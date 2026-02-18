"use client";

import { listTemplates } from "@viona/templates";
import { TemplateGallery } from "@/components/TemplateGallery";
import { useMemo } from "react";

export default function GalleryPage() {
  const templates = useMemo(() => listTemplates(), []);

  return (
    <main className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">V</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                Viona Templates
              </h1>
              <p className="text-xs text-muted-foreground">
                Pre-built Remotion compositions
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Template Library
          </h2>
          <p className="text-muted-foreground mt-1">
            Browse, preview, and customize pre-built video compositions.
            Each template can be installed into your project and customized further.
          </p>
        </div>

        <TemplateGallery templates={templates} />
      </div>
    </main>
  );
}
