import { randomUUID } from 'crypto';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { SandboxProvider, Sandbox, CreateSandboxOpts } from './provider.js';

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2';

async function railwayGql(query: string, variables: Record<string, unknown> = {}, step?: string): Promise<any> {
  const token = config.sandbox.railway.apiToken;
  if (!token) {
    throw new Error(`Railway API token not configured (step: ${step || 'unknown'})`);
  }

  const MAX_RETRIES = 3;
  const RETRY_BASE_MS = 1000;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(RAILWAY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Railway API HTTP ${res.status} at step "${step || 'unknown'}": ${body}`);
      }

      const data = (await res.json()) as { errors?: unknown[]; data: unknown };
      if (data.errors) {
        const errStr = JSON.stringify(data.errors);
        // "Problem processing request" is a transient Railway server error — retry
        if (errStr.includes('Problem processing request') && attempt < MAX_RETRIES - 1) {
          logger.warn({ step, attempt: attempt + 1, errors: errStr }, 'Railway API transient error, retrying');
          await new Promise(r => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)));
          continue;
        }
        throw new Error(`Railway API error at step "${step || 'unknown'}": ${errStr}`);
      }
      return data.data;
    } catch (err: any) {
      // Retry on network/fetch failures (not on our own thrown errors with step info)
      const isTransient = err.cause?.code === 'ECONNRESET' ||
        err.cause?.code === 'ETIMEDOUT' ||
        err.message?.includes('fetch failed') ||
        err.message?.includes('Problem processing request');

      if (isTransient && attempt < MAX_RETRIES - 1) {
        logger.warn({ step, attempt: attempt + 1, err: err.message }, 'Railway API transient error, retrying');
        await new Promise(r => setTimeout(r, RETRY_BASE_MS * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }

  throw new Error(`Railway API failed after ${MAX_RETRIES} retries at step "${step || 'unknown'}"`);
}

export class RailwaySandboxProvider implements SandboxProvider {
  async create(opts: CreateSandboxOpts): Promise<Sandbox> {
    const { projectId, userId, backupId, env = {} } = opts;
    const secret = randomUUID();

    let serviceId: string | undefined;
    let volumeId: string | undefined;

    try {
      // 1. Create service — use image source if a custom SANDBOX_IMAGE is set,
      //    otherwise build from the GitHub repo (no external registry needed)
      const useImage = config.sandbox.image !== 'viona-sandbox:latest';
      logger.info({
        projectId,
        useImage,
        railwayProjectId: config.sandbox.railway.projectId,
        railwayEnvId: config.sandbox.railway.environmentId,
        tokenPrefix: config.sandbox.railway.apiToken?.slice(0, 8),
      }, 'Creating sandbox service on Railway');

      const serviceResult = await railwayGql(`
        mutation($input: ServiceCreateInput!) {
          serviceCreate(input: $input) { id name }
        }
      `, {
        input: {
          projectId: config.sandbox.railway.projectId,
          environmentId: config.sandbox.railway.environmentId,
          name: `sandbox-${projectId.slice(0, 8)}`,
          source: useImage
            ? { image: config.sandbox.image }
            : { repo: config.sandbox.railway.repo },
          branch: config.sandbox.railway.branch,
        },
      }, 'serviceCreate');
      serviceId = serviceResult.serviceCreate.id;

      // 1b. Configure build settings (Dockerfile path, health check)
      await railwayGql(`
        mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
          serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
        }
      `, {
        serviceId,
        environmentId: config.sandbox.railway.environmentId,
        input: {
          ...(useImage ? {} : { dockerfilePath: 'packages/sandbox/Dockerfile' }),
          healthcheckPath: '/health',
          healthcheckTimeout: 60,
          restartPolicyType: 'ON_FAILURE',
          restartPolicyMaxRetries: 3,
        },
      }, 'serviceInstanceUpdate');

      // 2. Set environment variables
      const allEnv: Record<string, string> = {
        SANDBOX_SECRET: secret,
        SANDBOX_ID: projectId,
        API_CALLBACK_URL: config.sandbox.callbackUrl,
        CHECKPOINT_INTERVAL_MS: String(config.sandbox.checkpointIntervalMs),
        MINIO_ENDPOINT: process.env.BUCKET_ENDPOINT || '',
        MINIO_PORT: process.env.BUCKET_PORT || '443',
        MINIO_ACCESS_KEY: config.storage.accessKey,
        MINIO_SECRET_KEY: config.storage.secretKey,
        MINIO_BUCKET: config.storage.bucket,
        MINIO_USE_SSL: 'true',
        MINIO_PUBLIC_ENDPOINT: process.env.BUCKET_PUBLIC_ENDPOINT || process.env.RAILWAY_SERVICE_STORAGE_URL || '',
        ...env,
      };

      await railwayGql(`
        mutation($input: VariableCollectionUpsertInput!) {
          variableCollectionUpsert(input: $input)
        }
      `, {
        input: {
          projectId: config.sandbox.railway.projectId,
          environmentId: config.sandbox.railway.environmentId,
          serviceId,
          variables: allEnv,
        },
      }, 'variableCollectionUpsert');

      // 3. Create volume
      const volumeResult = await railwayGql(`
        mutation($input: VolumeCreateInput!) {
          volumeCreate(input: $input) { id }
        }
      `, {
        input: {
          projectId: config.sandbox.railway.projectId,
          serviceId,
          mountPath: '/workspace',
        },
      }, 'volumeCreate');
      volumeId = volumeResult.volumeCreate.id;

      // 4. Deploy
      await railwayGql(`
        mutation($serviceId: String!, $environmentId: String!) {
          serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId)
        }
      `, {
        serviceId,
        environmentId: config.sandbox.railway.environmentId,
      }, 'serviceInstanceDeployV2');

      // 5. Wait for deployment and volume to be ready
      //    Use volumeId directly from creation — Railway will have the instance ready shortly
      //    Give it 30 seconds to initialize after deployment trigger
      const volumeInstanceId = volumeId;
      await new Promise(r => setTimeout(r, 30_000));

      // 6. Restore backup if provided
      if (backupId) {
        await railwayGql(`
          mutation($volumeInstanceBackupId: String!, $volumeInstanceId: String!) {
            volumeInstanceBackupRestore(
              volumeInstanceBackupId: $volumeInstanceBackupId,
              volumeInstanceId: $volumeInstanceId
            )
          }
        `, {
          volumeInstanceBackupId: backupId,
          volumeInstanceId,
        }, 'volumeInstanceBackupRestore');
      }

      // 7. Resolve internal URL
      const serviceName = `sandbox-${projectId.slice(0, 8)}`;
      const internalUrl = `http://${serviceName}.railway.internal:8080`;
      const agentUrl = `http://${serviceName}.railway.internal:8081`;

      const sandbox: Sandbox = {
        id: serviceId!,
        projectId,
        volumeId: volumeId!,
        volumeInstanceId,
        internalUrl,
        agentUrl,
        secret,
        status: 'ready',
      };

      // 8. Wait for health check — repo builds take ~3-5 min, image pulls ~30s
      await this.waitForReady(internalUrl, 300_000);

      return sandbox;
    } catch (err: any) {
      // Cleanup on failure — delete both service and orphaned volume
      if (volumeId) {
        try {
          await railwayGql(`mutation($volumeId: String!) { volumeDelete(volumeId: $volumeId) }`, { volumeId }, 'cleanup:volumeDelete');
        } catch {}
      }
      if (serviceId) {
        try {
          await railwayGql(`mutation($id: String!) { serviceDelete(id: $id) }`, { id: serviceId }, 'cleanup:serviceDelete');
        } catch {}
      }
      throw new Error(`Railway sandbox create failed: ${err.message}`);
    }
  }

  async destroy(sandbox: Pick<Sandbox, 'id' | 'volumeId' | 'projectId'>): Promise<void> {
    try {
      await railwayGql(`mutation($id: String!) { serviceDelete(id: $id) }`, { id: sandbox.id });
    } catch (err: any) {
      logger.warn({ err: err.message, sandboxId: sandbox.id }, 'Railway service delete failed');
    }

    if (sandbox.volumeId) {
      try {
        await railwayGql(`mutation($volumeId: String!) { volumeDelete(volumeId: $volumeId) }`, { volumeId: sandbox.volumeId });
        logger.info({ volumeId: sandbox.volumeId }, 'Railway volume deleted');
      } catch (err: any) {
        logger.warn({ err: err.message, volumeId: sandbox.volumeId }, 'Railway volume delete failed');
      }
    }
  }

  async backup(sandbox: Pick<Sandbox, 'id' | 'volumeId' | 'volumeInstanceId' | 'projectId'>): Promise<string> {
    const result = await railwayGql(`
      mutation($volumeInstanceId: String!) {
        volumeInstanceBackupCreate(volumeInstanceId: $volumeInstanceId)
      }
    `, {
      volumeInstanceId: sandbox.volumeInstanceId,
    });

    return result.volumeInstanceBackupCreate;
  }

  async listContainers(): Promise<Array<{ id: string; projectId: string; createdAt: number }>> {
    // Query all services in our Railway project that match the sandbox naming convention.
    // Railway service names are `sandbox-{projectId.slice(0,8)}` (32-char limit).
    // We return the Railway serviceId as `id` — the GC sweep reconciles against
    // `railwayServiceId` in the DB, not the Viona projectId.
    const result = await railwayGql(`
      query($projectId: String!) {
        project(id: $projectId) {
          services {
            edges {
              node {
                id
                name
                createdAt
              }
            }
          }
        }
      }
    `, { projectId: config.sandbox.railway.projectId });

    const services = result.project?.services?.edges || [];

    return services
      .filter((edge: any) => edge.node.name.startsWith('sandbox-'))
      .map((edge: any) => ({
        id: edge.node.id,
        // Railway doesn't have labels — use the truncated projectId from the name.
        // GC sweep will match by service ID against railwayServiceId in DB.
        projectId: edge.node.name.replace('sandbox-', ''),
        createdAt: new Date(edge.node.createdAt).getTime(),
      }));
  }

  async isReady(url: string): Promise<boolean> {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return false;
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
      await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error(`Sandbox not ready after ${timeoutMs}ms`);
  }
}
