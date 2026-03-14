import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

const SANDBOX_SECRET = process.env.SANDBOX_SECRET;

if (!SANDBOX_SECRET) {
  console.error('FATAL: SANDBOX_SECRET env var is required');
  process.exit(1);
}

const secretBuffer = Buffer.from(SANDBOX_SECRET);

/**
 * Validates Authorization: Bearer {secret} header on all incoming requests.
 * Uses timing-safe comparison to prevent side-channel attacks.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization' });
    return;
  }

  const token = Buffer.from(authHeader.slice(7));
  if (token.length !== secretBuffer.length || !timingSafeEqual(token, secretBuffer)) {
    res.status(403).json({ error: 'Invalid secret' });
    return;
  }

  next();
}
