import type { Track } from '../store/types';

const TRACK_NAMES: Record<string, string> = {
  video: 'Video',
  audio: 'Audio',
  overlay: 'Overlay',
  caption: 'Caption',
};

/**
 * Finds an existing track of the given type, or creates a new one.
 * Returns the track ID.
 */
export function findOrCreateTrack(
  tracks: Track[],
  trackType: string,
  addTrack: (track: Partial<Track>) => string,
): string {
  const existing = tracks.find((t) => t.type === trackType);
  if (existing) return existing.id;

  const count = tracks.filter((t) => t.type === trackType).length;
  const name = `${TRACK_NAMES[trackType] || trackType} ${count + 1}`;
  return addTrack({
    type: trackType as Track['type'],
    name,
    position: tracks.length,
    height: 60,
    locked: false,
    visible: true,
    collapsed: false,
  });
}
