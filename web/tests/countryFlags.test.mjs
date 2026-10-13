import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCountryFlag, COUNTRY_FLAGS, POPULAR_COUNTRIES } from '../src/data/countryFlags.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('COUNTRY_FLAGS provides authentic emoji flags for all 224 Brasfoot countries', () => {
  assert.equal(Object.keys(COUNTRY_FLAGS).length, 224, 'All 224 Brasfoot countries must have flags');

  // Verify critical requested countries
  assert.equal(getCountryFlag(131), '🇲🇽', 'ID 131 must be Mexico flag');
  assert.equal(getCountryFlag(68), '🇺🇸', 'ID 68 must be USA flag');
  assert.equal(getCountryFlag(14), '🇦🇺', 'ID 14 must be Australia flag');
  assert.equal(getCountryFlag(143), '🇳🇿', 'ID 143 must be New Zealand flag');
  assert.equal(getCountryFlag(39), '🇶🇦', 'ID 39 must be Qatar flag');
  assert.equal(getCountryFlag(29), '🇧🇷', 'ID 29 must be Brazil flag');
  assert.equal(getCountryFlag(154), '🇵🇹', 'ID 154 must be Portugal flag');
  assert.equal(getCountryFlag(65), '🇪🇸', 'ID 65 must be Spain flag');
  assert.equal(getCountryFlag(97), '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'ID 97 must be England flag');

  // Unknown fallback
  assert.equal(getCountryFlag(9999), '🌐', 'Unknown country must fallback to globe');
  assert.equal(getCountryFlag(null), '🌐', 'Null country must fallback to globe');
});

test('POPULAR_COUNTRIES contains correct Mexico and USA configuration', () => {
  const mex = POPULAR_COUNTRIES.find((c) => c.id === 131);
  const usa = POPULAR_COUNTRIES.find((c) => c.id === 68);

  assert.ok(mex, 'Mexico must be in POPULAR_COUNTRIES');
  assert.equal(mex.name, 'México');
  assert.equal(mex.flag, '🇲🇽');

  assert.ok(usa, 'USA must be in POPULAR_COUNTRIES');
  assert.equal(usa.name, 'Estados Unidos');
  assert.equal(usa.flag, '🇺🇸');
});

test('leagues_meta.json has correct country IDs, names, and bundleKeys for USA and Mexico', () => {
  const metaPath = path.join(__dirname, '../public/data/leagues/leagues_meta.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

  const c68 = meta.countries.find((c) => c.id === 68);
  const c131 = meta.countries.find((c) => c.id === 131);

  assert.ok(c68, 'Country 68 must exist in leagues_meta.json');
  assert.equal(c68.name, 'Estados Unidos', 'Country 68 must be Estados Unidos');
  assert.equal(c68.bundleKey, 'usa', 'Country 68 must belong to usa bundle');

  assert.ok(c131, 'Country 131 must exist in leagues_meta.json');
  assert.equal(c131.name, 'México', 'Country 131 must be México');
  assert.equal(c131.bundleKey, 'mexico', 'Country 131 must belong to mexico bundle');
});
