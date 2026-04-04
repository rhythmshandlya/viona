import React, { useState, useEffect } from 'react';
import { t } from '../theme';

// ── Country Data ─────────────────────────────────────────────────────────────

export interface CountryOption {
  name: string;
  iso_a3: string;
  iso_a2: string;
  centroid: [number, number];
}

let cachedCountries: CountryOption[] | null = null;

export function useCountryList(): CountryOption[] {
  const [countries, setCountries] = React.useState<CountryOption[]>(cachedCountries ?? []);
  React.useEffect(() => {
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

// ── UI Primitives ────────────────────────────────────────────────────────────

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: t.text3, marginBottom: 6 }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 12, color: t.text2, marginBottom: 2, display: 'block' }}>{children}</span>;
}

export function ButtonGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {options.map((o) => (
        <button
          key={o} onClick={() => onChange(o)}
          style={{
            flex: 1, padding: '5px 0', border: '1px solid',
            borderColor: o === value ? t.accent : t.border, borderRadius: 5,
            background: o === value ? t.accentSoft : 'transparent',
            color: o === value ? t.accentText : t.text3,
            cursor: 'pointer', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            transition: 'all 0.15s',
          }}
        >{o}</button>
      ))}
    </div>
  );
}

export function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Label>{label}</Label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        style={{ background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 5, padding: '5px 8px', color: t.text1, fontSize: 13, transition: 'border-color 0.15s' }} />
    </label>
  );
}

export function NumberInput({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Label>{label}</Label>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          type="number" value={value} min={min} max={max} step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 5, padding: '5px 8px', color: t.text1, fontSize: 13, width: 80, transition: 'border-color 0.15s' }}
        />
        <input
          type="range" value={value} min={min} max={max} step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 2, accentColor: t.accent }}
        />
      </div>
    </label>
  );
}

export function SliderInput({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Label>{label}</Label>
        <span style={{ fontSize: 11, color: t.accent, fontFamily: 'monospace' }}>{step < 1 ? value.toFixed(2) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} style={{ accentColor: t.accent }} />
    </label>
  );
}

export function SelectInput({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Label>{label}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 5, padding: '5px 8px', color: t.text1, fontSize: 13, transition: 'border-color 0.15s' }}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

export function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: 28, height: 22, border: `1px solid ${t.border}`, borderRadius: 4, cursor: 'pointer', background: 'transparent' }} />
      <span style={{ fontSize: 12, color: t.text2 }}>{label}</span>
      <span style={{ fontSize: 11, color: t.text3, fontFamily: 'monospace', marginLeft: 'auto' }}>{value}</span>
    </label>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <div onClick={() => onChange(!value)}
        style={{ width: 32, height: 18, borderRadius: 9, background: value ? t.accent : t.border, position: 'relative', transition: 'background 0.15s', flexShrink: 0 }}
      >
        <div style={{ width: 14, height: 14, borderRadius: 7, background: 'white', position: 'absolute', top: 2, left: value ? 16 : 2, transition: 'left 0.15s' }} />
      </div>
      <span style={{ fontSize: 13, color: t.text2 }}>{label}</span>
    </label>
  );
}

export function CountrySelect({ label, value, countries, onChange }: {
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
          background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: 5, padding: '5px 8px',
          color: value ? t.text1 : t.text3, fontSize: 13, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          transition: 'border-color 0.15s',
        }}
      >
        <span>{value || 'Select country...'}</span>
        <span style={{ color: t.text3, fontSize: 10 }}>{open ? '\u25B2' : '\u25BC'}</span>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: t.bgPanel, border: `1px solid ${t.border}`, borderRadius: 6,
          maxHeight: 250, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        }}>
          <input
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Type to filter..."
            style={{ background: t.bgInput, border: 'none', borderBottom: `1px solid ${t.border}`, padding: '6px 10px', color: t.text1, fontSize: 13, outline: 'none' }}
          />
          <div style={{ overflowY: 'auto', maxHeight: 200 }}>
            {filtered.slice(0, 50).map((c) => (
              <div
                key={c.iso_a3}
                onClick={() => { onChange(c.name, c); setOpen(false); setSearchTerm(''); }}
                style={{
                  padding: '5px 10px', cursor: 'pointer', fontSize: 13,
                  color: c.name === value ? t.accentText : t.text1,
                  background: c.name === value ? t.accentSoft : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { (e.target as HTMLDivElement).style.background = t.accentSoft; }}
                onMouseLeave={(e) => { (e.target as HTMLDivElement).style.background = c.name === value ? t.accentSoft : 'transparent'; }}
              >
                {c.name} <span style={{ color: t.text3, fontSize: 11 }}>{c.iso_a3}</span>
              </div>
            ))}
            {filtered.length === 0 && <div style={{ padding: '8px 10px', color: t.text3, fontSize: 12 }}>No countries found</div>}
          </div>
        </div>
      )}
    </div>
  );
}
