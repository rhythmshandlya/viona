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
