import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame } from '../src/data/initialData.ts';
import { getAllClubs } from '../src/data/teamsDatabase.ts';
import { buildInitialActiveOtherLeagues, advanceOtherLeaguesProgress } from '../src/engine/crossSeasonSimulation.ts';

test('Starting in Brazil with Spain active initializes Spain with 19 rounds played (cross-season)', () => {
  // Club 255 is Flamengo (Brazil, countryId 29)
  const state = createNewGame(255, 'Professor', {
    activeCountryIds: [29, 65], // Brazil and Spain
  });

  assert.ok(state.otherLeagues, 'otherLeagues should exist on GameState');
  assert.equal(state.otherLeagues.length, 1, 'Should have 1 other league for Spain');

  const spainLeague = state.otherLeagues[0];
  assert.equal(spainLeague.countryId, 65);
  assert.equal(spainLeague.seasonLabel, '2025/2026');
  assert.equal(spainLeague.currentRound, 19);
  assert.equal(spainLeague.totalRounds, 38);
  assert.ok(spainLeague.standings.length >= 18, 'Spain should have at least 18-20 clubs');

  // Verify all clubs have played exactly 19 games
  for (const row of spainLeague.standings) {
    assert.equal(row.played, 19, `Club ${row.clubName} should have 19 games played`);
    assert.equal(row.won + row.drawn + row.lost, 19);
    assert.equal(row.points, row.won * 3 + row.drawn);
    assert.equal(row.goalDiff, row.goalsFor - row.goalsAgainst);
  }

  // Verify sorted order
  for (let i = 0; i < spainLeague.standings.length - 1; i++) {
    const a = spainLeague.standings[i];
    const b = spainLeague.standings[i + 1];
    assert.ok(
      a.points > b.points ||
      (a.points === b.points && a.won > b.won) ||
      (a.points === b.points && a.won === b.won && a.goalDiff > b.goalDiff) ||
      (a.points === b.points && a.won === b.won && a.goalDiff === b.goalDiff && a.goalsFor >= b.goalsFor),
      `Standings should be sorted: pos ${i + 1} vs ${i + 2}`
    );
  }
});

test('Starting in Europe (Spain) with Brazil active initializes Brazil at half-season', () => {
  const spanishClub = getAllClubs().find(c => c.countryId === 65);
  assert.ok(spanishClub, 'Spanish club should exist');

  const state = createNewGame(spanishClub.id, 'Mister', {
    activeCountryIds: [65, 29], // Spain and Brazil
  });

  assert.ok(state.otherLeagues, 'otherLeagues should exist on GameState');
  assert.equal(state.otherLeagues.length, 1, 'Should have 1 other league for Brazil');

  const brazilLeague = state.otherLeagues[0];
  assert.equal(brazilLeague.countryId, 29);
  assert.equal(brazilLeague.seasonLabel, '2026');
  assert.equal(brazilLeague.currentRound, 19);
  assert.equal(brazilLeague.totalRounds, 38);

  for (const row of brazilLeague.standings) {
    assert.equal(row.played, 19);
    assert.equal(row.won + row.drawn + row.lost, 19);
  }
});

test('advanceOtherLeaguesProgress progresses rounds proportionally to user calendar', () => {
  const brazilClub = getAllClubs().find(c => c.countryId === 29) || { id: 255, countryId: 29 };
  const allClubs = getAllClubs();
  const initialLeagues = buildInitialActiveOtherLeagues(brazilClub, [29, 65], allClubs, 2026);
  assert.equal(initialLeagues.length, 1);
  const initialRound = initialLeagues[0].currentRound; // 19

  // Advance user calendar round from 1 to 20 out of 68 total dates
  const updatedLeagues = advanceOtherLeaguesProgress(initialLeagues, 20, 68);
  assert.ok(
    updatedLeagues[0].currentRound >= initialRound,
    `Round should advance or stay: was ${initialRound}, now ${updatedLeagues[0].currentRound}`
  );
  assert.ok(
    updatedLeagues[0].currentRound <= 38,
    'Round should not exceed total rounds (38)'
  );
});
