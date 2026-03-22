import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { MagazineNewspaperProps } from './schema';
import { paperSlide, editorialReveal } from '../../magazine/animations';
import { NewspaperPage } from './components/NewspaperPage';
import { useHeadlineZoom } from './components/HeadlineZoom';

const MagazineNewspaper: React.FC<MagazineNewspaperProps> = (props) => {
  const frame = useCurrentFrame();

  // ── Phase 1: Slide in with 3D perspective (0-25) ──────────────────────────
  const slide = paperSlide(frame, 0, 25, 'up');
  const rotateX = interpolate(frame, [0, 25], [8, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const rotateY = interpolate(frame, [0, 25], [-5, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Phase 2-4: Zoom in → pan → zoom out to full page (25-95) ─────────────
  const { scale, translateX: zoomTx, translateY: zoomTy, surroundFade } =
    useHeadlineZoom(frame, 25, 48, 78, 95);

  // ── Subhead reveals as camera zooms back out ──────────────────────────────
  const subheadReveal = editorialReveal(frame, 82, 15);

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          perspective: 1200,
          opacity: slide.opacity,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            transform: `
              translateX(${slide.translateX + zoomTx}px)
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
