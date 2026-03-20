import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import type { IPhoneMessagesProps } from './schema';

interface MessageItem {
  text: string;
  from: 'me' | 'them';
}

const FRAME_COLORS: Record<string, { bg: string; border: string }> = {
  'space-black': { bg: '#1C1C1E', border: '#3A3A3C' },
  'silver': { bg: '#D1D1D6', border: '#E5E5EA' },
  'gold': { bg: '#D4C5A9', border: '#E5D9C3' },
  'deep-purple': { bg: '#2D1B4E', border: '#4A3070' },
};

const MSG_START = 50;
const MSG_STAGGER = 35;

const IPhoneMessages: React.FC<IPhoneMessagesProps> = (props) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const isDark = props.theme === 'dark';

  // ── Collect non-empty messages ─────────────────────────────────────
  const messages: MessageItem[] = [
    props.msg1, props.msg2, props.msg3, props.msg4, props.msg5, props.msg6,
  ].filter((m) => m.text.length > 0);

  // ── Phone sizing (relative to composition) ─────────────────────────
  const s = Math.min(width, height) / 1080;
  const PW = 400 * s;  // phone width
  const PH = 830 * s;  // phone height
  const PR = PW * 0.125; // phone corner radius
  const SR = PR - 4;     // screen corner radius

  // ── 3D entry animation ─────────────────────────────────────────────
  const entry = spring({
    frame, fps,
    config: { damping: 26, stiffness: 80, mass: 1.2 },
  });

  const rY = interpolate(entry, [0, 1], [-20, -5], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const rX = interpolate(entry, [0, 1], [12, 4], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const sc = interpolate(entry, [0, 1], [0.7, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Subtle float / sway ────────────────────────────────────────────
  const t = frame / durationInFrames;
  const floatY = interpolate(t, [0, 0.25, 0.5, 0.75, 1], [0, -6, 0, 6, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const swayRY = interpolate(t, [0, 0.5, 1], [-5, 3, -5], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Fade in / out ──────────────────────────────────────────────────
  const fadeIn = interpolate(frame, [0, 25], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Reflection sweep ───────────────────────────────────────────────
  const reflectX = interpolate(frame, [0, durationInFrames], [-PW * 0.5, PW * 1.5], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Theme colors ───────────────────────────────────────────────────
  const screenBg = isDark ? '#000000' : '#FFFFFF';
  const headerBg = isDark ? '#1C1C1E' : '#F6F6F6';
  const msgAreaBg = isDark ? '#000000' : '#FFFFFF';
  const theirBubbleBg = isDark ? '#26252A' : '#E9E9EB';
  const theirText = isDark ? '#FFFFFF' : '#000000';
  const headerText = isDark ? '#FFFFFF' : '#000000';
  const separatorColor = isDark ? '#38383A' : '#C6C6C8';
  const keyBg = isDark ? '#3A3A3C' : '#FFFFFF';
  const keyboardBg = isDark ? '#1C1C1E' : '#D1D1D6';

  const pf = FRAME_COLORS[props.phoneColor] ?? FRAME_COLORS['space-black'];

  const font = 'Inter, -apple-system, system-ui, sans-serif';

  return (
    <AbsoluteFill
      style={{ backgroundColor: props.backgroundColor, opacity: fadeIn * fadeOut }}
    >
      {/* Background glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 50% 40%, ${props.myBubbleColor}18 0%, transparent 50%)`,
        pointerEvents: 'none',
      }} />

      {/* 3D container */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        perspective: 1200,
      }}>
        {/* Phone shadow */}
        <div style={{
          position: 'absolute',
          width: PW * 0.7,
          height: 30 * s,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.35)',
          filter: `blur(${18 * s}px)`,
          bottom: `calc(50% - ${PH / 2 + 25 * s}px)`,
          transform: `translateY(${floatY}px)`,
        }} />

        {/* Phone */}
        <div style={{
          width: PW, height: PH,
          borderRadius: PR,
          backgroundColor: pf.bg,
          border: `2px solid ${pf.border}`,
          padding: 4 * s,
          transform: `rotateX(${rX}deg) rotateY(${rY + swayRY}deg) translateY(${floatY}px) scale(${sc})`,
          transformStyle: 'preserve-3d',
          boxShadow: `0 ${20 * s}px ${60 * s}px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08) inset`,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Screen */}
          <div style={{
            width: '100%', height: '100%',
            borderRadius: SR,
            backgroundColor: screenBg,
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            position: 'relative',
          }}>
            {/* Dynamic Island */}
            <div style={{
              position: 'absolute',
              top: PH * 0.012,
              left: '50%',
              transform: 'translateX(-50%)',
              width: PW * 0.28,
              height: PH * 0.036,
              backgroundColor: '#000',
              borderRadius: 20 * s,
              zIndex: 10,
            }} />

            {/* Status bar */}
            <div style={{
              height: PH * 0.065,
              display: 'flex', alignItems: 'flex-end',
              justifyContent: 'space-between',
              padding: `0 ${PW * 0.07}px ${PH * 0.005}px`,
              backgroundColor: headerBg,
              fontSize: PW * 0.035, fontWeight: 600,
              color: headerText, fontFamily: font,
            }}>
              <span>9:41</span>
              <div style={{ display: 'flex', gap: 3 * s, alignItems: 'center', fontSize: PW * 0.025 }}>
                <span>●●●●</span>
                <span style={{ fontSize: PW * 0.03, marginLeft: 2 }}>■</span>
              </div>
            </div>

            {/* iMessage header */}
            <div style={{
              backgroundColor: headerBg,
              padding: `${PH * 0.008}px ${PW * 0.05}px ${PH * 0.012}px`,
              borderBottom: `0.5px solid ${separatorColor}`,
              display: 'flex', alignItems: 'center', gap: PW * 0.03,
            }}>
              <span style={{ color: '#007AFF', fontSize: PW * 0.06, fontWeight: 300, lineHeight: 1 }}>‹</span>
              <div style={{
                width: PW * 0.09, height: PW * 0.09,
                borderRadius: '50%',
                backgroundColor: isDark ? '#636366' : '#C7C7CC',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: PW * 0.04, fontWeight: 600,
                color: isDark ? '#FFF' : '#FFF',
                flexShrink: 0,
              }}>
                {props.contactEmoji}
              </div>
              <div style={{
                fontSize: PW * 0.042, fontWeight: 600,
                color: headerText, fontFamily: font,
              }}>
                {props.contactName}
              </div>
            </div>

            {/* Messages area */}
            <div style={{
              flex: 1,
              backgroundColor: msgAreaBg,
              padding: `${PH * 0.02}px ${PW * 0.04}px`,
              display: 'flex', flexDirection: 'column',
              gap: PH * 0.007,
              justifyContent: 'flex-end',
              overflow: 'hidden',
            }}>
              {messages.map((msg, i) => {
                const msgFrame = MSG_START + i * MSG_STAGGER;
                if (frame < msgFrame) return null;

                const isMe = msg.from === 'me';
                const pop = spring({
                  frame: Math.max(0, frame - msgFrame), fps,
                  config: { damping: 22, stiffness: 170, mass: 0.8 },
                });
                const opacity = interpolate(frame, [msgFrame, msgFrame + 10], [0, 1], {
                  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                });
                const scaleVal = interpolate(pop, [0, 1], [0.65, 1], {
                  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                });
                const yOff = interpolate(pop, [0, 1], [12, 0], {
                  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                });

                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: isMe ? 'flex-end' : 'flex-start',
                      opacity,
                      transform: `translateY(${yOff}px) scale(${scaleVal})`,
                      transformOrigin: isMe ? 'bottom right' : 'bottom left',
                    }}
                  >
                    <div style={{
                      backgroundColor: isMe ? props.myBubbleColor : theirBubbleBg,
                      color: isMe ? '#FFF' : theirText,
                      padding: `${PH * 0.009}px ${PW * 0.04}px`,
                      borderRadius: PW * 0.05,
                      maxWidth: '78%',
                      fontSize: PW * 0.042,
                      fontFamily: font,
                      lineHeight: 1.35,
                      wordBreak: 'break-word',
                    }}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Keyboard */}
            {props.showKeyboard && (
              <Keyboard
                isDark={isDark}
                keyBg={keyBg}
                keyboardBg={keyboardBg}
                separatorColor={separatorColor}
                PW={PW}
                PH={PH}
                s={s}
                font={font}
              />
            )}

            {/* Home indicator */}
            <div style={{
              height: PH * 0.022,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: props.showKeyboard ? keyboardBg : msgAreaBg,
            }}>
              <div style={{
                width: PW * 0.35, height: 4 * s,
                borderRadius: 2 * s,
                backgroundColor: isDark ? '#FFF' : '#000',
                opacity: 0.25,
              }} />
            </div>
          </div>

          {/* Screen reflection */}
          <div style={{
            position: 'absolute',
            inset: 4 * s,
            borderRadius: SR,
            background: `linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.03) 40%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 60%, transparent 100%)`,
            transform: `translateX(${reflectX}px)`,
            pointerEvents: 'none',
          }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Simplified iOS keyboard ──────────────────────────────────────────────

function Keyboard({
  isDark, keyBg, keyboardBg, separatorColor, PW, PH, s, font,
}: {
  isDark: boolean; keyBg: string; keyboardBg: string; separatorColor: string;
  PW: number; PH: number; s: number; font: string;
}) {
  const keyShadow = isDark ? 'none' : `0 ${1 * s}px 0 rgba(0,0,0,0.12)`;
  const keyH = PH * 0.042;
  const gap = PW * 0.012;
  const keyR = 5 * s;

  return (
    <div style={{
      height: PH * 0.26,
      backgroundColor: keyboardBg,
      padding: `${PH * 0.006}px ${PW * 0.02}px`,
      display: 'flex', flexDirection: 'column', gap: PH * 0.007,
    }}>
      {/* Text field */}
      <div style={{
        display: 'flex', gap: PW * 0.02, alignItems: 'center',
        padding: `0 ${PW * 0.01}px`,
        marginBottom: PH * 0.003,
      }}>
        <div style={{
          flex: 1, height: PH * 0.038,
          borderRadius: 18 * s,
          border: `1px solid ${separatorColor}`,
          backgroundColor: isDark ? '#2C2C2E' : '#FFF',
          padding: `0 ${PW * 0.03}px`,
          display: 'flex', alignItems: 'center',
          fontSize: PW * 0.032, color: '#8E8E93', fontFamily: font,
        }}>
          iMessage
        </div>
        <div style={{
          width: PW * 0.065, height: PW * 0.065,
          borderRadius: '50%',
          backgroundColor: '#007AFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: PW * 0.035, color: '#FFF', fontWeight: 700,
        }}>↑</div>
      </div>

      {/* Key rows */}
      {[10, 9, 7].map((count, row) => (
        <div key={row} style={{
          display: 'flex', gap, justifyContent: 'center',
          padding: `0 ${row === 2 ? PW * 0.07 : 0}px`,
        }}>
          {Array.from({ length: count }).map((_, k) => (
            <div key={k} style={{
              flex: 1, height: keyH,
              backgroundColor: keyBg, borderRadius: keyR,
              boxShadow: keyShadow,
            }} />
          ))}
        </div>
      ))}

      {/* Bottom row: special + space + special */}
      <div style={{ display: 'flex', gap, justifyContent: 'center' }}>
        <div style={{
          width: PW * 0.18, height: keyH,
          backgroundColor: isDark ? '#636366' : '#ADB0BB',
          borderRadius: keyR, boxShadow: keyShadow,
        }} />
        <div style={{
          flex: 1, height: keyH,
          backgroundColor: keyBg, borderRadius: keyR,
          boxShadow: keyShadow,
        }} />
        <div style={{
          width: PW * 0.18, height: keyH,
          backgroundColor: isDark ? '#636366' : '#ADB0BB',
          borderRadius: keyR, boxShadow: keyShadow,
        }} />
      </div>
    </div>
  );
}

export default IPhoneMessages;
