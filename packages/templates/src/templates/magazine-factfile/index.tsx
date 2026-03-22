import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import type { MagazineFactfileProps } from './schema';
import { paperSlide, editorialReveal } from '../../magazine/animations';
import { SerifHeadline, SectionLabel } from '../../magazine/typography';
import { MAGAZINE_COLORS } from '../../magazine/constants';
import { DossierCard } from './components/DossierCard';
import { FieldRow } from './components/FieldRow';

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const CARD_W = 940;
const CARD_H = 1400;

const MagazineFactfile: React.FC<MagazineFactfileProps> = ({ title, subtitle, fields }) => {
  const frame = useCurrentFrame();

  const cardSlide = paperSlide(frame, 0, 25, 'up');

  const parallaxX = frame >= 70 ? Math.sin(frame * 0.015) * 4 : 0;
  const parallaxY = frame >= 70 ? Math.sin(frame * 0.02 + 1.0) * 3 : 0;

  const titleReveal = editorialReveal(frame, 20, 20);
  const subtitleReveal = editorialReveal(frame, 28, 15);

  const cardX = (CANVAS_W - CARD_W) / 2 + parallaxX + cardSlide.translateX;
  const cardY = (CANVAS_H - CARD_H) / 2 + parallaxY + cardSlide.translateY;
  const cardOpacity = cardSlide.opacity;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', left: cardX, top: cardY, opacity: cardOpacity }}>
        <DossierCard>
          <div style={{ opacity: titleReveal.opacity, transform: `translateY(${titleReveal.translateY}px)` }}>
            <SerifHeadline text={title} size={76} showRule />
          </div>
          <div style={{ marginTop: 16, opacity: subtitleReveal.opacity, transform: `translateY(${subtitleReveal.translateY}px)` }}>
            <SectionLabel label={subtitle} />
          </div>
          <div style={{ marginTop: 40 }}>
            {fields.map((field, i) => (
              <FieldRow key={i} fieldKey={field.key} value={field.value} index={i} revealFrame={35 + i * 8} width={CARD_W - 100} />
            ))}
          </div>
        </DossierCard>
      </div>
    </AbsoluteFill>
  );
};

export default MagazineFactfile;
