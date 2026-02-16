#!/usr/bin/env tsx
/**
 * Upload remotion-template to S3 storage.
 * Run: pnpm --filter @viona/worker run upload-template
 */

import { join } from 'path';
import { existsSync, createWriteStream, unlinkSync } from 'fs';
import archiver from 'archiver';
import { getStorage } from '@viona/shared/storage';
import { config } from '../src/config.js';

const TEMPLATE_SOURCE = join(process.cwd(), 'remotion-template');
const TEMP_ZIP_PATH = join(process.cwd(), 'temp-template.zip');

async function zipDirectory(source: string, out: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = createWriteStream(out);

    stream.on('close', () => resolve());
    archive.on('error', (err) => reject(err));

    archive.pipe(stream);

    // Add directory contents, excluding node_modules
    archive.glob('**/*', {
      cwd: source,
      ignore: ['node_modules/**', '.git/**'],
      dot: true, // Include dotfiles like .claude/
    });

    archive.finalize();
  });
}

async function main() {
  console.log('Uploading remotion template to S3...');
  console.log(`Source: ${TEMPLATE_SOURCE}`);
  console.log(`Template name: ${config.worker.templateName}`);

  // Check template exists
  if (!existsSync(TEMPLATE_SOURCE)) {
    console.error(`Template not found at: ${TEMPLATE_SOURCE}`);
    process.exit(1);
  }

  // Create zip file
  console.log('Creating zip archive...');
  await zipDirectory(TEMPLATE_SOURCE, TEMP_ZIP_PATH);
  console.log('Zip archive created.');

  // Upload to S3
  const storage = getStorage();
  console.log(`Uploading to storage...`);

  try {
    await storage.ensureBucket();
    await storage.uploadTemplate(config.worker.templateName, TEMP_ZIP_PATH);
    console.log(`Template uploaded successfully: ${config.worker.templateName}`);
  } finally {
    // Clean up temp file
    if (existsSync(TEMP_ZIP_PATH)) {
      unlinkSync(TEMP_ZIP_PATH);
    }
  }

  // Verify upload
  const exists = await storage.templateExists(config.worker.templateName);
  if (exists) {
    console.log('Upload verified!');
  } else {
    console.error('Upload verification failed - template not found in storage');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Failed to upload template:', err);
  process.exit(1);
});
