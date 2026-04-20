'use client';
import { useEffect, useState, useCallback, type ReactElement } from 'react';
import { AssetsApi, type Asset } from '@/lib/api/assets';
import { useAssetEvents } from '@/lib/sse/useAssetEvents';

const api = new AssetsApi(process.env.NEXT_PUBLIC_API_URL ?? '');

type Tab = 'project' | 'library';

export interface AssetsPanelV2Props {
  projectId: string;
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

  // Task 7 wires this more fully; stub subscription here so the hook-mock in tests runs.
  useAssetEvents({
    enabled: false,  // turned on in Task 7
    onEvent: () => {},
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
          {assets.map((a) => (
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
              className="rounded border px-2 py-1 text-sm cursor-grab hover:bg-accent"
            >
              {a.filename}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
