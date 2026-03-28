"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api, type TemplateListItem, type TemplateCategory } from "@/lib/api";
import { TemplateCard } from "@/components/template-card";
import { Loader2, Search, LayoutGrid } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TemplatesTab() {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>("all");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
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
    <div className="max-w-[1600px] mx-auto w-full">
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-8 px-2">
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
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="h-9 bg-white/[0.06] border-white/[0.08] text-white/70 text-sm min-w-[140px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="bg-[rgba(28,28,35,0.95)] backdrop-blur-2xl border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <SelectItem value="all" className="text-white/70 focus:bg-white/[0.06] focus:text-white">
              All Categories
            </SelectItem>
            {categories.map((cat) => (
              <SelectItem
                key={cat.category}
                value={cat.category}
                className="text-white/70 focus:bg-white/[0.06] focus:text-white"
              >
                {cat.category} ({cat.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Aspect ratio filter */}
        <Select value={selectedAspectRatio} onValueChange={setSelectedAspectRatio}>
          <SelectTrigger className="h-9 bg-white/[0.06] border-white/[0.08] text-white/70 text-sm min-w-[130px]">
            <SelectValue placeholder="Aspect Ratio" />
          </SelectTrigger>
          <SelectContent className="bg-[rgba(28,28,35,0.95)] backdrop-blur-2xl border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <SelectItem value="all" className="text-white/70 focus:bg-white/[0.06] focus:text-white">
              All Ratios
            </SelectItem>
            <SelectItem value="16:9" className="text-white/70 focus:bg-white/[0.06] focus:text-white">
              16:9
            </SelectItem>
            <SelectItem value="9:16" className="text-white/70 focus:bg-white/[0.06] focus:text-white">
              9:16
            </SelectItem>
            <SelectItem value="1:1" className="text-white/70 focus:bg-white/[0.06] focus:text-white">
              1:1
            </SelectItem>
            <SelectItem value="4:5" className="text-white/70 focus:bg-white/[0.06] focus:text-white">
              4:5
            </SelectItem>
          </SelectContent>
        </Select>
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
  );
}
