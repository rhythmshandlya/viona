import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from '@remotion/player';
import { z } from 'zod';

// ── Template discovery (lazy — broken templates don't crash the app) ────────

const templateImports = import.meta.glob('./.templates/*/index.tsx') as Record<string, () => Promise<{ default: React.FC<any> }>>;
const schemaModules = import.meta.glob('./.templates/*/schema.ts', { eager: true }) as Record<string, { schema: z.ZodObject<any>; defaultProps: any }>;
const metaModules = import.meta.glob('./.templates/*/meta.json', { eager: true }) as Record<string, { default: Record<string, any> }>;

interface TemplateEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  loader: () => Promise<{ default: React.FC<any> }>;
  schema: z.ZodObject<any>;
  defaultProps: Record<string, any>;
  meta: Record<string, any>;
}

function discoverTemplates(): TemplateEntry[] {
  const templates: TemplateEntry[] = [];
  for (const [path, loader] of Object.entries(templateImports)) {
    const slug = path.match(/\.templates\/([^/]+)\//)?.[1];
    if (!slug) continue;

    const schemaMod = schemaModules[`./.templates/${slug}/schema.ts`];
    const metaMod = metaModules[`./.templates/${slug}/meta.json`];
    if (!schemaMod?.schema) continue;

    templates.push({
      id: slug,
      name: metaMod?.default?.name ?? slug,
      description: metaMod?.default?.description ?? '',
      category: metaMod?.default?.category ?? 'uncategorized',
      loader,
      schema: schemaMod.schema,
      defaultProps: schemaMod.defaultProps ?? schemaMod.schema.parse({}),
      meta: metaMod?.default ?? {},
    });
  }
  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Country data (loaded once for dropdowns) ────────────────────────────────

interface CountryOption {
  name: string;
  iso_a3: string;
  iso_a2: string;
  centroid: [number, number];
}

let cachedCountries: CountryOption[] | null = null;

function useCountryList(): CountryOption[] {
  const [countries, setCountries] = useState<CountryOption[]>(cachedCountries ?? []);
  useEffect(() => {
    if (cachedCountries) return;
    fetch('/data/countries.json')
      .then((r) => r.json())
      .then((data: any[]) => {
        const list = data
          .map((c) => ({ name: c.name, iso_a3: c.iso_a3, iso_a2: c.iso_a2, centroid: c.centroid }))
          .sort((a, b) => a.name.localeCompare(b.name));
        cachedCountries = list;
        setCountries(list);
      })
      .catch(() => {});
  }, []);
  return countries;
}

// ── Zod schema introspection ────────────────────────────────────────────────

type FieldType = 'string' | 'number' | 'boolean' | 'enum' | 'color' | 'object' | 'coord' | 'country' | 'array' | 'unknown';

interface FieldInfo {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  children?: FieldInfo[];
}

function unwrapZod(schema: z.ZodTypeAny): { inner: z.ZodTypeAny; defaultValue?: any } {
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

/** Detect if an object field looks like a coordinate {lat, lng, label?} */
function isCoordObject(schema: z.ZodTypeAny): boolean {
  const { inner } = unwrapZod(schema);
  const def = (inner as any)._def;
  if (def.typeName !== 'ZodObject') return false;
  const shape = (inner as z.ZodObject<any>).shape;
  return 'lat' in shape && 'lng' in shape;
}

/** Infer smart number bounds from field name when Zod has no constraints */
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

  // Fallback: use schema bounds or generic range
  return {
    min: schemaBounds.min ?? 0,
    max: schemaBounds.max ?? 100,
    step: 1,
  };
}

/** Detect if a string field should be a country selector */
function isCountryField(key: string): boolean {
  const k = key.toLowerCase();
  return k === 'countryname' || k === 'country_name' || k === 'country';
}

function introspectSchema(schema: z.ZodObject<any>): FieldInfo[] {
  const shape = schema.shape;
  const fields: FieldInfo[] = [];

  for (const [key, rawField] of Object.entries(shape)) {
    const { inner } = unwrapZod(rawField as z.ZodTypeAny);
    const def = (inner as any)._def;

    // Coord object {lat, lng, label?}
    if (isCoordObject(rawField as z.ZodTypeAny)) {
      fields.push({ key, label: toLabel(key), type: 'coord' });
      continue;
    }

    if (def.typeName === 'ZodObject') {
      fields.push({
        key, label: toLabel(key), type: 'object',
        children: introspectSchema(inner as z.ZodObject<any>),
      });
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

function toLabel(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (s) => s.toUpperCase());
}

// ── Error boundary for broken templates ─────────────────────────────────────

class TemplateBoundary extends React.Component<
  { templateId: string; children: React.ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(err: Error) { return { error: err.message }; }
  componentDidUpdate(prev: { templateId: string }) {
    if (prev.templateId !== this.props.templateId) this.setState({ error: null });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ color: '#ef4444', fontSize: 13, textAlign: 'center', maxWidth: 400, lineHeight: 1.6, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Template render error</div>
          <code style={{ color: '#f87171', fontSize: 12, wordBreak: 'break-word' }}>{this.state.error}</code>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Aspect / Duration ───────────────────────────────────────────────────────

const ASPECTS = {
  '1:1': { width: 1080, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
} as const;

const DURATIONS = [6, 12, 20, 30];

// ── Main ────────────────────────────────────────────────────────────────────

function Playground() {
  const templates = useMemo(discoverTemplates, []);
  const countries = useCountryList();
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [aspect, setAspect] = useState<keyof typeof ASPECTS>('1:1');
  const [duration, setDuration] = useState(12);
  const [propsMap, setPropsMap] = useState<Record<string, Record<string, any>>>(() => {
    const map: Record<string, Record<string, any>> = {};
    for (const t of templates) map[t.id] = { ...t.defaultProps };
    return map;
  });

  const [loadedComponents, setLoadedComponents] = useState<Record<string, React.FC<any>>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  const template = templates.find((t) => t.id === selectedId);
  const loadedComponent = template ? loadedComponents[template.id] : undefined;

  useEffect(() => {
    if (!template) return;
    if (loadedComponents[template.id]) { setLoadError(null); return; }
    setLoadError(null);
    template.loader()
      .then((mod) => setLoadedComponents((prev) => ({ ...prev, [template.id]: mod.default })))
      .catch((err) => setLoadError(`Failed to load "${template.name}": ${err.message}`));
  }, [template?.id]);

  const props = template ? propsMap[template.id] : {};
  const fields = useMemo(() => (template ? introspectSchema(template.schema) : []), [template]);
  const dims = ASPECTS[aspect];
  const fps = 30;

  const updateProp = useCallback(
    (path: string[], value: any) => {
      if (!template) return;
      setPropsMap((prev) => {
        const current = { ...prev[template.id] };
        if (path.length === 1) {
          current[path[0]] = value;
        } else if (path.length === 2) {
          current[path[0]] = { ...(current[path[0]] ?? {}), [path[1]]: value };
        } else if (path.length === 3) {
          const top = { ...(current[path[0]] ?? {}) };
          top[path[1]] = { ...(top[path[1]] ?? {}), [path[2]]: value };
          current[path[0]] = top;
        }
        return { ...prev, [template.id]: current };
      });
    },
    [template],
  );

  const resetProps = useCallback(() => {
    if (!template) return;
    setPropsMap((prev) => ({ ...prev, [template.id]: { ...template.defaultProps } }));
  }, [template]);

  const filtered = search
    ? templates.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.meta.tags?.some((tag: string) => tag.includes(search.toLowerCase())),
      )
    : templates;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* ── Left: Template list ── */}
      <div style={{ width: 340, display: 'flex', flexDirection: 'column', borderRight: '1px solid #1e1e2e', flexShrink: 0 }}>
        <div style={{ padding: '16px 14px 8px' }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: '#8B5CF6', marginBottom: 10 }}>Templates</h1>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            style={{ width: '100%', background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 6, padding: '6px 10px', color: '#e0e0e0', fontSize: 13, outline: 'none' }}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 14px 14px' }}>
          {filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: 2,
                borderRadius: 6, border: 'none', cursor: 'pointer',
                background: t.id === selectedId ? '#8B5CF620' : 'transparent',
                color: t.id === selectedId ? '#c4b5fd' : '#999',
                fontSize: 13, fontWeight: t.id === selectedId ? 600 : 400,
              }}
            >
              {t.name}
              <span style={{ display: 'block', fontSize: 11, color: '#666', marginTop: 1 }}>{t.category}</span>
            </button>
          ))}
          {filtered.length === 0 && <div style={{ color: '#555', fontSize: 12, padding: 8 }}>No templates found</div>}
        </div>
      </div>

      {/* ── Center: Player ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#08080c', padding: 40, flexDirection: 'column', gap: 16 }}>
        {loadError ? (
          <div style={{ color: '#ef4444', fontSize: 14, textAlign: 'center', maxWidth: 400, lineHeight: 1.5 }}>{loadError}</div>
        ) : template && loadedComponent ? (
          <TemplateBoundary templateId={template.id}>
            <Player
              key={`${template.id}-${aspect}`}
              component={loadedComponent}
              inputProps={props}
              durationInFrames={duration * fps}
              compositionWidth={dims.width}
              compositionHeight={dims.height}
              fps={fps}
              style={{
                width: '100%',
                maxWidth: aspect === '16:9' ? 900 : aspect === '1:1' ? 600 : 400,
                borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 40px rgba(0,0,0,0.6)',
              }}
              controls autoPlay loop
            />
          </TemplateBoundary>
        ) : template ? (
          <div style={{ color: '#888', fontSize: 14 }}>Loading template...</div>
        ) : (
          <div style={{ color: '#555', fontSize: 16 }}>No template selected</div>
        )}
      </div>

      {/* ── Right: Controls ── */}
      <div style={{ width: 380, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #1e1e2e', flexShrink: 0 }}>
        <div style={{ padding: '16px 14px 8px' }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {template?.name ?? 'Controls'}
          </h2>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 14px 14px' }}>
          <Section title="Playback">
            <ButtonGroup options={Object.keys(ASPECTS)} value={aspect} onChange={(v) => setAspect(v as keyof typeof ASPECTS)} />
            <ButtonGroup options={DURATIONS.map((d) => `${d}s`)} value={`${duration}s`} onChange={(v) => setDuration(parseInt(v))} />
          </Section>

          {template && (
            <>
              {fields.map((field) => (
                <FieldControl
                  key={field.key}
                  field={field}
                  value={props[field.key]}
                  onChange={(v) => updateProp([field.key], v)}
                  onPathChange={(path, v) => updateProp([field.key, ...path], v)}
                  countries={countries}
                  allProps={props}
                  onUpdateProp={updateProp}
                />
              ))}
              <button
                onClick={resetProps}
                style={{ marginTop: 16, width: '100%', padding: '7px 0', background: 'transparent', border: '1px solid #333', borderRadius: 6, color: '#888', fontSize: 12, cursor: 'pointer' }}
              >
                Reset to defaults
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Schema-driven field renderer ────────────────────────────────────────────

function FieldControl({
  field, value, onChange, onPathChange, countries, allProps, onUpdateProp,
}: {
  field: FieldInfo;
  value: any;
  onChange: (v: any) => void;
  onPathChange: (path: string[], v: any) => void;
  countries: CountryOption[];
  allProps: Record<string, any>;
  onUpdateProp: (path: string[], v: any) => void;
}) {
  // ── Coordinate object {lat, lng, label?} ──
  if (field.type === 'coord') {
    const coord = value ?? { lat: 0, lng: 0 };
    return (
      <Section title={field.label}>
        {coord.label !== undefined && (
          <TextInput label="Label" value={coord.label ?? ''} onChange={(v) => onChange({ ...coord, label: v })} />
        )}
        <NumberInput label="Latitude" value={coord.lat ?? 0} min={-90} max={90} step={0.01} onChange={(v) => onChange({ ...coord, lat: v })} />
        <NumberInput label="Longitude" value={coord.lng ?? 0} min={-180} max={180} step={0.01} onChange={(v) => onChange({ ...coord, lng: v })} />
      </Section>
    );
  }

  // ── Country dropdown ──
  if (field.type === 'country') {
    return (
      <CountrySelect
        label={field.label}
        value={value ?? ''}
        countries={countries}
        onChange={(name, country) => {
          onChange(name);
          // Auto-fill countryCode if it exists in props
          if (country && 'countryCode' in allProps) {
            onUpdateProp(['countryCode'], country.iso_a3);
          }
        }}
      />
    );
  }

  // ── Nested object ──
  if (field.type === 'object' && field.children) {
    return (
      <Section title={field.label}>
        {field.children.map((child) => (
          <FieldControl
            key={child.key}
            field={child}
            value={value?.[child.key]}
            onChange={(v) => onPathChange([child.key], v)}
            onPathChange={(path, v) => onPathChange([child.key, ...path], v)}
            countries={countries}
            allProps={allProps}
            onUpdateProp={onUpdateProp}
          />
        ))}
      </Section>
    );
  }

  if (field.type === 'boolean') return <Toggle label={field.label} value={!!value} onChange={onChange} />;

  if (field.type === 'enum' && field.options) {
    if (field.options.length <= 4) {
      return (<div><Label>{field.label}</Label><ButtonGroup options={field.options} value={value ?? ''} onChange={onChange} /></div>);
    }
    return <SelectInput label={field.label} value={value ?? ''} options={field.options} onChange={onChange} />;
  }

  if (field.type === 'color') return <ColorInput label={field.label} value={value ?? '#000000'} onChange={onChange} />;

  if (field.type === 'number') {
    return <SliderInput label={field.label} value={value ?? 0} min={field.min ?? 0} max={field.max ?? 100} step={field.step ?? 1} onChange={onChange} />;
  }

  if (field.type === 'string') return <TextInput label={field.label} value={value ?? ''} onChange={onChange} />;

  if (field.type === 'array') {
    return (
      <div style={{ marginBottom: 8 }}>
        <Label>{field.label} (array)</Label>
        <textarea
          value={JSON.stringify(value ?? [], null, 2)}
          onChange={(e) => { try { onChange(JSON.parse(e.target.value)); } catch {} }}
          style={{ width: '100%', minHeight: 60, background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 6, padding: '6px 10px', color: '#e0e0e0', fontSize: 12, fontFamily: 'monospace', resize: 'vertical' }}
        />
      </div>
    );
  }

  return null;
}

// ── UI Primitives ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#666', marginBottom: 6 }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 12, color: '#888', marginBottom: 2, display: 'block' }}>{children}</span>;
}

function ButtonGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {options.map((o) => (
        <button
          key={o} onClick={() => onChange(o)}
          style={{
            flex: 1, padding: '5px 0', border: '1px solid',
            borderColor: o === value ? '#8B5CF6' : '#2a2a3e', borderRadius: 5,
            background: o === value ? '#8B5CF620' : 'transparent',
            color: o === value ? '#c4b5fd' : '#777',
            cursor: 'pointer', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >{o}</button>
      ))}
    </div>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Label>{label}</Label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        style={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 5, padding: '5px 8px', color: '#e0e0e0', fontSize: 13 }} />
    </label>
  );
}

function NumberInput({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Label>{label}</Label>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          type="number" value={value} min={min} max={max} step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 5, padding: '5px 8px', color: '#e0e0e0', fontSize: 13, width: 80 }}
        />
        <input
          type="range" value={value} min={min} max={max} step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 2, accentColor: '#8B5CF6' }}
        />
      </div>
    </label>
  );
}

function SelectInput({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Label>{label}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 5, padding: '5px 8px', color: '#e0e0e0', fontSize: 13 }}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function CountrySelect({ label, value, countries, onChange }: {
  label: string; value: string; countries: CountryOption[];
  onChange: (name: string, country: CountryOption | undefined) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = searchTerm
    ? countries.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : countries;

  return (
    <div style={{ marginBottom: 8, position: 'relative' }}>
      <Label>{label}</Label>
      <div
        onClick={() => setOpen(!open)}
        style={{
          background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 5, padding: '5px 8px',
          color: '#e0e0e0', fontSize: 13, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <span>{value || 'Select country...'}</span>
        <span style={{ color: '#666', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 6,
          maxHeight: 250, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          <input
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type to filter..."
            style={{ background: '#12121f', border: 'none', borderBottom: '1px solid #2a2a3e', padding: '6px 10px', color: '#e0e0e0', fontSize: 13, outline: 'none' }}
          />
          <div style={{ overflowY: 'auto', maxHeight: 200 }}>
            {filtered.slice(0, 50).map((c) => (
              <div
                key={c.iso_a3}
                onClick={() => { onChange(c.name, c); setOpen(false); setSearchTerm(''); }}
                style={{
                  padding: '5px 10px', cursor: 'pointer', fontSize: 13,
                  color: c.name === value ? '#c4b5fd' : '#ccc',
                  background: c.name === value ? '#8B5CF620' : 'transparent',
                }}
                onMouseEnter={(e) => { (e.target as HTMLDivElement).style.background = '#8B5CF610'; }}
                onMouseLeave={(e) => { (e.target as HTMLDivElement).style.background = c.name === value ? '#8B5CF620' : 'transparent'; }}
              >
                {c.name} <span style={{ color: '#555', fontSize: 11 }}>{c.iso_a3}</span>
              </div>
            ))}
            {filtered.length === 0 && <div style={{ padding: '8px 10px', color: '#555', fontSize: 12 }}>No countries found</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function SliderInput({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Label>{label}</Label>
        <span style={{ fontSize: 11, color: '#8B5CF6', fontFamily: 'monospace' }}>{step < 1 ? value.toFixed(2) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} style={{ accentColor: '#8B5CF6' }} />
    </label>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: 28, height: 22, border: '1px solid #2a2a3e', borderRadius: 4, cursor: 'pointer', background: 'transparent' }} />
      <span style={{ fontSize: 12, color: '#888' }}>{label}</span>
      <span style={{ fontSize: 11, color: '#555', fontFamily: 'monospace', marginLeft: 'auto' }}>{value}</span>
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <div onClick={() => onChange(!value)}
        style={{ width: 32, height: 18, borderRadius: 9, background: value ? '#8B5CF6' : '#2a2a3e', position: 'relative', transition: 'background 0.15s', flexShrink: 0 }}
      >
        <div style={{ width: 14, height: 14, borderRadius: 7, background: 'white', position: 'absolute', top: 2, left: value ? 16 : 2, transition: 'left 0.15s' }} />
      </div>
      <span style={{ fontSize: 13, color: '#aaa' }}>{label}</span>
    </label>
  );
}

// ── Mount ───────────────────────────────────────────────────────────────────

const root = createRoot(document.getElementById('root')!);
root.render(<Playground />);
