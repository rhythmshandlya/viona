# Caption Agent Tuning Log

## Context
Project: Viona Video Editor — KineticLuxeCaption system
Date: 2026-04-06
Test project: `666a696d-13ca-4287-b654-d3f1a40fb0a0` (Algeria Internet Shutdowns)

---

## Issue 1: Hero words on every phrase — visual chaos

**Problem:** The Caption Agent marked hero words on nearly every phrase (26/42 = 62%). When phrases are back-to-back with no natural pause, the constant big/small typography switching creates visual chaos — the eye can't settle.

**Insight:** The transcript has natural "breath" gaps (300-580ms) between groups of phrases. These gaps are where the dramatic hero/satellite treatment works. Continuous phrases within a flow group should be uniform satellite text.

**Prompt sent to Caption Agent:**
```
Fix caption hero distribution — heroes should only appear on "breath" phrases, not every phrase.

Right now every phrase has hero/satellite treatment which creates visual chaos because phrases flow back-to-back with no pause between them.

The rule: Look at the gaps between phrases. When there's a natural pause (gap ≥ 300ms before a phrase), that phrase is a "breath phrase" — it can have hero words with the big dramatic sizing. When phrases are continuous (gap < 300ms from previous phrase), they should have ALL words marked hero: false — uniform satellite text only.

Exception: the very first phrase always gets hero treatment.

What this looks like in practice:
- Phrase 1 "Do you remember the dividers" → has heroes (first phrase)
- Phrase 2 "we used to use in school" → gap 0ms → ALL satellite, no heroes
- Phrase 3 "to prevent cheating" → gap 0ms → ALL satellite, no heroes
- Phrase 4 "Well some countries take more extreme measures" → gap 580ms → can have heroes
- Phrase 5 "China uses drones" → gap 580ms → can have heroes
- Phrase 6 "and facial recognition" → gap 0ms → ALL satellite, no heroes

Steps:
1. Read the manifest to get all caption items sorted by startMs
2. For each caption item, calculate the gap from the previous item's endMs
3. If gap < 300ms AND it's not the first phrase: update that item to set ALL words to hero: false
4. If gap ≥ 300ms OR it's the first phrase: keep existing hero annotations (or pick 1-2 heroes if none exist)
5. Update each modified caption item via update_item

Do NOT regenerate phrases or change timing — only modify the hero field on existing words.
```

**Result:** Caption Agent reduced heroes to 8/42 phrases (19%). All breath phrases retained heroes, all flow phrases became all-satellite. ✅

---

## Issue 2: `hero` field stripped by manifest-bridge

**Problem:** After the Caption Agent correctly set hero annotations in the sandbox manifest, the frontend preview showed no difference — all words rendered the same size. The `hero` field was being silently stripped by `manifest-bridge.ts` when converting manifest→store and store→manifest.

**Fix:** Added `hero` preservation to both directions in `apps/web/src/features/editor-v2/store/manifest-bridge.ts`:
- manifest→store (line ~341): Added `...(w.hero !== undefined ? { hero: w.hero } : {})`
- store→manifest (line ~494): Same preservation

---

## Issue 3: All-satellite phrases render broken layout

**Problem:** When a phrase has zero hero words (`hero: false` on all), the KineticLuxeCaption layout algorithm crashes — it tries to build hero runs from an empty array, gets `[undefined]`, computes nonsensical font sizes, and renders words one-per-line or not at all.

**Fix:** Added an all-satellite shortcut in `KineticLuxeCaption.tsx` — when `heroIndices.length === 0`, skip the hero sizing/run logic entirely and render all words as clean centered satellite blocks with a fixed font size (42px) and full container width wrapping.

---

## Issue 4: First phrase hero word choice

**Problem:** Caption Agent picked "dividers" as the hero for "Do you remember the dividers". User wanted "remember" — the action verb that hooks the viewer.

**Fix:** Manual update via ops endpoint. This should inform prompt tuning — hero selection should prefer action verbs over nouns when the phrase is an opening hook.

---

## Issue 5: Phrases too long — need semantic splitting

**Problem:** "Well some countries take more extreme measures" was one 7-word phrase with "extreme" as hero. The whole thing renders as one block, but semantically it's a setup ("Well some countries take") followed by a payoff ("more extreme measures"). Slamming it together loses the dramatic beat.

**What we did:** Split into two caption items manually:
1. `removeItem` on the original 7-word phrase
2. `addItem` × 2 — because `split_item` doesn't support captions (blocker B3)
   - "Well some countries take" (3420-4520ms) — all `hero: false` (flow phrase, no gap before next)
   - "more extreme measures" (4520-5720ms) — "extreme" as hero

**How the Caption Agent should handle phrasing (two-pass approach):**

### Pass 1 — Phrase grouping

The agent should think about **breath groups** — clusters of continuous speech separated by natural pauses (≥300ms gaps in word timestamps).

Within a breath group:
- Split into short flow phrases (3-4 words each)
- Flow phrases are the "setup" — they carry the narrative forward
- Keep them tight and uniform (all satellite, no heroes)

At breath boundaries:
- The first phrase after a gap is the "payoff" — short, punchy (2-4 words)
- This is where the hero word lives
- The breath phrase should contain the key term the speaker is emphasizing

**Example breakdown:**
```
[580ms gap]
  "Well some countries take"     ← flow (setup, satellite only)
  "more extreme measures"        ← payoff within same breath, but "extreme" is the punch
[580ms gap]
  "China uses drones"            ← breath phrase (hero: China, drones)
  "and facial recognition"       ← flow (satellite only)
[500ms gap]
  "India uses fingerprinting"    ← breath phrase (hero: India, fingerprinting)
  "and biometric technology"     ← flow (satellite only)
```

### Pass 2 — Hero annotation

- **First phrase of video:** always gets a hero (the opening hook)
- **Breath phrases** (gap ≥ 300ms before): pick 1-2 heroes — the key terms
- **Flow phrases** (gap < 300ms, not first): ALL `hero: false`
- Hero selection priority: action verbs for hooks ("remember", "shuts down"), key nouns for facts ("Algeria", "800,000"), emotional words for impact ("extreme", "severe")

### Key insight

The Caption Agent shouldn't just count words per phrase (the old `wordsPerPhrase: 5` mechanical approach). It should read the transcript semantically:
- Where does the speaker pause? → phrase boundary
- What's the setup vs the payoff? → flow vs breath
- What word carries the weight? → hero

This is why we need AI for captions — mechanical splitting can't distinguish "Well some countries take / more extreme measures" from "Well some countries / take more extreme measures". Only semantic understanding gets it right.

---

## Issue 6: Hero rule too aggressive — closing beats and paired phrases need heroes too

**Problem:** The breath-phrase rule (Issue 1) went too far. Two cases where flow phrases still need heroes:

### 6a: Closing beat before a gap

"to prevent cheating" is the last phrase before a 580ms gap. It's the payoff of the opening section — "cheating" is THE word the whole intro builds toward. But our rule only gives heroes to the first phrase *after* a gap, not the last phrase *before* one.

```
Phrase 1: "Do you remember the dividers"  ← first phrase, has hero ✅
Phrase 2: "we used to use in school"       ← flow, no hero ✅
Phrase 3: "to prevent cheating"            ← flow, no hero ❌ should have "cheating" as hero
          [580ms gap]
Phrase 4: "Well some countries take"       ← flow setup ✅
```

**Updated rule:** Heroes appear on:
- First phrase of the video (opening hook)
- First phrase after a gap ≥ 300ms (breath opener)
- **Last phrase before a gap ≥ 300ms (closing beat / payoff)**

### 6b: Paired phrases in a sequence pattern

"China uses drones / and facial recognition" is one semantic beat split across two phrases. Same with "India uses fingerprinting / and biometric technology". Stripping heroes from the second half breaks the visual rhythm of the parallel structure.

```
Phrase 5: "China uses drones"           ← breath, heroes: China, drones ✅
Phrase 6: "and facial recognition"      ← flow, no heroes ❌ should have: facial, recognition
          [500ms gap]
Phrase 7: "India uses fingerprinting"   ← breath, heroes: India, fingerprinting ✅
Phrase 8: "and biometric technology"    ← flow, no heroes ❌ should have: biometric
```

**Updated rule:** When two phrases form a **continuation pattern** (second phrase starts with "and", "or", "but" and continues the same thought), the second phrase inherits the hero treatment of the first. The Caption Agent should recognize these as paired phrases.

### Refined hero assignment rules

1. **Opening hook:** First phrase → always hero
2. **Breath opener:** First phrase after gap ≥ 300ms → hero
3. **Closing beat:** Last phrase before gap ≥ 300ms → hero (the payoff word)
4. **Continuation pair:** If phrase starts with conjunction and continues previous phrase's thought → inherit hero treatment
5. **Pure flow:** Everything else → all satellite

This gives us three types of hero phrases (opener, closer, continuation) and one type of satellite phrase (pure flow). The gap threshold (300ms) still drives the primary distinction, but semantic context (conjunctions, parallel structure) modifies the rule.

### Manual fixes applied to test project

Applied all three fixes directly to the sandbox manifest:

```
1. [0ms]   Do you **remember** the dividers        ← opening hook
2. [0ms]   we used to use in school                 ← pure flow
3. [0ms]   to prevent **cheating?**                 ← closing beat (added hero + punctuation)
           [580ms gap]
4. [580ms] Well some countries take                 ← flow setup
5. [0ms]   more **extreme** measures                ← payoff
           [580ms gap]
6. [580ms] **China** uses **drones**                ← breath opener
7. [0ms]   and **facial** **recognition**           ← continuation pair (added heroes)
           [500ms gap]
8. [500ms] **India** uses **fingerprinting**        ← breath opener
9. [0ms]   and **biometric** technology             ← continuation pair (added hero)
           [400ms gap]
10.[400ms] And **Algeria**                          ← breath opener
```

---

## Issue 7: Punctuation for emphasis

**Observation:** The transcript is raw speech — no punctuation. But captions benefit from punctuation that matches the speaker's delivery. "to prevent cheating" is clearly a question in context ("Do you remember the dividers we used to use in school to prevent cheating?") — adding "?" makes the phrase land better visually.

**Rule for Caption Agent:** Add punctuation where the speaker's delivery implies it:
- `?` for rhetorical questions and interrogative delivery
- `!` for exclamations and emphasis
- `...` for trailing off or dramatic pause before a reveal
- `.` for definitive statements that close a section

The Caption Agent should infer punctuation from context, not just copy the raw transcript. This is another reason AI owns captions — mechanical splitting can't add punctuation.

---

## Issue 8: Hero phrases need minimum duration

**Problem:** "to prevent **cheating?**" is only 720ms. The hero spring animation needs time to scale in, the eye needs time to register the big/small layout, and then the phrase disappears. It flashes without landing.

**Durations of current hero phrases:**
```
1300ms  Do you **remember** the dividers     ← fine
 720ms  to prevent **cheating?**              ← too short ❌
1200ms  more **extreme** measures             ← fine
 640ms  **China** uses **drones**             ← too short ❌
 940ms  and **facial** **recognition**        ← borderline
 920ms  **India** uses **fingerprinting**     ← borderline
1160ms  and **biometric** technology          ← fine
 620ms  And **Algeria**                       ← too short ❌
```

**Rule:** Hero phrases need at least ~1000ms to work. If a phrase is too short for hero treatment, the Caption Agent has two options:
1. **Merge it** with the adjacent phrase to create a longer hero phrase (e.g. merge "to prevent" into "cheating?" so "to prevent cheating?" is one phrase with more duration)
2. **Drop to satellite** — keep the phrase but make it all-satellite if merging doesn't make sense

For the closing-beat case ("to prevent cheating?"), merging makes sense — the whole clause is "to prevent cheating?" and splitting "to prevent" from "cheating?" was artificial.

For paired phrases like "China uses drones" (640ms), the phrase grouping should either absorb it into a longer phrase or the Caption Agent should recognize it's too fast and keep it satellite, letting the continuation phrase ("and facial recognition", 940ms) carry the hero instead.

**Minimum duration threshold:** ~1000ms for hero treatment. Below that, the animation can't land.

---

## Issue 9: Speaking pace (WPM) as the core judgment signal

**Insight:** Words per minute is the real driver behind all the rules above. Instead of a pile of edge-case rules (breath gaps, continuation pairs, closing beats, minimum duration), the Caption Agent should think about **speaking pace** as the primary signal.

**How it works:**
- Compute WPM per section of the transcript (not just global average)
- Fast sections (high WPM, ~200+) → speaker is rattling off points → mostly satellite, heroes rare
- Slow sections (low WPM, ~120-150) → speaker is emphasizing, pausing → hero treatment works
- Transitional moments (WPM drops suddenly) → the speaker just slowed down for emphasis → strong hero candidate

**This subsumes the previous rules:**
- "Breath gaps" = the speaker slowed down → low local WPM → hero
- "Closing beat" = speaker pauses after a key word → gap after = low local WPM → hero
- "Too short for hero" = speaker is going fast → high local WPM → satellite
- "Continuation pair" = still semantic, but WPM tells you if there's time for heroes on both halves

**Example from test project:**
```
Phrases 1-3 (0-2840ms): "Do you remember the dividers we used to use in school to prevent cheating?"
  → 14 words in 2840ms = ~296 WPM — FAST
  → Only 1 hero max (the opening hook "remember"), rest satellite

Phrases 6-7 (6300-7880ms): "China uses drones and facial recognition"
  → 6 words in 1580ms = ~228 WPM — MODERATE-FAST
  → Heroes work on "China/drones" (breath phrase) but "facial/recognition" (0ms gap) is marginal

Phrase 10-14 (10860-20880ms): "And Algeria... shuts down... entire country"
  → Slower delivery with pauses → heroes land better
```

**For the Caption Agent prompt:** Instead of prescribing gap thresholds, tell the agent to:
1. Analyze speaking pace across the transcript
2. In fast sections: fewer heroes, shorter phrases, mostly satellite
3. In slow sections: more heroes, dramatic timing
4. At pace transitions (fast→slow): that's where the biggest hero moments live
5. Never put hero on a phrase shorter than 1000ms regardless of pace

---

## Issue 10: Long hero phrases must be split (consistent with Issue 5)

**Problem:** Phrase 17 "Well to prevent cheating on their annual **baccalaureate**" was 8 words, 2520ms — same pattern as Issue 5. The setup words ("Well to prevent cheating") and the payoff ("on their annual baccalaureate") were jammed together. The hero "baccalaureate" competes with 7 satellite words for visual attention.

**Fix:** Split into setup + payoff:
- "Well to prevent cheating" (21700-22640ms, 940ms) — all satellite
- "on their annual **baccalaureate**" (22640-24220ms, 1580ms) — hero payoff

**Rule for Caption Agent:** Any phrase over 5-6 words with a hero should be split so the hero lives in a short punchy phrase (2-4 words). The setup words go into a preceding satellite phrase. This is the same setup/payoff split pattern from Issue 5.

---

## Issue 11: Minimum hero font size — long hero text shrinks everything

**Problem:** "and **facial** **recognition**" — two consecutive hero words get merged into one hero run "facial recognition" (18 chars). The hero sizing formula divides target width by character count, giving heroFs=52px and satFs=18px. The entire phrase becomes tiny.

**Fix:** Added `MIN_HERO_FONT = 72` and `min satFs = 25` in KineticLuxeCaption.tsx. Long hero text is allowed to overflow past the 50% target width (capped at container width) rather than shrinking below readable sizes.

---

## Issue 12: Single-word dramatic phrases are exempt from duration minimum

**Problem:** "Why" (420ms) was left as satellite because it's below the 1000ms hero threshold. But it's a rhetorical pivot — the speaker pauses, says one word, then explains. It should be the biggest word on screen for that beat.

**Insight:** The 1000ms minimum exists because the hero/satellite *layout* (big word + small words) needs time for the eye to parse both sizes. But a single-word phrase has no layout to parse — it's just one big word. A dramatic flash at 420ms is exactly right for a single-word rhetorical question.

**Fix:** Made "Why?" a hero with punctuation.

**Rule for Caption Agent:** Single-word phrases at narrative pivot points (rhetorical questions, exclamations, dramatic reveals) should always be heroes regardless of duration. The duration minimum only applies to multi-word phrases where the eye needs time to process the hero/satellite size contrast.

---

## Issue 13: Short hero words crumble the layout — expand to 2 heroes

**Problem:** "There have been **eight** straight years" — "eight" is 5 characters. The hero sizing formula makes it massive (fills 50% container for 5 chars = ~160px), while satellite text becomes tiny crumbs. A single short word dominating the layout looks disproportionate.

**Rule:** When a hero word is short (under ~8 characters) and surrounded by 3+ satellites, expand to 2 adjacent heroes so the hero block has enough visual weight to balance the satellites. Max 2 heroes per phrase — never 3.

**Fixes applied:**
- #22 "There have been **eight straight** years" — "eight" alone too small, added "straight"
- #34 "three hundred ninety **million dollars**" — "million" alone too small, added "dollars"
- #36 "caused **mass outrage** among citizens" — "outrage" alone too small, added "mass"
- #40 "Unlike the **JEE** in **India**" — "JEE" alone (3 chars) too small, added "India"

**Exception:** Wide tokens like "800,000" (7 chars with comma + digits = visually wide) are fine alone — numbers read bigger than letters.

**Rule for Caption Agent:** Check the **satellite-to-hero ratio**. If there are more than 4 satellite words per hero word, the phrase is unbalanced. Two fixes:

1. **Expand heroes** — add an adjacent word as hero (compound: "eight straight", "mass outrage", "million dollars"). Max 2 heroes per phrase.
2. **Split the phrase** — if even with 2 heroes the ratio is still >4:1 (i.e. 9+ word phrase), split into setup (satellite) + payoff (hero). This is the same pattern as Issues 5 and 10.

The character-count check (Issue 11's MIN_HERO_FONT) is a renderer safety net, but the real fix is at the content level: the Caption Agent should never create a phrase where heroes are visually dwarfed.

**Example — Issue 13b:** "and has been cited as a human rights violation" (9 words, 1 hero) → split into:
- "and has been cited as" (satellite setup)
- "a **human rights** violation" (hero payoff, 4 words, 2:2 ratio)

---

## Issue 14: Renderer — satellite text too small overall

**Problem:** Even with MIN_HERO_FONT, when the hero text is long (e.g. "facial recognition" = 18 chars), hero gets forced to minimum and satellite shrinks proportionally to near-unreadable sizes. The old `SAT_SIZE_RATIO = 0.35` meant satellite was only 35% of hero — at MIN_HERO_FONT=72 that was 25px.

**Fix (KineticLuxeCaption.tsx):**
- `SAT_SIZE_RATIO`: 0.35 → **0.45** — satellites are now 45% of hero, not 35%
- Satellite floor: 25px → **32px** — never go below 32px regardless of ratio
- `MIN_HERO_FONT`: 72 → **90** — hero never shrinks below 90px
- Overflow safety: if text physically can't fit at MIN_HERO_FONT, fall back to clamped size instead of overflowing

**Before/after for "facial recognition" (18 chars):**
- Before: heroFs=52→72(min), satFs=25 — entire cluster looks tiny
- After: heroFs=52→90(min), satFs=41 — readable, proportional

---

## Issue 15: Renderer — cluster not centered as a unit

**Problem:** Each block (hero/satellite) was positioned independently — heroes centered on container center, satellites poke-aligned relative to hero. But the entire cluster as a whole wasn't centered. The visual center of the caption group drifted depending on satellite alignment, and hero phrases sat at the bottom while all-satellite phrases sat at a different vertical position.

**Fix (KineticLuxeCaption.tsx — Phase 6):** After all block positions are computed (hero sizing, poke-avoidance, vertical stacking), compute the bounding box of the entire cluster:
1. Find minX, maxX, minY, maxY across all blocks
2. Compute cluster center = (midX, midY)
3. Shift all blocks so cluster center aligns with (containerCenter, captionZoneCenter)

Both hero phrases and all-satellite phrases now anchor to the same vertical center point (`canvasH * (1 - offsetY/100) - canvasH * 0.06`), so transitions between phrase types don't jump positions.

---

## Issue 16: Missing punctuation at key moments

**Problem:** Issue 7 established the punctuation rule but only "Why?" and "cheating?" were fixed. The rest of the timeline was raw unpunctuated speech.

**Punctuation applied:**
```
 5. more **extreme** measures.          ← definitive statement closing intro
11. Algeria **shuts** **down** its Internet!  ← the big reveal
15. of the **entire** **country!**      ← dramatic emphasis
24. the latest lasting **four** **days!**  ← shocking stat
31. are **severe.**                      ← definitive closing
34. three hundred ninety **million** **dollars!**  ← shocking number
35. in losses.                           ← section closer
38. a **human** **rights** violation.    ← grave statement
```

**Pattern for Caption Agent:**
- `!` → shocking reveals, dramatic stats, exclamations (shuts down Internet!, entire country!, four days!, million dollars!)
- `.` → definitive closers, grave statements (extreme measures., are severe., in losses., violation.)
- `?` → rhetorical questions (cheating?, Why?)
- The agent should read the full transcript and infer delivery tone from context — questions get `?`, shock gets `!`, gravity gets `.`

---

## Issue 17: Renderer — SAT_SIZE_RATIO too low, satellites unreadable

**Problem:** With `SAT_SIZE_RATIO = 0.35`, satellite text was only 35% of hero font size. When MIN_HERO_FONT kicked in (e.g. "facial recognition" forcing hero to minimum), satellite shrank to 25px — barely readable.

**Fix (KineticLuxeCaption.tsx):**
- `SAT_SIZE_RATIO`: 0.35 → **0.45**
- Satellite floor: 25px → **32px**

---

## Issue 18: Renderer — MIN_HERO_FONT too low

**Problem:** MIN_HERO_FONT=72 was still too small for long hero text on a 1080×1920 canvas. "facial recognition" at 72px looked tiny compared to short heroes like "remember" at ~117px. The entire cluster felt small.

**Fix:** `MIN_HERO_FONT`: 72 → **90**

Added overflow safety: if text physically can't fit the container at MIN_HERO_FONT, fall back to clamped size instead of overflowing.

---

## Issue 19: Renderer — bounding box approach for cluster centering

**Problem:** Each block (hero/satellite) was positioned independently with absolute canvas coordinates. No single DOM element wrapped the cluster, so:
1. The cluster couldn't be centered as a unit
2. The frontend had no element to grab for dragging/moving captions
3. Transitions between hero and all-satellite phrases jumped vertically

**First attempt (failed):** Computed bounding box from approximate text widths (`approxWidth`), normalized block positions to relative coords within that box. Problem: `approxWidth` overestimated text width, creating dead space on the right side of the bounding box. Text appeared left-biased within the blue selection rectangle.

**Correct approach:**
- Bounding box width = `containerW` (fixed, always same size — no approximate measurement dependency)
- Bounding box height = actual cluster height (computed from block positions)
- Block x-coordinates stay as-is (hero centered at containerW/2, satellites poke-aligned) — they're already relative to containerW
- Only y-coordinates normalized (subtract minY so blocks start from y=0)
- Bounding box positioned: `left = (canvasW - containerW) / 2`, `top = captionZoneCenter - clusterH / 2`

**Result:** The `data-caption-overlay` div is now the true bounding box:
- Wraps all blocks as a single unit
- Centered horizontally on canvas, vertically in caption zone
- Frontend can grab it for dragging
- No approximate-width drift

---

## Still TODO
- [ ] Verify all-satellite rendering looks correct after sandbox rebuild
- [ ] Update Caption Agent system prompt with all refined rules (Issues 1, 4, 5, 6)
- [ ] Test on a fresh project end-to-end
- [ ] Consider: should breath-phrase detection be in the renderer (automatic) or the Caption Agent (explicit)?
