import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring } from 'remotion';
import {
  FadeIn,
  BounceIn,
  FadeInUp,
  FadeInDown,
  ZoomIn,
  PremiumStagger,
  GlowPulse,
} from '../../animations';

const PostelLawIntroduction: React.FC = () => {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const minDim = Math.min(width, height);

  // Layout Constants
  const TOP_SECTION_HEIGHT = height * 0.15;
  const MIDDLE_SECTION_HEIGHT = height * 0.60;
  const BOTTOM_SECTION_HEIGHT = height * 0.25;

  const centerX = width / 2;
  const centerY = TOP_SECTION_HEIGHT + MIDDLE_SECTION_HEIGHT / 2;
  
  const gatewayWidth = minDim * 0.15;
  const gatewayHeight = MIDDLE_SECTION_HEIGHT * 0.7;
  
  const iconSize = minDim * 0.12;
  const clientX = width * 0.15;
  const dbX = width * 0.85;

  // Animation values
  const entranceDelay = 10;
  const staggerDelay = 20;

  // Funnel and Grid properties
  const funnelWidth = width * 0.25;
  const funnelRightBody = centerX + gatewayWidth / 2;
  const funnelLeftMouth = funnelRightBody + funnelWidth;

  const gridWidth = width * 0.2;
  const gridRightEdge = centerX - gatewayWidth / 2;
  const gridLeftEdge = gridRightEdge - gridWidth;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0F172A', fontFamily: 'sans-serif' }}>
      {/* 1. HEADER SECTION */}
      <div style={{ height: TOP_SECTION_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FadeInDown delay={entranceDelay}>
          <h1 style={{ 
            color: 'white', 
            fontSize: height * 0.045, 
            fontWeight: 800, 
            textAlign: 'center',
            margin: 0,
            textShadow: '0 4px 10px rgba(0,0,0,0.5)'
          }}>
            Postel&apos;s Law
          </h1>
        </FadeInDown>
      </div>

      {/* 2. MAIN VISUAL MIDDLE SECTION */}
      <div style={{ height: MIDDLE_SECTION_HEIGHT, position: 'relative' }}>
        
        {/* Horizontal Tracks */}
        <svg style={{ position: 'absolute', width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="trackGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.1" />
              <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <line 
            x1={clientX} y1={centerY - TOP_SECTION_HEIGHT} 
            x2={dbX} y2={centerY - TOP_SECTION_HEIGHT} 
            stroke="url(#trackGradient)" 
            strokeWidth={4} 
            strokeDasharray={`${minDim * 0.02} ${minDim * 0.02}`} 
          />
        </svg>

        {/* Client (Left) */}
        <div style={{ position: 'absolute', left: clientX, top: centerY - TOP_SECTION_HEIGHT, transform: 'translate(-50%, -50%)' }}>
          <BounceIn delay={entranceDelay + staggerDelay}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: minDim * 0.01 }}>
              <img 
                src="https://unpkg.com/lucide-static@latest/icons/monitor.svg" 
                style={{ width: iconSize, height: iconSize, filter: 'brightness(0) invert(1) drop-shadow(0 0 10px #3B82F6)' }}
                alt="Client"
              />
              <span style={{ color: 'white', opacity: 0.7, fontSize: minDim * 0.03 }}>Client</span>
            </div>
          </BounceIn>
        </div>

        {/* Database (Right) */}
        <div style={{ position: 'absolute', left: dbX, top: centerY - TOP_SECTION_HEIGHT, transform: 'translate(-50%, -50%)' }}>
          <BounceIn delay={entranceDelay + staggerDelay * 2}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: minDim * 0.01 }}>
              <img 
                src="https://unpkg.com/lucide-static@latest/icons/database.svg" 
                style={{ width: iconSize, height: iconSize, filter: 'brightness(0) invert(1) drop-shadow(0 0 10px #10B981)' }}
                alt="Database"
              />
              <span style={{ color: 'white', opacity: 0.7, fontSize: minDim * 0.03 }}>Service</span>
            </div>
          </BounceIn>
        </div>

        {/* API Gateway (Center) */}
        <div style={{ position: 'absolute', left: centerX, top: centerY - TOP_SECTION_HEIGHT, transform: 'translate(-50%, -50%)' }}>
          <GlowPulse>
            <ZoomIn delay={entranceDelay + staggerDelay * 3}>
              <div style={{
                width: gatewayWidth,
                height: gatewayHeight,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                backdropFilter: 'blur(10px)',
                borderRadius: minDim * 0.02,
                border: '2px solid rgba(255,255,255,0.2)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                boxShadow: '0 0 30px rgba(59, 130, 246, 0.3)'
              }}>
                <img 
                  src="https://unpkg.com/lucide-static@latest/icons/cpu.svg" 
                  style={{ width: iconSize * 0.7, height: iconSize * 0.7, filter: 'brightness(0) invert(1)' }}
                  alt="API Logic"
                />
                <div style={{ marginTop: 10, color: 'white', fontWeight: 'bold', fontSize: minDim * 0.025, letterSpacing: 1 }}>API GATEWAY</div>
              </div>
            </ZoomIn>
          </GlowPulse>
        </div>

        {/* The Functional Shapes: Funnel (Liberal) and Grid (Conservative) */}
        <svg style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}>
          {/* Liberal Funnel (Input side: Service to Gateway flow) */}
          <g>
            <FadeIn delay={100}>
              <path
                d={`M ${funnelLeftMouth} ${centerY - TOP_SECTION_HEIGHT - minDim * 0.15} 
                   L ${funnelRightBody} ${centerY - TOP_SECTION_HEIGHT - minDim * 0.05}
                   L ${funnelRightBody} ${centerY - TOP_SECTION_HEIGHT + minDim * 0.05}
                   L ${funnelLeftMouth} ${centerY - TOP_SECTION_HEIGHT + minDim * 0.15} Z`}
                fill="url(#liberalGradient)"
                stroke="#10B981"
                strokeWidth={2}
                opacity={0.4}
              />
            </FadeIn>
            <defs>
              <linearGradient id="liberalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.1" />
              </linearGradient>
            </defs>
          </g>

          {/* Conservative Grid (Output side: Gateway to Client flow) */}
          <g>
            <FadeIn delay={120}>
              <rect
                x={gridLeftEdge}
                y={centerY - TOP_SECTION_HEIGHT - minDim * 0.05}
                width={gridWidth}
                height={minDim * 0.1}
                rx={minDim * 0.01}
                fill="none"
                stroke="#3B82F6"
                strokeWidth={3}
              />
              {/* Grid vertical bars */}
              {[1, 2, 3, 4].map((i) => (
                <line
                  key={`grid-${i}`}
                  x1={gridLeftEdge + (gridWidth / 5) * i}
                  y1={centerY - TOP_SECTION_HEIGHT - minDim * 0.05}
                  x2={gridLeftEdge + (gridWidth / 5) * i}
                  y2={centerY - TOP_SECTION_HEIGHT + minDim * 0.05}
                  stroke="#3B82F6"
                  strokeWidth={2}
                  opacity={0.6}
                />
              ))}
            </FadeIn>
          </g>
        </svg>
      </div>

      {/* 3. CAPTIONS SECTION */}
      <div style={{ 
        height: BOTTOM_SECTION_HEIGHT, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'flex-start',
        padding: `0 ${width * 0.05}px`,
        gap: minDim * 0.03
      }}>
        <PremiumStagger startDelay={130} delayPerItem={40} animation="fadeInUp">
          <div key="cap1" style={{ 
            background: 'rgba(59, 130, 246, 0.1)', 
            borderLeft: '4px solid #3B82F6',
            padding: minDim * 0.025,
            borderRadius: minDim * 0.01,
            width: '100%'
          }}>
            <h2 style={{ margin: 0, color: '#3B82F6', fontSize: minDim * 0.04, textTransform: 'uppercase' }}>Conservative in Send</h2>
            <p style={{ margin: 5, color: 'white', opacity: 0.8, fontSize: minDim * 0.035 }}>Strict validation of your API responses.</p>
          </div>

          <div key="cap2" style={{ 
            background: 'rgba(16, 185, 129, 0.1)', 
            borderLeft: '4px solid #10B981',
            padding: minDim * 0.025,
            borderRadius: minDim * 0.01,
            width: '100%'
          }}>
            <h2 style={{ margin: 0, color: '#10B981', fontSize: minDim * 0.04, textTransform: 'uppercase' }}>Liberal in Accept</h2>
            <p style={{ margin: 5, color: 'white', opacity: 0.8, fontSize: minDim * 0.035 }}>Flexible parsing of varying inputs.</p>
          </div>
        </PremiumStagger>
      </div>

      {/* Decorative background glow that follows frame */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: minDim * 0.8,
        height: minDim * 0.8,
        background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)',
        transform: `translate(-50%, -50%) scale(${1 + Math.sin(frame / 30) * 0.1})`,
        zIndex: -1
      }} />
    </AbsoluteFill>
  );
};

export default PostelLawIntroduction;