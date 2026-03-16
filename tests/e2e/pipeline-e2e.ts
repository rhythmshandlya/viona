#!/usr/bin/env tsx
/**
 * End-to-End Pipeline Test
 *
 * Exercises the full sandbox pipeline: Docker container → workspace init →
 * orchestrator prompt → SSE streaming → manifest output.
 *
 * Prerequisites:
 *   docker-compose up -d minio      (MinIO for video storage)
 *   docker build -t viona-sandbox:latest -f packages/sandbox/Dockerfile .
 *
 * Usage:
 *   pnpm tsx tests/e2e/pipeline-e2e.ts                     # auto-generates test video
 *   pnpm tsx tests/e2e/pipeline-e2e.ts tests/e2e/fixtures/my-video.mp4   # use your own
 *
 * Output:
 *   Workspace contents are copied to tests/e2e/output/{run-id}/
 *   Final manifest is printed to stdout.
 */

import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { join, resolve, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  mkdirSync, existsSync, rmSync, readFileSync, readdirSync,
  cpSync, writeFileSync, statSync,
} from 'fs';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Config ──────────────────────────────────────────────────────────────────

const ROOT = resolve(__dirname, '..', '..');
const FIXTURES_DIR = join(__dirname, 'fixtures');
const OUTPUT_DIR = join(__dirname, 'output');

const SANDBOX_IMAGE = process.env.SANDBOX_IMAGE || 'viona-sandbox:latest';
const SANDBOX_SECRET = randomUUID();

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000', 10);
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'viona';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'viona123';
const MINIO_BUCKET = 'viona';

// Timeout for the full pipeline (default: 45 minutes — agents take time)
const PIPELINE_TIMEOUT_MS = parseInt(process.env.PIPELINE_TIMEOUT_MS || '2700000', 10);

// ── Helpers ─────────────────────────────────────────────────────────────────

let containerName: string | null = null;
let workspacePath: string | null = null;

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function logSection(title: string) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(60)}\n`);
}

async function cleanup() {
  if (containerName) {
    log(`Cleaning up container: ${containerName}`);
    try { execFileSync('docker', ['rm', '-f', containerName]); } catch {}
  }
}

process.on('SIGINT', async () => { await cleanup(); process.exit(1); });
process.on('SIGTERM', async () => { await cleanup(); process.exit(1); });

// ── Step 1: Find or generate test video ─────────────────────────────────────

async function getTestVideo(): Promise<string> {
  // Check CLI arg
  const argVideo = process.argv[2];
  if (argVideo) {
    const abs = resolve(argVideo);
    if (!existsSync(abs)) throw new Error(`Video not found: ${abs}`);
    log(`Using provided video: ${abs}`);
    return abs;
  }

  // Check fixtures/ for any video file
  const VIDEO_EXTS = ['.mp4', '.mov', '.mkv', '.webm', '.avi'];
  if (existsSync(FIXTURES_DIR)) {
    const videos = readdirSync(FIXTURES_DIR).filter(f =>
      VIDEO_EXTS.some(ext => f.toLowerCase().endsWith(ext))
    );
    if (videos.length > 0) {
      const found = join(FIXTURES_DIR, videos[0]);
      log(`Using fixture video: ${found}`);
      return found;
    }
  }

  // Generate a 5-second test video with ffmpeg
  log('No video found — generating 5s test video with ffmpeg...');
  mkdirSync(FIXTURES_DIR, { recursive: true });
  const testVideo = join(FIXTURES_DIR, 'test-5s.mp4');

  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'color=c=0x1a1a2e:s=1920x1080:d=5:r=30',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=5',
    '-vf', `drawtext=text='VIONA E2E TEST':fontsize=72:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2`,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
    '-c:a', 'aac', '-b:a', '64k',
    '-pix_fmt', 'yuv420p',
    '-shortest',
    testVideo,
  ], { timeout: 30_000 });

  log(`Generated: ${testVideo}`);
  return testVideo;
}

// ── Step 2: Ensure MinIO bucket + upload video ──────────────────────────────

async function uploadToMinio(videoPath: string): Promise<string> {
  log('Checking MinIO connectivity...');

  // Health check
  try {
    const res = await fetch(`http://${MINIO_ENDPOINT}:${MINIO_PORT}/minio/health/live`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`MinIO health: ${res.status}`);
  } catch (err) {
    throw new Error(
      `MinIO not reachable at ${MINIO_ENDPOINT}:${MINIO_PORT}. Run: docker-compose up -d minio`
    );
  }

  // Use mc (MinIO client) via Docker to create bucket + upload
  // This avoids needing the minio npm package in devDeps
  const minioAlias = `http://${MINIO_ENDPOINT}:${MINIO_PORT}`;
  const objectKey = `e2e-test/${randomUUID()}/${basename(videoPath)}`;

  // Create bucket if not exists (ignore errors if already exists)
  try {
    await execFileAsync('docker', [
      'run', '--rm', '--network', 'host',
      'minio/mc:latest',
      'mb', '--ignore-existing', `myminio/${MINIO_BUCKET}`,
    ], { timeout: 15_000, env: { ...process.env } });
  } catch {
    // mc alias may not be set — set it first
    log('Setting up MinIO client alias...');
  }

  // Upload using a simple HTTP PUT (MinIO supports it with path-style)
  const videoData = readFileSync(videoPath);
  const uploadUrl = `http://${MINIO_ENDPOINT}:${MINIO_PORT}/${MINIO_BUCKET}/${objectKey}`;

  // Ensure bucket exists via S3 API
  try {
    await fetch(`http://${MINIO_ENDPOINT}:${MINIO_PORT}/${MINIO_BUCKET}`, {
      method: 'PUT',
      headers: {
        'Authorization': `AWS ${MINIO_ACCESS_KEY}:${MINIO_SECRET_KEY}`,
      },
      signal: AbortSignal.timeout(5000),
    });
  } catch {}

  // Use the minio npm package via a quick inline script (already available in node_modules)
  const uploadScript = `
    const { Client } = require('minio');
    const fs = require('fs');
    const mc = new Client({
      endPoint: '${MINIO_ENDPOINT}',
      port: ${MINIO_PORT},
      useSSL: false,
      accessKey: '${MINIO_ACCESS_KEY}',
      secretKey: '${MINIO_SECRET_KEY}',
    });
    (async () => {
      try { await mc.makeBucket('${MINIO_BUCKET}'); } catch(e) { if (e.code !== 'BucketAlreadyOwnedByYou') throw e; }
      await mc.fPutObject('${MINIO_BUCKET}', '${objectKey}', '${videoPath.replace(/\\/g, '\\\\')}');
      console.log('uploaded');
    })().catch(e => { console.error(e); process.exit(1); });
  `;

  const { stdout } = await execFileAsync('node', ['-e', uploadScript], {
    timeout: 30_000,
    cwd: ROOT,
  });

  if (!stdout.includes('uploaded')) {
    throw new Error('MinIO upload failed');
  }

  log(`Video uploaded to MinIO: ${objectKey}`);
  return objectKey;
}

// ── Step 3: Start sandbox container ─────────────────────────────────────────

async function startSandbox(projectId: string): Promise<{ agentUrl: string }> {
  containerName = `e2e-test-${projectId}`;
  workspacePath = join(ROOT, '.sandbox-workspaces', `e2e-${projectId}`);

  // Clean up any previous run
  try { execFileSync('docker', ['rm', '-f', containerName]); } catch {}
  mkdirSync(workspacePath, { recursive: true });

  log(`Starting sandbox container: ${containerName}`);

  const port = 18200 + Math.floor(Math.random() * 100);

  const args = [
    'run', '-d', '--name', containerName,
    '-v', `${workspacePath}:/workspace`,
    '-p', `${port}:8081`,
    '-e', `SANDBOX_SECRET=${SANDBOX_SECRET}`,
    '-e', `SANDBOX_ID=${projectId}`,
    '-e', `MINIO_ENDPOINT=host.docker.internal`,
    '-e', `MINIO_PORT=${MINIO_PORT}`,
    '-e', `MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}`,
    '-e', `MINIO_SECRET_KEY=${MINIO_SECRET_KEY}`,
    '-e', `MINIO_BUCKET=${MINIO_BUCKET}`,
    '-e', `MINIO_USE_SSL=false`,
    '-e', `CHECKPOINT_INTERVAL_MS=999999`,
  ];

  // Mount Claude credentials for Agent SDK
  const claudeDir = join(process.env.HOME || process.env.USERPROFILE || '', '.claude');
  if (existsSync(claudeDir)) {
    args.push('-v', `${claudeDir}:/home/sandbox/.claude`);
  }

  args.push(SANDBOX_IMAGE);

  const { stdout } = await execFileAsync('docker', args);
  log(`Container started: ${stdout.trim().slice(0, 12)}`);

  const agentUrl = `http://localhost:${port}`;

  // Wait for health
  log('Waiting for sandbox health check...');
  const start = Date.now();
  while (Date.now() - start < 60_000) {
    try {
      const res = await fetch(`${agentUrl}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        log('Sandbox is healthy');
        return { agentUrl };
      }
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }

  // Dump logs on failure
  try {
    const { stdout: logs } = await execFileAsync('docker', ['logs', '--tail', '30', containerName]);
    console.error('\nContainer logs:\n', logs);
  } catch {}

  throw new Error('Sandbox did not become healthy within 60s');
}

// ── Step 4: Initialize workspace ────────────────────────────────────────────

async function initWorkspace(agentUrl: string, videoKey: string): Promise<void> {
  log('Sending /init to sandbox...');

  const manifest = {
    version: 2,
    fps: 30,
    durationMs: 5000,
    canvas: { width: 1920, height: 1080 },
    tracks: [
      { id: 'video-main', type: 'video', name: 'Video', position: 0 },
      { id: 'audio-main', type: 'audio', name: 'Audio', position: 1 },
    ],
    items: [
      {
        id: 'video-1',
        type: 'video',
        trackId: 'video-main',
        startMs: 0,
        endMs: 5000,
        data: {
          src: '/public/source.mp4',
          crop: { x: 0, y: 0, scale: 1 },
          volume: 1,
          playbackRate: 1,
        },
      },
      {
        id: 'audio-1',
        type: 'audio',
        trackId: 'audio-main',
        startMs: 0,
        endMs: 5000,
        data: {
          src: '/public/source.mp4',
          volume: 1,
          playbackRate: 1,
        },
      },
    ],
    assets: {},
    captionStyle: {
      fontSize: 32,
      fontFamily: 'Inter',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.7)',
      position: 'bottom',
    },
    videoSettings: {},
  };

  const initPayload = {
    videoUrl: videoKey,
    manifest,
    transcript: {
      words: [
        { text: 'This', startMs: 0, endMs: 500, confidence: 0.99 },
        { text: 'is', startMs: 500, endMs: 800, confidence: 0.99 },
        { text: 'a', startMs: 800, endMs: 1000, confidence: 0.99 },
        { text: 'test', startMs: 1000, endMs: 1500, confidence: 0.99 },
        { text: 'video', startMs: 1500, endMs: 2000, confidence: 0.99 },
        { text: 'for', startMs: 2500, endMs: 3000, confidence: 0.99 },
        { text: 'Viona', startMs: 3000, endMs: 3500, confidence: 0.99 },
        { text: 'pipeline', startMs: 3500, endMs: 4000, confidence: 0.99 },
        { text: 'testing', startMs: 4000, endMs: 4500, confidence: 0.99 },
      ],
      segments: [
        { text: 'This is a test video', startMs: 0, endMs: 2000 },
        { text: 'for Viona pipeline testing', startMs: 2500, endMs: 4500 },
      ],
      language: 'en',
    },
    userBrief: 'E2E test — generate a simple title card animation.',
    projectMeta: {
      width: 1920,
      height: 1080,
      fps: 30,
      durationMs: 5000,
    },
  };

  const res = await fetch(`${agentUrl}/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SANDBOX_SECRET}`,
    },
    body: JSON.stringify(initPayload),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`/init failed (${res.status}): ${body}`);
  }

  log('Workspace initialized');

  // Give esbuild watcher a moment to start
  await new Promise(r => setTimeout(r, 3000));
}

// ── Step 5: Run orchestrator prompt ─────────────────────────────────────────

interface PipelineResult {
  events: Array<{ event: string; data: unknown }>;
  textChunks: string[];
  progressUpdates: Array<{ phase: string; percent: number; message: string; agentName?: string }>;
  finalResult: { sessionId?: string; cost?: number } | null;
  error: string | null;
}

async function runPipeline(agentUrl: string): Promise<PipelineResult> {
  log('Sending prompt to orchestrator...');

  const promptBody = {
    prompt: 'Create a simple title card scene for this video. Keep it minimal — just one scene with the text "E2E Test" animated in. Skip brainstorming, go straight to planning and generation.',
    conversationHistory: [],
    projectContext: {
      canvasWidth: 1920,
      canvasHeight: 1080,
      fps: 30,
      durationMs: 5000,
      hasTranscript: true,
      theme: 'studio-dark',
      projectType: 'short_form',
    },
  };

  const res = await fetch(`${agentUrl}/prompt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SANDBOX_SECRET}`,
    },
    body: JSON.stringify(promptBody),
    signal: AbortSignal.timeout(PIPELINE_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`/prompt failed (${res.status}): ${body}`);
  }

  // Parse SSE stream
  const result: PipelineResult = {
    events: [],
    textChunks: [],
    progressUpdates: [],
    finalResult: null,
    error: null,
  };

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    let currentEvent = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        const dataStr = line.slice(6);
        try {
          const data = JSON.parse(dataStr);
          result.events.push({ event: currentEvent, data });

          switch (currentEvent) {
            case 'text':
              if (data.text) {
                result.textChunks.push(data.text);
                process.stdout.write(data.text);
              }
              break;

            case 'progress': {
              const p = data as { phase: string; percent: number; message: string; agentName?: string };
              result.progressUpdates.push(p);
              const agent = p.agentName ? ` [${p.agentName}]` : '';
              log(`PROGRESS: ${p.percent}% — ${p.phase}${agent} — ${p.message}`);
              break;
            }

            case 'done':
              result.finalResult = data;
              log(`DONE: sessionId=${data.sessionId || 'none'}`);
              break;

            case 'error':
              result.error = data.message || JSON.stringify(data);
              log(`ERROR: ${result.error}`);
              break;

            case 'widget':
              log(`WIDGET: ${JSON.stringify(data).slice(0, 100)}`);
              break;

            case 'heartbeat':
              break;

            default:
              break;
          }
        } catch {
          // Ignore malformed JSON
        }
      }
    }
  }

  return result;
}

// ── Step 5b: Render final MP4 ────────────────────────────────────────────────

async function renderVideo(agentUrl: string): Promise<{ outputPath: string; durationMs: number } | null> {
  log('Sending render request to sandbox...');

  const res = await fetch(`${agentUrl}/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SANDBOX_SECRET}`,
    },
    body: JSON.stringify({ compositionId: 'MainComposition', crf: 23, concurrency: 1 }),
    signal: AbortSignal.timeout(PIPELINE_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text();
    log(`/render failed (${res.status}): ${body}`);
    return null;
  }

  // Parse SSE stream from render endpoint
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let renderResult: { outputPath: string; durationMs: number } | null = null;
  let renderError: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let currentEvent = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          switch (currentEvent) {
            case 'progress':
              log(`RENDER: ${data.percent}% — ${data.message}`);
              break;
            case 'done':
              renderResult = { outputPath: data.outputPath, durationMs: data.durationMs };
              log(`RENDER DONE: ${data.outputPath} (${(data.durationMs / 1000).toFixed(1)}s)`);
              break;
            case 'error':
              renderError = data.message || JSON.stringify(data);
              log(`RENDER ERROR: ${renderError}`);
              break;
          }
        } catch {}
      }
    }
  }

  if (renderError) {
    log(`Render failed: ${renderError}`);
    return null;
  }

  return renderResult;
}

// ── Step 6: Collect and verify output ───────────────────────────────────────

interface TestResults {
  passed: number;
  failed: number;
  checks: Array<{ label: string; passed: boolean; detail?: string }>;
}

function verifyOutput(
  pipelineResult: PipelineResult,
  wsPath: string,
  renderResult: { outputPath: string; durationMs: number } | null,
): TestResults {
  const results: TestResults = { passed: 0, failed: 0, checks: [] };

  function check(label: string, condition: boolean, detail?: string) {
    results.checks.push({ label, passed: condition, detail });
    if (condition) {
      results.passed++;
      console.log(`  ✓ ${label}${detail ? ` (${detail})` : ''}`);
    } else {
      results.failed++;
      console.error(`  ✗ ${label}${detail ? ` (${detail})` : ''}`);
    }
  }

  logSection('Pipeline Results');

  // SSE event checks
  check('Received text events', pipelineResult.textChunks.length > 0,
    `${pipelineResult.textChunks.length} chunks`);
  check('Received progress events', pipelineResult.progressUpdates.length > 0,
    `${pipelineResult.progressUpdates.length} updates`);
  check('Pipeline completed (done event)', pipelineResult.finalResult !== null);
  check('No pipeline error', pipelineResult.error === null,
    pipelineResult.error || undefined);

  // Workspace file checks
  const manifestPath = join(wsPath, 'manifest.json');
  const manifestExists = existsSync(manifestPath);
  check('manifest.json exists', manifestExists);

  if (manifestExists) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      check('Manifest is valid JSON', true);
      check('Manifest has version', manifest.version === 2, `v${manifest.version}`);
      check('Manifest has tracks', Array.isArray(manifest.tracks) && manifest.tracks.length > 0,
        `${manifest.tracks?.length || 0} tracks`);
      check('Manifest has items', Array.isArray(manifest.items) && manifest.items.length > 0,
        `${manifest.items?.length || 0} items`);

      // Check for visual items (scenes generated by pipeline)
      const visualItems = manifest.items?.filter((i: any) => i.type === 'visual') || [];
      check('Visual items generated', visualItems.length > 0,
        `${visualItems.length} visual items`);

      if (visualItems.length > 0) {
        const firstVisual = visualItems[0];
        check('Visual item has sceneFile', !!firstVisual.data?.sceneFile,
          firstVisual.data?.sceneFile);
        // displayMode removed — visual items no longer carry this field
      }
    } catch (err) {
      check('Manifest is valid JSON', false, String(err));
    }
  }

  // Check scene files
  const scenesDir = join(wsPath, 'src', 'scenes');
  if (existsSync(scenesDir)) {
    const sceneFiles = readdirSync(scenesDir).filter(f => f.endsWith('.tsx'));
    check('Scene .tsx files generated', sceneFiles.length > 0,
      sceneFiles.join(', '));
  } else {
    check('Scene .tsx files generated', false, 'src/scenes/ directory not found');
  }

  // Check scene registry
  const registryPath = join(wsPath, 'src', 'scene-registry.ts');
  if (existsSync(registryPath)) {
    const registryContent = readFileSync(registryPath, 'utf-8');
    check('Scene registry exists', true);
    // After generation, registry should have imports (not just the empty stub)
    const hasImports = registryContent.includes('import') && registryContent.length > 150;
    check('Scene registry has imports', hasImports,
      `${registryContent.length} chars`);
  } else {
    check('Scene registry exists', false);
  }

  // Check plan file
  const planPath = join(wsPath, 'SCENE_PLAN.md');
  const planExists = existsSync(planPath);
  check('SCENE_PLAN.md generated', planExists);

  // Check transcript data
  const transcriptPath = join(wsPath, 'docs', 'transcript.json');
  check('Transcript file present', existsSync(transcriptPath));

  // Check source video was downloaded
  const videoPath = join(wsPath, 'public', 'source.mp4');
  check('Source video downloaded', existsSync(videoPath));

  // Render checks
  check('Render completed successfully', renderResult !== null);
  if (renderResult) {
    const renderedPath = join(wsPath, 'output', 'final.mp4');
    check('Rendered MP4 exists on host', existsSync(renderedPath),
      existsSync(renderedPath) ? `${(statSync(renderedPath).size / 1024 / 1024).toFixed(1)} MB` : undefined);
    check('Render time reasonable', renderResult.durationMs < 300_000,
      `${(renderResult.durationMs / 1000).toFixed(1)}s`);
  }

  return results;
}

// ── Step 7: Copy output for inspection ──────────────────────────────────────

function copyOutput(wsPath: string, runId: string) {
  const outputPath = join(OUTPUT_DIR, runId);
  mkdirSync(outputPath, { recursive: true });

  // Copy key files (not node_modules symlink)
  const filesToCopy = [
    'manifest.json',
    'SCENE_PLAN.md',
    'generation-progress.json',
  ];

  for (const file of filesToCopy) {
    const src = join(wsPath, file);
    if (existsSync(src)) {
      cpSync(src, join(outputPath, file));
    }
  }

  // Copy directories
  const dirsToCopy = ['src/scenes', 'docs'];
  for (const dir of dirsToCopy) {
    const src = join(wsPath, dir);
    if (existsSync(src)) {
      cpSync(src, join(outputPath, dir), { recursive: true });
    }
  }

  // Copy rendered MP4 if it exists
  const renderedMp4 = join(wsPath, 'output', 'final.mp4');
  if (existsSync(renderedMp4)) {
    cpSync(renderedMp4, join(outputPath, 'final.mp4'));
    log(`Rendered video: ${outputPath}/final.mp4 (${(statSync(renderedMp4).size / 1024 / 1024).toFixed(1)} MB)`);
  }

  log(`Output copied to: ${outputPath}`);
  return outputPath;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const runId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const projectId = `e2e-${runId}`;

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         VIONA PIPELINE — END-TO-END TEST                ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  log(`Run ID: ${runId}`);
  log(`Project ID: ${projectId}`);

  try {
    // Step 1: Get video
    logSection('Step 1: Prepare Test Video');
    const videoPath = await getTestVideo();

    // Step 2: Upload to MinIO
    logSection('Step 2: Upload Video to MinIO');
    const videoKey = await uploadToMinio(videoPath);

    // Step 3: Start sandbox
    logSection('Step 3: Start Sandbox Container');
    const { agentUrl } = await startSandbox(projectId);

    // Step 4: Init workspace
    logSection('Step 4: Initialize Workspace');
    await initWorkspace(agentUrl, videoKey);

    // Verify workspace was initialized
    const wsPath = workspacePath!;
    if (!existsSync(join(wsPath, 'manifest.json'))) {
      throw new Error('Workspace init failed — manifest.json not found');
    }
    log('Workspace files confirmed on host (bind mount working)');

    // Step 5: Run pipeline
    logSection('Step 5: Run Orchestrator Pipeline');
    console.log('\n--- Orchestrator Output ---\n');
    const pipelineResult = await runPipeline(agentUrl);
    console.log('\n\n--- End Output ---\n');

    // Step 5b: Render final MP4
    logSection('Step 5b: Render Final Video');
    let renderResult: { outputPath: string; durationMs: number } | null = null;
    if (!pipelineResult.error) {
      renderResult = await renderVideo(agentUrl);
    } else {
      log('Skipping render — pipeline had errors');
    }

    // Step 6: Verify output
    logSection('Step 6: Verify Output');
    const results = verifyOutput(pipelineResult, wsPath, renderResult);

    // Step 7: Copy output
    logSection('Step 7: Save Output');
    const outputPath = copyOutput(wsPath, runId);

    // Print manifest
    const manifestPath = join(wsPath, 'manifest.json');
    if (existsSync(manifestPath)) {
      logSection('Final Manifest');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      console.log(JSON.stringify(manifest, null, 2));
    }

    // Summary
    logSection('Results');
    console.log(`  Passed: ${results.passed}`);
    console.log(`  Failed: ${results.failed}`);
    console.log(`  Output: ${outputPath}`);

    if (results.failed > 0) {
      console.log('\n  Failed checks:');
      for (const c of results.checks) {
        if (!c.passed) console.log(`    - ${c.label}${c.detail ? `: ${c.detail}` : ''}`);
      }
    }

    console.log('');
    process.exitCode = results.failed > 0 ? 1 : 0;

  } catch (err) {
    console.error('\n\nFATAL ERROR:', err instanceof Error ? err.message : err);

    // Dump container logs on failure
    if (containerName) {
      try {
        const { stdout } = await execFileAsync('docker', ['logs', '--tail', '50', containerName]);
        console.error('\n--- Container Logs ---\n', stdout);
      } catch {}
    }

    process.exitCode = 2;
  } finally {
    await cleanup();
  }
}

main();
