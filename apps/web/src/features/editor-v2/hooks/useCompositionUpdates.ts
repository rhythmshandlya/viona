'use client';

/**
 * PR-C2 Task 6
 *
 * Bridges the asset-system-v2 composition into the editor store:
 *   - on mount (when NEXT_PUBLIC_ASSET_SYSTEM_V2=true), fetches the resolved
 *     composition and applies it once so the timeline reflects server state
 *     immediately after loadProject.
 *   - listens for `window.editor:composition-updated` events dispatched from
 *     the AIAssistantPanel SSE handler (Task 5) and re-applies on each.
 *
 * Non-invasive: loadProject's existing sandbox-manifest flow still runs.
 * This hook augments it with composition-v2 data when the feature flag is on.
 */

import { useEffect } from 'react';
import { CompositionApi, type Composition } from '@/lib/api/composition';
import { isAssetSystemV2 } from '@/lib/feature-flags';
import { useApplyCompositionV2 } from '../store/use-editor-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// One shared client is enough — the API is stateless and the baseUrl is fixed.
const compositionApi = new CompositionApi(API_URL);

export function useCompositionUpdates(projectId: string): void {
  const applyCompositionV2 = useApplyCompositionV2();

  // Initial fetch on mount when the flag is enabled. Only merge if the
  // composition is non-empty so we never blow away the legacy timeline that
  // loadProject populated.
  useEffect(() => {
    if (!projectId) return;
    if (!isAssetSystemV2()) return;

    let cancelled = false;
    (async () => {
      try {
        const composition = await compositionApi.getComposition(projectId);
        if (cancelled) return;
        if (composition.timelineItems.length === 0 && composition.tracks.length === 0) {
          return;
        }
        applyCompositionV2(composition);
      } catch (err) {
        console.error('[useCompositionUpdates] initial fetch failed', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, applyCompositionV2]);

  // SSE-triggered refetches from Task 5. The AIAssistantPanel fetches the
  // composition itself, then emits this custom event so we stay decoupled
  // from the SSE transport.
  useEffect(() => {
    if (!projectId) return;

    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ composition: Composition; projectId: string }>;
      if (!custom.detail) return;
      if (custom.detail.projectId !== projectId) return;
      applyCompositionV2(custom.detail.composition);
    };

    window.addEventListener('editor:composition-updated', handler);
    return () => window.removeEventListener('editor:composition-updated', handler);
  }, [projectId, applyCompositionV2]);
}
