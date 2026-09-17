import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite configuration for N-Guard frontend.
 * In development, all /api requests are proxied to the CAP backend (port 4004).
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target    : 'http://localhost:4004',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir   : 'dist',
    sourcemap: true,
  },
});
