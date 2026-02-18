"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getTemplate, type TemplateRegistryEntry } from "@viona/templates";
import { TemplatePreview } from "@/components/TemplatePreview";
import { PropsEditor } from "@/components/PropsEditor";
import { useTemplateProps } from "@/lib/use-template-props";
import { ArrowLeft, Copy, Check } from "lucide-react";

export default function TemplateDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [template, setTemplate] = useState<TemplateRegistryEntry | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (params.slug) {
      const t = getTemplate(params.slug);
      if (t) setTemplate(t);
    }
  }, [params.slug]);

  if (!template) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground text-lg">Template not found</p>
          <button
            onClick={() => router.push("/")}
            className="mt-4 text-primary hover:underline"
          >
            Back to gallery
          </button>
        </div>
      </main>
    );
  }

  return <TemplateDetailContent template={template} />;
}

function TemplateDetailContent({
  template,
}: {
  template: TemplateRegistryEntry;
}) {
  const router = useRouter();
  const { props, updateProp, resetProps, addArrayItem, removeArrayItem } =
    useTemplateProps(template.defaultProps);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const propsJson = JSON.stringify(props, null, 2);
    await navigator.clipboard.writeText(propsJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/")}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <div className="h-5 w-px bg-border" />
              <h1 className="text-lg font-semibold text-foreground">
                {template.meta.name}
              </h1>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
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

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
          <div className="space-y-6">
            <TemplatePreview template={template} props={props} />

            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">
                {template.meta.description}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {template.meta.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start rounded-xl border border-border bg-card p-5 max-h-[calc(100vh-8rem)] overflow-y-auto">
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
    </main>
  );
}
