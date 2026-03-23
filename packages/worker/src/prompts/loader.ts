/**
 * @deprecated This TypeScript loader is part of the legacy single-agent pipeline.
 * The production pipeline uses the Python loader (loader.py) with the
 * build_agent_prompt() function. This file is kept for backward compatibility
 * with generate-visuals.ts but should not be used for new code.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cache: Record<string, string> = {};

export function loadPrompt(name: string): string {
  if (name in cache) return cache[name];
  const filePath = join(__dirname, `${name}.md`);
  const content = readFileSync(filePath, 'utf-8');
  cache[name] = content;
  return content;
}

export function loadTemplate(name: string, variables?: Record<string, string | number>): string {
  const raw = loadPrompt(name);
  if (!variables) return raw;
  return raw.replace(/\{\{(\w+)\}\}/g, (_, key) => String(variables[key] ?? `{{${key}}}`));
}

const SHARED_MODULES = [
  'shared/technical-rules',
  'shared/motion-design-principles',
  'shared/vocabulary',
  'shared/quality-checklist',
] as const;

export function loadSharedModules(): string {
  return SHARED_MODULES.map(loadPrompt).join('\n\n');
}
