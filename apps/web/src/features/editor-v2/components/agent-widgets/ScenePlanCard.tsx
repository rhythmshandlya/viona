import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Clock, ExternalLink, Layers, Palette, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Scene {
  startMs: number;
  endMs: number;
  title: string;
  description: string;
}

interface ScenePlanMetadata {
  primaryMetaphor?: string;
  colorPalette?: string;
  totalScenes?: number;
  durationSeconds?: number;
}

interface ScenePlanCardProps {
  scenes: Scene[];
  scenePlanMarkdown?: string;
  metadata?: ScenePlanMetadata;
  onApprove: () => void;
  onReject: () => void;
  disabled?: boolean;
  approved?: boolean;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

export function ScenePlanCard({
  scenes,
  scenePlanMarkdown,
  metadata,
  onApprove,
  onReject,
  disabled,
  approved,
}: ScenePlanCardProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const sceneCount = metadata?.totalScenes ?? scenes.length;
  const duration = metadata?.durationSeconds;

  // Resolved status: show a compact banner instead of the full card
  if (approved !== undefined) {
    return (
      <div
        className={`my-2 px-3 py-2 rounded-lg text-xs text-center ${
          approved
            ? 'bg-green-500/10 border border-green-500/20 text-green-600'
            : 'bg-red-500/10 border border-red-500/20 text-red-500'
        }`}
      >
        {approved
          ? `Plan approved - ${sceneCount} scene${sceneCount !== 1 ? 's' : ''}`
          : 'Plan rejected - awaiting revision'}
      </div>
    );
  }

  return (
    <div className="my-2 border border-[var(--editor-border-subtle)] rounded-lg overflow-hidden">
      {/* Header row: scene count, duration, color palette */}
      <div className="px-3 py-2 bg-[var(--editor-bg-hover)] border-b border-[var(--editor-border-subtle)] flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-[var(--editor-text-primary)]">Scene Plan</span>

        <div className="flex items-center gap-3 ml-auto text-xs text-[var(--editor-text-muted)]">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3" />
            {sceneCount} scene{sceneCount !== 1 ? 's' : ''}
          </span>
          {duration !== undefined && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(duration)}
            </span>
          )}
          {metadata?.colorPalette && (
            <span className="flex items-center gap-1">
              <Palette className="w-3 h-3" />
              {metadata.colorPalette}
            </span>
          )}
        </div>
      </div>

      {/* Primary metaphor */}
      {metadata?.primaryMetaphor && (
        <div className="px-3 py-1.5 border-b border-[var(--editor-border-subtle)] bg-purple-500/5 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-purple-500 shrink-0" />
          <span className="text-xs text-purple-400 italic truncate">
            {metadata.primaryMetaphor}
          </span>
        </div>
      )}

      {/* Compact scene list */}
      <div className="divide-y divide-[var(--editor-border-subtle)]">
        {scenes.map((scene, i) => (
          <div key={i} className="px-3 py-2">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-mono text-[var(--editor-text-muted)] shrink-0">
                {formatTime(scene.startMs)}-{formatTime(scene.endMs)}
              </span>
              <span className="text-sm font-medium text-[var(--editor-text-primary)] truncate">
                {scene.title}
              </span>
            </div>
            <p className="text-xs text-[var(--editor-text-secondary)] line-clamp-1">
              {scene.description}
            </p>
          </div>
        ))}
      </div>

      {/* "View full plan" button → opens modal */}
      {scenePlanMarkdown && (
        <button
          onClick={() => setModalOpen(true)}
          className="w-full px-3 py-1.5 border-t border-[var(--editor-border-subtle)] bg-[var(--editor-bg-hover)]
                     flex items-center justify-center gap-1 text-xs text-[var(--editor-text-muted)]
                     hover:text-[var(--editor-text-secondary)] transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          View full plan
        </button>
      )}

      {/* Full plan modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Scene Plan
              <span className="text-sm font-normal text-muted-foreground">
                {sceneCount} scenes{duration ? ` · ${formatDuration(duration)}` : ''}
              </span>
            </DialogTitle>
            {metadata?.primaryMetaphor && (
              <p className="text-sm text-muted-foreground italic">{metadata.primaryMetaphor}</p>
            )}
          </DialogHeader>
          <div className="overflow-y-auto flex-1 pr-2">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {scenePlanMarkdown || ''}
              </ReactMarkdown>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Action buttons */}
      {!disabled && (
        <div className="px-3 py-2 bg-[var(--editor-bg-hover)] border-t border-[var(--editor-border-subtle)] flex gap-2">
          <button
            onClick={onApprove}
            className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-md transition-colors"
          >
            Approve & Generate
          </button>
          <button
            onClick={onReject}
            className="px-3 py-1.5 border border-[var(--editor-border-subtle)] hover:border-[var(--editor-border-default)]
                       text-[var(--editor-text-secondary)] text-sm rounded-md transition-colors"
          >
            Revise
          </button>
        </div>
      )}
    </div>
  );
}
