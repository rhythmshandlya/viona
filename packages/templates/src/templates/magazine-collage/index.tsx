import React from 'react';
import { useCurrentFrame, interpolate, random } from 'remotion';
import type { MagazineCollageProps } from './schema';
import { ScaledContainer } from '../../magazine/ScaledContainer';
import { paperSlide, magazineEasing } from '../../magazine/animations';
import { PaperClipping } from './components/PaperClipping';
import { TapeMark } from '../../magazine/decorations';
import { PinMark } from '../../magazine/decorations';
import { TopicWord } from './components/TopicWord';

// ── Layout constants ─────────────────────────────────────────────────────────

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const COLS = 2;
const ROWS = 3;
const CELL_W = CANVAS_W / COLS; // 540
const CELL_H = CANVAS_H / ROWS; // 640

const CLIPPING_W = 420;
const CLIPPING_H = 320;
const TOPIC_W = 700;
const TOPIC_H = 300;

const STAGGER = 8; // frames between each clipping entrance

// Direction sequence for fragment entrances
const DIRECTIONS: Array<'left' | 'right' | 'up' | 'down'> = ['left', 'right', 'up', 'down'];

// Tape corner assignments per fragment index
const TAPE_CORNERS: Array<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = [
  'top-right',
  'top-left',
  'bottom-right',
  'bottom-left',
];

/**
 * Compute deterministic grid position for a fragment.
 * 2-col, 3-row grid. Fragments fill cells by index (skipping center for topic).
 * Cell order: [0,0], [1,0], [0,2], [1,2], [0,0]... (top-left, top-right, bottom-left, bottom-right, wrap)
 * Center row (row 1) is reserved for the topic word.
 */
function getFragmentPosition(index: number): { x: number; y: number } {
  const cellSlots: Array<[number, number]> = [
    [0, 0], // top-left
    [1, 0], // top-right
    [0, 2], // bottom-left
    [1, 2], // bottom-right
  ];
  const slot = cellSlots[index % cellSlots.length];
  const baseX = slot[0] * CELL_W + (CELL_W - CLIPPING_W) / 2;
  const baseY = slot[1] * CELL_H + (CELL_H - CLIPPING_H) / 2;

  // Add deterministic random offset within cell (±40px)
  const offsetX = (random(`frag-ox-${index}`) - 0.5) * 80;
  const offsetY = (random(`frag-oy-${index}`) - 0.5) * 80;

  return { x: baseX + offsetX, y: baseY + offsetY };
}

/**
 * Z-depth layer for parallax (0, 1, or 2 based on index % 3).
 * Higher depth = more parallax movement.
 */
function getDepth(index: number): number {
  return index % 3;
}

const MagazineCollage: React.FC<MagazineCollageProps> = (props) => {
  const frame = useCurrentFrame();
  const { fragments, topic } = props;

  return (
    <ScaledContainer baseWidth={1080} baseHeight={1920}>
      {/* ── Fragment clippings ──────────────────────────────────────────────── */}
      {fragments.map((frag, i) => {
        const pos = getFragmentPosition(i);
        const depth = getDepth(i);
        const depthMultiplier = (depth + 1) * 8;

        // Phase 1 (0-40): Entrance via paperSlide with stagger
        const enterStart = i * STAGGER;
        const enterDuration = 30;
        const direction = DIRECTIONS[i % DIRECTIONS.length];
        const slide = paperSlide(frame, enterStart, enterDuration, direction);

        // Phase 3 (60+): Parallax drift using Math.sin for smooth oscillation
        const parallaxX = frame >= 60
          ? Math.sin(frame * 0.02 + i * 1.5) * depthMultiplier
          : 0;
        const parallaxY = frame >= 60
          ? Math.sin(frame * 0.025 + i * 2.0) * depthMultiplier * 0.6
          : 0;

        // Combine transforms
        const isEntering = frame < enterStart + enterDuration;

        let translateX = pos.x + parallaxX;
        let translateY = pos.y + parallaxY;
        let opacity = 1;

        if (isEntering) {
          translateX += slide.translateX;
          translateY += slide.translateY;
          opacity = slide.opacity;
        }

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: translateX,
              top: translateY,
              opacity,
              zIndex: depth,
            }}
          >
            <div style={{ position: 'relative' }}>
              <PaperClipping
                text={frag.text}
                style={frag.style}
                index={i}
                width={CLIPPING_W}
                height={CLIPPING_H}
              />
              {/* Decoration: tape OR pin, mutually exclusive (deterministic) */}
              {random(`decoration-${i}`) > 0.5 ? (
                <TapeMark
                  corner={TAPE_CORNERS[i % TAPE_CORNERS.length]}
                  seed={i}
                />
              ) : (
                <PinMark
                  x={CLIPPING_W / 2}
                  y={4}
                  seed={i}
                />
              )}
            </div>
          </div>
        );
      })}

      {/* ── Topic word — center ────────────────────────────────────────────── */}
      {(() => {
        // Phase 2 (40-60): TopicWord enters center, scale 1.2 -> 1.0
        const topicOpacity = interpolate(frame, [40, 55], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: magazineEasing,
        });
        const topicScale = interpolate(frame, [40, 60], [1.2, 1.0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: magazineEasing,
        });

        // Phase 3 (60+): Subtle parallax drift for topic (low depth)
        const topicParallaxX = frame >= 60
          ? Math.sin(frame * 0.015) * 4
          : 0;
        const topicParallaxY = frame >= 60
          ? Math.sin(frame * 0.02 + 1.0) * 3
          : 0;

        const finalOpacity = topicOpacity;
        const finalScale = topicScale;

        const centerX = (CANVAS_W - TOPIC_W) / 2 + topicParallaxX;
        const centerY = (CANVAS_H - TOPIC_H) / 2 + topicParallaxY;

        return (
          <div
            style={{
              position: 'absolute',
              left: centerX,
              top: centerY,
              opacity: finalOpacity,
              transform: `scale(${finalScale})`,
              transformOrigin: '50% 50%',
              zIndex: 5,
            }}
          >
            <TopicWord
              topic={topic}
              width={TOPIC_W}
              height={TOPIC_H}
            />
          </div>
        );
      })()}
    </ScaledContainer>
  );
};

export default MagazineCollage;
