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

  const activeWords = data.words.filter(
    (word) => currentTimeMs >= word.startMs && currentTimeMs <= word.endMs,
  );

  if (activeWords.length === 0) {
    return null;
  }

  const captionPreset = captionStyle;

  // Resolve role for a word (role field, or fallback to classification)
  const getWordRole = (word: CaptionWord): string | undefined => {
    return word.role || word.classification || undefined;
  };

  // Resolve style for a word based on its role
  const resolveWordStyle = (word: CaptionWord) => {
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

  const anchor = captionPreset.position?.anchor ?? 'bottom';
  const offsetX = captionPreset.position?.offsetX ?? 0;
  const offsetY = captionPreset.position?.offsetY ?? 0;
  const textAlign = captionPreset.position?.textAlign ?? 'center';

  const positionStyles: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent:
      textAlign === 'left'
        ? 'flex-start'
        : textAlign === 'right'
          ? 'flex-end'
          : 'center',
    paddingLeft: Math.max(0, offsetX),
    paddingRight: Math.max(0, -offsetX),
  };

  if (anchor === 'top') {
    positionStyles.top = 40 + offsetY;
  } else if (anchor === 'center') {
    positionStyles.top = '50%';
    positionStyles.transform = `translateY(calc(-50% + ${offsetY}px))`;
  } else {
    positionStyles.bottom = 40 - offsetY;
  }

  return (
    <div style={positionStyles} data-caption-overlay>
      {activeWords.map((word, i) => {
        const ws = resolveWordStyle(word);
        return (
          <span
            key={i}
            style={{
              fontFamily: ws.fontFamily,
              fontSize: ws.fontSize,
              fontWeight: ws.fontWeight,
              color: ws.color,
              letterSpacing: ws.letterSpacing,
              textTransform: ws.textTransform as any,
              lineHeight: ws.lineHeight,
              transform: ws.scale && ws.scale !== 1 ? `scale(${ws.scale})` : undefined,
              display: 'inline-block',
              backgroundColor: ws.emphasisBg ?? (captionPreset.activeBackgroundColor ?? 'transparent'),
              padding: captionPreset.backgroundPadding
                ? `${captionPreset.backgroundPadding.y}px ${captionPreset.backgroundPadding.x}px`
                : undefined,
              borderRadius: captionPreset.backgroundRadius,
            }}
          >
            {word.text}{i < activeWords.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </div>
  );
};
