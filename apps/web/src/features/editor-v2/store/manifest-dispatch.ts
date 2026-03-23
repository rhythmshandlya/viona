import { api } from '@/lib/api';

export interface SandboxOp {
  tool: 'addTrack' | 'updateTrack' | 'removeTrack' | 'addItem' | 'updateItem' | 'removeItem' | 'splitItem' | 'updateCaptionPreset' | 'generateCaptions';
  input: Record<string, unknown>;
}

// Debounce timer for updateCaptionPreset ops (rapid style changes flood the API)
let captionPresetTimer: ReturnType<typeof setTimeout> | null = null;
let pendingCaptionPresetOp: { projectId: string; input: Record<string, unknown> } | null = null;

function flushCaptionPresetOp() {
  if (!pendingCaptionPresetOp) return;
  const { projectId, input } = pendingCaptionPresetOp;
  pendingCaptionPresetOp = null;
  api.sandboxOps(projectId, 'updateCaptionPreset', input).catch((err) => {
    console.error('Sandbox dispatch error: updateCaptionPreset', err);
  });
}

/**
 * Dispatch one or more granular manifest operations to the sandbox.
 * Fire-and-forget — errors are logged but not thrown.
 * updateCaptionPreset ops are debounced (300ms) to avoid flooding on rapid style changes.
 */
export async function dispatchToSandbox(
  projectId: string,
  ops: SandboxOp[],
): Promise<void> {
  for (const op of ops) {
    // Debounce caption preset updates
    if (op.tool === 'updateCaptionPreset') {
      pendingCaptionPresetOp = { projectId, input: op.input };
      if (captionPresetTimer) clearTimeout(captionPresetTimer);
      captionPresetTimer = setTimeout(flushCaptionPresetOp, 300);
      continue;
    }

    try {
      const result = await api.sandboxOps(projectId, op.tool, op.input);
      if (!result.ok) {
        console.error(`Sandbox op failed: ${op.tool}`, result.error);
      }
    } catch (err: any) {
      // Removals are idempotent — "not found" means the item/track is already gone
      const isRemove = op.tool === 'removeItem' || op.tool === 'removeTrack';
      const isNotFound = err?.message?.includes('not found') || err?.message?.includes('Not found');
      if (isRemove && isNotFound) {
        // Desired state achieved — silently ignore
        return;
      }
      console.error(`Sandbox dispatch error: ${op.tool}`, err);
    }
  }
}
