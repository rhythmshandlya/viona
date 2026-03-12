/**
 * Hook for workspace-level WebSocket events.
 * These events are routed by projectId (not job subscription).
 * Uses the singleton wsClient from @/lib/ws.
 */
import { useEffect, useRef } from 'react';
import {
  wsClient,
  WSMessage,
  WorkspaceReadyPayload,
  ManifestUpdatedPayload,
  BundleReadyPayload,
  BundleErrorPayload,
  WorkspaceLockPayload,
  WorkspaceTeardownPayload,
} from '@/lib/ws';

interface WorkspaceWSHandlers {
  onWorkspaceReady?: (data: WorkspaceReadyPayload) => void;
  onManifestUpdated?: (data: ManifestUpdatedPayload) => void;
  onBundleReady?: (data: BundleReadyPayload) => void;
  onBundleError?: (data: BundleErrorPayload) => void;
  onLockAcquired?: (data: WorkspaceLockPayload) => void;
  onLockReleased?: (data: WorkspaceLockPayload) => void;
  onWorkspaceTeardown?: (data: WorkspaceTeardownPayload) => void;
}

export function useWorkspaceWS(
  projectId: string | null,
  handlers: WorkspaceWSHandlers,
) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!projectId) return;

    const removeHandler = wsClient.addHandler((message: WSMessage) => {
      const h = handlersRef.current;
      switch (message.type) {
        case 'workspace:ready':
          h.onWorkspaceReady?.(message.payload as WorkspaceReadyPayload);
          break;
        case 'manifest:updated':
          h.onManifestUpdated?.(message.payload as ManifestUpdatedPayload);
          break;
        case 'bundle:ready':
          h.onBundleReady?.(message.payload as BundleReadyPayload);
          break;
        case 'bundle:error':
          h.onBundleError?.(message.payload as BundleErrorPayload);
          break;
        case 'workspace:lock_acquired':
          h.onLockAcquired?.(message.payload as WorkspaceLockPayload);
          break;
        case 'workspace:lock_released':
          h.onLockReleased?.(message.payload as WorkspaceLockPayload);
          break;
        case 'workspace:teardown':
          h.onWorkspaceTeardown?.(message.payload as WorkspaceTeardownPayload);
          break;
      }
    });

    return removeHandler;
  }, [projectId]);
}
