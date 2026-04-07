/**
 * Extract Stytch session token from cookies.
 * Prefers JWT (faster server-side validation) over opaque token.
 * Returns null if not authenticated or running on server.
 */
export function getSessionToken(): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const eqIndex = cookie.indexOf('=');
    if (eqIndex === -1) return acc;
    const key = cookie.slice(0, eqIndex).trim();
    const value = cookie.slice(eqIndex + 1).trim();
    if (key) acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  // Dev bypass: when stytch_session cookie is 'dev-bypass', return it as the token
  // so WebSocket and API calls can authenticate without Stytch
  if (cookies['stytch_session'] === 'dev-bypass') {
    return 'dev-bypass';
  }

  return cookies['stytch_session_jwt'] || cookies['stytch_session_token'] || null;
}
