import React from 'react';
import { random } from 'remotion';
import { MAGAZINE_COLORS, MAGAZINE_FONTS, FONT_SIZES } from '../../../magazine/constants';
import { PaperTexture } from '../../../magazine/textures';
import { TornEdge } from '../../../magazine/effects';
import { SerifHeadline, SectionLabel } from '../../../magazine/typography';

type FragmentStyle = 'headline' | 'pullquote' | 'label' | 'stat';

/**
 * A single text fragment on a torn paper scrap.
 * Rendering varies by style prop.
 */
export function PaperClipping({
  text,
  style,
  index,
  width,
  height,
}: {
  text: string;
  style: FragmentStyle;
  index: number;
  width: number;
  height: number;
}) {
  // Deterministic rotation ±5° based on index
  const rotation = (random(`clipping-rot-${index}`) - 0.5) * 10;

  return (
    <div
      style={{
        width,
        height,
        transform: `rotate(${rotation}deg)`,
        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.4))',
        position: 'relative',
      }}
    >
      <TornEdge
        edges={['top', 'bottom', 'left', 'right']}
        roughness={0.5}
        seed={index * 7 + 3}
        width={width}
        height={height}
      >
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <PaperTexture age={0.3 + random(`clipping-age-${index}`) * 0.4} seed={`clipping-${index}`} />
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              boxSizing: 'border-box',
            }}
          >
            <FragmentContent text={text} style={style} index={index} />
          </div>
        </div>
      </TornEdge>
    </div>
  );
}

function FragmentContent({
  text,
  style,
  index,
}: {
  text: string;
  style: FragmentStyle;
  index: number;
}) {
  switch (style) {
    case 'headline':
      return <SerifHeadline text={text} size={FONT_SIZES.h2} />;

    case 'pullquote':
      return (
        <div
          style={{
            fontFamily: MAGAZINE_FONTS.body,
            fontSize: FONT_SIZES.h3,
            fontStyle: 'italic',
            color: MAGAZINE_COLORS.text,
            lineHeight: 1.3,
            textAlign: 'center',
          }}
        >
          &ldquo;{text}&rdquo;
        </div>
      );

    case 'label':
      return <SectionLabel label={text} />;

    case 'stat':
      return (
        <div
          style={{
            fontFamily: MAGAZINE_FONTS.headline,
            fontSize: FONT_SIZES.hero,
            fontWeight: 900,
            color: MAGAZINE_COLORS.stamp,
            lineHeight: 1.0,
            textAlign: 'center',
            letterSpacing: '-0.02em',
          }}
        >
          {text}
        </div>
      );

    default:
      return <SerifHeadline text={text} size={FONT_SIZES.h3} />;
  }
}
