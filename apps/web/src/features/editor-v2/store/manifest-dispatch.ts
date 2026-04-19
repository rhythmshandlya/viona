import { api } from '@/lib/api';

export interface SandboxOp {
  tool: 'addTrack' | 'updateTrack' | 'removeTrack' | 'addItem' | 'updateItem' | 'removeItem' | 'splitItem' | 'updateCaptionPreset' | 'generateCaptions';
  input: Record<string, unknown>;
}

// Debounce timer for updateCaptionPreset ops (rapid style changes flood the API)
let captionPresetTimer: ReturnType<typeof setTimeout> | null = null;
let pendingCaptionPresetOp: { projectId: string; input: Record<string, unknown> } | null = null;

// Track whether we're already re-acquiring the sandbox to avoid concurrent attempts
let reacquiring: Promise<void> | null = null;

// Timestamp of the most recent user-initiated dispatch. The sandbox's
// manifest-updated WS event is hardcoded to source:'ai' regardless of origin
// (see packages/api/src/sandbox/routes.ts). When the user is actively editing,
// every one of our own writes triggers a round-trip that overwrites local
// in-flight state with a stale sandbox snapshot. Until source tagging is
// fixed upstream, the FE suppresses remote manifest updates that arrive
// within USER_OP_QUIET_MS of a local dispatch.
let lastUserDispatchTs = 0;
export const USER_OP_QUIET_MS = 2000;
export function markUserDispatch(): void {
  lastUserDispatchTs = Date.now();
}
export function isRecentUserDispatch(now: number = Date.now()): boolean {
  return now - lastUserDispatchTs < USER_OP_QUIET_MS;
}

/** Re-acquire the sandbox session when it has expired/crashed */
async function reacquireSandbox(projectId: string): Promise<boolean> {
  try {
    const result = await api.createSandbox(projectId);
    if (result.status === 'ready') return true;
    // Poll briefly for readiness
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const status = await api.getSandboxStatus(projectId);
      if (status.status === 'ready') return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Check if an error indicates the sandbox session is gone */
function isNoActiveSandbox(err: any): boolean {
  return err?.message?.includes('No active sandbox') || err?.message?.includes('Request failed: 404');
}

function flushCaptionPresetOp() {
  if (!pendingCaptionPresetOp) return;
  const { projectId, input } = pendingCaptionPresetOp;
  pendingCaptionPresetOp = null;
  markUserDispatch();
  sendOp(projectId, 'updateCaptionPreset', input).catch((err) => {
    console.error('Sandbox dispatch error: updateCaptionPreset', err);
  });
}

/** Send a single op, re-acquiring the sandbox on 404 "No active sandbox" */
async function sendOp(projectId: string, tool: string, input: Record<string, unknown>): Promise<any> {
  try {
    return await api.sandboxOps(projectId, tool, input);
  } catch (err: any) {
    if (isNoActiveSandbox(err)) {
      // Re-acquire once, then retry
      if (!reacquiring) {
        reacquiring = reacquireSandbox(projectId).then(ok => {
          reacquiring = null;
          if (!ok) throw new Error('Failed to re-acquire sandbox');
        });
      }
      await reacquiring;
      return api.sandboxOps(projectId, tool, input);
    }
    throw err;
  }
}

/**
 * Dispatch one or more granular manifest operations to the sandbox.
 * Fire-and-forget — errors are logged but not thrown.
 * updateCaptionPreset ops are debounced (300ms) to avoid flooding on rapid style changes.
 * Automatically re-acquires the sandbox if the session expired.
 */
export async function dispatchToSandbox(
  projectId: string,
  ops: SandboxOp[],
): Promise<void> {
  if (ops.length > 0) markUserDispatch();
  for (const op of ops) {
    // Debounce caption preset updates
    if (op.tool === 'updateCaptionPreset') {
      pendingCaptionPresetOp = { projectId, input: op.input };
      if (captionPresetTimer) clearTimeout(captionPresetTimer);
      captionPresetTimer = setTimeout(flushCaptionPresetOp, 300);
      continue;
    }

    // Flush pending caption preset before generateCaptions to avoid race
    if (op.tool === 'generateCaptions' && pendingCaptionPresetOp) {
      if (captionPresetTimer) clearTimeout(captionPresetTimer);
      flushCaptionPresetOp();
      // Small delay for the preset op to be processed first
      await new Promise(r => setTimeout(r, 200));
    }

    try {
      const result = await sendOp(projectId, op.tool, op.input);
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
