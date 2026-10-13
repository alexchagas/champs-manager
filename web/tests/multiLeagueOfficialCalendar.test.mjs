import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame } from '../src/data/initialData.ts';
import { getAllClubs, getClubById } from '../src/data/teamsDatabase.ts';
import { parseBrasfootDate, getOfficialDates, OFFICIAL_CALENDARS } from '../src/data/officialCalendars.ts';
import { appointHuman, migrateCareer } from '../src/engine/careerEconomy.ts';
import { getContinentalTournamentField } from '../src/data/continentalRepresentatives.ts';
import { getCountryLeagueConfig, COUNTRY_LEAGUE_PRESETS } from '../src/data/leagueConfigurations.ts';
import { readFileSync } from 'node:fs';
import path from 'node:path';

test('parseBrasfootDate converts Brasfoot DD/MM strings accurately with weekday and leap support', () => {
  const date1 = parseBrasfootDate('28/01', 2026);
  assert.equal(date1.date, '2026-01-28');
  assert.equal(date1.dayOfWeek, 'quarta');

  const date2 = parseBrasfootDate('15/03', 2026);
  assert.equal(date2.date, '2026-03-15');
  assert.equal(date2.dayOfWeek, 'domingo');

  const date3 = parseBrasfootDate('01/12', 2026);
  assert.equal(date3.date, '2026-12-01');
  assert.equal(date3.dayOfWeek, 'terça');
});

test('getOfficialDates compiles all Brasfoot competition dates from disk', () => {
  const estaduais = getOfficialDates('estaduais', 2026);
  assert.equal(estaduais.length, 25);
  assert.equal(estaduais[0].raw, '11/01');
  assert.equal(estaduais[0].date, '2026-01-11');
  assert.equal(estaduais[0].dayOfWeek, 'domingo');

  const nacional = getOfficialDates('nacional', 2026);
  assert.equal(nacional.length, 40);
  assert.equal(nacional[0].raw, '28/01');

  const supermundial = getOfficialDates('supermundial', 2026);
  assert.equal(supermundial.length, 7);
  assert.equal(supermundial[0].raw, '21/06');
  assert.equal(supermundial[supermundial.length - 1].raw, '15/07');

  const intercontinental = getOfficialDates('intercontinental', 2026);
  assert.equal(intercontinental.length, 5);
  assert.equal(intercontinental[0].raw, '16/12');
  assert.equal(intercontinental[intercontinental.length - 1].raw, '29/12');

  const champions = getOfficialDates('champions_uefa', 2026);
  assert.equal(champions.length, 25);
});

test('multi-league new game supports 3 to 5 active leagues (e.g. Portugal, Brasil, Espanha)', () => {
  // Load Portugal modular bundle from disk
  const portugalPath = new URL('../public/data/leagues/portugal.json', import.meta.url);
  const portugalClubs = JSON.parse(readFileSync(portugalPath, 'utf-8'));
  assert.equal(portugalClubs.length, 124, 'Portugal has all 124 clubs');

  const porto = portugalClubs.find(c => c.name === 'Porto');
  assert.ok(porto, 'Porto must exist');
  assert.equal(porto.countryId, 154);
  assert.equal(porto.division, 1);

  // Create new game starting with Porto and active leagues: Portugal (154), Brasil (29), Espanha (65)
  const activeCountryIds = [154, 29, 65];
  const state = migrateCareer(createNewGame(porto.id, 'Alex Chagas', {}, activeCountryIds, portugalClubs));

  assert.equal(state.userClubId, porto.id);
  assert.deepEqual(state.activeCountryIds, [154, 29, 65]);
  assert.equal(state.countryName, 'Portugal');
  assert.equal(state.leagueName, 'Campeonato Português');

  // Verify state.clubs contains both Portuguese clubs and Brazilian clubs
  const clubCountries = new Set(state.clubs.map(c => c.countryId));
  assert.ok(clubCountries.has(154), 'Portuguese clubs present');
  assert.ok(clubCountries.has(29), 'Brazilian clubs present');

  // Verify manager mobility between leagues: manager can move from Porto to Flamengo
  const flamengo = state.clubs.find(c => c.name === 'Flamengo');
  assert.ok(flamengo, 'Flamengo is active in the multi-league universe');

  const updatedState = appointHuman(state, flamengo.id);
  assert.equal(updatedState.userClubId, flamengo.id, 'Manager successfully transferred between active leagues');
  const userClub = updatedState.clubs.find(c => c.id === updatedState.userClubId);
  assert.equal(userClub.coach, 'Alex Chagas');
});

test('new game starting with Mexico initializes valid Mexican league career', () => {
  const allClubs = getAllClubs();
  const americaMex = allClubs.find(c => c.countryId === 131 && c.name.toLowerCase().includes('américa'));
  assert.ok(americaMex, 'Club América (Mexico) must exist');
  assert.equal(americaMex.countryId, 131);

  const state = migrateCareer(createNewGame(americaMex.id, 'Técnico Mexicano', {}, [131, 29, 68]));
  assert.equal(state.userClubId, americaMex.id);
  assert.equal(state.countryName, 'México');
  assert.ok(state.leagueName.includes('Mexicano') || state.leagueName.includes('México'));
  assert.ok(state.calendar.length >= 30, 'Calendar has complete schedule');
});

test('starting with Access Pool club (e.g. Valencia B or York City) generates balanced 20-team league', () => {
  const allClubs = getAllClubs();
  const valenciaB = allClubs.find(c => c.countryId === 65 && c.name.toLowerCase() === 'valencia b');
  assert.ok(valenciaB, 'Valencia B must exist');

  const state = migrateCareer(createNewGame(valenciaB.id, 'Técnico Acesso', {}, [65, 29, 97]));
  assert.equal(state.userClubId, valenciaB.id);
  assert.equal(state.countryName, 'Espanha');
  assert.ok(state.divisionName.includes('Acesso') || state.leagueName.includes('Acesso'));
  // Must NOT be a 2-team dead league
  assert.ok(state.standings.length >= 16, `Standings must have at least 16 teams, got ${state.standings.length}`);
  assert.ok(state.calendar.length >= 30, `Calendar must have at least 30 matches, got ${state.calendar.length}`);
});

test('Single-League Mode (Brazil solo) populates Copa Libertadores with authentic international giants', () => {
  const allClubs = getAllClubs();
  const flamengo = allClubs.find(c => c.id === 255);
  assert.ok(flamengo, 'Flamengo must exist');

  // Start game with single active league: ONLY Brazil [29]
  const state = migrateCareer(createNewGame(flamengo.id, 'Técnico Focado', {}, [29]));
  assert.deepEqual(state.activeCountryIds, [29], 'Only Brazil is active');

  // Verify continental tournament field
  const continentalMatches = state.calendar.filter(f => f.competitionType === 'libertadores');
  assert.ok(continentalMatches.length > 0, 'Copa Libertadores is scheduled even with 1 active league');

  // Get continental clubs participating in the state
  const continentalClubIds = new Set(continentalMatches.flatMap(f => [f.homeClubId, f.awayClubId]).filter(id => id > 0));
  const continentalClubs = state.clubs.filter(c => continentalClubIds.has(c.id));

  // Verify authentic foreign clubs are present in the tournament field
  const foreignCountries = new Set(continentalClubs.map(c => c.countryId).filter(cid => cid !== 29));
  assert.ok(foreignCountries.size >= 3, `Must have representatives from at least 3 other South American nations, got ${foreignCountries.size}`);

  const clubNames = continentalClubs.map(c => c.name);
  // Must include prominent clubs from Argentina, Uruguay, etc.
  const hasArgentineGiant = continentalClubs.some(c => c.countryId === 11);
  const hasUruguayanGiant = continentalClubs.some(c => c.countryId === 195);
  assert.ok(hasArgentineGiant, `Must include Argentine club in Copa Libertadores, found: ${clubNames.join(', ')}`);
  assert.ok(hasUruguayanGiant, `Must include Uruguayan club in Copa Libertadores, found: ${clubNames.join(', ')}`);
});

test('Single-League European Mode populates Champions League with authentic European giants', () => {
  const allClubs = getAllClubs();
  const realMadrid = allClubs.find(c => c.name === 'Real Madrid' && c.countryId === 65);
  assert.ok(realMadrid, 'Real Madrid must exist');

  // Start career with single league Spain solo [65]
  const state = migrateCareer(createNewGame(realMadrid.id, 'Mister Europe', {}, [65]));
  assert.deepEqual(state.activeCountryIds, [65]);

  const championsMatches = state.calendar.filter(f => f.competitionType === 'champions');
  assert.ok(championsMatches.length > 0, 'Champions League scheduled in European solo career');

  const championsClubIds = new Set(championsMatches.flatMap(f => [f.homeClubId, f.awayClubId]).filter(id => id > 0));
  const championsClubs = state.clubs.filter(c => championsClubIds.has(c.id));

  const europeanCountries = new Set(championsClubs.map(c => c.countryId));
  assert.ok(europeanCountries.size >= 3, 'Champions League features multiple European nations');
});

test('COUNTRY_LEAGUE_PRESETS provides authentic division structures for major countries', () => {
  const brazilConfig = getCountryLeagueConfig(29, 'Brasil');
  assert.equal(brazilConfig.divisions.length, 4, 'Brazil has 4 national divisions');
  assert.equal(brazilConfig.divisions[0].teamCount, 20, 'Série A has 20 clubs');
  assert.equal(brazilConfig.divisions[0].relegationDirect, 4, 'Série A has 4 relegated');
  assert.equal(brazilConfig.divisions[3].teamCount, 64, 'Série D has 64 clubs');

  const englandConfig = getCountryLeagueConfig(97, 'Inglaterra');
  assert.equal(englandConfig.divisions.length, 4, 'England has 4 divisions');
  assert.equal(englandConfig.divisions[0].teamCount, 20, 'Premier League has 20 clubs');
  assert.equal(englandConfig.divisions[0].relegationDirect, 3, 'Premier League has 3 relegated');
  assert.equal(englandConfig.divisions[1].promotionPlayoff, 1, 'Championship has promotion playoff');

  const germanyConfig = getCountryLeagueConfig(3, 'Alemanha');
  assert.equal(germanyConfig.divisions[0].teamCount, 18, 'Bundesliga has 18 clubs');
  assert.equal(germanyConfig.divisions[0].relegationPlayoff, 1, 'Bundesliga has 1 relegation playoff spot');

  // Portugal, Argentina, France
  const portugalConfig = getCountryLeagueConfig(154, 'Portugal');
  assert.equal(portugalConfig.divisions.length, 4, 'Portugal has 4 divisions');
  assert.equal(portugalConfig.divisions[0].teamCount, 20, 'Liga Portugal has 20 clubs');
  assert.equal(portugalConfig.divisions[0].tiebreakPriority, 'head_to_head');

  const argentinaConfig = getCountryLeagueConfig(11, 'Argentina');
  assert.equal(argentinaConfig.divisions.length, 4, 'Argentina has 4 divisions');
  assert.equal(argentinaConfig.divisions[0].teamCount, 30, 'Liga Profesional has 30 clubs');
  assert.equal(argentinaConfig.divisions[0].rounds, 1, 'Liga Profesional has 1 round (single turn)');

  const franceConfig = getCountryLeagueConfig(72, 'França');
  assert.equal(franceConfig.divisions.length, 4, 'France has 4 divisions');
  assert.equal(franceConfig.divisions[0].teamCount, 18, 'Ligue 1 has 18 clubs');
  assert.equal(franceConfig.divisions[0].relegationPlayoff, 1, 'Ligue 1 has 1 relegation playoff');

  // Generic fallback rule
  const generic20 = getCountryLeagueConfig(999, 'País Teste', 22);
  assert.equal(generic20.divisions[0].teamCount, 20);

  const generic10 = getCountryLeagueConfig(998, 'País Pequeno', 10);
  assert.equal(generic10.divisions[0].teamCount, 10);
});

