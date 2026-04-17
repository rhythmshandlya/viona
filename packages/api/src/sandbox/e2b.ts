import { randomUUID } from 'crypto';
import { Sandbox } from 'e2b';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { SandboxProvider, Sandbox as SandboxMeta, CreateSandboxOpts } from './provider.js';

/**
 * E2B Cloud sandbox provider.
 *
 * Maps the SandboxProvider interface onto E2B's pause/resume model:
 *   create()    -> Sandbox.create(template, { envs, lifecycle: { onTimeout: 'pause' } })
 *   create(bk)  -> Sandbox.connect(bk)   (auto-resumes paused sandboxes in 2.x)
 *   backup()    -> sandbox.pause()        (returns sandboxId as resumable backupId)
 *   destroy()   -> Sandbox.kill(id)       (idempotent if already killed/paused)
 *   isReady()   -> GET <internalUrl>/health
 *
 * On E2B, getHost(port) returns a public HTTPS host. We expose 8080 (file
 * server) as internalUrl and 8081 (agent server) as agentUrl.
 */
export class E2BSandboxProvider implements SandboxProvider {
  private readonly apiKey: string;
  private readonly templateName: string;

  constructor() {
    this.apiKey = config.sandbox.e2b.apiKey;
    this.templateName = config.sandbox.e2b.templateName;
    if (!this.apiKey) {
      throw new Error('E2B_API_KEY is not configured (set in packages/api/.env)');
    }
  }

  async create(opts: CreateSandboxOpts): Promise<SandboxMeta> {
    const { projectId, backupId, env = {} } = opts;
    const secret = randomUUID();

    const envs: Record<string, string> = {
      SANDBOX_SECRET: secret,
      SANDBOX_ID: projectId,
      API_CALLBACK_URL: config.sandbox.callbackUrl,
      API_INTERNAL_URL: config.sandbox.callbackUrl,
      CHECKPOINT_INTERVAL_MS: String(config.sandbox.checkpointIntervalMs),
      MINIO_ENDPOINT: process.env.BUCKET_ENDPOINT || '',
      MINIO_PORT: process.env.BUCKET_PORT || '443',
      MINIO_ACCESS_KEY: config.storage.accessKey,
      MINIO_SECRET_KEY: config.storage.secretKey,
      MINIO_BUCKET: config.storage.bucket,
      MINIO_USE_SSL: 'true',
      MINIO_PUBLIC_ENDPOINT: process.env.BUCKET_PUBLIC_ENDPOINT || '',
      ...env,
    };

    try {
      let sandbox: Sandbox;

      if (backupId) {
        // In e2b 2.x, Sandbox.connect() auto-resumes paused sandboxes.
        // There is no Sandbox.resume() — connect() is the correct API.
        logger.info({ projectId, backupId }, 'Resuming E2B sandbox via connect');
        sandbox = await Sandbox.connect(backupId, { apiKey: this.apiKey });
      } else {
        logger.info({ projectId, template: this.templateName }, 'Creating new E2B sandbox');
        sandbox = await Sandbox.create(this.templateName, {
          apiKey: this.apiKey,
          envs,
          timeoutMs: 60 * 60 * 1000,   // 1h wall-time before auto-pause
          lifecycle: { onTimeout: 'pause' },
        });
      }

      const fileHost = sandbox.getHost(8080);
      const agentHost = sandbox.getHost(8081);

      const result: SandboxMeta = {
        id: sandbox.sandboxId,
        projectId,
        // E2B has no separate volumes — stub these to sandboxId so the provider/DB
        // schema stays consistent with the Railway/Docker shape.
        volumeId: sandbox.sandboxId,
        volumeInstanceId: sandbox.sandboxId,
        internalUrl: `https://${fileHost}`,
        agentUrl: `https://${agentHost}`,
        secret,
        status: 'ready',
      };

      await this.waitForReady(result.internalUrl, 120_000);
      return result;
    } catch (err: any) {
      logger.error({ err: err.message, projectId }, 'E2B sandbox create failed');
      throw new Error(`E2B sandbox create failed: ${err.message}`);
    }
  }

  async destroy(sandbox: Pick<SandboxMeta, 'id' | 'volumeId' | 'projectId'>): Promise<void> {
    // Idempotent — Sandbox.kill throws on already-killed; we swallow.
    try {
      await Sandbox.kill(sandbox.id, { apiKey: this.apiKey });
      logger.info({ sandboxId: sandbox.id }, 'E2B sandbox killed');
    } catch (err: any) {
      logger.warn(
        { err: err.message, sandboxId: sandbox.id },
        'E2B sandbox kill failed (possibly already gone)',
      );
    }
  }

  async backup(
    sandbox: Pick<SandboxMeta, 'id' | 'volumeId' | 'volumeInstanceId' | 'projectId'>,
  ): Promise<string> {
    const live = await Sandbox.connect(sandbox.id, { apiKey: this.apiKey });
    // pause() returns Promise<boolean> in 2.x — return value is not meaningful here.
    await live.pause();
    logger.info({ sandboxId: sandbox.id }, 'E2B sandbox paused (backupId = sandboxId)');
    return sandbox.id;
  }

  async isReady(url: string): Promise<boolean> {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return false;
      const body = (await res.json()) as { initialized?: boolean };
      return body.initialized === true;
    } catch {
      return false;
    }
  }

  async listContainers(): Promise<Array<{ id: string; projectId: string; createdAt: number }>> {
    const paginator = Sandbox.list({ apiKey: this.apiKey });
    const results: Array<{ id: string; projectId: string; createdAt: number }> = [];
    while (paginator.hasNext) {
      const page = await paginator.nextItems();
      for (const s of page) {
        results.push({
          id: s.sandboxId,
          // No reliable projectId mapping from E2B — GC sweep in manager reconciles
          // against sandboxId in the DB, so this field is informational only.
          projectId: s.metadata?.['projectId'] || '',
          createdAt: s.startedAt instanceof Date ? s.startedAt.getTime() : Date.now(),
        });
      }
    }
    return results;
  }

  private async waitForReady(url: string, timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error(`E2B sandbox not ready after ${timeoutMs}ms`);
  }
}
