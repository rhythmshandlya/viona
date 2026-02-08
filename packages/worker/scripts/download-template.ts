#!/usr/bin/env tsx
/**
 * Download and extract remotion-template from S3 storage.
 * Run: pnpm --filter @reelify/worker run download-template
 *
 * This script is designed to be run on container startup in production.
 */

import { join } from 'path';
import { existsSync, mkdirSync, createReadStream } from 'fs';
import { rm } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { getStorage } from '@reelify/shared/storage';
import { config } from '../src/config.js';
import unzipper from 'unzipper';

const TEMP_ZIP_PATH = join(config.worker.templatePath, '..', 'template-download.zip');

async function main() {
  const templatePath = config.worker.templatePath;
  const templateName = config.worker.templateName;

  console.log('Downloading remotion template from S3...');
  console.log(`Template name: ${templateName}`);
  console.log(`Destination: ${templatePath}`);

  // Check if template already exists
  if (existsSync(join(templatePath, 'package.json'))) {
    console.log('Template already exists, skipping download.');
    return;
  }

  // Ensure parent directory exists
  const parentDir = join(templatePath, '..');
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }

  const storage = getStorage();

  // Check if template exists in storage
  const exists = await storage.templateExists(templateName);
  if (!exists) {
    console.error(`Template not found in storage: ${templateName}`);
    console.error('Run: pnpm --filter @reelify/worker run upload-template');
    process.exit(1);
  }

  // Download zip file
  console.log('Downloading template zip...');
  await storage.downloadTemplate(templateName, TEMP_ZIP_PATH);

  // Extract zip file
  console.log('Extracting template...');
  if (existsSync(templatePath)) {
    await rm(templatePath, { recursive: true, force: true });
  }
  mkdirSync(templatePath, { recursive: true });

  await pipeline(
    createReadStream(TEMP_ZIP_PATH),
    unzipper.Extract({ path: templatePath })
  );

  // Clean up temp file
  if (existsSync(TEMP_ZIP_PATH)) {
    await rm(TEMP_ZIP_PATH);
  }

  // Verify extraction
  if (existsSync(join(templatePath, 'package.json'))) {
    console.log('Template downloaded and extracted successfully!');
  } else {
    console.error('Extraction verification failed - package.json not found');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Failed to download template:', err);
  process.exit(1);
});
