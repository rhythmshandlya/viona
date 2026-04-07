import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';

/**
 * KineticLuxeCaption — Algorithm-driven caption layout.
 *
 * Uses the kinetic-captions algorithm: hero sizing → satellite wrapping →
 * vertical stacking with ink-gap → edge alignment. All positions computed
 * as absolute coordinates, no CSS flex spacing.
 */

// ── Word Classification ─────────────────────────────────────────────────────

const POWER_WORDS = new Set([
  'love','hate','fear','die','dead','death','kill','destroy','dream',
  'obsessed','insane','crazy','incredible','amazing','unbelievable',
  'shocking','terrifying','brilliant','genius','perfect','worst',
  'best','greatest','legendary','epic','massive','huge','evil',
  'now','stop','wait','listen','watch','look','never','always',
  'forever','immediately','urgent','warning','danger','critical',
  'important','breaking','exclusive','secret','finally','today',
  'million','billion','thousand','money','rich','free','paid',
  'but','however','actually','wrong','right','truth','lie','real',
  'fake','only','everything','nothing','impossible','possible',
  'everyone','nobody','first','last','biggest','smallest',
  'win','won','lose','lost','fight','broke','crushed','dominated',
  'exploded','changed','saved','failed','success','discovered',
]);
const FILLER_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being',
  'to','of','in','for','on','at','by','with','from','as',
  'and','or','if','it','its','that','this','than','then',
  'so','up','do','did','has','had','have','will','would',
  'could','should','can','may','might','shall','just','very',
  'also','about','into','not','no','yes','some','my','your',
  'we','they','he','she','i','me','us','them','our','their',
]);
const STRONG_WORDS = new Set([
  'really','literally','seriously','basically','honestly',
  'completely','extremely','definitely','absolutely','truly',
  'believe','remember','imagine','understand','realize',
  'create','become','happen','achieve','overcome',
  'different','specific','better','worse','special',
  'people','problem','reason','question','answer','story','world',
]);

type WordTier = 'power' | 'strong' | 'medium' | 'filler';
function classifyWord(text: string): WordTier {
  const clean = text.replace(/[^a-zA-Z0-9%]/g, '').toLowerCase();
  if (/^\$?\d/.test(clean) || /\d{4,}/.test(clean) || clean.endsWith('%')) return 'power';
  if (POWER_WORDS.has(clean)) return 'power';
  if (FILLER_WORDS.has(clean)) return 'filler';
  if (STRONG_WORDS.has(clean)) return 'strong';
  return 'medium';
}
// Static fallback for old projects without hero annotations
function isHeroFallback(text: string): boolean {
  const tier = classifyWord(text);
  return tier === 'power' || tier === 'strong';
}

// ── Approximate text measurement ────────────────────────────────────────────
// charWidthFactor: average character width as fraction of fontSize
// Per-font-pair values — different fonts have different average widths
const FONT_PAIR_CWF: Record<string, { serif: number; sans: number }> = {
  classic:   { serif: 0.43, sans: 0.48 },  // Playfair Display + Inter
  cinematic: { serif: 0.40, sans: 0.46 },  // Cormorant Garamond + Space Grotesk
  poster:    { serif: 0.42, sans: 0.35 },  // DM Serif Display + Bebas Neue (condensed)
};
const DEFAULT_CWF = { serif: 0.43, sans: 0.48 };

const SAT_LETTER_SPACING = 1.5; // px — matches the render style
function approxWidth(text: string, fontSize: number, isSerif: boolean, cwf: { serif: number; sans: number }): number {
  const charW = text.length * fontSize * (isSerif ? cwf.serif : cwf.sans);
  const spacing = isSerif ? 0 : text.length * SAT_LETTER_SPACING;
  return charW + spacing;
}

// ── Algorithm constants ─────────────────────────────────────────────────────
const HERO_SIZE_RATIO = 0.50;     // hero fills this fraction of container width
const SAT_SIZE_RATIO = 0.45;      // satellite font = hero × this
const MAX_HERO_FONT = 160;
const OVERFLOW_CLAMP = 0.90;
const SAT_MAX_LINE_RATIO = 0.90;  // satellite lines wrap at 90% of hero width
const INK_GAP = 2;                // px between ink edges — tight
const X_HEIGHT_RATIO = 0.50;      // x-height (top of short letters) ≈ fontSize × this
const ASCENDER_RATIO = 0.85;      // full ascent ≈ fontSize × this
const DESCENDER_RATIO = 0.15;     // descender depth ≈ fontSize × this
const SAT_HEIGHT_RATIO = 0.72;    // satellite visual height (uppercase caps)
// Ascender letters — poke UP above x-height (affects satellite ABOVE hero)
const ASCENDER_CHARS = new Set(['b', 'd', 'f', 'h', 'k', 'l', 't']);
// Descender letters — poke DOWN below baseline (affects satellite BELOW hero)
const DESCENDER_CHARS = new Set(['g', 'y', 'p', 'q', 'j']);

// ── Layout block ────────────────────────────────────────────────────────────
interface Block {
  type: 'hero' | 'satellite';
  text: string;
  fontSize: number;
  isSerif: boolean;
  width: number;         // approximate text width
  spaceAbove: number;    // space from top of line box to where we stack from above
  spaceBelow: number;    // space from bottom stack edge to bottom of line box
  totalHeight: number;   // full height of line box for rendering
  x: number;
  y: number;             // top of the line box (for absolute positioning)
  lineStartMs: number;
}

// ── Props ────────────────────────────────────────────────────────────────────
interface KineticLuxeCaptionProps {
  words: Array<{ text: string; startMs: number; endMs: number; hero?: boolean }>;
  itemStartMs: number;
  heroFontFamily?: string;
  heroColor?: string;
  satFontFamily?: string;
  satColor?: string;
  fontPairId?: string;
  offsetY?: number;
  /** @deprecated Use flat props instead */
  config?: { hero?: { fontFamily?: string; color?: string }; satellite?: { fontFamily?: string; color?: string }; position?: { offsetY?: number } };
}

export const KineticLuxeCaption: React.FC<KineticLuxeCaptionProps> = React.memo((props) => {
  const { words, itemStartMs, config } = props;
  const frame = useCurrentFrame();
  const { fps, width: canvasW, height: canvasH } = useVideoConfig();

  // Read from flat props first, fall back to config object, then defaults
  const heroFontFamily = props.heroFontFamily || config?.hero?.fontFamily || "'Playfair Display', serif";
  const heroColor = props.heroColor || config?.hero?.color || '#e63946';
  const satFontFamily = props.satFontFamily || config?.satellite?.fontFamily || "'Inter', sans-serif";
  const satColor = props.satColor || config?.satellite?.color || '#ffffff';
  const offsetY = props.offsetY ?? config?.position?.offsetY ?? 8;
  const containerW = canvasW * 0.90;

  const currentTimeMs = itemStartMs + (frame / fps) * 1000;

  const cwf = FONT_PAIR_CWF[props.fontPairId || 'classic'] || DEFAULT_CWF;

  // ══════════════════════════════════════════════════════════════════════════
  // LAYOUT COMPUTATION (memoized — only recomputes when words change)
  // ══════════════════════════════════════════════════════════════════════════
  const layout = useMemo(() => {
    // Phase 1: Classify words, find heroes
    const wordList = words.map(w => w.text);
    // Read AI annotation first (word.hero), fallback to static classification
    const hasAnnotations = words.some(w => w.hero !== undefined);
    const heroIndices: number[] = [];
    wordList.forEach((w, i) => {
      const wordHero = words[i].hero !== undefined ? words[i].hero : isHeroFallback(w);
      if (wordHero) heroIndices.push(i);
    });
    // If AI annotated all words as non-hero, respect that (no forced fallback).
    // Only pick longest word when there are NO annotations at all.
    if (heroIndices.length === 0 && !hasAnnotations) {
      let longest = 0;
      wordList.forEach((w, i) => { if (w.length > wordList[longest].length) longest = i; });
      heroIndices.push(longest);
    }
    const heroSet = new Set(heroIndices);

    // ── All-satellite shortcut ──────────────────────────────────────────────
    // When no heroes: render all words as a single centered satellite block.
    // Use a comfortable font size and full container width for wrapping.
    if (heroIndices.length === 0) {
      const allSatFs = 42; // clean readable size for flow phrases
      const maxLineW = containerW * 0.70; // conservative — accounts for uppercase + letter-spacing
      const spaceW = allSatFs * 0.25;
      const blocks: Block[] = [];
      let line: string[] = [];
      let lineW = 0;
      for (let si = 0; si < wordList.length; si++) {
        const ww = approxWidth(wordList[si], allSatFs, false, cwf);
        const needed = ww + (line.length > 0 ? spaceW : 0);
        if (lineW + needed > maxLineW && line.length > 0) {
          const text = line.join(' ');
          blocks.push({
            type: 'satellite', text, fontSize: allSatFs, isSerif: false,
            width: approxWidth(text, allSatFs, false, cwf),
            spaceAbove: 0, spaceBelow: 0,
            totalHeight: allSatFs * SAT_HEIGHT_RATIO,
            x: 0, y: 0,
            lineStartMs: words[0].startMs,
          });
          line = []; lineW = 0;
        }
        lineW += needed;
        line.push(wordList[si]);
      }
      if (line.length > 0) {
        const text = line.join(' ');
        blocks.push({
          type: 'satellite', text, fontSize: allSatFs, isSerif: false,
          width: approxWidth(text, allSatFs, false, cwf),
          spaceAbove: 0, spaceBelow: 0,
          totalHeight: allSatFs * SAT_HEIGHT_RATIO,
          x: 0, y: 0,
          lineStartMs: words[0].startMs,
        });
      }
      // Center each line horizontally, stack vertically from y=0
      const maxW = Math.max(...blocks.map(b => b.width));
      for (const b of blocks) { b.x = (maxW - b.width) / 2; }
      let curY = 0;
      for (let bi = 0; bi < blocks.length; bi++) {
        if (bi > 0) curY += INK_GAP;
        blocks[bi].y = curY;
        curY += blocks[bi].totalHeight;
      }
      const clusterW = maxW;
      const clusterH = curY;
      return { blocks, clusterW, clusterH };
    }

    // Merge consecutive heroes into runs
    const heroRuns: number[][] = [];
    const sorted = [...heroIndices].sort((a, b) => a - b);
    let run = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1) run.push(sorted[i]);
      else { heroRuns.push(run); run = [sorted[i]]; }
    }
    heroRuns.push(run);

    // Phase 2: Compute hero font size
    // Size hero to fill HERO_SIZE_RATIO of container, but never below MIN_HERO_FONT.
    // Long hero text (e.g. "facial recognition") is allowed to overflow past the
    // target width — capped at full container — rather than shrinking to tiny sizes.
    const MIN_HERO_FONT = 90;
    let longestHeroText = '';
    for (const r of heroRuns) {
      const t = r.map(i => wordList[i]).join(' ');
      if (t.length > longestHeroText.length) longestHeroText = t;
    }
    const targetW = containerW * HERO_SIZE_RATIO;
    let heroFs = Math.round(targetW / (longestHeroText.length * cwf.serif));
    heroFs = Math.min(heroFs, MAX_HERO_FONT);
    heroFs = Math.max(heroFs, MIN_HERO_FONT);
    const heroW = approxWidth(longestHeroText, heroFs, true);
    if (heroW > containerW * OVERFLOW_CLAMP) {
      // Clamp to fit, but only override MIN if text physically can't fit at MIN size
      const clampedFs = Math.round(heroFs * (containerW * OVERFLOW_CLAMP) / heroW);
      const minFits = approxWidth(longestHeroText, MIN_HERO_FONT, true, cwf) <= containerW;
      heroFs = minFits ? Math.max(clampedFs, MIN_HERO_FONT) : clampedFs;
    }
    const satFs = Math.max(Math.round(heroFs * SAT_SIZE_RATIO), 32);
    const maxSatLineW = Math.min(approxWidth(longestHeroText, heroFs, true) * SAT_MAX_LINE_RATIO, containerW);

    // Phase 3: Build blocks in transcript order
    const blocks: Block[] = [];
    let wi = 0;
    while (wi < wordList.length) {
      if (heroSet.has(wi)) {
        const r = heroRuns.find(run => run.includes(wi))!;
        const text = r.map(i => wordList[i]).join(' ');
        blocks.push({
          type: 'hero', text, fontSize: heroFs, isSerif: true,
          width: approxWidth(text, heroFs, true, cwf),
          spaceAbove: 0, // computed per-pair in stacking phase based on poke avoidance
          spaceBelow: 0,
          totalHeight: heroFs * 1.2,  // Playfair Display actual rendered height > em square
          x: 0, y: 0,
          lineStartMs: words[r[0]].startMs,
        });
        wi = r[r.length - 1] + 1;
      } else {
        // Collect satellite words until next hero
        const satWords: string[] = [];
        const firstIdx = wi;
        while (wi < wordList.length && !heroSet.has(wi)) {
          satWords.push(wordList[wi]);
          wi++;
        }
        // Wrap into lines
        let line: string[] = [];
        let lineW = 0;
        const spaceW = satFs * 0.25;
        for (let si = 0; si < satWords.length; si++) {
          const ww = approxWidth(satWords[si], satFs, false, cwf);
          const needed = ww + (line.length > 0 ? spaceW : 0);
          if (lineW + needed > maxSatLineW && line.length > 0) {
            const text = line.join(' ');
            blocks.push({
              type: 'satellite', text, fontSize: satFs, isSerif: false,
              width: approxWidth(text, satFs, false, cwf),
              // Satellite (uppercase): no ascenders/descenders, just cap height
              spaceAbove: 0,
              spaceBelow: 0,
              totalHeight: satFs * SAT_HEIGHT_RATIO,
              x: 0, y: 0,
              lineStartMs: words[firstIdx].startMs,
            });
            line = []; lineW = 0;
          }
          lineW += needed;
          line.push(satWords[si]);
        }
        if (line.length > 0) {
          const text = line.join(' ');
          blocks.push({
            type: 'satellite', text, fontSize: satFs, isSerif: false,
            width: approxWidth(text, satFs, false, cwf),
            spaceAbove: 0,
            spaceBelow: 0,
            totalHeight: satFs * SAT_HEIGHT_RATIO,
            x: 0, y: 0,
            lineStartMs: words[firstIdx].startMs,
          });
        }
      }
    }

    // Phase 4: Vertical stacking with ink-gap
    // Stack edge model:
    //   - Each block has spaceAbove (dead space at top before content)
    //     and spaceBelow (dead space at bottom after content)
    //   - For hero: spaceAbove = ascender zone above x-height (where ascenders poke)
    //     Satellite above sits AT the x-height, with ascenders poking up into the gap
    //   - For satellite (uppercase): spaceAbove = 0 (no ascenders)
    //
    // Between two blocks: gap = block[i].spaceBelow + INK_GAP + block[i+1].spaceAbove
    // This means satellite-above-hero has almost no gap (sat.spaceBelow=0 + INK_GAP + hero.spaceAbove)
    // but the hero's spaceAbove is the ascender zone — satellite overlaps into it visually.

    // Stack from bottom upward
    // Compute per-pair vertical overlap using letter-level collision detection.
    //
    // For each hero-satellite pair, scan every character position where they
    // horizontally overlap. Check if the hero letter at that position would
    // collide (ascender pokes up into satellite, or descender pokes down).
    //
    // If ALL overlapping positions are collision-free → tighten vertically.
    // If ANY position has a collision → keep normal spacing.

    function computeOverlap(
      heroBlock: Block, satBlock: Block, direction: 'above' | 'below'
    ): number {
      const heroText = heroBlock.text.toLowerCase();
      const heroCharW = heroBlock.width / heroBlock.text.length;
      const pokeSet = direction === 'above' ? ASCENDER_CHARS : DESCENDER_CHARS;

      // Map satellite horizontal range to hero character indices
      const satLeft = satBlock.x;
      const satRight = satBlock.x + satBlock.width;

      // For each hero character, check if it's under/over the satellite
      let hasCollision = false;
      let hasOverlapZone = false;

      for (let c = 0; c < heroText.length; c++) {
        const charLeft = heroBlock.x + c * heroCharW;
        const charRight = charLeft + heroCharW;

        // Does this character overlap horizontally with the satellite?
        if (charRight < satLeft || charLeft > satRight) continue;
        hasOverlapZone = true;

        // Does this character poke?
        if (pokeSet.has(heroText[c])) {
          hasCollision = true;
          break;
        }
      }

      if (!hasOverlapZone) return 0; // no horizontal overlap at all
      if (hasCollision) return 0;     // poke letter found → no tightening

      // All overlapping characters are short → safe to tighten
      return heroBlock.fontSize * (direction === 'above' ? 0.25 : 0.15);
    }

    const pairOverlaps: number[] = [0];
    for (let bi = 1; bi < blocks.length; bi++) {
      const prev = blocks[bi - 1];
      const curr = blocks[bi];
      let overlap = 0;

      if (curr.type === 'hero' && prev.type === 'satellite') {
        // Satellite above hero — check hero's ascenders under satellite
        overlap = computeOverlap(curr, prev, 'above');
      }

      if (prev.type === 'hero' && curr.type === 'satellite') {
        // Hero above satellite — check hero's descenders over satellite
        overlap = computeOverlap(prev, curr, 'below');
      }

      pairOverlaps.push(overlap);
    }

    // Compute total height
    let totalH = 0;
    for (let bi = 0; bi < blocks.length; bi++) {
      totalH += blocks[bi].totalHeight;
      if (bi > 0) totalH += INK_GAP - pairOverlaps[bi];
    }

    // Stack from bottom upward
    const bottomY = canvasH * (1 - offsetY / 100);
    let curY = bottomY - totalH;
    for (let bi = 0; bi < blocks.length; bi++) {
      if (bi > 0) curY += INK_GAP - pairOverlaps[bi];
      blocks[bi].y = curY;
      curY += blocks[bi].totalHeight;
    }

    // Phase 5: Horizontal — center heroes, offset satellites
    const centerX = containerW / 2;
    for (const b of blocks) {
      b.x = centerX - b.width / 2;
    }

    // Poke-aware satellite alignment
    const heroBlocks = blocks.filter(b => b.type === 'hero');
    if (heroBlocks.length > 0) {
      for (let i = 0; i < blocks.length; i++) {
        if (blocks[i].type !== 'satellite') continue;
        let nearestHeroIdx = 0;
        let minDist = Infinity;
        for (let h = 0; h < blocks.length; h++) {
          if (blocks[h].type !== 'hero') continue;
          if (Math.abs(h - i) < minDist) { minDist = Math.abs(h - i); nearestHeroIdx = h; }
        }
        const hero = blocks[nearestHeroIdx];
        const hL = hero.x;
        const hR = hero.x + hero.width;
        const sat = blocks[i];

        // Default: center satellite under/over hero
        // Then nudge based on whether it's before or after hero in transcript
        if (i < nearestHeroIdx) {
          // Satellite before hero — left-align to hero
          sat.x = hL;
        } else {
          // Satellite after hero — right-align to hero
          sat.x = hR - sat.width;
        }
        // Clamp within hero bounds
        sat.x = Math.max(hL, Math.min(sat.x, hR - sat.width));
      }
    }

    // Phase 6: Normalize to relative coords.
    // Horizontal: compute cluster midpoint and re-center so the visual center
    // of the cluster aligns with containerW/2. This corrects approxWidth drift
    // while preserving the relative offsets between hero and satellites.
    const minX = Math.min(...blocks.map(b => b.x));
    const maxX = Math.max(...blocks.map(b => b.x + b.width));
    const clusterMidX = (minX + maxX) / 2;
    const shiftX = centerX - clusterMidX;
    for (const b of blocks) { b.x += shiftX; }

    // Vertical: normalize so y=0 at top of cluster
    const minY = Math.min(...blocks.map(b => b.y));
    const maxY = Math.max(...blocks.map(b => b.y + b.totalHeight));
    for (const b of blocks) { b.y -= minY; }
    const clusterH = maxY - minY;

    return { blocks, clusterW: containerW, clusterH };
  }, [words, containerW, canvasH, offsetY, cwf]);

  if (!layout || layout.blocks.length === 0) return null;

  const { blocks, clusterW, clusterH } = layout;

  // Caption zone: center the bounding box horizontally and position in lower portion
  const bottomY = canvasH * (1 - offsetY / 100);
  const captionZoneCenter = bottomY - (canvasH * 0.06);
  const boxTop = captionZoneCenter - clusterH / 2;
  const boxLeft = (canvasW - clusterW) / 2;

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER — bounding box div wraps all blocks. Blocks use relative coords.
  // The bounding box is the draggable/movable element for the frontend.
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div
      style={{
        position: 'absolute',
        left: boxLeft,
        top: boxTop,
        width: clusterW,
        height: clusterH,
        pointerEvents: 'none',
      }}
      data-caption-overlay
    >
      {blocks.map((block, i) => {
        const appeared = currentTimeMs >= block.lineStartMs;

        // Hero spring animation
        let scaleVal = 1;
        if (block.type === 'hero' && appeared) {
          const elapsed = Math.round(((currentTimeMs - block.lineStartMs) / 1000) * fps);
          scaleVal = spring({ frame: elapsed, fps, config: { damping: 12, stiffness: 150, mass: 0.8 } });
        }

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: block.x,
              top: block.y,
              fontFamily: block.type === 'hero' ? heroFontFamily : satFontFamily,
              fontSize: block.fontSize,
              fontWeight: block.type === 'hero' ? 700 : 600,
              fontStyle: block.type === 'hero' ? 'italic' : 'normal',
              color: block.type === 'hero' ? heroColor : satColor,
              letterSpacing: block.type === 'hero' ? '-0.5px' : '1.5px',
              textTransform: block.type === 'satellite' ? 'uppercase' as const : 'none' as const,
              lineHeight: 1,
              textShadow: block.type === 'hero'
                ? '0 0 20px rgba(230,57,70,0.5), 0 2px 12px rgba(0,0,0,0.9)'
                : '0 1px 8px rgba(0,0,0,0.85)',
              opacity: appeared ? (block.type === 'satellite' ? 0.9 : 1) : 0,
              transform: block.type === 'hero' ? `scale(${appeared ? scaleVal : 1})` : undefined,
              transformOrigin: 'center top',
              whiteSpace: 'nowrap',
            }}
          >
            {block.text}
          </div>
        );
      })}
    </div>
  );
});

export default KineticLuxeCaption;
