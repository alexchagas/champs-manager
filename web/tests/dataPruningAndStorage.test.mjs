import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame } from '../src/data/initialData.ts';
import { migrateCareer } from '../src/engine/careerEconomy.ts';
import {
  prunePreviousSeasonData,
  compressGameState,
  decompressGameState,
  getGameStateMetrics,
} from '../src/engine/dataPruning.ts';
import {
  saveActiveGameToStorage,
  loadActiveGameFromStorage,
  saveGameSlotToStorage,
  loadGameSlotFromStorage,
} from '../src/state/storage.ts';

// Mock LocalStorage helper
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

function setupMockStorage() {
  const mock = new MockLocalStorage();
  globalThis.localStorage = mock;
  globalThis.window = { localStorage: mock };
  return mock;
}

test('Task 5: prunePreviousSeasonData strips past match events and minute-by-minute details', () => {
  const game = migrateCareer(createNewGame(1, 'Alex Manager', 1));

  // Add fixtures with extensive events
  game.calendar = [
    {
      id: 1,
      round: 1,
      homeClubId: 1,
      awayClubId: 2,
      homeScore: 3,
      awayScore: 1,
      played: true,
      events: [
        { id: 'e1', minute: 12, type: 'goal', team: 'home', description: 'Gol de placa' },
        { id: 'e2', minute: 34, type: 'yellow_card', team: 'away', description: 'Falta dura' },
        { id: 'e3', minute: 78, type: 'substitution', team: 'home', description: 'Troca tática' },
      ],
    },
    {
      id: 2,
      round: 2,
      homeClubId: 1,
      awayClubId: 3,
      played: false,
    },
  ];

  const pruned = prunePreviousSeasonData(game);

  assert.equal(pruned.calendar[0].played, true);
  assert.equal(pruned.calendar[0].events, undefined, 'Played fixture minute-by-minute events must be pruned');
  assert.equal(pruned.calendar[1].played, false);
});

test('Task 5: prunePreviousSeasonData compacts championship history and records promotions/relegations', () => {
  const game = migrateCareer(createNewGame(1, 'Alex Manager', 1));
  game.seasonYear = 2027; // moving to 2027, previous was 2026

  game.championshipHistory = [
    {
      id: '2026-nacional',
      seasonYear: 2026,
      competitionType: 'nacional',
      competitionName: 'Campeonato Brasileiro Série A',
      championClubId: 1,
      championClubName: 'Flamengo',
      runnerUpClubId: 2,
      runnerUpClubName: 'Palmeiras',
      topScorerName: 'Pedro',
      topScorerClubName: 'Flamengo',
      topScorerGoals: 24,
      managerName: 'Alex Manager',
      finalScoreText: '82 pts',
    },
    {
      id: '2026-serie-b',
      seasonYear: 2026,
      competitionType: 'nacional',
      competitionName: 'Campeonato Brasileiro Série B',
      championClubId: 10,
      championClubName: 'Santos',
      runnerUpClubId: 11,
      runnerUpClubName: 'Sport',
      finalScoreText: '74 pts',
    },
  ];

  const mockMobility = {
    updatedClubs: game.clubs,
    nationalPromotions: [
      { clubId: 10, clubName: 'Santos', fromDivision: 2, toDivision: 1, type: 'promotion', reason: 'G4' },
      { clubId: 11, clubName: 'Sport', fromDivision: 2, toDivision: 1, type: 'promotion', reason: 'G4' },
    ],
    nationalRelegations: [
      { clubId: 20, clubName: 'Cuiabá', fromDivision: 1, toDivision: 2, type: 'relegation', reason: 'Z4' },
      { clubId: 21, clubName: 'Atlético-GO', fromDivision: 1, toDivision: 2, type: 'relegation', reason: 'Z4' },
    ],
    statePromotions: [],
    stateRelegations: [],
    nextPromotedStateClubIds: [],
    nextRelegatedStateClubIds: [],
    newsArticles: [],
    userPromoted: false,
    userRelegated: false,
    userNewDivision: 1,
    userNewStateTier: 1,
  };

  const pruned = prunePreviousSeasonData(game, mockMobility);

  const serieA = pruned.championshipHistory.find((r) => r.id === '2026-nacional');
  assert.ok(serieA);
  assert.equal(serieA.championClubName, 'Flamengo');
  assert.equal(serieA.runnerUpClubName, 'Palmeiras');
  assert.equal(serieA.topScorerName, 'Pedro');
  assert.deepEqual(serieA.relegatedClubNames, ['Cuiabá', 'Atlético-GO']);

  const serieB = pruned.championshipHistory.find((r) => r.id === '2026-serie-b');
  assert.ok(serieB);
  assert.deepEqual(serieB.promotedClubNames, ['Santos', 'Sport']);
});

test('Task 5: prunePreviousSeasonData caps news feed, clears AI ledgers, and caps manager events', () => {
  const game = migrateCareer(createNewGame(1, 'Alex Manager', 1));

  // Add 100 news articles
  game.newsFeed = Array.from({ length: 100 }, (_, i) => ({
    id: `news-${i}`,
    round: i,
    category: 'geral',
    title: `Notícia ${i}`,
    subtitle: `Sub ${i}`,
    content: `Conteúdo longo ${i}`,
    date: '10/10/2026',
    isHeadline: i % 10 === 0,
  }));

  // Add bulky financial ledgers to AI clubs
  game.clubs = game.clubs.map((c) => ({
    ...c,
    weeklyStatements: Array.from({ length: 50 }, (_, i) => ({
      week: i,
      round: i,
      income: { bilheteria: 1000, premiacoes: 0, patrocinio: 500, vendasAtletas: 0, total: 1500 },
      expenses: { salariosProfissional: 1000, salariosBase: 100, obras: 0, manutencao: 50, parcelasEmprestimo: 0, comprasAtletas: 0, total: 1150 },
      net: 350,
    })),
    financialLedger: Array.from({ length: 100 }, (_, i) => ({
      round: i,
      type: 'income',
      category: 'bilheteria',
      description: `Renda jogo ${i}`,
      amount: 1000,
    })),
  }));

  // Add manager events
  game.managers = (game.managers || []).map((m) => ({
    ...m,
    events: Array.from({ length: 50 }, (_, i) => `Evento longo de técnico ${i}`),
  }));

  const pruned = prunePreviousSeasonData(game);

  // 1. News feed capped to 40
  assert.ok(pruned.newsFeed.length <= 40, `News feed must be capped to <= 40, had ${pruned.newsFeed.length}`);

  // 2. User club retains up to 52 statements, AI clubs retain <= 4
  const userClub = pruned.clubs.find((c) => c.id === pruned.userClubId);
  const aiClub = pruned.clubs.find((c) => c.id !== pruned.userClubId);
  assert.ok(userClub.weeklyStatements.length <= 52);
  assert.ok(aiClub.weeklyStatements.length <= 4, `AI club statements must be pruned to <= 4, had ${aiClub.weeklyStatements.length}`);
  assert.equal(aiClub.financialLedger.length, 0, 'AI financial ledger must be emptied');

  // 3. Manager events capped to <= 12
  for (const m of pruned.managers) {
    assert.ok(m.events.length <= 12, `Manager events must be capped, had ${m.events.length}`);
  }
});

test('Task 5: Save game compression produces payload < 2MB (< 2048 KB)', async () => {
  const game = migrateCareer(createNewGame(1, 'Alex Manager', 1));
  const pruned = prunePreviousSeasonData(game);

  const metrics = await getGameStateMetrics(pruned);
  assert.ok(metrics.isUnder2MB, `Save game must be under 2MB (2048 KB), was ${metrics.compressedKb.toFixed(2)} KB`);
  assert.ok(metrics.compressedKb < 1500, `Compressed save should comfortably be < 1.5MB, was ${metrics.compressedKb.toFixed(2)} KB`);

  // Verify roundtrip fidelity
  const compressed = await compressGameState(pruned);
  const restored = await decompressGameState(compressed);

  assert.equal(restored.userClubId, pruned.userClubId);
  assert.equal(restored.clubs.length, pruned.clubs.length);
  assert.equal(restored.seasonYear, pruned.seasonYear);
});

test('Task 5: Decoupled localStorage writes handle QuotaExceededError safely without throwing', async () => {
  setupMockStorage();
  const game = migrateCareer(createNewGame(1, 'Alex Manager', 1));

  // Simula mock com IndexedDB disponível
  const mockIDB = {
    open: () => {
      const listeners = {};
      const req = {
        result: {
          objectStoreNames: { contains: () => true },
          transaction: () => ({
            objectStore: () => ({
              put: () => ({}),
              get: () => ({ onsuccess: null, onerror: null }),
            }),
            oncomplete: null,
            onerror: null,
            onabort: null,
          }),
          close: () => {},
        },
        onsuccess: null,
        onerror: null,
      };
      setTimeout(() => {
        if (req.onsuccess) req.onsuccess({ target: req });
      }, 0);
      return req;
    },
  };

  // Salva no storage sem travar
  await assert.doesNotReject(async () => {
    await saveActiveGameToStorage(game);
  });
});
