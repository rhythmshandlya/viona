import React from 'react';

interface SceneItemData {
  sceneFile: string;
}

interface SceneItemProps {
  data: SceneItemData;
  width: number;
  height: number;
  durationInFrames: number;
  fps: number;
  sceneRegistry: Record<string, React.ComponentType<any>>;
}

export const SceneItem: React.FC<SceneItemProps> = ({
  data,
  width,
  height,
  durationInFrames,
  fps,
  sceneRegistry,
}) => {
  // Look up by exact key first, then try with/without extension
  const SceneComponent = sceneRegistry[data.sceneFile]
    || sceneRegistry[`${data.sceneFile}.tsx`]
    || sceneRegistry[`${data.sceneFile}.ts`];

  if (!SceneComponent) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a2e',
          color: '#e74c3c',
          fontFamily: 'monospace',
          fontSize: 18,
          padding: 20,
          textAlign: 'center',
        }}
      >
        Scene not found: {data.sceneFile}
      </div>
    );
  }

  return (
    <SceneComponent
      width={width}
      height={height}
      durationInFrames={durationInFrames}
      fps={fps}
    />
  );
};
