import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/core.ts', 'src/contact.ts'],
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
  onSuccess: async () => {
    const srcEmbedded = 'src/protocol/v2/embedded';
    const destEmbedded = 'dist/embedded';
    mkdirSync(dirname(join(destEmbedded, 'placeholder')), { recursive: true });
    cpSync(srcEmbedded, destEmbedded, { recursive: true });
  },
});
