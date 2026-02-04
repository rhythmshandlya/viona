import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useVideoConfig,
  useCurrentFrame,
  interpolate,
  Easing,
} from 'remotion';
import {
  GlowPulse,
  FadeInUp,
} from '../../animations';

// --- Types & Constants ---
interface DataBlock {
  id: number;
  color: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

export default function ReservoirSamplingFinalState() {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const minDim = Math.min(width, height);

  // Layout Constants
  const reservoirY = height * 0.45;
  const reservoirSize = minDim * 0.25;
  const blockSize = minDim * 0.18;
  const streamY = height * 0.45;

  // 1. TIMING & CAMERA EVOLUTION
  // We zoom out smoothly over 300 frames to show the scale
  const zoom = interpolate(frame, [0, 300], [1, 0.6], {
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  });

  // 2. STREAM SPEED & DATA GENERATION
  // The stream accelerates to show large N
  const speed = interpolate(frame, [0, 300], [0.1, 0.5]); 
  const currentN = Math.floor(interpolate(frame, [0, 300], [4, 1500], {
    easing: Easing.inOut(Easing.quad),
  }));

  // Logic for the current occupant of the reservoir
  // We simulate "hits" at specific intervals to show fair replacement
  // Prev state had Block #3 in.
  const occupantId = useMemo(() => {
    if (frame < 50) return 3;
    if (frame < 180) return 142;
    if (frame < 260) return 890;
    return 1204;
  }, [frame]);

  // 3. RENDER HELPERS
  const renderReservoir = () => {
    const isReplacing = [50, 180, 260].includes(frame);
    
    return (
      <div
        style={{
          position: 'absolute',
          left: width / 2 - (reservoirSize * zoom) / 2,
          top: reservoirY - (reservoirSize * zoom) / 2,
          width: reservoirSize * zoom,
          height: reservoirSize * zoom,
          border: `${minDim * 0.01}px solid #3B82F6`,
          borderRadius: minDim * 0.03,
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isReplacing ? `0 0 ${minDim * 0.1}px #10B981` : 'none',
          transition: 'box-shadow 0.1s ease-out',
          zIndex: 10,
        }}
      >
        <div style={{
          width: blockSize * zoom,
          height: blockSize * zoom,
          backgroundColor: COLORS[occupantId % COLORS.length],
          borderRadius: minDim * 0.02,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: minDim * 0.05 * zoom,
          fontWeight: 'bold',
          boxShadow: '0 10px 20px rgba(0,0,0,0.3)',
        }}>
          #{occupantId}
        </div>
      </div>
    );
  };

  const renderStream = () => {
    const blocks = Array.from({ length: 8 }).map((_, i) => {
      const offset = (frame * speed + i * 1.5) % 8;
      const xPos = width + (blockSize * 2) - (offset * width * 0.3 * zoom);
      const id = currentN + i;
      
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: xPos,
            top: streamY - (blockSize * zoom) / 2,
            width: blockSize * zoom,
            height: blockSize * zoom,
            backgroundColor: COLORS[id % COLORS.length],
            borderRadius: minDim * 0.02,
            opacity: 0.6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: minDim * 0.04 * zoom,
            fontWeight: 'bold',
          }}
        >
          #{id}
        </div>
      );
    });

    return <>{blocks}</>;
  };

  return (
    <AbsoluteFill style={{ backgroundColor: '#0F172A', overflow: 'hidden' }}>
      {/* HEADER SECTION */}
      <div style={{
        paddingTop: height * 0.05,
        textAlign: 'center',
        zIndex: 20,
      }}>
        <FadeInUp delay={0}>
          <h1 style={{
            color: 'white',
            fontSize: minDim * 0.06,
            margin: 0,
            fontFamily: 'sans-serif',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '2px'
          }}>
            Uniform Probability
          </h1>
        </FadeInUp>
      </div>

      {/* MAIN VISUAL AREA */}
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Probability Indicator */}
        <div style={{
          position: 'absolute',
          top: height * 0.25,
          left: 0,
          right: 0,
          textAlign: 'center',
        }}>
           <GlowPulse speed="slow">
            <div style={{
                fontSize: minDim * 0.08 * (1 + (1 - zoom) * 0.5),
                color: '#F59E0B',
                fontWeight: 'bold',
                fontFamily: 'monospace'
            }}>
                P = 1 / {currentN.toLocaleString()}
            </div>
           </GlowPulse>
        </div>

        {/* The Reservoir Box */}
        {renderReservoir()}

        {/* The Flowing Stream */}
        {renderStream()}

        {/* Connector Line */}
        <svg style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}>
           <line 
            x1="0" y1={streamY} 
            x2={width} y2={streamY} 
            stroke="rgba(255,255,255,0.1)" 
            strokeWidth={2} 
            strokeDasharray="10 10" 
           />
        </svg>
      </div>

      {/* LABELS & STATS SECTION */}
      <div style={{
        position: 'absolute',
        bottom: height * 0.1,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: minDim * 0.02,
      }}>
        <div style={{
            padding: `${minDim * 0.02}px ${minDim * 0.05}px`,
            background: 'rgba(255,255,255,0.05)',
            borderRadius: minDim * 0.05,
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            color: '#10B981',
            fontSize: minDim * 0.04,
            fontWeight: '600',
            fontFamily: 'sans-serif'
        }}>
            Stream Size (n): {currentN.toLocaleString()}
        </div>
        
        <p style={{
          color: 'rgba(255,255,255,0.7)',
          fontSize: minDim * 0.035,
          width: '80%',
          textAlign: 'center',
          lineHeight: 1.5,
          fontFamily: 'sans-serif'
        }}>
          Every item processed has exactly <span style={{color: '#F59E0B', fontWeight: 'bold'}}>k/n</span> chance of being in the final sample.
        </p>
      </div>

      {/* Flash Effect on swap */}
      {[50, 180, 260].map(swapFrame => {
        const opacity = interpolate(frame, [swapFrame, swapFrame + 10], [0.4, 0], {
            extrapolateRight: 'clamp'
        });
        if (frame < swapFrame || frame > swapFrame + 10) return null;
        return (
            <AbsoluteFill key={swapFrame} style={{ backgroundColor: '#10B981', opacity, pointerEvents: 'none' }} />
        );
      })}
    </AbsoluteFill>
  );
}