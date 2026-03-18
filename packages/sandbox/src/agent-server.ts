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
import {
  startJob, getJobState, isJobBusy, onStateChange, failJob, updatePlan,
} from './job-state.js';
import { pushState, flushCallbacks } from './api-callback.js';

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
  // The orchestrator runs independently of the SSE connection: if the client
  // disconnects (page refresh, tab close) the orchestrator keeps running and
  // state is pushed to the API via callbacks.  Only /cancel stops it.
  app.post('/prompt', async (req: express.Request, res: express.Response) => {
    const body = req.body as OrchestratorRequest;
    if (!body.prompt || typeof body.prompt !== 'string') {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }

    // R1.6: reject if already busy
    if (isJobBusy()) {
      res.status(409).json({ error: 'Agent is already busy', busy: true });
      return;
    }

    // Initialize ground-truth job state
    startJob();

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    let eventId = 0;
    let connectionAlive = true;

    const sendSSE = (event: string, data: unknown) => {
      if (!connectionAlive) return;
      try {
        eventId++;
        res.write(`id: ${eventId}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {
        connectionAlive = false;
      }
    };

    // R1.3 / R1.4: disconnect does NOT abort the orchestrator
    res.on('close', () => {
      connectionAlive = false;
      logger.info('SSE client disconnected — orchestrator continues');
    });
    res.on('error', () => {
      connectionAlive = false;
      logger.warn('SSE connection error — orchestrator continues');
    });

    // R5.1: Heartbeat with activeTasks snapshot
    const heartbeat = setInterval(() => {
      const state = getJobState();
      sendSSE('heartbeat', {
        activeTasks: state?.activeTasks.filter(t => t.status === 'active') ?? [],
        busy: state?.isBusy ?? false,
      });
    }, 15000);

    // R1.5: AbortController only triggered by /cancel
    const abortController = new AbortController();
    currentAbortController = abortController;

    // Wire job-state changes → SSE stream + API callback
    const unsubscribe = onStateChange((type, data) => {
      // Push to API regardless of SSE connection
      pushState(type, data);

      // Stream to connected SSE client (skip 'plan' — it's sent as 'agent_plan' via MCP callback)
      if (type !== 'plan') {
        sendSSE(type, data);
      }

      // R5.4: Backward-compatible progress/activity events
      if (type === 'task_started') {
        const task = data as { agent: string; action: string; phase?: string; startedAt?: number };
        sendSSE('activity', { agent: task.agent, action: task.action, phase: task.phase, startedAt: task.startedAt });
        sendSSE('progress', { phase: task.action, percent: -1, message: `${task.agent}: ${task.action}` });
      } else if (type === 'task_updated') {
        const update = data as { id: string; action: string };
        sendSSE('activity', { agent: null, action: update.action });
        sendSSE('progress', { phase: update.action, percent: -1, message: update.action });
      }
    });

    const mcpServers = createMcpServers({
      onWidget: (widget) => sendSSE('widget', widget),
      onProgress: (progress) => sendSSE('progress', progress),
      onPlan: (plan) => {
        updatePlan(plan);  // Tracks in job-state → triggers onStateChange → pushState to API
        sendSSE('agent_plan', plan);
      },
    });

    try {
      await runOrchestrator(body, {
        onText: (text) => sendSSE('text', { text }),
        onWidget: (widget) => sendSSE('widget', widget),
        onProgress: (progress) => sendSSE('progress', progress),
        onActivity: (activity) => {
          sendSSE('activity', activity);
        },
        onDone: async (result) => {
          sendSSE('done', result);
          await checkpoint();
        },
        onError: (error) => {
          sendSSE('error', { message: error });
        },
        signal: abortController.signal,
      }, mcpServers);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Internal error';
      sendSSE('error', { message: msg });
      failJob(msg);
    } finally {
      clearInterval(heartbeat);
      unsubscribe();
      flushCallbacks();
      currentAbortController = null;

      // Safely close SSE if client is still connected
      if (connectionAlive) {
        try { res.end(); } catch { /* already closed */ }
      }
    }
  });

  // Cancel endpoint — the ONLY way to stop a running orchestrator (R1.5)
  app.post('/cancel', (_req, res) => {
    if (currentAbortController) {
      currentAbortController.abort();
      failJob('Cancelled by user');
      flushCallbacks();
      currentAbortController = null;
    }
    res.json({ ok: true });
  });

  // Status endpoint — R4.1: returns ground-truth job state
  app.get('/status', (_req, res) => {
    const state = getJobState();
    res.json({
      bundleVersion: getBundleVersion(),
      busy: state?.isBusy ?? false,
      activeTasks: state?.activeTasks.filter(t => t.status === 'active') ?? [],
      plan: state?.plan ?? null,
      startedAt: state?.startedAt ?? null,
      result: state?.result ?? null,
      error: state?.error ?? null,
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
