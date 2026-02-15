import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { config } from '../config.js';

interface OAuthCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

const CREDENTIALS_PATHS = [
  join(process.env.USERPROFILE || process.env.HOME || '', '.claude', '.credentials.json'),
  join(process.env.USERPROFILE || process.env.HOME || '', '.claude', 'credentials.json'),
];

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

let cachedCredentials: OAuthCredentials | null = null;

function readCredentialsFile(): OAuthCredentials | null {
  for (const credPath of CREDENTIALS_PATHS) {
    if (existsSync(credPath)) {
      try {
        const raw = readFileSync(credPath, 'utf-8');
        const data = JSON.parse(raw);
        const oauth = data.claudeAiOauth;
        if (oauth?.accessToken) {
          return {
            accessToken: oauth.accessToken,
            refreshToken: oauth.refreshToken,
            expiresAt: oauth.expiresAt,
          };
        }
      } catch {
        // Continue to next path
      }
    }
  }
  return null;
}

async function refreshAccessToken(refreshToken: string): Promise<OAuthCredentials | null> {
  try {
    const response = await fetch('https://console.anthropic.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: data.expires_in
        ? Date.now() + data.expires_in * 1000
        : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Get a valid OAuth access token for the Anthropic API.
 * Priority: env var > credentials file. Auto-refreshes if expired.
 */
export async function getOAuthToken(): Promise<string | null> {
  // 1. Check environment variable
  if (config.anthropic.oauthToken) {
    return config.anthropic.oauthToken;
  }

  // 2. Use cached credentials if still valid
  if (cachedCredentials?.accessToken) {
    const needsRefresh = cachedCredentials.expiresAt &&
      Date.now() > cachedCredentials.expiresAt - REFRESH_BUFFER_MS;

    if (!needsRefresh) {
      return cachedCredentials.accessToken;
    }

    // Try to refresh
    if (cachedCredentials.refreshToken) {
      const refreshed = await refreshAccessToken(cachedCredentials.refreshToken);
      if (refreshed) {
        cachedCredentials = refreshed;
        return refreshed.accessToken;
      }
    }
  }

  // 3. Read from credentials file
  const fileCredentials = readCredentialsFile();
  if (fileCredentials) {
    cachedCredentials = fileCredentials;

    // Check if token needs refresh
    const needsRefresh = fileCredentials.expiresAt &&
      Date.now() > fileCredentials.expiresAt - REFRESH_BUFFER_MS;

    if (needsRefresh && fileCredentials.refreshToken) {
      const refreshed = await refreshAccessToken(fileCredentials.refreshToken);
      if (refreshed) {
        cachedCredentials = refreshed;
        return refreshed.accessToken;
      }
    }

    return fileCredentials.accessToken;
  }

  return null;
}

/**
 * Create an Anthropic SDK client config.
 * Returns { apiKey } or { authToken } depending on what's available.
 */
export async function getAnthropicAuth(): Promise<{ apiKey: string } | { authToken: string } | null> {
  // Prefer API key if set
  if (config.anthropic.apiKey) {
    return { apiKey: config.anthropic.apiKey };
  }

  // Fall back to OAuth token
  const oauthToken = await getOAuthToken();
  if (oauthToken) {
    return { authToken: oauthToken };
  }

  return null;
}
