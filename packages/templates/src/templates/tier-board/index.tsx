import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants, BACKGROUNDS, TIER_COLORS } from './constants';
import type { TierBoardProps } from './schema';

const TIERS = ['S', 'A', 'B', 'C', 'D'] as const;

const TierBoard: React.FC<TierBoardProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];
  const items = props.items;

  const introOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const outroOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const titleOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Group items by tier
  const tierItems: Record<string, string[]> = { S: [], A: [], B: [], C: [], D: [] };
  items.forEach((item) => { if (tierItems[item.tier]) tierItems[item.tier].push(item.name); });

  // Flatten items in order for sequential reveal
  const orderedItems: { name: string; tier: string; indexInTier: number }[] = [];
  TIERS.forEach((t) => {
    tierItems[t].forEach((name, idx) => {
      orderedItems.push({ name, tier: t, indexInTier: idx });
    });
  });

  const ROW_TOP = s(100);
  const ROW_HEIGHT = s(160);
  const LABEL_WIDTH = s(90);
  const ROW_LEFT = s(40);
  const ROW_RIGHT = s(40);
  const ITEM_START_FRAME = 50;
  const ITEM_INTERVAL = Math.min(25, Math.floor((durationInFrames - 80 - ITEM_START_FRAME) / Math.max(orderedItems.length, 1)));

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, opacity: introOpacity * outroOpacity }}>
      {/* Title */}
      <div style={{ position: 'absolute', top: s(30), left: 0, right: 0, textAlign: 'center', opacity: titleOpacity }}>
        <span style={{ fontFamily: FONTS.body, fontSize: s(22), fontWeight: 600, letterSpacing: s(3), color: theme.textMuted, textTransform: 'uppercase' }}>{props.title}</span>
      </div>

      {/* Tier rows */}
      {TIERS.map((tier, rowIdx) => {
        const y = ROW_TOP + rowIdx * ROW_HEIGHT;
        const tierColor = TIER_COLORS[tier];

        // Row label entrance
        const rowEnter = 20 + rowIdx * 6;
        const rowOpacity = interpolate(frame, [rowEnter, rowEnter + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const rowSlideX = interpolate(frame, [rowEnter, rowEnter + 12], [-30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

        return (
          <div key={tier} style={{ position: 'absolute', left: ROW_LEFT, right: ROW_RIGHT, top: y, height: ROW_HEIGHT - s(12), display: 'flex', opacity: rowOpacity, transform: `translateX(${rowSlideX}px)` }}>
            {/* Tier label */}
            <div style={{
              width: LABEL_WIDTH,
              height: '100%',
              backgroundColor: tierColor,
              borderRadius: s(12),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontFamily: FONTS.headline, fontSize: s(48), fontWeight: 900, color: '#0B0F1A' }}>{tier}</span>
            </div>

            {/* Items area */}
            <div style={{
              flex: 1,
              marginLeft: s(10),
              backgroundColor: theme.rowBg,
              borderRadius: s(12),
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: s(10),
              padding: `${s(10)}px ${s(16)}px`,
              minHeight: ROW_HEIGHT - s(12),
            }}>
              {tierItems[tier].map((name, idx) => {
                // Find global index for timing
                const globalIdx = orderedItems.findIndex((o) => o.name === name && o.tier === tier && o.indexInTier === idx);
                const itemEnter = ITEM_START_FRAME + globalIdx * ITEM_INTERVAL;

                const chipScale = spring({ frame: frame - itemEnter, fps, config: { damping: 14, stiffness: 200, mass: 0.5 } });
                const chipOpacity = interpolate(frame, [itemEnter, itemEnter + 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

                return (
                  <div key={idx} style={{
                    backgroundColor: theme.itemBg,
                    borderRadius: s(8),
                    padding: `${s(8)}px ${s(18)}px`,
                    opacity: chipOpacity,
                    transform: `scale(${chipScale})`,
                  }}>
                    <span style={{ fontFamily: FONTS.body, fontSize: s(18), fontWeight: 600, color: theme.text, whiteSpace: 'nowrap' }}>{name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default TierBoard;
