/**
 * Pexels Photo API Client
 *
 * Searches and downloads photos from Pexels for use in Remotion visual compositions.
 * Photos are used as hero images, accents, or backgrounds in scenes tagged with [IMAGE: keyword].
 */

import { writeFile } from 'fs/promises';
import { config } from '../config.js';
import { logger } from '../logger.js';

export interface PexelsPhotoSrc {
  original: string;
  large2x: string;
  large: string;    // 940px wide — optimal for compositions
  medium: string;
  small: string;
  portrait: string;
  landscape: string;
  tiny: string;
}

export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  photographer_id: number;
  avg_color: string;
  src: PexelsPhotoSrc;
  alt: string;
}

interface PexelsPhotoSearchResponse {
  page: number;
  per_page: number;
  total_results: number;
  photos: PexelsPhoto[];
}

/**
 * Search Pexels for photos matching a query.
 * Returns up to `perPage` photo results.
 */
export async function searchPhotos(
  query: string,
  options?: { perPage?: number; orientation?: 'landscape' | 'portrait' | 'square' },
): Promise<PexelsPhoto[]> {
  const apiKey = config.pexels.apiKey;
  if (!apiKey) {
    logger.warn('PEXELS_API_KEY not configured — skipping photo search');
    return [];
  }

  try {
    const params = new URLSearchParams({
      query,
      per_page: String(options?.perPage ?? 5),
    });
    if (options?.orientation) {
      params.set('orientation', options.orientation);
    }

    const response = await fetch(`https://api.pexels.com/v1/search?${params}`, {
      headers: { Authorization: apiKey },
    });

    if (!response.ok) {
      logger.warn({ status: response.status, query }, 'Pexels photo search failed');
      return [];
    }

    const data = (await response.json()) as PexelsPhotoSearchResponse;
    return data.photos ?? [];
  } catch (err) {
    logger.error({ err, query }, 'Pexels photo search error');
    return [];
  }
}

/**
 * Download a Pexels photo to a local path.
 * Uses `src.large` (940px) by default for optimal quality/size balance.
 *
 * @returns The downloaded photo dimensions { width, height } or null on failure.
 */
export async function downloadPhoto(
  photo: PexelsPhoto,
  destPath: string,
  size: keyof PexelsPhotoSrc = 'large',
): Promise<{ width: number; height: number } | null> {
  const url = photo.src[size];
  if (!url) {
    logger.warn({ photoId: photo.id, size }, 'Pexels photo URL not available for size');
    return null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      logger.warn({ status: response.status, photoId: photo.id }, 'Pexels photo download failed');
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(destPath, buffer);

    logger.info({ photoId: photo.id, destPath, bytes: buffer.length }, 'Pexels photo downloaded');
    return { width: photo.width, height: photo.height };
  } catch (err) {
    logger.error({ err, photoId: photo.id }, 'Pexels photo download error');
    return null;
  }
}
