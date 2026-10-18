import test from 'node:test';
import assert from 'node:assert/strict';
import { getAllClubs } from '../src/data/teamsDatabase.ts';
import { createNewGame } from '../src/data/initialData.ts';
import {
  advanceOtherLeaguesProgress,
  buildInitialNationalDivisions,
  buildInitialStateDivisions,
  preSimulateLeagueRounds,
} from '../src/engine/crossSeasonSimulation.ts';

test('Global Simulation: All active national divisions (Séries A, B, C, D) simulate concurrently', () => {
  const allClubs = getAllClubs();
  const palmeiras = allClubs.find((c) => c.name === 'Palmeiras' && c.countryId === 29);
  assert.ok(palmeiras, 'Palmeiras must exist in database');

  const state = createNewGame(palmeiras.id);
  assert.ok(state.nationalDivisions && state.nationalDivisions.length > 0, 'nationalDivisions must be populated');

  // Verify Séries B, C and D exist
  const bDiv = state.nationalDivisions.find((d) => d.division === 2);
  const cDiv = state.nationalDivisions.find((d) => d.division === 3);
  const dDiv = state.nationalDivisions.find((d) => d.division === 4);

  assert.ok(bDiv, 'Série B must exist in nationalDivisions');
  assert.ok(cDiv, 'Série C must exist in nationalDivisions');
  assert.ok(dDiv, 'Série D must exist in nationalDivisions');

  assert.equal(bDiv.standings.length, 20, 'Série B must have 20 clubs');
  assert.equal(cDiv.standings.length, 20, 'Série C must have 20 clubs');
  assert.equal(dDiv.standings.length, 64, 'Série D must have 64 clubs');

  // During Semester 1 (Estaduais), national divisions remain at round 0
  const sem1Advanced = advanceOtherLeaguesProgress(state.nationalDivisions, 0.1, state.clubs, true, {
    currentSemester: 1,
    currentRound: 5,
    totalRounds: 50,
  });
  assert.equal(sem1Advanced.find((d) => d.division === 2)?.currentRound, 0, 'Série B must be at round 0 during Semester 1');
  assert.equal(sem1Advanced.find((d) => d.division === 4)?.currentRound, 0, 'Série D must be at round 0 during Semester 1');

  // During Semester 2, national divisions advance concurrently
  const sem2Advanced = advanceOtherLeaguesProgress(state.nationalDivisions, 0.6, state.clubs, true, {
    currentSemester: 2,
    currentRound: 26, // week 26 (approx 12 national rounds in)
    totalRounds: 50,
  });

  const advB = sem2Advanced.find((d) => d.division === 2);
  const advC = sem2Advanced.find((d) => d.division === 3);
  const advD = sem2Advanced.find((d) => d.division === 4);

  assert.ok((advB?.currentRound ?? 0) > 0, 'Série B must have advanced rounds in Semester 2');
  assert.ok((advC?.currentRound ?? 0) > 0, 'Série C must have advanced rounds in Semester 2');
  assert.ok((advD?.currentRound ?? 0) > 0, 'Série D must have advanced rounds in Semester 2');

  // Check standings consistency: points, played, goalDiff
  for (const row of advB?.standings || []) {
    assert.equal(row.played, advB?.currentRound, 'All Série B clubs must have played currentRound matches');
    assert.equal(row.won + row.drawn + row.lost, row.played, 'Won + Drawn + Lost must equal Played');
    assert.equal(row.points, row.won * 3 + row.drawn, 'Points must equal 3 * Won + Drawn');
    assert.equal(row.goalDiff, row.goalsFor - row.goalsAgainst, 'Goal difference must equal Goals For - Goals Against');
  }
});

test('Global Simulation: State divisions simulate concurrently during Semester 1 and finalize in Semester 2', () => {
  const allClubs = getAllClubs();
  // Choose an access club in SP (XV de Jaú) so user plays Série A2 and Série A1 is in stateDivisions
  const jau = allClubs.find((c) => c.name.includes('Jaú') && c.stateCode === 'SP');
  assert.ok(jau, 'XV de Jaú must exist');

  const state = createNewGame(jau.id);
  assert.ok(state.stateDivisions && state.stateDivisions.length > 0, 'stateDivisions must contain Série A1');

  const a1 = state.stateDivisions.find((d) => d.division === 1);
  assert.ok(a1, 'Série A1 must exist');
  assert.equal(a1.standings.length, 16, 'Paulistão A1 must have 16 clubs');

  // Advance mid-way through Semester 1 (e.g. week 7)
  const sem1Mid = advanceOtherLeaguesProgress(state.stateDivisions, 0.15, state.clubs, true, {
    currentSemester: 1,
    currentRound: 7,
    totalRounds: 50,
  });
  const a1Mid = sem1Mid.find((d) => d.division === 1);
  assert.ok((a1Mid?.currentRound ?? 0) > 0, 'Série A1 must advance during Semester 1');
  assert.ok((a1Mid?.currentRound ?? 0) <= 12, 'Série A1 must not exceed group rounds during mid-season');

  // Once Semester 2 begins, state divisions are 100% complete
  const sem2State = advanceOtherLeaguesProgress(state.stateDivisions, 0.5, state.clubs, true, {
    currentSemester: 2,
    currentRound: 25,
    totalRounds: 50,
  });
  const a1End = sem2State.find((d) => d.division === 1);
  assert.equal(a1End?.currentRound, a1End?.totalRounds, 'Série A1 must be 100% complete in Semester 2');
});

test('Global Simulation: Historical determinism - past round results never mutate when advancing', () => {
  const allClubs = getAllClubs();
  const serieBClubs = allClubs.filter((c) => c.countryId === 29 && c.division === 2).slice(0, 20);
  assert.equal(serieBClubs.length, 20);

  // Simulate up to round 5
  const seed = 54321;
  const round5Standings = preSimulateLeagueRounds(serieBClubs, 5, seed, 1);
  const round5Snapshot = new Map(round5Standings.map((r) => [r.clubId, { ...r }]));

  // Simulate up to round 6 with the SAME seed
  const round6Standings = preSimulateLeagueRounds(serieBClubs, 6, seed, 1);

  // Verify that every club's stats at round 6 are >= their stats at round 5
  for (const r6 of round6Standings) {
    const r5 = round5Snapshot.get(r6.clubId);
    assert.ok(r5, `Club ${r6.clubName} must exist in round 5 snapshot`);
    assert.equal(r6.played, r5.played + 1, 'Played must increment by exactly 1');
    assert.ok(r6.points >= r5.points, 'Points must be >= round 5 points');
    assert.ok(r6.goalsFor >= r5.goalsFor, 'Goals for must be >= round 5 goals for');
    assert.ok(r6.goalsAgainst >= r5.goalsAgainst, 'Goals against must be >= round 5 goals against');
    assert.ok(r6.won >= r5.won, 'Wins must be >= round 5 wins');
  }
});

test('Global Simulation: Performance benchmark (< 30ms for advancing all active divisions)', () => {
  const allClubs = getAllClubs();
  const palmeiras = allClubs.find((c) => c.name === 'Palmeiras' && c.countryId === 29);
  assert.ok(palmeiras);
  const state = createNewGame(palmeiras.id);

  const iterations = 10;
  const startTime = performance.now();

  let currentNat = state.nationalDivisions || [];
  let currentStateDivs = state.stateDivisions || [];
  let currentCont = state.continentalCompetitions || [];
  let currentOther = state.otherLeagues || [];

  for (let round = 1; round <= iterations; round++) {
    const roundStart = performance.now();
    const ratio = round / 50;
    const ctx = {
      currentSemester: round <= 13 ? 1 : 2,
      currentRound: round,
      totalRounds: 50,
    };

    currentNat = advanceOtherLeaguesProgress(currentNat, ratio, state.clubs, true, ctx);
    currentStateDivs = advanceOtherLeaguesProgress(currentStateDivs, ratio, state.clubs, true, ctx);
    currentCont = advanceOtherLeaguesProgress(currentCont, ratio, state.clubs, true, ctx);
    currentOther = advanceOtherLeaguesProgress(currentOther, ratio, state.clubs, true, ctx);

    const roundElapsed = performance.now() - roundStart;
    assert.ok(roundElapsed < 30, `Round ${round} advancement took ${roundElapsed.toFixed(2)}ms, exceeding 30ms limit`);
  }

  const totalElapsed = performance.now() - startTime;
  const avgPerRound = totalElapsed / iterations;
  assert.ok(avgPerRound < 10, `Average advance per round was ${avgPerRound.toFixed(2)}ms, well within target`);
});
