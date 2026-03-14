import React from 'react';

interface ShapeOverlayProps {
  data: {
    shape: 'rectangle' | 'circle' | 'line';
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    borderRadius?: number;
  };
}

export const ShapeOverlay: React.FC<ShapeOverlayProps> = ({ data }) => {
  const baseStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: data.fill || '#FFFFFF',
    border: data.stroke ? `${data.strokeWidth || 1}px solid ${data.stroke}` : undefined,
  };

  switch (data.shape) {
    case 'circle':
      return <div style={{ ...baseStyle, borderRadius: '50%' }} />;

    case 'line':
      return (
        <div
          style={{
            width: '100%',
            height: data.strokeWidth || 2,
            backgroundColor: data.fill || '#FFFFFF',
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
      );

    case 'rectangle':
    default:
      return (
        <div
          style={{
            ...baseStyle,
            borderRadius: data.borderRadius ?? 0,
          }}
        />
      );
  }
};
