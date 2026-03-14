/**
 * Scene/layout/asset context building for edit-visuals.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { db, projectAssets } from '../../db/index.js';
import { downloadFile } from '../../services/minio.js';
import { logger } from '../../logger.js';
import { getWorkspacePath } from '../../workspace.js';
import type { ExtractedAsset } from './types.js';

/**
 * Extract assets from the composition.
 * Reads scenes.json and parses layout information to create a list of editable assets.
 */
export async function extractAssets(projectDir: string): Promise<ExtractedAsset[]> {
  const assets: ExtractedAsset[] = [];

  try {
    const scenesPath = join(projectDir, 'scenes.json');
    const scenesContent = await readFile(scenesPath, 'utf-8');
    const scenesData = JSON.parse(scenesContent);

    // V2: segments with nested beats (check before v1)
    if (scenesData.version >= 2 && scenesData.segments) {
      for (const segment of scenesData.segments) {
        const segmentId = segment.id;
        const segmentName = segment.layout || `Segment ${segmentId}`;

        for (const beat of (segment.beats || [])) {
          const beatId = beat.id;
          const beatName = beat.name || `Beat ${beatId}`;

          if (beat.layout && typeof beat.layout === 'object') {
            for (const [key, value] of Object.entries(beat.layout as Record<string, any>)) {
              if (key === 'background') continue;

              let assetType: ExtractedAsset['type'] = 'element';
              const lowerKey = key.toLowerCase();
              if (lowerKey.includes('text') || lowerKey.includes('title') || lowerKey.includes('label')) {
                assetType = 'text';
              } else if (lowerKey.includes('icon')) {
                assetType = 'icon';
              } else if (lowerKey.includes('shape') || lowerKey.includes('circle') || lowerKey.includes('rect')) {
                assetType = 'shape';
              } else if (lowerKey.includes('particle') || lowerKey.includes('bg')) {
                assetType = 'background';
              }

              assets.push({
                id: `seg${segmentId}-beat${beatId}-${key}`,
                name: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim(),
                type: assetType,
                sceneId: beatId,
                sceneName: `${segmentName} / ${beatName}`,
                description: beat.visual || beatName,
                position: value?.x || value?.y ? { x: value.x || 'center', y: value.y || '50%' } : undefined,
                size: value?.width || value?.height ? { width: value.width || 'auto', height: value.height || 'auto' } : undefined,
              });
            }
          }
        }
      }

      const assetsPath = join(projectDir, 'assets.json');
      await writeFile(assetsPath, JSON.stringify({ assets, extractedAt: new Date().toISOString() }, null, 2));
      logger.info({ projectDir, assetCount: assets.length }, 'Extracted assets from v2 composition');
      return assets;
    }

    if (!scenesData.scenes || !Array.isArray(scenesData.scenes)) {
      return assets;
    }

    for (const scene of scenesData.scenes) {
      const sceneId = scene.id;
      const sceneName = scene.name || `Scene ${sceneId}`;

      if (scene.layout && typeof scene.layout === 'object') {
        for (const [key, value] of Object.entries(scene.layout as Record<string, any>)) {
          if (key === 'background') continue;

          let assetType: ExtractedAsset['type'] = 'element';
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes('text') || lowerKey.includes('title') || lowerKey.includes('label')) {
            assetType = 'text';
          } else if (lowerKey.includes('icon')) {
            assetType = 'icon';
          } else if (lowerKey.includes('shape') || lowerKey.includes('circle') || lowerKey.includes('rect')) {
            assetType = 'shape';
          } else if (lowerKey.includes('particle') || lowerKey.includes('bg')) {
            assetType = 'background';
          }

          assets.push({
            id: `scene${sceneId}-${key}`,
            name: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim(),
            type: assetType,
            sceneId,
            sceneName,
            description: scene.visual || sceneName,
            position: value?.x || value?.y ? { x: value.x || 'center', y: value.y || '50%' } : undefined,
            size: value?.width || value?.height ? { width: value.width || 'auto', height: value.height || 'auto' } : undefined,
          });
        }
      }
    }

    const assetsPath = join(projectDir, 'assets.json');
    await writeFile(assetsPath, JSON.stringify({ assets, extractedAt: new Date().toISOString() }, null, 2));
    logger.info({ projectDir, assetCount: assets.length }, 'Extracted assets from composition');

  } catch (error) {
    logger.warn({ projectDir, error }, 'Failed to extract assets');
  }

  return assets;
}

/**
 * Build display-mode-specific layout rules for the edit agent.
 * Mirrors the logic from animator.py's _build_default_rules() so the
 * edit agent knows the exact dimensional constraints of each scene.
 */
export async function buildLayoutContext(
  projectDir: string,
  targetSceneId: number | undefined,
  canvasWidth: number,
  canvasHeight: number,
): Promise<string> {
  try {
    const scenesPath = join(projectDir, 'scenes.json');
    const scenesContent = await readFile(scenesPath, 'utf-8');
    const scenesData = JSON.parse(scenesContent);

    // v2 projects use segments instead of scenes
    if (scenesData.version >= 2 && scenesData.segments) {
      return buildV2LayoutContext(scenesData, targetSceneId, canvasWidth, canvasHeight);
    }

    if (!scenesData.scenes || !Array.isArray(scenesData.scenes)) {
      return '';
    }

    // If targeting a specific scene, build rules for just that scene
    if (targetSceneId) {
      const scene = scenesData.scenes.find((s: any) => s.id === targetSceneId);
      if (!scene) return '';

      const eff = scene.effectiveDimensions || { width: canvasWidth, height: canvasHeight };
      const ew = eff.width;
      const eh = eff.height;
      const displayMode = scene.displayMode || 'default';

      return buildRulesForMode(displayMode, canvasWidth, canvasHeight, ew, eh);
    }

    // No target scene — summarize all unique display modes present
    const modeMap = new Map<string, { ew: number; eh: number; sceneIds: number[] }>();
    for (const scene of scenesData.scenes) {
      const eff = scene.effectiveDimensions || { width: canvasWidth, height: canvasHeight };
      const dm = scene.displayMode || 'default';
      const key = `${dm}:${eff.width}x${eff.height}`;
      if (!modeMap.has(key)) {
        modeMap.set(key, { ew: eff.width, eh: eff.height, sceneIds: [] });
      }
      modeMap.get(key)!.sceneIds.push(scene.id);
    }

    const sections: string[] = [];
    for (const [key, { ew, eh, sceneIds }] of modeMap) {
      const dm = key.split(':')[0];
      sections.push(`Scenes ${sceneIds.join(', ')}:\n${buildRulesForMode(dm, canvasWidth, canvasHeight, ew, eh)}`);
    }
    return sections.join('\n');
  } catch {
    return '';
  }
}

export function buildRulesForMode(
  displayMode: string,
  canvasWidth: number,
  canvasHeight: number,
  ew: number,
  eh: number,
): string {
  if (displayMode === 'overlay') {
    return `LAYOUT & DIMENSION RULES:
Canvas: ${canvasWidth}x${canvasHeight} | Scene effective area: ${ew}x${eh} | Display mode: overlay
- Transparent background — ZERO backgroundColor or Background component.
- Speaker is fullscreen. Your visuals float ON TOP.
- Max 1-3 elements. Subtle animations only (damping >= 28).
- Position content in corners/edges, avoiding speaker's face area.
- All sizes relative to EW/EH (const EW = ${ew}, EH = ${eh}). NEVER hardcoded pixels.
- Clipping container: <div style={{ position: 'absolute', top: 0, left: 0, width: EW, height: EH, overflow: 'hidden' }}>`;
  }

  if (displayMode === 'fullscreen') {
    return `LAYOUT & DIMENSION RULES:
Canvas: ${canvasWidth}x${canvasHeight} | Scene effective area: ${ew}x${eh} | Display mode: fullscreen
- Full ${ew}x${eh} canvas. Speaker is HIDDEN.
- Vertical stacking: title top 20%, primary content middle 50%, supporting bottom 25%.
- All sizes relative to EW/EH (const EW = ${ew}, EH = ${eh}). NEVER hardcoded pixels.
- Clipping container required with overflow: 'hidden'.`;
  }

  // Default mode — check if stacked (compact) or PiP (full portrait)
  const isCompact = eh < ew * 1.2;

  if (isCompact) {
    return `LAYOUT & DIMENSION RULES:
Canvas: ${canvasWidth}x${canvasHeight} | Scene effective area: ${ew}x${eh} | Display mode: default (STACKED — nearly square)
- This scene renders in the TOP HALF. Speaker video appears below.
- VERTICAL space is SCARCE — only ${eh}px of height!
- Use HORIZONTAL layouts: title + content side-by-side, or compact title above wide content below.
- Title font: EH * 0.05 to EH * 0.07 (NOT the large EH * 0.10 used in fullscreen).
- Cards: WIDE (EW * 0.85) and SHORT (EH * 0.3 max). Think "dashboard widget", not "full phone screen".
- Max 3 attention-grabbing elements + subtle ambient.
- All sizes relative to EW/EH (const EW = ${ew}, EH = ${eh}). NEVER hardcoded pixels.
- Clipping container: <div style={{ position: 'absolute', top: 0, left: 0, width: EW, height: EH, overflow: 'hidden' }}>`;
  }

  return `LAYOUT & DIMENSION RULES:
Canvas: ${canvasWidth}x${canvasHeight} | Scene effective area: ${ew}x${eh} | Display mode: default (PIP — full portrait)
- Full portrait canvas. Speaker PiP bubble floats in bottom-right corner.
- Design for TALL portrait — stack content vertically.
- Bottom-right ~15%: avoid placing critical content (PiP bubble overlaps).
- All sizes relative to EW/EH (const EW = ${ew}, EH = ${eh}). NEVER hardcoded pixels.
- Clipping container required with overflow: 'hidden'.`;
}

/**
 * Build layout context for v2 projects (segments-based).
 */
function buildV2LayoutContext(
  scenesJson: any,
  targetSegmentId: number | undefined,
  canvasWidth: number,
  canvasHeight: number,
): string {
  const segments = scenesJson.segments || [];
  const lines = ['COMPOSITION LAYOUT (v2 — AI-generated Composition.tsx):'];

  for (const seg of segments) {
    const [startF, endF] = seg.frames;
    const dur = endF - startF;
    const marker = targetSegmentId === seg.id ? ' ← TARGET' : '';
    lines.push(`  Segment ${seg.id}: ${seg.layout} | frames ${startF}–${endF} (${dur}f) | ${seg.beats?.length || 0} beats${marker}`);
    if (seg.layoutProps && Object.keys(seg.layoutProps).length > 0) {
      lines.push(`    Props: ${JSON.stringify(seg.layoutProps)}`);
    }
  }

  lines.push(`  Canvas: ${canvasWidth}×${canvasHeight}`);
  lines.push('  Layout is defined in Composition.tsx (AI-generated). Animation content is in segments/SegmentN.tsx files.');

  return lines.join('\n');
}

/**
 * Inject user-uploaded assets into the workspace for the Animator to use.
 */
export async function injectUserAssets(projectId: string, projectDir: string): Promise<number> {
  const workspacePath = getWorkspacePath();
  const assets = await db.select().from(projectAssets)
    .where(eq(projectAssets.projectId, projectId));

  if (assets.length === 0) return 0;

  const userAssetsDir = join(workspacePath, 'public', 'assets', 'user');
  await mkdir(userAssetsDir, { recursive: true });

  const manifest: { assets: Array<{ filename: string; label: string; contentType: string; remotionPath: string }> } = { assets: [] };

  for (const asset of assets) {
    const extMatch = asset.filename.match(/\.[^.]+$/);
    const extPart = extMatch ? extMatch[0] : '';
    const basePart = asset.filename.replace(/\.[^.]+$/, '').replace(/[^\w.-]/g, '_');
    const safeFilename = `${basePart}_${asset.id.slice(0, 8)}${extPart}`;
    const destPath = join(userAssetsDir, safeFilename);
    try {
      await downloadFile('uploads', asset.storageKey, destPath);
      manifest.assets.push({
        filename: safeFilename,
        label: asset.label || asset.filename.replace(/\.[^.]+$/, ''),
        contentType: asset.contentType,
        remotionPath: `assets/user/${safeFilename}`,
      });
    } catch (err) {
      logger.warn({ err, assetId: asset.id, storageKey: asset.storageKey }, 'Failed to download user asset');
    }
  }

  const manifestPath = join(projectDir, 'user_assets.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  logger.info({ projectId, assetCount: manifest.assets.length }, 'Injected user assets into workspace');

  return manifest.assets.length;
}
