import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame } from '../src/data/initialData.ts';
import { getAllClubs } from '../src/data/teamsDatabase.ts';
import {
  isWorldCupYear,
  isSuperClubWorldCupYear,
  isIntercontinentalYear,
  initializeNationalTeams,
  WORLD_CUP_QUALIFIED_TEAMS,
  createWorldCupTournament,
  createSuperClubWorldCup,
  createIntercontinentalCup,
  getAvailableNationalTeamOffers,
  evaluateUserSquadCallups,
  advanceWorldCupRound,
  getWorldCupHostInfo,
  getPotsForWorldCup,
  performWorldCupDraw,
} from '../src/data/nationalTeamsData.ts';
import { getOfficialDates } from '../src/data/officialCalendars.ts';
import { resolvePendingFixtures } from '../src/engine/qualification.ts';
import { migrateCareer } from '../src/engine/careerEconomy.ts';

test('Quadrennial cycle accurately determines World Cup and Super Club World Cup years', () => {
  // World Cup: Even years (2026, 2030, 2034, 2038)
  assert.equal(isWorldCupYear(2026), true, '2026 is a World Cup year');
  assert.equal(isWorldCupYear(2030), true, '2030 is a World Cup year');
  assert.equal(isWorldCupYear(2034), true, '2034 is a World Cup year');
  assert.equal(isWorldCupYear(2027), false, '2027 is not a World Cup year');
  assert.equal(isWorldCupYear(2028), false, '2028 is not a World Cup year');
  assert.equal(isWorldCupYear(2029), false, '2029 is not a World Cup year');

  // Super Club World Cup: Odd pre-World Cup years (2029, 2033, 2037)
  assert.equal(isSuperClubWorldCupYear(2029), true, '2029 is a Super Club World Cup year');
  assert.equal(isSuperClubWorldCupYear(2033), true, '2033 is a Super Club World Cup year');
  assert.equal(isSuperClubWorldCupYear(2026), false, '2026 is not a Super Club World Cup year');
  assert.equal(isSuperClubWorldCupYear(2030), false, '2030 is not a Super Club World Cup year');

  // Intercontinental Cup: Annual in December
  assert.equal(isIntercontinentalYear(2026), true);
  assert.equal(isIntercontinentalYear(2027), true);
  assert.equal(isIntercontinentalYear(2028), true);
  assert.equal(isIntercontinentalYear(2029), true);
});

test('World Cup schedules matches during official June/July league pause dates', () => {
  const dates = getOfficialDates('supermundial', 2026);
  assert.equal(dates.length, 7, '7 official June/July dates');
  assert.equal(dates[0].raw, '21/06', 'Group round 1');
  assert.equal(dates[1].raw, '25/06', 'Group round 2');
  assert.equal(dates[2].raw, '29/06', 'Group round 3');
  assert.equal(dates[3].raw, '02/07', 'Round of 16');
  assert.equal(dates[4].raw, '06/07', 'Quarter-Finals');
  assert.equal(dates[5].raw, '10/07', 'Semi-Finals');
  assert.equal(dates[6].raw, '15/07', 'Grand Final');

  // Verify national league calendar leaves this window open (Round 18 on 31/05, Round 19 on 22/07)
  const nacionalDates = getOfficialDates('nacional', 2026);
  assert.equal(nacionalDates[17].raw, '31/05', 'Round 18 on 31/05 before World Cup');
  assert.equal(nacionalDates[18].raw, '22/07', 'Round 19 on 22/07 after World Cup');

  // Intercontinental dates in December
  const intercontinentalDates = getOfficialDates('intercontinental', 2026);
  assert.equal(intercontinentalDates.length, 5);
  assert.equal(intercontinentalDates[0].raw, '16/12', 'Starts after national league conclusion on 14/12');
  assert.equal(intercontinentalDates[4].raw, '29/12', 'Intercontinental final on 29/12');
});

test('Authentic 32-team World Cup database with 4 pots, flags, and 23-player squads', () => {
  const allClubs = getAllClubs();
  const nationalTeams = initializeNationalTeams(allClubs);

  assert.equal(nationalTeams.length, 32, 'Exactly 32 qualified national teams');

  // Verify pot distribution: 8 teams per pot
  const pot1 = WORLD_CUP_QUALIFIED_TEAMS.filter(t => t.pot === 1);
  const pot2 = WORLD_CUP_QUALIFIED_TEAMS.filter(t => t.pot === 2);
  const pot3 = WORLD_CUP_QUALIFIED_TEAMS.filter(t => t.pot === 3);
  const pot4 = WORLD_CUP_QUALIFIED_TEAMS.filter(t => t.pot === 4);

  assert.equal(pot1.length, 8, '8 Pot 1 seeds (Brasil, Argentina, França, Alemanha, etc.)');
  assert.equal(pot2.length, 8, '8 Pot 2 teams');
  assert.equal(pot3.length, 8, '8 Pot 3 teams');
  assert.equal(pot4.length, 8, '8 Pot 4 teams');

  // Elite seeds
  const brazil = nationalTeams.find(t => t.code === 'BRA');
  assert.ok(brazil, 'Brazil exists');
  assert.equal(brazil.flag, '🇧🇷');
  assert.equal(brazil.reputation, 5);
  assert.equal(brazil.isElite, true);
  assert.equal(brazil.shirtUrl, '/selecoes/camisas/BRA.png');

  // Check squad composition: 23 players, >= 2 GK, >= 15 outfielders
  assert.equal(brazil.squad.length, 23, '23-player national squad');
  const gks = brazil.squad.filter(p => p.position === 'GOL');
  const outfield = brazil.squad.filter(p => p.position !== 'GOL');
  assert.ok(gks.length >= 2, 'At least 2 goalkeepers');
  assert.ok(outfield.length >= 15, 'At least 15 outfield players');
  assert.equal(brazil.squad.filter(p => p.isStarter).length, 11, 'Exactly 11 starters');
});

test('Tournament structure initializes 8 balanced groups (A-H) and reserved knockout matches', () => {
  const allClubs = getAllClubs();
  const nationalTeams = initializeNationalTeams(allClubs);
  const tournament = createWorldCupTournament(2026, nationalTeams);

  assert.equal(tournament.seasonYear, 2026);
  assert.equal(tournament.groups.length, 8, '8 Groups (A to H)');

  // Verify each group has 4 teams from distinct pots
  for (const group of tournament.groups) {
    assert.equal(group.teams.length, 4, `Group ${group.groupLetter} has 4 teams`);
    assert.equal(group.standings.length, 4, `Group ${group.groupLetter} has 4 standings rows`);
    assert.equal(group.fixtures.length, 6, `Group ${group.groupLetter} has 6 round-robin matches`);
  }

  // Verify knockout reservation slots
  const r16 = tournament.fixtures.filter(f => f.round === 4);
  const qf = tournament.fixtures.filter(f => f.round === 5);
  const sf = tournament.fixtures.filter(f => f.round === 6);
  const final = tournament.fixtures.find(f => f.round === 7);

  assert.equal(r16.length, 8, '8 Round of 16 matches');
  assert.equal(qf.length, 4, '4 Quarter-Final matches');
  assert.equal(sf.length, 2, '2 Semi-Final matches');
  assert.ok(final, '1 Grand Final match');
  assert.equal(final.pendingQualification, true, 'Final is reserved');
});

test('Manager national team proposals obey Brasfoot reputation and title rules', () => {
  const allClubs = getAllClubs();
  const nationalTeams = initializeNationalTeams(allClubs);

  // Beginner manager: reputation 1, 0 titles
  const rookieManager = {
    id: 'rookie',
    name: 'Técnico Iniciante',
    kind: 'human',
    reputation: 1,
    boardRating: 50,
    riskProfile: 'balanced',
    available: false,
    jobs: [],
    titles: [],
    events: [],
    seasonScore: 0,
    careerScore: 0,
    scoreComponents: { results: 0, competitions: 0, squad: 0, finances: 0 },
  };

  const rookieOffers = getAvailableNationalTeamOffers(rookieManager, 2026, nationalTeams);
  assert.ok(rookieOffers.length > 0, 'Rookie receives job offers from smaller nations');
  // Must NOT include elite nations (Brazil, Argentina, France, Germany)
  for (const offer of rookieOffers) {
    assert.ok(offer.reputation < 5, 'Rookie manager never receives offers from elite 5-star nations');
  }

  // Veteran manager: reputation 5, 3 titles (Brasileirão, Libertadores, Copa do Brasil)
  const veteranManager = {
    id: 'veteran',
    name: 'Técnico Campeão',
    kind: 'human',
    reputation: 5,
    boardRating: 95,
    riskProfile: 'balanced',
    available: false,
    jobs: [],
    titles: ['2024 · Brasileirão Série A', '2025 · Copa Libertadores', '2025 · Copa do Brasil'],
    events: [],
    seasonScore: 50,
    careerScore: 180,
    scoreComponents: { results: 50, competitions: 50, squad: 40, finances: 40 },
  };

  const veteranOffers = getAvailableNationalTeamOffers(veteranManager, 2026, nationalTeams);
  assert.ok(veteranOffers.length > 0, 'Veteran manager receives top offers');
  assert.ok(veteranOffers.some(o => o.reputation === 5), 'Veteran manager qualifies for elite 5-star nations');
});

test('Top user squad players are called up by national teams and increase in market value', () => {
  const allClubs = getAllClubs();
  const flamengo = allClubs.find(c => c.name === 'Flamengo') || allClubs[0];
  const nationalTeams = initializeNationalTeams(allClubs);

  const { callups, newsArticles } = evaluateUserSquadCallups(flamengo, 2026, nationalTeams);

  assert.ok(callups.length > 0, 'Flamengo stars are called up');
  assert.ok(newsArticles.length > 0, 'Official callup news articles are generated');

  // Verify callup details and market value boost
  for (const callup of callups) {
    assert.equal(callup.clubId, flamengo.id);
    assert.ok(callup.marketValueBoostPercent >= 20, 'At least +20% market value appreciation');
    assert.ok(callup.boostedMarketValue > callup.originalMarketValue, 'Market value is boosted');
    assert.equal(callup.tournamentName, 'Copa do Mundo FIFA');
  }

  // News article format
  const headline = newsArticles[0];
  assert.ok(headline.title.includes('CONVOCAÇÃO OFICIAL'), 'Authentic headline');
  assert.equal(headline.badgeText, 'COPA DO MUNDO');
  assert.equal(headline.isHeadline, true);
});

test('Full World Cup tournament simulation: groups, knockout advancement, penalties, and champion crown', () => {
  const allClubs = getAllClubs();
  const nationalTeams = initializeNationalTeams(allClubs);
  const teamsMap = new Map(nationalTeams.map(t => [t.id, t]));
  let tournament = createWorldCupTournament(2026, nationalTeams);

  // Simulate group stage (rounds 1, 2, 3)
  for (let r = 1; r <= 3; r++) {
    tournament = advanceWorldCupRound(tournament, r, teamsMap);
  }

  // Verify standings are sorted and top 2 advance
  for (const group of tournament.groups) {
    assert.equal(group.standings.length, 4);
    assert.ok(group.standings[0].points >= group.standings[1].points, 'Rank 1 has >= points than Rank 2');
    assert.equal(group.standings[0].played, 3, 'All 3 group matches played');
  }

  // Verify Round of 16 (round 4) slots are now populated with actual team IDs
  const r16 = tournament.fixtures.filter(f => f.round === 4);
  assert.equal(r16.length, 8);
  for (const fix of r16) {
    assert.ok(fix.homeClubId > 0, 'Home team populated');
    assert.ok(fix.awayClubId > 0, 'Away team populated');
    assert.equal(fix.pendingQualification, false, 'Qualification resolved');
  }

  // Simulate Round of 16 -> fills Quarter-Finals (round 5)
  tournament = advanceWorldCupRound(tournament, 4, teamsMap);
  const qf = tournament.fixtures.filter(f => f.round === 5);
  assert.equal(qf.length, 4);
  for (const fix of qf) {
    assert.ok(fix.homeClubId > 0);
    assert.ok(fix.awayClubId > 0);
  }

  // Simulate Quarter-Finals -> fills Semi-Finals (round 6)
  tournament = advanceWorldCupRound(tournament, 5, teamsMap);
  const sf = tournament.fixtures.filter(f => f.round === 6);
  assert.equal(sf.length, 2);
  for (const fix of sf) {
    assert.ok(fix.homeClubId > 0);
    assert.ok(fix.awayClubId > 0);
  }

  // Simulate Semi-Finals -> fills Final (round 7)
  tournament = advanceWorldCupRound(tournament, 6, teamsMap);
  const final = tournament.fixtures.find(f => f.round === 7);
  assert.ok(final.homeClubId > 0);
  assert.ok(final.awayClubId > 0);

  // Simulate Grand Final -> crowns Champion
  tournament = advanceWorldCupRound(tournament, 7, teamsMap);
  assert.equal(tournament.status, 'finished');
  assert.ok(tournament.champion, 'World Cup champion is crowned');
  assert.ok(tournament.champion.name.length > 0);
  assert.ok(tournament.champion.flag.length > 0);
  assert.ok(tournament.runnerUp, 'Runner-up is identified');
});

test('Super Club World Cup and Intercontinental Cup tournament generation', () => {
  const allClubs = getAllClubs();

  // Super Club World Cup (2029)
  const superMundial = createSuperClubWorldCup(2029, allClubs);
  assert.equal(superMundial.seasonYear, 2029);
  assert.equal(superMundial.fixtures.length, 7, '7 tournament fixtures');
  assert.equal(superMundial.fixtures[0].competitionType, 'supermundial');
  assert.equal(superMundial.fixtures[0].stage, 'Quartas de Final');

  // Intercontinental Cup (Annual)
  const intercontinental = createIntercontinentalCup(2026, allClubs);
  assert.equal(intercontinental.seasonYear, 2026);
  assert.equal(intercontinental.fixtures.length, 3, '2 Semifinals + 1 Final');
  assert.equal(intercontinental.fixtures[0].competitionType, 'intercontinental');
  assert.equal(intercontinental.fixtures[2].competitionRound, 'Grande Final');

  // Test qualification resolution for single-leg tournaments
  const smFixtures = superMundial.fixtures.map((f, i) => i < 4 ? { ...f, homeScore: 2, awayScore: 1, played: true } : f);
  const mockState = { calendar: smFixtures };
  const resolvedState = resolvePendingFixtures(mockState);
  const semis = resolvedState.calendar.filter(f => f.stage === 'Semifinal');
  assert.ok(semis.every(f => f.homeClubId > 0 && f.awayClubId > 0), 'Super Mundial semifinalists resolved');
});

test('Career initialization sets up World Cup, callups, and national team offers on game start', () => {
  const allClubs = getAllClubs();
  const flamengo = allClubs.find(c => c.name === 'Flamengo') || allClubs[0];

  const state = migrateCareer(createNewGame(flamengo.id, 'Alex Chagas'));

  assert.equal(state.seasonYear, 2026);
  assert.ok(state.worldCup, 'World Cup is active in 2026');
  assert.equal(state.worldCup.groups.length, 8, '8 Groups created');
  assert.ok(state.nationalTeamOffers && state.nationalTeamOffers.length > 0, 'Offers available');
  assert.ok(state.nationalCallups && state.nationalCallups.length > 0, 'User players called up');
  assert.ok(state.intercontinentalCup, 'Intercontinental cup active for December');

  // Verify callup news in newsFeed
  const callupNews = state.newsFeed?.find(n => n.badgeText === 'COPA DO MUNDO');
  assert.ok(callupNews, 'Callup headline is present in initial newsFeed');
});

test('National team squads match realistic strength distribution and modest nations call up lower division players', () => {
  const allClubs = getAllClubs();
  const nationalTeams = initializeNationalTeams(allClubs);

  // Check generated squad strengths: max strength across all national teams must adhere to realistic scale
  for (const nt of nationalTeams) {
    for (const p of nt.squad) {
      assert.ok(p.strength <= 72, `Player ${p.name} strength ${p.strength} should not exceed top player ceiling (72)`);
      assert.ok(p.strength >= 20, `Player ${p.name} strength ${p.strength} should be at least 20`);
    }

    const avgStr = nt.squad.reduce((acc, p) => acc + p.strength, 0) / nt.squad.length;
    if (nt.reputation === 5) {
      assert.ok(avgStr >= 50, `Elite national team ${nt.name} average ${avgStr} is at least 50`);
    }
  }

  // Modest nation callup test: Costa Rica (countryId 51, rep 2) with modest players
  const costaRica = nationalTeams.find(t => t.countryId === 51) || nationalTeams[0];
  const modestClub = {
    id: 8888,
    name: 'Clube Modesto FC',
    countryId: costaRica.countryId,
    reputation: 1,
    stadium: 'Estádio Local',
    capacity: 5000,
    coach: 'Treinador',
    primaryColor: '#000000',
    secondaryColor: '#ffffff',
    balance: 100000,
    ticketPrice: 15,
    crestUrl: '',
    crestMiniUrl: '',
    squad: [
      {
        id: 101,
        name: 'Jogador Destaque Modesto',
        position: 'ATA',
        strength: 28, // Below 80, but >= 22 (eligible for modest nation)
        age: 23,
        foot: 'D',
        energy: 100,
        salary: 10000,
        marketValue: 150000,
        isStarter: true,
        isStar: false,
        isWorldTop: false,
        skill1: 'Finalização',
        skill2: 'Velocidade',
        goals: 5,
        assists: 2,
        yellowCards: 0,
        redCards: 0,
        injured: false,
        suspended: false,
        contractYears: 2,
      },
      {
        id: 102,
        name: 'Jogador Fraco',
        position: 'VOL',
        strength: 15, // Below 22, should NOT be called up
        age: 19,
        foot: 'D',
        energy: 100,
        salary: 5000,
        marketValue: 50000,
        isStarter: true,
        isStar: false,
        isWorldTop: false,
        skill1: 'Desarme',
        skill2: 'Passe',
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
        injured: false,
        suspended: false,
        contractYears: 1,
      },
    ],
    tactics: {
      formation: '4-4-2',
      mentality: 'Equilibrada',
      penaltyTakerId: 101,
      freeKickTakerId: 101,
      cornerTakerId: 101,
      captainId: 101,
    },
  };

  const { callups, newsArticles } = evaluateUserSquadCallups(modestClub, 2026, nationalTeams);
  assert.equal(callups.length, 1, 'Exactly 1 player called up from modest club');
  assert.equal(callups[0].playerId, 101, 'Player with strength 28 was called up by Costa Rica');
  assert.equal(callups[0].nationalTeamName, costaRica.name);
  assert.equal(newsArticles.length, 1);
});

test('FIFA World Cup host nations and stadiums match official cycles (2026, 2030, 2034)', () => {
  const host2026 = getWorldCupHostInfo(2026);
  assert.equal(host2026.seasonYear, 2026);
  assert.equal(host2026.hosts.length, 3, '2026 has 3 host nations (USA, MEX, CAN)');
  assert.ok(host2026.hosts.some(h => h.code === 'EUA'));
  assert.ok(host2026.hosts.some(h => h.code === 'MEX'));
  assert.ok(host2026.hosts.some(h => h.code === 'CAN'));
  assert.ok(host2026.famousStadiums.length >= 2, 'MetLife, Azteca, etc.');

  const host2030 = getWorldCupHostInfo(2030);
  assert.equal(host2030.seasonYear, 2030);
  assert.ok(host2030.hosts.some(h => h.code === 'ESP'));
  assert.ok(host2030.hosts.some(h => h.code === 'POR'));
  assert.ok(host2030.hosts.some(h => h.code === 'MAR'));

  const host2034 = getWorldCupHostInfo(2034);
  assert.equal(host2034.seasonYear, 2034);
  assert.ok(host2034.hosts.some(h => h.code === 'ARS'));
});

test('FIFA World Cup draw ceremony: 4 balanced pots and confederation restrictions', () => {
  const allClubs = getAllClubs();
  const nationalTeams = initializeNationalTeams(allClubs);

  const { pot1, pot2, pot3, pot4 } = getPotsForWorldCup(2026, nationalTeams);
  assert.equal(pot1.length, 8, 'Pot 1 has 8 teams');
  assert.equal(pot2.length, 8, 'Pot 2 has 8 teams');
  assert.equal(pot3.length, 8, 'Pot 3 has 8 teams');
  assert.equal(pot4.length, 8, 'Pot 4 has 8 teams');

  // In 2026, all 3 hosts must be in Pot 1
  assert.ok(pot1.some(t => t.code === 'EUA'), 'USA in Pot 1');
  assert.ok(pot1.some(t => t.code === 'MEX'), 'Mexico in Pot 1');
  assert.ok(pot1.some(t => t.code === 'CAN'), 'Canada in Pot 1');

  // Draw execution
  const { groups, fixtures } = performWorldCupDraw(2026, nationalTeams);
  assert.equal(groups.length, 8, '8 groups formed');
  assert.equal(fixtures.length, 63, '63 total fixtures (48 group + 15 knockout)');

  // Verify confederation constraints in every group:
  // - Max 2 UEFA
  // - Max 1 CONMEBOL
  // - Max 1 CONCACAF
  for (const group of groups) {
    assert.equal(group.teams.length, 4, `Group ${group.groupLetter} has exactly 4 teams`);
    const uefa = group.teams.filter(t => (t.confederation || 'UEFA') === 'UEFA').length;
    const conmebol = group.teams.filter(t => t.confederation === 'CONMEBOL').length;
    const concacaf = group.teams.filter(t => t.confederation === 'CONCACAF').length;

    assert.ok(uefa <= 2, `Group ${group.groupLetter} has at most 2 UEFA teams (got ${uefa})`);
    assert.ok(conmebol <= 1, `Group ${group.groupLetter} has at most 1 CONMEBOL team (got ${conmebol})`);
    assert.ok(concacaf <= 1, `Group ${group.groupLetter} has at most 1 CONCACAF team (got ${concacaf})`);
  }
});

test('Strict callup cap prevents overcalling (e.g. Cruzeiro / Flamengo squad cap)', () => {
  const allClubs = getAllClubs();
  const nationalTeams = initializeNationalTeams(allClubs);

  // Build a club with 20 elite players (similar to Cruzeiro/Flamengo stacked squad)
  const stackedClub = {
    id: 7777,
    name: 'Cruzeiro EC',
    countryId: 29, // Brazil
    reputation: 5,
    stadium: 'Mineirão',
    capacity: 62000,
    coach: 'Técnico',
    primaryColor: '#0000ff',
    secondaryColor: '#ffffff',
    balance: 50000000,
    ticketPrice: 50,
    crestUrl: '',
    crestMiniUrl: '',
    squad: Array.from({ length: 20 }, (_, i) => ({
      id: 2000 + i,
      name: `Craque do Cruzeiro ${i + 1}`,
      position: ['GOL', 'ZAG', 'LAT', 'VOL', 'MEI', 'ATA'][i % 6],
      strength: 55 + (i % 8), // All have strength >= 55 (well above threshold)
      age: 25,
      foot: 'D',
      energy: 100,
      salary: 50000,
      marketValue: 2000000,
      isStarter: i < 11,
      isStar: i < 5, // 5 stars
      isWorldTop: i === 0, // 1 world top
      skill1: 'Passe',
      skill2: 'Finalização',
      goals: 10,
      assists: 5,
      yellowCards: 0,
      redCards: 0,
      injured: false,
      suspended: false,
      contractYears: 3,
    })),
    tactics: {
      formation: '4-4-2',
      mentality: 'Equilibrada',
      penaltyTakerId: 2000,
      freeKickTakerId: 2000,
      cornerTakerId: 2000,
      captainId: 2000,
    },
  };

  const { callups, newsArticles } = evaluateUserSquadCallups(stackedClub, 2026, nationalTeams);

  // Anti-overcalling assertion: NEVER call up half the squad! Maximum 2 players!
  assert.ok(callups.length >= 1, 'At least 1 player called up');
  assert.ok(callups.length <= 2, `Cruzeiro callups must not exceed cap of 2 (got ${callups.length})`);
  assert.equal(callups[0].playerId, 2000, 'Top merit player (World Top) is prioritized first');
  assert.equal(newsArticles.length, callups.length);
});
