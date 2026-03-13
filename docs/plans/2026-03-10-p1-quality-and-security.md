# P1: Quality & Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix high-priority quality and security gaps — missing error boundaries, inconsistent logging, path traversal risk, missing request timeouts, and duplicated auth token parsing. These issues won't crash the system at scale but will cause poor UX, debugging blind spots, and security vulnerabilities.

**Architecture:** Changes span all 3 packages (API, Worker, Web). Tasks are independent — can be done in any order. Frontend changes are React component additions. Backend changes are logging standardization and input sanitization.

**Tech Stack:** React, Next.js, Fastify, Pino (structured logger), TypeScript

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/src/components/ErrorBoundary.tsx` | Create | Reusable error boundary component |
| `apps/web/src/features/editor-v2/Editor.tsx` | Modify | Wrap editor sections in error boundaries |
| `apps/web/src/lib/auth.ts` | Create | Centralized token parsing (extracted from 3 files) |
| `apps/web/src/lib/api.ts` | Modify | Use shared auth, add request timeout |
| `apps/web/src/lib/ws.ts` | Modify | Use shared auth |
| `apps/web/src/features/editor-v2/hooks/use-job-websocket.ts` | Modify | Use shared auth |
| `packages/api/src/middleware/auth.ts` | Modify | Replace console.error with fastify logger |
| `packages/api/src/ws/handler.ts` | Modify | Replace console.* with fastify logger |
| `packages/api/src/db/migrate.ts` | Modify | Replace console.log with structured logger |
| `packages/api/src/index.ts` | Modify | Sanitize path params on bundle/source routes |
| `packages/api/src/services/minio.ts` | Modify | Replace console.log |
| `packages/api/src/services/youtube-search.ts` | Modify | Replace console.* |
| `packages/api/src/services/youtube-clip.ts` | Modify | Replace console.* |

---

### Task 1: Create Reusable Error Boundary Component

**Files:**
- Create: `apps/web/src/components/ErrorBoundary.tsx`

**Why:** Only 1 file in the entire frontend has an error boundary. A single crash in the editor (Player, Timeline, or Panels) white-screens the entire app. React error boundaries catch render errors and show a fallback UI.

- [ ] **Step 1: Create the ErrorBoundary component**

```tsx
'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** UI to show when a crash occurs. Receives error + reset function. */
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode;
  /** Name for logging (e.g. "Player", "Timeline") */
  name?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.name ? `:${this.props.name}` : ''}]`,
      error,
      errorInfo.componentStack,
    );
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.reset });
      }

      return (
        <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-zinc-400">
            {this.props.name ? `${this.props.name} crashed` : 'Something went wrong'}
          </p>
          <button
            onClick={this.reset}
            className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

- [ ] **Step 2: Commit**
```bash
git add apps/web/src/components/ErrorBoundary.tsx
git commit -m "feat(web): add reusable ErrorBoundary component"
```

---

### Task 2: Wrap Editor Sections in Error Boundaries

**Files:**
- Modify: `apps/web/src/features/editor-v2/Editor.tsx`

**Why:** The Editor component renders Player, Timeline, AIAssistantPanel, and StylePanel. If any crashes, the entire editor dies. Each section should be independently recoverable.

- [ ] **Step 1: Add import at top of Editor.tsx**

```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary';
```

- [ ] **Step 2: Wrap the main editor panels**

Find where `<Scene .../>` is rendered in the JSX and wrap it:
```tsx
<ErrorBoundary name="Scene">
  <Scene ... />
</ErrorBoundary>
```

Find where `<Timeline .../>` is rendered and wrap it:
```tsx
<ErrorBoundary name="Timeline">
  <Timeline ... />
</ErrorBoundary>
```

Find where `<AIAssistantPanel .../>` is rendered and wrap it:
```tsx
<ErrorBoundary name="AI Assistant">
  <AIAssistantPanel ... />
</ErrorBoundary>
```

Find where `<StylePanel .../>` is rendered and wrap it:
```tsx
<ErrorBoundary name="Style Panel">
  <StylePanel ... />
</ErrorBoundary>
```

- [ ] **Step 3: Verify** — Start the web app, open the editor. All panels should render normally. To test boundaries: temporarily throw an error in one component and confirm only that panel shows the fallback.

- [ ] **Step 4: Commit**
```bash
git add apps/web/src/features/editor-v2/Editor.tsx
git commit -m "feat(web): wrap editor panels in error boundaries for crash isolation"
```

---

### Task 3: Centralize Token Parsing

**Files:**
- Create: `apps/web/src/lib/auth.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/ws.ts`
- Modify: `apps/web/src/features/editor-v2/hooks/use-job-websocket.ts`
- Modify: `apps/web/src/hooks/use-auth.ts`

**Why:** Token parsing (reading `stytch_session_jwt` / `stytch_session_token` from cookies) is duplicated in 4 files with identical logic. Any bug fix must be applied to all copies.

- [ ] **Step 1: Create shared auth utility**

```typescript
// apps/web/src/lib/auth.ts

/**
 * Extract Stytch session token from cookies.
 * Prefers JWT (faster server-side validation) over opaque token.
 * Returns null if not authenticated or running on server.
 */
export function getSessionToken(): string | null {
  if (typeof document === 'undefined') return null;

  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key) acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  return cookies['stytch_session_jwt'] || cookies['stytch_session_token'] || null;
}
```

- [ ] **Step 2: Update api.ts to use shared auth**

In `apps/web/src/lib/api.ts`:
- Remove the local `getSessionToken` function (lines 4-15)
- Add import at top: `import { getSessionToken } from './auth';`

- [ ] **Step 3: Update ws.ts to use shared auth**

In `apps/web/src/lib/ws.ts`:
- Remove the local `getSessionToken` function (lines 4-15)
- Add import at top: `import { getSessionToken } from './auth';`

- [ ] **Step 4: Update use-job-websocket.ts to use shared auth**

In `apps/web/src/features/editor-v2/hooks/use-job-websocket.ts`:
- Find the local `getSessionToken` function (lines 11-19)
- Replace with: `import { getSessionToken } from '@/lib/auth';`
- Remove the local implementation

- [ ] **Step 5: Update use-auth.ts to use shared auth**

In `apps/web/src/hooks/use-auth.ts`:
- Find the local `getSessionToken` function (lines 26-38)
- Replace with: `import { getSessionToken } from '@/lib/auth';`
- Remove the local implementation

- [ ] **Step 7: Verify** — Start web app, log in, open editor. WebSocket connects. SSE agent chat works. No auth errors in console.

- [ ] **Step 8: Commit**
```bash
git add apps/web/src/lib/auth.ts apps/web/src/lib/api.ts apps/web/src/lib/ws.ts apps/web/src/features/editor-v2/hooks/use-job-websocket.ts apps/web/src/hooks/use-auth.ts
git commit -m "refactor(web): centralize session token parsing into lib/auth.ts"
```

---

### Task 4: Add Request Timeout to Frontend API Client

**Files:**
- Modify: `apps/web/src/lib/api.ts`

**Why:** The `ApiClient.request()` method uses `fetch()` with no timeout. If the API hangs (DB deadlock, Redis timeout), the UI hangs forever with no feedback to the user.

- [ ] **Step 1: Add timeout to the `request` method**

In `apps/web/src/lib/api.ts`, modify the `request` method (around line 276):

```typescript
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // Get auth token
    const token = getSessionToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add timeout — 30s for most requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
        signal: options.signal ?? controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[API Error]', response.status, url, JSON.stringify(error).slice(0, 500));
        throw new Error(error.error || `Request failed: ${response.status}`);
      }

      return response.json();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
```

- [ ] **Step 2: Commit**
```bash
git add apps/web/src/lib/api.ts
git commit -m "fix(web): add 30s request timeout to API client to prevent hung UI"
```

---

### Task 5: Sanitize Path Parameters on Bundle/Source Routes

**Files:**
- Modify: `packages/api/src/index.ts`

**Why:** The bundle and source serving routes (lines 92-231) take a wildcard `*` parameter for file paths but don't validate it. A request like `/api/bundles/comp1/../../../etc/passwd` could escape the intended directory.

- [ ] **Step 1: Add path sanitizer helper**

Add this helper function before the route definitions (before the `// Bundle serving from S3` comment):

```typescript
/** Sanitize a file path parameter — prevent directory traversal */
function sanitizeFilePath(filePath: string): string | null {
  // Reject paths with traversal sequences
  if (filePath.includes('..') || filePath.includes('\\')) {
    return null;
  }
  // Normalize: remove leading slashes, collapse double slashes
  const normalized = filePath.replace(/^\/+/, '').replace(/\/+/g, '/');
  if (!normalized || normalized.startsWith('/')) {
    return null;
  }
  return normalized;
}
```

- [ ] **Step 2: Apply to bundle route (line 94)**

After extracting `filePath` from params, add validation:

```typescript
    const rawFilePath = (request.params as { '*': string })['*'] || 'index.html';
    const filePath = sanitizeFilePath(rawFilePath);
    if (!filePath) {
      return reply.code(400).send({ error: 'Invalid file path' });
    }
```

- [ ] **Step 3: Apply to source file route (line 154)**

Same pattern:
```typescript
    const rawFilePath = (request.params as { '*': string })['*'] || 'index.tsx';
    const filePath = sanitizeFilePath(rawFilePath);
    if (!filePath) {
      return reply.code(400).send({ error: 'Invalid file path' });
    }
```

- [ ] **Step 4: Commit**
```bash
git add packages/api/src/index.ts
git commit -m "fix(api): sanitize file path params on bundle/source routes to prevent traversal"
```

---

### Task 6: Replace console.* with Structured Logger in API

**Files:**
- Modify: `packages/api/src/middleware/auth.ts`
- Modify: `packages/api/src/ws/handler.ts`
- Modify: `packages/api/src/db/migrate.ts`
- Modify: `packages/api/src/services/minio.ts`
- Modify: `packages/api/src/services/youtube-search.ts`
- Modify: `packages/api/src/services/youtube-clip.ts`

**Why:** 56 `console.*` calls across the API package. These bypass Pino structured logging — they won't have timestamps, request IDs, or be captured by log aggregation services. At 50 users, debugging without structured logs is impossible.

**Approach:** Fastify's built-in logger is available as `fastify.log`. For files that don't have access to the Fastify instance (middleware, services), create a standalone Pino logger.

- [ ] **Step 1: Create shared API logger**

Create `packages/api/src/logger.ts`:

```typescript
import pino from 'pino';

export const logger = pino({
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});
```

- [ ] **Step 2: Update auth.ts (1 console.error)**

In `packages/api/src/middleware/auth.ts`:
- Add import: `import { logger } from '../logger.js';`
- Line 145: Replace `console.error('Failed to get/create user:', error);` with `logger.warn({ error }, 'Failed to get/create user in optional auth');`

- [ ] **Step 3: Update ws/handler.ts (5 console calls)**

In `packages/api/src/ws/handler.ts`:
- Add import: `import { logger } from '../logger.js';`
- Line 60: `console.error('Error processing Redis message:', err)` → `logger.error({ err }, 'Error processing Redis pub/sub message')`
- Line 129: `console.log(...)` → `logger.info({ projectId, userId: user.id }, 'WebSocket connected')`
- Line 145: `console.error(...)` → `logger.warn({ err }, 'Error parsing WebSocket message')`
- Line 152: `console.log(...)` → `logger.info({ projectId }, 'WebSocket disconnected')`
- Line 156: `console.error(...)` → `logger.error({ err }, 'WebSocket error')`

- [ ] **Step 4: Update db/migrate.ts (3 console.log)**

In `packages/api/src/db/migrate.ts`:
- Add import: `import { logger } from '../logger.js';`
- Line 47: `console.log(...)` → `logger.info({ file }, 'Applying migration')`
- Line 63: `console.log(...)` → `logger.info({ count: applied_count }, 'Migrations applied')`
- Line 65: `console.log(...)` → `logger.info({ total: sqlFiles.length }, 'Database up to date')`

- [ ] **Step 5: Update services/minio.ts**

Find and replace any `console.log` with `logger.info` or `logger.error`. Add import for logger.

- [ ] **Step 6: Update services/youtube-search.ts and youtube-clip.ts**

Same pattern — replace `console.warn` / `console.error` with `logger.warn` / `logger.error`. Add import.

- [ ] **Step 7: Verify** — `pnpm --filter @viona/api build` passes. Start API, confirm logs are structured JSON (or pretty-printed in dev).

- [ ] **Step 8: Commit**
```bash
git add packages/api/src/logger.ts packages/api/src/middleware/auth.ts packages/api/src/ws/handler.ts packages/api/src/db/migrate.ts packages/api/src/services/minio.ts packages/api/src/services/youtube-search.ts packages/api/src/services/youtube-clip.ts
git commit -m "refactor(api): replace console.* with structured pino logger across all files"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `pnpm --filter @viona/api build` passes
- [ ] `pnpm --filter @viona/web build` passes (note: confirm the correct filter name)
- [ ] Search for remaining `console.log` in API src: `grep -r "console\." packages/api/src/ --include="*.ts" | grep -v node_modules | grep -v ".test."` — only `index.ts` debug route should remain
- [ ] Open editor in browser → all panels render → no white screen
- [ ] Try `/api/bundles/test/../../../etc/passwd` → returns 400 "Invalid file path"
- [ ] API requests from editor complete within 30s or show timeout error
