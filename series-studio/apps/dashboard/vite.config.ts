import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Dev: Vite serves the app and proxies API/media/WS to the studio server (127.0.0.1:8787).
// Build: output goes to dist/, which apps/server serves at /.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
      '/files': 'http://127.0.0.1:8787',
      '/ws': { target: 'ws://127.0.0.1:8787', ws: true },
    },
  },
});
