/**
 * Shared player ref — allows external components (e.g. PlaybackBar)
 * to call player.play(event) directly from user gesture handlers,
 * which is required by browsers for audio autoplay policy.
 */
import type { MutableRefObject } from 'react';
import type { PlayerRef } from '@remotion/player';

export const sharedPlayerRef: MutableRefObject<PlayerRef | null> = { current: null };
