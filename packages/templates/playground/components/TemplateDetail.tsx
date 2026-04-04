import React, { useState, useCallback } from 'react';
import type { TemplateEntry, ThemeDefinition } from '../lib/types';
import { PlayerWrapper, type AspectKey } from './PlayerWrapper';
import { PropsEditor } from './PropsEditor';
import { ButtonGroup, Label } from './ui';
import { t, type BgMode } from '../theme';

interface TemplateDetailProps {
  template: TemplateEntry;
  themes: ThemeDefinition[];
  onBack: () => void;
  onSelectTheme: (slug: string) => void;
}

export function TemplateDetail({ template, themes, onBack, onSelectTheme }: TemplateDetailProps) {
  const [props, setProps] = useState<Record<string, any>>(() => ({ ...template.defaultProps }));
  const intrinsicDuration = template.durationInFrames / template.fps;
  const [aspect, setAspect] = useState<AspectKey>('1:1');
  const [duration, setDuration] = useState<number | null>(null);
  const [bgMode, setBgMode] = useState<BgMode>('checkerboard');

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
    .map((slug) => themes.find((th) => th.slug === slug))
    .filter((th): th is ThemeDefinition => th != null);

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100%', background: t.bgPage }}>
      {/* Center area */}
      <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: t.text3,
            fontSize: 13,
            cursor: 'pointer',
            padding: '4px 0',
            marginBottom: 16,
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.color = t.text1; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.color = t.text3; }}
        >
          &larr; Back to gallery
        </button>

        <h2 style={{ fontSize: 22, fontWeight: 600, color: t.text1, margin: '0 0 6px 0' }}>
          {template.name}
        </h2>
        <p style={{ fontSize: 13, color: t.text2, margin: '0 0 20px 0', lineHeight: 1.5 }}>
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
          <div style={{ flex: 1, maxWidth: 280 }}>
            <Label>Duration ({intrinsicDuration}s native)</Label>
            <ButtonGroup
              options={['native', '6', '12', '20', '30']}
              value={duration === null ? 'native' : String(duration)}
              onChange={(v) => setDuration(v === 'native' ? null : Number(v))}
            />
          </div>
          <div style={{ flex: 1, maxWidth: 280 }}>
            <Label>Background</Label>
            <ButtonGroup
              options={['Check', 'Dark', 'Light', 'None']}
              value={{ checkerboard: 'Check', dark: 'Dark', light: 'Light', none: 'None' }[bgMode]}
              onChange={(v) => setBgMode({ Check: 'checkerboard', Dark: 'dark', Light: 'light', None: 'none' }[v] as BgMode)}
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
                  background: t.accentSoft,
                  border: `1px solid ${t.accent}40`,
                  borderRadius: 12,
                  padding: '3px 10px',
                  color: t.accentText,
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
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
          duration={duration ?? undefined}
          bgMode={bgMode}
        />
      </div>

      {/* Right sidebar */}
      <div
        style={{
          width: 380,
          flexShrink: 0,
          background: t.bgPanel,
          borderLeft: `1px solid ${t.border}`,
          padding: 20,
          overflowY: 'auto',
        }}
      >
        <h3 style={{ fontSize: 13, fontWeight: 600, color: t.text1, margin: '0 0 16px 0' }}>
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
