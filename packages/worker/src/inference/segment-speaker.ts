import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { downloadFile, uploadFile } from '../services/minio.js';
import { logger } from '../logger.js';
import { runSubprocess } from '../utils/subprocess.js';

/**
 * Absolute path to the RVM segmentation script.
 *
 * The worker is started from `packages/worker/` in both dev (`tsx watch src/index.ts`)
 * and prod (`node dist/index.js`), so `process.cwd()` is stable. Going up two levels
 * reaches the monorepo root, then into `models/rvm/segment_person.py`.
 */
const SCRIPT_PATH = resolve(process.cwd(), '..', '..', 'models', 'rvm', 'segment_person.py');

/** Python resolution — matches the pattern used in src/processors/segmentation.ts. */
function resolvePythonPath(): string {
  return (
    process.env.PYTHON_PATH
    || (process.env.CONDA_PREFIX ? join(process.env.CONDA_PREFIX, 'python.exe') : null)
    || 'python'
  );
}

export interface SegmentSpeakerInput {
  videoKey: string;
  /** Optional time ranges (ms) where RVM inference is needed. Other frames get a black matte. */
  ranges?: Array<{ startMs: number; endMs: number }>;
  params?: {
    backbone?: 'resnet50' | 'mobilenetv3';
    scale?: number;
    fps?: number;
    downsampleRatio?: number;
  };
}

export interface InferenceOutcome {
  /** Canonical storage keys echoed back to the caller (e.g. { matteKey: "outputs/...", fgrKey: "outputs/..." }). */
  output: Record<string, string>;
  metrics: Record<string, unknown>;
}

/**
 * Local runner: downloads input, spawns segment_person.py, generates 480p proxies,
 * and uploads every produced artifact using the canonical keys from the registry.
 *
 * Output keys MUST match `cap.outputKeys(jobId, input)` so both the local runner
 * and a remote (RunPod) runner produce bit-identical MinIO paths.
 */
export async function run(
  jobId: string,
  input: SegmentSpeakerInput,
  outputKeys: Record<string, { key: string; contentType: string }>,
  executionTimeoutSec: number,
): Promise<InferenceOutcome> {
  if (!existsSync(SCRIPT_PATH)) {
    throw new Error(`segment_person.py not found at ${SCRIPT_PATH}`);
  }

  const workDir = mkdtempSync(join(tmpdir(), 'viona-infer-'));
  logger.info({ jobId, capability: 'segment-speaker', workDir }, 'segment-speaker runner started');

  try {
    const videoPath = join(workDir, 'source.mp4');
    const mattePath = join(workDir, 'matte.mp4');
    // segment_person.py writes the foreground alongside the matte as `<matte>-fgr.mp4`.
    const fgrPath = mattePath.replace(/\.mp4$/, '-fgr.mp4');
    // segment_person.py writes bbox data alongside the matte as `matte-bbox.json`.
    const bboxPath = join(workDir, 'matte-bbox.json');
    const proxyMattePath = join(workDir, 'matte-proxy.mp4');
    const proxyFgrPath = join(workDir, 'fgr-proxy.mp4');

    // 1. Download input video
    await downloadFile('uploads', input.videoKey, videoPath);

    // 2. Build segment_person.py args
    const pythonArgs: string[] = [
      SCRIPT_PATH,
      videoPath,
      '--output', mattePath,
      '--backbone', input.params?.backbone ?? 'resnet50',
      '--scale', String(input.params?.scale ?? 0.5),
      '--fps', String(input.params?.fps ?? 0),
      '--downsample-ratio', String(input.params?.downsampleRatio ?? 0.8),
    ];
    if (input.ranges?.length) {
      pythonArgs.push('--matte-ranges', JSON.stringify(input.ranges));
    }

    // 3. Spawn Python
    const pythonPath = resolvePythonPath();
    logger.info(
      { jobId, pythonPath, scriptPath: SCRIPT_PATH, videoPath, mattePath },
      'Spawning segment_person.py',
    );

    const t0 = Date.now();
    await runSubprocess({
      command: pythonPath,
      args: pythonArgs,
      timeoutMs: executionTimeoutSec * 1000,
      name: 'segment_person',
      onStdoutLine: (line) => {
        logger.debug({ jobId, name: 'segment_person', line: line.trim() }, 'Python stdout');
      },
      onStderrLine: (line) => {
        const trimmed = line.trim();
        if (trimmed) logger.warn({ jobId, name: 'segment_person', line: trimmed }, 'Python stderr');
      },
    });
    const durationMs = Date.now() - t0;

    // 4. ffmpeg proxies (480p h264, fast preset) — keyframe every 1s for editor seeking.
    if (existsSync(mattePath)) {
      try {
        await runSubprocess({
          command: 'ffmpeg',
          args: [
            '-y', '-i', mattePath,
            '-vf', 'scale=-2:480',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-an',
            '-force_key_frames', 'expr:gte(t,n_forced*1)',
            proxyMattePath,
          ],
          timeoutMs: 120_000,
          name: 'ffmpeg-matte-proxy',
        });
      } catch (err) {
        logger.warn({ jobId, err }, 'Matte proxy generation failed (non-critical)');
      }
    }

    if (existsSync(fgrPath)) {
      try {
        await runSubprocess({
          command: 'ffmpeg',
          args: [
            '-y', '-i', fgrPath,
            '-vf', 'scale=-2:480',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-an',
            '-force_key_frames', 'expr:gte(t,n_forced*1)',
            proxyFgrPath,
          ],
          timeoutMs: 120_000,
          name: 'ffmpeg-fgr-proxy',
        });
      } catch (err) {
        logger.warn({ jobId, err }, 'FGR proxy generation failed (non-critical)');
      }
    }

    // 5. Upload each requested artifact using canonical keys from the registry.
    const localPathByName: Record<string, string> = {
      matte: mattePath,
      fgr: fgrPath,
      bbox: bboxPath,
      proxyMatte: proxyMattePath,
      proxyFgr: proxyFgrPath,
    };

    const outputEcho: Record<string, string> = {};
    for (const [name, { key }] of Object.entries(outputKeys)) {
      const localPath = localPathByName[name];
      if (!localPath) {
        logger.warn({ jobId, name }, 'Unknown output name in outputKeys registry — skipping');
        continue;
      }
      if (!existsSync(localPath)) {
        logger.warn({ jobId, name, localPath }, 'Expected artifact missing on disk — skipping upload');
        continue;
      }
      await uploadFile('outputs', key, localPath);
      outputEcho[`${name}Key`] = `outputs/${key}`;
      logger.info({ jobId, name, key }, 'Artifact uploaded');
    }

    return {
      output: outputEcho,
      metrics: {
        durationMs,
        // TODO: parse "Processed N frames" lines from stdout if downstream needs it.
        framesProcessed: null,
      },
    };
  } finally {
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
