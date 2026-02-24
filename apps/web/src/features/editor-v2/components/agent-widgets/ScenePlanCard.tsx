import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Clock, ExternalLink, Layers, Palette, Sparkles, Zap,
  ArrowRight, FileText, Pencil, Move, Box, Check, Mic, Save,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface IconOption {
  id: string;
  name: string;
  thumbnailUrl: string;
}

export interface Scene {
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
  svgOptions?: Record<string, IconOption[]>;
  displayMode?: 'default' | 'fullscreen' | 'overlay';
  transition?: {
    enter: { type: string; durationMs: number };
    exit: { type: string; durationMs: number };
  };
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

const DISPLAY_MODE_BADGE: Record<string, { label: string; color: string }> = {
  default: { label: 'Standard', color: '#3b82f6' },
  pip: { label: 'Standard', color: '#3b82f6' }, // legacy fallback
  fullscreen: { label: 'Fullscreen', color: '#8b5cf6' },
  overlay: { label: 'Overlay', color: '#f97316' },
};

const DISPLAY_MODE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'default', label: 'Standard' },
  { value: 'fullscreen', label: 'Fullscreen' },
  { value: 'overlay', label: 'Overlay' },
];

function DisplayModeBadge({ mode }: { mode: string }) {
  const cfg = DISPLAY_MODE_BADGE[mode] || DISPLAY_MODE_BADGE.default;
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none"
      style={{ backgroundColor: cfg.color, color: '#fff' }}
    >
      {cfg.label}
    </span>
  );
}

function SpeakerGapIndicator({ startMs, endMs }: { startMs: number; endMs: number }) {
  const durationMs = endMs - startMs;
  const seconds = (durationMs / 1000).toFixed(1);
  return (
    <div className="flex items-center gap-1.5 px-3 py-1 text-[10px] text-[var(--editor-text-muted)]">
      <div className="flex-1 border-t border-dashed border-[var(--editor-border-subtle)]" />
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium leading-none"
        style={{ backgroundColor: '#22c55e', color: '#fff' }}
      >
        <Mic className="w-2.5 h-2.5" />
        Speaker only · {seconds}s
      </span>
      <div className="flex-1 border-t border-dashed border-[var(--editor-border-subtle)]" />
    </div>
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
        className={`font-semibold text-sm ${disabled ? '' : 'cursor-pointer hover:bg-foreground/5 rounded px-1 -mx-1'}`}
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
      className="font-semibold text-sm bg-transparent border border-foreground/20 rounded px-1 -mx-1 outline-none focus:border-foreground/40 w-full"
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
        className={`text-sm text-foreground/80 leading-relaxed ${disabled ? '' : 'cursor-pointer hover:bg-foreground/5 rounded px-1 -mx-1'}`}
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
      className="text-sm text-foreground/80 leading-relaxed bg-transparent border border-foreground/20 rounded px-1 -mx-1 outline-none focus:border-foreground/40 w-full resize-none"
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
      return ls.title !== ps.title || ls.description !== ps.description || ls.displayMode !== ps.displayMode;
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
  const updateSceneDisplayMode = (index: number, displayMode: 'default' | 'fullscreen' | 'overlay') => {
    setLocalScenes(prev => prev.map((s, i) => i === index ? { ...s, displayMode } : s));
  };

  const isEditable = !disabled && !!onScenesUpdate && !!planJobId;

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
    <>
      {/* Compact inline card */}
      <div className="my-2 border border-[var(--editor-border-subtle)] rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-[var(--editor-bg-hover)] transition-colors text-left"
        >
          <div className="w-7 h-7 rounded-md bg-[var(--editor-accent-soft)] flex items-center justify-center shrink-0">
            <Layers className="w-3.5 h-3.5 text-[var(--editor-accent)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--editor-text-primary)]">Scene Plan</span>
              <span className="text-[11px] text-[var(--editor-text-muted)]">
                {sceneCount} scene{sceneCount !== 1 ? 's' : ''}
                {duration !== undefined && ` · ${formatDuration(duration)}`}
              </span>
            </div>
            {metadata?.primaryMetaphor && (
              <p className="text-[11px] text-[var(--editor-text-muted)] truncate mt-0.5">
                {metadata.primaryMetaphor}
              </p>
            )}
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-[var(--editor-text-muted)] shrink-0" />
        </button>

        {/* Action buttons */}
        {!disabled && (
          <div className="px-3 py-1.5 bg-[var(--editor-bg-hover)] border-t border-[var(--editor-border-subtle)] flex gap-2">
            <button
              onClick={() => onApprove(hasIconSelections ? iconSelections : undefined)}
              className="flex-1 px-2.5 py-1 bg-[var(--editor-accent)] hover:bg-[var(--editor-accent-hover)] text-white text-xs rounded-md active:scale-[0.97] transition-all"
            >
              Approve & Generate
            </button>
            <button
              onClick={onReject}
              className="px-2.5 py-1 border border-[var(--editor-border-subtle)] hover:border-[var(--editor-border-default)]
                         text-[var(--editor-text-secondary)] text-xs rounded-md transition-colors"
            >
              Revise
            </button>
          </div>
        )}
      </div>

      {/* Full plan popup modal */}
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
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--editor-accent-soft)] text-[var(--editor-accent)] text-xs">
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

            {/* Tab switcher + Save button */}
            <div className="flex items-center gap-1 mt-3">
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
              {scenePlanMarkdown && (
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
              )}

              {/* Save Changes button — appears when edits differ from props */}
              {isEditable && hasEdits && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="ml-auto px-3 py-1.5 text-xs rounded-md bg-[var(--editor-accent)] text-white
                             hover:bg-[var(--editor-accent-hover)] active:scale-[0.97] transition-all
                             flex items-center gap-1 disabled:opacity-50"
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
              <div className="space-y-3">
                {localScenes.map((scene, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && localScenes[i - 1].endMs < scene.startMs && (
                      <SpeakerGapIndicator startMs={localScenes[i - 1].endMs} endMs={scene.startMs} />
                    )}
                    <div className="rounded-lg border p-4 space-y-3">
                    {/* Scene header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-foreground/10 text-xs font-bold shrink-0">
                          {i + 1}
                        </span>
                        {isEditable ? (
                          <InlineEditableTitle
                            value={scene.title}
                            onChange={(v) => updateSceneTitle(i, v)}
                          />
                        ) : (
                          <h3 className="font-semibold text-sm">{scene.title}</h3>
                        )}
                        {isEditable ? (
                          <Select
                            value={scene.displayMode || 'default'}
                            onValueChange={(v) => updateSceneDisplayMode(i, v as 'default' | 'fullscreen' | 'overlay')}
                          >
                            <SelectTrigger size="sm" className="h-6 px-1.5 text-[10px] gap-1 min-w-0 w-auto border-none shadow-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DISPLAY_MODE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <DisplayModeBadge mode={scene.displayMode || 'default'} />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!disabled && onEditScene && (
                          <button
                            onClick={() => { setModalOpen(false); onEditScene(i, scene.title); }}
                            className="p-1.5 rounded-md hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-colors"
                            title={`Edit ${scene.title} with AI`}
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
                    {isEditable ? (
                      <InlineEditableDescription
                        value={scene.description}
                        onChange={(v) => updateSceneDescription(i, v)}
                      />
                    ) : (
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        {scene.description}
                      </p>
                    )}

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
                      {scene.icons && scene.icons.length > 0 && !scene.svgOptions && (
                        <div>
                          <span className="font-medium text-muted-foreground flex items-center gap-1">
                            <Box className="w-3 h-3" /> Elements
                          </span>
                          <p className="text-foreground/70">{scene.icons.join(', ')}</p>
                        </div>
                      )}
                    </div>

                    {/* Icon picker */}
                    {scene.svgOptions && Object.keys(scene.svgOptions).length > 0 && (
                      <div className="space-y-2 pt-1">
                        <span className="font-medium text-xs text-muted-foreground flex items-center gap-1">
                          <Box className="w-3 h-3" /> Icon Selection
                        </span>
                        {Object.entries(scene.svgOptions).map(([keyword, options]) => (
                          <div key={keyword} className="space-y-1">
                            <span className="text-[11px] text-muted-foreground capitalize">{keyword}</span>
                            <div className="flex gap-1.5 flex-wrap">
                              {options.map((option) => {
                                const isSelected = iconSelections[i]?.[keyword] === option.id;
                                return (
                                  <button
                                    key={option.id}
                                    onClick={() => !disabled && handleIconSelect(i, keyword, option.id)}
                                    disabled={disabled}
                                    className={`relative w-10 h-10 rounded-md border-2 overflow-hidden transition-all
                                      ${isSelected
                                        ? 'border-[var(--editor-accent)] ring-1 ring-[var(--editor-accent)]/30'
                                        : 'border-transparent hover:border-foreground/20'
                                      }
                                      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                      bg-foreground/5`}
                                    title={option.name}
                                  >
                                    {option.thumbnailUrl ? (
                                      <img
                                        src={option.thumbnailUrl}
                                        alt={option.name}
                                        className="w-full h-full object-contain p-0.5"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-[8px] text-muted-foreground">
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
                  </React.Fragment>
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

          {/* Modal footer with action buttons */}
          {!disabled && (
            <div className="px-6 py-3 border-t shrink-0 flex items-center gap-2">
              {isEditable && hasEdits && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs rounded-md border border-[var(--editor-border-subtle)]
                             hover:border-[var(--editor-border-default)] text-[var(--editor-text-secondary)]
                             active:scale-[0.97] transition-all flex items-center gap-1 disabled:opacity-50"
                >
                  <Save className="w-3 h-3" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={() => { setModalOpen(false); onReject(); }}
                className="px-3 py-1.5 border border-[var(--editor-border-subtle)] hover:border-[var(--editor-border-default)]
                           text-[var(--editor-text-secondary)] text-sm rounded-md transition-colors"
              >
                Revise
              </button>
              <button
                onClick={() => { setModalOpen(false); onApprove(hasIconSelections ? iconSelections : undefined); }}
                className="px-4 py-1.5 bg-[var(--editor-accent)] hover:bg-[var(--editor-accent-hover)] text-white text-sm rounded-md active:scale-[0.97] transition-all"
              >
                Approve & Generate
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
