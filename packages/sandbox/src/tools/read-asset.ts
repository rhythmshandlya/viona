import { access, readFile, mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { posix as pathPosix } from 'node:path';
import type { AssetsManifest } from '../assets/manifest.js';

function workspaceRoot(): string {
  return process.env.WORKSPACE_DIR ?? '/workspace';
}

async function loadManifest(): Promise<AssetsManifest> {
  const raw = await readFile(pathPosix.join(workspaceRoot(), 'assets-manifest.json'), 'utf8');
  return JSON.parse(raw) as AssetsManifest;
}

async function fileExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

export const readAssetTool = {
  name: 'read_asset',
  description:
    'Download an asset to the sandbox workspace and return its local path. ' +
    'Uses a disk cache at /workspace/assets/{id}/{filename} — call is idempotent. ' +
    'Asset ids come from /workspace/assets-manifest.json.',
  input_schema: {
    type: 'object' as const,
    properties: {
      id: { type: 'string', description: 'Asset id (from assets-manifest.json)' },
    },
    required: ['id'],
  },
  async execute(input: { id: string }): Promise<string> {
    let manifest: AssetsManifest;
    try {
      manifest = await loadManifest();
    } catch (err) {
      return `ERROR loading assets-manifest.json: ${(err as Error).message}`;
    }

    const entry = manifest.assets.find((a) => a.id === input.id);
    if (!entry) return `ERROR: asset ${input.id} not found in assets-manifest.json`;

    const dir = pathPosix.join(workspaceRoot(), 'assets', entry.id);
    const path = pathPosix.join(dir, entry.filename);
    if (await fileExists(path)) return path;

    const apiUrl = process.env.API_CALLBACK_URL;
    const secret = process.env.SANDBOX_SECRET;
    const sandboxId = process.env.SANDBOX_ID;
    if (!apiUrl || !secret || !sandboxId) {
      return 'ERROR: sandbox env vars missing (API_CALLBACK_URL, SANDBOX_SECRET, SANDBOX_ID)';
    }

    const url = `${apiUrl}/internal/sandbox/${sandboxId}/asset/${entry.id}/stream`;
    const res = await fetch(url, { headers: { authorization: `Bearer ${secret}` } });

    if (!res.ok || !res.body) {
      return `ERROR: asset stream failed ${res.status}`;
    }

    await mkdir(dir, { recursive: true });
    const readable = res.body as unknown as Readable;
    await pipeline(readable, createWriteStream(path));
    return path;
  },
};
