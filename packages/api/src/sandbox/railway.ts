import { randomUUID } from 'crypto';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { SandboxProvider, Sandbox, CreateSandboxOpts } from './provider.js';

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2';

async function railwayGql(query: string, variables: Record<string, unknown> = {}): Promise<any> {
  const res = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.sandbox.railway.apiToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = (await res.json()) as { errors?: unknown[]; data: unknown };
  if (data.errors) {
    throw new Error(`Railway API error: ${JSON.stringify(data.errors)}`);
  }
  return data.data;
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
      });
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
      });

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
      });

      // 3. Create volume
      const volumeResult = await railwayGql(`
        mutation($input: VolumeCreateInput!) {
          volumeCreate(input: $input) { id }
        }
      `, {
        input: {
          projectId: config.sandbox.railway.projectId,
          environmentId: config.sandbox.railway.environmentId,
          serviceId,
          mountPath: '/workspace',
          name: `workspace-${projectId.slice(0, 8)}`,
        },
      });
      volumeId = volumeResult.volumeCreate.id;

      // 4. Deploy
      await railwayGql(`
        mutation($serviceId: String!, $environmentId: String!) {
          serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId)
        }
      `, {
        serviceId,
        environmentId: config.sandbox.railway.environmentId,
      });

      // 5. Wait for deployment and get volume instance ID
      //    Repo-based builds take longer than image pulls — poll for up to 5 min
      let volumeInstanceId = '';
      for (let i = 0; i < 150; i++) {
        await new Promise(r => setTimeout(r, 2000));

        const volData = await railwayGql(`
          query($volumeId: String!) {
            volume(id: $volumeId) {
              volumeInstances { id }
            }
          }
        `, { volumeId });

        const instances = volData.volume?.volumeInstances || [];
        if (instances.length > 0) {
          volumeInstanceId = instances[0].id;
          break;
        }
      }

      if (!volumeInstanceId) {
        throw new Error('Volume instance not created after 300s');
      }

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
        });
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
          await railwayGql(`mutation($volumeId: String!) { volumeDelete(volumeId: $volumeId) }`, { volumeId });
        } catch {}
      }
      if (serviceId) {
        try {
          await railwayGql(`mutation($id: String!) { serviceDelete(id: $id) }`, { id: serviceId });
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
