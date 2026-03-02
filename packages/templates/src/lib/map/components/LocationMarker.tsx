import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';

interface LocationMarkerProps {
  x: number;
  y: number;
  frame: number;
  enterFrame: number;
  color: string;
  size: number;
  markerStyle?: 'pulse' | 'pinDrop' | 'ripple' | 'flag' | 'numbered';
  /** Number to display inside the marker when markerStyle is 'numbered'. */
  number?: number;
}

const LocationMarker: React.FC<LocationMarkerProps> = ({
  x,
  y,
  frame,
  enterFrame,
  color,
  size,
  markerStyle = 'pulse',
  number: markerNumber,
}) => {
  const { fps } = useVideoConfig();

  if (frame < enterFrame) return null;

  const localFrame = frame - enterFrame;

  if (markerStyle === 'pinDrop') {
    return <PinDropMarker x={x} y={y} localFrame={localFrame} fps={fps} color={color} size={size} />;
  }

  if (markerStyle === 'ripple') {
    return <RippleMarker x={x} y={y} localFrame={localFrame} color={color} size={size} />;
  }

  if (markerStyle === 'flag') {
    return <FlagMarker x={x} y={y} localFrame={localFrame} fps={fps} color={color} size={size} />;
  }

  if (markerStyle === 'numbered') {
    return (
      <NumberedMarker
        x={x}
        y={y}
        localFrame={localFrame}
        fps={fps}
        color={color}
        size={size}
        number={markerNumber ?? 1}
      />
    );
  }

  // Default: pulse
  return <PulseMarker x={x} y={y} localFrame={localFrame} fps={fps} color={color} size={size} />;
};

/** Pulse: spring scale entrance + expanding ring (original behavior) */
const PulseMarker: React.FC<{
  x: number; y: number; localFrame: number; fps: number; color: string; size: number;
}> = ({ x, y, localFrame, fps, color, size }) => {
  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 26, stiffness: 200, mass: 0.8 },
  });

  const pulseScale = interpolate(localFrame, [0, 30], [1, 2.5], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const pulseOpacity = interpolate(localFrame, [0, 30], [0.6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: size * 2,
          height: size * 2,
          borderRadius: '50%',
          border: `2px solid ${color}`,
          transform: `translate(-50%, -50%) scale(${pulseScale})`,
          opacity: pulseOpacity,
          pointerEvents: 'none',
        }}
      />
      <MarkerDot color={color} size={size} />
    </div>
  );
};

/** PinDrop: marker drops from 200px above with spring bounce */
const PinDropMarker: React.FC<{
  x: number; y: number; localFrame: number; fps: number; color: string; size: number;
}> = ({ x, y, localFrame, fps, color, size }) => {
  const dropProgress = spring({
    frame: localFrame,
    fps,
    config: { damping: 20, stiffness: 150, mass: 0.6 },
  });

  const dropY = interpolate(dropProgress, [0, 1], [-200, 0]);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) translateY(${dropY}px)`,
      }}
    >
      <MarkerDot color={color} size={size} />
    </div>
  );
};

/** Ripple: 3 concentric rings expanding sequentially, opacity fade-in entrance */
const RippleMarker: React.FC<{
  x: number; y: number; localFrame: number; color: string; size: number;
}> = ({ x, y, localFrame, color, size }) => {
  const opacity = interpolate(localFrame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const rings = [0, 10, 20]; // stagger offsets

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        opacity,
      }}
    >
      {rings.map((stagger, i) => {
        const ringFrame = localFrame - stagger;
        if (ringFrame < 0) return null;
        const ringScale = interpolate(ringFrame, [0, 40], [1, 3], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const ringOpacity = interpolate(ringFrame, [0, 40], [0.5, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: size * 2,
              height: size * 2,
              borderRadius: '50%',
              border: `2px solid ${color}`,
              transform: `translate(-50%, -50%) scale(${ringScale})`,
              opacity: ringOpacity,
              pointerEvents: 'none',
            }}
          />
        );
      })}
      <MarkerDot color={color} size={size} />
    </div>
  );
};

/** Flag: small flag SVG marker with spring entrance */
const FlagMarker: React.FC<{
  x: number; y: number; localFrame: number; fps: number; color: string; size: number;
}> = ({ x, y, localFrame, fps, color, size }) => {
  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const flagWidth = size * 1.2;
  const flagHeight = size * 2;
  const poleHeight = flagHeight * 0.9;
  const flagBodyHeight = flagHeight * 0.5;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-${size * 0.15}px, -${flagHeight}px) scale(${scale})`,
        transformOrigin: 'bottom left',
      }}
    >
      <svg width={flagWidth} height={flagHeight} viewBox={`0 0 ${flagWidth} ${flagHeight}`}>
        {/* Pole */}
        <line
          x1={1}
          y1={0}
          x2={1}
          y2={poleHeight}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Flag body */}
        <polygon
          points={`3,2 ${flagWidth - 2},${flagBodyHeight * 0.35} 3,${flagBodyHeight}`}
          fill={color}
          opacity={0.9}
        />
        {/* Base circle */}
        <circle cx={1} cy={poleHeight} r={3} fill={color} />
      </svg>
    </div>
  );
};

/** Numbered: circled number marker with spring entrance */
const NumberedMarker: React.FC<{
  x: number; y: number; localFrame: number; fps: number; color: string; size: number; number: number;
}> = ({ x, y, localFrame, fps, color, size, number: markerNumber }) => {
  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 26, stiffness: 120, mass: 1.0 },
  });

  const circleSize = Math.max(size, 24);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
      }}
    >
      <div
        style={{
          width: circleSize,
          height: circleSize,
          borderRadius: '50%',
          backgroundColor: color,
          border: `${Math.max(2, circleSize * 0.1)}px solid white`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: '#FFFFFF',
            fontSize: circleSize * 0.5,
            fontWeight: 700,
            lineHeight: 1,
            fontFamily: 'sans-serif',
          }}
        >
          {markerNumber}
        </span>
      </div>
    </div>
  );
};

/** Shared marker dot */
const MarkerDot: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      backgroundColor: color,
      border: `${Math.max(2, size * 0.15)}px solid white`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    }}
  />
);

export default LocationMarker;
