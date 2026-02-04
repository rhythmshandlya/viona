#!/usr/bin/env python3
"""Claude Code Authentication Setup"""

import json
import os
import subprocess
import sys
from pathlib import Path


def get_credential_paths() -> list[Path]:
    """Get possible credential file locations."""
    paths = []
    if sys.platform == "win32":
        paths.extend([
            Path(os.path.expandvars(r"%USERPROFILE%\.claude\.credentials.json")),
            Path(os.path.expandvars(r"%USERPROFILE%\.claude\credentials.json")),
        ])
    home = Path.home()
    paths.extend([
        home / ".claude" / ".credentials.json",
        home / ".claude" / "credentials.json",
    ])
    return paths


def get_existing_token() -> str | None:
    """Check for existing valid OAuth token."""
    env_token = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN", "")
    if env_token.startswith("sk-ant-oat01-"):
        return env_token

    for cred_path in get_credential_paths():
        if cred_path.exists():
            try:
                data = json.loads(cred_path.read_text())
                token = data.get("claudeAiOauth", {}).get("accessToken", "")
                if token.startswith("sk-ant-oat01-"):
                    return token
            except (json.JSONDecodeError, KeyError):
                continue
    return None


def launch_claude_login() -> bool:
    """Launch Claude CLI for interactive login."""
    print("\n" + "=" * 60)
    print("CLAUDE CODE AUTHENTICATION SETUP")
    print("=" * 60)
    print("\nNo valid OAuth token found.")
    print("\nThis will launch Claude Code CLI.")
    print("Once it starts, type: /login")
    print("Then complete OAuth in your browser.\n")
    print("Press Enter to continue (or Ctrl+C to cancel)...")

    try:
        input()
    except KeyboardInterrupt:
        print("\nCancelled.")
        return False

    try:
        result = subprocess.run(["claude"], shell=True)
        return result.returncode == 0
    except FileNotFoundError:
        print("\nError: Claude Code CLI not found.")
        return False


def main() -> int:
    token = get_existing_token()
    if token:
        print("✓ Valid OAuth token found")
        return 0

    if not launch_claude_login():
        return 1

    token = get_existing_token()
    if token:
        print("\n✓ Authentication successful!")
        return 0
    else:
        print("\n✗ Authentication failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())
