import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/shared', 'apps/server', 'apps/web'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'html', 'json-summary'],
      include: ['packages/shared/src/**', 'apps/server/src/**', 'apps/web/src/**'],
      exclude: [
        '**/__tests__/**',
        '**/*.test.{ts,tsx}',
        '**/test/**',
        '**/*.d.ts',
        '**/*.stories.tsx',
        'apps/web/src/main.tsx',
      ],
    },
  },
});
