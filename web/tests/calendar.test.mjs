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
  assert.ok(state.calendar.filter(f => f.competitionType === 'copa' && f.round > 2).every(f => f.pendingQualification));
});

test('generic continental competition exposes every group and keeps all groups on one date slot', async () => {
  const { generateTwoSemesterCalendar, initializeStandings } = await import('../src/data/calendarGenerator.ts');
  const clubs = getAllClubs().filter(c => c.countryId === 29).slice(0, 32);
  const user = clubs[0];
  const result = generateTwoSemesterCalendar(user, clubs.slice(0, 20), clubs, 2026);
  const continental = result.calendar.filter(f => f.competitionType === 'libertadores' || f.competitionType === 'sulamericana' || f.competitionType === 'champions');
  const groupFixtures = continental.filter(f => f.competitionRound?.startsWith('Grupo '));
  const groups = [...new Set(groupFixtures.map(f => f.competitionRound.match(/Grupo ([A-Z]+)/)[1]))];
  assert.ok(groups.length >= 4);
  assert.ok(groupFixtures.every(f => f.fixtureDateIndex === groupFixtures[0].fixtureDateIndex || f.competitionRound.includes('Rodada')));
  const standings = initializeStandings(result.continentalClubs, (_club, index) => groups[index % groups.length]);
  assert.equal(new Set(standings.map(row => row.group)).size, groups.length);
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
    const cupMatch = current.find(f => f.competitionType === 'copa' && (f.round === 1 || f.round === 2) && (f.homeClubId === 255 || f.awayClubId === 255));
    const score = cupMatch ? (cupMatch.homeClubId === 255 ? [0, 9] : [9, 0]) : null;
    state = play(state, slot, score);
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
  const pending = state.calendar.filter(f => f.pendingQualification);
  assert.ok(pending.every(f => (f.competitionType === 'copa' && f.round > 2) || f.stage?.includes('Quartas') || f.stage?.includes('Semifinal') || f.stage?.includes('Final')));
  assert.ok(state.calendar.filter(f => f.competitionRound?.startsWith('Grupo ')).every(f => f.played || f.pendingQualification));
  assert.equal(state.calendar.filter(f => f.competitionType === 'copa' && f.round > 2 && (f.homeClubId === 255 || f.awayClubId === 255)).length, 0);
  // Verify that Leg 1 NEVER has penalty scores
  assert.ok(state.calendar.filter(f => f.competitionType === 'copa' && f.leg === 1).every(f => !f.penaltyScore));
});

test('Copa do Brasil two-legged ties never shoot out in Leg 1 and resolve aggregate in Leg 2', () => {
  const initial = createNewGame(255);
  const cupLeg1 = initial.calendar.find(f => f.competitionType === 'copa' && f.stage === 'Oitavas de Final' && f.leg === 1);
  const cupLeg2 = initial.calendar.find(f => f.competitionType === 'copa' && f.stage === 'Oitavas de Final' && f.leg === 2 && f.homeClubId === cupLeg1.awayClubId);
  assert.ok(cupLeg1);
  assert.ok(cupLeg2);
  assert.equal(cupLeg1.leg, 1);
  assert.equal(cupLeg2.leg, 2);

  // Leg 1 played with a draw: 1x1
  let updatedCalendar = initial.calendar.map(f => {
    if (f.id === cupLeg1.id) return { ...f, played: true, homeScore: 1, awayScore: 1 };
    return f;
  });
  let state = resolvePendingFixtures({ ...initial, calendar: updatedCalendar });
  let resolvedLeg1 = state.calendar.find(f => f.id === cupLeg1.id);
  // Assert Leg 1 DRAW NEVER HAS PENALTIES
  assert.equal(resolvedLeg1.penaltyScore, undefined);

  // Leg 2 played with 2x2 (aggregate 3x3 tie)
  updatedCalendar = state.calendar.map(f => {
    if (f.id === cupLeg2.id) return { ...f, played: true, homeScore: 2, awayScore: 2 };
    return f;
  });
  state = resolvePendingFixtures({ ...state, calendar: updatedCalendar });
  let resolvedLeg2 = state.calendar.find(f => f.id === cupLeg2.id);
  // Assert Leg 2 has penalties recorded when aggregate is tied
  assert.ok(resolvedLeg2.penaltyScore);
  assert.equal(resolvedLeg2.penaltyScore.length, 2);
});

