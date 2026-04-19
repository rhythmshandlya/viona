import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';
import { minioClient, getBucket } from '../minio.js';

type RegisterKind = 'generated' | 'derived';

function inferMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  const map: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
    '.txt': 'text/plain',
  };
  return map[ext] ?? 'application/octet-stream';
}

export const registerAssetTool = {
  name: 'register_asset',
  description:
    'Upload a file from the sandbox workspace to storage and register it as a first-class asset linked to the current project. Returns the new asset id.',
  input_schema: {
    type: 'object' as const,
    properties: {
      localPath: { type: 'string', description: 'Absolute path inside /workspace' },
      kind: { type: 'string', enum: ['generated', 'derived'] },
      parentAssetIds: { type: 'array', items: { type: 'string' } },
      label: { type: 'string' },
      mimeType: { type: 'string', description: 'Optional; inferred from extension if omitted' },
    },
    required: ['localPath', 'kind'],
  },
  async execute(input: {
    localPath: string;
    kind: RegisterKind;
    parentAssetIds?: string[];
    label?: string;
    mimeType?: string;
  }): Promise<string> {
    let bytes: Buffer;
    try {
      bytes = await readFile(input.localPath);
    } catch (err) {
      return `ERROR reading ${input.localPath}: ${(err as Error).message}`;
    }

    const info = await stat(input.localPath);
    const filename = basename(input.localPath);
    const mimeType = input.mimeType ?? inferMimeType(filename);
    const sha256 = createHash('sha256').update(bytes).digest('hex');

    const apiUrl = process.env.API_CALLBACK_URL;
    const sandboxId = process.env.SANDBOX_ID;
    const secret = process.env.SANDBOX_SECRET;
    if (!apiUrl || !sandboxId || !secret) {
      return 'ERROR: sandbox env vars missing (API_CALLBACK_URL, SANDBOX_ID, SANDBOX_SECRET)';
    }

    const storageKey = `sandbox/${sandboxId}/assets/${sha256}/${filename}`;

    try {
      await minioClient.putObject(getBucket(), storageKey, bytes, bytes.length, {
        'Content-Type': mimeType,
      });
    } catch (err) {
      return `ERROR uploading to MinIO: ${(err as Error).message}`;
    }

    const res = await fetch(`${apiUrl}/internal/sandbox/${sandboxId}/asset/register`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        sha256,
        storageKey,
        filename,
        mimeType,
        fileSize: info.size,
        source: input.kind,
        parentAssetIds: input.parentAssetIds,
        label: input.label,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return `ERROR register ${res.status}: ${body}`;
    }

    const data = (await res.json()) as { asset: { id: string }; deduped: boolean };
    return `OK assetId=${data.asset.id} deduped=${data.deduped}`;
  },
};
