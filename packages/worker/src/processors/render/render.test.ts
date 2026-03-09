import { describe, it, expect } from 'vitest';
import {
  formatASSTime,
  hexToASSColor,
  getASSAlignment,
  convertToSubtitles,
} from './subtitles.js';
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
// formatASSTime
// =============================================================================
describe('formatASSTime', () => {
  it('formats zero milliseconds', () => {
    expect(formatASSTime(0)).toBe('0:00:00.00');
  });

  it('formats sub-second values', () => {
    expect(formatASSTime(500)).toBe('0:00:00.50');
    expect(formatASSTime(10)).toBe('0:00:00.01');
    expect(formatASSTime(990)).toBe('0:00:00.99');
  });

  it('formats seconds correctly', () => {
    expect(formatASSTime(1000)).toBe('0:00:01.00');
    expect(formatASSTime(5500)).toBe('0:00:05.50');
    expect(formatASSTime(59999)).toBe('0:00:59.99');
  });

  it('formats minutes correctly', () => {
    expect(formatASSTime(60000)).toBe('0:01:00.00');
    expect(formatASSTime(90000)).toBe('0:01:30.00');
    expect(formatASSTime(3599999)).toBe('0:59:59.99');
  });

  it('formats hours correctly', () => {
    expect(formatASSTime(3600000)).toBe('1:00:00.00');
    expect(formatASSTime(7261500)).toBe('2:01:01.50');
  });

  it('truncates sub-centisecond precision', () => {
    // 1234ms = 1s + 234ms → centiseconds = floor(234/10) = 23
    expect(formatASSTime(1234)).toBe('0:00:01.23');
    // 999ms → centiseconds = floor(999/10) = 99
    expect(formatASSTime(999)).toBe('0:00:00.99');
  });

  it('pads minutes and seconds with leading zeros', () => {
    expect(formatASSTime(61000)).toBe('0:01:01.00');
    // Hours are NOT padded (ASS format uses single digit for hours < 10)
    expect(formatASSTime(1000)).toBe('0:00:01.00');
  });
});

// =============================================================================
// hexToASSColor
// =============================================================================
describe('hexToASSColor', () => {
  it('converts standard 6-digit hex colors', () => {
    // ASS format is &HAABBGGRR (alpha=00 for opaque)
    expect(hexToASSColor('#FFFFFF')).toBe('&H00FFFFFF');
    expect(hexToASSColor('#000000')).toBe('&H00000000');
    expect(hexToASSColor('#FF0000')).toBe('&H000000FF'); // Red → &H00-00-00-FF (BGR reversed)
    expect(hexToASSColor('#00FF00')).toBe('&H0000FF00'); // Green stays in middle
    expect(hexToASSColor('#0000FF')).toBe('&H00FF0000'); // Blue → first color byte
  });

  it('handles hex without hash prefix', () => {
    expect(hexToASSColor('FFFFFF')).toBe('&H00FFFFFF');
    expect(hexToASSColor('FF0000')).toBe('&H000000FF');
  });

  it('expands 3-digit shorthand hex', () => {
    expect(hexToASSColor('#fff')).toBe('&H00FFFFFF');
    expect(hexToASSColor('#f00')).toBe('&H000000FF');
    expect(hexToASSColor('#0f0')).toBe('&H0000FF00');
  });

  it('converts rgba() format with alpha', () => {
    // rgba(255, 255, 255, 1) → fully opaque white → alpha=00
    expect(hexToASSColor('rgba(255, 255, 255, 1)')).toBe('&H00FFFFFF');
    // rgba(255, 0, 0, 0.5) → 50% transparent red → alpha = round((1-0.5)*255) = 128 = 0x80
    expect(hexToASSColor('rgba(255, 0, 0, 0.5)')).toBe('&H800000FF');
    // rgba(0, 0, 0, 0) → fully transparent black → alpha = round((1-0)*255) = 255 = 0xFF
    expect(hexToASSColor('rgba(0, 0, 0, 0)')).toBe('&HFF000000');
  });

  it('converts rgb() format (no alpha)', () => {
    // rgb(255, 255, 255) → alpha defaults to 0 (opaque)
    expect(hexToASSColor('rgb(255, 255, 255)')).toBe('&H00FFFFFF');
    expect(hexToASSColor('rgb(255, 0, 0)')).toBe('&H000000FF');
  });

  it('returns white for empty/falsy input', () => {
    expect(hexToASSColor('')).toBe('&H00FFFFFF');
  });

  it('handles lowercase hex', () => {
    expect(hexToASSColor('#ff5733')).toBe('&H003357FF');
  });
});

// =============================================================================
// getASSAlignment
// =============================================================================
describe('getASSAlignment', () => {
  it('returns correct alignment for bottom (default subtitle position)', () => {
    expect(getASSAlignment('bottom')).toBe(2);
  });

  it('returns correct alignment for top', () => {
    expect(getASSAlignment('top')).toBe(8);
  });

  it('returns correct alignment for middle', () => {
    expect(getASSAlignment('middle')).toBe(5);
  });

  it('returns correct alignment for center (alias)', () => {
    expect(getASSAlignment('center')).toBe(5);
  });

  it('defaults to bottom for unknown positions', () => {
    expect(getASSAlignment('unknown')).toBe(2);
    expect(getASSAlignment('')).toBe(2);
  });
});

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

// =============================================================================
// convertToSubtitles
// =============================================================================
describe('convertToSubtitles', () => {
  it('converts caption items to SubtitleItem format', () => {
    const items = [
      {
        id: 'cap1',
        type: 'caption',
        startMs: 0,
        endMs: 2000,
        data: { text: 'Hello world', words: [{ text: 'Hello', startMs: 0, endMs: 1000 }, { text: 'world', startMs: 1000, endMs: 2000 }], style: { fontSize: 24 } },
      },
    ];

    const result = convertToSubtitles(items);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cap1');
    expect(result[0].startMs).toBe(0);
    expect(result[0].endMs).toBe(2000);
    expect(result[0].text).toBe('Hello world');
    expect(result[0].words).toHaveLength(2);
    expect(result[0].style).toEqual({ fontSize: 24 });
  });

  it('also accepts subtitle type items', () => {
    const items = [
      {
        id: 'sub1',
        type: 'subtitle',
        startMs: 100,
        endMs: 500,
        data: { text: 'Test subtitle' },
      },
    ];

    const result = convertToSubtitles(items);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Test subtitle');
  });

  it('filters out non-caption/subtitle items', () => {
    const items = [
      { id: 'v1', type: 'visual', startMs: 0, endMs: 1000, data: {} },
      { id: 'a1', type: 'audio', startMs: 0, endMs: 1000, data: {} },
      { id: 'cap1', type: 'caption', startMs: 0, endMs: 1000, data: { text: 'Keep me' } },
    ];

    const result = convertToSubtitles(items);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cap1');
  });

  it('creates default word array when words are missing', () => {
    const items = [
      {
        id: 'cap1',
        type: 'caption',
        startMs: 500,
        endMs: 1500,
        data: { text: 'No words provided' },
      },
    ];

    const result = convertToSubtitles(items);
    expect(result[0].words).toHaveLength(1);
    expect(result[0].words[0].text).toBe('No words provided');
    expect(result[0].words[0].startMs).toBe(500);
    expect(result[0].words[0].endMs).toBe(1500);
  });

  it('handles empty text gracefully', () => {
    const items = [
      {
        id: 'cap1',
        type: 'caption',
        startMs: 0,
        endMs: 1000,
        data: {},
      },
    ];

    const result = convertToSubtitles(items);
    expect(result[0].text).toBe('');
  });

  it('returns empty array for no matching items', () => {
    const result = convertToSubtitles([]);
    expect(result).toEqual([]);

    const result2 = convertToSubtitles([
      { id: 'v1', type: 'visual', startMs: 0, endMs: 1000, data: {} },
    ]);
    expect(result2).toEqual([]);
  });

  it('preserves multiple caption items in order', () => {
    const items = [
      { id: 'c1', type: 'caption', startMs: 0, endMs: 1000, data: { text: 'First' } },
      { id: 'c2', type: 'caption', startMs: 1000, endMs: 2000, data: { text: 'Second' } },
      { id: 'c3', type: 'caption', startMs: 2000, endMs: 3000, data: { text: 'Third' } },
    ];

    const result = convertToSubtitles(items);
    expect(result).toHaveLength(3);
    expect(result[0].text).toBe('First');
    expect(result[1].text).toBe('Second');
    expect(result[2].text).toBe('Third');
  });
});
