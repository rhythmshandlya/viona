import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { MagazineNewspaperProps } from './schema';
import { paperSlide, editorialReveal, exitTear } from '../../magazine/animations';
import { NewspaperPage } from './components/NewspaperPage';
import { useHeadlineZoom } from './components/HeadlineZoom';
import { useTearTransition } from './components/TearTransition';

const MagazineNewspaper: React.FC<MagazineNewspaperProps> = (props) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // ── Phase 1: Slide in with 3D perspective (0-30) ──────────────────────────
  const slide = paperSlide(frame, 0, 30, 'up');
  const rotateX = interpolate(frame, [0, 30], [8, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rotateY = interpolate(frame, [0, 30], [-5, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Phase 2: Zoom into headline (30-60) ───────────────────────────────────
  const { scale: zoomScale, surroundFade } = useHeadlineZoom(frame, 30, 60);

  // ── Phase 3: Hold + subhead reveal (60-90) ────────────────────────────────
  const subheadReveal = editorialReveal(frame, 65, 15);

  // ── Phase 4: Tear exit (90-120) ───────────────────────────────────────────
  const tear = exitTear(frame, 90, 30);
  const tearTransition = useTearTransition(frame, 90, 30, width, height);

  // Combine opacities: slide-in fade during phase 1, tear fade during phase 4
  const combinedOpacity = frame < 90 ? slide.opacity : tear.opacity;

  // Only apply zoom scale after phase 1 completes
  const activeScale = frame >= 30 ? zoomScale : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          perspective: 1200,
          opacity: combinedOpacity,
          clipPath: tearTransition.clipPath,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            transform: `
              translateX(${slide.translateX + tearTransition.translateX}px)
              translateY(${slide.translateY}px)
              rotateX(${rotateX}deg)
              rotateY(${rotateY}deg)
              scale(${activeScale})
            `,
            transformOrigin: '50% 17%',
          }}
        >
          <NewspaperPage
            headline={props.headline}
            subhead={props.subhead}
            publicationDate={props.publicationDate}
            section={props.section}
            surroundOpacity={surroundFade}
            subheadOpacity={subheadReveal.opacity}
            subheadTranslateY={subheadReveal.translateY}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default MagazineNewspaper;
