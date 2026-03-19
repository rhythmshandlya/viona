import React from 'react';
import { useCurrentFrame } from 'remotion';

interface CaptionWord {
  text: string;
  startMs: number;
  endMs: number;
  classification?: 'power' | 'medium' | 'filler';
  styleOverrides?: Record<string, unknown>;
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

  const anchor = captionStyle.position?.anchor ?? 'bottom';
  const offsetX = captionStyle.position?.offsetX ?? 0;
  const offsetY = captionStyle.position?.offsetY ?? 0;
  const textAlign = captionStyle.position?.textAlign ?? 'center';

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
    <div style={positionStyles}>
      <span
        style={{
          fontFamily: captionStyle.fontFamily ?? 'Inter',
          fontSize: captionStyle.fontSize ?? 56,
          fontWeight: captionStyle.fontWeight ?? 800,
          color: captionStyle.activeColor ?? captionStyle.color ?? '#FFD700',
          backgroundColor: captionStyle.activeBackgroundColor ?? 'transparent',
          letterSpacing: captionStyle.letterSpacing,
          textTransform: captionStyle.textTransform,
          lineHeight: captionStyle.lineHeight,
          padding: captionStyle.backgroundPadding
            ? `${captionStyle.backgroundPadding.y}px ${captionStyle.backgroundPadding.x}px`
            : undefined,
          borderRadius: captionStyle.backgroundRadius,
        }}
      >
        {activeWords.map((word) => word.text).join(' ')}
      </span>
    </div>
  );
};
