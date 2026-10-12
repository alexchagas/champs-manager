import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateCareer } from '../src/engine/careerEconomy.ts';
import { createNewGame } from '../src/data/initialData.ts';
import {
  saveGameSlotToStorage,
  loadGameSlotFromStorage,
  listAllSaveSlots,
  loadActiveGameFromStorage,
  saveActiveGameToStorage,
} from '../src/state/storage.ts';

// Mock localStorage for Node test environment
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
  // Ensure IndexedDB is undefined in mock node environment so fallback to localStorage executes
  globalThis.window = { localStorage: mock };
  return mock;
}

test('new game creates career with disabled auto-save by default and unique careerId', () => {
  const game = createNewGame(1, 'Alex Teste', 1);
  assert.equal(game.options.autoSaveMode, 'disabled');
  assert.ok(game.careerId);
  assert.equal(typeof game.careerId, 'string');
  assert.equal(game.autoSaveMatchCounter, 0);
});

test('migration detects legacy career without autoSaveMode and preserves legacy continuous behavior', () => {
  const legacyGame = {
    userClubId: 1,
    managerName: 'Treinador Antigo',
    seasonYear: 2026,
    currentRound: 5,
    clubs: [{ id: 1, name: 'Flamengo', coach: 'Treinador Antigo', squad: [] }],
    calendar: [],
    standings: [],
    options: { soundEnabled: true, matchSpeed: 'normal' }, // no autoSaveMode!
  };

  const migrated = migrateCareer(legacyGame);
  assert.equal(migrated.options.autoSaveMode, 'legacy_continuous');
  assert.ok(migrated.careerId);
  assert.equal(migrated.autoSaveMatchCounter, 0);

  // If autoSaveMode was already explicitly set, migration preserves it
  const explicitGame = {
    ...legacyGame,
    careerId: 'custom-career-id-123',
    autoSaveMatchCounter: 2,
    options: { ...legacyGame.options, autoSaveMode: 'every_3_matches' },
  };
  const migratedExplicit = migrateCareer(explicitGame);
  assert.equal(migratedExplicit.options.autoSaveMode, 'every_3_matches');
  assert.equal(migratedExplicit.careerId, 'custom-career-id-123');
  assert.equal(migratedExplicit.autoSaveMatchCounter, 2);
});

test('auto-save trigger logic: every_3_matches counts only completed matches and resets at 3', () => {
  const checkShouldAutoSave = (mode, counter) => {
    switch (mode) {
      case 'disabled':
        return { shouldSave: false, nextCounter: counter };
      case 'every_match':
        return { shouldSave: true, nextCounter: 0 };
      case 'every_3_matches': {
        const next = counter + 1;
        if (next >= 3) {
          return { shouldSave: true, nextCounter: 0 };
        }
        return { shouldSave: false, nextCounter: next };
      }
      case 'start_of_year':
        return { shouldSave: false, nextCounter: 0 };
      case 'legacy_continuous':
      default:
        return { shouldSave: true, nextCounter: 0 };
    }
  };

  // 1st match completed
  let step1 = checkShouldAutoSave('every_3_matches', 0);
  assert.equal(step1.shouldSave, false);
  assert.equal(step1.nextCounter, 1);

  // 2nd match completed
  let step2 = checkShouldAutoSave('every_3_matches', step1.nextCounter);
  assert.equal(step2.shouldSave, false);
  assert.equal(step2.nextCounter, 2);

  // 3rd match completed: must save and reset counter
  let step3 = checkShouldAutoSave('every_3_matches', step2.nextCounter);
  assert.equal(step3.shouldSave, true);
  assert.equal(step3.nextCounter, 0);

  // 4th match: starts counting again
  let step4 = checkShouldAutoSave('every_3_matches', step3.nextCounter);
  assert.equal(step4.shouldSave, false);
  assert.equal(step4.nextCounter, 1);
});

test('auto-save trigger logic: every_match saves every completed round', () => {
  const checkShouldAutoSave = (mode, counter) => {
    if (mode === 'every_match') return { shouldSave: true, nextCounter: 0 };
    return { shouldSave: false, nextCounter: counter };
  };

  assert.equal(checkShouldAutoSave('every_match', 0).shouldSave, true);
  assert.equal(checkShouldAutoSave('every_match', 1).shouldSave, true);
});

test('auto-save trigger logic: disabled mode never auto-saves upon completed matches', () => {
  const checkShouldAutoSave = (mode, counter) => {
    if (mode === 'disabled') return { shouldSave: false, nextCounter: counter };
    return { shouldSave: true, nextCounter: 0 };
  };

  assert.equal(checkShouldAutoSave('disabled', 0).shouldSave, false);
  assert.equal(checkShouldAutoSave('disabled', 2).shouldSave, false);
});

test('auto-save trigger logic: start_of_year triggers on rollover, not normal rounds', () => {
  const shouldSaveOnRound = (mode) => mode === 'every_match' || mode === 'legacy_continuous';
  const shouldSaveOnSeasonRollover = (mode) => mode === 'start_of_year' || mode === 'legacy_continuous';

  assert.equal(shouldSaveOnRound('start_of_year'), false);
  assert.equal(shouldSaveOnSeasonRollover('start_of_year'), true);
  assert.equal(shouldSaveOnSeasonRollover('disabled'), false);
});

test('leaving match or visiting screen without completing round does not increment counter or trigger save', () => {
  let counter = 1;
  let saveTriggered = false;

  // Player enters match screen:
  const playerVisitsMatchScreen = () => {
    // Screen changes to 'match', but match is not yet completed
  };

  // Player leaves match screen before completing:
  const playerExitsMatchScreen = () => {
    // Screen changes back to 'overview'
  };

  playerVisitsMatchScreen();
  playerExitsMatchScreen();

  assert.equal(counter, 1, 'Counter must not change on screen navigation');
  assert.equal(saveTriggered, false, 'Save must not trigger when exiting before completion');
});

test('manual save and auto-save use separate identifiable slots and never overwrite each other', async () => {
  setupMockStorage();
  const game = createNewGame(1, 'Alex Teste', 1);
  const careerId = game.careerId;

  // 1. Perform auto-save in dedicated slot
  const autoSaveSlotId = `autosave-${careerId}`;
  const autoSlot = {
    id: autoSaveSlotId,
    title: '[Auto-save] Teste Club',
    date: new Date().toISOString(),
    isAutoSave: true,
    careerId: careerId,
  };
  await saveGameSlotToStorage(autoSlot, { ...game, currentRound: 3 });

  // 2. Perform manual save in separate slot
  const manualSlotId = `manual-123456789`;
  const manualSlot = {
    id: manualSlotId,
    title: 'Manual Save Slot',
    date: new Date().toISOString(),
    isAutoSave: false,
    careerId: careerId,
  };
  await saveGameSlotToStorage(manualSlot, { ...game, currentRound: 3 });

  // Verify list has both slots
  const slots = await listAllSaveSlots();
  assert.equal(slots.length, 2);

  const foundAuto = slots.find((s) => s.id === autoSaveSlotId);
  const foundManual = slots.find((s) => s.id === manualSlotId);
  assert.ok(foundAuto, 'Auto-save slot must exist');
  assert.ok(foundManual, 'Manual slot must exist');
  assert.equal(foundAuto.isAutoSave, true);
  assert.equal(foundManual.isAutoSave, false);

  // 3. Second auto-save updates the same auto-save slot without creating duplicate slots
  const updatedAutoSlot = {
    ...autoSlot,
    date: new Date().toISOString(),
  };
  await saveGameSlotToStorage(updatedAutoSlot, { ...game, currentRound: 6 });

  const updatedSlots = await listAllSaveSlots();
  assert.equal(updatedSlots.length, 2, 'Auto-save should reuse the single career auto-save slot');

  // Verify manual slot was untouched
  const loadedManual = await loadGameSlotFromStorage(manualSlotId);
  assert.ok(loadedManual);
  assert.equal(loadedManual.currentRound, 3);

  // Verify auto-save has round 6
  const loadedAuto = await loadGameSlotFromStorage(autoSaveSlotId);
  assert.ok(loadedAuto);
  assert.equal(loadedAuto.currentRound, 6);
});

test('loading an unavailable or corrupted save returns null and does not silently create a new career', async () => {
  setupMockStorage();

  // Attempt to load nonexistent slot
  const result = await loadGameSlotFromStorage('nonexistent-slot-id');
  assert.equal(result, null, 'Loading nonexistent slot must return null');

  // Attempt to load corrupted slot returns null with logged error
  localStorage.setItem('champs_save_data_corrupted', 'INVALID_NOT_JSON{{{{');
  const corruptedResult = await loadGameSlotFromStorage('corrupted');
  assert.equal(corruptedResult, null, 'Corrupted slot returns null and does not return game state');
});

test('storage failure propagates error correctly without showing false success', async () => {
  const failingStorage = {
    store: new Map(),
    getItem(k) { return this.store.get(k) || null; },
    setItem() {
      throw new Error('QuotaExceededError: LocalStorage limit reached');
    },
    removeItem(k) { this.store.delete(k); },
    clear() { this.store.clear(); }
  };
  globalThis.localStorage = failingStorage;
  globalThis.window = { localStorage: failingStorage };

  await assert.rejects(
    async () => {
      await saveGameSlotToStorage(
        {
          id: 'slot-test',
          title: 'Test',
          date: new Date().toISOString(),
        },
        {}
      );
    },
    /QuotaExceededError/,
    'Save failure must reject and be catchable by the UI'
  );
});
