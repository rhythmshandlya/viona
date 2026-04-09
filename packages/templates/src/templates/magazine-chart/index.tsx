import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';
import type { MagazineChartProps } from './schema';
import { ScaledContainer } from '../../magazine/ScaledContainer';
import { paperSlide, editorialReveal, magazineEasing } from '../../magazine/animations';
import { PaperTexture } from '../../magazine/textures';
import { TornEdge } from '../../magazine/effects';
import { SerifHeadline, SectionLabel } from '../../magazine/typography';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1500;
const BAR_MAX_W = 580;
const BAR_H = 36;
const BAR_STAGGER = 10;

const MagazineChart: React.FC<MagazineChartProps> = ({ title, bars = [], unit }) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 20, 'up');
  const labelReveal = editorialReveal(frame, 14, 12);
  const titleReveal = editorialReveal(frame, 20, 15);

  const maxValue = Math.max(...bars.map((b) => b.value), 1);

  const cardX = (CANVAS_W - CARD_W) / 2 + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + cardSlide.translateY;

  return (
    <ScaledContainer baseWidth={1080} baseHeight={1920}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardSlide.opacity }}>
        <TornEdge edges={['top', 'bottom', 'left', 'right']} roughness={0.5} seed={350} width={CARD_W} height={CARD_H}>
          <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <PaperTexture age={0.15} seed="chart" />
            <div style={{
              position: 'relative', zIndex: 1, width: '100%', height: '100%',
              padding: '60px 50px', boxSizing: 'border-box',
            }}>
              {/* Section label */}
              <div style={{
                opacity: labelReveal.opacity,
                transform: `translateY(${labelReveal.translateY}px)`,
              }}>
                <SectionLabel label="Data" />
              </div>

              {/* Title */}
              <div style={{
                marginTop: 24,
                opacity: titleReveal.opacity,
                transform: `translateY(${titleReveal.translateY}px)`,
              }}>
                <SerifHeadline text={title} size={FONT_SIZES.h1} showRule />
              </div>

              {/* Bars */}
              <div style={{ marginTop: 50 }}>
                {bars.map((bar, i) => {
                  const barStart = 35 + i * BAR_STAGGER;
                  const reveal = editorialReveal(frame, barStart, 12);
                  const barFill = interpolate(frame, [barStart + 5, barStart + 25], [0, 1], {
                    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
                  });
                  const barWidth = (bar.value / maxValue) * BAR_MAX_W * barFill;

                  return (
                    <div key={i} style={{
                      marginBottom: 32,
                      opacity: reveal.opacity,
                      transform: `translateY(${reveal.translateY}px)`,
                    }}>
                      {/* Label row */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', marginBottom: 10,
                      }}>
                        <div style={{
                          fontFamily: MAGAZINE_FONTS.body, fontSize: FONT_SIZES.large,
                          color: MAGAZINE_COLORS.text, fontWeight: 600,
                        }}>
                          {bar.label}
                        </div>
                        <div style={{
                          fontFamily: MAGAZINE_FONTS.headline, fontSize: FONT_SIZES.large,
                          fontWeight: 700, color: MAGAZINE_COLORS.accent,
                        }}>
                          {bar.value}{unit}
                        </div>
                      </div>
                      {/* Bar track */}
                      <div style={{
                        width: BAR_MAX_W, height: BAR_H,
                        backgroundColor: 'rgba(15,23,42,0.06)', borderRadius: 4,
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: barWidth, height: '100%',
                          backgroundColor: i === 0 ? MAGAZINE_COLORS.accent : MAGAZINE_COLORS.inkBlack,
                          borderRadius: 4, opacity: i === 0 ? 1 : 0.7,
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </TornEdge>
      </div>
    </ScaledContainer>
  );
};

export default MagazineChart;
