import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initSync } from '../src/wasm_pkg/champs_core.js';
import { createNewGame } from '../src/data/initialData.ts';
import { migrateCareer } from '../src/engine/careerEconomy.ts';
import { 
  saveDevSnapshot, 
  getLastDevSnapshot, 
  getAllDevSnapshots, 
  clearDevSnapshots, 
  exportDevStateJson, 
  importDevStateJson,
  setDevModeEnabled,
  isDevModeEnabled
} from '../src/dev/devSandboxStorage.ts';
import { 
  executeHeadlessStep, 
  runHeadlessSimulation 
} from '../src/dev/devBatchEngine.ts';
import { 
  injectWorldCupInstant, 
  injectNationalTeamOffersInstant, 
  injectAiTransferOfferInstant,
  jumpToSecondSemester
} from '../src/dev/devScenarios.ts';

// Initialize Rust WASM engine for the test suite
initSync({ module: fs.readFileSync(new URL('../src/wasm_pkg/champs_core_bg.wasm', import.meta.url)) });

function createTestState() {
  const raw = createNewGame(255, 'Professor Dev', { soundEnabled: false, autoPauseOnGoal: false });
  return migrateCareer(raw);
}

test('devSandboxStorage - saves and restores snapshots with rollback capability', () => {
  clearDevSnapshots();
  const initial = createTestState();

  assert.equal(getLastDevSnapshot(), null);

  const snapshot = saveDevSnapshot(initial, 'Snapshot Teste 1');
  assert.ok(snapshot.id);
  assert.equal(snapshot.label, 'Snapshot Teste 1');
  assert.equal(snapshot.state.seasonYear, initial.seasonYear);
  assert.equal(snapshot.state.currentRound, initial.currentRound);

  const retrieved = getLastDevSnapshot();
  assert.ok(retrieved);
  assert.equal(retrieved.id, snapshot.id);
  assert.equal(retrieved.state.currentRound, 1);

  // Deep clone test: mutating state should not affect snapshot
  initial.currentRound = 99;
  assert.equal(getLastDevSnapshot().state.currentRound, 1);

  // Clear snapshots
  clearDevSnapshots();
  assert.equal(getLastDevSnapshot(), null);
  assert.equal(getAllDevSnapshots().length, 0);
});

test('devSandboxStorage - export and import JSON state validation', () => {
  const state = createTestState();
  const json = exportDevStateJson(state);
  assert.ok(json.includes('"userClubId": 255'));

  const parsed = importDevStateJson(json);
  assert.equal(parsed.success, true);
  assert.equal(parsed.state.userClubId, 255);

  const invalid = importDevStateJson('{"corrupted": true}');
  assert.equal(invalid.success, false);
  assert.ok(invalid.error);
});

test('devScenarios - instant injections generate valid tournament and offers', () => {
  const state = createTestState();

  // 1. Inject World Cup
  const withWc = injectWorldCupInstant(state);
  assert.ok(withWc.worldCup);
  assert.equal(withWc.worldCup.groups.length, 8);
  assert.equal(withWc.isWorldCupMode, true);
  assert.equal(withWc.activeScreen, 'world_cup');

  // 2. Inject National Team Offers
  const withOffers = injectNationalTeamOffersInstant(state);
  assert.ok(withOffers.nationalTeamOffers);
  assert.ok(withOffers.nationalTeamOffers.length > 0);
  assert.equal(withOffers.activeScreen, 'national_team_offer');

  // 3. Inject AI Transfer Offer
  const withTransfer = injectAiTransferOfferInstant(state);
  assert.ok(withTransfer.transferOffers);
  assert.ok(withTransfer.transferOffers.length > 0);
  assert.equal(withTransfer.activeScreen, 'transfers');
});

test('devBatchEngine - executeHeadlessStep progresses a round cleanly through the official pipeline', () => {
  const state = createTestState();
  assert.equal(state.currentRound, 1);

  const nextState = executeHeadlessStep(state, { forceUserWinKnockout: true });

  assert.equal(nextState.currentRound, 2);
  assert.ok(nextState.calendar.some(f => (f.fixtureDateIndex ?? f.round) === 1 && f.played));
  assert.ok(nextState.newsFeed && nextState.newsFeed.length > 0);
  assert.equal(nextState.activeMatch, undefined);
  assert.equal(nextState.activeScreen, 'overview');
});

test('devBatchEngine - runHeadlessSimulation runs multiple rounds reporting progress', async () => {
  const state = createTestState();
  const progressLogs = [];

  const finalState = await runHeadlessSimulation(state, {
    targetRounds: 3,
    forceUserWinKnockout: true,
    onProgress: (p) => {
      progressLogs.push(p);
    },
  });

  assert.equal(finalState.currentRound, 4);
  assert.ok(progressLogs.length >= 3);
  assert.equal(progressLogs[progressLogs.length - 1].percent, 100);
});

test('devBatchEngine - runHeadlessSimulation respects stopCondition and abort signal', async () => {
  const state = createTestState();

  // Stop condition
  const stoppedState = await runHeadlessSimulation(state, {
    targetRounds: 10,
    stopCondition: (s) => s.currentRound >= 3,
  });
  assert.equal(stoppedState.currentRound, 3);

  // Abort signal
  const controller = new AbortController();
  controller.abort();
  const abortedState = await runHeadlessSimulation(state, {
    targetRounds: 10,
    signal: controller.signal,
  });
  assert.equal(abortedState.currentRound, 1); // halted immediately
});
