import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring, Easing } from 'remotion';
import {
  FadeIn,
  SlideUp,
  ScaleIn,
  GlowPulse,
  SPRING_CONFIGS,
} from '../../animations';

const Scene5: React.FC = () => {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const minDim = Math.min(width, height);

  // Persistent Layout Constants
  const centerX = width * 0.5;
  const clientX = width * 0.15;
  const dbX = width * 0.85;
  const trackY = height * 0.5;
  const gatewayWidth = width * 0.12;
  const cardWidth = width * 0.25;

  // Animation Timelines
  // 0-30: Previous state cleanup (Blade retracts)
  // 30-70: New packet enters (USER_NAME)
  // 70-130: Transformation (Lowercase filter)
  // 130-180: Saving to DB
  
  const bladeRetraction = spring({
    frame,
    fps,
    config: SPRING_CONFIGS.gentle,
    durationInFrames: 30,
  });

  const packetEntry = spring({
    frame: frame - 30,
    fps,
    config: SPRING_CONFIGS.stiff,
    durationInFrames: 40,
  });

  const transformProgress = interpolate(frame, [80, 120], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const dbSaveProgress = spring({
    frame: frame - 140,
    fps,
    config: SPRING_CONFIGS.slow,
  });

  // Derived Positions
  const packetX = interpolate(
    frame,
    [30, 70, 140, 180],
    [clientX, centerX - gatewayWidth, centerX + gatewayWidth, dbX],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const packetOpacity = interpolate(frame, [0, 20], [1, 1]); // Persistent

  return (
    <AbsoluteFill style={{ backgroundColor: '#0F172A', overflow: 'hidden' }}>
      {/* 1. Header Section */}
      <div style={{
        position: 'absolute',
        top: height * 0.05,
        width: '100%',
        textAlign: 'center',
        padding: `0 ${width * 0.1}px`
      }}>
        <FadeIn>
          <h1 style={{
            color: 'white',
            fontSize: height * 0.04,
            fontWeight: 800,
            margin: 0,
            fontFamily: 'sans-serif'
          }}>
            FLUID INPUT NORMALIZATION
          </h1>
          <p style={{
            color: '#94A3B8',
            fontSize: height * 0.02,
            marginTop: height * 0.01,
            fontFamily: 'sans-serif'
          }}>
            Accept diverse cases, store standardized data
          </p>
        </FadeIn>
      </div>

      {/* 2. Persistent Visual Infrastructure */}
      <svg style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}>
        {/* Connection Track */}
        <line 
          x1={clientX} y1={trackY} x2={dbX} y2={trackY} 
          stroke="#1E293B" strokeWidth={height * 0.005} strokeDasharray="10 10" 
        />
        
        {/* Gateway "Normalization Funnel" Area */}
        <defs>
          <linearGradient id="gateGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path 
          d={`M ${centerX - gatewayWidth} ${trackY - height * 0.15} 
             L ${centerX + gatewayWidth} ${trackY - height * 0.1} 
             L ${centerX + gatewayWidth} ${trackY + height * 0.1} 
             L ${centerX - gatewayWidth} ${trackY + height * 0.15} Z`}
          fill="url(#gateGrad)"
          stroke="#3B82F6"
          strokeWidth="2"
        />
      </svg>

      {/* Client Node */}
      <div style={{
        position: 'absolute',
        left: clientX - minDim * 0.05,
        top: trackY - minDim * 0.05,
        width: minDim * 0.1,
        height: minDim * 0.1,
        background: '#1E293B',
        borderRadius: minDim * 0.02,
        border: '2px solid #3B82F6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <img 
          src="https://unpkg.com/lucide-static@latest/icons/monitor.svg" 
          width={minDim * 0.05} 
          style={{ filter: 'brightness(0) invert(1)' }}
          alt="Client"
        />
      </div>

      {/* Database Node */}
      <div style={{
        position: 'absolute',
        left: dbX - minDim * 0.05,
        top: trackY - minDim * 0.05,
        width: minDim * 0.1,
        height: minDim * 0.1,
        background: '#1E293B',
        borderRadius: minDim * 0.02,
        border: `2px solid ${dbSaveProgress > 0.1 ? '#10B981' : '#334155'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 0.3s ease'
      }}>
        <img 
          src="https://unpkg.com/lucide-static@latest/icons/database.svg" 
          width={minDim * 0.05} 
          style={{ filter: dbSaveProgress > 0.1 ? 'sepia(1) saturate(5) hue-rotate(90deg)' : 'brightness(0) invert(1)' }}
          alt="DB"
        />
      </div>

      {/* 3. The Active Scene Elements */}
      
      {/* Previous Element Cleanup: Blade Retracting */}
      <div style={{
        position: 'absolute',
        top: trackY - height * 0.2,
        left: centerX + gatewayWidth * 0.5,
        transform: `translateY(${(1 - bladeRetraction) * -height * 0.1}px)`,
        opacity: 1 - bladeRetraction
      }}>
        <img 
          src="https://unpkg.com/lucide-static@latest/icons/scissors.svg" 
          width={minDim * 0.04} 
          style={{ filter: 'invert(58%) sepia(88%) saturate(464%) hue-rotate(349deg) brightness(101%) contrast(94%)' }}
          alt="Trimmer"
        />
      </div>

      {/* The Username Data Packet */}
      <div style={{
        position: 'absolute',
        left: packetX - cardWidth / 2,
        top: trackY - height * 0.04,
        width: cardWidth,
        height: height * 0.08,
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        border: `2px solid ${interpolate(transformProgress, [0, 1], [0xf59e0b, 0x10b981]) === 0xf59e0b ? '#F59E0B' : '#10B981'}`,
        borderRadius: minDim * 0.01,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: packetOpacity,
        boxShadow: `0 0 ${interpolate(frame, [70, 90, 130], [0, 20, 0])}px rgba(59, 130, 246, 0.5)`
      }}>
        <div style={{ 
          fontSize: height * 0.025, 
          color: 'white', 
          fontFamily: 'monospace',
          fontWeight: 'bold',
          letterSpacing: '2px'
        }}>
          {transformProgress < 0.5 ? 'JOHN_DOE' : 'john_doe'}
        </div>
      </div>

      {/* Lowercase Filter Overlay - Slide effect */}
      {frame > 70 && frame < 150 && (
        <div style={{
          position: 'absolute',
          left: centerX - gatewayWidth,
          top: trackY - height * 0.12,
          width: gatewayWidth * 2,
          height: height * 0.24,
          border: '2px solid #3B82F6',
          borderRadius: minDim * 0.02,
          background: 'rgba(59, 130, 246, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          <ScaleIn speed="fast">
            <div style={{ 
              background: '#3B82F6', 
              padding: `${height * 0.005}px ${width * 0.02}px`,
              borderRadius: 100,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <img src="https://unpkg.com/lucide-static@latest/icons/type.svg" width={minDim * 0.02} style={{ filter: 'brightness(0) invert(1)' }} alt="Type icon"/>
              <span style={{ color: 'white', fontSize: height * 0.015, fontWeight: 'bold' }}>LOWERCASE()</span>
            </div>
          </ScaleIn>
          
          {/* Scanning line */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: `${transformProgress * 100}%`,
            width: 2,
            height: '100%',
            background: '#3B82F6',
            boxShadow: '0 0 15px #3B82F6'
          }} />
        </div>
      )}

      {/* 4. Captions Section */}
      <div style={{
        position: 'absolute',
        bottom: height * 0.1,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: minDim * 0.02
      }}>
        <div style={{
          background: 'rgba(30, 41, 59, 0.8)',
          padding: `${height * 0.02}px ${width * 0.05}px`,
          borderRadius: minDim * 0.02,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          maxWidth: width * 0.8
        }}>
          <p style={{
            color: '#E2E8F0',
            fontSize: height * 0.022,
            lineHeight: 1.5,
            margin: 0,
            textAlign: 'center',
            fontFamily: 'sans-serif'
          }}>
            {frame < 80 ? "Input: Flexible (Accepts variants)" : "Processing: Normalizing to business standards"}
          </p>
        </div>

        {/* Status Indicators */}
        <div style={{ display: 'flex', gap: width * 0.05 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#F59E0B' }} />
            <span style={{ color: '#94A3B8', fontSize: height * 0.015 }}>Raw User Input</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10B981' }} />
            <span style={{ color: '#94A3B8', fontSize: height * 0.015 }}>Sanitized DB Entry</span>
          </div>
        </div>
      </div>

      {/* Success Pulse on DB entry */}
      {frame > 160 && (
        <div style={{
          position: 'absolute',
          left: dbX - minDim * 0.05,
          top: trackY - minDim * 0.05,
          width: minDim * 0.1,
          height: minDim * 0.1,
        }}>
          <GlowPulse color="#10B981" />
        </div>
      )}

    </AbsoluteFill>
  );
};

export default Scene5;