'use client';
import { useEffect, useState, useCallback, type ReactElement } from 'react';
import { AssetsApi, type Asset } from '@/lib/api/assets';
import { useAssetEvents } from '@/lib/sse/useAssetEvents';

const api = new AssetsApi(process.env.NEXT_PUBLIC_API_URL ?? '');

type Tab = 'project' | 'library';

export interface AssetsPanelV2Props {
  projectId: string;
}

/** Format ms as M:SS. Returns null when duration is missing so callers can
 *  conditionally render the badge. */
function formatDuration(ms: number | null | undefined): string | null {
  if (ms == null) return null;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Short MIME-type placeholder text shown when no thumbnail is available. */
function mimeTypeLabel(mimeType: string): string {
  if (mimeType.startsWith('video/')) return 'VID';
  if (mimeType.startsWith('audio/')) return 'AUD';
  if (mimeType.startsWith('image/')) return 'IMG';
  return 'FILE';
}

export function AssetsPanelV2({ projectId }: AssetsPanelV2Props): ReactElement {
  const [tab, setTab] = useState<Tab>('project');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = tab === 'project'
        ? await api.listProjectAssets(projectId)
        : await api.listUserAssets();
      setAssets(res.assets);
    } finally {
      setLoading(false);
    }
  }, [tab, projectId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useAssetEvents({
    enabled: true,
    onEvent: (event) => {
      if (
        event.type === 'created' || event.type === 'ready' ||
        event.type === 'metadata_ready' || event.type === 'linked' ||
        event.type === 'unlinked' || event.type === 'renamed' ||
        event.type === 'deleted'
      ) {
        void refresh();
      }
    },
  });

  return (
    <div className="flex h-full flex-col">
      <div role="tablist" className="flex border-b">
        <button
          role="tab"
          aria-selected={tab === 'project'}
          onClick={() => setTab('project')}
          className={`flex-1 px-3 py-2 text-sm ${tab === 'project' ? 'font-semibold border-b-2' : 'text-muted-foreground'}`}
        >
          Project
        </button>
        <button
          role="tab"
          aria-selected={tab === 'library'}
          onClick={() => setTab('library')}
          className={`flex-1 px-3 py-2 text-sm ${tab === 'library' ? 'font-semibold border-b-2' : 'text-muted-foreground'}`}
        >
          Library
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loading && <div className="text-xs text-muted-foreground">Loading…</div>}
        {!loading && assets.length === 0 && (
          <div className="text-xs text-muted-foreground">
            {tab === 'project' ? 'No assets in this project yet.' : 'Your library is empty.'}
          </div>
        )}
        <ul className="flex flex-col gap-1">
          {assets.map((a) => {
            const duration = formatDuration(a.durationMs);
            return (
              <li
                key={a.id}
                data-testid={`asset-tile-${a.id}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-project-asset', JSON.stringify({
                    id: a.id,
                    mimeType: a.mimeType,
                    filename: a.filename,
                    label: a.label,
                    durationMs: a.durationMs,
                  }));
                }}
                className="rounded border cursor-grab hover:bg-accent"
              >
                <div className="flex items-center gap-2 px-2 py-1">
                  {a.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.thumbnailUrl}
                      alt=""
                      className="h-8 w-12 rounded object-cover flex-shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-8 w-12 rounded bg-muted flex-shrink-0 flex items-center justify-center text-[10px] text-muted-foreground">
                      {mimeTypeLabel(a.mimeType)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm">{a.filename}</div>
                  </div>
                  {duration && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {duration}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
