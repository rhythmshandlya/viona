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
