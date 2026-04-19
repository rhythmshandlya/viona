import { writeFile, mkdir } from 'node:fs/promises';
import { posix as pathPosix } from 'node:path';

export interface ManifestAsset {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  durationMs?: number;
  width?: number;
  height?: number;
  userIntent?: string;
  userDescription?: string;
  transcriptAssetId?: string | null;
}

export interface AssetsManifest {
  projectId: string;
  assets: ManifestAsset[];
  generatedAt: string;
}

export interface FetchManifestInput {
  apiUrl: string;
  sandboxId: string;
  secret: string;
  workspaceRoot: string;
}

/**
 * Fetches the asset manifest from the API and writes it to `{workspaceRoot}/assets-manifest.json`.
 * Called during sandbox boot; the `read_asset` MCP tool reads this file to map asset ids
 * to filenames + metadata.
 *
 * @throws When the API returns non-2xx. The manifest file is NOT written on failure.
 */
export async function fetchAndWriteAssetsManifest(input: FetchManifestInput): Promise<AssetsManifest> {
  const url = `${input.apiUrl}/internal/sandbox/${input.sandboxId}/assets-manifest`;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${input.secret}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`assets-manifest fetch failed ${res.status}: ${body}`);
  }

  const manifest = (await res.json()) as AssetsManifest;

  await mkdir(input.workspaceRoot, { recursive: true });
  const outPath = pathPosix.join(input.workspaceRoot, 'assets-manifest.json');
  await writeFile(outPath, JSON.stringify(manifest, null, 2), 'utf8');

  return manifest;
}
