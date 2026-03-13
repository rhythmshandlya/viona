import type { Request, Response, NextFunction } from 'express';

const SANDBOX_SECRET = process.env.SANDBOX_SECRET;

if (!SANDBOX_SECRET) {
  console.error('FATAL: SANDBOX_SECRET env var is required');
  process.exit(1);
}

/**
 * Validates Authorization: Bearer {secret} header on all incoming requests.
 * Rejects requests without valid secret.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization' });
    return;
  }

  const token = authHeader.slice(7);
  if (token !== SANDBOX_SECRET) {
    res.status(403).json({ error: 'Invalid secret' });
    return;
  }

  next();
}
