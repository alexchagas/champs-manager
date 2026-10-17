import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readNews = () => fs.readFileSync(path.join(__dirname, '../src/components/NewsFeed.tsx'), 'utf8');

// Os PNGs de web/public/escudos* não estão no git (ver .gitignore): os escudos vêm das sprites
// em public/sprites, resolvidas pelo ClubCrest. Um <img> direto para a URL antiga quebra.
test('NewsFeed.tsx renders crests through ClubCrest, never a raw <img> to the old PNG URLs', () => {
  const content = readNews();

  assert.ok(!/<img[^>]*src=\{[^}]*[cC]rest/.test(content), 'No raw <img> pointing at a crest URL');
  assert.ok(content.includes("import { ClubCrest } from './ClubCrest';"), 'Imports ClubCrest');
  assert.ok(content.includes('crestMiniUrl: activeArticle.clubCrest'), 'Highlight crest uses ClubCrest');
  assert.ok(content.includes('crestMiniUrl: activeArticle.secondaryClubCrest'), 'Opponent crest uses ClubCrest');
  assert.ok(content.includes('crestMiniUrl: art.clubCrest'), 'News list crest uses ClubCrest');
});
