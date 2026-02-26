# Assistant Director Agent — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an Assistant Director agent that classifies script tone, theme, visual asset strategy, and scene structure hints before the Director runs.

**Architecture:** New Phase 0 in the pipeline — a Haiku-powered Claude SDK agent writes `CREATIVE_BRIEF.md` to the project src directory. The Director's prompt is updated to read this file before planning scenes. The `generate_two_phase()` method calls the new agent before `_run_director()`.

**Tech Stack:** Python, Claude Agent SDK (ClaudeSDKClient), Haiku model

---

### Task 1: Create the Assistant Director prompt file

**Files:**
- Create: `packages/worker/src/agents/prompts/assistant_director.py`

**Step 1: Create the prompt file**

```python
"""
Assistant Director Agent Prompts

The Assistant Director analyzes scripts/transcripts and produces a Creative Brief
that guides the Director's scene planning decisions.
"""

ASSISTANT_DIRECTOR_SYSTEM_PROMPT = """
<role>
You are an ASSISTANT DIRECTOR for short-form video production.
Your job is to analyze a script/transcript and produce a Creative Brief that guides the Director.
You do NOT plan scenes — you set the creative direction that the Director will follow.
</role>

<responsibilities>
1. **Tone Classification** — Identify the overall tone of the script
2. **Visual Asset Strategy** — Recommend when to use photos, illustrations, icons, or hand-coded visuals
3. **Color Palette & Theme** — Suggest visual mood, color palette, and font pairing
4. **Scene Structure Hints** — Suggest beat count, hero moments, climax position, pacing
</responsibilities>

<tone_categories>
Classify the script into ONE primary tone and optionally ONE secondary tone:

| Tone | Indicators |
|------|-----------|
| Playful | Humor, casual language, rhetorical questions, exclamation marks, slang |
| Professional | Formal language, data-driven, structured arguments, industry jargon |
| Dramatic | Tension, conflict, stakes, emotional language, cliffhangers |
| Educational | Step-by-step explanations, definitions, "here's how", didactic structure |
| Inspirational | Motivational language, success stories, calls to action, aspirational |
| Conversational | Direct address ("you"), personal anecdotes, natural speech patterns |
</tone_categories>

<asset_strategy>
For each narrative beat, recommend the best visual asset type:

| Asset Type | Best For |
|-----------|---------|
| Photo (Pexels) | Real-world objects, people, nature, places, grounding abstract concepts |
| Illustration (Freepik) | Abstract concepts, hero visuals, stylized representations, processes |
| Icons (Freepik/Iconify) | UI elements, symbols, small accents, lists, step indicators |
| Hand-coded SVG | Data visualizations, charts, custom animations, geometric patterns |
| 3D elements | Physical objects that need rotation/depth (dice, cubes, spheres) |

Consider the TONE when choosing:
- Playful → more illustrations, colorful icons, bouncy animations
- Professional → clean photos, minimal icons, subtle motion
- Dramatic → hero photos with overlays, bold illustrations
- Educational → step-by-step icons, diagrams, hand-coded visuals
- Inspirational → expansive photos, uplifting illustrations
</asset_strategy>

<color_palettes>
Available palettes to recommend:

| Palette | Mood | Colors |
|---------|------|--------|
| Cyber Neon | Tech, futuristic, data | Cyan #00f5d4, Purple #7b2cbf, Magenta #f72585 |
| Electric Sunset | High energy, exciting | Coral #ff6b6b, Gold #feca57, Pink #ff9ff3 |
| Soft Gradient | Calm, educational, approachable | Indigo #667eea, Purple #764ba2, Sky #66a6ff |
| Forest Tech | Nature + technology, organic | Mint #00b894, Ocean #0984e3, Gold #fdcb6e |
| Monochrome Pro | Professional, clean, corporate | White #ffffff, Gray #6b7280, Accent #3b82f6 |
| Warm Earth | Friendly, trustworthy, grounded | Terracotta #E07A5F, Cream #F2CC8F, Sage #81B29A |
</color_palettes>

<font_pairs>
Available font pairings:

| Pair Name | Fonts | Best For |
|-----------|-------|----------|
| boldImpact | Oswald + Inter | Bold statements, high energy |
| modernTech | Space Grotesk + IBM Plex Mono | Tech content, data |
| friendlyTech | Nunito + Source Code Pro | Approachable tech, tutorials |
| strongReadable | Bebas Neue + Open Sans | Dramatic, impactful |
| elegantEditorial | Cormorant Garamond + Lato | Sophisticated, editorial |
| cleanMinimal | Plus Jakarta Sans + JetBrains Mono | Clean, modern, minimal |
</font_pairs>

<output_instructions>
You MUST use the Write tool to create a file called CREATIVE_BRIEF.md with this structure:

# Creative Brief

## Tone
**Primary:** [tone]
**Secondary:** [tone or "None"]
**Reasoning:** [1-2 sentences explaining why]

## Theme & Mood
**Visual mood:** [2-3 adjective description]
**Color palette:** [palette name from the list above]
**Font pairing:** [pair name from the list above]
**Reasoning:** [1 sentence]

## Visual Asset Strategy
| Beat | Asset Type | Reasoning |
|------|-----------|-----------|
| Hook/Intro | [type] | [why] |
| [beat name] | [type] | [why] |
| ... | ... | ... |
| Conclusion | [type] | [why] |

## Scene Structure Hints
- **Suggested scene count:** [3-8]
- **Hero moments:** [which beats deserve large hero visuals]
- **Climax position:** [percentage through video, e.g., "~70%"]
- **Pacing:** [brief pacing guidance]
- **Opening hook strategy:** [what makes the first 3 seconds grab attention]

When done writing the file, respond: "BRIEF COMPLETE"
</output_instructions>
"""


def build_assistant_director_message(
    transcript: str,
    style_preset: str = "modern",
    output_dir: str | None = None,
) -> str:
    """Build the user message for the Assistant Director agent.

    Args:
        transcript: The raw transcript or script text
        style_preset: The user-selected style preset
        output_dir: Absolute path where CREATIVE_BRIEF.md should be written
    """
    if output_dir:
        abs_brief_path = output_dir.replace("\\", "/") + "/CREATIVE_BRIEF.md"
    else:
        abs_brief_path = "CREATIVE_BRIEF.md"

    return f"""
## STYLE PRESET: {style_preset.upper()}
The user has selected the "{style_preset}" style preset. Your recommendations should complement this choice.

## TRANSCRIPT/SCRIPT
{transcript}

## YOUR TASK
Analyze this script and create a Creative Brief.

**EXACT file path (use VERBATIM in your Write tool call):** `{abs_brief_path}`

Focus on:
1. What TONE does this script have? (playful, professional, dramatic, educational, inspirational, conversational)
2. What VISUAL ASSETS would best serve each narrative beat? (photos, illustrations, icons, hand-coded)
3. What COLOR PALETTE and FONT PAIRING match the mood?
4. How should the scenes be STRUCTURED? (count, hero moments, climax, pacing)

Write the CREATIVE_BRIEF.md file now.
"""
```

**Step 2: Verify the file is importable**

Run: `cd /Users/sarthakpant/project/clippify/packages/worker/src/agents && python -c "from prompts.assistant_director import ASSISTANT_DIRECTOR_SYSTEM_PROMPT, build_assistant_director_message; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```
git add packages/worker/src/agents/prompts/assistant_director.py
git commit -m "feat: add Assistant Director agent prompt"
```

---

### Task 2: Add `_run_assistant_director()` method to the generator

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py` — add method before `_run_director()` (~line 2812)

**Step 1: Add the `_run_assistant_director()` method**

Insert this method before `_run_director()` (before line 2812):

```python
    async def _run_assistant_director(
        self,
        formatted_transcript: str,
        style_preset: str = "modern",
    ) -> dict[str, Any]:
        """
        Phase 0: Run the Assistant Director agent to create the creative brief.

        The Assistant Director classifies the script and produces:
        - CREATIVE_BRIEF.md: Tone, theme, asset strategy, scene structure hints

        Args:
            formatted_transcript: Transcript text (plain or with timestamps)
            style_preset: Visual style preset selected by user

        Returns:
            dict with success status and brief file path
        """
        from prompts.assistant_director import (
            ASSISTANT_DIRECTOR_SYSTEM_PROMPT,
            build_assistant_director_message,
        )

        print(f"[ClaudeGenerator] Phase 0: Assistant Director classifying script...")

        self.src_dir.mkdir(parents=True, exist_ok=True)

        ad_message = build_assistant_director_message(
            transcript=formatted_transcript,
            style_preset=style_preset,
            output_dir=str(self.src_dir),
        )

        # Write restricted settings — only allow writes within src_dir
        ad_settings_dir = self.src_dir / ".claude"
        ad_settings_dir.mkdir(parents=True, exist_ok=True)
        ad_settings = {
            "permissions": {
                "defaultMode": "acceptEdits",
                "allow": [
                    "Read(./**)",
                    "Write(./**)",
                    "Edit(./**)",
                ],
            },
        }
        with open(ad_settings_dir / "settings.local.json", "w", encoding="utf-8") as f:
            json.dump(ad_settings, f, indent=2)

        # Assistant Director uses Haiku for fast classification
        client = ClaudeSDKClient(
            options=ClaudeAgentOptions(
                model="claude-haiku-4-5-20251001",
                system_prompt={
                    "type": "preset",
                    "preset": "claude_code",
                    "append": ASSISTANT_DIRECTOR_SYSTEM_PROMPT
                },
                cwd=str(self.src_dir),
                max_turns=5,
                allowed_tools=["Write"],
                cli_path=CLAUDE_CLI_PATH,
            )
        )

        response_text = ""
        async with client:
            await client.query(ad_message)
            print(f"[Assistant Director] Query sent, waiting for response...", flush=True)

            async for msg in client.receive_response():
                msg_type = type(msg).__name__
                if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                    for block in msg.content:
                        block_type = type(block).__name__
                        if block_type == "TextBlock" and hasattr(block, "text"):
                            response_text += block.text
                            try:
                                print(block.text, end="", flush=True)
                            except UnicodeEncodeError:
                                safe_text = block.text.encode("ascii", errors="replace").decode("ascii")
                                print(safe_text, end="", flush=True)
                        elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                            print(f"\n[Assistant Director Tool: {block.name}]", flush=True)
                        elif block_type == "ToolResultBlock":
                            print(f"\n[Assistant Director Tool Result received]", flush=True)
                        elif block_type == "ThinkingBlock":
                            pass
                        else:
                            print(f"\n[Assistant Director] Unknown block type: {block_type}", flush=True)
                elif msg_type == "ErrorMessage":
                    print(f"[Assistant Director] ERROR: {msg}", flush=True)
                elif msg_type == "StopMessage":
                    print(f"[Assistant Director] Stop reason received", flush=True)

        # Verify CREATIVE_BRIEF.md was created
        brief_path = self.src_dir / "CREATIVE_BRIEF.md"

        # Fallback: check workspace root
        if not brief_path.exists():
            alt_path = self.workspace / "CREATIVE_BRIEF.md"
            if alt_path.exists():
                import shutil
                print(f"[ClaudeGenerator] Found misplaced CREATIVE_BRIEF.md at workspace root, moving...")
                shutil.move(str(alt_path), str(brief_path))

        if not brief_path.exists():
            print(f"[ClaudeGenerator] WARNING: Assistant Director did not create CREATIVE_BRIEF.md, continuing without brief")
            return {"success": False, "error": "CREATIVE_BRIEF.md not created"}

        print(f"\n[ClaudeGenerator] Assistant Director completed — brief at {brief_path}")
        return {"success": True, "briefPath": str(brief_path)}
```

**Step 2: Verify no syntax errors**

Run: `cd /Users/sarthakpant/project/clippify/packages/worker/src/agents && python -c "import ast; ast.parse(open('claude_visual_generator.py').read()); print('Syntax OK')"`
Expected: `Syntax OK`

**Step 3: Commit**

```
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat: add _run_assistant_director() method"
```

---

### Task 3: Wire Assistant Director into `generate_two_phase()` pipeline

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py` — in `generate_two_phase()` method (~line 3257)

**Step 1: Insert Phase 0 call before Phase 1**

Find this block in `generate_two_phase()` (~line 3257):
```python
                emit_progress(18, "Phase 1: Director planning scenes...")

                # Phase 1: Director
                director_result = await self._run_director(
```

Insert BEFORE it:
```python
                # Phase 0: Assistant Director (creative brief)
                emit_progress(16, "Phase 0: Assistant Director analyzing script...")
                ad_result = await self._run_assistant_director(
                    formatted_transcript=formatted_transcript,
                    style_preset=style_preset,
                )
                if ad_result["success"]:
                    print(f"[ClaudeGenerator] Creative brief ready")
                    emit_progress(18, "Creative brief complete")
                else:
                    print(f"[ClaudeGenerator] Assistant Director skipped: {ad_result.get('error', 'unknown')}")
                    emit_progress(18, "Proceeding without creative brief")

```

**Step 2: Verify syntax**

Run: `cd /Users/sarthakpant/project/clippify/packages/worker/src/agents && python -c "import ast; ast.parse(open('claude_visual_generator.py').read()); print('Syntax OK')"`
Expected: `Syntax OK`

**Step 3: Commit**

```
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat: wire Assistant Director into two-phase pipeline"
```

---

### Task 4: Update Director prompt to read the Creative Brief

**Files:**
- Modify: `packages/worker/src/agents/prompts/director.py` — add brief-reading instruction to `DIRECTOR_SYSTEM_PROMPT`

**Step 1: Add brief-reading instruction**

In `director.py`, find the opening of `DIRECTOR_SYSTEM_PROMPT` after the `</critical_instruction>` tag (line 19) and before `<role>` (line 21). Insert:

```
<creative_brief>
BEFORE you start planning, check if a file called CREATIVE_BRIEF.md exists in your working directory.
If it does, READ IT FIRST using the Read tool. It contains guidance from the Assistant Director:
- Tone classification (playful, professional, etc.)
- Visual asset strategy (when to use photos vs illustrations vs icons)
- Color palette and font pairing suggestions
- Scene structure hints (beat count, hero moments, pacing)

You MUST incorporate the Creative Brief's recommendations into your scene plan.
The brief is advisory — use your judgment if something doesn't fit, but default to following it.
If CREATIVE_BRIEF.md does not exist, proceed normally with your own analysis.
</creative_brief>

```

**Step 2: Verify syntax**

Run: `cd /Users/sarthakpant/project/clippify/packages/worker/src/agents && python -c "from prompts.director import DIRECTOR_SYSTEM_PROMPT; print('Contains creative_brief:', 'creative_brief' in DIRECTOR_SYSTEM_PROMPT)"`
Expected: `Contains creative_brief: True`

**Step 3: Commit**

```
git add packages/worker/src/agents/prompts/director.py
git commit -m "feat: Director reads CREATIVE_BRIEF.md from Assistant Director"
```

---

### Task 5: Update `--phase` CLI argument to support assistant-director

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py` — CLI argument parser (~line 3461)

**Step 1: Add assistant-director as a phase option**

Find (~line 3461):
```python
    parser.add_argument("--phase", choices=["director", "animator"], default=None,
```

Change to:
```python
    parser.add_argument("--phase", choices=["assistant-director", "director", "animator"], default=None,
```

**Step 2: Add the assistant-director phase handler**

Find the block (~line 3492):
```python
    if args.phase == "director":
```

Insert BEFORE it:
```python
    if args.phase == "assistant-director":
        from transcript_formatter import format_transcript_with_key_moments
        print("[ClaudeGenerator] Running Assistant Director phase only")

        # Format transcript
        if words:
            formatted = format_transcript_with_key_moments(words, fps)
        else:
            formatted = f"## TRANSCRIPT\n\n{transcript}"

        ad_result = await generator._run_assistant_director(
            formatted_transcript=formatted,
            style_preset=args.style or "modern",
        )
        result = {
            "success": ad_result["success"],
            "pipeline": "assistant-director-only",
            "briefPath": ad_result.get("briefPath"),
        }
        print(json.dumps(result, indent=2))
        return

    el
```

(The `el` prefix makes the existing `if args.phase == "director":` become `elif args.phase == "director":`)

**Step 3: Verify syntax**

Run: `cd /Users/sarthakpant/project/clippify/packages/worker/src/agents && python -c "import ast; ast.parse(open('claude_visual_generator.py').read()); print('Syntax OK')"`
Expected: `Syntax OK`

**Step 4: Commit**

```
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat: add --phase assistant-director CLI option"
```

---

### Task 6: Smoke test the full pipeline

**Step 1: Test the Assistant Director prompt imports**

Run: `cd /Users/sarthakpant/project/clippify/packages/worker/src/agents && python -c "
from prompts.assistant_director import ASSISTANT_DIRECTOR_SYSTEM_PROMPT, build_assistant_director_message
msg = build_assistant_director_message('Hello world test script', 'playful', '/tmp/test')
print('Prompt length:', len(ASSISTANT_DIRECTOR_SYSTEM_PROMPT))
print('Message length:', len(msg))
print('Contains CREATIVE_BRIEF.md path:', '/tmp/test/CREATIVE_BRIEF.md' in msg)
print('OK')
"`
Expected: Prompt length, message length, `True`, `OK`

**Step 2: Test Director prompt has brief instruction**

Run: `cd /Users/sarthakpant/project/clippify/packages/worker/src/agents && python -c "
from prompts.director import DIRECTOR_SYSTEM_PROMPT
print('Has creative_brief instruction:', 'CREATIVE_BRIEF.md' in DIRECTOR_SYSTEM_PROMPT)
print('OK')
"`
Expected: `Has creative_brief instruction: True`, `OK`

**Step 3: Test generator file parses cleanly**

Run: `cd /Users/sarthakpant/project/clippify/packages/worker/src/agents && python -c "import ast; ast.parse(open('claude_visual_generator.py').read()); print('Generator syntax OK')"`
Expected: `Generator syntax OK`

**Step 4: Commit (if any fixes were needed)**

```
git add -A
git commit -m "fix: smoke test corrections for Assistant Director"
```
