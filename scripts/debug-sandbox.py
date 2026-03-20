#!/usr/bin/env python3
"""
debug-sandbox.py — Interactive TUI dashboard + CLI for sandbox agent debugging.

Usage:
    python scripts/debug-sandbox.py <project-id>                  # Interactive TUI
    python scripts/debug-sandbox.py <project-id> --once           # One-shot snapshot
    python scripts/debug-sandbox.py <project-id> status           # Sandbox status
    python scripts/debug-sandbox.py <project-id> transcript       # Parsed session transcript
    python scripts/debug-sandbox.py <project-id> audit            # Pipeline & delegation audit
    python scripts/debug-sandbox.py <project-id> tools            # Tool usage analysis
    python scripts/debug-sandbox.py <project-id> scenes           # Scene source code
    python scripts/debug-sandbox.py <project-id> plan             # SCENE_PLAN.md
    python scripts/debug-sandbox.py <project-id> shared           # constants.ts + components
    python scripts/debug-sandbox.py <project-id> cost             # Per-turn cost breakdown
    python scripts/debug-sandbox.py <project-id> db               # Full DB state dump
    python scripts/debug-sandbox.py <project-id> logs [--lines N] # Formatted container logs
"""

import argparse
import json
import subprocess
import sys
import threading
import time
from collections import Counter, deque
from datetime import datetime
from typing import Any, Optional

import psycopg2
import psycopg2.extras
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.syntax import Syntax
from rich.tree import Tree

# ── Config ────────────────────────────────────────────────────────────────────

DB_DSN = "host=localhost user=viona password=viona123 dbname=viona"
POLL_INTERVAL = 3
LOG_LINES = 80

# Tools the orchestrator MUST NOT use directly (must delegate to subagents).
# Note: "Task" is how the orchestrator dispatches subagents — it's ALLOWED.
ORCHESTRATOR_DISALLOWED = {"Write", "Edit", "Bash", "NotebookEdit", "Skill", "TodoWrite"}

# Expected pipeline phases in order (matches orchestrator-system.md).
PIPELINE_PHASES = [
    "brief", "trimming", "planning", "setup",
    "layout", "generating", "reviewing", "assembling",
    "final-review", "complete",
]

# Subagent names expected for each phase (as dispatched via Task tool).
# Keys are phase names, values are the agent definition keys from the orchestrator.
PHASE_SUBAGENTS = {
    "trimming": "Trim Editor",
    "planning": "Planner",
    "setup": "Setup Agent",
    "layout": "Layout Editor",
    "generating": "Animator",
    "assembling": "Final Editor",
}

# User-friendly tool name mapping (mirrors TOOL_DISPLAY_NAMES in orchestrator.ts).
TOOL_DISPLAY_NAMES: dict[str, str] = {
    # Manifest tools
    "read_manifest": "Reading timeline",
    "add_track": "Adding track",
    "add_item": "Adding to timeline",
    "update_item": "Updating timeline",
    "delete_item": "Removing from timeline",
    "split_item": "Splitting clip",
    "move_item": "Moving clip",
    "update_track": "Updating track",
    "delete_track": "Removing track",
    # Scene tools
    "write_scene_file": "Generating animation",
    "delete_scene_file": "Removing animation",
    # Render tools
    "render_still": "Rendering preview",
    "trigger_rebuild": "Rebuilding project",
    "validate_workspace": "Validating workspace",
    # Analysis tools
    "analyze_transcript": "Analyzing transcript",
    "validate_timeline": "Validating timeline",
    # Asset tools
    "download_file": "Downloading asset",
    "search_unsplash": "Searching photos",
    "search_pexels": "Searching stock footage",
    "download_stock_photo": "Downloading stock photo",
    "get_speaker_grid": "Analyzing speakers",
    # Widget tools
    "show_widget": "Showing widget",
    "report_progress": "Reporting progress",
    "report_plan": "Reporting plan",
    # Built-in tools
    "Read": "Reading file",
    "Write": "Writing file",
    "Edit": "Editing file",
    "Glob": "Searching files",
    "Grep": "Searching code",
    "Bash": "Running command",
    "Task": "Dispatching agent",
}


def friendly_tool_name(raw_name: str) -> str:
    """Convert raw tool name (possibly mcp__server__tool) to user-friendly label."""
    if raw_name.startswith("mcp__"):
        parts = raw_name.split("__")
        short = "__".join(parts[2:]) if len(parts) >= 3 else raw_name
    else:
        short = raw_name
    return TOOL_DISPLAY_NAMES.get(short, short)

console = Console()

# Will be swapped to no-color console when --json is used
_json_mode = False


def jp(data: Any):
    """Print JSON to stdout (no rich formatting). Used when --json flag is set."""
    # Use a plain serializer that handles datetime and other types
    def _default(o):
        if isinstance(o, datetime):
            return o.isoformat()
        if hasattr(o, "__dict__"):
            return str(o)
        return str(o)
    print(json.dumps(data, indent=2, default=_default, ensure_ascii=False))


# ── Helpers ───────────────────────────────────────────────────────────────────

def run(cmd: str, timeout: int = 10) -> str:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
    return (r.stdout or "").strip()


def docker_exec(container: str, cmd: str, timeout: int = 10) -> str:
    r = subprocess.run(
        ["docker", "exec", container, "sh", "-c", cmd],
        capture_output=True, text=True, timeout=timeout,
    )
    return (r.stdout or "").strip()


def fetch_json(secret: str, port: str, path: str) -> dict:
    raw = run(f'curl -s -H "Authorization: Bearer {secret}" http://localhost:{port}{path}')
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {}


def get_db():
    try:
        conn = psycopg2.connect(DB_DSN)
        conn.autocommit = True
        return conn
    except Exception:
        return None


def resolve_container(project_id: str) -> tuple[str, str, str]:
    """Returns (container_name, sandbox_secret, agent_port)."""
    # Try by name first (legacy naming convention)
    container = f"sandbox-{project_id}"
    names = run("docker ps --format {{.Names}}")
    if container not in names.split("\n"):
        # Try by viona.projectId label
        container = run(f'docker ps -q --filter "label=viona.projectId={project_id}"').strip()
        if container:
            # Get the container name from the ID
            container = run(f"docker inspect {container} --format {{{{.Name}}}}").strip().lstrip("/")
        else:
            sandboxes = [n for n in names.split("\n") if "sandbox" in n.lower() or "viona" in n.lower()]
            console.print(f"[red]Container for project {project_id} not found.[/red]")
            if sandboxes:
                console.print("Running:", ", ".join(sandboxes))
            sys.exit(1)
    secret = docker_exec(container, "echo $SANDBOX_SECRET")
    agent_port = run(f"docker port {container} 8081").split(":")[-1].strip()
    return container, secret, agent_port


# ── Data Collectors ───────────────────────────────────────────────────────────

def collect_status(container: str, secret: str, port: str) -> dict:
    status = fetch_json(secret, port, "/status")
    manifest = fetch_json(secret, port, "/manifest")

    items = manifest.get("items") or []
    types: dict[str, int] = {}
    for i in items:
        t = i.get("type", "?")
        types[t] = types.get(t, 0) + 1

    # Try multiple known progress file locations
    progress = {}
    for progress_path in ["/workspace/docs/generation-progress.json", "/workspace/generation-progress.json"]:
        raw = docker_exec(container, f"cat {progress_path} 2>/dev/null")
        try:
            progress = json.loads(raw)
            if progress:
                break
        except (json.JSONDecodeError, TypeError):
            pass

    return {
        "status": status,
        "manifest": {
            "duration": f"{manifest.get('durationMs', 0) / 1000:.1f}s",
            "canvas": f"{(manifest.get('canvas') or {}).get('width')}x{(manifest.get('canvas') or {}).get('height')}",
            "tracks": len(manifest.get("tracks") or []),
            "items": len(items),
            "types": types,
        },
        "progress": progress,
    }


def collect_transcript(container: str, secret: str, port: str, session_id: str = "") -> list[dict]:
    """Parse the session JSONL transcript from the container."""
    if not session_id:
        status = fetch_json(secret, port, "/status")
        session_id = (status.get("result") or {}).get("sessionId", "")
    if not session_id:
        return []

    raw = docker_exec(
        container,
        f"cat /home/sandbox/.claude/projects/-workspace/{session_id}.jsonl 2>/dev/null",
        timeout=15,
    )
    entries = []
    for line in raw.split("\n"):
        if not line.strip():
            continue
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError:
            pass
    return entries


def collect_logs(container: str, lines: int = LOG_LINES) -> list[dict]:
    """Get recent container logs, parsed as JSON where possible."""
    raw = run(f"docker logs --tail {lines} {container} 2>&1", timeout=15)
    parsed = []
    for line in raw.split("\n"):
        if not line.strip():
            continue
        try:
            parsed.append(json.loads(line))
        except json.JSONDecodeError:
            parsed.append({"raw": line})
    return parsed


def collect_workspace_files(container: str) -> dict:
    raw = docker_exec(container, "find /workspace/src -type f 2>/dev/null | sort")
    files = sorted(f.replace("/workspace/src/", "") for f in raw.split("\n") if f.strip())
    scenes_raw = docker_exec(container, "ls /workspace/src/scenes/*.tsx 2>/dev/null | sort")
    scenes = [s.split("/")[-1] for s in scenes_raw.split("\n") if s.strip()]
    return {"files": files, "scenes": scenes}


def collect_scene_code(container: str) -> dict[str, str]:
    """Read all scene .tsx files."""
    scenes = {}
    listing = docker_exec(container, "ls /workspace/src/scenes/*.tsx 2>/dev/null")
    for path in listing.split("\n"):
        if not path.strip():
            continue
        name = path.split("/")[-1]
        code = docker_exec(container, f"cat {path}", timeout=15)
        scenes[name] = code
    return scenes


def collect_plan(container: str) -> str:
    # Try the docs subdirectory first (new layout), then root (legacy)
    for path in ["/workspace/docs/SCENE_PLAN.md", "/workspace/SCENE_PLAN.md"]:
        result = docker_exec(container, f"cat {path} 2>/dev/null", timeout=10)
        if result.strip():
            return result
    return ""


def collect_shared(container: str) -> dict[str, str]:
    result = {}
    result["constants.ts"] = docker_exec(container, "cat /workspace/src/constants.ts 2>/dev/null")
    comps_raw = docker_exec(container, "ls /workspace/src/components/*.tsx 2>/dev/null")
    for path in comps_raw.split("\n"):
        if not path.strip():
            continue
        name = path.split("/")[-1]
        result[f"components/{name}"] = docker_exec(container, f"cat {path}", timeout=10)
    return result


def collect_conversations(project_id: str) -> dict:
    conn = get_db()
    if not conn:
        return {"conversations": [], "messages": []}
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(
        "SELECT c.id, c.sdk_session_id, c.created_at, c.updated_at, "
        "(SELECT count(*) FROM conversation_messages cm WHERE cm.conversation_id = c.id) as msg_count "
        "FROM conversations c WHERE c.project_id = %s ORDER BY c.created_at DESC LIMIT 5",
        (project_id,),
    )
    convos = [dict(r) for r in cur.fetchall()]
    messages = []
    if convos:
        cur.execute(
            "SELECT id, role, content::text, created_at "
            "FROM conversation_messages WHERE conversation_id = %s ORDER BY created_at",
            (convos[0]["id"],),
        )
        messages = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    return {"conversations": convos, "messages": messages}


def collect_db_full(project_id: str) -> dict:
    """Full DB deep dive: project, sandbox sessions, conversations, messages."""
    conn = get_db()
    if not conn:
        return {}
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
        project = dict(cur.fetchone() or {})

        cur.execute(
            "SELECT * FROM sandbox_sessions WHERE project_id = %s ORDER BY created_at DESC LIMIT 3",
            (project_id,),
        )
        sessions = [dict(r) for r in cur.fetchall()]

        cur.execute(
            "SELECT * FROM jobs WHERE project_id = %s ORDER BY created_at DESC LIMIT 5",
            (project_id,),
        )
        jobs = [dict(r) for r in cur.fetchall()]

        cur.execute(
            "SELECT c.*, "
            "(SELECT count(*) FROM conversation_messages cm WHERE cm.conversation_id = c.id) as msg_count "
            "FROM conversations c WHERE c.project_id = %s ORDER BY c.created_at DESC LIMIT 5",
            (project_id,),
        )
        convos = [dict(r) for r in cur.fetchall()]

        all_messages = {}
        for conv in convos:
            cur.execute(
                "SELECT id, role, content::text, created_at "
                "FROM conversation_messages WHERE conversation_id = %s ORDER BY created_at",
                (conv["id"],),
            )
            all_messages[str(conv["id"])] = [dict(r) for r in cur.fetchall()]

        cur.close()
        conn.close()
        return {
            "project": project,
            "sandbox_sessions": sessions,
            "jobs": jobs,
            "conversations": convos,
            "messages": all_messages,
        }
    except Exception as e:
        try:
            conn.close()
        except Exception:
            pass
        return {"error": str(e)}


# ── Analysis ──────────────────────────────────────────────────────────────────

def analyze_tools(transcript: list[dict]) -> dict:
    """Analyze tool usage from transcript entries."""
    tool_counts: Counter = Counter()
    tool_timeline: list[dict] = []
    violations: list[dict] = []
    agent_dispatches: list[dict] = []
    turn = 0

    for entry in transcript:
        if entry.get("type") == "user":
            turn += 1
        if entry.get("type") != "assistant":
            continue
        content = (entry.get("message") or {}).get("content") or []
        parent_id = entry.get("parent_tool_use_id")
        is_orchestrator = parent_id is None

        for block in content:
            if block.get("type") != "tool_use":
                continue
            name = block.get("name", "")
            tool_counts[name] += 1
            tool_timeline.append({
                "turn": turn,
                "tool": name,
                "orchestrator": is_orchestrator,
                "input_preview": json.dumps(block.get("input", {}))[:200],
            })

            if is_orchestrator and name in ORCHESTRATOR_DISALLOWED:
                violations.append({
                    "turn": turn,
                    "tool": name,
                    "detail": f"Orchestrator used {name} directly (should delegate via Task)",
                    "input_preview": json.dumps(block.get("input", {}))[:150],
                })

            if name == "Task" and is_orchestrator:
                inp = block.get("input") or {}
                agent_dispatches.append({
                    "turn": turn,
                    "subagent": inp.get("subagent_type") or inp.get("description", "?"),
                    "prompt_preview": (inp.get("prompt") or "")[:200],
                })

    return {
        "tool_counts": dict(tool_counts.most_common()),
        "timeline": tool_timeline,
        "violations": violations,
        "agent_dispatches": agent_dispatches,
        "total_tools": sum(tool_counts.values()),
        "total_turns": turn,
    }


def audit_pipeline(transcript: list[dict], logs: list[dict]) -> list[dict]:
    """Auto-detect pipeline issues from transcript and logs."""
    issues: list[dict] = []
    tools = analyze_tools(transcript)

    # Check for disallowed tool usage
    for v in tools["violations"]:
        issues.append({
            "severity": "error",
            "message": f"Turn {v['turn']}: Orchestrator used {v['tool']} directly",
            "detail": v["input_preview"],
        })

    # Check which subagents were dispatched
    dispatched = {d["subagent"] for d in tools["agent_dispatches"]}
    dispatched_lower = {s.lower() for s in dispatched}
    for phase, expected_agent in PHASE_SUBAGENTS.items():
        if expected_agent in dispatched or expected_agent.lower() in dispatched_lower:
            issues.append({
                "severity": "ok",
                "message": f"Phase '{phase}' delegated to {expected_agent}",
            })
        else:
            issues.append({
                "severity": "warn",
                "message": f"Phase '{phase}' — {expected_agent} was NOT dispatched",
            })

    # Check for tool denials in logs
    for entry in logs:
        msg = entry.get("msg", "")
        if "permission" in msg.lower() and "denied" in msg.lower():
            issues.append({
                "severity": "info",
                "message": f"Tool denied: {msg[:120]}",
            })
        if entry.get("level", 0) >= 50:
            issues.append({
                "severity": "error",
                "message": f"Error: {msg[:120]}",
            })

    # Cost check
    status_cost = None
    for entry in logs:
        if "SDK result" in entry.get("msg", ""):
            status_cost = entry.get("totalCostUsd")
    if status_cost is not None:
        if status_cost > 1.0:
            issues.append({"severity": "warn", "message": f"High cost: ${status_cost:.4f}"})
        else:
            issues.append({"severity": "ok", "message": f"Total cost: ${status_cost:.4f}"})

    return issues


def cost_breakdown(transcript: list[dict]) -> list[dict]:
    """Extract per-turn cost from SDK result messages in transcript."""
    costs = []
    turn = 0
    for entry in transcript:
        if entry.get("type") == "user":
            turn += 1
        if entry.get("type") == "result":
            costs.append({
                "turn": turn,
                "cost": entry.get("total_cost_usd", 0),
                "turns_sdk": entry.get("num_turns", 0),
                "duration_ms": entry.get("duration_ms", 0),
                "stop_reason": entry.get("stop_reason", "?"),
            })
    return costs


# ── Formatters ────────────────────────────────────────────────────────────────

def format_log_entry(entry: dict) -> Text:
    """Format a single log entry for display."""
    if "raw" in entry:
        t = Text(entry["raw"][:150])
        if "error" in entry["raw"].lower():
            t.stylize("red")
        return t

    ts = datetime.fromtimestamp(entry.get("time", 0) / 1000).strftime("%H:%M:%S")
    name = entry.get("name", "?")
    msg = entry.get("msg", "")
    level = entry.get("level", 30)

    tag = "INF"
    style = "cyan"
    if level >= 50:
        tag, style = "ERR", "red"
    elif level >= 40:
        tag, style = "WRN", "yellow"

    text = Text()
    text.append(f"{ts} ", style="dim")
    text.append(f"{tag} ", style=style)
    text.append(f"{name} ", style="bold")
    text.append(msg[:100])

    if "Tool use" in msg and entry.get("tool"):
        raw_tool = entry['tool']
        friendly = friendly_tool_name(raw_tool)
        text.append(f" -> {friendly}", style="magenta")
        if friendly != raw_tool:
            text.append(f" ({raw_tool})", style="dim")
    elif "SDK result" in msg:
        text.append(f" cost=${entry.get('totalCostUsd', 0):.4f}", style="green")
        text.append(f" turns={entry.get('numTurns', '?')}", style="dim")
    elif "Bundle built" in msg:
        text.append(f" v{entry.get('version')} ({entry.get('elapsed')}ms)", style="green")

    return text


def format_transcript_entry(entry: dict, turn: list[int]) -> list[Text]:
    """Format a transcript entry into displayable lines. turn is a mutable counter [n]."""
    lines = []
    if entry.get("type") == "user":
        turn[0] += 1
        content = (entry.get("message") or {}).get("content") or []
        for block in content:
            if block.get("type") == "text":
                t = Text()
                t.append(f"\n[Turn {turn[0]}] USER: ", style="bold yellow")
                t.append(block["text"][:500])
                lines.append(t)
            elif block.get("type") == "tool_result":
                t = Text()
                t.append("  TOOL_RESULT: ", style="dim")
                t.append(json.dumps(block.get("content", ""))[:200], style="dim")
                lines.append(t)

    elif entry.get("type") == "assistant":
        content = (entry.get("message") or {}).get("content") or []
        parent_id = entry.get("parent_tool_use_id")
        prefix = "  " if parent_id else ""
        agent_label = "(subagent) " if parent_id else ""

        for block in content:
            if block.get("type") == "text" and block.get("text"):
                t = Text()
                t.append(f"{prefix}ASSISTANT {agent_label}: ", style="bold cyan")
                t.append(block["text"][:500])
                lines.append(t)
            elif block.get("type") == "tool_use":
                tool_name = block.get("name", "?")
                display_name = friendly_tool_name(tool_name)
                t = Text()
                t.append(f"{prefix}TOOL: ", style="magenta")
                t.append(display_name, style="bold magenta")
                if display_name != tool_name:
                    t.append(f" ({tool_name})", style="dim")

                inp = block.get("input") or {}
                if tool_name == "Task":
                    t.append(f" -> {inp.get('description') or inp.get('prompt', '?')[:80]}", style="green")
                elif tool_name in ("Write", "Edit", "Read"):
                    t.append(f" -> {inp.get('file_path', '?')}", style="dim")
                elif tool_name.startswith("mcp__"):
                    # Show minimal info for MCP tools
                    t.append(f" -> {json.dumps(inp)[:100]}", style="dim")
                else:
                    t.append(f" -> {json.dumps(inp)[:150]}", style="dim")

                # Flag violations
                is_orch = parent_id is None
                if is_orch and tool_name in ORCHESTRATOR_DISALLOWED:
                    t.append(f"  !! VIOLATION", style="bold red")
                lines.append(t)

            elif block.get("type") == "thinking" and block.get("thinking"):
                t = Text()
                t.append(f"{prefix}THINKING: ", style="dim italic")
                t.append(block["thinking"][:300], style="dim")
                lines.append(t)

    elif entry.get("type") == "result":
        t = Text()
        t.append("\n--- SDK RESULT --- ", style="bold green")
        t.append(f"cost=${entry.get('total_cost_usd', 0):.4f} ", style="green")
        t.append(f"turns={entry.get('num_turns', '?')} ", style="dim")
        t.append(f"stop={entry.get('stop_reason', '?')}", style="dim")
        lines.append(t)

    return lines


def format_audit_issue(issue: dict) -> Text:
    t = Text()
    sev = issue["severity"]
    if sev == "error":
        t.append(" !! ", style="bold red")
    elif sev == "warn":
        t.append(" ?  ", style="bold yellow")
    elif sev == "ok":
        t.append(" ok ", style="bold green")
    else:
        t.append(" i  ", style="bold blue")
    t.append(issue["message"])
    if issue.get("detail"):
        t.append(f"\n     {issue['detail']}", style="dim")
    return t


def format_message_block(msg: dict) -> list[Text]:
    """Format a DB conversation message for display."""
    lines = []
    role = msg["role"]
    try:
        blocks = json.loads(msg["content"])
    except (json.JSONDecodeError, TypeError):
        t = Text()
        t.append(f"[{role.upper()}] ", style="bold yellow" if role == "user" else "bold cyan")
        t.append(str(msg.get("content", ""))[:200])
        return [t]

    for b in blocks:
        if b.get("type") == "text":
            t = Text()
            t.append(f"[{role.upper()}] ", style="bold yellow" if role == "user" else "bold cyan")
            text = b["text"]
            if len(text) > 400:
                text = text[:400] + "..."
            t.append(text)
            lines.append(t)
        elif b.get("type") == "widget":
            w = b.get("widget") or {}
            t = Text()
            t.append(f"  [WIDGET: {w.get('kind')} — {w.get('id', '?')}]", style="magenta")
            lines.append(t)
            for q in w.get("questions") or []:
                opts = ", ".join(o.get("label", "") for o in q.get("options") or [])
                t2 = Text()
                t2.append(f"    Q: {q.get('question')}  [{opts}]", style="dim")
                lines.append(t2)
            if w.get("scenes"):
                t2 = Text()
                t2.append(f"    Scenes: {len(w['scenes'])}", style="dim")
                lines.append(t2)
        elif b.get("type") == "plan":
            t = Text()
            t.append(f"  [PLAN]", style="green")
            plan = b.get("plan") or {}
            if plan.get("phases"):
                t.append(f" {len(plan['phases'])} phases", style="dim")
            lines.append(t)
        else:
            t = Text()
            t.append(f"  [{b.get('type', '?')}]", style="dim")
            lines.append(t)
    return lines


# ── CLI Subcommands ───────────────────────────────────────────────────────────

def cmd_status(args):
    container, secret, port = resolve_container(args.project_id)
    data = collect_status(container, secret, port)

    if args.json:
        jp(data)
        return

    s = data["status"]
    result = s.get("result") or {}
    prog = data["progress"]
    ms = data["manifest"]

    t = Table(title="Sandbox Status", show_header=False, box=None, padding=(0, 2))
    t.add_column("key", style="dim", width=16)
    t.add_column("val")
    t.add_row("Busy", "[red]YES[/red]" if s.get("busy") else "[green]no[/green]")
    t.add_row("Cost", f"[green]${result.get('cost', 0):.4f}[/green]")
    t.add_row("Turns", str(result.get("numTurns", "-")))
    t.add_row("Session", (result.get("sessionId") or "-")[:24])
    t.add_row("Bundle", f"v{s.get('bundleVersion', '?')}")
    t.add_row("Error", f"[red]{s.get('error')}[/red]" if s.get("error") else "[green]none[/green]")
    t.add_row("Phase", prog.get("phase", "-"))
    if prog.get("totalScenes"):
        done = len(prog.get("completedScenes") or [])
        t.add_row("Scenes", f"{done}/{prog['totalScenes']}")
    t.add_row("Duration", ms.get("duration", "-"))
    t.add_row("Canvas", ms.get("canvas", "-"))
    t.add_row("Items", f"{ms.get('items', 0)} ({json.dumps(ms.get('types', {}))})")

    tasks = [tk for tk in (s.get("activeTasks") or []) if tk.get("status") == "active"]
    for tk in tasks:
        t.add_row("[magenta]Task[/magenta]", f"{tk.get('agent')}: {tk.get('action')}")

    console.print(t)


def cmd_transcript(args):
    container, secret, port = resolve_container(args.project_id)
    entries = collect_transcript(container, secret, port, getattr(args, "session_id", ""))
    if not entries:
        if args.json:
            jp({"entries": [], "error": "no transcript found"})
        else:
            console.print("[yellow]No transcript found (no active session?)[/yellow]")
        return

    if args.json:
        # Structured plain-text transcript for Claude to read
        turn = 0
        out: list[dict] = []
        for entry in entries:
            etype = entry.get("type")
            if etype == "user":
                turn += 1
                content = (entry.get("message") or {}).get("content") or []
                for block in content:
                    if block.get("type") == "text":
                        out.append({"turn": turn, "role": "user", "text": block["text"]})
                    elif block.get("type") == "tool_result":
                        out.append({"turn": turn, "role": "tool_result", "content": str(block.get("content", ""))[:300]})
            elif etype == "assistant":
                content = (entry.get("message") or {}).get("content") or []
                parent_id = entry.get("parent_tool_use_id")
                is_orch = parent_id is None
                for block in content:
                    if block.get("type") == "text" and block.get("text"):
                        out.append({"turn": turn, "role": "assistant", "orchestrator": is_orch, "text": block["text"]})
                    elif block.get("type") == "tool_use":
                        name = block.get("name", "?")
                        inp = block.get("input") or {}
                        violation = is_orch and name in ORCHESTRATOR_DISALLOWED
                        rec = {"turn": turn, "role": "tool_use", "tool": name, "orchestrator": is_orch, "violation": violation}
                        if name == "Task":
                            rec["subagent"] = inp.get("description") or "?"
                            rec["prompt_preview"] = (inp.get("prompt") or "")[:300]
                        elif name in ("Write", "Edit", "Read"):
                            rec["file"] = inp.get("file_path", "?")
                        else:
                            rec["input_preview"] = json.dumps(inp)[:200]
                        out.append(rec)
                    elif block.get("type") == "thinking" and block.get("thinking"):
                        out.append({"turn": turn, "role": "thinking", "orchestrator": is_orch, "text": block["thinking"][:500]})
            elif etype == "result":
                out.append({"turn": turn, "role": "sdk_result", "cost": entry.get("total_cost_usd", 0),
                            "turns": entry.get("num_turns", 0), "stop_reason": entry.get("stop_reason", "?")})
        jp({"total_entries": len(entries), "total_turns": turn, "entries": out})
        return

    console.print(f"[dim]Transcript: {len(entries)} entries[/dim]\n")
    turn = [0]
    for entry in entries:
        for line in format_transcript_entry(entry, turn):
            console.print(line)


def cmd_audit(args):
    container, secret, port = resolve_container(args.project_id)
    transcript = collect_transcript(container, secret, port)
    logs = collect_logs(container)
    issues = audit_pipeline(transcript, logs)

    if args.json:
        errors = sum(1 for i in issues if i["severity"] == "error")
        warns = sum(1 for i in issues if i["severity"] == "warn")
        jp({"issues": issues, "summary": {"errors": errors, "warnings": warns, "total": len(issues)}})
        return

    console.print(Panel("[bold]Pipeline Audit[/bold]", border_style="red"))
    for issue in issues:
        console.print(format_audit_issue(issue))

    errors = sum(1 for i in issues if i["severity"] == "error")
    warns = sum(1 for i in issues if i["severity"] == "warn")
    console.print(f"\n[dim]Summary: {errors} errors, {warns} warnings, {len(issues)} total checks[/dim]")


def cmd_tools(args):
    container, secret, port = resolve_container(args.project_id)
    transcript = collect_transcript(container, secret, port)
    if not transcript:
        if args.json:
            jp({"error": "no transcript found"})
        else:
            console.print("[yellow]No transcript found[/yellow]")
        return
    tools = analyze_tools(transcript)

    if args.json:
        jp(tools)
        return

    # Tool counts table
    t = Table(title="Tool Usage", show_header=True)
    t.add_column("Tool", style="bold")
    t.add_column("Friendly Name", style="cyan")
    t.add_column("Count", justify="right")
    t.add_column("Flags")
    for name, count in tools["tool_counts"].items():
        flag = "[red]!! DISALLOWED[/red]" if name in ORCHESTRATOR_DISALLOWED else ""
        friendly = friendly_tool_name(name)
        t.add_row(name, friendly if friendly != name else "", str(count), flag)
    t.add_row("[dim]Total[/dim]", "", f"[dim]{tools['total_tools']}[/dim]", "")
    console.print(t)

    # Agent dispatches
    if tools["agent_dispatches"]:
        console.print("\n[bold]Agent Dispatches:[/bold]")
        for d in tools["agent_dispatches"]:
            console.print(f"  Turn {d['turn']}: [green]{d['subagent']}[/green]")
            console.print(f"    {d['prompt_preview'][:150]}", style="dim")

    # Violations
    if tools["violations"]:
        console.print(f"\n[bold red]Violations ({len(tools['violations'])}):[/bold red]")
        for v in tools["violations"]:
            console.print(f"  Turn {v['turn']}: [red]{v['detail']}[/red]")
    else:
        console.print("\n[green]No violations detected.[/green]")


def cmd_scenes(args):
    container, _, _ = resolve_container(args.project_id)
    scenes = collect_scene_code(container)
    if not scenes:
        if args.json:
            jp({"scenes": {}})
        else:
            console.print("[yellow]No scene files yet[/yellow]")
        return

    if args.json:
        jp({"scenes": scenes})
        return

    for name, code in scenes.items():
        console.print(Panel(
            Syntax(code, "tsx", theme="monokai", line_numbers=True),
            title=f"[bold]{name}[/bold]",
            border_style="green",
        ))


def cmd_plan(args):
    container, _, _ = resolve_container(args.project_id)
    plan = collect_plan(container)
    if not plan:
        if args.json:
            jp({"plan": None})
        else:
            console.print("[yellow]No SCENE_PLAN.md found[/yellow]")
        return

    if args.json:
        jp({"plan": plan})
        return

    console.print(Panel(plan, title="[bold]SCENE_PLAN.md[/bold]", border_style="blue"))


def cmd_shared(args):
    container, _, _ = resolve_container(args.project_id)
    shared = collect_shared(container)
    if not shared:
        if args.json:
            jp({"files": {}})
        else:
            console.print("[yellow]No shared files found[/yellow]")
        return

    if args.json:
        jp({"files": {k: v for k, v in shared.items() if v}})
        return

    for name, code in shared.items():
        if not code:
            continue
        lang = "typescript" if name.endswith(".ts") else "tsx"
        console.print(Panel(
            Syntax(code, lang, theme="monokai", line_numbers=True),
            title=f"[bold]{name}[/bold]",
            border_style="cyan",
        ))


def cmd_cost(args):
    container, secret, port = resolve_container(args.project_id)
    transcript = collect_transcript(container, secret, port)
    costs = cost_breakdown(transcript)
    if not costs:
        status = fetch_json(secret, port, "/status")
        result = status.get("result") or {}
        if args.json:
            jp({"total_cost": result.get("cost", 0), "turns": result.get("numTurns", 0), "breakdown": []})
        else:
            console.print(f"Total cost: [green]${result.get('cost', 0):.4f}[/green]")
            console.print(f"Turns: {result.get('numTurns', '?')}")
        return

    if args.json:
        total = sum(c["cost"] for c in costs)
        jp({"total_cost": total, "breakdown": costs})
        return

    t = Table(title="Cost Breakdown", show_header=True)
    t.add_column("Turn", justify="right")
    t.add_column("Cost", justify="right", style="green")
    t.add_column("SDK Turns", justify="right")
    t.add_column("Duration", justify="right")
    t.add_column("Stop Reason")
    total = 0
    for c in costs:
        total += c["cost"]
        dur = f"{c['duration_ms'] / 1000:.1f}s" if c["duration_ms"] else "?"
        t.add_row(str(c["turn"]), f"${c['cost']:.4f}", str(c["turns_sdk"]), dur, c["stop_reason"])
    t.add_row("[bold]Total[/bold]", f"[bold]${total:.4f}[/bold]", "", "", "")
    console.print(t)


def cmd_db(args):
    data = collect_db_full(args.project_id)
    if not data:
        if args.json:
            jp({"error": "could not connect to DB"})
        else:
            console.print("[red]Could not connect to DB[/red]")
        return

    if args.json:
        jp(data)
        return

    # Project
    p = data.get("project") or {}
    if p:
        t = Table(title="Project", show_header=False, box=None, padding=(0, 2))
        t.add_column("key", style="dim", width=20)
        t.add_column("val")
        for key in ["id", "title", "status", "project_type", "workspace_status", "description"]:
            if p.get(key) is not None:
                val = str(p[key])
                if len(val) > 100:
                    val = val[:100] + "..."
                t.add_row(key, val)
        console.print(t)

    # Sandbox sessions
    sessions = data.get("sandbox_sessions") or []
    if sessions:
        console.print("\n[bold]Sandbox Sessions:[/bold]")
        for s in sessions:
            console.print(f"  {s['id'][:12]}  status=[bold]{s['status']}[/bold]  "
                          f"provider={s.get('provider')}  created={s.get('created_at')}")

    # Jobs
    jobs = data.get("jobs") or []
    if jobs:
        console.print("\n[bold]Jobs:[/bold]")
        for j in jobs:
            metrics = j.get("metrics") or {}
            cost = metrics.get("estimatedCostUsd", 0)
            console.print(f"  {j['id'][:12]}  type={j['type']}  status=[bold]{j['status']}[/bold]  "
                          f"progress={j.get('progress')}%  cost=${cost:.4f}")

    # Conversations with messages
    for conv in data.get("conversations") or []:
        conv_id = str(conv["id"])
        console.print(f"\n[bold]Conversation {conv_id[:12]}[/bold]  "
                      f"msgs={conv.get('msg_count', 0)}  sdk={conv.get('sdk_session_id', '-')}")
        for msg in data.get("messages", {}).get(conv_id, []):
            for line in format_message_block(msg):
                console.print(f"  ", end="")
                console.print(line)


def cmd_logs(args):
    container, _, _ = resolve_container(args.project_id)
    lines = getattr(args, "lines", LOG_LINES)
    logs = collect_logs(container, lines)

    if args.json:
        jp({"logs": logs})
        return

    for entry in logs:
        console.print(format_log_entry(entry))


def cmd_once(args):
    """Quick one-shot snapshot of everything."""
    container, secret, port = resolve_container(args.project_id)
    data = collect_status(container, secret, port)
    s = data["status"]
    result = s.get("result") or {}
    prog = data["progress"]

    console.print(Panel(
        f"Busy: {'[red]YES[/red]' if s.get('busy') else '[green]no[/green]'}  "
        f"Cost: [green]${result.get('cost', 0):.4f}[/green]  "
        f"Turns: {result.get('numTurns', '-')}  "
        f"Phase: {prog.get('phase', '-')}  "
        f"Bundle: v{s.get('bundleVersion', '?')}",
        title="[bold]Status[/bold]",
    ))

    files = collect_workspace_files(container)
    console.print(f"[dim]Files: {len(files['files'])}  Scenes: {', '.join(files['scenes']) or 'none'}[/dim]")

    conv_data = collect_conversations(args.project_id)
    if conv_data["messages"]:
        console.print(f"\n[bold]Conversation ({len(conv_data['messages'])} messages):[/bold]")
        for msg in conv_data["messages"][-6:]:
            for line in format_message_block(msg):
                console.print(f"  ", end="")
                console.print(line)


# ── TUI Dashboard (textual) ──────────────────────────────────────────────────

try:
    from textual.app import App, ComposeResult
    from textual.binding import Binding
    from textual.containers import Horizontal, Vertical, Container
    from textual.screen import Screen
    from textual.widgets import Header, Footer, RichLog, Static
    HAS_TEXTUAL = True
except ImportError:
    HAS_TEXTUAL = False

if HAS_TEXTUAL:

    class PanelLog(RichLog):
        """A RichLog with a visible border and title."""
        def __init__(self, panel_title: str, **kwargs):
            super().__init__(**kwargs)
            self.border_title = panel_title

    class FullscreenView(Screen):
        """Fullscreen view of a single panel's content."""
        BINDINGS = [("escape", "app.pop_screen", "Back")]

        def __init__(self, title: str, content_lines: list):
            super().__init__()
            self._title = title
            self._content = content_lines

        def compose(self) -> ComposeResult:
            yield Header()
            yield PanelLog(self._title, id="fs-log", auto_scroll=False, wrap=True)
            yield Footer()

        def on_mount(self):
            log = self.query_one("#fs-log", RichLog)
            for line in self._content:
                log.write(line)

    class TranscriptView(Screen):
        """Full transcript viewer."""
        BINDINGS = [("escape", "app.pop_screen", "Back")]

        def __init__(self, container: str, secret: str, port: str):
            super().__init__()
            self._container = container
            self._secret = secret
            self._port = port

        def compose(self) -> ComposeResult:
            yield Header()
            yield PanelLog("Transcript", id="ts-log", auto_scroll=False, wrap=True)
            yield Footer()

        def on_mount(self):
            self.run_worker(self._load, thread=True)

        def _load(self):
            entries = collect_transcript(self._container, self._secret, self._port)
            log = self.query_one("#ts-log", RichLog)
            if not entries:
                self.app.call_from_thread(log.write, Text("No transcript found", style="yellow"))
                return
            turn = [0]
            for entry in entries:
                for line in format_transcript_entry(entry, turn):
                    self.app.call_from_thread(log.write, line)

    class SceneView(Screen):
        """Scene code viewer."""
        BINDINGS = [("escape", "app.pop_screen", "Back")]

        def __init__(self, container: str):
            super().__init__()
            self._container = container

        def compose(self) -> ComposeResult:
            yield Header()
            yield PanelLog("Scenes", id="sc-log", auto_scroll=False, wrap=True)
            yield Footer()

        def on_mount(self):
            self.run_worker(self._load, thread=True)

        def _load(self):
            scenes = collect_scene_code(self._container)
            log = self.query_one("#sc-log", RichLog)
            if not scenes:
                self.app.call_from_thread(log.write, Text("No scene files yet", style="yellow"))
                return
            for name, code in scenes.items():
                self.app.call_from_thread(log.write, Text(f"\n=== {name} ===", style="bold green"))
                self.app.call_from_thread(log.write, Syntax(code, "tsx", theme="monokai", line_numbers=True))

    class PlanView(Screen):
        """SCENE_PLAN.md viewer."""
        BINDINGS = [("escape", "app.pop_screen", "Back")]

        def __init__(self, container: str):
            super().__init__()
            self._container = container

        def compose(self) -> ComposeResult:
            yield Header()
            yield PanelLog("SCENE_PLAN.md", id="pl-log", auto_scroll=False, wrap=True)
            yield Footer()

        def on_mount(self):
            plan = collect_plan(self._container)
            log = self.query_one("#pl-log", RichLog)
            if plan:
                log.write(Text(plan))
            else:
                log.write(Text("No SCENE_PLAN.md found", style="yellow"))

    class SandboxDashboard(App):
        """Interactive sandbox monitoring dashboard."""

        CSS = """
        Screen {
            background: $surface;
        }
        #top-row { height: 1fr; }
        #mid-row { height: 2fr; }
        #bot-row { height: 1fr; }
        #left-col { width: 2fr; }
        #right-col { width: 3fr; }

        PanelLog {
            border: solid $primary;
            scrollbar-size: 1 1;
            margin: 0 0;
            padding: 0 1;
        }
        PanelLog:focus {
            border: double $accent;
        }
        """

        BINDINGS = [
            Binding("q", "quit", "Quit"),
            Binding("f", "fullscreen", "Fullscreen"),
            Binding("t", "view_transcript", "Transcript"),
            Binding("s", "view_scenes", "Scenes"),
            Binding("p", "view_plan", "Plan"),
            Binding("a", "view_audit", "Audit Details"),
            Binding("r", "force_refresh", "Refresh"),
            Binding("tab", "focus_next", "Next", show=False),
            Binding("shift+tab", "focus_previous", "Prev", show=False),
        ]

        TITLE = "Sandbox Monitor"

        def __init__(self, project_id: str, container: str, secret: str, agent_port: str):
            super().__init__()
            self.project_id = project_id
            self.container = container
            self.secret = secret
            self.agent_port = agent_port
            self._panel_content: dict[str, list] = {
                "status": [], "logs": [], "conversation": [],
                "audit": [], "workspace": [], "events": [],
            }
            self._log_seen = 0
            self._msg_seen = 0

        def compose(self) -> ComposeResult:
            yield Header()
            with Horizontal(id="top-row"):
                with Vertical(id="left-col"):
                    yield PanelLog("Status", id="status", auto_scroll=False, wrap=True)
                with Vertical(id="right-col"):
                    yield PanelLog("Logs", id="logs", auto_scroll=True, wrap=True, max_lines=500)
            with Horizontal(id="mid-row"):
                with Vertical(id="left-col"):
                    yield PanelLog("Conversation", id="conversation", auto_scroll=True, wrap=True)
                with Vertical(id="right-col"):
                    yield PanelLog("Audit", id="audit", auto_scroll=False, wrap=True)
            with Horizontal(id="bot-row"):
                with Vertical(id="left-col"):
                    yield PanelLog("Workspace", id="workspace", auto_scroll=False, wrap=True)
                with Vertical(id="right-col"):
                    yield PanelLog("Events", id="events", auto_scroll=True, wrap=True, max_lines=300)
            yield Footer()

        def on_mount(self):
            self.sub_title = f"{self.project_id[:12]}..."
            self.set_interval(POLL_INTERVAL, self._poll_all)
            # Initial load
            self._poll_all()

        def _poll_all(self):
            self.run_worker(self._refresh_status, thread=True, exclusive=True, group="status")
            self.run_worker(self._refresh_logs, thread=True, exclusive=True, group="logs")
            self.run_worker(self._refresh_conversation, thread=True, exclusive=True, group="conv")
            self.run_worker(self._refresh_workspace, thread=True, exclusive=True, group="files")

        def _refresh_status(self):
            try:
                data = collect_status(self.container, self.secret, self.agent_port)
                s = data["status"]
                result = s.get("result") or {}
                prog = data["progress"]
                ms = data["manifest"]

                lines = []
                busy = s.get("busy", False)
                lines.append(Text.from_markup(
                    f"Busy: {'[red bold]YES[/]' if busy else '[green]no[/]'}  "
                    f"Cost: [green]${result.get('cost', 0):.4f}[/]  "
                    f"Turns: {result.get('numTurns', '-')}"
                ))
                lines.append(Text.from_markup(
                    f"Session: {(result.get('sessionId') or '-')[:20]}  "
                    f"Bundle: v{s.get('bundleVersion', '?')}"
                ))
                error = s.get("error")
                if error:
                    lines.append(Text(f"Error: {error}", style="bold red"))

                phase = prog.get("phase", "-")
                lines.append(Text.from_markup(f"Phase: [yellow]{phase}[/]"))
                if prog.get("totalScenes"):
                    done = len(prog.get("completedScenes") or [])
                    lines.append(Text(f"Scenes: {done}/{prog['totalScenes']}"))

                lines.append(Text.from_markup(
                    f"Canvas: {ms.get('canvas', '-')}  "
                    f"Items: {ms.get('items', 0)}  "
                    f"Duration: {ms.get('duration', '-')}"
                ))

                tasks = [tk for tk in (s.get("activeTasks") or []) if tk.get("status") == "active"]
                for tk in tasks:
                    lines.append(Text.from_markup(
                        f"[magenta]Task:[/] {tk.get('agent')}: {tk.get('action')}"
                    ))

                self._panel_content["status"] = lines
                log = self.query_one("#status", RichLog)
                self.app.call_from_thread(log.clear)
                for line in lines:
                    self.app.call_from_thread(log.write, line)
            except Exception:
                pass

        def _refresh_logs(self):
            try:
                raw_logs = collect_logs(self.container, 100)
                # Only show new logs since last poll
                new_logs = raw_logs[self._log_seen:]
                self._log_seen = len(raw_logs)

                log_widget = self.query_one("#logs", RichLog)
                event_widget = self.query_one("#events", RichLog)

                new_content = []
                new_events = []

                for entry in new_logs:
                    msg = entry.get("msg", entry.get("raw", ""))
                    if any(k in msg for k in (
                        "Tool use", "Tool result", "SDK result", "Session established",
                        "Bundle built", "failed", "error", "Error", "Orchestrator", "Starting",
                        "Resuming", "Long-running", "SSE client", "Workspace init",
                        "asset", "scene", "manifest", "permission", "denied",
                    )):
                        formatted = format_log_entry(entry)
                        new_content.append(formatted)

                        # Events panel
                        ts = datetime.fromtimestamp(entry.get("time", 0) / 1000).strftime("%H:%M:%S")
                        if "Tool use" in msg and entry.get("tool"):
                            tool = entry["tool"]
                            display = friendly_tool_name(tool)
                            style = "bold red" if tool in ORCHESTRATOR_DISALLOWED else "magenta"
                            new_events.append(Text.from_markup(f"{ts} [magenta]TOOL[/] [{style}]{display}[/]"))
                        elif "SDK result" in msg:
                            new_events.append(Text.from_markup(
                                f"{ts} [green]DONE[/] cost=${entry.get('totalCostUsd', 0):.4f}"
                            ))
                        elif "Session established" in msg:
                            new_events.append(Text.from_markup(
                                f"{ts} [green]SESSION[/] {entry.get('sessionId', '')[:16]}"
                            ))
                        elif "Bundle built" in msg:
                            new_events.append(Text.from_markup(
                                f"{ts} [green]BUILD[/] v{entry.get('version')}"
                            ))
                        elif "denied" in msg.lower() or "permission" in msg.lower():
                            new_events.append(Text.from_markup(f"{ts} [red]DENIED[/] {msg[:60]}"))

                self._panel_content["logs"].extend(new_content)
                self._panel_content["events"].extend(new_events)

                for line in new_content:
                    self.app.call_from_thread(log_widget.write, line)
                for line in new_events:
                    self.app.call_from_thread(event_widget.write, line)
            except Exception:
                pass

        def _refresh_conversation(self):
            try:
                conv_data = collect_conversations(self.project_id)
                messages = conv_data.get("messages") or []
                if len(messages) == self._msg_seen:
                    return
                self._msg_seen = len(messages)

                lines = []
                convos = conv_data.get("conversations") or []
                if convos:
                    lines.append(Text.from_markup(
                        f"[dim]Messages: {convos[0].get('msg_count', 0)}  "
                        f"SDK: {(convos[0].get('sdk_session_id') or '-')[:16]}[/]"
                    ))

                for msg in messages:
                    for line in format_message_block(msg):
                        lines.append(line)
                    lines.append(Text(""))

                self._panel_content["conversation"] = lines
                log = self.query_one("#conversation", RichLog)
                self.app.call_from_thread(log.clear)
                for line in lines:
                    self.app.call_from_thread(log.write, line)
            except Exception:
                pass

        def _refresh_workspace(self):
            try:
                ws = collect_workspace_files(self.container)
                lines = []
                if ws["scenes"]:
                    lines.append(Text.from_markup(
                        f"[bold]Scenes:[/] {', '.join(ws['scenes'])}"
                    ))
                else:
                    lines.append(Text("Scenes: none yet", style="dim"))
                lines.append(Text(f"Total: {len(ws['files'])} files", style="dim"))
                for f in ws["files"][-15:]:
                    lines.append(Text(f"  {f}", style="dim"))

                # Also run a quick audit
                try:
                    transcript = collect_transcript(self.container, self.secret, self.agent_port)
                    logs = collect_logs(self.container, 50)
                    issues = audit_pipeline(transcript, logs)
                    audit_lines = []
                    for issue in issues:
                        audit_lines.append(format_audit_issue(issue))
                    self._panel_content["audit"] = audit_lines
                    audit_log = self.query_one("#audit", RichLog)
                    self.app.call_from_thread(audit_log.clear)
                    for line in audit_lines:
                        self.app.call_from_thread(audit_log.write, line)
                except Exception:
                    pass

                self._panel_content["workspace"] = lines
                log = self.query_one("#workspace", RichLog)
                self.app.call_from_thread(log.clear)
                for line in lines:
                    self.app.call_from_thread(log.write, line)
            except Exception:
                pass

        # ── Actions ──

        def action_fullscreen(self):
            """Show the focused panel fullscreen."""
            focused = self.focused
            if not focused or not isinstance(focused, PanelLog):
                return
            panel_id = focused.id or ""
            content = self._panel_content.get(panel_id, [])
            title = focused.border_title or panel_id
            self.push_screen(FullscreenView(title, content))

        def action_view_transcript(self):
            self.push_screen(TranscriptView(self.container, self.secret, self.agent_port))

        def action_view_scenes(self):
            self.push_screen(SceneView(self.container))

        def action_view_plan(self):
            self.push_screen(PlanView(self.container))

        def action_view_audit(self):
            """Show detailed audit fullscreen."""
            content = self._panel_content.get("audit", [])
            self.push_screen(FullscreenView("Audit Details", content))

        def action_force_refresh(self):
            self._log_seen = 0
            self._msg_seen = 0
            for panel_id in ("status", "logs", "conversation", "audit", "workspace", "events"):
                try:
                    log = self.query_one(f"#{panel_id}", RichLog)
                    log.clear()
                except Exception:
                    pass
            self._poll_all()


# ── Entry Point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Sandbox agent debugging dashboard & CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("project_id", help="Project UUID")
    parser.add_argument("--json", action="store_true", help="Output JSON (for programmatic/Claude use)")
    parser.add_argument("--once", action="store_true", help="One-shot snapshot (no TUI)")

    sub = parser.add_subparsers(dest="command")

    sub.add_parser("status", help="Sandbox status, manifest, progress")
    t_parser = sub.add_parser("transcript", help="Parsed session transcript")
    t_parser.add_argument("--session-id", default="", help="Override session ID")
    sub.add_parser("audit", help="Pipeline & delegation audit")
    sub.add_parser("tools", help="Tool usage analysis")
    sub.add_parser("scenes", help="Scene source code")
    sub.add_parser("plan", help="SCENE_PLAN.md content")
    sub.add_parser("shared", help="constants.ts + shared components")
    sub.add_parser("cost", help="Per-turn cost breakdown")
    sub.add_parser("db", help="Full DB state dump")
    l_parser = sub.add_parser("logs", help="Formatted container logs")
    l_parser.add_argument("--lines", type=int, default=LOG_LINES, help="Number of log lines")

    args = parser.parse_args()

    # Ensure --json attr exists even when no subcommand
    if not hasattr(args, "json"):
        args.json = False

    commands = {
        "status": cmd_status,
        "transcript": cmd_transcript,
        "audit": cmd_audit,
        "tools": cmd_tools,
        "scenes": cmd_scenes,
        "plan": cmd_plan,
        "shared": cmd_shared,
        "cost": cmd_cost,
        "db": cmd_db,
        "logs": cmd_logs,
    }

    if args.command in commands:
        commands[args.command](args)
    elif args.once:
        cmd_once(args)
    elif HAS_TEXTUAL:
        container, secret, agent_port = resolve_container(args.project_id)
        app = SandboxDashboard(args.project_id, container, secret, agent_port)
        app.run()
    else:
        console.print("[yellow]textual not installed — falling back to --once mode[/yellow]")
        console.print("[dim]Install for interactive TUI: pip install textual[/dim]\n")
        cmd_once(args)


if __name__ == "__main__":
    main()
