import React, { useState, useCallback } from 'react';
import type { TemplateEntry, ThemeDefinition } from '../lib/types';
import { PlayerWrapper, type AspectKey } from './PlayerWrapper';
import { PropsEditor } from './PropsEditor';
import { ButtonGroup, Label } from './ui';

interface TemplateDetailProps {
  template: TemplateEntry;
  themes: ThemeDefinition[];
  onBack: () => void;
  onSelectTheme: (slug: string) => void;
}

export function TemplateDetail({ template, themes, onBack, onSelectTheme }: TemplateDetailProps) {
  const [props, setProps] = useState<Record<string, any>>(() => ({ ...template.defaultProps }));
  const [aspect, setAspect] = useState<AspectKey>('1:1');
  const [duration, setDuration] = useState(12);

  const onUpdateProp = useCallback((path: string[], value: any) => {
    setProps((prev) => {
      const next = { ...prev };
      if (path.length === 1) {
        next[path[0]] = value;
      } else if (path.length === 2) {
        next[path[0]] = { ...next[path[0]], [path[1]]: value };
      } else if (path.length === 3) {
        next[path[0]] = {
          ...next[path[0]],
          [path[1]]: { ...next[path[0]]?.[path[1]], [path[2]]: value },
        };
      }
      return next;
    });
  }, []);

  const onReset = useCallback(() => {
    setProps({ ...template.defaultProps });
  }, [template.defaultProps]);

  const matchedThemes = template.themes
    .map((slug) => themes.find((t) => t.slug === slug))
    .filter((t): t is ThemeDefinition => t != null);

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100%', background: '#0a0a14' }}>
      {/* Center area */}
      <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#888',
            fontSize: 13,
            cursor: 'pointer',
            padding: '4px 0',
            marginBottom: 16,
          }}
        >
          &larr; Back to gallery
        </button>

        <h2 style={{ fontSize: 22, fontWeight: 600, color: '#e0e0e0', margin: '0 0 6px 0' }}>
          {template.name}
        </h2>
        <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px 0', lineHeight: 1.5 }}>
          {template.description}
        </p>

        <div style={{ display: 'flex', gap: 24, marginBottom: 20, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, maxWidth: 220 }}>
            <Label>Aspect Ratio</Label>
            <ButtonGroup
              options={['1:1', '9:16', '16:9']}
              value={aspect}
              onChange={(v) => setAspect(v as AspectKey)}
            />
          </div>
          <div style={{ flex: 1, maxWidth: 220 }}>
            <Label>Duration (seconds)</Label>
            <ButtonGroup
              options={['6', '12', '20', '30']}
              value={String(duration)}
              onChange={(v) => setDuration(Number(v))}
            />
          </div>
        </div>

        {matchedThemes.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
            {matchedThemes.map((theme) => (
              <button
                key={theme.slug}
                onClick={() => onSelectTheme(theme.slug)}
                style={{
                  background: '#8B5CF620',
                  border: '1px solid #8B5CF650',
                  borderRadius: 12,
                  padding: '3px 10px',
                  color: '#c4b5fd',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {theme.name}
              </button>
            ))}
          </div>
        )}

        <PlayerWrapper
          template={template}
          props={props}
          aspect={aspect}
          duration={duration}
        />
      </div>

      {/* Right sidebar */}
      <div
        style={{
          width: 380,
          flexShrink: 0,
          background: '#12121f',
          borderLeft: '1px solid #2a2a3e',
          padding: 20,
          overflowY: 'auto',
        }}
      >
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e0', margin: '0 0 16px 0' }}>
          Props
        </h3>
        <PropsEditor
          template={template}
          props={props}
          onUpdateProp={onUpdateProp}
          onReset={onReset}
        />
      </div>
    </div>
  );
}
