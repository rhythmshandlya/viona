// Lightweight project context builder.
// The full system prompt is now built inside the sandbox orchestrator.

export interface ProjectContext {
  projectId: string;
  canvasWidth: number;
  canvasHeight: number;
  fps: number;
  durationMs: number | null;
  hasTranscript: boolean;
  theme?: string;
  projectType?: string;
}

export function buildProjectContext(project: Record<string, unknown>): ProjectContext {
  return {
    projectId: project.id as string,
    canvasWidth: (project.canvasWidth as number) || 1920,
    canvasHeight: (project.canvasHeight as number) || 1080,
    fps: (project.fps as number) || 30,
    durationMs: (project.durationMs as number) || null,
    hasTranscript: !!(project.transcriptId),
    theme: (project.theme as string) || 'studio-dark',
    projectType: (project.projectType as string) || 'video',
  };
}
