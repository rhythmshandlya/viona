# Landing Redesign: Human-Feel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Viona landing page from generic AI aesthetic to editorial/creator-focused, fixing every AI-generated tell.

**Architecture:** Pure Astro + CSS changes. No new dependencies except one Google Font (DM Serif Display). No component restructuring — each task edits one file at a time. Changes are purely presentational.

**Tech Stack:** Astro, Tailwind CSS v4 (`@import "tailwindcss"` style), GSAP, `apps/landing/` workspace.

**Dev command:** `cd apps/landing && npm run dev` (runs on localhost:4321)

---

## Task 1: Add DM Serif Display font + fix background color

**Files:**
- Modify: `apps/landing/src/layouts/BaseLayout.astro`
- Modify: `apps/landing/src/styles/globals.css`

**Step 1: Add DM Serif Display to `BaseLayout.astro`**

Find the existing DM Sans `<link>` tag (line 28) and replace it with a combined link that loads both fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet" />
```

**Step 2: Update `globals.css` — add serif font var + fix background**

In the `@theme inline` block, add the serif font variable after `--font-sans`:

```css
--font-serif: "DM Serif Display", Georgia, serif;
```

Change background from `#FAFAFF` to `#ffffff`:

```css
--color-background: #ffffff;
```

**Step 3: Add utility class for serif headlines at bottom of `globals.css`**

```css
/* Serif display headlines */
.font-serif {
  font-family: var(--font-serif);
  font-weight: 400;
  letter-spacing: -0.02em;
}
```

**Step 4: Verify**

Run `cd apps/landing && npm run dev`, open localhost:4321. Background should be pure white (was slightly purple). No visual font change yet since no elements use `.font-serif` yet.

**Step 5: Commit**

```bash
git add apps/landing/src/layouts/BaseLayout.astro apps/landing/src/styles/globals.css
git commit -m "feat(landing): add DM Serif Display font, fix background to pure white"
```

---

## Task 2: Rewrite Hero section

**Files:**
- Modify: `apps/landing/src/components/sections/Hero.astro`

**Goal:** Replace the abstract before/after placeholder (SVG person icon + gray box) and Three.js canvas with a left-aligned editorial layout: headline on the left, real product video in a phone frame on the right.

**Step 1: Replace the entire `Hero.astro` with this:**

```astro
---
// No imports needed
---

<section class="relative pt-24 pb-12 sm:pt-28 sm:pb-16 lg:pt-32 lg:pb-20 overflow-hidden">
  <div class="max-w-6xl mx-auto px-4 sm:px-6">
    <div class="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

      <!-- Left: editorial copy + form -->
      <div class="flex-1 text-center lg:text-left" data-hero-copy>
        <!-- Tagline badge -->
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-white text-xs mb-6 sm:mb-8" data-hero-badge>
          <span class="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
          <span class="text-muted-foreground">For explainer videos &amp; courses</span>
        </div>

        <!-- Headline -->
        <h1 class="font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.1] mb-4 sm:mb-6" data-hero-headline>
          Your audience is leaving<br />
          in the first 30 seconds.
          <br />
          <em class="not-italic text-primary">Here's how to keep them.</em>
        </h1>

        <!-- Subheadline -->
        <p class="text-muted-foreground text-base sm:text-lg max-w-lg mx-auto lg:mx-0 mb-8 sm:mb-10" data-hero-sub>
          Upload your talking-head video. Viona generates charts, diagrams, and visuals
          synced to your words — automatically.
        </p>

        <!-- Waitlist Form -->
        <div class="flex flex-col items-center lg:items-start" data-hero-cta>
          <form id="waitlist-form" class="email-input-group w-full max-w-md">
            <input
              type="email"
              id="waitlist-email"
              placeholder="Enter your email"
              required
              autocomplete="email"
            />
            <button type="submit" id="waitlist-btn">
              Join Waitlist
            </button>
          </form>
          <div id="waitlist-success" class="hidden text-sm font-medium text-primary mt-3">
            You're on the list!
          </div>
          <div id="waitlist-error" class="hidden text-sm text-red-500 mt-3"></div>
          <p class="text-xs text-muted-foreground mt-3" id="waitlist-counter" style="visibility: hidden;">
            <span id="waitlist-count" class="font-semibold text-foreground tabular-nums">0</span>
            creators on the waitlist
          </p>
        </div>
      </div>

      <!-- Right: product video in phone frame -->
      <div class="flex-shrink-0 w-[220px] sm:w-[260px] lg:w-[280px]" data-hero-visual>
        <div class="hero-phone">
          <video
            src="/assets/sample-output.mp4"
            poster="/assets/sample-output-poster.jpg"
            autoplay
            loop
            muted
            playsinline
            class="w-full h-full object-cover"
          ></video>
        </div>
      </div>

    </div>
  </div>
</section>

<style>
  .hero-phone {
    aspect-ratio: 9 / 16;
    border-radius: 28px;
    overflow: hidden;
    background: #1a1a1a;
    box-shadow:
      0 0 0 8px #1a1a1a,
      0 0 0 9px rgba(255,255,255,0.08),
      0 32px 80px rgba(0,0,0,0.25),
      0 8px 24px rgba(0,0,0,0.15);
  }
</style>

<script>
  import { gsap } from "@/scripts/animations";

  const API_URL = import.meta.env.PUBLIC_API_URL || "https://api-production-18ab.up.railway.app";

  document.addEventListener("astro:page-load", () => {
    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

    tl.from('[data-hero-badge]', { y: 16, opacity: 0, duration: 0.4 })
      .from('[data-hero-headline]', { y: 24, opacity: 0, duration: 0.5 }, "-=0.2")
      .from('[data-hero-sub]', { y: 16, opacity: 0, duration: 0.4 }, "-=0.2")
      .from('[data-hero-cta]', { y: 16, opacity: 0, duration: 0.4 }, "-=0.2")
      .from('[data-hero-visual]', { x: 24, opacity: 0, duration: 0.6 }, "-=0.5");

    // --- Waitlist ---
    const form = document.getElementById("waitlist-form") as HTMLFormElement | null;
    const emailInput = document.getElementById("waitlist-email") as HTMLInputElement | null;
    const btn = document.getElementById("waitlist-btn") as HTMLButtonElement | null;
    const successEl = document.getElementById("waitlist-success");
    const errorEl = document.getElementById("waitlist-error");
    const counterEl = document.getElementById("waitlist-counter");
    const countEl = document.getElementById("waitlist-count");

    fetch(`${API_URL}/api/waitlist/count`, { signal: AbortSignal.timeout(5000) })
      .then((r) => r.json())
      .then((data) => {
        if (data.count != null && countEl && counterEl) {
          animateCount(0, data.count, countEl);
          counterEl.style.visibility = "visible";
        }
      })
      .catch(() => {});

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!emailInput || !btn) return;
      const email = emailInput.value.trim();
      if (!email) return;
      btn.disabled = true;
      btn.textContent = "Joining...";
      errorEl?.classList.add("hidden");
      try {
        const res = await fetch(`${API_URL}/api/waitlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
          signal: AbortSignal.timeout(10000),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Something went wrong");
        form.classList.add("hidden");
        successEl?.classList.remove("hidden");
        if (data.count != null && countEl && counterEl) {
          const current = parseInt(countEl.textContent || "0", 10);
          animateCount(current, data.count, countEl);
          counterEl.style.visibility = "visible";
        }
      } catch (err: any) {
        if (errorEl) {
          errorEl.textContent = err.message || "Something went wrong. Please try again.";
          errorEl.classList.remove("hidden");
        }
        btn.disabled = false;
        btn.textContent = "Join Waitlist";
      }
    });

    function animateCount(from: number, to: number, el: HTMLElement) {
      const obj = { val: from };
      gsap.to(obj, {
        val: to, duration: 1, ease: "power2.out",
        onUpdate: () => { el.textContent = Math.round(obj.val).toLocaleString(); },
      });
    }
  });
</script>
```

**Step 2: Verify**

`npm run dev` — hero should show editorial headline on the left, the product video in a phone frame on the right. No Three.js canvas, no blob, no person icon.

**Step 3: Commit**

```bash
git add apps/landing/src/components/sections/Hero.astro
git commit -m "feat(landing): editorial hero — serif headline, product video phone frame"
```

---

## Task 3: Fix Features section

**Files:**
- Modify: `apps/landing/src/components/sections/Features.astro`

**Goal:** Rewrite headline to editorial voice. Replace the SVG person icon in the "Before" state with a realistic messy-transcript look. Replace the 3-checkbox feature list with a short narrative paragraph + app screenshot.

**Step 1: Change the section headline (line 78)**

Find:
```astro
<h2 class="text-2xl sm:text-3xl lg:text-4xl font-semibold leading-tight mb-4 sm:mb-6">
  <span class="text-brand">AI-Generated</span> Visuals
  <br />That Match Your
  <br /><span class="accent-underline">Explanations</span>
</h2>
```

Replace with:
```astro
<h2 class="font-serif text-2xl sm:text-3xl lg:text-4xl leading-tight mb-4 sm:mb-6">
  Your viewers don't learn<br />from talking heads.
  <br /><em class="not-italic text-primary">They learn from visuals.</em>
</h2>
```

**Step 2: Replace the Before state placeholder (lines 22–38)**

Find the `reveal-placeholder` div containing the SVG person and filler words:
```html
<div class="reveal-placeholder">
  <svg class="reveal-person" viewBox="0 0 80 100" fill="none">
    ...
  </svg>
  <div class="reveal-filler-words">
    <span>um</span>
    <span>so like</span>
    <span>you know</span>
  </div>
</div>
```

Replace with:
```html
<div class="reveal-placeholder">
  <div class="reveal-transcript">
    <div class="reveal-transcript-line">
      <span class="rt-word rt-filler">um</span>
      <span class="rt-word">so</span>
      <span class="rt-word">today</span>
      <span class="rt-word">we'll</span>
    </div>
    <div class="reveal-transcript-line">
      <span class="rt-word rt-filler">uh</span>
      <span class="rt-word">talk</span>
      <span class="rt-word">about</span>
      <span class="rt-word rt-filler">like</span>
    </div>
    <div class="reveal-transcript-line">
      <span class="rt-word">the</span>
      <span class="rt-word">growth</span>
      <span class="rt-word">rate</span>
      <span class="rt-word rt-filler">basically</span>
    </div>
    <div class="reveal-transcript-line">
      <span class="rt-word rt-filler">you know</span>
      <span class="rt-word">of</span>
      <span class="rt-word">our</span>
    </div>
  </div>
</div>
```

**Step 3: Replace the feature list + paragraph (lines 83–123)**

Find the `<p>` and `<div class="space-y-3...">` feature checklist + CTA block and replace with:
```astro
<p class="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8 leading-relaxed">
  Most talking-head videos lose viewers in the first 30 seconds — not because the
  content is bad, but because there's nothing to look at. Viona listens to your
  explanation and generates the exact visual that belongs there: a chart when you cite
  a stat, a diagram when you describe a process, a comparison when you contrast two ideas.
</p>

<ul class="space-y-2 mb-6 sm:mb-8 text-sm sm:text-base">
  <li class="flex items-start gap-3">
    <span class="text-primary font-semibold mt-0.5">→</span>
    <span>Flowcharts, timelines, stat cards, comparisons — picked automatically</span>
  </li>
  <li class="flex items-start gap-3">
    <span class="text-primary font-semibold mt-0.5">→</span>
    <span>Filler words removed before you even see the transcript</span>
  </li>
  <li class="flex items-start gap-3">
    <span class="text-primary font-semibold mt-0.5">→</span>
    <span>Edit any visual with a single sentence — the AI regenerates it</span>
  </li>
</ul>

<a href="#waitlist-form" class="btn-primary">
  Join Waitlist
  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
  </svg>
</a>
```

**Step 4: Add CSS for the transcript placeholder — add to the `<style>` block in Features.astro**

```css
/* ── Transcript placeholder (Before state) ── */
.reveal-placeholder {
  background: linear-gradient(180deg, #f5f5f5 0%, #ebebeb 100%);
  align-items: flex-start;
  padding: 20px 16px;
}

.reveal-transcript {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reveal-transcript-line {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.rt-word {
  font-size: 11px;
  font-weight: 500;
  color: #555;
  padding: 2px 6px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.06);
}

.rt-filler {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
  text-decoration: line-through;
}
```

**Step 5: Verify**

The "Before" state of the phone should now show a messy transcript with red struck-through filler words. The feature section copy should read as a story, not a checkbox list.

**Step 6: Commit**

```bash
git add apps/landing/src/components/sections/Features.astro
git commit -m "feat(landing): editorial features — narrative copy, transcript before-state"
```

---

## Task 4: Simplify HowItWorks section

**Files:**
- Modify: `apps/landing/src/components/sections/HowItWorks.astro`

**Goal:** Remove the toy white-card mini-UI illustrations and the dashed SVG connector line. Replace with cleaner numbered steps. Add a real screenshot below.

**Step 1: Replace the entire file with this:**

```astro
---
const steps = [
  {
    number: "1",
    title: "Upload your video",
    description: "Drop in your talking-head footage. MP4, MOV, or WebM — up to 60 minutes.",
  },
  {
    number: "2",
    title: "AI does the work",
    description: "We transcribe, strip filler words, and generate visuals synced to your narration.",
  },
  {
    number: "3",
    title: "Review and ship",
    description: "Accept the visuals, tweak anything with a sentence, style your captions, export.",
  },
];
---

<section id="how-it-works" class="py-12 sm:py-16 lg:py-20">
  <div class="max-w-6xl mx-auto px-4 sm:px-6">
    <!-- Header -->
    <div class="text-center mb-10 sm:mb-14">
      <h2 class="font-serif text-2xl sm:text-3xl lg:text-4xl leading-tight">
        From raw footage to<br />
        <em class="not-italic text-primary">polished explainer</em>
      </h2>
      <p class="text-sm sm:text-base text-muted-foreground mt-3 max-w-lg mx-auto">
        No editing skills required.
      </p>
    </div>

    <!-- Steps -->
    <div class="grid sm:grid-cols-3 gap-6 sm:gap-8 mb-10 sm:mb-14">
      {steps.map((step) => (
        <div class="hiw-step">
          <div class="hiw-number">{step.number}</div>
          <h3 class="text-base sm:text-lg font-semibold mb-2">{step.title}</h3>
          <p class="text-sm text-muted-foreground">{step.description}</p>
        </div>
      ))}
    </div>

    <!-- Real product screenshot -->
    <div class="hiw-screenshot-wrap">
      <div class="hiw-screenshot-chrome">
        <div class="hiw-chrome-dots">
          <span></span><span></span><span></span>
        </div>
        <div class="hiw-chrome-url">studio.viona.app</div>
        <div class="hiw-chrome-dots" style="visibility:hidden">
          <span></span><span></span><span></span>
        </div>
      </div>
      <img
        src="/assets/screenshots/editor-chat.png"
        alt="Viona editor showing AI chat, video preview, and timeline"
        class="w-full block"
        loading="lazy"
        decoding="async"
      />
    </div>
  </div>
</section>

<style>
  .hiw-step {
    background: white;
    border-radius: 1rem;
    padding: 1.5rem;
    border: 1px solid var(--color-border);
  }

  .hiw-number {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--color-primary);
    color: white;
    font-weight: 600;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .hiw-screenshot-wrap {
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid rgba(0,0,0,0.08);
    box-shadow: 0 8px 40px rgba(0,0,0,0.1);
  }

  .hiw-screenshot-chrome {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: #1f1f23;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }

  .hiw-chrome-dots {
    display: flex;
    gap: 5px;
    flex-shrink: 0;
  }

  .hiw-chrome-dots span {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .hiw-chrome-dots span:nth-child(1) { background: #ff5f57; }
  .hiw-chrome-dots span:nth-child(2) { background: #ffbd2e; }
  .hiw-chrome-dots span:nth-child(3) { background: #28c840; }

  .hiw-chrome-url {
    font-size: 11px;
    color: rgba(255,255,255,0.3);
    background: rgba(255,255,255,0.05);
    border-radius: 5px;
    padding: 3px 14px;
  }
</style>
```

**Step 2: Verify**

Three clean numbered cards, no toy mockups, no dashed SVG line. Below: a macOS-chrome screenshot of the editor.

**Step 3: Commit**

```bash
git add apps/landing/src/components/sections/HowItWorks.astro
git commit -m "feat(landing): how-it-works — remove toy mockups, add real screenshot"
```

---

## Task 5: Fix Testimonials — remove stars, rewrite quotes, Twitter-style cards

**Files:**
- Modify: `apps/landing/src/data/testimonials.ts`
- Modify: `apps/landing/src/components/sections/Testimonials.astro`

**Step 1: Replace the testimonials array in `testimonials.ts`**

Replace the entire `testimonials` array export with these 3 entries (keep the `faqs` export untouched):

```typescript
export const testimonials: Testimonial[] = [
  {
    quote: "I used to spend 4 hours editing each video. Now I upload, review the AI visuals, and export in 20 minutes. My engagement went up 40% in the first month.",
    author: "James Park",
    role: "Course creator",
    company: "180K subscribers",
    color: "#7C3AED",
    featured: true,
  },
  {
    quote: "The AI generates diagrams that actually match what I'm explaining — not generic stock. My students say the videos are finally clear.",
    author: "Dr. Lisa Chen",
    role: "EdTech founder",
    company: "MedLearn Pro",
    color: "#2563EB",
    featured: true,
  },
  {
    quote: "We produce 30+ explainer videos a month. Viona cut our production time in half. The AI chat editor is the feature I didn't know I needed.",
    author: "Marcus Webb",
    role: "Creative director",
    company: "Explainer Studio",
    color: "#059669",
    featured: true,
  },
];
```

Note: also add a `handle` field to the `Testimonial` interface:

```typescript
export interface Testimonial {
  quote: string;
  author: string;
  handle?: string;
  role: string;
  company: string;
  color: string;
  featured?: boolean;
}
```

And add `handle` values to each testimonial:

```typescript
{ handle: "@jamespark_edu", ... }
{ handle: "@drlichenmd", ... }
{ handle: "@marcuswebb_vid", ... }
```

**Step 2: Rewrite `Testimonials.astro`**

Replace the entire component with:

```astro
---
import { testimonials } from "@/data/testimonials";

const cards = testimonials.filter((t) => t.featured);
---

<section class="py-12 sm:py-16 lg:py-24 bg-dark text-white">
  <div class="max-w-5xl mx-auto px-4 sm:px-6">
    <!-- Header -->
    <div class="mb-10 sm:mb-14">
      <p class="text-sm font-medium text-primary mb-3 tracking-wide uppercase">From the waitlist</p>
      <h2 class="font-serif text-2xl sm:text-3xl lg:text-4xl">
        Creators who've tried it
      </h2>
    </div>

    <!-- Cards -->
    <div class="grid md:grid-cols-3 gap-4 sm:gap-6">
      {cards.map((t) => (
        <div class="testi-card">
          <!-- Author row -->
          <div class="flex items-center gap-3 mb-4">
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
              style={`background-color: ${t.color}`}
            >
              {t.author.split(' ').map((n: string) => n[0]).join('')}
            </div>
            <div>
              <div class="font-semibold text-sm">{t.author}</div>
              <div class="text-xs text-white/40">{t.handle} · {t.role}</div>
            </div>
          </div>

          <!-- Quote -->
          <blockquote class="text-sm text-white/70 leading-relaxed">
            "{t.quote}"
          </blockquote>
        </div>
      ))}
    </div>
  </div>
</section>

<style>
  .testi-card {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px;
    padding: 1.25rem 1.5rem;
  }
</style>
```

**Step 3: Verify**

3 cards, no stars, Twitter-style author line with handle + role.

**Step 4: Commit**

```bash
git add apps/landing/src/data/testimonials.ts apps/landing/src/components/sections/Testimonials.astro
git commit -m "feat(landing): testimonials — 3 cards, no stars, Twitter-style, rewritten quotes"
```

---

## Task 6: Replace Pricing with Early Access block

**Files:**
- Modify: `apps/landing/src/components/sections/Pricing.astro`

**Goal:** The product is pre-launch. Replace the 3-tier pricing grid with a single focused "Early Access" block.

**Step 1: Replace the entire `Pricing.astro` with:**

```astro
---
---

<section id="pricing" class="py-16 sm:py-20 lg:py-28 bg-muted">
  <div class="max-w-3xl mx-auto px-4 sm:px-6 text-center">
    <p class="text-sm font-medium text-primary mb-3 tracking-wide uppercase">Pricing</p>
    <h2 class="font-serif text-3xl sm:text-4xl lg:text-5xl mb-4">
      Free while in beta.
    </h2>
    <p class="text-muted-foreground text-base sm:text-lg mb-8 max-w-md mx-auto">
      No credit card. No commitment. Join the waitlist and get early access when we launch.
    </p>

    <a href="#waitlist-form" class="btn-primary text-base !py-3 !px-8">
      Join the Waitlist
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
      </svg>
    </a>
  </div>
</section>
```

**Step 2: Verify**

Single centered block with "Free while in beta" headline and waitlist CTA. The 3-tier pricing grid is gone.

**Step 3: Commit**

```bash
git add apps/landing/src/components/sections/Pricing.astro
git commit -m "feat(landing): replace pricing grid with early access block"
```

---

## Task 7: Final pass — open ngrok and review

**Step 1: Start dev server**

```bash
cd apps/landing && npm run dev
```

**Step 2: In a separate terminal, start ngrok**

```bash
ngrok http 4321
```

ngrok will print a public URL like `https://xxxx.ngrok-free.app`. Open it in a browser to review the full page on real network conditions.

**Step 3: Check each section**

- Hero: serif headline left-aligned, phone with video on right
- Features: narrative copy, transcript before-state in phone
- HowItWorks: 3 clean steps, screenshot below (no toy mockups)
- AppShowcase: unchanged (still looks good)
- Testimonials: 3 cards, no stars
- Pricing: single "Free while in beta" CTA

**Step 4: Final commit if any small tweaks were needed, then done.**
