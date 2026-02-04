#!/usr/bin/env python3
"""
Claude Code Visual Generator

Generates Remotion video compositions using Claude Agent SDK with OAuth authentication.
Uses Claude Pro/Max subscription (no API key costs).

Reference: Auto-Claude apps/backend/core/auth.py, client.py
"""

import asyncio
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any

# Claude Agent SDK imports
try:
    from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
    from claude_agent_sdk.types import HookMatcher
except ImportError:
    print("Error: claude-agent-sdk package not installed. Run: pip install claude-agent-sdk")
    sys.exit(1)


# =============================================================================
# Security Hook (Reference: Auto-Claude apps/backend/core/client.py)
# =============================================================================


def is_safe_npm_command(command: str) -> bool:
    """
    Check if a bash command is a safe npm/npx command.

    Rejects commands with shell chaining operators to prevent bypass attacks.
    The sandbox mode provides defense-in-depth for edge cases.
    """
    ALLOWED_PREFIXES = ["npm ", "npx ", "npm.cmd ", "npx.cmd "]
    FORBIDDEN_OPERATORS = ["&&", "||", ";", "|", "`", "$(", "${"]

    stripped = command.strip()

    # Must start with allowed prefix
    if not any(stripped.startswith(prefix) for prefix in ALLOWED_PREFIXES):
        return False

    # Must not contain chaining operators
    if any(op in command for op in FORBIDDEN_OPERATORS):
        return False

    return True


async def bash_security_hook(
    input_data: dict,
    tool_use_id: str | None = None,
    context: Any = None,
) -> dict:
    """
    Security hook to restrict Bash commands to npm/npx only.

    Prevents arbitrary command execution while allowing TypeScript/Remotion tooling.
    Defense-in-depth: sandbox mode provides additional protection.
    """
    if input_data.get("tool_name") != "Bash":
        return {}

    command = input_data.get("tool_input", {}).get("command", "")

    if is_safe_npm_command(command):
        return {}

    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": f"Only safe npm/npx commands allowed. Got: {command[:100]}..."
        }
    }


# =============================================================================
# OAuth Authentication (Reference: Auto-Claude apps/backend/core/auth.py)
# =============================================================================


def get_oauth_token_from_credential_store() -> str | None:
    """
    Get OAuth token from Windows credential files.

    Claude Code on Windows stores credentials in ~/.claude/.credentials.json

    Reference: Auto-Claude apps/backend/core/auth.py lines 476-530
    """
    try:
        # Windows credential paths
        cred_paths = [
            os.path.expandvars(r"%USERPROFILE%\.claude\.credentials.json"),
            os.path.expandvars(r"%USERPROFILE%\.claude\credentials.json"),
            os.path.expandvars(r"%LOCALAPPDATA%\Claude\credentials.json"),
            os.path.expandvars(r"%APPDATA%\Claude\credentials.json"),
        ]

        for cred_path in cred_paths:
            if os.path.exists(cred_path):
                try:
                    with open(cred_path, encoding="utf-8") as f:
                        data = json.load(f)
                        token = data.get("claudeAiOauth", {}).get("accessToken")
                        if token and (
                            token.startswith("sk-ant-oat01-")
                            or token.startswith("enc:")
                        ):
                            return token
                except (json.JSONDecodeError, KeyError):
                    continue

        return None

    except Exception:
        return None


def require_oauth_token() -> str:
    """
    Get OAuth token or raise error with instructions.

    Reference: Auto-Claude apps/backend/core/auth.py lines 782-831
    """
    # Check environment variable first
    token = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN")
    if token and token.startswith("sk-ant-oat01-"):
        return token

    # Try credential store
    token = get_oauth_token_from_credential_store()
    if token:
        return token

    raise ValueError(
        "No OAuth token found.\n\n"
        "Claude Visual Generator requires Claude Pro/Max subscription.\n"
        "API keys (ANTHROPIC_API_KEY) are NOT supported.\n\n"
        "To authenticate:\n"
        "  1. Run: claude\n"
        "  2. Type: /login\n"
        "  3. Complete OAuth in browser\n"
    )


def configure_sdk_auth() -> None:
    """
    Configure environment for Claude Agent SDK authentication.

    Reference: Auto-Claude apps/backend/core/auth.py lines 951-999
    """
    token = require_oauth_token()
    os.environ["CLAUDE_CODE_OAUTH_TOKEN"] = token


# =============================================================================
# Skill and Code Example Injection
# =============================================================================


def get_condensed_skills() -> str:
    """
    Return condensed, essential skill content to inject directly into prompt.
    Agents don't reliably read skill files, so we inject critical patterns directly.
    """
    return """
## REQUIRED ANIMATION PATTERNS (USE THESE EXACTLY)

### Spring Configuration (ALWAYS use this)
```tsx
const SPRING_CONFIG = { damping: 22, stiffness: 90, mass: 0.9 };
// Usage:
const progress = spring({frame: frame - startFrame, fps, config: SPRING_CONFIG});
```

### Stagger Pattern (REQUIRED for multiple elements)
```tsx
// NEVER animate all elements at once. Always stagger by 6+ frames:
{items.map((item, i) => (
  <Element key={i} delay={i * 6} />
))}
```

### Glassmorphism (for cards/containers)
```tsx
const glassStyle = {
  background: 'rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
};
```

### Flowing Particles (for streams/rivers)
```tsx
const FlowingParticles: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  return (
    <>
      {Array.from({length: 30}).map((_, i) => {
        const x = ((frame * 2 + i * 50) % (width + 100)) - 50;
        const y = (height * 0.4) + Math.sin((frame + i * 20) * 0.03) * 50;
        return (
          <div key={i} style={{
            position: 'absolute', left: x, top: y,
            width: 16, height: 16, borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            opacity: 0.7,
          }} />
        );
      })}
    </>
  );
};
```

### Particle Emitter (for explosion/radial effects)
```tsx
const ParticleEmitter: React.FC<{count: number, startFrame: number}> = ({count, startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <>
      {Array.from({length: count}).map((_, i) => {
        const delay = i * 6;
        const progress = spring({frame: frame - startFrame - delay, fps, config: {damping: 22, stiffness: 90}});
        const angle = (i / count) * Math.PI * 2;
        const radius = progress * 100;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `calc(50% + ${Math.cos(angle) * radius}px)`,
            top: `calc(50% + ${Math.sin(angle) * radius}px)`,
            width: 8, height: 8,
            borderRadius: '50%',
            background: '#8b5cf6',
            opacity: interpolate(progress, [0, 0.8, 1], [0, 1, 0]),
          }} />
        );
      })}
    </>
  );
};
```

### Counter Animation (for numbers)
```tsx
const Counter: React.FC<{target: number, start: number}> = ({target, start}) => {
  const frame = useCurrentFrame();
  const value = Math.round(interpolate(
    frame - start, [0, 45], [0, target], {extrapolateRight: 'clamp'}
  ));
  return <span style={{fontVariantNumeric: 'tabular-nums'}}>{value}</span>;
};
```

### Scale Entrance (for appearing elements)
```tsx
const ScaleIn: React.FC<{startFrame: number, children: React.ReactNode}> = ({startFrame, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const scale = spring({frame: frame - startFrame, fps, config: {damping: 22, stiffness: 90}});
  return <div style={{transform: `scale(${scale})`}}>{children}</div>;
};
```

### Fade In Animation
```tsx
const FadeIn: React.FC<{startFrame: number, children: React.ReactNode}> = ({startFrame, children}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame - startFrame,
    [0, 20],
    [0, 1],
    {extrapolateRight: 'clamp'}
  );
  return <div style={{opacity}}>{children}</div>;
};
```

## PROHIBITED PATTERNS (NEVER DO THESE)

- Math.sin() or Math.cos() on text rotation/position (causes jittery text)
- damping < 20 in spring config (too bouncy)
- All elements animating at the same time (no stagger)
- Plain colored circles instead of proper visuals
- Instant teleportation (no animation)
- Static backgrounds with no motion
- Missing extrapolateRight: 'clamp' in interpolate()
"""


TECHNIQUE_CODE_EXAMPLES = {
    "particle-emitter": '''
// ParticleEmitter - Use for particle effects
const ParticleEmitter: React.FC<{count: number, startFrame: number}> = ({count, startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <>
      {Array.from({length: count}).map((_, i) => {
        const delay = i * 6;
        const progress = spring({frame: frame - startFrame - delay, fps, config: {damping: 22, stiffness: 90}});
        const angle = (i / count) * Math.PI * 2;
        const radius = progress * 100;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: `calc(50% + ${Math.cos(angle) * radius}px)`,
            top: `calc(50% + ${Math.sin(angle) * radius}px)`,
            width: 8, height: 8,
            borderRadius: '50%',
            background: '#8b5cf6',
            opacity: interpolate(progress, [0, 0.8, 1], [0, 1, 0]),
          }} />
        );
      })}
    </>
  );
};''',
    "glass-morphism": '''
// GlassCard - Glassmorphism container
const GlassCard: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  }}>
    {children}
  </div>
);''',
    "flowing-river": '''
// FlowingRiver - Animated data stream
const FlowingRiver: React.FC<{startFrame: number}> = ({startFrame}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const particles = Array.from({length: 50}).map((_, i) => {
    const speed = 2 + (i % 3);
    const yOffset = (i * 40) % height;
    const x = ((frame - startFrame) * speed + i * 30) % (width + 100) - 50;
    const y = yOffset + Math.sin((frame + i * 10) * 0.02) * 30;
    return (
      <div key={i} style={{
        position: 'absolute', left: x, top: y,
        width: 12 + (i % 8), height: 12 + (i % 8),
        borderRadius: '50%',
        background: `linear-gradient(135deg, #3b82f6, #8b5cf6)`,
        opacity: 0.6 + (i % 4) * 0.1,
      }} />
    );
  });
  return <>{particles}</>;
};''',
    "probability-gate": '''
// ProbabilityGate - Dice/spinner for random chance visualization
const ProbabilityGate: React.FC<{n: number, startFrame: number}> = ({n, startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const spinProgress = spring({frame: frame - startFrame, fps, config: {damping: 15, stiffness: 80}});
  const rotation = interpolate(spinProgress, [0, 1], [0, 720]);
  return (
    <div style={{
      width: 80, height: 80,
      background: 'linear-gradient(135deg, #22c55e, #3b82f6)',
      borderRadius: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transform: `rotate(${rotation}deg)`,
      boxShadow: '0 4px 20px rgba(34, 197, 94, 0.4)',
    }}>
      <span style={{fontSize: 24, fontWeight: 'bold', color: 'white'}}>1/{n}</span>
    </div>
  );
};''',
    "scale-spring": '''
// Scale spring entrance animation
const scaleEntrance = (frame: number, startFrame: number, fps: number) => {
  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 22, stiffness: 90, mass: 0.9 }
  });
  return progress;
};
// Usage: transform: `scale(${scaleEntrance(frame, 15, fps)})`''',
    "counter-animation": '''
// AnimatedCounter - Number counting up
const AnimatedCounter: React.FC<{target: number, startFrame: number, duration?: number}> = ({target, startFrame, duration = 45}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame - startFrame, [0, duration], [0, 1], {extrapolateRight: 'clamp'});
  const value = Math.round(progress * target);
  return (
    <span style={{fontVariantNumeric: 'tabular-nums'}}>{value.toLocaleString()}</span>
  );
};''',
    "staggered-list": '''
// StaggeredList - Animated list with staggered entries
const StaggeredList: React.FC<{items: string[], startFrame: number}> = ({items, startFrame}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <div>
      {items.map((item, i) => {
        const delay = i * 6; // 6 frame stagger
        const progress = spring({
          frame: frame - startFrame - delay,
          fps,
          config: { damping: 22, stiffness: 90, mass: 0.9 }
        });
        return (
          <div key={i} style={{
            opacity: progress,
            transform: `translateY(${interpolate(progress, [0, 1], [20, 0])}px)`
          }}>
            {item}
          </div>
        );
      })}
    </div>
  );
};''',
}


def extract_technique_examples(transcript: str) -> str:
    """
    Extract relevant code examples based on transcript content.
    Analyzes transcript for keywords that suggest certain techniques would be useful.
    """
    transcript_lower = transcript.lower()
    examples = []

    # Keywords that suggest certain techniques
    technique_keywords = {
        "particle-emitter": ["particle", "explosion", "burst", "radial", "scatter", "emit"],
        "glass-morphism": ["card", "container", "panel", "box", "glass", "blur", "overlay"],
        "flowing-river": ["flow", "stream", "river", "data", "continuous", "pipeline", "process"],
        "probability-gate": ["probability", "chance", "random", "dice", "spin", "lottery", "odds"],
        "scale-spring": ["appear", "pop", "enter", "show", "reveal", "intro"],
        "counter-animation": ["count", "number", "statistic", "metric", "percentage", "value"],
        "staggered-list": ["list", "item", "bullet", "point", "step", "sequence"],
    }

    for technique, keywords in technique_keywords.items():
        if any(kw in transcript_lower for kw in keywords):
            if technique in TECHNIQUE_CODE_EXAMPLES:
                examples.append(f"### {technique.replace('-', ' ').title()}\n```tsx{TECHNIQUE_CODE_EXAMPLES[technique]}\n```")

    # Always include basic patterns
    if "scale-spring" not in [e.split("\n")[0] for e in examples]:
        examples.append(f"### Scale Spring Entrance\n```tsx{TECHNIQUE_CODE_EXAMPLES['scale-spring']}\n```")

    if not examples:
        return ""

    return f"""
## CODE EXAMPLES - COPY THESE DIRECTLY

Based on your transcript content, these techniques are likely useful:

{chr(10).join(examples)}

**IMPORTANT**: Copy these implementations directly. Do NOT simplify them.
"""


# =============================================================================
# System Prompt and User Message Templates
# =============================================================================


SYSTEM_PROMPT = """
<role>
You are a Remotion video generator. You create animated educational videos from transcripts.
Your output must be production-quality TypeScript/React code that compiles without errors.
</role>

<workspace>
Working directory: {workspace_dir}
Output files:
- src/{project_id}/constants.ts (colors, timing, spring configs)
- src/{project_id}/index.tsx (main composition with all scenes)
</workspace>

<process>
1. PLAN (think thoroughly about this):
   - Identify 4-6 key moments from the transcript
   - Design visual metaphors for abstract concepts
   - Plan timing (frames) for each scene
   - Consider transitions between scenes

2. WRITE:
   - Write constants.ts first with COLORS, TIMING, SPRING_CONFIG
   - Write index.tsx with all scene components and main composition
   - Use Sequence components for scene timing

3. VALIDATE:
   - Run: npx tsc --noEmit --pretty false
   - Fix ALL errors before finishing
   - Re-run validation until clean
</process>

<animation_rules>
CRITICAL - Follow these EXACTLY:

Spring Configuration (ALWAYS use):
  config: {{ damping: 22, stiffness: 90, mass: 0.9 }}

Stagger Rule:
  - NEVER animate multiple elements at frame 0
  - Stagger by 6+ frames: startFrame + (index * 6)

Interpolate Rule:
  - ALWAYS use extrapolateRight: 'clamp'
  - Example: interpolate(frame, [0, 30], [0, 1], {{extrapolateRight: 'clamp'}})

PROHIBITED:
  - Math.sin/cos on text positions (causes jitter)
  - damping < 20 (too bouncy)
  - Static backgrounds (add subtle motion)
</animation_rules>

<constraints>
- Resolution: {width}x{height}
- Duration: {duration_frames} frames at {fps} FPS
- Single file per type (no component splitting)
- MUST pass TypeScript validation
</constraints>

<quality_checklist>
Before declaring GENERATION COMPLETE, verify:
[ ] TypeScript compiles with no errors
[ ] All spring configs use damping >= 20
[ ] Elements are staggered (not simultaneous)
[ ] All interpolate() calls have extrapolateRight: 'clamp'
[ ] No Math.sin/cos on text elements
[ ] Scenes have proper Sequence timing
</quality_checklist>
"""


USER_MESSAGE = """
## PROJECT: {project_id}

## VIDEO SPECS
- Resolution: {width}x{height}
- Duration: {duration_frames} frames ({duration_seconds}s)
- FPS: {fps}

## TRANSCRIPT
{transcript}

## YOUR TASK
Create a visually engaging Remotion video that explains this content.

Think thoroughly about:
1. What visual metaphors best represent the concepts?
2. How should scenes flow and transition?
3. What animations will enhance understanding?

Requirements:
- 4-6 scenes building understanding progressively
- Visual metaphors (not just text)
- Smooth spring animations (damping >= 20)
- Staggered element entrances (6+ frame delays)
- All elements readable at {width}x{height}

Output files:
- src/{project_id}/constants.ts
- src/{project_id}/index.tsx

When TypeScript validation passes, respond with "GENERATION COMPLETE" and a summary of what you created.
"""


# =============================================================================
# Security Settings (Reference: Auto-Claude apps/backend/core/client.py)
# =============================================================================


def create_security_settings(workspace_path: str) -> dict:
    """
    Create security settings for Claude Agent SDK.

    Reference: Auto-Claude apps/backend/core/client.py lines 603-654
    """
    return {
        "sandbox": {"enabled": True, "autoAllowBashIfSandboxed": True},
        "permissions": {
            "defaultMode": "acceptEdits",
            "allow": [
                # Allow all file operations within workspace
                "Read(./**)",
                "Write(./**)",
                "Edit(./**)",
                "Glob(./**)",
                "Grep(./**)",
                # Also allow absolute paths
                f"Read({workspace_path}/**)",
                f"Write({workspace_path}/**)",
                f"Edit({workspace_path}/**)",
                f"Glob({workspace_path}/**)",
                f"Grep({workspace_path}/**)",
                # Allow bash for TypeScript validation
                "Bash(*)",
            ],
        },
    }


# =============================================================================
# Visual Generator Class
# =============================================================================


class ClaudeVisualGenerator:
    """
    Generates Remotion video compositions using Claude Agent SDK.

    Uses OAuth authentication from Claude Pro/Max subscription.
    """

    def __init__(
        self,
        workspace: Path,
        project_id: str,
        bundle_output: Path,
        model: str = "claude-sonnet-4-20250514",
        max_thinking_tokens: int = 10000,
        max_turns: int = 100,
    ):
        """
        Initialize the visual generator.

        Args:
            workspace: Path to the Remotion workspace (with node_modules)
            project_id: Unique project identifier
            bundle_output: Path to output bundled video
            model: Claude model to use
            max_thinking_tokens: Token budget for extended thinking
            max_turns: Maximum agent turns
        """
        self.workspace = workspace
        self.project_id = project_id
        self.src_dir = workspace / "src" / project_id
        self.bundle_output = bundle_output
        self.model = model
        self.max_thinking_tokens = max_thinking_tokens
        self.max_turns = max_turns

        # Configure OAuth authentication
        configure_sdk_auth()

    def _build_system_prompt(
        self,
        width: int,
        height: int,
        fps: int,
        duration_frames: int,
    ) -> str:
        """Build the system prompt with workspace context."""
        return SYSTEM_PROMPT.format(
            workspace_dir=str(self.workspace),
            project_id=self.project_id,
            width=width,
            height=height,
            fps=fps,
            duration_frames=duration_frames,
        )

    def _build_user_message(
        self,
        transcript: str,
        width: int,
        height: int,
        duration_frames: int,
        fps: int,
    ) -> str:
        """Build the user message with transcript, specs, and injected skills/examples."""
        duration_seconds = duration_frames / fps

        # Get condensed skills and technique examples to inject directly
        condensed_skills = get_condensed_skills()
        technique_examples = extract_technique_examples(transcript)

        base_message = USER_MESSAGE.format(
            project_id=self.project_id,
            width=width,
            height=height,
            duration_frames=duration_frames,
            duration_seconds=f"{duration_seconds:.1f}",
            fps=fps,
            transcript=transcript,
        )

        # Inject skills and examples directly into prompt (agents don't read skill files reliably)
        return f"{condensed_skills}\n\n{technique_examples}\n\n{base_message}"

    def _write_security_settings(self) -> Path:
        """Write security settings to a temporary file."""
        settings = create_security_settings(str(self.workspace))
        settings_path = self.workspace / ".claude" / "settings.local.json"
        settings_path.parent.mkdir(parents=True, exist_ok=True)

        with open(settings_path, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=2)

        return settings_path

    async def _verify_typescript(self) -> bool:
        """Run TypeScript validation on the generated code."""
        import subprocess

        try:
            result = subprocess.run(
                ["npx", "tsc", "--noEmit", "--pretty", "false"],
                cwd=str(self.workspace),
                capture_output=True,
                text=True,
                timeout=60,
                shell=True,
            )
            return result.returncode == 0
        except subprocess.TimeoutExpired:
            return False
        except Exception:
            return False

    async def _run_bundle(self) -> Path:
        """Bundle the Remotion project."""
        import subprocess

        bundle_path = self.bundle_output / self.project_id

        # Create output directory
        bundle_path.mkdir(parents=True, exist_ok=True)

        try:
            result = subprocess.run(
                ["npx", "remotion", "bundle", "--out-dir", str(bundle_path)],
                cwd=str(self.workspace),
                capture_output=True,
                text=True,
                timeout=300,
                shell=True,
            )

            if result.returncode != 0:
                raise RuntimeError(f"Bundle failed: {result.stderr}")

            return bundle_path

        except subprocess.TimeoutExpired:
            raise RuntimeError("Bundle timed out after 5 minutes")

    async def generate(
        self,
        transcript: str,
        width: int = 1920,
        height: int = 1080,
        duration_frames: int = 1800,
        fps: int = 30,
        timeout_seconds: int = 300,
        max_retries: int = 2,
    ) -> dict[str, Any]:
        """
        Generate a Remotion video composition from a transcript.

        Args:
            transcript: The transcript text to visualize
            width: Video width in pixels
            height: Video height in pixels
            duration_frames: Total duration in frames
            fps: Frames per second
            timeout_seconds: Timeout for generation
            max_retries: Maximum retry attempts

        Returns:
            dict with success status and bundle URL

        Raises:
            ValueError: If OAuth authentication fails
            RuntimeError: If generation fails after all retries
        """
        last_error: Exception | None = None

        for attempt in range(max_retries + 1):
            try:
                print(f"[ClaudeGenerator] Attempt {attempt + 1}/{max_retries + 1}")

                # Clean previous attempt
                if self.src_dir.exists():
                    shutil.rmtree(self.src_dir)
                self.src_dir.mkdir(parents=True)

                # Write security settings
                settings_path = self._write_security_settings()

                # Build prompts
                system_prompt = self._build_system_prompt(
                    width, height, fps, duration_frames
                )
                user_message = self._build_user_message(
                    transcript, width, height, duration_frames, fps
                )

                print(f"[ClaudeGenerator] Starting Claude Agent SDK...")
                print(f"[ClaudeGenerator] Model: {self.model}")
                print(f"[ClaudeGenerator] Workspace: {self.workspace}")

                # Create Claude SDK client with security hook
                client = ClaudeSDKClient(
                    options=ClaudeAgentOptions(
                        model=self.model,
                        system_prompt=system_prompt,
                        cwd=str(self.workspace),
                        max_turns=self.max_turns,
                        max_thinking_tokens=self.max_thinking_tokens,
                        max_buffer_size=10 * 1024 * 1024,  # 10MB for large tool results
                        enable_file_checkpointing=True,
                        settings=str(settings_path),
                        allowed_tools=["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
                        hooks={
                            "PreToolUse": [
                                HookMatcher(matcher="Bash", hooks=[bash_security_hook]),
                            ],
                        },
                    )
                )

                # Run the agent using query/receive pattern (like Auto-Claude)
                print(f"[ClaudeGenerator] Sending query to Claude Agent SDK...")
                await client.query(user_message)

                # Stream and display response
                response_text = ""
                async for msg in client.receive_response():
                    msg_type = type(msg).__name__
                    if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                        for block in msg.content:
                            block_type = type(block).__name__
                            if block_type == "TextBlock" and hasattr(block, "text"):
                                response_text += block.text
                                print(block.text, end="", flush=True)
                            elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                                print(f"\n[Tool: {block.name}]", flush=True)

                print(f"\n[ClaudeGenerator] Agent completed")

                # Verify output exists
                index_tsx = self.src_dir / "index.tsx"
                if not index_tsx.exists():
                    raise RuntimeError(
                        f"index.tsx not found at {index_tsx}. "
                        "Agent may not have generated the expected output."
                    )

                # Verify TypeScript
                print(f"[ClaudeGenerator] Verifying TypeScript...")
                if not await self._verify_typescript():
                    raise RuntimeError(
                        "TypeScript validation failed. "
                        "Generated code has type errors."
                    )

                print(f"[ClaudeGenerator] TypeScript validation passed")

                # Bundle
                print(f"[ClaudeGenerator] Bundling project...")
                bundle_path = await self._run_bundle()

                print(f"[ClaudeGenerator] Bundle complete: {bundle_path}")

                return {
                    "success": True,
                    "bundleUrl": f"/bundles/{self.project_id}/index.html",
                    "bundlePath": str(bundle_path),
                    "attempts": attempt + 1,
                }

            except ValueError:
                # Authentication errors should not be retried
                raise

            except Exception as e:
                last_error = e
                print(f"[ClaudeGenerator] Attempt {attempt + 1} failed: {e}")
                continue

        raise RuntimeError(
            f"Generation failed after {max_retries + 1} attempts: {last_error}"
        )


# =============================================================================
# CLI Entry Point
# =============================================================================


async def main():
    """CLI entry point for testing."""
    import argparse

    parser = argparse.ArgumentParser(description="Claude Code Visual Generator")
    parser.add_argument("--workspace", required=True, help="Path to Remotion workspace")
    parser.add_argument("--project-id", required=True, help="Project ID")
    parser.add_argument("--bundle-output", required=True, help="Bundle output directory")
    parser.add_argument("--transcript", required=True, help="Transcript text or file path")
    parser.add_argument("--width", type=int, default=1920, help="Video width")
    parser.add_argument("--height", type=int, default=1080, help="Video height")
    parser.add_argument("--duration", type=int, default=1800, help="Duration in frames")
    parser.add_argument("--fps", type=int, default=30, help="Frames per second")
    parser.add_argument("--model", default="claude-sonnet-4-20250514", help="Claude model")

    args = parser.parse_args()

    # Load transcript
    transcript = args.transcript
    if os.path.exists(transcript):
        with open(transcript, encoding="utf-8") as f:
            transcript = f.read()

    # Create generator
    generator = ClaudeVisualGenerator(
        workspace=Path(args.workspace),
        project_id=args.project_id,
        bundle_output=Path(args.bundle_output),
        model=args.model,
    )

    # Generate
    result = await generator.generate(
        transcript=transcript,
        width=args.width,
        height=args.height,
        duration_frames=args.duration,
        fps=args.fps,
    )

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
