import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { homedir } from 'os';
import { join, resolve } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { logger } from '../logger.js';
import { config } from '../config.js';
import type { SandboxProvider, Sandbox, CreateSandboxOpts } from './provider.js';

// Keep execFile for backup operations where dockerode doesn't add value
const execFileAsync = promisify(execFile);

// Local directory for bind-mounted workspaces (visible on host for dev inspection)
const WORKSPACES_ROOT = resolve(process.cwd(), '.sandbox-workspaces');

// Lazy-load dockerode — only used in Docker provider, not on Railway
import type Docker from 'dockerode';
let _docker: Docker | null = null;
async function getDocker(): Promise<Docker> {
  if (!_docker) {
    const { default: DockerClient } = await import('dockerode');
    _docker = new DockerClient();
  }
  return _docker;
}

export class DockerSandboxProvider implements SandboxProvider {
  async create(opts: CreateSandboxOpts): Promise<Sandbox> {
    const { projectId, userId, backupId, env = {} } = opts;
    const containerName = `sandbox-${projectId}`;
    const workspacePath = join(WORKSPACES_ROOT, projectId);
    const secret = randomUUID();

    // Kill existing container for THIS project only (not all sandboxes)
    try {
      const docker = await getDocker();
      const existing = docker.getContainer(containerName);
      await existing.remove({ force: true });
      logger.info({ containerName }, 'Removed existing container for project');
    } catch {
      // Container didn't exist — that's fine
    }

    try {
      const docker = await getDocker();

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

      // 3. Build environment variables
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

      // 4. Build bind mounts
      const binds = [`${workspacePath}:/workspace`];

      // Mount Claude Code credentials for Agent SDK authentication
      const claudeDir = join(homedir(), '.claude');
      if (existsSync(claudeDir)) {
        binds.push(`${claudeDir}:/home/sandbox/.claude`);
      }

      // 5. Create container with dockerode
      const container = await docker.createContainer({
        name: containerName,
        Image: config.sandbox.image,
        Env: Object.entries(envEntries).map(([k, v]) => `${k}=${v}`),
        ExposedPorts: {
          '8080/tcp': {},
          '8081/tcp': {},
        },
        Labels: {
          'viona.sandbox': 'true',
          'viona.projectId': projectId,
          'viona.createdAt': String(Date.now()),
        },
        HostConfig: {
          Binds: binds,
          PortBindings: {
            '8080/tcp': [{ HostPort: '0' }],
            '8081/tcp': [{ HostPort: '0' }],
          },
          Memory: 4 * 1024 * 1024 * 1024,       // 4GB
          MemorySwap: 4 * 1024 * 1024 * 1024,   // 4GB (no swap)
          NanoCpus: 2e9,                          // 2 CPUs
          PidsLimit: 512,
          Init: true,
        },
      });

      // 6. Start the container
      await container.start();

      // 7. Read dynamic ports from container inspect
      const info = await container.inspect();
      const filePort = info.NetworkSettings.Ports['8080/tcp']?.[0]?.HostPort;
      const agentPort = info.NetworkSettings.Ports['8081/tcp']?.[0]?.HostPort;

      if (!filePort || !agentPort) {
        throw new Error('Failed to read dynamic port assignments from container');
      }

      const sandbox: Sandbox = {
        id: info.Id,
        projectId,
        volumeId: workspacePath,
        volumeInstanceId: workspacePath,  // Local directory path for bind mount
        internalUrl: `http://localhost:${filePort}`,
        agentUrl: `http://localhost:${agentPort}`,
        secret,
        status: 'creating',
      };

      // 8. Wait for health check
      await this.waitForReady(sandbox.internalUrl, 60_000);
      sandbox.status = 'ready';

      logger.info({
        containerName,
        containerId: info.Id.substring(0, 12),
        filePort,
        agentPort,
      }, 'Docker sandbox created with dynamic ports');

      return sandbox;
    } catch (err: any) {
      logger.error({
        message: err.message,
        containerName,
      }, 'Docker sandbox create failed');

      // Cleanup on failure — remove container by name
      try {
        const docker = await getDocker();
        await docker.getContainer(containerName).remove({ force: true });
      } catch {}

      if (!backupId) {
        try { rmSync(workspacePath, { recursive: true, force: true }); } catch {}
      }

      throw new Error(`Docker sandbox create failed: ${err.message}`);
    }
  }

  async destroy(sandbox: Pick<Sandbox, 'id' | 'volumeId' | 'projectId'>): Promise<void> {
    const containerName = `sandbox-${sandbox.projectId}`;
    try {
      const docker = await getDocker();
      const container = docker.getContainer(containerName);
      await container.stop({ t: 30 });
      await container.remove();
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

  async listContainers(): Promise<Array<{ id: string; projectId: string; createdAt: number }>> {
    const docker = await getDocker();
    const containers = await docker.listContainers({
      all: true,
      filters: { label: ['viona.sandbox=true'] },
    });
    return containers.map(c => ({
      id: c.Id,
      projectId: c.Labels['viona.projectId'] || '',
      createdAt: Number(c.Labels['viona.createdAt'] || 0),
    }));
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
