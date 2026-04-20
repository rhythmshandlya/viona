/**
 * PR-C2 Task 6: applyCompositionV2 action
 *
 * Verifies the Zustand action replaces tracks + items with the composition's
 * contents and maps resolved asset URLs onto each item's data.src.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from './editor-store';
import type { CompositionV2Input } from './types';

function baseComposition(overrides: Partial<CompositionV2Input> = {}): CompositionV2Input {
  return {
    tracks: [],
    timelineItems: [],
    assets: {},
    ...overrides,
  };
}

describe('editor-store.applyCompositionV2', () => {
  beforeEach(() => {
    // Reset to an empty slate. syncWorkspaceManifest() bails out when there
    // is no project, so we don't need a fully populated state here.
    useEditorStore.setState({
      tracks: [],
      items: {},
      itemIds: [],
      selectedIds: [],
      lastSelectedId: null,
      project: null,
    });
  });

  it('replaces tracks and items with composition contents', () => {
    const composition: CompositionV2Input = baseComposition({
      tracks: [{ id: 't-1', projectId: 'p-1', position: 0, type: 'video', name: 'Track 1' }],
      timelineItems: [{
        id: 'i-1',
        trackId: 't-1',
        type: 'video',
        startMs: 0,
        endMs: 3000,
        data: { assetId: 'a-1', sourceStartMs: 0, sourceDurationMs: 3000, source: 'arrangement_agent' },
      }],
      assets: {
        'a-1': {
          id: 'a-1',
          filename: 'hero.mp4',
          mimeType: 'video/mp4',
          durationMs: 3000,
          width: 1920,
          height: 1080,
          url: 'https://signed/hero.mp4',
          thumbnailUrl: 'https://signed/thumb.jpg',
        },
      },
    });

    useEditorStore.getState().applyCompositionV2(composition);

    const state = useEditorStore.getState();
    expect(state.tracks).toHaveLength(1);
    expect(state.tracks[0]).toMatchObject({
      id: 't-1',
      type: 'video',
      position: 0,
      locked: false,
      visible: true,
      collapsed: false,
    });
    expect(typeof state.tracks[0].height).toBe('number');

    expect(state.itemIds).toEqual(['i-1']);
    expect(state.items['i-1']).toBeDefined();
    const itemData = state.items['i-1'].data as { src?: string; thumbnailUrl?: string; filename?: string; mimeType?: string; assetId?: string };
    expect(itemData.src).toBe('https://signed/hero.mp4');
    expect(itemData.thumbnailUrl).toBe('https://signed/thumb.jpg');
    expect(itemData.filename).toBe('hero.mp4');
    expect(itemData.mimeType).toBe('video/mp4');
    // Original assetId is preserved for round-trip/save.
    expect(itemData.assetId).toBe('a-1');
  });

  it('handles items without assetId (passes through existing src)', () => {
    const composition: CompositionV2Input = baseComposition({
      tracks: [{ id: 't-1', projectId: 'p-1', position: 0, type: 'video', name: 'T' }],
      timelineItems: [{
        id: 'i-1',
        trackId: 't-1',
        type: 'video',
        startMs: 0,
        endMs: 1000,
        data: { src: 'pre-existing-url' },
      }],
      assets: {},
    });

    useEditorStore.getState().applyCompositionV2(composition);

    const itemData = useEditorStore.getState().items['i-1'].data as { src?: string };
    expect(itemData.src).toBe('pre-existing-url');
  });

  it('normalizes subtitle type to caption on both tracks and items', () => {
    const composition: CompositionV2Input = baseComposition({
      tracks: [{ id: 't-cap', projectId: 'p-1', position: 1, type: 'subtitle', name: 'Subs' }],
      timelineItems: [{
        id: 'i-cap',
        trackId: 't-cap',
        type: 'subtitle',
        startMs: 0,
        endMs: 2000,
        data: { text: 'hello', words: [] },
      }],
    });

    useEditorStore.getState().applyCompositionV2(composition);
    const state = useEditorStore.getState();
    expect(state.tracks[0].type).toBe('caption');
    expect(state.items['i-cap'].type).toBe('caption');
  });

  it('sorts tracks by position', () => {
    const composition: CompositionV2Input = baseComposition({
      tracks: [
        { id: 't-b', projectId: 'p-1', position: 2, type: 'caption', name: 'B' },
        { id: 't-a', projectId: 'p-1', position: 0, type: 'video', name: 'A' },
      ],
    });

    useEditorStore.getState().applyCompositionV2(composition);
    const tracks = useEditorStore.getState().tracks;
    expect(tracks.map((t) => t.id)).toEqual(['t-a', 't-b']);
  });

  it('drops stale selection that references items no longer present', () => {
    useEditorStore.setState({
      selectedIds: ['ghost-id', 'i-1'],
      lastSelectedId: 'ghost-id',
    });

    const composition: CompositionV2Input = baseComposition({
      tracks: [{ id: 't-1', projectId: 'p-1', position: 0, type: 'video', name: 'T' }],
      timelineItems: [{
        id: 'i-1',
        trackId: 't-1',
        type: 'video',
        startMs: 0,
        endMs: 1000,
        data: { src: 'x' },
      }],
    });

    useEditorStore.getState().applyCompositionV2(composition);
    const state = useEditorStore.getState();
    expect(state.selectedIds).toEqual(['i-1']);
    expect(state.lastSelectedId).toBeNull();
  });
});
