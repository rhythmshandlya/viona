// packages/templates/src/templates/magazine-quote-depth/index.tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineQuoteDepthProps } from './schema';
import { editorialReveal, magazineEasing } from '../../magazine/animations';
import { MAGAZINE_FONTS, MAGAZINE_COLORS, FONT_SIZES } from '../../magazine/constants';
import { computeSpeakerPx } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;

const MagazineQuoteDepth: React.FC<MagazineQuoteDepthProps> = ({
  quote,
  author,
  role,
  context,
  speakerBbox,
  speakerCenter,
}) => {
  const frame = useCurrentFrame();

  const { bboxPx, centerPx } = computeSpeakerPx(
    speakerBbox,
    speakerCenter,
    CANVAS_W,
    CANVAS_H,
  );

  // Staggered reveals
  const quoteMarkReveal = editorialReveal(frame, 5, 15);
  const quoteTextReveal = editorialReveal(frame, 12, 20);
  const ruleProgress = interpolate(frame, [40, 55], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: magazineEasing,
  });
  const authorReveal = editorialReveal(frame, 50, 15);
  const roleReveal = editorialReveal(frame, 58, 12);
  const contextReveal = editorialReveal(frame, 68, 15);

  // Subtle breathing drift behind speaker
  const breathX = Math.sin(frame * 0.015) * 4;
  const breathY = Math.sin(frame * 0.02 + 1) * 3;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{
        position: 'absolute', inset: 0,
        transform: `translate(${breathX}px, ${breathY}px)`,
      }}>
        {/* Giant opening quotation mark — behind speaker center */}
        <div style={{
          position: 'absolute',
          left: centerPx.x - 160,
          top: bboxPx.y + bboxPx.h * 0.1,
          fontFamily: MAGAZINE_FONTS.headline,
          fontSize: 400,
          fontWeight: 700,
          color: MAGAZINE_COLORS.accent,
          opacity: quoteMarkReveal.opacity * 0.08,
          transform: `translateY(${quoteMarkReveal.translateY}px)`,
          lineHeight: 0.6,
          userSelect: 'none',
          pointerEvents: 'none',
        }}>
          {'\u201C'}
        </div>

        {/* Quote text — fills canvas, speaker body occludes middle */}
        <div style={{
          position: 'absolute',
          left: 60,
          right: 60,
          top: bboxPx.y + bboxPx.h * 0.15,
          opacity: quoteTextReveal.opacity,
          transform: `translateY(${quoteTextReveal.translateY}px)`,
        }}>
          <div style={{
            fontFamily: MAGAZINE_FONTS.headline,
            fontSize: 72,
            fontWeight: 700,
            color: MAGAZINE_COLORS.text,
            lineHeight: 1.25,
            letterSpacing: '-0.02em',
          }}>
            {quote}
          </div>
        </div>

        {/* Accent rule — below speaker area */}
        <div style={{
          position: 'absolute',
          left: 60,
          top: bboxPx.y + bboxPx.h + 40,
          width: `${ruleProgress * 30}%`,
          height: 4,
          backgroundColor: MAGAZINE_COLORS.accent,
          borderRadius: 2,
        }} />

        {/* Author — in bottom visible zone */}
        <div style={{
          position: 'absolute',
          left: 60,
          top: bboxPx.y + bboxPx.h + 60,
          opacity: authorReveal.opacity,
          transform: `translateY(${authorReveal.translateY}px)`,
        }}>
          <div style={{
            fontFamily: MAGAZINE_FONTS.headline,
            fontSize: FONT_SIZES.h3,
            fontWeight: 700,
            color: MAGAZINE_COLORS.text,
          }}>
            {'\u2014 '}{author}
          </div>
        </div>

        {/* Role */}
        {role && (
          <div style={{
            position: 'absolute',
            left: 86,
            top: bboxPx.y + bboxPx.h + 104,
            opacity: roleReveal.opacity,
            transform: `translateY(${roleReveal.translateY}px)`,
          }}>
            <div style={{
              fontFamily: MAGAZINE_FONTS.body,
              fontSize: FONT_SIZES.large,
              fontStyle: 'italic',
              color: MAGAZINE_COLORS.secondary,
            }}>
              {role}
            </div>
          </div>
        )}

        {/* Context */}
        {context && (
          <div style={{
            position: 'absolute',
            left: 60,
            top: bboxPx.y + bboxPx.h + 140,
            opacity: contextReveal.opacity,
            transform: `translateY(${contextReveal.translateY}px)`,
          }}>
            <div style={{
              fontFamily: MAGAZINE_FONTS.accent,
              fontSize: FONT_SIZES.small,
              color: MAGAZINE_COLORS.secondary,
              letterSpacing: '0.05em',
            }}>
              {context}
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export default MagazineQuoteDepth;
