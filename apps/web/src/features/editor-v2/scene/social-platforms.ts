export type SocialPlatform = 'instagram' | 'tiktok' | 'youtube';
export type OverlayMode = 'mockup' | 'safezones';

export interface SafeZone {
  /** Percentage of video height from top */
  top: number;
  /** Percentage of video height from bottom */
  bottom: number;
  /** Percentage of video width from left */
  left: number;
  /** Percentage of video width from right */
  right: number;
}

export interface PlatformConfig {
  id: SocialPlatform;
  label: string;
  safeZones: SafeZone;
}

// Research-backed safe zone values (2026) on a 1080×1920 canvas.
// Sources:
//   postplanify.com/blog/social-media-safe-zones-2026-complete-guide
//   zeely.ai/blog/tiktok-safe-zones
//   kreatli.com/guides/youtube-shorts-safe-zone
export const PLATFORMS: Record<SocialPlatform, PlatformConfig> = {
  instagram: {
    id: 'instagram',
    label: 'Instagram',
    // Top 210px (11%), Bottom 310px (16%), Left 0, Right 84px (8%)
    safeZones: { top: 11, bottom: 16, left: 0, right: 8 },
  },
  tiktok: {
    id: 'tiktok',
    label: 'TikTok',
    // Top 130px (7%), Bottom 350px (18%), Left 60px (5.5%), Right 120px (11%)
    safeZones: { top: 7, bottom: 18, left: 5.5, right: 11 },
  },
  youtube: {
    id: 'youtube',
    label: 'YouTube',
    // Top 120px (6%), Bottom 300px (16%), Left 0, Right 96px (9%)
    safeZones: { top: 6, bottom: 16, left: 0, right: 9 },
  },
};

export const PLATFORM_LIST: SocialPlatform[] = ['instagram', 'tiktok', 'youtube'];
