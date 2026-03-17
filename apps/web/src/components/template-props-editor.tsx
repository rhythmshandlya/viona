"use client";

import { useState, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronRight } from "lucide-react";

interface SchemaProperty {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: string[];
  properties?: Record<string, SchemaProperty>;
  minimum?: number;
  maximum?: number;
  step?: number;
}

interface PropsEditorProps {
  schema: {
    type?: string;
    properties?: Record<string, SchemaProperty>;
    required?: string[];
  };
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

function isColorField(name: string, schema: SchemaProperty): boolean {
  const lcName = name.toLowerCase();
  return (
    schema.type === "string" &&
    (lcName.includes("color") ||
      lcName.includes("colour") ||
      lcName.includes("bg") ||
      lcName.includes("background"))
  );
}

function FieldLabel({
  name,
  schema,
}: {
  name: string;
  schema: SchemaProperty;
}) {
  const label =
    schema.title ||
    name
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
  return (
    <label className="block text-xs text-white/50 mb-1.5">
      {label}
      {schema.description && (
        <span className="block text-[11px] text-white/25 mt-0.5 font-normal">
          {schema.description}
        </span>
      )}
    </label>
  );
}

function PropertyField({
  name,
  schema,
  value,
  onChange,
}: {
  name: string;
  schema: SchemaProperty;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  // Enum -> dropdown
  if (schema.enum && schema.enum.length > 0) {
    return (
      <div>
        <FieldLabel name={name} schema={schema} />
        <Select
          value={String(value ?? schema.default ?? schema.enum[0])}
          onValueChange={onChange}
        >
          <SelectTrigger className="h-8 bg-white/[0.06] border-white/[0.08] text-white/80 text-sm w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[rgba(28,28,35,0.95)] backdrop-blur-2xl border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            {schema.enum.map((opt) => (
              <SelectItem
                key={opt}
                value={opt}
                className="text-white/70 focus:bg-white/[0.06] focus:text-white"
              >
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Boolean -> toggle switch
  if (schema.type === "boolean") {
    return (
      <div className="flex items-center justify-between py-1">
        <FieldLabel name={name} schema={schema} />
        <Switch
          checked={Boolean(value ?? schema.default ?? false)}
          onCheckedChange={onChange}
          className="data-[state=checked]:bg-[#8B5CF6]"
        />
      </div>
    );
  }

  // Color field
  if (isColorField(name, schema)) {
    const colorValue = String(value ?? schema.default ?? "#ffffff");
    return (
      <div>
        <FieldLabel name={name} schema={schema} />
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="color"
              value={colorValue}
              onChange={(e) => onChange(e.target.value)}
              className="w-8 h-8 rounded-lg border border-white/[0.08] bg-transparent cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none"
            />
          </div>
          <input
            type="text"
            value={colorValue}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 h-8 px-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/80 text-sm font-mono outline-none focus:border-white/20 transition-colors"
          />
        </div>
      </div>
    );
  }

  // Number
  if (schema.type === "number" || schema.type === "integer") {
    return (
      <div>
        <FieldLabel name={name} schema={schema} />
        <input
          type="number"
          value={value !== undefined ? Number(value) : (schema.default as number) ?? 0}
          min={schema.minimum}
          max={schema.maximum}
          step={schema.step ?? (schema.type === "integer" ? 1 : 0.1)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-8 px-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/80 text-sm outline-none focus:border-white/20 transition-colors"
        />
      </div>
    );
  }

  // Nested object -> collapsible section
  if (schema.type === "object" && schema.properties) {
    return (
      <ObjectSection
        name={name}
        schema={schema}
        value={(value ?? {}) as Record<string, unknown>}
        onChange={onChange}
      />
    );
  }

  // Default: string input
  return (
    <div>
      <FieldLabel name={name} schema={schema} />
      <input
        type="text"
        value={String(value ?? schema.default ?? "")}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-8 px-2.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/80 text-sm outline-none focus:border-white/20 transition-colors"
      />
    </div>
  );
}

function ObjectSection({
  name,
  schema,
  value,
  onChange,
}: {
  name: string;
  schema: SchemaProperty;
  value: Record<string, unknown>;
  onChange: (value: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const label =
    schema.title ||
    name
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim();

  return (
    <div className="border border-white/[0.06] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white/80 hover:bg-white/[0.03] transition-colors"
      >
        <ChevronRight
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-90" : ""}`}
        />
        {label}
      </button>
      {open && schema.properties && (
        <div className="px-3 pb-3 space-y-3 border-t border-white/[0.04]">
          {Object.entries(schema.properties).map(([key, propSchema]) => (
            <PropertyField
              key={key}
              name={key}
              schema={propSchema}
              value={value[key]}
              onChange={(newVal) => {
                onChange({ ...value, [key]: newVal });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TemplatePropsEditor({
  schema,
  values,
  onChange,
}: PropsEditorProps) {
  const handleFieldChange = useCallback(
    (key: string, newValue: unknown) => {
      onChange({ ...values, [key]: newValue });
    },
    [values, onChange],
  );

  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    return (
      <div className="text-sm text-white/30 py-4 text-center">
        No editable properties
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(schema.properties).map(([key, propSchema]) => (
        <PropertyField
          key={key}
          name={key}
          schema={propSchema}
          value={values[key]}
          onChange={(val) => handleFieldChange(key, val)}
        />
      ))}
    </div>
  );
}
