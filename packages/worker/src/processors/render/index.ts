import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { mkdir, rm, readFile, writeFile, copyFile } from 'fs/promises';
import { join, basename } from 'path';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import { db, projects, tracks, timelineItems, jobs, visuals } from '../../db/index.js';
import { downloadFile, uploadFile } from '../../services/minio.js';
import { publishJobProgress, publishJobComplete, publishJobError, setJobProjectId } from '../../services/redis.js';
import { config } from '../../config.js';
import { logger } from '../../logger.js';
import { renderVideo } from '@viona/renderer';
import { convertToSubtitles } from './subtitles.js';
import { resolveAvailableFontFamily, ensureFontsDir, downloadFont, getASSFontSizeMultiplier, SYSTEM_FONTS_DIR } from './fonts.js';
import {
  buildVideoCropFilter,
  downloadVideoClipsForRender,
  encodeVideoWithAudio,
  renderWithRemotion,
  renderWithPiPLayout,
  finalizeRemotionVideo,
  hasZoneBasedVisuals,
  muxAudioOnly,
} from './ffmpeg.js';
import { escapePathForFilter } from './types.js';
import type {
  RenderJobData,
  VideoCropSettings,
  DisplayModeSegment,
  SegmentationData,
  OverlayZone,
  LayoutSegment,
} from './types.js';

// Re-exports for public API
export type { RenderJobData } from './types.js';
export { convertToSubtitles, formatASSTime, hexToASSColor, getASSAlignment } from './subtitles.js';
export { escapePathForFilter } from './types.js';
export { buildVideoCropFilter } from './ffmpeg.js';
export { resolveAvailableFontFamily } from './fonts.js';

/**
 * Convert visual display data to frame-based LayoutSegments for Remotion composition.
 * Fills gaps between visual items with 'default' mode segments.
 */
function buildLayoutSegments(
  visualItems: Array<{ startMs: number; endMs: number; data: { displayMode: string; overlayOpacity?: number } }>,
  fps: number,
  totalDurationMs: number,
): LayoutSegment[] {
  const segments: LayoutSegment[] = [];
  let lastEndMs = 0;

  for (const item of visualItems) {
    if (item.startMs > lastEndMs + 50) {
      segments.push({
        startFrame: Math.round((lastEndMs / 1000) * fps),
        endFrame: Math.round((item.startMs / 1000) * fps),
        displayMode: 'default',
      });
    }

    let dm = item.data.displayMode || 'default';
    if (dm === 'pip') dm = 'default';

    segments.push({
      startFrame: Math.round((item.startMs / 1000) * fps),
      endFrame: Math.round((item.endMs / 1000) * fps),
      displayMode: dm as 'default' | 'fullscreen' | 'overlay',
      overlayOpacity: item.data.overlayOpacity,
    });

    lastEndMs = item.endMs;
  }

  if (lastEndMs < totalDurationMs - 50) {
    segments.push({
      startFrame: Math.round((lastEndMs / 1000) * fps),
      endFrame: Math.round((totalDurationMs / 1000) * fps),
      displayMode: 'default',
    });
  }

  return segments;
}

export async function processRenderJob(job: Job<RenderJobData>) {
  const { projectId, jobId, layoutSettings, visualDisplayData, videoClipData } = job.data;
  setJobProjectId(jobId, projectId);
  const workDir = join(tmpdir(), `viona-render-${nanoid()}`);

  try {
    await mkdir(workDir, { recursive: true });

    // Update job status
    await db.update(jobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 5, 'Loading project...');

    // Load project data
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const projectTracks = await db.query.tracks.findMany({
      where: eq(tracks.projectId, projectId),
    });

    // Get all timeline items for all tracks
    const allItems = [];
    for (const track of projectTracks) {
      const items = await db.select().from(timelineItems)
        .where(eq(timelineItems.trackId, track.id));
      allItems.push(...items);
    }

    // Extract display mode segments from visual timeline items.
    // When visualDisplayData is provided by the frontend, use it as the authoritative
    // source (matches the exact preview state). Otherwise, fall back to DB items.
    const visualItemsRaw = visualDisplayData
      ? visualDisplayData.map((v) => ({
          startMs: v.startMs,
          endMs: v.endMs,
          data: { displayMode: v.displayMode || 'pip', transition: v.transition, overlayOpacity: v.overlayOpacity, overlayZone: (v as any).overlayZone },
        }))
      : allItems
          .filter((item: any) => item.type === 'visual')
          .map((item: any) => ({
            startMs: item.startMs,
            endMs: item.endMs,
            data: { displayMode: (item.data as any)?.displayMode || 'pip', transition: (item.data as any)?.transition, overlayOpacity: (item.data as any)?.overlayOpacity, overlayZone: (item.data as any)?.overlayZone },
          }));

    const visualItems = visualItemsRaw.sort((a, b) => a.startMs - b.startMs);

    // Check for zone-based visuals (requires segmentation for full effect)
    const hasZonedVisuals = hasZoneBasedVisuals(visualItems as Array<{ data: Record<string, unknown> }>);

    // Get video segmentation data if available (from project video settings)
    const projectVideoSettings = (project as any).videoSettings as Record<string, unknown> | undefined;
    const segmentation = projectVideoSettings?.segmentation as SegmentationData | undefined;
    const segmentationReady = segmentation?.status === 'ready';

    // Zone-based rendering note:
    // When segmentation is ready and visuals use zones, the Remotion composition
    // handles the zone layering internally. For export, we continue using the
    // standard overlay pipeline since Remotion's output already includes
    // zone-positioned graphics. The FFmpeg filter chain composites this correctly.
    //
    // Future enhancement: Download masks and use alphamerge for true speaker
    // segmentation in FFmpeg export (bypassing Remotion for better quality).

    if (hasZonedVisuals) {
      logger.info({
        segmentationReady,
        hasZonedVisuals
      }, 'Export includes zone-based visuals');
    }

    const fullscreenVisualSegments: DisplayModeSegment[] = [];
    const overlaySegments: DisplayModeSegment[] = [];
    const isSplitLayout = layoutSettings?.mode === 'stacked';

    for (let i = 0; i < visualItems.length; i++) {
      const item = visualItems[i];
      const dm = item.data.displayMode;
      const transition = item.data.transition;

      // Determine if layout changes at enter/exit boundaries
      // For stacked mode, 'default' is the base stacked layout — only non-default modes need overlay layers
      const prevItem = i > 0 ? visualItems[i - 1] : null;
      const nextItem = i < visualItems.length - 1 ? visualItems[i + 1] : null;
      const prevDm = prevItem ? prevItem.data.displayMode : 'gap';
      const nextDm = nextItem ? nextItem.data.displayMode : 'gap';

      // Check if there's a gap between prev and current (gap = different layout)
      const hasPrevGap = !prevItem || prevItem.endMs < item.startMs - 50;
      const hasNextGap = !nextItem || nextItem.startMs > item.endMs + 50;
      const effectivePrevLayout = hasPrevGap ? 'gap' : prevDm;
      const effectiveNextLayout = hasNextGap ? 'gap' : nextDm;

      const layoutChangesOnEnter = dm !== effectivePrevLayout;
      const layoutChangesOnExit = dm !== effectiveNextLayout;

      // Only include transition durations when the layout actually changes
      const enterDurationMs = (layoutChangesOnEnter && transition?.enter?.type !== 'cut')
        ? (transition?.enter?.durationMs || 0) : 0;
      const exitDurationMs = (layoutChangesOnExit && transition?.exit?.type !== 'cut')
        ? (transition?.exit?.durationMs || 0) : 0;

      if (dm === 'fullscreen') {
        fullscreenVisualSegments.push({ startMs: item.startMs, endMs: item.endMs, enterDurationMs, exitDurationMs });
      } else if (dm === 'overlay') {
        overlaySegments.push({
          startMs: item.startMs, endMs: item.endMs, enterDurationMs, exitDurationMs,
          overlayOpacity: (item.data as any)?.overlayOpacity ?? 0.85,
        });
      }
    }

    // Gap segments: time ranges where no visual is active (speaker fullscreen)
    // Computed for ALL layout modes — in pip mode, gaps need the source video
    // overlaid fullscreen so the Remotion black frames don't show through.
    const gapSegments: DisplayModeSegment[] = [];
    {
      const durationMs = project.durationMs || 0;
      let cursor = 0;
      for (let i = 0; i < visualItems.length; i++) {
        const item = visualItems[i];
        if (item.startMs > cursor) {
          // For gap enter: check transition of the preceding visual item (its exit)
          const prevItem = i > 0 ? visualItems[i - 1] : null;
          const prevTransition = prevItem ? prevItem.data.transition : null;
          const prevDm = prevItem ? prevItem.data.displayMode : 'pip';
          const gapEnterDuration = (prevDm !== 'gap' && prevTransition?.exit?.type !== 'cut')
            ? (prevTransition?.exit?.durationMs || 0) : 0;

          // For gap exit: check transition of the next visual item (its enter)
          const nextTransition = item.data.transition;
          const nextDm = item.data.displayMode;
          const gapExitDuration = (nextDm !== 'gap' && nextTransition?.enter?.type !== 'cut')
            ? (nextTransition?.enter?.durationMs || 0) : 0;

          gapSegments.push({
            startMs: cursor, endMs: item.startMs,
            enterDurationMs: gapEnterDuration, exitDurationMs: gapExitDuration,
          });
        }
        cursor = Math.max(cursor, item.endMs);
      }
      if (cursor < durationMs) {
        const lastItem = visualItems[visualItems.length - 1];
        const lastTransition = lastItem ? lastItem.data.transition : null;
        const lastDm = lastItem ? lastItem.data.displayMode : 'pip';
        const enterDuration = (lastDm !== 'gap' && lastTransition?.exit?.type !== 'cut')
          ? (lastTransition?.exit?.durationMs || 0) : 0;
        gapSegments.push({ startMs: cursor, endMs: durationMs, enterDurationMs: enterDuration, exitDurationMs: 0 });
      }
    }

    logger.info({
      fullscreenVisualCount: fullscreenVisualSegments.length,
      overlayCount: overlaySegments.length,
      gapCount: gapSegments.length,
      visualItemCount: visualItems.length,
      hasZonedVisuals,
      segmentationReady,
      source: visualDisplayData ? 'frontend' : 'db',
    }, 'Extracted display mode segments');

    const isAudioProject = (job.data.projectType || project.projectType || 'video') === 'audio';

    // Download source media
    let videoPath: string | null = null;
    let audioOnlyPath: string | null = null;

    if (isAudioProject) {
      // Audio project: download audio file, no video
      if (!project.audioKey) {
        throw new Error('Audio project has no audio key');
      }
      await publishJobProgress(jobId, 10, 'Downloading audio...');
      const audioExt = project.audioKey.match(/\.[^.]+$/)?.[0] || '.mp3';
      audioOnlyPath = join(workDir, `input${audioExt}`);
      await downloadFile('uploads', project.audioKey, audioOnlyPath);
    } else {
      // Video project: download video
      await publishJobProgress(jobId, 10, 'Downloading video...');
      videoPath = join(workDir, 'input.mp4');
      await downloadFile('uploads', project.videoKey!, videoPath);
    }

    await publishJobProgress(jobId, 20, 'Preparing render...');

    // Convert timeline items to subtitle format
    const subtitles = convertToSubtitles(allItems);
    const outputPath = join(workDir, 'output.mp4');

    // Find the first subtitle with a non-empty style object.
    // All captions should share the same style, but handle edge cases where
    // early subtitles might lack a style (legacy data, initial creation).
    const firstStyle = ((): any => {
      for (const sub of subtitles) {
        const s = sub.style as any;
        if (s && typeof s === 'object' && Object.keys(s).length > 0) return s;
      }
      return {};
    })();

    // Debug: Log subtitle data to verify styles are being passed
    logger.info({
      subtitleCount: subtitles.length,
      firstSubtitleStyle: firstStyle,
      styleKeys: Object.keys(firstStyle),
      fontSize: firstStyle.fontSize,
      fontWeight: firstStyle.fontWeight,
      fontFamily: firstStyle.fontFamily,
      wordsPerPhrase: firstStyle.wordsPerPhrase,
      displayMode: firstStyle.displayMode,
      firstSubtitleText: subtitles[0]?.text,
      allItemTypes: allItems.map((i: any) => i.type),
    }, 'Converted subtitles with styles');

    // Ensure fonts are available for FFmpeg subtitle rendering
    const rawFontFamily = firstStyle.fontFamily || 'Inter';
    const fontsDir = await ensureFontsDir(rawFontFamily);
    // Resolve the font to one that's actually available (with fallback for commercial fonts)
    const resolvedFontFamily = resolveAvailableFontFamily(rawFontFamily);
    logger.info({ rawFontFamily, resolvedFontFamily, fontsDir }, 'Resolved font for export');

    // Compute ASS↔CSS font size correction multiplier from TTF metrics.
    // libass sizes glyphs differently than CSS, so without this multiplier
    // exported text appears ~60% smaller than the preview.
    const fontSizeMultiplier = await getASSFontSizeMultiplier(resolvedFontFamily, fontsDir);

    // Resolve fontFamily in all subtitle styles so both Remotion (headless Chrome)
    // and FFmpeg/ASS paths use an actual available Google Font name.
    // Without this, CSS strings like "Komika Axis, Impact, system-ui, sans-serif"
    // fall through to generic system fonts in headless Chrome since neither
    // "Komika Axis" nor "Impact" are loaded via @remotion/google-fonts.
    const uniqueFontsToDownload = new Set<string>();
    uniqueFontsToDownload.add(resolvedFontFamily);
    for (const subtitle of subtitles) {
      const style = subtitle.style as any;
      if (style?.fontFamily) {
        style.fontFamily = resolveAvailableFontFamily(style.fontFamily);
        uniqueFontsToDownload.add(style.fontFamily);
      }
      // Also resolve per-word font overrides
      if (subtitle.words) {
        for (const word of subtitle.words as any[]) {
          if (word.styleOverrides?.fontFamily) {
            word.styleOverrides.fontFamily = resolveAvailableFontFamily(word.styleOverrides.fontFamily);
            uniqueFontsToDownload.add(word.styleOverrides.fontFamily);
          }
        }
      }
    }

    // Download all unique fonts (not just the first subtitle's font)
    // Skip if using system fonts dir (Docker/production — fonts are pre-installed)
    const isSystemFonts = fontsDir === escapePathForFilter(SYSTEM_FONTS_DIR);
    if (!isSystemFonts) {
      for (const font of uniqueFontsToDownload) {
        if (font !== resolvedFontFamily) { // Primary font already downloaded by ensureFontsDir
          await downloadFont(font);
        }
      }
    }
    logger.info({ resolvedFontFamily, uniqueFonts: [...uniqueFontsToDownload], firstStyleAfter: (subtitles[0]?.style as any)?.fontFamily }, 'Resolved font families in all subtitles');

    // Check for enhanced audio (or source audio for audio projects)
    const audioItems = allItems.filter((item: any) => item.type === 'audio');
    const enhancedAudioItem = audioItems.find((item: any) => {
      const data = item.data as any;
      return data.isEnhanced && data.src;
    });

    // Download enhanced audio if available
    let enhancedAudioPath: string | null = null;
    if (enhancedAudioItem) {
      const audioData = enhancedAudioItem.data as any;
      // Extract the audio key from the src URL (e.g., /api/media/outputs/xxx/enhanced.m4a -> xxx/enhanced.m4a)
      const audioSrc = audioData.src as string;
      const audioKeyMatch = audioSrc.match(/\/media\/outputs\/(.+)$/);
      if (audioKeyMatch) {
        const audioKey = audioKeyMatch[1];
        enhancedAudioPath = join(workDir, 'enhanced.m4a');
        try {
          await downloadFile('outputs', audioKey, enhancedAudioPath);
          logger.info({ audioKey, enhancedAudioPath }, 'Downloaded enhanced audio');
        } catch (err) {
          logger.warn({ err, audioKey }, 'Failed to download enhanced audio, using original');
          enhancedAudioPath = null;
        }
      }
    }

    // For audio projects, use the uploaded audio file as the audio source
    if (isAudioProject && !enhancedAudioPath && audioOnlyPath) {
      enhancedAudioPath = audioOnlyPath;
    }

    // Check for visual compositions to render with Remotion SSR
    const projectVisual = await db.query.visuals.findFirst({
      where: eq(visuals.projectId, projectId),
    });

    // Render path with Remotion visuals - export exactly what user sees in preview
    if (projectVisual) {
      await publishJobProgress(jobId, 25, 'Downloading video clips...');

      // Log received video clip data for debugging
      logger.info({
        videoClipDataCount: videoClipData?.length ?? 0,
        videoClipData: videoClipData?.map(c => ({
          sceneId: c.sourceSceneId,
          url: c.sourceVideoUrl?.substring(0, 50) + '...',
          trim: { start: c.trimStartSeconds, end: c.trimEndSeconds },
        })),
      }, 'Received video clip data from editor');

      // Download YouTube video clips if the project has any
      // Pass videoClipData to override trim values with user-edited values from the editor
      const { clips: videoClipPaths, failed: failedClips, manifest: videoManifest } =
        await downloadVideoClipsForRender(projectId, workDir, videoClipData);

      if (failedClips.length > 0) {
        logger.warn({ failedScenes: failedClips },
          'Some video clips failed to download - scenes will render without video');
      }
      if (videoClipPaths.size > 0) {
        logger.info({ clipCount: videoClipPaths.size }, 'Video clips downloaded for render');
      }

      await publishJobProgress(jobId, 30, 'Rendering visuals with Remotion...');

      // Get bundle path from compositionId (hyphens for directory, underscores for composition ID)
      const bundleDirName = projectVisual.compositionId.replace(/_/g, '-');
      const bundlePath = join(config.remotion.bundleOutputDir, bundleDirName);

      const visualFps = projectVisual.fps || 30;
      const totalFrames = projectVisual.durationFrames || 0;
      const sceneTimestamps = (projectVisual.timestamps as Array<{ startMs: number; endMs: number; type: string; description?: string }>) || [];

      // Use the FULL canvas dimensions for the final composite, not the visual-only
      // dimensions. In split modes, visuals are rendered at half-canvas size but the
      // final output must be the full canvas (video + visuals side by side).
      const videoSettings = (project.videoSettings || {}) as Record<string, unknown>;
      const outputWidth = (videoSettings.canvasWidth as number) || 1080;
      const outputHeight = (videoSettings.canvasHeight as number) || 1920;

      // Build video crop/pan/scale settings from project to match preview
      const videoCrop: VideoCropSettings = {
        sourceWidth: project.sourceWidth || 1920,
        sourceHeight: project.sourceHeight || 1080,
        cropX: (videoSettings.cropX as number) ?? 50,
        cropY: (videoSettings.cropY as number) ?? 50,
        scale: (videoSettings.scale as number) ?? 1.0,
      };

      // Copy video clips to bundle's public/assets/clips/ directory so Remotion staticFile() can access them
      // Scenes use: staticFile('assets/clips/scene{N}-youtube-clip.mp4')
      if (videoClipPaths.size > 0) {
        const bundleClipsDir = join(bundlePath, 'public', 'assets', 'clips');
        await mkdir(bundleClipsDir, { recursive: true });

        for (const [sceneId, clipPath] of videoClipPaths) {
          const destPath = join(bundleClipsDir, basename(clipPath));
          await copyFile(clipPath, destPath);
          logger.info({ sceneId, destPath }, 'Copied video clip to bundle public/assets/clips/');
        }

        // Inject clipUrl into templateProps for youtube-clip template scenes.
        // generate-visuals.ts sets templateProps.clipUrl to '' with the expectation
        // that render.ts fills it during export. The staticFile()-compatible path
        // lets the youtube-clip template component resolve the downloaded clip.
        const youtubeClipItems = allItems.filter((item: any) => {
          const data = item.data as Record<string, unknown>;
          return data?.templateId === 'youtube-clip' && data?.sourceSceneId !== undefined;
        });

        for (const item of youtubeClipItems) {
          const data = item.data as Record<string, unknown>;
          const sceneId = String(data.sourceSceneId);
          if (videoClipPaths.has(sceneId)) {
            const clipFilename = basename(videoClipPaths.get(sceneId)!);
            const staticFilePath = `assets/clips/${clipFilename}`;
            const templateProps = (data.templateProps || {}) as Record<string, unknown>;
            const updatedData = {
              ...data,
              templateProps: {
                ...templateProps,
                clipUrl: staticFilePath,
              },
            };
            await db.update(timelineItems)
              .set({ data: updatedData })
              .where(eq(timelineItems.id, item.id));
            logger.info({ sceneId, clipUrl: staticFilePath, itemId: item.id },
              'Injected clipUrl into youtube-clip templateProps for export');
          }
        }
      }

      // Determine if we should use the full Remotion composition (stacked layout)
      const useFullComposition = layoutSettings?.mode === 'stacked';

      // Copy source video to bundle's public/ dir for FullComposition
      if (useFullComposition && videoPath) {
        const bundlePublicDir = join(bundlePath, 'public');
        await mkdir(bundlePublicDir, { recursive: true });
        const bundleSourceVideo = join(bundlePublicDir, 'source.mp4');
        await copyFile(videoPath, bundleSourceVideo);
        logger.info({ bundleSourceVideo }, 'Copied source video to bundle public/ for FullComposition');
      }

      // Build composition props for full composition mode
      let compositionPropsPath: string | undefined;
      if (useFullComposition) {
        const layoutSegments = buildLayoutSegments(visualItems, visualFps, project.durationMs || 60000);
        const compositionProps = {
          splitSettings: layoutSettings?.split || { position: 'visuals-first' as const, ratio: 50, gap: 0 },
          layoutSegments,
          videoCropSettings: videoCrop,
          sourceVideoFile: 'source.mp4',
        };
        compositionPropsPath = join(workDir, 'composition-props.json');
        await writeFile(compositionPropsPath, JSON.stringify(compositionProps), 'utf-8');
        logger.info({ compositionPropsPath, segmentCount: layoutSegments.length }, 'Wrote composition props for full composition render');
      }

      logger.info({
        projectId,
        compositionId: projectVisual.compositionId,
        bundlePath,
        hasEnhancedAudio: !!enhancedAudioPath,
        subtitleCount: subtitles.length,
        outputWidth,
        outputHeight,
        videoCrop,
        sceneCount: sceneTimestamps.length,
        videoClipCount: videoClipPaths.size,
        useFullComposition,
      }, 'Starting Remotion SSR render');

      // Step 1: Render Remotion composition exactly as shown in preview
      // Note: compositionId uses underscores (as registered in bundle), bundlePath uses hyphens
      const remotionTempPath = join(workDir, 'remotion_visuals.mp4');

      // Track last reported scene to avoid duplicate messages
      let lastReportedScene = -1;

      await renderWithRemotion({
        bundlePath,
        compositionId: projectVisual.compositionId,
        outputPath: remotionTempPath,
        propsPath: compositionPropsPath,
        onProgress: (progress) => {
          const jobProgress = 30 + Math.round(progress * 40);

          // Calculate current time in ms based on progress
          if (sceneTimestamps.length > 0 && totalFrames > 0) {
            const currentFrame = Math.floor(progress * totalFrames);
            const currentMs = (currentFrame / visualFps) * 1000;

            // Find the current scene
            let currentSceneIndex = 0;
            for (let i = 0; i < sceneTimestamps.length; i++) {
              if (currentMs >= sceneTimestamps[i].startMs && currentMs < sceneTimestamps[i].endMs) {
                currentSceneIndex = i;
                break;
              } else if (currentMs >= sceneTimestamps[i].endMs) {
                currentSceneIndex = i + 1;
              }
            }

            // Clamp to valid range
            currentSceneIndex = Math.min(currentSceneIndex, sceneTimestamps.length - 1);

            // Only report if scene changed or every 5% within same scene
            if (currentSceneIndex !== lastReportedScene) {
              lastReportedScene = currentSceneIndex;
              const scene = sceneTimestamps[currentSceneIndex];
              const sceneDesc = scene.description || scene.type || `Scene ${currentSceneIndex + 1}`;
              publishJobProgress(
                jobId,
                jobProgress,
                `Rendering scene ${currentSceneIndex + 1}/${sceneTimestamps.length}: ${sceneDesc}`
              );
            } else {
              publishJobProgress(jobId, jobProgress, `Rendering scene ${currentSceneIndex + 1}/${sceneTimestamps.length}...`);
            }
          } else {
            publishJobProgress(jobId, jobProgress, `Rendering: ${Math.round(progress * 100)}%`);
          }
        },
      });

      logger.info({ projectId, remotionTempPath }, 'Remotion render complete');

      await publishJobProgress(jobId, 75, 'Compositing video with audio and subtitles...');

      if (isAudioProject) {
        // Audio project with visuals: two-pass approach for exact caption matching
        // Pass 1: Composite Remotion visuals + audio WITHOUT subtitles
        const hasSubtitles = subtitles.length > 0;
        const compositedAudioPath = hasSubtitles ? join(workDir, 'composited_audio.mp4') : outputPath;

        await finalizeRemotionVideo({
          remotionVideoPath: remotionTempPath,
          audioPath: enhancedAudioPath,
          subtitles: [],  // No ASS subtitles — Remotion handles them in pass 2
          outputPath: compositedAudioPath,
          workDir,
          width: outputWidth,
          height: outputHeight,
          fontsDir,
          resolvedFontFamily,
          fontSizeMultiplier,
        });

        // Pass 2: Overlay subtitles with Remotion (same React engine as preview)
        if (hasSubtitles) {
          await publishJobProgress(jobId, 80, 'Rendering captions...');

          const firstSubStyle = firstStyle;
          const captionDurationMs = project.durationMs || Math.max(...subtitles.map(s => s.endMs)) + 1000;

          await renderVideo({
            videoUrl: compositedAudioPath,
            subtitles,
            outputPath,
            width: outputWidth,
            height: outputHeight,
            fps: 30,
            durationMs: captionDurationMs,
            defaultSubtitleStyle: {
              fontFamily: firstSubStyle.fontFamily || resolvedFontFamily || 'Inter',
              fontSize: firstSubStyle.fontSize || 56,
              fontWeight: firstSubStyle.fontWeight || 800,
              color: firstSubStyle.color || '#ffffff',
              activeColor: firstSubStyle.activeColor || '#ffff00',
              backgroundColor: firstSubStyle.backgroundColor || 'transparent',
              activeBackgroundColor: firstSubStyle.activeBackgroundColor || 'transparent',
              opacity: firstSubStyle.opacity ?? 1,
              lineHeight: firstSubStyle.lineHeight ?? 1.4,
              letterSpacing: firstSubStyle.letterSpacing ?? 0,
              textTransform: (firstSubStyle.textTransform || 'none') as 'none' | 'uppercase' | 'lowercase',
              stroke: firstSubStyle.stroke ?? null,
              displayMode: firstSubStyle.displayMode || 'phrase',
              wordsPerPhrase: firstSubStyle.wordsPerPhrase || 5,
              presetId: firstSubStyle.presetId,
              position: firstSubStyle.position || 'bottom',
              effects: firstSubStyle.effects,
              animation: firstSubStyle.animation,
              backgroundPadding: firstSubStyle.backgroundPadding,
              backgroundRadius: firstSubStyle.backgroundRadius,
            },
            onProgress: (progress) => {
              const jobProgress = 80 + Math.round((progress / 100) * 15);
              publishJobProgress(jobId, jobProgress, `Rendering captions: ${progress}%`);
            },
          });
        }
      } else if (useFullComposition) {
        // Full composition: Remotion already composited video + visuals with layout transitions.
        // Just mux audio track.
        const hasSubtitles = subtitles.length > 0;
        const compositedPath = hasSubtitles ? join(workDir, 'composited.mp4') : outputPath;

        await muxAudioOnly({
          videoPath: remotionTempPath,
          audioPath: enhancedAudioPath,
          sourceVideoPath: videoPath!,
          outputPath: compositedPath,
          onProgress: (progress) => {
            const jobProgress = 75 + Math.round(progress * 7);
            publishJobProgress(jobId, jobProgress, `Muxing audio: ${Math.round(progress * 100)}%`);
          },
        });

        // Pass 2: Overlay subtitles with Remotion (same React engine as preview)
        if (hasSubtitles) {
          await publishJobProgress(jobId, 83, 'Rendering captions...');

          const firstSubStyle = firstStyle;
          let captionDurationMs = project.durationMs || 0;
          if (!captionDurationMs) {
            captionDurationMs = Math.max(...subtitles.map(s => s.endMs)) + 1000;
          }

          await renderVideo({
            videoUrl: compositedPath,
            subtitles,
            outputPath,
            width: outputWidth,
            height: outputHeight,
            fps: 30,
            durationMs: captionDurationMs,
            defaultSubtitleStyle: {
              fontFamily: firstSubStyle.fontFamily || resolvedFontFamily || 'Inter',
              fontSize: firstSubStyle.fontSize || 56,
              fontWeight: firstSubStyle.fontWeight || 800,
              color: firstSubStyle.color || '#ffffff',
              activeColor: firstSubStyle.activeColor || '#ffff00',
              backgroundColor: firstSubStyle.backgroundColor || 'transparent',
              activeBackgroundColor: firstSubStyle.activeBackgroundColor || 'transparent',
              opacity: firstSubStyle.opacity ?? 1,
              lineHeight: firstSubStyle.lineHeight ?? 1.4,
              letterSpacing: firstSubStyle.letterSpacing ?? 0,
              textTransform: (firstSubStyle.textTransform || 'none') as 'none' | 'uppercase' | 'lowercase',
              stroke: firstSubStyle.stroke ?? null,
              displayMode: firstSubStyle.displayMode || 'phrase',
              wordsPerPhrase: firstSubStyle.wordsPerPhrase || 5,
              presetId: firstSubStyle.presetId,
              position: firstSubStyle.position || 'bottom',
              effects: firstSubStyle.effects,
              animation: firstSubStyle.animation,
              backgroundPadding: firstSubStyle.backgroundPadding,
              backgroundRadius: firstSubStyle.backgroundRadius,
            },
            onProgress: (progress) => {
              const jobProgress = 83 + Math.round((progress / 100) * 12);
              publishJobProgress(jobId, jobProgress, `Rendering captions: ${progress}%`);
            },
          });
        }
      } else {
        // PiP or other layout modes: use existing FFmpeg composite pipeline
        // Video project with visuals: two-pass approach for exact caption matching
        // Pass 1: Composite source video + Remotion visuals + audio WITHOUT subtitles
        const hasSubtitles = subtitles.length > 0;
        const compositedPath = hasSubtitles ? join(workDir, 'composited.mp4') : outputPath;

        await renderWithPiPLayout({
          sourceVideoPath: videoPath!,
          remotionVideoPath: remotionTempPath,
          audioPath: enhancedAudioPath,
          subtitles: [],  // No ASS subtitles — Remotion handles them in pass 2
          outputPath: compositedPath,
          workDir,
          width: outputWidth,
          height: outputHeight,
          layoutSettings,
          videoCrop,
          fullscreenVisualSegments,
          overlaySegments,
          gapSegments,
          fontsDir,
          resolvedFontFamily,
          fontSizeMultiplier,
          videoClipPaths,
          videoManifest: videoManifest ?? undefined,
          sceneTimestamps,
          onProgress: (progress) => {
            // Map compositing progress from 75% to 82%
            const jobProgress = 75 + Math.round(progress * 7);
            publishJobProgress(jobId, jobProgress, `Compositing: ${Math.round(progress * 100)}%`);
          },
        });

        // Pass 2: Overlay subtitles with Remotion (same React engine as preview)
        if (hasSubtitles) {
          await publishJobProgress(jobId, 83, 'Rendering captions...');

          const firstSubStyle = firstStyle;
          let captionDurationMs = project.durationMs || 0;
          if (!captionDurationMs) {
            captionDurationMs = Math.max(...subtitles.map(s => s.endMs)) + 1000;
          }

          await renderVideo({
            videoUrl: compositedPath,
            subtitles,
            outputPath,
            width: outputWidth,
            height: outputHeight,
            fps: 30,
            durationMs: captionDurationMs,
            defaultSubtitleStyle: {
              fontFamily: firstSubStyle.fontFamily || resolvedFontFamily || 'Inter',
              fontSize: firstSubStyle.fontSize || 56,
              fontWeight: firstSubStyle.fontWeight || 800,
              color: firstSubStyle.color || '#ffffff',
              activeColor: firstSubStyle.activeColor || '#ffff00',
              backgroundColor: firstSubStyle.backgroundColor || 'transparent',
              activeBackgroundColor: firstSubStyle.activeBackgroundColor || 'transparent',
              opacity: firstSubStyle.opacity ?? 1,
              lineHeight: firstSubStyle.lineHeight ?? 1.4,
              letterSpacing: firstSubStyle.letterSpacing ?? 0,
              textTransform: (firstSubStyle.textTransform || 'none') as 'none' | 'uppercase' | 'lowercase',
              stroke: firstSubStyle.stroke ?? null,
              displayMode: firstSubStyle.displayMode || 'phrase',
              wordsPerPhrase: firstSubStyle.wordsPerPhrase || 5,
              presetId: firstSubStyle.presetId,
              position: firstSubStyle.position || 'bottom',
              effects: firstSubStyle.effects,
              animation: firstSubStyle.animation,
              backgroundPadding: firstSubStyle.backgroundPadding,
              backgroundRadius: firstSubStyle.backgroundRadius,
            },
            onProgress: (progress) => {
              const jobProgress = 83 + Math.round((progress / 100) * 12);
              publishJobProgress(jobId, jobProgress, `Rendering captions: ${progress}%`);
            },
          });
        }
      }

      logger.info({ projectId, outputPath }, 'Export complete with full composite');
    } else if (isAudioProject) {
      // Audio project without visuals: black canvas + subtitles + audio
      // Use Remotion for subtitles to match preview exactly
      await publishJobProgress(jobId, 30, 'Rendering audio project...');

      const videoSettings = (project.videoSettings as any) || {};
      const canvasWidth = videoSettings.canvasWidth || 1080;
      const canvasHeight = videoSettings.canvasHeight || 1920;
      const durationMs = project.durationMs || (subtitles.length > 0 ? Math.max(...subtitles.map(s => s.endMs)) + 1000 : 10000);

      if (subtitles.length > 0) {
        // Step 1: Create black canvas video (no subtitles yet)
        const { spawn: spawnProcess } = await import('child_process');

        const durationSec = (durationMs / 1000).toFixed(3);
        const blackCanvasPath = enhancedAudioPath ? join(workDir, 'black_canvas.mp4') : join(workDir, 'black_canvas_temp.mp4');

        // Generate black canvas with optional audio
        const canvasArgs = [
          '-f', 'lavfi',
          '-i', `color=c=black:s=${canvasWidth}x${canvasHeight}:d=${durationSec}:r=30`,
        ];

        if (enhancedAudioPath) {
          const audioFilename = basename(enhancedAudioPath);
          canvasArgs.push('-i', audioFilename);
        }

        canvasArgs.push('-y');
        canvasArgs.push('-c:v', 'libx264', '-preset', 'faster', '-crf', '18', '-threads', '4');

        if (enhancedAudioPath) {
          canvasArgs.push('-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-shortest');
        }

        canvasArgs.push(blackCanvasPath);

        await new Promise<void>((resolve, reject) => {
          const proc = spawnProcess('ffmpeg', canvasArgs, { cwd: workDir, stdio: ['ignore', 'pipe', 'pipe'] });
          let stderr = '';
          proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
          proc.on('close', (code: number | null) => {
            if (code === 0) resolve();
            else reject(new Error(`FFmpeg (black canvas) exited with code ${code}: ${stderr.slice(-500)}`));
          });
          proc.on('error', (err: Error) => reject(new Error(`Failed to spawn ffmpeg: ${err.message}`)));
        });

        // Step 2: Overlay subtitles with Remotion (same React engine as preview)
        await publishJobProgress(jobId, 50, 'Rendering captions...');

        const firstSubStyle = firstStyle;
        await renderVideo({
          videoUrl: blackCanvasPath,
          subtitles,
          outputPath,
          width: canvasWidth,
          height: canvasHeight,
          fps: 30,
          durationMs,
          defaultSubtitleStyle: {
            fontFamily: firstSubStyle.fontFamily || resolvedFontFamily || 'Inter',
            fontSize: firstSubStyle.fontSize || 56,
            fontWeight: firstSubStyle.fontWeight || 800,
            color: firstSubStyle.color || '#ffffff',
            activeColor: firstSubStyle.activeColor || '#ffff00',
            backgroundColor: firstSubStyle.backgroundColor || 'transparent',
            activeBackgroundColor: firstSubStyle.activeBackgroundColor || 'transparent',
            opacity: firstSubStyle.opacity ?? 1,
            lineHeight: firstSubStyle.lineHeight ?? 1.4,
            letterSpacing: firstSubStyle.letterSpacing ?? 0,
            textTransform: (firstSubStyle.textTransform || 'none') as 'none' | 'uppercase' | 'lowercase',
            stroke: firstSubStyle.stroke ?? null,
            displayMode: firstSubStyle.displayMode || 'phrase',
            wordsPerPhrase: firstSubStyle.wordsPerPhrase || 5,
            presetId: firstSubStyle.presetId,
            position: firstSubStyle.position || 'bottom',
            effects: firstSubStyle.effects,
            animation: firstSubStyle.animation,
            backgroundPadding: firstSubStyle.backgroundPadding,
            backgroundRadius: firstSubStyle.backgroundRadius,
          },
          onProgress: (progress) => {
            const jobProgress = 50 + Math.round((progress / 100) * 40);
            publishJobProgress(jobId, jobProgress, `Rendering captions: ${progress}%`);
          },
        });
      } else if (enhancedAudioPath) {
        // No subtitles, just audio: create black canvas + audio
        const { spawn: spawnProcess } = await import('child_process');

        const durationSec = (durationMs / 1000).toFixed(3);
        const audioFilename = basename(enhancedAudioPath);
        const args = [
          '-f', 'lavfi',
          '-i', `color=c=black:s=${canvasWidth}x${canvasHeight}:d=${durationSec}:r=30`,
          '-i', audioFilename,
          '-y',
          '-c:v', 'libx264', '-preset', 'faster', '-crf', '18',
          '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-shortest',
          outputPath,
        ];

        await new Promise<void>((resolve, reject) => {
          const proc = spawnProcess('ffmpeg', args, { cwd: workDir, stdio: ['ignore', 'pipe', 'pipe'] });
          let stderr = '';
          proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
          proc.on('close', (code: number | null) => {
            if (code === 0) resolve();
            else reject(new Error(`FFmpeg (audio render) exited with code ${code}: ${stderr.slice(-500)}`));
          });
          proc.on('error', (err: Error) => reject(new Error(`Failed to spawn ffmpeg: ${err.message}`)));
        });
      }
    } else {
      // No visuals - render subtitles with Remotion (browser-based for proper Google Fonts)
      await publishJobProgress(jobId, 30, 'Rendering video...');

      logger.info({
        hasEnhancedAudio: !!enhancedAudioPath,
        subtitleCount: subtitles.length,
      }, 'No visuals found, rendering with Remotion for proper font support');

      if (subtitles.length > 0) {
        const videoSettings = (project.videoSettings as any) || {};
        const canvasWidth = videoSettings.canvasWidth || 1080;
        const canvasHeight = videoSettings.canvasHeight || 1920;

        // Build video crop/pan/scale settings to match preview
        const noVisCrop: VideoCropSettings = {
          sourceWidth: project.sourceWidth || 1920,
          sourceHeight: project.sourceHeight || 1080,
          cropX: videoSettings.cropX ?? 50,
          cropY: videoSettings.cropY ?? 50,
          scale: videoSettings.scale ?? 1.0,
        };

        // Get video duration for Remotion rendering
        let durationMs = 0;
        try {
          const { execSync } = await import('child_process');
          const ffprobeOutput = execSync(
            `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
            { encoding: 'utf-8' }
          );
          durationMs = Math.round(parseFloat(ffprobeOutput.trim()) * 1000);
        } catch (err) {
          logger.warn({ err }, 'Could not get video duration, estimating from subtitles');
          durationMs = Math.max(...subtitles.map(s => s.endMs)) + 1000;
        }

        // Use Remotion browser-based rendering for subtitles
        // This renders subtitles as React components in headless Chrome
        // with Google Fonts loaded via @remotion/google-fonts (same as preview)
        const remotionOutputPath = enhancedAudioPath ? join(workDir, 'subtitled.mp4') : outputPath;

        logger.info({
          canvasWidth,
          canvasHeight,
          durationMs,
          subtitleCount: subtitles.length,
          presetId: firstStyle.presetId,
          displayMode: firstStyle.displayMode,
          renderPath: 'no-visuals-remotion-v2',
        }, 'Rendering subtitles with Remotion (browser-based fonts, emotional line-breaking)');

        // Build default style from the first subtitle's actual style (user's chosen font/colors)
        // so that even subtitles without explicit style get the user's settings.
        // Use the robust firstStyle from earlier (finds first subtitle WITH a style).
        const firstSubStyle = firstStyle;
        await renderVideo({
          videoUrl: videoPath!,
          subtitles,
          outputPath: remotionOutputPath,
          width: canvasWidth,
          height: canvasHeight,
          fps: 30,
          durationMs,
          videoCrop: noVisCrop,
          // Use the user's actual style as default, falling back to safe defaults.
          // This ensures even subtitles without an explicit style get the user's
          // chosen font, colors, display mode, and position.
          defaultSubtitleStyle: {
            fontFamily: firstSubStyle.fontFamily || resolvedFontFamily || 'Inter',
            fontSize: firstSubStyle.fontSize || 56,
            fontWeight: firstSubStyle.fontWeight || 800,
            color: firstSubStyle.color || '#ffffff',
            activeColor: firstSubStyle.activeColor || '#ffff00',
            backgroundColor: firstSubStyle.backgroundColor || 'transparent',
            activeBackgroundColor: firstSubStyle.activeBackgroundColor || 'transparent',
            opacity: firstSubStyle.opacity ?? 1,
            lineHeight: firstSubStyle.lineHeight ?? 1.4,
            letterSpacing: firstSubStyle.letterSpacing ?? 0,
            textTransform: (firstSubStyle.textTransform || 'none') as 'none' | 'uppercase' | 'lowercase',
            stroke: firstSubStyle.stroke ?? null,
            displayMode: firstSubStyle.displayMode || 'phrase',
            wordsPerPhrase: firstSubStyle.wordsPerPhrase || 5,
            presetId: firstSubStyle.presetId,
            position: firstSubStyle.position || 'bottom',
            effects: firstSubStyle.effects,
            animation: firstSubStyle.animation,
            backgroundPadding: firstSubStyle.backgroundPadding,
            backgroundRadius: firstSubStyle.backgroundRadius,
          },
          onProgress: (progress) => {
            const jobProgress = 30 + Math.round((progress / 100) * 55);
            publishJobProgress(jobId, jobProgress, `Rendering subtitles: ${progress}%`);
          },
        });

        // If enhanced audio, mux it with the rendered video
        if (enhancedAudioPath) {
          await encodeVideoWithAudio(remotionOutputPath, enhancedAudioPath, outputPath);
        }
      } else {
        // No subtitles — check if crop/pan/scale needs to be applied
        const videoSettings = (project.videoSettings as any) || {};
        const needsCrop = (videoSettings.cropX != null && videoSettings.cropX !== 50) ||
                          (videoSettings.cropY != null && videoSettings.cropY !== 50) ||
                          (videoSettings.scale != null && videoSettings.scale !== 1.0);

        if (needsCrop) {
          // Re-encode with crop/pan/scale to match preview
          const cw = videoSettings.canvasWidth || 1080;
          const ch = videoSettings.canvasHeight || 1920;
          const cropFilter = buildVideoCropFilter({
            sourceWidth: project.sourceWidth || 1920,
            sourceHeight: project.sourceHeight || 1080,
            cropX: videoSettings.cropX ?? 50,
            cropY: videoSettings.cropY ?? 50,
            scale: videoSettings.scale ?? 1.0,
          }, cw, ch);

          const { spawn: sp } = await import('child_process');

          const cropWorkDir = join(workDir, 'crop');
          await mkdir(cropWorkDir, { recursive: true });
          const localInput = join(cropWorkDir, basename(videoPath!));
          await copyFile(videoPath!, localInput);
          const localOutput = basename(outputPath);

          const cropArgs = [
            '-i', basename(localInput),
            ...(enhancedAudioPath ? ['-i', basename(enhancedAudioPath)] : []),
            '-y',
            '-vf', cropFilter,
            '-c:v', 'libx264', '-preset', 'faster', '-crf', '18', '-threads', '4',
            ...(enhancedAudioPath
              ? ['-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-shortest']
              : ['-map', '0:v', '-map', '0:a?', '-c:a', 'aac']),
            localOutput,
          ];

          await new Promise<void>((resolve, reject) => {
            const proc = sp('ffmpeg', cropArgs, { cwd: cropWorkDir, stdio: ['ignore', 'pipe', 'pipe'] });
            let stderr = '';
            proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
            proc.on('close', (code: number | null) => {
              if (code === 0) resolve();
              else reject(new Error(`FFmpeg (crop) exited with code ${code}: ${stderr.slice(-500)}`));
            });
            proc.on('error', (err: Error) => reject(new Error(`Failed to spawn ffmpeg: ${err.message}`)));
          });

          // Move output to final path
          await copyFile(join(cropWorkDir, localOutput), outputPath);
        } else {
          await encodeVideoWithAudio(videoPath!, enhancedAudioPath, outputPath);
        }
      }
    }

    await publishJobProgress(jobId, 85, 'Uploading result...');

    // Upload output
    const outputKey = `${nanoid()}/output.mp4`;
    await uploadFile('outputs', outputKey, outputPath);

    // Update project
    await db.update(projects)
      .set({
        status: 'complete',
        outputKey,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    await db.update(jobs)
      .set({ status: 'complete', progress: 100, completedAt: new Date() })
      .where(eq(jobs.id, jobId));

    await publishJobProgress(jobId, 100, 'Complete');
    await publishJobComplete(jobId, projectId);

    logger.info({ projectId }, 'Render complete');

  } catch (error) {
    logger.error({ projectId, err: error }, 'Render failed');

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await db.update(jobs)
      .set({ status: 'failed', error: errorMessage })
      .where(eq(jobs.id, jobId));

    await db.update(projects)
      .set({ status: 'failed' })
      .where(eq(projects.id, projectId));

    await publishJobError(jobId, errorMessage);

    throw error;
  } finally {
    try {
      await rm(workDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
