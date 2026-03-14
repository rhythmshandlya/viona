import React from 'react';

interface TextOverlayProps {
  data: {
    text: string;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    color?: string;
    backgroundColor?: string;
    borderRadius?: number;
    padding?: number;
    textAlign?: 'left' | 'center' | 'right';
    lineHeight?: number;
    letterSpacing?: number;
    textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  };
}

const textAlignToJustify: Record<string, string> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
};

export const TextOverlay: React.FC<TextOverlayProps> = ({ data }) => {
  const {
    text,
    fontFamily = 'Inter',
    fontSize = 48,
    fontWeight = 600,
    color = '#FFFFFF',
    backgroundColor,
    borderRadius,
    padding,
    textAlign = 'center',
    lineHeight,
    letterSpacing,
    textTransform,
  } = data;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: textAlignToJustify[textAlign] || 'center',
        overflow: 'hidden',
        wordBreak: 'break-word' as const,
      }}
    >
      <div
        style={{
          fontFamily,
          fontSize,
          fontWeight,
          color,
          backgroundColor,
          borderRadius,
          padding,
          textAlign,
          lineHeight: lineHeight ? `${lineHeight}` : undefined,
          letterSpacing: letterSpacing ? `${letterSpacing}px` : undefined,
          textTransform,
        }}
      >
        {text}
      </div>
    </div>
  );
};
