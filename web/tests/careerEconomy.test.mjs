import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateCareer, closeRoundFinances, validOffer, canSell, scoreManagers, changeManagers, appointHuman, post, rolloverManagers } from '../src/engine/careerEconomy.ts';
import { createNewGame } from '../src/data/initialData.ts';

const player = (id, position = 'ATA') => ({ id, name: `P${id}`, age: 25, position, strength: 60, salary: 40_000, marketValue: 1_000_000, injured: false, suspended: false });
const club = (id, name, balance = 5_000_000) => ({ id, name, coach: 'Alex', balance, capacity: 10_000, ticketPrice: 40, squad: Array.from({ length: 17 }, (_, i) => player(id * 100 + i, i === 0 ? 'GOL' : 'ATA')), youth: [], debt: 0, loans: [], tactics: {}, financialLedger: [], weeklyStatements: [] });
const state = () => ({ userClubId: 1, managerName: 'Alex', seasonYear: 2026, currentRound: 1, clubs: [club(1, 'Um'), club(2, 'Dois')], calendar: [], standings: [{ clubId: 1, played: 5, points: 0, form: ['D','D','D'] }, { clubId: 2, played: 5, points: 0, form: ['D','D','D'] }], transferOffers: [] });

test('migration gives equal names distinct stable identities and preserves finances', () => {
  const old = state();
  const migrated = migrateCareer(old);
  assert.notEqual(migrated.managers[0].id, migrated.managers[1].id);
  assert.equal(migrated.clubs[0].balance, old.clubs[0].balance);
  assert.equal(migrateCareer(migrated).managers[0].id, migrated.managers[0].id);
});

test('ledger close is single, balanced, and charges away clubs', () => {
  const s = migrateCareer(state());
  const before = s.clubs.map(c => c.balance);
  const fixture = [{ homeClubId: 1, awayClubId: 2, played: true, round: 1 }];
  const closed = closeRoundFinances(s.clubs, fixture, 1);
  for (let i = 0; i < 2; i++) {
    const newEntries = closed[i].financialLedger.filter(e => e.round === 1);
    assert.equal(closed[i].balance - before[i], newEntries.reduce((n, e) => n + (e.type === 'income' ? e.amount : -e.amount), 0));
    assert.ok(newEntries.some(e => e.category === 'salarios'));
  }
  assert.ok(!closed[1].financialLedger.some(e => e.category === 'bilheteria'));
  assert.deepEqual(closeRoundFinances(closed, fixture, 1), closed);
});

test('arrears are not paid twice and remain distinct from cash and debt', () => {
  const c = { ...club(1, 'Um', 0), debt: 50_000 };
  const one = closeRoundFinances([c], [], 1)[0];
  assert.ok(one.overdueWages > 0);
  assert.equal(one.debt, 50_000);
  const two = closeRoundFinances([{ ...one, balance: 1_000_000 }], [], 2)[0];
  assert.equal(two.overdueWages, 0);
  assert.equal(two.financialLedger.filter(e => e.description === 'Quitação de salários atrasados').length, 1);
});

test('impossible and expired offers fail; keeper and sixteen limit protect lineups', () => {
  const s = migrateCareer(state());
  const p = s.clubs[0].squad[0];
  assert.equal(canSell(s.clubs[0], p), false);
  const offer = { id: 1, fromClubId: 2, toClubId: 1, playerId: p.id, fee: 8_000_000, expiresRound: 1 };
  assert.ok(validOffer(s, offer));
  const ordinary = s.clubs[0].squad[1];
  assert.equal(canSell(s.clubs[0], ordinary), true);
  assert.ok(validOffer({ ...s, currentRound: 2 }, { ...offer, playerId: ordinary.id, fee: 100_000 }));
});

test('ranking, dismissal and appointment keep the person and club cash', () => {
  let s = migrateCareer(state());
  const fixture = [{ homeClubId: 1, awayClubId: 2, homeScore: 0, awayScore: 1, played: true }];
  s = scoreManagers(s, fixture);
  assert.equal(s.managers[0].jobs[0].losses, 1);
  assert.equal(s.managers[1].jobs[0].wins, 1);
  s.managers[0].boardRating = 0;
  s.currentRound = 6;
  const cash = s.clubs[0].balance;
  const swapped = changeManagers(s).state;
  assert.equal(swapped.clubs[0].balance, cash);
  assert.equal(swapped.managers.find(m => m.id === s.humanManagerId).available, true);
  const appointed = appointHuman(swapped, 2);
  assert.equal(appointed.clubs[1].balance, s.clubs[1].balance);
  assert.equal(appointed.managers.find(m => m.id === s.humanManagerId).jobs.length, 2);
});

test('transfer entries conserve cash', () => {
  const a = club(1, 'Um'), b = club(2, 'Dois');
  const total = a.balance + b.balance;
  const x = post(a, 1, 'expense', 'compras_atletas', 'Compra', 100_000, 'a');
  const y = post(b, 1, 'income', 'vendas_atletas', 'Venda', 100_000, 'b');
  assert.equal(x.balance + y.balance, total);
});

test('round statement includes transfers posted after close', () => {
  const c = closeRoundFinances([club(1, 'Um')], [], 1)[0];
  const transferred = post(c, 1, 'expense', 'compras_atletas', 'Compra', 100_000, 'purchase');
  assert.equal(transferred.weeklyStatements[0].expenses.comprasAtletas, 100_000);
  assert.equal(transferred.weeklyStatements[0].net, transferred.financialLedger.reduce((n, e) => n + (e.type === 'income' ? e.amount : -e.amount), 0));
});

test('season rollover preserves jobs, balance and adds title to career', () => {
  const s = migrateCareer(state());
  s.standings = [{ clubId: 1, points: 80 }, { clubId: 2, points: 40 }];
  const rolled = rolloverManagers(s);
  assert.equal(rolled.clubs[0].balance, s.clubs[0].balance);
  assert.equal(rolled.managers[0].jobs.length, 2);
  assert.equal(rolled.managers[0].titles.length, 1);
  assert.equal(rolled.managers[0].careerScore, 20);
});

test('Flamengo opening screen never shows unaffordable Palmeiras–Marinho offer', () => {
  const s = createNewGame(255, 'Alex');
  const palmeiras = s.clubs.find(c => c.name === 'Palmeiras');
  assert.equal(palmeiras.balance, 52_200_000);
  assert.ok(!(s.transferOffers || []).some(o => o.fromClubId === palmeiras.id && o.fee === 78_064_281));
  const migrated = migrateCareer(s);
  assert.ok((migrated.transferOffers || []).every(o => !validOffer(migrated, o)));
});
