import React, { useMemo, useState } from 'react';
import type { TemplateEntry, ThemeDefinition } from '../lib/types';
import { PlayerWrapper } from './PlayerWrapper';
import { t } from '../theme';

interface TemplateGalleryProps {
  templates: TemplateEntry[];
  themes: ThemeDefinition[];
  onSelectTemplate: (id: string) => void;
  onSelectTheme: (slug: string) => void;
}

export function TemplateGallery({ templates, themes, onSelectTemplate, onSelectTheme }: TemplateGalleryProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [themeFilter, setThemeFilter] = useState('');

  const categories = useMemo(
    () => Array.from(new Set(templates.map((tpl) => tpl.category))).sort(),
    [templates],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return templates.filter((tpl) => {
      if (q) {
        const nameMatch = tpl.name.toLowerCase().includes(q);
        const tagMatch = tpl.tags.some((tag) => tag.toLowerCase().includes(q));
        if (!nameMatch && !tagMatch) return false;
      }
      if (categoryFilter && tpl.category !== categoryFilter) return false;
      if (themeFilter) {
        if (themeFilter === '__unthemed__') {
          if (tpl.themes.length !== 0) return false;
        } else {
          if (!tpl.themes.includes(themeFilter)) return false;
        }
      }
      return true;
    });
  }, [templates, search, categoryFilter, themeFilter]);

  const inputStyle: React.CSSProperties = {
    background: t.bgInput,
    border: `1px solid ${t.border}`,
    borderRadius: 6,
    color: t.text1,
    fontSize: 13,
    padding: '8px 12px',
    outline: 'none',
    minWidth: 0,
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 10,
          padding: '12px 20px',
          background: t.bgPanel,
          flexShrink: 0,
          alignItems: 'center',
          flexWrap: 'wrap',
          borderBottom: `1px solid ${t.border}`,
        }}
      >
        <input
          type="text"
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: '1 1 180px' }}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ ...inputStyle, flex: '0 1 auto' }}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <select
          value={themeFilter}
          onChange={(e) => setThemeFilter(e.target.value)}
          style={{ ...inputStyle, flex: '0 1 auto' }}
        >
          <option value="">All Themes</option>
          <option value="__unthemed__">Unthemed</option>
          {themes.map((th) => (
            <option key={th.slug} value={th.slug}>
              {th.name}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 4 }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Card grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
          padding: 20,
          overflowY: 'auto',
          flex: 1,
          alignContent: 'start',
        }}
      >
        {filtered.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            themes={themes}
            onClick={() => onSelectTemplate(template.id)}
            onSelectTheme={onSelectTheme}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: t.text3, fontSize: 14, padding: 40 }}>
            No templates match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  themes,
  onClick,
  onSelectTheme,
}: {
  template: TemplateEntry;
  themes: ThemeDefinition[];
  onClick: () => void;
  onSelectTheme: (slug: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const themeNames = useMemo(() => {
    const map = new Map(themes.map((th) => [th.slug, th.name]));
    return template.themes.map((slug) => map.get(slug) ?? slug);
  }, [template.themes, themes]);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: t.bgPanel,
        borderRadius: 10,
        border: `1px solid ${hovered ? t.accent + '50' : t.border}`,
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: hovered ? `0 0 20px ${t.accent}08` : 'none',
      }}
    >
      {/* Thumbnail — fixed aspect ratio container with lazy-loaded player */}
      <div style={{
        overflow: 'hidden',
        borderRadius: '10px 10px 0 0',
        background: t.bgRaised,
      }}>
        <PlayerWrapper
          template={template}
          props={template.defaultProps}
          aspect="1:1"
          maxWidth={400}
          controls={false}
          autoPlay
          lazy
        />
      </div>

      {/* Info */}
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text1, marginBottom: 4 }}>
          {template.name}
        </div>
        <div
          style={{
            fontSize: 12,
            color: t.text2,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            marginBottom: 8,
            lineHeight: 1.4,
          }}
        >
          {template.description}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          <span
            style={{
              fontSize: 10,
              background: t.bgRaised,
              borderRadius: 4,
              padding: '2px 6px',
              color: t.text3,
              fontWeight: 500,
            }}
          >
            {template.category}
          </span>
          {themeNames.map((name, i) => (
            <span
              key={template.themes[i]}
              onClick={(e) => { e.stopPropagation(); onSelectTheme(template.themes[i]); }}
              style={{
                fontSize: 10,
                background: t.accentSoft,
                borderRadius: 4,
                padding: '2px 6px',
                color: t.accent,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
