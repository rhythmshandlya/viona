import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Clock, ExternalLink, Layers, Palette, Sparkles, Zap,
  ArrowRight, FileText, Pencil, Move, Box, Check, Mic, Save, Play,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface IconOption {
  id: string;
  name: string;
  thumbnailUrl: string;
  source?: 'freepik' | 'iconify';
}

export interface Scene {
  startMs?: number;
  endMs?: number;
  title?: string;
  description?: string;
  emotion?: string;
  keySync?: { word: string; timestamp: number; visualEvent: string };
  buildsFrom?: string | null;
  connectsTo?: string | null;
  layout?: Record<string, unknown> | null;
  frames?: [number, number] | null;
  icons?: string[];
  svgOptions?: Record<string, IconOption[]>;
  transition?: {
    enter: { type: string; durationMs: number };
    exit: { type: string; durationMs: number };
  };
  // Agent may send these alternative field names
  name?: string;
  sceneFile?: string;
  displayMode?: string;
  timeRange?: string;
  [key: string]: unknown;
}

/** Resolve scene title from various possible field names */
function resolveTitle(scene: Scene): string {
  return scene.title || scene.name || scene.sceneFile || 'Untitled';
}

/** Resolve scene time range, returning null if unavailable */
function resolveTimeRange(scene: Scene): { startMs: number; endMs: number } | null {
  if (typeof scene.startMs === 'number' && typeof scene.endMs === 'number' &&
      !isNaN(scene.startMs) && !isNaN(scene.endMs)) {
    return { startMs: scene.startMs, endMs: scene.endMs };
  }
  // Try frames array (assume 30fps if no fps context)
  if (scene.frames && Array.isArray(scene.frames) && scene.frames.length >= 2) {
    const fps = 30;
    return { startMs: Math.round(scene.frames[0] / fps * 1000), endMs: Math.round(scene.frames[1] / fps * 1000) };
  }
  return null;
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
  onApprove: (iconSelections?: Record<number, Record<string, string>>) => void;
  onReject: () => void;
  onEditScene?: (sceneIndex: number, sceneTitle: string) => void;
  onScenesUpdate?: (planJobId: string, scenes: Scene[]) => void | Promise<void>;
  planJobId?: string;
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

function SpeakerGapIndicator({ startMs, endMs }: { startMs: number; endMs: number }) {
  const durationMs = endMs - startMs;
  const seconds = (durationMs / 1000).toFixed(1);
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-[var(--editor-text-muted)]">
      <div className="flex-1 border-t border-dashed border-[var(--editor-border-subtle)]" />
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-normal leading-none bg-emerald-500/15 text-emerald-400">
        <Mic className="w-2.5 h-2.5" />
        Speaker only · {seconds}s
      </span>
      <div className="flex-1 border-t border-dashed border-[var(--editor-border-subtle)]" />
    </div>
  );
}

const DISPLAY_MODE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  stacked: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Stacked' },
  overlay: { bg: 'bg-purple-500/10', text: 'text-purple-400', label: 'Overlay' },
  fullscreen: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Fullscreen' },
};

function DisplayModeBadge({ mode }: { mode: string }) {
  const style = DISPLAY_MODE_STYLES[mode.toLowerCase()] ?? {
    bg: 'bg-white/[0.06]', text: 'text-[var(--editor-text-muted)]', label: mode,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-normal leading-none ${style.bg} ${style.text} shrink-0`}>
      <Layers className="w-2.5 h-2.5" />
      {style.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Inline editable text components
// ---------------------------------------------------------------------------

function InlineEditableTitle({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Sync draft when value changes externally
  useEffect(() => { setDraft(value); }, [value]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onChange(trimmed);
    else setDraft(value);
  };

  if (disabled || !editing) {
    return (
      <h3
        className={`font-normal text-sm text-[var(--editor-text-primary)] ${disabled ? '' : 'cursor-pointer hover:bg-[var(--editor-bg-hover)] rounded px-1 -mx-1'}`}
        onClick={() => !disabled && setEditing(true)}
        title={disabled ? undefined : 'Click to edit'}
      >
        {value}
      </h3>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') { setDraft(value); setEditing(false); }
      }}
      className="font-normal text-sm text-[var(--editor-text-primary)] bg-transparent border border-[var(--editor-border-default)] rounded px-1 -mx-1 outline-none focus:border-[var(--editor-border-focus)] w-full"
    />
  );
}

function InlineEditableDescription({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editing]);

  useEffect(() => { setDraft(value); }, [value]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onChange(trimmed);
    else setDraft(value);
  };

  if (disabled || !editing) {
    return (
      <p
        className={`text-sm text-[var(--editor-text-secondary)] leading-relaxed ${disabled ? '' : 'cursor-pointer hover:bg-[var(--editor-bg-hover)] rounded px-1 -mx-1'}`}
        onClick={() => !disabled && setEditing(true)}
        title={disabled ? undefined : 'Click to edit'}
      >
        {value}
      </p>
    );
  }

  return (
    <textarea
      ref={textareaRef}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { setDraft(value); setEditing(false); }
      }}
      className="text-sm text-[var(--editor-text-secondary)] leading-relaxed bg-transparent border border-[var(--editor-border-default)] rounded px-1 -mx-1 outline-none focus:border-[var(--editor-border-focus)] w-full resize-none"
      rows={2}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ScenePlanCard({
  scenes,
  scenePlanMarkdown,
  metadata,
  onApprove,
  onReject,
  onEditScene,
  onScenesUpdate,
  planJobId,
  disabled,
  approved,
}: ScenePlanCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'scenes' | 'markdown'>('scenes');
  // Local editable copy of scenes (for modal editing)
  const [localScenes, setLocalScenes] = useState<Scene[]>(scenes);

  // Sync localScenes when props.scenes changes (e.g. after save succeeds)
  useEffect(() => { setLocalScenes(scenes); }, [scenes]);

  // Check if there are unsaved edits
  const hasEdits = useMemo(() => {
    return localScenes.some((ls, i) => {
      const ps = scenes[i];
      if (!ps) return true;
      return resolveTitle(ls) !== resolveTitle(ps) || ls.description !== ps.description;
    });
  }, [localScenes, scenes]);

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!onScenesUpdate || !planJobId || saving) return;
    setSaving(true);
    try {
      await onScenesUpdate(planJobId, localScenes);
    } finally {
      setSaving(false);
    }
  };

  // Icon selections state: sceneIndex → keyword → iconId
  const [iconSelections, setIconSelections] = useState<Record<number, Record<string, string>>>(() => {
    const defaults: Record<number, Record<string, string>> = {};
    scenes.forEach((scene, i) => {
      if (scene.svgOptions) {
        defaults[i] = {};
        for (const [keyword, options] of Object.entries(scene.svgOptions)) {
          if (options.length > 0) {
            defaults[i][keyword] = options[0].id;
          }
        }
      }
    });
    return defaults;
  });

  const handleIconSelect = (sceneIndex: number, keyword: string, iconId: string) => {
    setIconSelections(prev => ({
      ...prev,
      [sceneIndex]: { ...prev[sceneIndex], [keyword]: iconId },
    }));
  };

  const hasIconSelections = Object.keys(iconSelections).length > 0;

  const sceneCount = metadata?.totalScenes ?? scenes.length;
  const duration = metadata?.durationSeconds;

  // Scene field updaters (for modal inline editing)
  const updateSceneTitle = (index: number, title: string) => {
    setLocalScenes(prev => prev.map((s, i) => i === index ? { ...s, title } : s));
  };
  const updateSceneDescription = (index: number, description: string) => {
    setLocalScenes(prev => prev.map((s, i) => i === index ? { ...s, description } : s));
  };

  const isEditable = !disabled && !!onScenesUpdate && !!planJobId;

  // Resolved state
  if (approved !== undefined) {
    return (
      <div
        className={`my-2 px-3.5 py-2.5 rounded-xl text-xs text-center font-normal ${
          approved
            ? 'bg-emerald-500/[0.08] border border-emerald-500/15 text-emerald-400'
            : 'bg-amber-500/[0.08] border border-amber-500/15 text-amber-400'
        }`}
      >
        {approved
          ? `Plan approved · ${sceneCount} scene${sceneCount !== 1 ? 's' : ''}`
          : 'Revision requested'}
      </div>
    );
  }

  return (
    <>
      {/* Inline scene plan card */}
      <div className="my-2 border border-[var(--editor-border-default)] rounded-xl overflow-hidden bg-[var(--editor-bg-elevated)]">
        {/* Header */}
        <div className="px-3.5 py-2.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--editor-accent-muted)] flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 text-[var(--editor-accent)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-normal text-[var(--editor-text-primary)]">Scene Plan</span>
              <span className="text-[11px] text-[var(--editor-text-muted)]">
                {sceneCount} scene{sceneCount !== 1 ? 's' : ''}
                {duration !== undefined && ` · ${formatDuration(duration)}`}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="p-1.5 rounded-lg hover:bg-[var(--editor-bg-hover)] text-[var(--editor-text-muted)] hover:text-[var(--editor-text-secondary)] transition-colors"
            title="View full plan"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scene list */}
        <div className="px-3.5 pb-2.5 space-y-1">
          {scenes.map((scene, i) => {
            const title = resolveTitle(scene);
            const time = resolveTimeRange(scene);
            return (
              <div
                key={i}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer"
                onClick={() => setModalOpen(true)}
              >
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--editor-accent-muted)] text-[var(--editor-accent)] text-[10px] font-normal shrink-0">
                  {i + 1}
                </span>
                <span className="text-xs text-[var(--editor-text-primary)] truncate flex-1">{title}</span>
                {scene.displayMode && (
                  <DisplayModeBadge mode={scene.displayMode} />
                )}
                {time && (
                  <span className="text-[10px] text-[var(--editor-text-muted)] font-mono shrink-0">
                    {formatTime(time.startMs)}–{formatTime(time.endMs)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        {!disabled && (
          <div className="px-3.5 py-2 bg-[var(--editor-bg-hover)] border-t border-[var(--editor-border-subtle)] flex gap-2">
            <button
              onClick={() => onApprove(hasIconSelections ? iconSelections : undefined)}
              className="flex-1 px-3 py-1.5 bg-[var(--editor-accent)] hover:bg-[var(--editor-accent-hover)] text-white text-xs font-normal rounded-lg
                         active:scale-[0.97] transition-all shadow-lg shadow-[var(--editor-accent)]/20
                         flex items-center justify-center gap-1.5"
            >
              <Play className="w-3 h-3" />
              Approve & Generate
            </button>
            <button
              onClick={onReject}
              className="px-3 py-1.5 border border-[var(--editor-border-subtle)] hover:border-[var(--editor-border-default)]
                         text-[var(--editor-text-secondary)] text-xs rounded-lg transition-colors"
            >
              Revise
            </button>
          </div>
        )}
      </div>

      {/* Full plan popup modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden
                     bg-[rgba(12,12,18,0.96)] backdrop-blur-2xl border-[var(--editor-border-default)]
                     shadow-[0_24px_80px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)_inset] rounded-2xl"
          showCloseButton={false}
        >
          {/* Modal header */}
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-[var(--editor-border-subtle)] shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-3 text-[var(--editor-text-primary)]">
                <div className="w-8 h-8 rounded-lg bg-[var(--editor-accent-soft)] flex items-center justify-center">
                  <Layers className="w-4 h-4 text-[var(--editor-accent)]" />
                </div>
                Scene Plan
                <span className="text-sm font-normal text-[var(--editor-text-muted)]">
                  {sceneCount} scenes{duration ? ` · ${formatDuration(duration)}` : ''}
                </span>
              </DialogTitle>
              <button
                onClick={() => setModalOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--editor-text-muted)] hover:text-[var(--editor-text-primary)] hover:bg-[var(--editor-bg-hover)] transition-colors"
              >
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>

            {/* Metadata pills */}
            {(metadata?.primaryMetaphor || metadata?.colorPalette || metadata?.visualContinuity) && (
              <div className="flex flex-wrap gap-2 mt-3">
                {metadata?.primaryMetaphor && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--editor-accent-soft)] text-[var(--editor-accent)] text-xs font-normal">
                    <Sparkles className="w-3 h-3" />
                    {metadata.primaryMetaphor}
                  </span>
                )}
                {metadata?.colorPalette && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-normal">
                    <Palette className="w-3 h-3" />
                    {metadata.colorPalette}
                  </span>
                )}
                {metadata?.visualContinuity && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-normal">
                    <ArrowRight className="w-3 h-3" />
                    {metadata.visualContinuity}
                  </span>
                )}
              </div>
            )}

            {/* Tab switcher + Save button */}
            <div className="flex items-center gap-1 mt-3">
              <div className="flex gap-0.5 p-0.5 rounded-lg bg-white/[0.04]">
                <button
                  onClick={() => setModalTab('scenes')}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all flex items-center gap-1.5 ${
                    modalTab === 'scenes'
                      ? 'bg-[var(--editor-accent-muted)] text-[var(--editor-accent)] font-normal shadow-sm'
                      : 'text-[var(--editor-text-muted)] hover:text-[var(--editor-text-secondary)]'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  Scenes
                </button>
                {scenePlanMarkdown && (
                  <button
                    onClick={() => setModalTab('markdown')}
                    className={`px-3 py-1.5 text-xs rounded-md transition-all flex items-center gap-1.5 ${
                      modalTab === 'markdown'
                        ? 'bg-[var(--editor-accent-muted)] text-[var(--editor-accent)] font-normal shadow-sm'
                        : 'text-[var(--editor-text-muted)] hover:text-[var(--editor-text-secondary)]'
                    }`}
                  >
                    <FileText className="w-3 h-3" />
                    Raw Plan
                  </button>
                )}
              </div>

              {/* Save Changes button — appears when edits differ from props */}
              {isEditable && hasEdits && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="ml-auto px-3 py-1.5 text-xs rounded-lg bg-[var(--editor-accent)] text-white
                             hover:bg-[var(--editor-accent-hover)] active:scale-[0.97] transition-all
                             flex items-center gap-1.5 disabled:opacity-50 shadow-lg shadow-[var(--editor-accent)]/20"
                >
                  <Save className="w-3 h-3" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>
          </DialogHeader>

          {/* Modal body */}
          <div className="overflow-y-auto flex-1 px-6 py-4">
            {modalTab === 'scenes' ? (
              <div className="space-y-2">
                {localScenes.map((scene, i) => {
                  const title = resolveTitle(scene);
                  const time = resolveTimeRange(scene);
                  const prevTime = i > 0 ? resolveTimeRange(localScenes[i - 1]) : null;
                  const sceneDurationSec = time ? (time.endMs - time.startMs) / 1000 : null;
                  return (
                  <React.Fragment key={i}>
                    {prevTime && time && prevTime.endMs < time.startMs && (
                      <SpeakerGapIndicator startMs={prevTime.endMs} endMs={time.startMs} />
                    )}
                    <div className="rounded-xl border border-[var(--editor-border-subtle)] bg-white/[0.02] hover:bg-white/[0.035] transition-colors p-4 space-y-3">
                    {/* Scene header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--editor-accent-muted)] text-[var(--editor-accent)] text-xs font-normal shrink-0">
                          {i + 1}
                        </span>
                        {isEditable ? (
                          <InlineEditableTitle
                            value={title}
                            onChange={(v) => updateSceneTitle(i, v)}
                          />
                        ) : (
                          <h3 className="font-normal text-sm text-[var(--editor-text-primary)]">{title}</h3>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {scene.displayMode && (
                          <DisplayModeBadge mode={scene.displayMode} />
                        )}
                        {!disabled && onEditScene && (
                          <button
                            onClick={() => { setModalOpen(false); onEditScene(i, title); }}
                            className="p-1.5 rounded-lg hover:bg-[var(--editor-bg-hover)] text-[var(--editor-text-muted)] hover:text-[var(--editor-accent)] transition-colors"
                            title={`Edit ${title} with AI`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {time && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.04] text-xs font-mono text-[var(--editor-text-muted)] shrink-0">
                            <Clock className="w-3 h-3" />
                            {formatTime(time.startMs)} – {formatTime(time.endMs)}
                            {sceneDurationSec != null && (
                              <span className="text-[var(--editor-text-muted)]/60">({sceneDurationSec.toFixed(1)}s)</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Visual description */}
                    {scene.description && (isEditable ? (
                      <InlineEditableDescription
                        value={scene.description}
                        onChange={(v) => updateSceneDescription(i, v)}
                      />
                    ) : (
                      <p className="text-sm text-[var(--editor-text-secondary)] leading-relaxed">
                        {scene.description}
                      </p>
                    ))}

                    {/* Key sync point */}
                    {scene.keySync && (
                      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/[0.06] border border-amber-500/10">
                        <Zap className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                        <div className="text-xs">
                          <span className="font-normal text-amber-400">
                            Sync on &quot;{scene.keySync.word}&quot;
                          </span>
                          <span className="text-[var(--editor-text-muted)] ml-1">
                            at {scene.keySync.timestamp.toFixed(1)}s
                          </span>
                          <p className="text-[var(--editor-text-muted)] mt-0.5">{scene.keySync.visualEvent}</p>
                        </div>
                      </div>
                    )}

                    {/* Detail grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      {scene.displayMode && (
                        <div>
                          <span className="font-normal text-[var(--editor-text-muted)] flex items-center gap-1">
                            <Layers className="w-3 h-3" /> Display Mode
                          </span>
                          <p className="mt-0.5"><DisplayModeBadge mode={scene.displayMode} /></p>
                        </div>
                      )}
                      {scene.emotion && (
                        <div>
                          <span className="font-normal text-[var(--editor-text-muted)]">Emotion</span>
                          <p className="text-[var(--editor-text-secondary)] mt-0.5">{scene.emotion}</p>
                        </div>
                      )}
                      {scene.frames && (
                        <div>
                          <span className="font-normal text-[var(--editor-text-muted)]">Frames</span>
                          <p className="text-[var(--editor-text-secondary)] font-mono mt-0.5">{formatFrameRange(scene.frames)}</p>
                        </div>
                      )}
                      {scene.layout && formatLayout(scene.layout) && (
                        <div>
                          <span className="font-normal text-[var(--editor-text-muted)] flex items-center gap-1">
                            <Move className="w-3 h-3" /> Layout
                          </span>
                          <p className="text-[var(--editor-text-secondary)] font-mono mt-0.5">{formatLayout(scene.layout)}</p>
                        </div>
                      )}
                      {scene.icons && scene.icons.length > 0 && !scene.svgOptions && (
                        <div>
                          <span className="font-normal text-[var(--editor-text-muted)] flex items-center gap-1">
                            <Box className="w-3 h-3" /> Elements
                          </span>
                          <p className="text-[var(--editor-text-secondary)] mt-0.5">{scene.icons.join(', ')}</p>
                        </div>
                      )}
                    </div>

                    {/* Icon picker */}
                    {scene.svgOptions && Object.keys(scene.svgOptions).length > 0 && (
                      <div className="space-y-2 pt-1">
                        <span className="font-normal text-xs text-[var(--editor-text-muted)] flex items-center gap-1">
                          <Box className="w-3 h-3" /> Icon Selection
                        </span>
                        {Object.entries(scene.svgOptions).map(([keyword, options]) => (
                          <div key={keyword} className="space-y-1.5">
                            <span className="text-[11px] text-[var(--editor-text-muted)] capitalize">{keyword}</span>
                            <div className="flex gap-1.5 flex-wrap">
                              {options.map((option) => {
                                const isSelected = iconSelections[i]?.[keyword] === option.id;
                                return (
                                  <button
                                    key={option.id}
                                    onClick={() => !disabled && handleIconSelect(i, keyword, option.id)}
                                    disabled={disabled}
                                    className={`relative w-10 h-10 rounded-lg border-2 overflow-hidden transition-all
                                      ${isSelected
                                        ? 'border-[var(--editor-accent)] ring-1 ring-[var(--editor-accent)]/30 bg-[var(--editor-accent-soft)]'
                                        : 'border-transparent hover:border-[var(--editor-border-default)] bg-white/[0.04]'
                                      }
                                      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                    title={option.name}
                                  >
                                    {option.thumbnailUrl ? (
                                      <img
                                        src={option.thumbnailUrl}
                                        alt={option.name}
                                        className="w-full h-full object-contain p-0.5"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-[8px] text-[var(--editor-text-muted)]">
                                        {option.name.slice(0, 3)}
                                      </div>
                                    )}
                                    {isSelected && (
                                      <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-[var(--editor-accent)] rounded-full flex items-center justify-center">
                                        <Check className="w-2 h-2 text-white" />
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Scene transitions */}
                    {(scene.buildsFrom || scene.connectsTo) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--editor-text-muted)] border-t border-[var(--editor-border-subtle)] pt-2.5">
                        {scene.buildsFrom && (
                          <span>
                            <span className="font-normal text-[var(--editor-text-secondary)]">Builds from:</span> {scene.buildsFrom}
                          </span>
                        )}
                        {scene.connectsTo && (
                          <span>
                            <span className="font-normal text-[var(--editor-text-secondary)]">Leads to:</span> {scene.connectsTo}
                          </span>
                        )}
                      </div>
                    )}
                    </div>
                  </React.Fragment>
                  );
                })}
              </div>
            ) : (
              <div className="prose prose-sm prose-invert max-w-none
                              prose-headings:text-[var(--editor-text-primary)]
                              prose-p:text-[var(--editor-text-secondary)]
                              prose-strong:text-[var(--editor-text-primary)]
                              prose-code:text-[var(--editor-accent)]
                              prose-a:text-[var(--editor-accent)]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {scenePlanMarkdown || ''}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Modal footer with action buttons */}
          {!disabled && (
            <div className="px-6 py-3 border-t border-[var(--editor-border-subtle)] shrink-0 flex items-center gap-2 bg-white/[0.01]">
              {isEditable && hasEdits && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs rounded-lg border border-[var(--editor-border-subtle)]
                             hover:border-[var(--editor-border-default)] text-[var(--editor-text-secondary)]
                             active:scale-[0.97] transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-3 h-3" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={() => { setModalOpen(false); onReject(); }}
                className="px-4 py-2 border border-[var(--editor-border-subtle)] hover:border-[var(--editor-border-default)]
                           text-[var(--editor-text-secondary)] hover:text-[var(--editor-text-primary)] text-sm rounded-lg transition-colors"
              >
                Revise
              </button>
              <button
                onClick={() => { setModalOpen(false); onApprove(hasIconSelections ? iconSelections : undefined); }}
                className="px-5 py-2 bg-[var(--editor-accent)] hover:bg-[var(--editor-accent-hover)] text-white text-sm font-normal rounded-lg
                           active:scale-[0.97] transition-all shadow-lg shadow-[var(--editor-accent)]/20
                           flex items-center gap-2"
              >
                <Play className="w-3.5 h-3.5" />
                Approve & Generate
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
