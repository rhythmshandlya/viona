import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring } from 'remotion';
import { 
  BounceIn, 
  FadeInUp, 
  GlowPulse, 
  PremiumStagger, 
  SPRING_CONFIGS 
} from '../../animations';

const ReservoirSamplingOutro: React.FC = () => {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const minDim = Math.min(width, height);

  // Constants for layout
  const slotCount = 5;
  const slotSize = width * 0.15;
  const slotGap = width * 0.02;
  const totalWidth = (slotSize * slotCount) + (slotGap * (slotCount - 1));
  const reservoirY = height * 0.55;

  // Background Stream Animation (Continuous)
  const streamSpeed = 5; // pixels per frame
  const blockWidth = width * 0.12;
  const blockGap = width * 0.05;

  // UI Evolution - Visuals recede slightly
  const mainScale = interpolate(frame, [0, 60], [1, 0.85], { extrapolateRight: 'clamp' });
  const mainTranslateY = interpolate(frame, [0, 60], [0, height * 0.05], { extrapolateRight: 'clamp' });

  // Social Data
  const socialIcons = [
    { label: 'Follow', color: '#3B82F6' },
    { label: 'Share', color: '#10B981' },
    { label: 'Comment', color: '#F59E0B' }
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: '#0F172A', fontFamily: 'sans-serif' }}>
      {/* Header Section (Final Architecture Title) */}
      <AbsoluteFill style={{ top: height * 0.1, textAlign: 'center' }}>
        <BounceIn delay={20}>
          <h1 style={{ 
            color: 'white', 
            fontSize: height * 0.045, 
            fontWeight: 'bold',
            margin: 0,
            textShadow: '0 4px 20px rgba(59, 130, 246, 0.5)'
          }}>
            RESERVOIR SAMPLING
          </h1>
        </BounceIn>
      </AbsoluteFill>

      {/* Main Educational Visual (Continuous from previous) */}
      <div style={{
        transform: `translateY(${mainTranslateY}px) scale(${mainScale})`,
        transformOrigin: 'center center',
        width: '100%',
        height: '100%'
      }}>
        {/* Continuous Stream of data packets */}
        <div style={{ position: 'absolute', top: reservoirY - height * 0.15, width: '100%' }}>
          {[...Array(8)].map((_, i) => {
            const xPos = (width + (i * (blockWidth + blockGap)) - (frame * streamSpeed)) % (width + blockWidth + blockGap);
            const itemNumber = 100 + Math.floor((frame * streamSpeed + (width - xPos)) / (blockWidth + blockGap));
            
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: xPos,
                  width: blockWidth,
                  height: blockWidth,
                  background: 'linear-gradient(135deg, #1E293B, #334155)',
                  borderRadius: minDim * 0.02,
                  border: '2px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: minDim * 0.03
                }}
              >
                #{itemNumber}
              </div>
            );
          })}
        </div>

        {/* 5-Slot Reservoir Container */}
        <div style={{
          position: 'absolute',
          top: reservoirY,
          left: (width - totalWidth) / 2,
          display: 'flex',
          gap: slotGap
        }}>
          {[...Array(slotCount)].map((_, i) => (
            <GlowPulse key={i} speed="slow">
              <div style={{
                width: slotSize,
                height: slotSize,
                borderRadius: minDim * 0.02,
                background: 'rgba(59, 130, 246, 0.15)',
                border: `3px solid #3B82F6`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
                position: 'relative'
              }}>
                <div style={{ 
                  width: '60%', height: '60%', 
                  background: 'linear-gradient(45deg, #3B82F6, #10B981)',
                  borderRadius: '50%',
                  opacity: 0.8
                }} />
                {/* k/n logic floating indicator */}
                <div style={{
                  position: 'absolute',
                  top: -slotSize * 0.4,
                  fontSize: slotSize * 0.25,
                  color: '#10B981',
                  fontWeight: 'bold'
                }}>
                  {i + 1}/n
                </div>
              </div>
            </GlowPulse>
          ))}
        </div>
      </div>

      {/* Outro UI Overlay */}
      <AbsoluteFill style={{ 
        top: height * 0.7, 
        padding: `0 ${width * 0.1}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: minDim * 0.04
      }}>
        {/* Prasanna / Zoho Card */}
        <FadeInUp delay={60} style={{ width: '100%' }}>
          <div style={{
            background: 'rgba(30, 41, 59, 0.7)',
            backdropFilter: 'blur(10px)',
            borderRadius: minDim * 0.03,
            padding: minDim * 0.04,
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: minDim * 0.04,
            width: '100%'
          }}>
            {/* Zoho Logo Circle */}
            <div style={{
              width: minDim * 0.12,
              height: minDim * 0.12,
              borderRadius: '50%',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'black',
              fontSize: minDim * 0.05,
              color: '#EF4444'
            }}>
              Z
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 'bold', fontSize: minDim * 0.045 }}>Prasanna</div>
              <div style={{ color: '#94A3B8', fontSize: minDim * 0.035 }}>Technical Architect @ Zoho</div>
            </div>
          </div>
        </FadeInUp>

        {/* Interaction Buttons Staggered */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          width: '100%',
          marginTop: minDim * 0.02
        }}>
          <PremiumStagger delay={120} interval={15}>
            {socialIcons.map((social, i) => (
              <div key={i} style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                gap: 8
              }}>
                <div style={{
                  width: minDim * 0.15,
                  height: minDim * 0.15,
                  borderRadius: '30%',
                  background: `${social.color}22`,
                  border: `2px solid ${social.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg viewBox="0 0 24 24" width={minDim * 0.08} height={minDim * 0.08} fill="none" stroke={social.color} strokeWidth="2.5">
                    {i === 0 && <path d="M12 5v14M5 12h14" />}
                    {i === 1 && <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />}
                    {i === 2 && <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />}
                  </svg>
                </div>
                <span style={{ color: 'white', fontSize: minDim * 0.03, fontWeight: '500' }}>{social.label}</span>
              </div>
            ))}
          </PremiumStagger>
        </div>
      </AbsoluteFill>

      {/* Solving Indicator for Elegant Solution */}
      <div style={{
        position: 'absolute',
        bottom: height * 0.05,
        width: '100%',
        textAlign: 'center'
      }}>
        <FadeInUp delay={200}>
          <div style={{
            display: 'inline-block',
            padding: `${minDim * 0.015}px ${minDim * 0.05}px`,
            borderRadius: minDim * 0.05,
            background: 'linear-gradient(90deg, #F59E0B, #D97706)',
            color: 'white',
            fontWeight: 'bold',
            fontSize: minDim * 0.03,
            boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)'
          }}>
            Check the Pinned Solution ↓
          </div>
        </FadeInUp>
      </div>

      {/* Decorative Glows */}
      <svg style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.3, pointerEvents: 'none' }}>
        <defs>
          <radialGradient id="grad1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50%" cy="60%" r={minDim * 0.6} fill="url(#grad1)" />
      </svg>
    </AbsoluteFill>
  );
};

export default ReservoirSamplingOutro;