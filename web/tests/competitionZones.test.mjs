import test from 'node:test';
import assert from 'node:assert/strict';
import { getCompetitionZones, getZoneForPosition } from '../src/engine/competitionZones.ts';

test('Campeonato Estadual (12 times com rebaixamento - ex: Carioca)', () => {
  const zones = getCompetitionZones({
    competitionType: 'estadual',
    totalTeams: 12,
    stateCode: 'RJ',
    stateDivisions: 2,
    customRelegated: 2,
  });

  assert.equal(zones.length, 2, 'Deve ter exatamente 2 zonas: Semifinais e Rebaixamento');

  // Semifinais
  assert.equal(zones[0].label, 'Semifinais');
  assert.equal(zones[0].minPos, 1);
  assert.equal(zones[0].maxPos, 4);

  // Rebaixamento
  assert.equal(zones[1].label, 'Rebaixamento');
  assert.equal(zones[1].minPos, 11);
  assert.equal(zones[1].maxPos, 12);

  // Test position resolution
  for (let p = 1; p <= 4; p++) {
    const z = getZoneForPosition(zones, p);
    assert.ok(z, `Posição ${p} deve ter zona`);
    assert.equal(z.label, 'Semifinais');
  }

  // Intermediários NÃO DEVEM ter zona continental
  for (let p = 5; p <= 10; p++) {
    const z = getZoneForPosition(zones, p);
    assert.equal(z, undefined, `Posição ${p} deve ser neutra (sem Libertadores/Sul-Americana)`);
  }

  // Últimos dois rebaixados
  for (let p = 11; p <= 12; p++) {
    const z = getZoneForPosition(zones, p);
    assert.ok(z, `Posição ${p} deve ter zona de rebaixamento`);
    assert.equal(z.label, 'Rebaixamento');
  }
});

test('Campeonato Estadual com divisão única (sem rebaixamento)', () => {
  const zones = getCompetitionZones({
    competitionType: 'estadual',
    totalTeams: 8,
    stateDivisions: 1,
  });

  assert.equal(zones.length, 1, 'Deve ter apenas a zona de Semifinais');
  assert.equal(zones[0].label, 'Semifinais');
  assert.equal(zones[0].minPos, 1);
  assert.equal(zones[0].maxPos, 4);

  // Ninguém deve ser rebaixado
  for (let p = 5; p <= 8; p++) {
    assert.equal(getZoneForPosition(zones, p), undefined, `Posição ${p} não deve ter rebaixamento`);
  }
});

test('Brasileirão Série A (20 times)', () => {
  const zones = getCompetitionZones({
    competitionType: 'nacional',
    division: 1,
    countryId: 29,
    totalTeams: 20,
    customRelegated: 4,
  });

  assert.equal(zones.length, 4, 'Deve ter 4 zonas na Série A');
  assert.equal(zones[0].label, 'Libertadores');
  assert.equal(zones[0].minPos, 1);
  assert.equal(zones[0].maxPos, 4);

  assert.equal(zones[1].label, 'Pré-Libert.');
  assert.equal(zones[1].minPos, 5);
  assert.equal(zones[1].maxPos, 6);

  assert.equal(zones[2].label, 'Sul-Americana');
  assert.equal(zones[2].minPos, 7);
  assert.equal(zones[2].maxPos, 12);

  assert.equal(zones[3].label, 'Rebaixamento');
  assert.equal(zones[3].minPos, 17);
  assert.equal(zones[3].maxPos, 20);

  // Posições intermediárias (13-16) são neutras
  for (let p = 13; p <= 16; p++) {
    assert.equal(getZoneForPosition(zones, p), undefined);
  }
});

test('Brasileirão Série B (20 times - Acesso e Rebaixamento)', () => {
  const zones = getCompetitionZones({
    competitionType: 'nacional',
    division: 2,
    countryId: 29,
    totalTeams: 20,
    customRelegated: 4,
  });

  assert.equal(zones.length, 2, 'Deve ter 2 zonas na Série B: Acesso e Rebaixamento');
  assert.equal(zones[0].label, 'Acesso');
  assert.equal(zones[0].minPos, 1);
  assert.equal(zones[0].maxPos, 4);

  assert.equal(zones[1].label, 'Rebaixamento');
  assert.equal(zones[1].minPos, 17);
  assert.equal(zones[1].maxPos, 20);

  // Sem zonas continentais
  for (let p = 5; p <= 16; p++) {
    assert.equal(getZoneForPosition(zones, p), undefined);
  }
});

test('Brasileirão Série D (Última divisão - Acesso sem rebaixamento)', () => {
  const zones = getCompetitionZones({
    competitionType: 'nacional',
    division: 4,
    countryId: 29,
    totalTeams: 8,
  });

  assert.equal(zones.length, 1, 'Deve ter apenas a zona de Acesso');
  assert.equal(zones[0].label, 'Acesso');
  assert.equal(zones[0].minPos, 1);
  assert.equal(zones[0].maxPos, 4);

  for (let p = 5; p <= 8; p++) {
    assert.equal(getZoneForPosition(zones, p), undefined, 'Não deve ter rebaixamento na Série D');
  }
});

test('Copa Libertadores / Champions (Fase de Grupos)', () => {
  const zones = getCompetitionZones({
    competitionType: 'libertadores',
    totalTeams: 4,
  });

  assert.equal(zones.length, 1, 'Deve ter apenas zona de Classificação');
  assert.equal(zones[0].label, 'Classificação');
  assert.equal(zones[0].minPos, 1);
  assert.equal(zones[0].maxPos, 2);

  assert.equal(getZoneForPosition(zones, 3), undefined);
  assert.equal(getZoneForPosition(zones, 4), undefined);
});

test('Copa Nacional (Mata-mata)', () => {
  const zones = getCompetitionZones({
    competitionType: 'copa',
    totalTeams: 16,
  });

  assert.equal(zones.length, 0, 'Copa eliminatória não possui zonas de tabela');
});
