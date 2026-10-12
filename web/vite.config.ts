import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { persistClubEdits } from './editorFileStore.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Champs Manager 2026',
        short_name: 'Champs Manager',
        description: 'Gerenciador Clássico de Futebol',
        theme_color: '#0c1511',
        background_color: '#0c1511',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}']
      }
    }),
    {
      name: 'club-editor-file-api',
      configureServer(server) {
        server.middlewares.use('/api/editor/clubs', async (req, res) => {
          if (req.method !== 'POST') { res.writeHead(405).end(); return; }
          try {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(Buffer.from(chunk));
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
            await persistClubEdits(root, body.clubs);
            res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'text/plain' }).end(String(error));
          }
        });
      },
    },
  ],
  build: {
    sourcemap: false,
  },
  server: {
    port: 3000,
    open: false,
  },
});
