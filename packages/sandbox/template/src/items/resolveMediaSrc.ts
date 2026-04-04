import { getRemotionEnvironment, staticFile } from 'remotion';

/**
 * Map of source file extensions → proxy file suffix.
 * Used by both sandbox composition and browser Player shim.
 */
export const PROXY_EXTENSIONS: Record<string, string> = {
  '.mp4': '-proxy.mp4',
  '.webm': '-proxy.mp4',
  '.png': '-proxy.webp',
  '.jpg': '-proxy.webp',
  '.jpeg': '-proxy.webp',
  '.webp': '-proxy.webp',
  '.aac': '-proxy.aac',
  '.mp3': '-proxy.aac',
  '.wav': '-proxy.aac',
  '.m4a': '-proxy.aac',
};

/**
 * Derive the proxy filename for a given source path.
 * Returns null if the extension is not in the proxy map.
 *
 * Example: "source.mp4" → "source-proxy.mp4"
 */
export function deriveProxyKey(src: string): string | null {
  if (!src) return null;
  if (src.includes('-proxy.')) return null; // Already a proxy
  const ext = src.match(/\.\w+$/)?.[0]?.toLowerCase();
  if (ext && PROXY_EXTENSIONS[ext]) {
    return src.replace(/\.\w+$/, PROXY_EXTENSIONS[ext]);
  }
  return null;
}

/**
 * Resolve a media source path to a playable URL.
 *
 * In preview mode: prefers proxy variant if available in assets map.
 * In render mode (remotion render / remotion still): uses local staticFile.
 *   Presigned URLs in the assets map are for browser access outside the
 *   sandbox container — headless Chrome inside Docker can't reach them.
 * In browser player: uses assets map for presigned URLs.
 *
 * Resolution order:
 *   Preview:  proxy → assets map → absolute URL → staticFile
 *   Render:   absolute URL → staticFile (skip assets map)
 *   Browser:  assets map → absolute URL → staticFile
 */
export function resolveMediaSrc(
  src: string,
  assets: Record<string, string>,
): string {
  if (!src) return '';
  const { isRendering } = getRemotionEnvironment();

  // In preview mode, prefer proxy if available in assets
  if (!isRendering) {
    const proxyKey = deriveProxyKey(src);
    if (proxyKey && assets[proxyKey]) return assets[proxyKey];
  }

  // Inside sandbox render (remotion render / remotion still): use local files.
  // The assets map contains presigned MinIO URLs meant for browser access
  // outside the container. Headless Chrome inside Docker can't reach them.
  if (isRendering) {
    if (/^https?:\/\/|^blob:/.test(src)) return src;
    return staticFile(src);
  }

  // Browser player: assets map → absolute URL → staticFile
  if (assets[src]) return assets[src];
  if (/^https?:\/\/|^blob:/.test(src)) return src;
  return staticFile(src);
}
