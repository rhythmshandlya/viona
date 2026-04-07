import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/types/index.ts', 'src/storage.ts', 'src/progress-types.ts', 'src/typography-pairings.ts', 'src/caption-font-pairs.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
});
