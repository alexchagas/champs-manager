import test from 'node:test';
import assert from 'node:assert/strict';
import { getAllClubs } from '../src/data/teamsDatabase.ts';
import { createNewGame } from '../src/data/initialData.ts';
import { migrateCareer, scoreManagers, changeManagers, rolloverManagers } from '../src/engine/careerEconomy.ts';
import { advanceOtherLeaguesProgress } from '../src/engine/crossSeasonSimulation.ts';

test('Task 4: Global manager ecosystem maps managers for all active clubs across divisions', () => {
  const allClubs = getAllClubs();
  const flamengo = allClubs.find((c) => c.name === 'Flamengo' && c.countryId === 29);
  assert.ok(flamengo);

  const rawState = createNewGame(flamengo.id);
  const state = migrateCareer(rawState);

  assert.ok(state.managers.length > 50, 'Must have managers for all active clubs');
  for (const club of state.clubs) {
    const coach = state.managers.find((m) => m.currentClubId === club.id);
    assert.ok(coach, `Club ${club.name} (${club.id}) must have an assigned manager`);
    assert.ok(coach.jobs.length > 0, `Manager ${coach.name} must have at least one job record`);
  }
});

test('Task 4: AI managers in parallel divisions (Série B, C, D) are scored from division standings', () => {
  const allClubs = getAllClubs();
  const flamengo = allClubs.find((c) => c.name === 'Flamengo' && c.countryId === 29);
  const rawState = createNewGame(flamengo.id);
  const state = migrateCareer(rawState);

  // Pick an AI club from nationalDivisions (e.g. Santos in Série B or a Série C club)
  const serieB = state.nationalDivisions?.find((d) => d.division === 2);
  assert.ok(serieB && serieB.standings.length > 0);
  const aiClubId = serieB.standings[0].clubId;
  const aiCoach = state.managers.find((m) => m.currentClubId === aiClubId);
  assert.ok(aiCoach, 'AI club in Série B must have an assigned coach');

  // Simulate advancing Série B progress (e.g. 5 rounds played)
  const advancedNational = advanceOtherLeaguesProgress(
    state.nationalDivisions,
    0.3,
    state.clubs,
    true,
    { currentSemester: 2, currentRound: 19, totalRounds: 38 }
  );

  const advancedSerieB = advancedNational.find((d) => d.division === 2);
  const aiStandingRow = advancedSerieB?.standings.find((r) => r.clubId === aiClubId);
  assert.ok(aiStandingRow && aiStandingRow.played > 0, 'AI club must have matches played in Série B');

  // Score managers across all divisions
  const scoredState = scoreManagers({
    ...state,
    nationalDivisions: advancedNational,
  }, []);

  const scoredCoach = scoredState.managers.find((m) => m.id === aiCoach.id);
  assert.ok(scoredCoach, 'Scored coach must exist');
  const job = scoredCoach.jobs[scoredCoach.jobs.length - 1];

  assert.equal(job.wins, aiStandingRow.won, 'Coach wins must match club wins in division standings');
  assert.equal(job.draws, aiStandingRow.drawn, 'Coach draws must match club draws in division standings');
  assert.equal(job.losses, aiStandingRow.lost, 'Coach losses must match club losses in division standings');
  assert.equal(job.points, aiStandingRow.points, 'Coach points must match club points in division standings');
});

test('Task 4: Global dismissal ("Dança das Cadeiras") fires underperforming AI managers across all divisions', () => {
  const allClubs = getAllClubs();
  const flamengo = allClubs.find((c) => c.name === 'Flamengo' && c.countryId === 29);
  const rawState = createNewGame(flamengo.id);
  const state = migrateCareer(rawState);

  // Pick a Série B club to put into a severe crisis
  const serieB = state.nationalDivisions?.find((d) => d.division === 2);
  assert.ok(serieB && serieB.standings.length >= 10);
  const crisisClubId = serieB.standings[serieB.standings.length - 1].clubId;
  const crisisCoach = state.managers.find((m) => m.currentClubId === crisisClubId);
  assert.ok(crisisCoach);

  // Set standing row to have 8 played matches (>= 5 matches requirement)
  const crisisStandings = serieB.standings.map((r) =>
    r.clubId === crisisClubId ? { ...r, played: 8, won: 0, drawn: 1, lost: 7, points: 1 } : { ...r, played: 8 }
  );
  const crisisNationalDivisions = state.nationalDivisions.map((d) =>
    d.division === 2 ? { ...d, standings: crisisStandings } : d
  );

  // Set coach boardRating below 20 (crisis threshold)
  const crisisManagers = state.managers.map((m) =>
    m.id === crisisCoach.id
      ? { ...m, boardRating: 12, jobs: m.jobs.map((j) => ({ ...j, startRound: 1, wins: 0, draws: 1, losses: 7, points: 1 })) }
      : m
  );

  const stateInCrisis = {
    ...state,
    currentRound: 9,
    managers: crisisManagers,
    nationalDivisions: crisisNationalDivisions,
  };

  const { state: updatedState, dismissals } = changeManagers(stateInCrisis);

  // Confirm dismissal occurred for the crisis club
  const clubDismissal = dismissals.find((d) => d.club.id === crisisClubId);
  assert.ok(clubDismissal, 'Crisis club in Série B must trigger coach dismissal');
  assert.equal(clubDismissal.oldCoach, crisisCoach.name);

  // Confirm old coach is now unemployed and available
  const oldCoachAfter = updatedState.managers.find((m) => m.id === crisisCoach.id);
  assert.equal(oldCoachAfter.available, true, 'Dismissed coach must be available');
  assert.equal(oldCoachAfter.currentClubId, undefined, 'Dismissed coach must not have a current club');

  // Confirm crisis club has hired a new coach
  const updatedClub = updatedState.clubs.find((c) => c.id === crisisClubId);
  assert.notEqual(updatedClub.managerId, crisisCoach.id, 'Club must have new managerId');
  assert.equal(updatedClub.coach, clubDismissal.newCoach);
});

test('Task 4: Performance benchmark - Global manager scoring and evaluation runs under 25ms', () => {
  const allClubs = getAllClubs();
  const flamengo = allClubs.find((c) => c.name === 'Flamengo' && c.countryId === 29);
  const rawState = createNewGame(flamengo.id);
  const state = migrateCareer(rawState);

  const start = performance.now();
  const scored = scoreManagers(state, []);
  const { state: finalState } = changeManagers(scored);
  const elapsed = performance.now() - start;

  assert.ok(finalState.managers.length > 0);
  assert.ok(elapsed < 25, `Global manager cycle must run under 25ms, took ${elapsed.toFixed(2)}ms`);
});

test('Task 4: Rollover awards titles and bonus points to champions of any division', () => {
  const allClubs = getAllClubs();
  const flamengo = allClubs.find((c) => c.name === 'Flamengo' && c.countryId === 29);
  const rawState = createNewGame(flamengo.id);
  const state = migrateCareer(rawState);

  // Pick a Série B club that won the title
  const serieB = state.nationalDivisions?.find((d) => d.division === 2);
  const bChampClubId = serieB.standings[0].clubId;
  const bCoach = state.managers.find((m) => m.currentClubId === bChampClubId);
  assert.ok(bCoach);

  const stateWithChampRecord = {
    ...state,
    championshipHistory: [
      {
        id: '2026-league-29-div2',
        seasonYear: 2026,
        competitionType: 'nacional',
        competitionName: 'Brasileirão Série B',
        championClubId: bChampClubId,
        championClubName: 'Campeão da B',
      },
    ],
  };

  const rolled = rolloverManagers(stateWithChampRecord);
  const bCoachAfter = rolled.managers.find((m) => m.id === bCoach.id);
  assert.ok(bCoachAfter);

  const wonTitle = bCoachAfter.titles.some((t) => t.includes('Brasileirão Série B'));
  assert.ok(wonTitle, 'Série B champion coach must receive the official title on season rollover');
  assert.ok(bCoachAfter.careerScore >= 20, 'Coach must receive title bonus points');
});
