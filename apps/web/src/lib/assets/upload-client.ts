import { AssetsApi, type RegisterAssetResponse, type AssetSource } from '@/lib/api/assets';

const api = new AssetsApi(process.env.NEXT_PUBLIC_API_URL ?? '');

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface UploadOptions {
  file: File;
  source: AssetSource;
  userIntent?: string;
  projectId?: string;
  parentAssetIds?: string[];
}

/**
 * Client-upload flow:
 *   1. Request presigned URL from API
 *   2. PUT bytes directly to S3
 *   3. POST /assets/register with sha256
 */
export async function uploadAndRegister(opts: UploadOptions): Promise<RegisterAssetResponse> {
  const { file } = opts;
  const presign = await api.getUploadUrls({
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    fileSize: file.size,
    partCount: 1,
  });

  const buf = await file.arrayBuffer();
  const put = await fetch(presign.partUrls[0].url, {
    method: 'PUT',
    body: buf,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  if (!put.ok) throw new Error(`S3 PUT failed ${put.status}`);

  const hash = await sha256Hex(buf);

  return api.registerAsset({
    sha256: hash,
    storageKey: presign.storageKey,
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    fileSize: file.size,
    source: opts.source,
    userIntent: opts.userIntent,
    parentAssetIds: opts.parentAssetIds,
    projectId: opts.projectId,
  });
}
