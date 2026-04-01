import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { ExplainerComparisonProps } from './schema';
import { BLACKBOARD_COLORS, BLACKBOARD_FONTS, BLACKBOARD_TIMING } from '../../blackboard/constants';
import { glowFadeIn, glowExit, staggeredGlowIn } from '../../blackboard/animations';
import { BoardTexture } from '../../blackboard/textures';
import { GlowHeading } from '../../blackboard/typography';
import { GlowPanel } from '../../blackboard/effects';
import { useScale } from '../../use-scale';
import { computeSpeakerPx, computeVisibleZones } from '../../depth';

const CANVAS_W = 1080;
const CANVAS_H = 1920;

const ExplainerComparison: React.FC<ExplainerComparisonProps> = ({
  heading,
  titleA,
  titleB,
  pointsA,
  pointsB,
  speakerBbox,
  speakerCenter,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = useScale();

  const isDepthMode = !!speakerBbox && !!speakerCenter;
  const depthData = isDepthMode
    ? computeSpeakerPx(speakerBbox, speakerCenter, CANVAS_W, CANVAS_H)
    : null;
  const zones = isDepthMode && depthData
    ? computeVisibleZones(depthData.bboxPx, CANVAS_W, CANVAS_H)
    : null;

  const headingAnim = glowFadeIn(frame, 5);
  const headerAnim = glowFadeIn(frame, 20);
  const exit = glowExit(frame, durationInFrames - BLACKBOARD_TIMING.exitDuration);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <AbsoluteFill style={{ opacity: exit.opacity }}>
        <BoardTexture seed="comp-bg" />

        {!isDepthMode ? (
          /* -- Standard layout ---------------------------------------- */
          <div
            style={{
              position: 'absolute',
              left: s(40),
              right: s(40),
              top: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {heading && (
              <div
                style={{
                  opacity: headingAnim.contentProgress,
                  transform: `scale(${headingAnim.scale})`,
                  marginBottom: s(32),
                  textAlign: 'center',
                }}
              >
                <GlowHeading
                  text={heading}
                  size={s(44)}
                  glowIntensity={headingAnim.glowProgress}
                />
              </div>
            )}

            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                gap: s(16),
                width: '100%',
              }}
            >
              {/* Left column -- amber / primary */}
              <GlowPanel
                glowColor="primary"
                glowIntensity={headerAnim.glowProgress}
                style={{
                  flex: 1,
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
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: s(12),
                        marginBottom: s(14),
                        opacity: anim.contentProgress,
                        transform: `scale(${anim.scale})`,
                      }}
                    >
                      <div
                        style={{
                          width: s(8),
                          height: s(8),
                          borderRadius: '50%',
                          backgroundColor: BLACKBOARD_COLORS.primary,
                          marginTop: s(8),
                          flexShrink: 0,
                        }}
                      />
                      <div
                        style={{
                          fontFamily: BLACKBOARD_FONTS.body,
                          fontSize: s(22),
                          color: BLACKBOARD_COLORS.text,
                          lineHeight: 1.4,
                        }}
                      >
                        {point}
                      </div>
                    </div>
                  );
                })}
              </GlowPanel>

              {/* Right column -- cyan / secondary */}
              <GlowPanel
                glowColor="secondary"
                glowIntensity={headerAnim.glowProgress}
                style={{
                  flex: 1,
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
                    style={{ textShadow: headerAnim.glowProgress > 0 ? '0 0 30px rgba(6, 182, 212, 0.3)' : 'none' }}
                  />
                </div>

                {pointsB.map((point, index) => {
                  const anim = staggeredGlowIn(frame, 35, index, 6);
                  return (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: s(12),
                        marginBottom: s(14),
                        opacity: anim.contentProgress,
                        transform: `scale(${anim.scale})`,
                      }}
                    >
                      <div
                        style={{
                          width: s(8),
                          height: s(8),
                          borderRadius: '50%',
                          backgroundColor: BLACKBOARD_COLORS.secondary,
                          marginTop: s(8),
                          flexShrink: 0,
                        }}
                      />
                      <div
                        style={{
                          fontFamily: BLACKBOARD_FONTS.body,
                          fontSize: s(22),
                          color: BLACKBOARD_COLORS.text,
                          lineHeight: 1.4,
                        }}
                      >
                        {point}
                      </div>
                    </div>
                  );
                })}
              </GlowPanel>
            </div>
          </div>
        ) : (
          /* -- Depth layout: two sides split behind speaker ----------- */
          <>
            {/* Heading above speaker */}
            {heading && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: s(80),
                  textAlign: 'center',
                  opacity: headingAnim.contentProgress,
                  transform: `scale(${headingAnim.scale})`,
                }}
              >
                <GlowHeading
                  text={heading}
                  size={s(40)}
                  glowIntensity={headingAnim.glowProgress}
                />
              </div>
            )}

            {/* Left panel (side A) -- slides in from left */}
            {(() => {
              const leftZone = zones!.left;
              const panelPad = s(20);
              const slideLeft = interpolate(
                frame,
                [20, 35],
                [-leftZone.w, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );

              return (
                <div
                  style={{
                    position: 'absolute',
                    left: leftZone.x + panelPad,
                    top: depthData!.bboxPx.y + s(40),
                    width: Math.max(0, leftZone.w - panelPad * 2),
                    opacity: headerAnim.contentProgress,
                    transform: `translateX(${slideLeft}px)`,
                  }}
                >
                  <GlowPanel
                    glowColor="primary"
                    glowIntensity={headerAnim.glowProgress}
                    style={{ padding: s(20) }}
                  >
                    <div style={{ marginBottom: s(16) }}>
                      <GlowHeading
                        text={titleA}
                        size={s(28)}
                        color={BLACKBOARD_COLORS.primary}
                        glowIntensity={headerAnim.glowProgress}
                      />
                    </div>

                    {pointsA.map((point, index) => {
                      const anim = staggeredGlowIn(frame, 35, index, 6);
                      return (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            gap: s(10),
                            marginBottom: s(12),
                            opacity: anim.contentProgress,
                            transform: `scale(${anim.scale})`,
                          }}
                        >
                          <div
                            style={{
                              width: s(7),
                              height: s(7),
                              borderRadius: '50%',
                              backgroundColor: BLACKBOARD_COLORS.primary,
                              marginTop: s(7),
                              flexShrink: 0,
                              boxShadow: `0 0 ${s(8)}px ${BLACKBOARD_COLORS.primary}`,
                            }}
                          />
                          <div
                            style={{
                              fontFamily: BLACKBOARD_FONTS.body,
                              fontSize: s(20),
                              color: BLACKBOARD_COLORS.text,
                              lineHeight: 1.4,
                            }}
                          >
                            {point}
                          </div>
                        </div>
                      );
                    })}
                  </GlowPanel>
                </div>
              );
            })()}

            {/* Right panel (side B) -- slides in from right */}
            {(() => {
              const rightZone = zones!.right;
              const panelPad = s(20);
              const slideRight = interpolate(
                frame,
                [20, 35],
                [rightZone.w, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );

              return (
                <div
                  style={{
                    position: 'absolute',
                    left: rightZone.x + panelPad,
                    top: depthData!.bboxPx.y + s(40),
                    width: Math.max(0, rightZone.w - panelPad * 2),
                    opacity: headerAnim.contentProgress,
                    transform: `translateX(${slideRight}px)`,
                  }}
                >
                  <GlowPanel
                    glowColor="secondary"
                    glowIntensity={headerAnim.glowProgress}
                    style={{ padding: s(20) }}
                  >
                    <div style={{ marginBottom: s(16) }}>
                      <GlowHeading
                        text={titleB}
                        size={s(28)}
                        color={BLACKBOARD_COLORS.secondary}
                        glowIntensity={headerAnim.glowProgress}
                      />
                    </div>

                    {pointsB.map((point, index) => {
                      const anim = staggeredGlowIn(frame, 35, index, 6);
                      return (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            gap: s(10),
                            marginBottom: s(12),
                            opacity: anim.contentProgress,
                            transform: `scale(${anim.scale})`,
                          }}
                        >
                          <div
                            style={{
                              width: s(7),
                              height: s(7),
                              borderRadius: '50%',
                              backgroundColor: BLACKBOARD_COLORS.secondary,
                              marginTop: s(7),
                              flexShrink: 0,
                              boxShadow: `0 0 ${s(8)}px ${BLACKBOARD_COLORS.secondary}`,
                            }}
                          />
                          <div
                            style={{
                              fontFamily: BLACKBOARD_FONTS.body,
                              fontSize: s(20),
                              color: BLACKBOARD_COLORS.text,
                              lineHeight: 1.4,
                            }}
                          >
                            {point}
                          </div>
                        </div>
                      );
                    })}
                  </GlowPanel>
                </div>
              );
            })()}
          </>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default ExplainerComparison;
