/**
 * Pre-processing and validation helpers for visual generation
 */

import { existsSync } from 'fs';
import { mkdir, writeFile, readFile, readdir } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { eq } from 'drizzle-orm';
import { db, projectAssets } from '../../db/index.js';
import { downloadFile } from '../../services/minio.js';
import { getWorkspacePath } from '../../workspace.js';
import { logger } from '../../logger.js';
import type { HeadTrackingFrame, SpeakerGrid, ExtractedAsset, VideoSelection, VideoManifest } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Find the packages/ root by walking up from __dirname to find the worker's
// package.json, then taking its parent. Works in both local dev and Docker:
//   Local:  src/processors/ → 2 parents to packages/worker
//   Docker: dist/           → 1 parent to packages/worker
export function findPackagesRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(dir, 'package.json'))) {
      return dirname(dir); // parent of packages/worker = packages/
    }
    dir = dirname(dir);
  }
  return resolve(__dirname, '..', '..', '..');
}

// ---------------------------------------------------------------------------
// Recursively copy a directory tree (used for template source files)
// ---------------------------------------------------------------------------
export async function copyDirRecursive(src: string, dest: string): Promise<void> {
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      await mkdir(destPath, { recursive: true });
      await copyDirRecursive(srcPath, destPath);
    } else {
      const content = await readFile(srcPath, 'utf-8');
      await writeFile(destPath, content, 'utf-8');
    }
  }
}

// ---------------------------------------------------------------------------
// Speaker grid computation (mirrors asset-server.js get_speaker_grid logic)
// ---------------------------------------------------------------------------

/**
 * Compute a 6x6 speaker occupancy grid for a time range from head tracking data.
 * Cells are marked 1 if the speaker's face overlaps them in >30% of frames.
 *
 * videoWidth/videoHeight are the source video pixel dimensions, used to normalize
 * the pixel-coordinate bboxes from detect_head.py into 0-1 fractions.
 */
export function computeSpeakerGrid(
  headTrackingData: { frames?: HeadTrackingFrame[]; video?: { width: number; height: number } },
  startMs: number,
  endMs: number,
  rows = 24,
  cols = 24,
): SpeakerGrid {
  const frames = headTrackingData.frames || [];
  const videoW = headTrackingData.video?.width || 1;
  const videoH = headTrackingData.video?.height || 1;

  // Filter frames by time range, only those with a face bbox
  const filtered = frames.filter(
    (f) => f.timestamp_ms >= startMs && f.timestamp_ms <= endMs && f.face?.bbox,
  );

  if (filtered.length === 0) {
    return {
      grid: Array.from({ length: rows }, () => Array(cols).fill(0)),
      occupancy: '0%',
      safePlacement: ['entire frame'],
    };
  }

  // Build grid: project each face bbox onto the grid
  const cellHits = Array.from({ length: rows }, () => Array(cols).fill(0) as number[]);

  for (const frame of filtered) {
    const b = frame.face!.bbox!;
    // Normalize pixel-coordinate bbox to 0-1 fractions
    const bx1 = b.x / videoW;
    const by1 = b.y / videoH;
    const bx2 = (b.x + b.width) / videoW;
    const by2 = (b.y + b.height) / videoH;

    // Convert to grid cell range (clamped)
    const colStart = Math.max(0, Math.floor(bx1 * cols));
    const colEnd = Math.min(cols - 1, Math.floor(bx2 * cols));
    const rowStart = Math.max(0, Math.floor(by1 * rows));
    const rowEnd = Math.min(rows - 1, Math.floor(by2 * rows));

    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = colStart; c <= colEnd; c++) {
        cellHits[r][c]++;
      }
    }
  }

  // Mark cells occupied if speaker present in >30% of filtered frames
  const threshold = filtered.length * 0.3;
  const grid = cellHits.map((row) => row.map((count) => (count >= threshold ? 1 : 0)));

  // Compute occupancy
  const totalCells = rows * cols;
  const occupiedCells = grid.flat().filter((v) => v === 1).length;
  const occupancy = `${Math.round((occupiedCells / totalCells) * 100)}%`;

  // Fallback: if occupancy is very low but we had frames, assume center-column speaker
  // Low occupancy likely means face detection was inconsistent
  if (occupiedCells < totalCells * 0.10 && filtered.length > 10) {
    const centerColStart = Math.floor(cols * 0.25);
    const centerColEnd = Math.floor(cols * 0.75);
    const centerRowStart = Math.floor(rows * 0.10);
    const centerRowEnd = Math.floor(rows * 0.60);

    for (let r = centerRowStart; r < centerRowEnd; r++) {
      for (let c = centerColStart; c < centerColEnd; c++) {
        grid[r][c] = 1;
      }
    }

    const fallbackOccupied = grid.flat().filter((v) => v === 1).length;
    const fallbackOccupancy = `${Math.round((fallbackOccupied / totalCells) * 100)}%`;

    return {
      grid,
      occupancy: fallbackOccupancy,
      safePlacement: ['top', 'bottom', 'bottom-left', 'bottom-right'],
    };
  }

  // Compute safe placement regions using fractional boundaries
  // With 24x24 grid, we check meaningful regions (top/bottom strips, left/right halves, quadrants)
  const safePlacement: string[] = [];

  // Helper: check if a rectangular region of the grid is entirely unoccupied
  const isRegionSafe = (r1: number, r2: number, c1: number, c2: number): boolean => {
    for (let r = r1; r < r2; r++) {
      for (let c = c1; c < c2; c++) {
        if (grid[r][c] === 1) return false;
      }
    }
    return true;
  };

  const midRow = Math.floor(rows / 2);
  const midCol = Math.floor(cols / 2);
  // Top/bottom strips: ~17% of canvas height (4 rows out of 24)
  const stripRows = Math.round(rows / 6);

  const regions: Record<string, () => boolean> = {
    'top-left':     () => isRegionSafe(0, midRow, 0, midCol),
    'top-right':    () => isRegionSafe(0, midRow, midCol, cols),
    'bottom-left':  () => isRegionSafe(midRow, rows, 0, midCol),
    'bottom-right': () => isRegionSafe(midRow, rows, midCol, cols),
    'top':          () => isRegionSafe(0, stripRows, 0, cols),
    'bottom':       () => isRegionSafe(rows - stripRows, rows, 0, cols),
    'left':         () => isRegionSafe(0, rows, 0, stripRows),
    'right':        () => isRegionSafe(0, rows, cols - stripRows, cols),
  };

  for (const [name, check] of Object.entries(regions)) {
    if (check()) safePlacement.push(name);
  }

  return { grid, occupancy, safePlacement };
}

/**
 * Extract assets from the generated composition.
 * Reads scenes.json and parses layout information to create a list of editable assets.
 */
export async function extractAssets(projectDir: string): Promise<ExtractedAsset[]> {
  const assets: ExtractedAsset[] = [];

  try {
    // Read scenes.json
    const scenesPath = join(projectDir, 'scenes.json');
    const scenesContent = await readFile(scenesPath, 'utf-8');
    const scenesData = JSON.parse(scenesContent);

    if (!scenesData.scenes || !Array.isArray(scenesData.scenes)) {
      logger.warn({ projectDir }, 'No scenes found in scenes.json');
      return assets;
    }

    // Extract assets from each scene's layout
    for (const scene of scenesData.scenes) {
      const sceneId = scene.id;
      const sceneName = scene.name || `Scene ${sceneId}`;

      if (scene.layout && typeof scene.layout === 'object') {
        for (const [key, value] of Object.entries(scene.layout as Record<string, any>)) {
          // Skip background elements
          if (key === 'background') continue;

          // Determine asset type based on name
          let assetType: ExtractedAsset['type'] = 'element';
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes('text') || lowerKey.includes('title') || lowerKey.includes('label')) {
            assetType = 'text';
          } else if (lowerKey.includes('icon')) {
            assetType = 'icon';
          } else if (lowerKey.includes('shape') || lowerKey.includes('circle') || lowerKey.includes('rect')) {
            assetType = 'shape';
          } else if (lowerKey.includes('particle') || lowerKey.includes('bg')) {
            assetType = 'background';
          }

          assets.push({
            id: `scene${sceneId}-${key}`,
            name: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim(),
            type: assetType,
            sceneId,
            sceneName,
            description: scene.visual || sceneName,
            position: value?.x || value?.y ? { x: value.x || 'center', y: value.y || '50%' } : undefined,
            size: value?.width || value?.height ? { width: value.width || 'auto', height: value.height || 'auto' } : undefined,
          });
        }
      }

      // Also check for icons array
      if (scene.icons && Array.isArray(scene.icons)) {
        for (const icon of scene.icons) {
          assets.push({
            id: `scene${sceneId}-icon-${icon.name || icon}`,
            name: typeof icon === 'string' ? icon : icon.name,
            type: 'icon',
            sceneId,
            sceneName,
            description: `Icon in ${sceneName}`,
          });
        }
      }
    }

    // Write assets.json to project directory
    const assetsPath = join(projectDir, 'assets.json');
    await writeFile(assetsPath, JSON.stringify({ assets, extractedAt: new Date().toISOString() }, null, 2));
    logger.info({ projectDir, assetCount: assets.length }, 'Extracted assets from composition');

  } catch (error) {
    logger.warn({ projectDir, error }, 'Failed to extract assets from composition');
  }

  return assets;
}

/**
 * Inject user-uploaded assets into the workspace for the Animator to use.
 * Downloads from MinIO → public/assets/user/ and writes user_assets.json manifest.
 */
export async function injectUserAssets(projectId: string, projectDir: string): Promise<number> {
  const workspacePath = getWorkspacePath();
  const assets = await db.select().from(projectAssets)
    .where(eq(projectAssets.projectId, projectId));

  if (assets.length === 0) return 0;

  const userAssetsDir = join(workspacePath, 'public', 'assets', 'user');
  await mkdir(userAssetsDir, { recursive: true });

  const manifest: { assets: Array<{ filename: string; label: string; contentType: string; remotionPath: string }> } = { assets: [] };

  for (const asset of assets) {
    // Sanitize filename for safe staticFile() paths, add ID suffix to prevent collisions
    const extMatch = asset.filename.match(/\.[^.]+$/);
    const extPart = extMatch ? extMatch[0] : '';
    const basePart = asset.filename.replace(/\.[^.]+$/, '').replace(/[^\w.-]/g, '_');
    const safeFilename = `${basePart}_${asset.id.slice(0, 8)}${extPart}`;
    const destPath = join(userAssetsDir, safeFilename);
    try {
      await downloadFile('uploads', asset.storageKey, destPath);
      manifest.assets.push({
        filename: safeFilename,
        label: asset.label || asset.filename.replace(/\.[^.]+$/, ''),
        contentType: asset.contentType,
        remotionPath: `assets/user/${safeFilename}`,
      });
    } catch (err) {
      logger.warn({ err, assetId: asset.id, storageKey: asset.storageKey }, 'Failed to download user asset');
    }
  }

  // Write manifest to project src dir so the Animator can read it
  const manifestPath = join(projectDir, 'user_assets.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  logger.info({ projectId, assetCount: manifest.assets.length }, 'Injected user assets into workspace');

  return manifest.assets.length;
}

/**
 * Prepare video assets manifest from user's video selections.
 * This manifest is used by the render processor to download clips for final export.
 */
export async function prepareVideoAssets(
  selectedVideos: Record<number, Record<string, VideoSelection>> | undefined,
  projectDir: string
): Promise<VideoManifest> {
  const manifest: VideoManifest = { videos: [] };

  if (!selectedVideos) return manifest;

  for (const [sceneIndexStr, keywords] of Object.entries(selectedVideos)) {
    const sceneIndex = parseInt(sceneIndexStr, 10);
    for (const [keyword, selection] of Object.entries(keywords as Record<string, VideoSelection>)) {
      manifest.videos.push({
        sceneId: String(sceneIndex + 1), // 1-indexed scene ID
        keyword,
        videoId: selection.videoId,
        sourceUrl: selection.url,
        title: selection.title,
        thumbnailUrl: selection.thumbnailUrl,
        trimStart: 0,
        trimEnd: 30, // Default 30s clip
      });
    }
  }

  if (manifest.videos.length > 0) {
    // Pre-fetch proxy URLs so the editor can play videos immediately
    const apiBaseUrl = process.env.API_URL || 'http://localhost:4000';
    for (const entry of manifest.videos) {
      try {
        const resp = await fetch(`${apiBaseUrl}/api/youtube/refresh-stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: entry.sourceUrl }),
        });
        if (resp.ok) {
          const { streamUrl } = (await resp.json()) as { streamUrl: string };
          entry.proxyUrl = `${apiBaseUrl}${streamUrl}`;
        }
      } catch { /* proxyUrl stays undefined, frontend refresh will handle it */ }
    }

    // Write manifest for render phase
    const manifestPath = join(projectDir, 'video_assets.json');
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    logger.info({ projectDir, videoCount: manifest.videos.length }, 'Wrote video_assets.json manifest');
  }

  return manifest;
}
