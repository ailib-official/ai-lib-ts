import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  treeshake: true,
  external: [],
  outDir: 'dist',
  target: 'es2022',
  platform: 'node',
  bundle: true,
  esbuildOptions(options) {
    options.banner = {
      js: '// @ailib-official/ai-lib-ts - AI-Protocol TypeScript Runtime',
    };
  },
});
