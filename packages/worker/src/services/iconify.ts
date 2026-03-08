/**
 * Iconify Public API Client
 *
 * Fallback icon source for brand/company keywords that return 0 results from Freepik.
 * Uses the free Iconify API (Cloudflare CDN, no auth, no rate limits).
 */

import { logger } from '../logger.js';
import type { IconOption } from './freepik.js';

const ICONIFY_API_BASE = 'https://api.iconify.design';

/** Preferred icon set prefixes, in priority order */
const PREFERRED_PREFIXES = ['simple-icons', 'logos', 'mdi', 'lucide'];

/**
 * Search Iconify for icons matching a term.
 * Returns up to `count` IconOption items with source: 'iconify'.
 */
export async function searchIconify(term: string, count: number = 5): Promise<IconOption[]> {
  try {
    const params = new URLSearchParams({
      query: term,
      limit: String(count * 3), // over-fetch to allow filtering/sorting
    });

    const response = await fetch(`${ICONIFY_API_BASE}/search?${params}`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      logger.warn({ status: response.status, term }, 'Iconify search failed');
      return [];
    }

    const data = await response.json() as {
      icons?: string[];  // e.g. ["simple-icons:slack", "mdi:slack"]
    };

    if (!data.icons || !Array.isArray(data.icons) || data.icons.length === 0) {
      return [];
    }

    // Sort by preferred prefix order, keeping original order for non-preferred
    const sorted = [...data.icons].sort((a, b) => {
      const prefixA = a.split(':')[0];
      const prefixB = b.split(':')[0];
      const idxA = PREFERRED_PREFIXES.indexOf(prefixA);
      const idxB = PREFERRED_PREFIXES.indexOf(prefixB);
      // Both preferred: sort by preference order
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      // Only one preferred: it wins
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      // Neither preferred: keep original order
      return 0;
    });

    return sorted.slice(0, count).flatMap((iconId) => {
      const colonIdx = iconId.indexOf(':');
      if (colonIdx === -1) return []; // skip malformed IDs without prefix:name format
      const prefix = iconId.slice(0, colonIdx);
      const name = iconId.slice(colonIdx + 1);
      return [{
        id: iconId,
        name: name.replace(/-/g, ' '),
        thumbnailUrl: `${ICONIFY_API_BASE}/${prefix}/${name}.svg?height=128`,
        source: 'iconify' as const,
      }];
    });
  } catch (err) {
    logger.error({ err, term }, 'Iconify search error');
    return [];
  }
}
