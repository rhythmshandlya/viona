import { redis } from '../services/redis.js';

/** Publish a workspace event via Redis pub/sub.
 * Channel format: `project:{projectId}:{event}` — matches existing psubscribe('project:*:*')
 * Automatically injects `projectId` into the payload for WS broadcast routing.
 */
async function publishWorkspaceEvent(projectId: string, event: string, data: unknown): Promise<void> {
  const channel = `project:${projectId}:${event}`;
  const payload = { ...(data as object), projectId };
  await redis.publish(channel, JSON.stringify(payload));
}

// ---- Specific event publishers ----

export async function emitWorkspaceReady(projectId: string, data: { bundleUrl: string }): Promise<void> {
  await publishWorkspaceEvent(projectId, 'workspace:ready', data);
}

export async function emitManifestUpdated(projectId: string, data: { source: 'user' | 'ai'; ops?: unknown[] }): Promise<void> {
  await publishWorkspaceEvent(projectId, 'manifest:updated', data);
}

export async function emitBundleReady(projectId: string, data: { bundleUrl: string }): Promise<void> {
  await publishWorkspaceEvent(projectId, 'bundle:ready', data);
}

export async function emitBundleError(projectId: string, data: { error: string }): Promise<void> {
  await publishWorkspaceEvent(projectId, 'bundle:error', data);
}

export async function emitLockAcquired(projectId: string, data: { holder: 'user' | 'ai' }): Promise<void> {
  await publishWorkspaceEvent(projectId, 'workspace:lock_acquired', data);
}

export async function emitLockReleased(projectId: string, data: { holder: 'user' | 'ai' }): Promise<void> {
  await publishWorkspaceEvent(projectId, 'workspace:lock_released', data);
}

export async function emitWorkspaceTeardown(projectId: string): Promise<void> {
  await publishWorkspaceEvent(projectId, 'workspace:teardown', {});
}
