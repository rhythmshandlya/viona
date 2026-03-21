import React, { useMemo, useState } from 'react';
import type { TemplateEntry, ThemeDefinition } from '../lib/types';
import { PlayerWrapper } from './PlayerWrapper';

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
    () => Array.from(new Set(templates.map((t) => t.category))).sort(),
    [templates],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return templates.filter((t) => {
      // Search filter
      if (q) {
        const nameMatch = t.name.toLowerCase().includes(q);
        const tagMatch = t.tags.some((tag) => tag.toLowerCase().includes(q));
        if (!nameMatch && !tagMatch) return false;
      }
      // Category filter
      if (categoryFilter && t.category !== categoryFilter) return false;
      // Theme filter
      if (themeFilter) {
        if (themeFilter === '__unthemed__') {
          if (t.themes.length !== 0) return false;
        } else {
          if (!t.themes.includes(themeFilter)) return false;
        }
      }
      return true;
    });
  }, [templates, search, categoryFilter, themeFilter]);

  const inputStyle: React.CSSProperties = {
    background: '#1a1a2e',
    border: '1px solid #2a2a3e',
    borderRadius: 6,
    color: '#e0e0e0',
    fontSize: 13,
    padding: '8px 12px',
    outline: 'none',
    minWidth: 0,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 10,
          padding: '14px 20px',
          background: '#0c0c14',
          flexShrink: 0,
          alignItems: 'center',
          flexWrap: 'wrap',
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
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#666', fontSize: 14, padding: 40 }}>
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
    const map = new Map(themes.map((t) => [t.slug, t.name]));
    return template.themes.map((slug) => map.get(slug) ?? slug);
  }, [template.themes, themes]);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#12121f',
        borderRadius: 10,
        border: `1px solid ${hovered ? '#8B5CF640' : '#1e1e2e'}`,
        cursor: 'pointer',
        transition: 'border-color 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Thumbnail */}
      <div style={{ overflow: 'hidden', borderRadius: '10px 10px 0 0' }}>
        <PlayerWrapper
          template={template}
          props={template.defaultProps}
          aspect="1:1"
          duration={12}
          maxWidth={400}
          controls={false}
          autoPlay={false}
        />
      </div>

      {/* Info */}
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e0e0e0', marginBottom: 4 }}>
          {template.name}
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#888',
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
              background: '#1e1e2e',
              borderRadius: 4,
              padding: '2px 6px',
              color: '#666',
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
                background: '#8B5CF620',
                borderRadius: 4,
                padding: '2px 6px',
                color: '#8B5CF6',
                cursor: 'pointer',
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
