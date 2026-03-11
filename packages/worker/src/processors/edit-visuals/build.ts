/**
 * Compilation and storage for edit-visuals.
 */

import { readFile, readdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { uploadFile } from '../../services/minio.js';
import { logger } from '../../logger.js';
import { getWorkspacePath } from '../../workspace.js';

/**
 * Compile composition source to CommonJS for dynamic frontend loading.
 * The frontend's DynamicVisualLoader expects a composition.cjs.js file.
 */
export async function compileCjs(projectDir: string, bundleDir: string): Promise<void> {
  const indexTsx = join(projectDir, 'index.tsx');
  const cjsOutput = join(bundleDir, 'composition.cjs.js');
  const workspacePath = getWorkspacePath();

  logger.info({ indexTsx, cjsOutput }, 'Compiling composition to CJS');

  try {
    // Use CommonJS format for Node.js require() compatibility in render.ts
    // The DynamicVisualLoader provides a custom require() shim for browser preview
    // For SSR rendering, we need proper CJS that Node.js can load
    execSync([
      'npx', 'esbuild',
      indexTsx,
      '--bundle',
      '--format=cjs',
      '--platform=node',  // Node platform for SSR rendering
      '--target=es2020',
      '--external:react',
      '--external:react/jsx-runtime',
      '--external:react/jsx-dev-runtime',
      '--external:remotion',
      '--external:@remotion/noise',
      '--external:@remotion/shapes',
      '--external:@remotion/paths',
      '--external:@remotion/three',
      `--outfile=${cjsOutput}`,
    ].join(' '), {
      cwd: workspacePath,
      timeout: 60000,
      encoding: 'utf-8',
    });
    logger.info({ cjsOutput }, 'CJS compilation complete');
  } catch (error) {
    logger.error({ error }, 'CJS compilation failed');
    throw new Error(`Failed to compile composition to CJS: ${error}`);
  }
}

/**
 * Auto-fix common Remotion issues in all .tsx files within a project directory.
 * Fixes descending interpolate ranges that crash the Remotion player.
 */
export async function autoFixProjectFiles(projectDir: string): Promise<void> {
  const entries = await readdir(projectDir, { recursive: true, withFileTypes: true });
  let fixedCount = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue;
    const parentPath = (entry as any).parentPath ?? (entry as any).path ?? projectDir;
    const filePath = join(parentPath, entry.name);

    let content = await readFile(filePath, 'utf-8');
    const original = content;

    // Fix descending interpolate ranges by reversing both input and output
    content = content.replace(
      /interpolate\s*\(\s*([^,]+),\s*\[([^\]]+)\],\s*\[([^\]]+)\]/g,
      (match, input, inputRange, outputRange) => {
        const inputParts = inputRange.split(',').map((n: string) => n.trim());
        const outputParts = outputRange.split(',').map((n: string) => n.trim());
        const inputNums = inputParts.map((n: string) => parseFloat(n)).filter((n: number) => !isNaN(n));

        let isDescending = false;
        for (let i = 1; i < inputNums.length; i++) {
          if (inputNums[i] < inputNums[i - 1]) {
            isDescending = true;
            break;
          }
        }

        if (isDescending && inputNums.length === inputParts.length) {
          const fixedInputRange = [...inputParts].reverse().join(', ');
          const fixedOutputRange = [...outputParts].reverse().join(', ');
          return `interpolate(${input}, [${fixedInputRange}], [${fixedOutputRange}]`;
        }
        return match;
      }
    );

    if (content !== original) {
      await writeFile(filePath, content);
      fixedCount++;
      logger.info({ filePath }, 'Auto-fixed descending interpolate ranges');
    }
  }

  if (fixedCount > 0) {
    logger.info({ projectDir, fixedCount }, 'Auto-fixed files with descending interpolate ranges');
  }
}

/**
 * Upload bundle directory to S3 storage.
 */
export async function uploadBundleToStorage(bundleDir: string, compositionId: string): Promise<void> {
  const files = await readdir(bundleDir, { recursive: true, withFileTypes: true });

  for (const file of files) {
    if (file.isFile()) {
      const parentPath = file.parentPath || file.path;
      const relativePath = parentPath.replace(bundleDir, '').replace(/^[\\/]/, '');
      const fileName = file.name;
      const relativeFilePath = relativePath ? `${relativePath}/${fileName}` : fileName;

      const s3Key = `bundles/${compositionId}/${relativeFilePath}`.replace(/\\/g, '/');
      const localPath = join(parentPath, fileName);

      await uploadFile('outputs', s3Key, localPath);
    }
  }

  logger.info({ compositionId, bundleDir }, 'Bundle uploaded to S3');
}

/**
 * Upload source project directory to S3 storage.
 */
export async function uploadSourceToStorage(projectDir: string, compositionId: string): Promise<string> {
  const files = await readdir(projectDir, { recursive: true, withFileTypes: true });

  for (const file of files) {
    if (file.isFile()) {
      const parentPath = file.parentPath || file.path;
      const relativePath = parentPath.replace(projectDir, '').replace(/^[\\/]/, '');
      const fileName = file.name;
      const relativeFilePath = relativePath ? `${relativePath}/${fileName}` : fileName;

      const s3Key = `sources/${compositionId}/${relativeFilePath}`.replace(/\\/g, '/');
      const localPath = join(parentPath, fileName);

      await uploadFile('outputs', s3Key, localPath);
    }
  }

  // Also upload src/composition/ (FullComposition infrastructure) so rebuildBundleFromCJS
  // can reconstruct the full composition wrapper during render.
  const compositionDir = join(getWorkspacePath(), 'src', 'composition');
  if (existsSync(compositionDir)) {
    try {
      const compositionFiles = await readdir(compositionDir, { recursive: true, withFileTypes: true });
      for (const file of compositionFiles) {
        if (file.isFile()) {
          const parentPath = file.parentPath || file.path;
          const relativePath = parentPath.replace(compositionDir, '').replace(/^[\\/]/, '');
          const fileName = file.name;
          const relativeFilePath = relativePath ? `${relativePath}/${fileName}` : fileName;

          const s3Key = `sources/${compositionId}/__composition__/${relativeFilePath}`.replace(/\\/g, '/');
          const localPath = join(parentPath, fileName);
          await uploadFile('outputs', s3Key, localPath);
        }
      }
      logger.info({ compositionId }, 'Composition infrastructure files uploaded to S3');
    } catch (err) {
      logger.warn({ compositionId, err }, 'Failed to upload composition/ dir (non-fatal)');
    }
  }

  const sourceUrl = `/api/sources/${compositionId}`;
  logger.info({ compositionId, projectDir, sourceUrl }, 'Source project files uploaded to S3');
  return sourceUrl;
}
