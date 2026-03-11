/**
 * S3 upload functions for visual generation
 */

import { readdir } from 'fs/promises';
import { join } from 'path';
import { uploadFile } from '../../services/minio.js';
import { logger } from '../../logger.js';
import { getWorkspacePath } from '../../workspace.js';

/**
 * Upload bundle directory to S3 storage.
 * Uploads all files in the bundle directory to outputs/bundles/{compositionId}/
 */
export async function uploadBundleToStorage(bundleDir: string, compositionId: string): Promise<void> {
  const files = await readdir(bundleDir, { recursive: true, withFileTypes: true });

  for (const file of files) {
    if (file.isFile()) {
      // Get relative path from bundle dir
      const parentPath = file.parentPath || file.path;
      const relativePath = parentPath.replace(bundleDir, '').replace(/^[\\/]/, '');
      const fileName = file.name;
      const relativeFilePath = relativePath ? `${relativePath}/${fileName}` : fileName;

      // Upload to S3: outputs/bundles/{compositionId}/{relativePath}
      const s3Key = `bundles/${compositionId}/${relativeFilePath}`.replace(/\\/g, '/');
      const localPath = join(parentPath, fileName);

      await uploadFile('outputs', s3Key, localPath);
    }
  }

  logger.info({ compositionId, bundleDir }, 'Bundle uploaded to S3');
}

/**
 * Upload source project directory to S3 storage.
 * Uploads ALL source files to outputs/sources/{compositionId}/ including:
 * - SCENE_PLAN.md - Director's visual story plan
 * - IMPLEMENTATION_LOG.md - Implementation decisions and reasoning
 * - scenes.json - Scene definitions with timing
 * - metadata.json - Composition metadata
 * - index.tsx - Main composition code
 * - constants.ts - Colors, timing, spring configs
 * - components/*.tsx - Reusable components (Background, etc.)
 * - scenes/*.tsx - Individual scene components
 *
 * This preserves the full AI context so users can continue editing later.
 */
export async function uploadSourceToStorage(projectDir: string, compositionId: string): Promise<string> {
  const files = await readdir(projectDir, { recursive: true, withFileTypes: true });

  for (const file of files) {
    if (file.isFile()) {
      // Get relative path from project dir
      const parentPath = file.parentPath || file.path;
      const relativePath = parentPath.replace(projectDir, '').replace(/^[\\/]/, '');
      const fileName = file.name;
      const relativeFilePath = relativePath ? `${relativePath}/${fileName}` : fileName;

      // Upload to S3: outputs/sources/{compositionId}/{relativePath}
      const s3Key = `sources/${compositionId}/${relativeFilePath}`.replace(/\\/g, '/');
      const localPath = join(parentPath, fileName);

      await uploadFile('outputs', s3Key, localPath);
    }
  }

  // Also upload src/composition/ (FullComposition infrastructure) so rebuildBundleFromCJS
  // can reconstruct the full composition wrapper during render.
  const compositionDir = join(getWorkspacePath(), 'src', 'composition');
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
    logger.warn({ compositionId, err }, 'Failed to upload composition/ dir (non-fatal for legacy projects)');
  }

  const sourceUrl = `/api/sources/${compositionId}`;
  logger.info({ compositionId, projectDir, sourceUrl }, 'Source project files uploaded to S3');
  return sourceUrl;
}
