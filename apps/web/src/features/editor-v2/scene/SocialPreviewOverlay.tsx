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
  const leftW = width * (zones.left / 100);
  const rightW = width * (zones.right / 100);
  const middleH = height - topH - bottomH;
  const middleW = width - leftW - rightW;

  const borderWidth = Math.max(1, Math.round(width / 500));

  const dangerStyle: React.CSSProperties = {
    background: 'rgba(255, 80, 60, 0.15)',
    border: `${borderWidth}px dashed rgba(255, 80, 60, 0.4)`,
    pointerEvents: 'none',
  };

  const labelStyle: React.CSSProperties = {
    color: 'rgba(255, 80, 60, 0.7)',
    fontSize: Math.max(10, width * 0.026),
    fontWeight: 500,
    letterSpacing: '0.02em',
    pointerEvents: 'none',
    userSelect: 'none',
  };

  return (
    <div
      className="absolute inset-0 z-10"
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

      {/* Left zone (between top and bottom) */}
      {leftW > 0 && (
        <div
          className="absolute left-0 flex items-center justify-center"
          style={{
            ...dangerStyle,
            top: topH,
            width: leftW,
            height: middleH,
          }}
        />
      )}

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
        className="absolute"
        style={{
          top: topH,
          left: leftW,
          width: middleW,
          height: middleH,
          border: `${borderWidth}px solid rgba(34, 197, 94, 0.3)`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mockup overlay
// ---------------------------------------------------------------------------

// All base values are CSS logical-pixel values measured from a real phone
// viewport (~393px wide on iPhone 14/15).  We scale by canvas / viewport
// to get realistic proportions on the 1080×1920 canvas.
const PHONE_VIEWPORT_WIDTH = 393;

function MockupOverlay({ platform, width, height }: ZoneProps) {
  const s = width / PHONE_VIEWPORT_WIDTH;

  return (
    <div className="absolute inset-0 pointer-events-none z-10" style={{ fontSize: 14 * s }}>
      {(() => {
        switch (platform) {
          case 'instagram':
            return <InstagramMockup width={width} height={height} s={s} />;
          case 'tiktok':
            return <TikTokMockup width={width} height={height} s={s} />;
          case 'youtube':
            return <YouTubeMockup width={width} height={height} s={s} />;
          default: {
            const _exhaustive: never = platform;
            return null;
          }
        }
      })()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

/** iOS-style status bar with time, signal, wifi, battery */
function StatusBar({ s }: { s: number }) {
  return (
    <div
      className="absolute top-0 left-0 right-0 flex items-center justify-between"
      style={{ height: 48 * s, paddingLeft: 28 * s, paddingRight: 20 * s, paddingTop: 12 * s }}
    >
      <span className="text-white font-semibold" style={{ fontSize: 15 * s, letterSpacing: 0.5 }}>
        9:41
      </span>
      <div className="flex items-center" style={{ gap: 5 * s }}>
        {/* Cellular signal bars */}
        <svg viewBox="0 0 18 12" style={{ width: 16 * s, height: 11 * s }}>
          <rect x="0" y="9" width="3" height="3" rx="0.5" fill="white" opacity={0.9} />
          <rect x="4.5" y="6" width="3" height="6" rx="0.5" fill="white" opacity={0.9} />
          <rect x="9" y="3" width="3" height="9" rx="0.5" fill="white" opacity={0.9} />
          <rect x="13.5" y="0" width="3" height="12" rx="0.5" fill="white" opacity={0.9} />
        </svg>
        {/* WiFi */}
        <svg viewBox="0 0 16 12" style={{ width: 15 * s, height: 11 * s }}>
          <path d="M1.5 4.5C4.5 1.5 11.5 1.5 14.5 4.5" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity={0.9} />
          <path d="M4 7.5c2-2 6-2 8 0" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity={0.9} />
          <circle cx="8" cy="11" r="1.2" fill="white" opacity={0.9} />
        </svg>
        {/* Battery */}
        <svg viewBox="0 0 28 13" style={{ width: 25 * s, height: 12 * s }}>
          <rect x="0.5" y="0.5" width="23" height="11.5" rx="2.5" fill="none" stroke="white" strokeWidth="1" opacity={0.35} />
          <rect x="2" y="2" width="18" height="8.5" rx="1.5" fill="white" opacity={0.9} />
          <rect x="24.5" y="3.5" width="2.5" height="5.5" rx="1.2" fill="white" opacity={0.4} />
        </svg>
      </div>
    </div>
  );
}

/** Bottom gradient for text readability */
function BottomGradient({ height, s }: { height: number; s: number }) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0"
      style={{
        height: height * 0.45,
        background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
      }}
    />
  );
}

/** Tab bar icon using SVG stroke */
function TabBarStrokeIcon({ path, s, active }: { path: React.ReactNode; s: number; active?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? 'white' : 'rgba(255,255,255,0.5)'}
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: 22 * s, height: 22 * s }}
    >
      {path}
    </svg>
  );
}

/** Tab bar icon using SVG fill */
function TabBarFillIcon({ path, s, active }: { path: React.ReactNode; s: number; active?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={active ? 'white' : 'rgba(255,255,255,0.5)'}
      style={{ width: 22 * s, height: 22 * s }}
    >
      {path}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// SVG icon paths — action icons (right side)
// ---------------------------------------------------------------------------

const ICON_HEART = (
  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
);
const ICON_COMMENT = (
  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
);
const ICON_SHARE_SEND = (
  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
);
const ICON_SHARE_ARROW = (
  <path d="M15 3l6 6-6 6v-4.5C9 10.5 5.5 12 3 15.5c.5-6.5 4-10 12-10.5V3z" />
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
const ICON_MORE_V = (
  <path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0-5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
);
const ICON_MORE_H = (
  <path d="M5 12a1 1 0 1 0 2 0 1 1 0 0 0-2 0zm6 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0zm6 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0z" />
);
const ICON_MUSIC = (
  <path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
);

// ---------------------------------------------------------------------------
// SVG icon paths — tab bar icons
// ---------------------------------------------------------------------------

const TAB_HOME = (
  <path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-5h6v5h3a1 1 0 001-1V10" />
);
const TAB_HOME_FILLED = (
  <path d="M12 3l9 9v8a2 2 0 01-2 2h-4v-5H9v5H5a2 2 0 01-2-2v-8l9-9z" />
);
const TAB_SEARCH = (
  <>
    <circle cx="10.5" cy="10.5" r="7" />
    <path d="M16 16l5.5 5.5" />
  </>
);
const TAB_REELS = (
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M9 3l-3 6M18 3l-3 6" />
  </>
);
const TAB_PROFILE = (
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a7 7 0 0114 0v1" />
  </>
);
const TAB_SHOP = (
  <>
    <path d="M6 6h12l1.5 14H4.5L6 6z" />
    <path d="M9 6V4a3 3 0 016 0v2" />
  </>
);
const TAB_INBOX = (
  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
);
const TAB_SHORTS = (
  <>
    <path d="M10 9l5 3.5-5 3.5V9z" />
    <rect x="5" y="2" width="14" height="20" rx="3" />
  </>
);
const TAB_SUBS = (
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M10 9.5l5 3-5 3v-6z" />
  </>
);

// ---------------------------------------------------------------------------
// Shared action helpers
// ---------------------------------------------------------------------------

function ActionIcon({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center" style={{ gap: 2 }}>
      <svg viewBox="0 0 24 24" fill="white" style={{ width: size, height: size, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}>
        {children}
      </svg>
    </div>
  );
}

function ActionIconWithLabel({ size, label, children }: { size: number; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center" style={{ gap: 3 }}>
      <svg viewBox="0 0 24 24" fill="white" style={{ width: size, height: size, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}>
        {children}
      </svg>
      <span
        className="font-semibold"
        style={{
          fontSize: size * 0.38,
          lineHeight: 1,
          color: 'white',
          textShadow: '0 1px 3px rgba(0,0,0,0.5)',
        }}
      >
        {label}
      </span>
    </div>
  );
}

function StrokeActionIcon({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center" style={{ gap: 2 }}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: size, height: size, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}
      >
        {children}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Platform-specific mockups
// All pixel values are CSS logical pixels from a ~393px wide iPhone viewport.
// ---------------------------------------------------------------------------

interface MockupProps {
  width: number;
  height: number;
  /** Scale factor: canvas width / phone viewport width */
  s: number;
}

// ---- Instagram Reels ----

function InstagramMockup({ width, height, s }: MockupProps) {
  const iconSize = 28 * s;
  const tabBarH = 50 * s;

  return (
    <>
      {/* Gradient overlays for readability */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: height * 0.15,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 100%)',
        }}
      />
      <BottomGradient height={height} s={s} />

      {/* Status bar */}
      <StatusBar s={s} />

      {/* Top: "Reels" title + camera icon */}
      <div
        className="absolute flex items-center justify-between"
        style={{
          top: 52 * s,
          left: 16 * s,
          right: 16 * s,
          height: 28 * s,
        }}
      >
        <span
          className="font-bold"
          style={{
            fontSize: 20 * s,
            color: 'white',
            textShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }}
        >
          Reels
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: 24 * s, height: 24 * s, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
        >
          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </div>

      {/* Right-side action icons */}
      <div
        className="absolute flex flex-col items-center"
        style={{
          right: 12 * s,
          bottom: tabBarH + 100 * s,
          gap: 20 * s,
        }}
      >
        <ActionIconWithLabel size={iconSize} label="1,248">{ICON_HEART}</ActionIconWithLabel>
        <ActionIconWithLabel size={iconSize} label="48">{ICON_COMMENT}</ActionIconWithLabel>
        <ActionIcon size={iconSize}>{ICON_SHARE_SEND}</ActionIcon>
        <ActionIcon size={iconSize}>{ICON_BOOKMARK}</ActionIcon>
        <ActionIcon size={iconSize}>{ICON_MORE_V}</ActionIcon>
        {/* Music album art */}
        <div
          className="rounded-md overflow-hidden border border-white/20"
          style={{
            width: 28 * s,
            height: 28 * s,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          <div className="w-full h-full flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="white" opacity={0.6} style={{ width: 14 * s, height: 14 * s }}>
              {ICON_MUSIC}
            </svg>
          </div>
        </div>
      </div>

      {/* Bottom-left: avatar + username + Follow */}
      <div
        className="absolute flex items-center"
        style={{
          left: 14 * s,
          bottom: tabBarH + 52 * s,
          gap: 8 * s,
        }}
      >
        <div
          className="rounded-full border-2 border-pink-400/70 overflow-hidden"
          style={{
            width: 32 * s,
            height: 32 * s,
            flexShrink: 0,
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          }}
        />
        <span
          className="font-semibold"
          style={{
            fontSize: 13.5 * s,
            lineHeight: 1.2,
            color: 'white',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}
        >
          viona_user
        </span>
        <div
          className="rounded-md border border-white/60 flex items-center justify-center"
          style={{ height: 24 * s, paddingLeft: 10 * s, paddingRight: 10 * s }}
        >
          <span
            className="font-semibold"
            style={{
              fontSize: 11.5 * s,
              lineHeight: 1,
              color: 'white',
              textShadow: '0 1px 2px rgba(0,0,0,0.4)',
            }}
          >
            Follow
          </span>
        </div>
      </div>

      {/* Caption text */}
      <div
        className="absolute"
        style={{
          left: 14 * s,
          right: 56 * s,
          bottom: tabBarH + 30 * s,
        }}
      >
        <span
          style={{
            fontSize: 13 * s,
            lineHeight: 1.35,
            color: 'rgba(255,255,255,0.85)',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}
        >
          Check out this edit ✨ #reels #edit
        </span>
      </div>

      {/* Audio row */}
      <div
        className="absolute flex items-center"
        style={{
          left: 14 * s,
          bottom: tabBarH + 10 * s,
          gap: 6 * s,
        }}
      >
        <svg viewBox="0 0 24 24" fill="white" opacity={0.55}
          style={{ width: 12 * s, height: 12 * s, flexShrink: 0 }}>
          {ICON_MUSIC}
        </svg>
        <span
          style={{
            fontSize: 11.5 * s,
            color: 'rgba(255,255,255,0.6)',
            textShadow: '0 1px 2px rgba(0,0,0,0.4)',
          }}
        >
          Original audio · viona_user
        </span>
      </div>

      {/* Bottom tab bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-around"
        style={{
          height: tabBarH,
          paddingBottom: 6 * s,
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)',
        }}
      >
        <div className="flex flex-col items-center" style={{ gap: 2 * s }}>
          <TabBarStrokeIcon path={TAB_HOME} s={s} />
          <span className="text-white/50" style={{ fontSize: 9 * s }}>Home</span>
        </div>
        <div className="flex flex-col items-center" style={{ gap: 2 * s }}>
          <TabBarStrokeIcon path={TAB_SEARCH} s={s} />
          <span className="text-white/50" style={{ fontSize: 9 * s }}>Search</span>
        </div>
        <div className="flex flex-col items-center" style={{ gap: 2 * s }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1.8}
            strokeLinecap="round" strokeLinejoin="round"
            style={{ width: 26 * s, height: 26 * s }}>
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M12 8v8M8 12h8" />
          </svg>
        </div>
        <div className="flex flex-col items-center" style={{ gap: 2 * s }}>
          <TabBarStrokeIcon path={TAB_REELS} s={s} active />
          <span className="text-white font-semibold" style={{ fontSize: 9 * s }}>Reels</span>
        </div>
        <div className="flex flex-col items-center" style={{ gap: 2 * s }}>
          <TabBarStrokeIcon path={TAB_PROFILE} s={s} />
          <span className="text-white/50" style={{ fontSize: 9 * s }}>Profile</span>
        </div>
      </div>

    </>
  );
}

// ---- TikTok ----

function TikTokMockup({ width, height, s }: MockupProps) {
  const iconSize = 28 * s;
  const tabBarH = 50 * s;

  return (
    <>
      {/* Gradient overlays */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: height * 0.12,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 100%)',
        }}
      />
      <BottomGradient height={height} s={s} />

      {/* Status bar */}
      <StatusBar s={s} />

      {/* Top: "Following | For You" tabs */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          top: 52 * s,
          left: 0,
          right: 0,
          height: 32 * s,
          gap: 24 * s,
        }}
      >
        <span
          className="font-medium"
          style={{
            fontSize: 16 * s,
            color: 'rgba(255,255,255,0.5)',
            textShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
        >
          Following
        </span>
        <div className="flex flex-col items-center" style={{ gap: 4 * s }}>
          <span
            className="font-bold"
            style={{
              fontSize: 17 * s,
              color: 'white',
              textShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
          >
            For You
          </span>
          <div className="rounded-full bg-white" style={{ width: 24 * s, height: 2.5 * s }} />
        </div>
      </div>

      {/* Top-right: search icon */}
      <div className="absolute" style={{ top: 54 * s, right: 14 * s }}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: 22 * s, height: 22 * s, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M16.5 16.5L21 21" />
        </svg>
      </div>

      {/* Right-side: profile + action icons + music disc */}
      <div
        className="absolute flex flex-col items-center"
        style={{
          right: 10 * s,
          bottom: tabBarH + 80 * s,
          gap: 18 * s,
        }}
      >
        {/* Profile circle with + badge */}
        <div className="relative" style={{ marginBottom: 6 * s }}>
          <div
            className="rounded-full border-2 border-white/60 overflow-hidden"
            style={{
              width: 44 * s,
              height: 44 * s,
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            }}
          />
          <div
            className="absolute rounded-full bg-[#fe2c55] flex items-center justify-center"
            style={{
              width: 18 * s,
              height: 18 * s,
              bottom: -5 * s,
              left: '50%',
              transform: 'translateX(-50%)',
              border: '2px solid #111',
            }}
          >
            <span className="text-white font-bold" style={{ fontSize: 13 * s, lineHeight: 1 }}>+</span>
          </div>
        </div>
        <ActionIconWithLabel size={iconSize} label="45.2K">{ICON_HEART}</ActionIconWithLabel>
        <ActionIconWithLabel size={iconSize} label="312">{ICON_COMMENT}</ActionIconWithLabel>
        <ActionIconWithLabel size={iconSize} label="2,841">{ICON_BOOKMARK}</ActionIconWithLabel>
        <ActionIcon size={iconSize}>{ICON_SHARE_ARROW}</ActionIcon>
        {/* Spinning music disc */}
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            width: 38 * s,
            height: 38 * s,
            background: 'conic-gradient(from 0deg, #1a1a1a, #333, #1a1a1a, #333, #1a1a1a)',
            border: `${2 * s}px solid rgba(255,255,255,0.1)`,
          }}
        >
          <div
            className="rounded-full"
            style={{
              width: 14 * s,
              height: 14 * s,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: `${1.5 * s}px solid rgba(255,255,255,0.2)`,
            }}
          />
        </div>
      </div>

      {/* Bottom-left: username + description + music row */}
      <div
        className="absolute flex flex-col"
        style={{
          left: 14 * s,
          bottom: tabBarH + 14 * s,
          right: 76 * s,
          gap: 8 * s,
        }}
      >
        <span
          className="font-bold"
          style={{
            fontSize: 15.5 * s,
            lineHeight: 1.2,
            color: 'white',
            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
          }}
        >
          @viona_user
        </span>
        <span
          style={{
            fontSize: 13.5 * s,
            lineHeight: 1.35,
            color: 'rgba(255,255,255,0.8)',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}
        >
          Check out this video 🔥 #fyp #viral #edit
        </span>
        <div className="flex items-center" style={{ gap: 6 * s }}>
          <svg viewBox="0 0 24 24" fill="white" opacity={0.6}
            style={{ width: 12 * s, height: 12 * s, flexShrink: 0 }}>
            {ICON_MUSIC}
          </svg>
          <span
            style={{
              fontSize: 12 * s,
              color: 'rgba(255,255,255,0.65)',
              textShadow: '0 1px 2px rgba(0,0,0,0.4)',
            }}
          >
            Original sound — viona_user
          </span>
        </div>
      </div>

      {/* Bottom tab bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-around"
        style={{
          height: tabBarH,
          paddingBottom: 6 * s,
          background: 'rgba(0,0,0,0.85)',
        }}
      >
        <div className="flex flex-col items-center" style={{ gap: 2 * s }}>
          <TabBarFillIcon path={TAB_HOME_FILLED} s={s} active />
          <span className="text-white font-medium" style={{ fontSize: 9.5 * s }}>Home</span>
        </div>
        <div className="flex flex-col items-center" style={{ gap: 2 * s }}>
          <TabBarStrokeIcon path={TAB_SHOP} s={s} />
          <span className="text-white/50" style={{ fontSize: 9.5 * s }}>Shop</span>
        </div>
        {/* TikTok distinctive "+" button */}
        <div className="relative flex items-center justify-center" style={{ width: 46 * s, height: 28 * s }}>
          <div
            className="absolute rounded-md"
            style={{
              width: 38 * s,
              height: 24 * s,
              left: 0,
              background: '#25f4ee',
              borderRadius: 6 * s,
            }}
          />
          <div
            className="absolute rounded-md"
            style={{
              width: 38 * s,
              height: 24 * s,
              right: 0,
              background: '#fe2c55',
              borderRadius: 6 * s,
            }}
          />
          <div
            className="relative rounded-md bg-white flex items-center justify-center"
            style={{
              width: 38 * s,
              height: 24 * s,
              borderRadius: 6 * s,
            }}
          >
            <span className="font-bold text-black" style={{ fontSize: 18 * s, lineHeight: 1 }}>+</span>
          </div>
        </div>
        <div className="flex flex-col items-center" style={{ gap: 2 * s }}>
          <TabBarStrokeIcon path={TAB_INBOX} s={s} />
          <span className="text-white/50" style={{ fontSize: 9.5 * s }}>Inbox</span>
        </div>
        <div className="flex flex-col items-center" style={{ gap: 2 * s }}>
          <TabBarStrokeIcon path={TAB_PROFILE} s={s} />
          <span className="text-white/50" style={{ fontSize: 9.5 * s }}>Profile</span>
        </div>
      </div>

    </>
  );
}

// ---- YouTube Shorts ----

function YouTubeMockup({ width, height, s }: MockupProps) {
  const iconSize = 26 * s;
  const tabBarH = 52 * s;

  return (
    <>
      {/* Gradient overlays */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: height * 0.12,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 100%)',
        }}
      />
      <BottomGradient height={height} s={s} />

      {/* Status bar */}
      <StatusBar s={s} />

      {/* Top: Shorts logo + search/camera/more */}
      <div
        className="absolute flex items-center justify-between"
        style={{
          top: 52 * s,
          left: 16 * s,
          right: 16 * s,
          height: 28 * s,
        }}
      >
        <div className="flex items-center" style={{ gap: 6 * s }}>
          {/* YouTube Shorts icon (simplified) */}
          <svg viewBox="0 0 20 20" fill="none" style={{ width: 20 * s, height: 20 * s }}>
            <rect x="2" y="4" width="16" height="12" rx="2" fill="#FF0000" />
            <path d="M8.5 7.5l5 2.5-5 2.5v-5z" fill="white" />
          </svg>
          <span
            className="font-bold"
            style={{
              fontSize: 18 * s,
              color: 'white',
              textShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
          >
            Shorts
          </span>
        </div>
        <div className="flex items-center" style={{ gap: 18 * s }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round"
            style={{ width: 22 * s, height: 22 * s, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>
            <circle cx="11" cy="11" r="7" />
            <path d="M16.5 16.5L21 21" />
          </svg>
          <svg viewBox="0 0 24 24" fill="white" opacity={0.85}
            style={{ width: 22 * s, height: 22 * s, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>
            {ICON_MORE_V}
          </svg>
        </div>
      </div>

      {/* Right-side action icons */}
      <div
        className="absolute flex flex-col items-center"
        style={{
          right: 12 * s,
          bottom: tabBarH + 110 * s,
          gap: 20 * s,
        }}
      >
        <ActionIconWithLabel size={iconSize} label="3.4K">{ICON_LIKE}</ActionIconWithLabel>
        <ActionIcon size={iconSize}>{ICON_DISLIKE}</ActionIcon>
        <ActionIconWithLabel size={iconSize} label="89">{ICON_COMMENT}</ActionIconWithLabel>
        <ActionIcon size={iconSize}>{ICON_SHARE_ARROW}</ActionIcon>
        <StrokeActionIcon size={iconSize}>
          {ICON_MORE_H}
        </StrokeActionIcon>
      </div>

      {/* Bottom-left: channel avatar + name + Subscribe */}
      <div
        className="absolute flex items-center"
        style={{
          left: 14 * s,
          bottom: tabBarH + 52 * s,
          gap: 8 * s,
        }}
      >
        <div
          className="rounded-full overflow-hidden"
          style={{
            width: 34 * s,
            height: 34 * s,
            flexShrink: 0,
            background: 'linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)',
          }}
        />
        <span
          className="font-semibold"
          style={{
            fontSize: 13.5 * s,
            lineHeight: 1.2,
            color: 'white',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}
        >
          @viona
        </span>
        <div
          className="rounded-full bg-white flex items-center justify-center"
          style={{
            height: 28 * s,
            paddingLeft: 14 * s,
            paddingRight: 14 * s,
          }}
        >
          <span
            className="font-semibold text-black"
            style={{ fontSize: 12.5 * s, lineHeight: 1 }}
          >
            Subscribe
          </span>
        </div>
      </div>

      {/* Description text */}
      <div
        className="absolute"
        style={{
          left: 14 * s,
          right: 56 * s,
          bottom: tabBarH + 30 * s,
        }}
      >
        <span
          style={{
            fontSize: 13 * s,
            lineHeight: 1.35,
            color: 'rgba(255,255,255,0.8)',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}
        >
          Amazing video edit 🎬 #shorts #viral
        </span>
      </div>

      {/* Sound / music row */}
      <div
        className="absolute flex items-center"
        style={{
          left: 14 * s,
          bottom: tabBarH + 10 * s,
          gap: 6 * s,
        }}
      >
        <svg viewBox="0 0 24 24" fill="white" opacity={0.55}
          style={{ width: 12 * s, height: 12 * s, flexShrink: 0 }}>
          {ICON_MUSIC}
        </svg>
        <span
          style={{
            fontSize: 11.5 * s,
            color: 'rgba(255,255,255,0.6)',
            textShadow: '0 1px 2px rgba(0,0,0,0.4)',
          }}
        >
          Original audio
        </span>
      </div>

      {/* Bottom tab bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-around"
        style={{
          height: tabBarH,
          paddingBottom: 8 * s,
          background: 'rgba(15,15,15,0.9)',
        }}
      >
        <div className="flex flex-col items-center" style={{ gap: 2 * s }}>
          <TabBarStrokeIcon path={TAB_HOME} s={s} />
          <span className="text-white/50" style={{ fontSize: 9 * s }}>Home</span>
        </div>
        <div className="flex flex-col items-center" style={{ gap: 2 * s }}>
          <TabBarStrokeIcon path={TAB_SHORTS} s={s} active />
          <span className="text-white font-semibold" style={{ fontSize: 9 * s }}>Shorts</span>
        </div>
        {/* YouTube + button */}
        <div className="flex flex-col items-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.6}
            strokeLinecap="round" strokeLinejoin="round"
            style={{ width: 32 * s, height: 32 * s }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v8M8 12h8" />
          </svg>
        </div>
        <div className="flex flex-col items-center" style={{ gap: 2 * s }}>
          <TabBarStrokeIcon path={TAB_SUBS} s={s} />
          <span className="text-white/50" style={{ fontSize: 9 * s }}>Subs</span>
        </div>
        <div className="flex flex-col items-center" style={{ gap: 2 * s }}>
          <TabBarStrokeIcon path={TAB_PROFILE} s={s} />
          <span className="text-white/50" style={{ fontSize: 9 * s }}>You</span>
        </div>
      </div>

    </>
  );
}
