import express from 'express';
import { join } from 'path';
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
 *   /health    → 200 OK (no auth — used by provider health check)
 */
export function startFileServer(port = 8080): void {
  const app = express();

  // Health check — no auth (used by provider to detect readiness)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
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
      // Large files (video) need streaming support
      if (path.endsWith('.mp4') || path.endsWith('.webm')) {
        res.setHeader('Accept-Ranges', 'bytes');
      }
    },
  }));

  app.listen(port, '0.0.0.0', () => {
    logger.info({ port }, 'File server started');
  });
}
