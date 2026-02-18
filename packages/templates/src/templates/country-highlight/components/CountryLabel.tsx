import React from 'react';
import { interpolate, useCurrentFrame, Easing } from 'remotion';

interface CountryLabelProps {
  label: string;
  fontSize: number;
  enterFrame: number;
  fontFamily: string;
  color: string;
}

const CountryLabel: React.FC<CountryLabelProps> = ({
  label,
  fontSize,
  enterFrame,
  fontFamily,
  color,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [enterFrame, enterFrame + 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const translateY = interpolate(frame, [enterFrame, enterFrame + 25], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div
      style={{
        position: 'absolute',
        top: '40%',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <span
        style={{
          fontFamily,
          fontWeight: 700,
          fontSize,
          color,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          textShadow: '0 2px 12px rgba(0,0,0,0.7), 0 0px 4px rgba(0,0,0,0.5)',
          textAlign: 'center',
        }}
      >
        {label}
      </span>
    </div>
  );
};

export default CountryLabel;
