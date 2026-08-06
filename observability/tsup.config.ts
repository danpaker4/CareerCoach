import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'fastify/index': 'src/fastify/index.ts',
    'logger/index': 'src/logger/index.ts',
    'open-telemetry/index': 'src/open-telemetry/index.ts',
  },
  format: ['esm'],
  target: 'node20',
  dts: true,
  sourcemap: true,
  clean: true,
});
