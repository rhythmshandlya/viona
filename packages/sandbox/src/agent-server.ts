import express from 'express';
import pino from 'pino';
import { authMiddleware } from './auth.js';
import { isInitialized, initWorkspace, ensureNodeModulesSymlink } from './workspace-init.js';
import { startWatcher, onBundle, getBundleVersion } from './esbuild-watcher.js';
import { checkpoint, startCheckpointing } from './manifest-checkpoint.js';
import { triggerRebuildTool } from './tools/trigger-rebuild.js';
import { renderStillTool } from './tools/render-still.js';
import { readManifestTool, updateManifestTool } from './tools/manifest-ops.js';

const logger = pino({ name: 'agent-server' });

const API_CALLBACK_URL = process.env.API_CALLBACK_URL;
const SANDBOX_ID = process.env.SANDBOX_ID;
const SANDBOX_SECRET = process.env.SANDBOX_SECRET;
const CHECKPOINT_INTERVAL = parseInt(process.env.CHECKPOINT_INTERVAL_MS || '60000', 10);

// Prompt queue — sequential execution per Ramp pattern
interface PromptRequest {
  prompt: string;
  conversationId?: string;
  resolve: (value: void) => void;
}

const promptQueue: PromptRequest[] = [];
let processing = false;

async function processNext(): Promise<void> {
  if (promptQueue.length === 0) {
    processing = false;
    return;
  }

  processing = true;
  const req = promptQueue.shift()!;

  try {
    // TODO: Phase 1 — integrate Agent SDK here
    // For now, this is a stub that acknowledges the prompt
    logger.info({ prompt: req.prompt.slice(0, 100) }, 'Processing prompt');

    // The actual Agent SDK integration will:
    // 1. Create/resume Agent with system prompt from /workspace/.claude/
    // 2. Run agent turn with prompt + custom tools
    // 3. Stream events to the response
    // 4. Checkpoint manifest after completion

    await checkpoint();
  } catch (err) {
    logger.error({ err }, 'Prompt processing failed');
  } finally {
    req.resolve();
    processNext();
  }
}

function enqueuePrompt(prompt: string, conversationId?: string): Promise<void> {
  return new Promise((resolve) => {
    promptQueue.push({ prompt, conversationId, resolve });
    if (!processing) processNext();
  });
}

/**
 * Start the agent HTTP server on the given port.
 */
export function startAgentServer(port = 8081): void {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Health check — no auth
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', queueLength: promptQueue.length, processing });
  });

  // All other routes require auth
  app.use(authMiddleware);

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

  // Prompt endpoint — enqueue and process sequentially
  app.post('/prompt', async (req, res) => {
    const { prompt, conversationId } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }

    // For Phase 1: simple acknowledgement
    // TODO: Replace with SSE streaming when Agent SDK is integrated
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial event
    res.write(`data: ${JSON.stringify({ type: 'agent:progress', message: 'Processing...' })}\n\n`);

    await enqueuePrompt(prompt, conversationId);

    // Send completion event
    res.write(`data: ${JSON.stringify({ type: 'agent:complete', filesChanged: [] })}\n\n`);
    res.end();
  });

  // Status endpoint
  app.get('/status', (_req, res) => {
    res.json({
      queueLength: promptQueue.length,
      processing,
      bundleVersion: getBundleVersion(),
    });
  });

  app.listen(port, '0.0.0.0', () => {
    logger.info({ port }, 'Agent server started');
  });
}
