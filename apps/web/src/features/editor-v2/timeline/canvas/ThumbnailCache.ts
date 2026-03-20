/**
 * ThumbnailCache
 * LRU cache for video frame thumbnails extracted via hidden <video> elements.
 *
 * Handles both same-origin and cross-origin videos:
 * - Same-origin: uses ImageBitmap (efficient, transferable)
 * - Cross-origin without CORS: falls back to HTMLCanvasElement
 *   (canvas gets tainted but drawImage still works for rendering)
 */

const MAX_ENTRIES = 200;
const MAX_CONCURRENT = 3;
const LOAD_TIMEOUT = 15_000;
const SEEK_TIMEOUT = 5_000;

export type ThumbnailSource = ImageBitmap | HTMLCanvasElement;

interface CacheEntry {
  source: ThumbnailSource;
  lastUsed: number;
}

class ThumbnailCache {
  private cache = new Map<string, CacheEntry>();
  private pending = new Set<string>();
  private failed = new Map<string, number>(); // src → failure timestamp (avoid retry storms)
  private activeExtractions = 0;
  private queue: Array<{ key: string; src: string; timeMs: number; callback: () => void }> = [];
  private static FAIL_COOLDOWN = 30_000; // Don't retry a failed src for 30s

  private makeKey(src: string, timeMs: number): string {
    return `${src}:${Math.round(timeMs / 500) * 500}`; // Round to 500ms intervals
  }

  getThumbnail(src: string, timeMs: number): ThumbnailSource | null {
    const key = this.makeKey(src, timeMs);
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastUsed = Date.now();
      return entry.source;
    }
    return null;
  }

  requestThumbnail(src: string, timeMs: number, callback: () => void): void {
    const key = this.makeKey(src, timeMs);
    if (this.cache.has(key) || this.pending.has(key)) return;

    // Skip sources that recently failed (avoid retry storms with bad URLs)
    const failedAt = this.failed.get(src);
    if (failedAt && Date.now() - failedAt < ThumbnailCache.FAIL_COOLDOWN) return;

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
    let video: HTMLVideoElement | null = null;
    try {
      video = document.createElement('video');
      // Do NOT set crossOrigin — thumbnailSrc should be same-origin via /media-proxy rewrite.
      video.muted = true;
      video.preload = 'auto';

      // Load video with timeout
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Video load timeout')), LOAD_TIMEOUT);
        video!.onloadeddata = () => { clearTimeout(timeout); resolve(); };
        video!.onerror = () => { clearTimeout(timeout); reject(new Error('Video load error')); };
        video!.src = src;
      });

      // Seek — set handler BEFORE changing currentTime to avoid race condition
      const seekTime = Math.min(timeMs / 1000, (video.duration || 1) - 0.1);
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, SEEK_TIMEOUT);
        video!.onseeked = () => { clearTimeout(timeout); resolve(); };
        video!.currentTime = Math.max(0, seekTime);
      });

      // Calculate thumbnail dimensions
      const thumbHeight = 72;
      const aspect = (video.videoWidth && video.videoHeight)
        ? (video.videoWidth / video.videoHeight)
        : (16 / 9);
      const thumbWidth = Math.round(thumbHeight * aspect);

      // Try ImageBitmap (works for same-origin, throws on tainted canvas)
      let source: ThumbnailSource;
      try {
        const offscreen = new OffscreenCanvas(thumbWidth, thumbHeight);
        const offCtx = offscreen.getContext('2d')!;
        offCtx.drawImage(video, 0, 0, thumbWidth, thumbHeight);
        source = await createImageBitmap(offscreen);
      } catch {
        // Cross-origin fallback: draw to a regular canvas.
        // The canvas is tainted but ctx.drawImage(canvas, ...) still works for rendering.
        const canvas = document.createElement('canvas');
        canvas.width = thumbWidth;
        canvas.height = thumbHeight;
        canvas.getContext('2d')!.drawImage(video, 0, 0, thumbWidth, thumbHeight);
        source = canvas;
      }

      this.evictIfNeeded();
      this.cache.set(key, { source, lastUsed: Date.now() });
      callback();
    } catch (err) {
      console.warn('[ThumbnailCache] extraction failed:', err);
      this.failed.set(src, Date.now());
    } finally {
      // Release video resources
      if (video) {
        video.removeAttribute('src');
        video.load();
      }
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
      if (entry?.source instanceof ImageBitmap) entry.source.close();
      this.cache.delete(oldestKey);
    }
  }

  clear(): void {
    for (const [, entry] of this.cache) {
      if (entry.source instanceof ImageBitmap) entry.source.close();
    }
    this.cache.clear();
    this.pending.clear();
    this.failed.clear();
    this.queue = [];
  }
}

let instance: ThumbnailCache | null = null;

export function getThumbnailCache(): ThumbnailCache {
  if (!instance) instance = new ThumbnailCache();
  return instance;
}
