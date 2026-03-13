import React from 'react';

interface ShapeItemData {
  shape: 'rectangle' | 'circle' | 'line';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
}

interface ShapeItemProps {
  data: ShapeItemData;
}

export const ShapeItem: React.FC<ShapeItemProps> = ({ data }) => {
  if (data.shape === 'line') {
    return (
      <div
        style={{
          width: '100%',
          height: data.strokeWidth ?? 2,
          backgroundColor: data.fill,
          alignSelf: 'center',
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: data.fill,
        borderRadius:
          data.shape === 'circle' ? '50%' : data.borderRadius ?? 0,
        border:
          data.stroke && data.strokeWidth
            ? `${data.strokeWidth}px solid ${data.stroke}`
            : undefined,
        boxSizing: 'border-box',
      }}
    />
  );
};
