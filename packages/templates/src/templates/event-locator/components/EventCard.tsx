import React from 'react';
import { spring, interpolate } from 'remotion';

interface EventCardColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

interface EventCardProps {
  x: number;
  y: number;
  eventName: string;
  eventDate: string;
  eventTime: string;
  address: string;
  frame: number;
  enterFrame: number;
  fps: number;
  font: { headline: string; body: string };
  colors: EventCardColors;
}

const EventCard: React.FC<EventCardProps> = ({
  x,
  y,
  eventName,
  eventDate,
  eventTime,
  address,
  frame,
  enterFrame,
  fps,
  font,
  colors,
}) => {
  if (frame < enterFrame) return null;

  const localFrame = frame - enterFrame;

  // Slide from left (from pin position)
  const slideSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const translateX = interpolate(slideSpring, [0, 1], [-60, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = interpolate(localFrame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const cardWidth = 320;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translateX(${translateX}px)`,
        opacity,
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      {/* Backdrop blur layer */}
      <div
        style={{
          position: 'absolute',
          inset: -6,
          borderRadius: 20,
          backgroundColor: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(8px)',
        }}
      />

      {/* Card body */}
      <div
        style={{
          position: 'relative',
          width: cardWidth,
          backgroundColor: 'rgba(255,255,255,0.97)',
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            height: 5,
            backgroundColor: colors.accent,
          }}
        />

        <div style={{ padding: '16px 20px 18px' }}>
          {/* Event name */}
          <div
            style={{
              fontFamily: font.headline,
              fontSize: 22,
              fontWeight: 700,
              color: colors.secondary,
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              marginBottom: 10,
            }}
          >
            {eventName}
          </div>

          {/* Separator */}
          <div
            style={{
              height: 1,
              backgroundColor: colors.accent,
              opacity: 0.35,
              marginBottom: 10,
            }}
          />

          {/* Date + time row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            {/* Calendar icon */}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="3" width="14" height="12" rx="2" stroke={colors.accent} strokeWidth="1.5" />
              <path d="M5 1v4M11 1v4" stroke={colors.accent} strokeWidth="1.5" strokeLinecap="round" />
              <path d="M1 7h14" stroke={colors.accent} strokeWidth="1.5" />
            </svg>
            <span
              style={{
                fontFamily: font.body,
                fontSize: 13,
                fontWeight: 600,
                color: colors.text,
                letterSpacing: '0.01em',
              }}
            >
              {eventDate}
            </span>
            <span
              style={{
                fontFamily: font.body,
                fontSize: 13,
                fontWeight: 400,
                color: colors.secondary,
                opacity: 0.6,
              }}
            >
              •
            </span>
            <span
              style={{
                fontFamily: font.body,
                fontSize: 13,
                fontWeight: 500,
                color: colors.secondary,
                opacity: 0.8,
              }}
            >
              {eventTime}
            </span>
          </div>

          {/* Address row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            {/* Location icon */}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ marginTop: 1, flexShrink: 0 }}>
              <path
                d="M8 1C5.239 1 3 3.239 3 6c0 4.5 5 9 5 9s5-4.5 5-9c0-2.761-2.239-5-5-5z"
                stroke={colors.primary}
                strokeWidth="1.5"
              />
              <circle cx="8" cy="6" r="1.5" fill={colors.primary} />
            </svg>
            <span
              style={{
                fontFamily: font.body,
                fontSize: 12,
                fontWeight: 400,
                color: colors.text,
                opacity: 0.75,
                lineHeight: 1.4,
              }}
            >
              {address}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventCard;
