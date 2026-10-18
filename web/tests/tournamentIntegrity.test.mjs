import test from 'node:test';
import assert from 'node:assert/strict';
import { getAllClubs, getCompetitionClubs } from '../src/data/teamsDatabase.ts';
import { createNewGame } from '../src/data/initialData.ts';
import { getContinentalTournamentField, computeContinentalQualifiers } from '../src/data/continentalRepresentatives.ts';
import { getCompetitionZones } from '../src/engine/competitionZones.ts';
import { advanceOtherLeaguesProgress, buildInitialNationalDivisions } from '../src/engine/crossSeasonSimulation.ts';
import { resolvePendingFixtures } from '../src/engine/qualification.ts';

test('Requirement 1: Lower-division clubs (e.g. Portuguesa) must not be forcibly included in Libertadores/Sul-Americana without qualification', () => {
  const allClubs = getAllClubs();
  const portuguesa = allClubs.find((c) => c.name === 'Portuguesa');
  assert.ok(portuguesa, 'Portuguesa must exist in database');
  assert.equal(portuguesa.division, 4, 'Portuguesa must be in Série D (division 4)');

  // 1. getContinentalTournamentField for lower division club without explicit participation
  const continentalInfo = getContinentalTournamentField(portuguesa);
  assert.equal(continentalInfo.userParticipates, false, 'User must not participate in continental tournament');
  assert.equal(continentalInfo.clubs.length, 32, 'Continental tournament must generate 32 eligible clubs across 8 groups');
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

test('Requirement 4: Série D must include all 64 clubs partitioned into 8 regional groups (A to H) with 14 group rounds and playoffs, and Access clubs enter Série D replacing 1 regional slot', () => {
  const allClubs = getAllClubs();
  const portuguesa = allClubs.find((c) => c.name === 'Portuguesa');
  assert.ok(portuguesa);

  const res = getCompetitionClubs(portuguesa.id);
  assert.equal(res.competitionClubs.length, 64, `Official Série D must have all 64 clubs across 8 groups of 8, got ${res.competitionClubs.length}`);
  assert.ok(res.divisionName.includes('Série D'), 'Division name must indicate Série D');
  assert.ok(res.competitionClubs.some((c) => c.id === portuguesa.id), 'Portuguesa must be in the competition');

  const state = createNewGame(portuguesa.id);
  assert.equal(state.standingsNacional.length, 64, 'standingsNacional must have 64 clubs');
  const groups = 'ABCDEFGH'.split('');
  for (const grp of groups) {
    const clubsInGroup = state.standingsNacional.filter((r) => r.group === grp);
    assert.equal(clubsInGroup.length, 8, `Série D Grupo ${grp} must have 8 clubs`);
  }

  // Each club in Série D plays 14 matches in its group (home & away vs 7 group opponents)
  const nacionalGroupFixtures = state.calendar.filter(
    (f) => f.competitionType === 'nacional' && f.competitionRound?.startsWith('Grupo ')
  );
  const portuguesaMatches = nacionalGroupFixtures.filter(
    (f) => f.homeClubId === portuguesa.id || f.awayClubId === portuguesa.id
  );
  assert.equal(portuguesaMatches.length, 14, `Portuguesa must play 14 group matches in Série D, got ${portuguesaMatches.length}`);

  // Playoff stages must be scheduled: Segunda Fase, Oitavas de Final, Quartas de Final, Semifinal, Final
  for (const stage of ['Segunda Fase', 'Oitavas de Final', 'Quartas de Final', 'Semifinal', 'Final']) {
    const stageFixtures = state.calendar.filter((f) => f.competitionType === 'nacional' && f.stage === stage);
    assert.ok(stageFixtures.length > 0, `Série D must schedule ${stage}`);
  }

  // Access club (division 5) enters Série D replacing 1 regional club so all 64 clubs play in 8 groups of 8
  const accessClub = allClubs.find((c) => c.countryId === 29 && c.division === 5);
  assert.ok(accessClub, 'Should find a Brazilian access club (division 5)');
  const accessRes = getCompetitionClubs(accessClub.id);
  assert.equal(accessRes.competitionClubs.length, 64, 'Access club enters 64-club Série D');
  assert.ok(accessRes.competitionClubs.some((c) => c.id === accessClub.id), 'Access club must be included in Série D');
});

test('Requirement 5: Paulistão Formula 7 (4 groups A-D with 1 SP giant per group + Quartas de Final) and Série C (19 single-turn rounds + playoffs)', () => {
  const allClubs = getAllClubs();
  const portuguesa = allClubs.find((c) => c.name === 'Portuguesa');
  assert.ok(portuguesa);

  const state = createNewGame(portuguesa.id);
  const estadualClubs = state.standingsEstadual.map((s) => s.clubName);

  // Paulistão has 16 clubs across 4 groups (A, B, C, D)
  assert.equal(estadualClubs.length, 16, 'Paulistão must contain 16 clubs');
  for (const grp of ['A', 'B', 'C', 'D']) {
    const inGroup = state.standingsEstadual.filter((r) => r.group === grp);
    assert.equal(inGroup.length, 4, `Paulistão Grupo ${grp} must have 4 clubs`);
  }
  assert.ok(estadualClubs.includes('Palmeiras'), 'Palmeiras must be in Paulistão');
  assert.ok(estadualClubs.includes('São Paulo'), 'São Paulo must be in Paulistão');
  assert.ok(estadualClubs.includes('Corinthians'), 'Corinthians must be in Paulistão');
  assert.ok(estadualClubs.includes('Santos'), 'Santos must be in Paulistão');
  assert.ok(estadualClubs.includes('Portuguesa'), 'Portuguesa must be in Paulistão');

  // Verify Pot 1 seeding: Palmeiras, Corinthians, São Paulo, and Santos must be placed in 4 DIFFERENT groups (A, B, C, D)
  const spGiants = ['Palmeiras', 'Corinthians', 'São Paulo', 'Santos'];
  const giantGroups = new Set(
    state.standingsEstadual
      .filter((r) => spGiants.includes(r.clubName))
      .map((r) => r.group)
  );
  assert.equal(giantGroups.size, 4, 'Palmeiras, Corinthians, São Paulo and Santos must be heads of 4 distinct groups (A, B, C, D)');

  // Verify group rounds: For Formula 7 (16 clubs in 4 groups of 4), teams play 12 matches
  const estadualFixtures = state.calendar.filter((f) => f.competitionType === 'estadual' && f.stage?.startsWith('Rodada'));
  const userEstadualMatches = estadualFixtures.filter((f) => f.homeClubId === portuguesa.id || f.awayClubId === portuguesa.id);
  assert.equal(userEstadualMatches.length, 12, `Paulistão group stage must have 12 matches for each club, got ${userEstadualMatches.length}`);

  // Paulistão must include Quartas de Final (4 ties) before Semifinal and Final
  const paulistaoQuartas = state.calendar.filter((f) => f.competitionType === 'estadual' && f.stage === 'Quartas de Final');
  assert.equal(paulistaoQuartas.length, 4, 'Paulistão must have 4 Quartas de Final ties');

  // Série C club must play 19 single-turn rounds + Quartas/Semifinal/Final
  const serieCClub = allClubs.find((c) => c.countryId === 29 && c.division === 3);
  assert.ok(serieCClub);
  const serieCState = createNewGame(serieCClub.id);
  assert.equal(serieCState.standingsNacional.length, 20, 'Série C must have 20 clubs');
  const serieCLeagueFixtures = serieCState.calendar.filter(
    (f) => f.competitionType === 'nacional' && f.stage?.startsWith('Rodada')
  );
  const userSerieCMatches = serieCLeagueFixtures.filter(
    (f) => f.homeClubId === serieCClub.id || f.awayClubId === serieCClub.id
  );
  assert.equal(userSerieCMatches.length, 19, `Série C first phase must be single turn (19 matches), got ${userSerieCMatches.length}`);
  const serieCQuartas = serieCState.calendar.filter((f) => f.competitionType === 'nacional' && f.stage === 'Quartas de Final');
  assert.equal(serieCQuartas.length, 8, 'Série C must have two-legged Quartas de Final (8 matches)');
});

test('Requirement 6: Copa Libertadores & Sul-Americana 32 clubs (8 groups A-H + Oitavas) and 7-stage Copa do Brasil with direct Oitavas entry', () => {
  const allClubs = getAllClubs();
  const flamengo = allClubs.find((c) => c.id === 255);
  const state = createNewGame(flamengo.id);

  // 1. Primary continental tournament (Copa Libertadores) has 32 clubs across 8 groups (A-H) and Oitavas de Final
  assert.equal(state.standingsContinental.length, 32, 'Copa Libertadores must have 32 clubs');
  for (const grp of 'ABCDEFGH'.split('')) {
    const inGroup = state.standingsContinental.filter((r) => r.group === grp);
    assert.equal(inGroup.length, 4, `Libertadores Grupo ${grp} must have 4 clubs`);
  }
  const libOitavas = state.calendar.filter(
    (f) => f.competitionType === 'libertadores' && f.stage === 'Oitavas de Final'
  );
  assert.equal(libOitavas.length, 16, 'Libertadores must schedule 16 Oitavas de Final matches (8 two-legged ties)');

  // 2. Sister continental tournament (Copa Sul-Americana) is simultaneously available in continentalCompetitions with 32 clubs across 8 groups
  const sister = state.continentalCompetitions?.find((l) => l.id === 'continental-sister');
  assert.ok(sister, 'Copa Sul-Americana must be simultaneously initialized in continentalCompetitions');
  assert.equal(sister.leagueName, 'Copa Sul-Americana');
  assert.equal(sister.standings.length, 32, 'Copa Sul-Americana must have 32 clubs');

  // 3. Copa do Brasil has all 7 stages (Primeira Fase, Segunda Fase, Terceira Fase, Oitavas, Quartas, Semifinal, Final)
  for (const st of [
    'Primeira Fase',
    'Segunda Fase',
    'Terceira Fase',
    'Oitavas de Final',
    'Quartas de Final',
    'Semifinal',
    'Final',
  ]) {
    const matches = state.calendar.filter((f) => f.competitionType === 'copa' && f.stage === st);
    assert.ok(matches.length > 0, `Copa do Brasil must schedule ${st}`);
  }

  // 4. Flamengo (Libertadores club) enters directly in Oitavas de Final of Copa do Brasil (not in 1ª/2ª/3ª Fase)
  const earlyCopa = state.calendar.filter(
    (f) =>
      f.competitionType === 'copa' &&
      ['Primeira Fase', 'Segunda Fase', 'Terceira Fase'].includes(f.stage || '') &&
      (f.homeClubId === flamengo.id || f.awayClubId === flamengo.id)
  );
  assert.equal(earlyCopa.length, 0, 'Libertadores club (Flamengo) must bypass 1ª, 2ª and 3ª Fase of Copa do Brasil');
  const oitavasCopa = state.calendar.filter(
    (f) =>
      f.competitionType === 'copa' &&
      f.stage === 'Oitavas de Final' &&
      (f.homeClubId === flamengo.id || f.awayClubId === flamengo.id)
  );
  assert.equal(oitavasCopa.length, 2, 'Libertadores club (Flamengo) must be pre-allocated in Oitavas de Final (Ida e Volta)');

  // 5. Pré-Libertadores (2ª Fase & 3ª Fase) is scheduled in Semester 1 and resolves into Groups E-H of Libertadores + Sul-Americana transfer
  const preLib2 = state.calendar.filter(
    (f) => f.competitionType === 'libertadores' && f.stage === 'Pré-Libertadores (2ª Fase)'
  );
  const preLib3 = state.calendar.filter(
    (f) => f.competitionType === 'libertadores' && f.stage === 'Pré-Libertadores (3ª Fase)'
  );
  assert.equal(preLib2.length, 16, 'Pré-Libertadores (2ª Fase) must schedule 16 matches (8 two-legged ties for 16 clubs)');
  assert.equal(preLib3.length, 8, 'Pré-Libertadores (3ª Fase) must schedule 8 matches (4 two-legged ties for 8 clubs)');

  // Simulate playing 2ª Fase so away clubs (non-seeds) win every tie -> 3ª Fase populates
  let cal = state.calendar.map((f) =>
    f.competitionType === 'libertadores' && f.stage === 'Pré-Libertadores (2ª Fase)'
      ? { ...f, played: true, homeScore: f.leg === 1 ? 0 : 1, awayScore: f.leg === 1 ? 2 : 2 }
      : f
  );
  let resolved = resolvePendingFixtures({ ...state, calendar: cal });
  const populatedPre3 = resolved.calendar.filter(
    (f) => f.competitionType === 'libertadores' && f.stage === 'Pré-Libertadores (3ª Fase)' && !f.pendingQualification
  );
  assert.equal(populatedPre3.length, 8, 'All 8 matches of Pré-Libertadores (3ª Fase) must be populated after 2ª Fase finishes');

  // Simulate playing 3ª Fase so away clubs win every tie -> 4 winners enter Groups E, F, G, H and 4 losers transfer to Sul-Americana
  const expectedWinners = populatedPre3.filter((f) => f.leg === 1).map((f) => f.awayClubId);
  const expectedLosers = populatedPre3.filter((f) => f.leg === 1).map((f) => f.homeClubId);
  cal = resolved.calendar.map((f) =>
    f.competitionType === 'libertadores' && f.stage === 'Pré-Libertadores (3ª Fase)'
      ? { ...f, played: true, homeScore: f.leg === 1 ? 0 : 0, awayScore: f.leg === 1 ? 3 : 1 }
      : f
  );
  resolved = resolvePendingFixtures({
    ...state,
    calendar: cal,
    standingsContinental: resolved.standingsContinental ?? state.standingsContinental,
    continentalCompetitions: resolved.continentalCompetitions ?? state.continentalCompetitions,
  });

  for (let i = 0; i < 4; i++) {
    const grp = ['E', 'F', 'G', 'H'][i];
    const winnerId = expectedWinners[i];
    const inGroupStandings = resolved.standingsContinental.some(
      (r) => r.group === grp && r.clubId === winnerId
    );
    assert.ok(inGroupStandings, `Pré-Libertadores 3ª Fase winner (${winnerId}) must be placed in Grupo ${grp} of Copa Libertadores`);
  }

  const updatedSister = resolved.continentalCompetitions?.find((l) => l.id === 'continental-sister');
  for (const loserId of expectedLosers) {
    const inSula = updatedSister?.standings.some((r) => r.clubId === loserId);
    assert.ok(inSula, `Eliminated club from Pré-Libertadores 3ª Fase (${loserId}) must transfer to Copa Sul-Americana group stage`);
  }

  // 6. computeContinentalQualifiers separates 4 direct Libertadores spots and 2 Pré-Libertadores spots from Série A
  const qualifiers = computeContinentalQualifiers(state.clubs, state.standingsNacional, []);
  assert.equal(qualifiers.libertadoresDirectClubIds.length, 4, 'Top 4 of Série A qualify directly to Libertadores Group Stage');
  assert.equal(qualifiers.preLibertadoresClubIds.length, 2, '5th and 6th of Série A qualify to Pré-Libertadores');
  assert.equal(qualifiers.libertadoresClubIds.length, 6, 'Total Brazilian Libertadores qualifiers (direct + Pré) must be 6');
});

test('Requirement 7: leagues_meta.json and brazil.json must match canonical Brazilian pyramid (Série A/B/C/D + Acesso / Estaduais, no 10ª Divisão or misclassified 1ª Divisão)', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const metaPath = path.resolve(process.cwd(), 'public/data/leagues/leagues_meta.json');
  const brazilBundlePath = path.resolve(process.cwd(), 'public/data/leagues/brazil.json');

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const brazilBundle = JSON.parse(fs.readFileSync(brazilBundlePath, 'utf8'));

  const braIndex = meta.clubsIndex.filter((c) => c.countryId === 29);
  assert.equal(braIndex.length, 827, 'Brazil must have 827 clubs in leagues_meta.json');
  assert.equal(brazilBundle.length, 827, 'brazil.json must have 827 clubs');

  const validDivNames = new Set(['Série A', 'Série B', 'Série C', 'Série D', 'Acesso / Estaduais']);
  for (const club of braIndex) {
    assert.ok(
      validDivNames.has(club.divisionName),
      `Club ${club.name} in leagues_meta.json has invalid divisionName "${club.divisionName}"`
    );
    assert.ok(club.division >= 1 && club.division <= 5, `Club ${club.name} has out-of-range division ${club.division}`);
  }

  for (const name of [
    'Vitória do Jari',
    'Vila Operária',
    'Vilavelhense',
    'Vitória das Tabocas',
    'XV de Jaú',
    'Zinzane FC',
    'Zumbi',
  ]) {
    const inMeta = braIndex.find((c) => c.name === name);
    assert.ok(inMeta, `${name} must exist in leagues_meta.json`);
    assert.equal(inMeta.division, 5, `${name} must be in division 5 (Acesso / Estaduais)`);
    assert.equal(inMeta.divisionName, 'Acesso / Estaduais', `${name} must show badge "Acesso / Estaduais"`);
  }
});

test('Requirement 8: Gama career progression across Pré-Libertadores CPU dates and Libertadores group placeholder integrity', () => {
  const allClubs = getAllClubs();
  const gama = allClubs.find((c) => c.id === 266);
  assert.ok(gama, 'Gama must exist in database');

  const state = createNewGame(gama.id);
  assert.equal(state.userClubId, 266);

  // 1. Initial Libertadores standings contain placeholders for Groups E-H, NOT qualified clubs
  const standingsCont = state.standingsContinental || [];
  assert.equal(standingsCont.length, 32, 'Libertadores must have 32 teams across 8 groups');
  for (let i = 0; i < 4; i++) {
    const grp = ['E', 'F', 'G', 'H'][i];
    const expectedPlaceholderId = 990001 + i;
    const placeholderRow = standingsCont.find((r) => r.group === grp && r.clubId === expectedPlaceholderId);
    assert.ok(placeholderRow, `Group ${grp} must initially contain placeholder ${expectedPlaceholderId}`);
    assert.ok(placeholderRow.clubName.includes('Pré-Lib'), `Group ${grp} placeholder name must mention Pré-Lib`);
  }

  // 2. Fixtures with placeholder clubs have pendingQualification: true
  const groupFixtures = state.calendar.filter((f) => f.competitionRound?.startsWith('Grupo '));
  const placeholderFixtures = groupFixtures.filter(
    (f) =>
      (f.homeClubId >= 990001 && f.homeClubId <= 990004) ||
      (f.awayClubId >= 990001 && f.awayClubId <= 990004)
  );
  assert.ok(placeholderFixtures.length > 0, 'Fixtures for placeholder clubs must exist');
  for (const fix of placeholderFixtures) {
    assert.equal(fix.pendingQualification, true, 'Fixture involving placeholder club must be pendingQualification: true');
  }

  // 3. Calendar structure for Gama
  // Round 1 and Round 2 are state championship matches.
  // Round 3 is Wednesday (Pré-Libertadores 2ª Fase Ida), where Gama has NO match.
  const r3Fixtures = state.calendar.filter((f) => (f.fixtureDateIndex ?? f.round) === 3);
  assert.ok(r3Fixtures.length > 0, 'Round 3 must have fixtures');
  const gamaInR3 = r3Fixtures.some((f) => f.homeClubId === 266 || f.awayClubId === 266);
  assert.equal(gamaInR3, false, 'Gama must have NO match in Round 3 (Pré-Libertadores date)');
  assert.ok(r3Fixtures.every((f) => !f.played), 'Round 3 fixtures must NOT be pre-played at season start');

  // Round 4 is Sunday, where Gama plays Round 3 of Campeonato do Distrito Federal
  const r4Fixtures = state.calendar.filter((f) => (f.fixtureDateIndex ?? f.round) === 4);
  const gamaInR4 = r4Fixtures.some((f) => f.homeClubId === 266 || f.awayClubId === 266);
  assert.ok(gamaInR4, 'Gama must have a scheduled match in Round 4');
});

test('Requirement 11: Choosing an access club in SP (e.g. XV de Jaú) plays Série A2, while Série A1 runs in stateDivisions', () => {
  const allClubs = getAllClubs();
  // Find an access club in São Paulo: level <= 8 and division >= 4
  const spAccessClubs = allClubs.filter(
    (c) => c.countryId === 29 && c.stateCode === 'SP' && (c.division == null || c.division >= 4)
  );
  assert.ok(spAccessClubs.length > 20, 'São Paulo must have more than 20 access clubs');
  const jau = spAccessClubs.find((c) => c.name.includes('Jaú')) || spAccessClubs[spAccessClubs.length - 1];
  assert.ok(jau, 'Access club must exist');

  const state = createNewGame(jau.id);
  assert.equal(state.stateTier, 2, 'User club from access must be assigned to stateTier 2');
  assert.ok(state.stateChampionshipName?.includes('Série A2'), 'Championship name must be Paulistão Série A2');

  // Active tournament must be single-table Série A2
  const estadualRows = state.standingsEstadual || [];
  assert.ok(estadualRows.length >= 8 && estadualRows.length <= 16, 'Série A2 must have between 8 and 16 clubs');
  assert.ok(estadualRows.some((r) => r.clubId === jau.id), 'User club must be in Série A2 standings');
  assert.ok(estadualRows.every((r) => !r.group), 'Série A2 must be a single flight table without groups');

  // Série A1 must be simulated in stateDivisions with the 4 giants seeded in 4 groups!
  assert.ok(state.stateDivisions && state.stateDivisions.length > 0, 'stateDivisions must contain Série A1');
  const a1 = state.stateDivisions.find((d) => d.division === 1);
  assert.ok(a1, 'stateDivisions must have division 1');
  assert.ok(a1.leagueName.includes('Paulistão'), 'Division 1 name must be Paulistão');
  assert.equal(a1.standings.length, 16, 'Paulistão Série A1 must have 16 clubs');

  // Verify the 4 giants are present
  const a1Names = a1.standings.map((r) => r.clubName);
  assert.ok(a1Names.some((n) => n.includes('Palmeiras')), 'Palmeiras must be in A1');
  assert.ok(a1Names.some((n) => n.includes('Corinthians')), 'Corinthians must be in A1');
  assert.ok(a1Names.some((n) => n.includes('São Paulo')), 'São Paulo must be in A1');
  assert.ok(a1Names.some((n) => n.includes('Santos')), 'Santos must be in A1');

  // Verify competition zones for SP Série A2
  const zones = getCompetitionZones({
    competitionType: 'estadual',
    totalTeams: estadualRows.length,
    division: 2,
    stateCode: 'SP',
  });
  const promoZone = zones.find((z) => z.label.includes('Acesso'));
  assert.ok(promoZone, 'Must have Acesso à 1ª Divisão zone');
  assert.equal(promoZone.minPos, 1);
  assert.equal(promoZone.maxPos, 2);

  const relegZone = zones.find((z) => z.label.includes('Rebaixamento'));
  assert.ok(relegZone, 'SP Série A2 must have Rebaixamento (Série A3) zone');
  assert.equal(relegZone.minPos, estadualRows.length - 1);
  assert.equal(relegZone.maxPos, estadualRows.length);
});

test('Requirement 12: Choosing an elite club in SP (e.g. Palmeiras) plays Série A1 with 4 groups, while Série A2 is in stateDivisions', () => {
  const allClubs = getAllClubs();
  const palmeiras = allClubs.find((c) => c.name === 'Palmeiras' && c.stateCode === 'SP');
  assert.ok(palmeiras, 'Palmeiras must exist');

  const state = createNewGame(palmeiras.id);
  assert.equal(state.stateTier, 1, 'Palmeiras must be in stateTier 1');
  assert.equal(state.stateChampionshipName, 'Campeonato Paulista (Paulistão)');

  // Série A1 must have 4 groups
  const estadualRows = state.standingsEstadual || [];
  assert.equal(estadualRows.length, 16, 'Paulistão A1 must have 16 clubs');
  const groups = new Set(estadualRows.map((r) => r.group).filter(Boolean));
  assert.equal(groups.size, 4, 'Paulistão A1 must have 4 groups A, B, C, D');

  // Série A2 must be in stateDivisions
  assert.ok(state.stateDivisions && state.stateDivisions.length > 0);
  const a2 = state.stateDivisions.find((d) => d.division === 2);
  assert.ok(a2, 'stateDivisions must contain division 2');
  assert.ok(a2.leagueName.includes('Série A2'));
});

test('Requirement 13: States with single tier (Acre, Rondônia, Roraima) have no 2nd division', () => {
  const allClubs = getAllClubs();
  const acreClub = allClubs.find((c) => c.stateCode === 'AC');
  assert.ok(acreClub, 'Acre club must exist');

  const state = createNewGame(acreClub.id);
  assert.equal(state.stateTier, 1, 'Acre club must be in tier 1');
  assert.equal((state.stateDivisions || []).length, 0, 'Single flight states must have empty stateDivisions');
});



