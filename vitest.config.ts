import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    clearMocks: true,
    coverage: {
      enabled: false,
    },
    environment: 'node',
    include: [
      'tests/**/*.test.ts',
      'apps/api/**/*.test.ts',
      'apps/web/**/*.test.ts',
      'packages/**/*.test.ts',
    ],
    restoreMocks: true,
  },
});
