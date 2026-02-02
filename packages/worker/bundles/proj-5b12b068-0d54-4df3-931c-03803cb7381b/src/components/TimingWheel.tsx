import React from 'react';
import { useCurrentFrame } from 'remotion';
import { COLORS } from '../constants';

interface TimingWheelProps {
  size: number;
  slots: number;
  rotationSpeed?: number;
  accentColor?: string;
  isSecondary?: boolean;
}

export const TimingWheel: React.FC<TimingWheelProps> = ({
  size,
  slots,
  rotationSpeed = 1,
  accentColor = COLORS.secondary,
  isSecondary = false
}) => {
  const frame = useCurrentFrame();
  const rotation = frame * rotationSpeed;

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      border: `8px solid ${accentColor}`,
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transform: `rotate(${rotation}deg)`,
      boxShadow: `0 0 40px ${accentColor}44`,
      background: isSecondary ? 'transparent' : `${COLORS.void}88`,
    }}>
      {/* Slots */}
      {Array.from({ length: slots }).map((_, i) => {
        const angle = (i / slots) * 360;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: 4,
              height: 20,
              background: i % 5 === 0 ? COLORS.white : accentColor,
              transform: `rotate(${angle}deg) translateY(-${size / 2 - 10}px)`,
              opacity: 0.6
            }}
          />
        );
      })}

      {/* Numbers (optional for clarity) */}
      {!isSecondary && Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * 360;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              color: COLORS.white,
              fontSize: size * 0.05,
              fontWeight: 'bold',
              transform: `rotate(${angle}deg) translateY(-${size * 0.35}px) rotate(${-angle - rotation}deg)`,
            }}
          >
            {i * 5}
          </div>
        );
      })}

      {/* Clock hand */}
      <div style={{
        position: 'absolute',
        width: 4,
        height: size * 0.45,
        background: COLORS.danger,
        bottom: '50%',
        transformOrigin: 'bottom',
        borderRadius: 2,
        boxShadow: `0 0 10px ${COLORS.danger}88`,
      }} />

      {/* Center hub */}
      <div style={{
        width: size * 0.1,
        height: size * 0.1,
        borderRadius: '50%',
        background: COLORS.white,
        zIndex: 2,
        boxShadow: `0 0 20px ${COLORS.white}`,
      }} />
    </div>
  );
};
