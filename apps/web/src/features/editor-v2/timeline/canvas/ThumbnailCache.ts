/**
 * ThumbnailCache
 * LRU cache for video frame thumbnails extracted via hidden <video> elements.
 */

const MAX_ENTRIES = 200;
const MAX_CONCURRENT = 2;

interface CacheEntry {
  bitmap: ImageBitmap;
  lastUsed: number;
}

class ThumbnailCache {
  private cache = new Map<string, CacheEntry>();
  private pending = new Set<string>();
  private activeExtractions = 0;
  private queue: Array<{ key: string; src: string; timeMs: number; callback: () => void }> = [];

  private makeKey(src: string, timeMs: number): string {
    return `${src}:${Math.round(timeMs / 500) * 500}`; // Round to 500ms intervals
  }

  getThumbnail(src: string, timeMs: number): ImageBitmap | null {
    const key = this.makeKey(src, timeMs);
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastUsed = Date.now();
      return entry.bitmap;
    }
    return null;
  }

  requestThumbnail(src: string, timeMs: number, callback: () => void): void {
    const key = this.makeKey(src, timeMs);
    if (this.cache.has(key) || this.pending.has(key)) return;

    this.pending.add(key);
    this.queue.push({ key, src, timeMs, callback });
    this.processQueue();
  }

  private processQueue(): void {
    while (this.activeExtractions < MAX_CONCURRENT && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.activeExtractions++;
      this.extractThumbnail(job.key, job.src, job.timeMs, job.callback);
    }
  }

  private async extractThumbnail(key: string, src: string, timeMs: number, callback: () => void): Promise<void> {
    try {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.preload = 'metadata';

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Failed to load video'));
        video.src = src;
      });

      // Seek to time
      const seekTime = Math.min(timeMs / 1000, video.duration - 0.1);
      video.currentTime = Math.max(0, seekTime);

      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
      });

      // Draw to offscreen canvas
      const thumbHeight = 56;
      const aspect = video.videoWidth / video.videoHeight;
      const thumbWidth = Math.round(thumbHeight * aspect);

      const offscreen = new OffscreenCanvas(thumbWidth, thumbHeight);
      const offCtx = offscreen.getContext('2d')!;
      offCtx.drawImage(video, 0, 0, thumbWidth, thumbHeight);

      const bitmap = await createImageBitmap(offscreen);

      // Evict if at capacity
      this.evictIfNeeded();

      this.cache.set(key, { bitmap, lastUsed: Date.now() });
      callback();
    } catch {
      // Silently fail — placeholder will remain
    } finally {
      this.pending.delete(key);
      this.activeExtractions--;
      this.processQueue();
    }
  }

  private evictIfNeeded(): void {
    if (this.cache.size < MAX_ENTRIES) return;

    // Find least recently used
    let oldestKey = '';
    let oldestTime = Infinity;
    for (const [key, entry] of this.cache) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      entry?.bitmap.close();
      this.cache.delete(oldestKey);
    }
  }

  clear(): void {
    for (const [, entry] of this.cache) {
      entry.bitmap.close();
    }
    this.cache.clear();
    this.pending.clear();
    this.queue = [];
  }
}

let instance: ThumbnailCache | null = null;

export function getThumbnailCache(): ThumbnailCache {
  if (!instance) instance = new ThumbnailCache();
  return instance;
}
