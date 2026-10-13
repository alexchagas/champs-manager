import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { persistClubEdits } from './editorFileStore.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { VitePWA } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';

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
        globPatterns: ['**/*.{js,css,html,ico,svg,wasm}', 'pwa-*.png', 'apple-touch-icon.png'],
        runtimeCaching: [
          {
            urlPattern: /\/sprites\/.*\.(webp|json)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'sprites-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 24 * 60 * 60
              }
            }
          },
          {
            urlPattern: /\/(escudos|escudosMini)\/.*\.png$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'crests-cache',
              expiration: {
                maxEntries: 2000,
                maxAgeSeconds: 30 * 24 * 60 * 60
              }
            }
          },
          {
            urlPattern: /\/audio\/.*\.wav$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 30 * 24 * 60 * 60
              }
            }
          }
        ]
      }
    }),
    sentryVitePlugin({
      org: 'alex-org-3b',
      project: 'javascript-react',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        filesToDeleteAfterUpload: ['**/*.js.map'],
      },
      disable: !process.env.SENTRY_AUTH_TOKEN,
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
    {
      name: 'exclude-raw-crests-from-dist',
      async closeBundle() {
        const fs = await import('node:fs/promises');
        const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'dist');
        await fs.rm(path.join(outDir, 'escudos'), { recursive: true, force: true }).catch(() => {});
        await fs.rm(path.join(outDir, 'escudosMini'), { recursive: true, force: true }).catch(() => {});
      },
    },
  ],
  build: {
    sourcemap: process.env.SENTRY_AUTH_TOKEN ? true : false,
  },
  server: {
    port: 3000,
    open: false,
  },
});
