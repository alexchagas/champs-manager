import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchClubs } from '../src/utils/clubSearch.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const club = (name, reputation, extra = {}) => ({ name, reputation, stadium: 'Estádio', coach: 'Técnico', ...extra });
// Casos reais do print: "ava" listava clubes cujo ESTÁDIO tem "ava" antes do Avaí (reputação baixa)
const clubs = [
  club('Ararat-Armenia', 3, { stadium: 'Avan Academy' }),
  club('Bengaluru', 3, { stadium: 'Kanteerava' }),
  club('Platinum', 3, { stadium: 'Mandava Stadium' }),
  club('Paranavaí', 0, { stateCode: 'PR' }),
  club('Avaí', 2, { stadium: 'Ressacada', stateCode: 'SC' }),
  club('Santos', 4, { coach: 'Cléber Xavier' }),
];
const names = (list) => list.map((c) => c.name);

test('"ava" brings Avaí first: name matches beat stadium/coach matches', () => {
  const result = names(searchClubs(clubs, 'ava'));
  assert.equal(result[0], 'Avaí', 'Name starting with the query comes first');
  assert.ok(result.indexOf('Paranavaí') < result.indexOf('Ararat-Armenia'), 'Name containing the query beats stadium match');
  assert.ok(result.includes('Ararat-Armenia') && result.includes('Bengaluru'), 'Stadium matches are still listed, after');
});

test('search ignores accents both ways', () => {
  assert.equal(names(searchClubs(clubs, 'avai'))[0], 'Avaí', '"avai" finds Avaí');
  assert.equal(names(searchClubs(clubs, 'AVAÍ'))[0], 'Avaí', 'case and accent insensitive');
  assert.ok(names(searchClubs(clubs, 'cleber')).includes('Santos'), 'Coach without accent still matches');
});

test('ties keep the previous order: higher reputation first, then name', () => {
  const result = names(searchClubs(clubs, 'stadium'));
  assert.deepEqual(result, ['Platinum']);
  const stadiumOnly = names(searchClubs([club('B', 1, { stadium: 'xava' }), club('A', 4, { stadium: 'xava' })], 'xava'));
  assert.deepEqual(stadiumOnly, ['A', 'B']);
});

test('queries shorter than 2 characters return nothing (same threshold as before)', () => {
  assert.deepEqual(searchClubs(clubs, 'a'), []);
  assert.deepEqual(searchClubs(clubs, '  '), []);
});

test('MainMenu uses searchClubs for the global search', () => {
  const menu = fs.readFileSync(path.join(__dirname, '../src/components/MainMenu.tsx'), 'utf8');
  assert.ok(menu.includes("import { searchClubs } from '../utils/clubSearch';"), 'Imports searchClubs');
  assert.ok(menu.includes('return searchClubs(allClubs, searchFilter);'), 'Global search delegates to searchClubs');
});
