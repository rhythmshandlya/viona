"use client";

import { cn } from "@/lib/cn";
import { Search, X } from "lucide-react";

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "marketing", label: "Marketing" },
  { value: "education", label: "Education" },
  { value: "social", label: "Social" },
  { value: "corporate", label: "Corporate" },
  { value: "entertainment", label: "Entertainment" },
] as const;

const ASPECT_RATIOS = [
  { value: "", label: "Any ratio" },
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
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search templates..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-lg border border-input bg-card pl-10 pr-9 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring transition-shadow"
        />
        {search && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => onCategoryChange(cat.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              category === cat.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <select
        value={aspectRatio}
        onChange={(e) => onAspectRatioChange(e.target.value)}
        className="rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        {ASPECT_RATIOS.map((ar) => (
          <option key={ar.value} value={ar.value}>
            {ar.label}
          </option>
        ))}
      </select>

      {tags.length > 0 && (
        <select
          value={selectedTag}
          onChange={(e) => onTagChange(e.target.value)}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All tags</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
