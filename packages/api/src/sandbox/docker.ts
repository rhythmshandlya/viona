import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { logger } from '../logger.js';
import { config } from '../config.js';
import type { SandboxProvider, Sandbox, CreateSandboxOpts } from './provider.js';

const execFileAsync = promisify(execFile);

// Find an available port
let nextPort = 18080;
function allocatePort(): number {
  return nextPort++;
}

export class DockerSandboxProvider implements SandboxProvider {
  async create(opts: CreateSandboxOpts): Promise<Sandbox> {
    const { projectId, userId, backupId, env = {} } = opts;
    const containerName = `sandbox-${projectId.slice(0, 8)}`;
    const volumeName = `viona-${projectId}`;
    const secret = randomUUID();
    const filePort = allocatePort();
    const agentPort = allocatePort();

    try {
      // 1. Create Docker volume
      await execFileAsync('docker', ['volume', 'create', volumeName]);

      // 2. If restoring from backup, copy backup volume to project volume
      if (backupId) {
        await execFileAsync('docker', [
          'run', '--rm',
          '-v', `${backupId}:/backup`,
          '-v', `${volumeName}:/workspace`,
          'busybox', 'cp', '-a', '/backup/.', '/workspace/',
        ], { timeout: 60_000 });
      }

      // 3. Build container args
      const envEntries: Record<string, string> = {
        SANDBOX_SECRET: secret,
        SANDBOX_ID: projectId,
        API_CALLBACK_URL: `http://host.docker.internal:${config.port}/api`,
        CHECKPOINT_INTERVAL_MS: String(config.sandbox.checkpointIntervalMs),
        MINIO_ENDPOINT: 'host.docker.internal',
        MINIO_PORT: String(config.storage.port),
        MINIO_ACCESS_KEY: config.storage.accessKey,
        MINIO_SECRET_KEY: config.storage.secretKey,
        MINIO_BUCKET: config.storage.bucket,
        MINIO_USE_SSL: 'false',
        ...env,
      };

      const dockerArgs = [
        'run', '-d', '--name', containerName,
        '-v', `${volumeName}:/workspace`,
        '-p', `${filePort}:8080`, '-p', `${agentPort}:8081`,
        ...Object.entries(envEntries).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
        config.sandbox.image,
      ];

      // 4. Run container
      const { stdout } = await execFileAsync('docker', dockerArgs);
      const containerId = stdout.trim();

      const sandbox: Sandbox = {
        id: containerId,
        projectId,
        volumeId: volumeName,
        volumeInstanceId: volumeName,  // Same as volumeId for Docker
        internalUrl: `http://localhost:${filePort}`,
        agentUrl: `http://localhost:${agentPort}`,
        secret,
        status: 'creating',
      };

      // 5. Wait for health check
      await this.waitForReady(sandbox.internalUrl, 60_000);
      sandbox.status = 'ready';

      return sandbox;
    } catch (err: any) {
      // Cleanup on failure
      try { await execFileAsync('docker', ['rm', '-f', containerName]); } catch {}
      if (!backupId) {
        try { await execFileAsync('docker', ['volume', 'rm', volumeName]); } catch {}
      }
      throw new Error(`Docker sandbox create failed: ${err.message}`);
    }
  }

  async destroy(sandbox: Pick<Sandbox, 'id' | 'volumeId' | 'projectId'>): Promise<void> {
    const containerName = `sandbox-${sandbox.projectId.slice(0, 8)}`;
    try {
      await execFileAsync('docker', ['stop', containerName], { timeout: 15_000 });
      await execFileAsync('docker', ['rm', containerName]);
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Docker stop/rm failed (may already be stopped)');
    }

    // Delete the workspace volume after backup to prevent accumulation
    try {
      await execFileAsync('docker', ['volume', 'rm', sandbox.volumeId]);
      logger.info({ volumeId: sandbox.volumeId }, 'Workspace volume deleted');
    } catch (err: any) {
      logger.warn({ err: err.message, volumeId: sandbox.volumeId }, 'Volume delete failed (may not exist)');
    }
  }

  async backup(sandbox: Pick<Sandbox, 'id' | 'volumeId' | 'volumeInstanceId'>): Promise<string> {
    const backupVolume = `viona-backup-${sandbox.volumeId.replace('viona-', '')}`;

    // Remove old backup if exists
    try { await execFileAsync('docker', ['volume', 'rm', backupVolume]); } catch {}

    // Create backup volume and copy workspace contents
    await execFileAsync('docker', ['volume', 'create', backupVolume]);
    await execFileAsync('docker', [
      'run', '--rm',
      '-v', `${sandbox.volumeId}:/workspace`,
      '-v', `${backupVolume}:/backup`,
      'busybox', 'cp', '-a', '/workspace/.', '/backup/',
    ], { timeout: 120_000 });

    return backupVolume;
  }

  async isReady(url: string): Promise<boolean> {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async waitForReady(url: string, timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) return;
      } catch {}
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error(`Sandbox not ready after ${timeoutMs}ms`);
  }
}
