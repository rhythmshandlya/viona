import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { useScale } from '../../../use-scale';
import type { Article } from '../schema';

interface ArticleFrameProps {
  article: Article;
  brandName: string;
  highlightColor: string;
  headlineFont: string;
  bodyFont: string;
  blurEnabled: boolean;
  blurIntensity: number;
  articleIndex: number;
}

const SOURCE_ACCENTS: Record<string, string> = {
  'The New York Times': '#121212',
  'The Wall Street Journal': '#0080C6',
  'Financial Times': '#FCD0B1',
  'The Washington Post': '#1C1E21',
  'Reuters': '#FF6600',
  'The Guardian': '#052962',
  'Bloomberg': '#1E1034',
  'BBC News': '#BB1919',
};

const SOURCE_BG: Record<string, string> = {
  'Financial Times': '#FFF1E5',
};

function highlightBrand(
  text: string,
  brandName: string,
  highlightColor: string,
  scale: number,
  bodyFont: string,
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  const lowerBrand = brandName.toLowerCase();
  let lastIndex = 0;
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const idx = lower.indexOf(lowerBrand, searchFrom);
    if (idx === -1) break;

    if (idx > lastIndex) {
      parts.push(
        <React.Fragment key={`t-${idx}`}>
          {text.slice(lastIndex, idx)}
        </React.Fragment>,
      );
    }

    parts.push(
      <span
        key={`hl-${idx}`}
        style={{
          backgroundColor: highlightColor,
          color: '#0D0D0D',
          padding: `${1 * scale}px ${5 * scale}px`,
          borderRadius: 2 * scale,
          fontWeight: 700,
          fontFamily: bodyFont,
          boxDecorationBreak: 'clone' as const,
          WebkitBoxDecorationBreak: 'clone' as const,
        }}
      >
        {text.slice(idx, idx + brandName.length)}
      </span>,
    );

    lastIndex = idx + brandName.length;
    searchFrom = lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(
      <React.Fragment key="t-end">
        {text.slice(lastIndex)}
      </React.Fragment>,
    );
  }

  return parts;
}

/**
 * Zoom factor — all font sizes and spacing are multiplied by this
 * to create the zoomed-in effect without a CSS transform.
 */
const Z = 1.6;

const ArticleFrame: React.FC<ArticleFrameProps> = ({
  article,
  brandName,
  highlightColor,
  headlineFont,
  bodyFont,
  blurEnabled,
  blurIntensity,
}) => {
  const { height } = useVideoConfig();
  const s = useScale();

  const bg = '#FAF9F6';
  const textPrimary = '#1C1C1C';
  const textSecondary = '#4A4A4A';
  const textMuted = '#8A8A8A';
  const ruleLine = '#D5D0C8';
  const sourceAccent = SOURCE_ACCENTS[article.source] || '#1C1C1C';

  // All sizes scaled by Z for the zoomed-in feel
  const px = s(44) * Z;
  const bodyFontSize = s(23) * Z;
  const bodyLH = 1.75;
  const lineHeightPx = bodyFontSize * bodyLH;

  // Body text first line is vertically centered on screen
  const bodyY = height / 2 - lineHeightPx / 2;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, overflow: 'hidden' }}>
      {/* ── Header: grows upward from just above body text ── */}
      <div
        style={{
          position: 'absolute',
          left: px,
          right: px,
          bottom: height - bodyY + s(14) * Z,
        }}
      >
        {/* Source name — large, newspaper masthead style */}
        <div
          style={{
            fontFamily: headlineFont,
            fontSize: s(16) * Z,
            fontWeight: 400,
            fontStyle: 'italic',
            color: textSecondary,
            letterSpacing: '0.02em',
            marginBottom: s(6) * Z,
          }}
        >
          {article.source}
        </div>

        {/* Section tag */}
        <div
          style={{
            display: 'inline-block',
            fontFamily: bodyFont,
            fontSize: s(9) * Z,
            fontWeight: 700,
            color: sourceAccent,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            borderBottom: `${s(2) * Z}px solid ${sourceAccent}`,
            paddingBottom: s(2) * Z,
            marginBottom: s(14) * Z,
          }}
        >
          {article.section}
        </div>

        {/* Headline — big serif */}
        <div
          style={{
            fontFamily: headlineFont,
            fontSize: s(article.headline.length > 55 ? 28 : 34) * Z,
            fontWeight: 700,
            color: textPrimary,
            lineHeight: 1.18,
            letterSpacing: '-0.015em',
            marginBottom: s(10) * Z,
          }}
        >
          {highlightBrand(article.headline, brandName, highlightColor, s(1) * Z, bodyFont)}
        </div>

        {/* Byline — thin, understated */}
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: s(10) * Z,
            fontWeight: 400,
            color: textMuted,
            letterSpacing: '0.01em',
            marginBottom: s(14) * Z,
          }}
        >
          {article.author}
          <span style={{ margin: `0 ${s(6) * Z}px`, color: '#CCC' }}>|</span>
          {article.date}
        </div>

        {/* Rule line — thin newspaper separator */}
        <div
          style={{
            width: '100%',
            height: 1,
            backgroundColor: ruleLine,
          }}
        />
      </div>

      {/* ── Body text: starts at fixed Y ── */}
      <div
        style={{
          position: 'absolute',
          top: bodyY,
          left: px,
          right: px,
          fontFamily: bodyFont,
          fontSize: bodyFontSize,
          lineHeight: bodyLH,
          color: textPrimary,
          fontWeight: 400,
          letterSpacing: '0.005em',
        }}
      >
        {highlightBrand(article.body, brandName, highlightColor, s(1) * Z, bodyFont)}
      </div>

      {/* ── Paper texture overlay ── */}
      <AbsoluteFill
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: `${s(256)}px`,
          pointerEvents: 'none',
          mixBlendMode: 'multiply',
          zIndex: 2,
        }}
      />

      {/* ── Vignette — warm off-white edges ── */}
      {blurEnabled && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(
              ellipse 58% 42% at 50% 50%,
              transparent 0%,
              ${bg}${Math.round(blurIntensity * 180).toString(16).padStart(2, '0')} 50%,
              ${bg}E8 70%,
              ${bg} 100%
            )`,
            pointerEvents: 'none',
            zIndex: 3,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

export default ArticleFrame;
