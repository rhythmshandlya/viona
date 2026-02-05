#!/usr/bin/env python3
"""
OAuth Token Utilities for Server Deployment

This module provides utilities for managing Claude OAuth tokens in server environments.

Usage:
    # 1. Export tokens from local machine (after `claude /login`)
    python token_utils.py export > tokens.json

    # 2. Import tokens to server (save to DB or env var)
    python token_utils.py import tokens.json

    # 3. Test token validity
    python token_utils.py test

    # 4. Refresh tokens
    python token_utils.py refresh
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from claude_visual_generator import (
    OAuthTokenManager,
    OAuthTokens,
    FileTokenStorage,
    DatabaseTokenStorage,
    get_oauth_credentials,
)


def export_tokens() -> dict | None:
    """Export current tokens from local credential store."""
    creds = get_oauth_credentials()
    if not creds:
        print("No tokens found in local credential store.", file=sys.stderr)
        print("Run 'claude /login' first to authenticate.", file=sys.stderr)
        return None
    return creds


def import_tokens(tokens_dict: dict, output_path: str | None = None) -> bool:
    """Import tokens to credential file or print for DB storage."""
    if output_path:
        # Save to specified file
        storage = FileTokenStorage(output_path)
        tokens = OAuthTokens.from_dict(tokens_dict)
        storage.save(tokens)
        print(f"Tokens saved to {output_path}")
        return True
    else:
        # Print JSON for database storage
        print(json.dumps(tokens_dict, indent=2))
        return True


async def test_tokens() -> bool:
    """Test if current tokens are valid."""
    manager = OAuthTokenManager()
    try:
        token = await manager.get_valid_token()
        tokens = manager._tokens
        print(f"[OK] Token valid for {tokens.minutes_remaining} minutes")
        print(f"  Access token: {token[:30]}...")
        print(f"  Has refresh token: {tokens.refresh_token is not None}")
        print(f"  Subscription: {tokens.subscription_type}")
        return True
    except ValueError as e:
        print(f"[FAIL] Token invalid: {e}", file=sys.stderr)
        return False
    finally:
        await manager.close()


async def refresh_tokens() -> bool:
    """Force refresh tokens."""
    manager = OAuthTokenManager()
    manager.load_tokens()

    if not manager._tokens:
        print("No tokens to refresh.", file=sys.stderr)
        return False

    try:
        print(f"Current token expires in {manager._tokens.minutes_remaining} minutes")
        new_tokens = await manager.refresh_tokens()
        if new_tokens:
            print(f"[OK] Tokens refreshed! New expiry in {new_tokens.minutes_remaining} minutes")
            return True
        else:
            print("[FAIL] Refresh failed", file=sys.stderr)
            return False
    finally:
        await manager.close()


def create_env_config(tokens_dict: dict) -> str:
    """Create environment variable configuration for server."""
    return f"""# Claude OAuth Configuration
# Add to your server's environment variables or .env file

CLAUDE_OAUTH_ACCESS_TOKEN={tokens_dict['accessToken']}
CLAUDE_OAUTH_REFRESH_TOKEN={tokens_dict.get('refreshToken', '')}
CLAUDE_OAUTH_EXPIRES_AT={tokens_dict.get('expiresAt', 0)}

# For the visual generator, set this:
CLAUDE_CODE_OAUTH_TOKEN={tokens_dict['accessToken']}
"""


def main():
    parser = argparse.ArgumentParser(
        description="OAuth Token Utilities for Claude Visual Generator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Export tokens from local machine
  python token_utils.py export > tokens.json

  # Export as environment variables
  python token_utils.py export --format env > .env.claude

  # Test current tokens
  python token_utils.py test

  # Force refresh tokens
  python token_utils.py refresh

  # Import tokens from file
  python token_utils.py import tokens.json
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # Export command
    export_parser = subparsers.add_parser("export", help="Export tokens from local store")
    export_parser.add_argument(
        "--format",
        choices=["json", "env"],
        default="json",
        help="Output format (default: json)",
    )

    # Import command
    import_parser = subparsers.add_parser("import", help="Import tokens")
    import_parser.add_argument("file", help="JSON file with tokens")
    import_parser.add_argument("--output", "-o", help="Output credential file path")

    # Test command
    subparsers.add_parser("test", help="Test token validity")

    # Refresh command
    subparsers.add_parser("refresh", help="Force refresh tokens")

    args = parser.parse_args()

    if args.command == "export":
        tokens = export_tokens()
        if tokens:
            if args.format == "env":
                print(create_env_config(tokens))
            else:
                print(json.dumps(tokens, indent=2))

    elif args.command == "import":
        with open(args.file) as f:
            tokens = json.load(f)
        import_tokens(tokens, args.output)

    elif args.command == "test":
        success = asyncio.run(test_tokens())
        sys.exit(0 if success else 1)

    elif args.command == "refresh":
        success = asyncio.run(refresh_tokens())
        sys.exit(0 if success else 1)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
