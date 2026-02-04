import React, { useMemo } from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring, Sequence } from 'remotion';
import {
  FadeIn,
  SlideUp,
  ScaleIn,
  BounceIn,
  Tada,
  GlowPulse,
  SPRING_CONFIGS,
} from '../../animations';

const COLORS = {
  background: '#0F172A',
  primary: '#3B82F6',
  secondary: '#10B981',
  accent: '#F59E0B',
  white: '#FFFFFF',
  text: '#E2E8F0',
};

const DataBlock: React.FC<{ 
  val: number; 
  size: number; 
  x: number; 
  y: number; 
  color: string; 
  opacity?: number;
  highlight?: boolean;
}> = ({ val, size, x, y, color, opacity = 1, highlight = false }) => (
  <div
    style={{
      position: 'absolute',
      width: size,
      height: size,
      left: x - size / 2,
      top: y - size / 2,
      backgroundColor: color,
      borderRadius: size * 0.2,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontWeight: 'bold',
      fontSize: size * 0.4,
      boxShadow: highlight ? `0 0 ${size * 0.3}px ${color}` : `0 4px 10px rgba(0,0,0,0.3)`,
      opacity,
      border: `2px solid ${highlight ? COLORS.white : 'transparent'}`,
    }}
  >
    {val}
  </div>
);

const Die: React.FC<{ size: number; value: number; x: number; y: number; opacity: number }> = ({ size, value, x, y, opacity }) => (
  <div
    style={{
      position: 'absolute',
      width: size,
      height: size,
      left: x - size / 2,
      top: y - size / 2,
      backgroundColor: COLORS.white,
      borderRadius: size * 0.15,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: COLORS.background,
      fontWeight: '900',
      fontSize: size * 0.5,
      boxShadow: '0 10px 20px rgba(0,0,0,0.4)',
      opacity,
      transform: `rotate(${interpolate(opacity, [0, 1], [45, 0])}deg)`,
    }}
  >
    {value}
  </div>
);

export default function ReservoirSamplingMechanism() {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const minDim = Math.min(width, height);

  const reservoirSize = minDim * 0.25;
  const blockSize = minDim * 0.18;
  const centerY = height * 0.52;
  const reservoirX = width * 0.5;

  // Timings
  const block2ArrivalFrame = 30;
  const block2RollFrame = 60;
  const block2ExitFrame = 100;
  
  const block3ArrivalFrame = 140;
  const block3RollFrame = 170;
  const block3SwapFrame = 210;

  // Block 1 Position (Inside reservoir until swapped)
  const b1Spring = spring({
    frame: frame - block3SwapFrame,
    fps,
    config: { damping: 12, stiffness: 60 },
  });
  const b1X = interpolate(b1Spring, [0, 1], [reservoirX, reservoirX - width * 0.6]);
  const b1Y = interpolate(b1Spring, [0, 0.5, 1], [centerY, centerY - height * 0.1, centerY + height * 0.2]);
  const b1Opacity = interpolate(b1Spring, [0.8, 1], [1, 0]);

  // Block 2 Position (Comes in, fails, goes out)
  const b2EntrySpring = spring({
    frame: frame - block2ArrivalFrame,
    fps,
    config: SPRING_CONFIGS.gentle,
  });
  const b2ExitSpring = spring({
    frame: frame - block2ExitFrame,
    fps,
    config: { damping: 15, stiffness: 40 },
  });
  
  const b2BaseX = interpolate(b2EntrySpring, [0, 1], [width + blockSize, reservoirX + blockSize * 1.5]);
  const b2X = interpolate(b2ExitSpring, [0, 1], [b2BaseX, width + blockSize]);

  // Block 3 Position (Comes in, succeeds, replaces)
  const b3EntrySpring = spring({
    frame: frame - block3ArrivalFrame,
    fps,
    config: SPRING_CONFIGS.gentle,
  });
  const b3SwapSpring = spring({
    frame: frame - block3SwapFrame,
    fps,
    config: { damping: 12, stiffness: 90 },
  });

  const b3BaseX = interpolate(b3EntrySpring, [0, 1], [width + blockSize, reservoirX + blockSize * 1.5]);
  const b3X = interpolate(b3SwapSpring, [0, 1], [b3BaseX, reservoirX]);

  // Probabilities
  const p2Opacity = interpolate(frame, [block2ArrivalFrame, block2ArrivalFrame + 15, block2ExitFrame, block2ExitFrame + 10], [0, 1, 1, 0]);
  const p3Opacity = interpolate(frame, [block3ArrivalFrame, block3ArrivalFrame + 15, block3SwapFrame, block3SwapFrame + 10], [0, 1, 1, 0]);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background, fontFamily: 'system-ui, sans-serif' }}>
      
      {/* HEADER AREA */}
      <div style={{ height: height * 0.15, paddingTop: height * 0.05, textAlign: 'center' }}>
        <FadeIn>
          <h1 style={{ color: COLORS.white, fontSize: height * 0.04, margin: 0 }}>
            The Selection Rule
          </h1>
        </FadeIn>
      </div>

      {/* MAIN VISUAL AREA */}
      <AbsoluteFill style={{ top: height * 0.15, height: height * 0.6 }}>
        
        {/* Reservoir Container */}
        <div style={{
          position: 'absolute',
          width: reservoirSize,
          height: reservoirSize,
          left: reservoirX - reservoirSize / 2,
          top: centerY - reservoirSize / 2,
          border: `4px dashed ${COLORS.primary}`,
          borderRadius: minDim * 0.04,
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: minDim * 0.02
        }}>
          <div style={{ color: COLORS.primary, fontSize: minDim * 0.03, fontWeight: 'bold', opacity: 0.6 }}>RESERVOIR</div>
        </div>

        {/* Die Roll for Block 2 */}
        <Sequence from={block2RollFrame} duration={50}>
          <Die size={minDim * 0.1} value={2} x={b2X} y={centerY - blockSize} opacity={1} />
          {frame > block2RollFrame + 15 && (
            <div style={{ position: 'absolute', left: b2X - 50, top: centerY - blockSize * 1.8, color: COLORS.accent, fontWeight: 'bold', fontSize: minDim * 0.04 }}>
              FAIL
            </div>
          )}
        </Sequence>

        {/* Die Roll for Block 3 */}
        <Sequence from={block3RollFrame} duration={50}>
          <Die size={minDim * 0.1} value={1} x={b3X} y={centerY - blockSize} opacity={1} />
          {frame > block3RollFrame + 15 && (
            <Tada>
              <div style={{ position: 'absolute', left: b3X - 50, top: centerY - blockSize * 1.8, color: COLORS.secondary, fontWeight: 'bold', fontSize: minDim * 0.04 }}>
                SUCCESS!
              </div>
            </Tada>
          )}
        </Sequence>

        {/* Probability Indicators */}
        <div style={{ position: 'absolute', left: b2X - 40, top: centerY - blockSize * 0.8, opacity: p2Opacity, color: COLORS.accent, fontWeight: 'bold', fontSize: minDim * 0.04 }}>
          P = 1/2
        </div>
        <div style={{ position: 'absolute', left: b3X - 40, top: centerY - blockSize * 0.8, opacity: p3Opacity, color: COLORS.accent, fontWeight: 'bold', fontSize: minDim * 0.04 }}>
          P = 1/3
        </div>

        {/* Existing Blocks */}
        <DataBlock 
          val={1} 
          size={blockSize} 
          x={b1X} 
          y={b1Y} 
          color={COLORS.primary} 
          opacity={b1Opacity} 
          highlight={frame < block3SwapFrame}
        />
        
        {frame >= block2ArrivalFrame && (
          <DataBlock val={2} size={blockSize} x={b2X} y={centerY} color="#475569" />
        )}

        {frame >= block3ArrivalFrame && (
          <DataBlock 
            val={3} 
            size={blockSize} 
            x={b3X} 
            y={centerY} 
            color={COLORS.primary} 
            highlight={frame >= block3SwapFrame}
          />
        )}

      </AbsoluteFill>

      {/* LABELS AREA */}
      <AbsoluteFill style={{ top: height * 0.75, height: height * 0.25, padding: minDim * 0.05 }}>
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.05)', 
          backdropFilter: 'blur(10px)',
          borderRadius: minDim * 0.03,
          padding: minDim * 0.04,
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <Sequence from={0} duration={block3ArrivalFrame}>
            <div style={{ color: COLORS.text, fontSize: height * 0.025, lineHeight: 1.4 }}>
              For item <span style={{ color: COLORS.accent, fontWeight: 'bold' }}>n=2</span>, roll a die.
              <br />
              Probability of replacement: <span style={{ color: COLORS.accent }}>1/2</span>
            </div>
          </Sequence>
          
          <Sequence from={block3ArrivalFrame}>
            <div style={{ color: COLORS.text, fontSize: height * 0.025, lineHeight: 1.4 }}>
              For item <span style={{ color: COLORS.accent, fontWeight: 'bold' }}>n=3</span>, roll again.
              <br />
              Probability of replacement: <span style={{ color: COLORS.accent }}>1/3</span>
            </div>
          </Sequence>

          <div style={{ marginTop: minDim * 0.03, display: 'flex', gap: minDim * 0.04 }}>
            <GlowPulse speed="slow">
              <div style={{ 
                color: b1Opacity > 0.5 ? COLORS.primary : COLORS.secondary, 
                fontSize: minDim * 0.03, 
                fontWeight: 'bold',
                padding: '4px 12px',
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: 8
              }}>
                Current Winner: #{frame < block3SwapFrame + 5 ? '1' : '3'}
              </div>
            </GlowPulse>
            
            <div style={{ color: COLORS.accent, fontSize: minDim * 0.03, fontWeight: 'bold' }}>
              n = {frame < block3ArrivalFrame ? '2' : '3'}
            </div>
          </div>
        </div>
      </AbsoluteFill>

    </AbsoluteFill>
  );
}