'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useAssetEvents } from '@/lib/sse/useAssetEvents';
import { AssetsApi } from '@/lib/api/assets';
import { AGENT_STYLES } from './types';

const api = new AssetsApi(process.env.NEXT_PUBLIC_API_URL ?? '');

// Phases a single asset walks through after /assets/register.
// `uploading` — row fabricated on an `asset-created` event OR on mount when we
//               observe an in-flight asset that hasn't reached metadata_ready.
// `metadata`  — `metadata_ready` received; still waiting on transcript.
// `transcribing` — downstream transcribe job started (metadata_ready for video/audio
//               auto-queues transcribe, so we render this eagerly).
// `done`      — `transcript_ready` (or `metadata_ready` for images/non-transcribable).
// `failed`    — any stage failed.
type Phase = 'uploading' | 'metadata' | 'transcribing' | 'done' | 'failed';

interface IngestRow {
  assetId: string;
  filename: string;
  mimeType: string | null;
  phase: Phase;
  startedAt: number;
  errorMessage?: string;
}

function ElapsedTime({ startedAt }: { startedAt: number }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  const _ = tick; // keep setTick referenced
  void _;
  return (
    <span className="text-[10px] tabular-nums opacity-60">
      {m > 0 ? `${m}m ${s}s` : `${s}s`}
    </span>
  );
}

function phaseLabel(row: IngestRow): { agent: string; action: string } {
  const isTranscribable =
    row.mimeType?.startsWith('video/') || row.mimeType?.startsWith('audio/');
  switch (row.phase) {
    case 'uploading':
      return { agent: 'Ingest', action: `Uploading ${row.filename}` };
    case 'metadata':
      return {
        agent: 'Ingest',
        action: `Extracting metadata for ${row.filename}`,
      };
    case 'transcribing':
      return {
        agent: 'Transcriber',
        action: `Transcribing ${row.filename}`,
      };
    case 'done':
      return {
        agent: isTranscribable ? 'Transcriber' : 'Ingest',
        action: `Ready — ${row.filename}`,
      };
    case 'failed':
      return {
        agent: 'Ingest',
        action: row.errorMessage
          ? `Failed: ${row.errorMessage}`
          : `Failed to ingest ${row.filename}`,
      };
  }
}

/**
 * Renders one row per in-flight or recently-completed asset ingest, styled to
 * match the subagent rows in `ActiveTaskList` (same dot / badge / action /
 * elapsed-time layout). Tracks state via the `/asset-events` SSE stream.
 *
 * Rows auto-dismiss 2.5s after reaching `done`. Failures stay visible until the
 * component unmounts or a follow-up `metadata_ready` event arrives.
 *
 * When `projectId` is provided, the component also seeds itself from
 * `GET /projects/:id/assets` on mount — so a user who lands on the editor
 * AFTER upload has already started still sees the in-flight rows (events for
 * those assets already fired before this component mounted).
 *
 * Mounted alongside `ActiveTaskList` in `ChatMessageList` so the user sees
 * upload + transcription the same way they see "arrangement • Adding to
 * timeline • 21s" — one consistent progress surface in the chat.
 */
export const IngestStatusList = memo(function IngestStatusList({
  projectId,
}: { projectId?: string } = {}) {
  const [rows, setRows] = useState<Record<string, IngestRow>>({});
  // Deletion timers for completed rows, so a late event doesn't flash a row
  // that was already dismissed.
  const pendingRemovals = useRef(new Set<string>());

  // Seed from the current project asset list on mount so assets that are
  // already mid-ingest (no "created" event will fire for them) still appear.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.listProjectAssets(projectId);
        if (cancelled) return;
        setRows((prev) => {
          const next = { ...prev };
          for (const a of res.assets) {
            if (next[a.id]) continue; // event-driven row already exists
            const isTranscribable =
              a.mimeType.startsWith('video/') || a.mimeType.startsWith('audio/');
            const transcriptTerminal =
              a.transcriptStatus === 'ready' ||
              a.transcriptStatus === 'not_applicable' ||
              a.transcriptStatus === 'failed';
            const metadataTerminal =
              a.thumbnailStatus !== 'pending' && a.waveformStatus !== 'pending';

            // If the asset is fully done (e.g. content-addressed dedup
            // returned an existing processed row on re-upload), still show
            // a transient "ready" row so the user gets acknowledgement.
            // scheduleRemoval below fades it out after 2.5s.
            if (transcriptTerminal && metadataTerminal) {
              next[a.id] = {
                assetId: a.id,
                filename: a.filename,
                mimeType: a.mimeType,
                phase: 'done',
                startedAt: Date.now(),
              };
              scheduleRemoval(a.id);
              continue;
            }

            let phase: Phase = 'metadata';
            if (isTranscribable && metadataTerminal && !transcriptTerminal) {
              phase = 'transcribing';
            }
            // startedAt is "when this ingest phase started from the user's
            // perspective", not the asset row's createdAt. Old pending rows
            // (e.g. worker crash earlier) would otherwise display 150m+
            // elapsed on first render. Use `now` — the elapsed counter then
            // reflects time-since-editor-mount, which is accurate enough for
            // the "is something hanging?" signal this row conveys.
            next[a.id] = {
              assetId: a.id,
              filename: a.filename,
              mimeType: a.mimeType,
              phase,
              startedAt: Date.now(),
            };
          }
          return next;
        });
      } catch {
        // Non-fatal — event-driven path still works.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const scheduleRemoval = useCallback((assetId: string) => {
    if (pendingRemovals.current.has(assetId)) return;
    pendingRemovals.current.add(assetId);
    setTimeout(() => {
      pendingRemovals.current.delete(assetId);
      setRows((prev) => {
        const next = { ...prev };
        delete next[assetId];
        return next;
      });
    }, 2500);
  }, []);

  useAssetEvents({
    enabled: true,
    onEvent: (event) => {
      const { assetId, type, payload } = event;
      if (type === 'created') {
        const filename = (payload?.filename as string | undefined) ?? 'file';
        const mimeType = (payload?.mimeType as string | undefined) ?? null;
        setRows((prev) => ({
          ...prev,
          [assetId]: {
            assetId,
            filename,
            mimeType,
            phase: 'uploading',
            startedAt: Date.now(),
          },
        }));
      } else if (type === 'metadata_ready') {
        setRows((prev) => {
          const existing = prev[assetId];
          // If we never saw the `created` event (page loaded mid-ingest),
          // fabricate a row from the event payload so the user still sees
          // progress rather than a blank period before transcript_ready.
          const next: IngestRow = existing
            ? { ...existing }
            : {
                assetId,
                filename: 'file',
                mimeType: null,
                phase: 'metadata',
                startedAt: Date.now(),
              };
          const isTranscribable =
            next.mimeType?.startsWith('video/') ||
            next.mimeType?.startsWith('audio/');
          next.phase = isTranscribable ? 'transcribing' : 'done';
          // Reset the elapsed timer on phase change so the counter shows how
          // long the CURRENT phase has taken, not total-since-row-was-seeded.
          // Otherwise a row that sat in "uploading" for 4 min while the
          // worker was down keeps showing "4m 12s" when transcription
          // actually takes 2s.
          next.startedAt = Date.now();
          if (!isTranscribable) scheduleRemoval(assetId);
          return { ...prev, [assetId]: next };
        });
      } else if (type === 'transcript_ready') {
        setRows((prev) => {
          const existing = prev[assetId];
          if (!existing) return prev;
          scheduleRemoval(assetId);
          return {
            ...prev,
            [assetId]: { ...existing, phase: 'done', startedAt: Date.now() },
          };
        });
      } else if (type === 'failed') {
        const stage = (payload?.stage as string | undefined) ?? 'ingest';
        const message = (payload?.message as string | undefined) ?? stage;
        setRows((prev) => {
          const existing = prev[assetId];
          if (!existing) return prev;
          return {
            ...prev,
            [assetId]: { ...existing, phase: 'failed', errorMessage: message },
          };
        });
      }
    },
  });

  const list = Object.values(rows);
  if (list.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--chat-bubble-assistant-border)] bg-[var(--chat-bubble-assistant-bg)] backdrop-blur-xl overflow-hidden">
      {list.map((row) => {
        const { agent, action } = phaseLabel(row);
        const style = AGENT_STYLES[agent] ?? { color: '#94a3b8', icon: '●' };
        const isDone = row.phase === 'done';
        const isFailed = row.phase === 'failed';
        return (
          <div
            key={row.assetId}
            className={`flex items-center gap-2 px-3 py-1.5 transition-opacity duration-[2000ms] ${isDone ? 'opacity-0' : 'opacity-100'}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDone || isFailed ? '' : 'animate-pulse'}`}
              style={{
                backgroundColor: isFailed ? '#ef4444' : style.color,
              }}
            />
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: `${style.color}20`, color: style.color }}
            >
              {style.icon} {agent}
            </span>
            <span className="text-xs text-[var(--editor-text-secondary)] truncate flex-1">
              {action}
            </span>
            <ElapsedTime startedAt={row.startedAt} />
          </div>
        );
      })}
    </div>
  );
});
