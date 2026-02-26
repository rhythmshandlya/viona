import React, { useMemo } from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export interface TranscriptWord {
  text: string;
  startMs: number;
  endMs: number;
  /** Force a specific tier override */
  tier?: WordTier;
}

export type WordTier = 'power' | 'medium' | 'filler';

type LayoutType = 'center' | 'left' | 'stacked' | 'impact';
type EntranceType = 'slideUp' | 'pop' | 'fadeRise' | 'slideLeft' | 'dropIn';

interface ClassifiedWord extends TranscriptWord {
  tier: WordTier;
}

interface Segment {
  words: ClassifiedWord[];
  startMs: number;
  endMs: number;
  layout: LayoutType;
  entrance: EntranceType;
}

export interface DynamicSubtitlesProps {
  words: TranscriptWord[];
  startMs: number;
  endMs: number;
  /** Primary text color */
  textColor?: string;
  /** Highlight for power words (yellow) */
  accentPrimary?: string;
  /** Secondary highlight (neon green) */
  accentSecondary?: string;
  fontFamily?: string;
  /** Base font size — power words scale 2x-2.5x from this */
  baseFontSize?: number;
  /** Fade-out duration in ms */
  fadeOutMs?: number;
}

// ═══════════════════════════════════════════════════════════════════════
// 1. WORD CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════

const POWER_WORDS = new Set([
  // Emotion
  'amazing', 'insane', 'incredible', 'unbelievable', 'obsessed', 'crazy',
  'shocking', 'massive', 'epic', 'wild', 'brutal', 'terrifying', 'perfect',
  'beautiful', 'disgusting', 'horrible', 'awesome', 'worst', 'best',
  'love', 'hate', 'killed', 'dead', 'die', 'destroy', 'explode',
  'impossible', 'legendary', 'genius', 'stupid', 'sick', 'fire',
  'goat', 'god', 'broken', 'rigged', 'scam', 'real', 'fake',
  // Urgency
  'now', 'today', 'never', 'always', 'stop', 'wait', 'listen',
  'watch', 'warning', 'urgent', 'finally', 'immediately', 'forever',
  // Contrast
  'but', 'however', 'instead', 'actually', 'wrong', 'right', 'except',
  'versus', 'only', 'literally', 'secretly', 'nobody', 'everybody',
  'everything', 'nothing',
  // Money / Scale
  'million', 'billion', 'thousand', 'money', 'rich', 'broke', 'free',
  'expensive', 'cheap', 'profit', 'revenue', 'dollars', 'paid',
  'zero', 'double', 'triple', 'hundred', 'percent',
  // Impact
  'why', 'how', 'what', 'biggest', 'smallest', 'fastest', 'first',
  'last', 'most', 'least', 'every', 'single', 'guaranteed',
]);

const FILLER_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'it', 'its',
  'that', 'this', 'with', 'as', 'by', 'from', 'up', 'so', 'if',
  'not', 'no', 'do', 'does', 'did', 'has', 'had', 'have', 'will',
  'can', 'could', 'would', 'should', 'may', 'might', 'just', 'also',
  'very', 'really', 'like', 'about', 'than', 'then', 'them', 'they',
  'we', 'he', 'she', 'you', 'i', 'me', 'my', 'your', 'our',
  'his', 'her', 'their', 'some', 'all', 'more', 'out', 'into',
]);

function classifyWord(word: TranscriptWord): ClassifiedWord {
  if (word.tier) return { ...word, tier: word.tier };

  const clean = word.text.toLowerCase().replace(/[^a-z0-9$]/g, '');

  // Numbers and dollar amounts are always power words
  if (/^\$?\d/.test(clean) || /\d+[kmb]$/i.test(clean)) {
    return { ...word, tier: 'power' };
  }

  // ALL-CAPS words with 3+ chars are power words (speaker emphasis)
  if (word.text.length >= 3 && word.text === word.text.toUpperCase() && /[A-Z]/.test(word.text)) {
    return { ...word, tier: 'power' };
  }

  if (POWER_WORDS.has(clean)) return { ...word, tier: 'power' };
  if (FILLER_WORDS.has(clean)) return { ...word, tier: 'filler' };
  return { ...word, tier: 'medium' };
}

// ═══════════════════════════════════════════════════════════════════════
// 2. EMOTIONAL SEGMENTATION
// ═══════════════════════════════════════════════════════════════════════

/** Deterministic hash for segment index → layout/animation selection */
function deterministicChoice<T>(options: T[], index: number, salt: number): T {
  const hash = ((index * 2654435761 + salt) >>> 0) % options.length;
  return options[hash];
}

const GAP_THRESHOLD_MS = 250; // Timing gap that forces a segment break
const MAX_SEGMENT_WORDS = 5;
const MIN_SEGMENT_WORDS = 1;

function buildSegments(words: ClassifiedWord[]): Segment[] {
  const segments: Segment[] = [];
  let current: ClassifiedWord[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prev = i > 0 ? words[i - 1] : null;
    const gap = prev ? word.startMs - prev.endMs : 0;

    // Break conditions:
    // 1. Timing gap exceeds threshold (natural pause)
    const hasTimingGap = gap > GAP_THRESHOLD_MS;

    // 2. Current segment is full
    const isFull = current.length >= MAX_SEGMENT_WORDS;

    // 3. Power word isolation: if this is a power word and we already have
    //    2+ words, break before it so it leads the next segment
    const isolatePower = word.tier === 'power' && current.length >= 2;

    // 4. Power word just appeared and next word is filler — keep the punch
    //    by breaking after the power word
    const prevWasPower = current.length > 0 &&
      current[current.length - 1].tier === 'power' &&
      word.tier === 'filler' &&
      current.length >= 2;

    if ((hasTimingGap || isFull || isolatePower || prevWasPower) && current.length >= MIN_SEGMENT_WORDS) {
      segments.push(finalizeSegment(current, segments.length));
      current = [];
    }

    current.push(word);
  }

  if (current.length > 0) {
    segments.push(finalizeSegment(current, segments.length));
  }

  return segments;
}

const LAYOUTS: LayoutType[] = ['center', 'left', 'center', 'stacked', 'center', 'impact'];
const ENTRANCES: EntranceType[] = ['slideUp', 'pop', 'fadeRise', 'slideLeft', 'dropIn'];

function finalizeSegment(words: ClassifiedWord[], index: number): Segment {
  const hasPower = words.some((w) => w.tier === 'power');
  const isShort = words.length <= 2;

  // Single power word or 1-2 word segment → impact layout
  let layout: LayoutType;
  if (isShort && hasPower) {
    layout = 'impact';
  } else {
    layout = deterministicChoice(LAYOUTS, index, 7);
  }

  // Ensure no consecutive identical entrances
  let entrance = deterministicChoice(ENTRANCES, index, 13);
  if (index > 0) {
    const prevEntrance = deterministicChoice(ENTRANCES, index - 1, 13);
    if (entrance === prevEntrance) {
      entrance = deterministicChoice(ENTRANCES, index + 3, 17);
    }
  }

  return {
    words,
    startMs: words[0].startMs,
    endMs: words[words.length - 1].endMs,
    layout,
    entrance,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 3. MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export const DynamicSubtitles: React.FC<DynamicSubtitlesProps> = ({
  words,
  startMs,
  endMs,
  textColor = '#FFFFFF',
  accentPrimary = '#FFD400',
  accentSecondary = '#39FF14',
  fontFamily = 'Montserrat, system-ui, sans-serif',
  baseFontSize = 48,
  fadeOutMs = 350,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = startMs + (frame / fps) * 1000;

  // Classify words and build segments (memoized — deterministic from props)
  const segments = useMemo(() => {
    const classified = words.map(classifyWord);
    return buildSegments(classified);
  }, [words]);

  // Find active segment
  const activeIdx = segments.findIndex(
    (seg) => currentTimeMs >= seg.startMs && currentTimeMs < seg.endMs
  );

  // If between segments, check if we're in a gap — show nothing during gaps
  if (activeIdx < 0) {
    // Check if we're past the last segment (fade out)
    const lastSeg = segments[segments.length - 1];
    if (lastSeg && currentTimeMs >= lastSeg.endMs && currentTimeMs < lastSeg.endMs + 200) {
      // Brief hold on last segment during fade
      return (
        <SegmentRenderer
          segment={lastSeg}
          segmentIndex={segments.length - 1}
          currentTimeMs={currentTimeMs}
          startMs={startMs}
          endMs={endMs}
          frame={frame}
          fps={fps}
          textColor={textColor}
          accentPrimary={accentPrimary}
          accentSecondary={accentSecondary}
          fontFamily={fontFamily}
          baseFontSize={baseFontSize}
          fadeOutMs={fadeOutMs}
          isFadingOut
        />
      );
    }
    return null;
  }

  const segment = segments[activeIdx];

  return (
    <SegmentRenderer
      segment={segment}
      segmentIndex={activeIdx}
      currentTimeMs={currentTimeMs}
      startMs={startMs}
      endMs={endMs}
      frame={frame}
      fps={fps}
      textColor={textColor}
      accentPrimary={accentPrimary}
      accentSecondary={accentSecondary}
      fontFamily={fontFamily}
      baseFontSize={baseFontSize}
      fadeOutMs={fadeOutMs}
      isFadingOut={false}
    />
  );
};

// ═══════════════════════════════════════════════════════════════════════
// 4. SEGMENT RENDERER — handles layout + entrance per segment
// ═══════════════════════════════════════════════════════════════════════

interface SegmentRendererProps {
  segment: Segment;
  segmentIndex: number;
  currentTimeMs: number;
  startMs: number;
  endMs: number;
  frame: number;
  fps: number;
  textColor: string;
  accentPrimary: string;
  accentSecondary: string;
  fontFamily: string;
  baseFontSize: number;
  fadeOutMs: number;
  isFadingOut: boolean;
}

const SegmentRenderer: React.FC<SegmentRendererProps> = ({
  segment,
  segmentIndex,
  currentTimeMs,
  startMs,
  endMs,
  frame,
  fps,
  textColor,
  accentPrimary,
  accentSecondary,
  fontFamily,
  baseFontSize,
  fadeOutMs,
  isFadingOut,
}) => {
  // ── Fade out at end of subtitle segment ──
  const distToEnd = endMs - currentTimeMs;
  const segmentFade = isFadingOut
    ? Math.max(0, 1 - (currentTimeMs - segment.endMs) / 200)
    : distToEnd < fadeOutMs
      ? interpolate(distToEnd, [0, fadeOutMs], [0, 1], { extrapolateRight: 'clamp' })
      : 1;

  // ── Segment-level entrance frame ──
  const segAppearFrame = Math.floor(((segment.startMs - startMs) / 1000) * fps);
  const segElapsed = frame - segAppearFrame;

  // ── Layout styles ──
  const layoutStyle = getLayoutStyle(segment.layout);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '16%',
        left: 0,
        right: 0,
        paddingLeft: '6%',
        paddingRight: '6%',
        opacity: segmentFade,
        transform: segmentFade < 1 ? `translateY(${(1 - segmentFade) * 12}px)` : undefined,
        ...layoutStyle,
      }}
    >
      {segment.words.map((word, idx) => (
        <DynamicWord
          key={`${segmentIndex}-${idx}`}
          word={word}
          wordIndex={idx}
          segmentIndex={segmentIndex}
          segment={segment}
          currentTimeMs={currentTimeMs}
          segAppearFrame={segAppearFrame}
          frame={frame}
          fps={fps}
          textColor={textColor}
          accentPrimary={accentPrimary}
          accentSecondary={accentSecondary}
          fontFamily={fontFamily}
          baseFontSize={baseFontSize}
        />
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// 5. LAYOUT STYLES
// ═══════════════════════════════════════════════════════════════════════

function getLayoutStyle(layout: LayoutType): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: '6px 10px',
  };

  switch (layout) {
    case 'center':
      return { ...base, justifyContent: 'center', textAlign: 'center' };

    case 'left':
      return {
        ...base,
        justifyContent: 'flex-start',
        textAlign: 'left',
        paddingRight: '20%',
      };

    case 'stacked':
      return {
        ...base,
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
      };

    case 'impact':
      return {
        ...base,
        justifyContent: 'center',
        textAlign: 'center',
        // Extra vertical spacing for dramatic isolated words
        gap: '4px 14px',
      };

    default:
      return { ...base, justifyContent: 'center' };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 6. DYNAMIC WORD — per-word rendering with tier-based sizing + animation
// ═══════════════════════════════════════════════════════════════════════

interface DynamicWordProps {
  word: ClassifiedWord;
  wordIndex: number;
  segmentIndex: number;
  segment: Segment;
  currentTimeMs: number;
  segAppearFrame: number;
  frame: number;
  fps: number;
  textColor: string;
  accentPrimary: string;
  accentSecondary: string;
  fontFamily: string;
  baseFontSize: number;
}

const DynamicWord: React.FC<DynamicWordProps> = ({
  word,
  wordIndex,
  segmentIndex,
  segment,
  currentTimeMs,
  segAppearFrame,
  frame,
  fps,
  textColor,
  accentPrimary,
  accentSecondary,
  fontFamily,
  baseFontSize,
}) => {
  const isActive = currentTimeMs >= word.startMs && currentTimeMs < word.endMs;
  const hasAppeared = currentTimeMs >= word.startMs;
  const isPower = word.tier === 'power';
  const isFiller = word.tier === 'filler';

  // ── Typography hierarchy ──
  const tierScale = isPower ? 2.2 : isFiller ? 0.65 : 1;
  const fontSize = Math.round(baseFontSize * tierScale);
  const fontWeight = isPower ? 900 : isFiller ? 500 : 700;

  // ── Entrance animation (varies per segment) ──
  const stagger = wordIndex * 3;
  const entranceElapsed = frame - segAppearFrame - stagger;

  const entranceProgress = spring({
    frame: Math.max(0, entranceElapsed),
    fps,
    config: entranceSpringConfig(segment.entrance),
  });

  const { translateX, translateY, scaleEntrance, entranceOpacity } =
    computeEntrance(segment.entrance, entranceProgress);

  // ── Active word: spring pop to 1.25x ──
  const activeElapsed = isActive
    ? Math.max(0, Math.floor(((currentTimeMs - word.startMs) / 1000) * fps))
    : 0;

  const activeSpring = spring({
    frame: activeElapsed,
    fps,
    config: { damping: 14, stiffness: 200, mass: 0.5, overshootClamping: false },
    durationInFrames: 12,
  });

  const activeScale = isActive && isPower
    ? interpolate(activeSpring, [0, 1], [1, 1.25], { extrapolateRight: 'clamp' })
    : isActive
      ? interpolate(activeSpring, [0, 1], [1, 1.08], { extrapolateRight: 'clamp' })
      : 1;

  const finalScale = scaleEntrance * activeScale;

  // ── Motion blur on power word punch ──
  const motionBlur = isPower && isActive && activeSpring < 0.6
    ? `blur(${interpolate(activeSpring, [0, 0.6], [3, 0], { extrapolateRight: 'clamp' })}px)`
    : undefined;

  // ── Color logic ──
  // Power words: alternate between primary/secondary accent deterministically
  // Active non-power: primary accent
  // Filler: dimmed white
  // Medium inactive: white
  let color: string;
  if (isPower) {
    color = (segmentIndex + wordIndex) % 3 === 0 ? accentSecondary : accentPrimary;
  } else if (isActive) {
    color = accentPrimary;
  } else if (isFiller) {
    color = textColor;
  } else {
    color = textColor;
  }

  // Past words: dim non-power words
  const dimming = hasAppeared && !isActive && !isPower ? 0.5 : 1;
  // Filler words always slightly dimmed
  const fillerDim = isFiller ? 0.6 : 1;

  const opacity = entranceOpacity * dimming * fillerDim;

  // ── Shadow: heavier for power words ──
  const shadow = isPower
    ? [
        '0 3px 6px rgba(0,0,0,0.9)',
        '0 6px 20px rgba(0,0,0,0.6)',
        '0 0 30px rgba(0,0,0,0.35)',
      ].join(', ')
    : [
        '0 2px 4px rgba(0,0,0,0.8)',
        '0 4px 12px rgba(0,0,0,0.4)',
      ].join(', ');

  return (
    <span
      style={{
        fontFamily,
        fontSize,
        fontWeight,
        color,
        display: 'inline-block',
        opacity,
        transform: [
          `translate(${translateX}px, ${translateY}px)`,
          `scale(${finalScale})`,
        ].join(' '),
        transformOrigin: 'center bottom',
        textShadow: shadow,
        filter: motionBlur,
        letterSpacing: isPower ? '0.5px' : isFiller ? '0px' : '-0.3px',
        lineHeight: 1.2,
        WebkitFontSmoothing: 'antialiased' as const,
        // Power words get a subtle text stroke for extra punch
        WebkitTextStroke: isPower ? '1px rgba(0,0,0,0.3)' : undefined,
        paintOrder: isPower ? ('stroke fill' as const) : undefined,
      }}
    >
      {word.text}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// 7. ENTRANCE ANIMATION CONFIGS
// ═══════════════════════════════════════════════════════════════════════

function entranceSpringConfig(entrance: EntranceType) {
  switch (entrance) {
    case 'pop':
      return { damping: 12, stiffness: 200, mass: 0.6, overshootClamping: false };
    case 'dropIn':
      return { damping: 16, stiffness: 150, mass: 0.8, overshootClamping: false };
    case 'slideLeft':
      return { damping: 20, stiffness: 100, mass: 0.7, overshootClamping: false };
    case 'fadeRise':
      return { damping: 24, stiffness: 80, mass: 0.9, overshootClamping: false };
    case 'slideUp':
    default:
      return { damping: 18, stiffness: 120, mass: 0.7, overshootClamping: false };
  }
}

function computeEntrance(
  entrance: EntranceType,
  progress: number
): { translateX: number; translateY: number; scaleEntrance: number; entranceOpacity: number } {
  const opacity = interpolate(progress, [0, 1], [0, 1], { extrapolateRight: 'clamp' });

  switch (entrance) {
    case 'slideUp':
      return {
        translateX: 0,
        translateY: interpolate(progress, [0, 1], [30, 0], { extrapolateRight: 'clamp' }),
        scaleEntrance: 1,
        entranceOpacity: opacity,
      };

    case 'pop':
      return {
        translateX: 0,
        translateY: 0,
        scaleEntrance: interpolate(progress, [0, 1], [0.3, 1], { extrapolateRight: 'clamp' }),
        entranceOpacity: opacity,
      };

    case 'fadeRise':
      return {
        translateX: 0,
        translateY: interpolate(progress, [0, 1], [14, 0], { extrapolateRight: 'clamp' }),
        scaleEntrance: interpolate(progress, [0, 1], [0.95, 1], { extrapolateRight: 'clamp' }),
        entranceOpacity: opacity,
      };

    case 'slideLeft':
      return {
        translateX: interpolate(progress, [0, 1], [40, 0], { extrapolateRight: 'clamp' }),
        translateY: 0,
        scaleEntrance: 1,
        entranceOpacity: opacity,
      };

    case 'dropIn':
      return {
        translateX: 0,
        translateY: interpolate(progress, [0, 1], [-35, 0], { extrapolateRight: 'clamp' }),
        scaleEntrance: interpolate(progress, [0, 1], [1.15, 1], { extrapolateRight: 'clamp' }),
        entranceOpacity: opacity,
      };

    default:
      return { translateX: 0, translateY: 0, scaleEntrance: 1, entranceOpacity: 1 };
  }
}

export default DynamicSubtitles;
