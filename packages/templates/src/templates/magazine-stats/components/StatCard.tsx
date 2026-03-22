import React from 'react';
import { useCurrentFrame, random } from 'remotion';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';
import { PaperTexture } from '../../../magazine/textures';
import { TornEdge } from '../../../magazine/effects';
import { parseValue, formatAnimatedValue } from './CountUp';

export function StatCard({
  value, label, index, countUpStart, width, height,
}: {
  value: string; label: string; index: number;
  countUpStart: number; width: number; height: number;
}) {
  const frame = useCurrentFrame();
  const rotation = (random(`stat-rot-${index}`) - 0.5) * 8;
  const parsed = parseValue(value);
  const displayValue = formatAnimatedValue(frame, countUpStart, 20, parsed, value);
  const valueColor = index % 2 === 0 ? MAGAZINE_COLORS.text : MAGAZINE_COLORS.stamp;

  return (
    <div style={{
      width, height,
      transform: `rotate(${rotation}deg)`,
      filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      position: 'relative',
    }}>
      <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={index * 9 + 2} width={width} height={height}>
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <PaperTexture age={0.2 + random(`stat-age-${index}`) * 0.3} seed={`stat-${index}`} />
          <div style={{
            position: 'relative', zIndex: 1, width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 24, boxSizing: 'border-box',
          }}>
            <div style={{
              fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.hero,
              fontWeight: 900, color: valueColor, lineHeight: 1.0,
              letterSpacing: '-0.02em', textAlign: 'center',
            }}>{displayValue}</div>
            <div style={{
              fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
              fontWeight: 700, color: MAGAZINE_COLORS.secondary,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              marginTop: 12, textAlign: 'center',
            }}>{label}</div>
          </div>
        </div>
      </TornEdge>
    </div>
  );
}
