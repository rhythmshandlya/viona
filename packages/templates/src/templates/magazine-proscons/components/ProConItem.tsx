import React from 'react';
import { useCurrentFrame } from 'remotion';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';
import { editorialReveal } from '../../../magazine/animations';

export function ProConItem({
  text, type, revealFrame,
}: {
  text: string; type: 'pro' | 'con'; revealFrame: number;
}) {
  const frame = useCurrentFrame();
  const reveal = editorialReveal(frame, revealFrame, 15);
  const isPro = type === 'pro';
  const iconColor = isPro ? '#16a34a' : MAGAZINE_COLORS.accent;
  const icon = isPro ? '\u2713' : '\u2717';

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 16,
      opacity: reveal.opacity,
      transform: `translateY(${reveal.translateY}px)`,
      marginBottom: 24,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        backgroundColor: iconColor, opacity: 0.15,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.large,
          fontWeight: 700, color: iconColor, lineHeight: 1,
        }}>
          {icon}
        </div>
      </div>
      <div style={{
        fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.h4,
        color: MAGAZINE_COLORS.text, lineHeight: 1.3, paddingTop: 4,
      }}>
        {text}
      </div>
    </div>
  );
}
