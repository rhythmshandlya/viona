import React from 'react';

interface TextItemData {
  text: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  backgroundColor?: string;
  borderRadius?: number;
  padding?: number | string;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
}

interface TextItemProps {
  data: TextItemData;
}

export const TextItem: React.FC<TextItemProps> = ({ data }) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: data.fontFamily ?? 'sans-serif',
        fontSize: data.fontSize ?? 24,
        fontWeight: data.fontWeight ?? 400,
        color: data.color ?? '#FFFFFF',
        backgroundColor: data.backgroundColor,
        borderRadius: data.borderRadius,
        padding: data.padding,
        textAlign: data.textAlign ?? 'center',
        lineHeight: data.lineHeight,
        letterSpacing: data.letterSpacing,
        textTransform: data.textTransform,
      }}
    >
      {data.text}
    </div>
  );
};
