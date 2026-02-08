import * as stytch from 'stytch';
import { config } from '../config.js';

// Initialize Stytch client
const stytchClient = new stytch.Client({
  project_id: config.stytch.projectId,
  secret: config.stytch.secret,
});

export interface StytchSession {
  sessionId: string;
  userId: string;
  email: string;
  name?: string;
}

/**
 * Validate a Stytch session token
 * Returns the session data if valid, null if invalid
 */
export async function validateSession(sessionToken: string): Promise<StytchSession | null> {
  try {
    const response = await stytchClient.sessions.authenticate({
      session_token: sessionToken,
    });

    if (!response.session || !response.user) {
      return null;
    }

    // Get the primary email
    const primaryEmail = response.user.emails?.find((e: { verified: boolean; email: string }) => e.verified)?.email ||
                         response.user.emails?.[0]?.email || '';

    return {
      sessionId: response.session.session_id,
      userId: response.user.user_id,
      email: primaryEmail,
      name: response.user.name?.first_name
        ? `${response.user.name.first_name} ${response.user.name.last_name || ''}`.trim()
        : undefined,
    };
  } catch (error) {
    // Session is invalid or expired
    console.error('Stytch session validation error:', error);
    return null;
  }
}

/**
 * Validate a Stytch session JWT
 * This is faster than token validation as it doesn't make a network call
 * But requires the session JWT instead of the session token
 */
export async function validateSessionJwt(sessionJwt: string): Promise<StytchSession | null> {
  try {
    // JWT authentication only returns session info, not user info
    // We need to use the regular authenticate method for full user data
    const response = await stytchClient.sessions.authenticate({
      session_jwt: sessionJwt,
    });

    if (!response.session || !response.user) {
      return null;
    }

    const primaryEmail = response.user.emails?.find((e: { verified: boolean; email: string }) => e.verified)?.email ||
                         response.user.emails?.[0]?.email || '';

    return {
      sessionId: response.session.session_id,
      userId: response.user.user_id,
      email: primaryEmail,
      name: response.user.name?.first_name
        ? `${response.user.name.first_name} ${response.user.name.last_name || ''}`.trim()
        : undefined,
    };
  } catch (error) {
    console.error('Stytch JWT validation error:', error);
    return null;
  }
}

export { stytchClient };
