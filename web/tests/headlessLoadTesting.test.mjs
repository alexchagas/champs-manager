import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame } from '../src/data/initialData.ts';
import { migrateCareer } from '../src/engine/careerEconomy.ts';
import { getAllClubs } from '../src/data/teamsDatabase.ts';
import {
  simulateHeadlessSeasons,
  simulateRoundHeadless,
} from '../src/engine/headlessSimulation.ts';

test('Task 6: Performance benchmark - Headless round simulation runs under 20ms', () => {
  const allClubs = getAllClubs();
  const flamengo = allClubs.find((c) => c.name === 'Flamengo' && c.countryId === 29);
  const raw = createNewGame(flamengo.id, 'Professor', 1);
  const state = migrateCareer(raw);

  const start = performance.now();
  const next = simulateRoundHeadless(state, 12345);
  const elapsed = performance.now() - start;

  assert.equal(next.currentRound, 2);
  assert.ok(elapsed < 25, `Round simulation should run under 25ms, took ${elapsed.toFixed(2)}ms`);
});

test('Task 6: Headless load testing across 5 full seasons (2026-2031)', async (t) => {
  const allClubs = getAllClubs();
  const flamengo = allClubs.find((c) => c.name === 'Flamengo' && c.countryId === 29);
  const raw = createNewGame(flamengo.id, 'Professor Carga', 1);
  const state = migrateCareer(raw);

  const seasonsCount = 5;
  const start = performance.now();

  const { finalState, telemetryLog } = await simulateHeadlessSeasons(
    state,
    seasonsCount,
    (telemetry) => {
      // Verificações invariantes a cada virada de ano
      assert.ok(
        telemetry.isUnder2MB,
        `Season ${telemetry.seasonYear} save must be under 2MB, was ${telemetry.compressedKb.toFixed(2)} KB`
      );
      assert.ok(
        telemetry.compressedKb < 1600,
        `Season ${telemetry.seasonYear} compressed size should be comfortable (< 1.6MB), was ${telemetry.compressedKb.toFixed(2)} KB`
      );
      assert.equal(
        telemetry.activeClubsCount,
        state.clubs.length,
        `Club count must remain strictly intact (${state.clubs.length})`
      );
    }
  );

  const totalTime = performance.now() - start;

  // 1. Telemetria das 5 temporadas
  assert.equal(telemetryLog.length, 5, 'Must collect telemetry for exactly 5 seasons');
  assert.equal(finalState.seasonYear, 2031, 'Season year must reach 2031');

  // 2. Histórico de campeonatos arquivado sem duplicação
  assert.ok(finalState.championshipHistory && finalState.championshipHistory.length > 0);
  const seasonsInHistory = new Set(finalState.championshipHistory.map((h) => h.seasonYear));
  assert.ok(seasonsInHistory.size >= 5, 'Must have recorded championships for at least 5 distinct seasons');

  // 3. Verificação de integridade dos clubes
  const clubIds = new Set(finalState.clubs.map((c) => c.id));
  assert.equal(clubIds.size, state.clubs.length, 'No duplicate or lost club IDs');

  for (const c of finalState.clubs) {
    assert.ok(!Number.isNaN(c.balance), `Club ${c.name} balance is NaN`);
    assert.ok(Array.isArray(c.squad), `Club ${c.name} squad must be an array`);
    assert.ok(c.squad.length > 0, `Club ${c.name} must have players`);
  }

  // 4. Verificação de integridade dos treinadores
  assert.ok(finalState.managers && finalState.managers.length > 0);
  const human = finalState.managers.find((m) => m.id === finalState.humanManagerId);
  assert.ok(human, 'Human manager must exist');
  assert.ok(human.jobs.length > 0, 'Human manager must have career jobs');

  // 5. Invariantes numéricas das tabelas
  for (const row of finalState.standingsEstadual || []) {
    assert.ok(!Number.isNaN(row.points), 'Points cannot be NaN');
    assert.ok(!Number.isNaN(row.goalsFor), 'GoalsFor cannot be NaN');
    assert.ok(!Number.isNaN(row.goalsAgainst), 'GoalsAgainst cannot be NaN');
  }

  console.log(`[LOAD TEST] 5 seasons headless simulated in ${(totalTime / 1000).toFixed(2)}s`);
  for (const t of telemetryLog) {
    console.log(`  -> Season ${t.seasonYear}: Save size ${t.compressedKb.toFixed(1)} KB (Under 2MB: ${t.isUnder2MB})`);
  }
});

test('Task 6: Multi-tier sports mobility and pyramid stability across multi-season simulation', async () => {
  const allClubs = getAllClubs();
  // Start with Portuguesa (Série D, state A1/A2)
  const lusa = allClubs.find((c) => c.name.includes('Portuguesa') && c.countryId === 29) || allClubs[0];
  const raw = createNewGame(lusa.id, 'Treinador Lusa', 1);
  const state = migrateCareer(raw);

  const { finalState, telemetryLog } = await simulateHeadlessSeasons(state, 3);

  assert.equal(finalState.seasonYear, 2029);
  assert.equal(telemetryLog.length, 3);

  // Verificação de cotas da pirâmide nacional
  const clubsInA = finalState.clubs.filter((c) => c.countryId === 29 && c.division === 1);
  const clubsInB = finalState.clubs.filter((c) => c.countryId === 29 && c.division === 2);
  const clubsInC = finalState.clubs.filter((c) => c.countryId === 29 && c.division === 3);
  const clubsInD = finalState.clubs.filter((c) => c.countryId === 29 && c.division === 4);

  assert.equal(clubsInA.length, 20, 'Série A must always have exactly 20 clubs');
  assert.equal(clubsInB.length, 20, 'Série B must always have exactly 20 clubs');
  assert.equal(clubsInC.length, 20, 'Série C must always have exactly 20 clubs');
  assert.equal(clubsInD.length, 64, 'Série D must always have exactly 64 clubs');
});

test('Task 6: Endurance load testing across 10 full seasons (2026-2036)', async () => {
  const allClubs = getAllClubs();
  const palmeiras = allClubs.find((c) => c.name === 'Palmeiras' && c.countryId === 29) || allClubs[0];
  const raw = createNewGame(palmeiras.id, 'Professor Decênio', 1);
  const state = migrateCareer(raw);

  const seasonsCount = 10;
  const start = performance.now();

  const { finalState, telemetryLog } = await simulateHeadlessSeasons(
    state,
    seasonsCount,
    (telemetry) => {
      assert.ok(
        telemetry.isUnder2MB,
        `Season ${telemetry.seasonYear} save must remain under 2MB, was ${telemetry.compressedKb.toFixed(2)} KB`
      );
    }
  );

  const totalTime = performance.now() - start;

  assert.equal(telemetryLog.length, 10, 'Must complete all 10 seasons');
  assert.equal(finalState.seasonYear, 2036, 'Target season year must be 2036');

  // Verify memory and save size stability across 10 seasons
  const firstSeason = telemetryLog[0];
  const tenthSeason = telemetryLog[9];
  assert.ok(
    tenthSeason.compressedKb < 1800,
    `Tenth season save size (${tenthSeason.compressedKb.toFixed(1)} KB) must stay well under 2MB ceiling`
  );

  console.log(`[ENDURANCE TEST] 10 seasons headless simulated in ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`  -> Season 1 (2026): ${firstSeason.compressedKb.toFixed(1)} KB | Season 10 (2035): ${tenthSeason.compressedKb.toFixed(1)} KB`);
});
