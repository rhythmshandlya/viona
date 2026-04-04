import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { discoverTemplates, discoverThemes } from './lib/discover';
import type { View } from './lib/types';
import { TemplateGallery } from './components/TemplateGallery';
import { TemplateDetail } from './components/TemplateDetail';
import { ThemeBrowser } from './components/ThemeBrowser';
import { t } from './theme';

const TABS = [
  { key: 'gallery', label: 'Templates' },
  { key: 'themes', label: 'Themes' },
] as const;

function viewToHash(view: View): string {
  if (view.type === 'detail') return `#/template/${view.templateId}`;
  if (view.type === 'themes') return view.themeSlug ? `#/themes/${view.themeSlug}` : '#/themes';
  return '#/';
}

function hashToView(hash: string): View {
  const h = hash.replace(/^#\/?/, '');
  if (h.startsWith('template/')) {
    const id = h.slice('template/'.length);
    if (id) return { type: 'detail', templateId: id };
  }
  if (h.startsWith('themes/')) {
    const slug = h.slice('themes/'.length);
    return { type: 'themes', themeSlug: slug || undefined };
  }
  if (h === 'themes') return { type: 'themes' };
  return { type: 'gallery' };
}

export function App() {
  const templates = useMemo(discoverTemplates, []);
  const themes = useMemo(discoverThemes, []);
  const [view, setViewState] = useState<View>(() => hashToView(window.location.hash));

  const setView = useCallback((v: View) => {
    setViewState(v);
    const newHash = viewToHash(v);
    if (window.location.hash !== newHash) {
      window.history.pushState(null, '', newHash);
    }
  }, []);

  useEffect(() => {
    const onPopState = () => setViewState(hashToView(window.location.hash));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const activeTab = view.type === 'themes' ? 'themes' : 'gallery';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        borderBottom: `1px solid ${t.border}`, padding: '0 20px',
        background: t.bgPanel, flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: t.accent, marginRight: 28, padding: '13px 0', letterSpacing: '-0.01em' }}>
          Viona
        </span>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key === 'gallery' ? { type: 'gallery' } : { type: 'themes' })}
            style={{
              padding: '13px 14px', border: 'none', cursor: 'pointer',
              background: 'transparent', fontSize: 12, fontWeight: 600,
              color: activeTab === tab.key ? t.text1 : t.text3,
              borderBottom: activeTab === tab.key ? `2px solid ${t.accent}` : '2px solid transparent',
              transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: t.textMuted }}>
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
        {view.type === 'detail' && (() => {
          const template = templates.find((tpl) => tpl.id === view.templateId);
          if (!template) { setView({ type: 'gallery' }); return null; }
          return (
            <TemplateDetail
              key={template.id}
              template={template}
              themes={themes}
              onBack={() => setView({ type: 'gallery' })}
              onSelectTheme={(slug) => setView({ type: 'themes', themeSlug: slug })}
            />
          );
        })()}
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
