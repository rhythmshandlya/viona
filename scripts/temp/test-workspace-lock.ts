// Test workspace-config path helpers
import { getWorkspacePath, getManifestPath, getScenesPath } from '../../packages/api/src/workspace/workspace-config.js';

console.log('Test 1: getWorkspacePath...');
const wp = getWorkspacePath('test-project-123');
console.assert(wp.includes('test-project-123'), `Path should contain project ID: ${wp}`);
console.assert(!wp.endsWith('/'), 'Path should not end with slash');
console.log('  PASS');

console.log('Test 2: getManifestPath...');
const mp = getManifestPath('test-project-123');
console.assert(mp.endsWith('manifest.json'), `Path should end with manifest.json: ${mp}`);
console.assert(mp.startsWith(wp), 'Manifest path should be inside workspace');
console.log('  PASS');

console.log('Test 3: getScenesPath...');
const sp = getScenesPath('test-project-123');
console.assert(sp.includes('scenes'), `Path should contain scenes: ${sp}`);
console.assert(sp.includes('src'), 'Scenes should be inside src/');
console.log('  PASS');

console.log('\nAll tests passed!');
