import { applyManifestOp, validateManifest, type Manifest } from '@viona/shared';

function makeTestManifest(): Manifest {
  return validateManifest({
    version: 1, fps: 30, durationMs: 15000,
    canvas: { width: 1080, height: 1920 },
    tracks: [
      { id: 't1', type: 'video', name: 'Speaker', position: 0 },
      { id: 't2', type: 'visual', name: 'Visuals', position: 1 },
    ],
    items: [
      {
        id: 'v1', type: 'visual', trackId: 't2', startMs: 0, endMs: 8000,
        data: { sceneFile: 'scenes/Scene1.tsx', displayMode: 'default', frameOffset: 0 },
      },
      {
        id: 'v2', type: 'visual', trackId: 't2', startMs: 8000, endMs: 15000,
        data: { sceneFile: 'scenes/Scene2.tsx', displayMode: 'default', frameOffset: 0 },
      },
    ],
  });
}

// Test 1: move_item
console.log('Test 1: move_item...');
const m1 = applyManifestOp(makeTestManifest(), {
  op: 'move_item', itemId: 'v2', startMs: 9000, endMs: 16000,
});
console.assert(m1.items[1].startMs === 9000, 'startMs should be 9000');
console.assert(m1.items[1].endMs === 16000, 'endMs should be 16000');
console.assert(m1.durationMs === 16000, 'durationMs should update to 16000');
console.log('  PASS');

// Test 2: set_display_mode
console.log('Test 2: set_display_mode...');
const m2 = applyManifestOp(makeTestManifest(), {
  op: 'set_display_mode', itemId: 'v1', displayMode: 'overlay',
});
console.assert((m2.items[0].data as any).displayMode === 'overlay');
console.log('  PASS');

// Test 3: split_item
console.log('Test 3: split_item...');
const m3 = applyManifestOp(makeTestManifest(), {
  op: 'split_item', itemId: 'v1', atMs: 4000,
});
console.assert(m3.items.length === 3, 'Should have 3 items after split');
console.assert(m3.items[0].endMs === 4000, 'First half ends at 4000');
console.assert(m3.items[1].startMs === 4000, 'Second half starts at 4000');
console.assert(m3.items[1].endMs === 8000, 'Second half ends at 8000');
const secondData = m3.items[1].data as any;
console.assert(secondData.frameOffset === 120, 'frameOffset should be 120 (4000ms * 30fps / 1000)');
console.assert(secondData.sceneFile === 'scenes/Scene1.tsx', 'Same scene file');
console.log('  PASS');

// Test 4: delete_item
console.log('Test 4: delete_item...');
const m4 = applyManifestOp(makeTestManifest(), {
  op: 'delete_item', itemId: 'v1',
});
console.assert(m4.items.length === 1, 'Should have 1 item after delete');
console.assert(m4.items[0].id === 'v2', 'Remaining item should be v2');
console.log('  PASS');

// Test 5: set_layout
console.log('Test 5: set_layout...');
const m5 = applyManifestOp(makeTestManifest(), {
  op: 'set_layout', layout: { mode: 'pip' },
});
console.assert(m5.layout.mode === 'pip', 'Layout mode should be pip');
console.assert(m5.layout.split.ratio === 50, 'Split ratio should be preserved');
console.log('  PASS');

// Test 6: update_caption_style
console.log('Test 6: update_caption_style...');
const m6 = applyManifestOp(makeTestManifest(), {
  op: 'update_caption_style', updates: { fontSize: 72, color: '#FF0000' },
});
console.assert(m6.captionStyle.fontSize === 72);
console.assert(m6.captionStyle.color === '#FF0000');
console.log('  PASS');

// Test 7: set_transition
console.log('Test 7: set_transition...');
const m7 = applyManifestOp(makeTestManifest(), {
  op: 'set_transition', itemId: 'v1',
  exit: { type: 'crossfade', durationMs: 300 },
});
console.assert((m7.items[0].data as any).transition.exit.type === 'crossfade');
console.assert((m7.items[0].data as any).transition.exit.durationMs === 300);
console.log('  PASS');

// Test 8: immutability — original not mutated
console.log('Test 8: immutability...');
const original = makeTestManifest();
const modified = applyManifestOp(original, { op: 'move_item', itemId: 'v1', startMs: 1000, endMs: 5000 });
console.assert(original.items[0].startMs === 0, 'Original should not be mutated');
console.assert(modified.items[0].startMs === 1000, 'Modified should have new value');
console.log('  PASS');

// Test 9: error on invalid item
console.log('Test 9: error on invalid item...');
try {
  applyManifestOp(makeTestManifest(), { op: 'delete_item', itemId: 'nonexistent' });
  console.assert(false, 'Should have thrown');
} catch (e: any) {
  console.assert(e.message.includes('not found'), 'Should throw "not found"');
  console.log('  PASS');
}

console.log('\nAll tests passed!');
