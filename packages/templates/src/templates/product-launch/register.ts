import { registerTemplate } from '../../registry';
import meta from './meta.json';
import compositionMeta from './metadata.json';
import { schema, defaultProps } from './schema';

registerTemplate({
  meta: meta as any,
  compositionMeta,
  schema,
  defaultProps,
  getComponent: () => import('./index'),
  getFiles: async () => {
    // Node.js only - reads source files for template installation
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.dirname(new URL(import.meta.url).pathname);
    const files: { path: string; content: string }[] = [];

    function readDir(dirPath: string, relativeTo: string) {
      for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const fullPath = path.join(dirPath, entry.name);
        const relPath = path.relative(relativeTo, fullPath);
        if (entry.isDirectory()) {
          readDir(fullPath, relativeTo);
        } else if (/\.(tsx?|json)$/.test(entry.name)) {
          files.push({ path: relPath, content: fs.readFileSync(fullPath, 'utf-8') });
        }
      }
    }

    readDir(dir, dir);
    return files;
  },
});
