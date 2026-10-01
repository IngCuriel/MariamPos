import { defineConfig } from 'vitest/config';

// Minimal Vitest configuration for the ESM backend.
// Runs in the Node environment and discovers *.test.js files under src/.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.js'],
  },
});
