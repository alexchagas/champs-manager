import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearchString, matchesSearch } from '../src/utils/stringNormalizer.ts';
import { getStateLeagueRule, STATE_LEAGUE_RULES } from '../src/data/stateLeagueFormulas.ts';
import { createNewGame } from '../src/data/initialData.ts';
import { getAllClubs } from '../src/data/teamsDatabase.ts';

test('normalizeSearchString and matchesSearch ignore diacritics and case', () => {
  // Teste 1: Avaí / avai
  assert.equal(normalizeSearchString('Avaí'), 'avai');
  assert.equal(normalizeSearchString('AVAI'), 'avai');
  assert.ok(matchesSearch('Avaí', 'avai'));
  assert.ok(matchesSearch('Avaí', 'AVAI'));
  assert.ok(matchesSearch('Avaí', 'Avaí'));

  // Teste 2: São Paulo / sao paulo
  assert.equal(normalizeSearchString('São Paulo'), 'sao paulo');
  assert.ok(matchesSearch('São Paulo', 'sao paulo'));
  assert.ok(matchesSearch('São Paulo', 'SAO PAULO'));

  // Teste 3: Grêmio, Criciúma, Chapecoense
  assert.ok(matchesSearch('Grêmio', 'gremio'));
  assert.ok(matchesSearch('Criciúma', 'criciuma'));
  assert.ok(matchesSearch('Chapecoense', 'chapecoense'));
  assert.ok(matchesSearch('Atlético Mineiro', 'atletico'));
});

test('State league rules contain authentic reverse-engineered formulas from .ces', () => {
  // SP: Fórmula 7 (16 times, 4 grupos de 4)
  const spRule = getStateLeagueRule('SP');
  assert.equal(spRule.formulaId, 7);
  assert.equal(spRule.nTimes, 16);
  assert.equal(spRule.nGrupos, 4);
  assert.equal(spRule.mataMata, 8);
  assert.equal(spRule.rebaixados, 2);

  // SC: Fórmula 4 (12 times, turno único, 4 no mata-mata)
  const scRule = getStateLeagueRule('SC');
  assert.equal(scRule.formulaId, 4);
  assert.equal(scRule.nTimes, 12);
  assert.equal(scRule.mataMata, 4);
  assert.equal(scRule.rebaixados, 2);

  // BA: Fórmula 2 (10 times)
  const baRule = getStateLeagueRule('BA');
  assert.equal(baRule.formulaId, 2);
  assert.equal(baRule.nTimes, 10);

  // PB: Fórmula 0 (6 times)
  const pbRule = getStateLeagueRule('PB');
  assert.equal(pbRule.formulaId, 0);
  assert.equal(pbRule.nTimes, 6);
});

test('Paulistão contains São Paulo, Palmeiras, Corinthians and Santos even when playing with Portuguesa', () => {
  const allClubs = getAllClubs();
  const portuguesa = allClubs.find(c => c.name === 'Portuguesa');
  assert.ok(portuguesa, 'Portuguesa must exist');

  const state = createNewGame(portuguesa.id);
  const estadualClubs = state.standingsEstadual.map(s => s.clubName);

  // O Paulistão deve conter 16 clubes
  assert.equal(estadualClubs.length, 16, 'Paulistão must have 16 clubs');

  // Os 4 gigantes devem estar presentes
  assert.ok(estadualClubs.includes('Palmeiras'), 'Palmeiras must be in Paulistão');
  assert.ok(estadualClubs.includes('São Paulo'), 'São Paulo must be in Paulistão');
  assert.ok(estadualClubs.includes('Corinthians'), 'Corinthians must be in Paulistão');
  assert.ok(estadualClubs.includes('Santos'), 'Santos must be in Paulistão');
  assert.ok(estadualClubs.includes('Portuguesa'), 'Portuguesa must be in Paulistão');
});

test('Campeonato Catarinense contains Chapecoense, Avaí, Criciúma and Figueirense together', () => {
  const allClubs = getAllClubs();
  const chapecoense = allClubs.find(c => c.name === 'Chapecoense');
  assert.ok(chapecoense, 'Chapecoense must exist');

  const state = createNewGame(chapecoense.id);
  const estadualClubs = state.standingsEstadual.map(s => s.clubName);

  // Catarinense deve ter 12 clubes
  assert.equal(estadualClubs.length, 12, 'Catarinense must have 12 clubs');

  // Chapecoense e Avaí devem estar juntos no mesmo campeonato
  assert.ok(estadualClubs.includes('Chapecoense'), 'Chapecoense must be in Catarinense');
  assert.ok(estadualClubs.includes('Avaí'), 'Avaí must be in Catarinense');
  assert.ok(estadualClubs.includes('Criciúma'), 'Criciúma must be in Catarinense');
  assert.ok(estadualClubs.includes('Figueirense'), 'Figueirense must be in Catarinense');
  assert.ok(estadualClubs.includes('Brusque'), 'Brusque must be in Catarinense');
});

test('Starting with Avaí generates Catarinense with Chapecoense and other SC giants', () => {
  const allClubs = getAllClubs();
  const avai = allClubs.find(c => c.name === 'Avaí');
  assert.ok(avai, 'Avaí must exist in database');

  const state = createNewGame(avai.id);
  const estadualClubs = state.standingsEstadual.map(s => s.clubName);

  assert.equal(estadualClubs.length, 12);
  assert.ok(estadualClubs.includes('Avaí'));
  assert.ok(estadualClubs.includes('Chapecoense'));
  assert.ok(estadualClubs.includes('Criciúma'));
});

test('National divisions are concurrently available in nationalDivisions', () => {
  const allClubs = getAllClubs();
  const chapecoense = allClubs.find(c => c.name === 'Chapecoense'); // Série A
  const state = createNewGame(chapecoense.id);

  assert.ok(state.nationalDivisions && state.nationalDivisions.length > 0);
  const divisionNames = state.nationalDivisions.map(l => l.leagueName);

  // Deve conter as divisões irmãs brasileiras (Série B, Série C, Série D)
  assert.ok(divisionNames.some(d => d.includes('Série B')), 'Série B must be in nationalDivisions');
  assert.ok(divisionNames.some(d => d.includes('Série C')), 'Série C must be in nationalDivisions');
  assert.ok(divisionNames.some(d => d.includes('Série D')), 'Série D must be in nationalDivisions');
});
