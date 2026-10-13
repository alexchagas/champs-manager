import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame } from '../src/data/initialData.ts';
import { getAllClubs, getClubById } from '../src/data/teamsDatabase.ts';
import { parseBrasfootDate, getOfficialDates, OFFICIAL_CALENDARS } from '../src/data/officialCalendars.ts';
import { appointHuman, migrateCareer } from '../src/engine/careerEconomy.ts';
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
  const portugalPath = path.resolve('web/public/data/leagues/portugal.json');
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
