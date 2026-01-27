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
// Shared helpers
// ---------------------------------------------------------------------------

function ActionIcon({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center" style={{ gap: 2 }}>
      <svg viewBox="0 0 24 24" fill="white" opacity={0.85} style={{ width: size, height: size }}>
        {children}
      </svg>
    </div>
  );
}

function ActionIconWithLabel({ size, label, children }: { size: number; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center" style={{ gap: 2 }}>
      <svg viewBox="0 0 24 24" fill="white" opacity={0.85} style={{ width: size, height: size }}>
        {children}
      </svg>
      <span className="text-white/70 font-medium" style={{ fontSize: size * 0.4, lineHeight: 1 }}>
        {label}
      </span>
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
const ICON_MORE = (
  <path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0-5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
);
const ICON_MUSIC = (
  <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
);

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
// Layout reference: status bar → header → video → right icons → bottom info → tab bar

function InstagramMockup({ width, height, s }: MockupProps) {
  const iconSize = 26 * s;
  // Tab bar (Home, Search, +, Reels, Profile) sits at the very bottom
  const tabBarH = 50 * s;

  return (
    <>
      {/* Top: "Reels" title + camera icon */}
      <div
        className="absolute flex items-center justify-between"
        style={{
          top: 54 * s,
          left: 16 * s,
          right: 16 * s,
          height: 28 * s,
        }}
      >
        <span className="font-bold text-white/90" style={{ fontSize: 18 * s }}>
          Reels
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} opacity={0.7}
          style={{ width: 22 * s, height: 22 * s }}>
          <rect x="2" y="2" width="20" height="20" rx="2" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      </div>

      {/* Right-side action icons */}
      <div
        className="absolute flex flex-col items-center"
        style={{
          right: 8 * s,
          bottom: tabBarH + 110 * s,
          gap: 20 * s,
        }}
      >
        <ActionIconWithLabel size={iconSize} label="1.2K">{ICON_HEART}</ActionIconWithLabel>
        <ActionIconWithLabel size={iconSize} label="48">{ICON_COMMENT}</ActionIconWithLabel>
        <ActionIcon size={iconSize}>{ICON_SHARE}</ActionIcon>
        <ActionIcon size={iconSize}>{ICON_BOOKMARK}</ActionIcon>
        <ActionIcon size={iconSize}>{ICON_MORE}</ActionIcon>
        {/* Music disc */}
        <div
          className="rounded-md bg-gradient-to-br from-white/20 to-white/5 border border-white/15 overflow-hidden"
          style={{ width: 28 * s, height: 28 * s }}
        >
          <div
            className="rounded-full bg-white/30 mx-auto"
            style={{
              width: 12 * s,
              height: 12 * s,
              marginTop: 8 * s,
            }}
          />
        </div>
      </div>

      {/* Bottom-left: avatar + username + Follow */}
      <div
        className="absolute flex items-center"
        style={{
          left: 12 * s,
          bottom: tabBarH + 55 * s,
          gap: 8 * s,
        }}
      >
        <div
          className="rounded-full bg-white/30 border-2 border-pink-400/60"
          style={{ width: 32 * s, height: 32 * s, flexShrink: 0 }}
        />
        <span
          className="font-semibold text-white/90"
          style={{ fontSize: 13 * s, lineHeight: 1.2 }}
        >
          username
        </span>
        <div
          className="rounded-md border border-white/50 flex items-center justify-center"
          style={{ height: 22 * s, paddingLeft: 8 * s, paddingRight: 8 * s }}
        >
          <span className="font-medium text-white/90" style={{ fontSize: 11 * s, lineHeight: 1 }}>
            Follow
          </span>
        </div>
      </div>

      {/* Caption text */}
      <div
        className="absolute"
        style={{
          left: 12 * s,
          right: 56 * s,
          bottom: tabBarH + 30 * s,
        }}
      >
        <span className="text-white/80" style={{ fontSize: 13 * s, lineHeight: 1.3 }}>
          Caption text goes here...
        </span>
      </div>

      {/* Audio row */}
      <div
        className="absolute flex items-center"
        style={{
          left: 12 * s,
          bottom: tabBarH + 10 * s,
          gap: 6 * s,
        }}
      >
        <svg viewBox="0 0 24 24" fill="white" opacity={0.5}
          style={{ width: 11 * s, height: 11 * s, flexShrink: 0 }}>
          {ICON_MUSIC}
        </svg>
        <span className="text-white/50" style={{ fontSize: 11 * s }}>
          Original audio
        </span>
      </div>

      {/* Bottom tab bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-around"
        style={{ height: tabBarH, background: 'linear-gradient(transparent, rgba(0,0,0,0.6))' }}
      >
        {['Home', 'Search', '', 'Reels', 'Profile'].map((label, i) => (
          <div key={label || 'add'} className="flex flex-col items-center" style={{ gap: 2 * s }}>
            {i === 2 ? (
              <div className="rounded-lg bg-white/30 border border-white/20"
                style={{ width: 24 * s, height: 24 * s }} />
            ) : (
              <div className="rounded bg-white/40"
                style={{ width: 22 * s, height: 22 * s }} />
            )}
            {label && (
              <span
                className={`${i === 3 ? 'text-white font-medium' : 'text-white/40'}`}
                style={{ fontSize: 9 * s }}
              >
                {label}
              </span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ---- TikTok ----
// Layout: status bar → Following|For You tabs → video → right icons → bottom info → tab bar

function TikTokMockup({ width, height, s }: MockupProps) {
  const iconSize = 26 * s;
  const tabBarH = 48 * s;

  return (
    <>
      {/* Top: Following | For You tabs */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          top: 54 * s,
          left: 0,
          right: 0,
          height: 32 * s,
          gap: 20 * s,
        }}
      >
        <span className="text-white/50 font-medium" style={{ fontSize: 15 * s }}>
          Following
        </span>
        <span className="text-white font-bold" style={{ fontSize: 16 * s, textDecoration: 'underline', textUnderlineOffset: 6 * s }}>
          For You
        </span>
      </div>

      {/* Top-right: search icon */}
      <div className="absolute" style={{ top: 56 * s, right: 12 * s }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} opacity={0.7}
          style={{ width: 22 * s, height: 22 * s }}>
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </div>

      {/* Right-side: profile + action icons + music disc */}
      <div
        className="absolute flex flex-col items-center"
        style={{
          right: 10 * s,
          bottom: tabBarH + 80 * s,
          gap: 16 * s,
        }}
      >
        {/* Profile circle with + badge */}
        <div className="relative">
          <div
            className="rounded-full bg-white/30 border-2 border-white/50"
            style={{ width: 42 * s, height: 42 * s }}
          />
          <div
            className="absolute rounded-full bg-rose-500 flex items-center justify-center"
            style={{
              width: 16 * s, height: 16 * s,
              bottom: -4 * s, left: '50%', transform: 'translateX(-50%)',
            }}
          >
            <span className="text-white font-bold" style={{ fontSize: 12 * s, lineHeight: 1 }}>+</span>
          </div>
        </div>
        <ActionIconWithLabel size={iconSize} label="45.2K">{ICON_HEART}</ActionIconWithLabel>
        <ActionIconWithLabel size={iconSize} label="312">{ICON_COMMENT}</ActionIconWithLabel>
        <ActionIconWithLabel size={iconSize} label="2,841">{ICON_BOOKMARK}</ActionIconWithLabel>
        <ActionIcon size={iconSize}>{ICON_SHARE}</ActionIcon>
        {/* Spinning music disc */}
        <div
          className="rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border border-white/10"
          style={{ width: 36 * s, height: 36 * s, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            className="rounded-full bg-white/20"
            style={{ width: 12 * s, height: 12 * s }}
          />
        </div>
      </div>

      {/* Bottom-left: username + description + music row */}
      <div
        className="absolute flex flex-col"
        style={{
          left: 12 * s,
          bottom: tabBarH + 12 * s,
          right: 76 * s,
          gap: 6 * s,
        }}
      >
        <span
          className="font-bold text-white/90"
          style={{ fontSize: 15 * s, lineHeight: 1.2 }}
        >
          @username
        </span>
        <span className="text-white/70" style={{ fontSize: 13 * s, lineHeight: 1.3 }}>
          Description text goes here #fyp #viral
        </span>
        <div className="flex items-center" style={{ gap: 6 * s }}>
          <svg viewBox="0 0 24 24" fill="white" opacity={0.6}
            style={{ width: 12 * s, height: 12 * s, flexShrink: 0 }}>
            {ICON_MUSIC}
          </svg>
          <span className="text-white/60" style={{ fontSize: 12 * s }}>
            Original sound - username
          </span>
        </div>
      </div>

      {/* Bottom tab bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-around bg-black/70"
        style={{ height: tabBarH }}
      >
        {['Home', 'Shop', '', 'Inbox', 'Profile'].map((label, i) => (
          <div key={label || 'add'} className="flex flex-col items-center" style={{ gap: 2 * s }}>
            {i === 2 ? (
              <div className="rounded-lg bg-white flex items-center justify-center"
                style={{ width: 38 * s, height: 26 * s }}>
                <span className="text-black font-bold" style={{ fontSize: 18 * s, lineHeight: 1 }}>+</span>
              </div>
            ) : (
              <>
                <div className="rounded bg-white/40"
                  style={{ width: 20 * s, height: 20 * s }} />
                <span
                  className={`${i === 0 ? 'text-white font-medium' : 'text-white/40'}`}
                  style={{ fontSize: 9 * s }}
                >
                  {label}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ---- YouTube Shorts ----
// Layout: status bar → minimal header → video → right icons → bottom info → tab bar

function YouTubeMockup({ width, height, s }: MockupProps) {
  const iconSize = 24 * s;
  const tabBarH = 50 * s;

  return (
    <>
      {/* Top: Shorts logo + search/more */}
      <div
        className="absolute flex items-center justify-between"
        style={{
          top: 54 * s,
          left: 16 * s,
          right: 16 * s,
          height: 28 * s,
        }}
      >
        <span className="font-bold text-white/90" style={{ fontSize: 18 * s }}>
          Shorts
        </span>
        <div className="flex items-center" style={{ gap: 16 * s }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} opacity={0.7}
            style={{ width: 22 * s, height: 22 * s }}>
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <svg viewBox="0 0 24 24" fill="white" opacity={0.7}
            style={{ width: 22 * s, height: 22 * s }}>
            {ICON_MORE}
          </svg>
        </div>
      </div>

      {/* Right-side action icons */}
      <div
        className="absolute flex flex-col items-center"
        style={{
          right: 10 * s,
          bottom: tabBarH + 120 * s,
          gap: 18 * s,
        }}
      >
        <ActionIconWithLabel size={iconSize} label="3.4K">{ICON_LIKE}</ActionIconWithLabel>
        <ActionIcon size={iconSize}>{ICON_DISLIKE}</ActionIcon>
        <ActionIconWithLabel size={iconSize} label="89">{ICON_COMMENT}</ActionIconWithLabel>
        <ActionIcon size={iconSize}>{ICON_SHARE}</ActionIcon>
        <ActionIcon size={iconSize}>{ICON_MORE}</ActionIcon>
      </div>

      {/* Bottom-left: channel avatar + name + Subscribe */}
      <div
        className="absolute flex items-center"
        style={{
          left: 12 * s,
          bottom: tabBarH + 55 * s,
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
          className="rounded-full bg-white flex items-center justify-center"
          style={{
            height: 26 * s,
            paddingLeft: 12 * s,
            paddingRight: 12 * s,
          }}
        >
          <span
            className="font-semibold text-black"
            style={{ fontSize: 12 * s, lineHeight: 1 }}
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
          right: 56 * s,
          bottom: tabBarH + 30 * s,
        }}
      >
        <span className="text-white/70" style={{ fontSize: 13 * s, lineHeight: 1.3 }}>
          Video description text #shorts
        </span>
      </div>

      {/* Sound / music row */}
      <div
        className="absolute flex items-center"
        style={{
          left: 12 * s,
          bottom: tabBarH + 10 * s,
          gap: 6 * s,
        }}
      >
        <svg viewBox="0 0 24 24" fill="white" opacity={0.5}
          style={{ width: 11 * s, height: 11 * s, flexShrink: 0 }}>
          {ICON_MUSIC}
        </svg>
        <span className="text-white/50" style={{ fontSize: 11 * s }}>
          Original audio
        </span>
      </div>

      {/* Bottom tab bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-around bg-black/60"
        style={{ height: tabBarH }}
      >
        {['Home', 'Shorts', '', 'Subs', 'You'].map((label, i) => (
          <div key={label || 'add'} className="flex flex-col items-center" style={{ gap: 2 * s }}>
            {i === 2 ? (
              <div className="rounded-full bg-white/20 border border-white/30 flex items-center justify-center"
                style={{ width: 32 * s, height: 32 * s }}>
                <span className="text-white font-bold" style={{ fontSize: 20 * s, lineHeight: 1 }}>+</span>
              </div>
            ) : (
              <>
                <div className="rounded bg-white/40"
                  style={{ width: 20 * s, height: 20 * s }} />
                <span
                  className={`${i === 1 ? 'text-white font-medium' : 'text-white/40'}`}
                  style={{ fontSize: 9 * s }}
                >
                  {label}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
