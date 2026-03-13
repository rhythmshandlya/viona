/**
 * Compilation and storage for SVG animation bundles
 */

import { readdir } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { spawn, execSync } from 'child_process';
import { uploadFile } from '../../services/minio.js';
import { logger } from '../../logger.js';
import { getWorkspacePath } from '../../workspace.js';

/**
 * Compile composition to CJS for dynamic frontend loading
 */
export async function compileCjs(projectDir: string, bundleDir: string): Promise<void> {
  const indexTsx = join(projectDir, 'index.tsx');
  const cjsOutput = join(bundleDir, 'composition.cjs.js');
  const workspacePath = getWorkspacePath();

  logger.info({ indexTsx, cjsOutput }, 'Compiling composition to CJS');

  try {
    execSync([
      'npx', 'esbuild',
      indexTsx,
      '--bundle',
      '--format=cjs',
      '--platform=browser',
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
 * Bundle the Remotion project
 */
export async function bundleComposition(
  compositionId: string,
  bundleOutputDir: string
): Promise<string> {
  const workspacePath = getWorkspacePath();
  const bundleDir = join(bundleOutputDir, compositionId);

  // Create bundle directory
  if (!existsSync(bundleDir)) {
    mkdirSync(bundleDir, { recursive: true });
  }

  logger.info({ compositionId, bundleDir }, 'Bundling composition');

  // Use src/index.ts as entry point (it calls registerRoot with Root.tsx)
  const entryPoint = 'src/index.ts';

  return new Promise((resolve, reject) => {
    const bundle = spawn(
      'npx',
      ['remotion', 'bundle', entryPoint, '--out-dir', bundleDir],
      {
        cwd: workspacePath,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let stdout = '';
    let stderr = '';

    bundle.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    bundle.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    bundle.on('close', (code) => {
      if (code === 0) {
        logger.info({ compositionId, bundleDir }, 'Bundle complete');
        resolve(bundleDir);
      } else {
        logger.error({ compositionId, code, stderr }, 'Bundle failed');
        reject(new Error(`Bundle failed with code ${code}: ${stderr}`));
      }
    });

    bundle.on('error', (error) => {
      reject(new Error(`Bundle process error: ${error.message}`));
    });
  });
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

  const sourceUrl = `/api/sources/${compositionId}`;
  logger.info({ compositionId, projectDir, sourceUrl }, 'Source project files uploaded to S3');
  return sourceUrl;
}
