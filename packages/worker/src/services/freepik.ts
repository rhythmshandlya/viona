/**
 * Freepik REST API Client
 *
 * Lightweight client for searching and downloading icons and resources from Freepik's API.
 * Used during plan generation to fetch SVG options for user selection and illustrations for scenes.
 */

import { writeFile } from 'fs/promises';
import { config } from '../config.js';
import { logger } from '../logger.js';

export interface IconOption {
  id: string;
  name: string;
  thumbnailUrl: string;
}

const FREEPIK_API_BASE = 'https://api.freepik.com/v1';

function getHeaders(): Record<string, string> {
  return {
    'x-freepik-api-key': config.freepik.apiKey,
    'Accept': 'application/json',
  };
}

/**
 * Search Freepik for icons matching a term.
 * Returns up to `count` icon options with id, name, and thumbnail URL.
 */
export async function searchIcons(term: string, count: number = 5): Promise<IconOption[]> {
  if (!config.freepik.apiKey) {
    logger.warn('FREEPIK_API_KEY not configured — skipping icon search');
    return [];
  }

  try {
    const params = new URLSearchParams({
      term,
      per_page: String(count),
      thumbnail_size: '128',
    });

    const response = await fetch(`${FREEPIK_API_BASE}/icons?${params}`, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      logger.warn({ status: response.status, term }, 'Freepik icon search failed');
      return [];
    }

    const data = await response.json() as {
      data?: Array<{
        id: number;
        description?: string;
        thumbnails?: Array<{ url: string }>;
      }>;
    };

    if (!data.data || !Array.isArray(data.data)) {
      return [];
    }

    return data.data.slice(0, count).map((icon) => ({
      id: String(icon.id),
      name: icon.description || term,
      thumbnailUrl: icon.thumbnails?.[0]?.url || '',
    }));
  } catch (err) {
    logger.error({ err, term }, 'Freepik icon search error');
    return [];
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

    const buffer = Buffer.from(await fileResponse.arrayBuffer());
    await writeFile(destPath, buffer);

    logger.info({ id, destPath, bytes: buffer.length }, 'Freepik resource downloaded');
    return true;
  } catch (err) {
    logger.error({ err, id }, 'Freepik resource download error');
    return false;
  }
}
