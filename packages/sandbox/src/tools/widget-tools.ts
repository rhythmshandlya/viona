export interface WidgetCallbacks {
  onWidget: (widget: Record<string, unknown>) => void;
  onProgress: (progress: { phase: string; percent: number; message: string }) => void;
}

export const showWidgetTool = {
  name: 'show_widget',
  description:
    'Show an interactive widget in the chat UI. Use this to present choices, confirmations, theme pickers, layout pickers, or scene plans to the user.',
  input_schema: {
    type: 'object' as const,
    properties: {
      kind: {
        type: 'string',
        enum: ['theme_picker', 'layout_picker', 'scene_plan', 'choice', 'confirmation'],
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
    'Report progress to the user during long-running operations like rendering or generation.',
  input_schema: {
    type: 'object' as const,
    properties: {
      phase: {
        type: 'string',
        description: 'Current phase of the operation (e.g. "rendering", "generating").',
      },
      percent: {
        type: 'number',
        description: 'Progress percentage from 0 to 100.',
      },
      message: {
        type: 'string',
        description: 'Human-readable progress message.',
      },
    },
    required: ['phase', 'percent', 'message'],
  },
};

export const allWidgetTools = [showWidgetTool, reportProgressTool];
