import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Vitest configuration.
 *
 * Kept separate from vite.config.ts because the app build config carries
 * production-only concerns (manualChunks, external mysql2, env loading) that
 * are irrelevant — and in the case of `external` actively unhelpful — under test.
 *
 * Path aliases are duplicated from vite.config.ts so `@/…` imports resolve
 * identically in tests and in the app.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      src: resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Start with the money paths and the print renderers — the areas where a
      // silent regression is most expensive.
      include: [
        'src/utils/printTemplateRenderer.ts',
        'src/components/print-templates/**',
        'src/hooks/useLocaleFormat.ts',
        'src/services/**',
      ],
    },
  },
});
