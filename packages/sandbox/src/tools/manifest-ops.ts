import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const MANIFEST_PATH = join('/workspace', 'manifest.json');

export const readManifestTool = {
  name: 'readManifest',
  description: 'Read the current manifest.json (timeline state). Returns the full manifest JSON.',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
  async execute(): Promise<string> {
    try {
      const content = await readFile(MANIFEST_PATH, 'utf-8');
      return content;
    } catch (err: any) {
      return `Failed to read manifest: ${err.message}`;
    }
  },
};

export const updateManifestTool = {
  name: 'updateManifest',
  description: 'Replace manifest.json with the provided manifest object and trigger a preview rebuild.',
  input_schema: {
    type: 'object' as const,
    properties: {
      manifest: {
        type: 'object',
        description: 'The complete updated manifest object',
      },
    },
    required: ['manifest'],
  },
  async execute(input: { manifest: object }): Promise<string> {
    try {
      await writeFile(MANIFEST_PATH, JSON.stringify(input.manifest, null, 2));
      // Trigger rebuild so preview picks up manifest changes
      const { triggerRebuild } = await import('../esbuild-watcher.js');
      triggerRebuild();
      return 'Manifest updated and rebuild triggered.';
    } catch (err: any) {
      return `Failed to update manifest: ${err.message}`;
    }
  },
};
