'use client';
import {
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactElement,
  type DragEvent,
} from 'react';
import { X, Upload, Plus } from 'lucide-react';
import { AssetsApi, type Asset } from '@/lib/api/assets';
import { useAssetEvents } from '@/lib/sse/useAssetEvents';
import { uploadAndRegister } from '@/lib/assets/upload-client';

const api = new AssetsApi(process.env.NEXT_PUBLIC_API_URL ?? '');


export interface AssetsPanelV2Props {
  projectId: string;
  onClose?: () => void;
}

interface UploadingFile {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'registering' | 'ready' | 'failed';
  error?: string;
}

function formatDuration(ms: number | null | undefined): string | null {
  if (ms == null) return null;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeTypeLabel(mimeType: string): string {
  if (mimeType.startsWith('video/')) return 'VID';
  if (mimeType.startsWith('audio/')) return 'AUD';
  if (mimeType.startsWith('image/')) return 'IMG';
  return 'FILE';
}

export function AssetsPanelV2({ projectId, onClose }: AssetsPanelV2Props): ReactElement {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploads, setUploads] = useState<UploadingFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
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
    enabled: true,
    onEvent: (event) => {
      if (
        event.type === 'created' ||
        event.type === 'ready' ||
        event.type === 'metadata_ready' ||
        event.type === 'linked' ||
        event.type === 'unlinked' ||
        event.type === 'renamed' ||
        event.type === 'deleted'
      ) {
        void refresh();
      }
    },
  });

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      const rows: UploadingFile[] = files.map((f) => ({
        id: `${Date.now()}-${f.name}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        size: f.size,
        status: 'uploading',
      }));
      setUploads((prev) => [...rows, ...prev]);

      await Promise.all(
        rows.map(async (row, i) => {
          const file = files[i];
          try {
            await uploadAndRegister({
              file,
              source: 'upload',
              projectId,
            });
            setUploads((prev) =>
              prev.map((r) => (r.id === row.id ? { ...r, status: 'ready' } : r)),
            );
          } catch (err) {
            setUploads((prev) =>
              prev.map((r) =>
                r.id === row.id
                  ? { ...r, status: 'failed', error: (err as Error).message }
                  : r,
              ),
            );
          }
        }),
      );

      // Clear success rows after a short delay so the user sees completion; keep failures visible.
      setTimeout(() => {
        setUploads((prev) => prev.filter((r) => r.status !== 'ready'));
      }, 1200);
      void refresh();
    },
    [projectId, refresh],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer?.files?.length) {
        void handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  return (
    <div
      className="flex h-full flex-col relative"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      {/* Unified header: title + upload + close. The Library tab is hidden
          until the global-upload surface exists — Library was meant for media
          uploaded outside any project (a separate "my media" area). There's
          no UI for that today, so the tab just echoed Project and we'd rather
          not show a dead toggle. Bring it back when the global uploader ships. */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3 flex-shrink-0">
        <h3 className="text-xs font-normal text-[var(--editor-text-muted)] uppercase tracking-wide">
          Visual Assets
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-[var(--editor-text-primary)] bg-[var(--editor-accent)]/15 hover:bg-[var(--editor-accent)]/25 transition-colors active:scale-[0.97]"
            title="Upload media"
          >
            <Plus className="w-3.5 h-3.5" />
            Upload
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[var(--editor-text-muted)] active:scale-[0.97] transition-all"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {/* In-flight uploads: agent-card-like status rows so the user sees progress
            before metadata_ready fires and the tile lands in the list. */}
        {uploads.length > 0 && (
          <ul className="flex flex-col gap-1 mb-3">
            {uploads.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-xs"
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    u.status === 'failed'
                      ? 'bg-red-500'
                      : u.status === 'ready'
                        ? 'bg-green-500'
                        : 'bg-[var(--editor-accent)] animate-pulse'
                  }`}
                />
                <span className="truncate flex-1 text-[var(--editor-text-primary)]">
                  {u.name}
                </span>
                <span className="text-[var(--editor-text-muted)] flex-shrink-0">
                  {u.status === 'failed'
                    ? 'Failed'
                    : u.status === 'ready'
                      ? 'Done'
                      : u.status === 'registering'
                        ? 'Registering'
                        : 'Uploading'}
                </span>
              </li>
            ))}
          </ul>
        )}

        {loading && assets.length === 0 && (
          <div className="text-xs text-[var(--editor-text-muted)] px-2">Loading…</div>
        )}

        {!loading && assets.length === 0 && uploads.length === 0 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] py-8 text-[var(--editor-text-muted)] transition-colors"
          >
            <Upload className="w-5 h-5" />
            <div className="text-xs">
              No assets yet. Drop files or click to upload.
            </div>
          </button>
        )}

        {assets.length > 0 && (
          <ul className="grid grid-cols-2 gap-2">
            {assets.map((a) => {
              const duration = formatDuration(a.durationMs);
              return (
                <li
                  key={a.id}
                  data-testid={`asset-tile-${a.id}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      'application/x-project-asset',
                      JSON.stringify({
                        id: a.id,
                        mimeType: a.mimeType,
                        filename: a.filename,
                        label: a.label,
                        durationMs: a.durationMs,
                      }),
                    );
                  }}
                  className="group relative rounded-lg overflow-hidden border border-white/[0.05] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04] cursor-grab transition-colors"
                >
                  <div className="aspect-video bg-black/40 flex items-center justify-center">
                    {a.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-[10px] tracking-wider text-[var(--editor-text-muted)]">
                        {mimeTypeLabel(a.mimeType)}
                      </span>
                    )}
                    {duration && (
                      <span className="absolute bottom-1 right-1 text-[10px] px-1 rounded bg-black/70 text-white">
                        {duration}
                      </span>
                    )}
                  </div>
                  <div className="px-1.5 py-1">
                    <div
                      className="truncate text-xs text-[var(--editor-text-primary)]"
                      title={a.filename}
                    >
                      {a.filename}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Drag overlay — covers the whole panel while a drag is active */}
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-[var(--editor-accent)] bg-[var(--editor-accent)]/10">
          <div className="flex items-center gap-2 text-sm text-[var(--editor-text-primary)]">
            <Upload className="w-4 h-4" /> Drop to upload
          </div>
        </div>
      )}
    </div>
  );
}
