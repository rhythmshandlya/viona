"""
MCP Server Registry Loader

Reads mcp-servers.json registry file and resolves template variables
to produce a Claude CLI --mcp-config compatible dict.

Template variable syntax:
  {name}     - Resolved from the `variables` dict passed to load/validate
  {env.VAR}  - Resolved from os.environ at runtime
"""

import json
import os
import re
from pathlib import Path
from typing import Any


_REGISTRY_PATH = Path(__file__).parent / "mcp-servers.json"

# Matches {varName} or {env.VAR_NAME} in template strings
_VAR_PATTERN = re.compile(r"\{([^}]+)\}")


def _resolve_template(template: str, variables: dict[str, str]) -> str:
    """Resolve all {name} and {env.VAR} placeholders in a template string."""

    def replacer(match: re.Match) -> str:
        key = match.group(1)
        if key.startswith("env."):
            env_name = key[4:]
            return os.environ.get(env_name, "")
        if key in variables:
            return variables[key]
        raise ValueError(
            f"Unknown template variable '{{{key}}}' in MCP registry. "
            f"Available variables: {list(variables.keys())}"
        )

    return _VAR_PATTERN.sub(replacer, template)


def _resolve_env(
    env_decls: dict[str, Any],
) -> dict[str, str]:
    """Resolve environment variable declarations to actual values from os.environ."""
    resolved: dict[str, str] = {}
    for name, decl in env_decls.items():
        value = os.environ.get(name, "")
        if not value and decl.get("isRequired"):
            raise EnvironmentError(
                f"Required environment variable '{name}' is not set. "
                f"This MCP server needs it to function."
            )
        resolved[name] = value
    return resolved


def load_mcp_registry(variables: dict[str, str]) -> dict[str, Any]:
    """Load the MCP server registry and resolve all template variables.

    Args:
        variables: Template variable bindings. Must include all non-env
                   variables declared in the registry (e.g. dist, workspace,
                   mcp-remote, better-icons).

    Returns:
        Dict compatible with Claude CLI --mcp-config format:
        {
            "server-name": {
                "type": "stdio",
                "command": "node",
                "args": ["/resolved/path", ...],
                "env": {"KEY": "value"}
            }
        }
    """
    registry = json.loads(_REGISTRY_PATH.read_text(encoding="utf-8"))
    servers = registry.get("servers", {})
    result: dict[str, Any] = {}

    for name, config in servers.items():
        resolved_args = [
            _resolve_template(arg, variables) for arg in config["args"]
        ]
        resolved_env = _resolve_env(config.get("env", {}))

        entry: dict[str, Any] = {
            "type": config["type"],
            "command": config["command"],
            "args": resolved_args,
        }
        if resolved_env:
            entry["env"] = resolved_env

        result[name] = entry

    return result


def validate_mcp_registry(variables: dict[str, str]) -> None:
    """Validate that all MCP server entry-points exist on disk.

    Call at worker startup with path variables only (no runtime vars
    like 'workspace'). Skips args that contain unresolved variables.

    Raises FileNotFoundError if a required file is missing.
    """
    registry = json.loads(_REGISTRY_PATH.read_text(encoding="utf-8"))
    servers = registry.get("servers", {})
    missing: list[str] = []

    for name, config in servers.items():
        for arg in config["args"]:
            # Skip args with unresolved variables (runtime-only like {workspace})
            try:
                resolved = _resolve_template(arg, variables)
            except ValueError:
                continue

            # Check if the resolved arg looks like a file path
            if resolved.endswith(".js") or resolved.endswith(".py"):
                if not Path(resolved).exists():
                    missing.append(f"  {name}: {resolved}")

    if missing:
        raise FileNotFoundError(
            "MCP server files missing — run `pnpm install && pnpm build:mcp-servers`:\n"
            + "\n".join(missing)
        )
