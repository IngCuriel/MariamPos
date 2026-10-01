/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Vitest configuration for the web POS.
// Uses the jsdom environment so UI/component tests can run outside the browser.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Keep the runner green until the first spec tasks add real tests.
    passWithNoTests: true,
  },
})
