import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Tests resolve workspace packages from source so no build step is needed.
      '@series-studio/core': `${here}packages/core/src/index.ts`,
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
    server: { deps: { inline: [] } },
    environment: 'node',
    testTimeout: 20_000,
  },
});
