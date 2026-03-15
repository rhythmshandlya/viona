// packages/sandbox/src/prompts/prompt-loader.ts
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// In production (sandbox container), .md files are at /app/dist/prompts/
// In dev, they're relative to the compiled source
const PROMPTS_DIR = process.env.NODE_ENV === 'production'
  ? '/app/dist/prompts'
  : join(__dirname);

// Shared modules are copied into /workspace/docs/shared/ during init
const WORKSPACE_SHARED = '/workspace/docs/shared';

const SHARED_MODULES = [
  'technical-rules.md',
  'motion-design-principles.md',
  'vocabulary.md',
  'quality-checklist.md',
];

async function loadFile(path: string): Promise<string> {
  return readFile(path, 'utf-8');
}

export async function loadSharedModules(): Promise<string> {
  const modules: string[] = [];
  for (const file of SHARED_MODULES) {
    try {
      const content = await loadFile(join(WORKSPACE_SHARED, file));
      modules.push(`## ${file.replace('.md', '').replace(/-/g, ' ').toUpperCase()}\n\n${content}`);
    } catch {
      // Shared module not found — skip (dev environment)
    }
  }
  return modules.join('\n\n---\n\n');
}

export async function loadPrompt(name: string): Promise<string> {
  return loadFile(join(PROMPTS_DIR, `${name}.md`));
}

export async function loadPromptWithShared(name: string): Promise<string> {
  const [shared, prompt] = await Promise.all([
    loadSharedModules(),
    loadPrompt(name),
  ]);
  return `${shared}\n\n---\n\n${prompt}`;
}

export interface PromptContext {
  canvasWidth: number;
  canvasHeight: number;
  fps: number;
  durationMs: number | null;
  hasTranscript: boolean;
  theme?: string;
  projectType?: string;
  briefSummary?: string;
  hasHeadTracking?: boolean;
  totalScenes?: number;
  currentPhase?: string;
}

/** Split ratio for stacked layout: visuals get this percentage of canvas height. */
const STACKED_VISUAL_RATIO = 0.55;

export function injectContext(prompt: string, ctx: PromptContext): string {
  const stackedVisualHeight = Math.round(ctx.canvasHeight * STACKED_VISUAL_RATIO);

  return prompt
    .replaceAll('{{CANVAS_WIDTH}}', String(ctx.canvasWidth))
    .replaceAll('{{CANVAS_HEIGHT}}', String(ctx.canvasHeight))
    .replaceAll('{{STACKED_VISUAL_HEIGHT}}', String(stackedVisualHeight))
    .replaceAll('{{FPS}}', String(ctx.fps))
    .replaceAll('{{DURATION_MS}}', String(ctx.durationMs ?? 'unknown'))
    .replaceAll('{{THEME}}', ctx.theme ?? 'studio-dark')
    .replaceAll('{{PROJECT_TYPE}}', ctx.projectType ?? 'video')
    .replaceAll('{{BRIEF_SUMMARY}}', ctx.briefSummary ?? 'No brief provided')
    .replaceAll('{{HAS_HEAD_TRACKING}}', String(ctx.hasHeadTracking ?? false))
    .replaceAll('{{TOTAL_SCENES}}', String(ctx.totalScenes ?? 0))
    .replaceAll('{{CURRENT_PHASE}}', ctx.currentPhase ?? 'unknown');
}
