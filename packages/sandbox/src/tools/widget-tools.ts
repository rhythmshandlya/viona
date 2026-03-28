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
  onPlan: (plan: { title: string; tasks: Array<{ id: string; title: string; status: string; agent?: string }> }) => void;
}
