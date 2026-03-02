# Templates App UX Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the templates web app from a generic dev-tool feel into a premium, consumer-grade template browser matching the main Viona app's design language.

**Architecture:** Update CSS tokens to match `apps/web/src/app/globals.css`, add animation system (fadeInUp, stagger delays), then rewrite each component with larger cards, polished hover states, premium micro-interactions, and consistent typography. No data model changes — purely UI/UX.

**Tech Stack:** Next.js 15, Tailwind CSS 4, Remotion Player/Thumbnail, Lucide React icons, Inter font

---

### Task 1: Align Global CSS Tokens with Main App

**Files:**
- Modify: `apps/templates/src/app/globals.css`

**Step 1: Replace globals.css with main-app-aligned tokens**

Replace the entire `globals.css` with tokens matching `apps/web/src/app/globals.css`:

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: var(--font-inter), system-ui, sans-serif;
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-destructive: var(--destructive);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --shadow-2xs: var(--shadow-2xs);
  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow: var(--shadow);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
  --shadow-2xl: var(--shadow-2xl);
}

:root {
  --radius: 0.5rem;
  --background: #FAFAFF;
  --foreground: #1a1a1a;
  --card: #ffffff;
  --card-foreground: #1a1a1a;
  --primary: #7C3AED;
  --primary-foreground: #ffffff;
  --secondary: #f3f2f8;
  --secondary-foreground: #1a1a1a;
  --muted: #f3f2f8;
  --muted-foreground: #6b7280;
  --accent: #EDE9FE;
  --accent-foreground: #1a1a1a;
  --destructive: #ef4444;
  --border: #e5e5e5;
  --input: #f3f2f8;
  --ring: #7C3AED;

  --shadow-2xs: 0px 1px 3px 0px hsl(0 0% 0% / 0.06);
  --shadow-xs: 0px 1px 3px 0px hsl(0 0% 0% / 0.06);
  --shadow-sm: 0px 1px 3px 0px hsl(0 0% 0% / 0.08), 0px 1px 2px -1px hsl(0 0% 0% / 0.08);
  --shadow: 0px 4px 24px 0px hsl(0 0% 0% / 0.06);
  --shadow-md: 0px 1px 3px 0px hsl(0 0% 0% / 0.08), 0px 2px 4px -1px hsl(0 0% 0% / 0.08);
  --shadow-lg: 0px 4px 24px 0px hsl(0 0% 0% / 0.06);
  --shadow-xl: 0px 8px 32px 0px hsl(0 0% 0% / 0.1);
  --shadow-2xl: 0px 1px 3px 0px hsl(0 0% 0% / 0.25);
}

.dark {
  --background: #0A0A0A;
  --foreground: #FAFAFA;
  --card: #111111;
  --card-foreground: #FAFAFA;
  --primary: #7C3AED;
  --primary-foreground: #ffffff;
  --secondary: #1F1F1F;
  --secondary-foreground: #FAFAFA;
  --muted: #191919;
  --muted-foreground: #A1A1A1;
  --accent: #1F1F1F;
  --accent-foreground: #FAFAFA;
  --destructive: #dc2626;
  --border: #2A2A2A;
  --input: #1F1F1F;
  --ring: #7C3AED;

  --shadow-2xs: 0px 1px 3px 0px hsl(0 0% 0% / 0.2);
  --shadow-xs: 0px 1px 3px 0px hsl(0 0% 0% / 0.2);
  --shadow-sm: 0px 1px 3px 0px hsl(0 0% 0% / 0.3), 0px 1px 2px -1px hsl(0 0% 0% / 0.3);
  --shadow: 0px 1px 3px 0px hsl(0 0% 0% / 0.3), 0px 1px 2px -1px hsl(0 0% 0% / 0.3);
  --shadow-md: 0px 1px 3px 0px hsl(0 0% 0% / 0.3), 0px 2px 4px -1px hsl(0 0% 0% / 0.3);
  --shadow-lg: 0px 1px 3px 0px hsl(0 0% 0% / 0.3), 0px 4px 6px -1px hsl(0 0% 0% / 0.3);
  --shadow-xl: 0px 1px 3px 0px hsl(0 0% 0% / 0.3), 0px 8px 10px -1px hsl(0 0% 0% / 0.3);
  --shadow-2xl: 0px 1px 3px 0px hsl(0 0% 0% / 0.5);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}

/* Staggered fade-in animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fadeInUp 0.4s ease-out forwards;
  opacity: 0;
}

.stagger-1 { animation-delay: 50ms; }
.stagger-2 { animation-delay: 100ms; }
.stagger-3 { animation-delay: 150ms; }
.stagger-4 { animation-delay: 200ms; }
.stagger-5 { animation-delay: 250ms; }
.stagger-6 { animation-delay: 300ms; }
.stagger-7 { animation-delay: 350ms; }
.stagger-8 { animation-delay: 400ms; }

/* Card shadows matching main app */
.shadow-card {
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
}
.shadow-card-hover {
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}
```

**Step 2: Verify the app still renders**

Run: `cd apps/templates && npx next build` (or just reload dev server and check no CSS errors)

**Step 3: Commit**

```bash
git add apps/templates/src/app/globals.css
git commit -m "style: align templates app CSS tokens with main Viona app"
```

---

### Task 2: Redesign Gallery Page Header & Hero

**Files:**
- Modify: `apps/templates/src/app/page.tsx`

**Step 1: Rewrite the gallery page with premium header and hero**

Replace the entire file content:

```tsx
"use client";

import { listTemplates } from "@viona/templates";
import { TemplateGallery } from "@/components/TemplateGallery";
import { useMemo } from "react";

export default function GalleryPage() {
  const templates = useMemo(() => listTemplates(), []);

  return (
    <main className="min-h-screen">
      {/* Sticky Header */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">V</span>
            </div>
            <span className="text-sm font-semibold text-foreground tracking-tight">
              Viona Templates
            </span>
          </div>
          <span className="text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-full font-medium">
            {templates.length} templates
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-6 pt-12 pb-8">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          Template{" "}
          <span className="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
            Library
          </span>
        </h1>
        <p className="text-muted-foreground mt-2 text-base max-w-xl">
          Browse, preview, and customize pre-built video compositions.
          Pick a template to get started in seconds.
        </p>
      </div>

      {/* Gallery */}
      <div className="max-w-7xl mx-auto px-6 pb-16">
        <TemplateGallery templates={templates} />
      </div>
    </main>
  );
}
```

**Step 2: Commit**

```bash
git add apps/templates/src/app/page.tsx
git commit -m "style: redesign gallery page header and hero section"
```

---

### Task 3: Redesign FilterBar with Pill Buttons

**Files:**
- Modify: `apps/templates/src/components/FilterBar.tsx`

**Step 1: Rewrite FilterBar with pill-style categories and aspect ratio buttons**

Replace the entire file:

```tsx
"use client";

import { cn } from "@/lib/cn";
import { Search, X, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "marketing", label: "Marketing" },
  { value: "education", label: "Education" },
  { value: "social", label: "Social" },
  { value: "corporate", label: "Corporate" },
  { value: "entertainment", label: "Entertainment" },
] as const;

const ASPECT_RATIOS = [
  { value: "", label: "Any" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
] as const;

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  aspectRatio: string;
  onAspectRatioChange: (value: string) => void;
  tags: string[];
  selectedTag: string;
  onTagChange: (value: string) => void;
  totalCount: number;
  filteredCount: number;
}

export function FilterBar({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  aspectRatio,
  onAspectRatioChange,
  tags = [],
  selectedTag,
  onTagChange,
  totalCount,
  filteredCount,
}: FilterBarProps) {
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagRef = useRef<HTMLDivElement>(null);

  const hasActiveFilters = category || aspectRatio || selectedTag || search;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (tagRef.current && !tagRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-4">
      {/* Top row: Search + Aspect Ratio + Tags */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-card pl-10 pr-9 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-all"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Aspect Ratio Pills */}
        <div className="flex items-center gap-1.5">
          {ASPECT_RATIOS.map((ar) => (
            <button
              key={ar.value}
              onClick={() => onAspectRatioChange(ar.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                aspectRatio === ar.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
              )}
            >
              {ar.label}
            </button>
          ))}
        </div>

        {/* Tags Dropdown */}
        {tags.length > 0 && (
          <div ref={tagRef} className="relative">
            <button
              onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-all duration-200",
                selectedTag
                  ? "border-primary/40 bg-accent text-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              {selectedTag || "Tags"}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", tagDropdownOpen && "rotate-180")} />
            </button>
            {tagDropdownOpen && (
              <div className="absolute top-full mt-1.5 right-0 w-48 max-h-64 overflow-y-auto rounded-lg border border-border bg-card shadow-xl z-20 py-1">
                <button
                  onClick={() => { onTagChange(""); setTagDropdownOpen(false); }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-sm transition-colors",
                    !selectedTag ? "text-primary font-medium bg-accent/50" : "text-foreground hover:bg-secondary"
                  )}
                >
                  All tags
                </button>
                {tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => { onTagChange(tag); setTagDropdownOpen(false); }}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-sm transition-colors",
                      selectedTag === tag ? "text-primary font-medium bg-accent/50" : "text-foreground hover:bg-secondary"
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom row: Category pills + result count */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => onCategoryChange(cat.value)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                category === cat.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {hasActiveFilters && (
            <button
              onClick={() => {
                onSearchChange("");
                onCategoryChange("");
                onAspectRatioChange("");
                onTagChange("");
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
          )}
          <span className="text-xs text-muted-foreground">
            {filteredCount === totalCount
              ? `${totalCount} templates`
              : `Showing ${filteredCount} of ${totalCount}`}
          </span>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/templates/src/components/FilterBar.tsx
git commit -m "style: redesign FilterBar with pill buttons and custom tag dropdown"
```

---

### Task 4: Redesign TemplateCard with Hover Animation

**Files:**
- Modify: `apps/templates/src/components/TemplateCard.tsx`

**Step 1: Rewrite TemplateCard with larger design, animated hover, and premium feel**

Replace the entire file:

```tsx
"use client";

import Link from "next/link";
import { Thumbnail } from "@remotion/player";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TemplateRegistryEntry } from "@viona/templates";
import { cn } from "@/lib/cn";
import { Clock, Play } from "lucide-react";

interface TemplateCardProps {
  template: TemplateRegistryEntry;
  index?: number;
}

const categoryColors: Record<string, string> = {
  marketing: "bg-purple-50 text-purple-600 border-purple-100",
  education: "bg-blue-50 text-blue-600 border-blue-100",
  social: "bg-pink-50 text-pink-600 border-pink-100",
  corporate: "bg-slate-50 text-slate-600 border-slate-100",
  entertainment: "bg-amber-50 text-amber-600 border-amber-100",
};

export function TemplateCard({ template, index = 0 }: TemplateCardProps) {
  const { meta, compositionMeta, defaultProps } = template;
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverFrame, setHoverFrame] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    template.getComponent().then((mod) => {
      setComponent(() => mod.default);
    });
  }, [template]);

  const { width, height, fps, durationInFrames } = compositionMeta;
  const previewFrame = Math.min(Math.round(fps), durationInFrames - 1);

  // Cycle through frames on hover for animated preview
  const previewFrames = [
    previewFrame,
    Math.min(Math.round(fps * 3), durationInFrames - 1),
    Math.min(Math.round(fps * 6), durationInFrames - 1),
  ];

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
    let idx = 0;
    intervalRef.current = setInterval(() => {
      idx = (idx + 1) % previewFrames.length;
      setHoverFrame(previewFrames[idx]);
    }, 800);
  }, [previewFrames]);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    setHoverFrame(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Stagger class for animation (wrap around after 8)
  const staggerClass = `stagger-${(index % 8) + 1}`;

  return (
    <Link
      href={`/templates/${meta.slug}`}
      className={cn(
        "group block rounded-xl border border-border bg-card overflow-hidden",
        "transition-all duration-300 ease-out",
        "hover:shadow-xl hover:border-primary/30 hover:scale-[1.02]",
        "animate-fade-in-up",
        staggerClass
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden bg-muted/30">
        {Component ? (
          <Thumbnail
            component={Component}
            inputProps={defaultProps}
            compositionWidth={width}
            compositionHeight={height}
            durationInFrames={durationInFrames}
            fps={fps}
            frameToDisplay={isHovering ? hoverFrame : previewFrame}
            style={{ width: "100%" }}
          />
        ) : (
          <div
            className="bg-gradient-to-br from-primary/5 to-accent/10 animate-pulse flex items-center justify-center"
            style={{ aspectRatio: `${width}/${height}` }}
          >
            <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          </div>
        )}

        {/* Duration overlay */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white text-xs font-medium">
          <Clock className="h-3 w-3" />
          {meta.estimatedDuration}
        </div>

        {/* Play hint on hover */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300",
          "group-hover:bg-black/10"
        )}>
          <div className={cn(
            "w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg",
            "opacity-0 scale-75 transition-all duration-300",
            "group-hover:opacity-100 group-hover:scale-100"
          )}>
            <Play className="h-4 w-4 text-primary ml-0.5" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5 space-y-2">
        <h3 className="text-sm font-semibold text-card-foreground group-hover:text-primary transition-colors leading-tight line-clamp-1">
          {meta.name}
        </h3>

        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {meta.description}
        </p>

        <div className="flex items-center gap-1.5 pt-0.5">
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full border",
              categoryColors[meta.category] || "bg-muted text-muted-foreground border-border"
            )}
          >
            {meta.category}
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            {meta.aspectRatio}
          </span>
        </div>
      </div>
    </Link>
  );
}
```

**Step 2: Commit**

```bash
git add apps/templates/src/components/TemplateCard.tsx
git commit -m "style: redesign TemplateCard with hover animation and premium feel"
```

---

### Task 5: Redesign TemplateGallery with New Grid & Empty State

**Files:**
- Modify: `apps/templates/src/components/TemplateGallery.tsx`

**Step 1: Rewrite TemplateGallery with 4-column grid and visual empty state**

Replace the entire file:

```tsx
"use client";

import { useState, useMemo } from "react";
import type { TemplateRegistryEntry } from "@viona/templates";
import { TemplateCard } from "./TemplateCard";
import { FilterBar } from "./FilterBar";
import { Search } from "lucide-react";

interface TemplateGalleryProps {
  templates: TemplateRegistryEntry[];
}

export function TemplateGallery({ templates }: TemplateGalleryProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [aspectRatio, setAspectRatio] = useState("");
  const [selectedTag, setSelectedTag] = useState("");

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const t of templates) {
      for (const tag of t.meta.tags) tagSet.add(tag);
    }
    return Array.from(tagSet).sort();
  }, [templates]);

  const filtered = useMemo(() => {
    let items = templates;

    if (category) {
      items = items.filter((t) => t.meta.category === category);
    }

    if (aspectRatio) {
      items = items.filter((t) => t.meta.aspectRatio === aspectRatio);
    }

    if (selectedTag) {
      items = items.filter((t) => t.meta.tags.includes(selectedTag));
    }

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (t) =>
          t.meta.name.toLowerCase().includes(q) ||
          t.meta.description.toLowerCase().includes(q) ||
          t.meta.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    return items;
  }, [templates, search, category, aspectRatio, selectedTag]);

  return (
    <div className="space-y-8">
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        aspectRatio={aspectRatio}
        onAspectRatioChange={setAspectRatio}
        tags={allTags}
        selectedTag={selectedTag}
        onTagChange={setSelectedTag}
        totalCount={templates.length}
        filteredCount={filtered.length}
      />

      {filtered.length === 0 ? (
        <div className="text-center py-24 animate-fade-in-up">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <Search className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            No templates found
          </h3>
          <p className="text-muted-foreground mt-1 text-sm max-w-sm mx-auto">
            Try adjusting your search or filters to find what you&apos;re looking for.
          </p>
          <button
            onClick={() => {
              setSearch("");
              setCategory("");
              setAspectRatio("");
              setSelectedTag("");
            }}
            className="mt-5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((template, i) => (
            <TemplateCard key={template.meta.slug} template={template} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/templates/src/components/TemplateGallery.tsx
git commit -m "style: redesign TemplateGallery with 4-col grid and visual empty state"
```

---

### Task 6: Redesign Detail Page Layout

**Files:**
- Modify: `apps/templates/src/app/templates/[slug]/page.tsx`

**Step 1: Rewrite the detail page with premium layout, dark canvas preview, and related templates**

Replace the entire file:

```tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getTemplate, listTemplates, type TemplateRegistryEntry } from "@viona/templates";
import { TemplatePreview } from "@/components/TemplatePreview";
import { PropsEditor } from "@/components/PropsEditor";
import { TemplateCard } from "@/components/TemplateCard";
import { useTemplateProps } from "@/lib/use-template-props";
import { ArrowLeft, Copy, Check } from "lucide-react";

export default function TemplateDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [template, setTemplate] = useState<TemplateRegistryEntry | null>(null);

  useEffect(() => {
    if (params.slug) {
      const t = getTemplate(params.slug);
      if (t) setTemplate(t);
    }
  }, [params.slug]);

  if (!template) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-fade-in-up">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <span className="text-2xl">?</span>
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            Template not found
          </h3>
          <button
            onClick={() => router.push("/")}
            className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Back to gallery
          </button>
        </div>
      </main>
    );
  }

  return <TemplateDetailContent template={template} />;
}

function TemplateDetailContent({ template }: { template: TemplateRegistryEntry }) {
  const router = useRouter();
  const { props, updateProp, resetProps, addArrayItem, removeArrayItem } =
    useTemplateProps(template.defaultProps);
  const [copied, setCopied] = useState(false);

  const relatedTemplates = useMemo(() => {
    return listTemplates()
      .filter(
        (t) =>
          t.meta.category === template.meta.category &&
          t.meta.slug !== template.meta.slug
      )
      .slice(0, 4);
  }, [template]);

  const handleCopy = async () => {
    const propsJson = JSON.stringify(props, null, 2);
    await navigator.clipboard.writeText(propsJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/")}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <div className="h-4 w-px bg-border" />
              <h1 className="text-sm font-semibold text-foreground">
                {template.meta.name}
              </h1>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.97] transition-all"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Props
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
          {/* Left: Preview + Meta */}
          <div className="space-y-6 animate-fade-in-up">
            <TemplatePreview template={template} props={props} />

            <div className="space-y-3">
              <p className="text-muted-foreground text-sm leading-relaxed">
                {template.meta.description}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {template.meta.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2.5 py-1 rounded-full bg-accent text-accent-foreground font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Props Editor */}
          <aside className="lg:sticky lg:top-20 lg:self-start rounded-xl border border-border bg-card p-5 max-h-[calc(100vh-7rem)] overflow-y-auto shadow-sm animate-fade-in-up stagger-2">
            <PropsEditor
              schema={template.schema}
              props={props}
              onPropChange={updateProp}
              onAddArrayItem={addArrayItem}
              onRemoveArrayItem={removeArrayItem}
              onReset={resetProps}
            />
          </aside>
        </div>
      </div>

      {/* Related Templates */}
      {relatedTemplates.length > 0 && (
        <div className="border-t border-border bg-secondary/30">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <h2 className="text-lg font-semibold text-foreground mb-6">
              More in {template.meta.category}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {relatedTemplates.map((t, i) => (
                <TemplateCard key={t.meta.slug} template={t} index={i} />
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
```

**Step 2: Commit**

```bash
git add apps/templates/src/app/templates/[slug]/page.tsx
git commit -m "style: redesign detail page with premium layout and related templates"
```

---

### Task 7: Redesign TemplatePreview with Dark Canvas

**Files:**
- Modify: `apps/templates/src/components/TemplatePreview.tsx`

**Step 1: Rewrite TemplatePreview with dark canvas background and badge-style specs**

Replace the entire file:

```tsx
"use client";

import { Player } from "@remotion/player";
import { useCallback, useMemo, useState } from "react";
import type { TemplateRegistryEntry } from "@viona/templates";

interface TemplatePreviewProps {
  template: TemplateRegistryEntry;
  props: Record<string, unknown>;
}

export function TemplatePreview({ template, props }: TemplatePreviewProps) {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);
  const [loading, setLoading] = useState(true);

  useMemo(() => {
    setLoading(true);
    template.getComponent().then((mod) => {
      setComponent(() => mod.default);
      setLoading(false);
    });
  }, [template]);

  const { width, height, fps, durationInFrames } = template.compositionMeta;
  const isPortrait = height > width;

  const containerStyle = useMemo(
    () => ({
      maxWidth: isPortrait ? 360 : "100%",
      margin: isPortrait ? "0 auto" : undefined,
    }),
    [isPortrait]
  );

  const renderPoster = useCallback(() => {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
        <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
          <svg className="w-6 h-6 text-primary ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    );
  }, []);

  if (loading || !Component) {
    return (
      <div className="rounded-xl bg-neutral-950 p-6">
        <div
          className="rounded-lg bg-neutral-800 animate-pulse flex items-center justify-center"
          style={{ ...containerStyle, aspectRatio: `${width}/${height}` }}
        >
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Dark canvas wrapper */}
      <div className="rounded-xl bg-neutral-950 p-4 sm:p-6">
        <div style={containerStyle}>
          <div className="rounded-lg overflow-hidden shadow-2xl ring-1 ring-white/10">
            <Player
              component={Component}
              inputProps={props}
              durationInFrames={durationInFrames}
              compositionWidth={width}
              compositionHeight={height}
              fps={fps}
              style={{ width: "100%" }}
              controls
              autoPlay
              loop
              renderPoster={renderPoster}
              showPosterWhenUnplayed
            />
          </div>
        </div>
      </div>

      {/* Specs bar */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {[
          `${width}×${height}`,
          `${fps} fps`,
          `${(durationInFrames / fps).toFixed(1)}s`,
          `${durationInFrames} frames`,
        ].map((spec) => (
          <span
            key={spec}
            className="text-xs px-2.5 py-1 rounded-md bg-secondary text-muted-foreground font-medium"
          >
            {spec}
          </span>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/templates/src/components/TemplatePreview.tsx
git commit -m "style: redesign TemplatePreview with dark canvas and spec badges"
```

---

### Task 8: Polish PropsEditor and PropsEditorField

**Files:**
- Modify: `apps/templates/src/components/PropsEditor.tsx`
- Modify: `apps/templates/src/components/PropsEditorField.tsx`

**Step 1: Update PropsEditor with cleaner header styling**

In `apps/templates/src/components/PropsEditor.tsx`, replace the header section:

Change the `<h3>` from:
```tsx
<h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
```
to:
```tsx
<h3 className="text-sm font-semibold text-foreground">
```

(Drop the uppercase/tracking-wide — feels too dev-tool-like for a consumer app.)

**Step 2: Update PropsEditorField input styling to match main app**

In `apps/templates/src/components/PropsEditorField.tsx`, make these changes across all input elements:

For all text/number inputs, use this consistent class:
```
w-full h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-all
```

For the color input text field:
```
flex-1 h-9 rounded-md border border-border bg-card px-3 text-sm font-mono outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-all
```

For select elements:
```
w-full h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-all
```

For the fieldset border:
```
space-y-3 rounded-lg border border-border/60 p-3.5
```

For the array item border:
```
flex items-start gap-2 rounded-lg border border-border/60 p-3
```

**Step 3: Commit**

```bash
git add apps/templates/src/components/PropsEditor.tsx apps/templates/src/components/PropsEditorField.tsx
git commit -m "style: polish PropsEditor fields to match main app input styling"
```

---

### Task 9: Verify Everything Works End-to-End

**Step 1: Start the dev server**

Run: `cd apps/templates && npm run dev`

**Step 2: Manual verification checklist**

- [ ] Gallery page: Header shows "Viona Templates" with template count badge
- [ ] Hero: "Template Library" with violet gradient on "Library"
- [ ] Cards: 4-column grid, larger thumbnails, staggered fade-in animation
- [ ] Cards: Hover shows scale + shadow + animated frame cycling + play button overlay
- [ ] Cards: Duration badge overlaid on thumbnail corner
- [ ] FilterBar: Category pills with violet active state
- [ ] FilterBar: Aspect ratio as pill buttons (not select)
- [ ] FilterBar: Tag dropdown as styled popover
- [ ] FilterBar: Result count displayed, clear-all button visible when filters active
- [ ] Empty state: Icon + heading + description + clear button
- [ ] Detail page: Slim header with back arrow, template name, copy button
- [ ] Preview: Dark canvas background with shadow
- [ ] Preview: Spec badges below (resolution, fps, duration, frames)
- [ ] Props sidebar: Clean field styling, proper focus rings
- [ ] Related templates: Row of 4 cards from same category at bottom
- [ ] All transitions smooth (300ms ease-out)
- [ ] No console errors

**Step 3: Final commit**

If any small fixes were needed, commit them:
```bash
git add -A
git commit -m "fix: polish templates UX overhaul based on manual testing"
```
