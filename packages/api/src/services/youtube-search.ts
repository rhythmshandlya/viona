/**
 * YouTube Video Search Service
 *
 * Searches YouTube videos using the YouTube Data API v3.
 * Used by AI to find relevant video clips for scene planning.
 */

import { config } from '../config.js';
import { logger } from '../logger.js';

// ============================================
// Types
// ============================================

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  thumbnail: {
    url: string;
    width: number;
    height: number;
  };
  duration?: string; // ISO 8601 duration (requires separate API call)
  viewCount?: string;
  url: string;
}

export interface YouTubeSearchOptions {
  maxResults?: number;
  videoDuration?: 'short' | 'medium' | 'long' | 'any';
  videoDefinition?: 'high' | 'standard' | 'any';
  order?: 'relevance' | 'date' | 'viewCount' | 'rating';
  type?: 'video' | 'channel' | 'playlist';
}

interface YouTubeApiSearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: {
      high?: { url: string; width: number; height: number };
      medium?: { url: string; width: number; height: number };
      default?: { url: string; width: number; height: number };
    };
  };
}

interface YouTubeApiSearchResponse {
  items: YouTubeApiSearchItem[];
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  nextPageToken?: string;
}

interface YouTubeApiVideoItem {
  id: string;
  contentDetails: {
    duration: string;
  };
  statistics: {
    viewCount: string;
  };
}

interface YouTubeApiVideosResponse {
  items: YouTubeApiVideoItem[];
}

// ============================================
// YouTube Search Service
// ============================================

class YouTubeSearchService {
  private readonly baseUrl = 'https://www.googleapis.com/youtube/v3';

  /**
   * Search YouTube for videos matching a query.
   */
  async searchVideos(
    query: string,
    options: YouTubeSearchOptions = {}
  ): Promise<YouTubeSearchResult[]> {
    const apiKey = config.youtube.apiKey;
    if (!apiKey) {
      logger.warn('YOUTUBE_API_KEY not configured — skipping video search');
      return [];
    }

    try {
      const {
        maxResults = 5,
        videoDuration = 'any',
        videoDefinition = 'any',
        order = 'relevance',
        type = 'video',
      } = options;

      // Build search params
      const params = new URLSearchParams({
        part: 'snippet',
        q: query,
        type,
        maxResults: String(maxResults),
        order,
        key: apiKey,
        // Only embeddable videos (important for legal compliance)
        videoEmbeddable: 'true',
        // Only Creative Commons or standard license
        videoSyndicated: 'true',
      });

      if (videoDuration !== 'any') {
        params.set('videoDuration', videoDuration);
      }
      if (videoDefinition !== 'any') {
        params.set('videoDefinition', videoDefinition);
      }

      const searchUrl = `${this.baseUrl}/search?${params}`;
      const response = await fetch(searchUrl);

      if (!response.ok) {
        logger.error({ status: response.status }, 'YouTube search API error');
        return [];
      }

      const data = (await response.json()) as YouTubeApiSearchResponse;

      if (!data.items || data.items.length === 0) {
        return [];
      }

      // Get video IDs for additional details (duration, view count)
      const videoIds = data.items.map((item) => item.id.videoId).join(',');
      const videoDetails = await this.getVideoDetails(videoIds, apiKey);

      // Map results with additional details
      return data.items.map((item) => {
        const details = videoDetails.get(item.id.videoId);
        const thumbnail =
          item.snippet.thumbnails.high ||
          item.snippet.thumbnails.medium ||
          item.snippet.thumbnails.default;

        return {
          videoId: item.id.videoId,
          title: item.snippet.title,
          description: item.snippet.description,
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
          thumbnail: thumbnail
            ? { url: thumbnail.url, width: thumbnail.width, height: thumbnail.height }
            : { url: '', width: 0, height: 0 },
          duration: details?.duration,
          viewCount: details?.viewCount,
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        };
      });
    } catch (err) {
      logger.error({ err }, 'YouTube search error');
      return [];
    }
  }

  /**
   * Get video details (duration, view count) for a list of video IDs.
   */
  private async getVideoDetails(
    videoIds: string,
    apiKey: string
  ): Promise<Map<string, { duration: string; viewCount: string }>> {
    const details = new Map<string, { duration: string; viewCount: string }>();

    try {
      const params = new URLSearchParams({
        part: 'contentDetails,statistics',
        id: videoIds,
        key: apiKey,
      });

      const response = await fetch(`${this.baseUrl}/videos?${params}`);
      if (!response.ok) {
        return details;
      }

      const data = (await response.json()) as YouTubeApiVideosResponse;

      for (const item of data.items) {
        details.set(item.id, {
          duration: this.parseDuration(item.contentDetails.duration),
          viewCount: item.statistics.viewCount,
        });
      }
    } catch {
      // Return empty map on error
    }

    return details;
  }

  /**
   * Parse ISO 8601 duration (PT1H2M3S) to human-readable format.
   */
  private parseDuration(isoDuration: string): string {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return isoDuration;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

export const youtubeSearchService = new YouTubeSearchService();
