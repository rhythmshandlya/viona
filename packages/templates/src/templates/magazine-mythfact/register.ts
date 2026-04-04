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

    const ownFileNames = [
      'meta.json', 'metadata.json', 'schema.ts', 'index.tsx', 'register.ts',
    ];

    const sharedFileNames = [
      'constants.ts', 'textures.tsx', 'effects.tsx', 'typography.tsx', 'animations.ts',
    ];

    const ownFiles = ownFileNames.map((f) => ({
      path: f, content: fs.readFileSync(path.join(dir, f), 'utf-8'),
    }));
    const sharedFiles = sharedFileNames.map((f) => ({
      path: `../../magazine/${f}`, content: fs.readFileSync(path.join(magazineDir, f), 'utf-8'),
    }));

    return [...ownFiles, ...sharedFiles];
  },
});
