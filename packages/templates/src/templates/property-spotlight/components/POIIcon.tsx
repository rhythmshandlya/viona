import React from 'react';
import { spring, interpolate } from 'remotion';
import type { AmenityCategory } from '../schema';

interface POIIconProps {
  x: number;
  y: number;
  label: string;
  category: AmenityCategory;
  frame: number;
  enterFrame: number;
  fps: number;
  darkMap?: boolean;
}

const CATEGORY_COLORS: Record<AmenityCategory, string> = {
  school: '#3498DB',
  park: '#27AE60',
  transit: '#E67E22',
  shop: '#9B59B6',
  restaurant: '#E74C3C',
  gym: '#F39C12',
};

function SchoolIcon({ color }: { color: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      {/* Graduation cap */}
      <ellipse cx={10} cy={7} rx={8} ry={2.5} fill={color} />
      <polygon points="10,4 3,7 10,10 17,7" fill={color} opacity={0.85} />
      <rect x={14} y={7} width={1.5} height={5} rx={0.75} fill={color} />
      <circle cx={14.75} cy={12.5} r={1.5} fill={color} />
      <rect x={6} y={10} width={8} height={5} rx={1} fill={color} opacity={0.7} />
    </svg>
  );
}

function ParkIcon({ color }: { color: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      {/* Tree */}
      <ellipse cx={10} cy={7} rx={6} ry={6} fill={color} />
      <ellipse cx={10} cy={10} rx={5} ry={5} fill={color} />
      <rect x={8.5} y={13} width={3} height={5} rx={1} fill={color} opacity={0.8} />
    </svg>
  );
}

function TransitIcon({ color }: { color: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      {/* Metro/train */}
      <rect x={3} y={3} width={14} height={11} rx={3} fill={color} />
      <rect x={5} y={5} width={4} height={4} rx={1} fill="white" opacity={0.9} />
      <rect x={11} y={5} width={4} height={4} rx={1} fill="white" opacity={0.9} />
      <rect x={3} y={11} width={14} height={2} fill={color} opacity={0.6} />
      <circle cx={6} cy={16} r={2} fill={color} />
      <circle cx={14} cy={16} r={2} fill={color} />
    </svg>
  );
}

function ShopIcon({ color }: { color: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      {/* Shopping bag */}
      <rect x={4} y={7} width={12} height={11} rx={2} fill={color} />
      <path
        d="M7 7C7 5.34315 8.34315 4 10 4C11.6569 4 13 5.34315 13 7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
        opacity={0.7}
      />
      <rect x={7} y={10} width={6} height={1.5} rx={0.75} fill="white" opacity={0.7} />
    </svg>
  );
}

function RestaurantIcon({ color }: { color: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      {/* Fork and knife */}
      <rect x={6} y={2} width={1.5} height={12} rx={0.75} fill={color} />
      <path d="M5 2 L5 7 Q6.75 8.5 8.5 7 L8.5 2" stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <rect x={13} y={2} width={1.5} height={16} rx={0.75} fill={color} />
      <path d="M11.5 2 L11.5 8 Q13.25 10 15 8 L15 2" stroke={color} strokeWidth={1} fill="none" strokeLinecap="round" />
    </svg>
  );
}

function GymIcon({ color }: { color: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      {/* Dumbbell */}
      <rect x={8} y={9} width={4} height={2} rx={1} fill={color} />
      <rect x={2} y={7} width={3} height={6} rx={1.5} fill={color} />
      <rect x={1} y={8.5} width={2} height={3} rx={1} fill={color} />
      <rect x={15} y={7} width={3} height={6} rx={1.5} fill={color} />
      <rect x={17} y={8.5} width={2} height={3} rx={1} fill={color} />
      <rect x={5} y={9} width={3} height={2} rx={1} fill={color} />
      <rect x={12} y={9} width={3} height={2} rx={1} fill={color} />
    </svg>
  );
}

function CategoryIcon({ category, color }: { category: AmenityCategory; color: string }) {
  switch (category) {
    case 'school': return <SchoolIcon color={color} />;
    case 'park': return <ParkIcon color={color} />;
    case 'transit': return <TransitIcon color={color} />;
    case 'shop': return <ShopIcon color={color} />;
    case 'restaurant': return <RestaurantIcon color={color} />;
    case 'gym': return <GymIcon color={color} />;
  }
}

const POIIcon: React.FC<POIIconProps> = ({
  x,
  y,
  label,
  category,
  frame,
  enterFrame,
  fps,
  darkMap = false,
}) => {
  const progress = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 22, stiffness: 180, mass: 0.8 },
  });

  const scale = interpolate(progress, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = interpolate(progress, [0, 0.4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (scale < 0.01) return null;

  const color = CATEGORY_COLORS[category];
  const labelColor = darkMap ? '#FFFFFF' : '#2C3E50';
  const bgColor = darkMap ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.92)';

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      {/* Icon bubble */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          backgroundColor: bgColor,
          border: `2px solid ${color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 2px 8px ${color}44`,
        }}
      >
        <CategoryIcon category={category} color={color} />
      </div>
      {/* Label */}
      <div
        style={{
          marginTop: 3,
          paddingLeft: 5,
          paddingRight: 5,
          paddingTop: 1,
          paddingBottom: 1,
          borderRadius: 4,
          backgroundColor: bgColor,
          color: labelColor,
          fontSize: 9,
          fontWeight: 600,
          fontFamily: 'Inter, sans-serif',
          whiteSpace: 'nowrap',
          maxWidth: 80,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textAlign: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        }}
      >
        {label}
      </div>
    </div>
  );
};

export default POIIcon;
