'use client';

import { type SocialPlatform, type OverlayMode, PLATFORMS } from './social-platforms';

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Safe-zone overlay
// ---------------------------------------------------------------------------

interface ZoneProps {
  platform: SocialPlatform;
  width: number;
  height: number;
}

function SafeZoneOverlay({ platform, width, height }: ZoneProps) {
  const zones = PLATFORMS[platform].safeZones;

  const topH = height * (zones.top / 100);
  const bottomH = height * (zones.bottom / 100);
  const rightW = width * (zones.right / 100);
  const middleH = height - topH - bottomH;

  const dangerStyle: React.CSSProperties = {
    background: 'rgba(255, 80, 60, 0.15)',
    border: '1px dashed rgba(255, 80, 60, 0.4)',
    pointerEvents: 'none',
  };

  const labelStyle: React.CSSProperties = {
    color: 'rgba(255, 80, 60, 0.7)',
    fontSize: Math.max(10, width * 0.012),
    fontWeight: 500,
    letterSpacing: '0.02em',
    pointerEvents: 'none',
    userSelect: 'none',
  };

  return (
    <div
      className="absolute inset-0"
      style={{ pointerEvents: 'none', width, height }}
    >
      {/* Top zone */}
      <div
        className="absolute left-0 right-0 top-0 flex items-center justify-center"
        style={{ ...dangerStyle, height: topH }}
      >
        <span style={labelStyle}>Status bar</span>
      </div>

      {/* Bottom zone */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-center"
        style={{ ...dangerStyle, height: bottomH }}
      >
        <span style={labelStyle}>Description &amp; nav</span>
      </div>

      {/* Right zone (between top and bottom) */}
      <div
        className="absolute right-0 flex items-center justify-center"
        style={{
          ...dangerStyle,
          top: topH,
          width: rightW,
          height: middleH,
        }}
      >
        <span style={{ ...labelStyle, writingMode: 'vertical-rl' }}>Actions</span>
      </div>

      {/* Safe area outline */}
      <div
        className="absolute border border-green-500/30"
        style={{
          top: topH,
          left: 0,
          width: width - rightW,
          height: middleH,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mockup overlay (delegates to platform-specific sub-components)
// ---------------------------------------------------------------------------

function MockupOverlay({ platform, width, height }: ZoneProps) {
  const s = width / 1080;

  switch (platform) {
    case 'instagram':
      return <InstagramMockup width={width} height={height} s={s} />;
    case 'tiktok':
      return <TikTokMockup width={width} height={height} s={s} />;
    case 'youtube':
      return <YouTubeMockup width={width} height={height} s={s} />;
  }
}

// ---------------------------------------------------------------------------
// Shared ActionIcon helper
// ---------------------------------------------------------------------------

function ActionIcon({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center" style={{ gap: 2 }}>
      <svg viewBox="0 0 24 24" fill="white" opacity={0.85} style={{ width: size, height: size }}>
        {children}
      </svg>
      <div className="rounded-full bg-white/30" style={{ width: size * 0.4, height: 3 }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG icon paths
// ---------------------------------------------------------------------------

const ICON_HEART = (
  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
);
const ICON_COMMENT = (
  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
);
const ICON_SHARE = (
  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
);
const ICON_BOOKMARK = (
  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
);
const ICON_LIKE = (
  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
);
const ICON_DISLIKE = (
  <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
);

// ---------------------------------------------------------------------------
// Platform-specific mockups
// ---------------------------------------------------------------------------

interface MockupProps {
  width: number;
  height: number;
  /** Scale factor relative to 1080px reference width */
  s: number;
}

// ---- Instagram ----

function InstagramMockup({ width, height, s }: MockupProps) {
  const iconSize = 28 * s;
  const navH = 44 * s;

  return (
    <div className="absolute inset-0" style={{ pointerEvents: 'none', width, height }}>
      {/* Right-side action icons */}
      <div
        className="absolute flex flex-col items-center"
        style={{
          right: 12 * s,
          bottom: navH + 120 * s,
          gap: 20 * s,
        }}
      >
        <ActionIcon size={iconSize}>{ICON_HEART}</ActionIcon>
        <ActionIcon size={iconSize}>{ICON_COMMENT}</ActionIcon>
        <ActionIcon size={iconSize}>{ICON_SHARE}</ActionIcon>
        <ActionIcon size={iconSize}>{ICON_BOOKMARK}</ActionIcon>
      </div>

      {/* Bottom-left: avatar + username */}
      <div
        className="absolute flex items-center"
        style={{
          left: 12 * s,
          bottom: navH + 56 * s,
          gap: 8 * s,
        }}
      >
        <div
          className="rounded-full bg-white/30"
          style={{ width: 32 * s, height: 32 * s, flexShrink: 0 }}
        />
        <div className="flex flex-col" style={{ gap: 2 * s }}>
          <span
            className="font-semibold text-white/90"
            style={{ fontSize: 13 * s, lineHeight: 1.2 }}
          >
            username
          </span>
          <span className="text-white/50" style={{ fontSize: 11 * s, lineHeight: 1.2 }}>
            Original audio
          </span>
        </div>
      </div>

      {/* Caption text placeholder */}
      <div
        className="absolute"
        style={{
          left: 12 * s,
          right: 60 * s,
          bottom: navH + 16 * s,
        }}
      >
        <div className="rounded bg-white/20" style={{ height: 12 * s, width: '70%' }} />
      </div>

      {/* Bottom nav bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-around bg-black/40"
        style={{ height: navH }}
      >
        {['Home', 'Search', 'Add', 'Reels', 'Profile'].map((label) => (
          <div key={label} className="flex flex-col items-center" style={{ gap: 2 * s }}>
            <div
              className="rounded bg-white/40"
              style={{ width: 20 * s, height: 20 * s }}
            />
            <span className="text-white/40" style={{ fontSize: 9 * s }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- TikTok ----

function TikTokMockup({ width, height, s }: MockupProps) {
  const iconSize = 28 * s;

  return (
    <div className="absolute inset-0" style={{ pointerEvents: 'none', width, height }}>
      {/* Right-side: profile + action icons + spinning disc */}
      <div
        className="absolute flex flex-col items-center"
        style={{
          right: 12 * s,
          bottom: 100 * s,
          gap: 18 * s,
        }}
      >
        {/* Profile circle */}
        <div
          className="rounded-full bg-white/30 border-2 border-white/50"
          style={{ width: 40 * s, height: 40 * s }}
        />
        <ActionIcon size={iconSize}>{ICON_HEART}</ActionIcon>
        <ActionIcon size={iconSize}>{ICON_COMMENT}</ActionIcon>
        <ActionIcon size={iconSize}>{ICON_BOOKMARK}</ActionIcon>
        <ActionIcon size={iconSize}>{ICON_SHARE}</ActionIcon>
        {/* Spinning music disc */}
        <div
          className="rounded-full bg-gradient-to-br from-white/30 to-white/10 border border-white/20"
          style={{ width: 36 * s, height: 36 * s }}
        >
          <div
            className="rounded-full bg-black/50 mx-auto"
            style={{
              width: 12 * s,
              height: 12 * s,
              marginTop: 12 * s,
            }}
          />
        </div>
      </div>

      {/* Bottom-left: username + description + music row */}
      <div
        className="absolute flex flex-col"
        style={{
          left: 12 * s,
          bottom: 20 * s,
          right: 80 * s,
          gap: 8 * s,
        }}
      >
        <span
          className="font-bold text-white/90"
          style={{ fontSize: 15 * s, lineHeight: 1.2 }}
        >
          @username
        </span>
        <span className="text-white/70" style={{ fontSize: 13 * s, lineHeight: 1.3 }}>
          Description text goes here #hashtag
        </span>
        <div className="flex items-center" style={{ gap: 6 * s }}>
          <svg
            viewBox="0 0 24 24"
            fill="white"
            opacity={0.6}
            style={{ width: 12 * s, height: 12 * s, flexShrink: 0 }}
          >
            <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
          </svg>
          <span className="text-white/60" style={{ fontSize: 12 * s }}>
            Original sound - username
          </span>
        </div>
      </div>
    </div>
  );
}

// ---- YouTube ----

function YouTubeMockup({ width, height, s }: MockupProps) {
  const iconSize = 26 * s;
  const navH = 44 * s;

  return (
    <div className="absolute inset-0" style={{ pointerEvents: 'none', width, height }}>
      {/* Right-side action icons */}
      <div
        className="absolute flex flex-col items-center"
        style={{
          right: 12 * s,
          bottom: navH + 140 * s,
          gap: 20 * s,
        }}
      >
        <ActionIcon size={iconSize}>{ICON_LIKE}</ActionIcon>
        <ActionIcon size={iconSize}>{ICON_DISLIKE}</ActionIcon>
        <ActionIcon size={iconSize}>{ICON_COMMENT}</ActionIcon>
        <ActionIcon size={iconSize}>{ICON_SHARE}</ActionIcon>
      </div>

      {/* Bottom-left: channel + subscribe */}
      <div
        className="absolute flex items-center"
        style={{
          left: 12 * s,
          bottom: navH + 60 * s,
          gap: 8 * s,
        }}
      >
        <div
          className="rounded-full bg-white/30"
          style={{ width: 32 * s, height: 32 * s, flexShrink: 0 }}
        />
        <span
          className="font-semibold text-white/90"
          style={{ fontSize: 13 * s, lineHeight: 1.2 }}
        >
          Channel Name
        </span>
        <div
          className="rounded-full bg-white px-2 flex items-center justify-center"
          style={{
            height: 24 * s,
            paddingLeft: 10 * s,
            paddingRight: 10 * s,
          }}
        >
          <span
            className="font-semibold text-black"
            style={{ fontSize: 11 * s, lineHeight: 1 }}
          >
            Subscribe
          </span>
        </div>
      </div>

      {/* Description text */}
      <div
        className="absolute"
        style={{
          left: 12 * s,
          right: 60 * s,
          bottom: navH + 24 * s,
        }}
      >
        <div className="rounded bg-white/20" style={{ height: 12 * s, width: '75%' }} />
      </div>

      {/* Bottom nav bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-around bg-black/50"
        style={{ height: navH }}
      >
        {['Home', 'Shorts', '+', 'Subs', 'You'].map((label) => (
          <div key={label} className="flex flex-col items-center" style={{ gap: 2 * s }}>
            <div
              className="rounded bg-white/40"
              style={{ width: 20 * s, height: 20 * s }}
            />
            <span className="text-white/40" style={{ fontSize: 9 * s }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
