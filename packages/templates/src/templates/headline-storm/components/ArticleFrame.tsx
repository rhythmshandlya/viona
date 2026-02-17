import React from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
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
  'The Wall Street Journal': '#0274B6',
  'Financial Times': '#0D7680',
  'The Washington Post': '#1C1E21',
  'Reuters': '#FF8000',
  'The Guardian': '#052962',
  'Bloomberg': '#472A91',
  'BBC News': '#BB1919',
};

function highlightBrand(
  text: string,
  brandName: string,
  highlightColor: string,
  scale: number,
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
          color: '#111111',
          padding: `${2 * scale}px ${6 * scale}px`,
          borderRadius: 3 * scale,
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

const ArticleFrame: React.FC<ArticleFrameProps> = ({
  article,
  brandName,
  highlightColor,
  headlineFont,
  bodyFont,
  blurEnabled,
  blurIntensity,
}) => {
  const { width, height } = useVideoConfig();
  const s = width / 1080;

  const bg = '#FFFFFF';
  const textPrimary = '#111111';
  const textSecondary = '#555555';
  const textMuted = '#999999';
  const borderLight = '#E5E5E5';
  const sourceAccent = SOURCE_ACCENTS[article.source] || '#111111';

  const px = 55 * s;
  const bodyFontSize = 24 * s;
  const bodyLH = 1.7;
  const lineHeightPx = bodyFontSize * bodyLH;

  // Estimate which line the brand name sits on, so we can
  // shift the entire block to place it at the vertical center.
  const contentWidth = width - 2 * px;
  const avgCharWidth = bodyFontSize * 0.48; // approximate for sans-serif
  const charsPerLine = Math.floor(contentWidth / avgCharWidth);

  const fullText = article.body;
  const lowerFull = fullText.toLowerCase();
  const brandIdx = lowerFull.indexOf(brandName.toLowerCase());
  const charsBefore = brandIdx >= 0 ? brandIdx : Math.floor(fullText.length / 2);

  // Line number where brand appears (0-indexed)
  const brandLine = charsBefore / charsPerLine;

  // Header height estimate: source bar + headline + byline + separator
  const headerHeight =
    (26 * s) +       // source bar
    (12 * s) +       // gap
    ((article.headline.length > 55 ? 32 : 38) * s * 1.15 * 2) + // headline (~2 lines)
    (8 * s) +        // gap
    (20 * s) +       // byline
    (14 * s) +       // gap
    1 +              // separator
    (12 * s);        // gap after separator

  // Y position of brand name relative to top of the content block
  const brandY = headerHeight + brandLine * lineHeightPx;

  // We want brandY to appear at height/2, so shift the block up
  const offsetY = height / 2 - brandY;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, overflow: 'hidden' }}>
      {/* Single continuous content block, shifted so brand name is at vertical center */}
      <div
        style={{
          position: 'absolute',
          top: offsetY,
          left: px,
          right: px,
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 14 * s }}>
          {/* Source + section */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10 * s,
              marginBottom: 12 * s,
            }}
          >
            <div
              style={{
                width: 4 * s,
                height: 26 * s,
                backgroundColor: sourceAccent,
                borderRadius: 2 * s,
                flexShrink: 0,
              }}
            />
            <div
              style={{
                fontFamily: headlineFont,
                fontSize: 20 * s,
                fontWeight: 700,
                color: textPrimary,
              }}
            >
              {article.source}
            </div>
            <span
              style={{
                fontFamily: bodyFont,
                fontSize: 11 * s,
                fontWeight: 700,
                color: sourceAccent,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: `${2 * s}px ${8 * s}px`,
                backgroundColor: `${sourceAccent}14`,
                borderRadius: 3 * s,
                marginLeft: 'auto',
              }}
            >
              {article.section}
            </span>
          </div>

          {/* Headline — also highlight brand in headline */}
          <div
            style={{
              fontFamily: headlineFont,
              fontSize: (article.headline.length > 55 ? 32 : 38) * s,
              fontWeight: 800,
              color: textPrimary,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              marginBottom: 8 * s,
            }}
          >
            {highlightBrand(article.headline, brandName, highlightColor, s)}
          </div>

          {/* Byline */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6 * s,
            }}
          >
            <div
              style={{
                width: 20 * s,
                height: 20 * s,
                borderRadius: '50%',
                backgroundColor: borderLight,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: bodyFont,
                fontSize: 11 * s,
                fontWeight: 600,
                color: textSecondary,
              }}
            >
              {article.author}
            </span>
            <span
              style={{
                fontFamily: bodyFont,
                fontSize: 11 * s,
                color: textMuted,
              }}
            >
              {article.date}
            </span>
          </div>
        </div>

        {/* Separator */}
        <div
          style={{
            width: '100%',
            height: 1,
            backgroundColor: borderLight,
            marginBottom: 12 * s,
          }}
        />

        {/* Body text — one continuous flow with brand highlighted inline */}
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: bodyFontSize,
            lineHeight: bodyLH,
            color: textPrimary,
          }}
        >
          {highlightBrand(fullText, brandName, highlightColor, s)}
        </div>
      </div>

      {/* Radial vignette */}
      {blurEnabled && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(
              ellipse 65% 50% at 50% 50%,
              transparent 0%,
              ${bg}${Math.round(blurIntensity * 220).toString(16).padStart(2, '0')} 60%,
              ${bg}F0 80%,
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
