import { registerTemplate } from '../../registry';
import type { TemplateMeta, CompositionMeta, TemplateFile } from '../../types';
import { schema, defaultProps } from './schema';

import meta from './meta.json';
import metadata from './metadata.json';

registerTemplate({
  meta: meta as TemplateMeta,
  compositionMeta: metadata as CompositionMeta,
  schema,
  defaultProps,
  getComponent: async () => import('./index'),
  getFiles: async (): Promise<TemplateFile[]> => {
    // Node.js only — called by worker for template installation
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.dirname(new URL(import.meta.url).pathname);

    const sourceFiles = [
      'index.tsx',
      'schema.ts',
      'constants.ts',
      'meta.json',
      'metadata.json',
      'components/CleanBg.tsx',
      'scenes/TitleScene.tsx',
      'scenes/TopicScene.tsx',
      'scenes/ChapterScene.tsx',
    ];

    return sourceFiles.map((filePath) => ({
      path: filePath,
      content: fs.readFileSync(path.join(dir, filePath), 'utf-8'),
    }));
  },
});
