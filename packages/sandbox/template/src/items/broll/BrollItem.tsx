import React from 'react';
import { THEME_DEFAULTS } from './types';
import type { BrollItemData, BrollDisplayMode, BrollTreatment } from './types';
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
  theme?: string;
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

export const BrollItem: React.FC<BrollItemProps> = React.memo(({ data, assets, theme }) => {
  const Component = DISPLAY_COMPONENTS[data.displayMode] || BrollFullscreen;
  // Merge theme defaults with explicit treatment (explicit wins)
  const mergedTreatment: BrollTreatment = {
    ...(theme ? THEME_DEFAULTS[theme] || {} : {}),
    ...data.treatment,
  };
  const mergedData = { ...data, treatment: mergedTreatment };
  return <Component data={mergedData} assets={assets} />;
});
