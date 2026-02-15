/**
 * Color analysis & contrast utilities for auto-selecting caption colors
 * that contrast well against the video background.
 */

// ============================================
// Types
// ============================================

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface ColorPalette {
  name: string;
  color: string;
  activeColor: string;
}

// ============================================
// Quick Color Palettes (static, curated)
// ============================================

export const QUICK_COLOR_PALETTES: ColorPalette[] = [
  { name: 'Classic White', color: '#ffffff', activeColor: '#ffffff' },
  { name: 'Yellow Pop', color: '#ffffff', activeColor: '#ffff00' },
  { name: 'Green Energy', color: '#ffffff', activeColor: '#00ff00' },
  { name: 'Cyan Electric', color: '#ffffff', activeColor: '#00e5ff' },
  { name: 'Pink Glow', color: '#ffffff', activeColor: '#f0abfc' },
  { name: 'Warm Amber', color: '#ffffff', activeColor: '#fbbf24' },
  { name: 'Dark Mode', color: '#1a1a1a', activeColor: '#000000' },
  { name: 'Neon Duo', color: '#00ffff', activeColor: '#ff00ff' },
];

// ============================================
// sRGB Linearization
// ============================================

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// ============================================
// Luminance & Contrast
// ============================================

export function getLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function getContrastRatio(fg: string, bg: string): number {
  const fgRgb = hexToRgb(fg);
  const bgRgb = hexToRgb(bg);
  const l1 = getLuminance(fgRgb.r, fgRgb.g, fgRgb.b);
  const l2 = getLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ============================================
// Hex / RGB conversions
// ============================================

function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ============================================
// HSL helpers
// ============================================

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

// ============================================
// Video Frame Sampling
// ============================================

export async function sampleVideoFrame(
  videoSrc: string,
  timeMs: number,
  region: 'bottom' | 'center' | 'full' = 'bottom'
): Promise<RGB> {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.preload = 'metadata';

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load video for color sampling'));
    video.src = videoSrc;
  });

  const seekTime = Math.min(timeMs / 1000, video.duration - 0.1);
  video.currentTime = Math.max(0, seekTime);

  await new Promise<void>((resolve) => {
    video.onseeked = () => resolve();
  });

  // Draw frame to offscreen canvas
  const w = video.videoWidth;
  const h = video.videoHeight;
  const offscreen = new OffscreenCanvas(w, h);
  const ctx = offscreen.getContext('2d')!;
  ctx.drawImage(video, 0, 0, w, h);

  // Determine sample region
  let startY = 0;
  let regionHeight = h;
  if (region === 'bottom') {
    startY = Math.floor(h * 0.75);
    regionHeight = h - startY;
  } else if (region === 'center') {
    startY = Math.floor(h * 0.375);
    regionHeight = Math.floor(h * 0.25);
  }

  const imageData = ctx.getImageData(0, startY, w, regionHeight);
  const data = imageData.data;

  // Average color — sample every 4th pixel for speed
  let totalR = 0, totalG = 0, totalB = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 16) {
    totalR += data[i];
    totalG += data[i + 1];
    totalB += data[i + 2];
    count++;
  }

  return {
    r: Math.round(totalR / count),
    g: Math.round(totalG / count),
    b: Math.round(totalB / count),
  };
}

// ============================================
// Generate Caption Colors from Background
// ============================================

export function generateCaptionColors(bgColor: RGB): ColorPalette[] {
  const bgLum = getLuminance(bgColor.r, bgColor.g, bgColor.b);
  const isDark = bgLum < 0.5;

  const [bgHue] = rgbToHsl(bgColor.r, bgColor.g, bgColor.b);

  // Base text color: white on dark backgrounds, dark on light backgrounds
  const baseColor = isDark ? '#ffffff' : '#1a1a1a';
  const baseRgb = hexToRgb(baseColor);

  // Generate active color candidates at various hue offsets
  const hueOffsets = [0, 60, 120, 180];
  const palettes: ColorPalette[] = [];

  for (const offset of hueOffsets) {
    const hue = (bgHue + offset + 180) % 360; // Start opposite the background hue
    const saturation = 0.9;
    const lightness = isDark ? 0.65 : 0.4;

    const [r, g, b] = hslToRgb(hue, saturation, lightness);
    const activeHex = rgbToHex(r, g, b);

    // Check contrast of active color against the video background
    const activeLum = getLuminance(r, g, b);
    const bgContrastActive =
      (Math.max(activeLum, bgLum) + 0.05) / (Math.min(activeLum, bgLum) + 0.05);

    // Check contrast of active color against the base text color
    const baseLum = getLuminance(baseRgb.r, baseRgb.g, baseRgb.b);
    const textContrastActive =
      (Math.max(activeLum, baseLum) + 0.05) / (Math.min(activeLum, baseLum) + 0.05);

    // Only include if both contrasts are reasonable
    if (bgContrastActive >= 3.0 && textContrastActive >= 1.5) {
      const names = ['Contrast', 'Complement', 'Triadic', 'Split'];
      palettes.push({
        name: names[hueOffsets.indexOf(offset)] ?? 'Variant',
        color: baseColor,
        activeColor: activeHex,
      });
    }
  }

  // Fallback: always include a high-contrast safe palette
  if (palettes.length === 0) {
    palettes.push({
      name: 'High Contrast',
      color: isDark ? '#ffffff' : '#1a1a1a',
      activeColor: isDark ? '#ffff00' : '#0000ff',
    });
  }

  // Add a pure base (no distinct active color) as last option
  palettes.push({
    name: isDark ? 'Pure White' : 'Pure Dark',
    color: baseColor,
    activeColor: baseColor,
  });

  return palettes.slice(0, 4);
}
