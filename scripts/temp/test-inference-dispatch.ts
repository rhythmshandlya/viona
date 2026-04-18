/**
 * E2E test — full API inference dispatch path.
 *
 * Simulates what the sandbox MCP tool `segment_speaker`
 * (packages/sandbox/src/tools/segment-speaker.ts) does end-to-end, minus the
 * MinIO artifact download step:
 *
 *   1. POST /internal/sandbox/:id/inference (capability `segment-speaker`)
 *   2. Open SSE stream GET /internal/sandbox/:id/inference/:jobId/stream
 *   3. Log each event, exit on terminal
 *
 * This exercises the API dispatcher for whichever provider is configured
 * (`INFERENCE_PROVIDER=runpod` or `INFERENCE_PROVIDER=worker`). Use it to
 * validate the full path resolves correctly — artifact content/MinIO key
 * verification is a separate concern (manual Task 20).
 *
 * ----- Prerequisites -----
 *
 * Services running:
 *   - API:         pnpm -F @viona/api dev
 *   - Worker:      pnpm -F @viona/worker dev   (only when INFERENCE_PROVIDER=worker)
 *   - MinIO:       accessible at configured endpoint, TEST_VIDEO_KEY uploaded
 *   - Postgres + Redis
 *
 * Database:
 *   - A row in `sandbox_sessions` with a known id + sandboxSecret + projectId.
 *     The API validates Bearer == sandboxSecret for both routes.
 *
 * Environment variables for this script:
 *   API_URL               Base URL of the API (default: http://localhost:4000)
 *   TEST_SANDBOX_ID       UUID of a sandbox_sessions row (required)
 *   TEST_SANDBOX_SECRET   Bearer token matching that row's sandboxSecret (required)
 *   TEST_VIDEO_KEY        MinIO key of the test video (default: test/short-clip.mp4)
 *   TEST_TIMEOUT_MS       SSE wall-clock timeout (default: 1200000 = 20 min)
 *
 * ----- Run -----
 *
 *   pnpm tsx scripts/temp/test-inference-dispatch.ts
 *
 * ----- Exit codes -----
 *
 *   0  terminal `complete` event received (success)
 *   1  terminal `error` event received, OR dispatch returned non-2xx
 *   2  SSE transport failure (stream dropped before terminal)
 *   3  wall-clock timeout waiting for terminal event
 */

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const SANDBOX_ID = process.env.TEST_SANDBOX_ID;
const SANDBOX_SECRET = process.env.TEST_SANDBOX_SECRET;
const VIDEO_KEY = process.env.TEST_VIDEO_KEY ?? 'test/short-clip.mp4';
const TIMEOUT_MS = Number(process.env.TEST_TIMEOUT_MS ?? 20 * 60 * 1000);

function requireEnv(name: string, value: string | undefined): asserts value is string {
  if (!value) {
    console.error(
      `ERROR: environment variable ${name} is required but not set.\n` +
        `See the comment block at the top of this script for setup.`,
    );
    process.exit(1);
  }
}

requireEnv('TEST_SANDBOX_ID', SANDBOX_ID);
requireEnv('TEST_SANDBOX_SECRET', SANDBOX_SECRET);

interface DispatchResponse {
  jobId: string;
}

async function dispatch(): Promise<DispatchResponse> {
  const url = `${API_URL}/internal/sandbox/${SANDBOX_ID}/inference`;
  console.log(`[dispatch] POST ${url}`);
  console.log(`[dispatch] videoKey=${VIDEO_KEY}`);

  // Body shape MUST mirror packages/sandbox/src/tools/segment-speaker.ts
  // so behavior under test matches what the MCP tool actually sends.
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SANDBOX_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      capability: 'segment-speaker',
      input: {
        videoKey: VIDEO_KEY,
        params: {
          backbone: 'resnet50',
          scale: 0.5,
          downsampleRatio: 0.8,
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '<no body>');
    console.error(`[dispatch] FAILED ${res.status} ${res.statusText}`);
    console.error(`[dispatch] body: ${body}`);
    process.exit(1);
  }

  const json = (await res.json()) as Partial<DispatchResponse>;
  if (!json.jobId) {
    console.error(`[dispatch] response missing jobId: ${JSON.stringify(json)}`);
    process.exit(1);
  }
  console.log(`[dispatch] ok jobId=${json.jobId}`);
  return json as DispatchResponse;
}

/**
 * Stream SSE events from the API and process each until a terminal event
 * (`complete` or `error`) arrives. Exits the process directly on terminal
 * or failure. Mirrors the buffer/parse logic in
 * packages/sandbox/src/tools/segment-speaker.ts.
 */
async function streamUntilTerminal(jobId: string): Promise<never> {
  const url = `${API_URL}/internal/sandbox/${SANDBOX_ID}/inference/${jobId}/stream`;
  console.log(`[stream]   GET ${url}`);

  const ac = new AbortController();
  const timer = setTimeout(() => {
    console.error(`[stream]   TIMEOUT after ${TIMEOUT_MS}ms`);
    ac.abort();
    process.exit(3);
  }, TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${SANDBOX_SECRET}` },
      signal: ac.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    console.error(`[stream]   fetch failed: ${(err as Error).message}`);
    process.exit(2);
  }

  if (!res.ok || !res.body) {
    clearTimeout(timer);
    const body = await res.text().catch(() => '<no body>');
    console.error(`[stream]   non-2xx: ${res.status} ${res.statusText}`);
    console.error(`[stream]   body: ${body}`);
    process.exit(2);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch (err) {
      clearTimeout(timer);
      console.error(`[stream]   read error: ${(err as Error).message}`);
      process.exit(2);
    }
    if (chunk.done) break;
    buf += decoder.decode(chunk.value, { stream: true });

    // SSE frames are delimited by a blank line (`\n\n`). Keep the tail
    // (possibly partial) in `buf` for the next iteration.
    const events = buf.split('\n\n');
    buf = events.pop() ?? '';

    for (const block of events) {
      if (!block.trim()) continue;
      // Skip heartbeat comments (lines beginning with `:`).
      if (block.startsWith(':')) continue;

      const eventMatch = block.match(/^event: (\w+)$/m);
      const dataMatch = block.match(/^data: (.+)$/m);
      if (!eventMatch || !dataMatch) {
        console.warn(`[stream]   skipping malformed block: ${block.replace(/\n/g, '\\n')}`);
        continue;
      }

      const kind = eventMatch[1];
      let data: unknown;
      try {
        data = JSON.parse(dataMatch[1]);
      } catch {
        data = { raw: dataMatch[1] };
      }

      console.log(`[event]    ${kind} ${JSON.stringify(data)}`);

      if (kind === 'complete') {
        clearTimeout(timer);
        console.log(`[stream]   terminal=complete — exiting 0`);
        process.exit(0);
      }
      if (kind === 'error') {
        clearTimeout(timer);
        console.error(`[stream]   terminal=error — exiting 1`);
        process.exit(1);
      }
      // progress and anything else — keep going.
    }
  }

  // Stream closed without a terminal event.
  clearTimeout(timer);
  console.error(`[stream]   ended without terminal event — exiting 2`);
  process.exit(2);
}

async function main(): Promise<void> {
  console.log(`[main]     API_URL=${API_URL}`);
  console.log(`[main]     SANDBOX_ID=${SANDBOX_ID}`);
  console.log(`[main]     TIMEOUT_MS=${TIMEOUT_MS}`);

  const { jobId } = await dispatch();
  await streamUntilTerminal(jobId);
}

main().catch((err) => {
  console.error('[main]     unhandled error:', err);
  process.exit(1);
});
