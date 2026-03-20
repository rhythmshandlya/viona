import { api } from '@/lib/api';

export interface SandboxOp {
  tool: 'addTrack' | 'updateTrack' | 'removeTrack' | 'addItem' | 'updateItem' | 'removeItem' | 'splitItem' | 'updateCaptionStyle' | 'generateCaptions';
  input: Record<string, unknown>;
}

/**
 * Dispatch one or more granular manifest operations to the sandbox.
 * Fire-and-forget — errors are logged but not thrown.
 * For batch ops, sends sequentially (sandbox mutex handles serialization).
 */
export async function dispatchToSandbox(
  projectId: string,
  ops: SandboxOp[],
): Promise<void> {
  for (const op of ops) {
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
