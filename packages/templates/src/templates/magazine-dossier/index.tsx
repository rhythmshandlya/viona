import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineDossierProps } from './schema';
import { paperSlide, magazineEasing } from '../../magazine/animations';
import { DocumentSheet } from './components/DocumentSheet';
import { ClassificationStamp } from './components/ClassificationStamp';
import { RedactionBar } from './components/RedactionBar';

const MagazineDossier: React.FC<MagazineDossierProps> = (props) => {
  const frame = useCurrentFrame();

  // ── Phase 1: Paper slides in from right, rotation 2° -> 0° (frames 0-25) ──
  const slide = paperSlide(frame, 0, 25, 'right');
  const rotation = interpolate(frame, [0, 25], [2, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });

  // ── Phase 2: Stamp slams down (frames 25-50) ─────────────────────────────
  // ClassificationStamp handles its own animation internally

  // ── Phase 3: Redaction bars reveal, staggered by 15 frames (frames 50-120)
  // Each item starts revealing at frame 50 + (index * 15)
  const itemOpacities = props.items.map((_, i) => {
    const revealStart = 50 + i * 15;
    return interpolate(frame, [revealStart, revealStart + 20], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: magazineEasing,
    });
  });

  // ── Phase 4: Reverse slide out + burn edge intensifies (frames 120-150) ──
  const exitSlide = interpolate(frame, [120, 150], [0, 1200], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: magazineEasing,
  });
  const exitRotation = interpolate(frame, [120, 150], [0, -3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exitOpacity = interpolate(frame, [120, 150], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Burn edge: low intensity during hold, ramps up during exit
  const burnIntensity = interpolate(frame, [0, 120, 150], [0.3, 0.3, 0.9], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Combine entrance and exit transforms
  const isExiting = frame >= 120;
  const translateX = isExiting ? exitSlide : slide.translateX;
  const translateY = isExiting ? 0 : slide.translateY;
  const rot = isExiting ? exitRotation : rotation;
  const opacity = isExiting ? exitOpacity : slide.opacity;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          opacity,
          transform: `translateX(${translateX}px) translateY(${translateY}px) rotate(${rot}deg)`,
          transformOrigin: '50% 50%',
        }}
      >
        <DocumentSheet
          title={props.title}
          items={props.items}
          itemOpacities={itemOpacities}
          burnIntensity={burnIntensity}
        >
          {/* Classification stamp overlays the document */}
          <ClassificationStamp
            classification={props.classification}
            frame={frame}
            slamStart={25}
            slamDuration={25}
          />

          {/* Redaction bars overlay the items area */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 70,
              right: 70,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {props.items.map((item, i) => (
              <RedactionBar
                key={i}
                text={item}
                frame={frame}
                revealStart={50 + i * 15}
                revealDuration={20}
                index={i}
              />
            ))}
          </div>
        </DocumentSheet>
      </div>
    </AbsoluteFill>
  );
};

export default MagazineDossier;
