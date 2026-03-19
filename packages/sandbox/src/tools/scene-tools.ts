import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';

const SCENES_DIR = '/workspace/src/scenes';

export const writeSceneFileTool = {
  name: 'write_scene_file',
  description: 'Write a scene .tsx file. This triggers an esbuild rebuild.',
  input_schema: {
    type: 'object' as const,
    properties: {
      filename: { type: 'string', description: 'Filename (e.g. "LowerThird.tsx")' },
      code: { type: 'string', description: 'Full TSX source code' },
    },
    required: ['filename', 'code'],
  },
  async execute(input: { filename: string; code: string }): Promise<string> {
    try {
      await mkdir(SCENES_DIR, { recursive: true });
      const filePath = join(SCENES_DIR, input.filename);
      await writeFile(filePath, input.code);
      // Trigger rebuild explicitly — chokidar inotify doesn't work on Docker Desktop Windows bind mounts
      try {
        const { triggerRebuild } = await import('../esbuild-watcher.js');
        triggerRebuild();
      } catch { /* watcher not started yet */ }
      return `Scene file written: ${input.filename}`;
    } catch (err: any) {
      return `Failed to write scene file: ${err.message}`;
    }
  },
};

export const deleteSceneFileTool = {
  name: 'delete_scene_file',
  description: 'Delete a scene .tsx file.',
  input_schema: {
    type: 'object' as const,
    properties: {
      filename: { type: 'string', description: 'Filename to delete (e.g. "LowerThird.tsx")' },
    },
    required: ['filename'],
  },
  async execute(input: { filename: string }): Promise<string> {
    try {
      await unlink(join(SCENES_DIR, input.filename));
      try {
        const { triggerRebuild } = await import('../esbuild-watcher.js');
        triggerRebuild();
      } catch { /* watcher not started yet */ }
      return `Scene file deleted: ${input.filename}`;
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  },
};
