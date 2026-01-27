# Social Preview Overlay Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a toggleable social platform overlay to the video preview showing how the video will look on Instagram Reels, TikTok, and YouTube Shorts — with both full UI mockup and safe zone guide modes.

**Architecture:** Two new components (`SocialPreviewOverlay`, `SceneToolbar`) placed inside `Scene.tsx`. A data file (`social-platforms.ts`) holds all platform definitions, zone percentages, and SVG icon components. State is local React state in Scene — no Zustand or Remotion changes.

**Tech Stack:** React, TypeScript, Tailwind CSS, inline SVG icons

---

## Task 1: Platform Data Constants

**Files:**
- Create: `apps/web/src/features/editor-v2/scene/social-platforms.ts`

**Step 1: Create the platform types and zone data**

```typescript
// apps/web/src/features/editor-v2/scene/social-platforms.ts

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
```

**Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/scene/social-platforms.ts
git commit -m "feat(editor): add social platform data constants"
```

---

## Task 2: Social Preview Overlay Component

**Files:**
- Create: `apps/web/src/features/editor-v2/scene/SocialPreviewOverlay.tsx`
- Reference: `apps/web/src/features/editor-v2/scene/social-platforms.ts`

This component renders either a platform UI mockup or safe zone guides on top of the video player. It receives the platform, mode, and video dimensions as props. All elements use `pointer-events: none`.

**Step 1: Create the overlay component with safe zone rendering**

Create `apps/web/src/features/editor-v2/scene/SocialPreviewOverlay.tsx`:

```tsx
'use client';

import { type SocialPlatform, type OverlayMode, PLATFORMS } from './social-platforms';

interface SocialPreviewOverlayProps {
  platform: SocialPlatform;
  mode: OverlayMode;
  width: number;
  height: number;
}

export function SocialPreviewOverlay({ platform, mode, width, height }: SocialPreviewOverlayProps) {
  if (mode === 'safezones') {
    return <SafeZoneOverlay platform={platform} width={width} height={height} />;
  }
  return <MockupOverlay platform={platform} width={width} height={height} />;
}
```

The component delegates to `SafeZoneOverlay` or `MockupOverlay` based on mode.

**Step 2: Implement SafeZoneOverlay**

Inside the same file, add:

```tsx
function SafeZoneOverlay({ platform, width, height }: { platform: SocialPlatform; width: number; height: number }) {
  const zones = PLATFORMS[platform].safeZones;
  const topH = height * (zones.top / 100);
  const bottomH = height * (zones.bottom / 100);
  const rightW = width * (zones.right / 100);

  const dangerStyle = {
    background: 'rgba(255, 80, 60, 0.15)',
    border: '1px dashed rgba(255, 80, 60, 0.4)',
  };

  const labelStyle = 'absolute text-[9px] font-medium text-red-400/70 pointer-events-none';

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Top zone */}
      <div className="absolute top-0 left-0 right-0" style={{ height: topH, ...dangerStyle }}>
        <span className={`${labelStyle} bottom-1 left-2`}>Status bar</span>
      </div>

      {/* Bottom zone */}
      <div className="absolute bottom-0 left-0 right-0" style={{ height: bottomH, ...dangerStyle }}>
        <span className={`${labelStyle} top-1 left-2`}>Description & nav</span>
      </div>

      {/* Right zone */}
      <div
        className="absolute right-0"
        style={{
          top: topH,
          width: rightW,
          height: height - topH - bottomH,
          ...dangerStyle,
        }}
      >
        <span className={`${labelStyle} top-2 left-1/2 -translate-x-1/2 whitespace-nowrap`}>Actions</span>
      </div>

      {/* Safe area border */}
      <div
        className="absolute border border-green-500/30 rounded-sm"
        style={{
          top: topH,
          left: 0,
          width: width - rightW,
          height: height - topH - bottomH,
        }}
      />
    </div>
  );
}
```

**Step 3: Implement MockupOverlay with Instagram layout**

Add to the same file:

```tsx
function MockupOverlay({ platform, width, height }: { platform: SocialPlatform; width: number; height: number }) {
  // Scale factor for icon/text sizing relative to a 1080-wide reference
  const s = width / 1080;

  return (
    <div className="absolute inset-0 pointer-events-none z-10" style={{ fontSize: 14 * s }}>
      {platform === 'instagram' && <InstagramMockup s={s} width={width} height={height} />}
      {platform === 'tiktok' && <TikTokMockup s={s} width={width} height={height} />}
      {platform === 'youtube' && <YouTubeMockup s={s} width={width} height={height} />}
    </div>
  );
}
```

**Step 4: Implement InstagramMockup**

```tsx
function InstagramMockup({ s, width, height }: { s: number; width: number; height: number }) {
  const iconSize = 28 * s;
  const gap = 20 * s;

  return (
    <>
      {/* Right action buttons */}
      <div
        className="absolute flex flex-col items-center"
        style={{ right: 12 * s, bottom: height * 0.18, gap }}
      >
        <ActionIcon size={iconSize}>
          {/* Heart */}
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </ActionIcon>
        <ActionIcon size={iconSize}>
          {/* Comment */}
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </ActionIcon>
        <ActionIcon size={iconSize}>
          {/* Share */}
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
        </ActionIcon>
        <ActionIcon size={iconSize}>
          {/* Bookmark */}
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </ActionIcon>
      </div>

      {/* Bottom left - username */}
      <div className="absolute" style={{ left: 12 * s, bottom: height * 0.08 }}>
        <div className="flex items-center" style={{ gap: 8 * s }}>
          <div
            className="rounded-full bg-white/30 border border-white/40"
            style={{ width: 32 * s, height: 32 * s }}
          />
          <div>
            <div className="text-white font-semibold" style={{ fontSize: 14 * s }}>username</div>
            <div className="text-white/60" style={{ fontSize: 11 * s }}>Original audio</div>
          </div>
        </div>
        <div className="text-white/70 mt-1" style={{ fontSize: 12 * s, maxWidth: width * 0.65 }}>
          Caption text goes here...
        </div>
      </div>

      {/* Bottom nav bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-around bg-black/40"
        style={{ height: 44 * s, paddingBottom: 4 * s }}
      >
        {['Home', 'Search', 'Add', 'Reels', 'Profile'].map((label) => (
          <div key={label} className="flex flex-col items-center" style={{ gap: 2 * s }}>
            <div className="rounded bg-white/30" style={{ width: 22 * s, height: 22 * s }} />
            <span className="text-white/50" style={{ fontSize: 9 * s }}>{label}</span>
          </div>
        ))}
      </div>
    </>
  );
}
```

**Step 5: Implement TikTokMockup**

```tsx
function TikTokMockup({ s, width, height }: { s: number; width: number; height: number }) {
  const iconSize = 28 * s;
  const gap = 18 * s;

  return (
    <>
      {/* Right action buttons */}
      <div
        className="absolute flex flex-col items-center"
        style={{ right: 12 * s, bottom: height * 0.2, gap }}
      >
        {/* Profile */}
        <div
          className="rounded-full bg-white/30 border-2 border-white/50"
          style={{ width: 40 * s, height: 40 * s, marginBottom: 4 * s }}
        />
        <ActionIcon size={iconSize}>
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </ActionIcon>
        <ActionIcon size={iconSize}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </ActionIcon>
        <ActionIcon size={iconSize}>
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </ActionIcon>
        <ActionIcon size={iconSize}>
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
        </ActionIcon>
        {/* Music disc */}
        <div
          className="rounded-full bg-white/20 border-2 border-white/30 mt-2"
          style={{ width: 36 * s, height: 36 * s }}
        />
      </div>

      {/* Bottom left - username + caption */}
      <div className="absolute" style={{ left: 12 * s, bottom: 16 * s }}>
        <div className="text-white font-bold" style={{ fontSize: 15 * s }}>@username</div>
        <div className="text-white/80 mt-0.5" style={{ fontSize: 12 * s, maxWidth: width * 0.6 }}>
          Video description goes here with some hashtags...
        </div>
        <div className="flex items-center mt-1" style={{ gap: 6 * s }}>
          <div className="rounded bg-white/20" style={{ width: 14 * s, height: 14 * s }} />
          <span className="text-white/60" style={{ fontSize: 11 * s }}>Original sound - username</span>
        </div>
      </div>
    </>
  );
}
```

**Step 6: Implement YouTubeMockup**

```tsx
function YouTubeMockup({ s, width, height }: { s: number; width: number; height: number }) {
  const iconSize = 28 * s;
  const gap = 20 * s;

  return (
    <>
      {/* Right action buttons */}
      <div
        className="absolute flex flex-col items-center"
        style={{ right: 12 * s, bottom: height * 0.22, gap }}
      >
        <ActionIcon size={iconSize}>
          {/* Like */}
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
        </ActionIcon>
        <ActionIcon size={iconSize}>
          {/* Dislike */}
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
        </ActionIcon>
        <ActionIcon size={iconSize}>
          {/* Comment */}
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </ActionIcon>
        <ActionIcon size={iconSize}>
          {/* Share */}
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
        </ActionIcon>
      </div>

      {/* Bottom left - channel info */}
      <div className="absolute" style={{ left: 12 * s, bottom: height * 0.08 }}>
        <div className="flex items-center" style={{ gap: 8 * s }}>
          <div
            className="rounded-full bg-white/30 border border-white/40"
            style={{ width: 32 * s, height: 32 * s }}
          />
          <span className="text-white font-semibold" style={{ fontSize: 13 * s }}>Channel Name</span>
          <div
            className="rounded-full bg-white/90 text-black font-semibold flex items-center justify-center"
            style={{ fontSize: 11 * s, paddingInline: 12 * s, height: 26 * s }}
          >
            Subscribe
          </div>
        </div>
        <div className="text-white/70 mt-1" style={{ fontSize: 12 * s, maxWidth: width * 0.65 }}>
          Video title and description...
        </div>
      </div>

      {/* Bottom nav bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-around bg-black/50"
        style={{ height: 44 * s, paddingBottom: 4 * s }}
      >
        {['Home', 'Shorts', '+', 'Subs', 'You'].map((label) => (
          <div key={label} className="flex flex-col items-center" style={{ gap: 2 * s }}>
            <div className="rounded bg-white/30" style={{ width: 22 * s, height: 22 * s }} />
            <span className="text-white/50" style={{ fontSize: 9 * s }}>{label}</span>
          </div>
        ))}
      </div>
    </>
  );
}
```

**Step 7: Add the shared ActionIcon helper**

Place this near the top of the file (after imports):

```tsx
function ActionIcon({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center" style={{ gap: 2 }}>
      <svg
        viewBox="0 0 24 24"
        fill="white"
        opacity={0.85}
        style={{ width: size, height: size }}
      >
        {children}
      </svg>
      <div
        className="rounded-full bg-white/30"
        style={{ width: size * 0.4, height: 3 }}
      />
    </div>
  );
}
```

**Step 8: Commit**

```bash
git add apps/web/src/features/editor-v2/scene/SocialPreviewOverlay.tsx
git commit -m "feat(editor): add social preview overlay with mockup and safe zone modes"
```

---

## Task 3: Scene Toolbar Component

**Files:**
- Create: `apps/web/src/features/editor-v2/scene/SceneToolbar.tsx`
- Reference: `apps/web/src/features/editor-v2/scene/social-platforms.ts`

**Step 1: Create the toolbar component**

```tsx
// apps/web/src/features/editor-v2/scene/SceneToolbar.tsx

'use client';

import { type SocialPlatform, type OverlayMode, PLATFORM_LIST } from './social-platforms';

interface SceneToolbarProps {
  activePlatform: SocialPlatform | null;
  overlayMode: OverlayMode;
  scalePercent: number;
  onPlatformChange: (platform: SocialPlatform | null) => void;
  onModeChange: (mode: OverlayMode) => void;
}

const PLATFORM_ICONS: Record<SocialPlatform, { label: string; icon: React.ReactNode }> = {
  instagram: {
    label: 'Instagram',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  tiktok: {
    label: 'TikTok',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1 0-5.78c.29 0 .57.04.84.11v-3.5a6.37 6.37 0 0 0-.84-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.87a8.28 8.28 0 0 0 4.77 1.51V6.93a4.84 4.84 0 0 1-1.01-.24z" />
      </svg>
    ),
  },
  youtube: {
    label: 'YouTube',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.88.55 9.38.55 9.38.55s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
      </svg>
    ),
  },
};

export function SceneToolbar({
  activePlatform,
  overlayMode,
  scalePercent,
  onPlatformChange,
  onModeChange,
}: SceneToolbarProps) {
  const handlePlatformClick = (platform: SocialPlatform) => {
    if (activePlatform === platform) {
      onPlatformChange(null); // Toggle off
    } else {
      onPlatformChange(platform);
    }
  };

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5
                    px-2 py-1 rounded-lg bg-[var(--editor-bg-surface)]/80 backdrop-blur-sm
                    border border-[var(--editor-border-subtle)]">
      {/* Platform buttons */}
      {PLATFORM_LIST.map((platform) => (
        <button
          key={platform}
          onClick={() => handlePlatformClick(platform)}
          title={PLATFORM_ICONS[platform].label}
          className={`p-1.5 rounded-md transition-colors ${
            activePlatform === platform
              ? 'bg-[var(--editor-accent)] text-white'
              : 'text-[var(--editor-text-muted)] hover:text-[var(--editor-text-secondary)] hover:bg-[var(--editor-bg-hover)]'
          }`}
        >
          <div className="w-4 h-4">
            {PLATFORM_ICONS[platform].icon}
          </div>
        </button>
      ))}

      {/* Separator + mode toggle (only when a platform is active) */}
      {activePlatform && (
        <>
          <div className="w-px h-4 bg-[var(--editor-border-subtle)] mx-1" />

          <div className="flex rounded-md bg-[var(--editor-bg-base)]/60 p-0.5">
            <button
              onClick={() => onModeChange('mockup')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                overlayMode === 'mockup'
                  ? 'bg-[var(--editor-bg-hover)] text-[var(--editor-text-primary)]'
                  : 'text-[var(--editor-text-muted)] hover:text-[var(--editor-text-secondary)]'
              }`}
            >
              Mockup
            </button>
            <button
              onClick={() => onModeChange('safezones')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
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

      {/* Scale indicator */}
      <div className="w-px h-4 bg-[var(--editor-border-subtle)] mx-1" />
      <span className="text-[10px] text-[var(--editor-text-muted)] font-mono tabular-nums">
        {scalePercent}%
      </span>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/scene/SceneToolbar.tsx
git commit -m "feat(editor): add scene toolbar with social platform toggles"
```

---

## Task 4: Integrate Into Scene + Add Keyboard Shortcut

**Files:**
- Modify: `apps/web/src/features/editor-v2/scene/Scene.tsx` (all lines, ~90 lines)
- Modify: `apps/web/src/features/editor-v2/hooks/use-keyboard-shortcuts.ts:42` (add `P` shortcut)

**Step 1: Update Scene.tsx to add overlay state, toolbar, and overlay**

Replace the full contents of `apps/web/src/features/editor-v2/scene/Scene.tsx`:

```tsx
/**
 * Scene Component
 * Maximized preview area containing the Remotion player
 * with optional social platform preview overlay
 */

'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Player } from '../player/Player';
import { useProject } from '../store/use-editor-store';
import { SocialPreviewOverlay } from './SocialPreviewOverlay';
import { SceneToolbar } from './SceneToolbar';
import { type SocialPlatform, type OverlayMode, PLATFORM_LIST } from './social-platforms';

interface SceneProps {
  className?: string;
}

export function Scene({ className }: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const project = useProject();
  const [scale, setScale] = useState(1);

  // Social preview state
  const [activePlatform, setActivePlatform] = useState<SocialPlatform | null>(null);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('mockup');
  const lastPlatformRef = useRef<SocialPlatform>('instagram');

  // Track last-used platform for keyboard toggle
  const handlePlatformChange = useCallback((platform: SocialPlatform | null) => {
    if (platform) lastPlatformRef.current = platform;
    setActivePlatform(platform);
  }, []);

  // Keyboard shortcut: P toggles overlay
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.code === 'KeyP' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setActivePlatform((prev) => (prev ? null : lastPlatformRef.current));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Calculate scale to fit player in container
  const calculateScale = useCallback(() => {
    if (!containerRef.current || !project) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth - 64;
    const containerHeight = container.clientHeight - 64;

    const videoWidth = project.videoSettings.canvasWidth;
    const videoHeight = project.videoSettings.canvasHeight;

    const scaleX = containerWidth / videoWidth;
    const scaleY = containerHeight / videoHeight;
    const newScale = Math.min(scaleX, scaleY, 1);

    setScale(newScale);
  }, [project]);

  useEffect(() => {
    calculateScale();
    const handleResize = () => calculateScale();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateScale]);

  useEffect(() => {
    calculateScale();
  }, [project, calculateScale]);

  if (!project) {
    return (
      <div className={`flex items-center justify-center bg-[var(--editor-bg-base)] ${className || ''}`}>
        <p className="text-[var(--editor-text-muted)] text-sm">Loading...</p>
      </div>
    );
  }

  const videoWidth = project.videoSettings.canvasWidth;
  const videoHeight = project.videoSettings.canvasHeight;
  const scalePercent = Math.round(scale * 100);

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center bg-[var(--editor-bg-base)] overflow-hidden ${className || ''}`}
    >
      {/* Player container with scale */}
      <div
        className="relative rounded-lg overflow-hidden shadow-2xl"
        style={{
          width: videoWidth,
          height: videoHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <Player />

        {/* Social preview overlay - inside scaled container so it matches video exactly */}
        {activePlatform && (
          <SocialPreviewOverlay
            platform={activePlatform}
            mode={overlayMode}
            width={videoWidth}
            height={videoHeight}
          />
        )}
      </div>

      {/* Scene toolbar - replaces old scale indicator */}
      <SceneToolbar
        activePlatform={activePlatform}
        overlayMode={overlayMode}
        scalePercent={scalePercent}
        onPlatformChange={handlePlatformChange}
        onModeChange={setOverlayMode}
      />
    </div>
  );
}
```

Note: The old standalone scale indicator `<div>` at `bottom-3 right-3` is removed — the scale percentage is now part of the `SceneToolbar`.

**Step 2: Commit**

```bash
git add apps/web/src/features/editor-v2/scene/Scene.tsx
git commit -m "feat(editor): integrate social preview overlay and toolbar into scene"
```

---

## Task 5: Verify Build

**Step 1: Run the build**

```bash
cd apps/web && pnpm build
```

Expected: No TypeScript errors. If there are import path issues, fix them.

**Step 2: Manual verification**

Open the editor in browser. Verify:
- Three platform icons visible in toolbar at bottom of scene
- Clicking a platform shows the mockup overlay on the video
- Clicking the active platform hides the overlay
- Switching between "Mockup" and "Safe Zones" mode works
- Pressing `P` toggles the overlay on/off
- The overlay does not interfere with video playback clicks
- Scale percentage still shows in the toolbar

**Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(editor): address build issues in social preview overlay"
```
