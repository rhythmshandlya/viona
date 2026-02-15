# Landing Page Motion Graphics Design

**Date:** 2026-02-15
**Status:** Approved

## Overview

Add cinematic motion graphics to `apps/landing` using GSAP + ScrollTrigger. Keep the existing warm orange + white theme. Goal: transform a clean but static landing page into a premium, motion-rich experience.

## Tech Stack

- **GSAP 3** (core + ScrollTrigger plugin) — ~45KB gzipped
- Loaded via `<script>` in Astro base layout
- Each component registers its own animations in inline `<script>` tags
- No framework integration needed (vanilla JS with Astro)

## Section-by-Section Design

### Hero

- **Headline:** Word-by-word fade-up on page load via GSAP timeline
- **Wavy underline:** SVG stroke draw-on animation
- **Subtext + CTA:** Staggered fade-up after headline (slight delay)
- **Animated product demo:** Coded SVG/CSS mockup showing the transformation:
  1. Video frame with talking-head silhouette
  2. Transcript lines animate in
  3. Visual elements (chart, diagram, icons) draw themselves alongside
  4. Sequence plays once and holds
- **Background:** Floating orange gradient orbs with slow GSAP parallax drift

### Stats Bar

- **Number counters:** Each stat counts up from 0 to final value on scroll-enter
- **Staggered entrance:** Slide-up + fade, 0.15s delay between each stat
- **Typography:** Tabular/mono figures so digits don't shift width during count

### Features

- **Alternating slide-ins:** Left feature slides from left, right from right
- **Animated mockups:** SVG chart/diagram that draws on scroll (replaces gradient placeholders)
- **Bullet stagger:** Feature text bullet points fade up with stagger
- **Parallax offset:** Text moves slightly faster than mockup image

### How It Works

- **Connecting line:** SVG path draws itself between the 3 steps on scroll
- **Step cards:** Scale 0.9 → 1.0 + fade in sequentially as line reaches each
- **Number pop:** Step numbers get brief bounce effect
- **Icon animations:** Each step icon gets contextual entrance (bounce, pulse, slide)

### Testimonials

- **Card dealing:** Cards stagger in from below with slight rotation (-2deg → 0deg)
- **Quote marks:** Scale-up pop effect
- **Carousel transitions:** Smooth GSAP crossfade (not hard cuts)
- **Background:** Subtle floating particles or gradient orbs with parallax

### CTA

- **Blur-to-sharp:** Text and button animate from slightly blurred to crisp
- **Button glow:** Persistent subtle orange shadow pulse (breathing effect)
- **Background:** Slow gradient hue shift on orange accent

## Global Motion Patterns

| Pattern | Value |
|---------|-------|
| Scroll reveal base | `fade-up`, 60px travel, 0.6s, `power2.out` |
| Stagger timing | 0.1–0.15s between siblings |
| Parallax rate | Background: 0.3x scroll speed |
| Page load | Hero timeline: 0.6s total |

## Accessibility

- All animations respect `prefers-reduced-motion` via GSAP `matchMedia`
- Animations simply don't play for users who prefer reduced motion
- All content remains fully accessible without animations

## Mobile

- Simpler animations (no parallax)
- Shorter travel distances
- Faster durations
- Performance-optimized for mobile devices

## Dependencies

- `gsap` (npm package)
- `@gsap/scrolltrigger` (npm package, or bundled with gsap)
- No other new dependencies
