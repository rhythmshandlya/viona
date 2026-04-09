# Plan 4: Vox Templates — Batch 2 (Comparison + Structure + Geographic)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the next 14 vox templates covering Comparison & Analysis (5), Structure & Process (6), and Geographic & Location (3).

**Architecture:** Same pattern as Batch 1 — each template has meta.json, metadata.json, schema.ts, index.tsx, register.ts. All import from `../../vox/` shared library.

**Tech Stack:** React, Remotion, Zod, vox shared library

**Spec reference:** `docs/superpowers/specs/2026-04-09-vox-theme-research.md` Part IV

**Prerequisite:** Plan 2 (shared library) must be completed first. Plan 3 (Batch 1) is NOT required — batches are independent.

---

## Template Specifications

### Comparison & Analysis (5 templates)

#### Task 1: `vox-versus`
A vs B split with rough divider. Each side has label + key metric. Yellow highlight on the winner.

**Schema:**
```typescript
export const schema = z.object({
  sideA: z.object({ label: z.string(), value: z.string(), detail: z.string().optional() }),
  sideB: z.object({ label: z.string(), value: z.string(), detail: z.string().optional() }),
  winner: z.enum(['a', 'b', 'none']).default('none'),
  title: z.string().optional(),
});
```

**Key animation:** Side A enters left, Side B enters right, staggered 6 frames. `RoughDivider` draws on between them. Winner gets `HighlighterMark`.

- [ ] Create all 5 files (meta.json, metadata.json, schema.ts, index.tsx, register.ts)
- [ ] Add import + registry entry
- [ ] Verify compiles, commit

#### Task 2: `vox-beforeafter`
Before/after split showing two states with date labels and rough divider.

**Schema:**
```typescript
export const schema = z.object({
  before: z.object({ label: z.string(), description: z.string(), year: z.string().optional() }),
  after: z.object({ label: z.string(), description: z.string(), year: z.string().optional() }),
  title: z.string().optional(),
});
```

- [ ] Create all 5 files
- [ ] Add import + registry entry
- [ ] Verify compiles, commit

#### Task 3: `vox-factcheck`
Claim card (dimmed/strikethrough) → correction card (yellow highlighted). Progressive reveal.

**Schema:**
```typescript
export const schema = z.object({
  claim: z.string(),
  reality: z.string(),
  source: z.string().optional(),
});
```

**Key animation:** Claim enters first (8 frames), holds. Then strikethrough draws across claim text via `drawOn()`. Reality card enters below with `HighlighterMark` on key phrase.

- [ ] Create all 5 files
- [ ] Add import + registry entry
- [ ] Verify compiles, commit

#### Task 4: `vox-proscons`
Two-column layout: pros (teal) and cons (muted red). Items stagger alternately.

**Schema:**
```typescript
export const schema = z.object({
  pros: z.array(z.string()).min(1).max(5),
  cons: z.array(z.string()).min(1).max(5),
  title: z.string().optional(),
});
```

- [ ] Create all 5 files
- [ ] Add import + registry entry
- [ ] Verify compiles, commit

#### Task 5: `vox-spectrum`
Continuous scale with labeled endpoints and positioned markers.

**Schema:**
```typescript
export const schema = z.object({
  leftLabel: z.string(),
  rightLabel: z.string(),
  markers: z.array(z.object({ label: z.string(), position: z.number().min(0).max(100) })).min(1).max(5),
  title: z.string().optional(),
});
```

- [ ] Create all 5 files
- [ ] Add import + registry entry
- [ ] Verify compiles, commit

---

### Structure & Process (6 templates)

#### Task 6: `vox-process`
Numbered step sequence. Each step reveals with stagger. Connecting lines draw on. Active step yellow.

**Schema:**
```typescript
export const schema = z.object({
  steps: z.array(z.object({ label: z.string(), description: z.string().optional() })).min(2).max(6),
  title: z.string().optional(),
  direction: z.enum(['vertical', 'horizontal']).default('vertical'),
});
```

**Key animation:** `progressiveBuild()` for items, `drawOn()` for connectors between steps.

- [ ] Create all 5 files
- [ ] Add import + registry entry
- [ ] Verify compiles, commit

#### Task 7: `vox-causeeffect`
Chain of cause → effect boxes with animated arrow connectors.

**Schema:**
```typescript
export const schema = z.object({
  chain: z.array(z.object({ label: z.string(), detail: z.string().optional() })).min(2).max(5),
  title: z.string().optional(),
});
```

- [ ] Create all 5 files
- [ ] Add import + registry entry
- [ ] Verify compiles, commit

#### Task 8: `vox-funnel`
Narrowing stages showing reduction. Each stage labeled with count/percentage.

**Schema:**
```typescript
export const schema = z.object({
  stages: z.array(z.object({ label: z.string(), value: z.string() })).min(2).max(5),
  title: z.string().optional(),
});
```

- [ ] Create all 5 files
- [ ] Add import + registry entry
- [ ] Verify compiles, commit

#### Task 9: `vox-checklist`
Items with check/cross marks revealing sequentially.

**Schema:**
```typescript
export const schema = z.object({
  items: z.array(z.object({ text: z.string(), checked: z.boolean() })).min(2).max(6),
  title: z.string().optional(),
});
```

- [ ] Create all 5 files
- [ ] Add import + registry entry
- [ ] Verify compiles, commit

#### Task 10: `vox-cycle`
Circular process with steps in a loop. Arrow follows the cycle.

**Schema:**
```typescript
export const schema = z.object({
  steps: z.array(z.string()).min(3).max(6),
  title: z.string().optional(),
});
```

- [ ] Create all 5 files
- [ ] Add import + registry entry
- [ ] Verify compiles, commit

#### Task 11: `vox-tree`
Hierarchical branching diagram. Parent → children with draw-on connections.

**Schema:**
```typescript
export const schema = z.object({
  root: z.string(),
  branches: z.array(z.object({ label: z.string(), children: z.array(z.string()).optional() })).min(2).max(4),
  title: z.string().optional(),
});
```

- [ ] Create all 5 files
- [ ] Add import + registry entry
- [ ] Verify compiles, commit

---

### Geographic & Location (3 templates)

#### Task 12: `vox-map`
Simplified map region with animated border draw-on, location pins, and labels.

**Schema:**
```typescript
export const schema = z.object({
  region: z.string().default('Middle East'),
  locations: z.array(z.object({ name: z.string(), detail: z.string().optional() })).max(4),
  title: z.string().optional(),
  highlightColor: z.string().optional(),
});
```

**Key animation:** Region shape fades in, border draws on via `drawOn()`, location pins `popIn()` with radar pulse.

- [ ] Create all 5 files
- [ ] Add import + registry entry
- [ ] Verify compiles, commit

#### Task 13: `vox-country`
Country silhouette with key stats inside or beside.

**Schema:**
```typescript
export const schema = z.object({
  country: z.string().default('Brazil'),
  stats: z.array(z.object({ label: z.string(), value: z.string() })).min(1).max(4),
  accentColor: z.string().optional(),
});
```

- [ ] Create all 5 files
- [ ] Add import + registry entry
- [ ] Verify compiles, commit

#### Task 14: `vox-location`
Location pin with place name, coordinates, and contextual details.

**Schema:**
```typescript
export const schema = z.object({
  name: z.string().default('Tahrir Square'),
  coordinates: z.string().optional(),
  detail: z.string().optional(),
});
```

- [ ] Create all 5 files
- [ ] Add import + registry entry
- [ ] Verify compiles, commit

---

### Task 15: Batch verification

- [ ] **Step 1: Verify all 14 new templates registered**

```bash
cd packages/templates && node -e "
  require('./src/index');
  const { listTemplates } = require('./src/registry');
  const vox = listTemplates({ theme: 'vox' });
  console.log('Vox templates:', vox.length);
  vox.forEach(t => console.log(' -', t.meta.slug));
"
```

- [ ] **Step 2: TypeScript compiles clean**

```bash
cd packages/templates && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "chore: verify vox templates batch 2 — 14 templates registered and compiling"
```
