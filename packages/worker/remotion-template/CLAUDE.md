# Remotion Visual Generator

## Commands
- `npx tsc --noEmit --pretty false` - TypeScript validation
- `npx remotion bundle --out-dir <path>` - Bundle composition

## Code Style (CRITICAL)
- TypeScript with React functional components
- Use `useCurrentFrame()` and `useVideoConfig()` for all animation timing
- Use `spring()` for entrances/exits with config: `{ damping: 22, stiffness: 90, mass: 0.9 }`
- Use `interpolate()` with `extrapolateRight: 'clamp'` ALWAYS
- Stagger elements by 6+ frames minimum (NEVER animate all at once)

## File Structure
```
src/proj_<id>/
├── constants.ts   # COLORS, TIMING, SPRING_CONFIG
└── index.tsx      # Main composition with all scenes
```

## Common Gotchas
- NEVER use `Math.sin/cos` on text positions (causes jittery text)
- NEVER use damping < 20 (too bouncy)
- NEVER use R3F's `useFrame()` hook - breaks video rendering
- For 3D: use `<ThreeCanvas>` from @remotion/three, NOT R3F `<Canvas>`

## Fonts
Import from `src/fonts.ts` for consistent typography:
```typescript
import { FONTS, FONT_PAIRS, FONT_SIZES } from '../fonts';

// Use font pairs for cohesive design
const { headline, body } = FONT_PAIRS.modernTech;

// Apply in styles
<div style={{ fontFamily: headline, fontSize: FONT_SIZES.h1 }}>Title</div>
<div style={{ fontFamily: body, fontSize: FONT_SIZES.body }}>Body text</div>
```

**Available Pairs:** `modernTech`, `boldImpact`, `friendlyTech`, `strongReadable`, `elegantEditorial`, `cleanMinimal`

**Content Matching:** Use `getFontPairForContent('tech' | 'lifestyle' | 'business' | 'entertainment' | 'educational' | 'news')`

## Available Skills

### Core Animation & Video
- `remotion-best-practices` - Official Remotion patterns, 3D, audio, animations
- `motion-one` - Animation principles and timing
- `framer-motion` - Framer Motion patterns (adaptable to Remotion)
- `interaction-design` - Interaction and motion design patterns

### Visual Design & Graphics
- `frontend-design` - Avoid generic AI aesthetics, bold design decisions
- `graphic-designer` - Graphic design principles
- `marketing-visual-design` - Marketing-focused visual design
- `tailwind-v4-shadcn` - Modern styling patterns

### Code Quality
- `vercel-react-best-practices` - React performance optimization from Vercel
- `typescript-skills` - TypeScript patterns

## Skill Usage

When implementing visual effects from a plan:
1. Check `remotion-best-practices` for Remotion-specific patterns
2. Check `motion-one` for animation timing and easing
3. Check `frontend-design` to avoid generic/boring aesthetics
4. Check `graphic-designer` for visual composition principles

For techniques like particle-emitter, mask-reveal, cell-division - implement with physics-based animations, not simple fades.
