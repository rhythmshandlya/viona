import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { mkdir, rm, access, constants, readFile, writeFile, readdir, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { nanoid } from 'nanoid';
import { db, projects, tracks, timelineItems, jobs, visuals } from '../db/index.js';
import { downloadFile, uploadFile, listObjects } from '../services/minio.js';
import { publishJobProgress, publishJobComplete, publishJobError } from '../services/redis.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { renderVideo, SubtitleItem, SubtitleStyle } from '@reelify/renderer';
import { renderMedia, selectComposition, getCompositions } from '@remotion/renderer';
import { bundle } from '@remotion/bundler';

// Font directory for FFmpeg's libass subtitle filter.
// In Docker (production), fonts are installed in /usr/share/fonts.
// Locally, we download and cache Google Fonts to a local directory.
const SYSTEM_FONTS_DIR = '/usr/share/fonts';
const LOCAL_FONTS_CACHE = join(tmpdir(), 'clippify-fonts');

/**
 * Escape a filesystem path for use inside FFmpeg filter strings.
 * FFmpeg's filter parser treats backslashes as escape characters, so on Windows
 * `C:\Users\...` gets mangled. Converting to forward slashes fixes it — FFmpeg
 * on Windows accepts forward slashes in filter paths.
 */
function escapePathForFilter(p: string): string {
  return p.replace(/\\/g, '/');
}

// Google Fonts CSS API query strings for each font.
// We fetch the CSS with a non-browser User-Agent to get TTF URLs from fonts.gstatic.com,
// then download the individual TTF files directly.
// NOTE: The old fonts.google.com/download?family=X URLs are BROKEN — they return HTML
// instead of ZIP files. This CSS API approach is the reliable alternative.
const GOOGLE_FONT_URLS: Record<string, string> = {
  'Inter': 'Inter:wght@400;500;600;700;800;900',
  'Montserrat': 'Montserrat:wght@300;400;500;600;700;800;900',
  'Poppins': 'Poppins:wght@400;500;600;700;800;900',
  'Anton': 'Anton',
  'Nunito': 'Nunito:wght@400;600;700;800;900',
  'Playfair Display': 'Playfair+Display:wght@400;500;600;700;800;900',
  'JetBrains Mono': 'JetBrains+Mono:wght@400;500;600;700;800',
  'Rubik': 'Rubik:wght@400;500;600;700;800;900',
  'Lora': 'Lora:wght@400;500;600;700',
  'Merriweather': 'Merriweather:wght@400;700;900',
  'Bebas Neue': 'Bebas+Neue',
  'Space Grotesk': 'Space+Grotesk:wght@400;500;600;700',
  'DM Sans': 'DM+Sans:wght@400;500;600;700',
  'Outfit': 'Outfit:wght@400;500;600;700;800',
  'Fira Code': 'Fira+Code:wght@400;500;600;700',
  'Source Sans 3': 'Source+Sans+3:wght@400;600;700',
  'Roboto': 'Roboto:wght@400;500;700',
  'Oswald': 'Oswald:wght@400;500;600;700',
  'Lato': 'Lato:wght@400;700;900',
  'Open Sans': 'Open+Sans:wght@400;500;600;700;800',
  'EB Garamond': 'EB+Garamond:wght@400;500;600;700;800',
};

// Fallback font mapping for fonts not available in Google Fonts.
// Maps unavailable font → closest available alternative.
const FONT_FALLBACKS: Record<string, string> = {
  'Komika Axis': 'Anton',           // MrBeast preset — bold, condensed
  'TT Fors': 'Inter',               // Ali Abdaal preset — clean sans-serif
  'Helvetica Neue': 'Inter',        // Netflix preset — clean sans-serif
  'Helvetica': 'Inter',
  'Arial': 'Inter',
  'SF Pro Display': 'Inter',        // Apple preset — clean sans-serif
  'Google Sans': 'Roboto',          // Google Material preset
  'Georgia': 'EB Garamond',         // Serif fallback (similar look)
  'Times New Roman': 'Merriweather', // Serif fallback
  'Impact': 'Anton',                // Bold condensed fallback
  'Consolas': 'JetBrains Mono',     // Monospace fallback
  'system-ui': 'Inter',
  'sans-serif': 'Inter',
  'serif': 'Merriweather',
  'monospace': 'JetBrains Mono',
};

// Track which fonts have been downloaded in this process
const downloadedFonts = new Set<string>();

/**
 * Resolve a font family name to one that's actually available for FFmpeg.
 * Walks the comma-separated list and returns the first available font,
 * checking Google Fonts registry and fallback map.
 */
function resolveAvailableFontFamily(fontFamilyCSS: string): string {
  const families = fontFamilyCSS.split(',').map(f => f.trim());

  for (const family of families) {
    // Available in Google Fonts → use it directly
    if (GOOGLE_FONT_URLS[family]) return family;
    // Has a fallback mapping → use the fallback
    if (FONT_FALLBACKS[family]) return FONT_FALLBACKS[family];
  }

  // Default fallback
  return 'Inter';
}

/**
 * Download a font from Google Fonts to the local cache directory.
 * Uses the Google Fonts CSS API to get direct TTF URLs from fonts.gstatic.com.
 * The old fonts.google.com/download?family=X URLs no longer return ZIP files.
 */
async function downloadFont(fontFamily: string): Promise<boolean> {
  if (downloadedFonts.has(fontFamily)) return true;

  const cssQuery = GOOGLE_FONT_URLS[fontFamily];
  if (!cssQuery) {
    logger.warn({ fontFamily }, 'No Google Fonts CSS query for font');
    return false;
  }

  // Check if already cached (marker file)
  const markerFile = join(LOCAL_FONTS_CACHE, `.downloaded-${fontFamily.replace(/\s+/g, '-').toLowerCase()}`);
  try {
    await access(markerFile, constants.R_OK);
    downloadedFonts.add(fontFamily);
    return true;
  } catch {
    // Not cached yet
  }

  logger.info({ fontFamily, cssQuery }, 'Downloading font for export via CSS API');

  try {
    const { execSync } = await import('child_process');

    // Step 1: Fetch CSS from Google Fonts API — use non-browser User-Agent to get TTF URLs
    const cssUrl = `https://fonts.googleapis.com/css2?family=${cssQuery}&display=swap`;
    const css = execSync(
      `curl -sL "${cssUrl}" -H "User-Agent: wget/1.0"`,
      { timeout: 15000, encoding: 'utf-8' }
    );

    // Step 2: Extract all TTF URLs from the CSS
    const ttfUrls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/g)]
      .map(m => m[1]);

    if (ttfUrls.length === 0) {
      logger.warn({ fontFamily, css: css.slice(0, 200) }, 'No TTF URLs found in Google Fonts CSS');
      return false;
    }

    // Step 3: Download each TTF file
    let downloadedCount = 0;
    for (const ttfUrl of ttfUrls) {
      const filename = `${fontFamily.replace(/\s+/g, '-')}-${downloadedCount}.ttf`;
      const ttfPath = join(LOCAL_FONTS_CACHE, filename);
      try {
        execSync(`curl -sL "${ttfUrl}" -o "${ttfPath}"`, { timeout: 15000 });
        downloadedCount++;
      } catch (err) {
        logger.warn({ fontFamily, ttfUrl, err }, 'Failed to download individual TTF file');
      }
    }

    if (downloadedCount === 0) {
      logger.warn({ fontFamily }, 'Failed to download any TTF files');
      return false;
    }

    // Create marker file so we don't re-download
    await writeFile(markerFile, fontFamily, 'utf-8');
    downloadedFonts.add(fontFamily);

    logger.info({ fontFamily, downloadedCount, totalUrls: ttfUrls.length }, 'Font downloaded and cached');
    return true;
  } catch (err) {
    logger.warn({ fontFamily, err }, 'Failed to download font');
    return false;
  }
}

/**
 * Ensure fonts are available for FFmpeg subtitle rendering.
 * Returns the fontsdir path to use in FFmpeg's subtitles filter.
 */
async function ensureFontsDir(fontFamilyCSS: string): Promise<string> {
  // In Docker/production, fonts are pre-installed in /usr/share/fonts
  try {
    await access(SYSTEM_FONTS_DIR, constants.R_OK);
    logger.info('Using system fonts directory (Docker/production)');
    return escapePathForFilter(SYSTEM_FONTS_DIR);
  } catch {
    // Not in Docker — download fonts locally
  }

  // Create local font cache directory
  await mkdir(LOCAL_FONTS_CACHE, { recursive: true });

  // Clear stale marker files from the old broken download mechanism
  // (old code used fonts.google.com/download URLs that returned HTML, not ZIPs)
  try {
    const entries = await readdir(LOCAL_FONTS_CACHE);
    const markerFiles = entries.filter((f) => f.startsWith('.downloaded-'));

    if (markerFiles.length > 0) {
      // Check if small/empty markers (< 100 bytes) — means download was broken
      let hasStaleMarkers = false;
      for (const marker of markerFiles) {
        try {
          const s = await stat(join(LOCAL_FONTS_CACHE, marker));
          if (s.size < 100) { hasStaleMarkers = true; break; }
        } catch { /* skip */ }
      }

      if (hasStaleMarkers) {
        // Check if any actual TTF files exist — if not, the markers are stale
        const hasTtf = entries.some((f) => f.endsWith('.ttf'));
        if (!hasTtf) {
          for (const marker of markerFiles) {
            await unlink(join(LOCAL_FONTS_CACHE, marker)).catch(() => {});
          }
          downloadedFonts.clear();
          logger.info('Cleared stale font markers (no TTF files found)');
        }
      }
    }
  } catch {
    // Non-critical cleanup
  }

  // Resolve which font we actually need
  const resolvedFont = resolveAvailableFontFamily(fontFamilyCSS);
  logger.info({ requestedFont: fontFamilyCSS, resolvedFont }, 'Resolved font for export');

  // Download the resolved font
  await downloadFont(resolvedFont);

  // Also download Inter as ultimate fallback
  if (resolvedFont !== 'Inter') {
    await downloadFont('Inter');
  }

  // Update fontconfig cache so libass can find the fonts (Linux/Docker only)
  try {
    const { execFile } = await import('child_process');
    await new Promise<void>((resolve) => {
      execFile('fc-cache', ['-f', LOCAL_FONTS_CACHE], { timeout: 10000 }, () => resolve());
    });
  } catch {
    // fc-cache not available on Windows/macOS — fonts still work via fontsdir
  }

  return escapePathForFilter(LOCAL_FONTS_CACHE);
}

export interface LayoutSettings {
  mode: 'pip' | 'split-horizontal' | 'split-vertical';
  pip: {
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    offsetX: number;
    offsetY: number;
    size: 'small' | 'medium' | 'large' | 'custom';
    customSize: number;
    shape: 'square' | 'circle' | 'rounded';
    borderRadius: number;
    borderWidth: number;
    borderColor: string;
    shadowEnabled: boolean;
    shadowColor: string;
    shadowBlur: number;
    opacity: number;
  };
  split: {
    position: 'visuals-first' | 'video-first';
    ratio: number;
    gap: number;
  };
}

const PIP_SIZE_MAP: Record<string, number> = {
  small: 18,
  medium: 25,
  large: 35,
  custom: 25,
};

export interface FullscreenSegment {
  startMs: number;
  endMs: number;
}

export interface RenderJobData {
  projectId: string;
  jobId: string;
  layoutSettings?: LayoutSettings;
  fullscreenSegments?: FullscreenSegment[];
}

export async function processRenderJob(job: Job<RenderJobData>) {
  const { projectId, jobId, layoutSettings, fullscreenSegments } = job.data;
  const workDir = join(tmpdir(), `reelify-render-${nanoid()}`);

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

    await publishJobProgress(jobId, 10, 'Downloading video...');

    // Download original video
    const videoPath = join(workDir, 'input.mp4');
    await downloadFile('uploads', project.videoKey!, videoPath);

    await publishJobProgress(jobId, 20, 'Preparing render...');

    // Convert timeline items to subtitle format
    const subtitles = convertToSubtitles(allItems);
    const outputPath = join(workDir, 'output.mp4');

    // Debug: Log subtitle data to verify styles are being passed
    logger.info({
      subtitleCount: subtitles.length,
      firstSubtitleStyle: subtitles[0]?.style,
      firstSubtitleText: subtitles[0]?.text,
      allItemTypes: allItems.map((i: any) => i.type),
    }, 'Converted subtitles with styles');

    // Ensure fonts are available for FFmpeg subtitle rendering
    const firstStyle = (subtitles[0]?.style as any) || {};
    const rawFontFamily = firstStyle.fontFamily || 'Inter';
    const fontsDir = await ensureFontsDir(rawFontFamily);
    // Resolve the font to one that's actually available (with fallback for commercial fonts)
    const resolvedFontFamily = resolveAvailableFontFamily(rawFontFamily);
    logger.info({ rawFontFamily, resolvedFontFamily, fontsDir }, 'Resolved font for export');

    // Resolve fontFamily in all subtitle styles so both Remotion (headless Chrome)
    // and FFmpeg/ASS paths use an actual available Google Font name.
    // Without this, CSS strings like "Komika Axis, Impact, system-ui, sans-serif"
    // fall through to generic system fonts in headless Chrome since neither
    // "Komika Axis" nor "Impact" are loaded via @remotion/google-fonts.
    for (const subtitle of subtitles) {
      const style = subtitle.style as any;
      if (style?.fontFamily) {
        style.fontFamily = resolveAvailableFontFamily(style.fontFamily);
      }
      // Also resolve per-word font overrides
      if (subtitle.words) {
        for (const word of subtitle.words as any[]) {
          if (word.styleOverrides?.fontFamily) {
            word.styleOverrides.fontFamily = resolveAvailableFontFamily(word.styleOverrides.fontFamily);
          }
        }
      }
    }
    logger.info({ resolvedFontFamily, firstStyleAfter: (subtitles[0]?.style as any)?.fontFamily }, 'Resolved font families in all subtitles');

    // Check for enhanced audio
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

    // Check for visual compositions to render with Remotion SSR
    const projectVisual = await db.query.visuals.findFirst({
      where: eq(visuals.projectId, projectId),
    });

    // Render path with Remotion visuals - export exactly what user sees in preview
    if (projectVisual) {
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

      logger.info({
        projectId,
        compositionId: projectVisual.compositionId,
        bundlePath,
        hasEnhancedAudio: !!enhancedAudioPath,
        subtitleCount: subtitles.length,
        outputWidth,
        outputHeight,
        sceneCount: sceneTimestamps.length,
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

      // Step 2: Composite source video + Remotion visuals + audio + subtitles
      // Use layoutSettings from export request for exact preview match
      await renderWithPiPLayout({
        sourceVideoPath: videoPath,
        remotionVideoPath: remotionTempPath,
        audioPath: enhancedAudioPath,
        subtitles,
        outputPath,
        workDir,
        width: outputWidth,
        height: outputHeight,
        layoutSettings,
        fullscreenSegments,
        fontsDir,
        resolvedFontFamily,
        onProgress: (progress) => {
          // Map compositing progress from 75% to 85%
          const jobProgress = 75 + Math.round(progress * 10);
          publishJobProgress(jobId, jobProgress, `Compositing: ${Math.round(progress * 100)}%`);
        },
      });

      logger.info({ projectId, outputPath }, 'Export complete with full composite');
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
        }, 'Rendering subtitles with Remotion (browser-based fonts)');

        await renderVideo({
          videoUrl: videoPath,
          subtitles,
          outputPath: remotionOutputPath,
          width: canvasWidth,
          height: canvasHeight,
          fps: 30,
          durationMs,
          // Pass default style matching preview defaults so fallback renders correctly
          defaultSubtitleStyle: {
            fontFamily: 'Inter',
            fontSize: 56,
            fontWeight: 800,
            color: '#ffffff',
            activeColor: '#ffff00',
            backgroundColor: 'transparent',
            activeBackgroundColor: 'transparent',
            opacity: 1,
            lineHeight: 1.4,
            letterSpacing: 0,
            textTransform: 'none' as const,
            stroke: null,
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
        await encodeVideoWithAudio(videoPath, enhancedAudioPath, outputPath);
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

function convertToSubtitles(items: any[]): SubtitleItem[] {
  // Frontend uses 'caption' type, not 'subtitle'
  return items
    .filter(item => item.type === 'caption' || item.type === 'subtitle')
    .map(item => {
      const data = item.data as any;
      return {
        id: item.id,
        startMs: item.startMs,
        endMs: item.endMs,
        text: data.text || '',
        words: data.words || [{ text: data.text || '', startMs: item.startMs, endMs: item.endMs }],
        style: data.style,
      };
    });
}

async function copyVideo(inputPath: string, outputPath: string): Promise<void> {
  const { spawn } = await import('child_process');
  const { dirname, basename } = await import('path');

  // Use spawn with cwd and relative filenames to avoid Windows path issues
  // (FFmpeg interprets colons in paths like C:/... as stream specifiers)
  const workDir = dirname(inputPath);
  const inputFilename = basename(inputPath);
  const outputFilename = basename(outputPath);

  logger.info({ inputPath, outputPath, workDir }, 'Copying video with FFmpeg');

  const args = [
    '-i', inputFilename,
    '-y',
    '-c', 'copy',
    outputFilename
  ];

  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
    });
  });
}

async function encodeVideoWithAudio(
  videoPath: string,
  audioPath: string | null,
  outputPath: string
): Promise<void> {
  const { spawn } = await import('child_process');
  const { basename, dirname } = await import('path');
  const { copyFile } = await import('fs/promises');

  const workingDir = dirname(videoPath);
  const videoFilename = basename(videoPath);
  const outputFilename = basename(outputPath);

  if (audioPath) {
    // Copy audio to working directory
    const audioFilename = basename(audioPath);
    const localAudioPath = join(workingDir, audioFilename);
    if (audioPath !== localAudioPath) {
      await copyFile(audioPath, localAudioPath);
    }

    logger.info({ videoFilename, audioFilename, outputFilename, workingDir }, 'Encoding video with enhanced audio');

    // Replace audio track with enhanced audio
    const args = [
      '-i', videoFilename,
      '-i', audioFilename,
      '-y',
      '-map', '0:v',      // Take video from first input
      '-map', '1:a',      // Take audio from second input
      '-c:v', 'copy',     // Copy video codec (no re-encode)
      '-c:a', 'aac',      // Encode audio to AAC
      '-shortest',        // End when shortest stream ends
      outputFilename
    ];

    return new Promise((resolve, reject) => {
      logger.info({ cmd: `ffmpeg ${args.join(' ')}` }, 'FFmpeg encode started');

      const proc = spawn('ffmpeg', args, {
        cwd: workingDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderr = '';
      proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

      proc.on('close', (code) => {
        if (code === 0) {
          logger.info({ outputPath }, 'FFmpeg encode completed');
          resolve();
        } else {
          logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg encode failed');
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        logger.error({ err }, 'FFmpeg spawn error');
        reject(err);
      });
    });
  } else {
    // No enhanced audio, just copy video
    logger.info({ videoPath, outputPath }, 'No enhanced audio, copying video directly');
    await copyVideo(videoPath, outputPath);
  }
}

// Fallback: FFmpeg subtitle burning for when Remotion fails
async function renderSubtitlesWithFFmpeg(
  inputPath: string,
  outputPath: string,
  items: any[],
  project: any,
  fontsDir: string = escapePathForFilter(SYSTEM_FONTS_DIR)
): Promise<void> {
  const { access, constants } = await import('fs/promises');

  // Filter subtitle items
  const subtitles = items.filter(item => item.type === 'subtitle');

  logger.info({ inputPath, outputPath, subtitleCount: subtitles.length }, 'Rendering with FFmpeg fallback');

  // Verify input file exists
  try {
    await access(inputPath, constants.R_OK);
    logger.info({ inputPath }, 'Input file verified');
  } catch (err) {
    logger.error({ inputPath, err }, 'Input file not accessible');
    throw new Error(`Input file not accessible: ${inputPath}`);
  }

  if (subtitles.length === 0) {
    // No subtitles, just copy the video using spawn with cwd
    return copyVideo(inputPath, outputPath);
  }

  // Create ASS subtitle file for FFmpeg
  const assPath = inputPath.replace('.mp4', '.ass');
  const assContent = generateASSSubtitles(subtitles, project);

  const { writeFile } = await import('fs/promises');
  await writeFile(assPath, assContent, 'utf-8');
  logger.info({ assPath }, 'ASS subtitle file created');

  // Burn subtitles into video using subtitles filter
  // Use relative path by extracting just the filename - FFmpeg will find it in cwd
  const { basename, dirname } = await import('path');
  const { spawn } = await import('child_process');
  const assFilename = basename(assPath);  // Just "input.ass"
  const workingDir = dirname(assPath);    // The temp directory

  logger.info({ assPath, assFilename, workingDir }, 'Using subtitles filter with relative path');

  // Use spawn directly with cwd to avoid path escaping issues
  return new Promise((resolve, reject) => {
    const args = [
      '-i', 'input.mp4',
      '-y',
      '-vf', `subtitles=${assFilename}:fontsdir=${fontsDir}`,
      '-c:a', 'copy',
      'output.mp4'
    ];

    logger.info({ cmd: `ffmpeg ${args.join(' ')}`, cwd: workingDir }, 'FFmpeg subtitle burn started');

    const proc = spawn('ffmpeg', args, {
      cwd: workingDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg subtitle burn completed');
        resolve();
      } else {
        logger.error({ code, stderr }, 'FFmpeg subtitle burn failed');
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

function generateASSSubtitles(subtitles: any[], project: any): string {
  const width = project.sourceWidth || 1920;
  const height = project.sourceHeight || 1080;

  // ASS header
  let ass = `[Script Info]
Title: Reelify Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Inter,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,2,10,10,50,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Add dialogue entries
  for (const subtitle of subtitles) {
    const data = subtitle.data as any;
    const startTime = formatASSTime(subtitle.startMs);
    const endTime = formatASSTime(subtitle.endMs);
    const text = (data.text || '').replace(/\n/g, '\\N');

    ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${text}\n`;
  }

  return ass;
}

function formatASSTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

// =============================================================================
// Remotion Server-Side Rendering
// =============================================================================

interface RenderRemotionOptions {
  bundlePath: string;
  compositionId: string;
  outputPath: string;
  onProgress?: (progress: number) => void;
}

/**
 * Download a Remotion bundle from S3 storage if it doesn't exist locally.
 * Bundles are uploaded during visual generation and need to be restored after container restarts.
 */
async function ensureBundleExists(bundlePath: string, compositionId: string): Promise<void> {
  const bundleIndexPath = join(bundlePath, 'index.html');

  // Check if bundle already exists locally
  try {
    await access(bundleIndexPath, constants.R_OK);
    logger.info({ bundlePath }, 'Bundle exists locally');
    return;
  } catch {
    // Bundle doesn't exist locally, try to download from S3
    logger.info({ bundlePath, compositionId }, 'Bundle not found locally, downloading from S3...');
  }

  // List all files in the bundle from S3
  const s3Prefix = `bundles/${compositionId}/`;
  const files = await listObjects('outputs', s3Prefix);

  if (files.length === 0) {
    throw new Error(`Bundle not found in S3 storage: ${s3Prefix}`);
  }

  logger.info({ compositionId, fileCount: files.length }, 'Found bundle files in S3');

  // Create bundle directory
  await mkdir(bundlePath, { recursive: true });

  // Download all files
  for (const file of files) {
    // file is like "bundles/proj-xxx/index.html" or "bundles/proj-xxx/assets/file.js"
    // We need to extract the relative path within the bundle
    const relativePath = file.replace(s3Prefix, '');
    const localPath = join(bundlePath, relativePath);

    // Create subdirectories if needed
    const dir = join(bundlePath, relativePath.split('/').slice(0, -1).join('/'));
    if (dir !== bundlePath) {
      await mkdir(dir, { recursive: true });
    }

    await downloadFile('outputs', file, localPath);
  }

  logger.info({ bundlePath, compositionId, fileCount: files.length }, 'Bundle downloaded from S3');
}

/**
 * Rebuild the Remotion bundle from TypeScript source files.
 * Downloads sources from S3 and creates a proper bundle with correct composition IDs.
 */
async function rebuildBundleFromCJS(bundlePath: string, compositionId: string): Promise<string> {
  logger.info({ bundlePath, compositionId }, 'Rebuilding bundle from TypeScript sources');

  // Download source files from S3
  const sourceCompositionId = compositionId.replace(/_/g, '-');
  const s3Prefix = `sources/${sourceCompositionId}/`;
  const sourceFiles = await listObjects('outputs', s3Prefix);

  if (sourceFiles.length === 0) {
    throw new Error(`Source files not found in S3: ${s3Prefix}`);
  }

  // Create temp directory for source files
  const tempDir = join(tmpdir(), `remotion-rebuild-${nanoid()}`);
  const srcDir = join(tempDir, 'src', compositionId.replace(/-/g, '_'));
  await mkdir(srcDir, { recursive: true });

  // Download all source files
  for (const file of sourceFiles) {
    const relativePath = file.replace(s3Prefix, '');
    const localPath = join(srcDir, relativePath);

    // Create subdirectories if needed
    const dir = join(srcDir, relativePath.split('/').slice(0, -1).join('/'));
    if (dir !== srcDir && relativePath.includes('/')) {
      await mkdir(dir, { recursive: true });
    }

    await downloadFile('outputs', file, localPath);
  }

  logger.info({ compositionId, fileCount: sourceFiles.length }, 'Downloaded source files from S3');

  // Fix composition ID in index.tsx (replace underscores with hyphens for Remotion)
  const indexPath = join(srcDir, 'index.tsx');
  try {
    let indexContent = await readFile(indexPath, 'utf-8');
    // Replace composition ID from underscores to hyphens
    const originalId = compositionId.replace(/-/g, '_');
    const fixedId = compositionId.replace(/_/g, '-');
    indexContent = indexContent.replace(new RegExp(originalId, 'g'), fixedId);
    await writeFile(indexPath, indexContent, 'utf-8');
  } catch (err) {
    logger.warn({ err }, 'Could not fix composition ID in index.tsx');
  }

  // Create entry point that imports the composition
  const entryContent = `
import { registerRoot } from 'remotion';
import { RemotionRoot } from './src/${compositionId.replace(/-/g, '_')}/index';

registerRoot(RemotionRoot);
`;
  const entryPath = join(tempDir, 'index.tsx');
  await writeFile(entryPath, entryContent, 'utf-8');

  logger.info({ entryPath, srcDir }, 'Created entry point for bundle');

  // Use Remotion's bundle() to create a proper bundle
  const newBundleLocation = await bundle({
    entryPoint: entryPath,
    outDir: bundlePath,
  });

  // Clean up temp dir
  await rm(tempDir, { recursive: true, force: true });

  logger.info({ newBundleLocation, compositionId }, 'Bundle rebuilt from sources successfully');
  return newBundleLocation;
}

/**
 * Render a Remotion composition to a video file using SSR.
 * Uses the existing bundle created by the visual generator.
 * If the composition is not found, attempts to rebuild the bundle from source.
 */
async function renderWithRemotion(options: RenderRemotionOptions): Promise<void> {
  const { bundlePath, compositionId, outputPath, onProgress } = options;

  logger.info({ bundlePath, compositionId, outputPath }, 'Starting Remotion SSR render');

  // Ensure bundle exists (download from S3 if needed)
  const bundleCompositionId = compositionId.replace(/_/g, '-');
  await ensureBundleExists(bundlePath, bundleCompositionId);

  // Remotion requires hyphens in composition IDs, not underscores
  // The visual generator creates IDs with underscores (proj_xxx), but Remotion validation fails
  // CRITICAL: If compositionId has underscores, skip getCompositions() entirely
  // because the existing bundle's composition.cjs.js also has underscores and will fail validation
  const hasUnderscores = compositionId.includes('_');
  const hyphenatedId = compositionId.replace(/_/g, '-');

  let composition;
  let serveUrl = bundlePath;

  if (hasUnderscores) {
    // Skip getCompositions() - we know the existing bundle will fail validation
    // Go straight to rebuild with fixed IDs
    logger.info({ compositionId, hyphenatedId }, 'Composition ID has underscores, rebuilding bundle with hyphens...');
    serveUrl = await rebuildBundleFromCJS(bundlePath, compositionId);

    composition = await selectComposition({
      serveUrl,
      id: hyphenatedId,
    });
  } else {
    // No underscores - try normal flow
    try {
      const compositions = await getCompositions(bundlePath);
      logger.info({
        availableCompositions: compositions.map(c => c.id),
        requestedComposition: compositionId
      }, 'Available compositions in bundle');

      const hasComposition = compositions.some(c => c.id === compositionId);

      if (!hasComposition) {
        logger.warn({ compositionId }, 'Composition not found in bundle, rebuilding from composition.cjs.js...');
        serveUrl = await rebuildBundleFromCJS(bundlePath, compositionId);
      }

      composition = await selectComposition({
        serveUrl,
        id: compositionId,
      });
    } catch (err) {
      logger.error({ err, compositionId }, 'Failed to select composition, attempting rebuild from CJS');
      serveUrl = await rebuildBundleFromCJS(bundlePath, compositionId);
      composition = await selectComposition({
        serveUrl,
        id: compositionId,
      });
    }
  }

  logger.info({
    compositionId: composition.id,
    width: composition.width,
    height: composition.height,
    fps: composition.fps,
    durationInFrames: composition.durationInFrames,
  }, 'Composition selected');

  // Render the composition to video
  // CRITICAL: Railway containers have limited RAM (~512MB-2GB)
  // x264 auto-detects 60 threads which requires 8-16GB RAM
  // Solution: Render at 50% scale to reduce memory by ~75%, then the final
  // composite step will scale back up

  logger.info({
    concurrency: 1,
    scale: 0.5,
    originalSize: `${composition.width}x${composition.height}`,
    scaledSize: `${Math.round(composition.width * 0.5)}x${Math.round(composition.height * 0.5)}`
  }, 'Starting renderMedia with reduced resolution for memory savings');

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outputPath,
    chromiumOptions: {
      enableMultiProcessOnLinux: true,
    },
    // CRITICAL: Use concurrency 1 to minimize memory - render one frame at a time
    concurrency: 1,
    // CRITICAL: Render at 50% scale to reduce memory usage by ~75%
    // This renders at 540x960 instead of 1080x1920
    scale: 0.5,
    // Use JPEG for faster rendering (no transparency needed for final output)
    imageFormat: 'jpeg',
    jpegQuality: 80,
    // Use 'ultrafast' preset - uses MUCH less memory than 'faster' or default
    x264Preset: 'ultrafast',
    // Higher CRF = lower quality but less memory (23 is still good quality)
    crf: 23,
    // Progress callback
    onProgress: ({ progress }) => {
      if (onProgress) {
        onProgress(progress);
      }
      logger.debug({ progress: Math.round(progress * 100) }, 'Remotion render progress');
    },
  });

  logger.info({ outputPath }, 'Remotion SSR render completed');
}

/**
 * Composite Remotion visuals with source video using FFmpeg.
 * Overlays the Remotion output on top of the source video.
 */
async function compositeVideos(
  sourceVideoPath: string,
  remotionVideoPath: string,
  outputPath: string,
  audioPath: string | null
): Promise<void> {
  const { spawn } = await import('child_process');
  const { dirname, basename } = await import('path');
  const { copyFile } = await import('fs/promises');

  const workingDir = dirname(outputPath);
  const sourceFilename = basename(sourceVideoPath);
  const remotionFilename = basename(remotionVideoPath);
  const outputFilename = basename(outputPath);

  // Copy files to working directory if needed
  const localSourcePath = join(workingDir, 'source_' + sourceFilename);
  const localRemotionPath = join(workingDir, 'remotion_' + remotionFilename);

  await copyFile(sourceVideoPath, localSourcePath);
  await copyFile(remotionVideoPath, localRemotionPath);

  let audioFilename: string | null = null;
  if (audioPath) {
    audioFilename = basename(audioPath);
    const localAudioPath = join(workingDir, audioFilename);
    if (audioPath !== localAudioPath) {
      await copyFile(audioPath, localAudioPath);
    }
  }

  logger.info({
    sourceFilename,
    remotionFilename,
    audioFilename,
    outputFilename,
    workingDir
  }, 'Compositing videos with FFmpeg');

  // Build FFmpeg command for overlay
  // The Remotion video is overlaid on top of the source video
  const args = [
    '-i', 'source_' + sourceFilename,
    '-i', 'remotion_' + remotionFilename,
  ];

  // Add audio input if available
  if (audioFilename) {
    args.push('-i', audioFilename);
  }

  args.push(
    '-y',
    '-filter_complex', '[0:v][1:v]overlay=0:0[outv]',
    '-map', '[outv]',
  );

  // Map audio from enhanced audio or source video
  if (audioFilename) {
    args.push('-map', '2:a');
  } else {
    args.push('-map', '0:a?');  // Use source audio if available
  }

  // LOW MEMORY MODE: Use ultrafast preset and limit threads
  args.push(
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '23',
    '-threads', '4',
    '-c:a', 'aac',
    '-shortest',
    outputFilename
  );

  return new Promise((resolve, reject) => {
    logger.info({ cmd: `ffmpeg ${args.join(' ')}` }, 'FFmpeg composite started');

    const proc = spawn('ffmpeg', args, {
      cwd: workingDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg composite completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg composite failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

/**
 * Render only the Remotion composition (no source video overlay).
 * Use this when the composition is standalone.
 */
async function renderRemotionOnly(
  bundlePath: string,
  compositionId: string,
  outputPath: string,
  audioPath: string | null,
  onProgress?: (progress: number) => void
): Promise<void> {
  const { spawn } = await import('child_process');
  const { dirname, basename } = await import('path');
  const { copyFile } = await import('fs/promises');

  // First render Remotion to a temp file
  const workingDir = dirname(outputPath);
  const remotionTempPath = join(workingDir, 'remotion_temp.mp4');

  await renderWithRemotion({
    bundlePath,
    compositionId,
    outputPath: remotionTempPath,
    onProgress,
  });

  // If we have enhanced audio, mux it with the Remotion video
  if (audioPath) {
    const audioFilename = basename(audioPath);
    const localAudioPath = join(workingDir, audioFilename);

    if (audioPath !== localAudioPath) {
      await copyFile(audioPath, localAudioPath);
    }

    logger.info({ remotionTempPath, audioPath, outputPath }, 'Muxing audio with Remotion video');

    const args = [
      '-i', 'remotion_temp.mp4',
      '-i', audioFilename,
      '-y',
      '-map', '0:v',
      '-map', '1:a',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-shortest',
      basename(outputPath)
    ];

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('ffmpeg', args, {
        cwd: workingDir,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderr = '';
      proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

      proc.on('close', (code) => {
        if (code === 0) {
          logger.info({ outputPath }, 'Audio muxing completed');
          resolve();
        } else {
          logger.error({ code, stderr: stderr.slice(-1000) }, 'Audio muxing failed');
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      proc.on('error', reject);
    });

    // Clean up temp file
    await rm(remotionTempPath, { force: true });
  } else {
    // No audio to add, just rename the temp file
    const { rename } = await import('fs/promises');
    await rename(remotionTempPath, outputPath);
  }
}

interface AddAudioAndSubtitlesOptions {
  videoPath: string;
  audioPath: string | null;
  subtitles: SubtitleItem[];
  outputPath: string;
  workDir: string;
  width: number;
  height: number;
  fontsDir?: string;
}

/**
 * Add audio and subtitles to a video file.
 * Simple pass-through - no layout changes.
 */
async function addAudioAndSubtitles(options: AddAudioAndSubtitlesOptions): Promise<void> {
  const {
    videoPath,
    audioPath,
    subtitles,
    outputPath,
    workDir,
    width,
    height,
    fontsDir = escapePathForFilter(SYSTEM_FONTS_DIR),
  } = options;

  const { spawn } = await import('child_process');
  const { basename } = await import('path');
  const { writeFile, copyFile } = await import('fs/promises');

  // Copy video to working directory
  const localVideoPath = join(workDir, 'video.mp4');
  await copyFile(videoPath, localVideoPath);

  // Copy audio if provided
  let audioFilename: string | null = null;
  if (audioPath) {
    audioFilename = 'audio.m4a';
    await copyFile(audioPath, join(workDir, audioFilename));
  }

  // Generate ASS subtitles if we have any
  let assFilename: string | null = null;
  if (subtitles.length > 0) {
    assFilename = 'subtitles.ass';
    const assContent = generateASSForComposite(subtitles, width, height);
    await writeFile(join(workDir, assFilename), assContent, 'utf-8');
    logger.info({ subtitleCount: subtitles.length }, 'Generated subtitles');
  }

  logger.info({
    videoPath,
    audioPath,
    subtitleCount: subtitles.length,
    outputPath,
  }, 'Adding audio and subtitles');

  // Build FFmpeg args
  const args = ['-i', 'video.mp4'];

  if (audioFilename) {
    args.push('-i', audioFilename);
  }

  args.push('-y');

  // Add subtitles filter if we have them, otherwise copy video
  if (assFilename) {
    args.push('-vf', `subtitles=${assFilename}:fontsdir=${fontsDir}`);
    args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-threads', '4');
  } else {
    args.push('-c:v', 'copy');
  }

  // Map streams
  if (audioFilename) {
    args.push('-map', '0:v', '-map', '1:a', '-c:a', 'aac');
  } else {
    args.push('-an');  // No audio if none provided
  }

  args.push('-shortest', basename(outputPath));

  return new Promise((resolve, reject) => {
    logger.info({ cmd: `ffmpeg ${args.join(' ')}`, cwd: workDir }, 'FFmpeg started');

    const proc = spawn('ffmpeg', args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

interface RenderWithPiPLayoutOptions {
  sourceVideoPath: string;
  remotionVideoPath: string;
  audioPath: string | null;
  subtitles: SubtitleItem[];
  outputPath: string;
  workDir: string;
  width: number;
  height: number;
  layoutSettings?: LayoutSettings;
  fullscreenSegments?: FullscreenSegment[];
  onProgress?: (progress: number) => void;
  fontsDir: string;
  resolvedFontFamily?: string;
}

/**
 * Render final video with configurable layout:
 * - PiP mode: Remotion visuals fullscreen, source video as overlay
 * - Split modes: Side by side or top/bottom
 * Uses layoutSettings for exact position, size, and styling to match preview
 */
async function renderWithPiPLayout(options: RenderWithPiPLayoutOptions): Promise<void> {
  const {
    sourceVideoPath,
    remotionVideoPath,
    audioPath,
    subtitles,
    outputPath,
    workDir,
    width: fullWidth,
    height: fullHeight,
    layoutSettings,
    fullscreenSegments,
    onProgress,
    fontsDir,
    resolvedFontFamily,
  } = options;

  // LOW MEMORY MODE: Scale down output to 50% to reduce FFmpeg memory usage
  // This matches the 0.5 scale used in Remotion rendering
  const MEMORY_SCALE = 0.5;
  const width = Math.round(fullWidth * MEMORY_SCALE);
  const height = Math.round(fullHeight * MEMORY_SCALE);

  logger.info({
    fullWidth,
    fullHeight,
    scaledWidth: width,
    scaledHeight: height,
    scale: MEMORY_SCALE,
  }, 'Using reduced resolution for low memory composite');

  const { spawn, execSync } = await import('child_process');
  const { basename } = await import('path');
  const { writeFile, copyFile } = await import('fs/promises');

  // Get video duration for progress tracking using ffprobe
  let durationSeconds = 0;
  try {
    const ffprobeOutput = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${sourceVideoPath}"`,
      { encoding: 'utf-8' }
    );
    durationSeconds = parseFloat(ffprobeOutput.trim()) || 0;
  } catch {
    logger.warn('Could not get video duration for progress tracking');
  }

  // Copy files to working directory with simple names
  const localSourcePath = join(workDir, 'source.mp4');
  const localRemotionPath = join(workDir, 'remotion.mp4');
  await copyFile(sourceVideoPath, localSourcePath);
  await copyFile(remotionVideoPath, localRemotionPath);

  // Copy audio if provided
  let audioFilename: string | null = null;
  if (audioPath) {
    audioFilename = 'audio.m4a';
    await copyFile(audioPath, join(workDir, audioFilename));
  }

  // Default layout settings if not provided
  const mode = layoutSettings?.mode || 'pip';
  const pip = layoutSettings?.pip || {
    position: 'bottom-right' as const,
    offsetX: 16,
    offsetY: 16,
    size: 'medium' as const,
    customSize: 25,
    shape: 'rounded' as const,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowEnabled: true,
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowBlur: 20,
    opacity: 1,
  };
  const split = layoutSettings?.split || {
    position: 'visuals-first' as const,
    ratio: 50,
    gap: 0,
  };

  let filterComplex: string;

  if (mode === 'pip') {
    // Calculate PiP dimensions based on settings
    const pipSizePercent = pip.size === 'custom' ? pip.customSize : PIP_SIZE_MAP[pip.size];
    const pipWidth = Math.round(width * (pipSizePercent / 100));
    const pipHeight = Math.round(pipWidth); // Square aspect ratio for PiP

    // Calculate position based on settings
    let pipX: number, pipY: number;
    switch (pip.position) {
      case 'top-left':
        pipX = pip.offsetX;
        pipY = pip.offsetY;
        break;
      case 'top-right':
        pipX = width - pipWidth - pip.offsetX;
        pipY = pip.offsetY;
        break;
      case 'bottom-left':
        pipX = pip.offsetX;
        pipY = height - pipHeight - pip.offsetY;
        break;
      case 'bottom-right':
      default:
        pipX = width - pipWidth - pip.offsetX;
        pipY = height - pipHeight - pip.offsetY;
        break;
    }

    logger.info({
      mode,
      pipDimensions: { pipWidth, pipHeight, pipX, pipY },
    }, 'Rendering with simplified PiP layout (low memory mode)');

    // LOW MEMORY MODE: Simple overlay without shadows, borders, or rounded corners
    // This uses minimal FFmpeg filters to prevent OOM on Railway
    filterComplex = [
      // Scale Remotion visuals to full screen
      `[1:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1[bg]`,
      // Scale source video to PiP size
      `[0:v]scale=${pipWidth}:${pipHeight}:force_original_aspect_ratio=increase,crop=${pipWidth}:${pipHeight},setsar=1[pip]`,
      // Simple overlay - no fancy effects
      `[bg][pip]overlay=${pipX}:${pipY}[outv]`
    ].join(';');

  } else if (mode === 'split-horizontal') {
    // Split horizontal (top/bottom)
    const visualsPercent = split.ratio / 100;
    const videoPercent = 1 - visualsPercent;
    const gap = split.gap;
    const isVisualsFirst = split.position === 'visuals-first';

    const visualsHeight = Math.round((height - gap) * visualsPercent);
    const videoHeight = Math.round((height - gap) * videoPercent);

    logger.info({
      mode,
      splitSettings: split,
      dimensions: { visualsHeight, videoHeight, gap },
    }, 'Rendering with horizontal split layout');

    // Use scale + crop to fill containers without black bars
    if (isVisualsFirst) {
      filterComplex = [
        `[1:v]scale=${width}:${visualsHeight}:force_original_aspect_ratio=increase,crop=${width}:${visualsHeight},setsar=1[visuals]`,
        `[0:v]scale=${width}:${videoHeight}:force_original_aspect_ratio=increase,crop=${width}:${videoHeight},setsar=1[video]`,
        `[visuals][video]vstack=inputs=2[outv]`
      ].join(';');
    } else {
      filterComplex = [
        `[0:v]scale=${width}:${videoHeight}:force_original_aspect_ratio=increase,crop=${width}:${videoHeight},setsar=1[video]`,
        `[1:v]scale=${width}:${visualsHeight}:force_original_aspect_ratio=increase,crop=${width}:${visualsHeight},setsar=1[visuals]`,
        `[video][visuals]vstack=inputs=2[outv]`
      ].join(';');
    }

  } else if (mode === 'split-vertical') {
    // Split vertical (left/right)
    const visualsPercent = split.ratio / 100;
    const videoPercent = 1 - visualsPercent;
    const gap = split.gap;
    const isVisualsFirst = split.position === 'visuals-first';

    const visualsWidth = Math.round((width - gap) * visualsPercent);
    const videoWidth = Math.round((width - gap) * videoPercent);

    logger.info({
      mode,
      splitSettings: split,
      dimensions: { visualsWidth, videoWidth, gap },
    }, 'Rendering with vertical split layout');

    // Use scale + crop to fill containers without black bars
    if (isVisualsFirst) {
      filterComplex = [
        `[1:v]scale=${visualsWidth}:${height}:force_original_aspect_ratio=increase,crop=${visualsWidth}:${height},setsar=1[visuals]`,
        `[0:v]scale=${videoWidth}:${height}:force_original_aspect_ratio=increase,crop=${videoWidth}:${height},setsar=1[video]`,
        `[visuals][video]hstack=inputs=2[outv]`
      ].join(';');
    } else {
      filterComplex = [
        `[0:v]scale=${videoWidth}:${height}:force_original_aspect_ratio=increase,crop=${videoWidth}:${height},setsar=1[video]`,
        `[1:v]scale=${visualsWidth}:${height}:force_original_aspect_ratio=increase,crop=${visualsWidth}:${height},setsar=1[visuals]`,
        `[video][visuals]hstack=inputs=2[outv]`
      ].join(';');
    }

  } else {
    // Fallback to PiP with defaults (use crop for no black bars)
    const pipWidth = Math.round(width * 0.25);
    const pipHeight = Math.round(pipWidth);
    const pipX = width - pipWidth - 16;
    const pipY = height - pipHeight - 16;

    filterComplex = [
      `[1:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1[bg]`,
      `[0:v]scale=${pipWidth}:${pipHeight}:force_original_aspect_ratio=increase,crop=${pipWidth}:${pipHeight},setsar=1[pip]`,
      `[bg][pip]overlay=${pipX}:${pipY}[outv]`
    ].join(';');
  }

  // Add fullscreen segment overlay if segments are defined
  // During fullscreen segments, the source video covers the entire frame (hiding visuals)
  const hasFullscreenSegments = fullscreenSegments && fullscreenSegments.length > 0;
  if (hasFullscreenSegments) {
    // Build FFmpeg enable expression: between(t,start1,end1)+between(t,start2,end2)+...
    const enableExpr = fullscreenSegments
      .map(seg => `between(t,${(seg.startMs / 1000).toFixed(3)},${(seg.endMs / 1000).toFixed(3)})`)
      .join('+');

    // Split source video so we can use it both in layout and fullscreen overlay
    // Replace [0:v] references in filterComplex with [src_layout]
    filterComplex = filterComplex.replace(/\[0:v\]/g, '[src_layout]');

    // Prepend the split filter and fullscreen source scale
    filterComplex = [
      `[0:v]split=2[src_layout][src_fs]`,
      `[src_fs]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1[fs_src]`,
      filterComplex,
    ].join(';');

    // Rename [outv] to [layout_out], then overlay fullscreen source on top
    filterComplex = filterComplex.replace('[outv]', '[layout_out]');
    filterComplex += `;[layout_out][fs_src]overlay=0:0:enable='${enableExpr}'[outv]`;

    logger.info({
      segmentCount: fullscreenSegments.length,
      enableExpr,
    }, 'Added fullscreen segment overlay to FFmpeg filter');
  }

  // Generate ASS subtitles if we have any - AFTER layout settings are parsed
  // so we can position captions correctly based on layout mode
  let assFilename: string | null = null;
  if (subtitles.length > 0) {
    assFilename = 'subtitles.ass';
    const assContent = generateASSForComposite(subtitles, width, height, layoutSettings, resolvedFontFamily);
    await writeFile(join(workDir, assFilename), assContent, 'utf-8');
    logger.info({ subtitleCount: subtitles.length, assFilename, mode, resolvedFontFamily }, 'Generated ASS subtitles with layout');
  }

  // Add subtitles filter if we have them
  if (assFilename) {
    filterComplex = filterComplex.replace('[outv]', '[pre]') + `;[pre]subtitles=${assFilename}:fontsdir=${fontsDir}[outv]`;
  }

  // Build FFmpeg args
  // Input order: 0=source, 1=remotion, 2=audio (optional)
  const args = [
    '-i', 'source.mp4',
    '-i', 'remotion.mp4',
  ];

  if (audioFilename) {
    args.push('-i', audioFilename);
  }

  args.push(
    '-y',
    '-filter_complex', filterComplex,
    '-map', '[outv]',
  );

  // Map audio
  if (audioFilename) {
    args.push('-map', '2:a');
  } else {
    args.push('-map', '0:a?');  // Use source audio if available
  }

  // LOW MEMORY MODE: Use ultrafast preset and limit threads to avoid OOM
  args.push(
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '23',
    '-threads', '4',
    '-c:a', 'aac',
    '-shortest',
    basename(outputPath)
  );

  return new Promise((resolve, reject) => {
    logger.info({ cmd: `ffmpeg ${args.join(' ')}`, cwd: workDir }, 'FFmpeg PiP render started');

    const proc = spawn('ffmpeg', args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    let lastReportedProgress = 0;
    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();

      // Parse FFmpeg progress from stderr (e.g., "time=00:01:23.45")
      if (onProgress && durationSeconds > 0) {
        const timeMatch = chunk.toString().match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const seconds = parseInt(timeMatch[3], 10);
          const centiseconds = parseInt(timeMatch[4], 10);
          const currentTime = hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
          const progress = Math.min(currentTime / durationSeconds, 1);
          // Only report if progress increased by at least 1%
          if (progress - lastReportedProgress >= 0.01) {
            lastReportedProgress = progress;
            onProgress(progress);
          }
        }
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg PiP render completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg PiP render failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

interface FinalizeRemotionVideoOptions {
  remotionVideoPath: string;
  audioPath: string | null;
  subtitles: SubtitleItem[];
  outputPath: string;
  workDir: string;
  width: number;
  height: number;
  fontsDir?: string;
}

/**
 * Finalize Remotion video by adding subtitles and audio.
 * The Remotion video is used fullscreen (exactly what user sees in preview).
 */
async function finalizeRemotionVideo(options: FinalizeRemotionVideoOptions): Promise<void> {
  const {
    remotionVideoPath,
    audioPath,
    subtitles,
    outputPath,
    workDir,
    width,
    height,
    fontsDir = escapePathForFilter(SYSTEM_FONTS_DIR),
  } = options;

  const { spawn } = await import('child_process');
  const { basename } = await import('path');
  const { writeFile, copyFile } = await import('fs/promises');

  // Copy Remotion video to working directory
  const localRemotionPath = join(workDir, 'remotion.mp4');
  await copyFile(remotionVideoPath, localRemotionPath);

  // Copy audio if provided
  let audioFilename: string | null = null;
  if (audioPath) {
    audioFilename = 'audio.m4a';
    await copyFile(audioPath, join(workDir, audioFilename));
  }

  // Generate ASS subtitles if we have any
  let assFilename: string | null = null;
  if (subtitles.length > 0) {
    assFilename = 'subtitles.ass';
    const assContent = generateASSForComposite(subtitles, width, height);
    await writeFile(join(workDir, assFilename), assContent, 'utf-8');
    logger.info({ subtitleCount: subtitles.length, assFilename }, 'Generated ASS subtitles');
  }

  logger.info({
    remotionVideoPath,
    audioPath,
    subtitleCount: subtitles.length,
    outputPath,
  }, 'Finalizing Remotion video with subtitles and audio');

  // Build FFmpeg args
  const args = ['-i', 'remotion.mp4'];

  if (audioFilename) {
    args.push('-i', audioFilename);
  }

  args.push('-y');

  // Add video filter for subtitles if we have them
  if (assFilename) {
    args.push('-vf', `subtitles=${assFilename}:fontsdir=${fontsDir}`);
  } else {
    args.push('-c:v', 'copy');  // No re-encode needed if no subtitles
  }

  // Map video (already added via -vf or -c:v copy)
  if (audioFilename) {
    args.push('-map', '0:v', '-map', '1:a');
    args.push('-c:a', 'aac');
  } else {
    // No audio - check if Remotion video has audio
    args.push('-map', '0:v', '-map', '0:a?');
    args.push('-c:a', 'aac');
  }

  // Encoding settings (only if we have subtitles to burn)
  if (assFilename) {
    args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-threads', '4');
  }

  args.push('-shortest', basename(outputPath));

  return new Promise((resolve, reject) => {
    logger.info({ cmd: `ffmpeg ${args.join(' ')}`, cwd: workDir }, 'FFmpeg finalize started');

    const proc = spawn('ffmpeg', args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg finalize completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg finalize failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

interface CompositeFullVideoOptions {
  sourceVideoPath: string;
  remotionVideoPath: string;
  audioPath: string | null;
  subtitles: SubtitleItem[];
  outputPath: string;
  workDir: string;
  projectWidth: number;
  projectHeight: number;
  fontsDir?: string;
}

/**
 * Composite source video + Remotion visuals + subtitles + audio into final output.
 * Uses picture-in-picture layout with Remotion visuals in corner.
 */
async function compositeFullVideo(options: CompositeFullVideoOptions): Promise<void> {
  const {
    sourceVideoPath,
    remotionVideoPath,
    audioPath,
    subtitles,
    outputPath,
    workDir,
    projectWidth: fullWidth,
    projectHeight: fullHeight,
    fontsDir = escapePathForFilter(SYSTEM_FONTS_DIR),
  } = options;

  // LOW MEMORY MODE: Scale down output to 50% to reduce FFmpeg memory usage
  const MEMORY_SCALE = 0.5;
  const projectWidth = Math.round(fullWidth * MEMORY_SCALE);
  const projectHeight = Math.round(fullHeight * MEMORY_SCALE);

  logger.info({
    fullWidth,
    fullHeight,
    scaledWidth: projectWidth,
    scaledHeight: projectHeight,
    scale: MEMORY_SCALE,
  }, 'Using reduced resolution for low memory full composite');

  const { spawn } = await import('child_process');
  const { basename } = await import('path');
  const { writeFile, copyFile } = await import('fs/promises');

  // Copy files to working directory with simple names
  const localSourcePath = join(workDir, 'source.mp4');
  const localRemotionPath = join(workDir, 'remotion.mp4');
  await copyFile(sourceVideoPath, localSourcePath);
  await copyFile(remotionVideoPath, localRemotionPath);

  // Copy audio if provided
  let audioFilename: string | null = null;
  if (audioPath) {
    audioFilename = 'audio.m4a';
    await copyFile(audioPath, join(workDir, audioFilename));
  }

  // Generate ASS subtitles if we have any
  let assFilename: string | null = null;
  if (subtitles.length > 0) {
    assFilename = 'subtitles.ass';
    const assContent = generateASSForComposite(subtitles, projectWidth, projectHeight);
    await writeFile(join(workDir, assFilename), assContent, 'utf-8');
    logger.info({ subtitleCount: subtitles.length, assFilename }, 'Generated ASS subtitles');
  }

  logger.info({
    sourceVideoPath,
    remotionVideoPath,
    audioPath,
    subtitleCount: subtitles.length,
    outputPath,
  }, 'Compositing full video');

  // Build FFmpeg filter complex
  // Layout: Source video as main, Remotion visuals scaled to PiP in top-right corner
  // Then burn subtitles on top
  const pipScale = 0.3; // PiP is 30% of source video size
  const pipWidth = Math.round(projectWidth * pipScale);
  const pipHeight = Math.round(projectHeight * pipScale);
  const pipX = projectWidth - pipWidth - 20; // 20px padding from right
  const pipY = 20; // 20px padding from top

  let filterComplex = `[1:v]scale=${pipWidth}:${pipHeight}[pip];[0:v][pip]overlay=${pipX}:${pipY}`;

  // Add subtitles filter if we have them
  if (assFilename) {
    filterComplex += `,subtitles=${assFilename}:fontsdir=${fontsDir}`;
  }

  filterComplex += '[outv]';

  // Build FFmpeg args
  const args = [
    '-i', 'source.mp4',
    '-i', 'remotion.mp4',
  ];

  if (audioFilename) {
    args.push('-i', audioFilename);
  }

  args.push(
    '-y',
    '-filter_complex', filterComplex,
    '-map', '[outv]',
  );

  // Map audio
  if (audioFilename) {
    args.push('-map', '2:a');
  } else {
    args.push('-map', '0:a?');
  }

  // LOW MEMORY MODE: Use ultrafast preset and limit threads
  args.push(
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '23',
    '-threads', '4',
    '-c:a', 'aac',
    '-shortest',
    basename(outputPath)
  );

  return new Promise((resolve, reject) => {
    logger.info({ cmd: `ffmpeg ${args.join(' ')}`, cwd: workDir }, 'FFmpeg full composite started');

    const proc = spawn('ffmpeg', args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg full composite completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg full composite failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}

/**
 * Convert hex or rgba color to ASS color format (&HAABBGGRR)
 */
function hexToASSColor(color: string): string {
  if (!color) return '&H00FFFFFF'; // Default to white

  // Handle rgba format: rgba(r, g, b, a)
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);
    const a = rgbaMatch[4] ? Math.round((1 - parseFloat(rgbaMatch[4])) * 255) : 0;
    const result = `&H${a.toString(16).padStart(2, '0').toUpperCase()}${b.toString(16).padStart(2, '0').toUpperCase()}${g.toString(16).padStart(2, '0').toUpperCase()}${r.toString(16).padStart(2, '0').toUpperCase()}`;
    logger.info({ input: color, type: 'rgba', r, g, b, a, result }, 'hexToASSColor conversion');
    return result;
  }

  // Handle hex format
  let hex = color.replace('#', '');

  // Handle short hex (#fff -> #ffffff)
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  // Parse RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // ASS uses &HAABBGGRR format (alpha, blue, green, red)
  // Alpha 00 = fully opaque
  const result = `&H00${b.toString(16).padStart(2, '0').toUpperCase()}${g.toString(16).padStart(2, '0').toUpperCase()}${r.toString(16).padStart(2, '0').toUpperCase()}`;
  logger.info({ input: color, type: 'hex', hex, r, g, b, result }, 'hexToASSColor conversion');
  return result;
}

/**
 * Get ASS alignment from position string
 * ASS alignments: 1=bottom-left, 2=bottom-center, 3=bottom-right
 *                 4=middle-left, 5=middle-center, 6=middle-right
 *                 7=top-left, 8=top-center, 9=top-right
 */
function getASSAlignment(position: string): number {
  switch (position) {
    case 'top': return 8;
    case 'middle': case 'center': return 5;
    case 'bottom': default: return 2;
  }
}

/**
 * Generate ASS subtitles using style from subtitle data.
 * Matches frontend caption styling as closely as possible.
 * Adjusts positioning based on layout mode (PiP, split-horizontal, split-vertical).
 * Supports word-by-word, phrase, and karaoke display modes.
 */
function generateASSForComposite(subtitles: SubtitleItem[], width: number, height: number, layoutSettings?: LayoutSettings, fontFamilyOverride?: string): string {
  // Get style from first subtitle (they should all have same style)
  const firstStyle = subtitles[0]?.style as any || {};

  logger.info({ captionStyle: firstStyle, layoutSettings }, 'Generating ASS subtitles with style and layout');

  // Use the resolved/override font family if provided, otherwise resolve from CSS font-family string
  // resolveAvailableFontFamily walks the comma-separated list and picks the first font
  // available in Google Fonts or the fallback map (e.g. 'Komika Axis' → 'Anton')
  const fontFamily = fontFamilyOverride || resolveAvailableFontFamily(firstStyle.fontFamily || 'Inter');
  logger.info({ fontFamily, fontFamilyOverride, styleFontFamily: firstStyle.fontFamily }, 'ASS using font family');
  // Use fontSize directly — PlayResY is set to canvas height so ASS handles coordinate mapping.
  // No height/1920 scaling needed; it's redundant at 1920p and creates mismatches at other resolutions.
  const baseFontSize = firstStyle.fontSize || 56;
  const fontSize = baseFontSize;

  // Apply opacity to colors if specified
  const opacity = firstStyle.opacity ?? 1;
  const applyOpacity = (assColor: string, op: number): string => {
    if (op >= 1) return assColor;
    // ASS format: &HAABBGGRR - modify the alpha (AA) based on opacity
    const alpha = Math.round((1 - op) * 255);
    return assColor.replace(/^&H../, `&H${alpha.toString(16).padStart(2, '0').toUpperCase()}`);
  };

  const color = applyOpacity(hexToASSColor(firstStyle.color || '#ffffff'), opacity);
  const activeColor = applyOpacity(hexToASSColor(firstStyle.activeColor || '#ffff00'), opacity);

  // Handle backgroundColor — use proper ASS BackColour
  // Default to fully transparent (matching preview's 'transparent' default)
  let backColor = '&H00000000'; // Fully transparent
  let borderStyle = 1; // 1 = outline + shadow (default)
  if (firstStyle.backgroundColor && firstStyle.backgroundColor !== 'transparent') {
    backColor = hexToASSColor(firstStyle.backgroundColor);
    borderStyle = 3; // 3 = opaque box behind text (like CSS backgroundColor)
  }

  const fontWeight = firstStyle.fontWeight || 800;
  const bold = fontWeight >= 700 ? -1 : 0;  // -1 = bold in ASS

  // Letter spacing — use directly (no height/1920 scaling, PlayRes handles it)
  const letterSpacing = firstStyle.letterSpacing || 0;

  // Line height — CSS lineHeight (unitless multiplier, default 1.4) controls vertical
  // line spacing. ASS doesn't have a direct lineHeight field, so we approximate via ScaleY.
  // Default ASS line spacing ≈ 1.2× font size (font-metric dependent).
  // ScaleY scales the entire glyph + line gap proportionally.
  const lineHeight = firstStyle.lineHeight ?? 1.4;
  const DEFAULT_ASS_LINE_HEIGHT = 1.2;
  const scaleY = Math.round((lineHeight / DEFAULT_ASS_LINE_HEIGHT) * 100);

  // Text transform - will be applied to each subtitle text
  const textTransform = firstStyle.textTransform || 'none';

  // Display mode for word-by-word/phrase/karaoke styling
  const displayMode = firstStyle.displayMode || 'phrase';
  const wordsPerPhrase = firstStyle.wordsPerPhrase || 5;

  // Parse V2 position system (object or legacy string)
  let captionPosition: string;
  let offsetX = 0;
  let offsetY = 0;
  let rotation = 0;
  let textAlign: string = 'center';

  if (typeof firstStyle.position === 'object' && firstStyle.position !== null) {
    // V2 position object
    captionPosition = firstStyle.position.anchor || 'bottom';
    offsetX = firstStyle.position.offsetX || 0;
    offsetY = firstStyle.position.offsetY || 0;
    rotation = firstStyle.position.rotation || 0;
    textAlign = firstStyle.position.textAlign || 'center';
  } else {
    // Legacy string position
    captionPosition = firstStyle.position || 'bottom';
  }

  // Map textAlign to ASS alignment
  // ASS alignments: 1=bottom-left, 2=bottom-center, 3=bottom-right
  //                 4=middle-left, 5=middle-center, 6=middle-right
  //                 7=top-left, 8=top-center, 9=top-right
  let alignment: number;
  const alignCol = textAlign === 'left' ? 1 : textAlign === 'right' ? 3 : 2;
  const alignRow = captionPosition === 'top' ? 6 : (captionPosition === 'center' || captionPosition === 'middle') ? 3 : 0;
  alignment = alignRow + alignCol;

  // Get layout info
  const mode = layoutSettings?.mode || 'pip';
  const pip = layoutSettings?.pip;
  const split = layoutSettings?.split;

  // Calculate effective area for captions based on layout
  let effectiveHeight = height;
  let verticalOffset = 0;

  if (mode === 'split-horizontal') {
    // In horizontal split, captions should be in the video section
    const visualsRatio = (split?.ratio || 50) / 100;
    const isVisualsFirst = split?.position === 'visuals-first';

    if (isVisualsFirst) {
      // Visuals on top, video on bottom - captions in bottom section
      effectiveHeight = Math.round(height * (1 - visualsRatio));
      verticalOffset = Math.round(height * visualsRatio);
    } else {
      // Video on top, visuals on bottom - captions in top section
      effectiveHeight = Math.round(height * (1 - visualsRatio));
      verticalOffset = 0;
    }
  } else if (mode === 'split-vertical') {
    // In vertical split, captions span the full height but may need adjustment
    // Keep full height, no offset needed
  }

  // Calculate margin based on position, offsetY, and layout
  let marginV: number;
  if (captionPosition === 'top') {
    marginV = Math.round(effectiveHeight * 0.10 + (offsetY * effectiveHeight / 100));
  } else if (captionPosition === 'center' || captionPosition === 'middle') {
    marginV = Math.round(effectiveHeight * 0.5 + (offsetY * effectiveHeight / 100));
  } else {
    // bottom - most common
    marginV = Math.round(effectiveHeight * 0.15 - (offsetY * effectiveHeight / 100));
  }

  // For split-horizontal with visuals-first, add the vertical offset
  if (mode === 'split-horizontal' && split?.position === 'visuals-first' && captionPosition === 'bottom') {
    // Captions are at bottom of video section which is at bottom of frame
    // marginV is from bottom, so no adjustment needed
  } else if (mode === 'split-horizontal' && split?.position !== 'visuals-first' && captionPosition === 'bottom') {
    // Video on top, captions should be at bottom of top section
    // Need to add offset for visuals section below
    marginV += Math.round(height * ((split?.ratio || 50) / 100));
  }

  // For PiP mode, avoid overlapping with PiP window
  if (mode === 'pip' && pip) {
    const pipSize = pip.size === 'custom' ? pip.customSize : PIP_SIZE_MAP[pip.size] || 25;
    const pipHeight = Math.round(width * (pipSize / 100)); // PiP is square

    // If caption is at bottom and PiP is at bottom, add margin to avoid overlap
    if (captionPosition === 'bottom' && (pip.position === 'bottom-left' || pip.position === 'bottom-right')) {
      marginV = Math.max(marginV, pipHeight + pip.offsetY + 20);
    }
    // If caption is at top and PiP is at top, add margin to avoid overlap
    if (captionPosition === 'top' && (pip.position === 'top-left' || pip.position === 'top-right')) {
      marginV = Math.max(marginV, pipHeight + pip.offsetY + 20);
    }
  }

  marginV = Math.max(20, Math.min(marginV, height / 2)); // Clamp to reasonable range

  // Calculate horizontal margins based on offsetX
  // offsetX is a percentage (-50 to +50), convert to pixels
  const offsetXPixels = Math.round(offsetX * width / 100);
  let marginL = 10 + Math.max(0, offsetXPixels);
  let marginR = 10 + Math.max(0, -offsetXPixels);

  // ── Effects mapping: stroke → ASS Outline, shadow → ASS inline xshad/yshad/blur ──
  // Stroke (CSS WebkitTextStroke) maps to ASS Outline (border around glyphs).
  // Shadow (CSS text-shadow) maps to ASS \xshad, \yshad, \blur inline override tags.
  // This separation matches the preview more closely than mixing them into Style fields.
  let outline = 0;
  let outlineColorParsed = '&H00000000'; // Default black

  // Stroke → ASS Outline (direct mapping, no height/1920 scaling — PlayRes handles it)
  if (firstStyle.stroke && firstStyle.stroke.width > 0) {
    outline = Math.round(firstStyle.stroke.width);
    outlineColorParsed = hexToASSColor(firstStyle.stroke.color || '#000000');
    logger.info({ stroke: firstStyle.stroke, outline }, 'Stroke → ASS Outline');
  }

  // Shadow → inline tags (built later, prepended to each dialogue line)
  // Stores the values for \xshad, \yshad, \blur tags
  let shadowXShad = 0;
  let shadowYShad = 0;
  let shadowBlur = 0;
  let shadowColor = '&H00000000'; // Default black shadow color

  if (firstStyle.effects?.shadow) {
    const se = firstStyle.effects.shadow;
    shadowXShad = se.offsetX;
    shadowYShad = se.offsetY;
    shadowBlur = Math.round(se.blur * 0.5); // ASS blur is more intense, scale down
    shadowColor = applyOpacity(hexToASSColor(se.color || '#000000'), se.opacity);
    logger.info({ shadowEffect: se, shadowXShad, shadowYShad, shadowBlur }, 'Shadow → ASS inline xshad/yshad/blur');

    // If no stroke, use shadow blur as a subtle outline for readability
    if (outline === 0 && se.blur > 0) {
      outline = Math.max(1, Math.round(se.blur / 4));
      outlineColorParsed = hexToASSColor(se.color || '#000000');
    }
  } else if (firstStyle.textShadow) {
    // Legacy fallback — parse "2px 2px 4px rgba(0,0,0,0.8)"
    const shadowMatch = firstStyle.textShadow.match(/(-?\d+)px\s+(-?\d+)px\s+(\d+)px/);
    if (shadowMatch) {
      shadowXShad = parseInt(shadowMatch[1], 10);
      shadowYShad = parseInt(shadowMatch[2], 10);
      shadowBlur = Math.round(parseInt(shadowMatch[3], 10) * 0.5);
    }
    if (outline === 0) {
      outline = Math.max(1, shadowBlur);
    }
  }

  // Secondary shadow support (previously ignored entirely)
  let shadowSecondaryTags = '';
  if (firstStyle.effects?.shadowSecondary) {
    const ss = firstStyle.effects.shadowSecondary;
    // Secondary shadow is applied as additional text-shadow in CSS.
    // In ASS we can't have two shadows, but we can approximate by choosing
    // the larger shadow for the inline tags (the one with more visual impact).
    const secondaryMag = Math.abs(ss.offsetX) + Math.abs(ss.offsetY) + ss.blur;
    const primaryMag = Math.abs(shadowXShad) + Math.abs(shadowYShad) + shadowBlur * 2;
    if (secondaryMag > primaryMag) {
      shadowXShad = ss.offsetX;
      shadowYShad = ss.offsetY;
      shadowBlur = Math.round(ss.blur * 0.5);
      shadowColor = applyOpacity(hexToASSColor(ss.color || '#000000'), ss.opacity);
    }
    logger.info({ shadowSecondary: ss }, 'Secondary shadow considered');
  }

  // Glow → ASS \blur tag (approximates CSS multi-layer glow shadows)
  let glowBlur = 0;
  let glowColor = '';
  if (firstStyle.effects?.glow?.enabled) {
    const glow = firstStyle.effects.glow;
    glowBlur = Math.round(glow.size * 0.5);
    glowColor = hexToASSColor(glow.color);
    // Combine glow blur with shadow blur (take the larger)
    shadowBlur = Math.max(shadowBlur, glowBlur);
    logger.info({ glow, glowBlur }, 'Glow → ASS blur');
  }

  // Build the inline effect override tags that get prepended to every dialogue line.
  // These override the Style-level Shadow field with per-axis values + Gaussian blur.
  const effectOverrideParts: string[] = [];
  if (shadowXShad !== 0) effectOverrideParts.push(`\\xshad${shadowXShad}`);
  if (shadowYShad !== 0) effectOverrideParts.push(`\\yshad${shadowYShad}`);
  if (shadowBlur > 0) effectOverrideParts.push(`\\blur${shadowBlur}`);
  // Shadow/glow color: glow color takes priority if glow is enabled, otherwise use shadow color
  const effectShadowColor = glowColor || shadowColor;
  if (effectShadowColor !== '&H00000000') effectOverrideParts.push(`\\4c${effectShadowColor}`);
  const effectOverrideTags = effectOverrideParts.length > 0 ? `{${effectOverrideParts.join('')}}` : '';

  // Helper to apply text transform
  const applyTextTransform = (text: string): string => {
    if (textTransform === 'uppercase') return text.toUpperCase();
    if (textTransform === 'lowercase') return text.toLowerCase();
    return text;
  };

  // Shadow in the Style line is set to 0 because we use inline \xshad/\yshad/\blur tags
  // for accurate per-axis shadow rendering. The Style Shadow field only supports equal X/Y.
  const styleShadow = 0;

  // Create styles - Default for inactive words, Active for highlighted words
  // BorderStyle: 1 = outline+shadow (transparent bg), 3 = opaque box (colored bg)
  let ass = `[Script Info]
Title: Reelify Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontFamily},${fontSize},${color},${activeColor},${outlineColorParsed},${backColor},${bold},0,0,0,100,${scaleY},${letterSpacing},${rotation},${borderStyle},${outline},${styleShadow},${alignment},${marginL},${marginR},${marginV},1
Style: Active,${fontFamily},${fontSize},${activeColor},${color},${outlineColorParsed},${backColor},${bold},0,0,0,100,${scaleY},${letterSpacing},${rotation},${borderStyle},${outline},${styleShadow},${alignment},${marginL},${marginR},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Log the ASS style header for debugging font issues
  logger.info({
    fontFamily,
    fontSize,
    bold,
    alignment,
    displayMode,
    assStylePreview: `Style: Default,${fontFamily},${fontSize},...`,
  }, 'Generated ASS style');

  // Helper to get absolute word timing
  // Words from database may be absolute (>= subtitle.startMs) or relative (< subtitle.startMs)
  const getAbsoluteWordTime = (subtitle: any, word: any, isEnd: boolean) => {
    const wordTime = isEnd ? (word.endMs ?? word.startMs + 500) : (word.startMs ?? 0);
    // If word time is >= subtitle start time, it's already absolute
    // Otherwise, add subtitle start to make it absolute
    if (wordTime >= subtitle.startMs) {
      return wordTime;
    }
    return subtitle.startMs + wordTime;
  };

  // Helper: build ASS inline override tags from per-word styleOverrides
  const buildWordOverrideTags = (word: any, isActive: boolean): string => {
    const ov = word.styleOverrides;
    if (!ov) return '';
    const tags: string[] = [];
    // Color override: use activeColor when word is active, else color
    if (isActive && ov.activeColor) {
      tags.push(`\\c${hexToASSColor(ov.activeColor)}`);
    } else if (ov.color) {
      tags.push(`\\c${hexToASSColor(ov.color)}`);
    }
    // Font family — resolve through fallback map so commercial fonts get substituted
    if (ov.fontFamily) {
      const family = resolveAvailableFontFamily(ov.fontFamily);
      tags.push(`\\fn${family}`);
    }
    // Font size (absolute override or scale) — no height/1920 scaling, PlayRes handles it
    if (ov.fontSize) {
      const scaledSize = Math.round((ov.scale || 1) * ov.fontSize);
      tags.push(`\\fs${scaledSize}`);
    } else if (ov.scale && ov.scale !== 1) {
      tags.push(`\\fs${Math.round(fontSize * ov.scale)}`);
    }
    // Font weight (bold)
    if (ov.fontWeight && ov.fontWeight >= 700) {
      tags.push('\\b1');
    }
    // Letter spacing
    if (ov.letterSpacing != null) {
      tags.push(`\\fsp${ov.letterSpacing}`);
    }
    // Emphasis background (\\3c = border color used as highlight box)
    if (ov.emphasisBg) {
      tags.push(`\\3c${hexToASSColor(ov.emphasisBg)}`);
    }
    return tags.length > 0 ? `{${tags.join('')}}` : '';
  };

  // Helper: reset ASS inline overrides back to style defaults after an overridden word
  const buildResetTags = (word: any): string => {
    const ov = word.styleOverrides;
    if (!ov) return '';
    const tags: string[] = [];
    if (ov.color || ov.activeColor) tags.push(`\\c${color}`);
    if (ov.fontFamily) tags.push(`\\fn${fontFamily}`);
    if (ov.fontSize || (ov.scale && ov.scale !== 1)) tags.push(`\\fs${fontSize}`);
    if (ov.fontWeight && ov.fontWeight >= 700) tags.push(`\\b${bold}`);
    if (ov.letterSpacing != null) tags.push(`\\fsp${letterSpacing}`);
    if (ov.emphasisBg) tags.push(`\\3c${outlineColorParsed}`);
    return tags.length > 0 ? `{${tags.join('')}}` : '';
  };

  // Helper: apply per-word textTransform (override > caption-level)
  const transformWordText = (word: any): string => {
    const text = word.text || '';
    const ov = word.styleOverrides;
    if (ov?.textTransform === 'uppercase') return text.toUpperCase();
    if (ov?.textTransform === 'lowercase') return text.toLowerCase();
    return applyTextTransform(text);
  };

  // Process subtitles based on display mode
  for (const subtitle of subtitles) {
    const rawWords = subtitle.words || [];
    // Create fallback word if no words exist
    const words = rawWords.length > 0 ? rawWords : [{ text: subtitle.text || '', startMs: subtitle.startMs, endMs: subtitle.endMs }];

    if (displayMode === 'word-by-word') {
      // Show one word at a time with active color
      for (const word of words) {
        const wordStart = getAbsoluteWordTime(subtitle, word, false);
        const wordEnd = getAbsoluteWordTime(subtitle, word, true);
        const startTime = formatASSTime(wordStart);
        const endTime = formatASSTime(wordEnd);
        const text = transformWordText(word).replace(/\n/g, '\\N');
        const overrideTags = buildWordOverrideTags(word, true);
        // Prepend effect tags (shadow xshad/yshad/blur) to each dialogue line
        ass += `Dialogue: 0,${startTime},${endTime},Active,,0,0,0,,${effectOverrideTags}${overrideTags}${text}\n`;
      }
    } else if (displayMode === 'karaoke') {
      // Show all words with karaoke fill effect - words highlight as they're spoken
      const startTime = formatASSTime(subtitle.startMs);
      const endTime = formatASSTime(subtitle.endMs);

      // Build karaoke text with \kf tags for fill effect
      let karaokeText = '';
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        // Duration in centiseconds for ASS karaoke tags
        const wordStart = getAbsoluteWordTime(subtitle, word, false);
        const wordEnd = getAbsoluteWordTime(subtitle, word, true);
        const duration = Math.round((wordEnd - wordStart) / 10);
        const wordText = transformWordText(word);
        const overrideTags = buildWordOverrideTags(word, false);
        // \kf = karaoke fill effect (smooth fill from left to right)
        // Merge override tags with \kf tag
        if (overrideTags) {
          // Insert \kf inside the override tag block
          karaokeText += `{\\kf${duration}${overrideTags.slice(1, -1)}}${wordText}`;
        } else {
          karaokeText += `{\\kf${duration}}${wordText}`;
        }
        // Reset after overridden word so next word uses defaults
        if ((word as any).styleOverrides && i < words.length - 1) karaokeText += buildResetTags(word);
        // Use space + \h to approximate the preview's flex gap + padding between words
        if (i < words.length - 1) karaokeText += ' \\h';
      }
      // Prepend effect tags to karaoke dialogue line
      ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${effectOverrideTags}${karaokeText}\n`;
    } else {
      // Phrase mode (default) — only the CURRENT word is highlighted, others stay in base color.
      // Instead of \kf karaoke (which permanently fills words), we generate one Dialogue line
      // per word's active period. Each line shows the full phrase with only that word in activeColor.
      // Gaps between words show all words in default color.

      // Helper: build the full phrase text with one word optionally highlighted
      const buildPhraseLine = (activeIdx: number): string => {
        let text = '';
        for (let j = 0; j < words.length; j++) {
          const w = words[j];
          const isWordActive = j === activeIdx;
          const ov = w.styleOverrides;
          const wordText = transformWordText(w);

          // Build inline override tags for this word
          const tags: string[] = [];

          // Color: active word uses activeColor, inactive uses base color
          // Per-word color overrides take priority
          if (isWordActive) {
            const wordColor = ov?.activeColor
              ? hexToASSColor(ov.activeColor)
              : (ov?.color ? hexToASSColor(ov.color) : activeColor);
            tags.push(`\\c${wordColor}`);
          } else {
            const wordColor = ov?.color ? hexToASSColor(ov.color) : color;
            tags.push(`\\c${wordColor}`);
          }

          // Background: active word may have activeBackgroundColor or emphasisBg
          if (ov?.emphasisBg) {
            tags.push(`\\3c${hexToASSColor(ov.emphasisBg)}`);
          }

          // Font overrides
          if (ov?.fontFamily) {
            tags.push(`\\fn${resolveAvailableFontFamily(ov.fontFamily)}`);
          }
          if (ov?.fontSize) {
            tags.push(`\\fs${Math.round((ov.scale || 1) * ov.fontSize)}`);
          } else if (ov?.scale && ov.scale !== 1) {
            tags.push(`\\fs${Math.round(fontSize * ov.scale)}`);
          }
          if (ov?.fontWeight && ov.fontWeight >= 700) {
            tags.push('\\b1');
          }
          if (ov?.letterSpacing != null) {
            tags.push(`\\fsp${ov.letterSpacing}`);
          }

          text += `{${tags.join('')}}${wordText}`;
          if (j < words.length - 1) text += ' \\h';
        }
        return text;
      };

      // Generate time-sliced Dialogue lines (no overlap, no karaoke tags)
      const firstWordStart = getAbsoluteWordTime(subtitle, words[0], false);

      // Before first word: all words in default color
      if (firstWordStart > subtitle.startMs) {
        ass += `Dialogue: 0,${formatASSTime(subtitle.startMs)},${formatASSTime(firstWordStart)},Default,,0,0,0,,${effectOverrideTags}${buildPhraseLine(-1)}\n`;
      }

      for (let i = 0; i < words.length; i++) {
        const wordStart = getAbsoluteWordTime(subtitle, words[i], false);
        const wordEnd = getAbsoluteWordTime(subtitle, words[i], true);

        // This word's active period — highlight it
        ass += `Dialogue: 0,${formatASSTime(wordStart)},${formatASSTime(wordEnd)},Default,,0,0,0,,${effectOverrideTags}${buildPhraseLine(i)}\n`;

        // Gap between this word and next — all words in default color
        if (i < words.length - 1) {
          const nextWordStart = getAbsoluteWordTime(subtitle, words[i + 1], false);
          if (wordEnd < nextWordStart) {
            ass += `Dialogue: 0,${formatASSTime(wordEnd)},${formatASSTime(nextWordStart)},Default,,0,0,0,,${effectOverrideTags}${buildPhraseLine(-1)}\n`;
          }
        }
      }

      // After last word: all words in default color
      const lastWordEnd = getAbsoluteWordTime(subtitle, words[words.length - 1], true);
      if (lastWordEnd < subtitle.endMs) {
        ass += `Dialogue: 0,${formatASSTime(lastWordEnd)},${formatASSTime(subtitle.endMs)},Default,,0,0,0,,${effectOverrideTags}${buildPhraseLine(-1)}\n`;
      }
    }
  }

  // Log sample of generated ASS for debugging
  const assLines = ass.split('\n');
  const dialogueLines = assLines.filter(l => l.startsWith('Dialogue:')).slice(0, 3);
  logger.info({
    sampleDialogueLines: dialogueLines,
    activeColorUsed: activeColor,
    colorUsed: color,
  }, 'ASS dialogue sample');

  logger.info({
    fontFamily,
    fontSize,
    captionPosition,
    textAlign,
    offsetX,
    offsetY,
    rotation,
    marginL,
    marginR,
    marginV,
    mode,
    displayMode,
    textTransform,
    letterSpacing,
    lineHeight,
    scaleY,
    opacity,
    outline,
    borderStyle,
    shadowXShad,
    shadowYShad,
    shadowBlur,
    effectOverrideTags,
    effectiveHeight,
    subtitleCount: subtitles.length
  }, 'ASS subtitles generated with full styling and layout awareness');

  return ass;
}

/**
 * Encode video with subtitles burned in (no Remotion visuals).
 */
async function encodeVideoWithSubtitles(
  videoPath: string,
  audioPath: string | null,
  subtitles: SubtitleItem[],
  outputPath: string,
  workDir: string,
  canvasWidth: number = 1080,
  canvasHeight: number = 1920,
  fontsDir: string = escapePathForFilter(SYSTEM_FONTS_DIR),
  resolvedFontFamily?: string
): Promise<void> {
  const { spawn } = await import('child_process');
  const { basename } = await import('path');
  const { writeFile, copyFile } = await import('fs/promises');

  // Copy video to working directory
  const localVideoPath = join(workDir, 'input.mp4');
  await copyFile(videoPath, localVideoPath);

  // Copy audio if provided
  let audioFilename: string | null = null;
  if (audioPath) {
    audioFilename = 'audio.m4a';
    await copyFile(audioPath, join(workDir, audioFilename));
  }

  // Generate ASS subtitles using actual canvas dimensions
  const assFilename = 'subtitles.ass';
  const assContent = generateASSForComposite(subtitles, canvasWidth, canvasHeight, undefined, resolvedFontFamily);
  await writeFile(join(workDir, assFilename), assContent, 'utf-8');

  logger.info({ subtitleCount: subtitles.length, audioPath }, 'Encoding video with subtitles');

  const args = [
    '-i', 'input.mp4',
  ];

  if (audioFilename) {
    args.push('-i', audioFilename);
  }

  args.push(
    '-y',
    '-vf', `subtitles=${assFilename}:fontsdir=${fontsDir}`,
  );

  if (audioFilename) {
    args.push('-map', '0:v', '-map', '1:a');
  }

  // LOW MEMORY MODE: Use ultrafast preset and limit threads
  args.push(
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '23',
    '-threads', '4',
    '-c:a', 'aac',
    '-shortest',
    basename(outputPath)
  );

  return new Promise((resolve, reject) => {
    logger.info({ cmd: `ffmpeg ${args.join(' ')}`, cwd: workDir }, 'FFmpeg subtitle encode started');

    const proc = spawn('ffmpeg', args, {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info({ outputPath }, 'FFmpeg subtitle encode completed');
        resolve();
      } else {
        logger.error({ code, stderr: stderr.slice(-1000) }, 'FFmpeg subtitle encode failed');
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      logger.error({ err }, 'FFmpeg spawn error');
      reject(err);
    });
  });
}
