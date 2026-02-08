#!/usr/bin/env node
/**
 * Test Bundle Loading
 *
 * Simulates the frontend's DynamicVisualLoader customRequire to verify
 * that composition.cjs.js can be loaded without errors.
 */

const fs = require('fs');
const path = require('path');

// Mock React
const mockReact = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  Fragment: Symbol('Fragment'),
  useMemo: (fn) => fn(),
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
  useCallback: (fn) => fn,
  useRef: (initial) => ({ current: initial }),
};

// Mock JSX runtime
const mockJsxRuntime = {
  jsx: (type, props, key) => ({ type, props, key }),
  jsxs: (type, props, key) => ({ type, props, key }),
  Fragment: mockReact.Fragment,
};

// Mock Remotion
const mockRemotion = {
  useCurrentFrame: () => 0,
  useVideoConfig: () => ({ fps: 30, width: 1080, height: 1920, durationInFrames: 150 }),
  interpolate: (frame, input, output, options) => output[0],
  spring: () => 1,
  Sequence: ({ children }) => children,
  AbsoluteFill: ({ children }) => children,
  Composition: () => null,
};

// Mock @remotion/three
const mockRemotionThree = {
  ThreeCanvas: ({ children }) => ({ type: 'ThreeCanvas', children }),
};

// Mock @remotion/noise, shapes, paths
const mockRemotionNoise = { noise2D: () => 0, noise3D: () => 0 };
const mockRemotionShapes = {};
const mockRemotionPaths = {};

// Mock THREE (minimal)
const mockTHREE = {
  CanvasTexture: class {
    constructor() { this.needsUpdate = false; }
  },
  MeshStandardMaterial: class {
    constructor(opts) { this.opts = opts; }
  },
  BoxGeometry: class {},
};

// Custom require function (mirrors DynamicVisualLoader)
function customRequire(moduleName) {
  const modules = {
    'react': mockReact,
    'react/jsx-runtime': mockJsxRuntime,
    'react/jsx-dev-runtime': mockJsxRuntime,
    'remotion': mockRemotion,
    '@remotion/three': mockRemotionThree,
    '@remotion/noise': mockRemotionNoise,
    '@remotion/shapes': mockRemotionShapes,
    '@remotion/paths': mockRemotionPaths,
    'three': mockTHREE,
  };

  if (modules[moduleName]) {
    return modules[moduleName];
  }

  throw new Error(`Unknown module: ${moduleName}`);
}

// Test a bundle
function testBundle(bundlePath) {
  const cjsPath = path.join(bundlePath, 'composition.cjs.js');

  console.log(`\nTesting bundle: ${bundlePath}`);
  console.log('─'.repeat(50));

  if (!fs.existsSync(cjsPath)) {
    console.log('❌ composition.cjs.js not found');
    return false;
  }

  console.log('✓ composition.cjs.js exists');

  try {
    const code = fs.readFileSync(cjsPath, 'utf-8');
    console.log(`✓ File loaded (${(code.length / 1024).toFixed(1)} KB)`);

    // Check for require calls that aren't in our mock list
    const requireCalls = code.match(/require\(["']([^"']+)["']\)/g) || [];
    const uniqueRequires = [...new Set(requireCalls.map(r => r.match(/["']([^"']+)["']/)[1]))];

    console.log(`\nRequired modules: ${uniqueRequires.length}`);
    uniqueRequires.forEach(mod => {
      const supported = customRequire.toString().includes(`'${mod}'`);
      console.log(`  ${supported ? '✓' : '⚠'} ${mod}`);
    });

    // Try to execute the module
    console.log('\nExecuting module...');

    const moduleObj = { exports: {} };
    const moduleFunction = new Function('module', 'exports', 'require', code);
    moduleFunction(moduleObj, moduleObj.exports, customRequire);

    console.log('✓ Module executed without errors');

    // Check exports
    const exports = moduleObj.exports;
    const exportNames = Object.keys(exports);

    console.log(`\nExports found: ${exportNames.length}`);
    exportNames.forEach(name => {
      const type = typeof exports[name];
      console.log(`  ✓ ${name} (${type})`);
    });

    // Check for MainComposition or default export
    const hasMainComposition = 'MainComposition' in exports || 'default' in exports;
    if (hasMainComposition) {
      console.log('\n✓ Main composition export found');
    } else {
      console.log('\n⚠ Warning: No MainComposition or default export');
    }

    console.log('\n' + '═'.repeat(50));
    console.log('✅ BUNDLE LOADING TEST PASSED');
    console.log('═'.repeat(50));

    return true;

  } catch (error) {
    console.log('\n❌ BUNDLE LOADING TEST FAILED');
    console.log('Error:', error.message);

    if (error.message.includes('Unknown module')) {
      console.log('\nThe bundle requires a module that the frontend does not provide.');
      console.log('This module needs to be either:');
      console.log('  1. Added to esbuild externals AND frontend customRequire');
      console.log('  2. Or bundled inline (not marked as external)');
    }

    return false;
  }
}

// Main
const args = process.argv.slice(2);
let bundlePath = args[0];

if (!bundlePath) {
  // Default to most recent bundle
  const bundlesDir = path.join(__dirname, '..', 'bundles');
  if (fs.existsSync(bundlesDir)) {
    const bundles = fs.readdirSync(bundlesDir)
      .filter(f => fs.statSync(path.join(bundlesDir, f)).isDirectory())
      .map(f => ({
        name: f,
        mtime: fs.statSync(path.join(bundlesDir, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (bundles.length > 0) {
      bundlePath = path.join(bundlesDir, bundles[0].name);
      console.log(`Using most recent bundle: ${bundles[0].name}`);
    }
  }
}

if (!bundlePath) {
  console.log('Usage: node test-bundle-loading.js [bundle-path]');
  console.log('Example: node test-bundle-loading.js bundles/test-dice-3d');
  process.exit(1);
}

const success = testBundle(bundlePath);
process.exit(success ? 0 : 1);
