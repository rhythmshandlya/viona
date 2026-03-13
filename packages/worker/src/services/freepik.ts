/**
 * Freepik REST API Client
 *
 * Lightweight client for searching and downloading icons and resources from Freepik's API.
 * Used during plan generation to fetch SVG options for user selection and illustrations for scenes.
 */

import { writeFile } from 'fs/promises';
import { extname } from 'path';
import { Open as unzipOpen } from 'unzipper';
import { config } from '../config.js';
import { logger } from '../logger.js';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']);

export interface IconOption {
  id: string;
  name: string;
  thumbnailUrl: string;
  source: 'freepik' | 'iconify';
}

const FREEPIK_API_BASE = 'https://api.freepik.com/v1';

function getHeaders(): Record<string, string> {
  return {
    'x-freepik-api-key': config.freepik.apiKey,
    'Accept': 'application/json',
  };
}

export interface IconStyleFilters {
  shape?: 'outline' | 'fill' | 'lineal-color' | 'hand-drawn';
  color?: string; // e.g. 'solid-black', 'white', 'multicolor', 'blue', etc.
  familyId?: number; // locks all icons to one design family for visual consistency
}

export interface SearchIconsResult {
  options: IconOption[];
  familyId?: number; // family.id from the top result (if available)
}

/**
 * Search Freepik for icons matching a term.
 * Returns up to `count` icon options with id, name, and thumbnail URL.
 * Optional style filters ensure visual consistency across a plan.
 */
export async function searchIcons(term: string, count: number = 5, style?: IconStyleFilters): Promise<SearchIconsResult> {
  if (!config.freepik.apiKey) {
    logger.warn('FREEPIK_API_KEY not configured — skipping icon search');
    return { options: [] };
  }

  try {
    const params = new URLSearchParams({
      term,
      per_page: String(count),
      thumbnail_size: '128',
    });
    if (style?.shape) params.set('filters[shape]', style.shape);
    if (style?.color) params.set('filters[color]', style.color);
    if (style?.familyId !== undefined) params.set('family-id', String(style.familyId));

    const response = await fetch(`${FREEPIK_API_BASE}/icons?${params}`, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      logger.warn({ status: response.status, term }, 'Freepik icon search failed');
      return { options: [] };
    }

    const data = await response.json() as {
      data?: Array<{
        id: number;
        description?: string;
        thumbnails?: Array<{ url: string }>;
        family?: { id: number; name?: string };
      }>;
    };

    if (!data.data || !Array.isArray(data.data)) {
      return { options: [] };
    }

    const options = data.data.slice(0, count).map((icon) => ({
      id: String(icon.id),
      name: icon.description || term,
      thumbnailUrl: icon.thumbnails?.[0]?.url || '',
      source: 'freepik' as const,
    }));

    // Extract family.id from the top result for family-ID locking
    const familyId = data.data[0]?.family?.id;

    return { options, familyId };
  } catch (err) {
    logger.error({ err, term }, 'Freepik icon search error');
    return { options: [] };
  }
}

/**
 * Download an icon's SVG content by ID.
 */
export async function getIconSvg(id: string): Promise<string | null> {
  if (!config.freepik.apiKey) {
    logger.warn('FREEPIK_API_KEY not configured — cannot download icon');
    return null;
  }

  try {
    const params = new URLSearchParams({ format: 'svg' });
    const response = await fetch(`${FREEPIK_API_BASE}/icons/${id}/download?${params}`, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      logger.warn({ status: response.status, id }, 'Freepik icon download failed');
      return null;
    }

    const data = await response.json() as { data?: { url?: string } };
    if (!data.data?.url) return null;

    // Fetch the actual SVG content
    const svgResponse = await fetch(data.data.url);
    if (!svgResponse.ok) return null;

    return await svgResponse.text();
  } catch (err) {
    logger.error({ err, id }, 'Freepik icon download error');
    return null;
  }
}

// =============================================================================
// Resource Search & Download (illustrations, vectors)
// =============================================================================

export interface ResourceOption {
  id: string;
  title: string;
  thumbnailUrl: string;
  type: 'vector' | 'photo' | 'psd';
}

/**
 * Search Freepik for resources (vectors/illustrations/photos).
 * Returns up to `count` resource options.
 *
 * @param contentType - Filter by content type: 'vector' for illustrations, 'photo' for photos
 */
export async function searchResources(
  term: string,
  count: number = 5,
  contentType: 'vector' | 'photo' = 'vector',
): Promise<ResourceOption[]> {
  if (!config.freepik.apiKey) {
    logger.warn('FREEPIK_API_KEY not configured — skipping resource search');
    return [];
  }

  try {
    const params = new URLSearchParams({
      term,
      limit: String(count),
    });
    // Apply content_type filter
    params.set(`filters[content_type][${contentType}]`, '1');

    const response = await fetch(`${FREEPIK_API_BASE}/resources?${params}`, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      logger.warn({ status: response.status, term, contentType }, 'Freepik resource search failed');
      return [];
    }

    const data = await response.json() as {
      data?: Array<{
        id: number;
        title?: string;
        image?: { source?: { url?: string } };
        type?: string;
      }>;
    };

    if (!data.data || !Array.isArray(data.data)) {
      return [];
    }

    return data.data.slice(0, count).map((resource) => ({
      id: String(resource.id),
      title: resource.title || term,
      thumbnailUrl: resource.image?.source?.url || '',
      type: (resource.type as ResourceOption['type']) || contentType,
    }));
  } catch (err) {
    logger.error({ err, term }, 'Freepik resource search error');
    return [];
  }
}

/**
 * Download a Freepik resource image file by ID.
 * Fetches the download URL and saves the image to destPath.
 *
 * @returns true if download succeeded, false otherwise.
 */
export async function downloadResource(id: string, destPath: string): Promise<boolean> {
  if (!config.freepik.apiKey) {
    logger.warn('FREEPIK_API_KEY not configured — cannot download resource');
    return false;
  }

  try {
    const response = await fetch(`${FREEPIK_API_BASE}/resources/${id}/download`, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      logger.warn({ status: response.status, id }, 'Freepik resource download failed');
      return false;
    }

    const data = await response.json() as { data?: { url?: string } };
    if (!data.data?.url) return false;

    // Download the actual file
    const fileResponse = await fetch(data.data.url);
    if (!fileResponse.ok) return false;

    let buffer = Buffer.from(await fileResponse.arrayBuffer());

    // Freepik returns ZIP archives containing the image + vector source files.
    // Extract the actual image if the response is a ZIP.
    if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
      try {
        const directory = await unzipOpen.buffer(buffer);
        const imageFiles = directory.files
          .filter((f: { path: string; uncompressedSize: number }) => {
            const ext = extname(f.path).toLowerCase();
            return IMAGE_EXTENSIONS.has(ext) && f.uncompressedSize > 0;
          })
          .sort((a: { uncompressedSize: number }, b: { uncompressedSize: number }) => b.uncompressedSize - a.uncompressedSize);

        if (imageFiles.length > 0) {
          buffer = Buffer.from(await imageFiles[0].buffer());
          logger.info({ id, extractedFile: imageFiles[0].path, bytes: buffer.length }, 'Extracted image from Freepik ZIP');
        } else {
          const allFiles = directory.files.map((f: { path: string }) => f.path);
          logger.warn({ id, files: allFiles }, 'Freepik ZIP contains no raster images (vector-only resource)');
          return false;
        }
      } catch (err) {
        logger.warn({ id, err }, 'Failed to extract from ZIP — skipping resource');
        return false;
      }
    }

    await writeFile(destPath, buffer);

    logger.info({ id, destPath, bytes: buffer.length }, 'Freepik resource downloaded');
    return true;
  } catch (err) {
    logger.error({ err, id }, 'Freepik resource download error');
    return false;
  }
}
