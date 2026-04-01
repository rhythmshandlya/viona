// packages/sandbox/src/prompts/prompt-loader.ts
import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// In production (sandbox container), prompt files are at /app/dist/prompts/
// In dev, they're relative to the compiled source
const PROMPTS_DIR = process.env.NODE_ENV === 'production'
  ? '/app/dist/prompts'
  : join(__dirname);

// --- Shared modules (cacheable prefix) ---

const SHARED_FILES = ['identity.xml', 'tool-usage.xml', 'manifest-tools.xml', 'quality-rules.xml', 'motion-design.xml', 'layer-compositing.xml'];

async function loadFile(path: string): Promise<string> {
  return readFile(path, 'utf-8');
}

export async function loadSharedModules(): Promise<string> {
  const modules: string[] = [];
  for (const file of SHARED_FILES) {
    try {
      modules.push(await loadFile(join(PROMPTS_DIR, 'shared', file)));
    } catch {
      // Shared module not found — skip
    }
  }
  return modules.join('\n\n');
}

// --- Agent-specific loading ---

async function loadAgentSystem(agentName: string): Promise<string> {
  return loadFile(join(PROMPTS_DIR, agentName, 'system.md'));
}

async function loadExamples(agentName: string): Promise<string> {
  const examplesDir = join(PROMPTS_DIR, agentName, 'examples');
  try {
    const files = await readdir(examplesDir);
    const contents = await Promise.all(
      files.filter(f => f.endsWith('.md')).map(f => loadFile(join(examplesDir, f)))
    );
    return contents.join('\n\n');
  } catch {
    return ''; // No examples directory
  }
}

async function loadCriticalReminder(agentName: string): Promise<string> {
  try {
    return await loadFile(join(PROMPTS_DIR, agentName, 'reminder.md'));
  } catch {
    return ''; // No reminder file
  }
}

// --- Full assembly ---

/**
 * Assemble a complete agent prompt in research-backed order:
 * 1. Shared modules (cacheable prefix) — at TOP
 * 2. Agent system prompt — role, core rules, task
 * 3. Few-shot examples — concrete good/bad examples
 * 4. Injected context (via template vars) — variable per dispatch
 * 5. Critical reminder (sandwich pattern) — at BOTTOM
 */
export async function assembleAgentPrompt(agentName: string, ctx: PromptContext): Promise<string> {
  const [shared, system, examples, reminder] = await Promise.all([
    loadSharedModules(),
    loadAgentSystem(agentName),
    loadExamples(agentName),
    loadCriticalReminder(agentName),
  ]);

  const sections = [shared, system, examples].filter(Boolean);
  const assembled = sections.join('\n\n---\n\n');
  const injected = injectContext(assembled, ctx);

  if (reminder) {
    return injected + '\n\n---\n\n' + injectContext(reminder, ctx);
  }
  return injected;
}

// --- Context injection ---

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
  hasSegmentation?: boolean;
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
    .replaceAll('{{THEME}}', ctx.theme ?? 'blackboard')
    .replaceAll('{{PROJECT_TYPE}}', ctx.projectType ?? 'video')
    .replaceAll('{{BRIEF_SUMMARY}}', ctx.briefSummary ?? 'No brief provided')
    .replaceAll('{{HAS_HEAD_TRACKING}}', String(ctx.hasHeadTracking ?? false))
    .replaceAll('{{TOTAL_SCENES}}', String(ctx.totalScenes ?? 0))
    .replaceAll('{{CURRENT_PHASE}}', ctx.currentPhase ?? 'unknown')
    .replaceAll('{{HAS_SEGMENTATION}}', String(ctx.hasSegmentation ?? false));
}

// --- Legacy compat (remove after migration) ---

export async function loadPrompt(name: string): Promise<string> {
  return loadFile(join(PROMPTS_DIR, `${name}.md`));
}

export async function loadPromptWithShared(name: string): Promise<string> {
  const [shared, prompt] = await Promise.all([loadSharedModules(), loadPrompt(name)]);
  return `${shared}\n\n---\n\n${prompt}`;
}
