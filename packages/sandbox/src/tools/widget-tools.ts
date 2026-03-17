import type { AgentPlan } from '@viona/shared/progress-types.js';

export interface WidgetCallbacks {
  onWidget: (widget: Record<string, unknown>) => void;
  onProgress: (progress: {
    phase: string;
    percent: number;
    message: string;
    agentName?: string;
    trackName?: string;
    estimatedTimeRemaining?: number;
  }) => void;
  onPlan: (plan: AgentPlan) => void;
}

export const showWidgetTool = {
  name: 'show_widget',
  description:
    'Show an interactive widget in the chat UI. Use this to present choices, confirmations, theme pickers, or scene plans to the user.',
  input_schema: {
    type: 'object' as const,
    properties: {
      kind: {
        type: 'string',
        enum: ['theme_picker', 'scene_plan', 'choice', 'confirmation'],
        description: 'The type of widget to display.',
      },
      id: {
        type: 'string',
        description: 'A unique identifier for this widget instance.',
      },
      data: {
        type: 'object',
        description: 'Widget-specific data (options, labels, etc.).',
      },
    },
    required: ['kind', 'id'],
  },
};

export const reportProgressTool = {
  name: 'report_progress',
  description:
    'Report progress with agent name, active track, and estimated time remaining.',
  input_schema: {
    type: 'object' as const,
    properties: {
      phase: {
        type: 'string',
        description: 'Current pipeline phase: trimming, planning, editing, generating, reviewing, assembling, complete.',
      },
      percent: {
        type: 'number',
        description: 'Progress percentage from 0 to 100.',
      },
      message: {
        type: 'string',
        description: 'Human-readable status message (Viona-centric, no internal agent names).',
      },
      agentName: {
        type: 'string',
        description: 'Which agent is working: Editor, Planner, Animator, Reviewer.',
      },
      trackName: {
        type: 'string',
        description: 'Which track/region is being edited: Video, Overlay, Captions, Audio.',
      },
      estimatedTimeRemaining: {
        type: 'number',
        description: 'Estimated seconds remaining for current phase.',
      },
    },
    required: ['phase', 'percent', 'message'],
  },
};

export const allWidgetTools = [showWidgetTool, reportProgressTool];
