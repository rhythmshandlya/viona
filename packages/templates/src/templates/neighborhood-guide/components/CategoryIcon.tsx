import React from 'react';
import { spring } from 'remotion';
import type { POICategory } from '../schema';

interface CategoryIconProps {
  x: number;
  y: number;
  label: string;
  category: POICategory;
  frame: number;
  enterFrame: number;
  fps: number;
  darkMap: boolean;
}

/** Per-category color palette */
export const CATEGORY_COLORS: Record<POICategory, string> = {
  food: '#E74C3C',
  shopping: '#9B59B6',
  parks: '#27AE60',
  transit: '#3498DB',
  nightlife: '#F39C12',
  culture: '#1ABC9C',
};

/** Small SVG icon for each category (viewBox 0 0 24 24) */
function CategorySVG({ category }: { category: POICategory }) {
  const color = '#FFFFFF';
  const size = 14;

  switch (category) {
    case 'food':
      // Fork and knife
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M11 2v20M7 2v6a4 4 0 0 0 4 4M17 2v4c0 1.1-.9 2-2 2h-1v12"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'shopping':
      // Shopping bag
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line x1="3" y1="6" x2="21" y2="6" stroke={color} strokeWidth="2" />
          <path
            d="M16 10a4 4 0 0 1-8 0"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'parks':
      // Tree
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 22v-7M12 15l-4-5h8l-4 5zM12 10L8 4h8l-4 6z"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'transit':
      // Train / subway
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <rect x="4" y="3" width="16" height="14" rx="3" stroke={color} strokeWidth="2" />
          <path
            d="M4 11h16M12 3v8"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M8 19l-2 2M16 19l2 2"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="8.5" cy="14.5" r="1" fill={color} />
          <circle cx="15.5" cy="14.5" r="1" fill={color} />
        </svg>
      );
    case 'nightlife':
      // Moon
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'culture':
      // Museum / columns
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L2 7h20L12 2z"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M5 7v12M9 7v12M15 7v12M19 7v12" stroke={color} strokeWidth="2" />
          <path
            d="M2 19h20"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

const CategoryIcon: React.FC<CategoryIconProps> = ({
  x,
  y,
  label,
  category,
  frame,
  enterFrame,
  fps,
  darkMap,
}) => {
  if (frame < enterFrame) return null;

  const localFrame = frame - enterFrame;

  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 22, stiffness: 180, mass: 0.8 },
  });

  const bgColor = CATEGORY_COLORS[category];
  const BUBBLE_SIZE = 34;
  const labelColor = darkMap ? '#FFFFFF' : '#2C3E50';

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center bottom',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      {/* Colored circle bubble */}
      <div
        style={{
          width: BUBBLE_SIZE,
          height: BUBBLE_SIZE,
          borderRadius: '50%',
          backgroundColor: bgColor,
          border: '2px solid rgba(255,255,255,0.9)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CategorySVG category={category} />
      </div>

      {/* Small stem / pointer */}
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: `6px solid ${bgColor}`,
          marginTop: -1,
        }}
      />

      {/* Label */}
      <div
        style={{
          marginTop: 3,
          backgroundColor: darkMap ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.88)',
          color: labelColor,
          fontSize: 11,
          fontWeight: 600,
          fontFamily: 'sans-serif',
          padding: '2px 5px',
          borderRadius: 4,
          whiteSpace: 'nowrap',
          maxWidth: 90,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          textAlign: 'center',
        }}
      >
        {label}
      </div>
    </div>
  );
};

export default CategoryIcon;
