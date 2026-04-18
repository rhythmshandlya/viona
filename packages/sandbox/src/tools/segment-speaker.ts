// packages/sandbox/src/tools/segment-speaker.ts
//
// MCP tool that dispatches a speaker-segmentation (RVM) job to the API's
// inference router, waits for terminal status via SSE, and downloads the
// produced artifacts (matte, foreground, bbox JSON, proxy matte/fgr) into
// the sandbox workspace.
//
// TODO: surface mid-run `progress` SSE events to the user via MCP
// `report_progress`. The current wrapTool() signature only provides
// (input → Promise<string>), so there's no callback to bubble events up.
// Until the wrapper is extended, this tool blocks silently until the job
// reaches `complete` / `error` / `timed_out`.

import { mkdirSync } from 'node:fs';
import { writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getMinioClient, BUCKET } from '../minio.js';

const API_BASE = process.env.API_CALLBACK_URL!;
const SANDBOX_ID = process.env.SANDBOX_ID!;
const SANDBOX_SECRET = process.env.SANDBOX_SECRET!;

interface Input {
  videoKey: string;
  ranges?: Array<{ startMs: number; endMs: number }>;
  params?: {
    backbone?: 'resnet50' | 'mobilenetv3';
    scale?: number;
    fps?: number;
    downsampleRatio?: number;
  };
  outputDir?: string;
}

interface TerminalEvent {
  jobId: string;
  status: 'completed' | 'failed' | 'timed_out';
  output?: {
    matteKey: string;
    fgrKey: string;
    bboxKey: string;
    proxyMatteKey: string;
    proxyFgrKey: string;
  };
  error?: { message: string };
}

async function dispatch(input: Input): Promise<{ jobId: string }> {
  const res = await fetch(`${API_BASE}/internal/sandbox/${SANDBOX_ID}/inference`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SANDBOX_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      capability: 'segment-speaker',
      input: {
        videoKey: input.videoKey,
        ranges: input.ranges,
        params: input.params ?? {},
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`dispatch failed: ${res.status} ${body}`);
  }
  return (await res.json()) as { jobId: string };
}

/**
 * Open an SSE stream for the given jobId and wait until we see a terminal
 * event (`complete` or `error`). Reconnects up to 3 times on transport
 * failures (fetch errors, premature stream close). Terminal events are
 * returned immediately — they don't trigger retry.
 */
async function waitForTerminal(jobId: string): Promise<TerminalEvent> {
  const url = `${API_BASE}/internal/sandbox/${SANDBOX_ID}/inference/${jobId}/stream`;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${SANDBOX_SECRET}` },
      });
      if (!res.ok || !res.body) {
        throw new Error(`stream failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const events = buf.split('\n\n');
        buf = events.pop() ?? '';

        for (const block of events) {
          if (!block.trim()) continue;
          const eventMatch = block.match(/^event: (\w+)$/m);
          const dataMatch = block.match(/^data: (.+)$/m);
          if (!eventMatch || !dataMatch) continue;

          const kind = eventMatch[1];
          const data = JSON.parse(dataMatch[1]);

          if (kind === 'complete' || kind === 'error') {
            return data as TerminalEvent;
          }
          // `progress` and other events: swallow for now (see TODO at top).
        }
      }
      // Stream closed without a terminal event — treat as transport failure.
      throw new Error('stream ended without terminal event');
    } catch (err) {
      lastErr = err;
      if (attempt === 2) break;
      // Exponential backoff: 1s, 2s, 4s.
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`segment_speaker stream failed after 3 attempts`);
}

async function downloadObject(key: string, destPath: string): Promise<void> {
  const minio = getMinioClient();
  mkdirSync(dirname(destPath), { recursive: true });
  const stream = await minio.getObject(BUCKET, key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  await writeFile(destPath, Buffer.concat(chunks));
}

export const segmentSpeakerTool = {
  name: 'segment_speaker',
  description:
    'Segments the speaker in a video using RVM (running on GPU via RunPod). Returns paths to matte, foreground, and per-frame bounding box JSON. Use this when you need speaker silhouette data for depth compositing or positioning.',
  input_schema: {
    type: 'object' as const,
    properties: {
      videoKey: {
        type: 'string',
        description:
          'MinIO key of the source video (e.g. "uploads/abc/source.mp4"). Typically comes from the project manifest.',
      },
      ranges: {
        type: 'array',
        description:
          'Optional. List of time ranges (objects with startMs and endMs) to segment. If omitted, segments the entire video.',
      },
      params: {
        type: 'object',
        description:
          'Optional tuning knobs: backbone (resnet50|mobilenetv3), scale, fps, downsampleRatio.',
      },
      outputDir: {
        type: 'string',
        description:
          'Workspace dir where output files will be written (defaults to /workspace/public/matte).',
      },
    },
    required: ['videoKey'],
  },
  async execute(input: Input): Promise<string> {
    const outputDir = input.outputDir ?? '/workspace/public/matte';
    // Ensure output dir exists up front so download failures surface cleanly.
    mkdirSync(outputDir, { recursive: true });

    const { jobId } = await dispatch(input);
    const terminal = await waitForTerminal(jobId);

    if (terminal.status !== 'completed' || !terminal.output) {
      const reason =
        terminal.status === 'timed_out'
          ? 'job timed out before completing'
          : terminal.error?.message ?? terminal.status;
      throw new Error(`segment_speaker failed (jobId=${jobId}): ${reason}`);
    }

    const mattePath = join(outputDir, 'matte.mp4');
    const fgrPath = join(outputDir, 'fgr.mp4');
    const bboxPath = join(outputDir, 'bbox.json');
    const proxyMattePath = join(outputDir, 'matte-proxy.mp4');
    const proxyFgrPath = join(outputDir, 'fgr-proxy.mp4');

    await Promise.all([
      downloadObject(terminal.output.matteKey, mattePath),
      downloadObject(terminal.output.fgrKey, fgrPath),
      downloadObject(terminal.output.bboxKey, bboxPath),
      downloadObject(terminal.output.proxyMatteKey, proxyMattePath),
      downloadObject(terminal.output.proxyFgrKey, proxyFgrPath),
    ]);

    const bbox = JSON.parse(await readFile(bboxPath, 'utf-8'));

    return JSON.stringify(
      {
        ok: true,
        jobId,
        mattePath,
        fgrPath,
        bboxPath,
        proxyMattePath,
        proxyFgrPath,
        aggregateBbox: bbox.aggregate,
        framesCount: bbox.frames?.length ?? 0,
      },
      null,
      2,
    );
  },
};
