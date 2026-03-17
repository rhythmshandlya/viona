"use client";

import { useRouter } from "next/navigation";
import type { TemplateListItem } from "@/lib/api";

export function TemplateCard({ template }: { template: TemplateListItem }) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/templates/${template.slug}`)}
      className="group block glass-card cursor-pointer"
    >
      {/* Thumbnail */}
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
              <svg
                className="w-8 h-8 text-[#8B5CF6]/60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                />
              </svg>
            </div>
          </div>
        )}

        {/* Aspect ratio badge */}
        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[11px] font-normal bg-black/50 text-white/70 backdrop-blur-xl border border-white/10">
          {template.aspectRatio}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-[#8B5CF6]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-normal text-white/90 truncate mb-1">
          {template.name}
        </h3>
        {template.description && (
          <p className="text-sm text-white/40 line-clamp-2 mb-2">
            {template.description}
          </p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-white/[0.06] text-white/50 border border-white/[0.06]">
            {template.category}
          </span>
          {template.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full text-[11px] bg-white/[0.04] text-white/35 border border-white/[0.04]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
