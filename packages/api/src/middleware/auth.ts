import { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { validateSession, validateSessionJwt, StytchSession } from '../services/stytch.js';
import { db, users, User } from '../db/index.js';
import { logger } from '../logger.js';

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
