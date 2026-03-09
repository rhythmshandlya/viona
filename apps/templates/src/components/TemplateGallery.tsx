"use client";

import { useState, useMemo } from "react";
import type { TemplateRegistryEntry } from "@viona/templates";
import { TemplateCard } from "./TemplateCard";
import { FilterBar } from "./FilterBar";

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
      />

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-lg">
            No templates match your filters
          </p>
          <button
            onClick={() => {
              setSearch("");
              setCategory("");
              setAspectRatio("");
              setSelectedTag("");
            }}
            className="mt-4 text-primary hover:underline text-sm"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map((template) => (
            <TemplateCard key={template.meta.slug} template={template} />
          ))}
        </div>
      )}
    </div>
  );
}
