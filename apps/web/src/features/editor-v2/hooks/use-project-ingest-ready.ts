'use client';
import { useCallback, useEffect, useState } from 'react';
import { AssetsApi, type Asset } from '@/lib/api/assets';
import { useAssetEvents } from '@/lib/sse/useAssetEvents';

const api = new AssetsApi(process.env.NEXT_PUBLIC_API_URL ?? '');

function isAssetReady(a: Asset): boolean {
  // An asset is ready for Viona when the transcript is done (or not applicable
  // / failed — so we don't block forever on a broken clip). Metadata is a
  // strict prerequisite for transcription so checking transcriptStatus alone
  // is sufficient.
  const s = a.transcriptStatus;
  return s === 'ready' || s === 'not_applicable' || s === 'failed';
}

export interface UseProjectIngestReadyResult {
  ready: boolean;
  /** Per-asset status used by callers that want to render progress rows. */
  assets: Asset[];
  /** `true` while the initial fetch is in flight. */
  loading: boolean;
}

/**
 * Observes the ingest state of every asset linked to a project. Returns
 * `ready: true` once every asset has a terminal transcriptStatus
 * (`ready` | `not_applicable` | `failed`). Refetches on the asset-events SSE
 * stream so it picks up `metadata_ready` / `transcript_ready` / `failed`
 * events without polling.
 *
 * Consumed by `AIAssistantPanel` to hold the first `initialPrompt` until
 * Viona has all transcripts in hand — otherwise Viona tries to plan before
 * it can see what's in the clips and falls back to a theme-picker widget.
 */
export function useProjectIngestReady(projectId: string | undefined): UseProjectIngestReadyResult {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await api.listProjectAssets(projectId);
      setAssets(res.assets);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useAssetEvents({
    enabled: !!projectId,
    onEvent: (event) => {
      if (
        event.type === 'created' ||
        event.type === 'ready' ||
        event.type === 'metadata_ready' ||
        event.type === 'transcript_ready' ||
        event.type === 'linked' ||
        event.type === 'unlinked' ||
        event.type === 'failed'
      ) {
        void refresh();
      }
    },
  });

  const ready = assets.length > 0 && assets.every(isAssetReady);
  return { ready, assets, loading };
}
