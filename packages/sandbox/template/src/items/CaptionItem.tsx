import React from 'react';
import { useCurrentFrame } from 'remotion';

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
    const alignment: 'center' | 'left' | 'stagger' = captionPreset.staircaseAlignment || 'center';

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
      // No strong/power word — render the whole phrase as a single body line
      return (
        <div style={containerStyle} data-caption-overlay>
          <div style={bodyLineStyle('0%')}>
            {visibleWords.map((w) => w.text).join(' ')}
          </div>
        </div>
      );
    }

    const beforeText = visibleWords.slice(0, pivotIdx).map((w) => w.text).join(' ');
    const pivotText = visibleWords[pivotIdx].text;
    const afterText = visibleWords.slice(pivotIdx + 1).map((w) => w.text).join(' ');

    return (
      <div style={containerStyle} data-caption-overlay>
        {beforeText ? <div style={bodyLineStyle('0%')}>{beforeText}</div> : null}
        <div style={emphasisLineStyle}>{pivotText}</div>
        {afterText ? <div style={bodyLineStyle(alignment === 'stagger' ? '16%' : '0%')}>{afterText}</div> : null}
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
