import type { SubtitleItem } from '@viona/renderer';
import { classifyWordTier, computeEmotionalSegments } from '@viona/shared';
import type { MinimalWord } from '@viona/shared';
import { logger } from '../../logger.js';
import { resolveAvailableFontFamily } from './fonts.js';
import type { LayoutSettings } from './types.js';
import { PIP_SIZE_MAP } from './types.js';

export function convertToSubtitles(items: any[]): SubtitleItem[] {
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

export function formatASSTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

/**
 * Convert hex or rgba color to ASS color format (&HAABBGGRR)
 */
export function hexToASSColor(color: string): string {
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
export function getASSAlignment(position: string): number {
  switch (position) {
    case 'top': return 8;
    case 'middle': case 'center': return 5;
    case 'bottom': default: return 2;
  }
}

export function generateASSSubtitles(subtitles: any[], project: any): string {
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

/**
 * Generate ASS subtitles using style from subtitle data.
 * Matches frontend caption styling as closely as possible.
 * Adjusts positioning based on layout mode (PiP, stacked).
 * Supports word-by-word, phrase, and karaoke display modes.
 */
export function generateASSForComposite(subtitles: SubtitleItem[], width: number, height: number, layoutSettings?: LayoutSettings, fontFamilyOverride?: string, fontSizeMultiplier: number = 1): string {
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

  // Parse V2/V3 position system (object or legacy string)
  let captionPosition: string;
  let offsetX = 0;
  let offsetY = 0;
  let rotation = 0;
  let textAlign: string = 'center';
  let positionMode: 'anchor' | 'free' = 'anchor';
  let freeX = 50; // percentage 0-100
  let freeY = 85; // percentage 0-100
  let captionWidthPercent = 90; // percentage 20-100

  if (typeof firstStyle.position === 'object' && firstStyle.position !== null) {
    // V2/V3 position object
    captionPosition = firstStyle.position.anchor || 'bottom';
    offsetX = firstStyle.position.offsetX || 0;
    offsetY = firstStyle.position.offsetY || 0;
    rotation = firstStyle.position.rotation || 0;
    textAlign = firstStyle.position.textAlign || 'center';
    positionMode = firstStyle.position.mode === 'free' ? 'free' : 'anchor';
    freeX = firstStyle.position.x ?? 50;
    freeY = firstStyle.position.y ?? 85;
    captionWidthPercent = firstStyle.position.width ?? 90;
  } else {
    // Legacy string position
    captionPosition = firstStyle.position || 'bottom';
  }

  // Map textAlign to ASS alignment
  // ASS alignments: 1=bottom-left, 2=bottom-center, 3=bottom-right
  //                 4=middle-left, 5=middle-center, 6=middle-right
  //                 7=top-left, 8=top-center, 9=top-right
  let alignment: number;
  if (positionMode === 'free') {
    // For free mode with \pos override, use middle-row alignment (4/5/6)
    // so the anchor point is at the center of the text block
    const alignCol = textAlign === 'left' ? 4 : textAlign === 'right' ? 6 : 5;
    alignment = alignCol;
  } else {
    const alignCol = textAlign === 'left' ? 1 : textAlign === 'right' ? 3 : 2;
    const alignRow = captionPosition === 'top' ? 6 : (captionPosition === 'center' || captionPosition === 'middle') ? 3 : 0;
    alignment = alignRow + alignCol;
  }

  // Free mode: compute pixel position for \pos(x,y) override tag
  let freePosTag = '';
  if (positionMode === 'free') {
    const posXPx = Math.round(freeX * width / 100);
    const posYPx = Math.round(freeY * height / 100);
    freePosTag = `\\pos(${posXPx},${posYPx})`;
  }

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

  // Calculate margins
  let marginV: number;
  let marginL: number;
  let marginR: number;

  if (positionMode === 'free') {
    // In free mode, margins control text wrapping width, not position
    // \pos() handles the actual position
    marginV = 0;
    const captionWidthPx = Math.round(captionWidthPercent * width / 100);
    const sideMargin = Math.round((width - captionWidthPx) / 2);
    marginL = Math.max(0, sideMargin);
    marginR = Math.max(0, sideMargin);
  } else {
    // Anchor mode: existing margin-based positioning
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

    // Calculate horizontal margins based on offsetX and width
    const offsetXPixels = Math.round(offsetX * width / 100);
    const captionWidthPx = Math.round(captionWidthPercent * width / 100);
    const baseHMargin = Math.round((width - captionWidthPx) / 2);
    marginL = Math.max(0, baseHMargin + offsetXPixels);
    marginR = Math.max(0, baseHMargin - offsetXPixels);
  }

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
  // In free mode, also includes \pos(x,y) for absolute positioning.
  const effectOverrideParts: string[] = [];
  if (freePosTag) effectOverrideParts.push(freePosTag);
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

  // ── Dynamic hierarchy (word classification imported from @viona/shared) ──
  const isDynamicHierarchy = firstStyle.presetId === 'dynamic-hierarchy';

  // Helper: build ASS inline override tags from per-word styleOverrides.
  // Only apply when using dynamic hierarchy — baked overrides must not leak.
  const buildWordOverrideTags = (word: any, isActive: boolean): string => {
    if (!isDynamicHierarchy) return '';
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
    if (!isDynamicHierarchy) return '';
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

  // Helper: apply per-word textTransform (only for dynamic hierarchy preset)
  const transformWordText = (word: any): string => {
    const text = word.text || '';
    if (isDynamicHierarchy) {
      const ov = word.styleOverrides;
      if (ov?.textTransform === 'uppercase') return text.toUpperCase();
      if (ov?.textTransform === 'lowercase') return text.toLowerCase();
    }
    return applyTextTransform(text);
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
          // Reset after overridden word so next word uses defaults (DH only)
          if (isDynamicHierarchy && i < group.groupWords.length - 1) {
            karaokeText += buildResetTags(word);
            karaokeText += buildDynamicHierarchyReset(word);
          }
          if (i < group.groupWords.length - 1) karaokeText += ' \\h';
        }
        ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${effectOverrideTags}${karaokeText}\n`;
      }
    } else if (isDynamicHierarchy) {
      // ── Dynamic hierarchy: emotional segmentation (shared with preview) ──
      // Map worker words to MinimalWord for the shared algorithm
      const minimalWords: MinimalWord[] = words.map((w: any) => ({
        text: w.text || '',
        startMs: getAbsoluteWordTime(subtitle, w, false),
        endMs: getAbsoluteWordTime(subtitle, w, true),
      }));
      const dhSegments = computeEmotionalSegments(minimalWords);

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

        // Helper: build phrase text for this group with one word optionally highlighted.
        // Per-word styleOverrides are NOT applied here — they only apply in DH mode.
        const buildGroupLine = (activeWordRef: any | null): string => {
          let text = '';
          for (let j = 0; j < gw.length; j++) {
            const w = gw[j];
            const isWordActive = w === activeWordRef;
            const wordText = transformWordText(w);

            const tags: string[] = [];
            tags.push(`\\c${isWordActive ? activeColor : color}`);

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
