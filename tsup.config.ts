import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node20',
  noExternal: [/(.*)/], // Bundle ALL dependencies into a standalone zero-dependency binary
  banner: {
    js: '#!/usr/bin/env node',
  },
});
