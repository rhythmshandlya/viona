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
  layout?: Record<string, unknown> | string | null;
  frames?: [number, number] | null;
  icons?: string[];
  svgOptions?: Record<string, IconOption[]>;
  transition?: {
    enter: { type: string; durationMs: number };
    exit: { type: string; durationMs: number };
  };
  // Agent may send these alternative field names
  name?: string;
  number?: number;
  sceneFile?: string;
  displayMode?: string;
  timeRange?: string;
  time?: string;
  [key: string]: unknown;
}

/** Resolve scene title from various possible field names */
function resolveTitle(scene: Scene): string {
  return scene.title || scene.name || scene.sceneFile || 'Untitled';
}

/** Parse a human-readable time string like "2.5s", "1:30", "90s" into milliseconds */
function parseTimeToMs(s: string): number | null {
  const trimmed = s.trim().replace(/s$/i, '');
  // "1:30" format
  if (trimmed.includes(':')) {
    const [min, sec] = trimmed.split(':').map(Number);
    if (!isNaN(min) && !isNaN(sec)) return Math.round((min * 60 + sec) * 1000);
  }
  // Plain number (seconds)
  const num = parseFloat(trimmed);
  if (!isNaN(num)) return Math.round(num * 1000);
  return null;
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
  // Try string time range: "2.5s - 5.5s", "2.5s – 5.5s", "2.5 - 5.5"
  const timeStr = scene.time || scene.timeRange;
  if (typeof timeStr === 'string') {
    const parts = timeStr.split(/\s*[-–]\s*/);
    if (parts.length >= 2) {
      const start = parseTimeToMs(parts[0]);
      const end = parseTimeToMs(parts[parts.length - 1]);
      if (start !== null && end !== null) return { startMs: start, endMs: end };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Parse SCENE_PLAN.md markdown into structured scenes
// ---------------------------------------------------------------------------

interface ParsedPlanData {
  scenes: Scene[];
  summary: string | null;
  captionStyle: string | null;
  totalScenes: number | null;
  sceneCoverage: string | null;
  speakerVisibility: string | null;
}

function parseScenesFromMarkdown(md: string): ParsedPlanData {
  const scenes: Scene[] = [];
  let summary: string | null = null;
  let captionStyle: string | null = null;
  let totalScenes: number | null = null;
  let sceneCoverage: string | null = null;
  let speakerVisibility: string | null = null;

  // Extract global metadata
  const captionMatch = md.match(/\*\*Caption style:\*\*\s*(.+)/i);
  if (captionMatch) captionStyle = captionMatch[1].trim();

  const totalMatch = md.match(/\*\*Total scenes:\*\*\s*(\d+)/i);
  if (totalMatch) totalScenes = parseInt(totalMatch[1], 10);

  const coverageMatch = md.match(/\*\*Scene coverage:\*\*\s*(.+)/i);
  if (coverageMatch) sceneCoverage = coverageMatch[1].trim();

  const visibilityMatch = md.match(/\*\*Speaker visibility:\*\*\s*(.+)/i);
  if (visibilityMatch) speakerVisibility = visibilityMatch[1].trim();

  // Build summary from globals
  const summaryParts: string[] = [];
  if (totalScenes != null) summaryParts.push(`${totalScenes} scenes`);
  if (sceneCoverage) summaryParts.push(sceneCoverage);
  if (speakerVisibility) summaryParts.push(`speaker ${speakerVisibility}`);
  if (summaryParts.length > 0) summary = summaryParts.join(' · ');

  // Split into sections by ## headings
  const sections = md.split(/^## /gm).slice(1); // skip content before first ##

  let sceneNum = 0;
  for (const section of sections) {
    const lines = section.split('\n');
    const heading = lines[0]?.trim() ?? '';

    // Only parse Scene sections (skip Segments, Global, Summary, etc.)
    const sceneHeadingMatch = heading.match(/^Scene\s+(\d+):\s*(.+)/i);
    if (!sceneHeadingMatch) continue;

    sceneNum++;
    const name = sceneHeadingMatch[2].trim();
    const body = lines.slice(1).join('\n');

    // Extract time
    const timeMatch = body.match(/\*\*Time:\*\*\s*(.+)/i);
    const time = timeMatch ? timeMatch[1].trim().replace(/\u2013/g, '-') : undefined;

    // Extract display mode
    const modeMatch = body.match(/\*\*Display mode:\*\*\s*(.+)/i);
    const layout = modeMatch ? modeMatch[1].trim() : undefined;

    // Extract transcript
    const transcriptMatch = body.match(/\*\*Transcript:\*\*\s*"?([^"*]+)"?/i);
    const transcript = transcriptMatch ? transcriptMatch[1].trim() : undefined;

    // Extract animation brief (everything under ### Animation brief until next ###)
    const briefMatch = body.match(/### Animation brief.*?\n([\s\S]*?)(?=\n###|\n---|\n## |$)/i);
    let description = '';
    if (briefMatch) {
      // Parse the brief fields
      const briefBody = briefMatch[1];
      const typeMatch = briefBody.match(/- Scene type:\s*(.+)/i);
      const descMatch = briefBody.match(/- Description:\s*"?([^"]+)"?/i);
      const dataMatch = briefBody.match(/- Key data:\s*(.+)/i);
      const mustShowMatch = briefBody.match(/- Must show:\s*(.+)/i);

      const parts: string[] = [];
      if (typeMatch) parts.push(typeMatch[1].trim());
      if (descMatch) parts.push(descMatch[1].trim());
      if (dataMatch) parts.push(`Key elements: ${dataMatch[1].trim()}`);
      if (mustShowMatch) parts.push(`Must show: ${mustShowMatch[1].trim()}`);
      description = parts.join('\n');
    }

    // Fallback: if no animation brief, try transcript
    if (!description && transcript) {
      description = `"${transcript}"`;
    }

    // Extract scene placement
    const dimMatch = body.match(/- Scene dimensions:\s*(\d+)x(\d+)/i);
    const transformMatch = body.match(/- Scene transform:\s*\{([^}]+)\}/i);

    // Extract transitions
    const entryMatch = body.match(/- Entry:\s*(.+)/i);
    const exitMatch = body.match(/- Exit:\s*(.+)/i);

    scenes.push({
      number: sceneNum,
      name,
      time,
      layout: layout ?? undefined,
      description,
      ...(dimMatch ? { sceneDimensions: `${dimMatch[1]}x${dimMatch[2]}` } : {}),
      ...(entryMatch || exitMatch ? {
        transitionInfo: [
          entryMatch ? `Entry: ${entryMatch[1].trim()}` : null,
          exitMatch ? `Exit: ${exitMatch[1].trim()}` : null,
        ].filter(Boolean).join(' · '),
      } : {}),
    });
  }

  return { scenes, summary, captionStyle, totalScenes, sceneCoverage, speakerVisibility };
}

interface ScenePlanMetadata {
  primaryMetaphor?: string;
  colorPalette?: string;
  totalScenes?: number;
  durationSeconds?: number;
  visualContinuity?: string;
  summary?: string;
  title?: string;
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
    <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px]">
      <div className="flex-1" style={{ borderTop: '1px dashed rgba(139, 92, 246, 0.1)' }} />
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-normal leading-none text-violet-300/40"
        style={{ background: 'rgba(139, 92, 246, 0.06)' }}
      >
        <Mic className="w-2.5 h-2.5" />
        Speaker only · {seconds}s
      </span>
      <div className="flex-1" style={{ borderTop: '1px dashed rgba(139, 92, 246, 0.1)' }} />
    </div>
  );
}

/** Resolve display mode from `displayMode` or `layout` field */
function resolveDisplayMode(scene: Scene): string | undefined {
  if (scene.displayMode) return scene.displayMode;
  if (typeof scene.layout === 'string' && scene.layout) return scene.layout;
  return undefined;
}

const DISPLAY_MODE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  stacked: { bg: 'bg-violet-400/10', text: 'text-violet-300', label: 'Stacked' },
  overlay: { bg: 'bg-purple-400/10', text: 'text-purple-300', label: 'Overlay' },
  fullscreen: { bg: 'bg-fuchsia-400/10', text: 'text-fuchsia-300', label: 'Fullscreen' },
  'split-screen': { bg: 'bg-violet-400/8', text: 'text-violet-200', label: 'Split Screen' },
};

function DisplayModeBadge({ mode }: { mode: string }) {
  // Match compound modes like "split-screen 50/50" to base key "split-screen"
  const modeKey = mode.toLowerCase();
  const style = DISPLAY_MODE_STYLES[modeKey]
    ?? Object.entries(DISPLAY_MODE_STYLES).find(([k]) => modeKey.startsWith(k))?.[1]
    ?? { bg: 'bg-white/[0.06]', text: 'text-[var(--editor-text-muted)]', label: mode };
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
  // Parse scenes from markdown when structured scenes array is empty/missing
  const parsedPlan = useMemo(() => {
    if (scenePlanMarkdown) return parseScenesFromMarkdown(scenePlanMarkdown);
    return null;
  }, [scenePlanMarkdown]);

  // Use parsed scenes as fallback when no structured scenes provided
  const effectiveScenes = scenes.length > 0 ? scenes : (parsedPlan?.scenes ?? []);
  // Merge parsed summary into metadata
  const effectiveMetadata = useMemo(() => ({
    ...metadata,
    summary: metadata?.summary || parsedPlan?.summary || undefined,
    totalScenes: metadata?.totalScenes || parsedPlan?.totalScenes || effectiveScenes.length || undefined,
  }), [metadata, parsedPlan, effectiveScenes.length]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'scenes' | 'markdown'>('scenes');
  // Local editable copy of scenes (for modal editing)
  const [localScenes, setLocalScenes] = useState<Scene[]>(effectiveScenes);

  // Sync localScenes when effective scenes change
  useEffect(() => { setLocalScenes(effectiveScenes); }, [effectiveScenes]);

  // Check if there are unsaved edits
  const hasEdits = useMemo(() => {
    return localScenes.some((ls, i) => {
      const ps = effectiveScenes[i];
      if (!ps) return true;
      return resolveTitle(ls) !== resolveTitle(ps) || ls.description !== ps.description;
    });
  }, [localScenes, effectiveScenes]);

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
    effectiveScenes.forEach((scene, i) => {
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

  const sceneCount = effectiveMetadata?.totalScenes ?? effectiveScenes.length;
  const duration = effectiveMetadata?.durationSeconds;

  // Scene field updaters (for modal inline editing)
  const updateSceneTitle = (index: number, title: string) => {
    setLocalScenes(prev => prev.map((s, i) => i === index ? { ...s, title } : s));
  };
  const updateSceneDescription = (index: number, description: string) => {
    setLocalScenes(prev => prev.map((s, i) => i === index ? { ...s, description } : s));
  };

  const isEditable = !disabled && !!onScenesUpdate && !!planJobId;

  const summary = effectiveMetadata?.summary;

  // Resolved state
  if (approved !== undefined) {
    return (
      <div
        className={`my-2 px-4 py-3 rounded-2xl text-xs text-center font-medium backdrop-blur-2xl ${
          approved
            ? 'text-emerald-300'
            : 'text-amber-300'
        }`}
        style={{
          background: approved
            ? 'linear-gradient(135deg, rgba(52, 211, 153, 0.08), rgba(16, 185, 129, 0.04))'
            : 'linear-gradient(135deg, rgba(251, 191, 36, 0.08), rgba(245, 158, 11, 0.04))',
          border: `1px solid ${approved ? 'rgba(52, 211, 153, 0.12)' : 'rgba(251, 191, 36, 0.12)'}`,
          boxShadow: `inset 0 1px 0 ${approved ? 'rgba(52, 211, 153, 0.06)' : 'rgba(251, 191, 36, 0.06)'}`,
        }}
      >
        {approved
          ? `Plan approved · ${sceneCount} scene${sceneCount !== 1 ? 's' : ''}`
          : 'Revision requested'}
      </div>
    );
  }

  return (
    <>
      {/* Inline scene plan card — liquid glass with purple tint */}
      <div
        className="my-2 rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, rgba(28, 28, 35, 0.55) 50%, rgba(124, 58, 237, 0.04) 100%)',
          backdropFilter: 'blur(40px) saturate(180%) brightness(1.1)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%) brightness(1.1)',
          border: '1px solid rgba(139, 92, 246, 0.12)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 0 0 0.5px rgba(139, 92, 246, 0.08)',
        }}
      >
        {/* Header */}
        <div className="px-4 py-3 flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(124, 58, 237, 0.1))',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 2px 8px rgba(139, 92, 246, 0.15)',
            }}
          >
            <Layers className="w-4 h-4 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white/92">Scene Plan</span>
              <span className="text-[11px] text-violet-300/40">
                {sceneCount} scene{sceneCount !== 1 ? 's' : ''}
                {duration !== undefined && ` · ${formatDuration(duration)}`}
              </span>
            </div>
            {summary && (
              <p className="text-[11px] text-white/30 mt-0.5 line-clamp-1">{summary}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="p-1.5 rounded-lg hover:bg-violet-500/10 text-violet-300/30 hover:text-violet-300/70 transition-colors"
            title="View full plan"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scene list */}
        <div className="px-3 pb-3 space-y-0.5">
          {effectiveScenes.map((scene, i) => {
            const title = resolveTitle(scene);
            const time = resolveTimeRange(scene);
            const mode = resolveDisplayMode(scene);
            return (
              <div
                key={i}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-violet-500/[0.06] transition-all cursor-pointer group"
                onClick={() => setModalOpen(true)}
              >
                <span
                  className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold shrink-0 text-violet-300"
                  style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.18), rgba(124, 58, 237, 0.08))',
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
                  }}
                >
                  {scene.number ?? i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-white/80 truncate block group-hover:text-white/90 transition-colors">{title}</span>
                  {scene.description && (
                    <span className="text-[10px] text-white/25 truncate block mt-0.5">{scene.description}</span>
                  )}
                </div>
                {mode && <DisplayModeBadge mode={mode} />}
                {time && (
                  <span className="text-[10px] text-violet-300/20 font-mono shrink-0 tabular-nums">
                    {formatTime(time.startMs)}–{formatTime(time.endMs)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        {!disabled && (
          <div className="px-4 py-2.5 flex gap-2" style={{ borderTop: '1px solid rgba(139, 92, 246, 0.08)' }}>
            <button
              onClick={() => onApprove(hasIconSelections ? iconSelections : undefined)}
              className="flex-1 px-3 py-1.5 text-white text-xs font-medium rounded-xl
                         active:scale-[0.97] transition-all
                         flex items-center justify-center gap-1.5"
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.85), rgba(124, 58, 237, 0.9))',
                boxShadow: '0 2px 12px rgba(139, 92, 246, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
              }}
            >
              <Play className="w-3 h-3" />
              Approve & Generate
            </button>
            <button
              onClick={onReject}
              className="px-3 py-1.5 text-violet-300/50 hover:text-violet-300/80 text-xs rounded-xl transition-all hover:bg-violet-500/[0.06]"
              style={{
                border: '1px solid rgba(139, 92, 246, 0.1)',
              }}
            >
              Revise
            </button>
          </div>
        )}
      </div>

      {/* Full plan popup modal — liquid glass + purple */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          className="max-w-[95vw] sm:max-w-5xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl"
          style={{
            background: 'linear-gradient(145deg, rgba(139, 92, 246, 0.04) 0%, rgba(12, 12, 18, 0.97) 30%, rgba(124, 58, 237, 0.03) 100%)',
            backdropFilter: 'blur(40px) saturate(180%) brightness(1.05)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%) brightness(1.05)',
            border: '1px solid rgba(139, 92, 246, 0.1)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 32px 80px rgba(0, 0, 0, 0.6), 0 0 80px rgba(139, 92, 246, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 0 0 0.5px rgba(139, 92, 246, 0.06)',
          }}
          showCloseButton={false}
        >
          {/* Modal header */}
          <DialogHeader className="px-5 pt-4 pb-3 shrink-0" style={{ borderBottom: '1px solid rgba(139, 92, 246, 0.06)' }}>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2.5 text-white/92">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(124, 58, 237, 0.1))',
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 2px 8px rgba(139, 92, 246, 0.12)',
                  }}
                >
                  <Layers className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <span className="text-sm font-medium">Scene Plan</span>
                <span className="text-xs font-normal text-violet-300/30">
                  {sceneCount} scenes{duration ? ` · ${formatDuration(duration)}` : ''}
                </span>
              </DialogTitle>
              <button
                onClick={() => setModalOpen(false)}
                className="w-6 h-6 rounded-md flex items-center justify-center text-violet-300/25 hover:text-violet-300/60 hover:bg-violet-500/[0.08] transition-colors"
              >
                <span className="text-sm leading-none">&times;</span>
              </button>
            </div>

            {/* Summary line */}
            {summary && (
              <p className="text-[11px] text-white/25 mt-2 leading-relaxed">{summary}</p>
            )}

            {/* Metadata pills */}
            {(effectiveMetadata?.primaryMetaphor || effectiveMetadata?.colorPalette || effectiveMetadata?.visualContinuity) && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {effectiveMetadata?.primaryMetaphor && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-violet-300 text-[10px]"
                    style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.08)' }}
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    {effectiveMetadata.primaryMetaphor}
                  </span>
                )}
                {effectiveMetadata?.colorPalette && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-violet-200/60 text-[10px]"
                    style={{ background: 'rgba(139, 92, 246, 0.06)', border: '1px solid rgba(139, 92, 246, 0.06)' }}
                  >
                    <Palette className="w-2.5 h-2.5" />
                    {effectiveMetadata.colorPalette}
                  </span>
                )}
                {effectiveMetadata?.visualContinuity && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-violet-200/60 text-[10px]"
                    style={{ background: 'rgba(139, 92, 246, 0.06)', border: '1px solid rgba(139, 92, 246, 0.06)' }}
                  >
                    <ArrowRight className="w-2.5 h-2.5" />
                    {effectiveMetadata.visualContinuity}
                  </span>
                )}
              </div>
            )}

            {/* Tab switcher + Save button */}
            <div className="flex items-center gap-1 mt-2.5">
              <div
                className="flex gap-0.5 p-0.5 rounded-lg"
                style={{ background: 'rgba(139, 92, 246, 0.04)' }}
              >
                <button
                  onClick={() => setModalTab('scenes')}
                  className={`px-2.5 py-1 text-[11px] rounded-md transition-all flex items-center gap-1 ${
                    modalTab === 'scenes'
                      ? 'text-violet-300 font-medium'
                      : 'text-white/25 hover:text-white/45'
                  }`}
                  style={modalTab === 'scenes' ? {
                    background: 'rgba(139, 92, 246, 0.12)',
                    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
                  } : undefined}
                >
                  <Layers className="w-3 h-3" />
                  Scenes
                </button>
                {scenePlanMarkdown && (
                  <button
                    onClick={() => setModalTab('markdown')}
                    className={`px-2.5 py-1 text-[11px] rounded-md transition-all flex items-center gap-1 ${
                      modalTab === 'markdown'
                        ? 'text-violet-300 font-medium'
                        : 'text-white/25 hover:text-white/45'
                    }`}
                    style={modalTab === 'markdown' ? {
                      background: 'rgba(139, 92, 246, 0.12)',
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
                    } : undefined}
                  >
                    <FileText className="w-3 h-3" />
                    Raw Plan
                  </button>
                )}
              </div>

              {/* Save Changes button */}
              {isEditable && hasEdits && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="ml-auto px-2.5 py-1 text-[11px] rounded-lg text-white
                             active:scale-[0.97] transition-all
                             flex items-center gap-1 disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.85), rgba(124, 58, 237, 0.9))',
                    boxShadow: '0 2px 12px rgba(139, 92, 246, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <Save className="w-3 h-3" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>
          </DialogHeader>

          {/* Modal body */}
          <div className="overflow-y-auto flex-1 px-5 py-4">
            {modalTab === 'scenes' ? (
              <div className="space-y-1.5">
                {localScenes.map((scene, i) => {
                  const title = resolveTitle(scene);
                  const time = resolveTimeRange(scene);
                  const prevTime = i > 0 ? resolveTimeRange(localScenes[i - 1]) : null;
                  const sceneDurationSec = time ? (time.endMs - time.startMs) / 1000 : null;
                  const mode = resolveDisplayMode(scene);
                  return (
                  <React.Fragment key={i}>
                    {prevTime && time && prevTime.endMs < time.startMs && (
                      <SpeakerGapIndicator startMs={prevTime.endMs} endMs={time.startMs} />
                    )}
                    <div
                      className="rounded-xl p-3.5 space-y-2.5 transition-all hover:translate-y-[-1px]"
                      style={{
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.03), rgba(28, 28, 35, 0.3))',
                        border: '1px solid rgba(139, 92, 246, 0.06)',
                        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.02)',
                      }}
                    >
                    {/* Scene header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <span
                          className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0 text-violet-300"
                          style={{
                            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.18), rgba(124, 58, 237, 0.08))',
                            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
                          }}
                        >
                          {scene.number ?? i + 1}
                        </span>
                        {isEditable ? (
                          <InlineEditableTitle
                            value={title}
                            onChange={(v) => updateSceneTitle(i, v)}
                          />
                        ) : (
                          <h3 className="font-medium text-sm text-white/88">{title}</h3>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {mode && <DisplayModeBadge mode={mode} />}
                        {!disabled && onEditScene && (
                          <button
                            onClick={() => { setModalOpen(false); onEditScene(i, title); }}
                            className="p-1 rounded-md hover:bg-violet-500/[0.08] text-violet-300/20 hover:text-violet-400 transition-colors"
                            title={`Edit ${title} with AI`}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        {time && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono text-violet-300/20 shrink-0"
                            style={{ background: 'rgba(139, 92, 246, 0.04)' }}
                          >
                            <Clock className="w-2.5 h-2.5" />
                            {formatTime(time.startMs)} – {formatTime(time.endMs)}
                            {sceneDurationSec != null && (
                              <span className="text-violet-300/12">({sceneDurationSec.toFixed(1)}s)</span>
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
                      <p className="text-[13px] text-white/35 leading-relaxed">
                        {scene.description}
                      </p>
                    ))}

                    {/* Key sync point */}
                    {scene.keySync && (
                      <div
                        className="flex items-start gap-2 px-2.5 py-2 rounded-lg"
                        style={{ background: 'rgba(139, 92, 246, 0.04)', border: '1px solid rgba(139, 92, 246, 0.06)' }}
                      >
                        <Zap className="w-3 h-3 text-violet-400 mt-0.5 shrink-0" />
                        <div className="text-[11px]">
                          <span className="font-medium text-violet-300">
                            Sync on &quot;{scene.keySync.word}&quot;
                          </span>
                          <span className="text-violet-300/25 ml-1">
                            at {scene.keySync.timestamp.toFixed(1)}s
                          </span>
                          <p className="text-violet-300/25 mt-0.5">{scene.keySync.visualEvent}</p>
                        </div>
                      </div>
                    )}

                    {/* Detail grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      {scene.emotion && (
                        <div>
                          <span className="text-violet-300/20">Emotion</span>
                          <p className="text-white/35 mt-0.5">{scene.emotion}</p>
                        </div>
                      )}
                      {scene.frames && (
                        <div>
                          <span className="text-violet-300/20">Frames</span>
                          <p className="text-white/35 font-mono mt-0.5">{formatFrameRange(scene.frames)}</p>
                        </div>
                      )}
                      {typeof scene.layout === 'object' && scene.layout && formatLayout(scene.layout as Record<string, unknown>) && (
                        <div>
                          <span className="text-violet-300/20 flex items-center gap-1">
                            <Move className="w-3 h-3" /> Layout
                          </span>
                          <p className="text-white/35 font-mono mt-0.5">{formatLayout(scene.layout as Record<string, unknown>)}</p>
                        </div>
                      )}
                      {scene.icons && scene.icons.length > 0 && !scene.svgOptions && (
                        <div>
                          <span className="text-violet-300/20 flex items-center gap-1">
                            <Box className="w-3 h-3" /> Elements
                          </span>
                          <p className="text-white/35 mt-0.5">{scene.icons.join(', ')}</p>
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
            <div className="px-5 py-3 shrink-0 flex items-center gap-2" style={{ borderTop: '1px solid rgba(139, 92, 246, 0.06)' }}>
              {isEditable && hasEdits && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs rounded-xl text-violet-300/50
                             active:scale-[0.97] transition-all flex items-center gap-1.5 disabled:opacity-50"
                  style={{ border: '1px solid rgba(139, 92, 246, 0.1)' }}
                >
                  <Save className="w-3 h-3" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={() => { setModalOpen(false); onReject(); }}
                className="px-4 py-1.5 text-violet-300/40 hover:text-violet-300/70 text-xs rounded-xl transition-all hover:bg-violet-500/[0.06]"
                style={{ border: '1px solid rgba(139, 92, 246, 0.08)' }}
              >
                Revise
              </button>
              <button
                onClick={() => { setModalOpen(false); onApprove(hasIconSelections ? iconSelections : undefined); }}
                className="px-4 py-1.5 text-white text-xs font-medium rounded-xl
                           active:scale-[0.97] transition-all flex items-center gap-1.5"
                style={{
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.85), rgba(124, 58, 237, 0.9))',
                  boxShadow: '0 2px 12px rgba(139, 92, 246, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
                }}
              >
                <Play className="w-3 h-3" />
                Approve & Generate
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
