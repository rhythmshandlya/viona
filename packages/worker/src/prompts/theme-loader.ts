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
  gridColor: string;
  cardBg: string;
  cardBorder: string;
  accentDefault: string;
  secondaryDefault: string;
}

export interface ThemeConfig {
  family: string;
  variant: string;
  label: string;
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

/**
 * Load a markdown prompt file and substitute color placeholders.
 * Replaces {background}, {text}, {variant_label}, etc.
 */
function loadThemePrompt(filePath: string, theme: ThemeConfig): string {
  const raw = readFileSync(join(THEMES_DIR, filePath), 'utf-8');
  const variantLabel = theme.variant.charAt(0).toUpperCase() + theme.variant.slice(1) + ' mode';
  const replacements: Record<string, string> = {
    ...theme.colors,
    variant_label: variantLabel,
    variant: theme.variant,
    family: theme.family,
    label: theme.label,
  };
  return raw.replace(/\{(\w+)\}/g, (match, key) => replacements[key] ?? match);
}

/** Load {family}/{variant}/style-guide.md with color placeholders filled. */
export function getStyleGuide(preset: string): string {
  const theme = getTheme(preset);
  if (!theme) throw new Error(`Unknown theme preset: ${preset}`);
  return loadThemePrompt(`${theme.family}/${theme.variant}/style-guide.md`, theme);
}

/** Load {family}/design-system.md with color placeholders filled. */
export function getDesignSystem(preset: string): string {
  const theme = getTheme(preset);
  if (!theme) throw new Error(`Unknown theme preset: ${preset}`);
  return loadThemePrompt(`${theme.family}/design-system.md`, theme);
}

/** Load {family}/director-style.md with color placeholders filled. */
export function getDirectorStyle(preset: string): string {
  const theme = getTheme(preset);
  if (!theme) throw new Error(`Unknown theme preset: ${preset}`);
  return loadThemePrompt(`${theme.family}/director-style.md`, theme);
}
