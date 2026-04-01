import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ExplainerComparisonDepthProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_TIMING } from '../../blackboard/constants';
import { glowFadeIn, glowExit, staggeredGlowIn } from '../../blackboard/animations';
import { GlowHeading } from '../../blackboard/typography';
import { GlowPanel } from '../../blackboard/effects';
import { useScale } from '../../use-scale';
import { computeSpeakerPx, computeVisibleZones } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;

const ExplainerComparisonDepth: React.FC<ExplainerComparisonDepthProps> = ({
  heading,
  titleA,
  titleB,
  pointsA = [],
  pointsB = [],
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

  const headingAnim = glowFadeIn(frame, 5);
  const headerAnim = glowFadeIn(frame, 20);
  const exit = glowExit(frame, durationInFrames - BLACKBOARD_TIMING.exitDuration);

  // Panel width: wide enough to extend from edge of canvas to behind speaker's shoulder
  const panelW = s(460);
  const panelGap = s(16);

  // Left panel: right edge overlaps into speaker bbox (peeks from left shoulder)
  const leftPanelX = bboxPx.x - panelW * 0.55;
  // Right panel: left edge overlaps into speaker bbox (peeks from right shoulder)
  const rightPanelX = bboxPx.x + bboxPx.w - panelW * 0.45;

  // Panels centered vertically at speaker chest height
  const panelTopY = bboxPx.y + bboxPx.h * 0.15;

  // Subtle parallax for spatial separation
  const leftDriftX = frame >= 60 ? Math.sin(frame * 0.02) * 6 : 0;
  const rightDriftX = frame >= 60 ? Math.sin(frame * 0.02 + Math.PI) * 6 : 0;
  const driftY = frame >= 60 ? Math.sin(frame * 0.025) * 4 : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        {/* Heading — top visible zone */}
        {heading && (
          <div style={{
            position: 'absolute',
            top: s(120),
            left: 0,
            width: '100%',
            textAlign: 'center',
            opacity: headingAnim.contentProgress,
            transform: `scale(${headingAnim.scale})`,
            zIndex: 10,
          }}>
            <GlowHeading text={heading} size={s(44)} glowIntensity={headingAnim.glowProgress} />
          </div>
        )}

        {/* Left column — behind speaker's left side (primary/amber) */}
        <div style={{
          position: 'absolute',
          left: leftPanelX + leftDriftX,
          top: panelTopY + driftY,
          width: panelW,
          zIndex: 0,
        }}>
          <GlowPanel
            glowColor="primary"
            glowIntensity={headerAnim.glowProgress}
            style={{
              padding: s(24),
              opacity: headerAnim.contentProgress,
              transform: `scale(${headerAnim.scale})`,
            }}
          >
            <div style={{ marginBottom: s(20) }}>
              <GlowHeading
                text={titleA}
                size={s(32)}
                color={BLACKBOARD_COLORS.primary}
                glowIntensity={headerAnim.glowProgress}
              />
            </div>

            {pointsA.map((point, index) => {
              const anim = staggeredGlowIn(frame, 35, index, 6);
              return (
                <div key={index} style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: s(12),
                  marginBottom: s(14),
                  opacity: anim.contentProgress,
                  transform: `scale(${anim.scale})`,
                }}>
                  <div style={{
                    width: s(8),
                    height: s(8),
                    borderRadius: '50%',
                    backgroundColor: BLACKBOARD_COLORS.primary,
                    marginTop: s(8),
                    flexShrink: 0,
                  }} />
                  <div style={{
                    fontFamily: BLACKBOARD_FONTS.body,
                    fontSize: s(22),
                    color: BLACKBOARD_COLORS.text,
                    lineHeight: 1.4,
                  }}>
                    {point}
                  </div>
                </div>
              );
            })}
          </GlowPanel>
        </div>

        {/* Right column — behind speaker's right side (secondary/cyan) */}
        <div style={{
          position: 'absolute',
          left: rightPanelX + rightDriftX,
          top: panelTopY + driftY,
          width: panelW,
          zIndex: 0,
        }}>
          <GlowPanel
            glowColor="secondary"
            glowIntensity={headerAnim.glowProgress}
            style={{
              padding: s(24),
              opacity: headerAnim.contentProgress,
              transform: `scale(${headerAnim.scale})`,
            }}
          >
            <div style={{ marginBottom: s(20) }}>
              <GlowHeading
                text={titleB}
                size={s(32)}
                color={BLACKBOARD_COLORS.secondary}
                glowIntensity={headerAnim.glowProgress}
              />
            </div>

            {pointsB.map((point, index) => {
              const anim = staggeredGlowIn(frame, 35, index, 6);
              return (
                <div key={index} style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: s(12),
                  marginBottom: s(14),
                  opacity: anim.contentProgress,
                  transform: `scale(${anim.scale})`,
                }}>
                  <div style={{
                    width: s(8),
                    height: s(8),
                    borderRadius: '50%',
                    backgroundColor: BLACKBOARD_COLORS.secondary,
                    marginTop: s(8),
                    flexShrink: 0,
                  }} />
                  <div style={{
                    fontFamily: BLACKBOARD_FONTS.body,
                    fontSize: s(22),
                    color: BLACKBOARD_COLORS.text,
                    lineHeight: 1.4,
                  }}>
                    {point}
                  </div>
                </div>
              );
            })}
          </GlowPanel>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerComparisonDepth;
