import { dbToManifest, manifestToDb, validateManifest, type DbToManifestInput } from '@viona/shared';

const dbInput: DbToManifestInput = {
  project: {
    fps: 30,
    durationMs: 30000,
    sourceWidth: 1920,
    sourceHeight: 1080,
    videoSettings: {
      canvasWidth: 1080,
      canvasHeight: 1920,
      cropX: 50,
      cropY: 40,
      scale: 1.2,
      layoutSettings: {
        mode: 'stacked',
        split: { position: 'visuals-first', ratio: 60, gap: 4 },
        pip: { position: 'bottom-right', size: 25, shape: 'circle' },
      },
      captionStyle: {
        displayMode: 'word-by-word',
        fontFamily: 'Montserrat',
        fontSize: 72,
        color: '#FFFFFF',
        activeColor: '#FF0000',
      },
    },
  },
  tracks: [
    { id: 't1', type: 'video', name: 'Speaker', position: 0, locked: false, visible: true },
    { id: 't2', type: 'visual', name: 'Visuals', position: 1, locked: false, visible: true },
    { id: 't3', type: 'caption', name: 'Captions', position: 2, locked: false, visible: true },
  ],
  items: [
    {
      id: 'vid1', trackId: 't1', type: 'video', startMs: 0, endMs: 30000,
      data: { src: 'source.mp4', volume: 1 },
    },
    {
      id: 'vis1', trackId: 't2', type: 'visual', startMs: 0, endMs: 8000,
      data: { sourceSceneId: 1, displayMode: 'default', transition: { enter: { type: 'fade', durationMs: 200 } } },
    },
    {
      id: 'vis2', trackId: 't2', type: 'visual', startMs: 8000, endMs: 15000,
      data: { sourceSceneId: 2, displayMode: 'overlay' },
    },
    {
      id: 'cap1', trackId: 't3', type: 'subtitle', startMs: 0, endMs: 3000, // DB uses 'subtitle', not 'caption'
      data: { words: [{ text: 'Hello', startMs: 0, endMs: 500 }, { text: 'world', startMs: 500, endMs: 1000 }] },
    },
  ],
};

// Test 1: DB → manifest produces valid manifest
console.log('Test 1: DB -> manifest...');
const manifest = dbToManifest(dbInput);
const validation = validateManifest(manifest);
console.assert(validation.version === 1);
console.assert(validation.fps === 30);
console.assert(validation.canvas.width === 1080);
console.assert(validation.tracks.length === 3);
console.assert(validation.items.length === 4);
console.log('  PASS');

// Test 2: Visual items get sceneFile from sourceSceneId
console.log('Test 2: sourceSceneId -> sceneFile...');
const vis1 = manifest.items.find(i => i.id === 'vis1')!;
console.assert((vis1.data as any).sceneFile === 'scenes/Scene1.tsx');
const vis2 = manifest.items.find(i => i.id === 'vis2')!;
console.assert((vis2.data as any).sceneFile === 'scenes/Scene2.tsx');
console.log('  PASS');

// Test 3: Layout settings preserved
console.log('Test 3: Layout settings...');
console.assert(manifest.layout.mode === 'stacked');
console.assert(manifest.layout.split.ratio === 60);
console.assert(manifest.layout.split.gap === 4);
console.log('  PASS');

// Test 4: Video settings preserved
console.log('Test 4: Video settings...');
console.assert(manifest.videoSettings.cropX === 50);
console.assert(manifest.videoSettings.cropY === 40);
console.assert(manifest.videoSettings.scale === 1.2);
console.log('  PASS');

// Test 5: Caption style preserved
console.log('Test 5: Caption style...');
console.assert(manifest.captionStyle.fontFamily === 'Montserrat');
console.assert(manifest.captionStyle.fontSize === 72);
console.log('  PASS');

// Test 6: DB 'subtitle' type maps to manifest 'caption' type
console.log('Test 6: subtitle -> caption mapping...');
const capItem = manifest.items.find(i => i.id === 'cap1')!;
console.assert(capItem.type === 'caption', `Expected 'caption' but got '${capItem.type}'`);
console.assert((capItem.data as any).words.length === 2, 'Should have 2 words');
console.log('  PASS');

// Test 7: manifest → DB round-trip
console.log('Test 7: manifest -> DB...');
const dbOut = manifestToDb(manifest);
console.assert(dbOut.tracks.length === 3);
console.assert(dbOut.items.length === 4);
// Visual items should have sourceSceneId restored
const dbVis1 = dbOut.items.find(i => i.id === 'vis1')!;
console.assert((dbVis1.data as any).sourceSceneId === 1, 'sourceSceneId should be restored from sceneFile');
console.assert((dbVis1.data as any).sceneFile === undefined, 'sceneFile should be removed');
// Caption items should map back to 'subtitle' type
const dbCap1 = dbOut.items.find(i => i.id === 'cap1')!;
console.assert(dbCap1.type === 'subtitle', `Expected DB type 'subtitle' but got '${dbCap1.type}'`);
console.log('  PASS');

// Test 8: videoSettings includes layout and caption style
console.log('Test 8: videoSettings structure...');
console.assert((dbOut.videoSettings.layoutSettings as any).mode === 'stacked');
console.assert((dbOut.videoSettings.captionStyle as any).fontFamily === 'Montserrat');
console.assert(dbOut.videoSettings.cropX === 50);
console.log('  PASS');

console.log('\nAll tests passed!');
