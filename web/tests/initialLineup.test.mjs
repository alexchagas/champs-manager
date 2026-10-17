import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withInitialLineup } from '../src/engine/initialLineup.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const player = (id, isStarter) => ({ id, name: `P${id}`, position: 'MEI', strength: 50, energy: 100, isStarter });
// Clube como vem dos dados do Brasfoot: 19 "titulares" (caso do Barcelona)
const state = () => ({
  userClubId: 1,
  clubs: [
    { id: 1, name: 'Barcelona', squad: Array.from({ length: 27 }, (_, i) => player(100 + i, i < 19)), tactics: { formation: '4-4-2' } },
    { id: 2, name: 'Elche', squad: Array.from({ length: 22 }, (_, i) => player(200 + i, i < 15)), tactics: { formation: '4-4-2' } },
  ],
});

test('withInitialLineup runs the auto-lineup for the user club only', () => {
  const calls = [];
  const fakeAutoSelect = (s, clubId) => {
    calls.push(clubId);
    return {
      ...s,
      clubs: s.clubs.map((c) => (c.id === clubId ? { ...c, squad: c.squad.map((p, i) => ({ ...p, isStarter: i < 11 })) } : c)),
    };
  };

  const result = withInitialLineup(state(), fakeAutoSelect);

  assert.deepEqual(calls, [1], 'Auto-lineup called once, for the user club');
  const user = result.clubs.find((c) => c.id === 1);
  assert.equal(user.squad.filter((p) => p.isStarter).length, 11, 'User club starts with exactly 11 starters');
  const ai = result.clubs.find((c) => c.id === 2);
  assert.equal(ai.squad.filter((p) => p.isStarter).length, 15, 'Other clubs are untouched');
});

test('withInitialLineup keeps the career as it was if the auto-lineup fails', () => {
  const original = state();
  const result = withInitialLineup(original, () => null);
  assert.equal(result, original, 'Falls back to the original state');
});

test('GameContext applies the initial lineup only when a NEW career starts', () => {
  const ctx = fs.readFileSync(path.join(__dirname, '../src/state/GameContext.tsx'), 'utf8');
  assert.ok(
    ctx.includes('withInitialLineup(migrateCareer(createNewGame(clubId, managerName, customOptions, activeCountryIds, loadedClubs)), autoSelectBestLineupWasm)'),
    'startNewGame auto-selects the lineup before the first screen'
  );
  assert.equal(ctx.split('withInitialLineup(').length - 1, 1, 'Not applied when loading saves (user choices are kept)');
});
