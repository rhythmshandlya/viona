# Landing Redesign: Human-Feel, Editorial/Storytelling

**Date:** 2026-03-11
**Branch:** landing/redesign-showcase
**Scope:** Full visual redesign — make the landing page feel crafted, not AI-generated.

## Goal

Remove all AI-generated aesthetic tells and replace with an editorial, creator-focused feel (reference: Descript, Captions.ai, The Browser Company). The page should feel like a human who knows video creators built it.

## What's Changing and Why

### Typography
- **Add DM Serif Display** (Google Font) for all `h1` and `h2` headlines
- Keep **DM Sans** for body and UI text
- Use **system monospace** for stats/counters
- Why: DM Sans everywhere reads as generic AI SaaS. A serif headline immediately signals editorial craft.

### Color Cleanup
- Background: `#ffffff` (remove purple-tinted `#FAFAFF`)
- Remove all purple gradient washes and glow blobs from hero section
- Purple stays only as a sharp accent: links, underlines, brand moments
- Why: Purple radial gradients = 2024 AI startup cliché.

### Hero Section (complete rewrite)
- **Remove**: Three.js canvas, floating gradient blob, GSAP blob animation, before/after placeholder with SVG person icon
- **Layout**: Left-aligned editorial split — headline+form on left, product video on right
- **Headline** (DM Serif Display): "Your audience is leaving in the first 30 seconds." / subline in purple: "Here's how to keep them."
- **Subtext**: 2 sentences, specific and human. No "Upload, enhance, export — it's that simple."
- **Right side**: `sample-output.mp4` in a clean phone frame (no gray placeholder person)
- Keep: GSAP entrance animation (toned down), waitlist email form, waitlist counter

### Features Section
- **Headline rewrite**: "Your viewers don't learn from talking heads. They learn from visuals."
- Replace 3-checkbox feature list with 2-column layout: story paragraph (left) + app screenshot (right)
- Before state in the phone reveal: replace SVG person icon with actual messy transcript text
- Keep: the before/after phone reveal animation (it's good)

### HowItWorks Section
- Steps reduced to ultra-short: "Upload. AI works. You ship."
- Remove the toy white-card mini-UI illustrations (index === 0/1/2 blocks)
- Remove the dashed SVG connecting line
- Add one real product screenshot spanning below all 3 steps
- Keep: card layout, step numbers

### Testimonials Section
- Reduce from 6 to 3 quotes
- Remove 5-star ratings from all cards (universal 5 stars = fake tell)
- Twitter/X card style: `@handle`, role ("Course creator, 180K subs")
- Quotes rewritten to be shorter and more specific: numbers, specific outcomes
- Colored initial avatars stay but add Twitter-bird-style card border

### Pricing Section
- Remove 3-tier pricing card grid (it's pre-launch, no pricing exists yet)
- Replace with single "Early Access" block: "Free while in beta. No credit card." + waitlist CTA
- Remove "Simple pricing. Start free and scale as you grow." copy

## What Stays

- AppShowcase (macOS chrome + screenshots — already good)
- FAQ section (clean as-is)
- Header navigation
- StatsBar (keep but may simplify)
- GSAP animations (keep, just reduce count of animated elements)
- Waitlist form and API integration

## Files to Change

- `apps/landing/src/styles/globals.css` — font import, background color, remove purple blob
- `apps/landing/src/components/sections/Hero.astro` — full rewrite
- `apps/landing/src/components/sections/Features.astro` — headline + before state + feature list
- `apps/landing/src/components/sections/HowItWorks.astro` — remove toy mockups, add screenshot
- `apps/landing/src/components/sections/Testimonials.astro` — reduce to 3, remove stars, rewrite quotes
- `apps/landing/src/components/sections/Pricing.astro` — replace with early access block
- `apps/landing/src/data/testimonials.ts` — rewrite 3 quotes with handles
- `apps/landing/src/layouts/Layout.astro` — add DM Serif Display font import
