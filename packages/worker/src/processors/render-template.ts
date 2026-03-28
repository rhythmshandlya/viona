/**
 * Render Template Processor
 *
 * Renders a template with custom props into an MP4 video:
 * 1. Look up template metadata from DB (dimensions, fps, duration, sourceKey)
 * 2. Download template source files from S3
 * 3. Create a thin Remotion entry wrapping the template in <Composition>
 * 4. bundle() via @remotion/bundler
 * 5. selectComposition() + renderMedia() to MP4
 * 6. Upload MP4 to S3
 * 7. Update templateExports record with status + outputUrl
 */

import { Job } from 'bullmq';
import { join, dirname } from 'path';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { rm } from 'fs/promises';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { db, templates, templateExports } from '../db/index.js';
import { listObjects, downloadFile, uploadFile } from '../services/minio.js';
import { logger } from '../logger.js';

export interface RenderTemplateJobData {
  exportId: string;
  templateId: string;
  slug: string;
  bundleKey: string;
  props: Record<string, unknown>;
  userId: string;
}

export async function processRenderTemplateJob(job: Job<RenderTemplateJobData>) {
  const { exportId, templateId, slug, props } = job.data;

  const workDir = join(tmpdir(), `render-tpl-${nanoid(8)}`);
  const sourceDir = join(workDir, 'src');
  const bundleOutDir = join(workDir, 'bundle');
  const outputPath = join(workDir, `${slug}.mp4`);

  try {
    // ── 1. Update status to processing ──────────────────────────
    await db.update(templateExports)
      .set({ status: 'processing' })
      .where(eq(templateExports.id, exportId));

    logger.info({ exportId, templateId, slug }, 'Render-template: starting');

    // ── 2. Look up template metadata ────────────────────────────
    const template = await db.query.templates.findFirst({
      where: eq(templates.id, templateId),
    });

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    if (!template.sourceKey) {
      throw new Error(`Template ${slug} has no sourceKey — cannot render`);
    }

    const { width, height, fps, durationFrames, sourceKey } = template;

    logger.info(
      { exportId, slug, width, height, fps, durationFrames, sourceKey },
      'Render-template: template metadata loaded',
    );

    // ── 3. Download source files from S3 ────────────────────────
    mkdirSync(sourceDir, { recursive: true });

    const objectKeys = await listObjects('templates', sourceKey);

    if (objectKeys.length === 0) {
      throw new Error(`No source files found at templates/${sourceKey}`);
    }

    for (const key of objectKeys) {
      // key is relative to the 'templates' prefix, e.g. "my-template/src/index.tsx"
      // We need the part after sourceKey to get the relative path within the template
      const relativePath = key.startsWith(sourceKey)
        ? key.slice(sourceKey.length).replace(/^\//, '')
        : key;

      const localPath = join(sourceDir, relativePath);
      const localDir = dirname(localPath);

      if (!existsSync(localDir)) {
        mkdirSync(localDir, { recursive: true });
      }

      await downloadFile('templates', key, localPath);
    }

    logger.info(
      { exportId, fileCount: objectKeys.length },
      'Render-template: source files downloaded',
    );

    // ── 4. Create thin Remotion entry point ─────────────────────
    const entryPath = join(workDir, 'entry.tsx');
    const compositionId = 'template';

    const entrySource = `
import React from 'react';
import { registerRoot, Composition } from 'remotion';
import TemplateComponent from './src/index';

const Root: React.FC = () => (
  <Composition
    id="${compositionId}"
    component={TemplateComponent}
    durationInFrames={${durationFrames}}
    fps={${fps}}
    width={${width}}
    height={${height}}
    defaultProps={${JSON.stringify(props)}}
  />
);

registerRoot(Root);
`;

    writeFileSync(entryPath, entrySource, 'utf-8');

    logger.info({ exportId, entryPath }, 'Render-template: entry point created');

    // ── 5. Bundle with @remotion/bundler ─────────────────────────
    await job.updateProgress(20);

    const bundlePath = await bundle({
      entryPoint: entryPath,
      outDir: bundleOutDir,
      // Webpack config to handle JSX/TSX
      webpackOverride: (config) => config,
    });

    logger.info({ exportId, bundlePath }, 'Render-template: bundle complete');

    // ── 6. Select composition + render to MP4 ───────────────────
    await job.updateProgress(40);

    const composition = await selectComposition({
      serveUrl: bundlePath,
      id: compositionId,
      inputProps: props,
    });

    await job.updateProgress(50);

    await renderMedia({
      composition,
      serveUrl: bundlePath,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: props,
      onProgress: ({ progress }) => {
        // Map render progress (0-1) to job progress (50-90)
        const jobProgress = Math.round(50 + progress * 40);
        job.updateProgress(jobProgress).catch(() => {});
      },
    });

    logger.info({ exportId, outputPath }, 'Render-template: render complete');

    // ── 7. Upload MP4 to S3 ─────────────────────────────────────
    await job.updateProgress(90);

    const outputKey = `exports/${exportId}/${slug}.mp4`;
    await uploadFile('templates', outputKey, outputPath);

    logger.info({ exportId, outputKey }, 'Render-template: MP4 uploaded');

    // ── 8. Update templateExports with completed status ─────────
    await db.update(templateExports)
      .set({
        status: 'completed',
        outputUrl: outputKey,
        completedAt: new Date(),
      })
      .where(eq(templateExports.id, exportId));

    await job.updateProgress(100);

    logger.info({ exportId, slug }, 'Render-template: job completed successfully');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ exportId, slug, err: error }, 'Render-template: job failed');

    // Update export status to failed
    try {
      await db.update(templateExports)
        .set({ status: 'failed' })
        .where(eq(templateExports.id, exportId));
    } catch (dbErr) {
      logger.error({ exportId, err: dbErr }, 'Render-template: failed to update status on error');
    }

    throw error;
  } finally {
    // ── Cleanup temp directory ─────────────────────────────────
    try {
      await rm(workDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
