import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** The manifest colors come from the light `--bg` token, so DESIGN.md stays the only source. */
const tokens = readFileSync(new URL('./src/styles/tokens.css', import.meta.url), 'utf8');
const [paper, graphite] = [...tokens.matchAll(/--bg:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1]);
if (!paper || !graphite) throw new Error('tokens.css needs a light and a dark --bg color');

/** Browser chrome color for both themes, from the same tokens. */
const themeColor: Plugin = {
  name: 'vgc-theme-color',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { name: 'theme-color', media: '(prefers-color-scheme: light)', content: paper },
      injectTo: 'head',
    },
    {
      tag: 'meta',
      attrs: { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: graphite },
      injectTo: 'head',
    },
  ],
};

// In development the API runs on :3000 and Vite proxies /api to it, so the browser sees one
// origin (http://localhost:5173), exactly like production, and the session cookie just works.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    themeColor,
    VitePWA({
      registerType: 'autoUpdate',
      // A generated registerSW.js file, not an inline script: the CSP is `script-src 'self'`.
      injectRegister: 'script',
      // Vercel Authentication protects every deployment, so the manifest request needs cookies.
      useCredentials: true,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'VGC Helper',
        short_name: 'VGC Helper',
        description: 'Team builder for competitive Pokémon.',
        lang: 'en',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: paper,
        background_color: paper,
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Only the app shell. /api responses are private and tied to the session: never cached.
        // The favicon and the icons are added through includeAssets and the manifest.
        globPatterns: ['**/*.{js,css,html,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
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
