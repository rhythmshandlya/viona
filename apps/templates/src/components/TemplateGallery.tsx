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
