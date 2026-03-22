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

    const ownFileNames = [
      'meta.json',
      'metadata.json',
      'schema.ts',
      'index.tsx',
      'register.ts',
      'components/DossierCard.tsx',
      'components/FieldRow.tsx',
      'components/PaperClip.tsx',
    ];

    const sharedFileNames = [
      'constants.ts',
      'textures.tsx',
      'effects.tsx',
      'typography.tsx',
      'animations.ts',
      'decorations.tsx',
    ];

    const sharedDir = path.resolve(dir, '../../magazine');

    return [
      ...ownFileNames.map((fileName) => ({
        path: fileName,
        content: fs.readFileSync(path.join(dir, fileName), 'utf-8'),
      })),
      ...sharedFileNames.map((fileName) => ({
        path: `../../magazine/${fileName}`,
        content: fs.readFileSync(path.join(sharedDir, fileName), 'utf-8'),
      })),
    ];
  },
});
