'use client';

import { type SocialPlatform, type OverlayMode, PLATFORM_LIST } from './social-platforms';

interface SceneToolbarProps {
  activePlatform: SocialPlatform | null;
  overlayMode: OverlayMode;
  onPlatformChange: (platform: SocialPlatform | null) => void;
  onModeChange: (mode: OverlayMode) => void;
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1 0-5.78c.29 0 .57.04.84.11v-3.5a6.37 6.37 0 0 0-.84-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.87a8.28 8.28 0 0 0 4.77 1.51V6.93a4.84 4.84 0 0 1-1.01-.24z" />
    </svg>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
    </svg>
  );
}

const PLATFORM_ICONS: Record<SocialPlatform, React.FC<{ className?: string }>> = {
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  youtube: YouTubeIcon,
};

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

export function SceneToolbar({
  activePlatform,
  overlayMode,
  onPlatformChange,
  onModeChange,
}: SceneToolbarProps) {
  return (
    <div className="flex items-center gap-0">
      {/* Platform icon buttons */}
      <div className="flex items-center">
        {PLATFORM_LIST.map((platform) => {
          const Icon = PLATFORM_ICONS[platform];
          const isActive = activePlatform === platform;

          return (
            <button
              key={platform}
              type="button"
              aria-label={PLATFORM_LABELS[platform]}
              aria-pressed={isActive}
              onClick={() => onPlatformChange(isActive ? null : platform)}
              className={`p-1.5 rounded-md transition-colors ${
                isActive
                  ? 'bg-[var(--editor-accent)] text-white'
                  : 'text-[var(--editor-text-muted)] hover:text-[var(--editor-text-secondary)] hover:bg-[var(--editor-bg-hover)]'
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      {/* Separator + mode toggle (only when a platform is active) */}
      {activePlatform !== null && (
        <>
          {/* Separator */}
          <div className="w-px h-4 bg-[var(--editor-border-subtle)] mx-1" />

          {/* Segmented control: Mockup | Safe Zones */}
          <div className="rounded-md bg-[var(--editor-bg-base)]/60 p-0.5 flex items-center">
            <button
              type="button"
              onClick={() => onModeChange('mockup')}
              className={`px-2 py-0.5 rounded text-[10px] font-normal transition-colors ${
                overlayMode === 'mockup'
                  ? 'bg-[var(--editor-bg-hover)] text-[var(--editor-text-primary)]'
                  : 'text-[var(--editor-text-muted)] hover:text-[var(--editor-text-secondary)]'
              }`}
            >
              Mockup
            </button>
            <button
              type="button"
              onClick={() => onModeChange('safezones')}
              className={`px-2 py-0.5 rounded text-[10px] font-normal transition-colors ${
                overlayMode === 'safezones'
                  ? 'bg-[var(--editor-bg-hover)] text-[var(--editor-text-primary)]'
                  : 'text-[var(--editor-text-muted)] hover:text-[var(--editor-text-secondary)]'
              }`}
            >
              Safe Zones
            </button>
          </div>
        </>
      )}
    </div>
  );
}
