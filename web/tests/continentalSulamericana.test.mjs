import test from 'node:test';
import assert from 'node:assert/strict';
import { getAllClubs } from '../src/data/teamsDatabase.ts';
import { createNewGame } from '../src/data/initialData.ts';
import { computeContinentalQualifiers } from '../src/data/continentalRepresentatives.ts';
import { advanceOtherLeaguesProgress } from '../src/engine/crossSeasonSimulation.ts';
import { detectNewlyCompletedCompetitions } from '../src/engine/tournamentCompletion.ts';

test('Task 3: Concurrent existence of Copa Libertadores and Copa Sul-Americana for user in Libertadores', () => {
  const allClubs = getAllClubs();
  const flamengo = allClubs.find((c) => c.name === 'Flamengo' && c.countryId === 29);
  assert.ok(flamengo);

  const state = createNewGame(flamengo.id);

  // User plays Libertadores
  assert.equal(state.continentalCupName, 'Copa Libertadores');
  assert.equal(state.standingsContinental.length, 32);
  assert.ok(state.standingsContinental.some((r) => r.clubId === flamengo.id));

  // Calendar schedules Libertadores fixtures
  const libFixtures = state.calendar.filter((f) => f.competitionType === 'libertadores');
  assert.ok(libFixtures.length > 0, 'Libertadores must be scheduled in calendar');
  const userLibFixtures = libFixtures.filter((f) => f.homeClubId === flamengo.id || f.awayClubId === flamengo.id);
  assert.ok(userLibFixtures.length >= 6, 'User club must have at least 6 group stage fixtures in Libertadores');

  // Copa Sul-Americana is simultaneously initialized in continentalCompetitions
  const sula = state.continentalCompetitions?.find((c) => c.id === 'continental-sister');
  assert.ok(sula, 'Copa Sul-Americana must exist in continentalCompetitions');
  assert.equal(sula.leagueName, 'Copa Sul-Americana');
  assert.equal(sula.standings.length, 32, 'Copa Sul-Americana must have 32 clubs');

  // Verify 8 groups of 4 clubs
  const groups = 'ABCDEFGH'.split('');
  for (const grp of groups) {
    const inGroup = sula.standings.filter((r) => r.group === grp);
    assert.equal(inGroup.length, 4, `Sul-Americana Grupo ${grp} must have 4 clubs`);
  }

  // Ensure no overlap of clubs between Libertadores and Sul-Americana
  const libClubIds = new Set(state.standingsContinental.map((r) => r.clubId));
  for (const row of sula.standings) {
    assert.equal(
      libClubIds.has(row.clubId),
      false,
      `Club ${row.clubName} (${row.clubId}) cannot be in both Libertadores and Sul-Americana`
    );
  }
});

test('Task 3: Concurrent existence of Copa Sul-Americana and Copa Libertadores for user in Sul-Americana', () => {
  const allClubs = getAllClubs();
  // Corinthians qualifies for Sul-Americana
  const corinthians = allClubs.find((c) => c.name === 'Corinthians' && c.countryId === 29);
  assert.ok(corinthians);

  const state = createNewGame(corinthians.id);

  // User plays Sul-Americana
  assert.equal(state.continentalCupName, 'Copa Sul-Americana');
  assert.equal(state.standingsContinental.length, 32);
  assert.ok(state.standingsContinental.some((r) => r.clubId === corinthians.id));

  // Calendar schedules Sul-Americana fixtures
  const sulaFixtures = state.calendar.filter((f) => f.competitionType === 'sulamericana');
  assert.ok(sulaFixtures.length > 0, 'Sul-Americana must be scheduled in calendar');
  const userSulaFixtures = sulaFixtures.filter((f) => f.homeClubId === corinthians.id || f.awayClubId === corinthians.id);
  assert.equal(userSulaFixtures.length, 6, 'Corinthians must play 6 group stage fixtures in Sul-Americana');

  // Copa Libertadores is simultaneously initialized in continentalCompetitions
  const lib = state.continentalCompetitions?.find((c) => c.id === 'continental-sister');
  assert.ok(lib, 'Copa Libertadores must exist in continentalCompetitions');
  assert.equal(lib.leagueName, 'Copa Libertadores');
  assert.equal(lib.standings.length, 32, 'Copa Libertadores must have 32 clubs');

  // No overlap
  const sulaClubIds = new Set(state.standingsContinental.map((r) => r.clubId));
  for (const row of lib.standings) {
    assert.equal(
      sulaClubIds.has(row.clubId),
      false,
      `Club ${row.clubName} (${row.clubId}) cannot be in both Sul-Americana and Libertadores`
    );
  }
});

test('Task 3: Advance of continental-sister matches synchronized with Semester 2', () => {
  const allClubs = getAllClubs();
  const flamengo = allClubs.find((c) => c.name === 'Flamengo' && c.countryId === 29);
  const state = createNewGame(flamengo.id);
  const initialSister = state.continentalCompetitions || [];
  assert.ok(initialSister.length > 0);

  // 1. In Semester 1 (e.g. week 7 during Estadual), sister continental tournament should not play group matches
  const sem1Sister = advanceOtherLeaguesProgress(initialSister, 7 / 38, state.clubs, true, {
    currentSemester: 1,
    currentRound: 7,
    totalRounds: 38,
  });
  const sisterInSem1 = sem1Sister.find((c) => c.id === 'continental-sister');
  assert.equal(sisterInSem1.currentRound, 0, 'Continental sister group stage must remain at round 0 during Semester 1');

  // 2. In Semester 2, week 18 (round 2 of continental groups), 2 rounds played
  const sem2MidSister = advanceOtherLeaguesProgress(initialSister, 18 / 38, state.clubs, true, {
    currentSemester: 2,
    currentRound: 18,
    totalRounds: 38,
  });
  const sisterMid = sem2MidSister.find((c) => c.id === 'continental-sister');
  assert.equal(sisterMid.currentRound, 2, 'At week 18, 2 continental group rounds should have been played');

  // 3. In Semester 2, week 30 (after week 26), all 6 group rounds played
  const sem2LateSister = advanceOtherLeaguesProgress(initialSister, 30 / 38, state.clubs, true, {
    currentSemester: 2,
    currentRound: 30,
    totalRounds: 38,
  });
  const sisterLate = sem2LateSister.find((c) => c.id === 'continental-sister');
  assert.equal(sisterLate.currentRound, 6, 'By week 30, all 6 continental group rounds must be played');
});

test('Task 3: Sister continental tournament champion is detected and recorded upon season conclusion', () => {
  const allClubs = getAllClubs();
  const flamengo = allClubs.find((c) => c.name === 'Flamengo' && c.countryId === 29);
  const state = createNewGame(flamengo.id);

  // Fully advance continental-sister to round 6
  const advancedSister = advanceOtherLeaguesProgress(state.continentalCompetitions || [], 1.0, state.clubs, true, {
    currentSemester: 2,
    currentRound: 38,
    totalRounds: 38,
  });

  // Mark all national matches as played
  const playedCalendar = state.calendar.map((f) => ({
    ...f,
    played: true,
    homeScore: 1,
    awayScore: 0,
  }));

  const completedState = {
    ...state,
    calendar: playedCalendar,
    continentalCompetitions: advancedSister,
  };

  const records = detectNewlyCompletedCompetitions(completedState);
  const sulaRecord = records.find((r) => r.competitionType === 'sulamericana');
  assert.ok(sulaRecord, 'Must detect and record completed Copa Sul-Americana champion');
  assert.equal(sulaRecord.competitionName, 'Copa Sul-Americana');
  assert.ok(sulaRecord.championClubId > 0, 'Must have valid championClubId');
  assert.ok(sulaRecord.championClubName, 'Must have valid championClubName');
});

test('Task 3: Sul-Americana champion earns direct qualification to Copa Libertadores in the subsequent season', () => {
  const allClubs = getAllClubs();
  const bahia = allClubs.find((c) => c.name === 'Bahia' && c.countryId === 29);
  assert.ok(bahia);

  // Simulate Bahia winning Copa Sul-Americana
  const seasonRecords = [
    {
      competitionType: 'sulamericana',
      championClubId: bahia.id,
      seasonYear: 2026,
    },
  ];

  // Standings where Bahia finished 15th in Série A (outside normal continental spots)
  const serieAClubs = allClubs.filter((c) => c.countryId === 29 && c.division === 1);
  const standings = serieAClubs.map((c, idx) => ({
    clubId: c.id,
    clubName: c.name,
    points: c.id === bahia.id ? 20 : 60 - idx,
    won: c.id === bahia.id ? 4 : 15,
    goalDiff: 0,
    goalsFor: 30,
    played: 38,
    drawn: 0,
    lost: 0,
    goalsAgainst: 30,
    form: [],
  }));

  const qualifiers = computeContinentalQualifiers(allClubs, standings, seasonRecords);

  assert.ok(
    qualifiers.libertadoresDirectClubIds.includes(bahia.id),
    'Copa Sul-Americana champion (Bahia) must receive direct spot in Copa Libertadores Group Stage'
  );
  assert.ok(
    qualifiers.libertadoresClubIds.includes(bahia.id),
    'Bahia must be included in libertadoresClubIds'
  );
});
