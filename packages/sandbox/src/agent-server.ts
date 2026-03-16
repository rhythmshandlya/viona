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
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
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

    const mcpServers = createMcpServers(
      {
        onWidget: (widget) => sendSSE('widget', widget),
        onProgress: (progress) => sendSSE('progress', progress),
      },
      body.projectContext ? {
        canvasWidth: body.projectContext.canvasWidth,
        canvasHeight: body.projectContext.canvasHeight,
        fps: body.projectContext.fps,
        theme: body.projectContext.theme ?? 'studio-dark',
      } : undefined,
    );

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

  app.listen(port, '0.0.0.0', () => {
    logger.info({ port }, 'Agent server started');
  });
}
