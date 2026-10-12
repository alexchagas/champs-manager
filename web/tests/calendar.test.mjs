import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame } from '../src/data/initialData.ts';
import { getAllClubs } from '../src/data/teamsDatabase.ts';
import { readFileSync } from 'node:fs';
import { initSync, WasmCareerEngine } from '../src/wasm_pkg/champs_core.js';
import { resolvePendingFixtures } from '../src/engine/qualification.ts';

test('Flamengo has a complete chronological national season and Brazilian state field', () => {
  const state = createNewGame(255);
  const clubById = new Map(state.clubs.map(club => [club.id, club]));
  const estadual = state.calendar.filter(f => f.competitionType === 'estadual');
  const national = state.calendar.filter(f => f.competitionType === 'nacional');
  assert.ok(estadual.length > 0);
  assert.ok(estadual.filter(f => f.fixtureDateIndex === 1).length > 0);
  assert.ok(estadual.filter(f => !f.pendingQualification).every(f => clubById.get(f.homeClubId)?.countryId === 29 && clubById.get(f.awayClubId)?.countryId === 29));
  for (let round = 1; round <= 38; round++) {
    const fixtures = national.filter(f => f.round === round);
    assert.equal(fixtures.length, 10, `national round ${round}`);
    const participants = fixtures.flatMap(f => [f.homeClubId, f.awayClubId]);
    assert.equal(new Set(participants).size, 20, `national round ${round} repeats a club`);
    assert.equal(new Set(fixtures.map(f => f.fixtureDateIndex)).size, 1);
  }
  assert.equal(new Set(national.map(f => f.fixtureDateIndex)).size, 38);
  assert.ok(state.calendar.every(f => Boolean(f.date && f.competitionRound && f.dayOfWeek)));
  assert.ok(state.calendar.filter(f => f.stage === 'Semifinal').every(f => f.pendingQualification && f.homeClubId === 0));
  assert.ok(state.calendar.filter(f => f.competitionType === 'copa' && f.round > 1).every(f => f.pendingQualification));
});

test('Spanish career skips the estadual and schedules national, cup and continental dates', () => {
  const spanishClub = getAllClubs().find(c => c.countryId === 65);
  assert.ok(spanishClub);
  const state = createNewGame(spanishClub.id);
  assert.equal(state.calendar.filter(f => f.competitionType === 'estadual').length, 0);
  assert.ok(state.calendar.some(f => f.competitionType === 'nacional'));
  assert.ok(state.calendar.some(f => f.competitionType === 'copa'));
  assert.ok(state.calendar.some(f => f.competitionType === 'champions'));
});

test('WASM advances every date and keeps competition tables independent', () => {
  initSync({ module: readFileSync(new URL('../src/wasm_pkg/champs_core_bg.wasm', import.meta.url)) });
  const initial = createNewGame(255);
  const play = (state, slot, score = null) => {
    const engine = new WasmCareerEngine(JSON.stringify({ ...state, currentRound: slot }), 42 + slot);
    const result = resolvePendingFixtures(JSON.parse(engine.play_current_round(score?.[0] ?? null, score?.[1] ?? null, null)));
    engine.free();
    return result;
  };
  const first = play(initial, 1);
  assert.equal(first.standingsEstadual.reduce((sum, row) => sum + row.played, 0), 12);
  assert.equal(first.standingsNacional.reduce((sum, row) => sum + row.played, 0), 0);
  let state = first;
  const lastSlot = Math.max(...initial.calendar.map(f => f.fixtureDateIndex));
  for (let slot = 2; slot <= lastSlot; slot++) {
    const current = state.calendar.filter(f => f.fixtureDateIndex === slot);
    const cupFirst = current.some(f => f.competitionType === 'copa' && f.round === 1);
    state = play(state, slot, cupFirst ? [0, 9] : null);
    if (slot === 11) {
      const topFour = state.standingsEstadual.slice(0, 4).map(row => row.clubId);
      const semifinals = state.calendar.filter(f => f.competitionType === 'estadual' && f.stage === 'Semifinal' && f.leg === 1);
      assert.deepEqual(semifinals.map(f => [f.homeClubId, f.awayClubId]),
        [[topFour[0], topFour[3]], [topFour[1], topFour[2]]]);
      assert.ok(state.calendar.find(f => f.competitionType === 'estadual' && f.stage === 'Final').pendingQualification);
    }
  }
  assert.equal(state.currentRound, lastSlot);
  assert.equal(state.calendar.filter(f => f.competitionType === 'nacional' && f.played).length, 380);
  assert.equal(state.standingsNacional.reduce((sum, row) => sum + row.played, 0), 760);
  assert.equal(state.standingsEstadual.reduce((sum, row) => sum + row.played, 0), 142);
  assert.equal(state.calendar.filter(f => f.pendingQualification).length, 0);
  assert.equal(state.calendar.filter(f => f.competitionType === 'copa' && f.round > 1 && (f.homeClubId === 255 || f.awayClubId === 255)).length, 0);
  assert.ok(state.calendar.filter(f => f.competitionType === 'copa' && f.homeScore === f.awayScore)
    .every(f => f.penaltyScore?.length === 2));
});
