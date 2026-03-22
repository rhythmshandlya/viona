import React from 'react';

export function PaperClip() {
  return (
    <div style={{
      position: 'absolute', top: -20, right: 30,
      transform: 'rotate(15deg)', pointerEvents: 'none', zIndex: 12,
    }}>
      <div style={{
        width: 40, height: 90,
        border: '2.5px solid #999', borderRadius: 8,
        position: 'relative', background: 'transparent',
      }}>
        <div style={{
          position: 'absolute', bottom: 0, left: 5,
          width: 30, height: 50,
          border: '2.5px solid #aaa', borderRadius: 6,
          borderTop: 'none', background: 'transparent',
        }} />
      </div>
    </div>
  );
}
