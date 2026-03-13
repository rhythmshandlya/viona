import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';
import { useScale } from '../../../use-scale';

interface OdometerCounterProps {
  totalKm: number;
  progress: number;
  frame: number;
  enterFrame: number;
  unit: 'miles' | 'km';
  font: string;
}

const KM_TO_MILES = 0.621371;

/**
 * Individual digit slot with rolling animation.
 * The digit slides up when transitioning to a new value.
 */
const DigitSlot: React.FC<{
  value: number;
  font: string;
  fontSize: number;
}> = ({ value, font, fontSize }) => {
  const slotHeight = fontSize * 1.3;

  // Use fractional part for smooth rolling
  const intPart = Math.floor(value);
  const fracPart = value - intPart;
  const currentDigit = intPart % 10;
  const nextDigit = (currentDigit + 1) % 10;

  const offset = fracPart * slotHeight;

  return (
    <div
      style={{
        width: fontSize * 0.65,
        height: slotHeight,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: 'rgba(80, 60, 40, 0.5)',
        borderRight: '1px solid rgba(196, 163, 90, 0.2)',
      }}
    >
      {/* Current digit */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: slotHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: font,
          fontSize,
          fontWeight: 700,
          color: '#F5EDE0',
          fontVariantNumeric: 'tabular-nums',
          transform: `translateY(${-offset}px)`,
        }}
      >
        {currentDigit}
      </div>
      {/* Next digit (below) */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: slotHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: font,
          fontSize,
          fontWeight: 700,
          color: '#F5EDE0',
          fontVariantNumeric: 'tabular-nums',
          transform: `translateY(${slotHeight - offset}px)`,
        }}
      >
        {nextDigit}
      </div>
    </div>
  );
};

const OdometerCounter: React.FC<OdometerCounterProps> = ({
  totalKm,
  progress,
  frame,
  enterFrame,
  unit,
  font,
}) => {
  const { fps } = useVideoConfig();
  const s = useScale();

  if (frame < enterFrame) return null;

  const enterScale = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 22, stiffness: 160, mass: 0.9 },
  });

  const opacity = interpolate(frame, [enterFrame, enterFrame + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const totalDistance = unit === 'miles' ? totalKm * KM_TO_MILES : totalKm;
  const currentDistance = totalDistance * progress;
  const suffix = unit === 'miles' ? 'MI' : 'KM';
  const fontSize = s(30);

  // Break number into individual digit values (with fractional rolling)
  const maxDigits = Math.max(4, Math.ceil(Math.log10(totalDistance + 1)) + 1);
  const digits: number[] = [];

  for (let i = maxDigits - 1; i >= 0; i--) {
    const placeValue = Math.pow(10, i);
    const digitValue = (currentDistance / placeValue) % 10;
    digits.push(digitValue);
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: s(50),
        left: '50%',
        transform: `translateX(-50%) scale(${enterScale})`,
        transformOrigin: 'bottom center',
        opacity,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#3D2B1F',
          border: '2px solid #C4A35A',
          borderRadius: 6,
          padding: '4px 6px',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        {/* Digit slots */}
        <div style={{ display: 'flex', gap: 1, borderRadius: 3, overflow: 'hidden' }}>
          {digits.map((val, i) => (
            <DigitSlot key={i} value={val} font={font} fontSize={fontSize} />
          ))}
        </div>

        {/* Unit suffix */}
        <div
          style={{
            fontFamily: font,
            fontSize: fontSize * 0.5,
            fontWeight: 700,
            color: '#C4A35A',
            marginLeft: 8,
            letterSpacing: 1,
          }}
        >
          {suffix}
        </div>
      </div>
    </div>
  );
};

export default OdometerCounter;
