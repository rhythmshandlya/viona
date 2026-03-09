import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/remotion-entry.tsx', 'src/animations/index.ts', 'src/components/DynamicSubtitles.tsx'],
  format: ['esm'],
  dts: false, // Skip DTS due to React 19 / Remotion type incompatibility
  clean: true,
  sourcemap: true,
  external: ['react', 'react-dom', 'remotion'],
});
