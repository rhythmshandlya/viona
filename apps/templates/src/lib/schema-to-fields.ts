import type { z } from "zod";

export type FieldType =
  | "text"
  | "number"
  | "color"
  | "boolean"
  | "enum"
  | "array"
  | "object";

export interface FieldDescriptor {
  key: string;
  label: string;
  type: FieldType;
  description?: string;
  enumValues?: string[];
  children?: FieldDescriptor[];
  arrayItemFields?: FieldDescriptor[];
}

const COLOR_KEYS = [
  "color",
  "primary",
  "secondary",
  "accent",
  "background",
  "text",
  "foreground",
];

function keyToLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function isColorKey(key: string): boolean {
  const lower = key.toLowerCase();
  return COLOR_KEYS.some(
    (ck) => lower === ck || lower.endsWith(ck) || lower.endsWith("color")
  );
}

function unwrapDefault(def: z.ZodTypeDef & { innerType?: any; typeName?: string }): z.ZodTypeDef & { typeName?: string } {
  if (def.typeName === "ZodDefault") {
    return unwrapDefault((def as any).innerType._def);
  }
  if (def.typeName === "ZodOptional") {
    return unwrapDefault((def as any).innerType._def);
  }
  return def;
}

export function schemaToFields(
  schema: z.ZodType,
  parentKey = ""
): FieldDescriptor[] {
  const def = unwrapDefault(schema._def as any);
  const typeName = (def as any).typeName as string;

  if (typeName === "ZodObject") {
    const shape = (def as any).shape?.() ?? (def as any).shape ?? {};
    return Object.keys(shape).map((key) => {
      const childSchema = shape[key];
      const childDef = unwrapDefault(childSchema._def);
      const childType = (childDef as any).typeName as string;
      const fullKey = parentKey ? `${parentKey}.${key}` : key;

      if (childType === "ZodString") {
        return {
          key: fullKey,
          label: keyToLabel(key),
          type: isColorKey(key) ? ("color" as const) : ("text" as const),
        };
      }

      if (childType === "ZodNumber") {
        return {
          key: fullKey,
          label: keyToLabel(key),
          type: "number" as const,
        };
      }

      if (childType === "ZodBoolean") {
        return {
          key: fullKey,
          label: keyToLabel(key),
          type: "boolean" as const,
        };
      }

      if (childType === "ZodEnum") {
        return {
          key: fullKey,
          label: keyToLabel(key),
          type: "enum" as const,
          enumValues: (childDef as any).values as string[],
        };
      }

      if (childType === "ZodArray") {
        const itemSchema = (childDef as any).type;
        const itemDef = unwrapDefault(itemSchema._def);
        const itemType = (itemDef as any).typeName as string;

        let arrayItemFields: FieldDescriptor[] | undefined;
        if (itemType === "ZodObject") {
          arrayItemFields = schemaToFields(itemSchema, "");
        } else if (itemType === "ZodString") {
          arrayItemFields = [
            { key: "value", label: "Value", type: "text" },
          ];
        }

        return {
          key: fullKey,
          label: keyToLabel(key),
          type: "array" as const,
          arrayItemFields,
        };
      }

      if (childType === "ZodObject") {
        return {
          key: fullKey,
          label: keyToLabel(key),
          type: "object" as const,
          children: schemaToFields(childSchema, fullKey),
        };
      }

      return {
        key: fullKey,
        label: keyToLabel(key),
        type: "text" as const,
      };
    });
  }

  return [];
}
