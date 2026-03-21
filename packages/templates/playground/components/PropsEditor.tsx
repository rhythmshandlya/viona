import React, { useMemo } from 'react';
import type { TemplateEntry } from '../lib/types';
import { introspectSchema, type FieldInfo } from '../lib/schema-introspect';
import {
  Section, TextInput, NumberInput, SliderInput, SelectInput,
  ColorInput, Toggle, ButtonGroup, Label, CountrySelect,
  useCountryList, type CountryOption,
} from './ui';

interface PropsEditorProps {
  template: TemplateEntry;
  props: Record<string, any>;
  onUpdateProp: (path: string[], value: any) => void;
  onReset: () => void;
}

export function PropsEditor({ template, props, onUpdateProp, onReset }: PropsEditorProps) {
  const fields = useMemo(() => introspectSchema(template.schema), [template]);
  const countries = useCountryList();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {fields.map((field) => (
        <FieldControl
          key={field.key}
          field={field}
          value={props[field.key]}
          onChange={(v) => onUpdateProp([field.key], v)}
          onPathChange={(path, v) => onUpdateProp([field.key, ...path], v)}
          countries={countries}
          allProps={props}
          onUpdateProp={onUpdateProp}
        />
      ))}
      <button
        onClick={onReset}
        style={{
          marginTop: 16, width: '100%', padding: '7px 0',
          background: 'transparent', border: '1px solid #333',
          borderRadius: 6, color: '#888', fontSize: 12, cursor: 'pointer',
        }}
      >
        Reset to defaults
      </button>
    </div>
  );
}

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
  if (field.type === 'country') {
    return (
      <CountrySelect
        label={field.label} value={value ?? ''} countries={countries}
        onChange={(name, country) => {
          onChange(name);
          if (country && 'countryCode' in allProps) onUpdateProp(['countryCode'], country.iso_a3);
        }}
      />
    );
  }
  if (field.type === 'object' && field.children) {
    return (
      <Section title={field.label}>
        {field.children.map((child) => (
          <FieldControl key={child.key} field={child} value={value?.[child.key]}
            onChange={(v) => onPathChange([child.key], v)}
            onPathChange={(path, v) => onPathChange([child.key, ...path], v)}
            countries={countries} allProps={allProps} onUpdateProp={onUpdateProp} />
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
        <textarea value={JSON.stringify(value ?? [], null, 2)}
          onChange={(e) => { try { onChange(JSON.parse(e.target.value)); } catch {} }}
          style={{ width: '100%', minHeight: 60, background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 6, padding: '6px 10px', color: '#e0e0e0', fontSize: 12, fontFamily: 'monospace', resize: 'vertical' }} />
      </div>
    );
  }
  return null;
}
