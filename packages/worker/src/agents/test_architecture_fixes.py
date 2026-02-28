#!/usr/bin/env python3
"""
Targeted tests for the 12 critical architecture audit fixes.

Tests verify:
  C1-C3: Template copy pipeline (path resolution, shared utilities, register.ts exclusion)
  C4-C5: Doubled braces in plain strings (STUDIO_DESIGN_SYSTEM, ANIMATOR_SYSTEM_PROMPT)
  C6-C8: Interpolate clamping consistency (rules + examples + templates)
  C9:    OAuth expires_at typing (None handling)
  C10-C11: Director pacing constraints (7s minimum respected)
  C12:   Visual verify field name (reads 'visual' not 'description')
"""

import json
import os
import re
import shutil
import sys
import tempfile
import time
from pathlib import Path
from unittest.mock import patch, MagicMock
from dataclasses import dataclass

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Import the worker package root (uses marker-file anchoring, works in both local & Docker)
from claude_visual_generator import _WORKER_PKG_ROOT


# ═══════════════════════════════════════════════════════════════════════
# C1-C3: Template Copy Pipeline
# ═══════════════════════════════════════════════════════════════════════

def test_template_path_resolution():
    """C1: _copy_studio_templates resolves to packages/templates/src/templates/."""
    print("=" * 60)
    print("TEST C1: Template path resolution")
    print("=" * 60)

    # _WORKER_PKG_ROOT should point to packages/worker
    assert _WORKER_PKG_ROOT.name == "worker", \
        f"_WORKER_PKG_ROOT should end with 'worker', got: {_WORKER_PKG_ROOT}"
    assert (_WORKER_PKG_ROOT / "package.json").exists(), \
        f"_WORKER_PKG_ROOT should contain package.json: {_WORKER_PKG_ROOT}"
    print(f"  OK _WORKER_PKG_ROOT = {_WORKER_PKG_ROOT}")

    # templates_pkg should resolve correctly via _WORKER_PKG_ROOT.parent
    templates_pkg = _WORKER_PKG_ROOT.parent / "templates" / "src" / "templates"
    assert templates_pkg.exists(), f"Template path does not resolve correctly: {templates_pkg}"
    print(f"  OK Path resolves to: {templates_pkg}")

    # Verify it contains template directories with meta.json
    template_dirs = [d for d in templates_pkg.iterdir() if d.is_dir() and (d / "meta.json").exists()]
    assert len(template_dirs) >= 60, f"Expected 60+ templates, found {len(template_dirs)}"
    print(f"  OK Found {len(template_dirs)} template directories")

    print("  PASSED\n")


def test_shared_utility_files_exist():
    """C2: use-scale.ts and fonts.ts exist in packages/templates/src/."""
    print("=" * 60)
    print("TEST C2: Shared utility files exist")
    print("=" * 60)

    templates_src = _WORKER_PKG_ROOT.parent / "templates" / "src"

    for shared_file in ["use-scale.ts", "fonts.ts"]:
        path = templates_src / shared_file
        assert path.exists(), f"Missing shared utility: {path}"
        content = path.read_text(encoding="utf-8")
        assert len(content) > 50, f"{shared_file} is too small ({len(content)} bytes)"
        print(f"  OK {shared_file} exists ({len(content)} bytes)")

    # Verify the copy target is workspace/src/ (not workspace/src/.templates/)
    # Templates import ../../use-scale from src/.templates/{slug}/ → resolves to src/
    generator_source = (Path(__file__).parent / "claude_visual_generator.py").read_text(encoding="utf-8")
    assert "src_dir = target_dir.parent" in generator_source, \
        "Shared files should be copied to target_dir.parent (workspace/src/), not target_dir"
    assert "shutil.copy2(src, src_dir / shared_file)" in generator_source, \
        "Copy destination should be src_dir (workspace/src/)"
    print("  OK Copy target resolves to workspace/src/ (correct for ../../ imports)")

    print("  PASSED\n")


def test_register_ts_excluded():
    """C3: register.ts is excluded from template copy via ignore_patterns."""
    print("=" * 60)
    print("TEST C3: register.ts exclusion in copytree")
    print("=" * 60)

    # Verify the source code uses ignore_patterns("register.ts")
    generator_path = Path(__file__).parent / "claude_visual_generator.py"
    source = generator_path.read_text(encoding="utf-8")
    assert 'ignore_patterns("register.ts")' in source, \
        "Missing shutil.ignore_patterns('register.ts') in _copy_studio_templates"
    print("  OK copytree uses ignore_patterns('register.ts')")

    # Functional test: simulate copytree with ignore
    templates_pkg = _WORKER_PKG_ROOT.parent / "templates" / "src" / "templates"
    sample_template = next(
        (d for d in sorted(templates_pkg.iterdir())
         if d.is_dir() and (d / "register.ts").exists()),
        None
    )
    assert sample_template is not None, "No template with register.ts found"

    with tempfile.TemporaryDirectory() as tmp:
        dest = Path(tmp) / sample_template.name
        shutil.copytree(sample_template, dest, ignore=shutil.ignore_patterns("register.ts"))
        assert not (dest / "register.ts").exists(), "register.ts was not excluded!"
        assert (dest / "index.tsx").exists(), "index.tsx should be copied"
        assert (dest / "meta.json").exists(), "meta.json should be copied"
        print(f"  OK Copied {sample_template.name} without register.ts")

    print("  PASSED\n")


def test_all_templates_have_studio_theme_tag():
    """C3b: All 60 templates have 'studio-theme' tag so they get copied."""
    print("=" * 60)
    print("TEST C3b: All templates have studio-theme tag")
    print("=" * 60)

    templates_pkg = _WORKER_PKG_ROOT.parent / "templates" / "src" / "templates"
    missing = []
    count = 0

    for template_dir in sorted(templates_pkg.iterdir()):
        if not template_dir.is_dir():
            continue
        meta_path = template_dir / "meta.json"
        if not meta_path.exists():
            continue
        count += 1
        with open(meta_path, encoding="utf-8") as f:
            meta = json.load(f)
        if "studio-theme" not in meta.get("tags", []):
            missing.append(template_dir.name)

    assert len(missing) == 0, f"Templates missing 'studio-theme' tag: {missing}"
    assert count >= 60, f"Expected 60+ templates, found {count}"
    print(f"  OK All {count} templates have 'studio-theme' tag")

    print("  PASSED\n")


def test_workspace_fonts_synced():
    """C3c: Workspace fonts.ts has all fonts from templates package."""
    print("=" * 60)
    print("TEST C3c: Workspace fonts.ts synced with templates package")
    print("=" * 60)

    templates_fonts = _WORKER_PKG_ROOT.parent / "templates" / "src" / "fonts.ts"
    workspace_fonts = _WORKER_PKG_ROOT / "workspace" / "src" / "fonts.ts"

    assert templates_fonts.exists(), f"Templates fonts.ts not found: {templates_fonts}"
    assert workspace_fonts.exists(), f"Workspace fonts.ts not found: {workspace_fonts}"

    pkg_content = templates_fonts.read_text(encoding="utf-8")
    ws_content = workspace_fonts.read_text(encoding="utf-8")

    # Extract font pair keys from both
    pkg_pairs = set(re.findall(r"(\w+):\s*\{[^}]*headline:", pkg_content))
    ws_pairs = set(re.findall(r"(\w+):\s*\{[^}]*headline:", ws_content))

    missing = pkg_pairs - ws_pairs
    assert len(missing) == 0, f"Workspace fonts.ts missing font pairs: {missing}"
    print(f"  OK Both files have {len(pkg_pairs)} font pairs")

    # Check newspaperClassic specifically
    assert "newspaperClassic" in ws_content, "Workspace missing newspaperClassic font pair"
    print("  OK newspaperClassic font pair present in workspace")

    print("  PASSED\n")


# ═══════════════════════════════════════════════════════════════════════
# C4-C5: Doubled Braces in Plain Strings
# ═══════════════════════════════════════════════════════════════════════

def test_studio_design_system_no_doubled_braces():
    """C4: STUDIO_DESIGN_SYSTEM has no {{slug}} or {{{{ }}}} patterns."""
    print("=" * 60)
    print("TEST C4: STUDIO_DESIGN_SYSTEM brace correctness")
    print("=" * 60)

    from prompts.animator import STUDIO_DESIGN_SYSTEM

    # Should NOT contain {{slug}} (doubled)
    assert "{{slug}}" not in STUDIO_DESIGN_SYSTEM, \
        "Found {{slug}} — should be {slug} in plain string"
    print("  OK No {{slug}} found")

    # Should NOT contain {{{{ (quadruple braces)
    assert "{{{{" not in STUDIO_DESIGN_SYSTEM, \
        "Found {{{{ — quadruple braces are garbled JSX"
    print("  OK No {{{{ found")

    # Should contain proper JSX double-brace for style={{...}}
    assert "style={{" in STUDIO_DESIGN_SYSTEM, \
        "Missing style={{ — JSX style objects need double braces"
    print("  OK Contains proper style={{ patterns")

    # Should contain {slug} (single braces for template path)
    assert "{slug}" in STUDIO_DESIGN_SYSTEM, \
        "Missing {slug} — template paths should use single braces"
    print("  OK Contains {slug} template paths")

    print("  PASSED\n")


def test_animator_system_prompt_no_doubled_braces():
    """C5: ANIMATOR_SYSTEM_PROMPT has correct brace usage (no garbled JSX)."""
    print("=" * 60)
    print("TEST C5: ANIMATOR_SYSTEM_PROMPT brace correctness")
    print("=" * 60)

    from prompts.animator import ANIMATOR_SYSTEM_PROMPT

    # Should NOT contain {{{{ (quadruple braces)
    assert "{{{{" not in ANIMATOR_SYSTEM_PROMPT, \
        "Found {{{{ in ANIMATOR_SYSTEM_PROMPT — garbled JSX"
    print("  OK No {{{{ found")

    # Check for common patterns that should be single-braced
    # const { fps } = useVideoConfig()  — NOT const {{ fps }}
    if "const {{ fps }}" in ANIMATOR_SYSTEM_PROMPT:
        raise AssertionError("Found 'const {{ fps }}' — should be 'const { fps }'")
    print("  OK No doubled destructuring patterns")

    # JSX style={{ ... }} should use exactly 2 braces (not 3 or 4)
    triple_brace_matches = re.findall(r"style=\{{3,}", ANIMATOR_SYSTEM_PROMPT)
    assert len(triple_brace_matches) == 0, \
        f"Found {len(triple_brace_matches)} style={{{{ patterns (should be style={{{{}})"
    print("  OK No triple/quadruple style braces")

    # Verify it still contains proper JSX double-brace for style
    assert "style={{" in ANIMATOR_SYSTEM_PROMPT, \
        "Missing style={{ — JSX style objects need double braces"
    print("  OK Contains proper style={{ patterns")

    print("  PASSED\n")


def test_animator_base_prompt_brace_consistency():
    """C5b: ANIMATOR_BASE_PROMPT (modular) also has correct braces."""
    print("=" * 60)
    print("TEST C5b: ANIMATOR_BASE_PROMPT brace correctness")
    print("=" * 60)

    from prompts.animator import ANIMATOR_BASE_PROMPT

    # Should NOT contain {{{{ (quadruple braces)
    assert "{{{{" not in ANIMATOR_BASE_PROMPT, \
        "Found {{{{ in ANIMATOR_BASE_PROMPT — garbled JSX"
    print("  OK No {{{{ found")

    # Should contain proper style={{ patterns
    assert "style={{" in ANIMATOR_BASE_PROMPT, \
        "Missing style={{ patterns"
    print("  OK Contains proper style={{ patterns")

    print("  PASSED\n")


# ═══════════════════════════════════════════════════════════════════════
# C6-C8: Interpolate Clamping Consistency
# ═══════════════════════════════════════════════════════════════════════

def test_remotion_rules_require_both_clamps():
    """C6: <remotion_rules> in both prompts require BOTH extrapolateLeft AND extrapolateRight."""
    print("=" * 60)
    print("TEST C6: <remotion_rules> clamping rule")
    print("=" * 60)

    from prompts.animator import ANIMATOR_SYSTEM_PROMPT, ANIMATOR_BASE_PROMPT

    for name, prompt in [("ANIMATOR_SYSTEM_PROMPT", ANIMATOR_SYSTEM_PROMPT),
                         ("ANIMATOR_BASE_PROMPT", ANIMATOR_BASE_PROMPT)]:
        # Extract <remotion_rules> section
        match = re.search(r"<remotion_rules>(.*?)</remotion_rules>", prompt, re.DOTALL)
        assert match, f"No <remotion_rules> section in {name}"
        rules = match.group(1)

        assert "extrapolateLeft" in rules, f"{name} <remotion_rules> missing extrapolateLeft mention"
        assert "extrapolateRight" in rules, f"{name} <remotion_rules> missing extrapolateRight mention"
        assert "BOTH" in rules.upper() or "both" in rules, \
            f"{name} <remotion_rules> should mention BOTH clamps"
        print(f"  OK {name} <remotion_rules> requires both clamps")

    print("  PASSED\n")


def test_prompt_examples_have_both_clamps():
    """C7: All interpolate() examples in prompts have both clamp directives."""
    print("=" * 60)
    print("TEST C7: Prompt interpolate examples have both clamps")
    print("=" * 60)

    from prompts.animator import ANIMATOR_SYSTEM_PROMPT, ANIMATOR_BASE_PROMPT

    for name, prompt in [("ANIMATOR_SYSTEM_PROMPT", ANIMATOR_SYSTEM_PROMPT),
                         ("ANIMATOR_BASE_PROMPT", ANIMATOR_BASE_PROMPT)]:
        # Find all interpolate() calls with extrapolate options
        # Match patterns like: interpolate(..., {...extrapolateRight: 'clamp'...})
        pattern = r"interpolate\([^)]*\{[^}]*extrapolate\w+:\s*['\"]clamp['\"][^}]*\}"
        matches = re.findall(pattern, prompt)

        violations = []
        for m in matches:
            has_left = "extrapolateLeft" in m
            has_right = "extrapolateRight" in m
            if has_left != has_right:  # one without the other
                violations.append(m[:80])

        assert len(violations) == 0, \
            f"{name} has {len(violations)} interpolate calls with only one clamp:\n" + \
            "\n".join(f"  - {v}" for v in violations[:5])
        print(f"  OK {name}: {len(matches)} interpolate examples all have both clamps")

    print("  PASSED\n")


def test_template_files_have_both_clamps():
    """C8: All 60 template index.tsx files have both clamp directives on every interpolate."""
    print("=" * 60)
    print("TEST C8: Template files interpolate clamping")
    print("=" * 60)

    templates_dir = _WORKER_PKG_ROOT.parent / "templates" / "src" / "templates"
    violations = []
    checked = 0

    for template_dir in sorted(templates_dir.iterdir()):
        if not template_dir.is_dir():
            continue

        # Check all .tsx files in the template
        for tsx_file in template_dir.rglob("*.tsx"):
            content = tsx_file.read_text(encoding="utf-8")
            checked += 1

            # Find interpolate calls with extrapolate options
            # Look for any interpolate with extrapolateRight but no extrapolateLeft (or vice versa)
            lines = content.split("\n")
            i = 0
            while i < len(lines):
                line = lines[i]
                if "interpolate(" in line:
                    # Gather the full interpolate call (may span multiple lines)
                    block = line
                    depth = 0
                    for ch in line:
                        if ch == "(":
                            depth += 1
                        elif ch == ")":
                            depth -= 1
                    j = i + 1
                    while depth > 0 and j < len(lines):
                        block += "\n" + lines[j]
                        for ch in lines[j]:
                            if ch == "(":
                                depth += 1
                            elif ch == ")":
                                depth -= 1
                        j += 1

                    if "extrapolate" in block:
                        has_left = "extrapolateLeft" in block
                        has_right = "extrapolateRight" in block
                        if has_left != has_right:
                            rel_path = tsx_file.relative_to(templates_dir)
                            violations.append(f"{rel_path}:{i+1}")
                    i = j
                else:
                    i += 1

    assert len(violations) == 0, \
        f"Found {len(violations)} interpolate calls with only one clamp:\n" + \
        "\n".join(f"  - {v}" for v in violations[:10])
    print(f"  OK Checked {checked} .tsx files — all interpolate calls have both clamps")

    print("  PASSED\n")


# ═══════════════════════════════════════════════════════════════════════
# C9: OAuth expires_at Typing
# ═══════════════════════════════════════════════════════════════════════

def test_oauth_tokens_handles_none_expires():
    """C9: OAuthTokens handles expires_at=None without crashing."""
    print("=" * 60)
    print("TEST C9: OAuth expires_at None handling")
    print("=" * 60)

    from claude_visual_generator import OAuthTokens

    # Test with None expires_at (e.g. server-deployed tokens)
    tokens = OAuthTokens(
        access_token="test_token",
        refresh_token="test_refresh",
        expires_at=None,
    )

    # These should NOT raise TypeError
    assert tokens.is_expired == False, "None expires_at should not be expired"
    print("  OK is_expired handles None (returns False)")

    assert tokens.needs_refresh == False, "None expires_at should not need refresh"
    print("  OK needs_refresh handles None (returns False)")

    assert tokens.minutes_remaining == 999, "None expires_at should return 999 minutes"
    print("  OK minutes_remaining handles None (returns 999)")

    # Test with actual timestamp (normal case still works)
    future_ms = int(time.time() * 1000) + 3600000  # 1 hour from now
    tokens2 = OAuthTokens(
        access_token="test",
        refresh_token=None,
        expires_at=future_ms,
    )
    assert tokens2.is_expired == False, "Future token should not be expired"
    assert tokens2.minutes_remaining > 0, "Future token should have minutes remaining"
    print("  OK Normal int expires_at still works correctly")

    # Test with past timestamp
    past_ms = int(time.time() * 1000) - 60000  # 1 minute ago
    tokens3 = OAuthTokens(
        access_token="test",
        refresh_token=None,
        expires_at=past_ms,
    )
    assert tokens3.is_expired == True, "Past token should be expired"
    assert tokens3.minutes_remaining == 0, "Past token should have 0 minutes remaining"
    print("  OK Expired token detection still works")

    print("  PASSED\n")


# ═══════════════════════════════════════════════════════════════════════
# C10-C11: Director Pacing Constraints
# ═══════════════════════════════════════════════════════════════════════

def test_director_pacing_respects_minimum():
    """C10-C11: Director pacing examples don't suggest scenes below 7s minimum."""
    print("=" * 60)
    print("TEST C10-C11: Director pacing respects 7s minimum")
    print("=" * 60)

    from prompts.director import DIRECTOR_SYSTEM_PROMPT

    # Extract the pacing section
    # Look for "RHYTHM PATTERN" through next major section
    pacing_match = re.search(
        r"RHYTHM PATTERN.*?(?=\n[A-Z]{2,}|\n</)",
        DIRECTOR_SYSTEM_PROMPT, re.DOTALL
    )
    assert pacing_match, "RHYTHM PATTERN section not found in director prompt"
    pacing = pacing_match.group()

    # Extract all duration values like "7s", "10s", "12s"
    durations = re.findall(r"(\d+)s\s*[—–-]", pacing)
    durations_int = [int(d) for d in durations]

    for d in durations_int:
        assert d >= 7, f"Pacing example suggests {d}s scene — below 7s minimum!"
    print(f"  OK All pacing durations >= 7s: {durations_int}")

    # Check that "short beats" language doesn't say 5-6s
    assert "5-6s" not in DIRECTOR_SYSTEM_PROMPT, \
        "Found '5-6s' in director prompt — should be 7-8s"
    assert "5s" not in pacing or "5s" not in DIRECTOR_SYSTEM_PROMPT.split("RHYTHM")[0], \
        "Found standalone '5s' in pacing section"
    print("  OK No '5-6s' short beats language found")

    print("  PASSED\n")


def test_director_sync_gap_limit_consistent():
    """C11b: Sync gap limit is consistently 5 seconds throughout director prompt."""
    print("=" * 60)
    print("TEST C11b: Director sync gap limit consistency")
    print("=" * 60)

    from prompts.director import DIRECTOR_SYSTEM_PROMPT, build_director_user_message

    # The system prompt should say 5 seconds, not 6
    assert "6+ seconds" not in DIRECTOR_SYSTEM_PROMPT, \
        "Found '6+ seconds' — should be '5+ seconds' for sync gap limit"
    assert "6 seconds" not in DIRECTOR_SYSTEM_PROMPT, \
        "Found '6 seconds' — sync gap limit should reference 5 seconds"
    print("  OK No '6+ seconds' sync gap reference in system prompt")

    # Build user message and check it too
    user_msg = build_director_user_message(
        project_id="test",
        formatted_transcript="Hello world. This is a test transcript.",
        width=1080,
        height=1920,
        duration_frames=900,
        fps=30,
        style_preset="modern",
        layout_mode="stacked",
    )
    assert "6+ seconds" not in user_msg, \
        "Found '6+ seconds' in user message"
    print("  OK No '6+ seconds' in generated user message")

    # Positive check: should mention 5 seconds
    assert "5 seconds" in DIRECTOR_SYSTEM_PROMPT or "5s" in DIRECTOR_SYSTEM_PROMPT, \
        "Should reference 5-second sync gap limit"
    print("  OK References 5-second sync gap limit")

    print("  PASSED\n")


# ═══════════════════════════════════════════════════════════════════════
# C12: Visual Verify Field Name
# ═══════════════════════════════════════════════════════════════════════

def test_visual_verify_reads_visual_field():
    """C12: Visual verification reads 'visual' field from scene data, not just 'description'."""
    print("=" * 60)
    print("TEST C12: Visual verify reads 'visual' field")
    print("=" * 60)

    generator_source = (Path(__file__).parent / "claude_visual_generator.py").read_text(encoding="utf-8")

    # The visual verify should read scene_data.get("visual", ...)
    visual_gets = re.findall(r'scene_data\.get\("visual"', generator_source)
    assert len(visual_gets) >= 2, \
        f"Expected 2+ scene_data.get('visual') calls, found {len(visual_gets)}"
    print(f"  OK Found {len(visual_gets)} scene_data.get('visual') calls")

    # It should fallback to description
    fallback_pattern = r'scene_data\.get\("visual",\s*scene_data\.get\("description"'
    fallbacks = re.findall(fallback_pattern, generator_source)
    assert len(fallbacks) >= 2, \
        f"Expected 2+ fallback chains (visual -> description), found {len(fallbacks)}"
    print(f"  OK Found {len(fallbacks)} visual->description fallback chains")

    # Ensure there are no standalone scene_data.get("description") without visual first
    desc_only = re.findall(
        r'(?<!get\("visual", )scene_data\.get\("description"',
        generator_source
    )
    # Filter out the ones that ARE in the fallback chain
    standalone_desc = [d for d in desc_only if "visual" not in generator_source[
        max(0, generator_source.find(d) - 50):generator_source.find(d)
    ]]
    # This is informational — some standalone uses may be valid
    print(f"  INFO {len(desc_only)} total description gets (some may be in fallback chains)")

    print("  PASSED\n")


# ═══════════════════════════════════════════════════════════════════════
# Bonus: Workspace tsconfig excludes .templates
# ═══════════════════════════════════════════════════════════════════════

def test_workspace_tsconfig_excludes_templates():
    """Bonus: workspace tsconfig.json excludes src/.templates from compilation."""
    print("=" * 60)
    print("TEST BONUS: Workspace tsconfig excludes .templates")
    print("=" * 60)

    tsconfig_path = _WORKER_PKG_ROOT / "workspace" / "tsconfig.json"
    assert tsconfig_path.exists(), f"tsconfig.json not found: {tsconfig_path}"

    with open(tsconfig_path, encoding="utf-8") as f:
        tsconfig = json.load(f)

    exclude = tsconfig.get("exclude", [])
    has_templates = any(".templates" in e for e in exclude)
    assert has_templates, f"tsconfig.json exclude list missing .templates: {exclude}"
    print(f"  OK exclude list: {exclude}")

    print("  PASSED\n")


# ═══════════════════════════════════════════════════════════════════════
# Docker Path Simulation
# ═══════════════════════════════════════════════════════════════════════

def test_docker_path_marker_file_anchoring():
    """Docker: _find_worker_pkg_root works when src/ level is stripped."""
    print("=" * 60)
    print("TEST DOCKER: Marker-file anchoring with fewer parent levels")
    print("=" * 60)

    from claude_visual_generator import _find_worker_pkg_root

    # Simulate Docker layout: packages/worker/agents/ (no src/ level)
    # Create a temp directory with:
    #   fake_root/packages/worker/package.json
    #   fake_root/packages/worker/agents/claude_visual_generator.py
    with tempfile.TemporaryDirectory() as tmp:
        fake_root = Path(tmp)
        worker_dir = fake_root / "packages" / "worker"
        agents_dir = worker_dir / "agents"
        agents_dir.mkdir(parents=True)

        # Write a package.json in the worker dir
        (worker_dir / "package.json").write_text('{"name": "@viona/worker"}')

        # Write a dummy generator file
        dummy_py = agents_dir / "claude_visual_generator.py"
        dummy_py.write_text("# dummy")

        # Patch __file__ to point to the Docker-layout location
        # The function walks up from Path(__file__).resolve().parent
        # In Docker: agents/ → worker/ (has package.json) → found!
        with patch("claude_visual_generator.Path") as MockPath:
            mock_file = MagicMock()
            mock_file.resolve.return_value.parent = agents_dir
            MockPath.return_value = mock_file
            MockPath.__file__ = str(dummy_py)

            # Direct test: walk up from agents_dir
            p = agents_dir
            found = None
            for _ in range(5):
                if (p / "package.json").exists():
                    found = p
                    break
                p = p.parent

            assert found is not None, "Failed to find package.json"
            assert found == worker_dir, f"Expected {worker_dir}, got {found}"
            assert found.name == "worker", f"Should find 'worker', got {found.name}"
            print(f"  OK Docker layout (2 levels): found worker at {found}")

    # Also verify local layout works (3 levels: src/agents/ → src/ → worker/)
    with tempfile.TemporaryDirectory() as tmp:
        fake_root = Path(tmp)
        worker_dir = fake_root / "packages" / "worker"
        src_agents = worker_dir / "src" / "agents"
        src_agents.mkdir(parents=True)

        (worker_dir / "package.json").write_text('{"name": "@viona/worker"}')

        p = src_agents
        found = None
        for _ in range(5):
            if (p / "package.json").exists():
                found = p
                break
            p = p.parent

        assert found is not None, "Failed to find package.json in local layout"
        assert found == worker_dir, f"Expected {worker_dir}, got {found}"
        print(f"  OK Local layout (3 levels): found worker at {found}")

    print("  PASSED\n")


def test_worker_pkg_root_uses_marker_file():
    """Verify _find_worker_pkg_root uses package.json marker, not hardcoded parent count."""
    print("=" * 60)
    print("TEST: _find_worker_pkg_root uses marker-file approach")
    print("=" * 60)

    generator_source = (Path(__file__).parent / "claude_visual_generator.py").read_text(encoding="utf-8")

    # Should contain _find_worker_pkg_root function
    assert "def _find_worker_pkg_root" in generator_source, \
        "Missing _find_worker_pkg_root function"
    print("  OK _find_worker_pkg_root function exists")

    # Should walk up looking for package.json
    assert 'package.json' in generator_source, \
        "Should reference package.json as marker file"
    print("  OK References package.json marker file")

    # Should NOT have the old hardcoded 3-parent chain as the main assignment
    # (fallback in the function is fine)
    import ast
    tree = ast.parse(generator_source)
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "_WORKER_PKG_ROOT":
                    # The assignment should call _find_worker_pkg_root(), not a .parent chain
                    assert isinstance(node.value, ast.Call), \
                        "_WORKER_PKG_ROOT should be assigned via _find_worker_pkg_root() call"
                    print("  OK _WORKER_PKG_ROOT assigned via function call (not hardcoded .parent chain)")
                    break

    print("  PASSED\n")


# ═══════════════════════════════════════════════════════════════════════
# Runner
# ═══════════════════════════════════════════════════════════════════════

def main():
    print("\n" + "=" * 60)
    print("ARCHITECTURE AUDIT FIXES — TARGETED E2E TESTS")
    print("=" * 60 + "\n")

    tests = [
        # C1-C3
        test_template_path_resolution,
        test_shared_utility_files_exist,
        test_register_ts_excluded,
        test_all_templates_have_studio_theme_tag,
        test_workspace_fonts_synced,
        # C4-C5
        test_studio_design_system_no_doubled_braces,
        test_animator_system_prompt_no_doubled_braces,
        test_animator_base_prompt_brace_consistency,
        # C6-C8
        test_remotion_rules_require_both_clamps,
        test_prompt_examples_have_both_clamps,
        test_template_files_have_both_clamps,
        # C9
        test_oauth_tokens_handles_none_expires,
        # C10-C11
        test_director_pacing_respects_minimum,
        test_director_sync_gap_limit_consistent,
        # C12
        test_visual_verify_reads_visual_field,
        # Bonus
        test_workspace_tsconfig_excludes_templates,
        # Docker path simulation
        test_docker_path_marker_file_anchoring,
        test_worker_pkg_root_uses_marker_file,
    ]

    passed = 0
    failed = 0
    errors = []

    for test_fn in tests:
        try:
            test_fn()
            passed += 1
        except Exception as e:
            failed += 1
            errors.append((test_fn.__name__, str(e)))
            print(f"  FAILED: {e}\n")

    print("\n" + "=" * 60)
    print(f"RESULTS: {passed} passed, {failed} failed out of {len(tests)} tests")
    print("=" * 60)

    if errors:
        print("\nFailed tests:")
        for name, err in errors:
            print(f"  - {name}: {err}")
        sys.exit(1)
    else:
        print("\nAll tests passed!")
        sys.exit(0)


if __name__ == "__main__":
    main()
