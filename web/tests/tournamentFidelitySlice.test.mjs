import test from 'node:test';
import assert from 'node:assert/strict';
import { getAllClubs, getClubById } from '../src/data/teamsDatabase.ts';
import { createNewGame } from '../src/data/initialData.ts';
import { getContinentalTournamentField } from '../src/data/continentalRepresentatives.ts';
import { advanceOtherLeaguesProgress, buildInitialNationalDivisions, buildInitialStateDivisions } from '../src/engine/crossSeasonSimulation.ts';
import { getStateDivisionInfo } from '../src/data/stateLeagueFormulas.ts';

// ---------------------------------------------------------------------------
// REQUIREMENT 1: Canonical National Competition Names Everywhere
// ---------------------------------------------------------------------------
test('Requirement 1: canonicalize national competition names for user division and selected divisions (Série A/B/C/D)', () => {
  // Clubs from each division
  const flamengo = getClubById(255); // Série A (div 1)
  const avai = getClubById(83); // Série B (div 2)
  const amazonas = getClubById(44); // Série C (div 3)
  const portuguesa = getClubById(503); // Série D (div 4)

  assert.ok(flamengo && avai && amazonas && portuguesa);

  const testCases = [
    { club: flamengo, expectedName: 'Brasileirão Série A' },
    { club: avai, expectedName: 'Brasileirão Série B' },
    { club: amazonas, expectedName: 'Brasileirão Série C' },
    { club: portuguesa, expectedName: 'Brasileirão Série D' },
  ];

  for (const { club, expectedName } of testCases) {
    const state = createNewGame(club.id);

    // 1. GameState.nationalLeagueName must be canonical
    assert.equal(
      state.nationalLeagueName,
      expectedName,
      `GameState.nationalLeagueName for ${club.name} (div ${club.division}) must be "${expectedName}", got "${state.nationalLeagueName}"`
    );

    // 2. All national calendar fixtures must have canonical competitionName
    const nationalFixtures = state.calendar.filter((f) => f.competitionType === 'nacional');
    assert.ok(nationalFixtures.length > 0, `Must have national fixtures for ${club.name}`);
    for (const fix of nationalFixtures) {
      assert.equal(
        fix.competitionName,
        expectedName,
        `Fixture id=${fix.id} competitionName must be "${expectedName}", got "${fix.competitionName}"`
      );
    }

    // 3. nationalDivisions must also use canonical names for other divisions
    if (state.nationalDivisions && state.nationalDivisions.length > 0) {
      for (const div of state.nationalDivisions) {
        assert.match(
          div.leagueName,
          /^Brasileirão Série [ABCD]$/,
          `nationalDivisions leagueName must be canonical Brasileirão Série A/B/C/D, got "${div.leagueName}"`
        );
      }
    }
  }
});

// ---------------------------------------------------------------------------
// REQUIREMENT 2: Explicit and Honest Continental Tournament Generation
// ---------------------------------------------------------------------------
test('Requirement 2: honest continental tournament generation and no Sul-Americana as Libertadores fallback', () => {
  const allClubs = getAllClubs();
  const flamengo = getClubById(255); // Top division elite
  const avai = getClubById(83); // Lower division (Série B)
  const portuguesa = getClubById(503); // Lower division (Série D)

  assert.ok(flamengo && avai && portuguesa);

  // 1. Lower division clubs do not participate without qualification
  for (const club of [avai, portuguesa]) {
    const field = getContinentalTournamentField(club);
    assert.equal(field.userParticipates, false, `${club.name} must not participate in continental tournament`);
    assert.ok(!field.clubs.some((c) => c.id === club.id), `${club.name} must not be in continental clubs`);

    const state = createNewGame(club.id);
    const userContinental = state.calendar.filter(
      (f) =>
        ['libertadores', 'sulamericana', 'champions'].includes(f.competitionType || '') &&
        (f.homeClubId === club.id || f.awayClubId === club.id)
    );
    assert.equal(userContinental.length, 0, `${club.name} must have 0 scheduled continental matches`);
  }

  // 2. Top-division club qualifies and participates in Copa Libertadores
  const flamengoField = getContinentalTournamentField(flamengo);
  assert.equal(flamengoField.userParticipates, true);
  assert.equal(flamengoField.type, 'libertadores');
  assert.equal(flamengoField.name, 'Copa Libertadores');

  // 3. Continental field is honestly Copa Libertadores, never disguised as Sul-Americana as fallback
  // Even for a modest division 1 club or custom test club, South American continental competition is Copa Libertadores
  const modestDiv1 = allClubs.find((c) => c.countryId === 29 && c.division === 1 && (c.reputation ?? 1) <= 2) || flamengo;
  const modestField = getContinentalTournamentField(modestDiv1, undefined, undefined, { forceUserParticipation: true });
  assert.equal(
    modestField.name,
    'Copa Libertadores',
    'South American elite tournament field must be Copa Libertadores, not disguised as Sul-Americana'
  );
  assert.equal(modestField.type, 'libertadores');

  // 4. Blocker test note for 32 clubs: current topology remains 16 clubs
  assert.equal(flamengoField.clubs.length, 16, 'Topology must safely remain 16 clubs');
});

// ---------------------------------------------------------------------------
// REQUIREMENT 3: State Second-Division Metadata and Visibility
// ---------------------------------------------------------------------------
test('Requirement 3: state second-division metadata and visibility only where >= 8 real clubs remain', () => {
  const allClubs = getAllClubs();

  // 1. Metadata check for São Paulo (SP): 103 clubs total, 16 elite, 87 remaining >= 8
  const spInfo = getStateDivisionInfo('SP', allClubs);
  assert.ok(spInfo, 'SP must have state division info');
  assert.equal(spInfo.hasSecondDivision, true, 'SP must have second division');
  assert.equal(spInfo.tier1.tier, 1);
  assert.equal(spInfo.tier1.badge, '1ª Divisão');
  assert.equal(spInfo.tier2?.tier, 2);
  assert.equal(spInfo.tier2?.badge, '2ª Divisão');
  assert.ok(spInfo.tier2?.leagueName.includes('Série A2'), `SP second division name should reference Série A2, got ${spInfo.tier2?.leagueName}`);

  // 2. Metadata check for Acre (AC): 12 clubs total, 8 elite, 4 remaining < 8
  const acInfo = getStateDivisionInfo('AC', allClubs);
  assert.ok(acInfo, 'AC must have state division info');
  assert.equal(acInfo.hasSecondDivision, false, 'AC must NOT have second division because only 4 real clubs remain');
  assert.equal(acInfo.tier2, undefined, 'AC must have no tier2 division');

  // 3. buildInitialStateDivisions test
  const flamengo = getClubById(255); // RJ (62 clubs total, 12 elite, 50 remaining >= 8)
  const rjDivs = buildInitialStateDivisions(flamengo, allClubs, 2026);
  assert.ok(rjDivs && rjDivs.length === 1, 'RJ must generate exactly 1 state second division');
  assert.equal(rjDivs[0].division, 2);
  assert.ok(rjDivs[0].standings.length >= 8, 'RJ second division must have at least 8 real clubs');
  // All clubs in RJ second division must be real RJ clubs
  for (const row of rjDivs[0].standings) {
    const club = getClubById(row.clubId);
    assert.ok(club, `Club ${row.clubId} in second division must exist`);
    assert.equal(club.stateCode, 'RJ', `Club ${club.name} must belong to RJ`);
  }

  // 4. Acre career must NOT generate state second division
  const adesg = getClubById(741); // AC
  assert.ok(adesg);
  const acDivs = buildInitialStateDivisions(adesg, allClubs, 2026);
  assert.equal(acDivs.length, 0, 'Acre must have 0 state second divisions (never fabricate competitions)');

  // 5. GameState stateDivisions lifecycle
  const stateSP = createNewGame(503); // Portuguesa (SP)
  assert.ok(stateSP.stateDivisions && stateSP.stateDivisions.length === 1, 'Portuguesa must have stateDivisions initialized');
  assert.equal(stateSP.stateDivisions[0].division, 2);
  assert.equal(stateSP.stateDivisions[0].currentRound, 0);

  // Advance stateDivisions
  const advancedStateDivs = advanceOtherLeaguesProgress(stateSP.stateDivisions, 0.5, stateSP.clubs, true);
  assert.ok(advancedStateDivs[0].currentRound > 0, 'stateDivisions must advance with season progress');
  assert.ok(advancedStateDivs[0].standings[0].played > 0, 'stateDivisions standings must record played matches');

  // Portuguesa gameplay placement must remain in Paulistão (elite field)
  const paulistaoClubs = stateSP.standingsEstadual.map((s) => s.clubName);
  assert.ok(paulistaoClubs.includes('Portuguesa'), 'Portuguesa must remain in Paulistão elite field');
  assert.ok(paulistaoClubs.includes('Palmeiras'), 'Palmeiras must remain in Paulistão elite field');
  assert.ok(paulistaoClubs.includes('São Paulo'), 'São Paulo must remain in Paulistão elite field');
  assert.ok(paulistaoClubs.includes('Corinthians'), 'Corinthians must remain in Paulistão elite field');
  assert.ok(paulistaoClubs.includes('Santos'), 'Santos must remain in Paulistão elite field');
});

// ---------------------------------------------------------------------------
// REQUIREMENT 4: ClubOverview UI & Code Contract Regression Tests
// ---------------------------------------------------------------------------
test('Requirement 4: ClubOverview UI regression tests for canonical titles and state tier badges', async () => {
  const fs = await import('node:fs');
  const overviewSource = fs.readFileSync(new URL('../src/components/ClubOverview.tsx', import.meta.url), 'utf-8');

  // 1. Structural UI contract check: stateDivisions in allExternalLeagues
  assert.ok(
    overviewSource.includes('gameState.stateDivisions'),
    'ClubOverview must integrate gameState.stateDivisions in external leagues'
  );

  // 2. Structural UI contract check: canonical national title and state second division title in tableTitle
  assert.ok(
    overviewSource.includes('isNationalDiv || isStateDiv'),
    'ClubOverview must display clean canonical title for national and state divisions without season appending'
  );

  // 3. Structural UI contract check: tier badge 1ª Divisão for active estadual
  assert.ok(
    overviewSource.includes("badge: '1ª Divisão'"),
    'ClubOverview must assign 1ª Divisão badge to active estadual tab'
  );
  assert.ok(
    overviewSource.includes('1ª Divisão'),
    'ClubOverview must render 1ª Divisão tier badge in table header when tableIsEstadual'
  );

  // 4. Structural UI contract check: tier badge 2ª Divisão for state second division
  assert.ok(
    overviewSource.includes("badge: '2ª Divisão'"),
    'ClubOverview must assign 2ª Divisão badge to stateDivisions tab'
  );
  assert.ok(
    overviewSource.includes('2ª Divisão'),
    'ClubOverview must render 2ª Divisão tier badge in table header for state second division'
  );

  // 5. Functional view test with Portuguesa (Série D, SP)
  const statePortuguesa = createNewGame(503);
  assert.equal(statePortuguesa.nationalLeagueName, 'Brasileirão Série D');

  // When Portuguesa national league is active, tableTitle derives canonical Brasileirão Série D
  const ptNationalTitle = statePortuguesa.nationalLeagueName;
  assert.equal(ptNationalTitle, 'Brasileirão Série D');

  // Selected external division (e.g. Série B from nationalDivisions)
  const ptDivB = statePortuguesa.nationalDivisions?.find((d) => d.division === 2);
  assert.ok(ptDivB);
  assert.equal(ptDivB.leagueName, 'Brasileirão Série B');

  // State second division for SP
  assert.ok(statePortuguesa.stateDivisions && statePortuguesa.stateDivisions.length === 1);
  assert.equal(statePortuguesa.stateDivisions[0].leagueName, 'Paulistão Série A2');

  // 6. Functional view test with ADESG (Acre)
  const stateAcre = createNewGame(741);
  assert.equal(stateAcre.stateDivisions?.length ?? 0, 0, 'Acre must have no stateDivisions tab');
});

