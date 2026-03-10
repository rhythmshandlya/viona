import React from 'react';
import { spring, interpolate } from 'remotion';
import type { POICategory } from '../schema';

interface CategoryEntry {
  name: POICategory;
  color: string;
  count: number;
}

interface CategoryLegendProps {
  categories: CategoryEntry[];
  activeCategory: POICategory | null;
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
}

const CATEGORY_LABELS: Record<POICategory, string> = {
  food: 'Food',
  shopping: 'Shopping',
  parks: 'Parks',
  transit: 'Transit',
  nightlife: 'Nightlife',
  culture: 'Culture',
};

const CategoryLegend: React.FC<CategoryLegendProps> = ({
  categories,
  activeCategory,
  frame,
  fps,
  font,
  colors,
}) => {
  // Panel slides up from bottom
  const PANEL_ENTER = 30;
  const panelSlide = spring({
    frame: Math.max(0, frame - PANEL_ENTER),
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const panelY = interpolate(panelSlide, [0, 1], [80, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const panelOpacity = interpolate(frame, [PANEL_ENTER, PANEL_ENTER + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '100%',
        transform: `translateY(${panelY}px)`,
        opacity: panelOpacity,
        backgroundColor: 'rgba(245,240,235,0.96)',
        borderTop: `3px solid ${colors.primary}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px',
        gap: 0,
      }}
    >
      {/* Section title */}
      <div
        style={{
          fontFamily: font,
          fontSize: 22,
          fontWeight: 700,
          color: colors.secondary,
          marginBottom: 18,
          letterSpacing: 0.5,
        }}
      >
        Explore the Neighborhood
      </div>

      {/* Pills row — wraps to two rows if needed */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
          justifyContent: 'center',
          width: '100%',
        }}
      >
        {categories.map((cat) => {
          const isActive = activeCategory === cat.name;

          // Compute per-pill spring scale based on active state
          const pillScale = spring({
            frame: isActive ? Math.max(0, frame) : 0,
            fps,
            config: { damping: 22, stiffness: 180, mass: 0.8 },
            to: isActive ? 1.1 : 1,
            from: 1,
          });

          const scale = isActive ? pillScale : 1;

          return (
            <div
              key={cat.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                backgroundColor: isActive ? cat.color : 'rgba(255,255,255,0.9)',
                border: isActive
                  ? `2px solid ${cat.color}`
                  : '2px solid rgba(0,0,0,0.1)',
                borderRadius: 24,
                padding: '7px 14px',
                transform: `scale(${scale})`,
                transformOrigin: 'center center',
                boxShadow: isActive
                  ? `0 0 12px ${cat.color}66, 0 3px 8px rgba(0,0,0,0.15)`
                  : '0 2px 6px rgba(0,0,0,0.08)',
                transition: 'none',
              }}
            >
              {/* Colored dot */}
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: isActive ? '#FFFFFF' : cat.color,
                  flexShrink: 0,
                }}
              />

              {/* Category label */}
              <span
                style={{
                  fontFamily: font,
                  fontSize: 16,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#FFFFFF' : colors.text,
                  lineHeight: 1,
                }}
              >
                {CATEGORY_LABELS[cat.name]}
              </span>

              {/* Count badge */}
              <span
                style={{
                  fontFamily: font,
                  fontSize: 13,
                  fontWeight: 600,
                  color: isActive ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.4)',
                  lineHeight: 1,
                }}
              >
                {cat.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryLegend;
