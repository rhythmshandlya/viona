import { FONT_PAIRS } from '../../fonts';
import type { SocialHandleBarProps } from './schema';

export const BACKGROUNDS = {
  dark: {
    bg: '#0B0F1A',
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    gridColor: 'rgba(255, 255, 255, 0.04)',
    handleBg: 'rgba(255, 255, 255, 0.06)',
    handleBorder: 'rgba(255, 255, 255, 0.10)',
  },
  light: {
    bg: '#F8F9FB',
    text: '#111827',
    textMuted: 'rgba(0, 0, 0, 0.45)',
    gridColor: 'rgba(0, 0, 0, 0.04)',
    handleBg: 'rgba(0, 0, 0, 0.03)',
    handleBorder: 'rgba(0, 0, 0, 0.08)',
  },
} as const;

export const PLATFORM_DEFAULTS: Record<string, { abbr: string; color: string }> = {
  YouTube: { abbr: 'YT', color: '#FF0000' },
  Instagram: { abbr: 'IG', color: '#E4405F' },
  TikTok: { abbr: 'TT', color: '#000000' },
  X: { abbr: 'X', color: '#1DA1F2' },
  Twitter: { abbr: 'X', color: '#1DA1F2' },
  Facebook: { abbr: 'FB', color: '#1877F2' },
  LinkedIn: { abbr: 'LI', color: '#0A66C2' },
  Twitch: { abbr: 'TW', color: '#9146FF' },
  Snapchat: { abbr: 'SC', color: '#FFFC00' },
};

export function getPlatformInfo(platform: string, color?: string) {
  const defaults = PLATFORM_DEFAULTS[platform] ?? {
    abbr: platform.slice(0, 2).toUpperCase(),
    color: '#6366F1',
  };
  return {
    abbr: defaults.abbr,
    color: color ?? defaults.color,
  };
}

export function getConstants(props: SocialHandleBarProps) {
  const COLORS = {
    primary: props.colors.primary,
    secondary: props.colors.secondary,
    accent: props.colors.accent,
    background: props.colors.background,
    text: props.colors.text,
  };

  const FONTS = FONT_PAIRS[props.fontPair];

  const SPRING_CONFIG = {
    damping: 20,
    stiffness: 120,
    mass: 0.8,
  };

  return { COLORS, FONTS, SPRING_CONFIG };
}

export type TemplateConstants = ReturnType<typeof getConstants>;
