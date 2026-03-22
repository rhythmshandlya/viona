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

  // ── Phase 1: Slide in with 3D perspective (0-25) ──────────────────────────
  const slide = paperSlide(frame, 0, 25, 'up');
  const rotateX = interpolate(frame, [0, 25], [8, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const rotateY = interpolate(frame, [0, 25], [-5, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Phase 2-4: Zoom in → pan across headline → zoom out (25-92) ──────────
  const { scale, translateX: zoomTx, translateY: zoomTy, surroundFade } =
    useHeadlineZoom(frame, 25, 48, 78, 92);

  // ── Subhead reveals as camera zooms back out ──────────────────────────────
  const subheadReveal = editorialReveal(frame, 82, 12);

  // ── Phase 5: Tear exit (92-120) ───────────────────────────────────────────
  const tear = exitTear(frame, 92, 28);
  const tearTransition = useTearTransition(frame, 92, 28, width, height);

  // Slide-in fade during phase 1, tear fade during phase 5
  const combinedOpacity = frame < 92 ? slide.opacity : tear.opacity;

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
              translateX(${slide.translateX + zoomTx + tearTransition.translateX}px)
              translateY(${slide.translateY + zoomTy}px)
              rotateX(${rotateX}deg)
              rotateY(${rotateY}deg)
              scale(${scale})
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
