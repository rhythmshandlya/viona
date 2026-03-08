# Kinetic Typography Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "kinetic-typography" visual style that generates Apple-ad-style text-on-colored-backgrounds videos with doodle annotations, synced to audio narration.

**Architecture:** Same Director → Animator → Render pipeline with different prompts. Director outputs text-card segments (2-8 words each with background colors, emphasis words, doodle types) instead of regular scenes. Animator generates Remotion components (Scene, PhraseReveal, WordByWord, Doodle*) instead of data visualizations. User selects style + provides 3 brand colors + resolution in the modal.

**Tech Stack:** TypeScript/React (frontend), Python (Director/Animator prompts), Remotion (rendering)

---

## Task 1: Add Kinetic Typography to StylePreset and StyleSelectionModal

**Files:**
- Modify: `apps/web/src/lib/api.ts:123`
- Modify: `apps/web/src/features/editor-v2/components/StyleSelectionModal.tsx:20-117,183-197`

**Context:** The `StylePreset` type at `api.ts:123` is a union of string literals. `STYLE_OPTIONS` at `StyleSelectionModal.tsx:31-117` is the array of style cards. When the user picks kinetic-typography, we need to collect 3 brand colors (accent, dark, light) and pass them to the backend. The existing `styleGuide` string field (`GenerateVisualsOptions.styleGuide`) is the simplest way to pass structured color data — we'll JSON-encode the colors into it.

**Step 1: Add 'kinetic-typography' to StylePreset type**

In `apps/web/src/lib/api.ts:123`, change:
```typescript
export type StylePreset = 'minimal' | 'modern' | 'playful' | 'bold' | 'classic' | 'apple' | 'google' | 'studio';
```
to:
```typescript
export type StylePreset = 'minimal' | 'modern' | 'playful' | 'bold' | 'classic' | 'apple' | 'google' | 'studio' | 'kinetic-typography';
```

**Step 2: Add kinetic-typography option to STYLE_OPTIONS**

In `StyleSelectionModal.tsx`, add this entry to the `STYLE_OPTIONS` array (after the last entry, before the closing `]` at line 117):

```tsx
  {
    id: 'kinetic-typography',
    name: 'Kinetic Text',
    description: 'Bold text cards with hand-drawn doodle annotations',
    colors: ['#00E556', '#000000', '#EBEBEB'],
    preview: (
      <div className="w-full h-full bg-[#00E556] flex items-center justify-center">
        <span className="text-black font-black text-base leading-none">Aa</span>
      </div>
    ),
  },
```

**Step 3: Add brand color picker UI for kinetic-typography**

In `StyleSelectionModal.tsx`, add state for brand colors (after the existing state declarations around line 186):

```tsx
const [brandColors, setBrandColors] = useState({
  accent: '#00E556',
  dark: '#000000',
  light: '#EBEBEB',
});
```

Add a conditional color picker section below the style grid (after the closing `</div>` of the style grid around line 513, before the Style Guide Input section):

```tsx
{/* Brand Colors — only for kinetic-typography */}
{selectedStyle === 'kinetic-typography' && (
  <div className="space-y-3 py-2 border-t border-gray-200">
    <label className="text-sm font-medium text-gray-700">Brand Colors</label>
    <div className="grid grid-cols-3 gap-3">
      {(['accent', 'dark', 'light'] as const).map((key) => (
        <div key={key} className="flex flex-col items-center gap-1.5">
          <label
            className="relative w-10 h-10 rounded-lg border border-gray-300 cursor-pointer overflow-hidden"
            style={{ backgroundColor: brandColors[key] }}
          >
            <input
              type="color"
              value={brandColors[key]}
              onChange={(e) => setBrandColors((prev) => ({ ...prev, [key]: e.target.value }))}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
          <span className="text-xs text-gray-500 capitalize">{key}</span>
        </div>
      ))}
    </div>
  </div>
)}
```

**Step 4: Inject brand colors into styleGuide on generate**

Modify `handleGenerate` (around line 190) to inject the brand colors when kinetic-typography is selected:

```tsx
const handleGenerate = () => {
  let finalStyleGuide = styleGuide.trim() || undefined;

  if (selectedStyle === 'kinetic-typography') {
    const colorData = JSON.stringify({
      kineticTypography: true,
      brandColors: brandColors,
    });
    finalStyleGuide = finalStyleGuide
      ? `${colorData}\n\n${finalStyleGuide}`
      : colorData;
  }

  onSelect({
    stylePreset: selectedStyle,
    layoutMode,
    dimensions,
    styleGuide: finalStyleGuide,
  });
};
```

**Step 5: Verify TypeScript compiles**

Run: `cd /Users/sarthakpant/project/clippify && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors related to StylePreset or StyleSelectionModal

**Step 6: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/features/editor-v2/components/StyleSelectionModal.tsx
git commit -m "feat: add kinetic-typography style option with brand color pickers"
```

---

## Task 2: Add Kinetic Typography Mode to Director Prompt

**Files:**
- Modify: `packages/worker/src/agents/prompts/director.py:321-374` (STYLE_PRESET_DESCRIPTIONS)
- Modify: `packages/worker/src/agents/prompts/director.py:541-805` (build_director_user_message)

**Context:** The Director is an AI agent that plans visual scenes. `STYLE_PRESET_DESCRIPTIONS` (line 321) provides the aesthetic instructions. `build_director_user_message()` (line 541) builds the full prompt including the scenes.json schema. For kinetic-typography, the Director needs to output a DIFFERENT schema — text-card segments with word timings, background colors, emphasis words, and doodle types — instead of the regular scene schema with visuals, sync points, etc.

**Step 1: Add kinetic-typography entry to STYLE_PRESET_DESCRIPTIONS**

In `director.py`, add this entry to the `STYLE_PRESET_DESCRIPTIONS` dict (after the "studio" entry, before the closing `}`):

```python
    "kinetic-typography": """Full-screen text cards synced to narration — Apple ad style.

**CONCEPT:** Every word the narrator says appears as large bold text on solid colored backgrounds.
Words are grouped into short phrases (2-8 words per card). Background colors rotate through 3 brand
colors. One emphasis word per card gets a hand-drawn doodle annotation (underline, circle, arrow,
or checkmark).

**THIS IS NOT A DATA VISUALIZATION STYLE.** Do not plan charts, diagrams, or illustrations.
Instead, plan TEXT CARDS that display the narrator's actual words.

**COLOR RULES:**
- Rotate through the 3 brand colors provided in the user guidance
- Never use the same background color 3 times in a row
- Text color: white (#FFFFFF) on dark backgrounds, black (#000000) on light backgrounds
- Use contrast ratio check: if background luminance > 0.5, use black text; otherwise white

**DOODLE ANNOTATIONS:**
Each segment gets ONE emphasis word with a doodle type:
- "underline" (50% frequency) — wavy hand-drawn underline
- "circle" (20%) — loose ellipse around the word
- "arrow" (15%) — curved arrow pointing to the word
- "checkmark" (10%) — hand-drawn check mark next to the word
- null (5%) — no doodle

**DISPLAY MODES:**
- "phrase" — entire phrase appears at once with scale animation (use for short punchy text, 2-4 words)
- "word-by-word" — words pop in one at a time synced to timestamps (use for dramatic reveals, 4-8 words)

**PACING:** Fast — each text card lasts 0.6-4 seconds matching voiceover speed.
""",
```

**Step 2: Add kinetic-typography branch in build_director_user_message**

In `build_director_user_message()`, after the `style_desc` lookup (line 572) and before the return statement (line 618), add a conditional that returns a completely different prompt for kinetic-typography:

```python
    # Kinetic typography uses a fundamentally different output schema
    if style_preset == "kinetic-typography":
        return _build_kinetic_typography_director_message(
            project_id=project_id,
            formatted_transcript=formatted_transcript,
            width=width,
            height=height,
            duration_frames=duration_frames,
            fps=fps,
            style_desc=style_desc,
            style_guide=style_guide,
            output_dir=output_dir,
        )
```

**Step 3: Implement the kinetic typography director message function**

Add this new function ABOVE `build_director_user_message()` (around line 535):

```python
def _build_kinetic_typography_director_message(
    project_id: str,
    formatted_transcript: str,
    width: int,
    height: int,
    duration_frames: int,
    fps: int,
    style_desc: str,
    style_guide: str | None = None,
    output_dir: str | None = None,
) -> str:
    """Build Director message for kinetic-typography style.

    Outputs a different schema: text-card segments with word timings,
    background colors, emphasis words, and doodle types.
    """
    duration_seconds = duration_frames / fps
    aspect_ratio = get_aspect_ratio_name(width, height)

    # Parse brand colors from style_guide JSON (injected by frontend)
    brand_colors_section = ""
    if style_guide and style_guide.strip():
        try:
            import json as _json
            parsed = _json.loads(style_guide.split("\n")[0])
            if parsed.get("kineticTypography") and parsed.get("brandColors"):
                bc = parsed["brandColors"]
                brand_colors_section = f"""
**BRAND COLORS (from user):**
- Accent: {bc.get('accent', '#00E556')}
- Dark: {bc.get('dark', '#000000')}
- Light: {bc.get('light', '#EBEBEB')}

Rotate through these 3 colors for backgrounds. Never use the same color 3x in a row.
"""
                # Remove the JSON line from style_guide so remaining text is user prose
                remaining = "\n".join(style_guide.split("\n")[1:]).strip()
                if remaining:
                    brand_colors_section += f"\n**Additional user guidance:** {remaining}\n"
        except Exception:
            pass

    if not brand_colors_section:
        brand_colors_section = """
**BRAND COLORS (defaults):**
- Accent: #00E556
- Dark: #000000
- Light: #EBEBEB

Rotate through these 3 colors for backgrounds. Never use the same color 3x in a row.
"""

    # Use absolute paths when output_dir is provided
    if output_dir:
        abs_plan_path = output_dir.replace("\\", "/") + "/SCENE_PLAN.md"
        abs_scenes_path = output_dir.replace("\\", "/") + "/scenes.json"
    else:
        abs_plan_path = "SCENE_PLAN.md"
        abs_scenes_path = "scenes.json"

    return f"""
## PROJECT: {project_id}

## CANVAS SPECIFICATIONS
- Dimensions: {width}x{height}px
- Aspect Ratio: {aspect_ratio}
- Duration: {duration_frames} frames ({duration_seconds:.1f}s)
- FPS: {fps}

## VISUAL STYLE: KINETIC TYPOGRAPHY
{style_desc}
{brand_colors_section}
{formatted_transcript}

## YOUR TASK

Group the transcript words into text-card segments (2-8 words each) and assign visual properties.

### Step 1: Group Words into Segments
- Read every word and its timestamp from the transcript
- Group consecutive words into short phrases (2-8 words)
- Break at natural pauses, sentence boundaries, or emphasis points
- Each segment becomes one full-screen text card

### Step 2: Assign Visual Properties
For each segment:
1. Pick a background color (rotate through brand colors, never 3x in a row)
2. Pick text color (white on dark backgrounds, black on light backgrounds)
3. Choose displayMode: "phrase" for short punchy text (2-4 words), "word-by-word" for dramatic reveals (4-8 words)
4. Pick ONE emphasis word and a doodle type (underline 50%, circle 20%, arrow 15%, checkmark 10%, null 5%)

### Step 3: Write Output Files

**CRITICAL: You MUST use the Write tool to create these files at the EXACT paths below.**

#### 1. SCENE_PLAN.md
**EXACT path:** `{abs_plan_path}`
Human-readable plan listing each segment with its text, timing, colors, and emphasis.

#### 2. scenes.json
**EXACT path:** `{abs_scenes_path}`
Machine-readable with this EXACT structure:

```json
{{{{
  "projectId": "{project_id}",
  "style": "kinetic-typography",
  "fps": {fps},
  "totalFrames": {duration_frames},
  "durationSeconds": {duration_seconds:.1f},
  "canvas": {{ "width": {width}, "height": {height} }},
  "segments": [
    {{{{
      "id": 1,
      "text": "Every product",
      "words": [
        {{ "word": "Every", "start": 0.48, "end": 0.72 }},
        {{ "word": "product", "start": 0.72, "end": 1.12 }}
      ],
      "startTime": 0.48,
      "endTime": 1.12,
      "startFrame": 14,
      "endFrame": 34,
      "background": "#00E556",
      "textColor": "#000000",
      "displayMode": "phrase",
      "emphasis": {{ "word": "product", "doodle": "underline" }}
    }}}}
  ]
}}}}
```

**SCHEMA RULES:**
- `segments` is an array of text cards, NOT scenes with visuals
- `words` array must include EVERY word with `start` and `end` timestamps from the transcript
- `startTime`/`endTime` = first word's start / last word's end
- `startFrame` = round(startTime * {fps}), `endFrame` = round(endTime * {fps})
- `background` = one of the 3 brand colors (hex string)
- `textColor` = "#FFFFFF" or "#000000" based on background luminance
- `displayMode` = "phrase" or "word-by-word"
- `emphasis.word` = one word from `text`, `emphasis.doodle` = "underline"|"circle"|"arrow"|"checkmark"|null

**CRITICAL CONSTRAINTS:**
- First segment must start at the first word's timestamp
- Last segment must end at the last word's timestamp
- Segments MUST be contiguous — no gaps in transcript coverage
- Every word from the transcript must appear in exactly one segment
- Total segment count: typically 15-60 depending on transcript length

## FINAL CHECKLIST
1. [ ] Used Write tool to create `{abs_plan_path}`
2. [ ] Used Write tool to create `{abs_scenes_path}`
3. [ ] scenes.json has valid JSON with "style": "kinetic-typography"
4. [ ] Every transcript word appears in exactly one segment
5. [ ] Segments are contiguous (no gaps)
6. [ ] Background colors rotate (never 3x same in a row)
7. [ ] Each segment has exactly one emphasis word with doodle type

When your plan files are written, respond: "PLANNING COMPLETE"
"""
```

**Step 4: Verify Python syntax**

Run: `cd /Users/sarthakpant/project/clippify && python3 -c "from packages.worker.src.agents.prompts.director import build_director_user_message; print('OK')" 2>&1 || python3 -c "import ast; ast.parse(open('packages/worker/src/agents/prompts/director.py').read()); print('Syntax OK')"`
Expected: "Syntax OK" or "OK"

**Step 5: Commit**

```bash
git add packages/worker/src/agents/prompts/director.py
git commit -m "feat: add kinetic-typography Director prompt with text-card segment schema"
```

---

## Task 3: Add Kinetic Typography Mode to Animator Prompt

**Files:**
- Modify: `packages/worker/src/agents/prompts/animator.py:880-936` (system prompt, add kinetic-typography section)
- Modify: `packages/worker/src/agents/prompts/animator.py:939-998` (build_animator_user_message)

**Context:** The Animator's system prompt (`ANIMATOR_SYSTEM_PROMPT`) has a `<studio_templates>` section (lines 881-935) that activates when the Director's plan uses the Studio style. We need an equivalent `<kinetic_typography>` section. The Animator reads the Director's `scenes.json` which will have `"style": "kinetic-typography"` — this is how it knows to use the kinetic typography instructions.

The Animator's `build_animator_user_message()` (line 939) currently only takes `project_id`. We don't need to change its signature — the kinetic-typography instructions in the system prompt will activate when the Animator reads `scenes.json` and sees `"style": "kinetic-typography"`.

**Step 1: Add kinetic_typography section to ANIMATOR_SYSTEM_PROMPT**

In `animator.py`, add this section BEFORE the closing `</studio_templates>` section's `"""` (before line 936), as a sibling section:

```python
</studio_templates>

<kinetic_typography>
## KINETIC TYPOGRAPHY — COMPONENT GENERATION

When scenes.json has `"style": "kinetic-typography"`, you are generating a text-card animation,
NOT data visualizations. The Director's output contains `segments` (not `scenes`).

### Required Components

Generate these components in `index.tsx` (the main Remotion composition):

**1. Scene Component (per segment)**
- Full-screen `<AbsoluteFill>` with solid background color from segment's `background`
- Centers text content horizontally and vertically
- Contains either PhraseReveal or WordByWord based on `displayMode`
- Contains doodle annotation overlay for the emphasis word

**2. PhraseReveal (displayMode: "phrase")**
```tsx
// Entire phrase scales from 0.7 → 1 with spring animation
const scale = spring({ fps, frame: frame - startFrame, config: { damping: 12, stiffness: 100 } });
const opacity = interpolate(frame - startFrame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
<div style={{
  transform: `scale(${0.7 + scale * 0.3})`,
  opacity,
  fontSize: /* 80-120px based on word count, fewer words = larger */,
  fontWeight: 900,
  fontFamily: "'Inter', sans-serif",
  color: segment.textColor,
  textAlign: 'center',
  padding: '0 10%',
}}>
  {segment.text}
</div>
```

**3. WordByWord (displayMode: "word-by-word")**
```tsx
// Words appear one at a time, synced to their timestamps
{segment.words.map((w, i) => {
  const wordFrame = Math.round(w.start * fps);
  const isVisible = frame >= wordFrame;
  const localFrame = frame - wordFrame;
  const wordScale = isVisible
    ? spring({ fps, frame: localFrame, config: { damping: 10, stiffness: 120 } })
    : 0;
  return (
    <span key={i} style={{
      display: 'inline-block',
      transform: `scale(${0.5 + wordScale * 0.5})`,
      opacity: isVisible ? 1 : 0,
      marginRight: '0.3em',
      fontSize: /* 60-100px */,
      fontWeight: 900,
      fontFamily: "'Inter', sans-serif",
      color: segment.textColor,
    }}>
      {w.word}
    </span>
  );
})}
```

**4. Doodle Annotations (SVG overlays)**
Each doodle is an SVG that appears ~6 frames AFTER the emphasis word appears.
Use `stroke-dasharray` + `stroke-dashoffset` animated with spring for a draw-on effect.

**DoodleUnderline:**
```tsx
// Wavy SVG line under the emphasis word
<svg width={wordWidth + 20} height="20" style={{ position: 'absolute', bottom: -5, left: -10 }}>
  <path
    d={`M 0 10 Q ${wordWidth * 0.25} 0, ${wordWidth * 0.5} 10 Q ${wordWidth * 0.75} 20, ${wordWidth} 10`}
    stroke={doodleColor}
    strokeWidth="3"
    fill="none"
    strokeLinecap="round"
    strokeDasharray={pathLength}
    strokeDashoffset={interpolate(drawProgress, [0, 1], [pathLength, 0])}
  />
</svg>
```

**DoodleCircle:**
```tsx
// Loose ellipse around the word
<svg width={wordWidth + 30} height={wordHeight + 20}>
  <ellipse cx="50%" cy="50%" rx={wordWidth * 0.6} ry={wordHeight * 0.7}
    stroke={doodleColor} strokeWidth="3" fill="none"
    strokeDasharray={pathLength}
    strokeDashoffset={interpolate(drawProgress, [0, 1], [pathLength, 0])}
    transform={`rotate(-5 ${cx} ${cy})`}
  />
</svg>
```

**DoodleArrow:**
```tsx
// Curved arrow pointing to word from above-right
<svg width="60" height="60">
  <path d="M 50 10 Q 30 5, 15 25 L 20 20 M 15 25 L 22 28"
    stroke={doodleColor} strokeWidth="3" fill="none" strokeLinecap="round"
    strokeDasharray={pathLength}
    strokeDashoffset={interpolate(drawProgress, [0, 1], [pathLength, 0])}
  />
</svg>
```

**DoodleCheckmark:**
```tsx
// Hand-drawn check next to word
<svg width="40" height="40">
  <path d="M 8 20 L 16 28 L 32 12"
    stroke={doodleColor} strokeWidth="3" fill="none" strokeLinecap="round"
    strokeDasharray={pathLength}
    strokeDashoffset={interpolate(drawProgress, [0, 1], [pathLength, 0])}
  />
</svg>
```

### Doodle Color Rule
- On dark backgrounds: doodle color = white (#FFFFFF)
- On light backgrounds: doodle color = black or dark accent

### Draw Animation
```tsx
const drawProgress = spring({
  fps,
  frame: frame - (emphasisFrame + 6), // 6 frames after text appears
  config: { damping: 15, stiffness: 80 },
});
```

### Font Loading
Import Inter Black from Google Fonts:
```tsx
import { loadFont } from "@remotion/google-fonts/Inter";
const { fontFamily } = loadFont();
```

### Composition Structure
```tsx
const KineticTypography: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const segments = [...]; // From scenes.json

  return (
    <AbsoluteFill>
      {segments.map((seg) => (
        <Sequence key={seg.id} from={seg.startFrame} durationInFrames={seg.endFrame - seg.startFrame}>
          <AbsoluteFill style={{ backgroundColor: seg.background }}>
            {/* Text content */}
            {seg.displayMode === 'phrase'
              ? <PhraseReveal segment={seg} />
              : <WordByWord segment={seg} />}
            {/* Doodle overlay */}
            {seg.emphasis.doodle && <DoodleOverlay segment={seg} />}
          </AbsoluteFill>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
```

### CRITICAL RULES
- Hard cuts between segments — NO dissolves or fade transitions
- Font size: 60-120px, scale inversely with word count (fewer words = bigger)
- All text centered on screen
- MANDATORY: `{ extrapolateRight: 'clamp' }` on ALL interpolate calls
- Segment data comes from scenes.json — read it and embed as constants
- This is a SINGLE index.tsx file, no separate scene files needed
</kinetic_typography>
```

Note: this means the `ANIMATOR_SYSTEM_PROMPT` string's closing `"""` needs to move after the new section. The actual edit inserts the `<kinetic_typography>...</kinetic_typography>` block after the `</studio_templates>` tag.

**Step 2: Verify Python syntax**

Run: `python3 -c "import ast; ast.parse(open('packages/worker/src/agents/prompts/animator.py').read()); print('Syntax OK')"`
Expected: "Syntax OK"

**Step 3: Commit**

```bash
git add packages/worker/src/agents/prompts/animator.py
git commit -m "feat: add kinetic-typography Animator prompt with component generation instructions"
```

---

## Task 4: Wire Kinetic Typography Through the Visual Generator Pipeline

**Files:**
- Modify: `packages/worker/src/agents/claude_visual_generator.py:3220-3229`

**Context:** The pipeline at `claude_visual_generator.py:3220-3229` has special handling for the "studio" style — it injects the template catalog into the Director prompt. For kinetic-typography, the Director prompt already handles everything via the conditional in `build_director_user_message()`. The Animator's system prompt already has the kinetic-typography section. So the pipeline wiring is minimal — we just need to ensure the style flows through without issues.

However, there's one improvement: for kinetic-typography, the layout should always be `pip` (fullscreen visuals, no split-screen needed since it's just text on backgrounds). We should enforce this or at least not break if split mode is selected.

**Step 1: Add kinetic-typography handling in generate_two_phase**

In `claude_visual_generator.py`, after the studio template injection block (around line 3229), add:

```python
        # For kinetic-typography: log that style is active.
        # No special injection needed — Director and Animator prompts handle it.
        if style_preset == "kinetic-typography":
            safe_print("[ClaudeGenerator] Kinetic typography style active — Director will output text-card segments")
```

That's it for the pipeline — the prompt changes in Tasks 2 and 3 handle everything.

**Step 2: Verify the full flow compiles**

Run: `python3 -c "import ast; ast.parse(open('packages/worker/src/agents/claude_visual_generator.py').read()); print('Syntax OK')"`
Expected: "Syntax OK"

**Step 3: Commit**

```bash
git add packages/worker/src/agents/claude_visual_generator.py
git commit -m "feat: wire kinetic-typography style through visual generator pipeline"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `apps/web/src/lib/api.ts` | Add `'kinetic-typography'` to `StylePreset` union type |
| `apps/web/src/features/editor-v2/components/StyleSelectionModal.tsx` | Add style option card + brand color pickers + inject colors into styleGuide |
| `packages/worker/src/agents/prompts/director.py` | Add `STYLE_PRESET_DESCRIPTIONS["kinetic-typography"]` + `_build_kinetic_typography_director_message()` for text-card segment schema |
| `packages/worker/src/agents/prompts/animator.py` | Add `<kinetic_typography>` section to `ANIMATOR_SYSTEM_PROMPT` with Scene/PhraseReveal/WordByWord/Doodle component generation instructions |
| `packages/worker/src/agents/claude_visual_generator.py` | Add log line for kinetic-typography style (pipeline wiring already handled by prompt changes) |

## What Stays the Same

- Rendering pipeline (Remotion bundling, FFmpeg) — untouched
- Layout system (PiP, split, fullscreen, overlay) — works as-is
- Timeline, captions, export — all untouched
- The visual layer renders kinetic typography instead of charts/diagrams
