import { registerTemplate } from '../../registry';
import type { TemplateMeta, CompositionMeta } from '../../types';
import { schema, defaultProps } from './schema';
import meta from './meta.json';
import compositionMeta from './metadata.json';

registerTemplate({
  meta: meta as TemplateMeta,
  compositionMeta: compositionMeta as CompositionMeta,
  schema,
  defaultProps,
  getComponent: async () => import('./index'),
  getFiles: async () => {
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.dirname(new URL(import.meta.url).pathname);
    const magazineDir = path.join(dir, '../../magazine');
    const chDir = path.join(dir, '../country-highlight');

    const ownFileNames = [
      'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts',
    ];
    const sharedFileNames = [
      'constants.ts', 'textures.tsx', 'effects.tsx', 'typography.tsx', 'animations.ts', 'ScaledContainer.tsx', 'paper-texture-data.ts',
    ];
    const chFiles = [
      'data/countries.ts',
      'lib/tile-math.ts',
      'lib/camera.ts',
      'lib/geo-utils.ts',
      'components/MapTileGrid.tsx',
      'components/CountryOverlay.tsx',
      'components/CountryLabel.tsx',
      'components/CityMarker.tsx',
    ];

    const ownResults = ownFileNames.map((f) => ({
      path: f, content: fs.readFileSync(path.join(dir, f), 'utf-8'),
    }));
    const sharedResults = sharedFileNames.map((f) => ({
      path: `../../magazine/${f}`, content: fs.readFileSync(path.join(magazineDir, f), 'utf-8'),
    }));
    const chResults = chFiles.map((f) => ({
      path: `../country-highlight/${f}`, content: fs.readFileSync(path.join(chDir, f), 'utf-8'),
    }));
    return [...ownResults, ...sharedResults, ...chResults];
  },
});
