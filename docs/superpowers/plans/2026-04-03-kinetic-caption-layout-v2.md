# Kinetic Caption Layout V2 — Proper Line-Based Packing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the kinetic caption layout so satellite words sit on clean straight baselines with proper word spacing, packed tightly against the hero using ink bounds — matching professional caption tools (CapCut, Submagic, Hormozi-style).

**Architecture:** Replace the current per-word-block scatter approach with a line-flow model. Satellite words are measured individually but GROUPED INTO LINES for positioning (like CSS flexbox wrap). Each line is a horizontal row of words with natural word spacing, centered on the hero. Vertical gaps between lines use ink bounds (actualBoundingBox) for tight packing. No SA perturbation, no random nudging — clean, deterministic placement.

**Tech Stack:** Canvas 2D TextMetrics API, kiwi.js (Cassowary), vanilla JS. Single HTML file: `scripts/temp/kinetic-captions-test.html`

---

## What's Wrong Now

1. **Each satellite word is a separate positioned block** — they float independently, the SA and nudge passes scatter them instead of keeping them on clean lines
2. **No proper word spacing** — `WORD_GAP_PX = 6` is arbitrary pixels, not typographic spacing. Words within a line should read as a phrase with natural inter-word spacing
3. **Vertical gaps too large** — the nudge tries to close gaps but the SA then moves things apart again. The collision pipeline also pushes blocks around
4. **The layout doesn't match the reference** — the screenshot shows clean straight lines: "Yeh Video" / "Ignore" / "mat krna", each on a perfectly horizontal baseline

## What It Should Look Like

```
         How on                ← satellite line: clean baseline, words spaced as a phrase
          earth                ← hero: large, italic, centered
    do you achieve this        ← satellite line: wraps to fit, centered under hero
```

For the reference screenshot ("Yeh Video Ignore mat krna"):
```
       Yeh Video              ← clean horizontal line, natural word spacing
        Ignore                ← hero, centered
        mat krna              ← clean horizontal line, slight right offset for style
```

## Key Design Rules (from research)

1. **Straight horizontal baselines always** — words are NEVER scattered/staggered
2. **Size + color = hierarchy** — not spatial displacement. Hero is bigger/colored, satellites are normal
3. **Word spacing = natural** — use the font's built-in space width, not arbitrary pixel gap
4. **Line height = tight** — 1.0-1.2 for caption text (ink-to-ink + small gap)
5. **Lines centered** — horizontal center aligned, consistent throughout
6. **Max 4-6 words per 2-line block** — wrap at width constraint, not at random
7. **Restraint** — no random perturbation (SA), no particle-physics nudging. Clean placement

## File Structure

**Modified:**
- `scripts/temp/kinetic-captions-test.html` — rewrite Phase 2 (buildBlocks) and Phase 3 (layout). Remove SA. Simplify Phase 4.

## Architecture Change

```
CURRENT (broken):
  buildBlocks() → per-word satellite blocks
  layoutTightPack() → row flow + nudge
  SA polish → scatters words
  collision pipeline → pushes things around

NEW (correct):
  buildBlocks() → per-word measurement only
  buildLines() → group words into LINES with natural spacing
  layoutLines() → position lines centered, ink-gap vertical spacing
  cassowaryRefine() → enforce safe zone only (preserve positions)
  (no SA, no nudge, no collision — lines don't overlap by construction)
```

---

### Task 1: Rewrite buildBlocks to produce line-grouped output

**Files:**
- Modify: `scripts/temp/kinetic-captions-test.html` — the `buildBlocks()` function (lines ~247-296) and add new `buildLines()` function

- [ ] **Step 1: Replace buildBlocks with measurement-only + line grouping**

The new approach: measure each word individually, then group satellite words into "visual lines" where each line is a single block with multiple words rendered with proper spacing.

Replace everything from `function buildBlocks(` through the end of the function, AND the `INK_GAP` / `WORD_GAP_PX` constants and the entire `layoutTightPack` function, with:

```javascript
// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: BUILD LINE-GROUPED BLOCKS
//
// 1. Measure each word individually
// 2. Group consecutive satellite words into LINES based on max width
// 3. Each line = one block, rendered as a phrase with natural word spacing
// 4. Hero blocks stay as single blocks (unchanged)
// ═══════════════════════════════════════════════════════════════════════════

function measureNaturalWordGap(fontSize, fontFamily, fontWeight, fontStyle) {
  // Measure the width of a space character in this font — the natural word gap
  ctx.save();
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  const spaceWidth = ctx.measureText(' ').width;
  ctx.restore();
  return spaceWidth;
}

function buildLines(wordList, heroIdxArray) {
  const T = TEMPLATE;
  const heroSet = new Set(heroIdxArray);
  const heroRuns = findConsecutiveRuns(heroIdxArray);

  // Hero font size
  let longestHeroText = '';
  for (const run of heroRuns) {
    const text = run.map(i => wordList[i]).join(' ');
    if (text.length > longestHeroText.length) longestHeroText = text;
  }
  const heroFs = computeHeroSize(longestHeroText);
  const satFs = Math.round(heroFs * 0.38);
  const satWordGap = measureNaturalWordGap(satFs, T.satelliteFont, T.satelliteWeight, T.satelliteStyle);

  // Measure every word
  const wordMeasures = wordList.map((word, i) => {
    const isHero = heroSet.has(i);
    const fs = isHero ? heroFs : satFs;
    const font = isHero ? T.heroFont : T.satelliteFont;
    const weight = isHero ? T.heroWeight : T.satelliteWeight;
    const style = isHero ? T.heroStyle : T.satelliteStyle;
    return { word, index: i, isHero, measure: measureWord(word, fs, font, weight, style) };
  });

  // Build blocks: heroes as individual blocks, satellites grouped into lines
  const safeW = W * (1 - 2 * T.safeMargin);
  // Max line width: use hero width as reference, allow up to 130% for longer lines
  const heroBlock0 = heroRuns[0];
  const heroText0 = heroBlock0.map(i => wordList[i]).join(' ');
  const heroMeasure0 = measureWord(heroText0, heroFs, T.heroFont, T.heroWeight, T.heroStyle);
  const maxLineWidth = Math.min(heroMeasure0.width * 1.3, safeW);

  const blocks = [];
  let i = 0;

  while (i < wordList.length) {
    if (heroSet.has(i)) {
      // Hero block
      const run = heroRuns.find(r => r.includes(i));
      const text = run.map(idx => wordList[idx]).join(' ');
      const m = measureWord(text, heroFs, T.heroFont, T.heroWeight, T.heroStyle);
      blocks.push({
        type: 'hero',
        heroOrder: heroRuns.indexOf(run),
        wordIndices: [...run],
        text, measure: m, fontSize: heroFs,
        font: T.heroFont, weight: T.heroWeight,
        style: T.heroStyle, color: T.heroColor,
        x: 0, y: 0,
      });
      i = run[run.length - 1] + 1;
    } else {
      // Collect consecutive non-hero words, group into lines
      const satWords = [];
      while (i < wordList.length && !heroSet.has(i)) {
        satWords.push({ word: wordList[i], index: i, measure: wordMeasures[i].measure });
        i++;
      }

      // Flow satellite words into lines (like CSS flexbox wrap)
      let lineWords = [];
      let lineWidth = 0;

      for (const sw of satWords) {
        const addedWidth = sw.measure.width + (lineWords.length > 0 ? satWordGap : 0);
        if (lineWidth + addedWidth > maxLineWidth && lineWords.length > 0) {
          // Flush current line as a block
          const lineText = lineWords.map(lw => lw.word).join(' ');
          const lineM = measureWord(lineText, satFs, T.satelliteFont, T.satelliteWeight, T.satelliteStyle);
          blocks.push({
            type: 'satellite',
            wordIndices: lineWords.map(lw => lw.index),
            text: lineText, measure: lineM, fontSize: satFs,
            font: T.satelliteFont, weight: T.satelliteWeight,
            style: T.satelliteStyle, color: T.satelliteColor,
            x: 0, y: 0,
          });
          lineWords = [];
          lineWidth = 0;
        }
        lineWidth += addedWidth;
        lineWords.push(sw);
      }

      // Flush remaining words
      if (lineWords.length > 0) {
        const lineText = lineWords.map(lw => lw.word).join(' ');
        const lineM = measureWord(lineText, satFs, T.satelliteFont, T.satelliteWeight, T.satelliteStyle);
        blocks.push({
          type: 'satellite',
          wordIndices: lineWords.map(lw => lw.index),
          text: lineText, measure: lineM, fontSize: satFs,
          font: T.satelliteFont, weight: T.satelliteWeight,
          style: T.satelliteStyle, color: T.satelliteColor,
          x: 0, y: 0,
        });
      }
    }
  }

  return blocks;
}
```

- [ ] **Step 2: Verify in browser console — open the HTML, type in console:**

```javascript
// Should see line-grouped blocks, not per-word blocks
words = ['How', 'on', 'earth', 'do', 'you', 'achieve', 'this'];
heroIndices = [2];
measureCache.clear();
const blocks = buildLines(words, heroIndices);
console.log(blocks.map(b => `[${b.type}] "${b.text}" w=${b.measure.width.toFixed(0)}`));
// Expected: [satellite] "How on", [hero] "earth", [satellite] "do you achieve this" (or wrapped)
```

- [ ] **Step 3: Commit**

```bash
git add scripts/temp/kinetic-captions-test.html
git commit -m "refactor: replace per-word blocks with line-grouped satellite blocks"
```

---

### Task 2: Write the line-based layout function

**Files:**
- Modify: `scripts/temp/kinetic-captions-test.html` — replace `layoutTightPack()` and `nudgeTowardHero()` with new `layoutLines()`

- [ ] **Step 1: Write the new layoutLines function**

This replaces `layoutTightPack()`, `nudgeTowardHero()`, and `inkOverlap()`. The layout is purely deterministic — no nudging, no random perturbation.

```javascript
// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3: LINE-BASED LAYOUT
//
// Clean, deterministic placement:
//   1. Place hero(es) at vertical center, horizontally centered
//   2. Place pre-hero satellite lines above hero, bottom-up
//   3. Place post-hero satellite lines below hero, top-down
//   4. All lines centered horizontally
//   5. Vertical gaps: ink-to-ink with small breathing room (4-6px)
//
// No nudging. No SA. No scatter. Straight baselines.
// ═══════════════════════════════════════════════════════════════════════════

const LINE_INK_GAP = 5; // px between ink edges of adjacent lines (tight but readable)

function layoutLines(blocks) {
  const T = TEMPLATE;
  const centerX = W / 2;
  const centerY = H * T.verticalAnchor;

  const heroes = blocks.filter(b => b.type === 'hero');
  const satellites = blocks.filter(b => b.type === 'satellite');

  // Separate pre-hero and post-hero satellite lines
  const firstHeroIdx = Math.min(...heroes.flatMap(h => h.wordIndices));
  const lastHeroIdx = Math.max(...heroes.flatMap(h => h.wordIndices));
  const preLines = satellites.filter(s => Math.max(...s.wordIndices) < firstHeroIdx);
  const postLines = satellites.filter(s => Math.min(...s.wordIndices) > lastHeroIdx);
  const betweenLines = satellites.filter(s => {
    const minI = Math.min(...s.wordIndices);
    const maxI = Math.max(...s.wordIndices);
    return minI > firstHeroIdx && maxI < lastHeroIdx;
  });

  // ── Compute total composition height (ink-based) ──
  const allRows = [...preLines, ...heroes, ...betweenLines, ...postLines];
  let totalInkH = 0;
  for (const row of allRows) totalInkH += row.measure.inkHeight;
  totalInkH += (allRows.length - 1) * LINE_INK_GAP;

  // ── Position all rows from top to bottom ──
  // Start so the composition is vertically centered
  let curY = centerY - totalInkH / 2;

  // Order: pre-lines → heroes → between-lines → post-lines (reading order)
  const orderedRows = [...preLines, ...heroes, ...betweenLines, ...postLines];

  for (const row of orderedRows) {
    curY += row.measure.inkAscent; // baseline = top of ink + inkAscent
    row.x = centerX - row.measure.width / 2; // horizontally centered
    row.y = curY;
    curY += row.measure.inkDescent + LINE_INK_GAP;
  }

  return blocks;
}
```

- [ ] **Step 2: Update the orchestrator (buildLayout function) to use the new functions**

Replace the call to `buildBlocks()` with `buildLines()`, replace the call to `layoutTightPack()` with `layoutLines()`. Remove the call to `simulatedAnnealing()`. Remove the final `nudgeTowardHero()` call. The orchestrator should now be:

```javascript
function buildLayout() {
  measureCache.clear();
  debugLines = [];
  const timings = {};
  const t0 = performance.now();

  // Phase 1+2: Measure words + group into lines
  const blocks = buildLines(words, heroIndices);
  timings.build = performance.now() - t0;

  const heroTexts = blocks.filter(b => b.type === 'hero').map(b => `"${b.text}"`);
  const satLines = blocks.filter(b => b.type === 'satellite');
  debugLines.push(`KINETIC CAPTION ENGINE — Line-Based Layout V2`);
  debugLines.push(`${'═'.repeat(55)}`);
  debugLines.push(`Words: [${words.join(', ')}]`);
  debugLines.push(`Heroes: [${heroIndices}] → ${heroTexts.join(', ')}`);
  debugLines.push(`Lines: ${blocks.length} total (${heroTexts.length} hero, ${satLines.length} satellite lines)`);
  debugLines.push(``);

  // Phase 3: Line-based layout
  const t1 = performance.now();
  layoutLines(blocks);
  timings.layout = performance.now() - t1;
  debugLines.push(`Phase 3: Line layout (ink-gap: ${LINE_INK_GAP}px)`);

  // Phase 4: Cassowary — enforce safe zone only
  const t2 = performance.now();
  try {
    cassowaryRefine(blocks);
    debugLines.push(`Phase 4: Cassowary safe-zone enforcement — OK`);
  } catch (e) {
    debugLines.push(`Phase 4: Cassowary FAILED: ${e.message} (skipped)`);
  }
  timings.cassowary = performance.now() - t2;

  // Phase 4B: Alignment snapping
  const snaps = alignmentSnapping(blocks);
  debugLines.push(`Phase 4B: Alignment snapping — ${snaps} snaps`);

  const totalTime = performance.now() - t0;

  debugLines.push(``);
  debugLines.push(`TIMINGS:`);
  debugLines.push(`  Build + measure:  ${timings.build.toFixed(2)}ms`);
  debugLines.push(`  Layout:           ${timings.layout.toFixed(2)}ms`);
  debugLines.push(`  Cassowary:        ${timings.cassowary.toFixed(2)}ms`);
  debugLines.push(`  TOTAL:            ${totalTime.toFixed(2)}ms`);
  debugLines.push(``);

  // Block details
  debugLines.push(`LINES:`);
  for (const b of blocks) {
    const tag = b.type === 'hero' ? `HERO` : `LINE`;
    debugLines.push(`  [${tag.padEnd(5)}] "${b.text}"  ${b.fontSize}px  pos(${b.x.toFixed(1)}, ${b.y.toFixed(1)})  w=${b.measure.width.toFixed(0)}  ink: ${b.measure.inkAscent.toFixed(0)}↑${b.measure.inkDescent.toFixed(0)}↓  dead: ${b.measure.deadAbove.toFixed(0)}↑${b.measure.deadBelow.toFixed(0)}↓`);
  }

  // Vertical gaps
  debugLines.push(``);
  debugLines.push(`INK-TO-INK GAPS:`);
  for (let i = 0; i < blocks.length - 1; i++) {
    const above = blocks[i], below = blocks[i + 1];
    const gap = (below.y - below.measure.inkAscent) - (above.y + above.measure.inkDescent);
    debugLines.push(`  "${above.text}" → "${below.text}":  ${gap.toFixed(1)}px  (target: ${LINE_INK_GAP}px)`);
  }

  // Character gap analysis for heroes
  debugLines.push(``);
  debugLines.push(`HERO CHARACTER GAPS:`);
  for (const b of blocks.filter(bl => bl.type === 'hero')) {
    const ga = analyzeCharGaps(b);
    const totalWS = ga.gaps.reduce((s, g) => s + g.width, 0);
    debugLines.push(`  "${b.text}": ${ga.gaps.length} gaps, ${totalWS.toFixed(0)}px whitespace / ${b.measure.width.toFixed(0)}px (${(totalWS / b.measure.width * 100).toFixed(0)}%)`);
  }

  layoutBlocks = blocks;
  document.getElementById('debugPanel').textContent = debugLines.join('\n');
}
```

- [ ] **Step 3: Remove dead code**

Delete these functions entirely as they are no longer used:
- `nudgeTowardHero()`
- `inkOverlap()` (the one used by nudge — keep `aabbOverlap` and `aabbOverlapArea` if still used by collision pipeline)
- `simulatedAnnealing()`
- `computeEnergy()`
- `collisionPipeline()` (lines don't overlap by construction)
- `layoutTightPack()`
- The `INK_GAP` and `WORD_GAP_PX` constants

Keep:
- `alignmentSnapping()` — still useful for edge cleanup
- `cassowaryRefine()` — enforces safe zone boundaries
- `analyzeCharGaps()` — used by debug overlay

- [ ] **Step 4: Verify in browser — open the HTML, it should show:**

```
      How on
       earth
  do you achieve this
```

All lines on straight horizontal baselines, centered, with tight ink-to-ink vertical gaps. No scattered words.

- [ ] **Step 5: Commit**

```bash
git add scripts/temp/kinetic-captions-test.html
git commit -m "feat: line-based layout with ink-gap vertical packing"
```

---

### Task 3: Fix the animation for line-grouped blocks

**Files:**
- Modify: `scripts/temp/kinetic-captions-test.html` — update `getBlockAnim()` and `startAnimation()`

- [ ] **Step 1: Update animation to work with line blocks**

Since satellites are now LINE blocks (not individual word blocks), the animation stagger should be per-line, not per-word. Update the satellite animation logic:

```javascript
function startAnimation() {
  const heroCount = layoutBlocks.filter(b => b.type === 'hero').length;
  animState = {
    startTime: performance.now(),
    heroDur: 350,
    heroStagger: 120,
    lineDur: 200,        // ms per satellite line (not per word)
    lineStagger: 80,     // ms between satellite line entrances
    lineDelay: 350 + (heroCount - 1) * 120 + 150, // start after heroes finish
  };
}

function getBlockAnim(block, elapsed) {
  if (!animState) return { scale: 1, opacity: 1, offsetX: 0, offsetY: 0 };
  const s = animState;

  if (block.type === 'hero') {
    const heroStart = (block.heroOrder ?? 0) * s.heroStagger;
    const t = Math.max(0, elapsed - heroStart);
    if (t >= s.heroDur * 1.5) return { scale: 1, opacity: 1, offsetX: 0, offsetY: 0 };
    const scale = criticallyDampedSpring(t / 1000, s.heroDur / 1000);
    const opacity = Math.min(1, (t / s.heroDur) * 4);
    return { scale, opacity, offsetX: 0, offsetY: 0 };
  }

  // Satellite lines: stagger by line order (sorted by first word index)
  const allSatLines = layoutBlocks.filter(b => b.type === 'satellite')
    .sort((a, b) => Math.min(...a.wordIndices) - Math.min(...b.wordIndices));
  const lineIdx = allSatLines.indexOf(block);
  const lineStart = s.lineDelay + lineIdx * s.lineStagger;
  const t = elapsed - lineStart;

  if (t <= 0) return { scale: 1, opacity: 0, offsetX: 0, offsetY: -12 };
  if (t >= s.lineDur) return { scale: 1, opacity: 1, offsetX: 0, offsetY: 0 };
  const p = easeOutCubic(t / s.lineDur);
  return { scale: 1, opacity: p, offsetX: 0, offsetY: -12 * (1 - p) };
}
```

- [ ] **Step 2: Verify — click Play, animation should show:**
1. Hero scales in with spring bounce
2. Each satellite LINE fades in with slight upward slide, staggered by reading order
3. No individual word animation — each line animates as a unit

- [ ] **Step 3: Commit**

```bash
git add scripts/temp/kinetic-captions-test.html
git commit -m "fix: animation stagger per-line instead of per-word"
```

---

### Task 4: Simplify debug overlay for line-based layout

**Files:**
- Modify: `scripts/temp/kinetic-captions-test.html` — update `renderDebugOverlay()`

- [ ] **Step 1: Update debug overlay**

The debug overlay should show:
- Ink bounding box per line (solid colored rectangle)
- Dead space above/below (magenta fill)
- Ink-to-ink gap measurements between lines (with pixel labels)
- Hero character gaps (yellow/cyan stripes)
- Center crosshair
- No per-character ink rectangles for satellites (they're lines now, not individual words)

The existing `renderDebugOverlay` already does most of this correctly since it iterates over blocks. The main change is that the ink gap measurements between lines now show the actual gap between adjacent lines in reading order (not randomly scattered blocks).

Replace the ink gap measurement section with:

```javascript
  // Ink gap measurements between sequential lines
  for (let i = 0; i < blocks.length - 1; i++) {
    const above = blocks[i], below = blocks[i + 1];
    const inkBottom = above.y + above.measure.inkDescent;
    const inkTop = below.y - below.measure.inkAscent;
    const gap = inkTop - inkBottom;

    const mx = Math.max(above.x + above.measure.width, below.x + below.measure.width) + 8;
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = gap < 2 ? '#f44' : '#0f0';
    ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(mx, inkBottom); ctx.lineTo(mx, inkTop); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 3, inkBottom); ctx.lineTo(mx + 3, inkBottom);
    ctx.moveTo(mx - 3, inkTop); ctx.lineTo(mx + 3, inkTop);
    ctx.stroke();
    ctx.font = '9px monospace'; ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
    ctx.fillText(`${gap.toFixed(0)}px`, mx + 6, (inkBottom + inkTop) / 2);
  }
```

- [ ] **Step 2: Verify — toggle Debug, should show clean ink boxes around each line, gap measurements between them**

- [ ] **Step 3: Commit**

```bash
git add scripts/temp/kinetic-captions-test.html
git commit -m "fix: debug overlay for line-based layout"
```

---

### Task 5: Test with multiple inputs and edge cases

**Files:**
- Modify: `scripts/temp/kinetic-captions-test.html` — no code changes, just manual testing

- [ ] **Step 1: Test the reference caption from the screenshot**

Set input to `Yeh Video Ignore mat krna`, hero index `2`. Verify:
- "Yeh Video" on one clean line above "Ignore"
- "Ignore" large, italic, red, centered
- "mat krna" on one clean line below "Ignore"
- All lines horizontally centered, tight vertical gaps

- [ ] **Step 2: Test the example caption**

Set input to `How on earth do you achieve this`, hero index `2`. Verify:
- "How on" above hero
- "earth" hero
- "do you achieve this" below hero (wraps to 2 lines if too wide for max line width)
- Natural word spacing within each line

- [ ] **Step 3: Test multiple heroes**

Set input to `This is absolutely incredible work`, hero indices `2,3`. Verify:
- "This is" above
- "absolutely incredible" as grouped hero block
- "work" below
- Tight packing between all lines

- [ ] **Step 4: Test long input**

Set input to `I cannot believe what just happened to me yesterday at the store`, hero index `3`. Verify:
- Pre-hero words wrap into multiple lines above
- "happened" as hero
- Post-hero words wrap into multiple lines below
- No overflow past safe zone

- [ ] **Step 5: Test single word hero with no satellites**

Set input to `Hello`, hero index `0`. Verify:
- Just "Hello" centered, no crash, no empty satellite lines

- [ ] **Step 6: Commit (if any fixes were needed)**

```bash
git add scripts/temp/kinetic-captions-test.html
git commit -m "test: verify line-based layout with multiple inputs"
```

---

### Task 6: Final cleanup — remove the Cassowary/SA toggle button and dead references

**Files:**
- Modify: `scripts/temp/kinetic-captions-test.html` — HTML controls section + JS

- [ ] **Step 1: Remove the toggle button from HTML**

The "Toggle: Cassowary / SA" button is no longer relevant since SA is removed. Remove the button from the controls div. Keep Play, Debug, and Color buttons.

- [ ] **Step 2: Remove `toggleAlgo()` function and `useCassowary` variable**

Delete the `toggleAlgo` function and the `let useCassowary = true;` variable declaration.

- [ ] **Step 3: Update the page title/h1**

Change the h1 from "Ink-Aware Tight Pack" to something like "Line-Based Ink Layout" to reflect the new approach.

- [ ] **Step 4: Final browser check — everything works, no console errors**

- [ ] **Step 5: Commit**

```bash
git add scripts/temp/kinetic-captions-test.html
git commit -m "cleanup: remove SA/toggle dead code, update title"
```
