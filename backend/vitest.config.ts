import { defineConfig } from "vitest/config";
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
        test: {
            exclude: [
                '**/node_modules/**',
                '**/dist/**',
                '**/.{idea,git,cache,output,temp}/**',
                '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
            ],
            include: ['src/**/*.test.ts'],
            coverage: {
                provider: 'v8',
                reporter: ['text', 'json', 'html'],
                exclude: [
                    'node_modules/**',
                    'dist/**',
                    '**/*.d.ts',
                    'test/**',
                    'config/**'
                ],
                thresholds: {
                    statements: 80,
                    lines: 80,
                    functions: 75,
                    branches: 70
                }
            },
            environment: 'node',
            globals: true,
      passWithNoTests: true,
    }
});
