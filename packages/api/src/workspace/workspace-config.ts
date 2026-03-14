import { resolve, join } from 'path';

const isProduction = !!process.env.RAILWAY_ENVIRONMENT;

export const workspaceConfig = {
  /** Root directory for all workspace directories */
  rootDir: resolve(process.env.WORKSPACE_ROOT_DIR || (isProduction ? '/tmp/workspaces' : join(process.cwd(), '..', 'workspaces'))),

  /** How long before an idle workspace is torn down (ms) */
  idleTimeoutMs: parseInt(process.env.WORKSPACE_IDLE_TIMEOUT_MS || '600000', 10), // 10 min

  /** How often to checkpoint manifest to DB (ms) */
  checkpointIntervalMs: parseInt(process.env.WORKSPACE_CHECKPOINT_MS || '60000', 10), // 60s

  /** Edit lock TTL before auto-release (ms) */
  lockTtlMs: 30_000, // 30s

  /** AI heartbeat interval for extending lock TTL (ms) */
  lockHeartbeatMs: 10_000, // 10s

  /** Bundler debounce time (ms) — batch rapid file changes */
  bundlerDebounceMs: 500,

  /** Redis key prefixes */
  redis: {
    lockPrefix: 'workspace:lock:',
    activityPrefix: 'workspace:activity:',
  },

  /** S3 prefixes */
  s3: {
    bundlePrefix: 'bundles/',
    sceneSourcePrefix: 'sources/',
  },
} as const;

/** Get the workspace directory path for a project */
export function getWorkspacePath(projectId: string): string {
  return join(workspaceConfig.rootDir, projectId);
}

/** Get path to manifest.json inside a workspace */
export function getManifestPath(projectId: string): string {
  return join(getWorkspacePath(projectId), 'manifest.json');
}

/** Get path to the src/ directory inside a workspace */
export function getWorkspaceSrcPath(projectId: string): string {
  return join(getWorkspacePath(projectId), 'src');
}

/** Get path to the scenes directory inside a workspace */
export function getScenesPath(projectId: string): string {
  return join(getWorkspacePath(projectId), 'src', 'scenes');
}

/** Get path to the public/ directory inside a workspace */
export function getPublicPath(projectId: string): string {
  return join(getWorkspacePath(projectId), 'public');
}
