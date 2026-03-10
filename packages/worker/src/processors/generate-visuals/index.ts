/**
 * Visual Generation Processor
 *
 * Uses Claude Code (Agent SDK) with OAuth authentication from Claude Pro/Max subscription.
 * No API key costs - included in subscription.
 */

import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { existsSync } from 'fs';
import { mkdir, rm, writeFile, readFile, readdir, copyFile } from 'fs/promises';
import { join } from 'path';
import { db, projects, tracks, timelineItems, transcripts, jobs, visuals } from '../../db/index.js';
import { publishJobProgress, publishJobComplete, publishJobError, setJobProjectId } from '../../services/redis.js';
import { config } from '../../config.js';
import { logger } from '../../logger.js';
import { getWorkspacePath, createProjectDir } from '../../workspace.js';
import { uploadFile } from '../../services/minio.js';
import { buildTemplateCatalog } from '../../prompts/studio-templates.js';
import { getTheme } from '../../prompts/theme-loader.js';
import type { GenerateVisualsJobData, HeadTrackingFrame, VisualMetadata, JobMetrics } from './types.js';
import { findPackagesRoot, copyDirRecursive, computeSpeakerGrid, extractAssets, injectUserAssets, prepareVideoAssets } from './validation.js';
import { uploadBundleToStorage, uploadSourceToStorage } from './storage.js';
import { runMonitoredClaudeGenerator } from './subprocess.js';

// Re-exports
export type { GenerateVisualsJobData } from './types.js';
export { validateEnvironment, cancelJob, getRunningJobs } from './subprocess.js';

export async function processGenerateVisualsJob(job: Job<GenerateVisualsJobData>) {
  const { projectId, jobId, stylePreset, layoutMode, dimensions, styleGuide } = job.data;
  setJobProjectId(jobId, projectId);
  const compositionId = `proj_${projectId.replace(/-/g, '_')}`;

  // Proactive lock extension — prevents BullMQ from marking 30-min jobs as stalled
  const lockExtender = setInterval(async () => {
    try {
      await job.extendLock(job.token!, 120_000);
    } catch (err) {
      logger.error({ jobId, err }, 'Lock extension failed');
    }
  }, 55_000);

  try {
    // Update job status
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 5, 'Loading project...');

    // Load project and transcript
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const transcript = await db.query.transcripts.findFirst({
      where: eq(transcripts.projectId, projectId),
    });

    if (!transcript || !transcript.words) {
      throw new Error('Project has no transcript');
    }

    await publishJobProgress(jobId, 10, 'Preparing workspace...');

    // Clean up old composition directories in workspace
    const workspacePath = getWorkspacePath();
    const srcDir = join(workspacePath, 'src');
    try {
      const entries = await readdir(srcDir);
      for (const entry of entries) {
        if (entry.startsWith('proj_') && entry !== compositionId) {
          const oldDir = join(srcDir, entry);
          logger.info({ oldDir, compositionId }, 'Removing stale composition directory');
          await rm(oldDir, { recursive: true, force: true });
        }
      }
    } catch (e) {
      logger.debug({ srcDir, error: e }, 'Could not clean old compositions (may not exist yet)');
    }

    // Check if previous attempt left any artifacts worth preserving for checkpoint resume.
    // If scenes.json exists, preserve the directory — the Python agent's checkpoint logic
    // will detect what phase to resume from (scenes only, setup+scenes, full pipeline, etc.).
    const projectDir = join(workspacePath, 'src', compositionId);
    const scenesJsonPath = join(projectDir, 'scenes.json');
    let hasExistingSources = false;
    try {
      await readFile(scenesJsonPath);
      hasExistingSources = true;
      logger.info({ projectDir }, 'Previous scenes.json found — preserving for checkpoint resume');
    } catch {
      // No artifacts worth preserving — clean and start fresh
      try {
        await rm(projectDir, { recursive: true, force: true });
        logger.info({ projectDir }, 'Cleaned stale project directory');
      } catch {
        // Directory may not exist yet — that's fine
      }
    }
    createProjectDir(compositionId); // mkdir -p is idempotent
    logger.info({ projectDir, compositionId, hasExistingSources }, 'Project directory ready');

    // Write head tracking data for spatial overlay awareness
    if (project.headTrackingData) {
      const htPath = join(projectDir, 'head_tracking.json');
      await writeFile(htPath, JSON.stringify(project.headTrackingData), 'utf-8');
      logger.info({ projectDir }, 'Wrote head_tracking.json for spatial overlay');
    }

    // Compute full-video speaker grid for Director overlay awareness
    let directorSafePlacement: string[] = [];
    if (project.headTrackingData) {
      const htData = project.headTrackingData as { frames?: HeadTrackingFrame[]; video?: { width: number; height: number } };
      const totalMs = (project.durationFrames || 900) / (project.fps || 30) * 1000;
      const fullGrid = computeSpeakerGrid(htData, 0, totalMs);
      directorSafePlacement = fullGrid.safePlacement;
      logger.info({ safePlacement: directorSafePlacement, occupancy: fullGrid.occupancy }, 'Pre-computed speaker grid for Director');
    }

    // Inject user-uploaded assets (logos, icons, brand images) into workspace
    const userAssetCount = await injectUserAssets(projectId, projectDir);
    if (userAssetCount > 0) {
      logger.info({ projectId, userAssetCount }, 'User assets injected into workspace');
    }

    // Prepare video assets manifest from user selections (for render phase)
    const videoManifest = await prepareVideoAssets(job.data.selectedVideos, projectDir);

    // If this is an Animator-only run (plan was created separately), write plan files to project dir
    // Also enrich scenes.json with per-scene effectiveDimensions
    const canvasWidth = dimensions?.width || 1080;
    const canvasHeight = dimensions?.height || 1920;
    const pipEffective = job.data.pipEffective || { width: canvasWidth, height: canvasHeight };

    if (job.data.planJobId) {
      // Detect if the plan changed (e.g. after "start over") by comparing the planJobId
      // to a marker file. If it changed, old generation artifacts (constants.ts, Scene*.tsx,
      // index.tsx) are stale and must be cleaned to prevent the checkpoint system from
      // resuming with scene files that don't match the new plan.
      const planMarkerPath = join(projectDir, '.plan_job_id');
      if (hasExistingSources) {
        let planChanged = false;
        try {
          const existingPlanJobId = (await readFile(planMarkerPath, 'utf-8')).trim();
          planChanged = existingPlanJobId !== job.data.planJobId;
        } catch {
          // No marker file → assume plan changed (safe default)
          planChanged = true;
        }
        if (planChanged) {
          logger.info({ projectDir, planJobId: job.data.planJobId }, 'Plan changed — cleaning stale generation artifacts');
          const scenesDir = join(projectDir, 'scenes');
          await rm(scenesDir, { recursive: true, force: true }).catch(() => {});
          for (const f of ['constants.ts', 'index.tsx', 'metadata.json']) {
            await rm(join(projectDir, f), { force: true }).catch(() => {});
          }
        }
      }
      await writeFile(planMarkerPath, job.data.planJobId, 'utf-8');

      const planJob = await db.query.jobs.findFirst({ where: eq(jobs.id, job.data.planJobId) });
      if (planJob?.planData) {
        const pd = planJob.planData as { scenePlan: string; scenes: Record<string, unknown> };
        // Write plan files to projectDir (workspace/src/{compositionId}) — the Python
        // generator receives compositionId as --project-id, so it looks there.
        const scenePlanPath = join(projectDir, 'SCENE_PLAN.md');
        await writeFile(scenePlanPath, pd.scenePlan, 'utf-8');

        // Enrich scenes with per-scene effectiveDimensions before writing
        const scenesObj = pd.scenes as Record<string, unknown>;
        const scenesArray = (scenesObj.scenes as Array<Record<string, unknown>>) || [];
        const fps = project.fps || 30;
        for (const scene of scenesArray) {
          const dm = (scene.displayMode as string) || 'default';
          if (dm === 'fullscreen' || dm === 'overlay') {
            scene.effectiveDimensions = { width: canvasWidth, height: canvasHeight };
          } else {
            scene.effectiveDimensions = { width: pipEffective.width, height: pipEffective.height };
          }

          // Pre-inject speaker grid for overlay scenes so the animator doesn't need to call a tool
          if (dm === 'overlay' && project.headTrackingData) {
            const frames = scene.frames as [number, number] | undefined;
            if (frames) {
              const startMs = (frames[0] / fps) * 1000;
              const endMs = (frames[1] / fps) * 1000;
              scene.speakerGrid = computeSpeakerGrid(
                project.headTrackingData as { frames?: HeadTrackingFrame[]; video?: { width: number; height: number } },
                startMs,
                endMs,
              );
            }
          }

          // Enrich scenes with video indicator for Animator awareness
          const sceneIdStr = String(scene.id);
          const sceneVideo = videoManifest.videos.find(v => v.sceneId === sceneIdStr);
          if (sceneVideo) {
            scene.hasVideo = true;
            scene.videoKeyword = sceneVideo.keyword;
          }
        }
        await writeFile(scenesJsonPath, JSON.stringify({ ...scenesObj, scenes: scenesArray }, null, 2), 'utf-8');
        logger.info({ projectDir, planJobId: job.data.planJobId, sceneCount: scenesArray.length }, 'Wrote enriched plan files from plan job for Animator-only run');
      } else {
        logger.warn({ planJobId: job.data.planJobId }, 'Plan job not found or has no planData');
      }
    }

    // Update workspace Root.tsx and index.ts to import from the correct project ID.
    // This prevents TypeScript import errors and eliminates the self-healing cycle.
    const compositionIdDashed = compositionId.replace(/_/g, '-'); // e.g. proj-abc-def
    const rootTsx = join(workspacePath, 'src', 'Root.tsx');
    const indexTsx = join(workspacePath, 'src', 'index.tsx');
    try {
      const durationFrames = Math.ceil(((project.durationMs || 60000) / 1000) * (project.fps || 30));
      await writeFile(rootTsx, `import "./index.css";
import { Composition } from "remotion";
import MainComposition from "./${compositionId}";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="${compositionIdDashed}"
        component={MainComposition}
        durationInFrames={${durationFrames}}
        fps={${project.fps || 30}}
        width={${dimensions?.width || 1080}}
        height={${dimensions?.height || 1920}}
      />
    </>
  );
};
`, 'utf-8');
      await writeFile(indexTsx, `import { registerRoot } from "remotion";
import { RemotionRoot } from "./${compositionId}/index";

registerRoot(RemotionRoot);
`, 'utf-8');

      // Remove old .ts if it exists (template ships index.ts, we write index.tsx)
      const oldIndexTs = join(workspacePath, 'src', 'index.ts');
      try { await rm(oldIndexTs, { force: true }); } catch { /* may not exist */ }

      logger.info({ compositionId }, 'Updated Root.tsx and index.tsx with correct project imports');
    } catch (e) {
      logger.warn({ error: e }, 'Failed to update Root.tsx/index.tsx — self-heal will fix it');
    }

    // Write categorized template catalog for Director prompt (no bulk copy — resolution happens after Director)
    if (getTheme(stylePreset)) {
      await publishJobProgress(jobId, 13, 'Preparing template catalog...');
      try {
        const srcDir = join(workspacePath, 'src');
        const catalog = buildTemplateCatalog(stylePreset);
        await writeFile(join(srcDir, 'STUDIO_TEMPLATES.md'), catalog, 'utf-8');
        logger.info('Studio template catalog written to workspace');
      } catch (err) {
        logger.warn({ err }, 'Failed to write studio template catalog (non-fatal)');
      }
    }

    await publishJobProgress(jobId, 15, 'Starting Claude Code generator...');

    // SubprocessMonitor handles progress via 3-layer monitoring (process health,
    // heartbeat tracking, file observation) — no manual heartbeat needed.

    // Calculate duration in frames
    const durationFrames = Math.ceil(((project.durationMs || 60000) / 1000) * (project.fps || 30));

    // Prepare transcript text and words
    const words = transcript.words as any[];
    const transcriptText = words
      .map((w: any) => w.word || w.text || '')
      .join(' ');

    // Run Claude Agent generator with SubprocessMonitor (always uses two-phase pipeline)
    const llmModel = config.claudeAgent.model;
    const claudeResult = await runMonitoredClaudeGenerator({
      projectId: compositionId,
      jobId,
      transcript: transcriptText,
      words,  // Always pass words for two-phase pipeline
      durationFrames,
      fps: project.fps || 30,
      width: canvasWidth,
      height: canvasHeight,
      stylePreset: stylePreset || 'studio-dark',
      layoutMode: layoutMode || 'pip',
      styleGuide,
      planJobId: job.data.planJobId,
      pipWidth: pipEffective.width,
      pipHeight: pipEffective.height,
      safePlacement: directorSafePlacement,
    });

    // Store metrics in job (no token cost for OAuth)
    const jobMetrics: JobMetrics = {
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      durationMs: claudeResult.durationMs,
      llmModel,
      filesWritten: claudeResult.filesWritten,
      screenshotsTaken: 0,
      finalScore: 100,
      totalIterations: 1,
      status: claudeResult.status,
    };

    await db.update(jobs)
      .set({ metrics: jobMetrics, logs: [`Claude Code generator completed in ${claudeResult.durationMs}ms`] })
      .where(eq(jobs.id, jobId));

    logger.info({ projectId, jobMetrics }, 'Job metrics recorded');

    // Always upload sources immediately after agent completes — even if bundling fails later.
    // This preserves the AI-generated code so retries can pick up where we left off.
    const earlyBundleCompositionId = compositionId.replace(/_/g, '-');
    try {
      await uploadSourceToStorage(projectDir, earlyBundleCompositionId);
      logger.info({ projectId }, 'Sources uploaded (pre-bundle) for failure recovery');
    } catch (err) {
      logger.warn({ projectId, err }, 'Pre-bundle source upload failed (non-fatal)');
    }

    await publishJobProgress(jobId, 70, 'Reading metadata...');

    // Read metadata file that the agent should have created
    const metadataPath = join(projectDir, 'metadata.json');
    const scenesPath = join(projectDir, 'scenes.json');
    let metadata: VisualMetadata;

    try {
      const metadataContent = await readFile(metadataPath, 'utf-8');
      metadata = JSON.parse(metadataContent);

      if (!metadata.compositionId || typeof metadata.durationInFrames !== 'number') {
        throw new Error('Invalid metadata.json: missing required fields');
      }

      // Try to read scenes.json for detailed scene information
      try {
        const scenesContent = await readFile(scenesPath, 'utf-8');
        const scenesData = JSON.parse(scenesContent);

        if (scenesData.scenes && Array.isArray(scenesData.scenes) && scenesData.scenes.length > 0) {
          // Convert scenes.json format to timestamps format for the database
          metadata.visuals = scenesData.scenes.map((scene: any) => {
            // Extract elements from layout if present
            const elements: Array<{
              id: string;
              name: string;
              type: string;
              x: string;
              y: string;
              width: string;
              height: string;
            }> = [];

            if (scene.layout && typeof scene.layout === 'object') {
              Object.entries(scene.layout).forEach(([key, value]: [string, any]) => {
                if (value && typeof value === 'object') {
                  elements.push({
                    id: `scene${scene.id}-${key}`,
                    name: key.charAt(0).toUpperCase() + key.slice(1), // Capitalize
                    type: key,
                    x: value.x || 'center',
                    y: value.y || '50%',
                    width: value.width || '100%',
                    height: value.height || '100%',
                  });
                }
              });
            }

            return {
              startMs: Math.round(scene.timestampRange[0] * 1000),
              endMs: Math.round(scene.timestampRange[1] * 1000),
              type: scene.name || `Scene ${scene.id}`,
              description: scene.visual || scene.emotion || '',
              displayMode: scene.displayMode || undefined,
              transition: scene.transition || undefined,
              elements: elements.length > 0 ? elements : undefined,
            };
          });
          logger.info({ projectId, sceneCount: metadata.visuals.length }, 'Loaded scenes from scenes.json');
        }
      } catch (scenesErr) {
        logger.warn({ projectId, error: scenesErr }, 'Could not read scenes.json, falling back to metadata.visuals');
      }

      if (!metadata.visuals || !Array.isArray(metadata.visuals)) {
        throw new Error('Invalid metadata.json: visuals must be an array');
      }

      if (metadata.visuals.length === 0) {
        throw new Error('Agent completed but generated no visuals.');
      }

      logger.info({ projectId, visualCount: metadata.visuals.length }, 'Metadata validated successfully');

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error reading metadata';

      // Check if the index.tsx file was at least created
      const indexPath = join(projectDir, 'index.tsx');
      let indexExists = false;
      try {
        await readFile(indexPath, 'utf-8');
        indexExists = true;
      } catch {
        // Index doesn't exist
      }

      if (!indexExists) {
        throw new Error(`Agent failed to generate any code. ${errorMsg}`);
      }

      // Create minimal fallback metadata
      logger.warn({ projectId, error: errorMsg }, 'Metadata missing, using fallback');
      metadata = {
        compositionId,
        durationInFrames: durationFrames,
        fps: project.fps || 30,
        width: canvasWidth,
        height: canvasHeight,
        visuals: [{
          startMs: 0,
          endMs: project.durationMs || 60000,
          type: 'generated',
          description: 'AI-generated visual',
        }],
      };
    }

    await publishJobProgress(jobId, 80, 'Verifying bundle...');

    // Verify bundle exists
    const bundleCompositionId = compositionId.replace(/_/g, '-');
    const bundleDir = join(config.remotion.bundleOutputDir, bundleCompositionId);
    const bundleIndex = join(bundleDir, 'index.html');

    try {
      await readFile(bundleIndex);
      logger.info({ projectId, bundleDir }, 'Bundle verified');
    } catch (err) {
      throw new Error(`Bundle not found at ${bundleDir}. Generator may have failed to create it.`);
    }

    // Ensure user assets are in the bundle (Remotion bundle may not always copy them)
    const userAssetsSource = join(getWorkspacePath(), 'public', 'assets', 'user');
    if (existsSync(userAssetsSource)) {
      const userAssetsDest = join(bundleDir, 'public', 'assets', 'user');
      await mkdir(userAssetsDest, { recursive: true });
      const userFiles = await readdir(userAssetsSource);
      for (const f of userFiles) {
        await copyFile(join(userAssetsSource, f), join(userAssetsDest, f));
      }
      if (userFiles.length > 0) {
        logger.info({ count: userFiles.length }, 'Copied user assets into bundle');
      }
    }

    // Upload bundle to S3 for production persistence
    await publishJobProgress(jobId, 82, 'Uploading bundle to storage...');
    await uploadBundleToStorage(bundleDir, bundleCompositionId);

    // Sources already uploaded pre-bundle (for failure recovery).
    const sourceUrl = `/api/sources/${bundleCompositionId}`;

    // Extract assets from composition for frontend selection
    await publishJobProgress(jobId, 84, 'Extracting assets...');
    const extractedAssets = await extractAssets(projectDir);

    // Upload assets.json to S3 as well
    const assetsPath = join(projectDir, 'assets.json');
    try {
      await uploadFile('outputs', `sources/${bundleCompositionId}/assets.json`, assetsPath);
      logger.info({ projectId, assetCount: extractedAssets.length }, 'Assets uploaded to storage');
    } catch (err) {
      logger.warn({ projectId, error: err }, 'Failed to upload assets.json');
    }

    // Bundle URL points to API route that serves from S3
    const bundleUrl = `/api/bundles/${bundleCompositionId}/index.html`;

    await publishJobProgress(jobId, 85, 'Registering visual...');

    // Wrap DB completion in a transaction — ensures frontend is never notified
    // before DB is consistent.
    await db.transaction(async (tx) => {
      // Clean up old visuals for this project
      const existingVisuals = await tx.select().from(visuals).where(eq(visuals.projectId, projectId));
      if (existingVisuals.length > 0) {
        logger.info({ projectId, count: existingVisuals.length }, 'Cleaning up existing visuals');

        for (const oldVisual of existingVisuals) {
          const allItems = await tx.select().from(timelineItems);
          for (const item of allItems) {
            if (item.type === 'visual' && (item.data as any)?.visualId === oldVisual.id) {
              await tx.delete(timelineItems).where(eq(timelineItems.id, item.id));
            }
          }

          if (oldVisual.compositionId) {
            const oldBundleDir = join(config.remotion.bundleOutputDir, oldVisual.compositionId);
            try {
              await rm(oldBundleDir, { recursive: true, force: true });
            } catch {
              // Ignore cleanup errors
            }
          }
        }

        await tx.delete(visuals).where(eq(visuals.projectId, projectId));
      }

      // Enrich timestamps with sourceSceneId (1-indexed scene file mapping)
      const timestampsWithSourceId = metadata.visuals.map((v, i) => ({
        ...v,
        sourceSceneId: i + 1,
      }));

      // Insert into visuals table
      const [insertedVisual] = await tx.insert(visuals).values({
        projectId,
        compositionId: metadata.compositionId,
        bundleUrl,
        sourceUrl, // Source project files for AI context restoration
        durationFrames: metadata.durationInFrames,
        fps: metadata.fps,
        width: metadata.width,
        height: metadata.height,
        stylePreset,
        llmModel,
        timestamps: timestampsWithSourceId,
      }).returning({ id: visuals.id });
      const visualId = insertedVisual.id;

      // Find or create visuals track
      const existingTracks = await tx.select().from(tracks).where(eq(tracks.projectId, projectId));
      let visualsTrack = existingTracks.find(t => t.type === 'visual');

      if (!visualsTrack) {
        const [newTrack] = await tx.insert(tracks).values({
          projectId,
          type: 'visual',
          name: 'Visuals',
          position: existingTracks.length,
        }).returning();
        visualsTrack = newTrack;
      }

      // Create one timeline item per scene so they appear as separate blocks on the track
      for (let sceneIndex = 0; sceneIndex < metadata.visuals.length; sceneIndex++) {
        const scene = metadata.visuals[sceneIndex];
        // Compute per-scene effective dimensions
        const sceneDm = scene.displayMode || 'default';
        const sceneEffectiveW = (sceneDm === 'fullscreen' || sceneDm === 'overlay')
          ? canvasWidth : pipEffective.width;
        const sceneEffectiveH = (sceneDm === 'fullscreen' || sceneDm === 'overlay')
          ? canvasHeight : pipEffective.height;

        // Compute speaker bbox for overlay scenes (for player-level face masking)
        let speakerBbox: { x: number; y: number; w: number; h: number } | undefined;
        if (sceneDm === 'overlay' && project.headTrackingData) {
          const htData = project.headTrackingData as { frames?: HeadTrackingFrame[]; video?: { width: number; height: number } };
          const videoW = htData.video?.width || 1;
          const videoH = htData.video?.height || 1;
          const htFrames = (htData.frames || []).filter(
            (f) => f.timestamp_ms >= scene.startMs && f.timestamp_ms <= scene.endMs && f.face?.bbox,
          );
          if (htFrames.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const f of htFrames) {
              const b = f.face!.bbox!;
              minX = Math.min(minX, b.x / videoW);
              minY = Math.min(minY, b.y / videoH);
              maxX = Math.max(maxX, (b.x + b.width) / videoW);
              maxY = Math.max(maxY, (b.y + b.height) / videoH);
            }
            speakerBbox = {
              x: Math.max(0, minX),
              y: Math.max(0, minY),
              w: Math.min(1, maxX) - Math.max(0, minX),
              h: Math.min(1, maxY) - Math.max(0, minY),
            };
          }
        }

        // sourceSceneId: 1-indexed scene ID mapping to scenes/SceneN.tsx
        // Survives timeline splits so the agent can target the correct file
        const sourceSceneId = sceneIndex + 1;

        // Check if this scene has a video clip selected
        const sceneVideo = videoManifest.videos.find(v => v.sceneId === String(sourceSceneId));

        // Detect youtube-clip scenes for template-based rendering
        const isYouTubeClip = scene.type === 'youtube-clip';

        await tx.insert(timelineItems).values({
          trackId: visualsTrack.id,
          type: 'visual',
          startMs: scene.startMs,
          endMs: scene.endMs,
          data: {
            visualId,
            compositionId: isYouTubeClip
              ? `youtube-clip-scene${sourceSceneId}`
              : metadata.compositionId,
            bundleUrl: isYouTubeClip ? '' : bundleUrl,
            type: scene.type || 'visual',
            description: scene.description || 'AI-generated visual',
            width: canvasWidth,
            height: canvasHeight,
            fps: metadata.fps,
            effectiveWidth: sceneEffectiveW,
            effectiveHeight: sceneEffectiveH,
            displayMode: sceneDm,
            transition: scene.transition || undefined,
            sourceSceneId,
            ...(speakerBbox ? { speakerBbox } : {}),
            // Template-based rendering for youtube-clip scenes
            ...(isYouTubeClip ? {
              templateId: 'youtube-clip',
              templateProps: {
                clipUrl: '', // Filled by render.ts during export; preview uses videoUrl
                frame: (scene as any).frameStyle || 'none',
                trimStartSeconds: sceneVideo?.trimStart ?? 0,
                trimEndSeconds: sceneVideo?.trimEnd ?? 30,
                backgroundColor: '#000000',
                muted: true,
                volume: 0,
              },
            } : {}),
            // Video clip URLs for preview and export
            ...(sceneVideo ? {
              sourceVideoUrl: sceneVideo.sourceUrl,
              videoUrl: sceneVideo.proxyUrl || sceneVideo.sourceUrl || '',
              hasVideo: true,
            } : {}),
          },
        });
      }

      // Update job and project status
      await tx.update(jobs)
        .set({
          status: 'complete',
          progress: 100,
          completedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));

      // Persist layoutMode into project videoSettings so the editor/export
      // uses the same layout the user selected at generation time.
      const existingVideoSettings = (project.videoSettings as Record<string, unknown>) || {};
      const existingLayoutSettings = (existingVideoSettings.layoutSettings as Record<string, unknown>) || {};
      await tx.update(projects)
        .set({
          status: 'ready',
          outputKey: null,
          updatedAt: new Date(),
          videoSettings: {
            ...existingVideoSettings,
            layoutSettings: {
              ...existingLayoutSettings,
              mode: layoutMode,
            },
          },
        })
        .where(eq(projects.id, projectId));
    });

    // Only AFTER transaction succeeds — notify frontend
    await publishJobProgress(jobId, 100, 'Complete');
    await publishJobComplete(jobId, projectId);

    logger.info({ projectId, compositionId, model: llmModel }, 'Visual generation complete');

  } catch (error) {
    logger.error({ projectId, err: error }, 'Visual generation failed');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Best-effort DB update — use Promise.race with timeout to prevent hanging
    try {
      await Promise.race([
        db.transaction(async (tx) => {
          await tx.update(jobs)
            .set({ status: 'failed', error: errorMessage })
            .where(eq(jobs.id, jobId));

          await tx.update(projects)
            .set({ status: 'failed' })
            .where(eq(projects.id, projectId));
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB update timeout')), 10_000)),
      ]);
    } catch (dbErr) {
      logger.error({ jobId, err: dbErr }, 'Failed to update DB on job failure — BullMQ on(failed) handler will retry');
    }

    // Best-effort SSE notification
    try {
      await publishJobError(jobId, errorMessage);
    } catch (sseErr) {
      logger.error({ jobId, err: sseErr }, 'Failed to publish job error event');
    }

    throw error;
  } finally {
    clearInterval(lockExtender);
  }
}
