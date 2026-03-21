import React, { useState, useEffect } from 'react';
import type { TemplateEntry, ThemeDefinition } from '../lib/types';
import { PaletteSwatches } from './PaletteSwatches';
import { PlayerWrapper } from './PlayerWrapper';

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

  const selectedTheme = themes.find((t) => t.slug === selectedSlug);
  const themedTemplates = templates.filter((t) => t.themes.includes(selectedSlug));

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100%', background: '#0a0a14' }}>
      {/* Left sidebar */}
      <div
        style={{
          width: 280,
          minWidth: 280,
          height: '100%',
          overflowY: 'auto',
          background: '#0c0c14',
          borderRight: '1px solid #1e1e2e',
        }}
      >
        {themes.map((theme) => (
          <div
            key={theme.slug}
            onClick={() => setSelectedSlug(theme.slug)}
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              background: theme.slug === selectedSlug ? '#8B5CF620' : 'transparent',
              borderLeft: theme.slug === selectedSlug ? '3px solid #8B5CF6' : '3px solid transparent',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 'bold', color: '#e0e0e0', marginBottom: 4 }}>
              {theme.name}
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#888',
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
            <h2 style={{ fontSize: 20, color: '#e0e0e0', marginTop: 0, marginBottom: 12 }}>
              {selectedTheme.name}
            </h2>

            <p style={{ fontSize: 14, color: '#999', lineHeight: 1.6, marginBottom: 20 }}>
              {selectedTheme.description}
            </p>

            {/* Style guidance */}
            <div
              style={{
                background: '#1a1a2e',
                borderLeft: '3px solid #8B5CF6',
                padding: '12px 16px',
                fontStyle: 'italic',
                color: '#aaa',
                fontSize: 13,
                marginBottom: 24,
                lineHeight: 1.6,
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
                  color: '#666',
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
                  color: '#666',
                  marginBottom: 10,
                }}
              >
                Font Recommendations
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(selectedTheme.fontRecommendations).map(([key, font]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <span style={{ fontSize: 12, color: '#888', minWidth: 80 }}>{key}</span>
                    <span style={{ fontSize: 14, color: '#e0e0e0' }}>{font}</span>
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
                  color: '#666',
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
                        background: '#12121f',
                        borderRadius: 8,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: '1px solid #1e1e2e',
                      }}
                    >
                      <div style={{ maxWidth: 240 }}>
                        <PlayerWrapper
                          template={template}
                          props={template.defaultProps}
                          aspect="1:1"
                          duration={12}
                          maxWidth={240}
                          controls={false}
                          autoPlay={false}
                        />
                      </div>
                      <div style={{ padding: '10px 12px', fontSize: 13, color: '#e0e0e0' }}>
                        {template.name}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: '#666', fontStyle: 'italic' }}>
                  No templates assigned to this theme yet
                </p>
              )}
            </div>
          </>
        ) : (
          <p style={{ color: '#666', fontSize: 14 }}>Select a theme from the sidebar</p>
        )}
      </div>
    </div>
  );
}
