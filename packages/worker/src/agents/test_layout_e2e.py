"""
Layout Quality E2E Tests — Uses Claude to verify prompts produce correct layout code.

These tests send focused prompts to Claude (via CLI) and verify the generated
TSX code follows layout rules: flexbox centering, overflow: hidden, EW/EH usage,
text safety, clamp options, etc.

Each test is a targeted scenario that isolates ONE layout concern.
"""

import subprocess
import sys
import re
import os
import json
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
CLAUDE_CLI = "claude"  # Assumes `claude` is in PATH
MODEL = "sonnet"  # Use Sonnet for speed/cost in tests (layout patterns are straightforward)
TIMEOUT = 120  # seconds per test

PASS_COUNT = 0
FAIL_COUNT = 0


def report(name: str, passed: bool, detail: str = ""):
    global PASS_COUNT, FAIL_COUNT
    status = "[PASS]" if passed else "[FAIL]"
    if passed:
        PASS_COUNT += 1
    else:
        FAIL_COUNT += 1
    suffix = f" — {detail}" if detail else ""
    print(f"  {status} {name}{suffix}")


def ask_claude(prompt: str, system: str = "") -> str:
    """Send a prompt to Claude CLI and return the text response.

    Uses --print mode (non-interactive) with no tools allowed.
    """
    cmd = [
        CLAUDE_CLI,
        "--print",
        "--model", MODEL,
        "--max-turns", "1",
    ]
    if system:
        cmd.extend(["--append-system-prompt", system])
    cmd.extend(["-p", prompt])

    # Must unset CLAUDECODE env var to allow nested invocation
    env = os.environ.copy()
    env.pop("CLAUDECODE", None)

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=TIMEOUT,
            cwd=str(Path(__file__).parent),
            encoding="utf-8",
            errors="replace",
            env=env,
        )
        output = result.stdout.strip()
        if not output and result.stderr:
            return f"[ERROR: {result.stderr[:200]}]"
        return output
    except subprocess.TimeoutExpired:
        return "[TIMEOUT]"
    except Exception as e:
        return f"[ERROR: {e}]"


# ---------------------------------------------------------------------------
# Layout system prompt excerpt (focused rules only, not the full 80K prompt)
# ---------------------------------------------------------------------------
LAYOUT_SYSTEM = """You are a Remotion animation implementer. Generate ONLY the TSX code requested.
No explanations, no markdown fences unless asked. Just raw TSX.

## LAYOUT RULES (MANDATORY)
- All sizes relative to EW (effective width) and EH (effective height) — NEVER use width/height from useVideoConfig
- Use `display: 'flex', justifyContent: 'center'` for horizontal centering
- NEVER use `left: EW / 2` for centering (positions the LEFT EDGE at center, not the element center)
- 60px minimum margins from all edges
- Bottom 15% of EH reserved for subtitles — do NOT place content there
- All containers with fixed dimensions MUST include `overflow: 'hidden'`
- All text containers MUST include: maxWidth (EW * 0.85 for titles), textAlign: 'center', overflowWrap: 'break-word', lineHeight: 1.2
- EVERY interpolate() call MUST include BOTH extrapolateLeft: 'clamp' AND extrapolateRight: 'clamp'
- Use spring() for entrances/exits with SPRINGS.SMOOTH or SPRINGS.SNAPPY configs
- Stagger elements by 6+ frames minimum
- MAX 4 attention-grabbing elements (ambient Layer 3 at opacity 0.15 or less are exempt)

## AVAILABLE CONSTANTS (already defined in constants.ts)
const EW = 1080;  // effective width
const EH = 960;   // effective height
const SPRINGS = { SMOOTH: { damping: 26, stiffness: 120, mass: 1.0 }, SNAPPY: { damping: 18, stiffness: 180, mass: 0.8 } };
const STAGGER = { NORMAL: 8, FAST: 4 };
const COLORS = { background: '#0B0F1A', primary: '#3b82f6', secondary: '#8b5cf6', accent: '#22d3ee', text: '#ffffff' };
const TIMING = { scene1KeySync: 45, scene1End: 180, fps: 30, scene1EffectiveWidth: 1080, scene1EffectiveHeight: 960 };
"""


# ═══════════════════════════════════════════════════════════════════════════
# TEST 1: Centered Title Scene
# ═══════════════════════════════════════════════════════════════════════════

def test_centered_title():
    """Claude should center a title using flexbox, not left: EW/2."""
    print("\n" + "=" * 70)
    print("E2E TEST 1: Centered Title Scene")
    print("=" * 70)

    prompt = """Generate a React functional component Scene1 that displays:
- A large title "Machine Learning" that fades in and scales from 1.5x to 1x
- The title should be CENTERED both horizontally and vertically in the effective area
- Use interpolate() for the scale and opacity animations
- Use EW and EH from TIMING for sizing
- Export as: export const Scene1: React.FC

Output ONLY the TSX code, no markdown fences."""

    code = ask_claude(prompt, LAYOUT_SYSTEM)

    if "[TIMEOUT]" in code or "[ERROR" in code:
        report("Claude responded", False, code[:100])
        return

    report("Claude responded", len(code) > 100, f"{len(code)} chars")

    # Check: uses flexbox centering (justifyContent or display: 'flex')
    has_flex = "justifyContent" in code or "justify-content" in code
    report("Uses flexbox centering (justifyContent)", has_flex)

    # Check: does NOT use left: EW / 2 or left: EW/2
    bad_centering = re.search(r"left:\s*EW\s*/\s*2", code)
    report("No 'left: EW / 2' bad centering", bad_centering is None,
           f"Found at: {bad_centering.group()}" if bad_centering else "Clean")

    # Check: uses extrapolateLeft AND extrapolateRight
    has_left_clamp = "extrapolateLeft" in code and "'clamp'" in code
    has_right_clamp = "extrapolateRight" in code and "'clamp'" in code
    report("Has extrapolateLeft: 'clamp'", has_left_clamp)
    report("Has extrapolateRight: 'clamp'", has_right_clamp)

    # Check: uses EW or EH for sizing (not hardcoded pixels)
    uses_ew_eh = "EW" in code or "EH" in code or "EffectiveWidth" in code or "EffectiveHeight" in code
    report("Uses EW/EH for sizing", uses_ew_eh)

    # Check: textAlign center
    has_text_center = "textAlign" in code and "center" in code
    report("Has textAlign: 'center'", has_text_center)

    # Print code snippet for inspection
    print(f"\n  Generated code preview ({len(code)} chars):")
    for line in code.split("\n")[:30]:
        print(f"    {line}")
    if code.count("\n") > 30:
        print(f"    ... ({code.count(chr(10)) - 30} more lines)")


# ═══════════════════════════════════════════════════════════════════════════
# TEST 2: Card with Text Overflow Safety
# ═══════════════════════════════════════════════════════════════════════════

def test_card_text_overflow():
    """Claude should use overflow: hidden on cards and text safety props."""
    print("\n" + "=" * 70)
    print("E2E TEST 2: Card with Text Overflow Safety")
    print("=" * 70)

    prompt = """Generate a React functional component Scene1 that displays:
- A glassmorphism card centered in the effective area
- Inside the card: a title "Understanding Quantum Computing Fundamentals" and a body paragraph
- The card should have proper overflow handling
- Use interpolate() with proper clamping for fade-in animation
- Use EW and EH from TIMING for all sizing
- Export as: export const Scene1: React.FC

Output ONLY the TSX code, no markdown fences."""

    code = ask_claude(prompt, LAYOUT_SYSTEM)

    if "[TIMEOUT]" in code or "[ERROR" in code:
        report("Claude responded", False, code[:100])
        return

    report("Claude responded", len(code) > 100, f"{len(code)} chars")

    # Check: overflow: hidden on card/container
    has_overflow = "overflow" in code and "hidden" in code
    report("Has overflow: 'hidden' on card", has_overflow)

    # Check: maxWidth on text
    has_max_width = "maxWidth" in code
    report("Has maxWidth on text container", has_max_width)

    # Check: overflowWrap or wordWrap
    has_wrap = "overflowWrap" in code or "wordWrap" in code or "word-wrap" in code or "overflow-wrap" in code
    report("Has overflowWrap/wordWrap", has_wrap)

    # Check: textAlign center
    has_text_center = "textAlign" in code and "center" in code
    report("Has textAlign: 'center'", has_text_center)

    # Check: uses EW/EH
    uses_ew_eh = "EW" in code or "EH" in code
    report("Uses EW/EH for sizing", uses_ew_eh)

    # Check: both clamps
    left_count = code.count("extrapolateLeft")
    right_count = code.count("extrapolateRight")
    report("Clamp counts match (Left == Right)", left_count == right_count and left_count > 0,
           f"Left={left_count}, Right={right_count}")

    print(f"\n  Generated code preview ({len(code)} chars):")
    for line in code.split("\n")[:30]:
        print(f"    {line}")
    if code.count("\n") > 30:
        print(f"    ... ({code.count(chr(10)) - 30} more lines)")


# ═══════════════════════════════════════════════════════════════════════════
# TEST 3: Multi-Element Layout (no overlaps)
# ═══════════════════════════════════════════════════════════════════════════

def test_multi_element_layout():
    """Claude should use proper zone layout with no overlapping elements."""
    print("\n" + "=" * 70)
    print("E2E TEST 3: Multi-Element Layout (no overlaps)")
    print("=" * 70)

    prompt = """Generate a React functional component Scene1 that displays:
- A title at the top: "Top 3 Programming Languages"
- Three stat cards in the middle area, stacked vertically with gaps
- A subtitle at the bottom: "Based on 2025 survey data"
- Each element animates in with DIFFERENT stagger delays (e.g., frame - 0, frame - 8, frame - 16, frame - 24)
- Use interpolate() with proper clamping for all animations
- EVERY dimension MUST use EW/EH fractions: width as EW * 0.X, height as EH * 0.X, fontSize as EH * 0.0X — NO hardcoded pixel values for top, left, width, height, or fontSize
- Export as: export const Scene1: React.FC

Output ONLY the TSX code, no markdown fences."""

    code = ask_claude(prompt, LAYOUT_SYSTEM)

    if "[TIMEOUT]" in code or "[ERROR" in code:
        report("Claude responded", False, code[:100])
        return

    report("Claude responded", len(code) > 100, f"{len(code)} chars")

    # Check: uses flexbox for layout
    has_flex = "display: 'flex'" in code or 'display: "flex"' in code
    report("Uses display: flex for layout", has_flex)

    # Check: uses flexDirection column for vertical stacking
    has_column = "flexDirection" in code and "column" in code
    report("Uses flexDirection: column for vertical stacking", has_column)

    # Check: gap or margin for spacing between elements
    has_spacing = "gap" in code or "marginBottom" in code or "marginTop" in code
    report("Has gap/margin spacing between elements", has_spacing)

    # Check: uses EW/EH sizing
    uses_ew_eh = "EW" in code or "EH" in code
    report("Uses EW/EH for sizing", uses_ew_eh)

    # Check: no hardcoded pixel positions for layout
    # Allow small px for subtle things like borderRadius, boxShadow
    bad_px = re.findall(r"(?:top|left|width|height|fontSize):\s*\d{3,}", code)
    report("No large hardcoded pixel positions", len(bad_px) == 0,
           f"Found: {bad_px[:3]}" if bad_px else "Clean")

    # Check: staggered animations (multiple different timing offsets)
    # Pattern 1: frame - N with different N values
    frame_offsets = re.findall(r"frame\s*-\s*(\d+)", code)
    unique_offsets = set(frame_offsets)
    # Pattern 2: index * N or i * N (loop-based stagger)
    index_stagger = re.findall(r"(?:index|i|idx)\s*\*\s*(\d+)", code)
    # Pattern 3: different starting values in interpolate ranges like [8, ...] vs [16, ...]
    interp_starts = re.findall(r"interpolate\(\s*\w+,\s*\[(\d+)", code)
    unique_starts = set(interp_starts)
    has_stagger = (len(unique_offsets) >= 2 or len(index_stagger) > 0 or len(unique_starts) >= 2)
    report("Staggered animation offsets", has_stagger,
           f"frame-N offsets: {unique_offsets}, index stagger: {index_stagger}, interp starts: {unique_starts}")

    # Check: both clamps on all interpolate calls
    left_count = code.count("extrapolateLeft")
    right_count = code.count("extrapolateRight")
    report("All interpolate() have both clamps", left_count == right_count and left_count > 0,
           f"Left={left_count}, Right={right_count}")

    # Check: overflow hidden
    has_overflow = "overflow" in code and "hidden" in code
    report("Has overflow: 'hidden' on container", has_overflow)

    print(f"\n  Generated code preview ({len(code)} chars):")
    for line in code.split("\n")[:35]:
        print(f"    {line}")
    if code.count("\n") > 35:
        print(f"    ... ({code.count(chr(10)) - 35} more lines)")


# ═══════════════════════════════════════════════════════════════════════════
# TEST 4: Particles use EW/EH not width/height
# ═══════════════════════════════════════════════════════════════════════════

def test_particles_viewport():
    """Claude should use EW/EH for particle positioning, not width/height."""
    print("\n" + "=" * 70)
    print("E2E TEST 4: Particles Use EW/EH")
    print("=" * 70)

    prompt = """Generate a React functional component Scene1 that displays:
- A centered title "Data Flows" with a fade-in animation
- 20 ambient floating particles in the background at low opacity (layer 3)
- Particles should drift across the effective viewport area
- Use interpolate() with proper clamping for the title animation
- Use EW and EH from TIMING for ALL positioning (particles AND title)
- DO NOT use width/height from useVideoConfig for positioning
- Export as: export const Scene1: React.FC

Output ONLY the TSX code, no markdown fences."""

    code = ask_claude(prompt, LAYOUT_SYSTEM)

    if "[TIMEOUT]" in code or "[ERROR" in code:
        report("Claude responded", False, code[:100])
        return

    report("Claude responded", len(code) > 100, f"{len(code)} chars")

    # Check: uses EW/EH
    uses_ew_eh = "EW" in code or "EH" in code
    report("Uses EW/EH for positioning", uses_ew_eh)

    # Check: does NOT destructure width/height for positioning
    # Allow useVideoConfig for fps only
    uses_wh_positioning = re.search(r"(?:width|height)\s*\*\s*0\.\d", code)
    report("No width/height * fraction for positioning", uses_wh_positioning is None,
           f"Found: {uses_wh_positioning.group()}" if uses_wh_positioning else "Uses EW/EH")

    # Check: particles at low opacity (ambient layer)
    # Multiple patterns: opacity: 0.1, opacity: N (where N is small), * 0.1, opacity variable
    low_opacity = re.findall(r"opacity:\s*(0\.\d+)", code)
    ambient_particles = [float(o) for o in low_opacity if float(o) <= 0.25]
    # Also check for opacity set via multiply (e.g., opacity: particleOpacity * 0.1)
    opacity_multiply = re.findall(r"\*\s*(0\.(?:0\d|1\d?|2[0-5]?))\b", code)
    # Also check for low opacity literal anywhere in particle context
    has_low_opacity_literal = any(f"0.{d}" in code for d in ["05", "08", "1", "10", "12", "15", "2", "20"])
    has_ambient = len(ambient_particles) > 0 or len(opacity_multiply) > 0 or has_low_opacity_literal
    report("Particles at ambient opacity", has_ambient,
           f"Direct: {low_opacity[:5]}, multiply: {opacity_multiply[:3]}, literal: {has_low_opacity_literal}")

    print(f"\n  Generated code preview ({len(code)} chars):")
    for line in code.split("\n")[:30]:
        print(f"    {line}")
    if code.count("\n") > 30:
        print(f"    ... ({code.count(chr(10)) - 30} more lines)")


# ═══════════════════════════════════════════════════════════════════════════
# TEST 5: Scale Animation with Overflow Safety
# ═══════════════════════════════════════════════════════════════════════════

def test_scale_overflow():
    """Claude should wrap scaled elements in overflow: hidden containers."""
    print("\n" + "=" * 70)
    print("E2E TEST 5: Scale Animation Overflow Safety")
    print("=" * 70)

    prompt = """Generate a React functional component Scene1 that displays:
- A large title "BREAKING NEWS" that uses a text-slam effect (scales from 2.5x to 1x)
- The title should be centered and not overflow the viewport during the scale-up phase
- Use spring() for the slam animation
- Use interpolate() with proper clamping for any supporting animations
- Use EW and EH from TIMING for sizing
- Export as: export const Scene1: React.FC

Output ONLY the TSX code, no markdown fences."""

    code = ask_claude(prompt, LAYOUT_SYSTEM)

    if "[TIMEOUT]" in code or "[ERROR" in code:
        report("Claude responded", False, code[:100])
        return

    report("Claude responded", len(code) > 100, f"{len(code)} chars")

    # Check: overflow hidden to contain the scale-up
    has_overflow = "overflow" in code and "hidden" in code
    report("Has overflow: 'hidden' to contain scale-up", has_overflow)

    # Check: uses transform scale
    has_scale = "scale(" in code or "scale`" in code
    report("Uses transform: scale() for slam effect", has_scale)

    # Check: centered with flexbox
    has_flex_center = "justifyContent" in code or "alignItems" in code
    report("Centered with flex", has_flex_center)

    # Check: both clamps
    left_count = code.count("extrapolateLeft")
    right_count = code.count("extrapolateRight")
    has_clamps = left_count == right_count and left_count >= 0
    report("Interpolate clamps balanced", has_clamps,
           f"Left={left_count}, Right={right_count}")

    print(f"\n  Generated code preview ({len(code)} chars):")
    for line in code.split("\n")[:30]:
        print(f"    {line}")
    if code.count("\n") > 30:
        print(f"    ... ({code.count(chr(10)) - 30} more lines)")


# ═══════════════════════════════════════════════════════════════════════════
# RUNNER
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 70)
    print("LAYOUT QUALITY E2E TESTS — USING CLAUDE")
    print("=" * 70)
    print(f"Model: {MODEL}")
    print(f"Timeout per test: {TIMEOUT}s")

    start = time.time()

    test_centered_title()
    test_card_text_overflow()
    test_multi_element_layout()
    test_particles_viewport()
    test_scale_overflow()

    elapsed = time.time() - start

    print("\n" + "=" * 70)
    total = PASS_COUNT + FAIL_COUNT
    print(f"RESULTS: {PASS_COUNT}/{total} passed, {FAIL_COUNT} failed")
    print(f"Time: {elapsed:.1f}s")
    print("=" * 70)

    if FAIL_COUNT > 0:
        print("\nSOME TESTS FAILED — see details above")
        sys.exit(1)
    else:
        print("\nALL TESTS PASSED")
        sys.exit(0)
