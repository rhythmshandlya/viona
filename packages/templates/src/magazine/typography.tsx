import React from 'react';
import { MAGAZINE_COLORS, MAGAZINE_FONTS, FONT_SIZES } from './constants';

/**
 * Large serif headline with editorial styling.
 */
export function SerifHeadline({
  text,
  size = FONT_SIZES.hero,
  showRule = false,
  color = MAGAZINE_COLORS.text,
  maxWidth,
}: {
  text: string;
  size?: number;
  showRule?: boolean;
  color?: string;
  maxWidth?: number;
}) {
  const rule = showRule ? (
    <div style={{
      width: '100%', height: 2,
      background: MAGAZINE_COLORS.accent,
      marginBottom: 12,
    }} />
  ) : null;

  return (
    <div style={{ maxWidth }}>
      {rule}
      <div
        style={{
          fontFamily: MAGAZINE_FONTS.headline,
          fontSize: size,
          fontWeight: 700,
          color,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
        }}
      >
        {text}
      </div>
      {showRule && (
        <div style={{
          width: '100%', height: 1,
          background: MAGAZINE_COLORS.accent,
          marginTop: 12,
          opacity: 0.5,
        }} />
      )}
    </div>
  );
}

/**
 * Byline — "By SOURCE" in small caps.
 */
export function Byline({ source, color = MAGAZINE_COLORS.secondary }: { source: string; color?: string }) {
  return (
    <div
      style={{
        fontFamily: MAGAZINE_FONTS.body,
        fontSize: FONT_SIZES.small,
        fontWeight: 400,
        color,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      By {source}
    </div>
  );
}

/**
 * Dateline — "MARCH 21, 2026 • WASHINGTON"
 */
export function Dateline({
  date,
  location,
  color = MAGAZINE_COLORS.secondary,
}: {
  date: string;
  location?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        fontFamily: MAGAZINE_FONTS.body,
        fontSize: FONT_SIZES.caption,
        fontWeight: 400,
        color,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        opacity: 0.7,
      }}
    >
      {date}{location ? ` \u2022 ${location}` : ''}
    </div>
  );
}

/**
 * Section label with horizontal rules: ── ANALYSIS ──
 */
export function SectionLabel({
  label,
  color = MAGAZINE_COLORS.accent,
}: {
  label: string;
  color?: string;
}) {
  const ruleStyle: React.CSSProperties = {
    flex: 1,
    height: 1,
    background: color,
    opacity: 0.5,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={ruleStyle} />
      <span
        style={{
          fontFamily: MAGAZINE_FONTS.accent,
          fontSize: FONT_SIZES.small,
          fontWeight: 600,
          color,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <div style={ruleStyle} />
    </div>
  );
}
