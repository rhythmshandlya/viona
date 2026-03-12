/**
 * Manifest editing tools for the Creative Director AI agent.
 * Each tool applies a validated ManifestOp to the workspace manifest.
 */
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { readManifest, applyManifestOperation, isWorkspaceActive } from '../workspace/workspace-service.js';
import { acquireLock, getLockInfo } from '../workspace/workspace-lock.js';
import { emitManifestUpdated } from '../workspace/workspace-ws.js';
import type { ToolContext } from './agent-tools.js';

/** Ensure workspace is active and AI holds the edit lock. */
async function ensureWorkspaceAndLock(projectId: string): Promise<{ error?: string }> {
  if (!(await isWorkspaceActive(projectId))) {
    return { error: 'No active workspace. The project must be opened in the editor first.' };
  }

  // Check if AI already holds the lock
  const lockInfo = await getLockInfo(projectId);
  if (lockInfo && lockInfo.holder === 'ai') {
    return {}; // Already holding
  }

  // Try to acquire
  const acquired = await acquireLock(projectId, 'ai');
  if (!acquired) {
    const current = await getLockInfo(projectId);
    return { error: `Edit lock held by ${current?.holder || 'unknown'}. Wait for the current edit to finish.` };
  }

  return {};
}

function errorResult(message: string) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
  };
}

function successResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
  };
}

/**
 * Create manifest editing tools for the Creative Director.
 * Returns an array of tool definitions to be included in the MCP server.
 */
export function createManifestTools(ctx: ToolContext) {
  return [
    // ---- read_manifest ----
    tool(
      'read_manifest',
      'Read the current workspace manifest to understand the timeline structure — tracks, items (visuals, captions, video, audio), layout settings, caption style, and video settings. Use this before making edits to understand what exists.',
      {},
      async () => {
        if (!(await isWorkspaceActive(ctx.projectId))) {
          return errorResult('No active workspace.');
        }

        const manifest = await readManifest(ctx.projectId);
        return successResult({
          manifest,
          summary: {
            trackCount: manifest.tracks.length,
            itemCount: manifest.items.length,
            visualCount: manifest.items.filter(i => i.type === 'visual').length,
            captionCount: manifest.items.filter(i => i.type === 'caption').length,
            durationMs: manifest.durationMs,
            layoutMode: manifest.layout.mode,
            fps: manifest.fps,
          },
        });
      },
    ),

    // ---- set_layout ----
    tool(
      'set_layout',
      'Change the layout mode and settings. Mode can be "stacked" (video and visuals side by side) or "pip" (speaker in a floating bubble). When switching to pip, you can set position, size, shape, etc.',
      {
        mode: z.enum(['stacked', 'pip']).optional().describe('Layout mode'),
        split: z.object({
          position: z.enum(['visuals-first', 'video-first']).optional(),
          ratio: z.number().min(0).max(100).optional(),
          gap: z.number().min(0).optional(),
        }).optional().describe('Split settings for stacked mode'),
        pip: z.object({
          position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).optional(),
          size: z.number().min(5).max(50).optional().describe('PiP bubble size as % of canvas width'),
          shape: z.enum(['square', 'circle', 'rounded']).optional(),
          borderRadius: z.number().optional(),
          borderWidth: z.number().optional(),
          borderColor: z.string().optional(),
          opacity: z.number().min(0).max(1).optional(),
        }).optional().describe('PiP settings (only used when mode is pip)'),
      },
      async ({ mode, split, pip }) => {
        const lockCheck = await ensureWorkspaceAndLock(ctx.projectId);
        if (lockCheck.error) return errorResult(lockCheck.error);

        const layout: Record<string, unknown> = {};
        if (mode) layout.mode = mode;
        if (split) layout.split = split;
        if (pip) layout.pip = pip;

        try {
          const updated = await applyManifestOperation(ctx.projectId, {
            op: 'set_layout',
            layout,
          });
          await emitManifestUpdated(ctx.projectId, { source: 'ai', ops: [{ op: 'set_layout', layout }] });
          return successResult({ layoutMode: updated.layout.mode, layout: updated.layout });
        } catch (err: any) {
          return errorResult(err.message);
        }
      },
    ),

    // ---- set_display_mode ----
    tool(
      'set_display_mode',
      'Change how a visual item composites with the speaker video. "default" follows the global layout mode. "fullscreen" hides the video — visuals fill the entire canvas. "overlay" renders visuals on top of the video.',
      {
        itemId: z.string().describe('The visual item ID to change'),
        displayMode: z.enum(['default', 'fullscreen', 'overlay']).describe('New display mode'),
      },
      async ({ itemId, displayMode }) => {
        const lockCheck = await ensureWorkspaceAndLock(ctx.projectId);
        if (lockCheck.error) return errorResult(lockCheck.error);

        try {
          const op = { op: 'set_display_mode' as const, itemId, displayMode };
          await applyManifestOperation(ctx.projectId, op);
          await emitManifestUpdated(ctx.projectId, { source: 'ai', ops: [op] });
          return successResult({ itemId, displayMode, applied: true });
        } catch (err: any) {
          return errorResult(err.message);
        }
      },
    ),

    // ---- set_transition ----
    tool(
      'set_transition',
      'Set enter/exit transitions on a visual item. Transitions create smooth visual changes between scenes. Types: "cut" (instant), "crossfade" (opacity blend), "slide-left", "slide-up", "zoom", "morph", "fade".',
      {
        itemId: z.string().describe('The visual item ID'),
        enter: z.object({
          type: z.enum(['cut', 'crossfade', 'slide-left', 'slide-up', 'zoom', 'morph', 'fade']),
          durationMs: z.number().min(0).max(2000).describe('Transition duration in ms (0 = instant)'),
        }).optional().describe('Enter transition'),
        exit: z.object({
          type: z.enum(['cut', 'crossfade', 'slide-left', 'slide-up', 'zoom', 'morph', 'fade']),
          durationMs: z.number().min(0).max(2000).describe('Transition duration in ms (0 = instant)'),
        }).optional().describe('Exit transition'),
      },
      async ({ itemId, enter, exit }) => {
        const lockCheck = await ensureWorkspaceAndLock(ctx.projectId);
        if (lockCheck.error) return errorResult(lockCheck.error);

        try {
          const op = { op: 'set_transition' as const, itemId, enter, exit };
          await applyManifestOperation(ctx.projectId, op);
          await emitManifestUpdated(ctx.projectId, { source: 'ai', ops: [op] });
          return successResult({ itemId, enter, exit, applied: true });
        } catch (err: any) {
          return errorResult(err.message);
        }
      },
    ),

    // ---- move_item ----
    tool(
      'move_item',
      'Change the timing of a timeline item (visual, caption, audio, etc.). Sets new start and end times in milliseconds.',
      {
        itemId: z.string().describe('The item ID to move'),
        startMs: z.number().min(0).describe('New start time in ms'),
        endMs: z.number().min(0).describe('New end time in ms'),
      },
      async ({ itemId, startMs, endMs }) => {
        const lockCheck = await ensureWorkspaceAndLock(ctx.projectId);
        if (lockCheck.error) return errorResult(lockCheck.error);

        if (endMs <= startMs) {
          return errorResult('endMs must be greater than startMs');
        }

        try {
          const op = { op: 'move_item' as const, itemId, startMs, endMs };
          await applyManifestOperation(ctx.projectId, op);
          await emitManifestUpdated(ctx.projectId, { source: 'ai', ops: [op] });
          return successResult({ itemId, startMs, endMs, applied: true });
        } catch (err: any) {
          return errorResult(err.message);
        }
      },
    ),

    // ---- update_caption_style ----
    tool(
      'update_caption_style',
      'Change caption/subtitle styling — font, colors, animation, position, effects, display mode. Partial updates are merged with existing style.',
      {
        fontFamily: z.string().optional(),
        fontSize: z.number().min(8).max(200).optional(),
        fontWeight: z.number().min(100).max(900).optional(),
        color: z.string().optional().describe('Text color (hex)'),
        activeColor: z.string().optional().describe('Active/highlighted word color (hex)'),
        backgroundColor: z.string().optional().describe('Word background color'),
        activeBackgroundColor: z.string().optional().describe('Active word background color'),
        displayMode: z.enum(['word-by-word', 'phrase', 'karaoke']).optional(),
        wordsPerPhrase: z.number().min(1).max(10).optional(),
        animation: z.object({
          in: z.string(),
          active: z.string(),
          out: z.string(),
          easing: z.string(),
        }).optional().describe('Caption animation config'),
        position: z.object({
          anchor: z.enum(['top', 'center', 'bottom']).optional(),
          offsetX: z.number().optional(),
          offsetY: z.number().optional(),
          textAlign: z.enum(['left', 'center', 'right']).optional(),
        }).optional().describe('Caption position on screen'),
      },
      async (updates) => {
        const lockCheck = await ensureWorkspaceAndLock(ctx.projectId);
        if (lockCheck.error) return errorResult(lockCheck.error);

        // Filter out undefined values
        const cleanUpdates: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
          if (value !== undefined) cleanUpdates[key] = value;
        }

        try {
          const op = { op: 'update_caption_style' as const, updates: cleanUpdates };
          const updated = await applyManifestOperation(ctx.projectId, op);
          await emitManifestUpdated(ctx.projectId, { source: 'ai', ops: [op] });
          return successResult({ captionStyle: updated.captionStyle, applied: true });
        } catch (err: any) {
          return errorResult(err.message);
        }
      },
    ),

    // ---- split_scene ----
    tool(
      'split_scene',
      'Split a visual item at a given timestamp. Creates two items from one — the second half automatically gets a frameOffset so the scene animation continues from where it was split.',
      {
        itemId: z.string().describe('The visual item ID to split'),
        atMs: z.number().min(0).describe('Timestamp in ms to split at (must be between item start and end)'),
      },
      async ({ itemId, atMs }) => {
        const lockCheck = await ensureWorkspaceAndLock(ctx.projectId);
        if (lockCheck.error) return errorResult(lockCheck.error);

        try {
          const op = { op: 'split_item' as const, itemId, atMs };
          const updated = await applyManifestOperation(ctx.projectId, op);
          await emitManifestUpdated(ctx.projectId, { source: 'ai', ops: [op] });

          // Report the two halves — original (trimmed) and new (with frameOffset).
          // Use position-based detection: applyManifestOp splices the second half
          // immediately after the first in the items array.
          const firstIdx = updated.items.findIndex(i => i.id === itemId);
          const firstHalf = firstIdx >= 0 ? updated.items[firstIdx] : null;
          const secondHalf = firstIdx >= 0 ? updated.items[firstIdx + 1] : null;

          return successResult({
            applied: true,
            splitAt: atMs,
            firstHalf: firstHalf ? { id: firstHalf.id, startMs: firstHalf.startMs, endMs: firstHalf.endMs } : null,
            secondHalf: secondHalf ? { id: secondHalf.id, startMs: secondHalf.startMs, endMs: secondHalf.endMs } : null,
          });
        } catch (err: any) {
          return errorResult(err.message);
        }
      },
    ),

    // ---- delete_item ----
    tool(
      'delete_item',
      'Remove an item from the timeline. Use with caution — this permanently removes the item from the manifest.',
      {
        itemId: z.string().describe('The item ID to delete'),
      },
      async ({ itemId }) => {
        const lockCheck = await ensureWorkspaceAndLock(ctx.projectId);
        if (lockCheck.error) return errorResult(lockCheck.error);

        try {
          // Read manifest first to report what was deleted
          const before = await readManifest(ctx.projectId);
          const deletedItem = before.items.find(i => i.id === itemId);

          const op = { op: 'delete_item' as const, itemId };
          await applyManifestOperation(ctx.projectId, op);
          await emitManifestUpdated(ctx.projectId, { source: 'ai', ops: [op] });

          return successResult({
            applied: true,
            deleted: deletedItem ? {
              id: deletedItem.id,
              type: deletedItem.type,
              startMs: deletedItem.startMs,
              endMs: deletedItem.endMs,
            } : { id: itemId },
          });
        } catch (err: any) {
          return errorResult(err.message);
        }
      },
    ),

    // ---- reorder_scenes ----
    tool(
      'reorder_scenes',
      'Reorder visual items on the timeline by providing ALL visual item IDs in the desired order. Items are repositioned sequentially with no gaps. You must include every visual item ID.',
      {
        itemIds: z.array(z.string()).describe('ALL visual item IDs in the desired order'),
      },
      async ({ itemIds }) => {
        const lockCheck = await ensureWorkspaceAndLock(ctx.projectId);
        if (lockCheck.error) return errorResult(lockCheck.error);

        try {
          // Read current manifest to get visual items
          const manifest = await readManifest(ctx.projectId);
          const visualItems = manifest.items.filter(i => i.type === 'visual');

          // Require ALL visual items to be included
          if (itemIds.length !== visualItems.length) {
            return errorResult(
              `Must include all ${visualItems.length} visual items. Got ${itemIds.length}. ` +
              `Visual IDs: ${visualItems.map(i => i.id).join(', ')}`
            );
          }

          // Validate all IDs are visual items
          for (const id of itemIds) {
            if (!visualItems.find(i => i.id === id)) {
              return errorResult(`Item ${id} is not a visual item or doesn't exist`);
            }
          }

          // Apply all move_item ops sequentially — each reads/writes manifest.
          // We read durations from the initial snapshot; durations don't change
          // across repositioning, so using the original values is correct.
          const ops = [];
          let currentMs = Math.min(...visualItems.map(i => i.startMs));

          for (const id of itemIds) {
            const item = visualItems.find(i => i.id === id)!;
            const durationMs = item.endMs - item.startMs;
            const op = { op: 'move_item' as const, itemId: id, startMs: currentMs, endMs: currentMs + durationMs };
            await applyManifestOperation(ctx.projectId, op);
            ops.push(op);
            currentMs += durationMs;
          }

          await emitManifestUpdated(ctx.projectId, { source: 'ai', ops });
          return successResult({
            applied: true,
            order: itemIds,
            message: `Reordered ${itemIds.length} visual items`,
          });
        } catch (err: any) {
          return errorResult(err.message);
        }
      },
    ),
  ];
}
