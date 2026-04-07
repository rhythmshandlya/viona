# Kinetic Luxe v2 — Design Spec

## Problem

Kinetic Luxe captions were built as a renderer + Caption Agent prototype. After hands-on tuning with a real project (Algeria Internet Shutdowns, 42 phrases, 65 seconds), we discovered 19 issues documented in `docs/caption-agent-tuning-log.md`. The system needs to graduate from prototype to product: schema gaps filled, Caption Agent prompt rewritten with learned intelligence, renderer cleaned up, frontend settings built, and orchestrator dispatch fixed.

## Solution

Full end-to-end overhaul: schema fixes, Caption Agent prompt rewrite using WPM-based intelligence, renderer cleanup, frontend font pair picker and caption settings, and orchestrator auto-dispatch fix.

## Core Principle

**Caption Agent = intelligence (what to show). Renderer = presentation (how to show it). Frontend = configuration (user choices). No overlap.**

---

## 1. Schema & Data Model

### displayMode enum

Add `'kinetic-luxe'` to `manifestCaptionPresetSchema.displayMode`. Make it the **default** for all new projects.

```typescript
// packages/shared/src/manifest-shared.ts
displayMode: z.enum(['word-by-word', 'phrase', 'karaoke', 'poster-staircase', 'kinetic-luxe']).default('kinetic-luxe')
```

### New captionPreset fields

```typescript
heroFontFamily: z.string().optional()    // serif/display font for hero words
heroColor: z.string().optional()          // hero word color
managedByAgent: z.boolean().optional()    // protects from syncCaptions destruction
fontPairId: z.string().optional()         // active font pair preset ID
```

### Deprecate

- `kineticConfig` nested object — not used, fields live flat on captionPreset
- `wordsPerPhrase` — irrelevant for kinetic-luxe (agent decides phrasing). Keep in schema for backward compatibility with other modes.

### Font pair presets

Shared constant (not DB), defined in `packages/shared/src/caption-font-pairs.ts`:

```typescript
export const CAPTION_FONT_PAIRS = {
  classic: {
    id: 'classic',
    label: 'Classic',
    heroFontFamily: "'Playfair Display', serif",
    fontFamily: "'Inter', sans-serif",
    heroColor: '#e63946',
    color: '#ffffff',
    // Approximate char width factors for layout math
    serifCwf: 0.43,
    sansCwf: 0.48,
  },
  cinematic: {
    id: 'cinematic',
    label: 'Cinematic',
    heroFontFamily: "'Cormorant Garamond', serif",
    fontFamily: "'Space Grotesk', sans-serif",
    heroColor: '#e63946',
    color: '#ffffff',
    serifCwf: 0.40,
    sansCwf: 0.46,
  },
  poster: {
    id: 'poster',
    label: 'Poster',
    heroFontFamily: "'DM Serif Display', serif",
    fontFamily: "'Bebas Neue', sans-serif",
    heroColor: '#e63946',
    color: '#ffffff',
    serifCwf: 0.42,
    sansCwf: 0.35,
  },
} as const;
```

### captionWordSchema

Already has `hero: z.boolean().optional()`. No changes needed.

---

## 2. Caption Agent Prompt — Complete Rewrite

### Philosophy

Replace mechanical `wordsPerPhrase` grouping with **speaking pace analysis (WPM)** as the core framework. All rules derive from WPM:
- Fast speech → fewer heroes, shorter phrases, mostly satellite
- Slow speech → more heroes, dramatic timing
- Pace transitions → biggest hero moments

### Prompt structure (system.md)

**Section 1: Role**
Typography director owning phrase boundaries, hero selection, punctuation, and preset configuration.

**Section 2: Analysis phase** (before creating any items)
1. Read full transcript, compute WPM per section (sliding window ~5-10 seconds)
2. Identify breath groups (word clusters separated by gaps >= 300ms)
3. Classify sections: fast (>200 WPM), moderate (150-200), slow (<150)
4. Read manifest for scene boundaries — never span a caption across a scene cut

**Section 3: Phrase grouping rules**
- Split at word timestamp gaps >= 200ms
- Within breath groups: 3-5 word flow phrases
- Long phrases (6+ words with a hero): split into setup (all satellite) + payoff (short hero phrase, 2-4 words)
- Satellite-to-hero ratio per phrase: max 4:1. If over, expand heroes or split.
- Max phrase length: 5-6 words. Over that, split.

**Section 4: Hero assignment (WPM-driven)**

| Condition | Treatment |
|-----------|-----------|
| First phrase of video | Hero (opening hook) |
| First phrase after gap >= 300ms | Hero (breath opener) |
| Last phrase before gap >= 300ms | Hero (closing beat) |
| Continuation phrase (starts with "and"/"or"/"but", continues prev thought) | Inherit hero from previous |
| Fast section (>200 WPM) | Mostly satellite, hero only at rare pauses |
| Slow section (<150 WPM) | More heroes, ~1 every 3-4 seconds |
| Single-word dramatic pivot ("Why?") | Always hero, exempt from duration minimum |
| Everything else | Satellite |

**Section 5: Hero word selection priority**
1. Stats/numbers: always hero ("800,000", "eight", "$390 million")
2. Action verbs at hooks: "remember", "shuts down"
3. Key terms on first mention: "baccalaureate", "JEE", country names
4. Emotional peak words: "extreme", "severe", "outrage"
5. If hero word <= 6 chars and >= 3 satellite words around it: pair with adjacent word to form compound ("eight straight", "mass outrage", "million dollars")
6. Max 2 heroes per phrase. Never 3.

**Section 6: Minimum duration**
- Multi-word hero phrase: >= 1000ms or demote to all-satellite
- Single-word pivots: exempt (the flash IS the effect)

**Section 7: Punctuation inference**
- `?` — rhetorical questions, interrogative delivery
- `!` — shocking reveals, dramatic stats, exclamations
- `.` — definitive closers, grave statements
- `...` — trailing off, dramatic pause before reveal
- Infer from context (transcript has no punctuation)

**Section 8: Reference example**
Full Algeria Internet Shutdowns timeline (from tuning log) showing:
- 45 phrases with WPM per breath group
- Hero annotations with reasoning
- Punctuation applied
- Setup/payoff splits highlighted
- Before (62% hero density, visual chaos) vs After (42%, breathing room)

**Section 9: Self-validation**
- All transcript words accounted for (no gaps, no duplicates)
- No phrase time overlaps
- Hero count 0-2 per phrase
- Timing monotonically increases
- Satellite-to-hero ratio <= 4:1 per phrase
- No hero phrase under 1000ms (except single-word pivots)
- Caption track is highest position

### Reminder prompt (reminder.md)

Compressed version of the above — critical rules only:
- WPM drives hero density
- Max 2 heroes, max 4:1 sat-to-hero ratio
- Split phrases over 5-6 words
- Add punctuation (?, !, .)
- 1000ms minimum for multi-word hero phrases
- Validate: no overlaps, no gaps, monotonic timing

---

## 3. KineticLuxeCaption Renderer Cleanup

### Props interface change

```typescript
interface KineticLuxeCaptionProps {
  words: Array<{ text: string; startMs: number; endMs: number; hero?: boolean }>;
  itemStartMs: number;
  heroFontFamily?: string;
  heroColor?: string;
  satFontFamily?: string;
  satColor?: string;
  fontPairId?: string;
  offsetY?: number;
}
```

No more `config?: KineticConfig` nested object.

### PlayerComposition routing update

```typescript
case 'caption': {
  if (captionPreset?.displayMode === 'kinetic-luxe') {
    return (
      <KineticLuxeCaption
        words={item.data.words}
        itemStartMs={item.startMs}
        heroFontFamily={captionPreset.heroFontFamily}
        heroColor={captionPreset.heroColor}
        satFontFamily={captionPreset.fontFamily}
        satColor={captionPreset.color}
        fontPairId={captionPreset.fontPairId}
        offsetY={captionPreset.position?.offsetY}
      />
    );
  }
  // ... existing fallbacks
}
```

Remove `poster-staircase` from the kinetic-luxe routing condition — it should use CaptionItem's own poster-staircase renderer.

### Char width factors per font pair

Replace hardcoded `SERIF_CWF`/`SANS_CWF` constants with lookup from `CAPTION_FONT_PAIRS[fontPairId]`. Falls back to classic values if unknown fontPairId.

### Keep

- Phase 1: Hero detection from `word.hero` with static fallback
- Phase 2: Hero font sizing (MIN_HERO_FONT=90, MAX_HERO_FONT=160, overflow safety)
- Phase 3: Block building (hero runs, satellite wrapping)
- Phase 4: Vertical stacking with poke-aware collision detection
- Phase 5: Horizontal alignment (simplified poke alignment: left-align before hero, right-align after, clamp within bounds)
- Phase 6: Cluster re-centering (shift all blocks so cluster midpoint = containerW/2)
- All-satellite shortcut (42px, 70% width wrapping, vertically centered in caption zone)
- Bounding box wrapper div (containerW wide, data-caption-overlay attribute)
- Spring animation on hero, opacity fade on satellite

### Remove

- Full poke-gap-detection Phase 5 (100 lines of gap scanning) — replaced by simplified left/right alignment
- Hardcoded font family/color constants — now from props

---

## 4. Frontend Caption Settings

### DisplayMode selector

Add kinetic-luxe option to the existing W/P/K/S selector. When kinetic-luxe is selected, swap visible controls to kinetic-luxe-specific panel.

### Kinetic-luxe panel shows:

1. **Font pair picker** — 3 cards (Classic, Cinematic, Poster) each showing a mini preview. Selecting sets `heroFontFamily`, `fontFamily`, `heroColor`, `color`, `fontPairId` as a batch via `update_caption_preset`.

2. **Hero color picker** — sets `heroColor`. Keep existing color picker component.

3. **Satellite color picker** — sets `color`. Keep existing color picker component.

4. **Position controls** — anchor (top/center/bottom) + offsetY slider. Same as existing.

5. **"AI-managed" badge** — when `managedByAgent: true`, shows indicator. Not a toggle.

6. **"Regenerate captions" button** — dispatches Caption Agent via sandbox prompt endpoint. Visible only for kinetic-luxe.

### Hide when kinetic-luxe active:

- wordsPerPhrase slider
- animation in/active/out dropdowns
- word emphasis role editor
- typography pairing selector (old system)
- staircase alignment dropdown

### Clean up:

Remove old poster-staircase/cinematic code paths from the kinetic-luxe selection handler. Currently selecting kinetic-luxe in frontend may trigger old preset application code that conflicts.

---

## 5. Orchestrator Dispatch Fix

### Problem

Caption Agent dispatched at Phase 2.5 returned in 443ms with zero tool calls. The SDK session likely failed silently.

### Fix: failure detection + retry

```
After Caption Agent returns:
1. Check return time — if < 5 seconds, treat as suspicious
2. Read manifest — check for caption track + items + managedByAgent
3. If all present → success, proceed
4. If missing → Caption Agent failed:
   a. Log warning
   b. Try ONE re-dispatch with explicit error context
   c. If re-dispatch also fails → degraded fallback (generate_captions tool, displayMode: 'phrase')
```

### Parallel dispatch enforcement

Orchestrator prompt must explicitly say: "Dispatch Caption Agent AND Planner in a SINGLE response with TWO parallel Agent tool calls." Currently the prompt says parallel but doesn't enforce the single-response requirement.

### Phase 6.5 caption sync

After Layout Editor completes:
1. Read manifest, get all scene boundaries (where scene items start/end)
2. Check each caption item — does its time range span a scene boundary?
3. If yes → re-dispatch Caption Agent with sync instructions listing boundary timestamps
4. If no → skip, proceed to Phase 7

### Fallback chain

```
Caption Agent succeeds     → kinetic-luxe + hero annotations + managedByAgent
Caption Agent fails (2x)   → generate_captions tool → phrase mode, no heroes
No transcript at all       → no captions
```

---

## 6. Separation of Concerns

| Component | Owns | Does NOT touch |
|-----------|------|----------------|
| **Caption Agent** | Phrase boundaries, hero selection, punctuation, WPM analysis, satellite-to-hero ratio, caption-plan.json, managedByAgent flag | Font sizes, layout algorithm, spring animation, colors |
| **Renderer** | Font sizing (min/max), vertical stacking, poke alignment, cluster centering, bounding box, animation | Which words are heroes, phrase boundaries, punctuation |
| **captionPreset** | Font pair, colors, position, displayMode, managedByAgent | Content decisions, layout algorithm |
| **Frontend** | Font pair picker, color pickers, position controls, regenerate button, displayMode selector | Word-level hero annotations, phrase boundaries |
| **Orchestrator** | When to dispatch Caption Agent, fallback on failure, phase coordination | Caption content, styling, layout |

---

## Files to Create or Modify

### Create
- `packages/shared/src/caption-font-pairs.ts` — font pair presets constant
- `packages/sandbox/src/prompts/caption-agent/system.md` — complete rewrite
- `packages/sandbox/src/prompts/caption-agent/reminder.md` — rewrite

### Modify
- `packages/shared/src/manifest-shared.ts` — displayMode enum + new captionPreset fields
- `packages/sandbox/template/src/items/KineticLuxeCaption.tsx` — props from captionPreset, font pair lookup, remove hardcoded fonts/colors
- `packages/sandbox/template/src/PlayerComposition.tsx` — updated routing, pass captionPreset fields as props
- `packages/sandbox/src/orchestrator.ts` — failure detection, parallel dispatch, Phase 6.5 sync
- `packages/sandbox/src/prompts/orchestrator/system.md` — enforce parallel dispatch, add failure handling
- `packages/sandbox/src/tools/manifest-ops.ts` — update_caption_preset to accept new fields
- `apps/web/src/features/editor-v2/panels/StylePanel.tsx` — kinetic-luxe mode UI, font pair picker, hide irrelevant controls
- `apps/web/src/features/editor-v2/store/manifest-bridge.ts` — already preserves hero field (done)

### Reference
- `docs/caption-agent-tuning-log.md` — source of truth for all rules and examples
