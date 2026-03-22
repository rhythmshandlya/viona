import React from 'react';

interface SceneItemData {
  sceneFile: string;
  displayMode?: string;
  sceneName?: string;
  sceneType?: string;
}

interface SceneItemProps {
  data: SceneItemData;
  width: number;
  height: number;
  durationInFrames: number;
  fps: number;
  sceneRegistry: Record<string, React.ComponentType<any>>;
}

/**
 * Mockup fallback — renders when the scene file doesn't exist yet.
 * Shows scene metadata so renders/stills display useful placeholder info.
 * Once the Animator writes the scene file and the registry regenerates,
 * SceneItem automatically picks up the real component.
 */
const SceneMockup: React.FC<{
  sceneFile: string;
  displayMode?: string;
  sceneName?: string;
  sceneType?: string;
  width: number;
  height: number;
}> = ({ sceneFile, displayMode, sceneName, sceneType, width, height }) => {
  const label = sceneName || sceneFile.replace(/\.tsx$/, '');
  const modeLabel = displayMode || 'unknown';
  const typeLabel = sceneType || 'scene';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        backgroundColor: 'rgba(139, 92, 246, 0.12)',
        border: '2px dashed rgba(139, 92, 246, 0.4)',
        borderRadius: 16,
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          fontFamily: 'Sora, system-ui, sans-serif',
          fontSize: Math.max(16, Math.min(32, width * 0.04)),
          fontWeight: 600,
          color: 'rgba(255, 255, 255, 0.9)',
          textAlign: 'center',
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: Math.max(11, Math.min(16, width * 0.02)),
            color: 'rgba(139, 92, 246, 0.9)',
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            padding: '4px 10px',
            borderRadius: 6,
          }}
        >
          {modeLabel}
        </span>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: Math.max(11, Math.min(16, width * 0.02)),
            color: 'rgba(255, 255, 255, 0.5)',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            padding: '4px 10px',
            borderRadius: 6,
          }}
        >
          {typeLabel}
        </span>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: Math.max(11, Math.min(16, width * 0.02)),
            color: 'rgba(255, 255, 255, 0.35)',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            padding: '4px 10px',
            borderRadius: 6,
          }}
        >
          {Math.round(width)}×{Math.round(height)}
        </span>
      </div>
    </div>
  );
};

export const SceneItem: React.FC<SceneItemProps> = React.memo(({
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
      <SceneMockup
        sceneFile={sceneFile ?? 'unknown'}
        displayMode={data.displayMode}
        sceneName={data.sceneName}
        sceneType={data.sceneType}
        width={width}
        height={height}
      />
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
});
