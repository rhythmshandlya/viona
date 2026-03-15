/**
 * Remotion Root — entry point for CLI rendering (remotion still / remotion render).
 *
 * Registers MainComposition which reads manifest.json from the workspace
 * and renders PlayerComposition.
 */

import React from 'react';
import { registerRoot, Composition } from 'remotion';
import { PlayerComposition } from './PlayerComposition';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MainComposition"
        component={PlayerComposition}
        durationInFrames={30}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          manifest: {
            version: 2,
            fps: 30,
            durationMs: 1000,
            canvas: { width: 1080, height: 1920 },
            tracks: [],
            items: [],
            assets: {},
          },
        }}
        calculateMetadata={async () => {
          try {
            const fs = await import('fs');
            const raw = fs.readFileSync('/workspace/manifest.json', 'utf-8');
            const manifest = JSON.parse(raw);
            const fps = manifest.fps || 30;
            const durationInFrames = Math.ceil((manifest.durationMs || 1000) / 1000 * fps);
            return {
              props: {
                manifest: {
                  ...manifest,
                  canvas: { width: manifest.width, height: manifest.height },
                },
              },
              durationInFrames,
              fps,
              width: manifest.width || 1080,
              height: manifest.height || 1920,
            };
          } catch {
            return {};
          }
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
