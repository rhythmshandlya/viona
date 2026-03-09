/**
 * Template management utilities.
 * Downloads and extracts the remotion template from S3 on startup.
 */

import { join } from 'path';
import { existsSync, mkdirSync, createReadStream } from 'fs';
import { rm } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { getStorage } from '@viona/shared/storage';
import { config } from '../config.js';
import unzipper from 'unzipper';

/**
 * Ensure the remotion template is available.
 * Downloads from S3 if not present locally.
 * In dev mode, expects template to exist locally.
 * In prod (Railway), downloads from S3.
 */
export async function ensureTemplate(): Promise<void> {
  const templatePath = config.worker.templatePath;
  const templateName = config.worker.templateName;
  const isRailway = !!process.env.RAILWAY_ENVIRONMENT;

  // Check if template already exists
  if (existsSync(join(templatePath, 'package.json'))) {
    console.log(`[Template] Template already exists at: ${templatePath}`);
    return;
  }

  // In dev mode, template should exist locally
  if (!isRailway) {
    const devPath = join(process.cwd(), 'remotion-template');
    if (existsSync(join(devPath, 'package.json'))) {
      console.log(`[Template] Using local template at: ${devPath}`);
      return;
    }
    throw new Error(
      `Template not found at: ${devPath}\n` +
      'Please ensure remotion-template directory exists with package.json'
    );
  }

  // Production: Download from S3
  console.log(`[Template] Downloading template from S3: ${templateName}`);

  const storage = getStorage();

  // Check if template exists in storage
  const exists = await storage.templateExists(templateName);
  if (!exists) {
    throw new Error(
      `Template not found in storage: ${templateName}\n` +
      'Run: pnpm --filter @viona/worker run upload-template'
    );
  }

  // Ensure parent directory exists
  const parentDir = join(templatePath, '..');
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }

  // Download zip file
  const tempZipPath = join(parentDir, 'template-download.zip');
  await storage.downloadTemplate(templateName, tempZipPath);

  // Extract zip file
  console.log(`[Template] Extracting template to: ${templatePath}`);
  if (existsSync(templatePath)) {
    await rm(templatePath, { recursive: true, force: true });
  }
  mkdirSync(templatePath, { recursive: true });

  await pipeline(
    createReadStream(tempZipPath),
    unzipper.Extract({ path: templatePath })
  );

  // Clean up temp file
  if (existsSync(tempZipPath)) {
    await rm(tempZipPath);
  }

  // Verify extraction
  if (!existsSync(join(templatePath, 'package.json'))) {
    throw new Error('Template extraction failed - package.json not found');
  }

  console.log(`[Template] Template ready at: ${templatePath}`);
}
