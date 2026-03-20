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
 * In render mode (remotion render / remotion still): always uses original for full quality.
 *
 * Note: getRemotionEnvironment().isRendering is true for BOTH `remotion render` and
 * `remotion still`. This means QC screenshots also use originals. If QC speed matters
 * more than pixel accuracy, this gate can be refined later.
 *
 * Resolution order: proxy (if preview) → assets map → absolute URL → staticFile
 */
export function resolveMediaSrc(
  src: string,
  assets: Record<string, string>,
): string {
  const { isRendering } = getRemotionEnvironment();

  // In preview mode, prefer proxy if available in assets
  if (!isRendering) {
    const proxyKey = deriveProxyKey(src);
    if (proxyKey && assets[proxyKey]) return assets[proxyKey];
  }

  // Standard resolution: assets map → absolute URL → staticFile
  if (assets[src]) return assets[src];
  if (/^https?:\/\/|^blob:/.test(src)) return src;
  return staticFile(src);
}
