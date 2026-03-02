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
