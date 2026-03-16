/**
 * Remotion Root — entry point for CLI rendering (remotion still / remotion render).
 *
 * Registers MainComposition which reads manifest.json from the workspace
 * and renders PlayerComposition.
 *
 * NOTE: calculateMetadata runs in Remotion's browser context, so `fs` is NOT
 * available. We use fetch(staticFile(...)) instead — manifest.json must be
 * copied to public/ before rendering.
 */

import React from 'react';
import { registerRoot, Composition, staticFile } from 'remotion';
import { PlayerComposition } from './PlayerComposition';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MainComposition"
        component={PlayerComposition}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          manifest: {
            version: 2,
            fps: 30,
            durationMs: 5000,
            canvas: { width: 1920, height: 1080 },
            tracks: [],
            items: [],
            assets: {},
          },
        }}
        calculateMetadata={async () => {
          try {
            const res = await fetch(staticFile('manifest.json'));
            if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.status}`);
            const manifest = await res.json();
            const fps = manifest.fps || 30;
            const w = manifest.canvas?.width || manifest.width || 1920;
            const h = manifest.canvas?.height || manifest.height || 1080;
            const durationInFrames = Math.ceil((manifest.durationMs || 5000) / 1000 * fps);
            return {
              props: {
                manifest: {
                  ...manifest,
                  canvas: { width: w, height: h },
                },
              },
              durationInFrames,
              fps,
              width: w,
              height: h,
            };
          } catch (err) {
            console.error('calculateMetadata error:', err);
            return {};
          }
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
