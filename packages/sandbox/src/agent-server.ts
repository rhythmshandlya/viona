import express from 'express';
import pino from 'pino';
import { authMiddleware } from './auth.js';
import { isInitialized, initWorkspace, ensureNodeModulesSymlink } from './workspace-init.js';
import { startWatcher, onBundle, getBundleVersion } from './esbuild-watcher.js';
import { checkpoint, startCheckpointing } from './manifest-checkpoint.js';
import { readManifestRaw, updateManifestTool } from './tools/manifest-ops.js';
import { mountOpsEndpoint } from './ops-endpoint.js';
import { runOrchestrator, type OrchestratorRequest } from './orchestrator.js';
import { createMcpServers } from './mcp-servers.js';
import { renderVideo } from './tools/render-video.js';

const logger = pino({ name: 'agent-server' });

const API_CALLBACK_URL = process.env.API_CALLBACK_URL;
const SANDBOX_ID = process.env.SANDBOX_ID;
const SANDBOX_SECRET = process.env.SANDBOX_SECRET;
const CHECKPOINT_INTERVAL = parseInt(process.env.CHECKPOINT_INTERVAL_MS || '60000', 10);

let currentAbortController: AbortController | null = null;

/**
 * Start the agent HTTP server on the given port.
 */
export function startAgentServer(port = 8081): void {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Health check — no auth
  // Returns initialized flag so provider can distinguish "server alive" from "workspace ready"
  app.get('/health', async (_req, res) => {
    const initialized = await isInitialized();
    res.json({ status: 'ok', initialized });
  });

  // All other routes require auth
  app.use(authMiddleware);

  // Granular manifest operations endpoint
  mountOpsEndpoint(app);

  // Init endpoint — first boot only
  app.post('/init', async (req, res) => {
    const already = await isInitialized();
    if (already) {
      res.status(409).json({ error: 'Already initialized' });
      return;
    }

    try {
      await initWorkspace(req.body);
      await ensureNodeModulesSymlink();

      // Start esbuild watcher now that we have src/ files
      onBundle((version) => {
        // Notify API of bundle ready
        if (API_CALLBACK_URL && SANDBOX_ID) {
          fetch(`${API_CALLBACK_URL}/internal/sandbox/${SANDBOX_ID}/bundle-ready`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SANDBOX_SECRET}`,
            },
            body: JSON.stringify({ version }),
          }).catch(() => {});
        }
      });
      await startWatcher();
      startCheckpointing(CHECKPOINT_INTERVAL);

      res.json({ ok: true });
    } catch (err: any) {
      logger.error({ err }, 'Init failed');
      res.status(500).json({ error: err.message });
    }
  });

  // Prompt endpoint — streams orchestrator output via SSE
  app.post('/prompt', async (req: express.Request, res: express.Response) => {
    const body = req.body as OrchestratorRequest;
    if (!body.prompt || typeof body.prompt !== 'string') {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    let eventId = 0;
    const sendSSE = (event: string, data: unknown) => {
      eventId++;
      res.write(`id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => sendSSE('heartbeat', {}), 15000);

    // Wire cancellation to connection close — use res.on('close') not req.on('close')
    // because Express 4.x fires req 'close' when the request body finishes reading
    // (immediately for POST), not when the client disconnects.
    const abortController = new AbortController();
    currentAbortController = abortController;
    res.on('close', () => abortController.abort());

    const mcpServers = createMcpServers({
      onWidget: (widget) => sendSSE('widget', widget),
      onProgress: (progress) => sendSSE('progress', progress),
    });

    try {
      await runOrchestrator(body, {
        onText: (text) => sendSSE('text', { text }),
        onWidget: (widget) => sendSSE('widget', widget),
        onProgress: (progress) => sendSSE('progress', progress),
        onDone: async (result) => {
          sendSSE('done', result);
          await checkpoint();
        },
        onError: (error) => sendSSE('error', { message: error }),
        signal: abortController.signal,
      }, mcpServers);
    } catch (err) {
      sendSSE('error', { message: err instanceof Error ? err.message : 'Internal error' });
    } finally {
      clearInterval(heartbeat);
      currentAbortController = null;
      res.end();
    }
  });

  // Cancel endpoint — aborts the current orchestrator run
  app.post('/cancel', (_req, res) => {
    if (currentAbortController) {
      currentAbortController.abort();
    }
    res.json({ ok: true });
  });

  // Status endpoint
  app.get('/status', (_req, res) => {
    res.json({
      bundleVersion: getBundleVersion(),
    });
  });

  // Manifest GET/PATCH — used by API proxy
  app.get('/manifest', async (_req, res) => {
    try {
      const content = await readManifestRaw();
      res.json(JSON.parse(content));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/manifest', async (req, res) => {
    const result = await updateManifestTool.execute({ manifest: req.body });
    res.json({ ok: true, message: result });
  });

  // Render endpoint — produces final MP4 from current workspace state
  app.post('/render', async (req, res) => {
    const { compositionId, crf, concurrency } = req.body || {};

    // SSE for progress
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    let eventId = 0;
    const sendSSE = (event: string, data: unknown) => {
      eventId++;
      res.write(`id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const heartbeat = setInterval(() => sendSSE('heartbeat', {}), 15000);

    try {
      sendSSE('progress', { phase: 'rendering', percent: 0, message: 'Starting Remotion render...' });

      const result = await renderVideo({
        compositionId,
        crf,
        concurrency,
        onProgress: (line) => {
          // Parse Remotion progress output
          const renderMatch = line.match(/Rendering frames.*?(\d+)%/);
          const stitchMatch = line.match(/Stitching.*?(\d+)%/);
          if (renderMatch) {
            const pct = parseInt(renderMatch[1], 10);
            sendSSE('progress', { phase: 'rendering', percent: Math.round(pct * 0.8), message: `Rendering frames... ${pct}%` });
          } else if (stitchMatch) {
            const pct = parseInt(stitchMatch[1], 10);
            sendSSE('progress', { phase: 'stitching', percent: 80 + Math.round(pct * 0.2), message: `Encoding video... ${pct}%` });
          }
        },
      });

      sendSSE('done', {
        outputPath: result.outputPath,
        durationMs: result.durationMs,
      });
    } catch (err) {
      sendSSE('error', { message: err instanceof Error ? err.message : 'Render failed' });
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  });

  app.listen(port, '0.0.0.0', () => {
    logger.info({ port }, 'Agent server started');
  });
}
