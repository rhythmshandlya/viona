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
    // Node.js only — called by worker for template installation
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
      'components/BoldBg.tsx',
      'scenes/HookScene.tsx',
      'scenes/BenefitsScene.tsx',
      'scenes/TestimonialScene.tsx',
      'scenes/CTAScene.tsx',
    ];

    return fileNames.map((fileName) => ({
      path: fileName,
      content: fs.readFileSync(path.join(dir, fileName), 'utf-8'),
    }));
  },
});
