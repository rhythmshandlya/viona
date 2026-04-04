import React, { useState, useEffect } from 'react';
import type { TemplateEntry, ThemeDefinition } from '../lib/types';
import { PaletteSwatches } from './PaletteSwatches';
import { PlayerWrapper } from './PlayerWrapper';
import { t } from '../theme';

interface ThemeBrowserProps {
  themes: ThemeDefinition[];
  templates: TemplateEntry[];
  initialThemeSlug?: string;
  onSelectTemplate: (id: string) => void;
}

export function ThemeBrowser({ themes, templates, initialThemeSlug, onSelectTemplate }: ThemeBrowserProps) {
  const [selectedSlug, setSelectedSlug] = useState<string>(
    initialThemeSlug ?? themes[0]?.slug ?? '',
  );

  useEffect(() => {
    if (initialThemeSlug) {
      setSelectedSlug(initialThemeSlug);
    }
  }, [initialThemeSlug]);

  const selectedTheme = themes.find((th) => th.slug === selectedSlug);
  const themedTemplates = templates.filter((tpl) => tpl.themes.includes(selectedSlug));

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100%', background: t.bgPage }}>
      {/* Left sidebar */}
      <div
        style={{
          width: 280,
          minWidth: 280,
          height: '100%',
          overflowY: 'auto',
          background: t.bgPanel,
          borderRight: `1px solid ${t.border}`,
        }}
      >
        {themes.map((theme) => (
          <div
            key={theme.slug}
            onClick={() => setSelectedSlug(theme.slug)}
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              background: theme.slug === selectedSlug ? t.accentSoft : 'transparent',
              borderLeft: theme.slug === selectedSlug ? `3px solid ${t.accent}` : '3px solid transparent',
              transition: 'background 0.1s',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: t.text1, marginBottom: 4 }}>
              {theme.name}
            </div>
            <div
              style={{
                fontSize: 12,
                color: t.text2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {theme.description}
            </div>
          </div>
        ))}
      </div>

      {/* Center panel */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {selectedTheme ? (
          <>
            <h2 style={{ fontSize: 20, color: t.text1, marginTop: 0, marginBottom: 12 }}>
              {selectedTheme.name}
            </h2>

            <p style={{ fontSize: 14, color: t.text2, lineHeight: 1.6, marginBottom: 20 }}>
              {selectedTheme.description}
            </p>

            {/* Style guidance */}
            <div
              style={{
                background: t.bgPanel,
                borderLeft: `3px solid ${t.accent}`,
                padding: '12px 16px',
                fontStyle: 'italic',
                color: t.text2,
                fontSize: 13,
                marginBottom: 24,
                lineHeight: 1.6,
                borderRadius: '0 6px 6px 0',
              }}
            >
              {selectedTheme.styleGuidance}
            </div>

            {/* Palette */}
            <div style={{ marginBottom: 24 }}>
              <h3
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: t.text3,
                  marginBottom: 10,
                }}
              >
                Color Palette
              </h3>
              <PaletteSwatches palette={selectedTheme.colorPalette} />
            </div>

            {/* Font recommendations */}
            <div style={{ marginBottom: 24 }}>
              <h3
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: t.text3,
                  marginBottom: 10,
                }}
              >
                Font Recommendations
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(selectedTheme.fontRecommendations).map(([key, font]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <span style={{ fontSize: 12, color: t.text2, minWidth: 80 }}>{key}</span>
                    <span style={{ fontSize: 14, color: t.text1 }}>{font}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Themed templates grid */}
            <div>
              <h3
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: t.text3,
                  marginBottom: 12,
                }}
              >
                Templates
              </h3>
              {themedTemplates.length > 0 ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: 16,
                  }}
                >
                  {themedTemplates.map((template) => (
                    <div
                      key={template.id}
                      onClick={() => onSelectTemplate(template.id)}
                      style={{
                        background: t.bgPanel,
                        borderRadius: 8,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: `1px solid ${t.border}`,
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = t.accent + '50'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = t.border; }}
                    >
                      <div style={{ maxWidth: 240, background: t.bgRaised }}>
                        <PlayerWrapper
                          template={template}
                          props={template.defaultProps}
                          aspect="1:1"
                          duration={12}
                          maxWidth={240}
                          controls={false}
                          autoPlay
                          lazy
                        />
                      </div>
                      <div style={{ padding: '10px 12px', fontSize: 13, color: t.text1 }}>
                        {template.name}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: t.text3, fontStyle: 'italic' }}>
                  No templates assigned to this theme yet
                </p>
              )}
            </div>
          </>
        ) : (
          <p style={{ color: t.text3, fontSize: 14 }}>Select a theme from the sidebar</p>
        )}
      </div>
    </div>
  );
}
