/**
 * Image Fetcher Orchestrator
 *
 * Reads [IMAGE: keyword] entries from scenes.json, routes requests to
 * Pexels (photos) or Freepik (illustrations), downloads images to the
 * Remotion workspace, and updates scene data with local file paths.
 *
 * Pipeline: Director → scenes.json → Image Fetcher → updated scenes.json + images → Animator
 */

import { mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { logger } from '../logger.js';
import { searchPhotos, downloadPhoto, type PexelsPhoto } from './pexels.js';
import { searchResources, downloadResource, type ResourceOption } from './freepik.js';

// =============================================================================
// Types
// =============================================================================

/** Image entry as written by the Director in scenes.json */
export interface SceneImageRequest {
  keyword: string;
  type: 'photo' | 'illustration';
  purpose: 'hero' | 'accent' | 'background';
  description?: string;
  placement?: 'center' | 'background' | 'left' | 'right';
}

/** Image entry after fetching — includes local paths and attribution */
export interface FetchedImage extends SceneImageRequest {
  localPath: string;
  remotionPath: string;
  source: 'pexels' | 'freepik';
  attribution: string;
  width?: number;
  height?: number;
}

/** A scene object from scenes.json (partial — only fields we care about) */
interface SceneEntry {
  id: number | string;
  name?: string;
  images?: SceneImageRequest[];
  [key: string]: unknown;
}

/** The top-level scenes.json structure */
interface ScenesData {
  scenes: SceneEntry[];
  [key: string]: unknown;
}

/** Image option for plan pipeline (before download — used in plan-visuals.ts) */
export interface ImageOption {
  id: string;
  title: string;
  thumbnailUrl: string;
  source: 'pexels' | 'freepik';
  type: 'photo' | 'illustration';
}

// =============================================================================
// Constants
// =============================================================================

const MAX_IMAGES_PER_SCENE = 2;
const MAX_TOTAL_IMAGES = 10;
const CONCURRENCY_LIMIT = 5;
const TOTAL_TIMEOUT_MS = 60_000;

// =============================================================================
// Main Orchestrator
// =============================================================================

/**
 * Fetch images for all scenes and download them to the workspace.
 *
 * @param scenesData - Parsed scenes.json content
 * @param workspacePath - Root workspace path (images go into public/assets/images/)
 * @returns Updated scenesData with localPath/remotionPath populated on fetched images
 */
export async function fetchImagesForScenes(
  scenesData: ScenesData,
  workspacePath: string,
): Promise<{ updatedScenes: ScenesData; downloadedCount: number }> {
  const imagesDir = join(workspacePath, 'public', 'assets', 'images');
  await mkdir(imagesDir, { recursive: true });

  // Collect all image requests across scenes (respecting budgets)
  const tasks: Array<{
    sceneIndex: number;
    imageIndex: number;
    request: SceneImageRequest;
  }> = [];

  for (let si = 0; si < scenesData.scenes.length; si++) {
    const scene = scenesData.scenes[si];
    if (!scene.images || !Array.isArray(scene.images)) continue;

    // Cap per-scene
    const sceneImages = scene.images.slice(0, MAX_IMAGES_PER_SCENE);
    for (let ii = 0; ii < sceneImages.length; ii++) {
      if (tasks.length >= MAX_TOTAL_IMAGES) break;
      tasks.push({ sceneIndex: si, imageIndex: ii, request: sceneImages[ii] });
    }
    if (tasks.length >= MAX_TOTAL_IMAGES) break;
  }

  if (tasks.length === 0) {
    logger.info('No image requests found in scenes — skipping image fetch');
    return { updatedScenes: scenesData, downloadedCount: 0 };
  }

  logger.info({ taskCount: tasks.length }, 'Fetching images for scenes');

  // Execute with concurrency limit and total timeout
  let downloadedCount = 0;

  const results = await Promise.race([
    runWithConcurrency(
      tasks,
      async (task) => {
        const sceneId = scenesData.scenes[task.sceneIndex].id ?? task.sceneIndex + 1;
        const slug = slugify(task.request.keyword);
        const fetched = await fetchSingleImage(
          task.request,
          imagesDir,
          `scene${sceneId}-${task.request.purpose}-${slug}`,
        );
        return { ...task, fetched };
      },
      CONCURRENCY_LIMIT,
    ),
    timeoutPromise(TOTAL_TIMEOUT_MS),
  ]);

  // Apply results back to scenesData
  if (Array.isArray(results)) {
    for (const result of results) {
      if (result.fetched) {
        const scene = scenesData.scenes[result.sceneIndex];
        if (!scene.images) scene.images = [];
        // Replace the request entry with the fetched version
        scene.images[result.imageIndex] = result.fetched;
        downloadedCount++;
      }
    }
  }

  // Clean up any image entries that weren't fetched (remove entries without remotionPath)
  for (const scene of scenesData.scenes) {
    if (scene.images && Array.isArray(scene.images)) {
      scene.images = scene.images.filter(
        (img) => 'remotionPath' in img && (img as FetchedImage).remotionPath,
      ) as SceneImageRequest[];
    }
  }

  logger.info({ downloadedCount, total: tasks.length }, 'Image fetching complete');
  return { updatedScenes: scenesData, downloadedCount };
}

// =============================================================================
// Plan Pipeline — Fetch image options (thumbnails only, no download)
// =============================================================================

/**
 * For the plan pipeline (plan-visuals.ts): search for image options per scene
 * and attach thumbnails for user preview. Does NOT download full images.
 */
export async function fetchImageOptionsForPlan<T extends { scenes?: unknown; [key: string]: unknown }>(
  planData: T,
): Promise<T & { imageOptions?: Record<string, Record<string, ImageOption[]>> }> {
  const scenesObj = planData.scenes as Record<string, unknown> | undefined;
  const scenesArray = ((scenesObj as any)?.scenes as SceneEntry[]) || [];

  // Collect unique keywords mapped to scene IDs and types
  const keywordMap = new Map<string, { sceneIds: string[]; type: 'photo' | 'illustration' }>();

  for (const scene of scenesArray) {
    if (!scene.images || !Array.isArray(scene.images)) continue;
    const sceneId = String(scene.id ?? scene.name ?? '');
    for (const img of scene.images) {
      const key = `${img.keyword}:${img.type}`;
      const existing = keywordMap.get(key);
      if (existing) {
        existing.sceneIds.push(sceneId);
      } else {
        keywordMap.set(key, { sceneIds: [sceneId], type: img.type });
      }
    }
  }

  if (keywordMap.size === 0) {
    logger.info('No image keywords found in plan — skipping image options fetch');
    return planData;
  }

  logger.info({ keywordCount: keywordMap.size }, 'Fetching image options for plan');

  // Fetch options for each unique keyword
  const entries = [...keywordMap.entries()];
  const results = await Promise.all(
    entries.map(async ([key, { sceneIds, type }]) => {
      const keyword = key.split(':')[0];
      const options = await searchImageOptions(keyword, type, 3);
      return { keyword, sceneIds, options };
    }),
  );

  // Build imageOptions map: { sceneId: { keyword: ImageOption[] } }
  const imageOptions: Record<string, Record<string, ImageOption[]>> = {};
  for (const { keyword, sceneIds, options } of results) {
    if (options.length === 0) continue;
    for (const sceneId of sceneIds) {
      if (!imageOptions[sceneId]) imageOptions[sceneId] = {};
      imageOptions[sceneId][keyword] = options;
    }
  }

  logger.info({ sceneCount: Object.keys(imageOptions).length }, 'Image options fetched for plan');
  return { ...planData, imageOptions };
}

// =============================================================================
// Internal Helpers
// =============================================================================

async function fetchSingleImage(
  request: SceneImageRequest,
  imagesDir: string,
  filePrefix: string,
): Promise<FetchedImage | null> {
  try {
    if (request.type === 'photo') {
      return await fetchPexelsPhoto(request, imagesDir, filePrefix);
    } else {
      return await fetchFreepikIllustration(request, imagesDir, filePrefix);
    }
  } catch (err) {
    logger.warn({ err, keyword: request.keyword, type: request.type }, 'Image fetch failed — skipping');
    return null;
  }
}

async function fetchPexelsPhoto(
  request: SceneImageRequest,
  imagesDir: string,
  filePrefix: string,
): Promise<FetchedImage | null> {
  const photos = await searchPhotos(request.keyword, { perPage: 3 });
  if (photos.length === 0) return null;

  // Pick the first result
  const photo = photos[0];
  const filename = `${filePrefix}.jpg`;
  const destPath = join(imagesDir, filename);

  const dims = await downloadPhoto(photo, destPath);
  if (!dims) return null;

  return {
    ...request,
    localPath: destPath,
    remotionPath: `assets/images/${filename}`,
    source: 'pexels',
    attribution: `Photo by ${photo.photographer} on Pexels`,
    width: dims.width,
    height: dims.height,
  };
}

async function fetchFreepikIllustration(
  request: SceneImageRequest,
  imagesDir: string,
  filePrefix: string,
): Promise<FetchedImage | null> {
  const resources = await searchResources(request.keyword, 3, 'vector');
  if (resources.length === 0) return null;

  const resource = resources[0];
  const filename = `${filePrefix}.jpg`;
  const destPath = join(imagesDir, filename);

  const success = await downloadResource(resource.id, destPath);
  if (!success) return null;

  return {
    ...request,
    localPath: destPath,
    remotionPath: `assets/images/${filename}`,
    source: 'freepik',
    attribution: `Illustration from Freepik`,
  };
}

async function searchImageOptions(
  keyword: string,
  type: 'photo' | 'illustration',
  count: number,
): Promise<ImageOption[]> {
  if (type === 'photo') {
    const photos = await searchPhotos(keyword, { perPage: count });
    return photos.map((p) => ({
      id: String(p.id),
      title: p.alt || keyword,
      thumbnailUrl: p.src.small,
      source: 'pexels' as const,
      type: 'photo' as const,
    }));
  } else {
    const resources = await searchResources(keyword, count, 'vector');
    return resources.map((r) => ({
      id: r.id,
      title: r.title,
      thumbnailUrl: r.thumbnailUrl,
      source: 'freepik' as const,
      type: 'illustration' as const,
    }));
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

/**
 * Run async tasks with a concurrency limit.
 */
async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  limit: number,
): Promise<R[]> {
  const results: R[] = [];
  const executing = new Set<Promise<void>>();

  for (const item of items) {
    const p = fn(item).then((r) => {
      results.push(r);
    });
    const tracked = p.then(() => { executing.delete(tracked); });
    executing.add(tracked);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

function timeoutPromise(ms: number): Promise<null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      logger.warn({ timeoutMs: ms }, 'Image fetch total timeout reached');
      resolve(null);
    }, ms);
  });
}
