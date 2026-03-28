import React from 'react';
import { AbsoluteFill } from 'remotion';
import { MAGAZINE_COLORS, MAGAZINE_FONTS, FONT_SIZES } from '../../../magazine/constants';
import { PaperTexture } from '../../../magazine/textures';
import { BurnEdge, FoldShadow } from '../../../magazine/effects';
import { SerifHeadline } from '../../../magazine/typography';

interface DocumentSheetProps {
  title: string;
  items: string[];
  /** 0-1 opacity for each item row (array length matches items) */
  itemOpacities: number[];
  /** Burn edge intensity (0-1), increases during exit */
  burnIntensity: number;
  children?: React.ReactNode;
}

export function DocumentSheet({
  title,
  items,
  itemOpacities,
  burnIntensity,
  children,
}: DocumentSheetProps) {
  return (
    <AbsoluteFill>
      {/* Aged paper background */}
      <PaperTexture age={0.8} opacity={1} seed="dossier-bg" />

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
          padding: '120px 70px 80px',
        }}
      >
        {/* Title with top rule */}
        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              width: '100%',
              height: 2,
              backgroundColor: MAGAZINE_COLORS.inkBlack,
              marginBottom: 24,
            }}
          />
          <SerifHeadline
            text={title}
            size={FONT_SIZES.h2}
            showRule={false}
            color={MAGAZINE_COLORS.inkBlack}
          />
          <div
            style={{
              width: '100%',
              height: 1,
              backgroundColor: MAGAZINE_COLORS.accent,
              marginTop: 20,
              opacity: 0.5,
            }}
          />
        </div>

        {/* Intel items as text rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                fontFamily: MAGAZINE_FONTS.body,
                fontSize: FONT_SIZES.h4,
                fontWeight: 400,
                color: MAGAZINE_COLORS.inkBlack,
                lineHeight: 1.4,
                opacity: itemOpacities[i] ?? 0,
                letterSpacing: '0.01em',
              }}
            >
              <span
                style={{
                  fontFamily: MAGAZINE_FONTS.accent,
                  fontSize: FONT_SIZES.small,
                  fontWeight: 600,
                  color: MAGAZINE_COLORS.secondary,
                  letterSpacing: '0.08em',
                  marginRight: 12,
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Dog-ear fold in top-right */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 0,
          height: 0,
          borderLeft: '60px solid transparent',
          borderTop: `60px solid rgba(0,0,0,0.08)`,
        }}
      />
      {/* Dog-ear triangle (folded paper showing) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 0,
          height: 0,
          borderRight: '60px solid #D8CDB8',
          borderBottom: '60px solid transparent',
        }}
      />
      {/* Dog-ear shadow */}
      <div
        style={{
          position: 'absolute',
          top: 50,
          right: 0,
          width: 70,
          height: 12,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.12) 0%, transparent 100%)',
          transform: 'rotate(-45deg)',
          transformOrigin: 'top right',
          pointerEvents: 'none',
        }}
      />

      {/* Fold shadow for paper depth */}
      <FoldShadow angle={90} position={0.5} depth={0.15} />

      {/* Burn edge (intensifies during exit) */}
      <BurnEdge intensity={burnIntensity} opacity={1} seed="dossier-burn" />

      {/* Stamp and other overlays go here */}
      {children}
    </AbsoluteFill>
  );
}
