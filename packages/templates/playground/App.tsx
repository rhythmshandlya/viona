import React, { useState, useMemo } from 'react';
import { discoverTemplates, discoverThemes } from './lib/discover';
import type { View } from './lib/types';
import { TemplateGallery } from './components/TemplateGallery';
import { TemplateDetail } from './components/TemplateDetail';
import { ThemeBrowser } from './components/ThemeBrowser';

const TABS = [
  { key: 'gallery', label: 'Templates' },
  { key: 'themes', label: 'Themes' },
] as const;

export function App() {
  const templates = useMemo(discoverTemplates, []);
  const themes = useMemo(discoverThemes, []);
  const [view, setView] = useState<View>({ type: 'gallery' });

  const activeTab = view.type === 'themes' ? 'themes' : 'gallery';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        borderBottom: '1px solid #1e1e2e', padding: '0 16px',
        background: '#0c0c14', flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#8B5CF6', marginRight: 24, padding: '12px 0' }}>
          Viona Templates
        </span>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key === 'gallery' ? { type: 'gallery' } : { type: 'themes' })}
            style={{
              padding: '12px 16px', border: 'none', cursor: 'pointer',
              background: 'transparent', fontSize: 13, fontWeight: 500,
              color: activeTab === tab.key ? '#c4b5fd' : '#666',
              borderBottom: activeTab === tab.key ? '2px solid #8B5CF6' : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: '#444' }}>
          {templates.length} templates · {themes.length} themes
        </span>
      </div>

      {/* View content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {view.type === 'gallery' && (
          <TemplateGallery
            templates={templates}
            themes={themes}
            onSelectTemplate={(id) => setView({ type: 'detail', templateId: id })}
            onSelectTheme={(slug) => setView({ type: 'themes', themeSlug: slug })}
          />
        )}
        {view.type === 'detail' && (
          <TemplateDetail
            template={templates.find((t) => t.id === view.templateId)!}
            themes={themes}
            onBack={() => setView({ type: 'gallery' })}
            onSelectTheme={(slug) => setView({ type: 'themes', themeSlug: slug })}
          />
        )}
        {view.type === 'themes' && (
          <ThemeBrowser
            themes={themes}
            templates={templates}
            initialThemeSlug={view.themeSlug}
            onSelectTemplate={(id) => setView({ type: 'detail', templateId: id })}
          />
        )}
      </div>
    </div>
  );
}
