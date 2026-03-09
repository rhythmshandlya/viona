import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';
import { useScale } from '../../../use-scale';

interface CardShellProps {
  children: React.ReactNode;
  frame: number;
  enterFrame: number;
  exitFrame: number;
  cardStyle: 'glass' | 'solid' | 'gradient' | 'outline';
  cardBg: string;
  cardBorder: string;
  accentColor: string;
}

const CardShell: React.FC<CardShellProps> = ({
  children,
  frame,
  enterFrame,
  exitFrame,
  cardStyle,
  cardBg,
  cardBorder,
  accentColor,
}) => {
  const { fps } = useVideoConfig();
  const s = useScale();
  const localFrame = frame - enterFrame;

  const entranceScale = spring({
    frame: localFrame,
    fps,
    config: { damping: 20, stiffness: 120, mass: 0.8 },
  });

  const entranceY = interpolate(entranceScale, [0, 1], [40, 0]);
  const entranceOpacity = interpolate(localFrame, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const exitOpacity = interpolate(frame, [exitFrame - 8, exitFrame], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const exitScale = interpolate(frame, [exitFrame - 8, exitFrame], [1, 0.97], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (frame < enterFrame || frame > exitFrame) return null;

  const scale = entranceScale * exitScale;
  const opacity = entranceOpacity * exitOpacity;

  const cardBackground = (() => {
    switch (cardStyle) {
      case 'glass':
        return cardBg;
      case 'solid':
        return cardBg.replace(/[\d.]+\)$/, '0.12)');
      case 'gradient':
        return `linear-gradient(135deg, ${accentColor}18 0%, ${cardBg} 100%)`;
      case 'outline':
        return 'transparent';
    }
  })();

  const border = cardStyle === 'outline'
    ? `1.5px solid ${cardBorder.replace(/[\d.]+\)$/, '0.2)')}`
    : `1px solid ${cardBorder}`;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        transform: `translateY(${entranceY}px) scale(${scale})`,
      }}
    >
      <div
        style={{
          width: s(900),
          minHeight: s(600),
          borderRadius: s(32),
          background: cardBackground,
          border,
          backdropFilter: cardStyle === 'glass' ? `blur(${s(20)}px)` : undefined,
          WebkitBackdropFilter: cardStyle === 'glass' ? `blur(${s(20)}px)` : undefined,
          padding: `${s(56)}px ${s(64)}px`,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: cardStyle !== 'outline' ? `0 ${s(8)}px ${s(32)}px rgba(0, 0, 0, 0.2)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default CardShell;
