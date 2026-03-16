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
      // 1. Create service
      const serviceResult = await railwayGql(`
        mutation($input: ServiceCreateInput!) {
          serviceCreate(input: $input) { id name }
        }
      `, {
        input: {
          projectId: config.sandbox.railway.projectId,
          environmentId: config.sandbox.railway.environmentId,
          name: `sandbox-${projectId.slice(0, 8)}`,
          source: { image: config.sandbox.image },
        },
      });
      serviceId = serviceResult.serviceCreate.id;

      // 2. Set environment variables
      const allEnv: Record<string, string> = {
        SANDBOX_SECRET: secret,
        SANDBOX_ID: projectId,
        API_CALLBACK_URL: process.env.RAILWAY_INTERNAL_URL || `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`,
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
        mutation($input: ServiceInstanceDeployInput!) {
          serviceInstanceDeployV2(input: $input)
        }
      `, {
        input: {
          serviceId,
          environmentId: config.sandbox.railway.environmentId,
        },
      });

      // 5. Wait for deployment and get volume instance ID
      let volumeInstanceId = '';
      for (let i = 0; i < 60; i++) {
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
        throw new Error('Volume instance not created after 120s');
      }

      // 6. Restore backup if provided
      if (backupId) {
        await railwayGql(`
          mutation($input: VolumeInstanceBackupRestoreInput!) {
            volumeInstanceBackupRestore(input: $input)
          }
        `, {
          input: { backupId, volumeInstanceId },
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

      // 8. Wait for health check
      await this.waitForReady(internalUrl, 120_000);

      return sandbox;
    } catch (err: any) {
      // Cleanup on failure
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
        await railwayGql(`mutation($id: String!) { volumeDelete(id: $id) }`, { id: sandbox.volumeId });
        logger.info({ volumeId: sandbox.volumeId }, 'Railway volume deleted');
      } catch (err: any) {
        logger.warn({ err: err.message, volumeId: sandbox.volumeId }, 'Railway volume delete failed');
      }
    }
  }

  async backup(sandbox: Pick<Sandbox, 'id' | 'volumeId' | 'volumeInstanceId' | 'projectId'>): Promise<string> {
    const result = await railwayGql(`
      mutation($input: VolumeInstanceBackupCreateInput!) {
        volumeInstanceBackupCreate(input: $input) { id }
      }
    `, {
      input: { volumeInstanceId: sandbox.volumeInstanceId },
    });

    return result.volumeInstanceBackupCreate.id;
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
