import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { useScale } from '../../use-scale';
import { getConstants, BACKGROUNDS } from './constants';
import type { CountdownRevealProps } from './schema';

const CountdownReveal: React.FC<CountdownRevealProps> = (props) => {
  const { FONTS } = getConstants(props);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = useScale();
  const theme = BACKGROUNDS[props.background];

  const items = props.items;
  const itemCount = items.length;

  const introOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const outroOpacity = interpolate(frame, [durationInFrames - 30, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Title
  const titleOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleSlideY = interpolate(frame, [0, 18], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Item timing
  const itemsStart = 25;
  const lastItemExtra = 25; // #1 gets extra hold time
  const availableFrames = durationInFrames - itemsStart - 40 - lastItemExtra;
  const framesPerItem = Math.floor(availableFrames / itemCount);

  // Determine which item is currently showing
  const activeIdx = Math.min(
    Math.floor((frame - itemsStart) / framesPerItem),
    itemCount - 1
  );

  const bgStyle: React.CSSProperties = props.background === 'gradient'
    ? { background: theme.bg }
    : { backgroundColor: theme.bg };

  return (
    <AbsoluteFill style={{ ...bgStyle, opacity: introOpacity * outroOpacity }}>
      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: s(40),
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: titleOpacity,
          transform: `translateY(${titleSlideY}px)`,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: s(24),
            fontWeight: 600,
            letterSpacing: s(3),
            color: theme.textMuted,
            textTransform: 'uppercase',
          }}
        >
          {props.title}
        </span>
      </div>

      {/* Items */}
      {items.map((item, i) => {
        // Items display in reverse: last item in array = rank N (shown first)
        // First item in array = rank 1 (shown last)
        const displayOrder = itemCount - 1 - i; // 0 = shown first, itemCount-1 = shown last
        const rank = i + 1; // rank 1 = first in array
        const isNumberOne = rank === 1;

        const enterFrame = itemsStart + displayOrder * framesPerItem;
        const exitFrame = isNumberOne
          ? durationInFrames - 30
          : enterFrame + framesPerItem;

        if (frame < enterFrame - 2 || frame > exitFrame + 5) return null;

        const localFrame = frame - enterFrame;

        // Rank number animation
        const numberScale = spring({
          frame: localFrame,
          fps,
          config: { damping: 12, stiffness: 200, mass: 0.6 },
        });

        const numberTargetScale = isNumberOne ? 1.3 : 1.0;
        const rankScale = interpolate(numberScale, [0, 1], [2.5, numberTargetScale]);
        const rankRotation = interpolate(numberScale, [0, 1], [-15, 0]);
        const rankOpacity = interpolate(localFrame, [0, 6], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        // Number moves to left, card appears from right
        const layoutProgress = interpolate(localFrame, [8, 22], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        // Card slide
        const cardSlideX = interpolate(layoutProgress, [0, 1], [80, 0]);
        const cardOpacity = interpolate(localFrame, [10, 22], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        // Title in card
        const titleInCardOpacity = interpolate(localFrame, [14, 24], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        // Subtitle + value
        const detailsOpacity = interpolate(localFrame, [20, 30], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        // Exit (not for #1)
        const itemExitOpacity = isNumberOne
          ? 1
          : interpolate(frame, [exitFrame - 8, exitFrame], [1, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

        // #1 glow
        const glowOpacity = isNumberOne
          ? interpolate(localFrame, [15, 30], [0, 0.6], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          : 0;

        const numberColor = props.numberColor;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: itemExitOpacity,
            }}
          >
            {/* Glow for #1 */}
            {isNumberOne && (
              <div
                style={{
                  position: 'absolute',
                  width: s(400),
                  height: s(400),
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${numberColor}30 0%, transparent 70%)`,
                  opacity: glowOpacity,
                }}
              />
            )}

            {/* Layout: number on left, card on right */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: interpolate(layoutProgress, [0, 1], [0, s(40)]),
                transform: `translateX(${interpolate(layoutProgress, [0, 1], [0, s(-40)])}px)`,
              }}
            >
              {/* Rank number */}
              <div
                style={{
                  opacity: rankOpacity,
                  transform: `scale(${rankScale}) rotate(${rankRotation}deg)`,
                }}
              >
                <span
                  style={{
                    fontFamily: FONTS.headline,
                    fontSize: isNumberOne ? s(180) : s(140),
                    fontWeight: 900,
                    color: numberColor,
                    lineHeight: 1,
                    textShadow: isNumberOne ? `0 0 ${s(40)}px ${numberColor}50` : undefined,
                  }}
                >
                  {rank}
                </span>
              </div>

              {/* Item card */}
              <div
                style={{
                  opacity: cardOpacity,
                  transform: `translateX(${cardSlideX}px)`,
                  background: theme.cardBg,
                  border: `1px solid ${theme.cardBorder}`,
                  borderRadius: s(20),
                  padding: `${s(28)}px ${s(36)}px`,
                  minWidth: s(400),
                  display: 'flex',
                  flexDirection: 'column',
                  gap: s(8),
                }}
              >
                <span
                  style={{
                    fontFamily: FONTS.headline,
                    fontSize: isNumberOne ? s(44) : s(36),
                    fontWeight: 800,
                    color: theme.text,
                    opacity: titleInCardOpacity,
                  }}
                >
                  {item.title}
                </span>

                {(item.subtitle || item.value) && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      opacity: detailsOpacity,
                      gap: s(16),
                    }}
                  >
                    {item.subtitle && (
                      <span
                        style={{
                          fontFamily: FONTS.body,
                          fontSize: s(20),
                          fontWeight: 400,
                          color: theme.textMuted,
                        }}
                      >
                        {item.subtitle}
                      </span>
                    )}
                    {item.value && (
                      <span
                        style={{
                          fontFamily: FONTS.headline,
                          fontSize: s(24),
                          fontWeight: 700,
                          color: numberColor,
                        }}
                      >
                        {item.value}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Progress dots */}
      {frame >= itemsStart && (
        <div
          style={{
            position: 'absolute',
            bottom: s(50),
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: s(10),
          }}
        >
          {items.map((_, i) => {
            const displayOrder = itemCount - 1 - i;
            const isActive = displayOrder <= activeIdx;
            return (
              <div
                key={i}
                style={{
                  width: isActive ? s(24) : s(8),
                  height: s(8),
                  borderRadius: s(4),
                  backgroundColor: isActive ? props.accentColor : `${theme.text}20`,
                }}
              />
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};

export default CountdownReveal;
