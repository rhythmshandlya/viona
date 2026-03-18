"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { api, type TemplateListItem, type TemplateCategory } from "@/lib/api";
import { Loader2, Search, LayoutGrid } from "lucide-react";

function TemplateCard({ template }: { template: TemplateListItem }) {
  return (
    <Link
      href={`/templates/${template.slug}`}
      className="group block glass-card cursor-pointer"
    >
      {/* Thumbnail / Preview */}
      <div className="aspect-video bg-gradient-to-br from-violet-950/40 to-purple-950/30 relative overflow-hidden">
        {template.screenshotUrl ? (
          <img
            src={template.screenshotUrl}
            alt={template.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-[#8B5CF6]/15 flex items-center justify-center">
              <LayoutGrid className="w-8 h-8 text-[#8B5CF6]/60" />
            </div>
          </div>
        )}

        {/* Category badge */}
        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-normal border backdrop-blur-xl bg-white/[0.08] text-white/70 border-white/[0.1]">
          {template.category}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-normal text-white/90 truncate mb-1">
          {template.name}
        </h3>
        {template.description && (
          <p className="text-sm text-white/40 line-clamp-2">
            {template.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-white/30">
            {template.aspectRatio}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState("all");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // Fetch categories once
  useEffect(() => {
    api
      .getTemplateCategories()
      .then(setCategories)
      .catch((err) => console.error("Failed to load categories:", err));
  }, []);

  // Fetch templates when filters change
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (selectedCategory !== "all") params.category = selectedCategory;
      if (selectedAspectRatio !== "all") params.aspectRatio = selectedAspectRatio;

      const result = await api.getTemplates(params);
      setTemplates(result.items);
      setTotal(result.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedCategory, selectedAspectRatio]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return (
    <div className="min-h-screen px-4 md:px-6 lg:px-8 pt-10 pb-12">
      <div className="max-w-[1600px] mx-auto w-full">
        {/* Header */}
        <div className="mb-8 px-2">
          <h1 className="text-lg font-normal text-white/80">Templates</h1>
          <p className="text-sm text-white/35 mt-0.5">
            Ready-made motion graphics you can customize and export
          </p>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6 px-2">
          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/90 text-sm placeholder:text-white/30 outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10 transition-all"
            />
          </div>

          {/* Category filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 px-3 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/70 text-sm outline-none focus:border-white/20 min-w-[140px]"
          >
            <option value="all" className="bg-[#1a1a2e]">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.category} value={cat.category} className="bg-[#1a1a2e]">
                {cat.category} ({cat.count})
              </option>
            ))}
          </select>

          {/* Aspect ratio filter */}
          <select
            value={selectedAspectRatio}
            onChange={(e) => setSelectedAspectRatio(e.target.value)}
            className="h-9 px-3 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/70 text-sm outline-none focus:border-white/20 min-w-[130px]"
          >
            <option value="all" className="bg-[#1a1a2e]">All Ratios</option>
            <option value="16:9" className="bg-[#1a1a2e]">16:9</option>
            <option value="9:16" className="bg-[#1a1a2e]">9:16</option>
            <option value="1:1" className="bg-[#1a1a2e]">1:1</option>
            <option value="4:5" className="bg-[#1a1a2e]">4:5</option>
          </select>
        </div>

        {/* Results count */}
        {!loading && !error && (
          <div className="px-2 mb-4">
            <p className="text-sm text-white/35">
              {total} template{total !== 1 ? "s" : ""}
              {debouncedSearch && ` matching "${debouncedSearch}"`}
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-[#8B5CF6] mb-3" />
            <p className="text-white/40 text-sm">Loading templates...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-24">
            <p className="text-red-400/80 text-sm mb-3">{error}</p>
            <button
              onClick={fetchTemplates}
              className="text-sm text-white/50 hover:text-white/80 underline transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && templates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
              <LayoutGrid className="w-8 h-8 text-white/20" />
            </div>
            <p className="text-white/40 text-sm mb-1">No templates found</p>
            <p className="text-white/25 text-xs">
              Try adjusting your search or filters
            </p>
          </div>
        )}

        {/* Grid */}
        {!loading && !error && templates.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {templates.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
