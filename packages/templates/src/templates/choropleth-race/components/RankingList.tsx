import React from 'react';
import { interpolate, spring } from 'remotion';

interface RankedRegion {
  label: string;
  currentValue: number;
  originalIndex: number;
}

interface RankingListProps {
  regions: RankedRegion[];
  maxValue: number;
  frame: number;
  fps: number;
  font: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  metricLabel: string;
}

const ITEM_HEIGHT = 80;
const SIDEBAR_PADDING = 24;

const RankingList: React.FC<RankingListProps> = ({
  regions,
  maxValue,
  frame,
  fps,
  font,
  colors,
  metricLabel,
}) => {
  // Sort regions by current value descending to get rank order
  const sorted = [...regions]
    .map((r, i) => ({ ...r, currentRank: i }))
    .sort((a, b) => b.currentValue - a.currentValue);

  // Sidebar entrance spring
  const enterScale = spring({
    frame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const sidebarOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: SIDEBAR_PADDING,
        backgroundColor: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(12px)',
        opacity: sidebarOpacity,
        transform: `scaleX(${enterScale})`,
        transformOrigin: 'right center',
        overflow: 'hidden',
      }}
    >
      {/* Title */}
      <div
        style={{
          fontFamily: font,
          fontSize: 28,
          fontWeight: 800,
          color: colors.secondary,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          marginBottom: 12,
          paddingBottom: 12,
          borderBottom: `3px solid ${colors.primary}`,
        }}
      >
        Rankings
      </div>

      {/* Metric label */}
      <div
        style={{
          fontFamily: font,
          fontSize: 15,
          fontWeight: 500,
          color: colors.text,
          opacity: 0.6,
          marginBottom: 16,
        }}
      >
        {metricLabel}
      </div>

      {/* Ranking items */}
      <div style={{ position: 'relative', flex: 1 }}>
        {sorted.map((region, rankIndex) => {
          const barWidth = maxValue > 0 ? (region.currentValue / maxValue) * 100 : 0;

          const itemY = rankIndex * ITEM_HEIGHT;

          // Item entrance spring stagger
          const itemEnterFrame = rankIndex * 8;
          const itemScale = spring({
            frame: Math.max(0, frame - itemEnterFrame),
            fps,
            config: { damping: 22, stiffness: 180, mass: 0.8 },
          });

          const itemOpacity = interpolate(frame, [itemEnterFrame, itemEnterFrame + 15], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          return (
            <div
              key={region.label}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: itemY,
                height: ITEM_HEIGHT - 8,
                opacity: itemOpacity,
                transform: `scale(${itemScale})`,
                transformOrigin: 'left center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 6,
                }}
              >
                {/* Rank number */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    backgroundColor: rankIndex === 0 ? colors.primary : colors.secondary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: font,
                    fontSize: 16,
                    fontWeight: 800,
                    color: 'white',
                    flexShrink: 0,
                  }}
                >
                  {rankIndex + 1}
                </div>

                {/* Label and value */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: font,
                      fontSize: 18,
                      fontWeight: 700,
                      color: colors.text,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {region.label}
                  </div>
                </div>

                {/* Value */}
                <div
                  style={{
                    fontFamily: font,
                    fontSize: 18,
                    fontWeight: 800,
                    color: colors.primary,
                    flexShrink: 0,
                  }}
                >
                  {Math.round(region.currentValue)}
                </div>
              </div>

              {/* Bar */}
              <div
                style={{
                  height: 8,
                  backgroundColor: 'rgba(0,0,0,0.08)',
                  borderRadius: 4,
                  overflow: 'hidden',
                  marginLeft: 44,
                }}
              >
                <div
                  style={{
                    width: `${barWidth}%`,
                    height: '100%',
                    backgroundColor: rankIndex === 0 ? colors.primary : colors.accent,
                    borderRadius: 4,
                    transition: 'width 0.1s ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RankingList;
