/**
 * Template Upload & DB Registration Script
 *
 * Reads the build manifest (dist/bundles/manifest.json) and for each template:
 * 1. Uploads bundle.{hash}.js to S3
 * 2. Uploads source files to S3
 * 3. Uploads assets (if they exist) to S3
 * 4. Upserts metadata into the `templates` DB table
 *
 * S3 layout:  templates/{slug}/bundle.{hash}.js
 *             templates/{slug}/source/...
 *             templates/{slug}/assets/...
 *
 * DB keys stored WITHOUT the `templates/` prefix (minio service prepends it).
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from the API package (has MINIO_* and DATABASE_URL)
config({ path: resolve(import.meta.dirname, '../../api/.env') });

import { Client as MinioClient } from 'minio';
import pg from 'pg';
import {
  readFileSync,
  readdirSync,
  existsSync,
  statSync,
} from 'fs';
import { join, dirname, resolve, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PKG_ROOT = resolve(__dirname, '..');
const SRC_DIR = join(PKG_ROOT, 'src');
const TEMPLATES_DIR = join(SRC_DIR, 'templates');
const DIST_DIR = join(PKG_ROOT, 'dist', 'bundles');
const MANIFEST_PATH = join(DIST_DIR, 'manifest.json');

// ── Config from env ─────────────────────────────────────────────────────────

// Precedence: BUCKET_* (Railway prod) > S3_* > MINIO_* (legacy dev).
// Prefer BUCKET_PUBLIC_* over BUCKET_* because this script runs from a developer
// machine (or CI) and needs the externally reachable Railway domain, not the
// `.railway.internal` endpoint which only resolves inside Railway's network.
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
// If we resolved the public endpoint, assume SSL (Railway public domains are HTTPS);
// otherwise respect the explicit S3_USE_SSL/MINIO_USE_SSL flag.
const S3_USE_SSL = process.env.BUCKET_PUBLIC_ENDPOINT
  ? true
  : (process.env.S3_USE_SSL || process.env.MINIO_USE_SSL) === 'true';
// Prefer DATABASE_PUBLIC_URL when running locally against Railway prod
// (DATABASE_URL points at `.railway.internal` which only resolves inside Railway).
const DATABASE_URL =
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/viona';

// S3 prefix — the minio service layer in the API prepends this,
// so DB keys are stored without it
const S3_PREFIX = 'templates/';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Recursively collect all files under a directory */
function getAllFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

/** Normalize Windows backslashes to forward slashes for S3 keys */
function toS3Key(path: string): string {
  return path.replace(/\\/g, '/');
}

/** Map file extension to content-type */
function getContentType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    '.js': 'application/javascript',
    '.ts': 'text/typescript',
    '.tsx': 'text/typescript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.css': 'text/css',
    '.html': 'text/html',
    '.md': 'text/markdown',
  };
  return types[ext] || 'application/octet-stream';
}

// ── Manifest types (matching build-templates.ts output) ─────────────────────

interface ManifestEntry {
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  bundleFile: string; // e.g. "globe-spin/globe-spin.bec9ab808aea.js"
  bundleHash: string;
  bundleSizeBytes: number;
  schemaFile: string;
  meta: Record<string, unknown>;
  compositionMeta: Record<string, unknown>;
  defaultProps: Record<string, unknown>;
}

interface Manifest {
  version: number;
  builtAt: string;
  templates: ManifestEntry[];
}

// ── S3 Upload ───────────────────────────────────────────────────────────────

async function uploadFileToS3(
  client: MinioClient,
  localPath: string,
  s3Key: string,
  contentType: string,
): Promise<void> {
  const fileBuffer = readFileSync(localPath);
  await client.putObject(S3_BUCKET, s3Key, fileBuffer, fileBuffer.length, {
    'Content-Type': contentType,
  });
}

async function uploadTemplate(
  client: MinioClient,
  entry: ManifestEntry,
): Promise<{ bundleKey: string; sourceKey: string }> {
  const { slug } = entry;

  // ── 1. Upload bundle.js ───────────────────────────────────────────
  const bundleLocalPath = join(DIST_DIR, entry.bundleFile);
  // Extract just the filename from bundleFile (e.g. "globe-spin.bec9ab808aea.js")
  const bundleFileName = entry.bundleFile.split('/').pop()!;
  const bundleS3Key = `${S3_PREFIX}${slug}/bundle.${entry.bundleHash}.js`;
  const bundleDbKey = `${slug}/bundle.${entry.bundleHash}.js`;

  console.log(`  Uploading bundle: ${bundleFileName}`);
  await uploadFileToS3(client, bundleLocalPath, bundleS3Key, 'application/javascript');

  // ── 2. Upload source files ────────────────────────────────────────
  const sourceDir = join(TEMPLATES_DIR, slug);
  const sourceDbKey = `${slug}/source/`;

  if (existsSync(sourceDir)) {
    const sourceFiles = getAllFiles(sourceDir);
    console.log(`  Uploading ${sourceFiles.length} source files...`);

    for (const filePath of sourceFiles) {
      const relativePath = filePath.substring(sourceDir.length + 1);
      const s3Key = toS3Key(`${S3_PREFIX}${slug}/source/${relativePath}`);
      const contentType = getContentType(filePath);
      await uploadFileToS3(client, filePath, s3Key, contentType);
    }
  }

  // ── 2b. Detect which shared modules this template uses ──────────────
  const sourceFilesAll = existsSync(sourceDir) ? getAllFiles(sourceDir) : [];
  const allSourceContent = sourceFilesAll
    .filter(fp => /\.(ts|tsx)$/.test(fp))
    .map(fp => readFileSync(fp, 'utf-8'));

  const usesMagazine = allSourceContent.some(c => /from\s+['"](?:\.\.\/){2,}magazine\//.test(c));
  const usesFonts = allSourceContent.some(c => /from\s+['"](?:\.\.\/){2,}fonts['"]/.test(c));
  const usesScale = allSourceContent.some(c => /from\s+['"](?:\.\.\/){2,}use-scale['"]/.test(c));
  const usesLib = allSourceContent.some(c => /from\s+['"](?:\.\.\/){2,}lib\//.test(c));

  // ── 2c. Upload shared magazine library (if used) ──────────────────
  const magazineDir = join(SRC_DIR, 'magazine');
  if (usesMagazine && existsSync(magazineDir)) {
    const magazineFiles = getAllFiles(magazineDir);
    console.log(`  Uploading ${magazineFiles.length} shared magazine library files...`);
    for (const filePath of magazineFiles) {
      const relativePath = filePath.substring(magazineDir.length + 1);
      const s3Key = toS3Key(`${S3_PREFIX}${slug}/source/magazine/${relativePath}`);
      const contentType = getContentType(filePath);
      await uploadFileToS3(client, filePath, s3Key, contentType);
    }
  }

  // ── 2d. Upload shared root files (fonts.ts, use-scale.ts) ──────────
  if (usesFonts || usesMagazine) {
    const fontsPath = join(SRC_DIR, 'fonts.ts');
    if (existsSync(fontsPath)) {
      const s3Key = toS3Key(`${S3_PREFIX}${slug}/source/fonts.ts`);
      await uploadFileToS3(client, fontsPath, s3Key, 'text/typescript');
    }
  }

  if (usesScale) {
    const scalePath = join(SRC_DIR, 'use-scale.ts');
    if (existsSync(scalePath)) {
      console.log(`  Uploading use-scale.ts...`);
      const s3Key = toS3Key(`${S3_PREFIX}${slug}/source/use-scale.ts`);
      await uploadFileToS3(client, scalePath, s3Key, 'text/typescript');
    }
  }

  // ── 2f. Upload shared lib/ directory (if used, e.g. lib/map/) ─────
  if (usesLib) {
    const libDir = join(SRC_DIR, 'lib');
    if (existsSync(libDir)) {
      const libFiles = getAllFiles(libDir);
      console.log(`  Uploading ${libFiles.length} shared lib/ files...`);
      for (const filePath of libFiles) {
        const relativePath = filePath.substring(libDir.length + 1);
        const s3Key = toS3Key(`${S3_PREFIX}${slug}/source/lib/${relativePath}`);
        const contentType = getContentType(filePath);
        await uploadFileToS3(client, filePath, s3Key, contentType);
      }
    }
  }

  // ── 3. Upload assets (if they exist) ──────────────────────────────
  const assetsDir = join(TEMPLATES_DIR, slug, 'assets');
  if (existsSync(assetsDir) && statSync(assetsDir).isDirectory()) {
    const assetFiles = getAllFiles(assetsDir);
    console.log(`  Uploading ${assetFiles.length} asset files...`);

    for (const filePath of assetFiles) {
      const relativePath = filePath.substring(assetsDir.length + 1);
      const s3Key = toS3Key(`${S3_PREFIX}${slug}/assets/${relativePath}`);
      const contentType = getContentType(filePath);
      await uploadFileToS3(client, filePath, s3Key, contentType);
    }
  }

  return { bundleKey: bundleDbKey, sourceKey: sourceDbKey };
}

// ── DB Upsert ───────────────────────────────────────────────────────────────

async function upsertTemplate(
  dbClient: pg.Client,
  entry: ManifestEntry,
  bundleKey: string,
  sourceKey: string,
): Promise<void> {
  const {
    slug,
    name,
    description,
    category,
    tags,
    compositionMeta,
    defaultProps,
  } = entry;

  // Read the JSON schema file for props_schema
  const schemaFilePath = join(DIST_DIR, entry.schemaFile);
  let propsSchema: Record<string, unknown> = {};
  if (existsSync(schemaFilePath)) {
    propsSchema = JSON.parse(readFileSync(schemaFilePath, 'utf-8'));
  }

  // Extract composition metadata
  const aspectRatio = (entry.meta.aspectRatio as string) || '16:9';
  const durationFrames =
    (compositionMeta.durationInFrames as number) || 360;
  const fps = (compositionMeta.fps as number) || 30;
  const width = (compositionMeta.width as number) || 1920;
  const height = (compositionMeta.height as number) || 1080;

  const dependencies = (entry.meta as any).dependencies || null;

  const sql = `
    INSERT INTO templates (
      slug, name, description, category, tags, aspect_ratio,
      duration_frames, fps, width, height, props_schema, default_props,
      screenshot_url, bundle_key, source_key, type, dependencies, version, is_published
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 1, true)
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      tags = EXCLUDED.tags,
      props_schema = EXCLUDED.props_schema,
      default_props = EXCLUDED.default_props,
      screenshot_url = EXCLUDED.screenshot_url,
      bundle_key = EXCLUDED.bundle_key,
      source_key = EXCLUDED.source_key,
      type = EXCLUDED.type,
      dependencies = EXCLUDED.dependencies,
      version = templates.version + 1,
      updated_at = NOW()
  `;

  const values = [
    slug,
    name,
    description,
    category,
    JSON.stringify(tags),
    aspectRatio,
    durationFrames,
    fps,
    width,
    height,
    JSON.stringify(propsSchema),
    JSON.stringify(defaultProps),
    null, // screenshot_url — deferred
    bundleKey,
    sourceKey,
    (entry.meta.type as string) || 'scene',
    dependencies ? JSON.stringify(dependencies) : null,
  ];

  await dbClient.query(sql, values);

  // Handle theme associations
  const themeSlugs: string[] = ((entry.meta as any).themes as string[]) || [];
  // Get template ID (needed for both add and clear cases)
  const templateRow = await dbClient.query(
    'SELECT id FROM templates WHERE slug = $1',
    [entry.slug],
  );
  const templateId = templateRow.rows[0]?.id;
  if (templateId) {
    // Clear existing associations
    await dbClient.query(
      'DELETE FROM template_themes WHERE template_id = $1',
      [templateId],
    );
    // Insert new associations
    for (const themeSlug of themeSlugs) {
      const themeRow = await dbClient.query(
        'SELECT id FROM themes WHERE slug = $1',
        [themeSlug],
      );
      if (themeRow.rows[0]) {
        await dbClient.query(
          'INSERT INTO template_themes (theme_id, template_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [themeRow.rows[0].id, templateId],
        );
      } else {
        console.warn(`  Warning: Theme "${themeSlug}" not found in DB, skipping association`);
      }
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Template Upload & DB Registration\n');

  // ── Read manifest ───────────────────────────────────────────────────
  if (!existsSync(MANIFEST_PATH)) {
    console.error(
      `Manifest not found at ${MANIFEST_PATH}.\nRun "pnpm templates:build" first.`,
    );
    process.exit(1);
  }

  const manifest: Manifest = JSON.parse(
    readFileSync(MANIFEST_PATH, 'utf-8'),
  );

  if (manifest.templates.length === 0) {
    console.log('No templates in manifest. Nothing to upload.');
    return;
  }

  console.log(
    `Found ${manifest.templates.length} template(s) in manifest (built ${manifest.builtAt})\n`,
  );

  // ── Initialize MinIO client ─────────────────────────────────────────
  const minioClient = new MinioClient({
    endPoint: S3_ENDPOINT,
    port: S3_PORT,
    useSSL: S3_USE_SSL,
    accessKey: S3_ACCESS_KEY,
    secretKey: S3_SECRET_KEY,
  });

  // Ensure bucket exists
  const bucketExists = await minioClient.bucketExists(S3_BUCKET);
  if (!bucketExists) {
    console.log(`Creating bucket: ${S3_BUCKET}`);
    await minioClient.makeBucket(S3_BUCKET, 'us-east-1');
  }

  // ── Initialize DB client ────────────────────────────────────────────
  const dbClient = new pg.Client({ connectionString: DATABASE_URL });
  await dbClient.connect();
  console.log('Connected to database.\n');

  // ── Process each template ───────────────────────────────────────────
  let successes = 0;
  let failures = 0;

  for (const entry of manifest.templates) {
    console.log(`[${entry.slug}]`);

    try {
      // Upload to S3
      const { bundleKey, sourceKey } = await uploadTemplate(
        minioClient,
        entry,
      );
      console.log(`  S3 upload complete.`);

      // Verify source files actually landed in the bucket
      const verifyPrefix = `${S3_PREFIX}${sourceKey}`;
      let verifyCount = 0;
      const verifyStream = minioClient.listObjects(S3_BUCKET, verifyPrefix, true);
      for await (const _obj of verifyStream) {
        verifyCount++;
      }
      if (verifyCount === 0) {
        throw new Error(
          `Post-upload verification failed: 0 objects at prefix "${verifyPrefix}" in bucket "${S3_BUCKET}". ` +
          `Check that S3_BUCKET is correct (currently: ${S3_BUCKET}).`,
        );
      }
      console.log(`  Verified: ${verifyCount} source files in ${S3_BUCKET}/${verifyPrefix}`);

      // Upsert to DB
      await upsertTemplate(dbClient, entry, bundleKey, sourceKey);
      console.log(`  DB upserted (bundle_key: ${bundleKey})`);

      successes++;
    } catch (err) {
      console.error(
        `  FAILED: ${(err as Error).message}`,
      );
      failures++;
    }

    console.log();
  }

  // ── Cleanup ─────────────────────────────────────────────────────────
  await dbClient.end();

  console.log(
    `Done. ${successes} succeeded, ${failures} failed out of ${manifest.templates.length} templates.`,
  );

  if (failures > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Upload failed:', err);
  process.exit(1);
});
