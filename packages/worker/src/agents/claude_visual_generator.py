#!/usr/bin/env python3
"""
Claude Code Visual Generator

Generates Remotion video compositions using Claude Agent SDK with OAuth authentication.
Uses Claude Pro/Max subscription (no API key costs).

Reference: Auto-Claude apps/backend/core/auth.py, client.py
"""

import asyncio
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any

# Add agents directory to path for local imports
_agents_dir = Path(__file__).parent
if str(_agents_dir) not in sys.path:
    sys.path.insert(0, str(_agents_dir))

# Claude Agent SDK imports
try:
    from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
    from claude_agent_sdk.types import HookMatcher
except ImportError:
    print("Error: claude-agent-sdk package not installed. Run: pip install claude-agent-sdk")
    sys.exit(1)


# =============================================================================
# Safe Print Helper (Windows Unicode Fix)
# =============================================================================

def safe_print(msg: str) -> None:
    """Print message safely, handling Unicode encoding errors on Windows."""
    try:
        print(msg)
    except UnicodeEncodeError:
        # Replace non-ASCII characters with ? for Windows console
        safe_msg = msg.encode('ascii', errors='replace').decode('ascii')
        print(safe_msg)


# =============================================================================
# Security Hook (Reference: Auto-Claude apps/backend/core/client.py)
# =============================================================================


def is_safe_npm_command(command: str) -> bool:
    """
    Check if a bash command is a safe npm/npx command.

    Rejects commands with shell chaining operators to prevent bypass attacks.
    The sandbox mode provides defense-in-depth for edge cases.
    """
    ALLOWED_PREFIXES = ["npm ", "npx ", "npm.cmd ", "npx.cmd "]
    FORBIDDEN_OPERATORS = ["&&", "||", ";", "|", "`", "$(", "${", "\n"]

    stripped = command.strip()

    # Must start with allowed prefix
    if not any(stripped.startswith(prefix) for prefix in ALLOWED_PREFIXES):
        return False

    # Must not contain chaining operators
    if any(op in command for op in FORBIDDEN_OPERATORS):
        return False

    return True


async def bash_security_hook(
    input_data: dict,
    tool_use_id: str | None = None,
    context: Any = None,
) -> dict:
    """
    Security hook to restrict Bash commands to npm/npx only.

    Prevents arbitrary command execution while allowing TypeScript/Remotion tooling.
    Defense-in-depth: sandbox mode provides additional protection.
    """
    if input_data.get("tool_name") != "Bash":
        return {}

    command = input_data.get("tool_input", {}).get("command", "")

    if is_safe_npm_command(command):
        return {}

    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": f"Only safe npm/npx commands allowed. Got: {command[:100]}..."
        }
    }


# =============================================================================
# OAuth Authentication with Auto-Refresh
# =============================================================================

import time
import httpx
from dataclasses import dataclass
from typing import Callable

# Anthropic OAuth endpoints (based on Claude Code's auth flow)
ANTHROPIC_TOKEN_ENDPOINT = "https://console.anthropic.com/v1/oauth/token"
ANTHROPIC_AUTH_URL = "https://console.anthropic.com/oauth/authorize"

# Minimum token validity required (10 minutes in milliseconds)
MIN_TOKEN_VALIDITY_MS = 10 * 60 * 1000

# Token refresh buffer (refresh 5 minutes before expiry)
REFRESH_BUFFER_MS = 5 * 60 * 1000


@dataclass
class OAuthTokens:
    """OAuth token data structure."""
    access_token: str
    refresh_token: str | None
    expires_at: int  # milliseconds timestamp
    scopes: list[str] | None = None
    subscription_type: str | None = None

    @property
    def is_expired(self) -> bool:
        """Check if access token is expired."""
        return int(time.time() * 1000) >= self.expires_at

    @property
    def needs_refresh(self) -> bool:
        """Check if token should be refreshed (within buffer period)."""
        return int(time.time() * 1000) >= (self.expires_at - REFRESH_BUFFER_MS)

    @property
    def minutes_remaining(self) -> int:
        """Minutes until token expires."""
        remaining_ms = self.expires_at - int(time.time() * 1000)
        return max(0, int(remaining_ms / 60000))

    def to_dict(self) -> dict:
        """Convert to dictionary for storage."""
        return {
            "accessToken": self.access_token,
            "refreshToken": self.refresh_token,
            "expiresAt": self.expires_at,
            "scopes": self.scopes,
            "subscriptionType": self.subscription_type,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "OAuthTokens":
        """Create from dictionary."""
        return cls(
            access_token=data["accessToken"],
            refresh_token=data.get("refreshToken"),
            expires_at=data.get("expiresAt", 0),
            scopes=data.get("scopes"),
            subscription_type=data.get("subscriptionType"),
        )


class TokenStorage:
    """Abstract base for token storage backends."""

    def load(self) -> OAuthTokens | None:
        """Load tokens from storage."""
        raise NotImplementedError

    def save(self, tokens: OAuthTokens) -> None:
        """Save tokens to storage."""
        raise NotImplementedError


class FileTokenStorage(TokenStorage):
    """Store tokens in Claude's credential file (local development)."""

    def __init__(self, path: str | None = None):
        self.path = path or self._find_credential_path()

    def _find_credential_path(self) -> str | None:
        """Find Claude's credential file."""
        paths = [
            os.path.expandvars(r"%USERPROFILE%\.claude\.credentials.json"),
            os.path.expandvars(r"%USERPROFILE%\.claude\credentials.json"),
            os.path.expanduser("~/.claude/.credentials.json"),
            os.path.expanduser("~/.claude/credentials.json"),
        ]
        for p in paths:
            if os.path.exists(p):
                return p
        return paths[0]  # Default to first path for creation

    def load(self) -> OAuthTokens | None:
        """Load tokens from credential file."""
        if not self.path or not os.path.exists(self.path):
            return None
        try:
            with open(self.path, encoding="utf-8") as f:
                data = json.load(f)
            oauth = data.get("claudeAiOauth", {})
            if oauth.get("accessToken"):
                return OAuthTokens.from_dict(oauth)
        except Exception as e:
            print(f"[TokenStorage] Error loading tokens: {e}")
        return None

    def save(self, tokens: OAuthTokens) -> None:
        """Save tokens to credential file."""
        if not self.path:
            return
        try:
            # Load existing data or create new
            data = {}
            if os.path.exists(self.path):
                with open(self.path, encoding="utf-8") as f:
                    data = json.load(f)

            # Update OAuth tokens
            data["claudeAiOauth"] = tokens.to_dict()

            # Ensure directory exists
            os.makedirs(os.path.dirname(self.path), exist_ok=True)

            # Write back
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)

            print(f"[TokenStorage] Tokens saved to {self.path}")
        except Exception as e:
            print(f"[TokenStorage] Error saving tokens: {e}")


class DatabaseTokenStorage(TokenStorage):
    """Store tokens in database (for server deployment)."""

    def __init__(
        self,
        load_fn: Callable[[], dict | None],
        save_fn: Callable[[dict], None],
    ):
        """
        Initialize with database callbacks.

        Args:
            load_fn: Function that returns token dict from DB or None
            save_fn: Function that saves token dict to DB
        """
        self.load_fn = load_fn
        self.save_fn = save_fn

    def load(self) -> OAuthTokens | None:
        """Load tokens from database."""
        try:
            data = self.load_fn()
            if data and data.get("accessToken"):
                return OAuthTokens.from_dict(data)
        except Exception as e:
            print(f"[TokenStorage] Error loading from DB: {e}")
        return None

    def save(self, tokens: OAuthTokens) -> None:
        """Save tokens to database."""
        try:
            self.save_fn(tokens.to_dict())
            print("[TokenStorage] Tokens saved to database")
        except Exception as e:
            print(f"[TokenStorage] Error saving to DB: {e}")


class OAuthTokenManager:
    """
    Manages OAuth tokens with automatic refresh.

    Usage:
        # Local development (uses Claude's credential file)
        manager = OAuthTokenManager()

        # Server deployment (uses database)
        manager = OAuthTokenManager(
            storage=DatabaseTokenStorage(
                load_fn=lambda: db.get_oauth_tokens(),
                save_fn=lambda tokens: db.save_oauth_tokens(tokens)
            )
        )

        # Get valid token (auto-refreshes if needed)
        token = await manager.get_valid_token()
    """

    def __init__(self, storage: TokenStorage | None = None):
        self.storage = storage or FileTokenStorage()
        self._tokens: OAuthTokens | None = None
        self._http_client: httpx.AsyncClient | None = None

    async def _get_http_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._http_client is None or self._http_client.is_closed:
            self._http_client = httpx.AsyncClient(timeout=30.0)
        return self._http_client

    async def close(self) -> None:
        """Close HTTP client."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None

    def load_tokens(self) -> OAuthTokens | None:
        """Load tokens from storage."""
        self._tokens = self.storage.load()
        return self._tokens

    def save_tokens(self, tokens: OAuthTokens) -> None:
        """Save tokens to storage."""
        self._tokens = tokens
        self.storage.save(tokens)

    async def refresh_tokens(self) -> OAuthTokens | None:
        """
        Refresh access token using refresh token.

        Returns new tokens or None if refresh failed.
        """
        if not self._tokens or not self._tokens.refresh_token:
            print("[OAuth] No refresh token available")
            return None

        print("[OAuth] Refreshing access token...")

        try:
            client = await self._get_http_client()

            # Try Anthropic's OAuth token endpoint
            response = await client.post(
                ANTHROPIC_TOKEN_ENDPOINT,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": self._tokens.refresh_token,
                },
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )

            if response.status_code == 200:
                data = response.json()
                new_tokens = OAuthTokens(
                    access_token=data["access_token"],
                    refresh_token=data.get("refresh_token", self._tokens.refresh_token),
                    expires_at=int(time.time() * 1000) + (data.get("expires_in", 28800) * 1000),
                    scopes=self._tokens.scopes,
                    subscription_type=self._tokens.subscription_type,
                )
                self.save_tokens(new_tokens)
                print(f"[OAuth] Token refreshed! Valid for {new_tokens.minutes_remaining} minutes")
                return new_tokens

            # If standard OAuth fails, try alternative methods
            print(f"[OAuth] Standard refresh failed ({response.status_code}), trying CLI refresh...")
            return await self._refresh_via_cli()

        except Exception as e:
            print(f"[OAuth] Refresh error: {e}")
            return await self._refresh_via_cli()

    async def _refresh_via_cli(self) -> OAuthTokens | None:
        """Fallback: trigger refresh via Claude CLI."""
        import subprocess

        try:
            # Running any claude command may trigger internal token refresh
            result = subprocess.run(
                ["claude", "--version"],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode == 0:
                # Reload tokens from file (CLI may have refreshed them)
                new_tokens = self.load_tokens()
                if new_tokens and not new_tokens.needs_refresh:
                    print(f"[OAuth] CLI refresh worked! Valid for {new_tokens.minutes_remaining} minutes")
                    return new_tokens

        except Exception as e:
            print(f"[OAuth] CLI refresh failed: {e}")

        return None

    async def get_valid_token(self) -> str:
        """
        Get a valid access token, refreshing if needed.

        Returns:
            Valid access token string

        Raises:
            ValueError: If no valid token available and refresh failed
        """
        # Load tokens if not cached
        if not self._tokens:
            self._tokens = self.load_tokens()

        if not self._tokens:
            raise ValueError(
                "No OAuth tokens found.\n\n"
                "For local development:\n"
                "  1. Run: claude\n"
                "  2. Type: /login\n"
                "  3. Complete OAuth in browser\n\n"
                "For server deployment:\n"
                "  1. Do initial login locally\n"
                "  2. Copy tokens to database\n"
                "  3. Use DatabaseTokenStorage\n"
            )

        # Check if refresh needed
        if self._tokens.needs_refresh:
            print(f"[OAuth] Token expires in {self._tokens.minutes_remaining} minutes, refreshing...")
            refreshed = await self.refresh_tokens()
            if refreshed:
                self._tokens = refreshed
            elif self._tokens.is_expired:
                raise ValueError(
                    "OAuth token expired and refresh failed.\n"
                    "Please re-authenticate with: claude /login"
                )
            else:
                print("[OAuth] WARNING: Refresh failed but token still valid, continuing...")

        print(f"[OAuth] Using token valid for {self._tokens.minutes_remaining} minutes")
        return self._tokens.access_token


# Global token manager instance
_token_manager: OAuthTokenManager | None = None


def get_token_manager(storage: TokenStorage | None = None) -> OAuthTokenManager:
    """Get or create the global token manager."""
    global _token_manager
    if _token_manager is None or storage is not None:
        _token_manager = OAuthTokenManager(storage)
    return _token_manager


# Legacy functions for backwards compatibility
def get_credential_file_path() -> str | None:
    """Find the Claude credentials file path."""
    storage = FileTokenStorage()
    return storage.path


def get_oauth_credentials() -> dict | None:
    """Get full OAuth credentials."""
    storage = FileTokenStorage()
    tokens = storage.load()
    return tokens.to_dict() if tokens else None


def get_oauth_token_from_credential_store() -> str | None:
    """Get OAuth token from credential store."""
    creds = get_oauth_credentials()
    return creds.get("accessToken") if creds else None


def check_token_validity() -> tuple[bool, int | None]:
    """Check if token is valid and has enough time remaining."""
    storage = FileTokenStorage()
    tokens = storage.load()
    if not tokens:
        return False, None
    is_valid = not tokens.needs_refresh
    return is_valid, tokens.minutes_remaining


async def async_require_oauth_token() -> str:
    """Get OAuth token with auto-refresh (async version)."""
    manager = get_token_manager()
    return await manager.get_valid_token()


def require_oauth_token() -> str:
    """Get OAuth token with auto-refresh (sync version)."""
    # For sync contexts, just load and check (can't async refresh)
    storage = FileTokenStorage()
    tokens = storage.load()

    if not tokens:
        raise ValueError(
            "No OAuth token found.\n\n"
            "Claude Visual Generator requires Claude Pro/Max subscription.\n\n"
            "To authenticate:\n"
            "  1. Run: claude\n"
            "  2. Type: /login\n"
            "  3. Complete OAuth in browser\n"
        )

    if tokens.needs_refresh:
        print(f"[OAuth] Token expires in {tokens.minutes_remaining} minutes")
        if tokens.is_expired:
            raise ValueError("OAuth token expired. Please re-authenticate with: claude /login")
        print("[OAuth] WARNING: Token expiring soon. Consider refreshing.")

    print(f"[OAuth] Token valid for {tokens.minutes_remaining} minutes")
    return tokens.access_token


def configure_sdk_auth() -> None:
    """Configure environment for Claude Agent SDK authentication."""
    token = require_oauth_token()
    os.environ["CLAUDE_AGENT_OAUTH_TOKEN"] = token


async def configure_sdk_auth_async() -> None:
    """Configure environment for Claude Agent SDK authentication (async, with refresh)."""
    token = await async_require_oauth_token()
    os.environ["CLAUDE_AGENT_OAUTH_TOKEN"] = token


# =============================================================================
# Skill and Code Example Injection
# =============================================================================


def get_condensed_skills() -> str:
    """
    Return condensed, essential skill content to inject directly into prompt.
    Agents don't reliably read skill files, so we inject critical patterns directly.
    """
    return """
## REQUIRED ANIMATION PATTERNS (USE THESE EXACTLY)

### Spring Configuration (ALWAYS use this)
```tsx
const SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };
// Usage:
const progress = spring({frame: frame - startFrame, fps, config: SPRING_CONFIG});
```

### Stagger Pattern (REQUIRED for multiple elements)
```tsx
// NEVER animate all elements at once. Always stagger by 6+ frames:
{items.map((item, i) => (
  <Element key={i} delay={i * 6} />
))}
```

### Glassmorphism (for cards/containers)
```tsx
const glassStyle = {
  background: 'rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
};
```

### Flowing Particles (for streams/rivers)
```tsx
const FlowingParticles: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  return (
    <>
      {Array.from({length: 30}).map((_, i) => {
        const x = ((frame * 2 + i * 50) % (width + 100)) - 50;
        const y = (height * 0.4) + Math.sin((frame + i * 20) * 0.03) * 50;
        return (
          <div key={i} style={{
            position: 'absolute', left: x, top: y,
            width: 16, height: 16, borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            opacity: 0.7,
          }} />
        );
      })}
    </>
  );
};
```

### Particle Emitter (for explosion/radial effects)
```tsx
const ParticleEmitter: React.FC<{count: number, startFrame: number}> = ({count, startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <>
      {Array.from({length: count}).map((_, i) => {
        const delay = i * 6;
        const progress = spring({frame: frame - startFrame - delay, fps, config: {damping: 22, stiffness: 90}});
        const angle = (i / count) * Math.PI * 2;
        const radius = progress * 100;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `calc(50% + ${Math.cos(angle) * radius}px)`,
            top: `calc(50% + ${Math.sin(angle) * radius}px)`,
            width: 8, height: 8,
            borderRadius: '50%',
            background: '#8b5cf6',
            opacity: interpolate(progress, [0, 0.8, 1], [0, 1, 0]),
          }} />
        );
      })}
    </>
  );
};
```

### Counter Animation (for numbers)
```tsx
const Counter: React.FC<{target: number, start: number}> = ({target, start}) => {
  const frame = useCurrentFrame();
  const value = Math.round(interpolate(
    frame - start, [0, 45], [0, target], {extrapolateRight: 'clamp'}
  ));
  return <span style={{fontVariantNumeric: 'tabular-nums'}}>{value}</span>;
};
```

### Scale Entrance (for appearing elements)
```tsx
const ScaleIn: React.FC<{startFrame: number, children: React.ReactNode}> = ({startFrame, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const scale = spring({frame: frame - startFrame, fps, config: {damping: 22, stiffness: 90}});
  return <div style={{transform: `scale(${scale})`}}>{children}</div>;
};
```

### Fade In Animation
```tsx
const FadeIn: React.FC<{startFrame: number, children: React.ReactNode}> = ({startFrame, children}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame - startFrame,
    [0, 20],
    [0, 1],
    {extrapolateRight: 'clamp'}
  );
  return <div style={{opacity}}>{children}</div>;
};
```

## PROHIBITED PATTERNS (NEVER DO THESE)

- EMPTY FRAMES with just background (WORST OFFENSE - kills retention)
- Missing key prop on children arrays (causes React warnings)
- Math.sin() or Math.cos() on text rotation/position (causes jittery text)
- damping < 20 in spring config (too bouncy)
- All elements animating at the same time (no stagger)
- Plain colored circles instead of proper visuals
- Instant teleportation (no animation)
- Static backgrounds with no motion
- Missing extrapolateRight: 'clamp' in interpolate()
- Scenes with no visual metaphor (just text on background)
- Gaps between scenes (no animation happening)

## REACT KEYS (MANDATORY)
Every element in a children array needs a unique key:
```tsx
// CORRECT:
<AbsoluteFill>
  <AnimatedBackground key="bg" />
  <Sequence key="scene1" from={0}>...</Sequence>
  <Sequence key="scene2" from={90}>...</Sequence>
</AbsoluteFill>

// WRONG (missing keys):
<AbsoluteFill>
  <AnimatedBackground />
  <Sequence from={0}>...</Sequence>
  <Sequence from={90}>...</Sequence>
</AbsoluteFill>
```
"""


def get_instagram_design_guide() -> str:
    """
    Return Instagram-worthy design principles and guidance.
    Teaches agents how to create scroll-stopping, visually stunning content.
    """
    return '''
## INSTAGRAM-WORTHY DESIGN GUIDE

### THE HOOK (FIRST 3 SECONDS = EVERYTHING)
Your video has 0.5-3 seconds to stop the scroll. The opening MUST be visually striking.

**Hook Techniques (USE AT LEAST ONE):**
1. **Bold Statement** - Large, animated text that makes a provocative claim
2. **Visual Paradox** - Something unexpected (e.g., data flowing backwards, impossible shapes)
3. **Dramatic Reveal** - Start zoomed in, pull back to reveal context
4. **Motion Explosion** - Particles/elements bursting from center
5. **Question Hook** - Animated question mark or "Did you know...?"

```tsx
// EXAMPLE: Motion Explosion Hook (first 45 frames)
const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // Dramatic scale-in for main element
  const scale = spring({frame, fps, config: {damping: 12, stiffness: 100}});

  // Particle burst behind it
  const particles = Array.from({length: 20}).map((_, i) => {
    const angle = (i / 20) * Math.PI * 2;
    const distance = spring({frame: frame - 5, fps, config: {damping: 18}}) * 150;
    return (
      <div key={i} style={{
        position: 'absolute',
        left: `calc(50% + ${Math.cos(angle) * distance}px)`,
        top: `calc(50% + ${Math.sin(angle) * distance}px)`,
        width: 12, height: 12, borderRadius: '50%',
        background: 'linear-gradient(135deg, #ff6b6b, #feca57)',
        opacity: interpolate(frame, [0, 30], [1, 0], {extrapolateRight: 'clamp'}),
      }} />
    );
  });

  return (
    <>
      {particles}
      <div style={{transform: `scale(${scale})`, textAlign: 'center'}}>
        <h1 style={{fontSize: 72, fontWeight: 900}}>🤯 Mind = Blown</h1>
      </div>
    </>
  );
};
```

### RETENTION TECHNIQUES (KEEP THEM WATCHING)

1. **Progressive Revelation** - Don't show everything at once. Build understanding.
2. **Visual Payoff Every 3-5 Seconds** - New animation, new element, new insight
3. **Anticipation Loops** - Show something partially, then reveal fully
4. **Counter/Progress Indicators** - Numbers counting, progress bars filling
5. **Pattern Interrupts** - Just when viewer expects X, do Y

### COLOR PALETTES (2024-2025 TRENDS)

**Palette 1: Electric Sunset (HIGH ENERGY)**
```tsx
const COLORS = {
  primary: '#ff6b6b',      // Coral red
  secondary: '#feca57',    // Golden yellow
  accent: '#ff9ff3',       // Pink
  dark: '#1a1a2e',         // Deep navy
  light: '#ffffff',
};
const GRADIENT = 'linear-gradient(135deg, #ff6b6b 0%, #feca57 50%, #ff9ff3 100%)';
```

**Palette 2: Cyber Neon (TECH/DATA)**
```tsx
const COLORS = {
  primary: '#00f5d4',      // Cyan
  secondary: '#7b2cbf',    // Purple
  accent: '#f72585',       // Magenta
  dark: '#0a0a0f',         // Near black
  light: '#e0e0e0',
};
const GRADIENT = 'linear-gradient(135deg, #00f5d4 0%, #7b2cbf 50%, #f72585 100%)';
```

**Palette 3: Soft Gradient (CALM/EDUCATIONAL)**
```tsx
const COLORS = {
  primary: '#667eea',      // Soft indigo
  secondary: '#764ba2',    // Soft purple
  accent: '#66a6ff',       // Sky blue
  dark: '#1e1e2f',         // Dark purple-gray
  light: '#f8f9fa',
};
const GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
```

**Palette 4: Forest Tech (NATURE + TECH)**
```tsx
const COLORS = {
  primary: '#00b894',      // Mint green
  secondary: '#0984e3',    // Ocean blue
  accent: '#fdcb6e',       // Soft gold
  dark: '#0c1618',         // Deep forest
  light: '#dfe6e9',
};
const GRADIENT = 'linear-gradient(135deg, #00b894 0%, #0984e3 100%)';
```

### MOBILE-FIRST TYPOGRAPHY (1080x1920 VERTICAL)

```tsx
// Mobile text sizes (for 1080x1920)
const TYPOGRAPHY = {
  hero: {fontSize: 96, fontWeight: 900, lineHeight: 1.1},     // Main hook text
  title: {fontSize: 64, fontWeight: 800, lineHeight: 1.2},    // Section titles
  subtitle: {fontSize: 48, fontWeight: 600, lineHeight: 1.3}, // Supporting text
  body: {fontSize: 36, fontWeight: 500, lineHeight: 1.5},     // Explanatory text
  caption: {fontSize: 28, fontWeight: 400, lineHeight: 1.4},  // Small labels
};

// For 1920x1080 horizontal, use 75% of these values
```

### MOTION DESIGN TRENDS

1. **Morphing Shapes** - Elements that smoothly transform into other shapes
2. **Liquid Motion** - Blob-like, organic movements
3. **Kinetic Typography** - Text that moves with meaning (words bouncing when saying "bounce")
4. **3D Depth** - Parallax layers, perspective transforms
5. **Micro-interactions** - Small details that reward attention

### SCENE STRUCTURE FOR ENGAGEMENT

```
Scene 1 (0-3s): THE HOOK - Stop the scroll, create curiosity
Scene 2 (3-8s): THE SETUP - Establish the problem/question
Scene 3 (8-15s): THE BUILD - Progressive revelation of concept
Scene 4 (15-22s): THE PAYOFF - Visual climax, "aha" moment
Scene 5 (22-28s): THE REINFORCE - Solidify understanding
Scene 6 (28-30s): THE CTA - Call to action, loop point
```

### BACKGROUNDS THAT POP

Never use plain solid colors. Always add depth:

```tsx
// Animated gradient background
const AnimatedBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const gradientAngle = interpolate(frame, [0, 300], [135, 225]);
  return (
    <AbsoluteFill style={{
      background: `linear-gradient(${gradientAngle}deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)`,
    }}>
      {/* Add floating particles or subtle grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)',
        backgroundSize: '40px 40px',
      }} />
    </AbsoluteFill>
  );
};
```

### VISUAL METAPHORS (MAKE ABSTRACT CONCRETE)

| Abstract Concept | Visual Metaphor |
|------------------|-----------------|
| Data flow | River of glowing particles |
| Algorithm | Assembly line / conveyor belt |
| Recursion | Mirrors reflecting mirrors |
| API call | Package being delivered |
| Cache | Drawer/filing cabinet |
| Memory | Grid of glowing boxes |
| Process | Gears turning together |
| Network | Connected nodes with pulses |
| Error | Red warning flash + shake |
| Success | Green checkmark + confetti |
'''


TECHNIQUE_CODE_EXAMPLES = {
    "particle-emitter": '''
// ParticleEmitter - Use for particle effects
const ParticleEmitter: React.FC<{count: number, startFrame: number}> = ({count, startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <>
      {Array.from({length: count}).map((_, i) => {
        const delay = i * 6;
        const progress = spring({frame: frame - startFrame - delay, fps, config: {damping: 22, stiffness: 90}});
        const angle = (i / count) * Math.PI * 2;
        const radius = progress * 100;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `calc(50% + ${Math.cos(angle) * radius}px)`,
            top: `calc(50% + ${Math.sin(angle) * radius}px)`,
            width: 8, height: 8,
            borderRadius: '50%',
            background: '#8b5cf6',
            opacity: interpolate(progress, [0, 0.8, 1], [0, 1, 0]),
          }} />
        );
      })}
    </>
  );
};''',
    "glass-morphism": '''
// GlassCard - Glassmorphism container
const GlassCard: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  }}>
    {children}
  </div>
);''',
    "flowing-river": '''
// FlowingRiver - Animated data stream
const FlowingRiver: React.FC<{startFrame: number}> = ({startFrame}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const particles = Array.from({length: 50}).map((_, i) => {
    const speed = 2 + (i % 3);
    const yOffset = (i * 40) % height;
    const x = ((frame - startFrame) * speed + i * 30) % (width + 100) - 50;
    const y = yOffset + Math.sin((frame + i * 10) * 0.02) * 30;
    return (
      <div key={i} style={{
        position: 'absolute', left: x, top: y,
        width: 12 + (i % 8), height: 12 + (i % 8),
        borderRadius: '50%',
        background: `linear-gradient(135deg, #3b82f6, #8b5cf6)`,
        opacity: 0.6 + (i % 4) * 0.1,
      }} />
    );
  });
  return <>{particles}</>;
};''',
    "probability-gate": '''
// ProbabilityGate - Dice/spinner for random chance visualization
const ProbabilityGate: React.FC<{n: number, startFrame: number}> = ({n, startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const spinProgress = spring({frame: frame - startFrame, fps, config: {damping: 15, stiffness: 80}});
  const rotation = interpolate(spinProgress, [0, 1], [0, 720]);
  return (
    <div style={{
      width: 80, height: 80,
      background: 'linear-gradient(135deg, #22c55e, #3b82f6)',
      borderRadius: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transform: `rotate(${rotation}deg)`,
      boxShadow: '0 4px 20px rgba(34, 197, 94, 0.4)',
    }}>
      <span style={{fontSize: 24, fontWeight: 'bold', color: 'white'}}>1/{n}</span>
    </div>
  );
};''',
    "scale-spring": '''
// Scale spring entrance animation
const scaleEntrance = (frame: number, startFrame: number, fps: number) => {
  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 22, stiffness: 90, mass: 0.9 }
  });
  return progress;
};
// Usage: transform: `scale(${scaleEntrance(frame, 15, fps)})`''',
    "counter-animation": '''
// AnimatedCounter - Number counting up
const AnimatedCounter: React.FC<{target: number, startFrame: number, duration?: number}> = ({target, startFrame, duration = 45}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame - startFrame, [0, duration], [0, 1], {extrapolateRight: 'clamp'});
  const value = Math.round(progress * target);
  return (
    <span style={{fontVariantNumeric: 'tabular-nums'}}>{value.toLocaleString()}</span>
  );
};''',
    "staggered-list": '''
// StaggeredList - Animated list with staggered entries
const StaggeredList: React.FC<{items: string[], startFrame: number}> = ({items, startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <div>
      {items.map((item, i) => {
        const delay = i * 6; // 6 frame stagger
        const progress = spring({
          frame: frame - startFrame - delay,
          fps,
          config: { damping: 22, stiffness: 90, mass: 0.9 }
        });
        return (
          <div key={i} style={{
            opacity: progress,
            transform: `translateY(${interpolate(progress, [0, 1], [20, 0])}px)`
          }}>
            {item}
          </div>
        );
      })}
    </div>
  );
};''',
}


def get_remotion_libraries_guide() -> str:
    """
    Return examples of Remotion's official libraries for advanced effects.
    These are npm packages that can be imported for sophisticated visuals.
    """
    return '''
## REMOTION LIBRARIES (ADVANCED EFFECTS)

These are official Remotion packages available in the workspace. Use them for sophisticated effects.

### @remotion/shapes - SVG Shape Primitives
```tsx
import {Pie, Triangle, Circle, Rect, Star, Polygon} from '@remotion/shapes';

// Animated pie chart
const AnimatedPie: React.FC<{progress: number}> = ({progress}) => (
  <Pie
    radius={100}
    progress={progress}
    fill="#667eea"
    stroke="#764ba2"
    strokeWidth={4}
  />
);

// Star rating animation
const StarRating: React.FC<{rating: number, startFrame: number}> = ({rating, startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <div style={{display: 'flex', gap: 8}}>
      {[1, 2, 3, 4, 5].map((i) => {
        const delay = (i - 1) * 6;
        const scale = spring({frame: frame - startFrame - delay, fps, config: {damping: 15}});
        const isFilled = i <= rating;
        return (
          <div key={i} style={{transform: `scale(${scale})`}}>
            <Star
              points={5}
              innerRadius={20}
              outerRadius={40}
              fill={isFilled ? '#feca57' : 'transparent'}
              stroke="#feca57"
              strokeWidth={2}
            />
          </div>
        );
      })}
    </div>
  );
};
```

### @remotion/noise - Procedural Noise
```tsx
import {noise2D, noise3D} from '@remotion/noise';

// Organic floating particles using noise
const NoiseParticles: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <>
      {Array.from({length: 30}).map((_, i) => {
        const seed = i * 100;
        const x = noise2D(seed, frame * 0.01, 0) * 400 + 540;
        const y = noise2D(seed + 1000, frame * 0.01, 0) * 400 + 960;
        const scale = noise2D(seed + 2000, frame * 0.02, 0) * 0.5 + 0.75;

        return (
          <div key={i} style={{
            position: 'absolute',
            left: x, top: y,
            width: 20, height: 20,
            borderRadius: '50%',
            background: 'rgba(102, 126, 234, 0.6)',
            transform: `scale(${scale})`,
          }} />
        );
      })}
    </>
  );
};

// Wavy text using noise
const WavyText: React.FC<{text: string}> = ({text}) => {
  const frame = useCurrentFrame();

  return (
    <div style={{display: 'flex'}}>
      {text.split('').map((char, i) => {
        const y = noise2D(i, frame * 0.05, 0) * 20;
        return (
          <span key={i} style={{
            display: 'inline-block',
            transform: `translateY(${y}px)`,
            fontSize: 64, fontWeight: 700,
          }}>
            {char}
          </span>
        );
      })}
    </div>
  );
};
```

### @remotion/paths - SVG Path Animation
```tsx
import {
  getLength,
  getPointAtLength,
  evolvePath,
  translatePath,
  scalePath,
} from '@remotion/paths';

// Draw-on line animation
const AnimatedPath: React.FC<{startFrame: number}> = ({startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const path = 'M 100 200 Q 300 100 500 200 T 900 200';
  const length = getLength(path);
  const progress = spring({frame: frame - startFrame, fps, config: {damping: 20}});

  const strokeDasharray = length;
  const strokeDashoffset = length * (1 - progress);

  return (
    <svg width="1000" height="400" viewBox="0 0 1000 400">
      <path
        d={path}
        stroke="url(#gradient)"
        strokeWidth={8}
        fill="none"
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#667eea" />
          <stop offset="100%" stopColor="#f72585" />
        </linearGradient>
      </defs>
    </svg>
  );
};

// Moving element along path
const ElementOnPath: React.FC<{progress: number}> = ({progress}) => {
  const path = 'M 0 100 Q 250 0 500 100 T 1000 100';
  const length = getLength(path);
  const point = getPointAtLength(path, progress * length);

  return (
    <div style={{
      position: 'absolute',
      left: point.x, top: point.y,
      width: 30, height: 30,
      borderRadius: '50%',
      background: '#00f5d4',
      transform: 'translate(-50%, -50%)',
      boxShadow: '0 0 20px #00f5d4',
    }} />
  );
};
```

### @remotion/animated-emoji - Animated Emojis
```tsx
import {AnimatedEmoji} from '@remotion/animated-emoji';

// Use animated emojis for visual interest
const EmojiReaction: React.FC<{emoji: string, startFrame: number}> = ({emoji, startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const scale = spring({frame: frame - startFrame, fps, config: {damping: 12}});

  return (
    <div style={{transform: `scale(${scale})`}}>
      <AnimatedEmoji emoji={emoji} />
    </div>
  );
};

// Available animated emojis: 🔥 ❤️ 👍 👎 😂 😮 😢 😡 🎉 💡 ✅ ❌
```

### @remotion/transitions - Scene Transitions
```tsx
import {
  TransitionSeries,
  springTiming,
  linearTiming,
} from '@remotion/transitions';
import {slide} from '@remotion/transitions/slide';
import {fade} from '@remotion/transitions/fade';
import {wipe} from '@remotion/transitions/wipe';

// Use TransitionSeries for smooth scene changes
const ScenesWithTransitions: React.FC = () => {
  const {fps} = useVideoConfig();

  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={90}>
        <Scene1 />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({direction: 'from-right'})}
        timing={springTiming({config: {damping: 200}, durationInFrames: 30})}
      />

      <TransitionSeries.Sequence durationInFrames={90}>
        <Scene2 />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({durationInFrames: 20})}
      />

      <TransitionSeries.Sequence durationInFrames={90}>
        <Scene3 />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
```

### COMBINING LIBRARIES FOR ADVANCED EFFECTS

```tsx
// Data visualization with noise, shapes, and paths
const DataVisualization: React.FC<{startFrame: number}> = ({startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const progress = spring({frame: frame - startFrame, fps, config: {damping: 20}});

  // Use noise for organic data variation
  const dataPoints = [65, 78, 82, 91, 87, 95].map((value, i) => ({
    value,
    noise: noise2D(i, frame * 0.02, 0) * 3, // Subtle organic motion
  }));

  return (
    <div style={{display: 'flex', alignItems: 'flex-end', gap: 24, height: 300}}>
      {dataPoints.map((point, i) => {
        const delay = i * 8;
        const barProgress = spring({
          frame: frame - startFrame - delay,
          fps,
          config: {damping: 18}
        });
        const height = (point.value + point.noise) * 2.5 * barProgress;

        return (
          <div key={i} style={{
            width: 60,
            height,
            background: `linear-gradient(180deg, #667eea 0%, #764ba2 100%)`,
            borderRadius: '8px 8px 0 0',
            boxShadow: '0 0 20px rgba(102, 126, 234, 0.5)',
          }}>
            <span style={{
              position: 'absolute', top: -30,
              left: '50%', transform: 'translateX(-50%)',
              fontSize: 24, fontWeight: 700, color: '#fff',
              opacity: barProgress,
            }}>
              {Math.round(point.value * barProgress)}%
            </span>
          </div>
        );
      })}
    </div>
  );
};
```
'''


def extract_technique_examples(transcript: str) -> str:
    """
    Extract relevant code examples based on transcript content.
    Analyzes transcript for keywords that suggest certain techniques would be useful.
    """
    transcript_lower = transcript.lower()
    examples = []

    # Keywords that suggest certain techniques
    technique_keywords = {
        "particle-emitter": ["particle", "explosion", "burst", "radial", "scatter", "emit"],
        "glass-morphism": ["card", "container", "panel", "box", "glass", "blur", "overlay"],
        "flowing-river": ["flow", "stream", "river", "data", "continuous", "pipeline", "process"],
        "probability-gate": ["probability", "chance", "random", "dice", "spin", "lottery", "odds"],
        "scale-spring": ["appear", "pop", "enter", "show", "reveal", "intro"],
        "counter-animation": ["count", "number", "statistic", "metric", "percentage", "value"],
        "staggered-list": ["list", "item", "bullet", "point", "step", "sequence"],
    }

    for technique, keywords in technique_keywords.items():
        if any(kw in transcript_lower for kw in keywords):
            if technique in TECHNIQUE_CODE_EXAMPLES:
                examples.append(f"### {technique.replace('-', ' ').title()}\n```tsx{TECHNIQUE_CODE_EXAMPLES[technique]}\n```")

    # Always include basic patterns
    if "scale-spring" not in [e.split("\n")[0] for e in examples]:
        examples.append(f"### Scale Spring Entrance\n```tsx{TECHNIQUE_CODE_EXAMPLES['scale-spring']}\n```")

    if not examples:
        return ""

    return f"""
## CODE EXAMPLES - COPY THESE DIRECTLY

Based on your transcript content, these techniques are likely useful:

{chr(10).join(examples)}

**IMPORTANT**: Copy these implementations directly. Do NOT simplify them.
"""


# =============================================================================
# System Prompt and User Message Templates
# =============================================================================


SYSTEM_PROMPT = """
<role>
You are an EXPLAINER VIDEO specialist creating TECH and FINANCE content for Instagram/TikTok.
Your videos make complex concepts crystal clear through visual storytelling.
Your output must be production-quality TypeScript/React code that compiles without errors AND explains beautifully.
</role>

<storytelling_philosophy>
You are a VISUAL STORYTELLER, not a slideshow maker. Your #1 goal is making viewers UNDERSTAND through visuals.

**THE GOLDEN RULE: SHOW, DON'T TELL**
- BAD: Text says "Data flows through the system"
- GOOD: Animated particles visually flow from left to right through a pipe
- BAD: Text says "Memory fills up"
- GOOD: A container visually fills with blocks until it overflows

**VISUAL TRANSFORMATIONS (CRITICAL)**
Elements should MORPH and TRANSFORM, not just appear/disappear:
- Chaos → Order (scattered items organize themselves)
- Small → Large (element grows to show importance)
- Many → One (multiple items merge into single solution)
- Broken → Fixed (cracked element repairs itself)

**CAUSALITY - One Thing Leads to Another**
Every scene must visually CAUSE the next:
- Problem scene ends with visual tension (shaking, red glow, overflow)
- That SAME element transforms into the solution
- Don't cut to a new scene - TRANSITION the existing elements

**EMOTIONAL BEATS**
- TENSION: Elements shake, turn red, overflow, crack
- RELEASE: Tension element transforms, calms, turns green
- SATISFACTION: Celebration particles, checkmark, glow pulse
</storytelling_philosophy>

<show_dont_tell>
**BANNED: Text-as-explanation**
Never use text to explain concepts. Text is ONLY for:
- Short labels (2-3 words max): "Winner", "1/N", "O(1)"
- Single question hooks: "How?"

**REQUIRED: Visual demonstrations**
Every concept needs a VISUAL that demonstrates it:

| Concept | BAD (text) | GOOD (visual) |
|---------|-----------|---------------|
| "Data streams in" | Text label | Particles flowing left→right |
| "Memory overflows" | "Out of memory!" text | Container fills, cracks, explodes |
| "Random selection" | "Pick random(1,N)" | Spotlight sweeps across items, lands on one |
| "Equal probability" | "1/N for everyone" | N boxes, each lights up equally |
| "Efficient" | "O(1) memory" | Single small box vs huge pile |

**THE TEST**: Mute the video. Can you understand the concept from visuals alone?
If NO, you're relying too much on text. Redesign the visual.
</show_dont_tell>

<visual_continuity>
**PERSISTENT ELEMENTS**
The SAME visual element should persist across scenes and transform:
- Scene 1: River of particles (data stream)
- Scene 2: SAME river, but now showing items being selected
- Scene 3: SAME river, but now one item glows (the winner)

**NEVER:**
- Cut to completely new visuals between scenes
- Show disconnected concepts without visual links
- Reset the visual state between acts

**TRANSITIONS = TRANSFORMATIONS**
When moving between scenes:
- Element A morphs INTO element B (scale, color, shape change)
- Use spring animations for organic feel
- The "problem" visual becomes the "solution" visual
</visual_continuity>

<concrete_metaphors>
**Use TANGIBLE real-world metaphors:**

| Abstract Concept | Concrete Metaphor |
|-----------------|-------------------|
| Data stream | River of glowing particles flowing |
| Memory/Storage | Physical container/bucket that fills |
| Random selection | Spotlight/laser sweeping and landing |
| Probability | Dice rolling, wheel spinning, coin flipping |
| Algorithm steps | Assembly line / conveyor belt |
| Comparison | Side-by-side scales / before-after split |
| Growth | Plant growing / balloon inflating |
| Efficiency | Small box vs large pile |

**ANIMATE THE METAPHOR:**
Don't just show a static bucket - show items FALLING INTO IT, it FILLING UP, potentially OVERFLOWING.
The animation IS the explanation.
</concrete_metaphors>

<emotional_arc>
**Structure your video as an emotional journey:**

**ACT 1: CURIOSITY (0-10%)**
- Show something intriguing/impossible
- Visual: Counter going crazy, items flooding in
- Emotion: "Whoa, how does that work?"

**ACT 2: TENSION (10-30%)**
- Show the problem getting worse
- Visual: Container overflowing, system crashing, red warnings
- Emotion: "This is broken! What do we do?"

**ACT 3: REVELATION (30-50%)**
- The "aha!" moment - show the elegant insight
- Visual: Chaos TRANSFORMS into order (same elements, new arrangement)
- Emotion: "Oh! That's clever!"

**ACT 4: UNDERSTANDING (50-80%)**
- Walk through the mechanism step by step
- Visual: Slow-motion replay showing exactly how it works
- Emotion: "Now I get it!"

**ACT 5: SATISFACTION (80-100%)**
- Show it working at scale
- Visual: Massive numbers, everything smooth, celebration
- Emotion: "That's beautiful!"
</emotional_arc>

<layout_rules>
**1080x1920 VERTICAL format:**
- Top zone (y: 200-500): Minimal text labels only
- Center zone (y: 500-1400): THE VISUAL STORY (this is 90% of your content)
- Bottom zone (y: 1400-1700): Supporting info
- Side margins: 60px minimum
</layout_rules>

<workspace>
Working directory: {workspace_dir}
Output files:
- src/{project_id}/constants.ts (colors, timing, spring configs, typography)
- src/{project_id}/index.tsx (main composition with all scenes)
- src/{project_id}/metadata.json (composition metadata)
</workspace>

<remotion_libraries>
You have access to these official Remotion packages (already installed):
- @remotion/shapes: Pie, Star, Triangle, Circle, Rect, Polygon
- @remotion/noise: noise2D, noise3D for organic motion
- @remotion/paths: getLength, getPointAtLength, evolvePath for SVG animation
- @remotion/animated-emoji: AnimatedEmoji component
- @remotion/transitions: TransitionSeries, slide, fade, wipe

USE THESE for advanced effects. Import them in your code.
</remotion_libraries>

<three_js_3d>
**3D Animation with Three.js**

You have full Three.js support for complex 3D animations (rolling dice, 3D objects, etc.).

PRE-INSTALLED PACKAGES:
- @remotion/three: Remotion integration, provides ThreeCanvas
- @react-three/fiber: React renderer for Three.js
- @react-three/drei: Helpers (Box, Sphere, Text3D, RoundedBox, useGLTF, etc.)
- three: Core Three.js library

CRITICAL RULES:
1. Use ThreeCanvas from @remotion/three (NOT Canvas from @react-three/fiber)
2. Use useCurrentFrame() for animation timing (NOT useFrame hook)
3. Animations must be deterministic/frame-based for video rendering

EXAMPLE - Rotating 3D Cube:
```tsx
import {{ ThreeCanvas }} from '@remotion/three';
import {{ useCurrentFrame }} from 'remotion';

const My3DScene: React.FC = () => {{
  const frame = useCurrentFrame();
  const rotation = frame * 0.05;

  return (
    <ThreeCanvas>
      <ambientLight intensity={{0.5}} />
      <pointLight position={{[10, 10, 10]}} />
      <mesh rotation={{[rotation, rotation, 0]}}>
        <boxGeometry args={{[2, 2, 2]}} />
        <meshStandardMaterial color="#ff6600" />
      </mesh>
    </ThreeCanvas>
  );
}};
```

EXAMPLE - Rolling Dice with Spring:
```tsx
import {{ ThreeCanvas }} from '@remotion/three';
import {{ useCurrentFrame, spring }} from 'remotion';
import {{ RoundedBox }} from '@react-three/drei';

const RollingDice: React.FC = () => {{
  const frame = useCurrentFrame();
  const rotX = spring({{ frame, fps: 30, from: 0, to: Math.PI * 4 }});
  const rotZ = spring({{ frame, fps: 30, from: 0, to: Math.PI * 2.5 }});

  return (
    <ThreeCanvas>
      <ambientLight intensity={{0.4}} />
      <directionalLight position={{[5, 5, 5]}} />
      <RoundedBox args={{[1, 1, 1]}} radius={{0.1}} rotation={{[rotX, 0, rotZ]}}>
        <meshStandardMaterial color="white" />
      </RoundedBox>
    </ThreeCanvas>
  );
}};
```
</three_js_3d>

<npm_package_search>
**NPM Package Discovery**

When you need specialized functionality not covered by pre-installed packages:

1. Use search_npm_packages("your query") to find packages
2. Review results - only install packages marked [+] VALID
3. Install: npm install package-name
4. Import and use in your composition

GOOD SEARCH QUERIES:
- "three.js physics cannon rapier" -> finds physics engines
- "3d text troika" -> finds text rendering
- "three particles" -> finds particle systems
- "simplex noise procedural" -> finds noise generators

DO NOT SEARCH FOR (already installed):
- "react three fiber" / "drei" / "remotion three" / "three.js"
- Any @remotion/* packages
- react, react-dom
</npm_package_search>

<icons_and_svg>
You have access to 200,000+ icons via the better-icons MCP tools.

**Searching for icons:**
Use `search_icons` with descriptive queries:
- search_icons("arrow right") → finds arrow icons
- search_icons("chart bar") → finds chart icons
- search_icons("lightning bolt") → finds energy/power icons

**Getting SVG code:**
Use `get_icon` with the icon ID (format: `prefix:name`):
- get_icon("lucide:arrow-right") → returns SVG markup
- get_icon("lucide:zap") → lightning bolt
- get_icon("mdi:chart-bar") → bar chart

**Popular collections:** lucide, mdi, heroicons, tabler, ph (phosphor)

**Using icons in components:**
- Inline the SVG directly in JSX
- Wrap in a container div for positioning/animation
- Use style prop for width/height, not SVG attributes
- Use currentColor for dynamic coloring

**Example:**
```tsx
// Get via: get_icon("lucide:zap")
<div style={{{{ color: COLORS.accent, transform: `scale(${{scale}})` }}}}>
  <svg viewBox="0 0 24 24" style={{{{ width: 48, height: 48 }}}} fill="none" stroke="currentColor" strokeWidth={{2}}>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
</div>
```

**Custom SVGs:**
For diagrams, flowcharts, or concepts without matching icons, write inline SVG code.
Use simple shapes: rect, circle, path, line, polygon.

**When to use icons vs custom SVG:**
- Icons: UI elements, common concepts (arrows, charts, users, settings)
- Custom SVG: Data visualizations, metaphors, animated diagrams
</icons_and_svg>

<web_search>
You have access to WebSearch for researching unfamiliar topics.

**When to search:**
- Unfamiliar technical concepts in the transcript (algorithms, protocols, systems)
- Domain-specific terminology you don't fully understand
- Looking for visual metaphor inspiration for abstract concepts
- Remotion-specific patterns or APIs you're unsure about
- Current events or recent developments mentioned in content

**How to search effectively:**
- Use specific, targeted queries: "reservoir sampling algorithm visual explanation"
- For Remotion help: "remotion [specific feature] example"
- For visual inspiration: "[concept] infographic design" or "[concept] motion graphics"

**Example searches:**
- Transcript mentions "B-trees": search "B-tree data structure visual explanation"
- Transcript mentions "TCP handshake": search "TCP three-way handshake diagram"
- Unsure about spring physics: search "remotion spring animation examples"
- Need metaphor for "caching": search "caching visual metaphor infographic"

**DON'T search for:**
- Basic React/TypeScript syntax (you know this)
- Things already in this prompt (animation patterns, color theory)
- Every concept - only when genuinely stuck or unfamiliar
</web_search>

<svg_animation_patterns>
**1. Scale & Fade Entry:**
```tsx
const scale = spring({{ frame, fps, config: {{ damping: 22, stiffness: 90 }} }});
const opacity = interpolate(frame, [0, 15], [0, 1], {{ extrapolateRight: 'clamp' }});

<div style={{{{ opacity, transform: `scale(${{scale}})` }}}}>
  <svg>...</svg>
</div>
```

**2. Rotation:**
```tsx
const rotation = interpolate(frame, [0, 30], [0, 360]);
<svg style={{{{ transform: `rotate(${{rotation}}deg)` }}}}>...</svg>
```

**3. Stroke Draw-in Effect (for line icons):**
```tsx
const progress = spring({{ frame: frame - delay, fps, config: {{ damping: 30 }} }});
const strokeDashoffset = interpolate(progress, [0, 1], [100, 0]);

<svg>
  <path
    d="..."
    fill="none"
    stroke={{COLORS.accent}}
    strokeWidth={{2}}
    strokeDasharray={{100}}
    strokeDashoffset={{strokeDashoffset}}
  />
</svg>
```

**4. Color Transitions:**
```tsx
const color = interpolateColors(frame, [0, 30], [COLORS.muted, COLORS.accent]);
<svg style={{{{ color }}}}><path fill="currentColor" .../></svg>
```

**Rules:**
- Stagger icon animations by 6+ frames (never all at once)
- Use springs for natural motion, interpolate for linear effects
- Match strokeDasharray value to approximate path length for draw-in effect
</svg_animation_patterns>

<process>
1. PLAN (think thoroughly - this is where the magic happens):
   - What's the HOOK? How will frame 0-90 stop the scroll?
   - What VISUAL METAPHORS represent the concepts?
   - What COLOR PALETTE fits the mood? (Vibrant? Tech? Calm?)
   - How do scenes BUILD understanding progressively?
   - What ANIMATIONS will create "wow" moments?

2. WRITE:
   - Write constants.ts first with COLORS (gradient-ready), TYPOGRAPHY, TIMING, SPRING_CONFIG
   - Write index.tsx with hook scene first, then build from there
   - Use Sequence components for scene timing
   - Add animated backgrounds - NEVER plain colors

3. VALIDATE:
   - Run: npx tsc --noEmit --pretty false
   - Fix ALL errors before finishing
   - Re-run validation until clean
</process>

<animation_rules>
**Sequence + useCurrentFrame() Rule (CRITICAL):**
Inside a Sequence, useCurrentFrame() returns RELATIVE frames starting at 0.
NEVER subtract the Sequence's start time - frame is already relative!

**Transformation Animations (THE KEY TO GOOD STORYTELLING):**
```tsx
// GOOD: Element transforms from problem → solution
const problemScale = interpolate(frame, [0, 60], [1, 0], {{extrapolateRight: 'clamp'}});
const solutionScale = interpolate(frame, [60, 120], [0, 1], {{extrapolateRight: 'clamp'}});
// Problem shrinks as solution grows - VISUAL CAUSALITY

// BAD: Disconnected elements that just appear/disappear
{{frame < 60 && <ProblemElement />}}
{{frame >= 60 && <SolutionElement />}}  // No connection!
```

**Persistent Visual Elements:**
Create ONE main visual (e.g., a container, a stream of particles) that PERSISTS and TRANSFORMS:
```tsx
// The same "stream" element throughout, but its behavior changes
const StreamElement = () => {{
  const fillLevel = interpolate(frame, [0, 100, 200], [0, 1, 0.1]); // fills, then drains
  const color = frame < 150 ? COLORS.danger : COLORS.success; // red → green
  // Same element, different states = VISUAL STORY
}};
```

**Spring Configuration:**
  config: {{ damping: 22, stiffness: 90, mass: 0.9 }}

**Stagger Rule:**
  - Stagger by 6+ frames: startFrame + (index * 6)

**Interpolate Rule:**
  - ALWAYS use extrapolateRight: 'clamp'

**React Keys Rule:**
  - EVERY array element needs a unique key prop

**Technical Rules:**
  - No overlapping elements
  - 60px minimum margins
  - MAX 3 animated elements at once
  - damping >= 20
</animation_rules>

<constraints>
- Resolution: {width}x{height}
- Duration: {duration_frames} frames at {fps} FPS
- Single file per type (no component splitting)
- MUST pass TypeScript validation
- MUST have animated backgrounds
- MUST have visual metaphors (not just text)
</constraints>

<quality_checklist>
Before declaring GENERATION COMPLETE, verify:

**STORYTELLING (MOST IMPORTANT):**
[ ] SHOW DON'T TELL: Can you understand the video on MUTE? If not, redesign.
[ ] VISUAL CONTINUITY: Same core visual element persists and transforms across scenes
[ ] TRANSFORMATION: Elements morph (problem→solution), not just appear/disappear
[ ] CAUSALITY: Each scene visually CAUSES the next (tension builds, then releases)
[ ] EMOTIONAL ARC: Curiosity → Tension → Revelation → Understanding → Satisfaction

**VISUAL METAPHORS:**
[ ] Every abstract concept has a CONCRETE visual metaphor
[ ] Metaphors are ANIMATED to demonstrate the concept (not just static icons)
[ ] Text is MINIMAL - only short labels, never explanations
[ ] The "mute test": Visuals alone tell the story

**CODE QUALITY:**
[ ] TypeScript compiles with no errors
[ ] All array children have unique key props
[ ] All spring configs use damping >= 20
[ ] All interpolate() calls have extrapolateRight: 'clamp'
[ ] Inside Sequence, useCurrentFrame() used directly (no subtraction)

**LAYOUT:**
[ ] Main visuals in center zone (y: 500-1400)
[ ] 60px minimum margins
[ ] No overlapping elements
[ ] MAX 3 animated elements at once
</quality_checklist>
"""


USER_MESSAGE = """
## PROJECT: {project_id}

## VIDEO SPECS
- Resolution: {width}x{height}
- Duration: {duration_frames} frames ({duration_seconds}s)
- FPS: {fps}

## TRANSCRIPT
{transcript}

## YOUR TASK
Create a VISUAL STORY that explains the transcript's concept. The video should be understandable ON MUTE.

### THE MUTE TEST (MOST IMPORTANT)
Ask yourself: "If I watch this with sound off, do I understand the concept?"
- If YES: Good visual storytelling
- If NO: You're relying too much on text. REDESIGN.

### SHOW, DON'T TELL
**BANNED:** Using text to explain concepts
**REQUIRED:** Using animated visuals to DEMONSTRATE concepts

| Instead of this text... | Show this visual... |
|------------------------|---------------------|
| "Data streams in" | Particles flowing left→right |
| "Memory fills up" | Container filling with blocks, then overflowing |
| "Random selection" | Spotlight sweeping across items, landing on one |
| "1/N probability" | N items, one lights up randomly |
| "Algorithm runs" | Assembly line moving items through stages |

### VISUAL CONTINUITY (CRITICAL)
Create ONE persistent visual element that TRANSFORMS across the video:

**GOOD Example - Data Stream Story:**
- Hook: River of particles flooding in (overwhelming)
- Problem: River overflows a tiny bucket (can't store all)
- Insight: Single glowing particle captured in bucket (one variable!)
- Mechanism: Each new particle has chance to replace the one in bucket
- Payoff: River processed, bucket glows with fair winner

**The SAME visual (river + bucket) transforms throughout. Viewer follows one story.**

**BAD Example - Disconnected Slides:**
- Hook: Counter numbers
- Problem: Grid of boxes
- Insight: Text saying "one variable"
- Mechanism: Formula on screen
- Payoff: Checkmark

**Each scene is unrelated. Feels like a slideshow, not a story.**

### TRANSFORMATION ANIMATIONS
Elements should MORPH, not just appear/disappear:

```tsx
// GOOD: Container fills, then cracks, then explodes into particles
const fillProgress = interpolate(frame, [0, 60], [0, 1]);  // fills
const crackOpacity = interpolate(frame, [60, 80], [0, 1]); // crack appears
const explodeProgress = spring({{frame: frame - 90, fps}}); // explodes

// BAD: Just show different things
{{frame < 60 && <FilledBox />}}
{{frame >= 60 && <ExplodedParticles />}}  // No transformation!
```

### EMOTIONAL ARC
Structure your video emotionally:

**ACT 1: CURIOSITY (0-10%)**
Visual: Something intriguing - counter going crazy, items flooding
Emotion: "Whoa, what's happening?"

**ACT 2: TENSION (10-30%)**
Visual: Problem gets worse - overflow, cracks, red warnings, shaking
Emotion: "This is broken! How do we fix this?"

**ACT 3: REVELATION (30-50%)**
Visual: SAME problematic element TRANSFORMS - chaos becomes order
Emotion: "Oh! That's clever!"
**KEY: Don't cut to new visuals. Transform the existing ones.**

**ACT 4: UNDERSTANDING (50-80%)**
Visual: Slow-motion replay showing mechanism step by step
Emotion: "Now I get exactly how it works."

**ACT 5: SATISFACTION (80-100%)**
Visual: Massive scale, smooth operation, celebration particles
Emotion: "That's beautiful. I learned something."

### CONCRETE METAPHORS
Use TANGIBLE real-world objects:
- Data stream → River of glowing particles
- Storage → Physical bucket/container
- Selection → Spotlight/laser beam
- Probability → Dice rolling, wheel spinning
- Efficiency → Small box vs huge pile (side by side)

### TECHNICAL REQUIREMENTS
- Sequence frames are RELATIVE: useCurrentFrame() returns 0 at Sequence start
- Spring config: {{ damping: 22, stiffness: 90, mass: 0.9 }}
- All interpolate() need extrapolateRight: 'clamp'
- All array children need unique key props
- 60px margins, no overlapping elements
- MAX 3 animated elements visible at once

### OUTPUT FILES (EXACTLY these paths and IDs):
- src/{project_id}/constants.ts
- src/{project_id}/index.tsx
- src/{project_id}/metadata.json

### CRITICAL - Exports Structure:
Your index.tsx MUST have this exact export structure:
```tsx
// MainComposition is the actual video content (scenes, animations, etc.)
const MainComposition: React.FC = () => {{
  return (
    <AbsoluteFill>
      {{/* Your scenes here */}}
    </AbsoluteFill>
  );
}};

// RemotionRoot registers the composition (for Remotion Studio)
export const RemotionRoot: React.FC = () => {{
  return (
    <Composition
      id="{project_id}"
      component={{MainComposition}}
      durationInFrames={{{duration_frames}}}
      fps={{{fps}}}
      width={{{width}}}
      height={{{height}}}
    />
  );
}};

// CRITICAL: Export MainComposition as default (NOT RemotionRoot!)
// The frontend player needs the actual video component, not the registration wrapper
export default MainComposition;

// Register root for Remotion bundler (required for SSR rendering)
registerRoot(RemotionRoot);
```

### CRITICAL - metadata.json:
After creating the code, write this file:
```json
{{
  "compositionId": "{project_id}",
  "durationInFrames": {duration_frames},
  "fps": {fps},
  "width": {width},
  "height": {height},
  "visuals": [
    {{"startMs": 0, "endMs": {duration_seconds}000, "type": "generated", "description": "AI-generated visual"}}
  ]
}}
```

### FINAL CHECK:
When TypeScript validation passes and all 3 files exist, respond with:
"GENERATION COMPLETE"
- Hook technique used: [describe]
- Visual metaphors: [list them]
- Color palette: [name]
- Remotion libraries used: [list them]
"""


# =============================================================================
# Security Settings (Reference: Auto-Claude apps/backend/core/client.py)
# =============================================================================


def create_security_settings(workspace_path: str) -> dict:
    """
    Create security settings for Claude Agent SDK.

    Reference: Auto-Claude apps/backend/core/client.py lines 603-654
    """
    return {
        "sandbox": {"enabled": True, "autoAllowBashIfSandboxed": True},
        "permissions": {
            "defaultMode": "acceptEdits",
            "allow": [
                # Allow all file operations within workspace
                "Read(./**)",
                "Write(./**)",
                "Edit(./**)",
                "Glob(./**)",
                "Grep(./**)",
                # Also allow absolute paths
                f"Read({workspace_path}/**)",
                f"Write({workspace_path}/**)",
                f"Edit({workspace_path}/**)",
                f"Glob({workspace_path}/**)",
                f"Grep({workspace_path}/**)",
                # Allow bash for TypeScript validation
                "Bash(*)",
            ],
        },
    }


# =============================================================================
# Visual Generator Class
# =============================================================================


class ClaudeVisualGenerator:
    """
    Generates Remotion video compositions using Claude Agent SDK.

    Uses OAuth authentication from Claude Pro/Max subscription.
    """

    def __init__(
        self,
        workspace: Path,
        project_id: str,
        bundle_output: Path,
        model: str = "claude-opus-4-5-20251101",
        max_thinking_tokens: int = 10000,
        max_turns: int = 100,
    ):
        """
        Initialize the visual generator.

        Args:
            workspace: Path to the Remotion workspace (with node_modules)
            project_id: Unique project identifier
            bundle_output: Path to output bundled video
            model: Claude model to use
            max_thinking_tokens: Token budget for extended thinking
            max_turns: Maximum agent turns
        """
        self.workspace = workspace
        self.project_id = project_id
        self.src_dir = workspace / "src" / project_id
        self.bundle_output = bundle_output
        self.model = model
        self.max_thinking_tokens = max_thinking_tokens
        self.max_turns = max_turns

        # Configure OAuth authentication
        configure_sdk_auth()

    def _build_system_prompt(
        self,
        width: int,
        height: int,
        fps: int,
        duration_frames: int,
    ) -> str:
        """Build the system prompt with workspace context."""
        return SYSTEM_PROMPT.format(
            workspace_dir=str(self.workspace),
            project_id=self.project_id,
            width=width,
            height=height,
            fps=fps,
            duration_frames=duration_frames,
        )

    def _build_user_message(
        self,
        transcript: str,
        width: int,
        height: int,
        duration_frames: int,
        fps: int,
    ) -> str:
        """Build the user message with transcript, specs, and injected skills/examples."""
        duration_seconds = duration_frames / fps

        # Get all guides and examples to inject directly
        # (Agents don't reliably read skill files, so we inject everything)
        instagram_guide = get_instagram_design_guide()
        remotion_libraries = get_remotion_libraries_guide()
        condensed_skills = get_condensed_skills()
        technique_examples = extract_technique_examples(transcript)

        base_message = USER_MESSAGE.format(
            project_id=self.project_id,
            width=width,
            height=height,
            duration_frames=duration_frames,
            duration_seconds=f"{duration_seconds:.1f}",
            fps=fps,
            transcript=transcript,
        )

        # Inject everything directly into prompt
        # Order: Design guide first (sets mindset), then libraries, then patterns, then task
        return f"{instagram_guide}\n\n{remotion_libraries}\n\n{condensed_skills}\n\n{technique_examples}\n\n{base_message}"

    def _write_security_settings(self) -> Path:
        """Write security settings to a temporary file."""
        settings = create_security_settings(str(self.workspace))
        settings_path = self.workspace / ".claude" / "settings.local.json"
        settings_path.parent.mkdir(parents=True, exist_ok=True)

        with open(settings_path, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=2)

        return settings_path

    async def _verify_typescript(self) -> tuple[bool, str]:
        """Run TypeScript validation on the generated code.

        Returns:
            Tuple of (success, error_output)
        """
        import subprocess

        try:
            result = subprocess.run(
                ["npx", "tsc", "--noEmit"],
                cwd=str(self.workspace),
                capture_output=True,
                timeout=60,
                shell=True,
                encoding="utf-8",
                errors="replace",
            )
            if result.returncode == 0:
                return True, ""
            else:
                errors = result.stdout + result.stderr
                print(f"[ClaudeGenerator] TypeScript errors:\n{errors[:2000]}")
                return False, errors
        except subprocess.TimeoutExpired:
            return False, "TypeScript check timed out"
        except Exception as e:
            return False, str(e)

    async def _run_self_heal(self, ts_errors: str) -> bool:
        """Run a mini-agent to fix TypeScript errors.

        Args:
            ts_errors: The TypeScript error output

        Returns:
            True if the agent ran successfully (doesn't guarantee errors fixed)
        """
        print(f"[ClaudeGenerator] Running self-heal agent...")

        heal_prompt = f"""
## TASK: Fix TypeScript Errors

The code has TypeScript compilation errors. Your job is to fix them.

### TypeScript Errors:
```
{ts_errors[:3000]}
```

### Instructions:
1. Read the error messages carefully
2. Identify the files and line numbers with errors
3. Read those files to understand the context
4. Fix each error - common issues are:
   - Missing imports
   - Type mismatches
   - Undefined variables
   - Syntax errors (missing brackets, etc.)
5. After fixing, run `npx tsc --noEmit` to verify

### Rules:
- Fix the MINIMUM needed to resolve errors
- Do NOT refactor or change working code
- Do NOT add new features
- Focus ONLY on making TypeScript compile

When done, respond: "SELF-HEAL COMPLETE"
"""

        try:
            client = ClaudeSDKClient(
                options=ClaudeAgentOptions(
                    model="claude-sonnet-4-20250514",  # Use Sonnet for speed
                    system_prompt={
                        "type": "preset",
                        "preset": "claude_code",
                        "append": "You are a TypeScript error fixer. Fix compilation errors quickly and precisely."
                    },
                    cwd=str(self.workspace),
                    max_turns=20,
                    max_thinking_tokens=3000,
                    setting_sources=["project"],  # Load skills from .claude/skills/
                    allowed_tools=["Read", "Edit", "Bash", "Glob", "Skill"],
                )
            )

            async with client:
                await client.query(heal_prompt)

                async for msg in client.receive_response():
                    msg_type = type(msg).__name__
                    if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                        for block in msg.content:
                            block_type = type(block).__name__
                            if block_type == "TextBlock" and hasattr(block, "text"):
                                try:
                                    print(block.text[:200], end="", flush=True)
                                except UnicodeEncodeError:
                                    pass
                            elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                                print(f"\n[SelfHeal Tool: {block.name}]", flush=True)

            print(f"\n[ClaudeGenerator] Self-heal agent completed")
            return True

        except Exception as e:
            print(f"[ClaudeGenerator] Self-heal agent error: {e}")
            return False

    async def _run_bundle(self) -> Path:
        """Bundle the Remotion project."""
        import subprocess

        # TypeScript processor expects dashes, not underscores in bundle path
        bundle_id = self.project_id.replace("_", "-")
        bundle_path = self.bundle_output / bundle_id

        # Create output directory
        bundle_path.mkdir(parents=True, exist_ok=True)

        # Use project-specific entry point instead of workspace Root.tsx
        # The generated composition exports RemotionRoot which registers the composition
        entry_point = self.src_dir / "index.tsx"

        try:
            result = subprocess.run(
                [
                    "npx", "remotion", "bundle",
                    "--entry-point", str(entry_point),
                    "--out-dir", str(bundle_path),
                ],
                cwd=str(self.workspace),
                capture_output=True,
                timeout=120,  # 2 min for tsc check
                shell=True,
                encoding="utf-8",
                errors="replace",
            )

            if result.returncode != 0:
                raise RuntimeError(f"Bundle failed: {result.stderr}")

            return bundle_path

        except subprocess.TimeoutExpired:
            raise RuntimeError("Bundle timed out after 5 minutes")

    async def _compile_cjs(self, bundle_path: Path) -> None:
        """
        Compile the composition source to CommonJS for dynamic frontend loading.

        The frontend's DynamicVisualLoader expects a composition.cjs.js file
        that exports the React component in CommonJS format.
        """
        import subprocess

        # Use absolute paths to avoid issues with cwd
        index_tsx = (self.src_dir / "index.tsx").resolve()
        cjs_output = (bundle_path / "composition.cjs.js").resolve()

        if not index_tsx.exists():
            safe_print(f"[ClaudeGenerator] Warning: index.tsx not found, skipping CJS compilation")
            return

        safe_print(f"[ClaudeGenerator] Compiling composition to CJS: {cjs_output}")

        try:
            # Use esbuild to compile the composition to CommonJS
            # This creates a file the frontend can dynamically import
            # Externalize all packages that the frontend's customRequire provides
            result = subprocess.run(
                [
                    "npx", "esbuild",
                    str(index_tsx),
                    "--bundle",
                    "--format=cjs",
                    "--platform=browser",
                    "--target=es2020",
                    "--external:react",
                    "--external:react/jsx-runtime",
                    "--external:react/jsx-dev-runtime",
                    "--external:remotion",
                    "--external:@remotion/noise",
                    "--external:@remotion/shapes",
                    "--external:@remotion/paths",
                    "--external:@remotion/three",
                    f"--outfile={cjs_output}",
                ],
                cwd=str(self.workspace),
                capture_output=True,
                timeout=60,
                shell=True,
                encoding="utf-8",
                errors="replace",
            )

            if result.returncode != 0:
                safe_print(f"[ClaudeGenerator] CJS compilation warning: {result.stderr}")
                # Don't fail - the browser bundle still works for some use cases
            else:
                safe_print(f"[ClaudeGenerator] CJS compilation successful")
                # Post-process to add React keys
                self._add_react_keys_to_cjs(cjs_output)

        except subprocess.TimeoutExpired:
            safe_print(f"[ClaudeGenerator] CJS compilation timed out")
        except Exception as e:
            safe_print(f"[ClaudeGenerator] CJS compilation error: {e}")

    def _add_react_keys_to_cjs(self, cjs_path: Path) -> None:
        """
        Post-process CJS file to add React keys to children arrays.
        This fixes the 'Each child in a list should have a unique key prop' warnings.

        Strategy: Find jsx/jsxs calls that end with }), and add a key before the closing paren.
        Skip ones that already have a key (end with }, "...")).
        """
        if not cjs_path.exists():
            return

        content = cjs_path.read_text(encoding="utf-8")
        lines = content.split('\n')
        modified = False
        key_counter = 0

        new_lines = []
        for line in lines:
            # Look for jsx calls ending with }) that don't have a key
            # Pattern: ...import_jsx_runtime.jsx)(..., {...}) or ...jsxs)(..., {...})
            # Should become: ...import_jsx_runtime.jsx)(..., {...}, "key")

            # Check if line has a jsx/jsxs call that ends with })
            if 'import_jsx_runtime.jsx' in line and line.rstrip().endswith('}),'):
                # Check if it already has a key (third arg)
                # Has key: }, "key"),  No key: }),
                stripped = line.rstrip()
                # Find the last }) and insert key before it
                if not '},  "' in stripped and not '}, "' in stripped:
                    # No key, add one
                    key_counter += 1
                    # Replace trailing }), with }, "k{n}"),
                    new_line = stripped[:-2] + f', "k{key_counter}"),'
                    new_lines.append(new_line)
                    modified = True
                    continue
            elif 'import_jsx_runtime.jsx' in line and line.rstrip().endswith('})'):
                stripped = line.rstrip()
                if not '},  "' in stripped and not '}, "' in stripped:
                    key_counter += 1
                    new_line = stripped[:-1] + f', "k{key_counter}")'
                    new_lines.append(new_line)
                    modified = True
                    continue

            new_lines.append(line)

        if modified:
            cjs_path.write_text('\n'.join(new_lines), encoding="utf-8")
            safe_print(f"[ClaudeGenerator] Added {key_counter} React keys to CJS output")

    # =========================================================================
    # Two-Phase Generation Pipeline (Director + Animator)
    # =========================================================================

    async def _run_director(
        self,
        formatted_transcript: str,
        width: int,
        height: int,
        duration_frames: int,
        fps: int,
        style_preset: str = "modern",
        layout_mode: str = "pip",
        style_guide: str | None = None,
    ) -> dict[str, Any]:
        """
        Phase 1: Run the Director agent to create the scene plan.

        The Director analyzes the transcript and creates:
        - SCENE_PLAN.md: Human-readable plan with visual story
        - scenes.json: Machine-readable scene data for Animator

        Args:
            formatted_transcript: Transcript with word-level timestamps
            width: Video width
            height: Video height
            duration_frames: Total frames
            fps: Frames per second
            style_preset: Visual style preset (minimal, modern, playful, bold, classic)
            layout_mode: Layout mode (pip, split-horizontal, split-vertical)
            style_guide: Optional user-provided style/layout guidance

        Returns:
            dict with success status and plan file paths
        """
        from prompts.director import DIRECTOR_SYSTEM_PROMPT, build_director_user_message

        print(f"[ClaudeGenerator] Phase 1: Director analyzing transcript...")

        director_message = build_director_user_message(
            project_id=self.project_id,
            formatted_transcript=formatted_transcript,
            width=width,
            height=height,
            duration_frames=duration_frames,
            fps=fps,
            style_preset=style_preset,
            layout_mode=layout_mode,
            style_guide=style_guide,
        )

        # Director uses Sonnet for fast planning
        # Use claude_code preset with append to preserve TodoWrite functionality
        client = ClaudeSDKClient(
            options=ClaudeAgentOptions(
                model="claude-sonnet-4-20250514",
                system_prompt={
                    "type": "preset",
                    "preset": "claude_code",
                    "append": DIRECTOR_SYSTEM_PROMPT
                },
                cwd=str(self.workspace),
                max_turns=50,  # Enough turns for research + planning + writing
                max_thinking_tokens=5000,
                setting_sources=["project"],  # Load skills from .claude/skills/
                allowed_tools=["Read", "Write", "Grep", "Glob", "WebSearch", "Skill", "TodoWrite"],
            )
        )

        response_text = ""
        tool_calls_made = []
        async with client:
            await client.query(director_message)
            print(f"[Director] Query sent, waiting for response...", flush=True)

            async for msg in client.receive_response():
                msg_type = type(msg).__name__
                print(f"[Director] Received message type: {msg_type}", flush=True)

                if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                    for block in msg.content:
                        block_type = type(block).__name__
                        if block_type == "TextBlock" and hasattr(block, "text"):
                            response_text += block.text
                            try:
                                print(block.text, end="", flush=True)
                            except UnicodeEncodeError:
                                safe_text = block.text.encode("ascii", errors="replace").decode("ascii")
                                print(safe_text, end="", flush=True)
                        elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                            tool_calls_made.append(block.name)
                            print(f"\n[Director Tool: {block.name}]", flush=True)
                        elif block_type == "ToolResultBlock":
                            print(f"\n[Director Tool Result received]", flush=True)
                        else:
                            print(f"\n[Director] Unknown block type: {block_type}", flush=True)
                elif msg_type == "ErrorMessage":
                    print(f"[Director] ERROR: {msg}", flush=True)
                elif msg_type == "StopMessage":
                    print(f"[Director] Stop reason received", flush=True)

        print(f"\n[ClaudeGenerator] Director made {len(tool_calls_made)} tool calls: {tool_calls_made}", flush=True)

        print(f"\n[ClaudeGenerator] Director completed")

        # Verify plan files were created
        scene_plan = self.src_dir / "SCENE_PLAN.md"
        scenes_json = self.src_dir / "scenes.json"

        # Debug: List what files exist in the source directory
        print(f"[ClaudeGenerator] Checking for plan files in: {self.src_dir}")
        if self.src_dir.exists():
            existing_files = list(self.src_dir.iterdir())
            print(f"[ClaudeGenerator] Files in src_dir: {[f.name for f in existing_files]}")
        else:
            print(f"[ClaudeGenerator] WARNING: src_dir does not exist!")

        if not scene_plan.exists():
            return {
                "success": False,
                "error": f"Director did not create SCENE_PLAN.md (expected at {scene_plan})",
            }

        if not scenes_json.exists():
            return {
                "success": False,
                "error": f"Director did not create scenes.json (expected at {scenes_json})",
            }

        # Validate scenes.json structure
        try:
            with open(scenes_json, encoding="utf-8") as f:
                plan_data = json.load(f)

            if "scenes" not in plan_data or len(plan_data["scenes"]) == 0:
                return {
                    "success": False,
                    "error": "scenes.json has no scenes defined",
                }

            scene_count = len(plan_data["scenes"])
            print(f"[ClaudeGenerator] Director created plan with {scene_count} scenes")

        except json.JSONDecodeError as e:
            return {
                "success": False,
                "error": f"scenes.json is invalid JSON: {e}",
            }

        return {
            "success": True,
            "scenePlanPath": str(scene_plan),
            "scenesJsonPath": str(scenes_json),
            "sceneCount": scene_count,
        }

    async def _run_animator(
        self,
        width: int,
        height: int,
        duration_frames: int,
        fps: int,
    ) -> dict[str, Any]:
        """
        Phase 2: Run the Animator agent to implement the scene plan.

        The Animator reads SCENE_PLAN.md and scenes.json, then:
        - Creates TODO list for each scene
        - Implements each scene with reasoning logged
        - Validates against the plan
        - Outputs: constants.ts, index.tsx, metadata.json

        Args:
            width: Video width
            height: Video height
            duration_frames: Total frames
            fps: Frames per second

        Returns:
            dict with success status
        """
        from prompts.animator import ANIMATOR_SYSTEM_PROMPT, build_animator_user_message

        print(f"[ClaudeGenerator] Phase 2: Animator implementing scenes...")

        # Get condensed skills and guides for Animator
        remotion_libraries = get_remotion_libraries_guide()
        condensed_skills = get_condensed_skills()

        # Build full system prompt with skills
        full_system_prompt = f"{ANIMATOR_SYSTEM_PROMPT}\n\n{remotion_libraries}\n\n{condensed_skills}"

        animator_message = build_animator_user_message(self.project_id)

        # Animator uses Opus for high-quality implementation
        # Use claude_code preset with append to preserve TodoWrite functionality
        client = ClaudeSDKClient(
            options=ClaudeAgentOptions(
                model=self.model,  # Use configured model (Opus)
                system_prompt={
                    "type": "preset",
                    "preset": "claude_code",
                    "append": full_system_prompt
                },
                cwd=str(self.workspace),
                max_turns=self.max_turns,
                max_thinking_tokens=self.max_thinking_tokens,
                max_buffer_size=10 * 1024 * 1024,
                enable_file_checkpointing=True,
                setting_sources=["project"],  # Load skills from .claude/skills/
                allowed_tools=["Read", "Write", "Edit", "Glob", "Grep", "Bash", "TodoWrite", "Skill"],
                mcp_servers={
                    "better-icons": {
                        "type": "stdio",
                        "command": "npx",
                        "args": ["better-icons"]
                    }
                },
                hooks={
                    "PreToolUse": [
                        HookMatcher(matcher="Bash", hooks=[bash_security_hook]),
                    ],
                },
            )
        )

        response_text = ""
        async with client:
            await client.query(animator_message)

            async for msg in client.receive_response():
                msg_type = type(msg).__name__
                if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                    for block in msg.content:
                        block_type = type(block).__name__
                        if block_type == "TextBlock" and hasattr(block, "text"):
                            response_text += block.text
                            try:
                                print(block.text, end="", flush=True)
                            except UnicodeEncodeError:
                                safe_text = block.text.encode("ascii", errors="replace").decode("ascii")
                                print(safe_text, end="", flush=True)
                        elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                            print(f"\n[Animator Tool: {block.name}]", flush=True)

        print(f"\n[ClaudeGenerator] Animator completed")

        # Verify output files
        index_tsx = self.src_dir / "index.tsx"
        if not index_tsx.exists():
            return {
                "success": False,
                "error": "Animator did not create index.tsx",
            }

        # Check for implementation log (optional but expected)
        impl_log = self.src_dir / "IMPLEMENTATION_LOG.md"
        if impl_log.exists():
            print(f"[ClaudeGenerator] Implementation log created: {impl_log}")

        return {
            "success": True,
            "indexPath": str(index_tsx),
            "hasImplementationLog": impl_log.exists(),
        }

    async def generate_two_phase(
        self,
        transcript: str,
        words: list[dict] | None = None,
        width: int = 1920,
        height: int = 1080,
        duration_frames: int = 1800,
        fps: int = 30,
        timeout_seconds: int = 2400,  # 40 minutes for two phases
        max_retries: int = 2,
        style_preset: str = "modern",
        layout_mode: str = "pip",
        style_guide: str | None = None,
    ) -> dict[str, Any]:
        """
        Generate video using two-phase pipeline: Director + Animator.

        Phase 1 (Director): Analyzes transcript, creates scene plan
        Phase 2 (Animator): Implements plan scene-by-scene with TODO tracking

        Args:
            transcript: Plain text transcript
            words: Optional word-level timestamps from WhisperX
            width: Video width in pixels
            height: Video height in pixels
            duration_frames: Total duration in frames
            fps: Frames per second
            timeout_seconds: Total timeout for both phases
            max_retries: Retry attempts per phase
            style_preset: Visual style preset (minimal, modern, playful, bold, classic)
            layout_mode: Layout mode (pip, split-horizontal, split-vertical)
            style_guide: Optional user-provided style/layout guidance

        Returns:
            dict with success status and bundle URL
        """
        from transcript_formatter import (
            format_transcript_for_director,
            format_transcript_with_key_moments,
        )

        last_error: Exception | None = None

        for attempt in range(max_retries + 1):
            try:
                print(f"[ClaudeGenerator] Two-phase attempt {attempt + 1}/{max_retries + 1}")

                if attempt > 0:
                    base_delay = 10 * (2 ** (attempt - 1))
                    print(f"[ClaudeGenerator] Waiting {base_delay}s before retry...")
                    await asyncio.sleep(base_delay)

                # Re-configure OAuth
                await configure_sdk_auth_async()

                # Clean previous attempt
                if self.src_dir.exists():
                    shutil.rmtree(self.src_dir)
                self.src_dir.mkdir(parents=True)

                # Format transcript with timestamps if available
                if words:
                    formatted_transcript = format_transcript_with_key_moments(words, fps)
                else:
                    formatted_transcript = f"## TRANSCRIPT\n\n{transcript}"

                # Phase 1: Director
                director_result = await self._run_director(
                    formatted_transcript=formatted_transcript,
                    width=width,
                    height=height,
                    duration_frames=duration_frames,
                    fps=fps,
                    style_preset=style_preset,
                    layout_mode=layout_mode,
                    style_guide=style_guide,
                )

                if not director_result["success"]:
                    raise RuntimeError(f"Director failed: {director_result.get('error', 'Unknown error')}")

                print(f"[ClaudeGenerator] Director created {director_result['sceneCount']} scenes")

                # Phase 2: Animator
                animator_result = await self._run_animator(
                    width=width,
                    height=height,
                    duration_frames=duration_frames,
                    fps=fps,
                )

                if not animator_result["success"]:
                    raise RuntimeError(f"Animator failed: {animator_result.get('error', 'Unknown error')}")

                # Verify TypeScript with self-healing
                print(f"[ClaudeGenerator] Verifying TypeScript...")
                ts_success, ts_errors = await self._verify_typescript()

                # Self-healing loop: try to fix TypeScript errors up to 3 times
                heal_attempts = 0
                max_heal_attempts = 3
                while not ts_success and heal_attempts < max_heal_attempts:
                    heal_attempts += 1
                    print(f"[ClaudeGenerator] TypeScript failed, self-healing attempt {heal_attempts}/{max_heal_attempts}...")

                    # Run a mini-healing agent to fix the errors
                    heal_success = await self._run_self_heal(ts_errors)
                    if not heal_success:
                        print(f"[ClaudeGenerator] Self-heal agent failed")
                        break

                    # Re-verify
                    ts_success, ts_errors = await self._verify_typescript()

                if not ts_success:
                    raise RuntimeError(f"TypeScript validation failed after {heal_attempts} self-heal attempts")

                print(f"[ClaudeGenerator] TypeScript validation passed")

                # Create metadata.json if not exists
                metadata_json = self.src_dir / "metadata.json"
                if not metadata_json.exists():
                    print("[ClaudeGenerator] Creating fallback metadata.json...")
                    fallback_metadata = {
                        "compositionId": self.project_id,
                        "durationInFrames": duration_frames,
                        "fps": fps,
                        "width": width,
                        "height": height,
                        "visuals": [
                            {"startMs": 0, "endMs": int(duration_frames / fps * 1000), "type": "generated", "description": "AI-generated visual"}
                        ]
                    }
                    with open(metadata_json, "w", encoding="utf-8") as f:
                        json.dump(fallback_metadata, f, indent=2)

                # Fix composition ID
                index_tsx = self.src_dir / "index.tsx"
                await self._fix_composition_id(index_tsx, self.project_id)

                # Bundle
                print(f"[ClaudeGenerator] Bundling project...")
                bundle_path = await self._run_bundle()
                print(f"[ClaudeGenerator] Bundle complete: {bundle_path}")

                # Compile CJS
                print(f"[ClaudeGenerator] Compiling CJS...")
                await self._compile_cjs(bundle_path)

                bundle_id = self.project_id.replace("_", "-")
                return {
                    "success": True,
                    "bundleUrl": f"/bundles/{bundle_id}/index.html",
                    "bundlePath": str(bundle_path),
                    "attempts": attempt + 1,
                    "pipeline": "two-phase",
                    "scenePlan": director_result.get("scenePlanPath"),
                    "implementationLog": str(self.src_dir / "IMPLEMENTATION_LOG.md"),
                }

            except Exception as e:
                last_error = e
                print(f"[ClaudeGenerator] Two-phase attempt {attempt + 1} failed: {e}")
                continue

        raise RuntimeError(f"Two-phase generation failed after {max_retries + 1} attempts: {last_error}")

    async def _fix_composition_id(self, index_tsx: Path, expected_id: str) -> None:
        """
        Ensure the Composition id in index.tsx matches the expected project_id.
        The agent sometimes uses descriptive names instead of the project ID.
        """
        import re

        content = index_tsx.read_text(encoding="utf-8")

        # Find all Composition id= values
        pattern = r'<Composition\s+id="([^"]+)"'
        matches = re.findall(pattern, content)

        if not matches:
            print(f"[ClaudeGenerator] Warning: No Composition found in index.tsx")
            return

        current_id = matches[0]
        if current_id == expected_id:
            print(f"[ClaudeGenerator] Composition ID is correct: {current_id}")
            return

        # Replace the composition ID
        print(f"[ClaudeGenerator] Fixing composition ID: {current_id} -> {expected_id}")
        new_content = re.sub(
            r'(<Composition\s+id=")([^"]+)(")',
            f'\\g<1>{expected_id}\\g<3>',
            content,
            count=1  # Only replace the first one
        )

        index_tsx.write_text(new_content, encoding="utf-8")


# =============================================================================
# CLI Entry Point
# =============================================================================


async def main():
    """CLI entry point for testing."""
    import argparse

    parser = argparse.ArgumentParser(description="Claude Code Visual Generator")
    parser.add_argument("--workspace", required=True, help="Path to Remotion workspace")
    parser.add_argument("--project-id", required=True, help="Project ID")
    parser.add_argument("--bundle-output", required=True, help="Bundle output directory")
    parser.add_argument("--transcript", required=True, help="Transcript text or file path")
    parser.add_argument("--words-json", help="Path to words JSON file with timestamps")
    parser.add_argument("--style-guide", help="Path to user style guide text file")
    parser.add_argument("--style-preset", default="modern", help="Visual style preset (minimal, modern, playful, bold, classic)")
    parser.add_argument("--layout-mode", default="pip", help="Layout mode (pip, split-horizontal, split-vertical)")
    parser.add_argument("--width", type=int, default=1920, help="Video width")
    parser.add_argument("--height", type=int, default=1080, help="Video height")
    parser.add_argument("--duration", type=int, default=1800, help="Duration in frames")
    parser.add_argument("--fps", type=int, default=30, help="Frames per second")
    parser.add_argument("--model", default="claude-opus-4-5-20251101", help="Claude model")

    args = parser.parse_args()

    # Load transcript
    transcript = args.transcript
    if os.path.exists(transcript):
        with open(transcript, encoding="utf-8") as f:
            transcript = f.read()

    # Load words if provided
    words = None
    if args.words_json and os.path.exists(args.words_json):
        with open(args.words_json, encoding="utf-8") as f:
            words = json.load(f)

    # Load style guide if provided
    style_guide = None
    if args.style_guide and os.path.exists(args.style_guide):
        with open(args.style_guide, encoding="utf-8") as f:
            style_guide = f.read().strip()

    # Create generator
    generator = ClaudeVisualGenerator(
        workspace=Path(args.workspace),
        project_id=args.project_id,
        bundle_output=Path(args.bundle_output),
        model=args.model,
    )

    # Generate using two-phase pipeline (Director + Animator)
    print("[ClaudeGenerator] Using two-phase pipeline (Director + Animator)")
    result = await generator.generate_two_phase(
        transcript=transcript,
        words=words,
        width=args.width,
        height=args.height,
        duration_frames=args.duration,
        fps=args.fps,
        style_preset=args.style_preset,
        layout_mode=args.layout_mode,
        style_guide=style_guide,
    )

    print(json.dumps(result, indent=2))
    sys.stdout.flush()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        import traceback
        print(f"FATAL ERROR: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        # Also print to stdout for worker to capture
        print(json.dumps({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }))
        sys.stdout.flush()
        sys.exit(1)
