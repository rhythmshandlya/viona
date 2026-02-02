#!/usr/bin/env python3
"""
End-to-end test for Visual Generator with OpenHands Docker.

This test:
1. Creates a test prompt file
2. Runs the OpenHands Docker container
3. Verifies the output (visual plan and generated code)
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# Test configuration
TEST_PROJECT_ID = "test_rest_api"
TEST_DURATION_FRAMES = 900  # 30 seconds at 30fps
TEST_FPS = 30
TEST_WIDTH = 1080
TEST_HEIGHT = 1920
DOCKER_IMAGE = "openhands-sandbox:latest"


def get_test_prompt() -> str:
    """Get a sample prompt for testing."""
    return """## Transcript with Timestamps

[0:00 - 0:05] Let's understand how REST APIs work.
[0:05 - 0:12] You have a client, like your browser or mobile app, that wants data.
[0:12 - 0:20] On the other side, there's a server that stores and manages that data.
[0:20 - 0:30] When you need something, your client sends a REQUEST to the server.

## Style Guidelines

Style: modern
Background: #0f0f23
Primary: #8b5cf6
Accent: #06b6d4
Text: #ffffff

## Project Details

- Project ID: test_rest_api
- Duration: 30 seconds (900 frames at 30fps)
- Canvas: 1080x1920 (vertical)
- Layout: pip (full screen for visuals)

## Instructions

Create a Remotion composition that visualizes this explanation about REST APIs.
Use creative visual metaphors - not generic icons.
"""


def run_test():
    """Run the end-to-end test."""
    print("=" * 60)
    print("END-TO-END TEST: Visual Generator with OpenHands")
    print("=" * 60)

    # Check for API key
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        # Try to load from .env
        env_path = Path(__file__).parent.parent.parent / ".env"
        if env_path.exists():
            for line in env_path.read_text().split("\n"):
                if line.startswith("OPENROUTER_API_KEY="):
                    api_key = line.split("=", 1)[1].strip()
                    break

    if not api_key:
        print("ERROR: OPENROUTER_API_KEY not set")
        print("Set it in environment or in packages/worker/.env")
        return 1

    print(f"API Key: {api_key[:10]}...{api_key[-4:]}")

    # Check Docker image exists
    result = subprocess.run(
        ["docker", "images", DOCKER_IMAGE, "--format", "{{.Repository}}"],
        capture_output=True, text=True
    )
    if DOCKER_IMAGE.split(":")[0] not in result.stdout:
        print(f"ERROR: Docker image {DOCKER_IMAGE} not found")
        return 1

    print(f"Docker image: {DOCKER_IMAGE}")

    # Create temp directories
    test_dir = Path(tempfile.mkdtemp(prefix="clipify_test_"))
    output_dir = test_dir / "output"
    bundle_dir = test_dir / "bundles"
    output_dir.mkdir()
    bundle_dir.mkdir()

    print(f"Test directory: {test_dir}")
    print(f"Output: {output_dir}")
    print(f"Bundles: {bundle_dir}")

    # Write prompt file
    prompt_path = test_dir / "prompt.txt"
    prompt_path.write_text(get_test_prompt(), encoding="utf-8")
    print(f"Prompt written: {prompt_path}")

    # Build Docker command
    # Use host.docker.internal for Windows Docker to reach OpenRouter
    base_url = "https://openrouter.ai/api/v1"
    model = "google/gemini-2.5-flash"  # With reasoning support

    # Convert Windows paths to Docker-compatible paths
    prompt_path_docker = str(prompt_path).replace("\\", "/")
    output_dir_docker = str(output_dir).replace("\\", "/")
    bundle_dir_docker = str(bundle_dir).replace("\\", "/")

    docker_cmd = [
        "docker", "run",
        "--rm",
        "--name", f"clipify-test-{os.getpid()}",
        "--memory", "4g",
        "--cpus", "2",
        # Mount prompt file
        "-v", f"{prompt_path_docker}:/tmp/prompt.txt:ro",
        # Mount output directories
        "-v", f"{output_dir_docker}:/output",
        "-v", f"{bundle_dir_docker}:/bundles",
        # Environment for LLM
        "-e", f"OPENAI_API_BASE={base_url}",
        "-e", f"OPENAI_API_KEY={api_key}",
        # Image
        DOCKER_IMAGE,
        # Arguments to entrypoint
        "--project-id", TEST_PROJECT_ID,
        "--model", model,
        "--model-flash", model,
        "--base-url", base_url,
        "--api-key", api_key,
        "--prompt-file", "/tmp/prompt.txt",
        "--output-dir", "/output",
        "--bundle-dir", "/bundles",
        "--duration-frames", str(TEST_DURATION_FRAMES),
        "--fps", str(TEST_FPS),
        "--width", str(TEST_WIDTH),
        "--height", str(TEST_HEIGHT),
        "--style-preset", "modern",
        "--layout-mode", "pip",
        "--reasoning-effort", "medium",
        "--temperature", "1.0",
        "--max-iterations", "2",
        "--quality-threshold", "60",
        # "--skip-planning",  # Enable planning to test full flow
    ]

    print("\n" + "=" * 60)
    print("Running Docker container...")
    print("=" * 60)
    print(f"Command: docker run ... {DOCKER_IMAGE} --project-id {TEST_PROJECT_ID} ...")

    # Run Docker
    process = subprocess.Popen(
        docker_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding='utf-8',
        errors='replace',  # Replace non-decodable chars instead of crashing
        env={**os.environ, "MSYS_NO_PATHCONV": "1", "MSYS2_ARG_CONV_EXCL": "*"}
    )

    # Stream output
    events = []
    try:
        for line in process.stdout:
            line = line.strip()
            if not line:
                continue

            # Try to parse as JSON event
            try:
                event = json.loads(line)
                # Skip if not a dict (e.g., raw integer)
                if not isinstance(event, dict):
                    safe_line = line[:100].encode('ascii', 'replace').decode('ascii')
                    print(f"  {safe_line}")
                    continue
                events.append(event)
                event_type = event.get("type", "unknown")

                if event_type == "started":
                    print(f"  [STARTED] Model: {event.get('model', 'unknown')}")
                elif event_type == "planning_start":
                    print(f"  [PLANNING] Starting Visual Director...")
                elif event_type == "planning_complete":
                    print(f"  [PLANNING] Complete: {event.get('scene_count', 0)} scenes")
                elif event_type == "iteration_start":
                    print(f"  [ITERATION] {event.get('iteration', '?')}/{event.get('max_iterations', '?')}")
                elif event_type == "iteration_complete":
                    print(f"  [SCORE] {event.get('score', 0)}/100")
                    if event.get("issues"):
                        for issue in event["issues"][:3]:
                            print(f"    - {issue}")
                elif event_type == "tool_call":
                    tool = event.get("tool", "unknown")
                    msg = event.get("message", "")
                    print(f"  [TOOL] {tool}: {msg[:60]}...")
                elif event_type == "complete":
                    print(f"  [COMPLETE] Status: {event.get('status', 'unknown')}, Score: {event.get('final_score', 0)}")
                elif event_type == "error":
                    print(f"  [ERROR] {event.get('message', 'unknown error')}")
                else:
                    print(f"  [{event_type.upper()}] {str(event)[:80]}...")
            except json.JSONDecodeError:
                # Not JSON, print as-is (sanitize for Windows console)
                safe_line = line[:100].encode('ascii', 'replace').decode('ascii')
                print(f"  {safe_line}")

    except KeyboardInterrupt:
        print("\nInterrupted - stopping container...")
        subprocess.run(["docker", "stop", f"clipify-test-{os.getpid()}"], capture_output=True)
        return 1

    # Wait for completion
    process.wait()
    stderr = process.stderr.read()

    if stderr:
        print("\nStderr:")
        print(stderr[:500])

    print("\n" + "=" * 60)
    print("Checking output...")
    print("=" * 60)

    # Check output
    project_dir = output_dir / TEST_PROJECT_ID
    success = True

    if project_dir.exists():
        files = list(project_dir.glob("**/*"))
        file_names = [f.name for f in files if f.is_file()]
        print(f"Output directory: {project_dir}")
        print(f"Files generated: {len(file_names)}")
        for name in file_names[:10]:
            print(f"  - {name}")

        # Check for key files
        if "index.tsx" in file_names:
            print("  OK index.tsx generated")
        else:
            print("  FAIL index.tsx missing")
            success = False

        if "metadata.json" in file_names:
            print("  OK metadata.json generated")
            # Read and display metadata
            meta_path = project_dir / "metadata.json"
            try:
                meta = json.loads(meta_path.read_text())
                print(f"    - compositionId: {meta.get('compositionId', 'N/A')}")
                print(f"    - durationInFrames: {meta.get('durationInFrames', 'N/A')}")
                print(f"    - visuals count: {len(meta.get('visuals', []))}")
            except Exception as e:
                print(f"    - Error reading: {e}")
        else:
            print("  WARN metadata.json missing (may be generated later)")

        # Check for visual plan
        if "visual-plan.json" in file_names:
            print("  OK visual-plan.json generated")
        else:
            print("  INFO visual-plan.json not found (planning may have been skipped)")

    else:
        print(f"FAIL Output directory not created: {project_dir}")
        success = False

    # Check bundles (new unified structure)
    bundle_project_dir = bundle_dir / TEST_PROJECT_ID.replace("_", "-")
    if bundle_project_dir.exists():
        print(f"\nBundle directory: {bundle_project_dir}")

        # Check logs/
        logs_dir = bundle_project_dir / "logs"
        if logs_dir.exists():
            log_file = logs_dir / "generation.log"
            if log_file.exists():
                log_lines = len(log_file.read_text().strip().split('\n'))
                print(f"  OK logs/generation.log ({log_lines} entries)")
            else:
                print("  WARN logs/generation.log missing")
        else:
            print("  WARN logs/ directory missing")

        # Check plans/
        plans_dir = bundle_project_dir / "plans"
        if plans_dir.exists():
            plan_file = plans_dir / "visual-plan.json"
            if plan_file.exists():
                plan = json.loads(plan_file.read_text())
                scenes = len(plan.get("scenes", []))
                print(f"  OK plans/visual-plan.json ({scenes} scenes)")
            else:
                print("  WARN plans/visual-plan.json missing")
            if (plans_dir / "raw-response.txt").exists():
                print("  OK plans/raw-response.txt")
            if (plans_dir / "thinking.txt").exists():
                print("  OK plans/thinking.txt")
        else:
            print("  WARN plans/ directory missing")

        # Check src/
        src_dir = bundle_project_dir / "src"
        if src_dir.exists():
            src_files = list(src_dir.glob("*"))
            print(f"  OK src/ ({len(src_files)} files)")
        else:
            print("  WARN src/ directory missing")

        # Check build/
        build_dir = bundle_project_dir / "build"
        if build_dir.exists():
            if (build_dir / "index.html").exists():
                print("  OK build/index.html")
            if (build_dir / "bundle.js").exists():
                print("  OK build/bundle.js")
        else:
            print("  WARN build/ directory missing")

        # Check summary
        if (bundle_project_dir / "summary.json").exists():
            summary = json.loads((bundle_project_dir / "summary.json").read_text())
            print(f"  OK summary.json (status: {summary.get('status')}, score: {summary.get('final_score')})")

        # Check video
        if (bundle_project_dir / "video.mp4").exists():
            print("  OK video.mp4 rendered")
    else:
        print(f"INFO Bundle not created (may require full pipeline)")

    # Summary
    print("\n" + "=" * 60)
    if success and process.returncode == 0:
        print("TEST PASSED - Visual generation completed successfully")
    else:
        print(f"TEST COMPLETED with issues (exit code: {process.returncode})")
    print("=" * 60)

    # Cleanup
    print(f"\nTest files kept at: {test_dir}")
    print("Run manually to clean up: rm -rf", test_dir)

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(run_test())
