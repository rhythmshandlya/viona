import express from 'express';
import { join } from 'path';
import { access } from 'fs/promises';
import pino from 'pino';
import { authMiddleware } from './auth.js';

const logger = pino({ name: 'file-server' });

const WORKSPACE = '/workspace';
const BUILD_DIR = join(WORKSPACE, '.build');
const PUBLIC_DIR = join(WORKSPACE, 'public');

/**
 * Start the file server on port 8080.
 * Serves:
 *   /bundle/*  → /workspace/.build/* (CJS bundle)
 *   /public/*  → /workspace/public/* (video, audio, user assets)
 *   /health    → 200 OK with initialized flag (no auth — used by provider health check)
 */
export function startFileServer(port = 8080): void {
  const app = express();

  // Health check — no auth (used by provider to detect readiness)
  // Returns initialized flag so provider can distinguish "server alive" from "workspace ready"
  app.get('/health', async (_req, res) => {
    let initialized = false;
    try {
      await access(join(WORKSPACE, 'manifest.json'));
      initialized = true;
    } catch {}
    res.json({ status: 'ok', initialized });
  });

  // All other routes require auth
  app.use(authMiddleware);

  // Serve bundle files
  app.use('/bundle', express.static(BUILD_DIR, {
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-cache');
    },
  }));

  // Serve public assets (video, audio, images)
  app.use('/public', express.static(PUBLIC_DIR, {
    setHeaders: (res, path) => {
      // Media files need streaming/seeking support
      if (/\.(mp4|webm|aac|m4a|mp3|wav)$/.test(path)) {
        res.setHeader('Accept-Ranges', 'bytes');
      }
    },
  }));

  // Serve render output files
  app.use('/output', express.static(join(WORKSPACE, 'output'), {
    setHeaders: (res, path) => {
      if (path.endsWith('.mp4')) {
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Accept-Ranges', 'bytes');
      }
    },
  }));

  app.listen(port, '0.0.0.0', () => {
    logger.info({ port }, 'File server started');
  });
}
