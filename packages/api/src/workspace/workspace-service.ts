import { mkdir, writeFile, readFile, readdir, rm, access, cp } from 'fs/promises';
import { join, resolve } from 'path';
import { eq, inArray } from 'drizzle-orm';
import {
  workspaceConfig,
  getWorkspacePath,
  getManifestPath,
  getWorkspaceSrcPath,
  getScenesPath,
} from './workspace-config.js';
import { bundlerService } from './bundler-service.js';
import { forceReleaseLock } from './workspace-lock.js';
import {
  downloadSceneSources,
  extractCompositionIds,
  buildVisualCompositionMap,
  remapManifestSceneFiles,
} from './workspace-scenes.js';
import { generatePlayerComposition, updateRootWithPlayerComposition } from './workspace-codegen.js';
import { emitWorkspaceReady, emitWorkspaceTeardown } from './workspace-ws.js';
import { dbToManifest, manifestToDb, validateManifest, applyManifestOp } from '@viona/shared';
import type { Manifest, ManifestOp, DbToManifestInput } from '@viona/shared';
import { db, projects, tracks, timelineItems } from '../db/index.js';

// Track active workspaces and their idle timers
const activeWorkspaces = new Map<string, { idleTimer: ReturnType<typeof setTimeout> }>();

/**
 * Spin up a workspace for a project.
 * Creates directory structure, generates manifest from DB, copies scene sources.
 */
export async function spinUpWorkspace(projectId: string): Promise<{ manifest: Manifest; bundleUrl: string | null }> {
  const workspacePath = getWorkspacePath(projectId);
  const srcPath = getWorkspaceSrcPath(projectId);
  const manifestPath = getManifestPath(projectId);

  // 1. Create directory structure
  await mkdir(join(srcPath, 'scenes'), { recursive: true });
  await mkdir(join(srcPath, 'captions'), { recursive: true });
  await mkdir(join(srcPath, 'layout'), { recursive: true });
  await mkdir(join(workspacePath, 'public'), { recursive: true });

  // 2. Generate manifest from DB
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const projectTracks = await db.select().from(tracks).where(eq(tracks.projectId, projectId));

  // Get ALL items for all tracks in this project (single query)
  const trackIds = projectTracks.map(t => t.id);
  const allItems = trackIds.length > 0
    ? await db.select().from(timelineItems).where(inArray(timelineItems.trackId, trackIds))
    : [];

  const dbInput: DbToManifestInput = {
    project: {
      fps: project.fps ?? 30,
      durationMs: project.durationMs ?? 0,
      sourceWidth: project.sourceWidth ?? 1920,
      sourceHeight: project.sourceHeight ?? 1080,
      videoSettings: (project.videoSettings as Record<string, unknown>) ?? null,
    },
    tracks: projectTracks.map(t => ({
      id: t.id,
      type: t.type,
      name: t.name,
      position: t.position,
      locked: t.locked,
      visible: t.visible,
    })),
    items: allItems.map(item => ({
      id: item.id,
      trackId: item.trackId,
      type: item.type,
      startMs: item.startMs,
      endMs: item.endMs,
      data: (item.data as Record<string, unknown>) ?? {},
    })),
  };

  const manifest = dbToManifest(dbInput);

  // 3. Download scene sources from S3 for existing visuals
  const dbItemsForScenes = allItems.map(item => ({
    id: item.id,
    type: item.type,
    data: (item.data as Record<string, unknown>) ?? {},
  }));
  const compositionIds = extractCompositionIds(dbItemsForScenes);
  const downloadedCompositions = await downloadSceneSources(projectId, compositionIds);

  // 3b. Remap manifest sceneFile values to match actual workspace paths
  const visualCompositionMap = buildVisualCompositionMap(dbItemsForScenes);
  remapManifestSceneFiles(manifest, visualCompositionMap, downloadedCompositions);

  // 3c. Copy composition infrastructure from worker template
  const templateCompositionDir = resolve(
    process.cwd(), '..', 'worker', 'remotion-template', 'src', 'composition',
  );
  const workspaceCompositionDir = join(srcPath, 'composition');
  try {
    await cp(templateCompositionDir, workspaceCompositionDir, { recursive: true });
  } catch (err) {
    console.warn(`[workspace] Failed to copy composition infrastructure:`, err);
  }

  // 3d. Generate PlayerComposition.tsx and Root.tsx (codegen)
  await generatePlayerComposition(projectId);
  await updateRootWithPlayerComposition(
    projectId,
    manifest.durationMs,
    manifest.fps,
    manifest.canvas.width,
    manifest.canvas.height,
  );

  // 4. Write manifest.json
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  // 5. Update project workspace status
  await db.update(projects)
    .set({
      workspaceStatus: 'active',
      workspaceLastActivity: new Date(),
    })
    .where(eq(projects.id, projectId));

  // 6. Start idle timer
  resetIdleTimer(projectId);

  // 7. Queue bundle build (non-blocking)
  const cachedBundleUrl = project.activeBundleUrl ?? null;
  bundlerService.enqueueBuild(projectId, 'user').then(async () => {
    await emitWorkspaceReady(projectId, {
      bundleUrl: `/api/workspace/${projectId}/bundle/`,
    });
  }).catch((err) => {
    console.error(`[workspace] Bundle build failed for ${projectId}:`, err);
  });

  return { manifest, bundleUrl: cachedBundleUrl };
}

/**
 * Tear down a workspace. Syncs manifest to DB, cleans up directory.
 */
export async function tearDownWorkspace(projectId: string): Promise<void> {
  const workspacePath = getWorkspacePath(projectId);
  const manifestPath = getManifestPath(projectId);

  try {
    // 1. Read current manifest
    const manifestJson = await readFile(manifestPath, 'utf-8');
    const manifest = validateManifest(JSON.parse(manifestJson));

    // 2. Sync manifest back to DB
    await syncManifestToDb(projectId, manifest);
  } catch (err) {
    console.error(`[workspace] Failed to sync manifest for ${projectId}:`, err);
    // Continue with teardown even if sync fails — DB still has last checkpoint
  }

  // 3. Clean up
  clearIdleTimer(projectId);
  bundlerService.cleanup(projectId);
  await forceReleaseLock(projectId);

  // 4. Update project status
  await db.update(projects)
    .set({ workspaceStatus: 'inactive' })
    .where(eq(projects.id, projectId));

  // 5. Remove workspace directory
  try {
    await rm(workspacePath, { recursive: true, force: true });
  } catch {
    // Best effort cleanup
  }

  // 6. Notify
  await emitWorkspaceTeardown(projectId);
  activeWorkspaces.delete(projectId);
}

/**
 * Read the current manifest from a workspace.
 */
export async function readManifest(projectId: string): Promise<Manifest> {
  const manifestPath = getManifestPath(projectId);
  const json = await readFile(manifestPath, 'utf-8');
  return validateManifest(JSON.parse(json));
}

/**
 * Apply a manifest operation. Validates, writes to disk, returns updated manifest.
 */
export async function applyManifestOperation(projectId: string, op: ManifestOp): Promise<Manifest> {
  const manifest = await readManifest(projectId);
  const updated = applyManifestOp(manifest, op);
  const manifestPath = getManifestPath(projectId);
  await writeFile(manifestPath, JSON.stringify(updated, null, 2), 'utf-8');
  touchActivity(projectId);
  return updated;
}

/**
 * Create an atomic snapshot of the workspace manifest.
 * Used by the render processor to get an immutable copy that won't change
 * during export while the user continues editing.
 */
export async function snapshotManifest(projectId: string): Promise<Manifest | null> {
  if (!(await isWorkspaceActive(projectId))) {
    return null;
  }

  const manifest = await readManifest(projectId);
  // Return a deep clone so mutations to the live manifest don't affect the snapshot
  return structuredClone(manifest);
}

/**
 * Check if a workspace is currently active.
 */
export async function isWorkspaceActive(projectId: string): Promise<boolean> {
  const workspacePath = getWorkspacePath(projectId);
  try {
    await access(workspacePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Record activity on a workspace (resets idle timer).
 */
export function touchActivity(projectId: string): void {
  resetIdleTimer(projectId);
}

// ---- Internal helpers ----

function resetIdleTimer(projectId: string): void {
  clearIdleTimer(projectId);
  const idleTimer = setTimeout(async () => {
    console.log(`[workspace] Idle timeout for ${projectId}, tearing down...`);
    try {
      await tearDownWorkspace(projectId);
    } catch (err) {
      console.error(`[workspace] Idle teardown failed for ${projectId}:`, err);
    }
  }, workspaceConfig.idleTimeoutMs);
  activeWorkspaces.set(projectId, { idleTimer });
}

function clearIdleTimer(projectId: string): void {
  const entry = activeWorkspaces.get(projectId);
  if (entry) {
    clearTimeout(entry.idleTimer);
  }
}

/**
 * Sync manifest data back to DB.
 * Updates tracks, timeline items, and video settings.
 */
async function syncManifestToDb(projectId: string, manifest: Manifest): Promise<void> {
  const { tracks: manifestTracks, items: manifestItems, videoSettings } = manifestToDb(manifest);

  await db.transaction(async (tx) => {
    // Update video settings on project
    await tx.update(projects)
      .set({
        videoSettings: videoSettings as any,
        durationMs: Math.round(manifest.durationMs),
      })
      .where(eq(projects.id, projectId));

    // Sync tracks: delete existing (timeline items cascade-delete via FK)
    await tx.delete(tracks).where(eq(tracks.projectId, projectId));

    for (const t of manifestTracks) {
      await tx.insert(tracks).values({
        id: t.id,
        projectId,
        type: t.type,
        name: t.name,
        position: t.position,
        locked: false,  // Default — manifest doesn't track lock/visibility state
        visible: true,
      });
    }

    // Insert items
    for (const item of manifestItems) {
      await tx.insert(timelineItems).values({
        id: item.id,
        trackId: item.trackId,
        type: item.type,
        startMs: item.startMs,
        endMs: item.endMs,
        data: item.data as any,
      });
    }
  });
}

/**
 * Clean up orphaned workspace directories on startup.
 * After a process restart, workspace directories may exist on disk but the
 * in-memory activeWorkspaces Map is empty. These orphans will never be cleaned up
 * unless we scan and remove them at boot.
 */
export async function cleanupOrphanedWorkspaces(): Promise<void> {
  const rootDir = workspaceConfig.rootDir;
  try {
    await access(rootDir);
  } catch {
    return; // Root doesn't exist — nothing to clean
  }

  const entries = await readdir(rootDir);

  for (const entry of entries) {
    try {
      console.log(`[workspace] Cleaning up orphaned workspace: ${entry}`);
      await db.update(projects)
        .set({ workspaceStatus: 'inactive' })
        .where(eq(projects.id, entry));
      await rm(join(rootDir, entry), { recursive: true, force: true });
      await forceReleaseLock(entry);
    } catch (err) {
      console.warn(`[workspace] Failed to clean up orphaned workspace ${entry}:`, err);
    }
  }
}
