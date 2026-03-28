import { z } from 'zod';

export type FieldType =
  | 'string' | 'number' | 'boolean' | 'enum' | 'color'
  | 'object' | 'coord' | 'country' | 'array' | 'unknown';

export interface FieldInfo {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  children?: FieldInfo[];
}

export function unwrapZod(schema: z.ZodTypeAny): { inner: z.ZodTypeAny; defaultValue?: any } {
  const def = (schema as any)._def;
  if (def.typeName === 'ZodDefault') {
    const unwrapped = unwrapZod(def.innerType);
    return { inner: unwrapped.inner, defaultValue: def.defaultValue() };
  }
  if (def.typeName === 'ZodOptional') {
    return unwrapZod(def.innerType);
  }
  return { inner: schema };
}

function isColorField(key: string, schema: z.ZodTypeAny): boolean {
  const { inner } = unwrapZod(schema);
  const def = (inner as any)._def;
  if (def.typeName !== 'ZodString') return false;
  const colorKeys = ['color', 'background', 'fill', 'stroke', 'highlight', 'tint', 'accent', 'primary', 'secondary', 'text'];
  return colorKeys.some((k) => key.toLowerCase().includes(k));
}

function extractNumberBounds(schema: z.ZodTypeAny): { min?: number; max?: number } {
  const { inner } = unwrapZod(schema);
  const checks = (inner as any)._def.checks as Array<{ kind: string; value: number }> | undefined;
  let min: number | undefined;
  let max: number | undefined;
  for (const check of checks ?? []) {
    if (check.kind === 'min') min = check.value;
    if (check.kind === 'max') max = check.value;
  }
  return { min, max };
}

function isCoordObject(schema: z.ZodTypeAny): boolean {
  const { inner } = unwrapZod(schema);
  const def = (inner as any)._def;
  if (def.typeName !== 'ZodObject') return false;
  const shape = (inner as z.ZodObject<any>).shape;
  return 'lat' in shape && 'lng' in shape;
}

function inferNumberBounds(key: string, schemaBounds: { min?: number; max?: number }): { min: number; max: number; step: number } {
  if (schemaBounds.min !== undefined && schemaBounds.max !== undefined) {
    const isFloat = schemaBounds.max <= 1 && schemaBounds.min >= 0;
    return { min: schemaBounds.min, max: schemaBounds.max, step: isFloat ? 0.01 : 1 };
  }
  const k = key.toLowerCase();
  if (k.includes('lat')) return { min: -90, max: 90, step: 0.1 };
  if (k.includes('lng') || k.includes('lon')) return { min: -180, max: 180, step: 0.1 };
  if (k.includes('opacity') || k.includes('alpha') || k.includes('intensity')) return { min: 0, max: 1, step: 0.01 };
  if (k.includes('size') || k.includes('fontsize') || k.includes('font_size')) return { min: 1, max: 200, step: 1 };
  if (k.includes('width') && !k.includes('viewport')) return { min: 1, max: 20, step: 1 };
  if (k.includes('radius')) return { min: 0, max: 100, step: 1 };
  if (k.includes('padding') || k.includes('margin')) return { min: 0, max: 400, step: 1 };
  if (k.includes('altitude')) return { min: 0.5, max: 5, step: 0.1 };
  if (k.includes('rotation') || k.includes('angle')) return { min: 0, max: 360, step: 1 };
  if (k.includes('zoom')) return { min: 1, max: 20, step: 0.5 };
  if (k.includes('speed')) return { min: 0.1, max: 10, step: 0.1 };
  if (k.includes('count') || k.includes('number')) return { min: 0, max: 100, step: 1 };
  return { min: schemaBounds.min ?? 0, max: schemaBounds.max ?? 100, step: 1 };
}

function isCountryField(key: string): boolean {
  const k = key.toLowerCase();
  return k === 'countryname' || k === 'country_name' || k === 'country';
}

function toLabel(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (s) => s.toUpperCase());
}

export function introspectSchema(schema: z.ZodObject<any>): FieldInfo[] {
  const shape = schema.shape;
  const fields: FieldInfo[] = [];

  for (const [key, rawField] of Object.entries(shape)) {
    const { inner } = unwrapZod(rawField as z.ZodTypeAny);
    const def = (inner as any)._def;

    if (isCoordObject(rawField as z.ZodTypeAny)) {
      fields.push({ key, label: toLabel(key), type: 'coord' });
      continue;
    }
    if (def.typeName === 'ZodObject') {
      fields.push({ key, label: toLabel(key), type: 'object', children: introspectSchema(inner as z.ZodObject<any>) });
    } else if (def.typeName === 'ZodEnum') {
      fields.push({ key, label: toLabel(key), type: 'enum', options: def.values });
    } else if (def.typeName === 'ZodBoolean') {
      fields.push({ key, label: toLabel(key), type: 'boolean' });
    } else if (def.typeName === 'ZodNumber') {
      const schemaBounds = extractNumberBounds(rawField as z.ZodTypeAny);
      const { min, max, step } = inferNumberBounds(key, schemaBounds);
      fields.push({ key, label: toLabel(key), type: 'number', min, max, step });
    } else if (def.typeName === 'ZodString') {
      if (isColorField(key, rawField as z.ZodTypeAny)) {
        fields.push({ key, label: toLabel(key), type: 'color' });
      } else if (isCountryField(key)) {
        fields.push({ key, label: toLabel(key), type: 'country' });
      } else {
        fields.push({ key, label: toLabel(key), type: 'string' });
      }
    } else if (def.typeName === 'ZodArray') {
      fields.push({ key, label: toLabel(key), type: 'array' });
    } else {
      fields.push({ key, label: toLabel(key), type: 'unknown' });
    }
  }
  return fields;
}
