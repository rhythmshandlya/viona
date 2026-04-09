import React from 'react';
import type { BrollItemData, BrollDisplayMode } from './types';
import { BrollFullscreen } from './BrollFullscreen';
import { BrollLetterboxed } from './BrollLetterboxed';
import { BrollLetterboxedCaptions } from './BrollLetterboxedCaptions';
import { BrollRoundedFloat } from './BrollRoundedFloat';
import { BrollPolaroid } from './BrollPolaroid';
import { BrollFilmTreatment } from './BrollFilmTreatment';
import { BrollStacked50 } from './BrollStacked50';
import { BrollStacked70 } from './BrollStacked70';
import { BrollSpeakerPip } from './BrollSpeakerPip';
import { BrollTripleStack } from './BrollTripleStack';
import { BrollGrid } from './BrollGrid';
import { BrollGreenscreen } from './BrollGreenscreen';

interface BrollItemProps {
  data: BrollItemData;
  assets: Record<string, string>;
}

const DISPLAY_COMPONENTS: Record<BrollDisplayMode, React.FC<{ data: BrollItemData; assets: Record<string, string> }>> = {
  'fullscreen-cutaway': BrollFullscreen,
  'letterboxed': BrollLetterboxed,
  'letterboxed-captions': BrollLetterboxedCaptions,
  'rounded-float': BrollRoundedFloat,
  'polaroid': BrollPolaroid,
  'film-treatment': BrollFilmTreatment,
  'stacked-50': BrollStacked50,
  'stacked-70': BrollStacked70,
  'speaker-pip': BrollSpeakerPip,
  'triple-stack': BrollTripleStack,
  'grid-2x2': BrollGrid,
  'greenscreen-bg': BrollGreenscreen,
};

export const BrollItem: React.FC<BrollItemProps> = React.memo(({ data, assets }) => {
  const Component = DISPLAY_COMPONENTS[data.displayMode] || BrollFullscreen;
  return <Component data={data} assets={assets} />;
});
