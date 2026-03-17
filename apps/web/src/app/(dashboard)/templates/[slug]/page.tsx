"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Player } from "@remotion/player";
import { api, type TemplateDetail, type TemplateExportStatus } from "@/lib/api";
import { useTemplateBundle } from "@/components/template-bundle-loader";
import { TemplatePropsEditor } from "@/components/template-props-editor";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import {
  ArrowLeft,
  Download,
  Loader2,
  Pencil,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [props, setProps] = useState<Record<string, unknown>>({});

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<TemplateExportStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load template detail
  useEffect(() => {
    if (!slug) return;

    setLoading(true);
    setError(null);

    api
      .getTemplate(slug)
      .then((t) => {
        setTemplate(t);
        setProps(t.defaultProps || {});
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load template");
      })
      .finally(() => setLoading(false));
  }, [slug]);

  // Load bundle
  const {
    Component,
    loading: bundleLoading,
    error: bundleError,
  } = useTemplateBundle(template?.bundleUrl ?? null);

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleExport = useCallback(async () => {
    if (!template || exporting) return;

    setExporting(true);
    setExportStatus(null);

    try {
      const initial = await api.exportTemplate(template.slug, props);
      const exportId = initial.exportId;
      setExportStatus({ id: exportId, status: initial.status as TemplateExportStatus['status'], downloadUrl: null, createdAt: new Date().toISOString(), completedAt: null });

      if (initial.status === "completed") {
        setExporting(false);
        return;
      }

      // Poll every 2s
      pollRef.current = setInterval(async () => {
        try {
          const status = await api.getExportStatus(template.slug, exportId);
          setExportStatus(status);

          if (status.status === "completed" || status.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setExporting(false);
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setExporting(false);
        }
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
      setExporting(false);
    }
  }, [template, props, exporting]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#8B5CF6]" />
          <p className="text-white/40">Loading template...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !template) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-normal mb-2 text-white/90">
          Template not found
        </h2>
        <p className="text-white/40 mb-6">{error || "Could not load this template."}</p>
        <LiquidButton onClick={() => router.push("/projects")}>
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </LiquidButton>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 md:px-6 lg:px-8 pt-8 pb-12">
      <div className="max-w-[1400px] mx-auto">
        {/* Back link */}
        <button
          onClick={() => router.push("/projects?tab=templates")}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Templates
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-normal text-white/90 mb-2">
            {template.name}
          </h1>
          {template.description && (
            <p className="text-white/40 max-w-2xl">{template.description}</p>
          )}
          <div className="flex items-center gap-3 mt-3">
            <span className="px-2.5 py-0.5 rounded-full text-xs bg-white/[0.06] text-white/50 border border-white/[0.06]">
              {template.category}
            </span>
            <span className="text-xs text-white/30">
              {template.width}x{template.height} &middot; {template.fps}fps &middot;{" "}
              {template.aspectRatio}
            </span>
          </div>
        </div>

        {/* Main layout: Player + Props */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* Left: Player */}
          <div className="glass-card p-1 self-start">
            <div className="rounded-[16px] overflow-hidden bg-black">
              {bundleLoading && (
                <div className="aspect-video flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-[#8B5CF6]" />
                    <p className="text-white/40 text-sm">Loading preview...</p>
                  </div>
                </div>
              )}
              {bundleError && (
                <div className="aspect-video flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <AlertCircle className="h-6 w-6 text-red-400/60" />
                    <p className="text-white/40 text-sm">
                      Preview unavailable
                    </p>
                  </div>
                </div>
              )}
              {Component && !bundleLoading && !bundleError && (
                <Player
                  component={Component}
                  inputProps={{ ...props, assetBaseUrl: template.assetBaseUrl }}
                  durationInFrames={template.durationFrames || 150}
                  compositionWidth={template.width}
                  compositionHeight={template.height}
                  fps={template.fps}
                  style={{
                    width: "100%",
                    aspectRatio: `${template.width}/${template.height}`,
                  }}
                  controls
                  autoPlay
                  loop
                />
              )}
              {!Component && !bundleLoading && !bundleError && (
                <div className="aspect-video flex items-center justify-center">
                  <p className="text-white/30 text-sm">No preview bundle available</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Props editor + Actions */}
          <div className="space-y-4">
            {/* Props editor panel */}
            <div className="glass-card p-5">
              <h2 className="text-sm font-normal text-white/60 mb-4 uppercase tracking-wider">
                Customize
              </h2>
              <TemplatePropsEditor
                schema={
                  (template.propsSchema as {
                    type?: string;
                    properties?: Record<string, any>;
                    required?: string[];
                  }) || {}
                }
                values={props}
                onChange={setProps}
              />
            </div>

            {/* Actions */}
            <div className="glass-card p-5 space-y-3">
              {/* Export button */}
              <button
                onClick={handleExport}
                disabled={exporting}
                className="w-full h-10 rounded-xl bg-[#8B5CF6] hover:bg-[#7C4FE0] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-normal flex items-center justify-center gap-2 transition-colors"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Export MP4
                  </>
                )}
              </button>

              {/* Export status */}
              {exportStatus && (
                <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-3">
                  {exportStatus.status === "completed" &&
                    exportStatus.downloadUrl && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span className="text-sm text-emerald-400/90 flex-1">
                          Export complete
                        </span>
                        <a
                          href={exportStatus.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-[#8B5CF6] hover:text-[#A78BFA] flex items-center gap-1 transition-colors"
                        >
                          Download
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  {exportStatus.status === "failed" && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <span className="text-sm text-red-400/90">
                        Export failed. Please try again.
                      </span>
                    </div>
                  )}
                  {(exportStatus.status === "queued" ||
                    exportStatus.status === "processing") && (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#8B5CF6] flex-shrink-0" />
                      <span className="text-sm text-white/50">
                        {exportStatus.status === "queued"
                          ? "Queued..."
                          : "Rendering..."}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Remix button (disabled) */}
              <div className="relative group">
                <button
                  disabled
                  className="w-full h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/30 text-sm font-normal flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  <Pencil className="w-4 h-4" />
                  Remix in Editor
                </button>
                {/* Tooltip */}
                <div className="absolute -top-9 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-[rgba(28,28,35,0.95)] border border-white/[0.08] text-xs text-white/50 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
                  Coming soon — edit in Viona editor
                </div>
              </div>
            </div>

            {/* Tags */}
            {template.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 px-1">
                {template.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-0.5 rounded-full text-[11px] bg-white/[0.04] text-white/30 border border-white/[0.04]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
