import React from 'react';
import { AbsoluteFill, random } from 'remotion';
import { MAGAZINE_COLORS, MAGAZINE_FONTS, FONT_SIZES } from '../../../magazine/constants';
import { PaperTexture, NewsprintGrain } from '../../../magazine/textures';
import { FoldShadow } from '../../../magazine/effects';
import { SerifHeadline, SectionLabel, Dateline } from '../../../magazine/typography';

interface NewspaperPageProps {
  headline: string;
  subhead: string;
  publicationDate: string;
  section: string;
  surroundOpacity: number;
  subheadOpacity: number;
  subheadTranslateY: number;
}

/** Blurred placeholder body text lines for the newspaper columns. */
function BodyTextPlaceholder({ columnIndex, seed }: { columnIndex: number; seed: string }) {
  const lineCount = 12;
  const lines: React.ReactNode[] = [];

  for (let i = 0; i < lineCount; i++) {
    const widthPct = 70 + random(`${seed}-col${columnIndex}-line${i}`) * 30;
    lines.push(
      <div
        key={i}
        style={{
          height: 8,
          width: `${widthPct}%`,
          backgroundColor: MAGAZINE_COLORS.inkBlack,
          opacity: 0.15,
          borderRadius: 1,
          marginBottom: 6,
        }}
      />,
    );
  }

  return <div>{lines}</div>;
}

/** Vertical column rule divider. */
function ColumnRule({ opacity }: { opacity: number }) {
  return (
    <div
      style={{
        width: 1,
        alignSelf: 'stretch',
        backgroundColor: MAGAZINE_COLORS.accent,
        opacity: opacity * 0.4,
      }}
    />
  );
}

export function NewspaperPage({
  headline,
  subhead,
  publicationDate,
  section,
  surroundOpacity,
  subheadOpacity,
  subheadTranslateY,
}: NewspaperPageProps) {
  return (
    <AbsoluteFill>
      {/* Paper background */}
      <PaperTexture age={0.6} opacity={1} seed="newspaper-bg" />
      <NewsprintGrain opacity={0.05} seed="newspaper-grain" />

      {/* Content container */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '80px 60px 60px',
        }}
      >
        {/* Masthead area */}
        <div style={{ opacity: surroundOpacity }}>
          {/* Top rule */}
          <div
            style={{
              width: '100%',
              height: 3,
              backgroundColor: MAGAZINE_COLORS.inkBlack,
              marginBottom: 12,
            }}
          />

          {/* Publication name */}
          <div
            style={{
              fontFamily: MAGAZINE_FONTS.headline,
              fontSize: FONT_SIZES.hero,
              fontWeight: 700,
              color: MAGAZINE_COLORS.inkBlack,
              textAlign: 'center',
              letterSpacing: '0.04em',
              lineHeight: 1,
              marginBottom: 8,
            }}
          >
            THE DAILY RECORD
          </div>

          {/* Thin rules around dateline */}
          <div
            style={{
              width: '100%',
              height: 1,
              backgroundColor: MAGAZINE_COLORS.inkBlack,
              opacity: 0.6,
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 0',
            }}
          >
            <Dateline date={publicationDate} color={MAGAZINE_COLORS.inkBlack} />
            <span
              style={{
                fontFamily: MAGAZINE_FONTS.body,
                fontSize: FONT_SIZES.caption,
                color: MAGAZINE_COLORS.inkBlack,
                opacity: 0.6,
              }}
            >
              Vol. CLXVII No. 248
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: 1,
              backgroundColor: MAGAZINE_COLORS.inkBlack,
              opacity: 0.6,
              marginBottom: 20,
            }}
          />
        </div>

        {/* Section label */}
        <div style={{ opacity: surroundOpacity, marginBottom: 20 }}>
          <SectionLabel label={section} color={MAGAZINE_COLORS.inkBlack} />
        </div>

        {/* Main headline */}
        <div style={{ marginBottom: 16 }}>
          <SerifHeadline
            text={headline}
            size={FONT_SIZES.hero}
            showRule={false}
            color={MAGAZINE_COLORS.inkBlack}
          />
        </div>

        {/* Subhead */}
        <div
          style={{
            opacity: subheadOpacity,
            transform: `translateY(${subheadTranslateY}px)`,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontFamily: MAGAZINE_FONTS.body,
              fontSize: FONT_SIZES.h3,
              fontWeight: 400,
              color: MAGAZINE_COLORS.inkBlack,
              opacity: 0.75,
              lineHeight: 1.3,
            }}
          >
            {subhead}
          </div>
        </div>

        {/* Thin rule below subhead */}
        <div
          style={{
            width: '100%',
            height: 1,
            backgroundColor: MAGAZINE_COLORS.accent,
            opacity: surroundOpacity * 0.5,
            marginBottom: 24,
          }}
        />

        {/* Body text columns (decorative) */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            flex: 1,
            opacity: surroundOpacity,
            overflow: 'hidden',
          }}
        >
          <div style={{ flex: 1 }}>
            <BodyTextPlaceholder columnIndex={0} seed="newspaper" />
          </div>
          <ColumnRule opacity={surroundOpacity} />
          <div style={{ flex: 1 }}>
            <BodyTextPlaceholder columnIndex={1} seed="newspaper" />
          </div>
          <ColumnRule opacity={surroundOpacity} />
          <div style={{ flex: 1 }}>
            <BodyTextPlaceholder columnIndex={2} seed="newspaper" />
          </div>
        </div>
      </div>

      {/* Fold shadow for 3D paper feel */}
      <FoldShadow angle={0} position={0.5} depth={0.15} />
    </AbsoluteFill>
  );
}
