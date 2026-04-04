import express from 'express';
import pino from 'pino';
import { authMiddleware } from './auth.js';
import { isInitialized, initWorkspace, ensureNodeModulesSymlink, resetWorkspace } from './workspace-init.js';
import { startWatcher, onBundle, getBundleVersion } from './esbuild-watcher.js';
import { checkpoint, startCheckpointWatcher } from './checkpoint.js';
import { readManifestRaw, updateManifestTool } from './tools/manifest-ops.js';
import { mountOpsEndpoint } from './ops-endpoint.js';
import { syncAssets } from './asset-sync.js';
import { runOrchestrator, type OrchestratorRequest } from './orchestrator.js';
import { createMcpServers } from './mcp-servers.js';
import { renderVideo } from './tools/render-video.js';
import {
  startJob, getJobState, isJobBusy, onStateChange, failJob, updatePlan, updateWidget,
} from './job-state.js';
import { pushState, flushCallbacks } from './api-callback.js';

const logger = pino({ name: 'agent-server' });

const API_CALLBACK_URL = process.env.API_CALLBACK_URL;
const SANDBOX_ID = process.env.SANDBOX_ID;
const SANDBOX_SECRET = process.env.SANDBOX_SECRET;

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

  // Internal sync-assets endpoint — no auth (localhost only, called by MCP servers after matte download)
  app.post('/sync-assets', async (_req, res) => {
    try {
      await syncAssets();
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, 'Asset sync failed');
      res.status(500).json({ error: 'sync failed' });
    }
  });

  // All other routes require auth
  app.use(authMiddleware);

  // Granular manifest operations endpoint
  mountOpsEndpoint(app);

  // Init endpoint — first boot only
  // Guard against concurrent init calls (retry logic can fire while init is running)
  let initInProgress = false;

  app.post('/init', async (req, res) => {
    const already = await isInitialized();
    if (already) {
      res.status(409).json({ error: 'Already initialized' });
      return;
    }

    if (initInProgress) {
      res.status(409).json({ error: 'Init already in progress' });
      return;
    }

    initInProgress = true;

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
      startCheckpointWatcher();

      res.json({ ok: true });
    } catch (err: any) {
      logger.error({ err }, 'Init failed');
      initInProgress = false;
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

    // Gate on workspace initialization — reject if init hasn't completed yet.
    // The API fires /init as fire-and-forget so /prompt can arrive before
    // the workspace is fully ready (video downloaded, git init, esbuild watcher).
    const initialized = await isInitialized();
    if (!initialized) {
      res.status(503).json({ error: 'Workspace not initialized yet', retryAfter: 3 });
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

      // Stream to connected SSE client
      // Skip 'plan'   — sent as 'agent_plan' via MCP callback
      // Skip 'text'   — sent directly via onText callback (avoids double-send)
      // Skip 'widget' — sent directly via onWidget callback (avoids double-send)
      // Skip 'done'   — sent directly via onDone callback (avoids double-send)
      // Skip 'error'  — sent directly via onError callback (avoids double-send)
      if (type !== 'plan' && type !== 'text' && type !== 'widget' && type !== 'done' && type !== 'error') {
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
      onWidget: (widget) => {
        updateWidget(widget);  // Tracks in job-state → triggers onStateChange → pushState to API
        sendSSE('widget', widget);
      },
      onProgress: (progress) => sendSSE('progress', progress),
      onPlan: (plan) => {
        updatePlan(plan);  // Tracks in job-state → triggers onStateChange → pushState to API
        sendSSE('agent_plan', plan);
      },
    });

    try {
      await runOrchestrator(body, {
        onText: (text) => sendSSE('text', { text }),
        onWidget: (widget) => {
          updateWidget(widget);  // Persist to job-state → pushState to API
          sendSSE('widget', widget);
        },
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
          failJob(error);
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

  // Reset endpoint — clears workspace back to post-init state, triggers rebuild
  app.post('/reset', async (_req, res) => {
    try {
      // Cancel active orchestrator first
      if (currentAbortController) {
        currentAbortController.abort();
        failJob('Reset by user');
        flushCallbacks();
        currentAbortController = null;
      }

      await resetWorkspace();

      // Trigger esbuild rebuild with clean workspace
      await startWatcher();

      res.json({ ok: true });
    } catch (err: any) {
      logger.error({ err }, 'Reset failed');
      res.status(500).json({ error: err.message });
    }
  });

  // Status endpoint — R4.1: returns ground-truth job state
  app.get('/status', (_req, res) => {
    const state = getJobState();
    res.json({
      bundleVersion: getBundleVersion(),
      busy: state?.isBusy ?? false,
      activeTasks: state?.activeTasks.filter(t => t.status === 'active') ?? [],
      plan: state?.plan ?? null,
      widget: state?.widget ?? null,
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
      // Retry once — atomic rename writes can briefly race with reads
      try {
        const retry = await readManifestRaw();
        res.json(JSON.parse(retry));
      } catch {
        res.status(500).json({ error: err.message });
      }
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

    res.on('close', () => { connectionAlive = false; });
    res.on('error', () => { connectionAlive = false; });

    const heartbeat = setInterval(() => sendSSE('heartbeat', {}), 15000);

    try {
      sendSSE('progress', { phase: 'bundling', percent: 0, message: 'Bundling project...' });

      const result = await renderVideo({
        compositionId,
        crf,
        concurrency,
        onProgress: (message) => {
          // Progress messages come directly from renderMedia's onProgress callback
          const percentMatch = message.match(/(\d+)%/);
          const percent = percentMatch ? parseInt(percentMatch[1], 10) : 0;
          const phase = message.includes('Bundle') ? 'bundling' : 'rendering';
          sendSSE('progress', { phase, percent, message });
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
      if (connectionAlive) {
        try { res.end(); } catch { /* already closed */ }
      }
    }
  });

  // Export bundle — bundles project, uploads to MinIO, returns key
  app.post('/export-bundle', async (req, res) => {
    try {
      const { bundle } = await import('@remotion/bundler');
      const { createReadStream, existsSync, copyFileSync, mkdirSync } = await import('fs');
      const { join } = await import('path');
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const { Client: MinioClient } = await import('minio');
      const { randomUUID } = await import('crypto');
      const execFileAsync = promisify(execFile);

      logger.info('Starting export bundle...');

      // Ensure manifest is in public/
      const publicDir = '/workspace/public';
      mkdirSync(publicDir, { recursive: true });
      if (existsSync('/workspace/manifest.json')) {
        copyFileSync('/workspace/manifest.json', join(publicDir, 'manifest.json'));
      }

      // Step 1: Bundle with Remotion
      const bundleLocation = await bundle({
        entryPoint: join('/workspace', 'src/Root.tsx'),
        webpackOverride: (config: any) => config,
        publicDir,
      });
      logger.info({ bundleLocation }, 'Bundle created');

      // Step 2: Tar the bundle (exclude large source media — worker downloads separately)
      // Keep matte/*.mp4 (small alpha videos needed for person compositing)
      const tarPath = '/tmp/export-bundle.tar.gz';
      await execFileAsync('tar', [
        '-czf', tarPath,
        '--dereference',
        '--exclude=./public/source.mp4', '--exclude=./public/audio.aac',
        '--exclude=*.webm',
        '-C', bundleLocation, '.',
      ], { timeout: 60_000 });

      // Step 3: Upload to MinIO
      const minio = new MinioClient({
        endPoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: parseInt(process.env.MINIO_PORT || '9000', 10),
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY || '',
        secretKey: process.env.MINIO_SECRET_KEY || '',
      });
      const bucket = process.env.MINIO_BUCKET || 'viona';
      const projectId = process.env.SANDBOX_ID || 'unknown';
      const bundleKey = `outputs/bundles/${projectId}/${randomUUID()}.tar.gz`;

      await minio.fPutObject(bucket, bundleKey, tarPath, {
        'Content-Type': 'application/gzip',
      });
      logger.info({ bundleKey }, 'Bundle uploaded to MinIO');

      // Step 4: Read manifest for the response
      const manifest = JSON.parse(
        (await import('fs')).readFileSync('/workspace/manifest.json', 'utf-8')
      );

      res.json({ bundleKey, manifest });
    } catch (err: any) {
      logger.error({ err }, 'Export bundle failed');
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(port, '0.0.0.0', () => {
    logger.info({ port }, 'Agent server started');
  });
}
