import React from 'react';

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
            background: color, border: '1px solid rgba(255,255,255,0.1)',
          }} />
          <span style={{ fontSize: 10, color: '#888' }}>{name}</span>
          <span style={{ fontSize: 9, color: '#555', fontFamily: 'monospace' }}>{color}</span>
        </div>
      ))}
    </div>
  );
}
