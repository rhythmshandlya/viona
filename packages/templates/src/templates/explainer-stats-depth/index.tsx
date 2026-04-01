import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import type { ExplainerStatsDepthProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_TIMING } from '../../blackboard/constants';
import { glowFadeIn, staggeredGlowIn, glowExit } from '../../blackboard/animations';
import { GlowHeading, GlowLabel } from '../../blackboard/typography';
import { useScale } from '../../use-scale';
import { CountUp } from '../explainer-stats/components/CountUp';
import { computeSpeakerPx, computeVisibleZones } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;

const ExplainerStatsDepth: React.FC<ExplainerStatsDepthProps> = ({
  title,
  stats = [],
  speakerBbox,
  speakerCenter,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const { bboxPx, centerPx } = computeSpeakerPx(
    speakerBbox,
    speakerCenter,
    CANVAS_W,
    CANVAS_H,
  );
  const zones = computeVisibleZones(bboxPx, CANVAS_W, CANVAS_H);

  const titleAnim = glowFadeIn(frame, 5);
  const exit = glowExit(frame, durationInFrames - BLACKBOARD_TIMING.exitDuration);

  const count = stats.length;

  // Stats are shown sequentially — each occupies its time window
  // then holds. All numbers are oversized and centered on speaker.
  const statStagger = 12;
  const statEnterDuration = 20;

  // Oversized number font — large enough to extend past speaker bbox
  const bigFontSize = s(140);

  // Layout: numbers stacked vertically around speaker center
  const statSpacing = s(280);
  const firstStatY = centerPx.y - ((count - 1) * statSpacing) / 2;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        {/* Title — top of canvas */}
        {title && (
          <div style={{
            position: 'absolute',
            top: s(120),
            left: 0,
            width: '100%',
            textAlign: 'center',
            opacity: titleAnim.contentProgress,
            transform: `scale(${titleAnim.scale})`,
          }}>
            <GlowHeading text={title} size={s(48)} glowIntensity={titleAnim.glowProgress} />
          </div>
        )}

        {/* Stat numbers — oversized, centered on speaker */}
        {stats.map((stat, index) => {
          const enterStart = 20 + index * statStagger;
          const stagger = staggeredGlowIn(frame, enterStart, index, statStagger);
          const countStart = enterStart + 5;
          const pulseStart = enterStart + 35;

          // DepthEntrance: scale from 0.3 at speaker center to full size
          const entranceProgress = interpolate(
            frame,
            [enterStart, enterStart + statEnterDuration],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.1)) },
          );
          const entranceScale = interpolate(entranceProgress, [0, 1], [0.3, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          const entranceOpacity = interpolate(entranceProgress, [0, 0.3], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });

          // Subtle drift after landing
          const depthMul = (index + 1) * 6;
          const driftX = frame >= enterStart + statEnterDuration
            ? Math.sin(frame * 0.015 + index * 2.0) * depthMul : 0;
          const driftY = frame >= enterStart + statEnterDuration
            ? Math.sin(frame * 0.02 + index * 1.5) * depthMul * 0.5 : 0;

          const statY = firstStatY + index * statSpacing;

          return (
            <React.Fragment key={index}>
              {/* Oversized number — centered on speaker, extends past bbox */}
              <div style={{
                position: 'absolute',
                left: 0,
                width: '100%',
                top: statY - bigFontSize / 2,
                display: 'flex',
                justifyContent: 'center',
                opacity: entranceOpacity,
                transform: `scale(${entranceScale}) translate(${driftX}px, ${driftY}px)`,
                transformOrigin: `${centerPx.x}px ${bigFontSize / 2}px`,
                zIndex: index,
              }}>
                <CountUp
                  value={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  startFrame={countStart}
                  duration={30}
                  fontSize={bigFontSize}
                  pulseStart={pulseStart}
                />
              </div>

              {/* Label — in visible zone below speaker */}
              <div style={{
                position: 'absolute',
                left: 0,
                width: '100%',
                top: statY + bigFontSize * 0.4,
                textAlign: 'center',
                opacity: stagger.contentProgress,
                transform: `scale(${stagger.scale})`,
                zIndex: count + index,
              }}>
                <GlowLabel
                  text={stat.label}
                  size={s(22)}
                  color={BLACKBOARD_COLORS.textMuted}
                />
              </div>
            </React.Fragment>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerStatsDepth;
