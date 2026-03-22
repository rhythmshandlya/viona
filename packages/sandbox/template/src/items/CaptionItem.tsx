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
