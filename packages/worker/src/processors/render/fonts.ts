import { access, constants, readFile, writeFile, readdir, stat, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { logger } from '../../logger.js';
import { escapePathForFilter } from './types.js';

// Font directory for FFmpeg's libass subtitle filter.
// In Docker (production), fonts are installed in /usr/share/fonts.
// Locally, we download and cache Google Fonts to a local directory.
export const SYSTEM_FONTS_DIR = '/usr/share/fonts';
export const LOCAL_FONTS_CACHE = join(tmpdir(), 'clippify-fonts');

// Google Fonts CSS API query strings for each font.
// We fetch the CSS with a non-browser User-Agent to get TTF URLs from fonts.gstatic.com,
// then download the individual TTF files directly.
// NOTE: The old fonts.google.com/download?family=X URLs are BROKEN — they return HTML
// instead of ZIP files. This CSS API approach is the reliable alternative.
export const GOOGLE_FONT_URLS: Record<string, string> = {
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
export const FONT_FALLBACKS: Record<string, string> = {
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
export const downloadedFonts = new Set<string>();

/**
 * Resolve a font family name to one that's actually available for FFmpeg.
 * Walks the comma-separated list and returns the first available font,
 * checking Google Fonts registry and fallback map.
 */
export function resolveAvailableFontFamily(fontFamilyCSS: string): string {
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
export async function downloadFont(fontFamily: string): Promise<boolean> {
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
export async function readTTFMetrics(ttfPath: string): Promise<{ unitsPerEm: number; usWinAscent: number; usWinDescent: number } | null> {
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
export async function getASSFontSizeMultiplier(fontFamily: string, fontsDir: string): Promise<number> {
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
export async function ensureFontsDir(fontFamilyCSS: string): Promise<string> {
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

/**
 * Scan bundled JS files for references to known Google Fonts.
 * Returns the list of font names found in the bundle.
 */
export async function detectFontsInBundle(bundlePath: string): Promise<string[]> {
  const assetsDir = join(bundlePath, 'assets');
  let jsFiles: string[] = [];

  try {
    const entries = await readdir(assetsDir);
    jsFiles = entries.filter(f => f.endsWith('.js')).map(f => join(assetsDir, f));
  } catch {
    // No assets dir — try flat bundle
    try {
      const entries = await readdir(bundlePath);
      jsFiles = entries.filter(f => f.endsWith('.js')).map(f => join(bundlePath, f));
    } catch {
      logger.warn({ bundlePath }, 'Could not read bundle directory for font detection, skipping');
      return [];
    }
  }

  if (jsFiles.length === 0) return [];

  // Concatenate all JS content
  const chunks = await Promise.all(jsFiles.map(f => readFile(f, 'utf-8')));
  const allJs = chunks.join('\n');

  const matched: string[] = [];
  for (const fontName of Object.keys(GOOGLE_FONT_URLS)) {
    // Match as quoted string literals to avoid substring false positives
    // (e.g. "Inter" must not match "interpolate")
    if (allJs.includes(`"${fontName}"`) || allJs.includes(`'${fontName}'`)) {
      matched.push(fontName);
    }
  }

  return matched;
}

/**
 * Inject Google Fonts <link> tags into the bundle's index.html so headless
 * Chromium loads them during renderMedia().
 */
export async function injectGoogleFontsIntoBundle(bundlePath: string, fonts: string[]): Promise<void> {
  if (fonts.length === 0) return;

  const indexPath = join(bundlePath, 'index.html');
  let html = await readFile(indexPath, 'utf-8');

  // Skip if already injected (idempotency for retries)
  if (html.includes('fonts.googleapis.com')) return;

  const linkTags = fonts.map(font => {
    const query = GOOGLE_FONT_URLS[font];
    return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${query}&display=swap">`;
  }).join('\n    ');

  html = html.replace('</head>', `    ${linkTags}\n  </head>`);
  await writeFile(indexPath, html, 'utf-8');

  logger.info({ fonts, count: fonts.length }, 'Injected Google Font links into bundle index.html');
}
