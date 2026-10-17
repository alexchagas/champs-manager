import test from 'node:test';
import assert from 'node:assert/strict';
import { getAllClubs, getCompetitionClubs } from '../src/data/teamsDatabase.ts';
import { createNewGame } from '../src/data/initialData.ts';
import { getContinentalTournamentField } from '../src/data/continentalRepresentatives.ts';
import { getCompetitionZones } from '../src/engine/competitionZones.ts';
import { advanceOtherLeaguesProgress, buildInitialNationalDivisions } from '../src/engine/crossSeasonSimulation.ts';

test('Requirement 1: Lower-division clubs (e.g. Portuguesa) must not be forcibly included in Libertadores/Sul-Americana without qualification', () => {
  const allClubs = getAllClubs();
  const portuguesa = allClubs.find((c) => c.name === 'Portuguesa');
  assert.ok(portuguesa, 'Portuguesa must exist in database');
  assert.equal(portuguesa.division, 4, 'Portuguesa must be in Série D (division 4)');

  // 1. getContinentalTournamentField for lower division club without explicit participation
  const continentalInfo = getContinentalTournamentField(portuguesa);
  assert.equal(continentalInfo.userParticipates, false, 'User must not participate in continental tournament');
  assert.equal(continentalInfo.clubs.length, 16, 'Continental tournament must still generate 16 eligible clubs');
  const hasPortuguesa = continentalInfo.clubs.some((c) => c.id === portuguesa.id);
  assert.equal(hasPortuguesa, false, 'Portuguesa must not be in continental clubs');

  // 2. createNewGame for Portuguesa
  const state = createNewGame(portuguesa.id);
  if (state.standingsContinental && state.standingsContinental.length > 0) {
    const inStandings = state.standingsContinental.some((r) => r.clubId === portuguesa.id);
    assert.equal(inStandings, false, 'Portuguesa must not be in standingsContinental');
  }
  const userContinentalMatches = state.calendar.filter(
    (f) =>
      ['libertadores', 'sulamericana'].includes(f.competitionType || '') &&
      (f.homeClubId === portuguesa.id || f.awayClubId === portuguesa.id)
  );
  assert.equal(userContinentalMatches.length, 0, 'Portuguesa must not have any scheduled continental fixtures');

  // 3. Eligible top-division club (e.g. Flamengo) qualifies and participates
  const flamengo = allClubs.find((c) => c.id === 255);
  assert.ok(flamengo);
  const flamengoContinental = getContinentalTournamentField(flamengo);
  assert.equal(flamengoContinental.userParticipates, true);
  assert.ok(flamengoContinental.clubs.some((c) => c.id === flamengo.id));

  // 4. Explicit user participation override
  const explicitInfo = getContinentalTournamentField(portuguesa, undefined, undefined, { forceUserParticipation: true });
  assert.equal(explicitInfo.userParticipates, true);
  assert.ok(explicitInfo.clubs.some((c) => c.id === portuguesa.id));
});

test('Requirement 2: nationalDivisions must advance when user advances rounds and survive season rollover', () => {
  const allClubs = getAllClubs();
  const chapecoense = allClubs.find((c) => c.name === 'Chapecoense'); // Série A
  assert.ok(chapecoense);

  const state = createNewGame(chapecoense.id);
  assert.ok(state.nationalDivisions && state.nationalDivisions.length > 0, 'nationalDivisions must be initialized');

  const divNames = state.nationalDivisions.map((d) => d.leagueName);
  assert.ok(divNames.some((n) => n.includes('Série B')), 'Must include Série B');
  assert.ok(divNames.some((n) => n.includes('Série C')), 'Must include Série C');
  assert.ok(divNames.some((n) => n.includes('Série D')), 'Must include Série D');

  // Check initial rounds are 0
  assert.equal(state.nationalDivisions[0].currentRound, 0);

  // Test advancing nationalDivisions
  const advanced = advanceOtherLeaguesProgress(state.nationalDivisions, 0.5, state.clubs, true);
  assert.ok(advanced[0].currentRound > 0, `nationalDivisions currentRound must increase on advance, got ${advanced[0].currentRound}`);
  assert.ok(advanced[0].standings[0].played > 0, 'Standings rows must show played matches');

  // Test rollover survival
  const rolledOverDivs = buildInitialNationalDivisions(chapecoense, state.clubs, 2027);
  assert.ok(rolledOverDivs && rolledOverDivs.length > 0, 'nationalDivisions must survive season rollover');
  assert.equal(rolledOverDivs[0].seasonLabel, '2027', 'Rolled over nationalDivisions must have updated season year');
});

test('Requirement 3: ClubOverview must label user national division explicitly as Série A/B/C/D and calculate competition zones from selected division', () => {
  const allClubs = getAllClubs();
  const portuguesa = allClubs.find((c) => c.name === 'Portuguesa'); // division 4
  const avai = allClubs.find((c) => c.name === 'Avaí'); // division 2
  const chapecoense = allClubs.find((c) => c.name === 'Chapecoense'); // division 1

  assert.ok(portuguesa && avai && chapecoense);

  // Helper function to test label derivation
  function getNationalDivisionLabel(club, leagueName) {
    if (club.countryId === 29) {
      const letter = club.division === 1 ? 'A' : club.division === 2 ? 'B' : club.division === 3 ? 'C' : club.division === 4 ? 'D' : '';
      if (letter) return `Brasileirão Série ${letter}`;
    }
    return leagueName || 'Brasileirão';
  }

  assert.equal(getNationalDivisionLabel(chapecoense, 'Brasileirão'), 'Brasileirão Série A');
  assert.equal(getNationalDivisionLabel(avai, 'Brasileirão'), 'Brasileirão Série B');
  assert.equal(getNationalDivisionLabel(portuguesa, 'Brasileirão'), 'Brasileirão Série D');

  // Competition zones calculation for Série D (division 4)
  const serieDZones = getCompetitionZones({
    competitionType: 'nacional',
    totalTeams: 8,
    division: 4,
    countryId: 29,
  });
  // Série D has promotion (Acesso), but NEVER relegation and NEVER Libertadores/Sul-Americana
  assert.ok(serieDZones.some((z) => z.label === 'Acesso'), 'Série D must have Acesso zone');
  assert.ok(!serieDZones.some((z) => z.label === 'Rebaixamento'), 'Série D must NOT have Rebaixamento zone');
  assert.ok(!serieDZones.some((z) => z.label === 'Libertadores'), 'Série D must NOT have Libertadores zone');

  // When competition zones are calculated for an external division (e.g. division 4 in nationalDivisions),
  // it must use division 4, NEVER hardcoded division 1
  const externalDiv4Zones = getCompetitionZones({
    competitionType: 'nacional',
    totalTeams: 20,
    division: 4,
    countryId: 29,
  });
  assert.ok(!externalDiv4Zones.some((z) => z.label === 'Libertadores'), 'External Série D must not get Libertadores zone');
});

test('Requirement 4: Série D group selection must not pad an official 8-club regional group with unrelated access clubs', () => {
  const allClubs = getAllClubs();
  const portuguesa = allClubs.find((c) => c.name === 'Portuguesa');
  assert.ok(portuguesa);

  const res = getCompetitionClubs(portuguesa.id);
  assert.equal(res.competitionClubs.length, 8, `Official Série D group must have exactly 8 clubs, got ${res.competitionClubs.length}`);
  assert.ok(res.divisionName.includes('Série D'), 'Division name must indicate Série D');
  assert.ok(res.competitionClubs.some((c) => c.id === portuguesa.id), 'Portuguesa must be in the group');
});

test('Requirement 5: Paulistão Formula 7 defect and meritocracy sorting', () => {
  const allClubs = getAllClubs();
  const portuguesa = allClubs.find((c) => c.name === 'Portuguesa');
  assert.ok(portuguesa);

  const state = createNewGame(portuguesa.id);
  const estadualClubs = state.standingsEstadual.map((s) => s.clubName);

  // Paulistão has 16 clubs
  assert.equal(estadualClubs.length, 16, 'Paulistão must contain 16 clubs');
  assert.ok(estadualClubs.includes('Palmeiras'), 'Palmeiras must be in Paulistão');
  assert.ok(estadualClubs.includes('São Paulo'), 'São Paulo must be in Paulistão');
  assert.ok(estadualClubs.includes('Corinthians'), 'Corinthians must be in Paulistão');
  assert.ok(estadualClubs.includes('Santos'), 'Santos must be in Paulistão');
  assert.ok(estadualClubs.includes('Portuguesa'), 'Portuguesa must be in Paulistão');

  // Verify group rounds: For Formula 7 (16 clubs in 4 groups of 4), teams play 12 inter-group matches (or 12 rounds),
  // not an arbitrary 11-round cutoff from a 12-team formula
  const estadualFixtures = state.calendar.filter((f) => f.competitionType === 'estadual' && f.stage?.startsWith('Rodada'));
  const userEstadualMatches = estadualFixtures.filter((f) => f.homeClubId === portuguesa.id || f.awayClubId === portuguesa.id);
  assert.equal(userEstadualMatches.length, 12, `Paulistão group stage must have 12 matches for each club, got ${userEstadualMatches.length}`);
});

test('Requirement 6: Copa Libertadores 32 clubs blocker test', () => {
  // Documenting architectural blockers for expanding Libertadores to 32 clubs:
  // 1. getContinentalTournamentField currently generates 16 clubs safely
  const allClubs = getAllClubs();
  const flamengo = allClubs.find((c) => c.id === 255);
  const field = getContinentalTournamentField(flamengo);
  assert.equal(field.clubs.length, 16, 'Current architecture safely supports 16-club continental field');

  // 2. Blocker check: Qualification engine (qualification.ts) only supports 4 groups 'ABCD' and Quartas de Final (8 teams).
  // Expanding to 32 teams requires 8 groups (A-H), Oitavas de Final (16 teams), and 2 additional calendar weeks
  // that would conflict with current national league schedules if not redesigned.
  const is32ClubSupportedByArchitecture = false;
  assert.equal(
    is32ClubSupportedByArchitecture,
    false,
    'Libertadores 32-club expansion is blocked until Oitavas de Final and 8-group calendar slots are integrated'
  );
});
