import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Clock, ExternalLink, Layers, Palette, Sparkles, Zap,
  ArrowRight, FileText, Pencil, Move, Box,
} from 'lucide-react';
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
  emotion?: string;
  keySync?: { word: string; timestamp: number; visualEvent: string };
  buildsFrom?: string | null;
  connectsTo?: string | null;
  layout?: Record<string, unknown> | null;
  frames?: [number, number] | null;
  icons?: string[];
}

interface ScenePlanMetadata {
  primaryMetaphor?: string;
  colorPalette?: string;
  totalScenes?: number;
  durationSeconds?: number;
  visualContinuity?: string;
}

interface ScenePlanCardProps {
  scenes: Scene[];
  scenePlanMarkdown?: string;
  metadata?: ScenePlanMetadata;
  onApprove: () => void;
  onReject: () => void;
  onEditScene?: (sceneIndex: number, sceneTitle: string) => void;
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
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

function formatFrameRange(frames: [number, number]): string {
  return `${frames[0]}–${frames[1]} (${frames[1] - frames[0]} frames)`;
}

function formatLayout(layout: Record<string, unknown>): string {
  const primary = layout.primary as Record<string, string> | undefined;
  if (!primary) return '';
  const parts: string[] = [];
  if (primary.x) parts.push(`x: ${primary.x}`);
  if (primary.y) parts.push(`y: ${primary.y}`);
  if (primary.width) parts.push(`w: ${primary.width}`);
  return parts.join(', ');
}

export function ScenePlanCard({
  scenes,
  scenePlanMarkdown,
  metadata,
  onApprove,
  onReject,
  onEditScene,
  disabled,
  approved,
}: ScenePlanCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'scenes' | 'markdown'>('scenes');

  const sceneCount = metadata?.totalScenes ?? scenes.length;
  const duration = metadata?.durationSeconds;

  // Resolved state
  if (approved !== undefined) {
    return (
      <div
        className={`my-2 px-3 py-2 rounded-lg text-xs text-center ${
          approved
            ? 'bg-green-500/10 border border-green-500/20 text-green-600'
            : 'bg-amber-500/10 border border-amber-500/20 text-amber-600'
        }`}
      >
        {approved
          ? `Plan approved - ${sceneCount} scene${sceneCount !== 1 ? 's' : ''}`
          : 'Revision requested'}
      </div>
    );
  }

  return (
    <div className="my-2 border border-[var(--editor-border-subtle)] rounded-lg overflow-hidden">
      {/* Header */}
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
          <div key={i} className="px-3 py-2 group">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-mono text-[var(--editor-text-muted)] shrink-0">
                {formatTime(scene.startMs)}-{formatTime(scene.endMs)}
              </span>
              <span className="text-sm font-medium text-[var(--editor-text-primary)] truncate flex-1">
                {scene.title}
              </span>
              {!disabled && onEditScene && (
                <button
                  onClick={() => onEditScene(i, scene.title)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--editor-bg-hover)] text-[var(--editor-text-muted)] hover:text-[var(--editor-text-secondary)] transition-all"
                  title={`Edit ${scene.title}`}
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
            <p className="text-xs text-[var(--editor-text-secondary)] line-clamp-1">
              {scene.description}
            </p>
          </div>
        ))}
      </div>

      {/* View full plan → modal */}
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
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          {/* Modal header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-3">
              Scene Plan
              <span className="text-sm font-normal text-muted-foreground">
                {sceneCount} scenes{duration ? ` · ${formatDuration(duration)}` : ''}
              </span>
            </DialogTitle>

            {/* Metadata pills */}
            <div className="flex flex-wrap gap-2 mt-2">
              {metadata?.primaryMetaphor && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs">
                  <Sparkles className="w-3 h-3" />
                  {metadata.primaryMetaphor}
                </span>
              )}
              {metadata?.colorPalette && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs">
                  <Palette className="w-3 h-3" />
                  {metadata.colorPalette}
                </span>
              )}
              {metadata?.visualContinuity && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs">
                  <ArrowRight className="w-3 h-3" />
                  {metadata.visualContinuity}
                </span>
              )}
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 mt-3">
              <button
                onClick={() => setModalTab('scenes')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  modalTab === 'scenes'
                    ? 'bg-foreground/10 text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Layers className="w-3 h-3 inline mr-1" />
                Scenes
              </button>
              <button
                onClick={() => setModalTab('markdown')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  modalTab === 'markdown'
                    ? 'bg-foreground/10 text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileText className="w-3 h-3 inline mr-1" />
                Raw Plan
              </button>
            </div>
          </DialogHeader>

          {/* Modal body */}
          <div className="overflow-y-auto flex-1 px-6 py-4">
            {modalTab === 'scenes' ? (
              <div className="space-y-3">
                {scenes.map((scene, i) => (
                  <div key={i} className="rounded-lg border p-4 space-y-3">
                    {/* Scene header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-foreground/10 text-xs font-bold">
                          {i + 1}
                        </span>
                        <h3 className="font-semibold text-sm">{scene.title}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {!disabled && onEditScene && (
                          <button
                            onClick={() => { setModalOpen(false); onEditScene(i, scene.title); }}
                            className="p-1.5 rounded-md hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-colors"
                            title={`Edit ${scene.title}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className="text-xs font-mono text-muted-foreground shrink-0">
                          {formatTime(scene.startMs)} – {formatTime(scene.endMs)}
                        </span>
                      </div>
                    </div>

                    {/* Visual description */}
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      {scene.description}
                    </p>

                    {/* Key sync point */}
                    {scene.keySync && (
                      <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-amber-500/5 border border-amber-500/10">
                        <Zap className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                        <div className="text-xs">
                          <span className="font-medium text-amber-600 dark:text-amber-400">
                            Sync on &quot;{scene.keySync.word}&quot;
                          </span>
                          <span className="text-muted-foreground ml-1">
                            at {scene.keySync.timestamp.toFixed(1)}s
                          </span>
                          <p className="text-muted-foreground mt-0.5">{scene.keySync.visualEvent}</p>
                        </div>
                      </div>
                    )}

                    {/* Detail grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      {scene.emotion && (
                        <div>
                          <span className="font-medium text-muted-foreground">Emotion</span>
                          <p className="text-foreground/70">{scene.emotion}</p>
                        </div>
                      )}
                      {scene.frames && (
                        <div>
                          <span className="font-medium text-muted-foreground">Frames</span>
                          <p className="text-foreground/70 font-mono">{formatFrameRange(scene.frames)}</p>
                        </div>
                      )}
                      {scene.layout && (
                        <div>
                          <span className="font-medium text-muted-foreground flex items-center gap-1">
                            <Move className="w-3 h-3" /> Layout
                          </span>
                          <p className="text-foreground/70 font-mono">{formatLayout(scene.layout)}</p>
                        </div>
                      )}
                      {scene.icons && scene.icons.length > 0 && (
                        <div>
                          <span className="font-medium text-muted-foreground flex items-center gap-1">
                            <Box className="w-3 h-3" /> Elements
                          </span>
                          <p className="text-foreground/70">{scene.icons.join(', ')}</p>
                        </div>
                      )}
                    </div>

                    {/* Scene transitions */}
                    {(scene.buildsFrom || scene.connectsTo) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground border-t pt-2">
                        {scene.buildsFrom && (
                          <span>
                            <span className="font-medium text-foreground/60">Builds from:</span> {scene.buildsFrom}
                          </span>
                        )}
                        {scene.connectsTo && (
                          <span>
                            <span className="font-medium text-foreground/60">Leads to:</span> {scene.connectsTo}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {scenePlanMarkdown || ''}
                </ReactMarkdown>
              </div>
            )}
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
