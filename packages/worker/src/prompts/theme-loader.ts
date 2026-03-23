import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const THEMES_DIR = join(__dirname, 'themes');

export interface ThemeColors {
  background: string;
  text: string;
  textMuted: string;
  accent: string;
  secondary: string;
}

export interface ThemeConfig {
  family: string;
  label: string;
  genre: string;
  templateTags: string[];
  colors: ThemeColors;
}

interface ThemeManifest {
  themes: Record<string, ThemeConfig>;
}

let _manifest: ThemeManifest | null = null;

function loadManifest(): ThemeManifest {
  if (!_manifest) {
    _manifest = JSON.parse(readFileSync(join(THEMES_DIR, 'themes.json'), 'utf-8'));
  }
  return _manifest!;
}

export function getTheme(preset: string): ThemeConfig | undefined {
  return loadManifest().themes[preset];
}

export function listThemePresets(): string[] {
  return Object.keys(loadManifest().themes);
}

export function getTemplateTags(preset: string): string[] {
  const theme = getTheme(preset);
  if (!theme) throw new Error(`Unknown theme preset: ${preset}`);
  return theme.templateTags;
}

export function getGenre(preset: string): string | undefined {
  return getTheme(preset)?.genre;
}

function loadThemePrompt(filePath: string, theme: ThemeConfig): string {
  const raw = readFileSync(join(THEMES_DIR, filePath), 'utf-8');
  const replacements: Record<string, string> = {
    ...theme.colors,
    family: theme.family,
    label: theme.label,
  };
  return raw.replace(/\{(\w+)\}/g, (match, key) => replacements[key] ?? match);
}

export function getDesignSystem(preset: string): string {
  const theme = getTheme(preset);
  if (!theme) throw new Error(`Unknown theme preset: ${preset}`);
  return loadThemePrompt(`${theme.family}/design-system.md`, theme);
}
