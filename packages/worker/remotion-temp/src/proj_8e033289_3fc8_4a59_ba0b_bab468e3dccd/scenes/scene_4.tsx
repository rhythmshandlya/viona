import React, { useMemo } from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring, Easing } from 'remotion';
import {
  FadeIn,
  PopIn,
  BounceIn,
  GlowPulse,
  ScaleIn,
} from '../../animations';

const SPRING_CONFIG = { damping: 15, stiffness: 60 };

export default function PostelsLawInputProcessing() {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const minDim = Math.min(width, height);

  // Layout Constants
  const centerX = width / 2;
  const centerY = height / 2;
  const clientX = width * 0.15;
  const gatewayX = centerX;
  const dbX = width * 0.85;
  const packetY = centerY;
  
  const slotWidth = width * 0.2;
  const slotHeight = height * 0.08;
  const oversizedWidth = width * 0.35;

  // Animation Timings
  const startReverseFlow = 20;
  const packetEnters = 50;
  const packetAtFunnel = 100;
  const trimAction = 140;
  const packetStored = 200;

  // 1. Initial State: Uniform blocks at Frontend (Legacy from Prev Scene)
  const blockX = interpolate(frame, [0, 40], [clientX, clientX - width * 0.1], { extrapolateRight: 'clamp' });
  const blockOpacity = interpolate(frame, [30, 50], [1, 0], { extrapolateRight: 'clamp' });

  // 2. Incoming "Messy" Bio Packet
  const bioX = interpolate(frame, [packetEnters, packetAtFunnel, packetStored], [clientX, gatewayX - width * 0.1, dbX], {
    easing: Easing.bezier(0.33, 1, 0.68, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const bioWidth = interpolate(frame, [trimAction, trimAction + 30], [oversizedWidth, slotWidth], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Funnel Animation
  const funnelGlow = interpolate(frame, [packetAtFunnel - 10, packetAtFunnel + 20, trimAction + 10], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Blade Animation
  const bladeYOffset = interpolate(frame, [trimAction - 5, trimAction + 5, trimAction + 20], [-100, 0, -100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const bladeOpacity = interpolate(frame, [trimAction - 10, trimAction, trimAction + 30], [0, 1, 0]);

  // Colors
  const colors = {
    bg: '#0F172A',
    primary: '#3B82F6',
    secondary: '#10B981',
    accent: '#F59E0B',
    danger: '#EF4444',
  };

  const textStyle: React.CSSProperties = {
    color: 'white',
    fontFamily: 'sans-serif',
    fontSize: minDim * 0.04,
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%',
  };

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      {/* PERSISTENT ELEMENTS: Header */}
      <div style={{ position: 'absolute', top: height * 0.05, width: '100%', textAlign: 'center' }}>
        <FadeIn delay={10}>
          <h1 style={{ ...textStyle, fontSize: minDim * 0.07, margin: 0 }}>ROBUSTNESS PRINCIPLE</h1>
          <p style={{ ...textStyle, color: colors.secondary, marginTop: 10 }}>"Be liberal in what you accept"</p>
        </FadeIn>
      </div>

      {/* TRACKS / BASELINE */}
      <svg style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.2 }}>
        <line x1={clientX} y1={packetY} x2={dbX} y2={packetY} stroke="white" strokeWidth={2} strokeDasharray="10 10" />
      </svg>

      {/* PERSISTENT: API GATEWAY (Central Axis) */}
      <div style={{
        position: 'absolute',
        left: gatewayX - 2,
        top: height * 0.25,
        width: 4,
        height: height * 0.5,
        background: `linear-gradient(to bottom, transparent, ${colors.primary}, transparent)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <PopIn delay={0}>
          <div style={{
            width: minDim * 0.12,
            height: minDim * 0.12,
            borderRadius: '50%',
            background: colors.bg,
            border: `3px solid ${colors.primary}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 20px ${colors.primary}44`
          }}>
             <img src="https://unpkg.com/lucide-static@latest/icons/cpu.svg" style={{ width: '60%', filter: 'brightness(0) invert(1)' }} alt="Gateway" />
          </div>
        </PopIn>
      </div>

      {/* PERSISTENT Elements Icons */}
      <div style={{ position: 'absolute', left: clientX - minDim * 0.05, top: centerY - minDim * 0.2 }}>
        <img src="https://unpkg.com/lucide-static@latest/icons/monitor.svg" style={{ width: minDim * 0.1, filter: 'brightness(0) invert(1)', opacity: 0.5 }} alt="Client" />
      </div>
      <div style={{ position: 'absolute', left: dbX - minDim * 0.05, top: centerY - minDim * 0.2 }}>
        <img src="https://unpkg.com/lucide-static@latest/icons/database.svg" style={{ width: minDim * 0.1, filter: 'brightness(0) invert(1)', opacity: 0.5 }} alt="DB" />
      </div>

      {/* START STATE: Legacy blocks moving out */}
      <div style={{ position: 'absolute', left: blockX, top: packetY - slotHeight / 2, opacity: blockOpacity }}>
        <div style={{
          width: slotWidth,
          height: slotHeight,
          background: colors.secondary,
          borderRadius: 8,
          border: '2px solid white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 14,
          fontWeight: 'bold'
        }}>
          STRICT OUTPUT
        </div>
      </div>

      {/* THE MECHANISM: Wide Funnel Entry */}
      <div style={{
        position: 'absolute',
        left: gatewayX - width * 0.2,
        top: packetY - height * 0.15,
        width: width * 0.15,
        height: height * 0.3,
        display: 'flex',
        alignItems: 'center',
      }}>
         <svg width="100%" height="100%" viewBox="0 0 100 200">
            <path 
              d="M 10 20 L 90 70 L 90 130 L 10 180" 
              fill="none" 
              stroke={colors.primary} 
              strokeWidth="4" 
              strokeLinecap="round" 
              style={{ filter: `drop-shadow(0 0 ${funnelGlow * 10}px ${colors.primary})` }}
            />
         </svg>
      </div>

      {/* THE BIO PACKET (The Focus) */}
      {frame >= packetEnters && (
        <div style={{
          position: 'absolute',
          left: bioX - bioWidth / 2,
          top: packetY - slotHeight / 2,
          width: bioWidth,
          height: slotHeight,
          overflow: 'hidden',
          borderRadius: 8,
          background: `linear-gradient(90deg, ${colors.primary}, ${colors.accent})`,
          boxShadow: `0 10px 30px rgba(0,0,0,0.5)`,
          display: 'flex',
          alignItems: 'center',
          border: '2px solid rgba(255,255,255,0.3)',
          zIndex: 10,
        }}>
          <div style={{ paddingLeft: 20, whiteSpace: 'nowrap', color: 'white', fontWeight: 'bold' }}>
            {frame < trimAction ? "BIO: 'User profile bio that is way too long for our DB limit...'" : "BIO: 'User profile bio that i...'"}
          </div>
          {/* Visual indicator of "Too Long" */}
          {frame < trimAction && (
             <div style={{ position: 'absolute', right: 5, color: colors.danger, animation: 'pulse 1s infinite' }}>
               <img src="https://unpkg.com/lucide-static@latest/icons/alert-triangle.svg" style={{ width: 24, filter: 'brightness(0) invert(1)' }} alt="Alert" />
             </div>
          )}
        </div>
      )}

      {/* THE TRIMMING BLADE */}
      <div style={{
        position: 'absolute',
        left: gatewayX + 20,
        top: packetY + bladeYOffset - 40,
        opacity: bladeOpacity,
        zIndex: 20,
      }}>
         <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ height: 60, width: 4, background: colors.danger }} />
            <img 
              src="https://unpkg.com/lucide-static@latest/icons/scissors.svg" 
              style={{ width: 40, filter: 'invert(37%) sepia(93%) saturate(3755%) hue-rotate(339deg) brightness(98%) contrast(92%)' }} 
              alt="Trim"
            />
         </div>
      </div>

      {/* SAVED TO DB ANIMATION */}
      {frame > packetStored - 20 && (
        <div style={{
          position: 'absolute',
          left: dbX - slotWidth / 2,
          top: packetY - slotHeight / 2,
        }}>
          <GlowPulse color={colors.secondary}>
             <div style={{
               width: slotWidth,
               height: slotHeight,
               borderRadius: 8,
               border: `2px solid ${colors.secondary}`,
               background: `${colors.secondary}33`,
             }} />
          </GlowPulse>
        </div>
      )}

      {/* LABELS */}
      <div style={{ position: 'absolute', bottom: height * 0.1, width: '100%', display: 'flex', justifyContent: 'center', gap: width * 0.2 }}>
        <FadeIn delay={40}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ ...textStyle, color: colors.primary, fontSize: minDim * 0.035 }}>FLEXIBLE INPUT</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: minDim * 0.025 }}>Accept variations</div>
          </div>
        </FadeIn>
        
        <FadeIn delay={120}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ ...textStyle, color: colors.accent, fontSize: minDim * 0.035 }}>NORMALIZATION</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: minDim * 0.025 }}>Trim & Sanitize</div>
          </div>
        </FadeIn>
      </div>

      {/* Educational Callout */}
      {frame > trimAction && frame < packetStored + 30 && (
        <AbsoluteFill style={{ pointerEvents: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', top: height * 0.15 }}>
          <PopIn>
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              padding: '10px 20px',
              borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.2)',
            }}>
              <span style={{ color: colors.secondary, fontWeight: 'bold' }}>✓ AUTO-TRIMMED TO FIT</span>
            </div>
          </PopIn>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}