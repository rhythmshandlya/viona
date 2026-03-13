# Visual Diversity — Expand Beyond Cards+Text Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the visual generation prompt pipeline so the AI produces diverse animation techniques (SVG path drawing, shape morphing, kinetic typography, animated diagrams, particle effects) instead of defaulting to card-with-text for every scene.

**Architecture:** The prompt pipeline has 4 layers: Director system prompt → Theme style (director-style.md, style-guide.md, design-system.md) → Animator system prompt → Workspace CLAUDE.md. All 4 layers previously funneled visuals into "polished card-based animations." We update each layer to encourage visual diversity while keeping cards as ONE option for data/stats.

**Tech Stack:** Markdown prompt files, no code changes needed.

---

## Chunk 1: Core Prompt Updates (ALREADY DONE)

The following files have already been edited in this session:

### Task 1: Director System Prompt ✅
**Files:**
- Modified: `packages/worker/src/prompts/director/system.md`

Changes made:
- [x] Updated philosophy section: "Template-first visuals" → "Diverse visual techniques"
- [x] Updated motion_design_planning: added technique variety rule, expanded layer descriptions
- [x] Updated visual_metaphors table: concepts now map to techniques + templates (not templates only)
- [x] Removed "NEVER describe physical objects" blanket ban, replaced with nuanced guidance
- [x] Added "Technique variety" check to self-verification table

### Task 2: Animator System Prompt ✅
**Files:**
- Modified: `packages/worker/src/prompts/animator/system.md`

Changes made:
- [x] Updated Layer 1 description in reasoning template: "text/data" → "animated SVG, path-drawing, morphing shape, kinetic typography, or diagram"
- [x] Removed "Colored div shapes as real objects" prohibition, replaced with "Plain colored divs as illustrations" ban
- [x] Removed "Crude figurative SVGs" blanket prohibition
- [x] Updated "Text-only scenes" to emphasize animated SVG, path-draw, morph, diagram, data-viz
- [x] Replaced "Domain SVGs on dot-grid" prohibition with "Every scene in a card" prohibition
- [x] Added full `<visual_techniques>` section with 7 technique recipes + code examples:
  - SVG path drawing (strokeDasharray/strokeDashoffset)
  - Shape morphing (cross-fade + scale)
  - Animated diagrams (nodes + connecting lines)
  - Kinetic typography (word-by-word cascade)
  - Animated progress/data viz
  - Particle/element scatter
  - Full-scene SVG illustration
- [x] Added technique selection guide table
- [x] Added adjacent-scene variety rule

### Task 3: Studio Dark Style Guide ✅
**Files:**
- Modified: `packages/worker/src/prompts/themes/studio/dark/style-guide.md`

Changes made:
- [x] Renamed from "Polished Card Animations" to "Polished Motion Graphics"
- [x] Updated DESIGN section: cards are now one option among many visual techniques
- [x] Added "VARIETY across scenes" design principle

### Task 4: Studio Light Style Guide ✅
**Files:**
- Modified: `packages/worker/src/prompts/themes/studio/light/style-guide.md`

Changes made:
- [x] Same changes as dark variant

### Task 5: Studio Design System ✅
**Files:**
- Modified: `packages/worker/src/prompts/themes/studio/design-system.md`

Changes made:
- [x] Updated Layer 1 table: concepts now map to techniques + templates
- [x] Added "Templates are ONE option" clarification
- [x] Replaced anti-patterns:
  - "Raw Shapes as Concepts" → nuanced SVG quality guidance
  - "Crude Figurative SVGs" → SVG quality threshold with constructive alternatives
  - Added "Every Scene in a Card" as new anti-pattern
  - Added "Same Visual Pattern Repeated" as new anti-pattern

### Task 6: Director Style Prompt ✅
**Files:**
- Modified: `packages/worker/src/prompts/themes/studio/director-style.md`

Changes made:
- [x] Updated header: "card-based animations" → "motion graphics with diverse visual techniques"
- [x] Added VISUAL TECHNIQUES table with 8 technique types and when to plan them
- [x] Added "No two adjacent scenes should use the same primary technique" rule
- [x] Relaxed template guidance: "use when they fit, but do NOT force every scene into a template"

---

## Chunk 2: Remaining Fixes ✅ (DONE)

### Task 7: Quality Checklist — Generalize Card References ✅
**Files:**
- Modified: `packages/worker/src/prompts/shared/quality-checklist.md`

- [x] Replaced "(icon + label + card)" with "(icon + label + container)"
- [x] Added "Visual technique varies from adjacent scenes" to animator checklist
- [x] Added "TECHNIQUE VARIETY TEST" to director plan checklist

### Task 8: YouTube Clip Section — Allow Frame Style Options ✅
**Files:**
- Modified: `packages/worker/src/prompts/animator/youtube-clip-section.md`

- [x] Removed blanket "NEVER use device mockup frames" ban
- [x] Default is still card frame, but Director-specified frameStyle (phone, laptop, browser, polaroid, film) is now allowed
- [x] Removed "No device mockups" from DON'T list

### Task 9: Verify No Remaining Card-Centric Language ✅
- [x] Searched for card-forcing patterns across all prompt files
- [x] All remaining "card" mentions are in context of "cards are ONE option, don't force everything into cards"
- [x] No card-forcing language remains
