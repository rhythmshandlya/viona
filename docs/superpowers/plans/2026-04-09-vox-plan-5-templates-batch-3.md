# Plan 5: Vox Templates — Batch 3 (Narrative + Emphasis + Extended)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the final 26 vox templates: Narrative & Evidence (9), Lists (2), Emphasis & Alert (4), and Extended catalog (11 from series analysis). This completes the full 52-template Vox theme.

**Architecture:** Same pattern as Batches 1 and 2.

**Tech Stack:** React, Remotion, Zod, vox shared library

**Spec reference:** `docs/superpowers/specs/2026-04-09-vox-theme-research.md` Parts IV and X

**Prerequisite:** Plan 2 (shared library). Plans 3 and 4 are NOT required — batches are independent.

---

### Narrative & Evidence (9 templates)

#### Task 1: `vox-collage`
2-4 cutout images with rough edges, arranged on textured background with parallax depth.

**Schema:**
```typescript
export const schema = z.object({
  items: z.array(z.object({ label: z.string(), description: z.string().optional() })).min(2).max(4),
  title: z.string().optional(),
});
```

- [ ] Create all 5 files, add import + registry, verify, commit

#### Task 2: `vox-annotation`
Image area with animated circle, arrow, and label annotations. Progressive reveal.

**Schema:**
```typescript
export const schema = z.object({
  annotations: z.array(z.object({
    type: z.enum(['circle', 'arrow', 'underline']),
    label: z.string(),
    positionX: z.number().min(0).max(100).default(50),
    positionY: z.number().min(0).max(100).default(50),
  })).min(1).max(4),
  title: z.string().optional(),
});
```

- [ ] Create all 5 files, add import + registry, verify, commit

#### Task 3: `vox-profile`
Person name, title, key fact in clean card. Optional photo cutout area.

**Schema:**
```typescript
export const schema = z.object({
  name: z.string(),
  title: z.string(),
  fact: z.string().optional(),
  role: z.string().optional(),
});
```

- [ ] Create all 5 files, add import + registry, verify, commit

#### Task 4: `vox-source`
Source document frame with zoom area and highlight. Attribution badge.

**Schema:**
```typescript
export const schema = z.object({
  title: z.string(),
  excerpt: z.string(),
  source: z.string(),
  year: z.string().optional(),
});
```

- [ ] Create all 5 files, add import + registry, verify, commit

#### Task 5: `vox-evidence`
Split layout: evidence side + interpretation side with rough divider.

**Schema:**
```typescript
export const schema = z.object({
  evidence: z.object({ label: z.string(), detail: z.string() }),
  interpretation: z.object({ label: z.string(), detail: z.string() }),
  title: z.string().optional(),
});
```

- [ ] Create all 5 files, add import + registry, verify, commit

#### Task 6: `vox-spotlight`
Darkened background with spotlight circle on focal area, annotations.

**Schema:**
```typescript
export const schema = z.object({
  focusLabel: z.string(),
  detail: z.string().optional(),
  annotations: z.array(z.string()).max(3).optional(),
});
```

- [ ] Create all 5 files, add import + registry, verify, commit

#### Task 7: `vox-filmstrip`
Contact sheet / film strip layout showing sequence of images or states.

**Schema:**
```typescript
export const schema = z.object({
  frames: z.array(z.object({ label: z.string(), caption: z.string().optional() })).min(3).max(6),
  title: z.string().optional(),
});
```

- [ ] Create all 5 files, add import + registry, verify, commit

#### Task 8: `vox-scrapbook`
Archival collage assembled piece-by-piece, protest-poster aesthetic.

**Schema:**
```typescript
export const schema = z.object({
  items: z.array(z.object({ text: z.string(), type: z.enum(['headline', 'clipping', 'note']).default('clipping') })).min(2).max(5),
  title: z.string().optional(),
});
```

- [ ] Create all 5 files, add import + registry, verify, commit

#### Task 9: `vox-metaphor`
Abstract concept with concrete visual proxy that reveals data.

**Schema:**
```typescript
export const schema = z.object({
  concept: z.string(),
  metaphor: z.string(),
  revealValue: z.string(),
  revealLabel: z.string().optional(),
});
```

- [ ] Create all 5 files, add import + registry, verify, commit

---

### Lists (2 templates)

#### Task 10: `vox-bullets`
Bulleted list with progressive reveal. Key terms in bold.

**Schema:**
```typescript
export const schema = z.object({
  items: z.array(z.string()).min(2).max(6),
  title: z.string().optional(),
});
```

- [ ] Create all 5 files, add import + registry, verify, commit

#### Task 11: `vox-proscons` (already in Batch 2 Task 4)
Skip — already created in Plan 4.

---

### Emphasis & Alert (4 templates)

#### Task 11: `vox-alert`
Yellow alert bar with bold text. Film grain heavier, slight entrance shake.

**Schema:**
```typescript
export const schema = z.object({
  text: z.string(),
  severity: z.enum(['info', 'warning', 'critical']).default('warning'),
});
```

- [ ] Create all 5 files, add import + registry, verify, commit

#### Task 12: `vox-callout`
Boxed callout with rough edge, icon + text. Slightly rotated.

**Schema:**
```typescript
export const schema = z.object({
  text: z.string(),
  icon: z.enum(['info', 'warning', 'star', 'pin']).default('info'),
});
```

- [ ] Create all 5 files, add import + registry, verify, commit

#### Task 13: `vox-takeaway`
Key takeaway card with numbered points. Yellow marker on number.

**Schema:**
```typescript
export const schema = z.object({
  takeaways: z.array(z.string()).min(1).max(4),
  title: z.string().default('Key Takeaways'),
});
```

- [ ] Create all 5 files, add import + registry, verify, commit

#### Task 14: `vox-verdict`
Final judgment card. Large serif verdict text with rationale.

**Schema:**
```typescript
export const schema = z.object({
  verdict: z.string(),
  rationale: z.string().optional(),
  confidence: z.enum(['strong', 'moderate', 'uncertain']).default('strong'),
});
```

- [ ] Create all 5 files, add import + registry, verify, commit

---

### Extended Catalog (11 templates from series analysis)

#### Task 15: `vox-wordswap`
Sentence with key word that swaps to show contrast.

**Schema:** `{ sentence: string, wordA: string, wordB: string }`

- [ ] Create all 5 files, add import + registry, verify, commit

#### Task 16: `vox-supercut`
Rapid montage of similar items flickering at 2-3 frames each.

**Schema:** `{ items: string[] (min 4, max 12), title?: string }`

- [ ] Create all 5 files, add import + registry, verify, commit

#### Task 17: `vox-unitchart`
Isotype visualization — individual dots/icons representing data points that regroup.

**Schema:** `{ total: number, highlighted: number, unit: string, label: string }`

- [ ] Create all 5 files, add import + registry, verify, commit

#### Task 18: `vox-systemdiagram`
Cartoon character system diagram — stakeholders with labeled roles and connections.

**Schema:** `{ actors: { name, role }[], connections: { from, to, label }[] }`

- [ ] Create all 5 files, add import + registry, verify, commit

#### Task 19: `vox-thennow`
Then/now split with date labels.

**Schema:** `{ then: { label, year, detail }, now: { label, year, detail } }`

- [ ] Create all 5 files, add import + registry, verify, commit

#### Task 20: `vox-blueprint`
Schematic overlay with dimension lines and labels.

**Schema:** `{ title: string, dimensions: { label, value }[], detail?: string }`

- [ ] Create all 5 files, add import + registry, verify, commit

#### Task 21: `vox-areachart`
Stacked area chart showing composition over time.

**Schema:** `{ layers: { label, color? }[], title?: string, xLabel?: string }`

- [ ] Create all 5 files, add import + registry, verify, commit

#### Task 22: `vox-donut`
Animated donut chart with segment reveals and percentage labels.

**Schema:** `{ segments: { label, value, color? }[], title?: string }`

- [ ] Create all 5 files, add import + registry, verify, commit

#### Task 23: `vox-diverging`
Diverging trend lines showing how two metrics separate.

**Schema:** `{ lineA: { label }, lineB: { label }, divergePoint?: string, title?: string }`

- [ ] Create all 5 files, add import + registry, verify, commit

#### Task 24: `vox-treemap`
Block chart showing hierarchical proportions with sequential fills.

**Schema:** `{ blocks: { label, value }[], title?: string }`

- [ ] Create all 5 files, add import + registry, verify, commit

#### Task 25: `vox-matrix`
2x2 grid with labeled axes and items in quadrants.

**Schema:** `{ xAxis: { low, high }, yAxis: { low, high }, items: { label, x, y }[] }`

- [ ] Create all 5 files, add import + registry, verify, commit

---

### Task 26: Final full-theme verification

- [ ] **Step 1: Count all vox templates**

```bash
cd packages/templates && node -e "
  require('./src/index');
  const { listTemplates } = require('./src/registry');
  const vox = listTemplates({ theme: 'vox' });
  console.log('Total vox templates:', vox.length);
  vox.forEach(t => console.log(' -', t.meta.slug));
"
```

Expected: ~52 templates (exact count depends on which were in Batch 2 vs 3).

- [ ] **Step 2: TypeScript compiles**

```bash
cd packages/templates && npx tsc --noEmit
```

- [ ] **Step 3: Verify no magazine templates broken**

```bash
cd packages/templates && node -e "
  require('./src/index');
  const { listTemplates } = require('./src/registry');
  const mag = listTemplates({ theme: 'magazine' });
  console.log('Magazine templates:', mag.length);
"
```

Expected: Same count as before vox work (should be ~28-30).

- [ ] **Step 4: Final commit**

```bash
git commit --allow-empty -m "chore: vox theme complete — 52 templates, shared library, DNA pipeline"
```
