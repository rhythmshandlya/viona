import type { AgentPlan, AgentTask, AgentSubtask, ProgressPayload, ActivityState } from '@viona/shared/progress-types';

/* ── Re-exports for convenience ── */
export type { AgentPlan, AgentTask, AgentSubtask, ProgressPayload, ActivityState };

/* ── Message Block Types ── */

export interface TextBlock {
  type: 'text';
  text: string;
  hidden?: boolean;
}

export interface WidgetBlock {
  type: 'widget';
  widget: {
    id: string;
    kind: 'theme_picker' | 'scene_plan' | 'choice' | 'confirmation' | 'completion';
    message?: string;
    scenes?: unknown[];
    options?: unknown[];
    metadata?: Record<string, unknown>;
    planJobId?: string;
    scenePlanMarkdown?: string;
    [key: string]: unknown;
  };
  response?: unknown;
}

export interface PlanBlock {
  type: 'plan';
  plan: AgentPlan;
}

/** @deprecated Kept for backward compat with historical DB messages */
export interface ProgressBlock {
  type: 'progress';
  [key: string]: unknown;
}

export type MessageBlock = TextBlock | WidgetBlock | PlanBlock | ProgressBlock;

/* ── Message ── */

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'pipeline';
  content: MessageBlock[];
  createdAt: string;
  queued?: boolean;
}

/* ── Progress State (transient, not persisted in messages) ── */

export interface ProgressState {
  phase: string;
  message: string;
  agentName?: string;
  trackName?: string;
  estimatedTimeRemaining?: number;
  startedAt: number;
}

/* ── Active Task (new resilient progress model) ── */

export interface ActiveTask {
  id: string;
  agent: string;
  action: string;
  target?: string;
  startedAt: number;
  status: 'active' | 'completed';
}

/* ── Agent style config ── */

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  mcp__assets__request_segmentation: 'Requesting speaker segmentation...',
  mcp__assets__check_segmentation_status: 'Checking segmentation status...',
  mcp__assets__get_depth_compositing_info: 'Checking depth compositing...',
  request_segmentation: 'Requesting speaker segmentation...',
  check_segmentation_status: 'Checking segmentation status...',
  get_depth_compositing_info: 'Checking depth compositing...',
};

export const AGENT_STYLES: Record<string, { color: string; icon: string }> = {
  Viona:            { color: '#f472b6', icon: '✦' },
  'Trim Editor':    { color: '#60a5fa', icon: '✂' },
  Planner:          { color: '#a78bfa', icon: '◈' },
  'Setup Agent':    { color: '#818cf8', icon: '⚙' },
  'Layout Editor':  { color: '#fbbf24', icon: '▦' },
  Animator:         { color: '#34d399', icon: '◆' },
  'Final Editor':   { color: '#c084fc', icon: '✓' },
  Editor:           { color: '#94a3b8', icon: '✎' },
  Renderer:         { color: '#fb923c', icon: '▶' },
  // Ingest pipeline — asset upload, metadata extraction (thumb, waveform, proxy),
  // and transcript generation. Rendered as a task row in chat so the user sees
  // per-file progress during the post-upload phase, the same way they see
  // subagent progress (e.g. "arrangement • Adding to timeline • 21s").
  Ingest:           { color: '#0ea5e9', icon: '⇧' },
  Transcriber:      { color: '#2dd4bf', icon: '✎' },
};
