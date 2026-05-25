import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['integration/**/*.spec.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 10000,
  },
});
