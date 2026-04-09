export type BrollDisplayMode =
  | 'fullscreen-cutaway'
  | 'letterboxed'
  | 'letterboxed-captions'
  | 'rounded-float'
  | 'polaroid'
  | 'film-treatment'
  | 'stacked-50'
  | 'stacked-70'
  | 'speaker-pip'
  | 'triple-stack'
  | 'grid-2x2'
  | 'greenscreen-bg';

export type BrollFilter = 'none' | 'grain' | 'vhs' | 'desaturated' | 'duotone';

export interface BrollTreatment {
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  tilt?: number;
  filter?: BrollFilter;
  filterIntensity?: number;  // 0-1
  roughEdges?: boolean;
}

export interface BrollAttribution {
  photographer: string;
  source: 'pexels';
  url: string;
}

export interface BrollItemData {
  src: string;
  mediaType: 'image' | 'video';
  displayMode: BrollDisplayMode;
  treatment: BrollTreatment;
  attribution?: BrollAttribution;
  additionalSrcs?: string[];
}

export interface BrollDisplayProps {
  data: BrollItemData;
  assets: Record<string, string>;
}

export const THEME_DEFAULTS: Record<string, BrollTreatment> = {
  vox: {
    filter: 'grain',
    filterIntensity: 0.3,
    roughEdges: true,
    borderRadius: 0,
  },
  magazine: {
    filter: 'none',
    roughEdges: false,
    borderRadius: 8,
    borderColor: '#FFFFFF',
  },
};
