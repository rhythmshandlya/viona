import { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { validateSession, validateSessionJwt, StytchSession } from '../services/stytch.js';
import { db, users, User } from '../db/index.js';
import { logger } from '../logger.js';

const isDevMode = !process.env.RAILWAY_ENVIRONMENT && !process.env.STYTCH_PROJECT_ID;
const isNonProduction = !process.env.RAILWAY_ENVIRONMENT;

// Dev bypass: resolve a user for non-production auth bypass
const _devBypassCache = new Map<string, User>();
export async function getDevBypassUser(email?: string): Promise<User | null> {
  if (!isNonProduction) return null;
  const key = email || '_default';
  if (_devBypassCache.has(key)) return _devBypassCache.get(key)!;
  let user: User | undefined;
  if (email) {
    user = await db.query.users.findFirst({ where: eq(users.email, email) });
  }
  if (!user) {
    user = await db.query.users.findFirst();
  }
  if (user) { _devBypassCache.set(key, user); return user; }
  return null;
}

/** Check if a request has a dev bypass signal (cookie or header) */
function hasDevBypass(request: FastifyRequest): boolean {
  if (!isNonProduction) return false;
  const cookie = (request.cookies as Record<string, string>)?.stytch_session;
  if (cookie === 'dev-bypass') return true;
  if (request.headers['x-dev-bypass']) return true;
  return false;
}

/** Extract dev bypass email from request */
function getDevBypassEmail(request: FastifyRequest): string | undefined {
  const header = request.headers['x-dev-bypass'] as string;
  if (header && header.includes('@')) return header;
  // Default email for cookie-only bypass (video/audio elements can't send headers)
  const cookie = (request.cookies as Record<string, string>)?.stytch_session;
  if (cookie === 'dev-bypass') return process.env.DEV_BYPASS_EMAIL || 'armaanbgp@gmail.com';
  return undefined;
}

// Dev-only: get or create a local dev user, bypassing Stytch
let _devUser: User | null = null;
async function getOrCreateDevUser(): Promise<User> {
  if (_devUser) return _devUser;
  const realUser = await db.query.users.findFirst();
  if (realUser) { _devUser = realUser; return realUser; }
  const devStytchId = 'dev-user-local';
  const [newUser] = await db.insert(users).values({
    stytchUserId: devStytchId,
    email: 'dev@localhost',
    name: 'Dev User',
  }).returning();
  logger.info('Created local dev user');
  _devUser = newUser;
  return newUser;
}

// FastifyRequest augmentation is in src/fastify.d.ts

/**
 * Extract session token from request
 * Checks Authorization header (Bearer token) or session cookie
 */
function extractSessionToken(request: FastifyRequest): { token: string; isJwt: boolean } | null {
  // Check Authorization header first
  const authHeader = request.headers.authorization;
  if (authHeader) {
    const [type, token] = authHeader.split(' ');
    if (type === 'Bearer' && token) {
      // JWTs start with 'eyJ', session tokens start with something else
      const isJwt = token.startsWith('eyJ');
      return { token, isJwt };
    }
  }

  // Check session cookie
  const sessionToken = (request.cookies as Record<string, string>)?.stytch_session_token;
  if (sessionToken) {
    return { token: sessionToken, isJwt: false };
  }

  const sessionJwt = (request.cookies as Record<string, string>)?.stytch_session_jwt;
  if (sessionJwt) {
    return { token: sessionJwt, isJwt: true };
  }

  return null;
}

/**
 * Get or create a user from Stytch session data
 */
async function getOrCreateUser(session: StytchSession): Promise<User> {
  // Try to find existing user
  const existingUser = await db.query.users.findFirst({
    where: eq(users.stytchUserId, session.userId),
  });

  if (existingUser) {
    // Update user info if changed
    if (existingUser.email !== session.email ||
        (session.name && existingUser.name !== session.name)) {
      const [updated] = await db.update(users)
        .set({
          email: session.email,
          name: session.name || existingUser.name,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();
      return updated;
    }
    return existingUser;
  }

  // Create new user
  const [newUser] = await db.insert(users).values({
    stytchUserId: session.userId,
    email: session.email,
    name: session.name,
  }).returning();

  return newUser;
}

/**
 * Auth middleware - requires authentication
 * Use as preHandler on protected routes
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Dev bypass: no Stytch configured, or dev-bypass cookie/header (non-production)
  if (isDevMode || hasDevBypass(request)) {
    const user = await getDevBypassUser(getDevBypassEmail(request)) || await getOrCreateDevUser();
    request.user = user;
    request.stytchSession = { sessionId: 'dev-bypass', userId: user.stytchUserId ?? 'dev', email: user.email };
    return;
  }

  const tokenInfo = extractSessionToken(request);

  if (!tokenInfo) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'No session token provided'
    });
  }

  // Validate session with Stytch
  const session = tokenInfo.isJwt
    ? await validateSessionJwt(tokenInfo.token)
    : await validateSession(tokenInfo.token);

  if (!session) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired session'
    });
  }

  // Get or create user in our database
  const user = await getOrCreateUser(session);

  // Attach user and session to request
  request.user = user;
  request.stytchSession = session;
}

/**
 * Optional auth middleware - populates user if authenticated but doesn't require it
 * Use for routes that behave differently for authenticated vs anonymous users
 */
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  if (isDevMode || hasDevBypass(request)) {
    const user = await getDevBypassUser(getDevBypassEmail(request)) || await getOrCreateDevUser();
    request.user = user;
    request.stytchSession = { sessionId: 'dev-bypass', userId: user.stytchUserId ?? 'dev', email: user.email };
    return;
  }

  const tokenInfo = extractSessionToken(request);

  if (!tokenInfo) {
    return; // No token, continue without user
  }

  const session = tokenInfo.isJwt
    ? await validateSessionJwt(tokenInfo.token)
    : await validateSession(tokenInfo.token);

  if (!session) {
    return; // Invalid token, continue without user
  }

  try {
    const user = await getOrCreateUser(session);
    request.user = user;
    request.stytchSession = session;
  } catch (error) {
    // Failed to get/create user, continue without
    logger.warn({ err: error }, 'Failed to get/create user');
  }
}
