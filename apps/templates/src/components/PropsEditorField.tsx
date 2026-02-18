"use client";

import type { FieldDescriptor } from "@/lib/schema-to-fields";
import { Minus, Plus } from "lucide-react";

interface PropsEditorFieldProps {
  field: FieldDescriptor;
  value: unknown;
  onChange: (path: string, value: unknown) => void;
  onAddArrayItem?: (path: string, item: unknown) => void;
  onRemoveArrayItem?: (path: string, index: number) => void;
}

export function PropsEditorField({
  field,
  value,
  onChange,
  onAddArrayItem,
  onRemoveArrayItem,
}: PropsEditorFieldProps) {
  if (field.type === "text") {
    return (
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {field.label}
        </label>
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-shadow"
        />
      </div>
    );
  }

  if (field.type === "color") {
    return (
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {field.label}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={(value as string) ?? "#000000"}
            onChange={(e) => onChange(field.key, e.target.value)}
            className="h-9 w-12 rounded border border-input cursor-pointer"
          />
          <input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(field.key, e.target.value)}
            className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {field.label}
        </label>
        <input
          type="number"
          value={(value as number) ?? 0}
          onChange={(e) => onChange(field.key, Number(e.target.value))}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-shadow"
        />
      </div>
    );
  }

  if (field.type === "boolean") {
    return (
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">
          {field.label}
        </label>
        <button
          onClick={() => onChange(field.key, !value)}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            value ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              value ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    );
  }

  if (field.type === "enum") {
    return (
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {field.label}
        </label>
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {field.enumValues?.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "object" && field.children) {
    return (
      <fieldset className="space-y-3 rounded-lg border border-border p-3">
        <legend className="text-sm font-medium text-foreground px-1">
          {field.label}
        </legend>
        {field.children.map((child) => {
          const childVal = value && typeof value === "object"
            ? (value as Record<string, unknown>)[child.key.split(".").pop()!]
            : undefined;
          return (
            <PropsEditorField
              key={child.key}
              field={child}
              value={childVal}
              onChange={onChange}
              onAddArrayItem={onAddArrayItem}
              onRemoveArrayItem={onRemoveArrayItem}
            />
          );
        })}
      </fieldset>
    );
  }

  if (field.type === "array") {
    const arr = Array.isArray(value) ? value : [];
    const itemFields = field.arrayItemFields;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            {field.label}
          </label>
          <button
            onClick={() => {
              if (!itemFields || !onAddArrayItem) return;
              if (itemFields.length === 1 && itemFields[0].key === "value") {
                onAddArrayItem(field.key, "");
              } else {
                const empty: Record<string, unknown> = {};
                itemFields.forEach((f) => {
                  empty[f.key] = f.type === "number" ? 0 : "";
                });
                onAddArrayItem(field.key, empty);
              }
            }}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>

        <div className="space-y-2">
          {arr.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 rounded-md border border-border/50 p-2"
            >
              <div className="flex-1 space-y-2">
                {itemFields?.length === 1 && itemFields[0].key === "value" ? (
                  <input
                    type="text"
                    value={item as string}
                    onChange={(e) =>
                      onChange(`${field.key}.${idx}`, e.target.value)
                    }
                    className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                ) : (
                  itemFields?.map((itemField) => {
                    const itemVal =
                      item && typeof item === "object"
                        ? (item as Record<string, unknown>)[itemField.key]
                        : undefined;
                    return (
                      <PropsEditorField
                        key={`${field.key}.${idx}.${itemField.key}`}
                        field={{
                          ...itemField,
                          key: `${field.key}.${idx}.${itemField.key}`,
                        }}
                        value={itemVal}
                        onChange={onChange}
                      />
                    );
                  })
                )}
              </div>
              <button
                onClick={() => onRemoveArrayItem?.(field.key, idx)}
                className="mt-1.5 text-muted-foreground hover:text-red-500 transition-colors"
              >
                <Minus className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
