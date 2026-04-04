import React from 'react';
import { t } from '../theme';

interface PaletteSwatchesProps {
  palette: Record<string, string>;
}

export function PaletteSwatches({ palette }: PaletteSwatchesProps) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {Object.entries(palette).map(([name, color]) => (
        <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 8,
            background: color, border: `1px solid ${t.border}`,
          }} />
          <span style={{ fontSize: 10, color: t.text2 }}>{name}</span>
          <span style={{ fontSize: 9, color: t.text3, fontFamily: 'monospace' }}>{color}</span>
        </div>
      ))}
    </div>
  );
}
