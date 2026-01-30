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

WORKSPACE = "/workspace"
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


def run_critic_agent(model: str, api_key: str):
    """Run the actual critic agent with an LLM."""

    log(f"\n{BLUE}Running Critic Agent with {model}...{RESET}")

    from pydantic import SecretStr
    from openhands.sdk import LLM

    # Import the create_critic_agent function
    from visual_generator import create_critic_agent, load_skill
    from tools.submit_score import get_last_score, clear_last_score

    # Determine model name for litellm
    model_lower = model.lower()
    if "gemini" in model_lower:
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
    )

    # Load scoring rubric
    skills_dir = Path("/opt/openhands/skills")
    scoring_rubric = load_skill(skills_dir / "scoring-rubric.md")

    # Create critic agent
    critic_agent = create_critic_agent(llm, scoring_rubric)

    # Clear any previous score
    clear_last_score()

    # Run critic
    from openhands.sdk import Conversation

    conversation = Conversation(agent=critic_agent, workspace=WORKSPACE)

    duration_frames = 150
    fps = 30
    mid_frame = duration_frames // 2
    end_frame = duration_frames - 10

    critic_prompt = f"""Evaluate the Remotion project at src/{PROJECT_ID}/.

Follow these steps:

1. **TypeScript Validation**: Run TypeScriptValidatorTool on path "src/{PROJECT_ID}"
2. **Bundle Validation**: Run RemotionBundleTool with entry_point="src/index.tsx"
3. **Visual Inspection**: Run RemotionRenderStillTool for composition_id="{PROJECT_ID}" at frames:
   - Frame 0 (start)
   - Frame {mid_frame} (middle)
   - Frame {end_frame} (near end)
4. **Review the rendered images** - Are they visually appealing? Smooth animations?
5. **Check metadata.json** in src/{PROJECT_ID}/

IMPORTANT: After evaluation, you MUST call SubmitScoreTool with your scores.

SCORING WEIGHTS (total = 100):
- visual_quality (0-70): 70% weight - MOST IMPORTANT!
- correctness (0-10): 10% weight
- completeness (0-10): 10% weight
- code_quality (0-10): 10% weight

Focus on VISUAL QUALITY - do the animations look professional and smooth?"""

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
    parser.add_argument("--quality", choices=["good", "average", "bad"], default="good",
                       help="Quality level of test component")
    args = parser.parse_args()

    # Find API key
    api_key = (
        os.environ.get("GEMINI_API_KEY") or
        os.environ.get("ANTHROPIC_API_KEY") or
        os.environ.get("OPENAI_API_KEY") or
        os.environ.get("LLM_API_KEY")
    )

    if not api_key:
        log("ERROR: No API key found. Set GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY", RED)
        return 1

    log(f"\n{BLUE}{'='*60}{RESET}")
    log(f"{BLUE}  CRITIC AGENT EVALUATION TEST{RESET}")
    log(f"{BLUE}{'='*60}{RESET}")
    log(f"  Model: {args.model}")
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
    score_result = run_critic_agent(args.model, api_key)

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
