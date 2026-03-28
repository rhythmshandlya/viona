import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

interface CaptionWord {
  text: string;
  startMs: number;
  endMs: number;
  role?: string;
  classification?: 'power' | 'medium' | 'filler';  // deprecated, use role
  styleOverrides?: Record<string, unknown>;           // deprecated
}

interface CaptionItemData {
  words: CaptionWord[];
}

interface CaptionItemProps {
  data: CaptionItemData;
  captionStyle: Record<string, any>;
  fps: number;
  itemStartMs: number;
}

// ─── Word classification ──────────────────────────────────────────────────────

const POWER_WORDS = new Set([
  'love','hate','fear','die','dead','death','kill','destroy','dream',
  'obsessed','insane','crazy','incredible','amazing','unbelievable',
  'shocking','terrifying','brilliant','genius','perfect','worst',
  'best','greatest','legendary','epic','massive','huge','evil',
  'now','stop','wait','listen','watch','look','never','always',
  'forever','immediately','urgent','warning','danger','critical',
  'important','breaking','exclusive','secret','finally','today',
  'million','billion','thousand','money','rich','free','paid',
  'but','however','actually','wrong','right','truth','lie','real',
  'fake','only','everything','nothing','impossible','possible',
  'everyone','nobody','first','last','biggest','smallest',
  'win','won','lose','lost','fight','broke','crushed','dominated',
  'exploded','changed','saved','failed','success','discovered',
]);
const FILLER_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being',
  'to','of','in','for','on','at','by','with','from','as',
  'and','or','if','it','its','that','this','than','then',
  'so','up','do','did','has','had','have','will','would',
  'could','should','can','may','might','shall','just','very',
  'also','about','into','not','no','yes','some','my','your',
  'we','they','he','she','i','me','us','them','our','their',
]);
const STRONG_WORDS = new Set([
  'really','literally','seriously','basically','honestly',
  'completely','extremely','definitely','absolutely','truly',
  'believe','remember','imagine','understand','realize',
  'create','become','happen','achieve','overcome',
  'different','specific','better','worse','special',
  'people','problem','reason','question','answer','story','world',
]);

type WordTier = 'power' | 'strong' | 'medium' | 'filler';
function classifyWord(text: string): WordTier {
  const clean = text.replace(/[^a-zA-Z0-9%]/g, '').toLowerCase();
  if (/^\$?\d/.test(clean) || /\d{4,}/.test(clean) || clean.endsWith('%')) return 'power';
  if (POWER_WORDS.has(clean)) return 'power';
  if (FILLER_WORDS.has(clean)) return 'filler';
  if (STRONG_WORDS.has(clean)) return 'strong';
  if (clean.length >= 7) return 'strong';
  return 'medium';
}

function isEmphasisWord(text: string): boolean {
  const tier = classifyWord(text);
  return tier === 'power' || tier === 'strong';
}

// ─── Component ────────────────────────────────────────────────────────────────

export const CaptionItem: React.FC<CaptionItemProps> = ({
  data,
  captionStyle,
  fps,
  itemStartMs,
}) => {
  const frame = useCurrentFrame();
  const { width: canvasW } = useVideoConfig();
  // Caption word timestamps are ABSOLUTE. Convert current frame to absolute ms.
  const currentTimeMs = itemStartMs + (frame / fps) * 1000;

  if (!data.words || !Array.isArray(data.words)) {
    return null;
  }

  const captionPreset = captionStyle;
  const displayMode = captionPreset.displayMode || 'phrase';
  const wordsPerPhrase = captionPreset.wordsPerPhrase || 7;

  // ── Phrase windowing ──────────────────────────────────────────────────────
  // poster-staircase always uses phrase windowing
  const usesPhraseWindowing =
    displayMode === 'phrase' ||
    displayMode === 'karaoke' ||
    displayMode === 'poster-staircase';

  let visibleWords: CaptionWord[];

  if (usesPhraseWindowing) {
    let lastAppearedIdx = -1;
    for (let i = data.words.length - 1; i >= 0; i--) {
      if (currentTimeMs >= data.words[i].startMs) {
        lastAppearedIdx = i;
        break;
      }
    }
    if (lastAppearedIdx < 0) return null;

    const groupIdx = Math.floor(lastAppearedIdx / wordsPerPhrase);
    const groupStart = groupIdx * wordsPerPhrase;
    const groupEnd = Math.min(groupStart + wordsPerPhrase, data.words.length);
    visibleWords = data.words.slice(groupStart, groupEnd);
  } else {
    // Word-by-word: only show active words
    visibleWords = data.words.filter(
      (word) => currentTimeMs >= word.startMs && currentTimeMs <= word.endMs,
    );
  }

  if (visibleWords.length === 0) {
    return null;
  }

  // ── Poster Staircase Layout ───────────────────────────────────────────────
  // Layout: one emphasis word (the strongest, most central word in the phrase)
  // sits on its own line; words before it form line 1, words after form line 3.
  // All lines appear simultaneously when the phrase starts.
  if (displayMode === 'poster-staircase') {
    const emphasisFont = captionPreset.displayFontFamily || 'Dancing Script';
    const bodyFont = captionPreset.bodyFontFamily || 'Montserrat';
    const baseFontSize = captionPreset.fontSize ?? 55;
    const alignment = captionPreset.staircaseAlignment || 'center';

    // Find the single pivot word: highest tier, closest to phrase center.
    // Only power (score 4) or strong (score 3, length ≥ 7) words qualify as emphasis.
    const wordScore = (text: string): number => {
      const c = text.replace(/[^a-zA-Z0-9%]/g, '').toLowerCase();
      if (/^\$?\d/.test(c) || /\d{4,}/.test(c) || c.endsWith('%')) return 4;
      if (POWER_WORDS.has(c)) return 4;
      if (FILLER_WORDS.has(c)) return 1;
      if (c.length >= 7) return 3;
      return 2;
    };

    const scores = visibleWords.map((w) => wordScore(w.text));
    const maxScore = Math.max(...scores);
    const phraseCenter = (visibleWords.length - 1) / 2;

    let pivotIdx = -1;
    if (maxScore >= 3) {
      let bestDist = Infinity;
      for (let i = 0; i < scores.length; i++) {
        if (scores[i] === maxScore) {
          const dist = Math.abs(i - phraseCenter);
          if (dist < bestDist) {
            bestDist = dist;
            pivotIdx = i;
          }
        }
      }
    }

    const position = captionPreset.position;
    const offsetX = position?.offsetX ?? 0;
    const offsetY = position?.offsetY ?? 5;

    // ── Word-by-word reveal helper ──────────────────────────────────────────
    // Returns CSS for opacity + transform based on word timing and transition style.
    const transitionStyle = captionPreset.staircaseTransition ?? 'slide-up';

    const wordRevealStyle = (word: CaptionWord): React.CSSProperties => {
      const appeared = currentTimeMs >= word.startMs;
      const timeSinceAppear = appeared ? currentTimeMs - word.startMs : 0;

      // 'none' — all words visible immediately, no per-word reveal
      if (transitionStyle === 'none') {
        return { opacity: 1, display: 'inline-block' };
      }

      // 'typewriter' — instant cut-in, no interpolation
      if (transitionStyle === 'typewriter') {
        return { opacity: appeared ? 1 : 0, display: 'inline-block' };
      }

      // 'pop' — scale 0.7→1.0 + fade, 200ms
      if (transitionStyle === 'pop') {
        const p = Math.min(timeSinceAppear / 200, 1);
        const scale = appeared ? 0.7 + 0.3 * p : 0.7;
        return {
          opacity: appeared ? (0.3 + 0.7 * p) : 0,
          transform: `scale(${scale})`,
          transition: 'none',
          display: 'inline-block',
        };
      }

      // 'fade' — opacity 0→1, 300ms, no transform
      if (transitionStyle === 'fade') {
        const p = Math.min(timeSinceAppear / 300, 1);
        return {
          opacity: appeared ? p : 0,
          display: 'inline-block',
        };
      }

      // 'slide-up' — translateY(30px)→0 + fade, 250ms (default)
      if (transitionStyle === 'slide-up') {
        const p = Math.min(timeSinceAppear / 250, 1);
        // ease-out curve: 1 - (1-p)^2
        const eased = appeared ? 1 - Math.pow(1 - p, 2) : 0;
        const translateY = appeared ? 30 * (1 - eased) : 30;
        return {
          opacity: appeared ? eased : 0,
          transform: `translateY(${translateY}px)`,
          display: 'inline-block',
        };
      }

      // 'elastic' — scale 0.5→1.15→1.0 + fade, 350ms (easeOutBack)
      if (transitionStyle === 'elastic') {
        const p = Math.min(timeSinceAppear / 350, 1);
        // easeOutBack approximation: overshoot then settle
        const c1 = 1.70158;
        const c3 = c1 + 1;
        const eased = appeared
          ? 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2)
          : 0;
        const scale = appeared ? Math.max(0.01, 0.5 + 0.5 * eased) : 0.5;
        return {
          opacity: appeared ? Math.min(1, p * 2) : 0,
          transform: `scale(${scale})`,
          display: 'inline-block',
        };
      }

      // fallback: slide-up
      const p = Math.min(timeSinceAppear / 250, 1);
      const eased = appeared ? 1 - Math.pow(1 - p, 2) : 0;
      return {
        opacity: appeared ? eased : 0,
        transform: `translateY(${appeared ? 30 * (1 - eased) : 30}px)`,
        display: 'inline-block',
      };
    };

    // For line-level reveal: show line only if ANY word in it has appeared
    const lineRevealStyle = (words: CaptionWord[]): React.CSSProperties => {
      const anyAppeared = words.some(w => currentTimeMs >= w.startMs);
      if (!anyAppeared) return { opacity: 0, transform: 'scale(0.8)' };
      const latestAppear = Math.max(...words.filter(w => currentTimeMs >= w.startMs).map(w => w.startMs));
      const timeSince = currentTimeMs - latestAppear;
      const progress = Math.min(timeSince / 150, 1);
      return { opacity: 0.3 + 0.7 * progress, transform: `scale(${0.85 + 0.15 * progress})` };
    };

    // Render text with per-word reveal animation
    const renderWordsWithReveal = (words: CaptionWord[], baseStyle: React.CSSProperties) => (
      <div style={baseStyle}>
        {words.map((w, i) => (
          <span key={i} style={{ ...wordRevealStyle(w), display: 'inline' }}>
            {w.text}{i < words.length - 1 ? ' ' : ''}
          </span>
        ))}
      </div>
    );

    // ── bold-stack: every word large, gold, uppercase, flex-wrapped ──────────
    if (alignment === 'bold-stack') {
      const containerStyle: React.CSSProperties = {
        position: 'absolute',
        bottom: `${offsetY}%`,
        left: '50%',
        transform: `translateX(calc(-50% + ${offsetX}px))`,
        width: '92%',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '2px 10px',
      };
      const wordStyle: React.CSSProperties = {
        fontFamily: "'Montserrat', system-ui, sans-serif",
        fontSize: baseFontSize * 1.5,
        fontWeight: 900,
        color: '#FFD700',
        textTransform: 'uppercase',
        letterSpacing: '2px',
        lineHeight: 1.05,
        textShadow: '0 2px 12px rgba(0,0,0,0.9), 0 0 30px rgba(255,180,0,0.35)',
        display: 'inline-block',
      };
      return (
        <div style={containerStyle} data-caption-overlay>
          {visibleWords.map((w, i) => (
            <span key={i} style={{ ...wordStyle, ...wordRevealStyle(w) }}>{w.text}</span>
          ))}
        </div>
      );
    }

    // ── impact: extreme contrast — tiny body, massive gold pivot ─────────────
    if (alignment === 'impact') {
      const containerStyle: React.CSSProperties = {
        position: 'absolute',
        bottom: `${offsetY}%`,
        left: '50%',
        transform: `translateX(calc(-50% + ${offsetX}px))`,
        width: '92%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
      };
      const bodyStyle = (marginLeft: string): React.CSSProperties => ({
        fontFamily: "'Montserrat', system-ui, sans-serif",
        fontSize: baseFontSize * 0.38,
        fontWeight: 700,
        color: '#FFFFFF',
        textTransform: 'uppercase',
        letterSpacing: '2.5px',
        lineHeight: 1.2,
        textAlign: 'center',
        textShadow: '0 1px 6px rgba(0,0,0,0.9)',
        width: '100%',
        marginLeft,
      });
      const pivotStyle: React.CSSProperties = {
        fontFamily: "'Montserrat', 'Impact', system-ui, sans-serif",
        fontSize: baseFontSize * 2.5,
        fontWeight: 900,
        color: '#FFD700',
        textTransform: 'uppercase',
        letterSpacing: '-1px',
        lineHeight: 1.0,
        textAlign: 'center',
        textShadow: '0 0 22px rgba(255,180,0,0.7), 0 3px 15px rgba(0,0,0,0.9)',
        width: '100%',
      };

      if (pivotIdx === -1) {
        return (
          <div style={containerStyle} data-caption-overlay>
            {renderWordsWithReveal(visibleWords, bodyStyle('0%'))}
          </div>
        );
      }
      const beforeWords = visibleWords.slice(0, pivotIdx);
      const afterWords = visibleWords.slice(pivotIdx + 1);
      return (
        <div style={containerStyle} data-caption-overlay>
          {beforeWords.length > 0 ? renderWordsWithReveal(beforeWords, bodyStyle('0%')) : null}
          <div style={{ ...pivotStyle, ...wordRevealStyle(visibleWords[pivotIdx]) }}>{visibleWords[pivotIdx].text}</div>
          {afterWords.length > 0 ? renderWordsWithReveal(afterWords, bodyStyle('0%')) : null}
        </div>
      );
    }

    // ── single: thin body + cursive pivot in gold ────────────────────────────
    if (alignment === 'single') {
      const containerStyle: React.CSSProperties = {
        position: 'absolute',
        bottom: `${offsetY}%`,
        left: '50%',
        transform: `translateX(calc(-50% + ${offsetX}px))`,
        width: '90%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '3px',
      };
      const bodyStyle: React.CSSProperties = {
        fontFamily: "'Montserrat', system-ui, sans-serif",
        fontSize: baseFontSize * 0.65,
        fontWeight: 300,
        color: 'rgba(255,255,255,0.85)',
        letterSpacing: '1.5px',
        lineHeight: 1.3,
        textAlign: 'center',
        textShadow: '0 1px 8px rgba(0,0,0,0.8)',
        width: '100%',
        textTransform: 'none',
      };
      const pivotStyle: React.CSSProperties = {
        fontFamily: "'Great Vibes', cursive",
        fontSize: baseFontSize * 2.1,
        fontWeight: 400,
        fontStyle: 'italic',
        color: '#FFD700',
        letterSpacing: '0.5px',
        lineHeight: 1.1,
        textAlign: 'center',
        textShadow: '0 0 18px rgba(255,180,0,0.4), 0 2px 12px rgba(0,0,0,0.85)',
        width: '100%',
      };

      if (pivotIdx === -1) {
        return (
          <div style={containerStyle} data-caption-overlay>
            {renderWordsWithReveal(visibleWords, pivotStyle)}
          </div>
        );
      }
      const beforeWords = visibleWords.slice(0, pivotIdx);
      const afterWords = visibleWords.slice(pivotIdx + 1);
      return (
        <div style={containerStyle} data-caption-overlay>
          {beforeWords.length > 0 ? renderWordsWithReveal(beforeWords, bodyStyle) : null}
          <div style={{ ...pivotStyle, ...wordRevealStyle(visibleWords[pivotIdx]) }}>{visibleWords[pivotIdx].text}</div>
          {afterWords.length > 0 ? renderWordsWithReveal(afterWords, bodyStyle) : null}
        </div>
      );
    }

    // ── scattered: absolute positioning across canvas ────────────────────────
    if (alignment === 'scattered') {
      // Scatter position slots [xPercent, yPercent, rotationDeg]
      // Designed for lower 45% of 9:16 vertical canvas (caption zone)
      const SLOTS: Array<[number, number, number]> = [
        [50, 62,  0],   // 0: center-primary (pivot)
        [18, 57, -4],   // 1: upper-left
        [76, 58,  3],   // 2: upper-right
        [30, 72, -2],   // 3: mid-left
        [66, 72,  2],   // 4: mid-right
        [22, 82, -3],   // 5: lower-left
        [72, 81,  2],   // 6: lower-right
        [46, 86, -1],   // 7: bottom-center
        [58, 52,  1],   // 8: upper-center-right
      ];
      const LEFT_SLOTS = [1, 3, 5, 7];
      const RIGHT_SLOTS = [2, 4, 6, 8];

      // Use pivot from existing logic, fallback to highest-scored word
      const effectivePivot = pivotIdx >= 0 ? pivotIdx : scores.indexOf(Math.max(...scores));

      let leftIdx = 0;
      let rightIdx = 0;
      const placements = visibleWords.map((w, i) => {
        if (i === effectivePivot) return { word: w, slot: SLOTS[0], tier: classifyWord(w.text) };
        if (i < effectivePivot) {
          const slot = SLOTS[LEFT_SLOTS[leftIdx % LEFT_SLOTS.length]];
          leftIdx++;
          return { word: w, slot, tier: classifyWord(w.text) };
        }
        const slot = SLOTS[RIGHT_SLOTS[rightIdx % RIGHT_SLOTS.length]];
        rightIdx++;
        return { word: w, slot, tier: classifyWord(w.text) };
      });

      const tierSizeMultiplier: Record<WordTier, number> = {
        power: 2.4, strong: 1.8, medium: 0.88, filler: 0.58,
      };
      const maxFontSize = canvasW * 0.14; // cap at 14% of canvas width

      return (
        <div style={{ position: 'absolute', inset: 0 }} data-caption-overlay>
          {placements.map(({ word, slot, tier }, idx) => {
            const [xPct, yPct, rot] = slot;
            const rawSize = baseFontSize * tierSizeMultiplier[tier];
            const fontSize = Math.min(rawSize, maxFontSize);
            const isEmphasis = tier === 'power' || tier === 'strong';
            const reveal = wordRevealStyle(word);
            const baseOpacity = isEmphasis ? 1 : 0.8;
            return (
              <div
                key={idx}
                style={{
                  position: 'absolute',
                  left: `${xPct}%`,
                  top: `${yPct}%`,
                  transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${reveal.transform?.toString().match(/scale\(([^)]+)\)/)?.[1] ?? 1})`,
                  fontFamily: "'Montserrat', system-ui, sans-serif",
                  fontSize,
                  fontWeight: isEmphasis ? 900 : 400,
                  color: isEmphasis ? '#FFD700' : '#FFFFFF',
                  textTransform: 'uppercase',
                  letterSpacing: isEmphasis ? '-0.5px' : '1px',
                  lineHeight: 1.0,
                  textShadow: isEmphasis ? '0 2px 10px rgba(0,0,0,0.9), 0 0 20px rgba(255,180,0,0.4)' : '0 2px 10px rgba(0,0,0,0.9)',
                  whiteSpace: 'nowrap',
                  opacity: typeof reveal.opacity === 'number' ? reveal.opacity * baseOpacity : 0,
                }}
              >
                {word.text}
              </div>
            );
          })}
        </div>
      );
    }

    // ── left-flush: center-aligned impact staircase with large emphasis ───────
    if (alignment === 'left-flush') {
      const containerStyle: React.CSSProperties = {
        position: 'absolute', bottom: `${offsetY}%`, left: '50%',
        transform: `translateX(calc(-50% + ${offsetX}px))`,
        width: '88%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '2px',
      };
      const bodyStyle: React.CSSProperties = {
        fontFamily: `'${bodyFont}', Montserrat, sans-serif`,
        fontSize: baseFontSize * 0.6, fontWeight: 500,
        color: 'rgba(255,255,255,0.88)', lineHeight: 1.2,
        textAlign: 'center', letterSpacing: '1.5px', textTransform: 'uppercase',
        textShadow: '0 1px 8px rgba(0,0,0,0.9)', width: '100%',
      };
      const pivotStyle: React.CSSProperties = {
        fontFamily: `'${emphasisFont}', 'Dancing Script', cursive`,
        fontSize: baseFontSize * 2.5, fontWeight: 900, fontStyle: 'italic',
        color: '#FFD700', lineHeight: 1.0, textAlign: 'center',
        textShadow: '0 0 20px rgba(255,180,0,0.7), 0 2px 12px rgba(0,0,0,0.9)',
        width: '100%',
      };
      if (pivotIdx === -1) {
        return (<div style={containerStyle} data-caption-overlay>{renderWordsWithReveal(visibleWords, bodyStyle)}</div>);
      }
      return (
        <div style={containerStyle} data-caption-overlay>
          {pivotIdx > 0 ? renderWordsWithReveal(visibleWords.slice(0, pivotIdx), bodyStyle) : null}
          <div style={{ ...pivotStyle, ...wordRevealStyle(visibleWords[pivotIdx]) }}>{visibleWords[pivotIdx].text}</div>
          {pivotIdx < visibleWords.length - 1 ? renderWordsWithReveal(visibleWords.slice(pivotIdx + 1), bodyStyle) : null}
        </div>
      );
    }

    // ── diagonal: center-aligned diagonal flow staircase ─────────────────────
    if (alignment === 'diagonal') {
      const containerStyle: React.CSSProperties = {
        position: 'absolute', bottom: `${offsetY}%`, left: '50%',
        transform: `translateX(calc(-50% + ${offsetX}px))`,
        width: '88%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '2px',
      };
      const bodyStyle: React.CSSProperties = {
        fontFamily: `'${bodyFont}', Montserrat, sans-serif`,
        fontSize: baseFontSize * 0.65, fontWeight: 500,
        color: 'rgba(255,255,255,0.88)', lineHeight: 1.2,
        textAlign: 'center', letterSpacing: '1.5px', textTransform: 'uppercase',
        textShadow: '0 1px 8px rgba(0,0,0,0.9)', width: '100%',
      };
      const pivotStyle: React.CSSProperties = {
        fontFamily: `'${emphasisFont}', 'Dancing Script', cursive`,
        fontSize: baseFontSize * 1.9, fontWeight: 700, fontStyle: 'italic',
        color: '#FFD700', lineHeight: 1.05, textAlign: 'center',
        textShadow: '0 0 20px rgba(255,180,0,0.7), 0 2px 12px rgba(0,0,0,0.9)',
        width: '100%',
      };
      if (pivotIdx === -1) {
        return (<div style={containerStyle} data-caption-overlay>{renderWordsWithReveal(visibleWords, bodyStyle)}</div>);
      }
      return (
        <div style={containerStyle} data-caption-overlay>
          {pivotIdx > 0 ? renderWordsWithReveal(visibleWords.slice(0, pivotIdx), bodyStyle) : null}
          <div style={{ ...pivotStyle, ...wordRevealStyle(visibleWords[pivotIdx]) }}>{visibleWords[pivotIdx].text}</div>
          {pivotIdx < visibleWords.length - 1 ? renderWordsWithReveal(visibleWords.slice(pivotIdx + 1), bodyStyle) : null}
        </div>
      );
    }

    // ── multi-block: each word sized by tier, stacked vertically centered ────
    if (alignment === 'multi-block') {
      const containerStyle: React.CSSProperties = {
        position: 'absolute', bottom: `${offsetY}%`, left: '50%',
        transform: `translateX(calc(-50% + ${offsetX}px))`,
        width: '88%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '0px',
      };
      const tierStyles: Record<WordTier, React.CSSProperties> = {
        power: { fontFamily: `'${emphasisFont}', 'Dancing Script', cursive`, fontSize: baseFontSize * 2.2, fontWeight: 900, fontStyle: 'italic', color: '#FFD700', lineHeight: 1.05, textShadow: '0 0 20px rgba(255,180,0,0.7), 0 2px 12px rgba(0,0,0,0.9)' },
        strong: { fontFamily: `'${emphasisFont}', 'Dancing Script', cursive`, fontSize: baseFontSize * 1.6, fontWeight: 700, fontStyle: 'italic', color: '#FFD700', lineHeight: 1.1, textShadow: '0 0 15px rgba(255,180,0,0.5), 0 2px 10px rgba(0,0,0,0.9)' },
        medium: { fontFamily: `'${bodyFont}', Montserrat, sans-serif`, fontSize: baseFontSize * 0.9, fontWeight: 600, color: 'rgba(255,255,255,0.9)', lineHeight: 1.2, textTransform: 'uppercase', letterSpacing: '1px', textShadow: '0 1px 8px rgba(0,0,0,0.9)' },
        filler: { fontFamily: `'${bodyFont}', Montserrat, sans-serif`, fontSize: baseFontSize * 0.55, fontWeight: 400, color: 'rgba(255,255,255,0.6)', lineHeight: 1.3, textTransform: 'uppercase', letterSpacing: '2px', textShadow: '0 1px 6px rgba(0,0,0,0.9)' },
      };
      return (
        <div style={containerStyle} data-caption-overlay>
          {visibleWords.map((w, i) => {
            const tier = classifyWord(w.text);
            return <div key={i} style={{ ...tierStyles[tier], width: '100%', textAlign: 'center', ...wordRevealStyle(w) }}>{w.text}</div>;
          })}
        </div>
      );
    }

    // ── bold-left: bold stack center-aligned ──────────────────────────────────
    if (alignment === 'bold-left') {
      const containerStyle: React.CSSProperties = {
        position: 'absolute', bottom: `${offsetY}%`, left: '50%',
        transform: `translateX(calc(-50% + ${offsetX}px))`,
        width: '88%', display: 'flex', flexWrap: 'wrap',
        justifyContent: 'center', alignItems: 'center',
        gap: '4px 8px',
      };
      const wordStyle: React.CSSProperties = {
        fontFamily: `'${emphasisFont}', 'Dancing Script', cursive`,
        fontSize: baseFontSize * 1.5, fontWeight: 800,
        color: '#FFD700', lineHeight: 1.1,
        textShadow: '0 0 20px rgba(255,180,0,0.7), 0 2px 12px rgba(0,0,0,0.9)',
        textTransform: 'uppercase',
      };
      return (
        <div style={containerStyle} data-caption-overlay>
          {visibleWords.map((w, i) => <span key={i} style={{ ...wordStyle, ...wordRevealStyle(w) }}>{w.text}</span>)}
        </div>
      );
    }

    // ── hero-center: extreme center-dominant emphasis ─────────────────────────
    if (alignment === 'hero-center') {
      const containerStyle: React.CSSProperties = {
        position: 'absolute', bottom: `${offsetY}%`, left: '50%',
        transform: `translateX(calc(-50% + ${offsetX}px))`,
        width: '88%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: '2px',
      };
      const bodyStyle: React.CSSProperties = {
        fontFamily: `'${bodyFont}', Montserrat, sans-serif`,
        fontSize: baseFontSize * 0.3, fontWeight: 400,
        color: 'rgba(255,255,255,0.7)', lineHeight: 1.2,
        textAlign: 'center', letterSpacing: '2px', textTransform: 'uppercase',
        textShadow: '0 1px 6px rgba(0,0,0,0.9)', width: '100%',
      };
      const pivotStyle: React.CSSProperties = {
        fontFamily: `'${emphasisFont}', 'Dancing Script', cursive`,
        fontSize: baseFontSize * 3.5, fontWeight: 900, fontStyle: 'italic',
        color: '#FFD700', lineHeight: 0.95, textAlign: 'center',
        textShadow: '0 0 30px rgba(255,180,0,0.8), 0 4px 16px rgba(0,0,0,0.9)',
        width: '100%',
      };
      const afterStyle: React.CSSProperties = {
        ...bodyStyle, fontSize: baseFontSize * 0.65,
      };
      if (pivotIdx === -1) {
        return (<div style={containerStyle} data-caption-overlay>{renderWordsWithReveal(visibleWords, pivotStyle)}</div>);
      }
      return (
        <div style={containerStyle} data-caption-overlay>
          {pivotIdx > 0 ? renderWordsWithReveal(visibleWords.slice(0, pivotIdx), bodyStyle) : null}
          <div style={{ ...pivotStyle, ...wordRevealStyle(visibleWords[pivotIdx]) }}>{visibleWords[pivotIdx].text}</div>
          {pivotIdx < visibleWords.length - 1 ? renderWordsWithReveal(visibleWords.slice(pivotIdx + 1), afterStyle) : null}
        </div>
      );
    }

    // ── Default Cinematic Luxe staircase (no variant / 'cinematic-luxe') ──────
    const containerStyle: React.CSSProperties = {
      position: 'absolute',
      bottom: `${offsetY}%`,
      left: '50%',
      transform: `translateX(calc(-50% + ${offsetX}px))`,
      width: '88%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: alignment === 'left' ? 'flex-start' : 'center',
      gap: '4px',
    };

    const bodyLineStyle = (indent: string): React.CSSProperties => ({
      fontFamily: `'${bodyFont}', Montserrat, sans-serif`,
      fontSize: baseFontSize * 0.72,
      fontWeight: 500,
      color: 'rgba(255,255,255,0.88)',
      lineHeight: 1.2,
      textAlign: alignment === 'left' ? 'left' : 'center',
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      textShadow: '0 1px 8px rgba(0,0,0,0.9)',
      marginLeft: indent,
      width: '100%',
    });

    const emphasisLineStyle: React.CSSProperties = {
      fontFamily: `'${emphasisFont}', 'Dancing Script', cursive`,
      fontSize: baseFontSize * 1.9,
      fontWeight: 700,
      fontStyle: 'italic',
      color: '#FFD700',
      lineHeight: 1.05,
      textAlign: alignment === 'left' ? 'left' : 'center',
      letterSpacing: '-0.5px',
      textShadow: '0 0 20px rgba(255,180,0,0.7), 0 2px 12px rgba(0,0,0,0.9)',
      marginLeft: alignment === 'stagger' ? '8%' : '0%',
      width: '100%',
    };

    if (pivotIdx === -1) {
      // No strong/power word — render the whole phrase with word reveal
      return (
        <div style={containerStyle} data-caption-overlay>
          {renderWordsWithReveal(visibleWords, bodyLineStyle('0%'))}
        </div>
      );
    }

    const beforeWords = visibleWords.slice(0, pivotIdx);
    const pivotWord = visibleWords[pivotIdx];
    const afterWords = visibleWords.slice(pivotIdx + 1);

    return (
      <div style={containerStyle} data-caption-overlay>
        {beforeWords.length > 0 ? renderWordsWithReveal(beforeWords, bodyLineStyle('0%')) : null}
        <div style={{ ...emphasisLineStyle, ...wordRevealStyle(pivotWord) }}>{pivotWord.text}</div>
        {afterWords.length > 0 ? renderWordsWithReveal(afterWords, bodyLineStyle(alignment === 'stagger' ? '16%' : '0%')) : null}
      </div>
    );
  }

  // ── Dynamic Hierarchy (other dual-typography presets) ─────────────────────
  const isDynamicHierarchy = !!captionPreset.typographyPairingId;
  const displayFontFamily = captionPreset.displayFontFamily || (captionPreset.fontFamily?.split(',')[0]?.trim()) || 'Montserrat';
  const bodyFontFamily = captionPreset.bodyFontFamily || 'Inter';

  const resolveWordStyle = (word: CaptionWord) => {
    if (isDynamicHierarchy) {
      const tier = classifyWord(word.text);
      const isEmphasis = tier === 'power' || tier === 'strong';
      const baseFontSize = captionPreset.fontSize ?? 60;
      return {
        fontFamily: isEmphasis ? displayFontFamily : bodyFontFamily,
        fontSize: isEmphasis ? baseFontSize * 2.5 : baseFontSize,
        fontWeight: isEmphasis ? 900 : 400,
        color: captionPreset.color ?? '#ffffff',
        letterSpacing: isEmphasis ? -1 : 0,
        textTransform: 'none' as const,
        lineHeight: 0.95,
        scale: undefined,
        emphasisBg: undefined,
        fontStyle: isEmphasis ? 'italic' : 'normal',
      };
    }

    const role = word.role || word.classification || undefined;
    const roleStyle = role ? captionPreset.wordEmphasis?.roles?.[role] : undefined;
    return {
      fontFamily: roleStyle?.fontFamily ?? captionPreset.fontFamily ?? 'Inter',
      fontSize: roleStyle?.fontSize ?? captionPreset.fontSize ?? 56,
      fontWeight: roleStyle?.fontWeight ?? captionPreset.fontWeight ?? 800,
      color: roleStyle?.activeColor ?? roleStyle?.color ?? captionPreset.activeColor ?? captionPreset.color ?? '#FFD700',
      letterSpacing: roleStyle?.letterSpacing ?? captionPreset.letterSpacing,
      textTransform: roleStyle?.textTransform ?? captionPreset.textTransform,
      lineHeight: captionPreset.lineHeight,
      scale: roleStyle?.scale,
      emphasisBg: roleStyle?.emphasisBg,
    };
  };

  const position = captionPreset.position;
  const posMode = position?.mode;
  const anchor = position?.anchor ?? 'bottom';
  const offsetX = position?.offsetX ?? 0;
  const offsetY = position?.offsetY ?? 0;
  const textAlign = position?.textAlign ?? 'center';
  const rotation = position?.rotation ?? 0;

  const positionStyles: React.CSSProperties = {
    position: 'absolute',
    display: 'flex',
    flexWrap: 'wrap',
  };

  positionStyles.justifyContent =
    textAlign === 'left'
      ? 'flex-start'
      : textAlign === 'right'
        ? 'flex-end'
        : 'center';

  if (posMode === 'free') {
    const x = position?.x ?? 50;
    const y = position?.y ?? 85;
    const width = position?.width ?? 90;
    positionStyles.left = `${x}%`;
    positionStyles.top = `${y}%`;
    positionStyles.width = `${width}%`;
    const transforms = ['translate(-50%, -50%)'];
    if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);
    positionStyles.transform = transforms.join(' ');
  } else {
    positionStyles.left = 0;
    positionStyles.right = 0;
    positionStyles.paddingLeft = Math.max(0, offsetX);
    positionStyles.paddingRight = Math.max(0, -offsetX);

    if (anchor === 'top') {
      positionStyles.top = 40 + offsetY;
    } else if (anchor === 'center') {
      positionStyles.top = '50%';
      const transforms = ['translateY(-50%)'];
      if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);
      positionStyles.transform = transforms.join(' ');
    } else {
      positionStyles.bottom = 40 - offsetY;
      if (rotation !== 0) {
        positionStyles.transform = `rotate(${rotation}deg)`;
      }
    }
  }

  if (isDynamicHierarchy) {
    const dhStyles: React.CSSProperties = {
      position: 'absolute',
      left: '5%',
      right: '5%',
      bottom: '12%',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      justifyContent: 'center',
      gap: '4px 8px',
      textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.4)',
    };

    return (
      <div style={dhStyles} data-caption-overlay>
        {visibleWords.map((word, i) => {
          const ws = resolveWordStyle(word);
          const hasAppeared = currentTimeMs >= word.startMs;
          return (
            <span
              key={i}
              style={{
                fontFamily: ws.fontFamily,
                fontSize: ws.fontSize,
                fontWeight: ws.fontWeight,
                fontStyle: (ws as any).fontStyle || 'normal',
                color: ws.color,
                opacity: hasAppeared ? 1 : 0.35,
                letterSpacing: ws.letterSpacing,
                lineHeight: ws.lineHeight,
                display: 'inline',
                transition: 'opacity 0.2s ease',
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    );
  }

  // ── Standard phrase / word-by-word / karaoke ──────────────────────────────
  return (
    <div style={positionStyles} data-caption-overlay>
      {visibleWords.map((word, i) => {
        const ws = resolveWordStyle(word);
        const isActive = currentTimeMs >= word.startMs && currentTimeMs <= word.endMs;
        const hasAppeared = currentTimeMs >= word.startMs;
        return (
          <span
            key={i}
            style={{
              fontFamily: ws.fontFamily,
              fontSize: ws.fontSize,
              fontWeight: ws.fontWeight,
              color: isActive ? ws.color : (hasAppeared ? ws.color : (captionPreset.color ?? '#ffffff')),
              opacity: hasAppeared ? 1 : 0.4,
              letterSpacing: ws.letterSpacing,
              textTransform: ws.textTransform as any,
              lineHeight: ws.lineHeight,
              transform: ws.scale && ws.scale !== 1 ? `scale(${ws.scale})` : undefined,
              display: 'inline-block',
              backgroundColor: ws.emphasisBg ?? (isActive ? (captionPreset.activeBackgroundColor ?? 'transparent') : 'transparent'),
              padding: captionPreset.backgroundPadding
                ? `${captionPreset.backgroundPadding.y}px ${captionPreset.backgroundPadding.x}px`
                : undefined,
              borderRadius: captionPreset.backgroundRadius,
              transition: 'opacity 0.15s ease',
            }}
          >
            {word.text}{i < visibleWords.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </div>
  );
};
