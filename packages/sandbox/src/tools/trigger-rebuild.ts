import { triggerRebuild as doRebuild } from '../esbuild-watcher.js';

export const triggerRebuildTool = {
  name: 'trigger_rebuild',
  description: 'Signal the esbuild watcher to rebuild the CJS bundle. Call this after writing/editing source files to update the preview.',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
  async execute(): Promise<string> {
    doRebuild();
    return 'Rebuild triggered. The esbuild watcher will rebuild the CJS bundle.';
  },
};
