# Landing Page Motion Graphics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add cinematic GSAP-powered motion graphics to the Astro landing page at `apps/landing`, transforming it from static to premium with scroll-triggered animations, parallax, animated counters, and an animated hero product demo.

**Architecture:** Install GSAP + ScrollTrigger, load via a shared `<script>` in the base layout. Each section component gets an inline `<script>` that registers its own scroll-triggered animations using `data-animate` attributes. A shared utility script handles common patterns (fade-up, stagger, parallax). Respects `prefers-reduced-motion`.

**Tech Stack:** GSAP 3, ScrollTrigger plugin, Astro 5 inline scripts, vanilla JS/TS

---

### Task 1: Install GSAP and Set Up Base Animation Infrastructure

**Files:**
- Modify: `apps/landing/package.json` (add gsap dependency)
- Create: `apps/landing/src/scripts/animations.ts` (shared animation utilities)
- Modify: `apps/landing/src/layouts/BaseLayout.astro` (load animation script)

**Step 1: Install GSAP**

Run: `cd apps/landing && pnpm add gsap`

**Step 2: Create shared animation utility script**

Create `apps/landing/src/scripts/animations.ts`:

```typescript
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Respect prefers-reduced-motion
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (prefersReducedMotion) {
  gsap.globalTimeline.timeScale(20); // effectively skip all animations
}

// Shared defaults
const DEFAULTS = {
  duration: 0.7,
  ease: "power2.out",
  y: 50,
  stagger: 0.12,
};

/**
 * Fade-up reveal for elements with [data-animate="fade-up"]
 */
export function initFadeUpAnimations() {
  const elements = document.querySelectorAll('[data-animate="fade-up"]');
  elements.forEach((el) => {
    gsap.from(el, {
      scrollTrigger: {
        trigger: el,
        start: "top 90%",
        toggleActions: "play none none none",
      },
      y: DEFAULTS.y,
      opacity: 0,
      duration: DEFAULTS.duration,
      ease: DEFAULTS.ease,
    });
  });
}

/**
 * Staggered children reveal for containers with [data-animate="stagger"]
 */
export function initStaggerAnimations() {
  const containers = document.querySelectorAll('[data-animate="stagger"]');
  containers.forEach((container) => {
    const children = container.children;
    gsap.from(children, {
      scrollTrigger: {
        trigger: container,
        start: "top 85%",
        toggleActions: "play none none none",
      },
      y: DEFAULTS.y,
      opacity: 0,
      duration: DEFAULTS.duration,
      ease: DEFAULTS.ease,
      stagger: DEFAULTS.stagger,
    });
  });
}

/**
 * Slide-in from left for [data-animate="slide-left"]
 */
export function initSlideLeftAnimations() {
  const elements = document.querySelectorAll('[data-animate="slide-left"]');
  elements.forEach((el) => {
    gsap.from(el, {
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        toggleActions: "play none none none",
      },
      x: -80,
      opacity: 0,
      duration: 0.8,
      ease: DEFAULTS.ease,
    });
  });
}

/**
 * Slide-in from right for [data-animate="slide-right"]
 */
export function initSlideRightAnimations() {
  const elements = document.querySelectorAll('[data-animate="slide-right"]');
  elements.forEach((el) => {
    gsap.from(el, {
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        toggleActions: "play none none none",
      },
      x: 80,
      opacity: 0,
      duration: 0.8,
      ease: DEFAULTS.ease,
    });
  });
}

/**
 * Scale-in for [data-animate="scale-in"]
 */
export function initScaleAnimations() {
  const elements = document.querySelectorAll('[data-animate="scale-in"]');
  elements.forEach((el) => {
    gsap.from(el, {
      scrollTrigger: {
        trigger: el,
        start: "top 88%",
        toggleActions: "play none none none",
      },
      scale: 0.9,
      opacity: 0,
      duration: 0.6,
      ease: "back.out(1.4)",
    });
  });
}

/**
 * Initialize all shared animations
 */
export function initAllAnimations() {
  initFadeUpAnimations();
  initStaggerAnimations();
  initSlideLeftAnimations();
  initSlideRightAnimations();
  initScaleAnimations();
}

export { gsap, ScrollTrigger, DEFAULTS };
```

**Step 3: Load animation script in BaseLayout**

In `apps/landing/src/layouts/BaseLayout.astro`, add before closing `</body>`:

```astro
<script>
  import { initAllAnimations } from "@/scripts/animations";

  // Run on initial load and on Astro client-side navigation
  document.addEventListener("astro:page-load", () => {
    initAllAnimations();
  });
</script>
```

**Step 4: Verify build**

Run: `cd apps/landing && pnpm build`
Expected: Build succeeds with no errors.

**Step 5: Commit**

```bash
git add apps/landing/package.json apps/landing/src/scripts/animations.ts apps/landing/src/layouts/BaseLayout.astro pnpm-lock.yaml
git commit -m "feat(landing): add GSAP + ScrollTrigger animation infrastructure"
```

---

### Task 2: Animate the Hero Section

**Files:**
- Modify: `apps/landing/src/components/sections/Hero.astro`
- Modify: `apps/landing/src/styles/globals.css` (add hero animation styles)

**Step 1: Add hero page-load timeline**

Replace the existing `Hero.astro` with animated version. Key changes:
- Add `data-hero-badge` to the tagline badge
- Add `data-hero-headline` to the h1
- Add `data-hero-sub` to the subheadline paragraph
- Add `data-hero-cta` to the CTA button wrapper
- Add `data-hero-visual` to the before/after visual container
- Add `data-hero-gradient` to the `.hero-gradient` div
- Add an inline `<script>` with a GSAP timeline for the page-load sequence

Add this script block at the bottom of `Hero.astro`:

```astro
<script>
  import { gsap } from "gsap";

  document.addEventListener("astro:page-load", () => {
    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

    tl.from('[data-hero-badge]', { y: 20, opacity: 0, duration: 0.5 })
      .from('[data-hero-headline]', { y: 30, opacity: 0, duration: 0.6 }, "-=0.2")
      .from('[data-hero-sub]', { y: 20, opacity: 0, duration: 0.5 }, "-=0.3")
      .from('[data-hero-cta]', { y: 20, opacity: 0, duration: 0.5 }, "-=0.3")
      .from('[data-hero-visual]', { y: 40, opacity: 0, duration: 0.7 }, "-=0.3");

    // Floating gradient parallax
    gsap.to('[data-hero-gradient]', {
      x: 30,
      y: -20,
      duration: 6,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
    });
  });
</script>
```

Add `data-*` attributes to the corresponding HTML elements in the Hero template:
- `<div class="inline-flex ...">` → add `data-hero-badge`
- `<h1 ...>` → add `data-hero-headline`
- `<p class="text-center text-muted-foreground ...">` → add `data-hero-sub`
- `<div class="flex justify-center mb-10 ...">` → add `data-hero-cta`
- `<div class="max-w-3xl mx-auto">` → add `data-hero-visual`
- `<div class="hero-gradient">` → add `data-hero-gradient`

**Step 2: Add wavy underline draw-on animation**

In `globals.css`, update `.wavy-underline::after` to support stroke animation:

```css
.wavy-underline::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -4px;
  height: 8px;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 10'%3E%3Cpath d='M0 5 Q 12.5 0, 25 5 T 50 5 T 75 5 T 100 5' stroke='%23F97316' stroke-width='2' fill='none'/%3E%3C/svg%3E") repeat-x;
  background-size: 50px 8px;
  clip-path: inset(0 100% 0 0);
  transition: clip-path 0.8s ease-out;
}

.wavy-underline.revealed::after {
  clip-path: inset(0 0% 0 0);
}
```

In the Hero script, add after the timeline:

```javascript
// Reveal wavy underline after headline appears
tl.add(() => {
  document.querySelector('[data-hero-headline] .wavy-underline')?.classList.add('revealed');
}, "-=0.3");
```

**Step 3: Verify dev server**

Run: `cd apps/landing && pnpm dev`
Expected: Hero elements animate in sequentially on page load. Gradient blob drifts gently.

**Step 4: Commit**

```bash
git add apps/landing/src/components/sections/Hero.astro apps/landing/src/styles/globals.css
git commit -m "feat(landing): add hero entrance timeline and floating gradient"
```

---

### Task 3: Animate the Hero Product Demo (Before/After Visual)

**Files:**
- Modify: `apps/landing/src/components/sections/Hero.astro` (replace static before/after with animated demo)

**Step 1: Replace the static before/after with an animated product demo**

Replace the `<!-- Before/After Visual -->` block in Hero.astro with an animated SVG/CSS mockup:

The mockup should show:
1. A "video frame" (the before state) on the left
2. An arrow that pulses
3. A "enhanced frame" on the right where:
   - Bar chart bars grow upward with staggered timing
   - A PiP (picture-in-picture) thumbnail slides in from bottom-right
   - Subtitle text types in character by character

Add to the Hero `<script>` block — a sub-timeline that animates the product demo elements:

```javascript
// Product demo animation
const demoTl = gsap.timeline({
  scrollTrigger: {
    trigger: '[data-hero-visual]',
    start: "top 80%",
  },
  defaults: { ease: "power2.out" },
});

// Animate bar chart bars growing
demoTl.from('[data-demo-bar]', {
  scaleY: 0,
  transformOrigin: "bottom",
  duration: 0.6,
  stagger: 0.15,
}, "+=0.3");

// Slide in PiP
demoTl.from('[data-demo-pip]', {
  x: 20,
  y: 20,
  opacity: 0,
  duration: 0.4,
}, "-=0.2");

// Pulse the arrow
gsap.to('[data-demo-arrow]', {
  scale: 1.1,
  duration: 1.2,
  ease: "sine.inOut",
  repeat: -1,
  yoyo: true,
});
```

Add corresponding `data-demo-bar`, `data-demo-pip`, `data-demo-arrow` attributes to the Hero HTML elements:
- Each bar div in the chart → `data-demo-bar`
- The PiP div → `data-demo-pip`
- The arrow circle → `data-demo-arrow`

**Step 2: Verify**

Run: `cd apps/landing && pnpm dev`
Expected: Chart bars grow upward with stagger, PiP slides in, arrow pulses.

**Step 3: Commit**

```bash
git add apps/landing/src/components/sections/Hero.astro
git commit -m "feat(landing): add animated product demo in hero"
```

---

### Task 4: Animate the Stats Bar with Number Counters

**Files:**
- Modify: `apps/landing/src/components/sections/StatsBar.astro`

**Step 1: Add data attributes and counter animation**

Update the stats section:
- Add `data-animate="fade-up"` to the value proposition header grid
- Add `data-stats-bar` to the dark stats bar container
- Add `data-stat` to each stat column
- Add `data-counter` with `data-value` attributes to each number element (e.g., `data-counter data-value="4"`, `data-counter data-value="95"`, `data-counter data-value="15"`)
- Add `data-suffix` for units (e.g., `data-suffix="hrs"`, `data-suffix="%"`, `data-suffix="+"`)

Add inline script:

```astro
<script>
  import { gsap, ScrollTrigger } from "@/scripts/animations";

  document.addEventListener("astro:page-load", () => {
    const statsBar = document.querySelector('[data-stats-bar]');
    if (!statsBar) return;

    // Stagger stat cards in
    gsap.from(statsBar.querySelectorAll('[data-stat]'), {
      scrollTrigger: {
        trigger: statsBar,
        start: "top 85%",
      },
      y: 30,
      opacity: 0,
      duration: 0.6,
      stagger: 0.15,
      ease: "power2.out",
    });

    // Animate number counters
    statsBar.querySelectorAll('[data-counter]').forEach((el) => {
      const target = parseFloat(el.getAttribute('data-value') || '0');
      const suffix = el.getAttribute('data-suffix') || '';
      const obj = { val: 0 };

      gsap.to(obj, {
        val: target,
        duration: 1.5,
        ease: "power1.out",
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
        },
        onUpdate: () => {
          el.textContent = Math.round(obj.val) + suffix;
        },
      });
    });

    // Sparkle pulse
    gsap.to(statsBar.querySelectorAll('svg[viewBox="0 0 24 24"]'), {
      scale: 1.3,
      duration: 1,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
      stagger: 0.3,
    });
  });
</script>
```

Update the stat number elements. Replace each static text like `4hrs` with:

```html
<div class="text-3xl sm:text-4xl md:text-5xl font-semibold mb-1 sm:mb-2 tabular-nums" data-counter data-value="4" data-suffix="hrs">0hrs</div>
```

Similarly for `95%` → `data-value="95" data-suffix="%"` and `15+` → `data-value="15" data-suffix="+"`.

**Step 2: Add tabular-nums utility**

In `globals.css`, add:

```css
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
```

**Step 3: Verify**

Run: `cd apps/landing && pnpm dev`
Expected: Stats slide up with stagger, numbers count from 0 to target, sparkles pulse.

**Step 4: Commit**

```bash
git add apps/landing/src/components/sections/StatsBar.astro apps/landing/src/styles/globals.css
git commit -m "feat(landing): add animated number counters and stagger to stats bar"
```

---

### Task 5: Animate the Features Section

**Files:**
- Modify: `apps/landing/src/components/sections/Features.astro`

**Step 1: Add slide-in animations**

Add data attributes:
- Left column (product mockup): `data-animate="slide-left"`
- Right column (content): `data-animate="slide-right"`
- Feature list items: wrap them in a div with `data-animate="stagger"`

These will be picked up automatically by the shared `initAllAnimations()`.

**Step 2: Add animated mockup elements**

For the flowchart mockup inside Features, add `data-feature-flow` to the flowchart container and `data-flow-step` to each step div. Add an inline script:

```astro
<script>
  import { gsap, ScrollTrigger } from "@/scripts/animations";

  document.addEventListener("astro:page-load", () => {
    const flow = document.querySelector('[data-feature-flow]');
    if (!flow) return;

    gsap.from(flow.querySelectorAll('[data-flow-step]'), {
      scrollTrigger: {
        trigger: flow,
        start: "top 80%",
      },
      y: 15,
      opacity: 0,
      duration: 0.5,
      stagger: 0.2,
      ease: "power2.out",
    });
  });
</script>
```

Add data attributes:
- Flowchart wrapper div → `data-feature-flow`
- Each "Step N" div → `data-flow-step`

**Step 3: Verify**

Run: `cd apps/landing && pnpm dev`
Expected: Mockup slides in from left, content slides in from right, flowchart steps appear sequentially, feature bullets stagger in.

**Step 4: Commit**

```bash
git add apps/landing/src/components/sections/Features.astro
git commit -m "feat(landing): add slide-in and stagger animations to features section"
```

---

### Task 6: Animate How It Works Section with Connecting Line

**Files:**
- Modify: `apps/landing/src/components/sections/HowItWorks.astro`

**Step 1: Add section header animation**

Add `data-animate="fade-up"` to the header container div.

**Step 2: Add connecting SVG line between steps**

Add an SVG path element between the step cards (visible on md+ screens). This horizontal line connects the three cards:

```html
<!-- Connecting line (desktop only) -->
<svg class="hidden md:block absolute top-1/3 left-[16%] w-[68%] h-2 overflow-visible" data-connect-line preserveAspectRatio="none">
  <line x1="0" y1="4" x2="100%" y2="4" stroke="#F97316" stroke-width="2" stroke-dasharray="8 4" />
</svg>
```

The steps grid needs `relative` positioning for the SVG overlay.

**Step 3: Add step card animations with inline script**

```astro
<script>
  import { gsap, ScrollTrigger } from "@/scripts/animations";

  document.addEventListener("astro:page-load", () => {
    const section = document.querySelector('[data-hiw-section]');
    if (!section) return;

    // Animate connecting line drawing
    const line = section.querySelector('[data-connect-line] line');
    if (line) {
      const length = 1000; // approximate
      gsap.set(line, { strokeDasharray: length, strokeDashoffset: length });
      gsap.to(line, {
        strokeDashoffset: 0,
        duration: 1.5,
        ease: "power1.inOut",
        scrollTrigger: {
          trigger: section,
          start: "top 70%",
        },
      });
    }

    // Stagger step cards with scale
    gsap.from(section.querySelectorAll('[data-hiw-card]'), {
      scrollTrigger: {
        trigger: section,
        start: "top 75%",
      },
      scale: 0.9,
      opacity: 0,
      y: 30,
      duration: 0.6,
      stagger: 0.2,
      ease: "back.out(1.2)",
    });
  });
</script>
```

Add data attributes:
- Section element → `data-hiw-section`
- Each step card → `data-hiw-card`

**Step 4: Verify**

Run: `cd apps/landing && pnpm dev`
Expected: Connecting line draws itself, step cards pop in sequentially with slight scale bounce.

**Step 5: Commit**

```bash
git add apps/landing/src/components/sections/HowItWorks.astro
git commit -m "feat(landing): add connecting line and stagger animations to how-it-works"
```

---

### Task 7: Animate the Testimonials Section

**Files:**
- Modify: `apps/landing/src/components/sections/Testimonials.astro`

**Step 1: Add scroll-triggered animations**

Add data attributes:
- Section heading → `data-animate="fade-up"`
- Avatar row container → `data-testimonial-avatars`
- Blockquote → `data-testimonial-quote`
- Author info → `data-testimonial-author`

Add inline script:

```astro
<script>
  import { gsap, ScrollTrigger } from "@/scripts/animations";

  document.addEventListener("astro:page-load", () => {
    const section = document.querySelector('[data-testimonial-section]');
    if (!section) return;

    // Stagger avatars in
    const avatars = section.querySelectorAll('[data-testimonial-avatars] > div');
    gsap.from(avatars, {
      scrollTrigger: {
        trigger: section,
        start: "top 80%",
      },
      scale: 0,
      opacity: 0,
      duration: 0.4,
      stagger: 0.08,
      ease: "back.out(2)",
    });

    // Quote fade in with slight rotation (card deal effect)
    gsap.from('[data-testimonial-quote]', {
      scrollTrigger: {
        trigger: '[data-testimonial-quote]',
        start: "top 85%",
      },
      y: 30,
      opacity: 0,
      rotation: -1,
      duration: 0.7,
      ease: "power2.out",
    });

    // Author info slide up
    gsap.from('[data-testimonial-author]', {
      scrollTrigger: {
        trigger: '[data-testimonial-author]',
        start: "top 90%",
      },
      y: 20,
      opacity: 0,
      duration: 0.5,
      ease: "power2.out",
    });
  });
</script>
```

Add `data-testimonial-section` to the `<section>` tag.

**Step 2: Verify**

Run: `cd apps/landing && pnpm dev`
Expected: Avatars pop in with bounce stagger, quote slides in with subtle rotation, author fades up.

**Step 3: Commit**

```bash
git add apps/landing/src/components/sections/Testimonials.astro
git commit -m "feat(landing): add testimonial entrance animations"
```

---

### Task 8: Animate the Blog Section

**Files:**
- Modify: `apps/landing/src/components/sections/Blog.astro`

**Step 1: Add animations**

Add data attributes:
- Section header → `data-animate="fade-up"`
- Blog cards container (the flex/grid div) → `data-animate="stagger"`

These are picked up by the shared animation system — no custom script needed.

**Step 2: Add hover micro-interaction enhancement**

In `globals.css`, enhance the blog card hover:

```css
.blog-card {
  background: white;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.blog-card:hover {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  transform: translateY(-4px);
}
```

**Step 3: Verify**

Run: `cd apps/landing && pnpm dev`
Expected: Blog section header fades up, cards stagger in, cards lift on hover.

**Step 4: Commit**

```bash
git add apps/landing/src/components/sections/Blog.astro apps/landing/src/styles/globals.css
git commit -m "feat(landing): add blog section animations and hover micro-interactions"
```

---

### Task 9: Animate the CTA Section

**Files:**
- Modify: `apps/landing/src/components/sections/CTA.astro`

**Step 1: Add blur-to-sharp and glow animations**

Add data attributes:
- The dark card container → `data-cta-card`
- The h2 → `data-cta-heading`
- The p → `data-cta-text`
- The CTA button → `data-cta-button`
- Each decorative dot → `data-cta-dot`

Add inline script:

```astro
<script>
  import { gsap, ScrollTrigger } from "@/scripts/animations";

  document.addEventListener("astro:page-load", () => {
    const card = document.querySelector('[data-cta-card]');
    if (!card) return;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: card,
        start: "top 80%",
      },
      defaults: { ease: "power2.out" },
    });

    // Card scale in
    tl.from(card, { scale: 0.95, opacity: 0, duration: 0.6 });

    // Heading blur-to-sharp
    tl.from('[data-cta-heading]', {
      y: 20,
      opacity: 0,
      filter: "blur(8px)",
      duration: 0.6,
    }, "-=0.3");

    // Text
    tl.from('[data-cta-text]', {
      y: 15,
      opacity: 0,
      filter: "blur(4px)",
      duration: 0.5,
    }, "-=0.3");

    // Button
    tl.from('[data-cta-button]', {
      y: 15,
      opacity: 0,
      duration: 0.5,
    }, "-=0.2");

    // Decorative dots float
    gsap.to('[data-cta-dot]', {
      y: -8,
      duration: 2,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
      stagger: 0.5,
    });

    // Button glow pulse
    gsap.to('[data-cta-button]', {
      boxShadow: "0 0 20px rgba(249, 115, 22, 0.4)",
      duration: 1.5,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
    });
  });
</script>
```

**Step 2: Verify**

Run: `cd apps/landing && pnpm dev`
Expected: CTA card scales in, heading/text blur-to-sharp, button has persistent glow pulse, dots float.

**Step 3: Commit**

```bash
git add apps/landing/src/components/sections/CTA.astro
git commit -m "feat(landing): add CTA blur-to-sharp entrance and glow animations"
```

---

### Task 10: Add Header Scroll Effect

**Files:**
- Modify: `apps/landing/src/components/layout/Header.astro`

**Step 1: Add scroll-triggered header shadow**

Add to the existing script in Header.astro:

```javascript
// Header shadow on scroll
const header = document.querySelector('header');
if (header) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 10) {
      header.classList.add('header-scrolled');
    } else {
      header.classList.remove('header-scrolled');
    }
  }, { passive: true });
}
```

In `globals.css`, add:

```css
header {
  transition: box-shadow 0.3s ease, background-color 0.3s ease;
}

.header-scrolled {
  box-shadow: 0 1px 12px rgba(0, 0, 0, 0.06);
}
```

**Step 2: Verify**

Run: `cd apps/landing && pnpm dev`
Expected: Header gains subtle shadow when scrolling down, removes on scroll to top.

**Step 3: Commit**

```bash
git add apps/landing/src/components/layout/Header.astro apps/landing/src/styles/globals.css
git commit -m "feat(landing): add header scroll shadow effect"
```

---

### Task 11: Final Polish — Mobile Optimization and Reduced Motion

**Files:**
- Modify: `apps/landing/src/scripts/animations.ts`
- Modify: `apps/landing/src/styles/globals.css`

**Step 1: Add mobile-specific animation tuning**

In `animations.ts`, update the shared defaults to be responsive:

```typescript
// Mobile-friendly defaults
const isMobile = window.innerWidth < 768;

const DEFAULTS = {
  duration: isMobile ? 0.5 : 0.7,
  ease: "power2.out",
  y: isMobile ? 30 : 50,
  stagger: isMobile ? 0.08 : 0.12,
};
```

**Step 2: Add reduced-motion CSS fallback**

In `globals.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Step 3: Full page walkthrough**

Run: `cd apps/landing && pnpm dev`
Test:
1. Full page scroll — all sections animate in smoothly
2. Resize to mobile — animations are simpler/faster
3. Browser devtools → Rendering → check "prefers-reduced-motion" → reload — no animations

**Step 4: Build check**

Run: `cd apps/landing && pnpm build`
Expected: Clean build, no errors.

**Step 5: Commit**

```bash
git add apps/landing/src/scripts/animations.ts apps/landing/src/styles/globals.css
git commit -m "feat(landing): add mobile optimization and reduced-motion support"
```

---

### Task 12: Final Review and Cleanup

**Files:**
- All modified files in `apps/landing/`

**Step 1: Run build**

Run: `cd apps/landing && pnpm build`
Expected: Clean build.

**Step 2: Visual review**

Run: `cd apps/landing && pnpm preview`
Walk through the entire page and verify:
- [ ] Hero: Elements animate in on load, gradient drifts, wavy underline draws
- [ ] Hero demo: Bars grow, PiP slides, arrow pulses
- [ ] Stats: Numbers count up, stats stagger in, sparkles pulse
- [ ] Features: Slides in from alternating sides, flowchart builds
- [ ] How it Works: Line draws, cards pop in with bounce
- [ ] Testimonials: Avatars bounce in, quote rotates in
- [ ] Blog: Cards stagger in, hover lift works
- [ ] CTA: Blur-to-sharp, button glows, dots float
- [ ] Header: Shadow appears on scroll
- [ ] Mobile: Simpler animations, no jank
- [ ] Reduced motion: No animations

**Step 3: Final commit if any tweaks needed**

```bash
git add -A apps/landing/
git commit -m "feat(landing): polish and finalize motion graphics"
```
