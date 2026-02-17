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

    const fileNames = [
      'meta.json',
      'metadata.json',
      'schema.ts',
      'constants.ts',
      'index.tsx',
      'register.ts',
      'lib/tile-math.ts',
      'components/MapTileGrid.tsx',
      'components/AnimatedPath.tsx',
      'components/LocationMarker.tsx',
      'components/LocationLabel.tsx',
    ];

    return fileNames.map((fileName) => ({
      path: fileName,
      content: fs.readFileSync(path.join(dir, fileName), 'utf-8'),
    }));
  },
});
