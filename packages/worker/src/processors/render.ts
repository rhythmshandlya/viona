import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { mkdir, rm, access, constants, readFile, writeFile, readdir, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import { db, projects, tracks, timelineItems, jobs, visuals } from '../db/index.js';
import { downloadFile, uploadFile, listObjects } from '../services/minio.js';
import { publishJobProgress, publishJobComplete, publishJobError, setJobProjectId } from '../services/redis.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { renderVideo, SubtitleItem, SubtitleStyle } from '@viona/renderer';
import { renderMedia, selectComposition, getCompositions } from '@remotion/renderer';
import { bundle } from '@remotion/bundler';

// Font directory for FFmpeg's libass subtitle filter.
// In Docker (production), fonts are installed in /usr/share/fonts.
// Locally, we download and cache Google Fonts to a local directory.
const SYSTEM_FONTS_DIR = '/usr/share/fonts';
const LOCAL_FONTS_CACHE = join(tmpdir(), 'clippify-fonts');

/**
 * Escape a filesystem path for use inside FFmpeg filter option values
 * (e.g. the `fontsdir` option in the `subtitles` filter).
 *
 * FFmpeg's filtergraph parser treats `:` as an option separator, so Windows
 * paths like `C:\Users\...` break filters that take path arguments. The fix
 * requires TWO levels of escaping:
 *   1. Backslash-escape the colon: `C:` → `C\:`  (tells the parser it's literal)
 *   2. Wrap in single quotes: `'C\:/...'`  (protects from further splitting)
 *
 * Verified working with FFmpeg 8.x on Windows. On Linux/macOS (no colons in
 * paths), the function is effectively a no-op.
 */
function escapePathForFilter(p: string): string {
  const normalized = p.replace(/\\/g, '/');
  // Windows paths contain drive letter colons (C:) which FFmpeg misparses
  if (normalized.includes(':')) {
    // Escape single quotes already in the path, then escape colons, then wrap
    const escaped = normalized
      .replace(/'/g, "'\\''")
      .replace(/:/g, '\\:');
    return "'" + escaped + "'";
  }
  return normalized;
}

// Google Fonts CSS API query strings for each font.
// We fetch the CSS with a non-browser User-Agent to get TTF URLs from fonts.gstatic.com,
// then download the individual TTF files directly.
// NOTE: The old fonts.google.com/download?family=X URLs are BROKEN — they return HTML
// instead of ZIP files. This CSS API approach is the reliable alternative.
const GOOGLE_FONT_URLS: Record<string, string> = {
  // Sans-serif
  'Roboto': 'Roboto:wght@400;500;700;900',
  'Open Sans': 'Open+Sans:wght@400;500;600;700;800',
  'Lato': 'Lato:wght@400;700;900',
  'Montserrat': 'Montserrat:wght@400;500;600;700;800;900',
  'Poppins': 'Poppins:wght@400;500;600;700;800;900',
  'Inter': 'Inter:wght@400;500;600;700;800;900',
  'Raleway': 'Raleway:wght@400;500;600;700;800;900',
  'Nunito': 'Nunito:wght@400;600;700;800;900',
  'Nunito Sans': 'Nunito+Sans:wght@400;600;700;800;900',
  'Ubuntu': 'Ubuntu:wght@400;500;700',
  'Rubik': 'Rubik:wght@400;500;600;700;800;900',
  'Noto Sans': 'Noto+Sans:wght@400;500;600;700;800;900',
  'Oswald': 'Oswald:wght@400;500;600;700',
  'Roboto Condensed': 'Roboto+Condensed:wght@400;500;700;900',
  'DM Sans': 'DM+Sans:wght@400;500;600;700',
  'Kanit': 'Kanit:wght@400;500;600;700;800;900',
  'Work Sans': 'Work+Sans:wght@400;500;600;700;800;900',
  'Quicksand': 'Quicksand:wght@400;500;600;700',
  'Barlow': 'Barlow:wght@400;500;600;700;800;900',
  'Mulish': 'Mulish:wght@400;500;600;700;800;900',
  'Manrope': 'Manrope:wght@400;500;600;700;800',
  'Karla': 'Karla:wght@400;500;600;700;800',
  'Cabin': 'Cabin:wght@400;500;600;700',
  'Libre Franklin': 'Libre+Franklin:wght@400;500;600;700;800;900',
  'Outfit': 'Outfit:wght@400;500;600;700;800',
  'Source Sans 3': 'Source+Sans+3:wght@400;600;700',
  'Space Grotesk': 'Space+Grotesk:wght@400;500;600;700',
  'PT Sans': 'PT+Sans:wght@400;700',
  'Josefin Sans': 'Josefin+Sans:wght@400;500;600;700',
  'Titillium Web': 'Titillium+Web:wght@400;600;700;900',
  'Archivo': 'Archivo:wght@400;500;600;700;800;900',
  'Overpass': 'Overpass:wght@400;500;600;700;800;900',
  'Arimo': 'Arimo:wght@400;500;600;700',
  'Exo 2': 'Exo+2:wght@400;500;600;700;800;900',
  'Comfortaa': 'Comfortaa:wght@400;500;600;700',
  'Merriweather Sans': 'Merriweather+Sans:wght@400;500;600;700;800',
  'Signika': 'Signika:wght@400;500;600;700',
  'Red Rose': 'Red+Rose:wght@400;500;600;700',
  'Oxanium': 'Oxanium:wght@400;500;600;700;800',
  'Sofia Sans Extra Condensed': 'Sofia+Sans+Extra+Condensed:wght@400;500;600;700;800;900',
  // Serif
  'Playfair Display': 'Playfair+Display:wght@400;500;600;700;800;900',
  'Lora': 'Lora:wght@400;500;600;700',
  'Merriweather': 'Merriweather:wght@400;700;900',
  'Roboto Slab': 'Roboto+Slab:wght@400;500;600;700;800;900',
  'PT Serif': 'PT+Serif:wght@400;700',
  'Noto Serif': 'Noto+Serif:wght@400;500;600;700;800;900',
  'EB Garamond': 'EB+Garamond:wght@400;500;600;700;800',
  'Libre Baskerville': 'Libre+Baskerville:wght@400;700',
  'Source Serif 4': 'Source+Serif+4:wght@400;500;600;700;800;900',
  'Crimson Text': 'Crimson+Text:wght@400;600;700',
  'Cormorant Garamond': 'Cormorant+Garamond:wght@400;500;600;700',
  'Bitter': 'Bitter:wght@400;500;600;700;800;900',
  'DM Serif Display': 'DM+Serif+Display',
  'Abril Fatface': 'Abril+Fatface',
  'Vidaloka': 'Vidaloka',
  'STIX Two Text': 'STIX+Two+Text:wght@400;500;600;700',
  'Gravitas One': 'Gravitas+One',
  'Rakkas': 'Rakkas',
  // Display
  'Anton': 'Anton',
  'Bebas Neue': 'Bebas+Neue',
  'Lobster': 'Lobster',
  'Pacifico': 'Pacifico',
  'Permanent Marker': 'Permanent+Marker',
  'Righteous': 'Righteous',
  'Fredoka': 'Fredoka:wght@400;500;600;700',
  'Lilita One': 'Lilita+One',
  'Bangers': 'Bangers',
  'Bungee': 'Bungee',
  'Black Ops One': 'Black+Ops+One',
  'Audiowide': 'Audiowide',
  'Creepster': 'Creepster',
  'Boogaloo': 'Boogaloo',
  'Honk': 'Honk',
  'Pixelify Sans': 'Pixelify+Sans:wght@400;500;600;700',
  'Rye': 'Rye',
  'New Rocker': 'New+Rocker',
  'Vast Shadow': 'Vast+Shadow',
  'Sancreek': 'Sancreek',
  'Amarante': 'Amarante',
  'Metamorphous': 'Metamorphous',
  'Ribeye': 'Ribeye',
  'Chicle': 'Chicle',
  'Press Start 2P': 'Press+Start+2P',
  'Agbalumo': 'Agbalumo',
  // Handwriting
  'Dancing Script': 'Dancing+Script:wght@400;500;600;700',
  'Caveat': 'Caveat:wght@400;500;600;700',
  'Satisfy': 'Satisfy',
  'Great Vibes': 'Great+Vibes',
  'Sacramento': 'Sacramento',
  'Shadows Into Light': 'Shadows+Into+Light',
  'Indie Flower': 'Indie+Flower',
  'Kalam': 'Kalam:wght@400;700',
  'Courgette': 'Courgette',
  'Pangolin': 'Pangolin',
  'Mansalva': 'Mansalva',
  'Berkshire Swash': 'Berkshire+Swash',
  'Eagle Lake': 'Eagle+Lake',
  // Monospace
  'Roboto Mono': 'Roboto+Mono:wght@400;500;600;700',
  'JetBrains Mono': 'JetBrains+Mono:wght@400;500;600;700;800',
  'Fira Code': 'Fira+Code:wght@400;500;600;700',
  'Source Code Pro': 'Source+Code+Pro:wght@400;500;600;700;800;900',
  'IBM Plex Mono': 'IBM+Plex+Mono:wght@400;500;600;700',
  'Space Mono': 'Space+Mono:wght@400;700',
  'Inconsolata': 'Inconsolata:wght@400;500;600;700;800;900',
};

// Fallback font mapping for fonts not available in Google Fonts.
// Maps unavailable font → closest available alternative.
const FONT_FALLBACKS: Record<string, string> = {
  'Komika Axis': 'Anton',           // MrBeast preset — bold, condensed
  'TT Fors': 'Inter',               // Ali Abdaal preset — clean sans-serif
  'Helvetica Neue': 'Inter',        // Netflix preset — clean sans-serif
  'Helvetica': 'Inter',
  'Arial': 'Inter',
  'SF Pro Display': 'Inter',        // Apple preset — clean sans-serif
  'Google Sans': 'Roboto',          // Google Material preset
  'Georgia': 'EB Garamond',         // Serif fallback (similar look)
  'Times New Roman': 'Merriweather', // Serif fallback
  'Impact': 'Anton',                // Bold condensed fallback
  'Consolas': 'JetBrains Mono',     // Monospace fallback
  'system-ui': 'Inter',
  'sans-serif': 'Inter',
  'serif': 'Merriweather',
  'monospace': 'JetBrains Mono',
  'cursive': 'Dancing Script',
};

// Track which fonts have been downloaded in this process
const downloadedFonts = new Set<string>();

/**
 * Resolve a font family name to one that's actually available for FFmpeg.
 * Walks the comma-separated list and returns the first available font,
 * checking Google Fonts registry and fallback map.
 */
function resolveAvailableFontFamily(fontFamilyCSS: string): string {
  const families = fontFamilyCSS.split(',').map(f => f.trim());

  for (const family of families) {
    // Available in Google Fonts → use it directly
    if (GOOGLE_FONT_URLS[family]) return family;
    // Has a fallback mapping → use the fallback
    if (FONT_FALLBACKS[family]) return FONT_FALLBACKS[family];
  }

  // Default fallback
  return 'Inter';
}

/**
 * Download a font from Google Fonts to the local cache directory.
 * Uses the Google Fonts CSS API to get direct TTF URLs from fonts.gstatic.com.
 * The old fonts.google.com/download?family=X URLs no longer return ZIP files.
 */
async function downloadFont(fontFamily: string): Promise<boolean> {
  if (downloadedFonts.has(fontFamily)) return true;

  const cssQuery = GOOGLE_FONT_URLS[fontFamily];
  if (!cssQuery) {
    logger.warn({ fontFamily }, 'No Google Fonts CSS query for font');
    return false;
  }

  // Check if already cached (marker file)
  const markerFile = join(LOCAL_FONTS_CACHE, `.downloaded-${fontFamily.replace(/\s+/g, '-').toLowerCase()}`);
  try {
    await access(markerFile, constants.R_OK);
    downloadedFonts.add(fontFamily);
    return true;
  } catch {
    // Not cached yet
  }

  logger.info({ fontFamily, cssQuery }, 'Downloading font for export via CSS API');

  try {
    const { execSync } = await import('child_process');

    // Step 1: Fetch CSS from Google Fonts API — use non-browser User-Agent to get TTF URLs
    const cssUrl = `https://fonts.googleapis.com/css2?family=${cssQuery}&display=swap`;
    const css = execSync(
      `curl -sL "${cssUrl}" -H "User-Agent: wget/1.0"`,
      { timeout: 15000, encoding: 'utf-8' }
    );

    // Step 2: Extract all TTF URLs from the CSS
    const ttfUrls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/g)]
      .map(m => m[1]);

    if (ttfUrls.length === 0) {
      logger.warn({ fontFamily, css: css.slice(0, 200) }, 'No TTF URLs found in Google Fonts CSS');
      return false;
    }

    // Step 3: Download each TTF file
    let downloadedCount = 0;
    for (const ttfUrl of ttfUrls) {
      const filename = `${fontFamily.replace(/\s+/g, '-')}-${downloadedCount}.ttf`;
      const ttfPath = join(LOCAL_FONTS_CACHE, filename);
      try {
        execSync(`curl -sL "${ttfUrl}" -o "${ttfPath}"`, { timeout: 15000 });
        downloadedCount++;
      } catch (err) {
        logger.warn({ fontFamily, ttfUrl, err }, 'Failed to download individual TTF file');
      }
    }

    if (downloadedCount === 0) {
      logger.warn({ fontFamily }, 'Failed to download any TTF files');
      return false;
    }

    // Create marker file so we don't re-download
    await writeFile(markerFile, fontFamily, 'utf-8');
    downloadedFonts.add(fontFamily);

    logger.info({ fontFamily, downloadedCount, totalUrls: ttfUrls.length }, 'Font downloaded and cached');
    return true;
  } catch (err) {
    logger.warn({ fontFamily, err }, 'Failed to download font');
    return false;
  }
}

/**
 * Read font metrics from a TTF file's 'head' and 'OS/2' tables.
 * Returns unitsPerEm, usWinAscent, and usWinDescent which are needed
 * to compute the ASS↔CSS font size correction ratio.
 *
 * ASS/libass sizes the font so that usWinAscent+usWinDescent maps to the
 * FontSize value, whereas CSS maps font-size to the em-square (unitsPerEm).
 * The correction ratio = (usWinAscent + usWinDescent) / unitsPerEm.
 */
async function readTTFMetrics(ttfPath: string): Promise<{ unitsPerEm: number; usWinAscent: number; usWinDescent: number } | null> {
  try {
    const buf = await readFile(ttfPath);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

    const numTables = view.getUint16(4);
    let headOffset = -1;
    let os2Offset = -1;

    for (let i = 0; i < numTables; i++) {
      const entry = 12 + i * 16;
      const tag = String.fromCharCode(
        view.getUint8(entry),
        view.getUint8(entry + 1),
        view.getUint8(entry + 2),
        view.getUint8(entry + 3),
      );
      const tableOff = view.getUint32(entry + 8);
      if (tag === 'head') headOffset = tableOff;
      if (tag === 'OS/2') os2Offset = tableOff;
    }

    if (headOffset < 0 || os2Offset < 0) return null;

    const unitsPerEm = view.getUint16(headOffset + 18);
    // OS/2 table layout: usWinAscent is at offset 74, usWinDescent at 76.
    // (offsets 68/70 are sTypoAscender/sTypoDescender — signed, different purpose)
    const usWinAscent = view.getUint16(os2Offset + 74);
    const usWinDescent = view.getUint16(os2Offset + 76);

    return { unitsPerEm, usWinAscent, usWinDescent };
  } catch {
    return null;
  }
}

/**
 * Compute the multiplier needed to make ASS FontSize visually match CSS font-size.
 * Reads the first TTF file in the fonts directory for the given font family.
 * Falls back to a default multiplier of 1.35 if the TTF can't be read.
 */
async function getASSFontSizeMultiplier(fontFamily: string, fontsDir: string): Promise<number> {
  const DEFAULT_MULTIPLIER = 1.35; // Conservative default for common fonts

  // Helper: recursively find TTF files in a directory (max 2 levels deep)
  const findTTFs = async (dir: string, depth = 0): Promise<string[]> => {
    const results: string[] = [];
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isFile() && entry.name.endsWith('.ttf')) {
          results.push(fullPath);
        } else if (entry.isDirectory() && depth < 2) {
          results.push(...await findTTFs(fullPath, depth + 1));
        }
      }
    } catch { /* skip unreadable dirs */ }
    return results;
  };

  // Resolve the actual font cache path (fontsDir may be escaped for FFmpeg)
  const fontsDirClean = fontsDir.replace(/\\\\/g, '\\').replace(/\\'/g, "'").replace(/\\:/g, ':');

  try {
    // Try local cache first (flat directory), then system fonts (nested)
    const dirsToTry = [LOCAL_FONTS_CACHE, fontsDirClean];
    // Deduplicate
    const uniqueDirs = [...new Set(dirsToTry)];

    let matchedPath: string | null = null;
    const fontSlug = fontFamily.replace(/\s+/g, '-').toLowerCase();

    for (const dir of uniqueDirs) {
      const ttfPaths = await findTTFs(dir);
      if (ttfPaths.length === 0) continue;

      // Try to find a TTF matching the font family name
      matchedPath = ttfPaths.find(p => {
        const name = p.split('/').pop()!.toLowerCase();
        return name.startsWith(fontSlug) || name.includes(fontSlug);
      }) || ttfPaths[0]; // fallback to first TTF found
      break;
    }

    if (!matchedPath) {
      logger.warn({ fontFamily, fontsDir: fontsDirClean }, 'No TTF file found for ASS font size correction');
      return DEFAULT_MULTIPLIER;
    }

    const metrics = await readTTFMetrics(matchedPath);
    if (!metrics || metrics.unitsPerEm === 0) {
      logger.warn({ fontFamily, matchedPath }, 'Could not read TTF metrics');
      return DEFAULT_MULTIPLIER;
    }

    const ratio = (metrics.usWinAscent + metrics.usWinDescent) / metrics.unitsPerEm;
    logger.info({
      fontFamily,
      ttfFile: matchedPath,
      unitsPerEm: metrics.unitsPerEm,
      usWinAscent: metrics.usWinAscent,
      usWinDescent: metrics.usWinDescent,
      ratio,
    }, 'Computed ASS font size multiplier from TTF metrics');

    // Sanity check: ratio should be between 1.0 and 2.5
    if (ratio < 1.0 || ratio > 2.5) {
      logger.warn({ fontFamily, ratio }, 'TTF metrics ratio out of expected range, using default');
      return DEFAULT_MULTIPLIER;
    }

    return ratio;
  } catch (err) {
    logger.warn({ fontFamily, fontsDir: fontsDirClean, err }, 'Failed to read font metrics for ASS correction');
    return DEFAULT_MULTIPLIER;
  }
}

/**
 * Ensure fonts are available for FFmpeg subtitle rendering.
 * Returns the fontsdir path to use in FFmpeg's subtitles filter.
 */
async function ensureFontsDir(fontFamilyCSS: string): Promise<string> {
  // In Docker/production, fonts are pre-installed in /usr/share/fonts
  try {
    await access(SYSTEM_FONTS_DIR, constants.R_OK);
    logger.info('Using system fonts directory (Docker/production)');
    return escapePathForFilter(SYSTEM_FONTS_DIR);
  } catch {
    // Not in Docker — download fonts locally
  }

  // Create local font cache directory
  await mkdir(LOCAL_FONTS_CACHE, { recursive: true });

  // Clear stale marker files from the old broken download mechanism
  // (old code used fonts.google.com/download URLs that returned HTML, not ZIPs)
  try {
    const entries = await readdir(LOCAL_FONTS_CACHE);
    const markerFiles = entries.filter((f) => f.startsWith('.downloaded-'));

    if (markerFiles.length > 0) {
      // Check if small/empty markers (< 100 bytes) — means download was broken
      let hasStaleMarkers = false;
      for (const marker of markerFiles) {
        try {
          const s = await stat(join(LOCAL_FONTS_CACHE, marker));
          if (s.size < 100) { hasStaleMarkers = true; break; }
        } catch { /* skip */ }
      }

      if (hasStaleMarkers) {
        // Check if any actual TTF files exist — if not, the markers are stale
        const hasTtf = entries.some((f) => f.endsWith('.ttf'));
        if (!hasTtf) {
          for (const marker of markerFiles) {
            await unlink(join(LOCAL_FONTS_CACHE, marker)).catch(() => {});
          }
          downloadedFonts.clear();
          logger.info('Cleared stale font markers (no TTF files found)');
        }
      }
    }
  } catch {
    // Non-critical cleanup
  }

  // Resolve which font we actually need
  const resolvedFont = resolveAvailableFontFamily(fontFamilyCSS);
  logger.info({ requestedFont: fontFamilyCSS, resolvedFont }, 'Resolved font for export');

  // Download the resolved font
  await downloadFont(resolvedFont);

  // Also download Inter as ultimate fallback
  if (resolvedFont !== 'Inter') {
    await downloadFont('Inter');
  }

  // Update fontconfig cache so libass can find the fonts (Linux/Docker only)
  try {
    const { execFile } = await import('child_process');
    await new Promise<void>((resolve) => {
      execFile('fc-cache', ['-f', LOCAL_FONTS_CACHE], { timeout: 10000 }, () => resolve());
    });
  } catch {
    // fc-cache not available on Windows/macOS — fonts still work via fontsdir
  }

  return escapePathForFilter(LOCAL_FONTS_CACHE);
}

export interface LayoutSettings {
  mode: 'pip' | 'stacked';
  pip: {
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    offsetX: number;
    offsetY: number;
    size: 'small' | 'medium' | 'large' | 'custom';
    customSize: number;
    shape: 'square' | 'circle' | 'rounded';
    borderRadius: number;
    borderWidth: number;
    borderColor: string;
    shadowEnabled: boolean;
    shadowColor: string;
    shadowBlur: number;
    opacity: number;
  };
  split: {
    position: 'visuals-first' | 'video-first';
    ratio: number;
    gap: number;
  };
}

const PIP_SIZE_MAP: Record<string, number> = {
  small: 18,
  medium: 25,
  large: 35,
  custom: 25,
};

export interface FullscreenSegment {
  startMs: number;
  endMs: number;
}

/** Video crop/pan/scale settings from the editor's videoSettings */
interface VideoCropSettings {
  sourceWidth: number;
  sourceHeight: number;
  cropX: number;    // 0-100, 50=center
  cropY: number;    // 0-100, 50=center
  scale: number;    // 1.0=fill, >1 zoom
}

/**
 * Build FFmpeg scale+crop filter that mirrors the preview's calculateVideoTransform.
 * Scales the source video to fill the target area (with optional zoom via scale),
 * then crops at an offset determined by cropX/cropY (0=left/top, 50=center, 100=right/bottom).
 */
function buildVideoCropFilter(
  crop: VideoCropSettings,
  targetWidth: number,
  targetHeight: number,
): string {
  const { sourceWidth, sourceHeight, cropX, cropY, scale } = crop;
  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = targetWidth / targetHeight;

  let scaleW: number;
  let scaleH: number;

  if (sourceAspect > targetAspect) {
    // Source is wider: match height first, then apply user zoom
    scaleH = Math.round(targetHeight * scale);
    scaleW = Math.round(sourceWidth * (scaleH / sourceHeight));
  } else {
    // Source is taller: match width first, then apply user zoom
    scaleW = Math.round(targetWidth * scale);
    scaleH = Math.round(sourceHeight * (scaleW / sourceWidth));
  }

  // Ensure at least target dimensions (handles scale < 1 edge case)
  scaleW = Math.max(scaleW, targetWidth);
  scaleH = Math.max(scaleH, targetHeight);

  // Make even (required by many video codecs)
  scaleW = scaleW % 2 === 0 ? scaleW : scaleW + 1;
  scaleH = scaleH % 2 === 0 ? scaleH : scaleH + 1;

  // Calculate crop position from user's pan settings
  const overflowX = scaleW - targetWidth;
  const overflowY = scaleH - targetHeight;
  const cropXPos = Math.round(overflowX * (cropX / 100));
  const cropYPos = Math.round(overflowY * (cropY / 100));

  return `scale=${scaleW}:${scaleH},crop=${targetWidth}:${targetHeight}:${cropXPos}:${cropYPos},setsar=1`;
}

interface DisplayModeSegment {
  startMs: number;
  endMs: number;
  enterDurationMs?: number; // transition duration when entering (0 = cut)
  exitDurationMs?: number;  // transition duration when exiting (0 = cut)
  overlayOpacity?: number;  // per-item overlay opacity (0-1), default 0.85
}

export interface RenderJobData {
  projectId: string;
  jobId: string;
  projectType?: string;
  layoutSettings?: LayoutSettings;
  fullscreenSegments?: FullscreenSegment[];
}

export async function processRenderJob(job: Job<RenderJobData>) {
  const { projectId, jobId, layoutSettings } = job.data;
  setJobProjectId(jobId, projectId);
  const workDir = join(tmpdir(), `viona-render-${nanoid()}`);

  try {
    await mkdir(workDir, { recursive: true });

    // Update job status
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 5, 'Loading project...');

    // Load project data
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const projectTracks = await db.query.tracks.findMany({
      where: eq(tracks.projectId, projectId),
    });

    // Get all timeline items for all tracks
    const allItems = [];
    for (const track of projectTracks) {
      const items = await db.select().from(timelineItems)
        .where(eq(timelineItems.trackId, track.id));
      allItems.push(...items);
    }

    // Extract display mode segments from visual timeline items
    const visualItems = allItems
      .filter((item: any) => item.type === 'visual')
      .sort((a: any, b: any) => a.startMs - b.startMs);

    const fullscreenVisualSegments: DisplayModeSegment[] = [];
    const overlaySegments: DisplayModeSegment[] = [];
    const isSplitLayout = layoutSettings?.mode === 'stacked';

    for (let i = 0; i < visualItems.length; i++) {
      const item = visualItems[i];
      const dm = (item.data as any)?.displayMode || 'default';
      const transition = (item.data as any)?.transition;

      // Determine if layout changes at enter/exit boundaries
      // For stacked mode, 'default' is the base stacked layout — only non-default modes need overlay layers
      const prevItem = i > 0 ? visualItems[i - 1] : null;
      const nextItem = i < visualItems.length - 1 ? visualItems[i + 1] : null;
      const prevDm = prevItem ? ((prevItem.data as any)?.displayMode || 'default') : 'gap';
      const nextDm = nextItem ? ((nextItem.data as any)?.displayMode || 'default') : 'gap';

      // Check if there's a gap between prev and current (gap = different layout)
      const hasPrevGap = !prevItem || prevItem.endMs < item.startMs - 50;
      const hasNextGap = !nextItem || nextItem.startMs > item.endMs + 50;
      const effectivePrevLayout = hasPrevGap ? 'gap' : prevDm;
      const effectiveNextLayout = hasNextGap ? 'gap' : nextDm;

      const layoutChangesOnEnter = dm !== effectivePrevLayout;
      const layoutChangesOnExit = dm !== effectiveNextLayout;

      // Only include transition durations when the layout actually changes
      const enterDurationMs = (layoutChangesOnEnter && transition?.enter?.type !== 'cut')
        ? (transition?.enter?.durationMs || 0) : 0;
      const exitDurationMs = (layoutChangesOnExit && transition?.exit?.type !== 'cut')
        ? (transition?.exit?.durationMs || 0) : 0;

      if (dm === 'fullscreen') {
        fullscreenVisualSegments.push({ startMs: item.startMs, endMs: item.endMs, enterDurationMs, exitDurationMs });
      } else if (dm === 'overlay') {
        overlaySegments.push({
          startMs: item.startMs, endMs: item.endMs, enterDurationMs, exitDurationMs,
          overlayOpacity: (item.data as any)?.overlayOpacity ?? 0.85,
        });
      }
    }

    // Gap segments: time ranges where no visual is active (speaker fullscreen)
    // Computed for ALL layout modes — in pip mode, gaps need the source video
    // overlaid fullscreen so the Remotion black frames don't show through.
    const gapSegments: DisplayModeSegment[] = [];
    {
      const durationMs = project.durationMs || 0;
      let cursor = 0;
      for (let i = 0; i < visualItems.length; i++) {
        const item = visualItems[i];
        if (item.startMs > cursor) {
          // For gap enter: check transition of the preceding visual item (its exit)
          const prevItem = i > 0 ? visualItems[i - 1] : null;
          const prevTransition = prevItem ? (prevItem.data as any)?.transition : null;
          const prevDm = prevItem ? ((prevItem.data as any)?.displayMode || 'default') : 'default';
          const gapEnterDuration = (prevDm !== 'gap' && prevTransition?.exit?.type !== 'cut')
            ? (prevTransition?.exit?.durationMs || 0) : 0;

          // For gap exit: check transition of the next visual item (its enter)
          const nextTransition = (item.data as any)?.transition;
          const nextDm = (item.data as any)?.displayMode || 'default';
          const gapExitDuration = (nextDm !== 'gap' && nextTransition?.enter?.type !== 'cut')
            ? (nextTransition?.enter?.durationMs || 0) : 0;

          gapSegments.push({
            startMs: cursor, endMs: item.startMs,
            enterDurationMs: gapEnterDuration, exitDurationMs: gapExitDuration,
          });
        }
        cursor = Math.max(cursor, item.endMs);
      }
      if (cursor < durationMs) {
        const lastItem = visualItems[visualItems.length - 1];
        const lastTransition = lastItem ? (lastItem.data as any)?.transition : null;
        const lastDm = lastItem ? ((lastItem.data as any)?.displayMode || 'default') : 'default';
        const enterDuration = (lastDm !== 'gap' && lastTransition?.exit?.type !== 'cut')
          ? (lastTransition?.exit?.durationMs || 0) : 0;
        gapSegments.push({ startMs: cursor, endMs: durationMs, enterDurationMs: enterDuration, exitDurationMs: 0 });
      }
    }

    logger.info({
      fullscreenVisualCount: fullscreenVisualSegments.length,
      overlayCount: overlaySegments.length,
      gapCount: gapSegments.length,
      visualItemCount: visualItems.length,
    }, 'Extracted display mode segments from DB');

    const isAudioProject = (job.data.projectType || project.projectType || 'video') === 'audio';

    // Download source media
    let videoPath: string | null = null;
    let audioOnlyPath: string | null = null;

    if (isAudioProject) {
      // Audio project: download audio file, no video
      if (!project.audioKey) {
        throw new Error('Audio project has no audio key');
      }
      await publishJobProgress(jobId, 10, 'Downloading audio...');
      const audioExt = project.audioKey.match(/\.[^.]+$/)?.[0] || '.mp3';
      audioOnlyPath = join(workDir, `input${audioExt}`);
      await downloadFile('uploads', project.audioKey, audioOnlyPath);
    } else {
      // Video project: download video
      await publishJobProgress(jobId, 10, 'Downloading video...');
      videoPath = join(workDir, 'input.mp4');
      await downloadFile('uploads', project.videoKey!, videoPath);
    }

    await publishJobProgress(jobId, 20, 'Preparing render...');

    // Convert timeline items to subtitle format
    const subtitles = convertToSubtitles(allItems);
    const outputPath = join(workDir, 'output.mp4');

    // Find the first subtitle with a non-empty style object.
    // All captions should share the same style, but handle edge cases where
    // early subtitles might lack a style (legacy data, initial creation).
    const firstStyle = ((): any => {
      for (const sub of subtitles) {
        const s = sub.style as any;
        if (s && typeof s === 'object' && Object.keys(s).length > 0) return s;
      }
      return {};
    })();

    // Debug: Log subtitle data to verify styles are being passed
    logger.info({
      subtitleCount: subtitles.length,
      firstSubtitleStyle: firstStyle,
      styleKeys: Object.keys(firstStyle),
      fontSize: firstStyle.fontSize,
      fontWeight: firstStyle.fontWeight,
      fontFamily: firstStyle.fontFamily,
      wordsPerPhrase: firstStyle.wordsPerPhrase,
      displayMode: firstStyle.displayMode,
      firstSubtitleText: subtitles[0]?.text,
      allItemTypes: allItems.map((i: any) => i.type),
    }, 'Converted subtitles with styles');

    // Ensure fonts are available for FFmpeg subtitle rendering
    const rawFontFamily = firstStyle.fontFamily || 'Inter';
    const fontsDir = await ensureFontsDir(rawFontFamily);
    // Resolve the font to one that's actually available (with fallback for commercial fonts)
    const resolvedFontFamily = resolveAvailableFontFamily(rawFontFamily);
    logger.info({ rawFontFamily, resolvedFontFamily, fontsDir }, 'Resolved font for export');

    // Compute ASS↔CSS font size correction multiplier from TTF metrics.
    // libass sizes glyphs differently than CSS, so without this multiplier
    // exported text appears ~60% smaller than the preview.
    const fontSizeMultiplier = await getASSFontSizeMultiplier(resolvedFontFamily, fontsDir);

    // Resolve fontFamily in all subtitle styles so both Remotion (headless Chrome)
    // and FFmpeg/ASS paths use an actual available Google Font name.
    // Without this, CSS strings like "Komika Axis, Impact, system-ui, sans-serif"
    // fall through to generic system fonts in headless Chrome since neither
    // "Komika Axis" nor "Impact" are loaded via @remotion/google-fonts.
    const uniqueFontsToDownload = new Set<string>();
    uniqueFontsToDownload.add(resolvedFontFamily);
    for (const subtitle of subtitles) {
      const style = subtitle.style as any;
      if (style?.fontFamily) {
        style.fontFamily = resolveAvailableFontFamily(style.fontFamily);
        uniqueFontsToDownload.add(style.fontFamily);
      }
      // Also resolve per-word font overrides
      if (subtitle.words) {
        for (const word of subtitle.words as any[]) {
          if (word.styleOverrides?.fontFamily) {
            word.styleOverrides.fontFamily = resolveAvailableFontFamily(word.styleOverrides.fontFamily);
            uniqueFontsToDownload.add(word.styleOverrides.fontFamily);
          }
        }
      }
    }

    // Download all unique fonts (not just the first subtitle's font)
    // Skip if using system fonts dir (Docker/production — fonts are pre-installed)
    const isSystemFonts = fontsDir === escapePathForFilter(SYSTEM_FONTS_DIR);
    if (!isSystemFonts) {
      for (const font of uniqueFontsToDownload) {
        if (font !== resolvedFontFamily) { // Primary font already downloaded by ensureFontsDir
          await downloadFont(font);
        }
      }
    }
    logger.info({ resolvedFontFamily, uniqueFonts: [...uniqueFontsToDownload], firstStyleAfter: (subtitles[0]?.style as any)?.fontFamily }, 'Resolved font families in all subtitles');

    // Check for enhanced audio (or source audio for audio projects)
    const audioItems = allItems.filter((item: any) => item.type === 'audio');
    const enhancedAudioItem = audioItems.find((item: any) => {
      const data = item.data as any;
      return data.isEnhanced && data.src;
    });

    // Download enhanced audio if available
    let enhancedAudioPath: string | null = null;
    if (enhancedAudioItem) {
      const audioData = enhancedAudioItem.data as any;
      // Extract the audio key from the src URL (e.g., /api/media/outputs/xxx/enhanced.m4a -> xxx/enhanced.m4a)
      const audioSrc = audioData.src as string;
      const audioKeyMatch = audioSrc.match(/\/media\/outputs\/(.+)$/);
      if (audioKeyMatch) {
        const audioKey = audioKeyMatch[1];
        enhancedAudioPath = join(workDir, 'enhanced.m4a');
        try {
          await downloadFile('outputs', audioKey, enhancedAudioPath);
          logger.info({ audioKey, enhancedAudioPath }, 'Downloaded enhanced audio');
        } catch (err) {
          logger.warn({ err, audioKey }, 'Failed to download enhanced audio, using original');
          enhancedAudioPath = null;
        }
      }
    }

    // For audio projects, use the uploaded audio file as the audio source
    if (isAudioProject && !enhancedAudioPath && audioOnlyPath) {
      enhancedAudioPath = audioOnlyPath;
    }

    // Check for visual compositions to render with Remotion SSR
    const projectVisual = await db.query.visuals.findFirst({
      where: eq(visuals.projectId, projectId),
    });

    // Render path with Remotion visuals - export exactly what user sees in preview
    if (projectVisual) {
      await publishJobProgress(jobId, 30, 'Rendering visuals with Remotion...');

      // Get bundle path from compositionId (hyphens for directory, underscores for composition ID)
      const bundleDirName = projectVisual.compositionId.replace(/_/g, '-');
      const bundlePath = join(config.remotion.bundleOutputDir, bundleDirName);

      const visualFps = projectVisual.fps || 30;
      const totalFrames = projectVisual.durationFrames || 0;
      const sceneTimestamps = (projectVisual.timestamps as Array<{ startMs: number; endMs: number; type: string; description?: string }>) || [];

      // Use the FULL canvas dimensions for the final composite, not the visual-only
      // dimensions. In split modes, visuals are rendered at half-canvas size but the
      // final output must be the full canvas (video + visuals side by side).
      const videoSettings = (project.videoSettings || {}) as Record<string, unknown>;
      const outputWidth = (videoSettings.canvasWidth as number) || 1080;
      const outputHeight = (videoSettings.canvasHeight as number) || 1920;

      // Build video crop/pan/scale settings from project to match preview
      const videoCrop: VideoCropSettings = {
        sourceWidth: project.sourceWidth || 1920,
        sourceHeight: project.sourceHeight || 1080,
        cropX: (videoSettings.cropX as number) ?? 50,
        cropY: (videoSettings.cropY as number) ?? 50,
        scale: (videoSettings.scale as number) ?? 1.0,
      };

      logger.info({
        projectId,
        compositionId: projectVisual.compositionId,
        bundlePath,
        hasEnhancedAudio: !!enhancedAudioPath,
        subtitleCount: subtitles.length,
        outputWidth,
        outputHeight,
        videoCrop,
        sceneCount: sceneTimestamps.length,
      }, 'Starting Remotion SSR render');

      // Step 1: Render Remotion composition exactly as shown in preview
      // Note: compositionId uses underscores (as registered in bundle), bundlePath uses hyphens
      const remotionTempPath = join(workDir, 'remotion_visuals.mp4');

      // Track last reported scene to avoid duplicate messages
      let lastReportedScene = -1;

      await renderWithRemotion({
        bundlePath,
        compositionId: projectVisual.compositionId,
        outputPath: remotionTempPath,
        onProgress: (progress) => {
          const jobProgress = 30 + Math.round(progress * 40);

          // Calculate current time in ms based on progress
          if (sceneTimestamps.length > 0 && totalFrames > 0) {
            const currentFrame = Math.floor(progress * totalFrames);
            const currentMs = (currentFrame / visualFps) * 1000;

            // Find the current scene
            let currentSceneIndex = 0;
            for (let i = 0; i < sceneTimestamps.length; i++) {
              if (currentMs >= sceneTimestamps[i].startMs && currentMs < sceneTimestamps[i].endMs) {
                currentSceneIndex = i;
                break;
              } else if (currentMs >= sceneTimestamps[i].endMs) {
                currentSceneIndex = i + 1;
              }
            }

            // Clamp to valid range
            currentSceneIndex = Math.min(currentSceneIndex, sceneTimestamps.length - 1);

            // Only report if scene changed or every 5% within same scene
            if (currentSceneIndex !== lastReportedScene) {
              lastReportedScene = currentSceneIndex;
              const scene = sceneTimestamps[currentSceneIndex];
              const sceneDesc = scene.description || scene.type || `Scene ${currentSceneIndex + 1}`;
              publishJobProgress(
                jobId,
                jobProgress,
                `Rendering scene ${currentSceneIndex + 1}/${sceneTimestamps.length}: ${sceneDesc}`
              );
            } else {
              publishJobProgress(jobId, jobProgress, `Rendering scene ${currentSceneIndex + 1}/${sceneTimestamps.length}...`);
            }
          } else {
            publishJobProgress(jobId, jobProgress, `Rendering: ${Math.round(progress * 100)}%`);
          }
        },
      });

      logger.info({ projectId, remotionTempPath }, 'Remotion render complete');

      await publishJobProgress(jobId, 75, 'Compositing video with audio and subtitles...');

      if (isAudioProject) {
        // Audio project with visuals: two-pass approach for exact caption matching
        // Pass 1: Composite Remotion visuals + audio WITHOUT subtitles
        const hasSubtitles = subtitles.length > 0;
        const compositedAudioPath = hasSubtitles ? join(workDir, 'composited_audio.mp4') : outputPath;

        await finalizeRemotionVideo({
          remotionVideoPath: remotionTempPath,
          audioPath: enhancedAudioPath,
          subtitles: [],  // No ASS subtitles — Remotion handles them in pass 2
          outputPath: compositedAudioPath,
          workDir,
          width: outputWidth,
          height: outputHeight,
          fontsDir,
          resolvedFontFamily,
          fontSizeMultiplier,
        });

        // Pass 2: Overlay subtitles with Remotion (same React engine as preview)
        if (hasSubtitles) {
          await publishJobProgress(jobId, 80, 'Rendering captions...');

          const firstSubStyle = firstStyle;
          const captionDurationMs = project.durationMs || Math.max(...subtitles.map(s => s.endMs)) + 1000;

          await renderVideo({
            videoUrl: compositedAudioPath,
            subtitles,
            outputPath,
            width: outputWidth,
            height: outputHeight,
            fps: 30,
            durationMs: captionDurationMs,
            defaultSubtitleStyle: {
              fontFamily: firstSubStyle.fontFamily || resolvedFontFamily || 'Inter',
              fontSize: firstSubStyle.fontSize || 56,
              fontWeight: firstSubStyle.fontWeight || 800,
              color: firstSubStyle.color || '#ffffff',
              activeColor: firstSubStyle.activeColor || '#ffff00',
              backgroundColor: firstSubStyle.backgroundColor || 'transparent',
              activeBackgroundColor: firstSubStyle.activeBackgroundColor || 'transparent',
              opacity: firstSubStyle.opacity ?? 1,
              lineHeight: firstSubStyle.lineHeight ?? 1.4,
              letterSpacing: firstSubStyle.letterSpacing ?? 0,
              textTransform: (firstSubStyle.textTransform || 'none') as 'none' | 'uppercase' | 'lowercase',
              stroke: firstSubStyle.stroke ?? null,
              displayMode: firstSubStyle.displayMode || 'phrase',
              wordsPerPhrase: firstSubStyle.wordsPerPhrase || 5,
              presetId: firstSubStyle.presetId,
              position: firstSubStyle.position || 'bottom',
              effects: firstSubStyle.effects,
              animation: firstSubStyle.animation,
              backgroundPadding: firstSubStyle.backgroundPadding,
              backgroundRadius: firstSubStyle.backgroundRadius,
            },
            onProgress: (progress) => {
              const jobProgress = 80 + Math.round((progress / 100) * 15);
              publishJobProgress(jobId, jobProgress, `Rendering captions: ${progress}%`);
            },
          });
        }
      } else {
        // Video project with visuals: two-pass approach for exact caption matching
        // Pass 1: Composite source video + Remotion visuals + audio WITHOUT subtitles
        const hasSubtitles = subtitles.length > 0;
        const compositedPath = hasSubtitles ? join(workDir, 'composited.mp4') : outputPath;

        await renderWithPiPLayout({
          sourceVideoPath: videoPath!,
          remotionVideoPath: remotionTempPath,
          audioPath: enhancedAudioPath,
          subtitles: [],  // No ASS subtitles — Remotion handles them in pass 2
          outputPath: compositedPath,
          workDir,
          width: outputWidth,
          height: outputHeight,
          layoutSettings,
          videoCrop,
          fullscreenVisualSegments,
          overlaySegments,
          gapSegments,
          fontsDir,
          resolvedFontFamily,
          fontSizeMultiplier,
          onProgress: (progress) => {
            // Map compositing progress from 75% to 82%
            const jobProgress = 75 + Math.round(progress * 7);
            publishJobProgress(jobId, jobProgress, `Compositing: ${Math.round(progress * 100)}%`);
          },
        });

        // Pass 2: Overlay subtitles with Remotion (same React engine as preview)
        if (hasSubtitles) {
          await publishJobProgress(jobId, 83, 'Rendering captions...');

          const firstSubStyle = firstStyle;
          let captionDurationMs = project.durationMs || 0;
          if (!captionDurationMs) {
            captionDurationMs = Math.max(...subtitles.map(s => s.endMs)) + 1000;
          }

          await renderVideo({
            videoUrl: compositedPath,
            subtitles,
            outputPath,
            width: outputWidth,
            height: outputHeight,
            fps: 30,
            durationMs: captionDurationMs,
            defaultSubtitleStyle: {
              fontFamily: firstSubStyle.fontFamily || resolvedFontFamily || 'Inter',
              fontSize: firstSubStyle.fontSize || 56,
              fontWeight: firstSubStyle.fontWeight || 800,
              color: firstSubStyle.color || '#ffffff',
              activeColor: firstSubStyle.activeColor || '#ffff00',
              backgroundColor: firstSubStyle.backgroundColor || 'transparent',
              activeBackgroundColor: firstSubStyle.activeBackgroundColor || 'transparent',
              opacity: firstSubStyle.opacity ?? 1,
              lineHeight: firstSubStyle.lineHeight ?? 1.4,
              letterSpacing: firstSubStyle.letterSpacing ?? 0,
              textTransform: (firstSubStyle.textTransform || 'none') as 'none' | 'uppercase' | 'lowercase',
              stroke: firstSubStyle.stroke ?? null,
              displayMode: firstSubStyle.displayMode || 'phrase',
              wordsPerPhrase: firstSubStyle.wordsPerPhrase || 5,
              presetId: firstSubStyle.presetId,
              position: firstSubStyle.position || 'bottom',
              effects: firstSubStyle.effects,
              animation: firstSubStyle.animation,
              backgroundPadding: firstSubStyle.backgroundPadding,
              backgroundRadius: firstSubStyle.backgroundRadius,
            },
            onProgress: (progress) => {
              const jobProgress = 83 + Math.round((progress / 100) * 12);
              publishJobProgress(jobId, jobProgress, `Rendering captions: ${progress}%`);
            },
          });
        }
      }

      logger.info({ projectId, outputPath }, 'Export complete with full composite');
    } else if (isAudioProject) {
      // Audio project without visuals: black canvas + subtitles + audio
      // Use Remotion for subtitles to match preview exactly
      await publishJobProgress(jobId, 30, 'Rendering audio project...');

      const videoSettings = (project.videoSettings as any) || {};
      const canvasWidth = videoSettings.canvasWidth || 1080;
      const canvasHeight = videoSettings.canvasHeight || 1920;
      const durationMs = project.durationMs || (subtitles.length > 0 ? Math.max(...subtitles.map(s => s.endMs)) + 1000 : 10000);

      if (subtitles.length > 0) {
        // Step 1: Create black canvas video (no subtitles yet)
        const { spawn: spawnProcess } = await import('child_process');

        const durationSec = (durationMs / 1000).toFixed(3);
        const blackCanvasPath = enhancedAudioPath ? join(workDir, 'black_canvas.mp4') : join(workDir, 'black_canvas_temp.mp4');

        // Generate black canvas with optional audio
        const canvasArgs = [
          '-f', 'lavfi',
          '-i', `color=c=black:s=${canvasWidth}x${canvasHeight}:d=${durationSec}:r=30`,
        ];

        if (enhancedAudioPath) {
          const { basename: baseFn } = await import('path');
          const audioFilename = baseFn(enhancedAudioPath);
          canvasArgs.push('-i', audioFilename);
        }

        canvasArgs.push('-y');
        canvasArgs.push('-c:v', 'libx264', '-preset', 'faster', '-crf', '18', '-threads', '4');

        if (enhancedAudioPath) {
          canvasArgs.push('-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-shortest');
        }

        canvasArgs.push(blackCanvasPath);

        await new Promise<void>((resolve, reject) => {
          const proc = spawnProcess('ffmpeg', canvasArgs, { cwd: workDir, stdio: ['ignore', 'pipe', 'pipe'] });
          let stderr = '';
          proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
          proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`FFmpeg (black canvas) exited with code ${code}: ${stderr.slice(-500)}`));
          });
          proc.on('error', (err) => reject(new Error(`Failed to spawn ffmpeg: ${err.message}`)));
        });

        // Step 2: Overlay subtitles with Remotion (same React engine as preview)
        await publishJobProgress(jobId, 50, 'Rendering captions...');

        const firstSubStyle = firstStyle;
        await renderVideo({
          videoUrl: blackCanvasPath,
          subtitles,
          outputPath,
          width: canvasWidth,
          height: canvasHeight,
          fps: 30,
          durationMs,
          defaultSubtitleStyle: {
            fontFamily: firstSubStyle.fontFamily || resolvedFontFamily || 'Inter',
            fontSize: firstSubStyle.fontSize || 56,
            fontWeight: firstSubStyle.fontWeight || 800,
            color: firstSubStyle.color || '#ffffff',
            activeColor: firstSubStyle.activeColor || '#ffff00',
            backgroundColor: firstSubStyle.backgroundColor || 'transparent',
            activeBackgroundColor: firstSubStyle.activeBackgroundColor || 'transparent',
            opacity: firstSubStyle.opacity ?? 1,
            lineHeight: firstSubStyle.lineHeight ?? 1.4,
            letterSpacing: firstSubStyle.letterSpacing ?? 0,
            textTransform: (firstSubStyle.textTransform || 'none') as 'none' | 'uppercase' | 'lowercase',
            stroke: firstSubStyle.stroke ?? null,
            displayMode: firstSubStyle.displayMode || 'phrase',
            wordsPerPhrase: firstSubStyle.wordsPerPhrase || 5,
            presetId: firstSubStyle.presetId,
            position: firstSubStyle.position || 'bottom',
            effects: firstSubStyle.effects,
            animation: firstSubStyle.animation,
            backgroundPadding: firstSubStyle.backgroundPadding,
            backgroundRadius: firstSubStyle.backgroundRadius,
          },
          onProgress: (progress) => {
            const jobProgress = 50 + Math.round((progress / 100) * 40);
            publishJobProgress(jobId, jobProgress, `Rendering captions: ${progress}%`);
          },
        });
      } else if (enhancedAudioPath) {
        // No subtitles, just audio: create black canvas + audio
        const { spawn: spawnProcess } = await import('child_process');
        const { basename: baseFn } = await import('path');

        const durationSec = (durationMs / 1000).toFixed(3);
        const audioFilename = baseFn(enhancedAudioPath);
        const args = [
          '-f', 'lavfi',
          '-i', `color=c=black:s=${canvasWidth}x${canvasHeight}:d=${durationSec}:r=30`,
          '-i', audioFilename,
          '-y',
          '-c:v', 'libx264', '-preset', 'faster', '-crf', '18',
          '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-shortest',
          outputPath,
        ];

        await new Promise<void>((resolve, reject) => {
          const proc = spawnProcess('ffmpeg', args, { cwd: workDir, stdio: ['ignore', 'pipe', 'pipe'] });
          let stderr = '';
          proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
          proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`FFmpeg (audio render) exited with code ${code}: ${stderr.slice(-500)}`));
          });
          proc.on('error', (err) => reject(new Error(`Failed to spawn ffmpeg: ${err.message}`)));
        });
      }
    } else {
      // No visuals - render subtitles with Remotion (browser-based for proper Google Fonts)
      await publishJobProgress(jobId, 30, 'Rendering video...');

      logger.info({
        hasEnhancedAudio: !!enhancedAudioPath,
        subtitleCount: subtitles.length,
      }, 'No visuals found, rendering with Remotion for proper font support');

      if (subtitles.length > 0) {
        const videoSettings = (project.videoSettings as any) || {};
        const canvasWidth = videoSettings.canvasWidth || 1080;
        const canvasHeight = videoSettings.canvasHeight || 1920;

        // Build video crop/pan/scale settings to match preview
        const noVisCrop: VideoCropSettings = {
          sourceWidth: project.sourceWidth || 1920,
          sourceHeight: project.sourceHeight || 1080,
          cropX: videoSettings.cropX ?? 50,
          cropY: videoSettings.cropY ?? 50,
          scale: videoSettings.scale ?? 1.0,
        };

        // Get video duration for Remotion rendering
        let durationMs = 0;
        try {
          const { execSync } = await import('child_process');
          const ffprobeOutput = execSync(
            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
            { encoding: 'utf-8' }
          );
          durationMs = Math.round(parseFloat(ffprobeOutput.trim()) * 1000);
        } catch (err) {
          logger.warn({ err }, 'Could not get video duration, estimating from subtitles');
          durationMs = Math.max(...subtitles.map(s => s.endMs)) + 1000;
        }

        // Use Remotion browser-based rendering for subtitles
        // This renders subtitles as React components in headless Chrome
        // with Google Fonts loaded via @remotion/google-fonts (same as preview)
        const remotionOutputPath = enhancedAudioPath ? join(workDir, 'subtitled.mp4') : outputPath;

        logger.info({
          canvasWidth,
          canvasHeight,
          durationMs,
          subtitleCount: subtitles.length,
          presetId: firstStyle.presetId,
          displayMode: firstStyle.displayMode,
          renderPath: 'no-visuals-remotion-v2',
        }, 'Rendering subtitles with Remotion (browser-based fonts, emotional line-breaking)');

        // Build default style from the first subtitle's actual style (user's chosen font/colors)
        // so that even subtitles without explicit style get the user's settings.
        // Use the robust firstStyle from earlier (finds first subtitle WITH a style).
        const firstSubStyle = firstStyle;
        await renderVideo({
          videoUrl: videoPath!,
          subtitles,
          outputPath: remotionOutputPath,
          width: canvasWidth,
          height: canvasHeight,
          fps: 30,
          durationMs,
          videoCrop: noVisCrop,
          // Use the user's actual style as default, falling back to safe defaults.
          // This ensures even subtitles without an explicit style get the user's
          // chosen font, colors, display mode, and position.
          defaultSubtitleStyle: {
            fontFamily: firstSubStyle.fontFamily || resolvedFontFamily || 'Inter',
            fontSize: firstSubStyle.fontSize || 56,
            fontWeight: firstSubStyle.fontWeight || 800,
            color: firstSubStyle.color || '#ffffff',
            activeColor: firstSubStyle.activeColor || '#ffff00',
            backgroundColor: firstSubStyle.backgroundColor || 'transparent',
            activeBackgroundColor: firstSubStyle.activeBackgroundColor || 'transparent',
            opacity: firstSubStyle.opacity ?? 1,
            lineHeight: firstSubStyle.lineHeight ?? 1.4,
            letterSpacing: firstSubStyle.letterSpacing ?? 0,
            textTransform: (firstSubStyle.textTransform || 'none') as 'none' | 'uppercase' | 'lowercase',
            stroke: firstSubStyle.stroke ?? null,
            displayMode: firstSubStyle.displayMode || 'phrase',
            wordsPerPhrase: firstSubStyle.wordsPerPhrase || 5,
            presetId: firstSubStyle.presetId,
            position: firstSubStyle.position || 'bottom',
            effects: firstSubStyle.effects,
            animation: firstSubStyle.animation,
            backgroundPadding: firstSubStyle.backgroundPadding,
            backgroundRadius: firstSubStyle.backgroundRadius,
          },
          onProgress: (progress) => {
            const jobProgress = 30 + Math.round((progress / 100) * 55);
            publishJobProgress(jobId, jobProgress, `Rendering subtitles: ${progress}%`);
          },
        });

        // If enhanced audio, mux it with the rendered video
        if (enhancedAudioPath) {
          await encodeVideoWithAudio(remotionOutputPath, enhancedAudioPath, outputPath);
        }
      } else {
        // No subtitles — check if crop/pan/scale needs to be applied
        const videoSettings = (project.videoSettings as any) || {};
        const needsCrop = (videoSettings.cropX != null && videoSettings.cropX !== 50) ||
                          (videoSettings.cropY != null && videoSettings.cropY !== 50) ||
                          (videoSettings.scale != null && videoSettings.scale !== 1.0);

        if (needsCrop) {
          // Re-encode with crop/pan/scale to match preview
          const cw = videoSettings.canvasWidth || 1080;
          const ch = videoSettings.canvasHeight || 1920;
          const cropFilter = buildVideoCropFilter({
            sourceWidth: project.sourceWidth || 1920,
            sourceHeight: project.sourceHeight || 1080,
            cropX: videoSettings.cropX ?? 50,
            cropY: videoSettings.cropY ?? 50,
            scale: videoSettings.scale ?? 1.0,
          }, cw, ch);

          const { spawn: sp } = await import('child_process');
          const { basename: bn, dirname: dn } = await import('path');
          const { copyFile: cpf } = await import('fs/promises');

          const cropWorkDir = join(workDir, 'crop');
          await mkdir(cropWorkDir, { recursive: true });
          const localInput = join(cropWorkDir, bn(videoPath!));
          await cpf(videoPath!, localInput);
          const localOutput = bn(outputPath);

          const cropArgs = [
            '-i', bn(localInput),
            ...(enhancedAudioPath ? ['-i', bn(enhancedAudioPath)] : []),
            '-y',
            '-vf', cropFilter,
            '-c:v', 'libx264', '-preset', 'faster', '-crf', '18', '-threads', '4',
            ...(enhancedAudioPath
              ? ['-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-shortest']
              : ['-map', '0:v', '-map', '0:a?', '-c:a', 'aac']),
            localOutput,
          ];

          await new Promise<void>((resolve, reject) => {
            const proc = sp('ffmpeg', cropArgs, { cwd: cropWorkDir, stdio: ['ignore', 'pipe', 'pipe'] });
            let stderr = '';
            proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
            proc.on('close', (code) => {
              if (code === 0) resolve();
              else reject(new Error(`FFmpeg (crop) exited with code ${code}: ${stderr.slice(-500)}`));
            });
            proc.on('error', (err) => reject(new Error(`Failed to spawn ffmpeg: ${err.message}`)));
          });

          // Move output to final path
          await cpf(join(cropWorkDir, localOutput), outputPath);
        } else {
          await encodeVideoWithAudio(videoPath!, enhancedAudioPath, outputPath);
        }
      }
    }

    await publishJobProgress(jobId, 85, 'Uploading result...');

    // Upload output
    const outputKey = `${nanoid()}/output.mp4`;
    await uploadFile('outputs', outputKey, outputPath);

    // Update project
    await db.update(projects)
      .set({
        status: 'complete',
        outputKey,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    await db.update(jobs)
      .set({ status: 'complete', progress: 100, completedAt: new Date() })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 100, 'Complete');
    await publishJobComplete(jobId, projectId);

    logger.info({ projectId }, 'Render complete');

  } catch (error) {
    logger.error({ projectId, err: error }, 'Render failed');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await db.update(jobs)
      .set({ status: 'failed', error: errorMessage })
      .where(eq(jobs.id, jobId));

    await db.update(projects)
      .set({ status: 'failed' })
      .where(eq(projects.id, projectId));

    await publishJobError(jobId, errorMessage);

    throw error;
  } finally {
    try {
      await rm(workDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

function convertToSubtitles(items: any[]): SubtitleItem[] {
  // Frontend uses 'caption' type, not 'subtitle'
  return items
    .filter(item => item.type === 'caption' || item.type === 'subtitle')
    .map(item => {
      const data = item.data as any;
      return {
        id: item.id,
        startMs: item.startMs,
        endMs: item.endMs,
        text: data.text || '',
        words: data.words || [{ text: data.text || '', startMs: item.startMs, endMs: item.endMs }],
        style: data.style,
      };
    });
}

async function copyVideo(inputPath: string, outputPath: string): Promise<void> {
  const { spawn } = await import('child_process');
  const { dirname, basename } = await import('path');

  // Use spawn with cwd and relative filenames to avoid Windows path issues
  // (FFmpeg interprets colons in paths like C:/... as stream specifiers)
  const workDir = dirname(inputPath);
  const inputFilename = basename(inputPath);
  const outputFilename = basename(outputPath);

  logger.info({ inputPath, outputPath, workDir }, 'Copying video with FFmpeg');

  const args = [
    '-i', inputFilename,
    '-y',
    '-c', 'copy',
    outputFilename
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
    });
  });
}

async function encodeVideoWithAudio(
  videoPath: string,
  audioPath: string | null,
  outputPath: string
): Promise<void> {
  const { spawn } = await import('child_process');
  const { basename, dirname } = await import('path');
  const { copyFile } = await import('fs/promises');

  const workingDir = dirname(videoPath);
  const videoFilename = basename(videoPath);
  const outputFilename = basename(outputPath);

  if (audioPath) {
    // Copy audio to working directory
    const audioFilename = basename(audioPath);
    const localAudioPath = join(workingDir, audioFilename);
    if (audioPath !== localAudioPath) {
      await copyFile(audioPath, localAudioPath);
    }

    logger.info({ videoFilename, audioFilename, outputFilename, workingDir }, 'Encoding video with enhanced audio');

    // Replace audio track with enhanced audio
    const args = [
      '-i', videoFilename,
      '-i', audioFilename,
      '-y',
      '-map', '0:v',      // Take video from first input
      '-map', '1:a',      // Take audio from second input
      '-c:v', 'copy',     // Copy video codec (no re-encode)
      '-c:a', 'aac',      // Encode audio to AAC
      '-shortest',        // End when shortest stream ends
      outputFilename
    ];

    return new Promise((resolve, reject) => {
      logger.info({ cmd: `ffmpeg ${args.join(' ')}` }, 'FFmpeg encode started');

      const proc = spawn('ffmpeg', args, {
        cwd: workingDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderr = '';
      proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

      proc.on('close', (code) => {
        if (code === 0) {
          logger.info({ outputPath }, 'FFmpeg encode completed');
          resolve();
        } else {
          logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg encode failed');
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        logger.error({ err }, 'FFmpeg spawn error');
        reject(err);
      });
    });
  } else {
    // No enhanced audio, just copy video
    logger.info({ videoPath, outputPath }, 'No enhanced audio, copying video directly');
    await copyVideo(videoPath, outputPath);
  }
}

// Fallback: FFmpeg subtitle burning for when Remotion fails
async function renderSubtitlesWithFFmpeg(
  inputPath: string,
  outputPath: string,
  items: any[],
  project: any,
  fontsDir: string = escapePathForFilter(SYSTEM_FONTS_DIR)
): Promise<void> {
  const { access, constants } = await import('fs/promises');

  // Filter subtitle items
  const subtitles = items.filter(item => item.type === 'subtitle');

  logger.info({ inputPath, outputPath, subtitleCount: subtitles.length }, 'Rendering with FFmpeg fallback');

  // Verify input file exists
  try {
    await access(inputPath, constants.R_OK);
    logger.info({ inputPath }, 'Input file verified');
  } catch (err) {
    logger.error({ inputPath, err }, 'Input file not accessible');
    throw new Error(`Input file not accessible: ${inputPath}`);
  }

  if (subtitles.length === 0) {
    // No subtitles, just copy the video using spawn with cwd
    return copyVideo(inputPath, outputPath);
  }

  // Create ASS subtitle file for FFmpeg
  const assPath = inputPath.replace('.mp4', '.ass');
  const assContent = generateASSSubtitles(subtitles, project);

  const { writeFile } = await import('fs/promises');
  await writeFile(assPath, assContent, 'utf-8');
  logger.info({ assPath }, 'ASS subtitle file created');

  // Burn subtitles into video using subtitles filter
  // Use relative path by extracting just the filename - FFmpeg will find it in cwd
  const { basename, dirname } = await import('path');
  const { spawn } = await import('child_process');
  const assFilename = basename(assPath);  // Just "input.ass"
  const workingDir = dirname(assPath);    // The temp directory

  logger.info({ assPath, assFilename, workingDir }, 'Using subtitles filter with relative path');

  // Use spawn directly with cwd to avoid path escaping issues
  return new Promise((resolve, reject) => {
    const args = [
      '-i', 'input.mp4',
      '-y',
      '-vf', `subtitles=${assFilename}:fontsdir=${fontsDir}`,
      '-c:a', 'copy',
      'output.mp4'
    ];

    logger.info({ cmd: `ffmpeg ${args.join(' ')}`, cwd: workingDir }, 'FFmpeg subtitle burn started');

    const proc = spawn('ffmpeg', args, {
      cwd: workingDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg subtitle burn completed');
        resolve();
      } else {
        logger.error({ code, stderr }, 'FFmpeg subtitle burn failed');
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

function generateASSSubtitles(subtitles: any[], project: any): string {
  const width = project.sourceWidth || 1920;
  const height = project.sourceHeight || 1080;

  // ASS header
  let ass = `[Script Info]
Title: Viona Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Inter,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,2,10,10,50,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Add dialogue entries
  for (const subtitle of subtitles) {
    const data = subtitle.data as any;
    const startTime = formatASSTime(subtitle.startMs);
    const endTime = formatASSTime(subtitle.endMs);
    const text = (data.text || '').replace(/\n/g, '\\N');

    ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${text}\n`;
  }

  return ass;
}

function formatASSTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

// =============================================================================
// Remotion Server-Side Rendering
// =============================================================================

interface RenderRemotionOptions {
  bundlePath: string;
  compositionId: string;
  outputPath: string;
  onProgress?: (progress: number) => void;
}

/**
 * Download a Remotion bundle from S3 storage if it doesn't exist locally.
 * Bundles are uploaded during visual generation and need to be restored after container restarts.
 */
async function ensureBundleExists(bundlePath: string, compositionId: string): Promise<void> {
  const bundleIndexPath = join(bundlePath, 'index.html');

  // Check if bundle already exists locally
  try {
    await access(bundleIndexPath, constants.R_OK);
    logger.info({ bundlePath }, 'Bundle exists locally');
    return;
  } catch {
    // Bundle doesn't exist locally, try to download from S3
    logger.info({ bundlePath, compositionId }, 'Bundle not found locally, downloading from S3...');
  }

  // List all files in the bundle from S3
  const s3Prefix = `bundles/${compositionId}/`;
  const files = await listObjects('outputs', s3Prefix);

  if (files.length === 0) {
    throw new Error(`Bundle not found in S3 storage: ${s3Prefix}`);
  }

  logger.info({ compositionId, fileCount: files.length }, 'Found bundle files in S3');

  // Create bundle directory
  await mkdir(bundlePath, { recursive: true });

  // Download all files
  for (const file of files) {
    // file is like "bundles/proj-xxx/index.html" or "bundles/proj-xxx/assets/file.js"
    // We need to extract the relative path within the bundle
    const relativePath = file.replace(s3Prefix, '');
    const localPath = join(bundlePath, relativePath);

    // Create subdirectories if needed
    const dir = join(bundlePath, relativePath.split('/').slice(0, -1).join('/'));
    if (dir !== bundlePath) {
      await mkdir(dir, { recursive: true });
    }

    await downloadFile('outputs', file, localPath);
  }

  logger.info({ bundlePath, compositionId, fileCount: files.length }, 'Bundle downloaded from S3');
}

/**
 * Rebuild the Remotion bundle from TypeScript source files.
 * Downloads sources from S3 and creates a proper bundle with correct composition IDs.
 */
async function rebuildBundleFromCJS(bundlePath: string, compositionId: string): Promise<string> {
  logger.info({ bundlePath, compositionId }, 'Rebuilding bundle from TypeScript sources');

  // Download source files from S3
  const sourceCompositionId = compositionId.replace(/_/g, '-');
  const s3Prefix = `sources/${sourceCompositionId}/`;
  const sourceFiles = await listObjects('outputs', s3Prefix);

  if (sourceFiles.length === 0) {
    throw new Error(`Source files not found in S3: ${s3Prefix}`);
  }

  // Create temp directory for source files
  const tempDir = join(tmpdir(), `remotion-rebuild-${nanoid()}`);
  const srcDir = join(tempDir, 'src', compositionId.replace(/-/g, '_'));
  await mkdir(srcDir, { recursive: true });

  // Download all source files
  for (const file of sourceFiles) {
    const relativePath = file.replace(s3Prefix, '');
    const localPath = join(srcDir, relativePath);

    // Create subdirectories if needed
    const dir = join(srcDir, relativePath.split('/').slice(0, -1).join('/'));
    if (dir !== srcDir && relativePath.includes('/')) {
      await mkdir(dir, { recursive: true });
    }

    await downloadFile('outputs', file, localPath);
  }

  logger.info({ compositionId, fileCount: sourceFiles.length }, 'Downloaded source files from S3');

  // Fix composition ID in index.tsx (replace underscores with hyphens for Remotion)
  const indexPath = join(srcDir, 'index.tsx');
  try {
    let indexContent = await readFile(indexPath, 'utf-8');
    // Replace composition ID from underscores to hyphens
    const originalId = compositionId.replace(/-/g, '_');
    const fixedId = compositionId.replace(/_/g, '-');
    indexContent = indexContent.replace(new RegExp(originalId, 'g'), fixedId);
    await writeFile(indexPath, indexContent, 'utf-8');
  } catch (err) {
    logger.warn({ err }, 'Could not fix composition ID in index.tsx');
  }

  // Create entry point that imports the composition
  const entryContent = `
import { registerRoot } from 'remotion';
import { RemotionRoot } from './src/${compositionId.replace(/-/g, '_')}/index';

registerRoot(RemotionRoot);
`;
  const entryPath = join(tempDir, 'index.tsx');
  await writeFile(entryPath, entryContent, 'utf-8');

  logger.info({ entryPath, srcDir }, 'Created entry point for bundle');

  // Use Remotion's bundle() to create a proper bundle
  const newBundleLocation = await bundle({
    entryPoint: entryPath,
    outDir: bundlePath,
  });

  // Clean up temp dir
  await rm(tempDir, { recursive: true, force: true });

  logger.info({ newBundleLocation, compositionId }, 'Bundle rebuilt from sources successfully');
  return newBundleLocation;
}

/**
 * Render a Remotion composition to a video file using SSR.
 * Uses the existing bundle created by the visual generator.
 * If the composition is not found, attempts to rebuild the bundle from source.
 */
async function renderWithRemotion(options: RenderRemotionOptions): Promise<void> {
  const { bundlePath, compositionId, outputPath, onProgress } = options;

  logger.info({ bundlePath, compositionId, outputPath }, 'Starting Remotion SSR render');

  // Ensure bundle exists (download from S3 if needed)
  const bundleCompositionId = compositionId.replace(/_/g, '-');
  await ensureBundleExists(bundlePath, bundleCompositionId);

  // Remotion requires hyphens in composition IDs, not underscores
  // The visual generator creates IDs with underscores (proj_xxx), but Remotion validation fails
  // CRITICAL: If compositionId has underscores, skip getCompositions() entirely
  // because the existing bundle's composition.cjs.js also has underscores and will fail validation
  const hasUnderscores = compositionId.includes('_');
  const hyphenatedId = compositionId.replace(/_/g, '-');

  let composition;
  let serveUrl = bundlePath;

  if (hasUnderscores) {
    // Skip getCompositions() - we know the existing bundle will fail validation
    // Go straight to rebuild with fixed IDs
    logger.info({ compositionId, hyphenatedId }, 'Composition ID has underscores, rebuilding bundle with hyphens...');
    serveUrl = await rebuildBundleFromCJS(bundlePath, compositionId);

    composition = await selectComposition({
      serveUrl,
      id: hyphenatedId,
    });
  } else {
    // No underscores - try normal flow
    try {
      const compositions = await getCompositions(bundlePath);
      logger.info({
        availableCompositions: compositions.map(c => c.id),
        requestedComposition: compositionId
      }, 'Available compositions in bundle');

      const hasComposition = compositions.some(c => c.id === compositionId);

      if (!hasComposition) {
        logger.warn({ compositionId }, 'Composition not found in bundle, rebuilding from composition.cjs.js...');
        serveUrl = await rebuildBundleFromCJS(bundlePath, compositionId);
      }

      composition = await selectComposition({
        serveUrl,
        id: compositionId,
      });
    } catch (err) {
      logger.error({ err, compositionId }, 'Failed to select composition, attempting rebuild from CJS');
      serveUrl = await rebuildBundleFromCJS(bundlePath, compositionId);
      composition = await selectComposition({
        serveUrl,
        id: compositionId,
      });
    }
  }

  logger.info({
    compositionId: composition.id,
    width: composition.width,
    height: composition.height,
    fps: composition.fps,
    durationInFrames: composition.durationInFrames,
  }, 'Composition selected');

  // Render the composition to video
  // Railway containers have limited RAM — use concurrency 1 and 'faster' preset
  // to keep memory reasonable while maintaining text/caption quality

  logger.info({
    concurrency: 1,
    originalSize: `${composition.width}x${composition.height}`,
  }, 'Starting renderMedia at full resolution');

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outputPath,
    chromiumOptions: {
      enableMultiProcessOnLinux: true,
    },
    concurrency: 1,
    imageFormat: 'png',
    x264Preset: 'faster',
    crf: 18,
    // Progress callback
    onProgress: ({ progress }) => {
      if (onProgress) {
        onProgress(progress);
      }
      logger.debug({ progress: Math.round(progress * 100) }, 'Remotion render progress');
    },
  });

  logger.info({ outputPath }, 'Remotion SSR render completed');
}

/**
 * Composite Remotion visuals with source video using FFmpeg.
 * Overlays the Remotion output on top of the source video.
 */
async function compositeVideos(
  sourceVideoPath: string,
  remotionVideoPath: string,
  outputPath: string,
  audioPath: string | null
): Promise<void> {
  const { spawn } = await import('child_process');
  const { dirname, basename } = await import('path');
  const { copyFile } = await import('fs/promises');

  const workingDir = dirname(outputPath);
  const sourceFilename = basename(sourceVideoPath);
  const remotionFilename = basename(remotionVideoPath);
  const outputFilename = basename(outputPath);

  // Copy files to working directory if needed
  const localSourcePath = join(workingDir, 'source_' + sourceFilename);
  const localRemotionPath = join(workingDir, 'remotion_' + remotionFilename);

  await copyFile(sourceVideoPath, localSourcePath);
  await copyFile(remotionVideoPath, localRemotionPath);

  let audioFilename: string | null = null;
  if (audioPath) {
    audioFilename = basename(audioPath);
    const localAudioPath = join(workingDir, audioFilename);
    if (audioPath !== localAudioPath) {
      await copyFile(audioPath, localAudioPath);
    }
  }

  logger.info({
    sourceFilename,
    remotionFilename,
    audioFilename,
    outputFilename,
    workingDir
  }, 'Compositing videos with FFmpeg');

  // Build FFmpeg command for overlay
  // The Remotion video is overlaid on top of the source video
  const args = [
    '-i', 'source_' + sourceFilename,
    '-i', 'remotion_' + remotionFilename,
  ];

  // Add audio input if available
  if (audioFilename) {
    args.push('-i', audioFilename);
  }

  args.push(
    '-y',
    '-filter_complex', '[0:v][1:v]overlay=0:0[outv]',
    '-map', '[outv]',
  );

  // Map audio from enhanced audio or source video
  if (audioFilename) {
    args.push('-map', '2:a');
  } else {
    args.push('-map', '0:a?');  // Use source audio if available
  }

  // Encoding: 'faster' preset balances quality and memory usage
  args.push(
    '-c:v', 'libx264',
    '-preset', 'faster',
    '-crf', '18',
    '-threads', '4',
    '-c:a', 'aac',
    '-shortest',
    outputFilename
  );

  return new Promise((resolve, reject) => {
    logger.info({ cmd: `ffmpeg ${args.join(' ')}` }, 'FFmpeg composite started');

    const proc = spawn('ffmpeg', args, {
      cwd: workingDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg composite completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg composite failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

/**
 * Render only the Remotion composition (no source video overlay).
 * Use this when the composition is standalone.
 */
async function renderRemotionOnly(
  bundlePath: string,
  compositionId: string,
  outputPath: string,
  audioPath: string | null,
  onProgress?: (progress: number) => void
): Promise<void> {
  const { spawn } = await import('child_process');
  const { dirname, basename } = await import('path');
  const { copyFile } = await import('fs/promises');

  // First render Remotion to a temp file
  const workingDir = dirname(outputPath);
  const remotionTempPath = join(workingDir, 'remotion_temp.mp4');

  await renderWithRemotion({
    bundlePath,
    compositionId,
    outputPath: remotionTempPath,
    onProgress,
  });

  // If we have enhanced audio, mux it with the Remotion video
  if (audioPath) {
    const audioFilename = basename(audioPath);
    const localAudioPath = join(workingDir, audioFilename);

    if (audioPath !== localAudioPath) {
      await copyFile(audioPath, localAudioPath);
    }

    logger.info({ remotionTempPath, audioPath, outputPath }, 'Muxing audio with Remotion video');

    const args = [
      '-i', 'remotion_temp.mp4',
      '-i', audioFilename,
      '-y',
      '-map', '0:v',
      '-map', '1:a',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-shortest',
      basename(outputPath)
    ];

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('ffmpeg', args, {
        cwd: workingDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderr = '';
      proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

      proc.on('close', (code) => {
        if (code === 0) {
          logger.info({ outputPath }, 'Audio muxing completed');
          resolve();
        } else {
          logger.error({ code, stderr: stderr.slice(-1000) }, 'Audio muxing failed');
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      proc.on('error', reject);
    });

    // Clean up temp file
    await rm(remotionTempPath, { force: true });
  } else {
    // No audio to add, just rename the temp file
    const { rename } = await import('fs/promises');
    await rename(remotionTempPath, outputPath);
  }
}

interface AddAudioAndSubtitlesOptions {
  videoPath: string;
  audioPath: string | null;
  subtitles: SubtitleItem[];
  outputPath: string;
  workDir: string;
  width: number;
  height: number;
  fontsDir?: string;
  fontSizeMultiplier?: number;
}

/**
 * Add audio and subtitles to a video file.
 * Simple pass-through - no layout changes.
 */
async function addAudioAndSubtitles(options: AddAudioAndSubtitlesOptions): Promise<void> {
  const {
    videoPath,
    audioPath,
    subtitles,
    outputPath,
    workDir,
    width,
    height,
    fontsDir = escapePathForFilter(SYSTEM_FONTS_DIR),
    fontSizeMultiplier = 1,
  } = options;

  const { spawn } = await import('child_process');
  const { basename } = await import('path');
  const { writeFile, copyFile } = await import('fs/promises');

  // Copy video to working directory
  const localVideoPath = join(workDir, 'video.mp4');
  await copyFile(videoPath, localVideoPath);

  // Copy audio if provided
  let audioFilename: string | null = null;
  if (audioPath) {
    audioFilename = 'audio.m4a';
    await copyFile(audioPath, join(workDir, audioFilename));
  }

  // Generate ASS subtitles if we have any
  let assFilename: string | null = null;
  if (subtitles.length > 0) {
    assFilename = 'subtitles.ass';
    const assContent = generateASSForComposite(subtitles, width, height, undefined, undefined, fontSizeMultiplier);
    await writeFile(join(workDir, assFilename), assContent, 'utf-8');
    logger.info({ subtitleCount: subtitles.length }, 'Generated subtitles');
  }

  logger.info({
    videoPath,
    audioPath,
    subtitleCount: subtitles.length,
    outputPath,
  }, 'Adding audio and subtitles');

  // Build FFmpeg args
  const args = ['-i', 'video.mp4'];

  if (audioFilename) {
    args.push('-i', audioFilename);
  }

  args.push('-y');

  // Add subtitles filter if we have them, otherwise copy video
  if (assFilename) {
    args.push('-vf', `subtitles=${assFilename}:fontsdir=${fontsDir}`);
    args.push('-c:v', 'libx264', '-preset', 'faster', '-crf', '18', '-threads', '4');
  } else {
    args.push('-c:v', 'copy');
  }

  // Map streams
  if (audioFilename) {
    args.push('-map', '0:v', '-map', '1:a', '-c:a', 'aac');
  } else {
    args.push('-an');  // No audio if none provided
  }

  args.push('-shortest', basename(outputPath));

  return new Promise((resolve, reject) => {
    logger.info({ cmd: `ffmpeg ${args.join(' ')}`, cwd: workDir }, 'FFmpeg started');

    const proc = spawn('ffmpeg', args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

interface RenderWithPiPLayoutOptions {
  sourceVideoPath: string;
  remotionVideoPath: string;
  audioPath: string | null;
  subtitles: SubtitleItem[];
  outputPath: string;
  workDir: string;
  width: number;
  height: number;
  layoutSettings?: LayoutSettings;
  videoCrop?: VideoCropSettings;
  fullscreenVisualSegments?: DisplayModeSegment[];
  overlaySegments?: DisplayModeSegment[];
  gapSegments?: DisplayModeSegment[];
  onProgress?: (progress: number) => void;
  fontsDir: string;
  resolvedFontFamily?: string;
  fontSizeMultiplier?: number;
}

/**
 * Render final video with configurable layout:
 * - PiP mode: Remotion visuals fullscreen, source video as overlay
 * - Split modes: Side by side or top/bottom
 * Uses layoutSettings for exact position, size, and styling to match preview
 */
async function renderWithPiPLayout(options: RenderWithPiPLayoutOptions): Promise<void> {
  const {
    sourceVideoPath,
    remotionVideoPath,
    audioPath,
    subtitles,
    outputPath,
    workDir,
    width: fullWidth,
    height: fullHeight,
    layoutSettings,
    videoCrop,
    fullscreenVisualSegments,
    overlaySegments,
    gapSegments,
    onProgress,
    fontsDir,
    resolvedFontFamily,
    fontSizeMultiplier = 1,
  } = options;

  // Render at full resolution for caption/text quality
  const width = fullWidth;
  const height = fullHeight;

  logger.info({
    width,
    height,
  }, 'Compositing at full resolution');

  const { spawn, execSync } = await import('child_process');
  const { basename } = await import('path');
  const { writeFile, copyFile } = await import('fs/promises');

  // Get video duration for progress tracking using ffprobe
  let durationSeconds = 0;
  try {
    const ffprobeOutput = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${sourceVideoPath}"`,
      { encoding: 'utf-8' }
    );
    durationSeconds = parseFloat(ffprobeOutput.trim()) || 0;
  } catch {
    logger.warn('Could not get video duration for progress tracking');
  }

  // Copy files to working directory with simple names
  const localSourcePath = join(workDir, 'source.mp4');
  const localRemotionPath = join(workDir, 'remotion.mp4');
  await copyFile(sourceVideoPath, localSourcePath);
  await copyFile(remotionVideoPath, localRemotionPath);

  // Copy audio if provided
  let audioFilename: string | null = null;
  if (audioPath) {
    audioFilename = 'audio.m4a';
    await copyFile(audioPath, join(workDir, audioFilename));
  }

  // Default layout settings if not provided
  const mode = layoutSettings?.mode || 'pip';
  const pip = layoutSettings?.pip || {
    position: 'bottom-right' as const,
    offsetX: 16,
    offsetY: 16,
    size: 'medium' as const,
    customSize: 25,
    shape: 'rounded' as const,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowEnabled: true,
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowBlur: 20,
    opacity: 1,
  };
  const split = layoutSettings?.split || {
    position: 'visuals-first' as const,
    ratio: 50,
    gap: 0,
  };

  // Build video crop filter strings for all video scaling operations.
  // When videoCrop is available, the source video is scaled+cropped to match the
  // user's exact pan/zoom from the preview. Without it, center crop is used.
  const srcCropFull = videoCrop
    ? buildVideoCropFilter(videoCrop, width, height)
    : `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1`;

  let filterComplex: string;

  if (mode === 'pip') {
    // Calculate PiP dimensions based on settings
    const pipSizePercent = pip.size === 'custom' ? pip.customSize : PIP_SIZE_MAP[pip.size];
    const pipWidth = Math.round(width * (pipSizePercent / 100));
    const pipHeight = Math.round(pipWidth); // Square aspect ratio for PiP

    // Calculate position based on settings
    const scaledOffsetX = Math.round(pip.offsetX);
    const scaledOffsetY = Math.round(pip.offsetY);
    let pipX: number, pipY: number;
    switch (pip.position) {
      case 'top-left':
        pipX = scaledOffsetX;
        pipY = scaledOffsetY;
        break;
      case 'top-right':
        pipX = width - pipWidth - scaledOffsetX;
        pipY = scaledOffsetY;
        break;
      case 'bottom-left':
        pipX = scaledOffsetX;
        pipY = height - pipHeight - scaledOffsetY;
        break;
      case 'bottom-right':
      default:
        pipX = width - pipWidth - scaledOffsetX;
        pipY = height - pipHeight - scaledOffsetY;
        break;
    }

    // Build PiP-specific crop filter: use user's crop/pan/scale for the PiP bubble
    const pipCropFilter = videoCrop
      ? buildVideoCropFilter(videoCrop, pipWidth, pipHeight)
      : `scale=${pipWidth}:${pipHeight}:force_original_aspect_ratio=increase,crop=${pipWidth}:${pipHeight},setsar=1`;

    // Apply PiP styling: rounded corners, border, shadow, opacity
    // Uses FFmpeg geq+alphaextract for rounded mask, drawbox for border
    const pipStyleFilters: string[] = [];

    // Rounded corners / circle via alpha mask
    const pipBorderRadius = pip.shape === 'circle' ? Math.round(pipWidth / 2) : Math.round(pip.borderRadius);
    if (pipBorderRadius > 0) {
      // Use geq filter to create rounded rectangle alpha mask
      // The formula calculates distance from corners and applies smooth rounding
      const r = Math.min(pipBorderRadius, Math.round(pipWidth / 2), Math.round(pipHeight / 2));
      const pw = pipWidth;
      const ph = pipHeight;
      // geq expression: evaluate distance from each corner; if within radius, check against circle
      pipStyleFilters.push(`format=yuva420p`);
      pipStyleFilters.push(
        `geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':` +
        `a='if(lte(X,${r})*lte(Y,${r}),if(lte(hypot(${r}-X,${r}-Y),${r}),255,0),` +
        `if(gte(X,${pw}-${r})*lte(Y,${r}),if(lte(hypot(X-${pw}+${r},${r}-Y),${r}),255,0),` +
        `if(lte(X,${r})*gte(Y,${ph}-${r}),if(lte(hypot(${r}-X,Y-${ph}+${r}),${r}),255,0),` +
        `if(gte(X,${pw}-${r})*gte(Y,${ph}-${r}),if(lte(hypot(X-${pw}+${r},Y-${ph}+${r}),${r}),255,0),` +
        `255))))'`
      );
    }

    // Opacity
    if (pip.opacity < 1) {
      if (!pipStyleFilters.some(f => f.includes('format=yuva420p'))) {
        pipStyleFilters.push('format=yuva420p');
      }
      pipStyleFilters.push(`colorchannelmixer=aa=${pip.opacity.toFixed(2)}`);
    }

    const pipFilterChain = pipStyleFilters.length > 0
      ? `,${pipStyleFilters.join(',')}`
      : '';

    logger.info({
      mode,
      pipDimensions: { pipWidth, pipHeight, pipX, pipY },
      pipBorderRadius,
      pipOpacity: pip.opacity,
    }, 'Rendering with PiP layout');
    filterComplex = [
      // Scale Remotion visuals to full screen
      `[1:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1[bg]`,
      // Scale source video to PiP size with crop/pan + styling
      `[0:v]${pipCropFilter}${pipFilterChain}[pip]`,
      // Overlay PiP on background
      `[bg][pip]overlay=${pipX}:${pipY}:format=auto[outv]`
    ].join(';');

  } else if (mode === 'stacked') {
    // Stacked (top/bottom)
    const visualsPercent = split.ratio / 100;
    const videoPercent = 1 - visualsPercent;
    const gap = Math.round(split.gap);
    const isVisualsFirst = split.position === 'visuals-first';

    const visualsHeight = Math.round((height - gap) * visualsPercent);
    const videoHeight = Math.round((height - gap) * videoPercent);

    logger.info({
      mode,
      splitSettings: split,
      dimensions: { visualsHeight, videoHeight, gap },
    }, 'Rendering with stacked layout');

    // Use scale + crop to fill containers without black bars
    // IMPORTANT: Visual stream (1:v) must crop from top-left (0:0) because Remotion
    // renders visual content at position (0,0) with effective dimensions.
    // Source video uses user's crop/pan/scale settings for preview-accurate positioning.
    const splitHCropFilter = videoCrop
      ? buildVideoCropFilter(videoCrop, width, videoHeight)
      : `scale=${width}:${videoHeight}:force_original_aspect_ratio=increase,crop=${width}:${videoHeight},setsar=1`;

    if (isVisualsFirst) {
      filterComplex = [
        `[1:v]scale=${width}:${visualsHeight}:force_original_aspect_ratio=increase,crop=${width}:${visualsHeight}:0:0,setsar=1[visuals]`,
        `[0:v]${splitHCropFilter}[video]`,
        `[visuals][video]vstack=inputs=2[outv]`
      ].join(';');
    } else {
      filterComplex = [
        `[0:v]${splitHCropFilter}[video]`,
        `[1:v]scale=${width}:${visualsHeight}:force_original_aspect_ratio=increase,crop=${width}:${visualsHeight}:0:0,setsar=1[visuals]`,
        `[video][visuals]vstack=inputs=2[outv]`
      ].join(';');
    }

  } else if (mode === 'split-vertical') {
    // Split vertical (left/right)
    const visualsPercent = split.ratio / 100;
    const videoPercent = 1 - visualsPercent;
    const gap = Math.round(split.gap);
    const isVisualsFirst = split.position === 'visuals-first';

    const visualsWidth = Math.round((width - gap) * visualsPercent);
    const videoWidth = Math.round((width - gap) * videoPercent);

    logger.info({
      mode,
      splitSettings: split,
      dimensions: { visualsWidth, videoWidth, gap },
    }, 'Rendering with vertical split layout');

    // Use scale + crop to fill containers without black bars
    // IMPORTANT: Visual stream (1:v) must crop from top-left (0:0) because Remotion
    // renders visual content at position (0,0) with effective dimensions.
    // Source video uses user's crop/pan/scale settings for preview-accurate positioning.
    const splitVCropFilter = videoCrop
      ? buildVideoCropFilter(videoCrop, videoWidth, height)
      : `scale=${videoWidth}:${height}:force_original_aspect_ratio=increase,crop=${videoWidth}:${height},setsar=1`;

    if (isVisualsFirst) {
      filterComplex = [
        `[1:v]scale=${visualsWidth}:${height}:force_original_aspect_ratio=increase,crop=${visualsWidth}:${height}:0:0,setsar=1[visuals]`,
        `[0:v]${splitVCropFilter}[video]`,
        `[visuals][video]hstack=inputs=2[outv]`
      ].join(';');
    } else {
      filterComplex = [
        `[0:v]${splitVCropFilter}[video]`,
        `[1:v]scale=${visualsWidth}:${height}:force_original_aspect_ratio=increase,crop=${visualsWidth}:${height}:0:0,setsar=1[visuals]`,
        `[video][visuals]hstack=inputs=2[outv]`
      ].join(';');
    }

  } else {
    // Fallback to PiP with defaults (use crop for no black bars)
    const pipWidth = Math.round(width * 0.25);
    const pipHeight = Math.round(pipWidth);
    const pipX = width - pipWidth - 16;
    const pipY = height - pipHeight - 16;

    const fallbackCropFilter = videoCrop
      ? buildVideoCropFilter(videoCrop, pipWidth, pipHeight)
      : `scale=${pipWidth}:${pipHeight}:force_original_aspect_ratio=increase,crop=${pipWidth}:${pipHeight},setsar=1`;

    filterComplex = [
      `[1:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1[bg]`,
      `[0:v]${fallbackCropFilter}[pip]`,
      `[bg][pip]overlay=${pipX}:${pipY}[outv]`
    ].join(';');
  }

  // Per-scene display mode switching via FFmpeg overlay layers with enable expressions
  // Fullscreen visual segments: Remotion fills entire canvas (hides split/pip layout)
  // Gap segments: Source video fills entire canvas (no visuals active)
  // Overlay segments: Source video fullscreen with Remotion at reduced opacity on top
  const needsFullscreen = fullscreenVisualSegments && fullscreenVisualSegments.length > 0;
  const needsOverlay = overlaySegments && overlaySegments.length > 0;
  const needsGaps = gapSegments && gapSegments.length > 0;
  const hasNonPipSegments = needsFullscreen || needsOverlay || needsGaps;

  if (hasNonPipSegments) {
    // Helper: build FFmpeg enable expression from segments (hard on/off)
    const buildEnableExpr = (segs: DisplayModeSegment[]): string =>
      segs.map(s => `between(t,${(s.startMs / 1000).toFixed(3)},${(s.endMs / 1000).toFixed(3)})`).join('+');

    // Helper: build fade filter chain for smooth enter/exit transitions
    // alphaOnly=true: uses alpha=1 (only affects alpha channel) — for overlay/fullscreen layers
    // alphaOnly=false: fades RGB toward black — for screen blend layers (dark = transparent in screen)
    const buildFadeFilters = (segs: DisplayModeSegment[], alphaOnly = true): string => {
      const fades: string[] = [];
      for (const s of segs) {
        if ((s.enterDurationMs || 0) > 0) {
          const st = (s.startMs / 1000).toFixed(3);
          const d = ((s.enterDurationMs || 0) / 1000).toFixed(3);
          fades.push(`fade=t=in:st=${st}:d=${d}${alphaOnly ? ':alpha=1' : ''}`);
        }
        if ((s.exitDurationMs || 0) > 0) {
          const st = ((s.endMs - (s.exitDurationMs || 0)) / 1000).toFixed(3);
          const d = ((s.exitDurationMs || 0) / 1000).toFixed(3);
          fades.push(`fade=t=out:st=${st}:d=${d}${alphaOnly ? ':alpha=1' : ''}`);
        }
      }
      return fades.join(',');
    };

    // Check if any segments have transitions (need fade pipeline)
    const anyTransitions = (segs: DisplayModeSegment[] | undefined): boolean =>
      !!segs?.some(s => (s.enterDurationMs || 0) > 0 || (s.exitDurationMs || 0) > 0);

    // Calculate how many copies of each stream we need
    // Source (0:v): 1 for layout + 1 if gaps or overlay need fullscreen source
    const srcSplitCount = 1 + (needsGaps || needsOverlay ? 1 : 0);
    // Remotion (1:v): 1 for layout + 1 if fullscreen + 1 if overlay
    const visSplitCount = 1 + (needsFullscreen ? 1 : 0) + (needsOverlay ? 1 : 0);

    // Replace raw input refs in existing filter with split output labels
    filterComplex = filterComplex.replace(/\[0:v\]/g, '[src_layout]');
    filterComplex = filterComplex.replace(/\[1:v\]/g, '[vis_layout]');

    // Build split filters
    const splitFilters: string[] = [];

    // Source split
    const srcLabels = ['src_layout'];
    if (needsGaps || needsOverlay) srcLabels.push('src_extra');
    if (srcSplitCount > 1) {
      splitFilters.push(`[0:v]split=${srcSplitCount}${srcLabels.map(l => `[${l}]`).join('')}`);
    } else {
      splitFilters.push(`[0:v]copy[src_layout]`);
    }

    // Remotion split
    const visLabels = ['vis_layout'];
    if (needsFullscreen) visLabels.push('vis_fs');
    if (needsOverlay) visLabels.push('vis_ovl');
    if (visSplitCount > 1) {
      splitFilters.push(`[1:v]split=${visSplitCount}${visLabels.map(l => `[${l}]`).join('')}`);
    } else {
      splitFilters.push(`[1:v]copy[vis_layout]`);
    }

    // Prepend split filters before existing layout filter
    filterComplex = [...splitFilters, filterComplex].join(';');

    // Rename current output to chain through overlay layers
    let currentOut = 'outv';

    // Layer 1: Fullscreen visual — Remotion fills canvas (hides split/pip)
    if (needsFullscreen) {
      const prevOut = currentOut;
      currentOut = 'after_fs';
      filterComplex = filterComplex.replace(`[${prevOut}]`, `[${prevOut === 'outv' ? 'base' : prevOut}]`);
      const baseLabel = prevOut === 'outv' ? 'base' : prevOut;
      const expr = buildEnableExpr(fullscreenVisualSegments!);

      if (anyTransitions(fullscreenVisualSegments)) {
        // Smooth transitions: convert to yuva420p and use fade filters for alpha
        const fadeChain = buildFadeFilters(fullscreenVisualSegments!);
        filterComplex += `;[vis_fs]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,format=yuva420p,${fadeChain}[vis_fs_faded]`;
        filterComplex += `;[${baseLabel}][vis_fs_faded]overlay=0:0:enable='${expr}':format=auto[${currentOut}]`;
      } else {
        filterComplex += `;[vis_fs]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1[vis_fs_scaled]`;
        filterComplex += `;[${baseLabel}][vis_fs_scaled]overlay=0:0:enable='${expr}'[${currentOut}]`;
      }
    }

    // Layer 2: Gap + Overlay background — Source video fills canvas
    const gapAndOverlaySegs = [...(gapSegments || []), ...(overlaySegments || [])];
    if (gapAndOverlaySegs.length > 0) {
      const prevOut = currentOut;
      currentOut = 'after_src';
      if (prevOut === 'outv') {
        filterComplex = filterComplex.replace('[outv]', '[base]');
      }
      const expr = buildEnableExpr(gapAndOverlaySegs);

      if (anyTransitions(gapAndOverlaySegs)) {
        const fadeChain = buildFadeFilters(gapAndOverlaySegs);
        filterComplex += `;[src_extra]${srcCropFull},format=yuva420p,${fadeChain}[src_fs_faded]`;
        filterComplex += `;[${prevOut === 'outv' ? 'base' : prevOut}][src_fs_faded]overlay=0:0:enable='${expr}':format=auto[${currentOut}]`;
      } else {
        filterComplex += `;[src_extra]${srcCropFull}[src_fs_scaled]`;
        filterComplex += `;[${prevOut === 'outv' ? 'base' : prevOut}][src_fs_scaled]overlay=0:0:enable='${expr}'[${currentOut}]`;
      }
    }

    // Layer 3: Overlay visuals — Remotion on top of source using screen blend
    // Screen blend makes dark pixels transparent (matching editor's mixBlendMode: 'screen').
    // Without this, the Remotion composition's opaque dark background would darken the video.
    if (needsOverlay) {
      const prevOut = currentOut;
      currentOut = 'after_ovl';
      if (prevOut === 'outv') {
        filterComplex = filterComplex.replace('[outv]', '[base]');
      }
      const expr = buildEnableExpr(overlaySegments!);

      // Build per-segment opacity via RGB channel scaling.
      // Pre-multiplying RGB simulates overlay opacity with screen blend:
      // screen(A, B*op) ≈ blend with all_opacity=op for screen mode.
      const opacityGroups = new Map<number, DisplayModeSegment[]>();
      for (const seg of overlaySegments!) {
        const op = seg.overlayOpacity ?? 0.85;
        if (!opacityGroups.has(op)) opacityGroups.set(op, []);
        opacityGroups.get(op)!.push(seg);
      }

      let rgbOpacityFilter: string;
      if (opacityGroups.size === 1) {
        const [[opacity]] = opacityGroups;
        rgbOpacityFilter = `colorchannelmixer=rr=${opacity}:gg=${opacity}:bb=${opacity}`;
      } else {
        // Multiple distinct opacities: chain filters with time-based enable.
        const parts: string[] = [];
        for (const [opacity, segs] of opacityGroups) {
          const enable = segs.map(s =>
            `between(t,${(s.startMs / 1000).toFixed(3)},${(s.endMs / 1000).toFixed(3)})`
          ).join('+');
          parts.push(`colorchannelmixer=rr=${opacity}:gg=${opacity}:bb=${opacity}:enable='${enable}'`);
        }
        rgbOpacityFilter = parts.join(',');
      }

      if (anyTransitions(overlaySegments)) {
        // RGB fade (not alpha) — fading toward black makes screen blend transition smooth
        // (black is identity for screen blend, so fading to black = fading out the effect)
        const fadeChain = buildFadeFilters(overlaySegments!, false);
        filterComplex += `;[vis_ovl]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,${rgbOpacityFilter},${fadeChain}[vis_ovl_faded]`;
        filterComplex += `;[${prevOut === 'outv' ? 'base' : prevOut}][vis_ovl_faded]blend=all_mode=screen:enable='${expr}'[${currentOut}]`;
      } else {
        filterComplex += `;[vis_ovl]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,${rgbOpacityFilter}[vis_ovl_screen]`;
        filterComplex += `;[${prevOut === 'outv' ? 'base' : prevOut}][vis_ovl_screen]blend=all_mode=screen:enable='${expr}'[${currentOut}]`;
      }
    }

    // Final output must be [outv] for downstream subtitle filter and mapping
    if (currentOut !== 'outv') {
      filterComplex += `;[${currentOut}]copy[outv]`;
    }

    logger.info({
      fullscreenVisualCount: fullscreenVisualSegments?.length || 0,
      overlayCount: overlaySegments?.length || 0,
      gapCount: gapSegments?.length || 0,
      srcSplitCount,
      visSplitCount,
    }, 'Added per-scene display mode overlays to FFmpeg filter');
  }

  // Generate ASS subtitles if we have any - AFTER layout settings are parsed
  // so we can position captions correctly based on layout mode
  let assFilename: string | null = null;
  if (subtitles.length > 0) {
    assFilename = 'subtitles.ass';
    const assContent = generateASSForComposite(subtitles, width, height, layoutSettings, resolvedFontFamily, fontSizeMultiplier);
    await writeFile(join(workDir, assFilename), assContent, 'utf-8');
    logger.info({ subtitleCount: subtitles.length, assFilename, mode, resolvedFontFamily, fontSizeMultiplier }, 'Generated ASS subtitles with layout');
  }

  // Add subtitles filter if we have them
  if (assFilename) {
    filterComplex = filterComplex.replace('[outv]', '[pre]') + `;[pre]subtitles=${assFilename}:fontsdir=${fontsDir}[outv]`;
  }

  // Build FFmpeg args
  // Input order: 0=source, 1=remotion, 2=audio (optional)
  const args = [
    '-i', 'source.mp4',
    '-i', 'remotion.mp4',
  ];

  if (audioFilename) {
    args.push('-i', audioFilename);
  }

  args.push(
    '-y',
    '-filter_complex', filterComplex,
    '-map', '[outv]',
  );

  // Map audio
  if (audioFilename) {
    args.push('-map', '2:a');
  } else {
    args.push('-map', '0:a?');  // Use source audio if available
  }

  // Encoding: 'faster' preset balances quality and memory usage to avoid OOM
  args.push(
    '-c:v', 'libx264',
    '-preset', 'faster',
    '-crf', '18',
    '-threads', '4',
    '-c:a', 'aac',
    '-shortest',
    basename(outputPath)
  );

  return new Promise((resolve, reject) => {
    logger.info({ cmd: `ffmpeg ${args.join(' ')}`, cwd: workDir }, 'FFmpeg PiP render started');

    const proc = spawn('ffmpeg', args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    let lastReportedProgress = 0;
    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();

      // Parse FFmpeg progress from stderr (e.g., "time=00:01:23.45")
      if (onProgress && durationSeconds > 0) {
        const timeMatch = chunk.toString().match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const seconds = parseInt(timeMatch[3], 10);
          const centiseconds = parseInt(timeMatch[4], 10);
          const currentTime = hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
          const progress = Math.min(currentTime / durationSeconds, 1);
          // Only report if progress increased by at least 1%
          if (progress - lastReportedProgress >= 0.01) {
            lastReportedProgress = progress;
            onProgress(progress);
          }
        }
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg PiP render completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg PiP render failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

interface FinalizeRemotionVideoOptions {
  remotionVideoPath: string;
  audioPath: string | null;
  subtitles: SubtitleItem[];
  outputPath: string;
  workDir: string;
  width: number;
  height: number;
  fontsDir?: string;
  resolvedFontFamily?: string;
  fontSizeMultiplier?: number;
}

/**
 * Finalize Remotion video by adding subtitles and audio.
 * The Remotion video is used fullscreen (exactly what user sees in preview).
 */
async function finalizeRemotionVideo(options: FinalizeRemotionVideoOptions): Promise<void> {
  const {
    remotionVideoPath,
    audioPath,
    subtitles,
    outputPath,
    workDir,
    width,
    height,
    fontsDir = escapePathForFilter(SYSTEM_FONTS_DIR),
    resolvedFontFamily,
    fontSizeMultiplier = 1,
  } = options;

  const { spawn } = await import('child_process');
  const { basename } = await import('path');
  const { writeFile, copyFile } = await import('fs/promises');

  // Copy Remotion video to working directory
  const localRemotionPath = join(workDir, 'remotion.mp4');
  await copyFile(remotionVideoPath, localRemotionPath);

  // Copy audio if provided
  let audioFilename: string | null = null;
  if (audioPath) {
    audioFilename = 'audio.m4a';
    await copyFile(audioPath, join(workDir, audioFilename));
  }

  // Generate ASS subtitles if we have any
  let assFilename: string | null = null;
  if (subtitles.length > 0) {
    assFilename = 'subtitles.ass';
    const assContent = generateASSForComposite(subtitles, width, height, undefined, resolvedFontFamily, fontSizeMultiplier);
    await writeFile(join(workDir, assFilename), assContent, 'utf-8');
    logger.info({ subtitleCount: subtitles.length, assFilename, resolvedFontFamily, fontSizeMultiplier }, 'Generated ASS subtitles');
  }

  logger.info({
    remotionVideoPath,
    audioPath,
    subtitleCount: subtitles.length,
    outputPath,
  }, 'Finalizing Remotion video with subtitles and audio');

  // Build FFmpeg args
  const args = ['-i', 'remotion.mp4'];

  if (audioFilename) {
    args.push('-i', audioFilename);
  }

  args.push('-y');

  // Add video filter for subtitles if we have them
  if (assFilename) {
    args.push('-vf', `subtitles=${assFilename}:fontsdir=${fontsDir}`);
  } else {
    args.push('-c:v', 'copy');  // No re-encode needed if no subtitles
  }

  // Map video (already added via -vf or -c:v copy)
  if (audioFilename) {
    args.push('-map', '0:v', '-map', '1:a');
    args.push('-c:a', 'aac');
  } else {
    // No audio - check if Remotion video has audio
    args.push('-map', '0:v', '-map', '0:a?');
    args.push('-c:a', 'aac');
  }

  // Encoding settings (only if we have subtitles to burn)
  if (assFilename) {
    args.push('-c:v', 'libx264', '-preset', 'faster', '-crf', '18', '-threads', '4');
  }

  args.push('-shortest', basename(outputPath));

  return new Promise((resolve, reject) => {
    logger.info({ cmd: `ffmpeg ${args.join(' ')}`, cwd: workDir }, 'FFmpeg finalize started');

    const proc = spawn('ffmpeg', args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg finalize completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg finalize failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

interface CompositeFullVideoOptions {
  sourceVideoPath: string;
  remotionVideoPath: string;
  audioPath: string | null;
  subtitles: SubtitleItem[];
  outputPath: string;
  workDir: string;
  projectWidth: number;
  projectHeight: number;
  fontsDir?: string;
  fontSizeMultiplier?: number;
}

/**
 * Composite source video + Remotion visuals + subtitles + audio into final output.
 * Uses picture-in-picture layout with Remotion visuals in corner.
 */
async function compositeFullVideo(options: CompositeFullVideoOptions): Promise<void> {
  const {
    sourceVideoPath,
    remotionVideoPath,
    audioPath,
    subtitles,
    outputPath,
    workDir,
    projectWidth: fullWidth,
    projectHeight: fullHeight,
    fontsDir = escapePathForFilter(SYSTEM_FONTS_DIR),
    fontSizeMultiplier = 1,
  } = options;

  // Render at full resolution for caption/text quality
  const projectWidth = fullWidth;
  const projectHeight = fullHeight;

  logger.info({
    projectWidth,
    projectHeight,
  }, 'Compositing at full resolution');

  const { spawn } = await import('child_process');
  const { basename } = await import('path');
  const { writeFile, copyFile } = await import('fs/promises');

  // Copy files to working directory with simple names
  const localSourcePath = join(workDir, 'source.mp4');
  const localRemotionPath = join(workDir, 'remotion.mp4');
  await copyFile(sourceVideoPath, localSourcePath);
  await copyFile(remotionVideoPath, localRemotionPath);

  // Copy audio if provided
  let audioFilename: string | null = null;
  if (audioPath) {
    audioFilename = 'audio.m4a';
    await copyFile(audioPath, join(workDir, audioFilename));
  }

  // Generate ASS subtitles if we have any
  let assFilename: string | null = null;
  if (subtitles.length > 0) {
    assFilename = 'subtitles.ass';
    const assContent = generateASSForComposite(subtitles, projectWidth, projectHeight, undefined, undefined, fontSizeMultiplier);
    await writeFile(join(workDir, assFilename), assContent, 'utf-8');
    logger.info({ subtitleCount: subtitles.length, assFilename }, 'Generated ASS subtitles');
  }

  logger.info({
    sourceVideoPath,
    remotionVideoPath,
    audioPath,
    subtitleCount: subtitles.length,
    outputPath,
  }, 'Compositing full video');

  // Build FFmpeg filter complex
  // Layout: Source video as main, Remotion visuals scaled to PiP in top-right corner
  // Then burn subtitles on top
  const pipScale = 0.3; // PiP is 30% of source video size
  const pipWidth = Math.round(projectWidth * pipScale);
  const pipHeight = Math.round(projectHeight * pipScale);
  const pipX = projectWidth - pipWidth - 20; // 20px padding from right
  const pipY = 20; // 20px padding from top

  let filterComplex = `[1:v]scale=${pipWidth}:${pipHeight}[pip];[0:v][pip]overlay=${pipX}:${pipY}`;

  // Add subtitles filter if we have them
  if (assFilename) {
    filterComplex += `,subtitles=${assFilename}:fontsdir=${fontsDir}`;
  }

  filterComplex += '[outv]';

  // Build FFmpeg args
  const args = [
    '-i', 'source.mp4',
    '-i', 'remotion.mp4',
  ];

  if (audioFilename) {
    args.push('-i', audioFilename);
  }

  args.push(
    '-y',
    '-filter_complex', filterComplex,
    '-map', '[outv]',
  );

  // Map audio
  if (audioFilename) {
    args.push('-map', '2:a');
  } else {
    args.push('-map', '0:a?');
  }

  // Encoding: 'faster' preset balances quality and memory usage
  args.push(
    '-c:v', 'libx264',
    '-preset', 'faster',
    '-crf', '18',
    '-threads', '4',
    '-c:a', 'aac',
    '-shortest',
    basename(outputPath)
  );

  return new Promise((resolve, reject) => {
    logger.info({ cmd: `ffmpeg ${args.join(' ')}`, cwd: workDir }, 'FFmpeg full composite started');

    const proc = spawn('ffmpeg', args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg full composite completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg full composite failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

/**
 * Convert hex or rgba color to ASS color format (&HAABBGGRR)
 */
function hexToASSColor(color: string): string {
  if (!color) return '&H00FFFFFF'; // Default to white

  // Handle rgba format: rgba(r, g, b, a)
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);
    const a = rgbaMatch[4] ? Math.round((1 - parseFloat(rgbaMatch[4])) * 255) : 0;
    const result = `&H${a.toString(16).padStart(2, '0').toUpperCase()}${b.toString(16).padStart(2, '0').toUpperCase()}${g.toString(16).padStart(2, '0').toUpperCase()}${r.toString(16).padStart(2, '0').toUpperCase()}`;
    logger.info({ input: color, type: 'rgba', r, g, b, a, result }, 'hexToASSColor conversion');
    return result;
  }

  // Handle hex format
  let hex = color.replace('#', '');

  // Handle short hex (#fff -> #ffffff)
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  // Parse RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // ASS uses &HAABBGGRR format (alpha, blue, green, red)
  // Alpha 00 = fully opaque
  const result = `&H00${b.toString(16).padStart(2, '0').toUpperCase()}${g.toString(16).padStart(2, '0').toUpperCase()}${r.toString(16).padStart(2, '0').toUpperCase()}`;
  logger.info({ input: color, type: 'hex', hex, r, g, b, result }, 'hexToASSColor conversion');
  return result;
}

/**
 * Get ASS alignment from position string
 * ASS alignments: 1=bottom-left, 2=bottom-center, 3=bottom-right
 *                 4=middle-left, 5=middle-center, 6=middle-right
 *                 7=top-left, 8=top-center, 9=top-right
 */
function getASSAlignment(position: string): number {
  switch (position) {
    case 'top': return 8;
    case 'middle': case 'center': return 5;
    case 'bottom': default: return 2;
  }
}

/**
 * Generate ASS subtitles using style from subtitle data.
 * Matches frontend caption styling as closely as possible.
 * Adjusts positioning based on layout mode (PiP, stacked).
 * Supports word-by-word, phrase, and karaoke display modes.
 */
function generateASSForComposite(subtitles: SubtitleItem[], width: number, height: number, layoutSettings?: LayoutSettings, fontFamilyOverride?: string, fontSizeMultiplier: number = 1): string {
  // Get style from the first subtitle that has a non-empty style object.
  // All captions should share the same style (set via updateAllCaptionStyles),
  // but if the first subtitle is missing its style (e.g. legacy data), search
  // through the list to find one that does.
  const firstStyle = ((): any => {
    for (const sub of subtitles) {
      const s = sub.style as any;
      if (s && typeof s === 'object' && Object.keys(s).length > 0) return s;
    }
    return {};
  })();

  logger.info({
    captionStyle: firstStyle,
    layoutSettings,
    styleKeys: Object.keys(firstStyle),
    fontFamily: firstStyle.fontFamily,
    fontSize: firstStyle.fontSize,
    fontWeight: firstStyle.fontWeight,
    wordsPerPhrase: firstStyle.wordsPerPhrase,
    displayMode: firstStyle.displayMode,
  }, 'Generating ASS subtitles with style and layout');

  // Use the resolved/override font family if provided, otherwise resolve from CSS font-family string
  // resolveAvailableFontFamily walks the comma-separated list and picks the first font
  // available in Google Fonts or the fallback map (e.g. 'Komika Axis' → 'Anton')
  const fontFamily = fontFamilyOverride || resolveAvailableFontFamily(firstStyle.fontFamily || 'Inter');
  logger.info({ fontFamily, fontFamilyOverride, styleFontFamily: firstStyle.fontFamily }, 'ASS using font family');
  // Apply ASS↔CSS font size correction. libass maps FontSize to the font's
  // usWinAscent+usWinDescent metrics, while CSS maps font-size to the em-square.
  // Without this multiplier, ASS text renders at ~60% of the intended size for Inter.
  const baseFontSize = firstStyle.fontSize || 56;
  const fontSize = Math.round(baseFontSize * fontSizeMultiplier);
  logger.info({ baseFontSize, fontSizeMultiplier, fontSize }, 'ASS font size with correction');

  // Apply opacity to colors if specified
  const opacity = firstStyle.opacity ?? 1;
  const applyOpacity = (assColor: string, op: number): string => {
    if (op >= 1) return assColor;
    // ASS format: &HAABBGGRR - modify the alpha (AA) based on opacity
    const alpha = Math.round((1 - op) * 255);
    return assColor.replace(/^&H../, `&H${alpha.toString(16).padStart(2, '0').toUpperCase()}`);
  };

  const color = applyOpacity(hexToASSColor(firstStyle.color || '#ffffff'), opacity);
  const activeColor = applyOpacity(hexToASSColor(firstStyle.activeColor || '#ffff00'), opacity);

  // Handle backgroundColor — use proper ASS BackColour
  // Default to fully transparent (matching preview's 'transparent' default)
  let backColor = '&H00000000'; // Fully transparent
  let borderStyle = 1; // 1 = outline + shadow (default)
  if (firstStyle.backgroundColor && firstStyle.backgroundColor !== 'transparent') {
    backColor = hexToASSColor(firstStyle.backgroundColor);
    borderStyle = 3; // 3 = opaque box behind text (like CSS backgroundColor)
  }

  const fontWeight = firstStyle.fontWeight || 800;
  const bold = fontWeight >= 700 ? -1 : 0;  // -1 = bold in ASS

  // Letter spacing — scale proportionally with font size multiplier
  const letterSpacing = Math.round((firstStyle.letterSpacing || 0) * fontSizeMultiplier);

  // Line height — CSS lineHeight (unitless multiplier, default 1.4) controls vertical
  // line spacing. ASS doesn't have a direct lineHeight field, so we approximate via ScaleY.
  // Default ASS line spacing ≈ 1.2× font size (font-metric dependent).
  // ScaleY scales the entire glyph + line gap proportionally.
  const lineHeight = firstStyle.lineHeight ?? 1.4;
  const DEFAULT_ASS_LINE_HEIGHT = 1.2;
  const scaleY = Math.round((lineHeight / DEFAULT_ASS_LINE_HEIGHT) * 100);

  // Text transform - will be applied to each subtitle text
  const textTransform = firstStyle.textTransform || 'none';

  // Display mode for word-by-word/phrase/karaoke styling
  const displayMode = firstStyle.displayMode || 'phrase';
  const wordsPerPhrase = firstStyle.wordsPerPhrase || 5;

  // Parse V2 position system (object or legacy string)
  let captionPosition: string;
  let offsetX = 0;
  let offsetY = 0;
  let rotation = 0;
  let textAlign: string = 'center';

  if (typeof firstStyle.position === 'object' && firstStyle.position !== null) {
    // V2 position object
    captionPosition = firstStyle.position.anchor || 'bottom';
    offsetX = firstStyle.position.offsetX || 0;
    offsetY = firstStyle.position.offsetY || 0;
    rotation = firstStyle.position.rotation || 0;
    textAlign = firstStyle.position.textAlign || 'center';
  } else {
    // Legacy string position
    captionPosition = firstStyle.position || 'bottom';
  }

  // Map textAlign to ASS alignment
  // ASS alignments: 1=bottom-left, 2=bottom-center, 3=bottom-right
  //                 4=middle-left, 5=middle-center, 6=middle-right
  //                 7=top-left, 8=top-center, 9=top-right
  let alignment: number;
  const alignCol = textAlign === 'left' ? 1 : textAlign === 'right' ? 3 : 2;
  const alignRow = captionPosition === 'top' ? 6 : (captionPosition === 'center' || captionPosition === 'middle') ? 3 : 0;
  alignment = alignRow + alignCol;

  // Get layout info
  const mode = layoutSettings?.mode || 'pip';
  const pip = layoutSettings?.pip;
  const split = layoutSettings?.split;

  // Calculate effective area for captions based on layout
  let effectiveHeight = height;
  let verticalOffset = 0;

  if (mode === 'stacked') {
    // In stacked layout, captions should be in the video section
    const visualsRatio = (split?.ratio || 50) / 100;
    const isVisualsFirst = split?.position === 'visuals-first';

    if (isVisualsFirst) {
      // Visuals on top, video on bottom - captions in bottom section
      effectiveHeight = Math.round(height * (1 - visualsRatio));
      verticalOffset = Math.round(height * visualsRatio);
    } else {
      // Video on top, visuals on bottom - captions in top section
      effectiveHeight = Math.round(height * (1 - visualsRatio));
      verticalOffset = 0;
    }
  }

  // Calculate margin based on position, offsetY, and layout
  let marginV: number;
  if (captionPosition === 'top') {
    marginV = Math.round(effectiveHeight * 0.10 + (offsetY * effectiveHeight / 100));
  } else if (captionPosition === 'center' || captionPosition === 'middle') {
    marginV = Math.round(effectiveHeight * 0.5 + (offsetY * effectiveHeight / 100));
  } else {
    // bottom - most common
    marginV = Math.round(effectiveHeight * 0.15 - (offsetY * effectiveHeight / 100));
  }

  // For stacked with visuals-first, add the vertical offset
  if (mode === 'stacked' && split?.position === 'visuals-first' && captionPosition === 'bottom') {
    // Captions are at bottom of video section which is at bottom of frame
    // marginV is from bottom, so no adjustment needed
  } else if (mode === 'stacked' && split?.position !== 'visuals-first' && captionPosition === 'bottom') {
    // Video on top, captions should be at bottom of top section
    // Need to add offset for visuals section below
    marginV += Math.round(height * ((split?.ratio || 50) / 100));
  }

  // For PiP mode, avoid overlapping with PiP window
  if (mode === 'pip' && pip) {
    const pipSize = pip.size === 'custom' ? pip.customSize : PIP_SIZE_MAP[pip.size] || 25;
    const pipHeight = Math.round(width * (pipSize / 100)); // PiP is square

    // If caption is at bottom and PiP is at bottom, add margin to avoid overlap
    if (captionPosition === 'bottom' && (pip.position === 'bottom-left' || pip.position === 'bottom-right')) {
      marginV = Math.max(marginV, pipHeight + pip.offsetY + 20);
    }
    // If caption is at top and PiP is at top, add margin to avoid overlap
    if (captionPosition === 'top' && (pip.position === 'top-left' || pip.position === 'top-right')) {
      marginV = Math.max(marginV, pipHeight + pip.offsetY + 20);
    }
  }

  marginV = Math.max(20, Math.min(marginV, height / 2)); // Clamp to reasonable range

  // Calculate horizontal margins based on offsetX
  // offsetX is a percentage (-50 to +50), convert to pixels
  const offsetXPixels = Math.round(offsetX * width / 100);
  let marginL = 10 + Math.max(0, offsetXPixels);
  let marginR = 10 + Math.max(0, -offsetXPixels);

  // ── Effects mapping: stroke → ASS Outline, shadow → ASS inline xshad/yshad/blur ──
  // Stroke (CSS WebkitTextStroke) maps to ASS Outline (border around glyphs).
  // Shadow (CSS text-shadow) maps to ASS \xshad, \yshad, \blur inline override tags.
  // This separation matches the preview more closely than mixing them into Style fields.
  let outline = 0;
  let outlineColorParsed = '&H00000000'; // Default black

  // Stroke → ASS Outline — scale proportionally with font size multiplier
  if (firstStyle.stroke && firstStyle.stroke.width > 0) {
    outline = Math.round(firstStyle.stroke.width * fontSizeMultiplier);
    outlineColorParsed = hexToASSColor(firstStyle.stroke.color || '#000000');
    logger.info({ stroke: firstStyle.stroke, outline, fontSizeMultiplier }, 'Stroke → ASS Outline (scaled)');
  }

  // Shadow → inline tags (built later, prepended to each dialogue line)
  // Stores the values for \xshad, \yshad, \blur tags
  let shadowXShad = 0;
  let shadowYShad = 0;
  let shadowBlur = 0;
  let shadowColor = '&H00000000'; // Default black shadow color

  if (firstStyle.effects?.shadow) {
    const se = firstStyle.effects.shadow;
    shadowXShad = Math.round(se.offsetX * fontSizeMultiplier);
    shadowYShad = Math.round(se.offsetY * fontSizeMultiplier);
    shadowBlur = Math.round(se.blur * 0.5 * fontSizeMultiplier); // ASS blur is more intense, scale down
    shadowColor = applyOpacity(hexToASSColor(se.color || '#000000'), se.opacity);
    logger.info({ shadowEffect: se, shadowXShad, shadowYShad, shadowBlur }, 'Shadow → ASS inline xshad/yshad/blur (scaled)');

    // If no stroke, use shadow blur as a subtle outline for readability
    if (outline === 0 && se.blur > 0) {
      outline = Math.max(1, Math.round(se.blur / 4 * fontSizeMultiplier));
      outlineColorParsed = hexToASSColor(se.color || '#000000');
    }
  } else if (firstStyle.textShadow) {
    // Legacy fallback — parse "2px 2px 4px rgba(0,0,0,0.8)"
    const shadowMatch = firstStyle.textShadow.match(/(-?\d+)px\s+(-?\d+)px\s+(\d+)px/);
    if (shadowMatch) {
      shadowXShad = Math.round(parseInt(shadowMatch[1], 10) * fontSizeMultiplier);
      shadowYShad = Math.round(parseInt(shadowMatch[2], 10) * fontSizeMultiplier);
      shadowBlur = Math.round(parseInt(shadowMatch[3], 10) * 0.5 * fontSizeMultiplier);
    }
    if (outline === 0) {
      outline = Math.max(1, shadowBlur);
    }
  }

  // Secondary shadow support (previously ignored entirely)
  let shadowSecondaryTags = '';
  if (firstStyle.effects?.shadowSecondary) {
    const ss = firstStyle.effects.shadowSecondary;
    // Secondary shadow is applied as additional text-shadow in CSS.
    // In ASS we can't have two shadows, but we can approximate by choosing
    // the larger shadow for the inline tags (the one with more visual impact).
    const secondaryMag = Math.abs(ss.offsetX) + Math.abs(ss.offsetY) + ss.blur;
    const primaryMag = Math.abs(shadowXShad) + Math.abs(shadowYShad) + shadowBlur * 2;
    if (secondaryMag > primaryMag) {
      shadowXShad = ss.offsetX;
      shadowYShad = ss.offsetY;
      shadowBlur = Math.round(ss.blur * 0.5);
      shadowColor = applyOpacity(hexToASSColor(ss.color || '#000000'), ss.opacity);
    }
    logger.info({ shadowSecondary: ss }, 'Secondary shadow considered');
  }

  // Glow → ASS \blur tag (approximates CSS multi-layer glow shadows)
  let glowBlur = 0;
  let glowColor = '';
  if (firstStyle.effects?.glow?.enabled) {
    const glow = firstStyle.effects.glow;
    glowBlur = Math.round(glow.size * 0.5 * fontSizeMultiplier);
    glowColor = hexToASSColor(glow.color);
    // Combine glow blur with shadow blur (take the larger)
    shadowBlur = Math.max(shadowBlur, glowBlur);
    logger.info({ glow, glowBlur }, 'Glow → ASS blur');
  }

  // Build the inline effect override tags that get prepended to every dialogue line.
  // These override the Style-level Shadow field with per-axis values + Gaussian blur.
  const effectOverrideParts: string[] = [];
  if (shadowXShad !== 0) effectOverrideParts.push(`\\xshad${shadowXShad}`);
  if (shadowYShad !== 0) effectOverrideParts.push(`\\yshad${shadowYShad}`);
  if (shadowBlur > 0) effectOverrideParts.push(`\\blur${shadowBlur}`);
  // Shadow/glow color: glow color takes priority if glow is enabled, otherwise use shadow color
  const effectShadowColor = glowColor || shadowColor;
  if (effectShadowColor !== '&H00000000') effectOverrideParts.push(`\\4c${effectShadowColor}`);
  const effectOverrideTags = effectOverrideParts.length > 0 ? `{${effectOverrideParts.join('')}}` : '';

  // Helper to apply text transform
  const applyTextTransform = (text: string): string => {
    if (textTransform === 'uppercase') return text.toUpperCase();
    if (textTransform === 'lowercase') return text.toLowerCase();
    return text;
  };

  // Shadow in the Style line is set to 0 because we use inline \xshad/\yshad/\blur tags
  // for accurate per-axis shadow rendering. The Style Shadow field only supports equal X/Y.
  const styleShadow = 0;

  // Create styles - Default for inactive words, Active for highlighted words
  // BorderStyle: 1 = outline+shadow (transparent bg), 3 = opaque box (colored bg)
  let ass = `[Script Info]
Title: Viona Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontFamily},${fontSize},${color},${activeColor},${outlineColorParsed},${backColor},${bold},0,0,0,100,${scaleY},${letterSpacing},${rotation},${borderStyle},${outline},${styleShadow},${alignment},${marginL},${marginR},${marginV},1
Style: Active,${fontFamily},${fontSize},${activeColor},${color},${outlineColorParsed},${backColor},${bold},0,0,0,100,${scaleY},${letterSpacing},${rotation},${borderStyle},${outline},${styleShadow},${alignment},${marginL},${marginR},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Log the ASS style header for debugging font issues
  logger.info({
    fontFamily,
    fontSize,
    bold,
    alignment,
    displayMode,
    assStylePreview: `Style: Default,${fontFamily},${fontSize},...`,
  }, 'Generated ASS style');

  // Helper to get absolute word timing
  // Words from database may be absolute (>= subtitle.startMs) or relative (< subtitle.startMs)
  const getAbsoluteWordTime = (subtitle: any, word: any, isEnd: boolean) => {
    const wordTime = isEnd ? (word.endMs ?? word.startMs + 500) : (word.startMs ?? 0);
    // If word time is >= subtitle start time, it's already absolute
    // Otherwise, add subtitle start to make it absolute
    if (wordTime >= subtitle.startMs) {
      return wordTime;
    }
    return subtitle.startMs + wordTime;
  };

  // Helper: build ASS inline override tags from per-word styleOverrides
  const buildWordOverrideTags = (word: any, isActive: boolean): string => {
    const ov = word.styleOverrides;
    if (!ov) return '';
    const tags: string[] = [];
    // Color override: use activeColor when word is active, else color
    if (isActive && ov.activeColor) {
      tags.push(`\\c${hexToASSColor(ov.activeColor)}`);
    } else if (ov.color) {
      tags.push(`\\c${hexToASSColor(ov.color)}`);
    }
    // Font family — resolve through fallback map so commercial fonts get substituted
    if (ov.fontFamily) {
      const family = resolveAvailableFontFamily(ov.fontFamily);
      tags.push(`\\fn${family}`);
    }
    // Font size (absolute override or scale) — apply fontSizeMultiplier for ASS↔CSS correction
    if (ov.fontSize) {
      const scaledSize = Math.round((ov.scale || 1) * ov.fontSize * fontSizeMultiplier);
      tags.push(`\\fs${scaledSize}`);
    } else if (ov.scale && ov.scale !== 1) {
      tags.push(`\\fs${Math.round(fontSize * ov.scale)}`);
    }
    // Font weight (bold)
    if (ov.fontWeight && ov.fontWeight >= 700) {
      tags.push('\\b1');
    }
    // Letter spacing
    if (ov.letterSpacing != null) {
      tags.push(`\\fsp${ov.letterSpacing}`);
    }
    // Emphasis background (\\3c = border color used as highlight box)
    if (ov.emphasisBg) {
      tags.push(`\\3c${hexToASSColor(ov.emphasisBg)}`);
    }
    return tags.length > 0 ? `{${tags.join('')}}` : '';
  };

  // Helper: reset ASS inline overrides back to style defaults after an overridden word
  const buildResetTags = (word: any): string => {
    const ov = word.styleOverrides;
    if (!ov) return '';
    const tags: string[] = [];
    if (ov.color || ov.activeColor) tags.push(`\\c${color}`);
    if (ov.fontFamily) tags.push(`\\fn${fontFamily}`);
    if (ov.fontSize || (ov.scale && ov.scale !== 1)) tags.push(`\\fs${fontSize}`);
    if (ov.fontWeight && ov.fontWeight >= 700) tags.push(`\\b${bold}`);
    if (ov.letterSpacing != null) tags.push(`\\fsp${letterSpacing}`);
    if (ov.emphasisBg) tags.push(`\\3c${outlineColorParsed}`);
    return tags.length > 0 ? `{${tags.join('')}}` : '';
  };

  // Helper: apply per-word textTransform (override > caption-level)
  const transformWordText = (word: any): string => {
    const text = word.text || '';
    const ov = word.styleOverrides;
    if (ov?.textTransform === 'uppercase') return text.toUpperCase();
    if (ov?.textTransform === 'lowercase') return text.toLowerCase();
    return applyTextTransform(text);
  };

  // ── Dynamic hierarchy word classification (matches Composition.tsx preview) ──
  const isDynamicHierarchy = firstStyle.presetId === 'dynamic-hierarchy';

  const POWER_WORDS = new Set([
    'love', 'hate', 'fear', 'die', 'dead', 'death', 'kill', 'destroy', 'dream',
    'obsessed', 'insane', 'crazy', 'incredible', 'amazing', 'unbelievable',
    'shocking', 'terrifying', 'brilliant', 'genius', 'perfect', 'worst',
    'best', 'greatest', 'legendary', 'epic', 'massive', 'huge', 'evil',
    'now', 'stop', 'wait', 'listen', 'watch', 'look', 'never', 'always',
    'forever', 'immediately', 'urgent', 'warning', 'danger', 'critical',
    'important', 'breaking', 'exclusive', 'secret', 'finally', 'today',
    'million', 'billion', 'thousand', 'money', 'rich', 'free', 'paid',
    'expensive', 'cheap', 'profit', 'cash', 'dollar', 'dollars', 'price',
    'worth', 'cost', 'zero', 'double', 'triple', '100%', '1000',
    'but', 'however', 'actually', 'wrong', 'right', 'truth', 'lie', 'real',
    'fake', 'only', 'everything', 'nothing', 'impossible', 'possible',
    'everyone', 'nobody', 'first', 'last', 'biggest', 'smallest',
    'win', 'won', 'lose', 'lost', 'fight', 'broke', 'crushed', 'dominated',
    'exploded', 'changed', 'saved', 'failed', 'success', 'discovered',
  ]);

  const FILLER_WORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'to', 'of', 'in', 'for', 'on', 'at', 'by', 'with', 'from', 'as',
    'and', 'or', 'if', 'it', 'its', 'that', 'this', 'than', 'then',
    'so', 'up', 'do', 'did', 'has', 'had', 'have', 'will', 'would',
    'could', 'should', 'can', 'may', 'might', 'shall', 'just', 'very',
    'also', 'about', 'into', 'not', 'no', 'yes', 'some', 'my', 'your',
    'we', 'they', 'he', 'she', 'i', 'me', 'us', 'them', 'our', 'their',
  ]);

  const classifyWordTier = (text: string): 'power' | 'medium' | 'filler' => {
    const clean = text.replace(/[^a-zA-Z0-9%]/g, '').toLowerCase();
    if (/^\$?\d/.test(clean) || /\d{4,}/.test(clean) || clean.endsWith('%')) return 'power';
    if (POWER_WORDS.has(clean)) return 'power';
    if (FILLER_WORDS.has(clean)) return 'filler';
    return 'medium';
  };

  // Build dynamic hierarchy ASS override tags for a word
  const buildDynamicHierarchyTags = (word: any, isActive: boolean): string => {
    if (!isDynamicHierarchy) return '';
    const tier = classifyWordTier(word.text || '');
    const tags: string[] = [];
    if (tier === 'power') {
      tags.push(`\\fs${Math.round(fontSize * 1.8)}`);
      tags.push('\\b1');
      tags.push(`\\c${isActive ? hexToASSColor('#FFD400') : hexToASSColor('#FFFFFF')}`);
    } else if (tier === 'filler') {
      tags.push(`\\fs${Math.round(fontSize * 0.65)}`);
      // Use 60% opacity white for filler words
      tags.push(`\\c${isActive ? '&H33FFFFFF' : '&H66FFFFFF'}`);
    } else {
      // medium — default size, bold
      tags.push('\\b1');
    }
    return tags.length > 0 ? `{${tags.join('')}}` : '';
  };

  // Build reset tags after a dynamic hierarchy word
  const buildDynamicHierarchyReset = (word: any): string => {
    if (!isDynamicHierarchy) return '';
    const tier = classifyWordTier(word.text || '');
    if (tier === 'power' || tier === 'filler') {
      return `{\\fs${fontSize}\\b${bold}\\c${color}}`;
    }
    return '';
  };

  // ── Phrase windowing helper ──
  // Groups words into chunks of wordsPerPhrase. Each chunk covers the time
  // from the first word's start to the last word's end.
  const windowWords = (words: any[], subtitle: any): { groupWords: any[]; startMs: number; endMs: number }[] => {
    const groups: { groupWords: any[]; startMs: number; endMs: number }[] = [];
    for (let i = 0; i < words.length; i += wordsPerPhrase) {
      const chunk = words.slice(i, i + wordsPerPhrase);
      const groupStart = getAbsoluteWordTime(subtitle, chunk[0], false);
      const groupEnd = getAbsoluteWordTime(subtitle, chunk[chunk.length - 1], true);
      groups.push({ groupWords: chunk, startMs: groupStart, endMs: groupEnd });
    }
    return groups;
  };

  // Process subtitles based on display mode
  for (const subtitle of subtitles) {
    const rawWords = subtitle.words || [];
    // Create fallback word if no words exist
    const words = rawWords.length > 0 ? rawWords : [{ text: subtitle.text || '', startMs: subtitle.startMs, endMs: subtitle.endMs }];

    if (displayMode === 'word-by-word') {
      // Show one word at a time with active color
      for (const word of words) {
        const wordStart = getAbsoluteWordTime(subtitle, word, false);
        const wordEnd = getAbsoluteWordTime(subtitle, word, true);
        const startTime = formatASSTime(wordStart);
        const endTime = formatASSTime(wordEnd);
        const text = transformWordText(word).replace(/\n/g, '\\N');
        const overrideTags = buildWordOverrideTags(word, true);
        const dhTags = buildDynamicHierarchyTags(word, true);
        // Prepend effect tags (shadow xshad/yshad/blur) to each dialogue line
        ass += `Dialogue: 0,${startTime},${endTime},Active,,0,0,0,,${effectOverrideTags}${dhTags}${overrideTags}${text}\n`;
      }
    } else if (displayMode === 'karaoke') {
      // Show words with karaoke fill effect, windowed by wordsPerPhrase
      const groups = windowWords(words, subtitle);
      for (const group of groups) {
        const startTime = formatASSTime(group.startMs);
        const endTime = formatASSTime(group.endMs);

        // Build karaoke text with \kf tags for fill effect
        let karaokeText = '';
        for (let i = 0; i < group.groupWords.length; i++) {
          const word = group.groupWords[i];
          const wordStart = getAbsoluteWordTime(subtitle, word, false);
          const wordEnd = getAbsoluteWordTime(subtitle, word, true);
          const duration = Math.round((wordEnd - wordStart) / 10);
          const wordText = transformWordText(word);
          const overrideTags = buildWordOverrideTags(word, false);
          const dhTags = buildDynamicHierarchyTags(word, false);
          // Merge all override tags with \kf tag
          const allOverrides = [
            dhTags ? dhTags.slice(1, -1) : '',
            overrideTags ? overrideTags.slice(1, -1) : '',
          ].filter(Boolean).join('');
          if (allOverrides) {
            karaokeText += `{\\kf${duration}${allOverrides}}${wordText}`;
          } else {
            karaokeText += `{\\kf${duration}}${wordText}`;
          }
          // Reset after overridden word so next word uses defaults
          const needsReset = (word as any).styleOverrides || isDynamicHierarchy;
          if (needsReset && i < group.groupWords.length - 1) {
            karaokeText += buildResetTags(word);
            karaokeText += buildDynamicHierarchyReset(word);
          }
          if (i < group.groupWords.length - 1) karaokeText += ' \\h';
        }
        ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${effectOverrideTags}${karaokeText}\n`;
      }
    } else if (isDynamicHierarchy) {
      // ── Dynamic hierarchy: emotional segmentation (matches Composition.tsx preview) ──
      // Instead of fixed wordsPerPhrase chunks, use emotional line breaking:
      // - Power words get their own line for dramatic emphasis
      // - Pauses > 400ms force line breaks
      // - Filler words don't start lines (pull to previous)
      // - Max 5 words per line, max 2 lines per segment
      const DH_MAX_LINE = 5;
      const DH_PAUSE_MS = 400;
      const emotionalLines: number[][] = [];
      let curLine: number[] = [];

      for (let i = 0; i < words.length; i++) {
        const tier = classifyWordTier(words[i].text || '');
        const hasPause = i > 0 &&
          (getAbsoluteWordTime(subtitle, words[i], false) - getAbsoluteWordTime(subtitle, words[i - 1], true)) > DH_PAUSE_MS;

        if (hasPause && curLine.length > 0) {
          emotionalLines.push(curLine);
          curLine = [];
        }
        if (tier === 'power' && curLine.length > 0) {
          emotionalLines.push(curLine);
          curLine = [];
        }
        if (tier === 'filler' && curLine.length === 0 && emotionalLines.length > 0) {
          const prevLine = emotionalLines[emotionalLines.length - 1];
          if (prevLine.length < DH_MAX_LINE) {
            prevLine.push(i);
            continue;
          }
        }
        curLine.push(i);
        if (tier === 'power' && curLine.length === 1) {
          emotionalLines.push(curLine);
          curLine = [];
          continue;
        }
        if (curLine.length >= DH_MAX_LINE) {
          emotionalLines.push(curLine);
          curLine = [];
        }
      }
      if (curLine.length > 0) emotionalLines.push(curLine);

      // Group lines into 2-line display segments (same as preview)
      const dhSegments: { lines: number[][]; startIdx: number; endIdx: number }[] = [];
      for (let l = 0; l < emotionalLines.length; l += 2) {
        const segLines = [emotionalLines[l]];
        if (l + 1 < emotionalLines.length) segLines.push(emotionalLines[l + 1]);
        const allIdx = segLines.flat();
        dhSegments.push({
          lines: segLines,
          startIdx: allIdx[0],
          endIdx: allIdx[allIdx.length - 1] + 1,
        });
      }

      // Wider margins to constrain text to ~60% width (matching preview's width: 60%)
      const dhMarginL = Math.round(width * 0.2);
      const dhMarginR = dhMarginL;

      // Build text for an emotional segment with one word optionally highlighted
      const buildSegText = (seg: { lines: number[][] }, activeWordRef: any | null): string => {
        const parts: string[] = [];
        for (let li = 0; li < seg.lines.length; li++) {
          const line = seg.lines[li];
          for (let j = 0; j < line.length; j++) {
            const idx = line[j];
            const w = words[idx];
            const isWordActive = w === activeWordRef;
            const wordText = transformWordText(w);
            const tier = classifyWordTier(w.text || '');
            const tags: string[] = [];

            if (tier === 'power') {
              tags.push(`\\fs${Math.round(fontSize * 1.8)}`);
              tags.push('\\b1');
              tags.push(`\\c${isWordActive ? hexToASSColor('#FFD400') : hexToASSColor('#FFFFFF')}`);
            } else if (tier === 'filler') {
              tags.push(`\\fs${Math.round(fontSize * 0.65)}`);
              tags.push(`\\c${isWordActive ? '&H33FFFFFF' : '&H66FFFFFF'}`);
            } else {
              tags.push('\\b1');
              tags.push(`\\c${isWordActive ? activeColor : color}`);
            }

            // Per-word style overrides
            const ov = (w as any).styleOverrides;
            if (ov?.fontFamily) tags.push(`\\fn${resolveAvailableFontFamily(ov.fontFamily)}`);
            if (ov?.fontSize) tags.push(`\\fs${Math.round((ov.scale || 1) * ov.fontSize * fontSizeMultiplier)}`);
            else if (ov?.scale && ov.scale !== 1) tags.push(`\\fs${Math.round(fontSize * ov.scale)}`);
            if (ov?.fontWeight && ov.fontWeight >= 700) tags.push('\\b1');

            parts.push(`{${tags.join('')}}${wordText}`);
            if (j < line.length - 1) parts.push(' \\h');
          }
          if (li < seg.lines.length - 1) parts.push('\\N');
        }
        return parts.join('');
      };

      // Generate dialogue lines for each emotional segment
      for (let si = 0; si < dhSegments.length; si++) {
        const seg = dhSegments[si];
        const segWordIndices = seg.lines.flat();
        const segWords = segWordIndices.map(idx => words[idx]);
        const segStart = getAbsoluteWordTime(subtitle, segWords[0], false);
        const segEnd = getAbsoluteWordTime(subtitle, segWords[segWords.length - 1], true);

        // Before first word in first segment: show in default color
        if (si === 0 && subtitle.startMs < segStart) {
          ass += `Dialogue: 0,${formatASSTime(subtitle.startMs)},${formatASSTime(segStart)},Default,,${dhMarginL},${dhMarginR},0,,${effectOverrideTags}${buildSegText(seg, null)}\n`;
        }

        // For each word in segment: highlight during its active period
        for (let wi = 0; wi < segWords.length; wi++) {
          const w = segWords[wi];
          const wStart = getAbsoluteWordTime(subtitle, w, false);
          const wEnd = getAbsoluteWordTime(subtitle, w, true);
          ass += `Dialogue: 0,${formatASSTime(wStart)},${formatASSTime(wEnd)},Default,,${dhMarginL},${dhMarginR},0,,${effectOverrideTags}${buildSegText(seg, w)}\n`;

          // Gap between this word and next
          if (wi < segWords.length - 1) {
            const nextStart = getAbsoluteWordTime(subtitle, segWords[wi + 1], false);
            if (wEnd < nextStart) {
              ass += `Dialogue: 0,${formatASSTime(wEnd)},${formatASSTime(nextStart)},Default,,${dhMarginL},${dhMarginR},0,,${effectOverrideTags}${buildSegText(seg, null)}\n`;
            }
          }
        }

        // Gap between segments
        if (si < dhSegments.length - 1) {
          const nextSegWords = dhSegments[si + 1].lines.flat().map(idx => words[idx]);
          const nextSegStart = getAbsoluteWordTime(subtitle, nextSegWords[0], false);
          if (segEnd < nextSegStart) {
            ass += `Dialogue: 0,${formatASSTime(segEnd)},${formatASSTime(nextSegStart)},Default,,${dhMarginL},${dhMarginR},0,,${effectOverrideTags}${buildSegText(seg, null)}\n`;
          }
        }
      }

      // After all segments: fill remaining subtitle duration
      if (dhSegments.length > 0) {
        const lastSeg = dhSegments[dhSegments.length - 1];
        const lastWords = lastSeg.lines.flat().map(idx => words[idx]);
        const lastEnd = getAbsoluteWordTime(subtitle, lastWords[lastWords.length - 1], true);
        if (lastEnd < subtitle.endMs) {
          ass += `Dialogue: 0,${formatASSTime(lastEnd)},${formatASSTime(subtitle.endMs)},Default,,${dhMarginL},${dhMarginR},0,,${effectOverrideTags}${buildSegText(lastSeg, null)}\n`;
        }
      }

    } else {
      // Phrase mode (default) — show wordsPerPhrase words at a time,
      // with the current word highlighted and others in base color.
      // Each windowed group is a separate dialogue block.

      const groups = windowWords(words, subtitle);

      for (const group of groups) {
        const gw = group.groupWords;

        // Helper: build phrase text for this group with one word optionally highlighted
        const buildGroupLine = (activeWordRef: any | null): string => {
          let text = '';
          for (let j = 0; j < gw.length; j++) {
            const w = gw[j];
            const isWordActive = w === activeWordRef;
            const ov = w.styleOverrides;
            const wordText = transformWordText(w);

            const tags: string[] = [];

            // Standard color: active word uses activeColor, inactive uses base color
            if (isWordActive) {
              const wordColor = ov?.activeColor
                ? hexToASSColor(ov.activeColor)
                : (ov?.color ? hexToASSColor(ov.color) : activeColor);
              tags.push(`\\c${wordColor}`);
            } else {
              const wordColor = ov?.color ? hexToASSColor(ov.color) : color;
              tags.push(`\\c${wordColor}`);
            }

            // Background: active word may have activeBackgroundColor or emphasisBg
            if (ov?.emphasisBg) {
              tags.push(`\\3c${hexToASSColor(ov.emphasisBg)}`);
            }

            // Font overrides (from per-word styleOverrides)
            if (ov?.fontFamily) {
              tags.push(`\\fn${resolveAvailableFontFamily(ov.fontFamily)}`);
            }
            if (ov?.fontSize) {
              tags.push(`\\fs${Math.round((ov.scale || 1) * ov.fontSize * fontSizeMultiplier)}`);
            } else if (ov?.scale && ov.scale !== 1) {
              tags.push(`\\fs${Math.round(fontSize * ov.scale)}`);
            }
            if (ov?.fontWeight && ov.fontWeight >= 700) {
              tags.push('\\b1');
            }
            if (ov?.letterSpacing != null) {
              tags.push(`\\fsp${ov.letterSpacing}`);
            }

            text += `{${tags.join('')}}${wordText}`;
            if (j < gw.length - 1) text += ' \\h';
          }
          return text;
        };

        // Generate time-sliced Dialogue lines for this group
        const groupFirstStart = group.startMs;
        const groupLastEnd = group.endMs;

        // Before first word in group: all words in default color
        const groupDisplayStart = (group === groups[0]) ? subtitle.startMs : groupFirstStart;
        if (groupFirstStart > groupDisplayStart) {
          ass += `Dialogue: 0,${formatASSTime(groupDisplayStart)},${formatASSTime(groupFirstStart)},Default,,0,0,0,,${effectOverrideTags}${buildGroupLine(null)}\n`;
        }

        for (let i = 0; i < gw.length; i++) {
          const wordStart = getAbsoluteWordTime(subtitle, gw[i], false);
          const wordEnd = getAbsoluteWordTime(subtitle, gw[i], true);

          ass += `Dialogue: 0,${formatASSTime(wordStart)},${formatASSTime(wordEnd)},Default,,0,0,0,,${effectOverrideTags}${buildGroupLine(gw[i])}\n`;

          if (i < gw.length - 1) {
            const nextWordStart = getAbsoluteWordTime(subtitle, gw[i + 1], false);
            if (wordEnd < nextWordStart) {
              ass += `Dialogue: 0,${formatASSTime(wordEnd)},${formatASSTime(nextWordStart)},Default,,0,0,0,,${effectOverrideTags}${buildGroupLine(null)}\n`;
            }
          }
        }

        if (getAbsoluteWordTime(subtitle, gw[gw.length - 1], true) < groupLastEnd) {
          ass += `Dialogue: 0,${formatASSTime(getAbsoluteWordTime(subtitle, gw[gw.length - 1], true))},${formatASSTime(groupLastEnd)},Default,,0,0,0,,${effectOverrideTags}${buildGroupLine(null)}\n`;
        }
      }

      // After all groups: fill remaining subtitle duration
      if (groups.length > 0) {
        const lastGroupEnd = groups[groups.length - 1].endMs;
        if (lastGroupEnd < subtitle.endMs) {
          const lastGroup = groups[groups.length - 1];
          const buildLastGroupLine = (): string => {
            let text = '';
            for (let j = 0; j < lastGroup.groupWords.length; j++) {
              const w = lastGroup.groupWords[j];
              const wordText = transformWordText(w);
              text += `{\\c${color}}${wordText}`;
              if (j < lastGroup.groupWords.length - 1) text += ' \\h';
            }
            return text;
          };
          ass += `Dialogue: 0,${formatASSTime(lastGroupEnd)},${formatASSTime(subtitle.endMs)},Default,,0,0,0,,${effectOverrideTags}${buildLastGroupLine()}\n`;
        }
      }
    }
  }

  // Log sample of generated ASS for debugging
  const assLines = ass.split('\n');
  const dialogueLines = assLines.filter(l => l.startsWith('Dialogue:')).slice(0, 3);
  logger.info({
    sampleDialogueLines: dialogueLines,
    activeColorUsed: activeColor,
    colorUsed: color,
  }, 'ASS dialogue sample');

  logger.info({
    fontFamily,
    fontSize,
    captionPosition,
    textAlign,
    offsetX,
    offsetY,
    rotation,
    marginL,
    marginR,
    marginV,
    mode,
    displayMode,
    textTransform,
    letterSpacing,
    lineHeight,
    scaleY,
    opacity,
    outline,
    borderStyle,
    shadowXShad,
    shadowYShad,
    shadowBlur,
    effectOverrideTags,
    effectiveHeight,
    subtitleCount: subtitles.length
  }, 'ASS subtitles generated with full styling and layout awareness');

  return ass;
}

/**
 * Encode video with subtitles burned in (no Remotion visuals).
 */
async function encodeVideoWithSubtitles(
  videoPath: string,
  audioPath: string | null,
  subtitles: SubtitleItem[],
  outputPath: string,
  workDir: string,
  canvasWidth: number = 1080,
  canvasHeight: number = 1920,
  fontsDir: string = escapePathForFilter(SYSTEM_FONTS_DIR),
  resolvedFontFamily?: string,
  fontSizeMultiplier: number = 1,
): Promise<void> {
  const { spawn } = await import('child_process');
  const { basename } = await import('path');
  const { writeFile, copyFile } = await import('fs/promises');

  // Copy video to working directory
  const localVideoPath = join(workDir, 'input.mp4');
  await copyFile(videoPath, localVideoPath);

  // Copy audio if provided
  let audioFilename: string | null = null;
  if (audioPath) {
    audioFilename = 'audio.m4a';
    await copyFile(audioPath, join(workDir, audioFilename));
  }

  // Generate ASS subtitles using actual canvas dimensions
  const assFilename = 'subtitles.ass';
  const assContent = generateASSForComposite(subtitles, canvasWidth, canvasHeight, undefined, resolvedFontFamily, fontSizeMultiplier);
  await writeFile(join(workDir, assFilename), assContent, 'utf-8');

  logger.info({ subtitleCount: subtitles.length, audioPath, fontSizeMultiplier }, 'Encoding video with subtitles');

  const args = [
    '-i', 'input.mp4',
  ];

  if (audioFilename) {
    args.push('-i', audioFilename);
  }

  args.push(
    '-y',
    '-vf', `subtitles=${assFilename}:fontsdir=${fontsDir}`,
  );

  if (audioFilename) {
    args.push('-map', '0:v', '-map', '1:a');
  }

  // Encoding: 'faster' preset balances quality and memory usage
  args.push(
    '-c:v', 'libx264',
    '-preset', 'faster',
    '-crf', '18',
    '-threads', '4',
    '-c:a', 'aac',
    '-shortest',
    basename(outputPath)
  );

  return new Promise((resolve, reject) => {
    logger.info({ cmd: `ffmpeg ${args.join(' ')}`, cwd: workDir }, 'FFmpeg subtitle encode started');

    const proc = spawn('ffmpeg', args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg subtitle encode completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg subtitle encode failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}
