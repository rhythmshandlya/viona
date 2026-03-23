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
  const displayMode = captionPreset.displayMode || 'word-by-word';
  const wordsPerPhrase = captionPreset.wordsPerPhrase || 5;

  // Phrase windowing: show a group of words, not just the single active word
  let visibleWords: CaptionWord[];
  if (displayMode === 'phrase' || displayMode === 'karaoke') {
    // Find the last word whose startMs we've reached
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

  // Word tier classification for dynamic hierarchy
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
  const classifyWord = (text: string): WordTier => {
    const clean = text.replace(/[^a-zA-Z0-9%]/g, '').toLowerCase();
    if (/^\$?\d/.test(clean) || /\d{4,}/.test(clean) || clean.endsWith('%')) return 'power';
    if (POWER_WORDS.has(clean)) return 'power';
    if (FILLER_WORDS.has(clean)) return 'filler';
    if (STRONG_WORDS.has(clean)) return 'strong';
    if (clean.length >= 7) return 'strong';
    return 'medium';
  };

  const isDynamicHierarchy = !!captionPreset.typographyPairingId;
  const displayFontFamily = captionPreset.displayFontFamily || (captionPreset.fontFamily?.split(',')[0]?.trim()) || 'Montserrat';
  const bodyFontFamily = captionPreset.bodyFontFamily || 'Inter';

  // Resolve role for a word (role field, or fallback to classification)
  const getWordRole = (word: CaptionWord): string | undefined => {
    return word.role || word.classification || undefined;
  };

  // Resolve style for a word based on its role
  const resolveWordStyle = (word: CaptionWord) => {
    // Dynamic hierarchy: 2 sizes — emphasis (big, bold, italic) vs normal (smaller)
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

    // Standard role-based resolution
    const role = getWordRole(word);
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

  // Justify content based on text alignment
  positionStyles.justifyContent =
    textAlign === 'left'
      ? 'flex-start'
      : textAlign === 'right'
        ? 'flex-end'
        : 'center';

  if (posMode === 'free') {
    // Free mode: x/y are percentages of canvas (center of caption box)
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
    // Anchor mode (legacy)
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

  // Dynamic hierarchy: override position for full-width multi-line flow
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
