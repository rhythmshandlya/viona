import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring, Sequence } from 'remotion';
import {
  FadeInUp,
  ScaleIn,
  BounceIn,
  PremiumStagger,
  GlowPulse,
} from '../../animations';

const Scene2: React.FC = () => {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const minDim = Math.min(width, height);

  // Persistent Elements Layout
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const gatewayWidth = width * 0.15;
  const gatewayHeight = height * 0.4;
  
  // Animation progress for panning camera/reveal
  const revealProgress = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 60 },
  });

  // UI Wireframe Position (Reveal from left)
  const uiX = interpolate(revealProgress, [0, 1], [-width * 0.3, width * 0.15]);
  const dbX = interpolate(revealProgress, [0, 1], [width * 1.3, width * 0.85]);

  // Labels and Objects Data
  const profileFields = [
    { label: 'Name', value: 'Alex' },
    { label: 'Bio', value: 'Developer' },
    { label: 'Location', value: 'NY' },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: '#0F172A', color: '#ffffff', fontFamily: 'sans-serif' }}>
      {/* 1. TOP TITLE SECTION */}
      <AbsoluteFill style={{ height: height * 0.15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FadeInUp duration={20}>
          <h1 style={{ 
            fontSize: height * 0.045, 
            fontWeight: 800, 
            background: 'linear-gradient(to right, #3B82F6, #10B981)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0
          }}>
            Example: Profile Update
          </h1>
        </FadeInUp>
      </AbsoluteFill>

      {/* 2. MAIN VISUAL MIDDLE (60% height) */}
      <AbsoluteFill style={{ top: height * 0.15, height: height * 0.6 }}>
        
        {/* PERSISTENT API GATEWAY - Static from previous scene */}
        <div style={{
          position: 'absolute',
          left: centerX - gatewayWidth / 2,
          top: centerY - (gatewayHeight / 2) - (height * 0.15),
          width: gatewayWidth,
          height: gatewayHeight,
          background: 'rgba(30, 41, 59, 0.8)',
          borderRadius: minDim * 0.02,
          border: '2px solid rgba(59, 130, 246, 0.3)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: minDim * 0.02,
          zIndex: 10
        }}>
          {/* Narrow Exit Port (Laser Grid) */}
          <div style={{ width: '80%', height: '10%', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10B981', borderRadius: 4 }} />
          
          <img 
            src="https://unpkg.com/lucide-static@latest/icons/cpu.svg" 
            width={gatewayWidth * 0.5} 
            style={{ filter: 'brightness(0) invert(1) sepia(1) saturate(5) hue-rotate(190deg)' }} 
            alt="API"
          />

          {/* Wide Entry Port (Funnel) */}
          <svg width="100%" height="20%" viewBox="0 0 100 40">
            <path d="M0 40 L100 40 L80 0 L20 0 Z" fill="none" stroke="#F59E0B" strokeWidth="2" strokeDasharray="4 2" />
          </svg>
        </div>

        {/* LEFT: FRONTEND UI WIREFRAME */}
        <div style={{
          position: 'absolute',
          left: uiX - (width * 0.12),
          top: centerY - (height * 0.2) - (height * 0.15),
          width: width * 0.25,
          height: height * 0.4,
          background: '#1E293B',
          borderRadius: minDim * 0.02,
          border: '1px solid #334155',
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ height: '15%', background: '#334155', display: 'flex', alignItems: 'center', padding: '0 10%' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#EF4444', marginRight: 6 }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#F59E0B', marginRight: 6 }} />
          </div>
          <div style={{ padding: minDim * 0.02 }}>
            <div style={{ width: '40%', height: height * 0.015, background: '#475569', marginBottom: minDim * 0.03 }} />
            <PremiumStagger delay={30}>
              {profileFields.map((field, i) => (
                <div key={i} style={{ marginBottom: minDim * 0.02 }}>
                  <div style={{ fontSize: minDim * 0.015, color: '#94A3B8', marginBottom: 4 }}>{field.label}</div>
                  <div style={{ height: height * 0.035, background: '#0F172A', borderRadius: 4, display: 'flex', alignItems: 'center', paddingLeft: 8, fontSize: minDim * 0.02 }}>
                    {field.value}
                  </div>
                </div>
              ))}
            </PremiumStagger>
          </div>
        </div>

        {/* RIGHT: DATABASE ICON */}
        <div style={{
          position: 'absolute',
          left: dbX - (width * 0.08),
          top: centerY - (height * 0.1) - (height * 0.15),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: minDim * 0.02
        }}>
          <ScaleIn delay={45}>
            <div style={{ textAlign: 'center' }}>
              <img 
                src="https://api.iconify.design/mdi/database.svg?color=%233B82F6" 
                width={width * 0.12} 
                alt="Database"
              />
              <div style={{ marginTop: 10, fontSize: minDim * 0.02, color: '#3B82F6', fontWeight: 'bold' }}>DB Cluster</div>
            </div>
          </ScaleIn>
        </div>

        {/* DATA PACKETS (Appear late in the scene) */}
        <Sequence from={60}>
          {/* Packet from Client */}
          <GlowPulse>
            <div style={{
              position: 'absolute',
              left: uiX + width * 0.15,
              top: centerY - (height * 0.15),
              background: 'linear-gradient(45deg, #F59E0B, #D97706)',
              padding: `${minDim * 0.01}px ${minDim * 0.02}px`,
              borderRadius: 8,
              fontSize: minDim * 0.018,
              fontWeight: 'bold',
              boxShadow: '0 0 15px rgba(245, 158, 11, 0.4)'
            }}>
              JSON REQUEST
            </div>
          </GlowPulse>

          {/* Packet in DB */}
          <div style={{
            position: 'absolute',
            left: dbX - width * 0.08,
            top: centerY + (height * 0.05),
            background: 'linear-gradient(45deg, #3B82F6, #2563EB)',
            padding: `${minDim * 0.01}px ${minDim * 0.02}px`,
            borderRadius: 8,
            fontSize: minDim * 0.018,
            fontWeight: 'bold',
            opacity: interpolate(frame, [80, 100], [0, 1], { extrapolateLeft: 'clamp' })
          }}>
            USER_RECORD
          </div>
        </Sequence>
      </AbsoluteFill>

      {/* 3. CAPTIONS SECTION (Bottom 25%) */}
      <AbsoluteFill style={{ top: height * 0.75, height: height * 0.25, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: `0 ${width * 0.1}px` }}>
        <BounceIn delay={20}>
          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            padding: minDim * 0.04,
            borderRadius: minDim * 0.02,
            border: '1px solid rgba(255,255,255,0.1)',
            textAlign: 'center',
            fontSize: height * 0.03,
            lineHeight: 1.4,
            width: '100%'
          }}>
            Imagine building an API for a user to <span style={{ color: '#F59E0B', fontWeight: 'bold' }}>update their profile details.</span>
          </div>
        </BounceIn>
      </AbsoluteFill>

      {/* Connection Links (Abstract) */}
      <svg style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}>
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="#334155" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <line 
          x1={uiX + width * 0.13} 
          y1={centerY} 
          x2={centerX - gatewayWidth/2} 
          y2={centerY} 
          stroke="url(#grad1)" 
          strokeWidth="2" 
          strokeDasharray="10,5"
        />
        <line 
          x1={centerX + gatewayWidth/2} 
          y1={centerY} 
          x2={dbX - width * 0.08} 
          y2={centerY} 
          stroke="url(#grad1)" 
          strokeWidth="2" 
          strokeDasharray="10,5"
        />
      </svg>
    </AbsoluteFill>
  );
};

export default Scene2;