import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import type { MagazineVersusProps } from './schema';
import { paperSlide, editorialReveal } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';
import { VsBadge } from './components/VsBadge';
import { ScaledContainer } from '../../magazine/ScaledContainer';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const SIDE_W = 440;
const SIDE_H = 800;
const LEFT_X = 40;
const RIGHT_X = 600;
const SIDES_Y = 480;
const STAT_STAGGER = 8;

const MagazineVersus: React.FC<MagazineVersusProps> = ({
  title, leftName, rightName, leftStats = [], rightStats = [],
}) => {
  const frame = useCurrentFrame();

  const titleReveal = editorialReveal(frame, 5, 15);
  const leftSlide = paperSlide(frame, 10, 25, 'left');
  const rightSlide = paperSlide(frame, 10, 25, 'right');
  const leftNameReveal = editorialReveal(frame, 30, 15);
  const rightNameReveal = editorialReveal(frame, 30, 15);

  return (
    <ScaledContainer baseWidth={1080} baseHeight={1920}>
      {/* Title */}
      {title && (
        <div style={{
          position: 'absolute', left: 0, top: 180, width: CANVAS_W,
          display: 'flex', justifyContent: 'center',
          opacity: titleReveal.opacity,
          transform: `translateY(${titleReveal.translateY}px)`,
        }}>
          <SectionLabel label={title} />
        </div>
      )}

      {/* VS Badge — center */}
      <div style={{
        position: 'absolute',
        left: CANVAS_W / 2 - 60, top: SIDES_Y + SIDE_H / 2 - 60,
        zIndex: 10,
      }}>
        <VsBadge appearFrame={5} />
      </div>

      {/* Left side */}
      <div style={{
        position: 'absolute',
        left: LEFT_X + leftSlide.translateX, top: SIDES_Y + leftSlide.translateY,
        opacity: leftSlide.opacity,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={290} width={SIDE_W} height={SIDE_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.2} seed="vs-left" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '40px 32px', boxSizing: 'border-box',
            }}>
              {/* Name */}
              <div style={{
                opacity: leftNameReveal.opacity,
                transform: `translateY(${leftNameReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h1,
                  fontWeight: 900, color: MAGAZINE_COLORS.text,
                  lineHeight: 1.1, letterSpacing: '-0.02em',
                }}>
                  {leftName}
                </div>
              </div>
              {/* Accent rule */}
              <div style={{
                width: 48, height: 3, backgroundColor: MAGAZINE_COLORS.accent,
                borderRadius: 1.5, marginTop: 20, marginBottom: 28,
              }} />
              {/* Stats */}
              {leftStats.map((stat, i) => {
                const reveal = editorialReveal(frame, 40 + i * STAT_STAGGER, 12);
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18,
                    opacity: reveal.opacity,
                    transform: `translateY(${reveal.translateY}px)`,
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      backgroundColor: MAGAZINE_COLORS.accent, flexShrink: 0,
                    }} />
                    <div style={{
                      fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.large,
                      color: MAGAZINE_COLORS.text, lineHeight: 1.3,
                    }}>
                      {stat}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TornEdge>
      </div>

      {/* Right side */}
      <div style={{
        position: 'absolute',
        left: RIGHT_X + rightSlide.translateX, top: SIDES_Y + rightSlide.translateY,
        opacity: rightSlide.opacity,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
      }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.4} seed={291} width={SIDE_W} height={SIDE_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.2} seed="vs-right" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '40px 32px', boxSizing: 'border-box',
            }}>
              {/* Name */}
              <div style={{
                opacity: rightNameReveal.opacity,
                transform: `translateY(${rightNameReveal.translateY}px)`,
              }}>
                <div style={{
                  fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.h1,
                  fontWeight: 900, color: MAGAZINE_COLORS.text,
                  lineHeight: 1.1, letterSpacing: '-0.02em',
                }}>
                  {rightName}
                </div>
              </div>
              {/* Accent rule */}
              <div style={{
                width: 48, height: 3, backgroundColor: MAGAZINE_COLORS.accent,
                borderRadius: 1.5, marginTop: 20, marginBottom: 28,
              }} />
              {/* Stats */}
              {rightStats.map((stat, i) => {
                const reveal = editorialReveal(frame, 40 + i * STAT_STAGGER, 12);
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18,
                    opacity: reveal.opacity,
                    transform: `translateY(${reveal.translateY}px)`,
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      backgroundColor: MAGAZINE_COLORS.accent, flexShrink: 0,
                    }} />
                    <div style={{
                      fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.large,
                      color: MAGAZINE_COLORS.text, lineHeight: 1.3,
                    }}>
                      {stat}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TornEdge>
      </div>
    </ScaledContainer>
  );
};

export default MagazineVersus;
