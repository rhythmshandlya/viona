"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getTemplate, listTemplates, type TemplateRegistryEntry } from "@viona/templates";
import { TemplatePreview } from "@/components/TemplatePreview";
import { PropsEditor } from "@/components/PropsEditor";
import { TemplateCard } from "@/components/TemplateCard";
import { useTemplateProps } from "@/lib/use-template-props";
import { ArrowLeft, Copy, Check } from "lucide-react";

export default function TemplateDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [template, setTemplate] = useState<TemplateRegistryEntry | null>(null);

  useEffect(() => {
    if (params.slug) {
      const t = getTemplate(params.slug);
      if (t) setTemplate(t);
    }
  }, [params.slug]);

  if (!template) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-fade-in-up">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <span className="text-2xl">?</span>
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            Template not found
          </h3>
          <button
            onClick={() => router.push("/")}
            className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Back to gallery
          </button>
        </div>
      </main>
    );
  }

  return <TemplateDetailContent template={template} />;
}

function TemplateDetailContent({ template }: { template: TemplateRegistryEntry }) {
  const router = useRouter();
  const { props, updateProp, resetProps, addArrayItem, removeArrayItem } =
    useTemplateProps(template.defaultProps);
  const [copied, setCopied] = useState(false);

  const relatedTemplates = useMemo(() => {
    return listTemplates()
      .filter(
        (t) =>
          t.meta.category === template.meta.category &&
          t.meta.slug !== template.meta.slug
      )
      .slice(0, 4);
  }, [template]);

  const handleCopy = async () => {
    const propsJson = JSON.stringify(props, null, 2);
    await navigator.clipboard.writeText(propsJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/")}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <div className="h-4 w-px bg-border" />
              <h1 className="text-sm font-semibold text-foreground">
                {template.meta.name}
              </h1>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.97] transition-all"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Props
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
          {/* Left: Preview + Meta */}
          <div className="space-y-6 animate-fade-in-up">
            <TemplatePreview template={template} props={props} />

            <div className="space-y-3">
              <p className="text-muted-foreground text-sm leading-relaxed">
                {template.meta.description}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {template.meta.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2.5 py-1 rounded-full bg-accent text-accent-foreground font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Props Editor */}
          <aside className="lg:sticky lg:top-20 lg:self-start rounded-xl border border-border bg-card p-5 max-h-[calc(100vh-7rem)] overflow-y-auto shadow-sm animate-fade-in-up stagger-2">
            <PropsEditor
              schema={template.schema}
              props={props}
              onPropChange={updateProp}
              onAddArrayItem={addArrayItem}
              onRemoveArrayItem={removeArrayItem}
              onReset={resetProps}
            />
          </aside>
        </div>
      </div>

      {/* Related Templates */}
      {relatedTemplates.length > 0 && (
        <div className="border-t border-border bg-secondary/30">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <h2 className="text-lg font-semibold text-foreground mb-6">
              More in {template.meta.category}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {relatedTemplates.map((t, i) => (
                <TemplateCard key={t.meta.slug} template={t} index={i} />
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
