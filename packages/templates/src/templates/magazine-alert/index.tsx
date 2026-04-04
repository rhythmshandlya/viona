import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineAlertProps } from './schema';
import { editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const CANVAS_W = 1080;
const BANNER_H = 680;
const BANNER_Y = 620;

const MagazineAlert: React.FC<MagazineAlertProps> = ({ label, headline, source, timestamp }) => {
  const frame = useCurrentFrame();

  // Red flash overlay (frames 0-12)
  const flashOpacity = interpolate(frame, [0, 4, 12], [0, 0.25, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Banner slides up from bottom (frames 2-18)
  const bannerSlideY = interpolate(frame, [2, 18], [BANNER_H + 40, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const bannerOpacity = interpolate(frame, [2, 10], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // "BREAKING" stamp slams in with scale bounce (frames 8-22)
  const stampScale = interpolate(frame, [8, 16, 22], [2.5, 0.95, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const stampOpacity = interpolate(frame, [8, 12], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Red accent bar draws (frames 14-28)
  const barProgress = interpolate(frame, [14, 28], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });

  // Headline reveals
  const headlineReveal = editorialReveal(frame, 22, 18);

  // Source line
  const sourceReveal = editorialReveal(frame, 38, 12);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Red flash overlay */}
      {flashOpacity > 0 && (
        <AbsoluteFill style={{ backgroundColor: MAGAZINE_COLORS.accent, opacity: flashOpacity }} />
      )}

      {/* Banner card */}
      <div style={{
        position: 'absolute', left: 0, top: BANNER_Y, width: CANVAS_W, height: BANNER_H,
        transform: `translateY(${bannerSlideY}px)`, opacity: bannerOpacity,
      }}>
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <PaperTexture age={0.05} seed="alert-paper" />

          {/* Top red bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: `${barProgress * 100}%`, height: 6,
            backgroundColor: MAGAZINE_COLORS.accent,
          }} />

          <div style={{
            position: 'relative', zIndex: 1,
            padding: '50px 60px', boxSizing: 'border-box',
          }}>
            {/* BREAKING stamp */}
            <div style={{
              transform: `scale(${stampScale})`, opacity: stampOpacity,
              transformOrigin: 'left center', marginBottom: 28,
            }}>
              <div style={{
                display: 'inline-block',
                fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.large,
                fontWeight: 900, color: '#ffffff',
                backgroundColor: MAGAZINE_COLORS.accent,
                padding: '8px 20px', letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}>
                {label}
              </div>
            </div>

            {/* Headline */}
            <div style={{
              opacity: headlineReveal.opacity,
              transform: `translateY(${headlineReveal.translateY}px)`,
            }}>
              <div style={{
                fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h1,
                fontWeight: 700, color: MAGAZINE_COLORS.text,
                lineHeight: 1.25, letterSpacing: '-0.01em',
              }}>
                {headline}
              </div>
            </div>

            {/* Source / timestamp */}
            {(source || timestamp) && (
              <div style={{
                marginTop: 28, opacity: sourceReveal.opacity,
                transform: `translateY(${sourceReveal.translateY}px)`,
                display: 'flex', gap: 16, alignItems: 'center',
              }}>
                {source && (
                  <div style={{
                    fontFamily: MAGAZINE_FONTS.accent, fontSize: FONT_SIZES.small,
                    fontWeight: 700, color: MAGAZINE_COLORS.secondary,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}>
                    {source}
                  </div>
                )}
                {source && timestamp && (
                  <div style={{
                    width: 4, height: 4, borderRadius: '50%',
                    backgroundColor: MAGAZINE_COLORS.secondary, opacity: 0.5,
                  }} />
                )}
                {timestamp && (
                  <div style={{
                    fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.small,
                    color: MAGAZINE_COLORS.secondary, fontStyle: 'italic',
                  }}>
                    {timestamp}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default MagazineAlert;
