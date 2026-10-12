import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { persistClubEdits } from './editorFileStore.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
  server: {
    port: 3000,
    open: false,
  },
});
