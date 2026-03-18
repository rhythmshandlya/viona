<example>
# SCENE_PLAN.md

## Global
- **Canvas:** 1080x1920
- **Caption style:** Sora 32px, rgba(255,255,255,0.95), active word #8B5CF6
- **Energy arc:** Hook high (4) → building (3) → dip (2) → climax (5) → close (3)
- **Total scenes:** 3
- **Scene coverage:** ~48% of total duration

---

## Scene 1: Three Key Benefits
**Time:** 12000 – 24000
**Transcript:** "there are three key benefits to this approach: faster iteration, lower costs, and better retention"
**Display mode:** split-screen 55/45
**Energy:** 4

### Speaker layout (for Layout Editor)
- Speaker transform: { x: 0, y: 1056, width: 1080, height: 864 }

### Scene placement (for Layout Editor)
- Scene dimensions: 1080x1056
- Scene transform: { x: 0, y: 0, width: 1080, height: 1056 }
- Track: overlay
- Z-order: above speaker, below captions

### Transitions (for Layout Editor)
- Entry: crossfade 12f
- Exit: crossfade 12f

### Animation brief (for Animator)
- Scene type: step-cards
- Description: "Three glass cards appear one by one with spring animation. Each card has a numbered circle on the left (1, 2, 3) in violet and the benefit text on the right. Cards stagger in 8 frames apart from the left side. After all three appear, checkmark icons fade in on each card simultaneously."
- Key data: ["Faster iteration", "Lower costs", "Better retention"]
- Must show: exactly three cards, one per benefit, using the speaker's exact words

---

## Scene 2: User Satisfaction Stat
**Time:** 31000 – 37000
**Transcript:** "and seventy-three percent of users said they actually preferred the new version"
**Display mode:** overlay
**Energy:** 2

### Speaker layout (for Layout Editor)
- Speaker transform: full size (no change)

### Scene placement (for Layout Editor)
- Scene dimensions: 280x160
- Scene transform: { x: 750, y: 620, width: 280, height: 160 }
- Track: overlay
- Z-order: above speaker, below captions

### Transitions (for Layout Editor)
- Entry: none
- Exit: fade 8f

### Animation brief (for Animator)
- Scene type: data-viz
- Description: "Glass card with a large counting number that animates from 0 to 73 over 22 frames, followed by a percent sign. Below the number, secondary text reads 'preferred new version'. The card scales in from 0.85 to 1.0 with a spring."
- Key data: ["73%", "preferred new version"]
- Must show: the number 73%, the phrase "preferred new version"

---

## Scene 3: Architecture Overview
**Time:** 42000 – 55000
**Transcript:** "so the architecture has three layers — the API gateway handles routing, the service mesh manages communication between microservices, and the data layer persists everything to postgres and redis"
**Display mode:** fullscreen
**Energy:** 5

### Speaker layout (for Layout Editor)
- Speaker transform: opacity: 0

### Scene placement (for Layout Editor)
- Scene dimensions: 1080x1920
- Scene transform: { x: 0, y: 0, width: 1080, height: 1920 }
- Track: overlay
- Z-order: above speaker, below captions

### Transitions (for Layout Editor)
- Entry: crossfade 12f
- Exit: crossfade 12f

### Animation brief (for Animator)
- Scene type: hierarchy
- Description: "Three-layer architecture diagram on dark mesh background. Top layer: glass card labeled 'API Gateway' with routing icon. Middle layer: glass card labeled 'Service Mesh' with three small connected nodes inside. Bottom layer: glass card labeled 'Data Layer' with Postgres and Redis icons side by side. Layers enter top-to-bottom with 10-frame stagger. After all layers are in, animated connecting lines draw between them vertically with a violet glow."
- Key data: ["API Gateway — routing", "Service Mesh — microservice communication", "Data Layer — Postgres + Redis"]
- Must show: three distinct layers, exact names (API Gateway, Service Mesh, Data Layer), Postgres and Redis mentioned in data layer

---

## Punch-in Locations
| Timestamp | Crop | Notes |
|---|---|---|
| 26000ms | { x: 50, y: 40, scale: 1.3 } | "this is the key insight" — emphasis moment |
| 58000ms | { x: 50, y: 40, scale: 1.35 } | "and that's what makes this work" — closing emphasis |

## Multi-angle Cuts
| Timestamp | Crop region | Notes |
|---|---|---|
| 38000ms | { x: 45, y: 42, scale: 1.1 } | Slight left offset before architecture scene |

---

## Self-verification

| Check | Status |
|---|---|
| Display modes vary (not 3+ same in a row) | PASS — split-screen, overlay, fullscreen |
| No 3+ consecutive fullscreen | PASS — only 1 fullscreen scene |
| Energy arc: no adjacent duplicates | PASS — 4, 2, 5 |
| Energy arc: hook at 4-5 | PASS — Scene 1 at 4 |
| Energy arc: at least one dip | PASS — Scene 2 at 2 |
| Scene coverage 40-60% | PASS — 25s of scenes / 52s total ≈ 48% |
| All scenes 5-15s | PASS — 12s, 6s, 13s |
| Overlay scenes avoid face zone | PASS — Scene 2 at x:750 y:620, right side |
| Split-screen has exact pixel values | PASS — Scene 1: speaker {0,1056,1080,864} + scene {0,0,1080,1056} |
| Fullscreen speaker opacity 0 | PASS — Scene 3 |
</example>
