/**
 * Remotion Root - Clipify Visual Workspace
 *
 * This file registers all compositions for the Remotion project.
 * New compositions are added dynamically by the visual generator agent.
 */

import { registerRoot } from 'remotion';
import { Composition } from 'remotion';
import React from 'react';

// Placeholder composition - will be replaced/extended by agent
const Placeholder: React.FC = () => {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0a0a0a',
        color: '#fff',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 48,
      }}
    >
      Clipify Visual Workspace
    </div>
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Placeholder"
        component={Placeholder}
        durationInFrames={90}
        fps={30}
        width={1920}
        height={1080}
      />
      {/* Agent-generated compositions will be added below */}
    </>
  );
};

registerRoot(RemotionRoot);
