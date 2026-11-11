import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development the API runs on :3000 and Vite proxies /api to it, so the browser sees one
// origin (http://localhost:5173), exactly like production, and the session cookie just works.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:3000' },
    },
  },
  build: {
    sourcemap: false,
  },
});
