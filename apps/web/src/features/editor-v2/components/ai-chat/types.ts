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
    kind: 'theme_picker' | 'scene_plan' | 'choice' | 'confirmation';
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
  role: 'user' | 'assistant';
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

export const AGENT_STYLES: Record<string, { color: string; icon: string }> = {
  Viona:           { color: '#f472b6', icon: '✦' },
  'Trim Editor':   { color: '#60a5fa', icon: '✂' },
  'Visual Editor': { color: '#818cf8', icon: '✎' },
  Planner:         { color: '#a78bfa', icon: '◈' },
  Animator:        { color: '#34d399', icon: '◆' },
  'QC Reviewer':   { color: '#fbbf24', icon: '◉' },
  Renderer:        { color: '#fb923c', icon: '▶' },
};
