import React from 'react';

interface ProgressBarProps {
  progress: number;
  color: string;
  height?: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color,
  height = 4,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        height,
        backgroundColor: `${color}33`,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: `${progress * 100}%`,
          height: '100%',
          backgroundColor: color,
        }}
      />
    </div>
  );
};

export default ProgressBar;
