C:\Users\armaa\Documents\cllipify\packages\worker\src\agents\oauth.py"""OAuth token management for Claude Agent SDK authentication."""

import json
import os
import time
from dataclasses import dataclass
from typing import Callable

import httpx

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
    expires_at: int | None  # milliseconds timestamp (None = never expires)
    scopes: list[str] | None = None
    subscription_type: str | None = None

    @property
    def is_expired(self) -> bool:
        """Check if access token is expired."""
        if self.expires_at is None:
            return False
        return int(time.time() * 1000) >= self.expires_at

    @property
    def needs_refresh(self) -> bool:
        """Check if token should be refreshed (within buffer period)."""
        if self.expires_at is None:
            return False
        return int(time.time() * 1000) >= (self.expires_at - REFRESH_BUFFER_MS)

    @property
    def minutes_remaining(self) -> int:
        """Minutes until token expires."""
        if self.expires_at is None:
            return 999
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

    @staticmethod
    def _find_credential_path() -> str | None:
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


class EnvTokenStorage(TokenStorage):
    """Store tokens in environment variables (for Railway/server deployment)."""

    def load(self) -> OAuthTokens | None:
        """Load tokens from environment variables."""
        access_token = os.environ.get("CLAUDE_OAUTH_ACCESS_TOKEN")
        if not access_token:
            return None

        refresh_token = os.environ.get("CLAUDE_OAUTH_REFRESH_TOKEN")
        expires_at = os.environ.get("CLAUDE_OAUTH_EXPIRES_AT")

        return OAuthTokens(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=int(expires_at) if expires_at else None,
            scopes=None,
            subscription_type=os.environ.get("CLAUDE_SUBSCRIPTION_TYPE", "max"),
        )

    def save(self, tokens: OAuthTokens) -> None:
        """Cannot save to env vars, but store in memory for session."""
        os.environ["CLAUDE_OAUTH_ACCESS_TOKEN"] = tokens.access_token
        if tokens.refresh_token:
            os.environ["CLAUDE_OAUTH_REFRESH_TOKEN"] = tokens.refresh_token
        if tokens.expires_at:
            os.environ["CLAUDE_OAUTH_EXPIRES_AT"] = str(tokens.expires_at)
        print("[TokenStorage] Tokens updated in environment")


def _get_default_storage() -> TokenStorage:
    """Get the appropriate token storage based on environment."""
    if os.environ.get("CLAUDE_OAUTH_ACCESS_TOKEN"):
        print("[TokenStorage] Using environment variable tokens")
        return EnvTokenStorage()
    return FileTokenStorage()


class OAuthTokenManager:
    """
    Manages OAuth tokens with automatic refresh.

    Usage:
        manager = OAuthTokenManager()  # Auto-detects storage
        token = await manager.get_valid_token()
    """

    def __init__(self, storage: TokenStorage | None = None):
        self.storage = storage or _get_default_storage()
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
        """Refresh access token using refresh token."""
        if not self._tokens or not self._tokens.refresh_token:
            print("[OAuth] No refresh token available")
            return None

        print("[OAuth] Refreshing access token...")

        try:
            client = await self._get_http_client()

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

            print(f"[OAuth] Standard refresh failed ({response.status_code}), trying CLI refresh...")
            return await self._refresh_via_cli()

        except Exception as e:
            print(f"[OAuth] Refresh error: {e}")
            return await self._refresh_via_cli()

    async def _refresh_via_cli(self) -> OAuthTokens | None:
        """Fallback: trigger refresh via Claude CLI."""
        import subprocess

        try:
            result = subprocess.run(
                ["claude", "--version"],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode == 0:
                new_tokens = self.load_tokens()
                if new_tokens and not new_tokens.needs_refresh:
                    print(f"[OAuth] CLI refresh worked! Valid for {new_tokens.minutes_remaining} minutes")
                    return new_tokens

        except Exception as e:
            print(f"[OAuth] CLI refresh failed: {e}")

        return None

    async def get_valid_token(self) -> str:
        """Get a valid access token, refreshing if needed."""
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
                "  Set CLAUDE_OAUTH_ACCESS_TOKEN env var\n"
            )

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
