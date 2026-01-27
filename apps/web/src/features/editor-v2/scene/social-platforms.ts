export type SocialPlatform = 'instagram' | 'tiktok' | 'youtube';
export type OverlayMode = 'mockup' | 'safezones';

export interface SafeZone {
  /** Percentage of video height from top */
  top: number;
  /** Percentage of video height from bottom */
  bottom: number;
  /** Percentage of video width from right */
  right: number;
}

export interface PlatformConfig {
  id: SocialPlatform;
  label: string;
  safeZones: SafeZone;
}

export const PLATFORMS: Record<SocialPlatform, PlatformConfig> = {
  instagram: {
    id: 'instagram',
    label: 'Instagram',
    safeZones: { top: 5, bottom: 25, right: 15 },
  },
  tiktok: {
    id: 'tiktok',
    label: 'TikTok',
    safeZones: { top: 5, bottom: 20, right: 15 },
  },
  youtube: {
    id: 'youtube',
    label: 'YouTube',
    safeZones: { top: 5, bottom: 25, right: 15 },
  },
};

export const PLATFORM_LIST: SocialPlatform[] = ['instagram', 'tiktok', 'youtube'];
