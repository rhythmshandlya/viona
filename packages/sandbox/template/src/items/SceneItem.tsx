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
  // Fallback: accept data.src for backward compat with agents that use the wrong field name
  const sceneFile = data.sceneFile || (data as any).src;
  const SceneComponent = sceneFile
    ? (sceneRegistry[sceneFile]
      || sceneRegistry[`${sceneFile}.tsx`]
      || sceneRegistry[`${sceneFile}.ts`])
    : undefined;

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
        Scene not found: {sceneFile ?? 'unknown'}
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
