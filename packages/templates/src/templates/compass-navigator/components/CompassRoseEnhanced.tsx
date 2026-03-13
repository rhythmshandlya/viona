import React from 'react';

interface CompassRoseEnhancedProps {
  size: number;
  compassStyle: 'classic' | 'modern' | 'nautical';
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

/**
 * Large ornate compass rose SVG with cardinal/intercardinal direction labels,
 * degree tick marks, and decorative inner rings.
 */
const CompassRoseEnhanced: React.FC<CompassRoseEnhancedProps> = ({
  size,
  compassStyle,
  primaryColor,
  secondaryColor,
  accentColor,
}) => {
  const center = size / 2;
  const outerRadius = size / 2 - 4;
  const tickOuterRadius = outerRadius - 2;
  const tickInnerRadiusMajor = outerRadius - 18;
  const tickInnerRadiusMinor = outerRadius - 10;
  const cardinalRadius = outerRadius - 34;
  const intercardinalRadius = outerRadius - 26;
  const innerRing1 = outerRadius - 44;
  const innerRing2 = outerRadius - 50;
  const starOuterRadius = innerRing2 - 8;
  const starInnerRadius = starOuterRadius * 0.38;

  const colors = getStyleColors(compassStyle, primaryColor, secondaryColor, accentColor);

  // Degree tick marks every 10 degrees, major every 30
  const ticks: React.ReactNode[] = [];
  for (let deg = 0; deg < 360; deg += 10) {
    const rad = (deg * Math.PI) / 180;
    const isMajor = deg % 30 === 0;
    const innerR = isMajor ? tickInnerRadiusMajor : tickInnerRadiusMinor;
    const x1 = center + Math.sin(rad) * innerR;
    const y1 = center - Math.cos(rad) * innerR;
    const x2 = center + Math.sin(rad) * tickOuterRadius;
    const y2 = center - Math.cos(rad) * tickOuterRadius;
    ticks.push(
      <line
        key={`tick-${deg}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={colors.tick}
        strokeWidth={isMajor ? 2 : 1}
        strokeLinecap="round"
      />
    );
  }

  // Cardinal labels: N, E, S, W
  const cardinals = [
    { label: 'N', angle: 0 },
    { label: 'E', angle: 90 },
    { label: 'S', angle: 180 },
    { label: 'W', angle: 270 },
  ];

  // Intercardinal labels: NE, SE, SW, NW
  const intercardinals = [
    { label: 'NE', angle: 45 },
    { label: 'SE', angle: 135 },
    { label: 'SW', angle: 225 },
    { label: 'NW', angle: 315 },
  ];

  // Star points for center decoration
  const starPoints = buildStarPoints(center, starOuterRadius, starInnerRadius, compassStyle === 'nautical' ? 16 : 8);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background circle */}
      <circle
        cx={center}
        cy={center}
        r={outerRadius}
        fill={colors.background}
        stroke={colors.ring}
        strokeWidth={3}
      />

      {/* Outer decorative ring */}
      <circle
        cx={center}
        cy={center}
        r={outerRadius - 1}
        fill="none"
        stroke={colors.ring}
        strokeWidth={1}
      />

      {/* Tick marks */}
      {ticks}

      {/* Inner ring 1 */}
      <circle
        cx={center}
        cy={center}
        r={innerRing1}
        fill="none"
        stroke={colors.ring}
        strokeWidth={1.5}
      />

      {/* Inner ring 2 */}
      <circle
        cx={center}
        cy={center}
        r={innerRing2}
        fill="none"
        stroke={colors.ring}
        strokeWidth={1}
      />

      {/* Center star/rose */}
      <polygon
        points={starPoints}
        fill={colors.starFill}
        stroke={colors.ring}
        strokeWidth={1}
        opacity={0.8}
      />

      {/* Small center circle */}
      <circle
        cx={center}
        cy={center}
        r={starInnerRadius * 0.5}
        fill={colors.centerDot}
        stroke={colors.ring}
        strokeWidth={1}
      />

      {/* Cardinal direction labels */}
      {cardinals.map(({ label, angle }) => {
        const rad = (angle * Math.PI) / 180;
        const x = center + Math.sin(rad) * cardinalRadius;
        const y = center - Math.cos(rad) * cardinalRadius;
        return (
          <text
            key={label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fill={label === 'N' ? colors.northLabel : colors.cardinalLabel}
            fontSize={size * 0.065}
            fontWeight="bold"
            fontFamily="serif"
          >
            {label}
          </text>
        );
      })}

      {/* Intercardinal direction labels */}
      {intercardinals.map(({ label, angle }) => {
        const rad = (angle * Math.PI) / 180;
        const x = center + Math.sin(rad) * intercardinalRadius;
        const y = center - Math.cos(rad) * intercardinalRadius;
        return (
          <text
            key={label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fill={colors.intercardinalLabel}
            fontSize={size * 0.038}
            fontWeight="600"
            fontFamily="serif"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
};

function getStyleColors(
  style: 'classic' | 'modern' | 'nautical',
  primaryColor: string,
  secondaryColor: string,
  accentColor: string,
) {
  switch (style) {
    case 'classic':
      return {
        background: '#FDF5E6',
        ring: secondaryColor,
        tick: secondaryColor,
        cardinalLabel: primaryColor,
        northLabel: accentColor,
        intercardinalLabel: '#6B4226',
        starFill: '#D4A76A',
        centerDot: secondaryColor,
      };
    case 'modern':
      return {
        background: '#FFFFFF',
        ring: '#333333',
        tick: '#555555',
        cardinalLabel: '#222222',
        northLabel: '#000000',
        intercardinalLabel: '#777777',
        starFill: '#E0E0E0',
        centerDot: '#333333',
      };
    case 'nautical':
      return {
        background: '#0C1B3A',
        ring: '#C9A84C',
        tick: '#C9A84C',
        cardinalLabel: '#F0E6C8',
        northLabel: '#C9A84C',
        intercardinalLabel: '#8B7D5C',
        starFill: '#1A3266',
        centerDot: '#C9A84C',
      };
  }
}

function buildStarPoints(
  cx: number,
  outerR: number,
  innerR: number,
  pointCount: number,
): string {
  const points: string[] = [];
  for (let i = 0; i < pointCount * 2; i++) {
    const angle = (i * Math.PI) / pointCount - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    points.push(`${cx + Math.cos(angle) * r},${cx + Math.sin(angle) * r}`);
  }
  return points.join(' ');
}

export default CompassRoseEnhanced;
