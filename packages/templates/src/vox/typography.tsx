import React from 'react';
import { VOX_FONTS, VOX_SIZES, VOX_COLORS } from './constants';
import { RoughEdgeMask } from './effects';

export const VoxHeadline: React.FC<{
  text: string;
  size?: number;
  color?: string;
  accentBar?: 'left' | 'underline' | 'none';
  accentColor?: string;
}> = ({
  text,
  size = VOX_SIZES.h1,
  color = VOX_COLORS.charcoal,
  accentBar = 'none',
  accentColor = VOX_COLORS.highlight,
}) => (
  <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: accentBar === 'left' ? 12 : 0 }}>
    {accentBar === 'left' && (
      <div style={{ width: 4, backgroundColor: accentColor, alignSelf: 'stretch', borderRadius: 2 }} />
    )}
    <div>
      <div style={{ fontFamily: VOX_FONTS.headline, fontSize: size, fontWeight: 700, color, lineHeight: 1.15 }}>
        {text}
      </div>
      {accentBar === 'underline' && (
        <div style={{ height: 4, backgroundColor: accentColor, marginTop: 6, borderRadius: 2 }} />
      )}
    </div>
  </div>
);

export const VoxBody: React.FC<{
  text: string;
  size?: number;
  color?: string;
  maxWidth?: number;
}> = ({ text, size = VOX_SIZES.body, color = VOX_COLORS.charcoal, maxWidth }) => (
  <div style={{ fontFamily: VOX_FONTS.body, fontSize: size, fontWeight: 400, color, lineHeight: 1.5, maxWidth }}>
    {text}
  </div>
);

export const VoxLabel: React.FC<{
  text: string;
  color?: string;
  background?: string;
}> = ({ text, color = VOX_COLORS.charcoal, background }) => (
  <div style={{ position: 'relative', display: 'inline-block' }}>
    {background && (
      <RoughEdgeMask seed={text.length * 7}>
        <div style={{ position: 'absolute', inset: -4, backgroundColor: background, borderRadius: 2 }} />
      </RoughEdgeMask>
    )}
    <span style={{
      fontFamily: VOX_FONTS.body,
      fontSize: VOX_SIZES.label,
      fontWeight: 500,
      color,
      textTransform: 'uppercase' as const,
      letterSpacing: 1.5,
      position: 'relative',
    }}>
      {text}
    </span>
  </div>
);

export const VoxCounter: React.FC<{
  value: number | string;
  unit?: string;
  size?: number;
  color?: string;
}> = ({ value, unit, size = VOX_SIZES.hero, color = VOX_COLORS.charcoal }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
    <span style={{ fontFamily: VOX_FONTS.body, fontSize: size, fontWeight: 700, color }}>
      {value}
    </span>
    {unit && (
      <span style={{ fontFamily: VOX_FONTS.body, fontSize: size * 0.4, fontWeight: 500, color: VOX_COLORS.medGray }}>
        {unit}
      </span>
    )}
  </div>
);

export const VoxQuestion: React.FC<{
  text: string;
  size?: number;
}> = ({ text, size = VOX_SIZES.h1 }) => (
  <div style={{
    fontFamily: VOX_FONTS.headline,
    fontSize: size,
    fontWeight: 700,
    color: VOX_COLORS.charcoal,
    lineHeight: 1.2,
    textAlign: 'center' as const,
    fontStyle: 'italic',
  }}>
    {text}
  </div>
);

export const VoxSourceBadge: React.FC<{
  source: string;
  position?: 'bottom-left' | 'bottom-right' | 'top-right';
}> = ({ source, position = 'bottom-left' }) => {
  const posStyles: Record<string, React.CSSProperties> = {
    'bottom-left': { bottom: 12, left: 12 },
    'bottom-right': { bottom: 12, right: 12 },
    'top-right': { top: 12, right: 12 },
  };
  return (
    <div style={{
      position: 'absolute',
      ...posStyles[position],
      fontFamily: VOX_FONTS.body,
      fontSize: VOX_SIZES.tiny,
      color: VOX_COLORS.medGray,
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
    }}>
      Source: {source}
    </div>
  );
};
