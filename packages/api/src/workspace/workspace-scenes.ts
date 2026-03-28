import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { Readable } from 'stream';
import { listObjects, getObjectStream } from '../services/minio.js';
import { getScenesPath } from './workspace-config.js';
import type { Manifest } from '@viona/shared';

/** Allowed file extensions for scene source downloads */
const ALLOWED_EXTENSIONS = ['.ts', '.tsx', '.css'];

/** Subdirectory to skip (composition-level metadata, not scene sources) */
const SKIP_SUBDIRECTORY = '__composition__/';

/**
 * Read a Node.js Readable stream into a string.
 */
async function streamToString(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Download scene source files from S3 for the given composition IDs.
 * Files are placed into `src/scenes/{compositionId}/` preserving the
 * internal directory structure so relative imports between scene files
 * continue to work.
 *
 * @returns Array of compositionIds that were successfully downloaded (have index.tsx).
 */
export async function downloadSceneSources(
  projectId: string,
  compositionIds: string[],
): Promise<string[]> {
  const scenesDir = getScenesPath(projectId);
  const downloaded: string[] = [];
  const uniqueIds = [...new Set(compositionIds)];

  for (const compositionId of uniqueIds) {
    try {
      // List all source files for this composition
      const keys = await listObjects('outputs', `sources/${compositionId}/`);

      let hasIndex = false;

      for (const key of keys) {
        // key is relative to the outputs prefix, e.g. "sources/{compositionId}/index.tsx"
        // Extract the path relative to the composition root
        const compositionPrefix = `sources/${compositionId}/`;
        const relativePath = key.startsWith(compositionPrefix)
          ? key.slice(compositionPrefix.length)
          : key;

        // Skip __composition__/ subdirectory
        if (relativePath.startsWith(SKIP_SUBDIRECTORY)) continue;

        // Only download allowed file types
        const ext = relativePath.slice(relativePath.lastIndexOf('.'));
        if (!ALLOWED_EXTENSIONS.includes(ext)) continue;

        // Download and write file
        const destPath = join(scenesDir, compositionId, relativePath);
        await mkdir(dirname(destPath), { recursive: true });

        const stream = await getObjectStream('outputs', key);
        const content = await streamToString(stream as Readable);
        await writeFile(destPath, content, 'utf-8');

        if (relativePath === 'index.tsx') {
          hasIndex = true;
        }
      }

      if (hasIndex) {
        downloaded.push(compositionId);
      }
    } catch (err) {
      // Log but don't fail — missing sources just means scenes won't render
      console.warn(`[workspace-scenes] Failed to download sources for ${compositionId}:`, err);
    }
  }

  return downloaded;
}

/**
 * Build a mapping from visual timeline item ID to compositionId.
 * Only includes items of type 'visual' that have a compositionId in their data.
 */
export function buildVisualCompositionMap(
  dbItems: Array<{ id: string; type: string; data: Record<string, unknown> }>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of dbItems) {
    if (item.type === 'visual' && typeof item.data?.compositionId === 'string') {
      map.set(item.id, item.data.compositionId as string);
    }
  }
  return map;
}

/**
 * Remap manifest sceneFile values from the generic `scenes/SceneN.tsx` paths
 * (produced by dbToManifest) to the actual workspace paths: `scenes/{compositionId}/index.tsx`.
 *
 * Mutates the manifest in-place.
 */
export function remapManifestSceneFiles(
  manifest: Manifest,
  visualCompositionMap: Map<string, string>,
  downloadedCompositions: string[],
): void {
  const downloadedSet = new Set(downloadedCompositions);

  for (const item of manifest.items) {
    if (item.type !== 'scene') continue;

    const compositionId = visualCompositionMap.get(item.id);
    if (!compositionId || !downloadedSet.has(compositionId)) continue;

    // Remap the sceneFile to point to the downloaded composition directory
    (item.data as { sceneFile: string }).sceneFile = `scenes/${compositionId}/index.tsx`;
  }
}

/**
 * Extract unique compositionIds from DB visual items.
 */
export function extractCompositionIds(
  dbItems: Array<{ type: string; data: Record<string, unknown> }>,
): string[] {
  const ids = new Set<string>();
  for (const item of dbItems) {
    if (item.type === 'visual' && typeof item.data?.compositionId === 'string') {
      ids.add(item.data.compositionId as string);
    }
  }
  return [...ids];
}
