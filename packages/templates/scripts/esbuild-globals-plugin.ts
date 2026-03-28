import type { Plugin } from 'esbuild';
import { resolve, join } from 'path';
import { createRequire } from 'module';
import { builtinModules } from 'module';

/**
 * esbuild plugin that redirects bare module imports to resolve from a
 * specific directory. Needed because template sources are copied into a
 * temporary resolved directory where node_modules doesn't exist.
 *
 * Uses Node's require.resolve with custom paths to find the actual file,
 * then returns the resolved absolute path so esbuild can bundle it.
 */
export function nodeModulesPlugin(pkgRoot: string): Plugin {
  // Create a require function anchored at the package root
  const pkgRequire = createRequire(join(resolve(pkgRoot), 'package.json'));

  return {
    name: 'node-modules-resolve',
    setup(build) {
      // Set of Node built-in modules (e.g. fs, path, crypto)
      const builtins = new Set([
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ]);

      // Match bare imports (not relative, not absolute, not already handled)
      build.onResolve({ filter: /^[^./]/ }, (args) => {
        // Skip if already handled by another plugin (e.g. globals namespace)
        if (args.namespace === 'globals') return undefined;

        // Skip Node built-in modules — mark them as external
        // (these are require'd in some deps like h3-js but unused at runtime)
        if (builtins.has(args.path)) {
          return { path: args.path, external: true };
        }

        try {
          const resolved = pkgRequire.resolve(args.path);
          return { path: resolved };
        } catch {
          // Let esbuild handle it normally (will produce an error)
          return undefined;
        }
      });
    },
  };
}

/**
 * esbuild plugin that rewrites imports of specified packages to reference
 * window globals. This allows template bundles to use React/Remotion from
 * the host app without bundling them.
 */
export function globalsPlugin(globals: Record<string, string>): Plugin {
  return {
    name: 'globals',
    setup(build) {
      for (const [moduleName, globalName] of Object.entries(globals)) {
        const filter = new RegExp(`^${moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

        build.onResolve({ filter }, (args) => ({
          path: args.path,
          namespace: 'globals',
        }));
      }

      build.onLoad({ filter: /.*/, namespace: 'globals' }, (args) => {
        const g = globals[args.path];
        if (!g) {
          return { contents: 'export default {}', loader: 'js' };
        }
        const namedExports = getNamedExports(g);
        const namedLine = namedExports.length > 0
          ? `export const {${namedExports}} = mod;`
          : '';
        return {
          contents: `
            const mod = window["${g}"];
            export default mod;
            ${namedLine}
          `,
          loader: 'js',
        };
      });
    },
  };
}

function getNamedExports(globalName: string): string {
  const exports: Record<string, string[]> = {
    React: [
      // Hooks
      'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef',
      'useContext', 'useReducer', 'useId', 'useImperativeHandle',
      'useLayoutEffect', 'useInsertionEffect', 'useDebugValue',
      'useDeferredValue', 'useTransition', 'useSyncExternalStore',
      'useOptimistic', 'useActionState', 'use',
      // Component utilities
      'forwardRef', 'memo', 'lazy',
      'createContext', 'createElement', 'createRef',
      'Fragment', 'StrictMode', 'Suspense', 'Profiler',
      'Children', 'cloneElement', 'isValidElement',
      // Concurrent
      'startTransition',
      // JSX (for automatic runtime compatibility)
      'jsx', 'jsxs', 'jsxDEV',
    ],
    ReactDOM: ['createRoot', 'hydrateRoot', 'createPortal', 'flushSync'],
    Remotion: [
      'useCurrentFrame', 'useVideoConfig', 'interpolate', 'spring',
      'Sequence', 'AbsoluteFill', 'Img', 'Audio', 'Video',
      'staticFile', 'delayRender', 'continueRender', 'Easing',
      'random', 'measureSpring', 'Series', 'Freeze',
      'getInputProps', 'getRemotionEnvironment',
    ],
  };
  return (exports[globalName] || []).join(', ');
}
