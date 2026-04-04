import React from 'react';
import { useCurrentFrame } from 'remotion';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../../magazine/constants';
import { editorialReveal } from '../../../magazine/animations';

export function StepCircle({
  stepNumber, label, description, revealFrame,
}: {
  stepNumber: number; label: string; description?: string; revealFrame: number;
}) {
  const frame = useCurrentFrame();
  const reveal = editorialReveal(frame, revealFrame, 15);

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 28,
      opacity: reveal.opacity,
      transform: `translateY(${reveal.translateY}px)`,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        backgroundColor: MAGAZINE_COLORS.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h3,
          fontWeight: 700, color: '#ffffff', lineHeight: 1,
        }}>
          {stepNumber}
        </div>
      </div>
      <div style={{ paddingTop: 4, flex: 1 }}>
        <div style={{
          fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h2,
          fontWeight: 700, color: MAGAZINE_COLORS.text,
          lineHeight: 1.2, letterSpacing: '-0.01em',
        }}>
          {label}
        </div>
        {description && (
          <div style={{
            fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.large,
            color: MAGAZINE_COLORS.secondary, marginTop: 8, lineHeight: 1.3,
          }}>
            {description}
          </div>
        )}
      </div>
    </div>
  );
}
