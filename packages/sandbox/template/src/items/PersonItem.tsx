import React from 'react';
import { SandwichComposite } from '../composition/SandwichComposite';
import { resolveMediaSrc } from './resolveMediaSrc';

interface PersonItemData {
  videoSrc: string;
  matteSrc: string;
  startFrom?: number;
  crop?: { x: number; y: number; scale: number };
}

interface PersonItemProps {
  data: PersonItemData;
  assets: Record<string, string>;
  fps: number;
}

/**
 * Track-system adapter for person matte compositing.
 *
 * Delegates to SandwichComposite for the actual canvas matte logic.
 * PersonItem handles:
 *   - Asset path resolution via the manifest's assets map
 *   - startFrom conversion (ms in manifest data)
 *   - Future: crop/reframe transforms
 *
 * In the 5-track depth structure, PersonItem renders on the "person" track
 * (position 2), above scene-bg and below scene-fg. The SandwichComposite
 * renders the person-only pixels (Layer 2) — the background video (Layer 0)
 * and mid-layer children (Layer 1) are handled by the other tracks, so we
 * pass an empty fragment as children here. The full sandwich is assembled
 * by the track ordering in PlayerComposition.
 */
export const PersonItem: React.FC<PersonItemProps> = React.memo(({
  data,
  assets,
  fps,
}) => {
  const videoSrc = resolveMediaSrc(data.videoSrc, assets);
  const matteSrc = resolveMediaSrc(data.matteSrc, assets);
  const startFrom = data.startFrom ?? 0;

  return (
    <SandwichComposite
      videoSrc={videoSrc}
      matteSrc={matteSrc}
      startFrom={startFrom}
      backgroundless
    >
      {/* No mid-layer children — in the track system, scene-bg/scene-fg
          tracks handle the behind/in-front layers separately. */}
      <></>
    </SandwichComposite>
  );
});
