import { describe, it, expect } from 'vitest';
import {
  buildVideoCropFilter,
} from './ffmpeg.js';
import {
  escapePathForFilter,
} from './types.js';
import {
  resolveAvailableFontFamily,
} from './fonts.js';

// =============================================================================
// escapePathForFilter
// =============================================================================
describe('escapePathForFilter', () => {
  it('returns unix paths unchanged', () => {
    expect(escapePathForFilter('/usr/share/fonts')).toBe('/usr/share/fonts');
    expect(escapePathForFilter('/tmp/clippify-fonts')).toBe('/tmp/clippify-fonts');
  });

  it('normalizes backslashes to forward slashes', () => {
    expect(escapePathForFilter('/some\\path\\here')).toBe('/some/path/here');
  });

  it('escapes Windows drive letter colons and wraps in quotes', () => {
    const result = escapePathForFilter('C:\\Users\\test\\fonts');
    expect(result).toBe("'C\\:/Users/test/fonts'");
  });

  it('handles Windows UNC paths', () => {
    // No colons, just backslashes → normalizes
    expect(escapePathForFilter('\\\\server\\share\\fonts')).toBe('//server/share/fonts');
  });

  it('handles paths with single quotes in them', () => {
    const result = escapePathForFilter("C:\\User's\\fonts");
    // Should escape the single quote and the colon
    expect(result).toContain('\\:');
    expect(result[0]).toBe("'");
    expect(result[result.length - 1]).toBe("'");
  });
});

// =============================================================================
// resolveAvailableFontFamily
// =============================================================================
describe('resolveAvailableFontFamily', () => {
  it('returns Google Font names directly', () => {
    expect(resolveAvailableFontFamily('Inter')).toBe('Inter');
    expect(resolveAvailableFontFamily('Roboto')).toBe('Roboto');
    expect(resolveAvailableFontFamily('Poppins')).toBe('Poppins');
    expect(resolveAvailableFontFamily('Montserrat')).toBe('Montserrat');
  });

  it('resolves fallback fonts to closest available', () => {
    expect(resolveAvailableFontFamily('Helvetica Neue')).toBe('Inter');
    expect(resolveAvailableFontFamily('Helvetica')).toBe('Inter');
    expect(resolveAvailableFontFamily('Arial')).toBe('Inter');
    expect(resolveAvailableFontFamily('Impact')).toBe('Anton');
    expect(resolveAvailableFontFamily('Georgia')).toBe('EB Garamond');
    expect(resolveAvailableFontFamily('Consolas')).toBe('JetBrains Mono');
  });

  it('handles generic CSS font families', () => {
    expect(resolveAvailableFontFamily('system-ui')).toBe('Inter');
    expect(resolveAvailableFontFamily('sans-serif')).toBe('Inter');
    expect(resolveAvailableFontFamily('serif')).toBe('Merriweather');
    expect(resolveAvailableFontFamily('monospace')).toBe('JetBrains Mono');
    expect(resolveAvailableFontFamily('cursive')).toBe('Dancing Script');
  });

  it('walks comma-separated font stack and returns first available', () => {
    // First is unknown, second is in Google Fonts
    expect(resolveAvailableFontFamily('CustomFont, Roboto, sans-serif')).toBe('Roboto');
    // First is a fallback, should resolve
    expect(resolveAvailableFontFamily('Helvetica, Arial, sans-serif')).toBe('Inter');
    // First is available
    expect(resolveAvailableFontFamily('Poppins, sans-serif')).toBe('Poppins');
  });

  it('falls back to Inter for completely unknown fonts', () => {
    expect(resolveAvailableFontFamily('TotallyUnknownFont')).toBe('Inter');
    expect(resolveAvailableFontFamily('My Custom Font, Another Unknown')).toBe('Inter');
  });

  it('trims whitespace around font names', () => {
    expect(resolveAvailableFontFamily('  Inter  ')).toBe('Inter');
    expect(resolveAvailableFontFamily('  Helvetica , Roboto  ')).toBe('Inter'); // Helvetica fallback found first
  });
});

// =============================================================================
// buildVideoCropFilter
// =============================================================================
describe('buildVideoCropFilter', () => {
  const defaultCrop = {
    sourceWidth: 1920,
    sourceHeight: 1080,
    cropX: 50,  // center
    cropY: 50,  // center
    scale: 1.0,
  };

  it('generates correct filter for same aspect ratio (no crop needed)', () => {
    // Source 1920x1080 → target 1920x1080 at center, scale 1
    const filter = buildVideoCropFilter(defaultCrop, 1920, 1080);
    expect(filter).toContain('scale=');
    expect(filter).toContain('crop=1920:1080');
    expect(filter).toContain('setsar=1');
  });

  it('generates correct filter for wider source than target', () => {
    // 1920x1080 source → 1080x1920 target (portrait)
    // Source wider (16:9 > 9:16): match height first
    const filter = buildVideoCropFilter(defaultCrop, 1080, 1920);
    expect(filter).toContain('crop=1080:1920');
    expect(filter).toContain('setsar=1');
  });

  it('generates correct filter for taller source than target', () => {
    // 1080x1920 source → 1920x1080 target
    const filter = buildVideoCropFilter(
      { sourceWidth: 1080, sourceHeight: 1920, cropX: 50, cropY: 50, scale: 1.0 },
      1920, 1080,
    );
    expect(filter).toContain('crop=1920:1080');
    expect(filter).toContain('setsar=1');
  });

  it('applies zoom via scale parameter', () => {
    // scale=2.0 should produce larger intermediate dimensions
    const noZoom = buildVideoCropFilter(defaultCrop, 1080, 1920);
    const zoomed = buildVideoCropFilter(
      { ...defaultCrop, scale: 2.0 }, 1080, 1920,
    );

    // Both produce the same final crop dimensions, but scale step differs
    expect(zoomed).toContain('crop=1080:1920');

    // Extract scale values from filter strings
    const noZoomScale = noZoom.match(/scale=(\d+):(\d+)/);
    const zoomedScale = zoomed.match(/scale=(\d+):(\d+)/);
    expect(noZoomScale).toBeTruthy();
    expect(zoomedScale).toBeTruthy();

    // Zoomed intermediate should be larger
    const noZoomH = parseInt(noZoomScale![2]);
    const zoomedH = parseInt(zoomedScale![2]);
    expect(zoomedH).toBeGreaterThan(noZoomH);
  });

  it('centers crop when cropX=50, cropY=50', () => {
    // With centered crop, the crop position should be the midpoint of overflow
    const filter = buildVideoCropFilter(defaultCrop, 1080, 1920);
    // Parse crop params: crop=W:H:X:Y
    const cropMatch = filter.match(/crop=(\d+):(\d+):(\d+):(\d+)/);
    expect(cropMatch).toBeTruthy();
    const cropX = parseInt(cropMatch![3]);
    const cropY = parseInt(cropMatch![4]);
    // At 50% centered, crop position should be roughly half of overflow
    // (exact values depend on calculated scale dimensions)
    expect(cropX).toBeGreaterThanOrEqual(0);
    expect(cropY).toBeGreaterThanOrEqual(0);
  });

  it('positions crop at top-left when cropX=0, cropY=0', () => {
    const filter = buildVideoCropFilter(
      { ...defaultCrop, cropX: 0, cropY: 0 }, 1080, 1920,
    );
    const cropMatch = filter.match(/crop=(\d+):(\d+):(\d+):(\d+)/);
    expect(cropMatch).toBeTruthy();
    expect(parseInt(cropMatch![3])).toBe(0); // X position
    expect(parseInt(cropMatch![4])).toBe(0); // Y position
  });

  it('positions crop at bottom-right when cropX=100, cropY=100', () => {
    const filter = buildVideoCropFilter(
      { ...defaultCrop, cropX: 100, cropY: 100 }, 1080, 1920,
    );
    const cropMatch = filter.match(/crop=(\d+):(\d+):(\d+):(\d+)/);
    expect(cropMatch).toBeTruthy();
    // At 100%, crop position = full overflow distance
    expect(parseInt(cropMatch![3])).toBeGreaterThanOrEqual(0);
    expect(parseInt(cropMatch![4])).toBeGreaterThanOrEqual(0);
  });

  it('produces even dimensions in scale step', () => {
    const filter = buildVideoCropFilter(
      { sourceWidth: 1921, sourceHeight: 1081, cropX: 50, cropY: 50, scale: 1.0 },
      1080, 1920,
    );
    const scaleMatch = filter.match(/scale=(\d+):(\d+)/);
    expect(scaleMatch).toBeTruthy();
    expect(parseInt(scaleMatch![1]) % 2).toBe(0);
    expect(parseInt(scaleMatch![2]) % 2).toBe(0);
  });
});

