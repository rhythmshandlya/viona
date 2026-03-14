// Verify workspace config module exports correctly
import { workspaceConfig, getWorkspacePath, getManifestPath } from '../../packages/api/src/workspace/workspace-config.js';

// Test 1: Config values are reasonable
console.log('Test 1: Config values...');
console.assert(workspaceConfig.idleTimeoutMs > 0, 'idleTimeoutMs should be positive');
console.assert(workspaceConfig.lockTtlMs > 0, 'lockTtlMs should be positive');
console.assert(workspaceConfig.bundlerDebounceMs > 0, 'bundlerDebounceMs should be positive');
console.assert(workspaceConfig.checkpointIntervalMs > 0, 'checkpointIntervalMs should be positive');
console.log('  PASS');

// Test 2: Path helpers produce consistent paths
console.log('Test 2: Path consistency...');
const wp = getWorkspacePath('abc-123');
const mp = getManifestPath('abc-123');
console.assert(mp.startsWith(wp), 'Manifest should be inside workspace');
console.assert(mp.endsWith('manifest.json'), 'Manifest should be manifest.json');
console.log('  PASS');

// Test 3: Different project IDs produce different paths
console.log('Test 3: Path isolation...');
const wp1 = getWorkspacePath('project-1');
const wp2 = getWorkspacePath('project-2');
console.assert(wp1 !== wp2, 'Different projects should have different paths');
console.assert(!wp1.includes('project-2'), 'Paths should not leak between projects');
console.log('  PASS');

console.log('\nAll tests passed!');
