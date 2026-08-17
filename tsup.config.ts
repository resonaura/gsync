import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node20',
  noExternal: [/(.*)/],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
