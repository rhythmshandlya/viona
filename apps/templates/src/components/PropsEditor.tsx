"use client";

import { useMemo } from "react";
import type { z } from "zod";
import { schemaToFields } from "@/lib/schema-to-fields";
import { PropsEditorField } from "./PropsEditorField";
import { RotateCcw } from "lucide-react";

interface PropsEditorProps {
  schema: z.ZodType;
  props: Record<string, unknown>;
  onPropChange: (path: string, value: unknown) => void;
  onAddArrayItem: (path: string, item: unknown) => void;
  onRemoveArrayItem: (path: string, index: number) => void;
  onReset: () => void;
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

export function PropsEditor({
  schema,
  props,
  onPropChange,
  onAddArrayItem,
  onRemoveArrayItem,
  onReset,
}: PropsEditorProps) {
  const fields = useMemo(() => schemaToFields(schema), [schema]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Properties
        </h3>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      <div className="space-y-4">
        {fields.map((field) => (
          <PropsEditorField
            key={field.key}
            field={field}
            value={getNestedValue(props, field.key)}
            onChange={onPropChange}
            onAddArrayItem={onAddArrayItem}
            onRemoveArrayItem={onRemoveArrayItem}
          />
        ))}
      </div>
    </div>
  );
}
