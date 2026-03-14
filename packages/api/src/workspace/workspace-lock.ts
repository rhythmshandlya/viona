import { redis } from '../services/redis.js';
import { workspaceConfig } from './workspace-config.js';

export type LockHolder = 'user' | 'ai';

export interface LockInfo {
  holder: LockHolder;
  acquiredAt: string;
}

/**
 * Try to acquire the workspace edit lock.
 * Returns true if acquired, false if held by another party.
 */
export async function acquireLock(projectId: string, holder: LockHolder): Promise<boolean> {
  const key = workspaceConfig.redis.lockPrefix + projectId;
  const value = JSON.stringify({ holder, acquiredAt: new Date().toISOString() } satisfies LockInfo);
  const result = await redis.set(key, value, 'PX', workspaceConfig.lockTtlMs, 'NX');
  return result === 'OK';
}

/**
 * Release the workspace edit lock (atomic via Lua script).
 * Only releases if the current holder matches.
 */
export async function releaseLock(projectId: string, holder: LockHolder): Promise<boolean> {
  const key = workspaceConfig.redis.lockPrefix + projectId;
  // Atomic check-and-delete: only delete if holder matches
  const script = `
    local val = redis.call("get", KEYS[1])
    if not val then return 1 end
    local info = cjson.decode(val)
    if info.holder == ARGV[1] then
      redis.call("del", KEYS[1])
      return 1
    end
    return 0
  `;
  const result = await redis.eval(script, 1, key, holder);
  return result === 1;
}

/**
 * Extend the lock TTL (heartbeat, atomic via Lua script).
 * Only extends if the current holder matches.
 */
export async function extendLock(projectId: string, holder: LockHolder): Promise<boolean> {
  const key = workspaceConfig.redis.lockPrefix + projectId;
  const script = `
    local val = redis.call("get", KEYS[1])
    if not val then return 0 end
    local info = cjson.decode(val)
    if info.holder == ARGV[1] then
      redis.call("pexpire", KEYS[1], ARGV[2])
      return 1
    end
    return 0
  `;
  const result = await redis.eval(script, 1, key, holder, String(workspaceConfig.lockTtlMs));
  return result === 1;
}

/**
 * Get current lock status. Returns null if no lock held.
 */
export async function getLockInfo(projectId: string): Promise<LockInfo | null> {
  const key = workspaceConfig.redis.lockPrefix + projectId;
  const current = await redis.get(key);
  if (!current) return null;
  return JSON.parse(current) as LockInfo;
}

/**
 * Force-release lock (admin/cleanup only). Used during workspace teardown.
 */
export async function forceReleaseLock(projectId: string): Promise<void> {
  const key = workspaceConfig.redis.lockPrefix + projectId;
  await redis.del(key);
}
