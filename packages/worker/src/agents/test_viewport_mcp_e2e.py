#!/usr/bin/env python3
"""
MCP Viewport Server Integration Test.

Spawns viewport-server.js as a subprocess and communicates via
MCP stdio protocol (JSON-RPC 2.0) to test both tools end-to-end:
  - get_scene_dimensions
  - validate_scene_code
"""

import asyncio
import json
import os
import sys
import tempfile
from pathlib import Path


# -------------------------------------------------------------------
# MCP stdio client helpers
# -------------------------------------------------------------------

class McpStdioClient:
    """Minimal MCP client that communicates over stdin/stdout with JSON-RPC."""

    def __init__(self, proc: asyncio.subprocess.Process):
        self.proc = proc
        self._id = 0

    def _next_id(self) -> int:
        self._id += 1
        return self._id

    async def send(self, method: str, params: dict | None = None) -> dict:
        """Send a JSON-RPC request and wait for the response."""
        msg_id = self._next_id()
        request = {
            "jsonrpc": "2.0",
            "id": msg_id,
            "method": method,
        }
        if params is not None:
            request["params"] = params

        payload = json.dumps(request) + "\n"
        self.proc.stdin.write(payload.encode())
        await self.proc.stdin.drain()

        # Read responses until we get our id
        while True:
            line = await asyncio.wait_for(self.proc.stdout.readline(), timeout=10)
            if not line:
                raise RuntimeError("Server closed stdout unexpectedly")
            line = line.decode().strip()
            if not line:
                continue
            try:
                response = json.loads(line)
            except json.JSONDecodeError:
                # stderr logging from the server, skip
                continue
            if isinstance(response, dict) and response.get("id") == msg_id:
                return response

    async def initialize(self) -> dict:
        """Perform MCP initialization handshake."""
        resp = await self.send("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "test-client", "version": "1.0.0"},
        })
        # Send initialized notification (no response expected)
        notif = json.dumps({
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
        }) + "\n"
        self.proc.stdin.write(notif.encode())
        await self.proc.stdin.drain()
        return resp

    async def call_tool(self, name: str, arguments: dict | None = None) -> dict:
        """Call an MCP tool and return the result."""
        params = {"name": name, "arguments": arguments or {}}
        return await self.send("tools/call", params)

    async def list_tools(self) -> dict:
        """List available tools."""
        return await self.send("tools/list", {})


# -------------------------------------------------------------------
# Test fixtures
# -------------------------------------------------------------------

def create_test_workspace(tmp_dir: Path, scenes: list[dict]) -> Path:
    """Create a mock workspace with src/proj_test/scenes.json."""
    proj_dir = tmp_dir / "src" / "proj_test"
    proj_dir.mkdir(parents=True)

    scenes_data = {"scenes": scenes}
    (proj_dir / "scenes.json").write_text(json.dumps(scenes_data, indent=2))
    return tmp_dir


def create_scene_file(tmp_dir: Path, scene_num: int, code: str) -> Path:
    """Write a mock scene file."""
    scenes_dir = tmp_dir / "src" / "proj_test" / "scenes"
    scenes_dir.mkdir(parents=True, exist_ok=True)
    scene_path = scenes_dir / f"Scene{scene_num}.tsx"
    scene_path.write_text(code)
    return scene_path


MOCK_SCENES = [
    {
        "id": 1,
        "title": "Introduction",
        "displayMode": "pip",
        "effectiveDimensions": {"width": 1080, "height": 960},
        "transition": {"enter": {"type": "cut", "durationMs": 0}, "exit": {"type": "fade", "durationMs": 300}},
    },
    {
        "id": 2,
        "title": "Big Reveal",
        "displayMode": "fullscreen",
        "effectiveDimensions": {"width": 1080, "height": 1920},
        "transition": {"enter": {"type": "zoom-in", "durationMs": 300}, "exit": {"type": "cut", "durationMs": 0}},
    },
    {
        "id": 3,
        "title": "Speaker Focus",
        "displayMode": "overlay",
        "effectiveDimensions": {"width": 1080, "height": 1920},
        "transition": {"enter": {"type": "fade", "durationMs": 400}, "exit": {"type": "fade", "durationMs": 400}},
    },
]


# -------------------------------------------------------------------
# Resolve viewport server path
# -------------------------------------------------------------------

VIEWPORT_SERVER = str(
    Path(__file__).parent / "mcp-servers" / "viewport-server.js"
)


async def spawn_server(workspace: str) -> tuple[asyncio.subprocess.Process, McpStdioClient]:
    """Spawn viewport-server.js and return process + MCP client."""
    proc = await asyncio.create_subprocess_exec(
        "node", VIEWPORT_SERVER, "--workspace", workspace,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    client = McpStdioClient(proc)
    await client.initialize()
    return proc, client


# -------------------------------------------------------------------
# Tests
# -------------------------------------------------------------------

async def test_get_scene_dimensions_all(client: McpStdioClient):
    """get_scene_dimensions without filter returns all scenes."""
    resp = await client.call_tool("get_scene_dimensions", {})
    assert "result" in resp, f"Expected result, got: {resp}"

    content = resp["result"]["content"]
    assert len(content) > 0
    data = json.loads(content[0]["text"])

    assert data["totalScenes"] == 3, f"Expected 3 scenes, got {data['totalScenes']}"
    scenes = data["scenes"]

    # Scene 1: pip, 1080x960
    assert scenes[0]["displayMode"] == "pip"
    assert scenes[0]["effectiveWidth"] == 1080
    assert scenes[0]["effectiveHeight"] == 960
    assert "aspectRatio" in scenes[0]
    assert "constantsKey" in scenes[0]
    assert scenes[0]["constantsKey"]["width"] == "TIMING.scene1EffectiveWidth"

    # Scene 2: fullscreen, 1080x1920
    assert scenes[1]["displayMode"] == "fullscreen"
    assert scenes[1]["effectiveWidth"] == 1080
    assert scenes[1]["effectiveHeight"] == 1920

    # Scene 3: overlay, 1080x1920
    assert scenes[2]["displayMode"] == "overlay"
    assert scenes[2]["effectiveWidth"] == 1080
    assert scenes[2]["effectiveHeight"] == 1920
    # Overlay should mention transparency in designTips
    assert "transparent" in scenes[2]["designTips"].lower() or "background" in scenes[2]["designTips"].lower()

    print("  PASS: get_scene_dimensions returns all scenes with correct data")


async def test_get_scene_dimensions_filtered(client: McpStdioClient):
    """get_scene_dimensions with sceneNumber filter returns single scene."""
    resp = await client.call_tool("get_scene_dimensions", {"sceneNumber": 2})
    assert "result" in resp, f"Expected result, got: {resp}"

    content = resp["result"]["content"]
    data = json.loads(content[0]["text"])

    # Should be a single scene object (not wrapped in scenes array)
    assert data["sceneNumber"] == 2
    assert data["displayMode"] == "fullscreen"
    assert data["effectiveWidth"] == 1080
    assert data["effectiveHeight"] == 1920
    assert data["constantsKey"]["height"] == "TIMING.scene2EffectiveHeight"

    print("  PASS: get_scene_dimensions with sceneNumber filter works")


async def test_validate_scene_code_valid(client: McpStdioClient, workspace: Path):
    """validate_scene_code passes for a correctly-written scene."""
    valid_code = """
import { useVideoConfig, useCurrentFrame, interpolate, spring } from 'remotion';
import { TIMING } from '../constants';

export const Scene1: React.FC = () => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const EW = TIMING.scene1EffectiveWidth;
  const EH = TIMING.scene1EffectiveHeight;

  const fadeIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: EW, height: EH, overflow: 'hidden' }}>
      <div style={{
        opacity: fadeIn,
        fontSize: EH * 0.04,
        textAlign: 'center',
        padding: EW * 0.1,
      }}>
        Introduction Scene
      </div>
    </div>
  );
};
"""
    scene_path = create_scene_file(workspace, 1, valid_code)

    resp = await client.call_tool("validate_scene_code", {
        "scenePath": str(scene_path),
        "sceneNumber": 1,
    })
    assert "result" in resp, f"Expected result, got: {resp}"

    content = resp["result"]["content"]
    data = json.loads(content[0]["text"])

    assert data["valid"] is True, f"Expected valid=True, got issues: {data.get('issues')}"
    assert len(data["issues"]) == 0
    print("  PASS: validate_scene_code passes for valid scene")


async def test_validate_scene_code_missing_timing_refs(client: McpStdioClient, workspace: Path):
    """validate_scene_code flags missing TIMING refs."""
    broken_code = """
import { useVideoConfig, useCurrentFrame } from 'remotion';

export const Scene1: React.FC = () => {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: 1080, height: 960 }}>
      <p style={{ fontSize: 48 }}>Hello</p>
    </div>
  );
};
"""
    scene_path = create_scene_file(workspace, 1, broken_code)

    resp = await client.call_tool("validate_scene_code", {
        "scenePath": str(scene_path),
        "sceneNumber": 1,
    })
    content = resp["result"]["content"]
    data = json.loads(content[0]["text"])

    assert data["valid"] is False, "Expected valid=False for scene missing TIMING refs"
    issues = data["issues"]
    # Should flag missing EffectiveWidth and EffectiveHeight
    assert any("EffectiveWidth" in i for i in issues), f"Expected EffectiveWidth issue, got: {issues}"
    assert any("EffectiveHeight" in i for i in issues), f"Expected EffectiveHeight issue, got: {issues}"
    # Should flag missing overflow:hidden
    assert any("overflow" in i.lower() for i in issues), f"Expected overflow:hidden issue, got: {issues}"

    print("  PASS: validate_scene_code flags missing TIMING refs and overflow:hidden")


async def test_validate_scene_code_overlay_with_background(client: McpStdioClient, workspace: Path):
    """validate_scene_code flags Background component in overlay scene."""
    overlay_broken = """
import { useVideoConfig, useCurrentFrame } from 'remotion';
import { Background } from 'remotion';
import { TIMING } from '../constants';

export const Scene3: React.FC = () => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const EW = TIMING.scene3EffectiveWidth;
  const EH = TIMING.scene3EffectiveHeight;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: EW, height: EH, overflow: 'hidden' }}>
      <Background color="#000000" />
      <p style={{ backgroundColor: '#FF0000', fontSize: EH * 0.04 }}>Overlay Content</p>
    </div>
  );
};
"""
    scene_path = create_scene_file(workspace, 3, overlay_broken)

    resp = await client.call_tool("validate_scene_code", {
        "scenePath": str(scene_path),
        "sceneNumber": 3,
    })
    content = resp["result"]["content"]
    data = json.loads(content[0]["text"])

    assert data["valid"] is False, "Expected valid=False for overlay with Background"
    issues = data["issues"]
    # Should flag Background in overlay
    assert any("Background" in i or "overlay" in i.lower() for i in issues), (
        f"Expected overlay/Background issue, got: {issues}"
    )

    print("  PASS: validate_scene_code flags Background in overlay scene")


async def test_server_lifecycle():
    """Verify server starts and stops cleanly."""
    with tempfile.TemporaryDirectory() as tmpdir:
        workspace = Path(tmpdir)
        create_test_workspace(workspace, MOCK_SCENES)

        proc = await asyncio.create_subprocess_exec(
            "node", VIEWPORT_SERVER, "--workspace", str(workspace),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        # Server should be running
        assert proc.returncode is None, "Server should be running"

        # Close stdin to signal shutdown
        proc.stdin.close()

        try:
            await asyncio.wait_for(proc.wait(), timeout=5)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()

        # Server should have exited (0 or killed)
        assert proc.returncode is not None, "Server should have exited"

    print("  PASS: server starts and stops cleanly")


# -------------------------------------------------------------------
# Runner
# -------------------------------------------------------------------

async def main():
    print("\n" + "=" * 60)
    print("VIEWPORT MCP SERVER — INTEGRATION TEST")
    print("=" * 60)

    # Verify server file exists
    if not Path(VIEWPORT_SERVER).exists():
        print(f"  ERROR: viewport-server.js not found at {VIEWPORT_SERVER}")
        return 1

    passed = 0
    failed = 0
    errors = []

    # Test 1: Server lifecycle
    print("\n--- Server lifecycle ---")
    try:
        await test_server_lifecycle()
        passed += 1
    except Exception as e:
        failed += 1
        errors.append(("test_server_lifecycle", str(e)))
        print(f"  FAIL: {e}")

    # Tests with a shared server session
    print("\n--- Tool tests ---")
    with tempfile.TemporaryDirectory() as tmpdir:
        workspace = Path(tmpdir)
        create_test_workspace(workspace, MOCK_SCENES)

        proc, client = await spawn_server(str(workspace))

        tool_tests = [
            ("test_get_scene_dimensions_all", test_get_scene_dimensions_all, (client,)),
            ("test_get_scene_dimensions_filtered", test_get_scene_dimensions_filtered, (client,)),
            ("test_validate_scene_code_valid", test_validate_scene_code_valid, (client, workspace)),
            ("test_validate_scene_code_missing_timing_refs", test_validate_scene_code_missing_timing_refs, (client, workspace)),
            ("test_validate_scene_code_overlay_with_background", test_validate_scene_code_overlay_with_background, (client, workspace)),
        ]

        for name, test_fn, args in tool_tests:
            try:
                await test_fn(*args)
                passed += 1
            except Exception as e:
                failed += 1
                errors.append((name, str(e)))
                print(f"  FAIL: {name}: {e}")

        # Clean up server
        proc.stdin.close()
        try:
            await asyncio.wait_for(proc.wait(), timeout=5)
        except asyncio.TimeoutError:
            proc.kill()
            await proc.wait()

    # Summary
    print(f"\n{'=' * 60}")
    print(f"Results: {passed} passed, {failed} failed out of {passed + failed}")
    if errors:
        print("\nFailures:")
        for name, err in errors:
            print(f"  - {name}: {err}")
    print("=" * 60)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
