/**
 * Generate template screenshots using Remotion renderStill.
 *
 * For each template in the manifest:
 * 1. Creates a temporary Remotion entry point
 * 2. Bundles with @remotion/bundler
 * 3. Renders a still at a visually interesting frame
 * 4. Uploads PNG to S3
 * 5. Updates screenshot_url in the DB
 *
 * Usage: pnpm templates:screenshots
 */

import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { Client as MinioClient } from 'minio';
import pg from 'pg';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  rmSync,
} from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PKG_ROOT = resolve(__dirname, '..');
const SRC_DIR = join(PKG_ROOT, 'src');
const TEMPLATES_DIR = join(SRC_DIR, 'templates');
const DIST_DIR = join(PKG_ROOT, 'dist', 'bundles');
const MANIFEST_PATH = join(DIST_DIR, 'manifest.json');
const TEMP_DIR = join(PKG_ROOT, 'dist', '_screenshots_temp');
const SCREENSHOTS_DIR = join(PKG_ROOT, 'dist', 'screenshots');

// ── Config ─────────────────────────────────────────────────────────────────
// Precedence matches upload-templates.ts: BUCKET_PUBLIC_* > BUCKET_* > S3_* > MINIO_*
const S3_ENDPOINT =
  process.env.BUCKET_PUBLIC_ENDPOINT ||
  process.env.BUCKET_ENDPOINT ||
  process.env.S3_ENDPOINT ||
  process.env.MINIO_ENDPOINT ||
  'localhost';
const S3_PORT = parseInt(
  process.env.BUCKET_PUBLIC_PORT ||
    process.env.BUCKET_PORT ||
    process.env.S3_PORT ||
    process.env.MINIO_PORT ||
    '9000',
  10,
);
const S3_ACCESS_KEY =
  process.env.BUCKET_ACCESS_KEY_ID ||
  process.env.S3_ACCESS_KEY ||
  process.env.MINIO_ACCESS_KEY ||
  'minioadmin';
const S3_SECRET_KEY =
  process.env.BUCKET_SECRET_ACCESS_KEY ||
  process.env.S3_SECRET_KEY ||
  process.env.MINIO_SECRET_KEY ||
  'minioadmin';
const S3_BUCKET =
  process.env.BUCKET_NAME ||
  process.env.S3_BUCKET ||
  process.env.MINIO_BUCKET ||
  'viona';
const S3_USE_SSL = process.env.BUCKET_PUBLIC_ENDPOINT
  ? true
  : (process.env.S3_USE_SSL || process.env.MINIO_USE_SSL) === 'true';
const DATABASE_URL =
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/viona';
const S3_PREFIX = 'templates/';

// Remotion's internal HTTP server (used during renderStill) can emit errors
// from event listeners that escape our try/catch and would kill the whole
// process — e.g. a template that fetches a relative proxy URL throws inside
// the server's request listener. Install a soft uncaughtException handler so
// a single misconfigured template doesn't abort the entire batch, and enforce
// a per-template timeout so the process doesn't hang on a stuck renderStill.
process.on('uncaughtException', (err) => {
  console.error(`  [uncaughtException] ${err.message}`);
  if (err.stack) {
    console.error(`  ${err.stack.split('\n').slice(1, 3).join('\n  ')}`);
  }
});

const TEMPLATE_TIMEOUT_MS = 120_000;

// Slugs we know can't render offline (e.g. rely on runtime-only proxy URLs).
// These are skipped during screenshot generation; their bundle + DB row are
// still published by the upload step.
const SCREENSHOT_SKIPLIST = new Set<string>([
  'vox-document', // loads PDF via /proxy-pdf/* relative URL; Remotion renderer rejects it
]);

// ── Manifest types ─────────────────────────────────────────────────────────
interface ManifestEntry {
  slug: string;
  name: string;
  compositionMeta: {
    compositionId?: string;
    durationInFrames?: number;
    fps?: number;
    width?: number;
    height?: number;
  };
  defaultProps: Record<string, unknown>;
}

interface Manifest {
  version: number;
  builtAt: string;
  templates: ManifestEntry[];
}

// ── Generate screenshot for one template ───────────────────────────────────
async function generateScreenshot(entry: ManifestEntry): Promise<string> {
  const { slug, compositionMeta, defaultProps } = entry;
  const compositionId = compositionMeta.compositionId || slug;
  const durationInFrames = compositionMeta.durationInFrames || 360;
  const fps = compositionMeta.fps || 30;
  const width = compositionMeta.width || 1080;
  const height = compositionMeta.height || 1080;

  // Pick a visually interesting frame (40% through the animation)
  const frame = Math.floor(durationInFrames * 0.4);

  console.log(`  Creating Remotion entry point...`);

  // Create a temp entry file that registers the composition
  const entryDir = join(TEMP_DIR, slug);
  mkdirSync(entryDir, { recursive: true });

  const templateIndexPath = join(TEMPLATES_DIR, slug, 'index.tsx');
  // Use forward slashes for import paths
  const templateImportPath = templateIndexPath.replace(/\\/g, '/');

  const entryContent = `
import React from 'react';
import { registerRoot, Composition } from 'remotion';
import Component from '${templateImportPath}';

const defaultProps = ${JSON.stringify(defaultProps)};

const Root: React.FC = () => {
  return (
    <Composition
      id="${compositionId}"
      component={Component}
      durationInFrames={${durationInFrames}}
      fps={${fps}}
      width={${width}}
      height={${height}}
      defaultProps={defaultProps}
    />
  );
};

registerRoot(Root);
`;

  const entryPath = join(entryDir, 'entry.tsx');
  writeFileSync(entryPath, entryContent, 'utf-8');

  console.log(`  Bundling with Remotion...`);

  // Bundle the entry point
  const bundlePath = await bundle({
    entryPoint: entryPath,
    onProgress: (progress) => {
      if (progress % 25 === 0) {
        process.stdout.write(`    Bundle progress: ${progress}%\r`);
      }
    },
  });
  console.log(`  Bundle complete.`);

  // Select composition
  console.log(`  Selecting composition "${compositionId}"...`);
  const composition = await selectComposition({
    serveUrl: bundlePath,
    id: compositionId,
    inputProps: defaultProps,
  });

  // Render still
  const outputPath = join(SCREENSHOTS_DIR, `${slug}.png`);
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  console.log(`  Rendering still at frame ${frame}/${durationInFrames}...`);
  await renderStill({
    composition,
    serveUrl: bundlePath,
    frame,
    output: outputPath,
    inputProps: defaultProps,
    imageFormat: 'png',
  });

  console.log(`  Screenshot saved: ${slug}.png`);
  return outputPath;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Template Screenshot Generator\n');

  if (!existsSync(MANIFEST_PATH)) {
    console.error(
      `Manifest not found at ${MANIFEST_PATH}.\nRun "pnpm templates:build" first.`,
    );
    process.exit(1);
  }

  const manifest: Manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));

  if (manifest.templates.length === 0) {
    console.log('No templates in manifest.');
    return;
  }

  console.log(`Found ${manifest.templates.length} template(s)\n`);

  // Clean temp dirs
  for (const dir of [TEMP_DIR, SCREENSHOTS_DIR]) {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
  }

  // Initialize S3 + DB
  const minioClient = new MinioClient({
    endPoint: S3_ENDPOINT,
    port: S3_PORT,
    useSSL: S3_USE_SSL,
    accessKey: S3_ACCESS_KEY,
    secretKey: S3_SECRET_KEY,
  });

  const dbClient = new pg.Client({ connectionString: DATABASE_URL });
  await dbClient.connect();
  console.log('Connected to database.\n');

  let successes = 0;
  let failures = 0;

  let skipped = 0;

  for (const entry of manifest.templates) {
    console.log(`[${entry.slug}]`);

    if (SCREENSHOT_SKIPLIST.has(entry.slug)) {
      console.log(`  SKIPPED (in SCREENSHOT_SKIPLIST — cannot render offline)`);
      skipped++;
      console.log();
      continue;
    }

    try {
      // Generate screenshot with a hard timeout so one stuck render
      // doesn't hang the whole batch.
      const screenshotPath = await Promise.race([
        generateScreenshot(entry),
        new Promise<string>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timed out after ${TEMPLATE_TIMEOUT_MS}ms`)),
            TEMPLATE_TIMEOUT_MS,
          ),
        ),
      ]);

      // Upload to S3
      const s3Key = `${S3_PREFIX}${entry.slug}/screenshot.png`;
      const dbKey = `${entry.slug}/screenshot.png`;

      const fileBuffer = readFileSync(screenshotPath);
      await minioClient.putObject(S3_BUCKET, s3Key, fileBuffer, fileBuffer.length, {
        'Content-Type': 'image/png',
      });
      console.log(`  Uploaded to S3: ${s3Key}`);

      // Update DB
      await dbClient.query(
        'UPDATE templates SET screenshot_url = $1, updated_at = NOW() WHERE slug = $2',
        [dbKey, entry.slug],
      );
      console.log(`  DB updated: screenshot_url = ${dbKey}`);

      successes++;
    } catch (err) {
      console.error(`  FAILED: ${(err as Error).message}`);
      if ((err as Error).stack) {
        console.error(`  ${(err as Error).stack?.split('\n').slice(1, 3).join('\n  ')}`);
      }
      failures++;
    }

    console.log();
  }

  // Cleanup
  await dbClient.end();
  if (existsSync(TEMP_DIR)) rmSync(TEMP_DIR, { recursive: true, force: true });

  console.log(
    `Done. ${successes} screenshots generated, ${failures} failed, ${skipped} skipped.`,
  );

  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Screenshot generation failed:', err);
  process.exit(1);
});
