/**
 * SandboxProvider — abstraction over Railway (prod) and Docker (local dev).
 * Handles sandbox lifecycle only. Prompt forwarding lives in proxy.ts.
 */

export interface Sandbox {
  id: string;                // Railway serviceId or Docker containerId
  projectId: string;
  volumeId: string;          // Railway volumeId or Docker volume name
  volumeInstanceId: string;  // Railway volumeInstanceId (needed for backup/restore)
  internalUrl: string;       // http://{service}.railway.internal or http://localhost:{port}
  agentUrl: string;          // http://{service}.railway.internal:8081 or http://localhost:{port2}
  secret: string;            // Shared secret for auth
  status: 'creating' | 'ready' | 'suspending' | 'suspended';
}

export interface CreateSandboxOpts {
  projectId: string;
  userId: string;
  backupId?: string;         // If resuming from previous session
  env?: Record<string, string>;  // Extra env vars to inject (MINIO_*, ANTHROPIC_API_KEY, etc.)
}

export interface SandboxProvider {
  /** Spin up a sandbox for a project. Handles volume create + optional backup restore. */
  create(opts: CreateSandboxOpts): Promise<Sandbox>;

  /**
   * Destroy sandbox infrastructure (service + volume). Does NOT create backup — call backup() first.
   * Accepts Sandbox metadata from DB so provider doesn't need in-memory state.
   */
  destroy(sandbox: Pick<Sandbox, 'id' | 'volumeId' | 'projectId'>): Promise<void>;

  /**
   * Create a volume backup, returns backupId for future restore.
   * Accepts Sandbox metadata from DB so provider doesn't need in-memory state.
   */
  backup(sandbox: Pick<Sandbox, 'id' | 'volumeId' | 'volumeInstanceId'>): Promise<string>;

  /** Health check — is the sandbox responsive? */
  isReady(url: string): Promise<boolean>;
}
