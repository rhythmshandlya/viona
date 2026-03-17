import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { homedir } from 'os';
import { join, resolve } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { logger } from '../logger.js';
import { config } from '../config.js';
import type { SandboxProvider, Sandbox, CreateSandboxOpts } from './provider.js';

const execFileAsync = promisify(execFile);

// Local directory for bind-mounted workspaces (visible on host for dev inspection)
const WORKSPACES_ROOT = resolve(process.cwd(), '.sandbox-workspaces');

// Find an available port
let nextPort = 18080;
function allocatePort(): number {
  return nextPort++;
}

export class DockerSandboxProvider implements SandboxProvider {
  async create(opts: CreateSandboxOpts): Promise<Sandbox> {
    const { projectId, userId, backupId, env = {} } = opts;
    const containerName = `sandbox-${projectId}`;
    const workspacePath = join(WORKSPACES_ROOT, projectId);
    const secret = randomUUID();
    const filePort = allocatePort();
    const agentPort = allocatePort();

    try {
      // 1. Create local workspace directory (bind mount — visible on host)
      mkdirSync(workspacePath, { recursive: true });

      // 2. If restoring from backup, copy backup volume into local directory
      if (backupId) {
        await execFileAsync('docker', [
          'run', '--rm',
          '-v', `${backupId}:/backup`,
          '-v', `${workspacePath}:/workspace`,
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
        '-v', `${workspacePath}:/workspace`,
        '-p', `${filePort}:8080`, '-p', `${agentPort}:8081`,
        ...Object.entries(envEntries).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
      ];

      // Mount Claude Code credentials for Agent SDK authentication
      const claudeDir = join(homedir(), '.claude');
      if (existsSync(claudeDir)) {
        dockerArgs.push('-v', `${claudeDir}:/home/sandbox/.claude`);
      }

      dockerArgs.push(config.sandbox.image);

      // 4. Run container
      const { stdout } = await execFileAsync('docker', dockerArgs);
      const containerId = stdout.trim();

      const sandbox: Sandbox = {
        id: containerId,
        projectId,
        volumeId: workspacePath,
        volumeInstanceId: workspacePath,  // Local directory path for bind mount
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
      // Log full error including stderr for debugging
      logger.error({
        message: err.message,
        stderr: err.stderr,
        stdout: err.stdout,
        code: err.code,
        containerName,
      }, 'Docker sandbox create failed');
      // Cleanup on failure
      try { await execFileAsync('docker', ['rm', '-f', containerName]); } catch {}
      if (!backupId) {
        try { rmSync(workspacePath, { recursive: true, force: true }); } catch {}
      }
      throw new Error(`Docker sandbox create failed: ${err.stderr || err.message}`);
    }
  }

  async destroy(sandbox: Pick<Sandbox, 'id' | 'volumeId' | 'projectId'>): Promise<void> {
    const containerName = `sandbox-${sandbox.projectId}`;
    try {
      await execFileAsync('docker', ['stop', containerName], { timeout: 15_000 });
      await execFileAsync('docker', ['rm', containerName]);
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Docker stop/rm failed (may already be stopped)');
    }

    // Delete the local workspace directory after backup to prevent accumulation
    const workspacePath = join(WORKSPACES_ROOT, sandbox.projectId);
    try {
      rmSync(workspacePath, { recursive: true, force: true });
      logger.info({ workspacePath }, 'Workspace directory deleted');
    } catch (err: any) {
      logger.warn({ err: err.message, workspacePath }, 'Workspace directory delete failed');
    }
  }

  async backup(sandbox: Pick<Sandbox, 'id' | 'volumeId' | 'volumeInstanceId' | 'projectId'>): Promise<string> {
    const backupVolume = `viona-backup-${sandbox.projectId}`;
    const workspacePath = join(WORKSPACES_ROOT, sandbox.projectId);

    // Remove old backup volume if exists
    try { await execFileAsync('docker', ['volume', 'rm', backupVolume]); } catch {}

    // Create backup volume and copy local workspace contents into it
    await execFileAsync('docker', ['volume', 'create', backupVolume]);
    await execFileAsync('docker', [
      'run', '--rm',
      '-v', `${workspacePath}:/workspace`,
      '-v', `${backupVolume}:/backup`,
      'busybox', 'cp', '-a', '/workspace/.', '/backup/',
    ], { timeout: 120_000 });

    return backupVolume;
  }

  async isReady(url: string): Promise<boolean> {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return false;
      // Verify workspace is actually initialized (manifest.json exists)
      // A sandbox can be "alive" (HTTP server running) but have a broken workspace
      const body = await res.json() as { initialized?: boolean };
      return body.initialized === true;
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
