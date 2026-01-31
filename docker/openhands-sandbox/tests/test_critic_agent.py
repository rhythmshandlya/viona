#!/usr/bin/env python3
"""
Test Real Critic Agent Evaluation

This test:
1. Creates a mock visual component (pre-generated)
2. Runs the REAL critic agent with an LLM to evaluate it
3. Returns actual scores based on visual inspection

Requires: GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY

Usage:
  GEMINI_API_KEY=xxx python /opt/openhands/tests/test_critic_agent.py
  ANTHROPIC_API_KEY=xxx python /opt/openhands/tests/test_critic_agent.py --model claude-3-5-sonnet
"""

import argparse
import json
import os
import sys
from pathlib import Path

# Add tools to path
sys.path.insert(0, "/opt/openhands")

# Use the actual Remotion template directory which has node_modules, package.json, etc.
WORKSPACE = "/opt/remotion-template"
PROJECT_ID = "proj-critic-test"

# Colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"


def log(msg: str, color: str = ""):
    print(f"{color}{msg}{RESET}")


def create_test_component(quality: str = "good"):
    """Create a test component with varying quality levels."""

    project_dir = Path(WORKSPACE) / "src" / PROJECT_ID
    project_dir.mkdir(parents=True, exist_ok=True)

    if quality == "good":
        # Well-structured component with smooth animations
        code = '''import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from 'remotion';

const AnimatedText: React.FC<{ text: string; delay: number }> = ({ text, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [delay, delay + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        fontSize: 64,
        fontWeight: 700,
        color: '#ffffff',
        textShadow: '0 4px 20px rgba(0,0,0,0.5)',
        fontFamily: 'Roboto, sans-serif',
      }}
    >
      {text}
    </div>
  );
};

export const CriticTestVisual: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const backgroundHue = interpolate(frame, [0, durationInFrames], [220, 280]);
  const progress = interpolate(frame, [0, durationInFrames], [0, 100]);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg,
          hsl(${backgroundHue}, 70%, 8%) 0%,
          hsl(${backgroundHue + 40}, 60%, 15%) 100%)`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Sequence from={0} durationInFrames={90}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <AnimatedText text="Welcome to Clipify" delay={0} />
        </AbsoluteFill>
      </Sequence>

      <Sequence from={60} durationInFrames={90}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', marginTop: 100 }}>
          <div style={{ fontSize: 28, color: 'rgba(255,255,255,0.7)', fontFamily: 'Open Sans' }}>
            AI-Powered Visual Generation
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 50,
          left: '10%',
          width: '80%',
          height: 4,
          backgroundColor: 'rgba(255,255,255,0.2)',
          borderRadius: 2,
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            backgroundColor: '#6366f1',
            borderRadius: 2,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

export default CriticTestVisual;
'''
    elif quality == "average":
        # Basic component with minimal animations
        code = '''import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';

export const CriticTestVisual: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ opacity, color: 'white', fontSize: 48 }}>
        Hello World
      </div>
    </AbsoluteFill>
  );
};

export default CriticTestVisual;
'''
    else:  # bad
        # Poor quality - static, no animations
        code = '''import React from 'react';
import { AbsoluteFill } from 'remotion';

export const CriticTestVisual: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      <div style={{ color: 'white', fontSize: 24, padding: 20 }}>
        Text here
      </div>
    </AbsoluteFill>
  );
};

export default CriticTestVisual;
'''

    # Write component
    (project_dir / "index.tsx").write_text(code)

    # Write metadata
    metadata = {
        "compositionId": PROJECT_ID,
        "durationInFrames": 150,
        "fps": 30,
        "width": 1920,
        "height": 1080,
    }
    (project_dir / "metadata.json").write_text(json.dumps(metadata, indent=2))

    log(f"  Created {quality} quality component in src/{PROJECT_ID}/", GREEN)
    return True


def generate_root():
    """Generate Root.tsx."""
    from tools.root_generator import generate_and_write_root

    success, message, compositions = generate_and_write_root(WORKSPACE, PROJECT_ID)
    log(f"  {message}", GREEN if success else RED)
    return success


def run_critic_agent(model: str, api_key: str, base_url: str = None, quality: str = "good"):
    """Run the actual critic agent with an LLM."""

    log(f"\n{BLUE}Running Critic Agent with {model}...{RESET}")
    if base_url:
        log(f"  Using base URL: {base_url}")

    from pydantic import SecretStr
    from openhands.sdk import LLM

    # Import the create_visual_evaluator_agent and create_text_evaluator_agent functions
    from visual_generator import (
        create_visual_evaluator_agent,
        create_text_evaluator_agent,
        load_skill,
        CLAUDE_CONFIG,
        is_claude_model
    )
    from tools.submit_score import get_last_score, clear_last_score

    # Determine model name for litellm
    model_lower = model.lower()
    if base_url:
        # Using proxy - use openai provider format
        model_name = f"openai/{model}"
    elif "gemini" in model_lower:
        model_name = f"gemini/{model}"
    elif "claude" in model_lower:
        model_name = f"anthropic/{model}"
    elif "gpt" in model_lower:
        model_name = f"openai/{model}"
    else:
        model_name = model

    # Configure LLM
    llm = LLM(
        model=model_name,
        api_key=SecretStr(api_key),
        base_url=base_url,
    )

    # Configure condenser LLM (use same model for simplicity)
    condenser_llm = LLM(
        model=model_name,
        api_key=SecretStr(api_key),
        base_url=base_url,
        usage_id="condenser",  # Different usage_id to avoid collision
    )

    # Load scoring rubric
    skills_dir = Path("/opt/openhands/skills")
    scoring_rubric = load_skill(skills_dir / "scoring-rubric.md")

    # Use Claude config for Claude models
    config = CLAUDE_CONFIG if is_claude_model(model) else None

    # Create appropriate evaluator agent based on model
    if is_claude_model(model):
        # Use text-based evaluator for Claude (no screenshots)
        critic_agent = create_text_evaluator_agent(llm, scoring_rubric, condenser_llm=condenser_llm, config=config)
        log("  Using text-based evaluator (no screenshots)", BLUE)
    else:
        # Use visual evaluator for other models (with screenshots)
        critic_agent = create_visual_evaluator_agent(llm, scoring_rubric, condenser_llm=condenser_llm, config=config)

    # Clear any previous score
    clear_last_score()

    # Run critic
    from openhands.sdk import Conversation

    duration_frames = 150
    fps = 30
    mid_frame = duration_frames // 2

    # Use appropriate max iterations for the model
    max_iterations = 15  # Same for both now with text-based evaluation

    # Create conversation with appropriate iteration limit
    conversation = Conversation(agent=critic_agent, workspace=WORKSPACE, max_iteration_per_run=max_iterations)

    # For Claude: Use text-based evaluation with code included in prompt
    if is_claude_model(model):
        # Read the actual code for text-based evaluation
        project_dir = Path(WORKSPACE) / "src" / PROJECT_ID
        code_path = project_dir / "index.tsx"
        code_content = code_path.read_text() if code_path.exists() else "// Code not found"

        critic_prompt = f"""Evaluate visual quality using TEXT-BASED REASONING. Analyze the code below.

## Source Code (src/{PROJECT_ID}/index.tsx):
```tsx
{code_content}
```

## Evaluation Criteria (analyze the code above):

### Animation Quality (0-30 points):
- spring() usage: Look for `spring({{` patterns with damping/stiffness config
- interpolate() usage: Look for frame-based interpolation with easing
- Staggering: Look for `delay = index * N` or incremental delay patterns
- Sequence components: Look for `<Sequence from={{N}}` for choreography

### Background Motion (0-15 points):
- Animated gradients: Look for `hsl({{frame}}` or interpolated colors
- Particles: Look for mapped arrays with position animations
- Continuous motion: Look for frame-based transforms on background elements

### Visual Effects (0-25 points):
- Scale animations: Look for `transform: \`scale(${{...}})\``
- Counter animations: Look for number interpolation (counting up/down)
- Draw/reveal effects: Look for clipPath or strokeDashoffset animations
- NOT just opacity fades

## Score the Code:
- 60-70: Uses spring(), staggering, background motion, multiple animation types
- 45-59: Uses spring() OR staggering, some variety beyond fades
- 30-44: Basic interpolate() animations, mostly fades
- 0-29: Static or minimal animation

IMMEDIATELY call SubmitScoreTool with your analysis:
- visual_quality (0-70): Based on code patterns found above
- correctness: 10 (code compiles)
- completeness: 10 (assume complete)
- code_quality: 10 (assume good)
- issues: List 1-3 specific missing animation patterns
- suggestion: One specific improvement with code example

YOU MUST CALL SubmitScoreTool - this is the ONLY way to complete your task."""

        prompt_words = len(critic_prompt.split())
        log(f"  Text eval: code={len(code_content)} chars, prompt={prompt_words} words", BLUE)
    else:
        critic_prompt = f"""Evaluate visual quality for composition "{PROJECT_ID}".

STEP 1: Render 1 screenshot with RemotionRenderStillTool (composition_id="{PROJECT_ID}", frame=0)

STEP 2: IMMEDIATELY call SubmitScoreTool with:
- visual_quality (0-70): How good do visuals look?
- correctness: 10 (code compiles)
- completeness: 10 (assume complete)
- code_quality: 10 (assume good)
- issues: List any visual problems
- suggestion: One improvement

YOU MUST CALL SubmitScoreTool - this is the ONLY way to complete your task.
If screenshots fail, submit score anyway with visual_quality=50 and note the issue."""

    log("  Sending prompt to critic agent...", BLUE)

    try:
        conversation.send_message(critic_prompt)
        conversation.run()
        log("  Critic agent completed", GREEN)
    except Exception as e:
        log(f"  Critic agent failed: {e}", RED)
        return None

    # Get the score
    score_result = get_last_score()

    if score_result:
        return score_result
    else:
        log("  Warning: SubmitScoreTool was not called", YELLOW)
        return None


def main():
    parser = argparse.ArgumentParser(description="Test Real Critic Agent")
    parser.add_argument("--model", default="gemini-2.0-flash-exp", help="LLM model to use")
    parser.add_argument("--base-url", default=None, help="LLM API base URL (for proxy). Use port 8082 for tool-name-fixer.")
    parser.add_argument("--quality", choices=["good", "average", "bad"], default="good",
                       help="Quality level of test component")
    args = parser.parse_args()

    # Find API key
    api_key = (
        os.environ.get("GEMINI_API_KEY") or
        os.environ.get("ANTHROPIC_API_KEY") or
        os.environ.get("OPENAI_API_KEY") or
        os.environ.get("LLM_API_KEY") or
        "not-needed"  # For proxy that doesn't require key
    )

    # Check for base URL from env
    # Default to port 8082 (tool-name-fixer) for Claude models via proxy
    base_url = args.base_url or os.environ.get("LLM_BASE_URL")

    # Auto-detect: if using Claude model without explicit base_url, use tool-name-fixer port
    if base_url and ":8317" in base_url and "claude" in args.model.lower():
        log(f"  Note: Switching from port 8317 to 8082 (tool-name-fixer) for Claude", YELLOW)
        base_url = base_url.replace(":8317", ":8082")

    log(f"\n{BLUE}{'='*60}{RESET}")
    log(f"{BLUE}  CRITIC AGENT EVALUATION TEST{RESET}")
    log(f"{BLUE}{'='*60}{RESET}")
    log(f"  Model: {args.model}")
    log(f"  Base URL: {base_url or 'default'}")
    log(f"  Component Quality: {args.quality}")

    # Step 1: Create test component
    log(f"\n{BLUE}Step 1: Creating Test Component{RESET}")
    create_test_component(args.quality)

    # Step 2: Generate Root.tsx
    log(f"\n{BLUE}Step 2: Generating Root.tsx{RESET}")
    if not generate_root():
        return 1

    # Step 3: Run critic agent
    log(f"\n{BLUE}Step 3: Running Critic Agent{RESET}")
    score_result = run_critic_agent(args.model, api_key, base_url, args.quality)

    # Results
    log(f"\n{BLUE}{'='*60}{RESET}")
    log(f"{BLUE}  RESULTS{RESET}")
    log(f"{BLUE}{'='*60}{RESET}")

    if score_result:
        score = score_result.get("score", 0)
        breakdown = score_result.get("breakdown", {})
        issues = score_result.get("issues", [])
        suggestion = score_result.get("suggestion", "")

        log(f"\n  SCORE: {score}/100", GREEN if score >= 90 else YELLOW if score >= 70 else RED)
        log(f"\n  Breakdown:")
        log(f"    - Visual Quality: {breakdown.get('visualQuality', 0)}/70")
        log(f"    - Correctness:    {breakdown.get('correctness', 0)}/10")
        log(f"    - Completeness:   {breakdown.get('completeness', 0)}/10")
        log(f"    - Code Quality:   {breakdown.get('codeQuality', 0)}/10")

        if issues:
            log(f"\n  Issues:")
            for issue in issues:
                log(f"    - {issue}")

        if suggestion:
            log(f"\n  Suggestion: {suggestion}")

        # Pass/fail
        if score >= 90:
            log(f"\n{GREEN}  PASSED{RESET}")
        else:
            log(f"\n{YELLOW}  BELOW THRESHOLD (need 90+){RESET}")
    else:
        log(f"\n{RED}  FAILED - No score returned{RESET}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
