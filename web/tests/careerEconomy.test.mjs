import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  migrateCareer, 
  closeRoundFinances, 
  validOffer, 
  canSell, 
  scoreManagers, 
  changeManagers, 
  appointHuman, 
  post, 
  rolloverManagers,
  resignHumanManager,
  generateUnemployedJobOffers,
  generateEmployedJobOffers,
  getOpenJobVacancies,
  applyCompetitionTitleBonus,
  deriveClubReputationLevel,
  getReputationLevelLabel
} from '../src/engine/careerEconomy.ts';
import { createNewGame } from '../src/data/initialData.ts';

const player = (id, position = 'ATA') => ({ id, name: `P${id}`, age: 25, position, strength: 60, salary: 40_000, marketValue: 1_000_000, injured: false, suspended: false });
const club = (id, name, balance = 5_000_000, division = 1) => ({ id, name, coach: 'Alex', balance, capacity: 10_000, ticketPrice: 40, division, reputation: division === 1 ? 4 : 2, squad: Array.from({ length: 17 }, (_, i) => player(id * 100 + i, i === 0 ? 'GOL' : 'ATA')), youth: [], debt: 0, loans: [], tactics: {}, financialLedger: [], weeklyStatements: [] });
const state = () => ({ userClubId: 1, managerName: 'Alex', seasonYear: 2026, currentRound: 1, clubs: [club(1, 'Um', 5_000_000, 1), club(2, 'Dois', 5_000_000, 1)], calendar: [], standings: [{ clubId: 1, played: 5, points: 0, form: ['D','D','D'] }, { clubId: 2, played: 5, points: 0, form: ['D','D','D'] }], transferOffers: [] });

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
  assert.equal(palmeiras.balance, 15_000_000);
  assert.ok(!(s.transferOffers || []).some(o => o.fromClubId === palmeiras.id && o.fee === 78_064_281));
  const migrated = migrateCareer(s);
  assert.ok((migrated.transferOffers || []).every(o => !validOffer(migrated, o)));
});

// ==========================================
// SPEC-010: Career & Reputation Unit Tests
// ==========================================

test('SPEC-010: reputation level labels and club derivation', () => {
  assert.equal(getReputationLevelLabel(0), 'Municipal');
  assert.equal(getReputationLevelLabel(1), 'Estadual');
  assert.equal(getReputationLevelLabel(2), 'Regional');
  assert.equal(getReputationLevelLabel(3), 'Nacional');
  assert.equal(getReputationLevelLabel(4), 'Continental');
  assert.equal(getReputationLevelLabel(5), 'Mundial');

  assert.equal(deriveClubReputationLevel({ division: 1 }), 3);
  assert.equal(deriveClubReputationLevel({ division: 2 }), 2);
  assert.equal(deriveClubReputationLevel({ division: 3 }), 1);
  assert.equal(deriveClubReputationLevel({ division: 4 }), 0);
  assert.equal(deriveClubReputationLevel({ reputation: 5 }), 5);
});

test('SPEC-010: scoreManagers applies blowout bonus and penalties', () => {
  let s = migrateCareer(state());
  // Human manager at club 1 starts with boardRating 95, fanRating 85
  s.managers[0].boardRating = 95;
  s.managers[0].fanRating = 85;

  // Blowout defeat at home: 0x4 (difference >= 3)
  const blowoutLossFixture = [{ homeClubId: 1, awayClubId: 2, homeScore: 0, awayScore: 4, played: true, competitionType: 'nacional' }];
  const afterBlowoutLoss = scoreManagers(s, blowoutLossFixture);
  const mgrLoss = afterBlowoutLoss.managers.find(m => m.id === s.humanManagerId);
  // Fan rating suffers home defeat against equal level (-3) + regular loss (-5) + blowout (-7) = -15
  assert.equal(mgrLoss.fanRating, 85 - 15);

  // Reset and test blowout victory at home: 4x0
  s.managers[0].fanRating = 85;
  const blowoutWinFixture = [{ homeClubId: 1, awayClubId: 2, homeScore: 4, awayScore: 0, played: true, competitionType: 'nacional' }];
  const afterBlowoutWin = scoreManagers(s, blowoutWinFixture);
  const mgrWin = afterBlowoutWin.managers.find(m => m.id === s.humanManagerId);
  // Fan rating should get regular win (+3) + blowout (+4) = +7
  assert.equal(mgrWin.fanRating, 85 + 7);
});

test('SPEC-010: negative balance and fan contagion penalize board rating', () => {
  let s = migrateCareer(state());
  // Negative balance on club 1
  s.clubs[0].balance = -500_000;
  s.managers[0].boardRating = 95;
  s.managers[0].fanRating = 15; // < 20 triggers popular contagion (-3)

  // Regular 1x1 draw at home
  const fixture = [{ homeClubId: 1, awayClubId: 2, homeScore: 1, awayScore: 1, played: true, competitionType: 'nacional' }];
  const after = scoreManagers(s, fixture);
  const mgr = after.managers.find(m => m.id === s.humanManagerId);

  // National league deficit penalty is -10
  // Fan contagion (< 20) is -3
  // Home draw with equal level is -1
  // Zone middle draw is -1
  assert.ok(mgr.boardRating <= 95 - 10 - 3);
});

test('SPEC-010: human dismissal occurs when boardRating < 10 after 5 matches with contextual reasons', () => {
  let s = migrateCareer(state());
  s.currentRound = 6;
  s.standings = [
    { clubId: 1, played: 5, points: 0, form: ['D','D','D','D','D'] },
    { clubId: 2, played: 5, points: 15, form: ['V','V','V','V','V'] },
  ];

  // Case A: Financial abyss
  s.clubs[0].balance = -1_000_000;
  s.managers[0].boardRating = 8;
  s.managers[0].fanRating = 30;

  const resA = changeManagers(s);
  assert.ok(resA.pendingDismissal);
  assert.equal(resA.pendingDismissal.clubId, 1);
  assert.match(resA.pendingDismissal.reason, /abismo financeiro/i);
  
  const humanA = resA.state.managers.find(m => m.id === s.humanManagerId);
  assert.equal(humanA.available, true);
  assert.equal(humanA.currentClubId, undefined);
  assert.equal(humanA.lastFiredClubId, 1);
  assert.equal(humanA.unemployedRounds, 0);

  // Case B: Fan pressure
  s.clubs[0].balance = 5_000_000;
  s.managers[0].boardRating = 8;
  s.managers[0].fanRating = 15;

  const resB = changeManagers(s);
  assert.match(resB.pendingDismissal.reason, /pressão da torcida/i);

  // Case C: Poor results
  s.managers[0].boardRating = 8;
  s.managers[0].fanRating = 40;

  const resC = changeManagers(s);
  assert.match(resC.pendingDismissal.reason, /resultados não agradaram/i);
});

test('SPEC-010: voluntary resignation frees manager and appoints AI coach', () => {
  let s = migrateCareer(state());
  s.currentRound = 4;
  const resignedState = resignHumanManager(s);
  const human = resignedState.managers.find(m => m.id === s.humanManagerId);
  assert.equal(human.available, true);
  assert.equal(human.currentClubId, undefined);
  assert.equal(human.jobs[human.jobs.length - 1].reason, 'Pediu demissão');

  const c = resignedState.clubs.find(cl => cl.id === 1);
  assert.notEqual(c.managerId, s.humanManagerId);
  assert.ok(c.coach);
});

test('SPEC-010: job offers for unemployed managers exclude last fired club', () => {
  let s = migrateCareer(state());
  // Setup 8 clubs in division 2
  s.clubs = Array.from({ length: 8 }, (_, i) => club(i + 10, `Club D2-${i}`, 2_000_000, 2));
  s.nationalDivisions = [
    {
      division: 2,
      name: 'Série B',
      standings: s.clubs.map((c, i) => ({ clubId: c.id, played: 10, points: 20 - i, won: 5, drawn: 1, lost: 4, goalsFor: 10, goalsAgainst: 10, goalDifference: 0 }))
    }
  ];

  const unemployedManager = {
    ...s.managers[0],
    available: true,
    currentClubId: undefined,
    unemployedRounds: 2,
    lastDivision: 2,
    lastFiredClubId: 10, // Fired from club 10
  };

  const offers = generateUnemployedJobOffers(s, unemployedManager);
  assert.ok(offers.length > 0);
  // Club 10 must never appear in the offers
  assert.ok(offers.every(o => o.clubId !== 10));
});

test('SPEC-010: Central de Empregos (getOpenJobVacancies) respects manager reputation', () => {
  let s = migrateCareer(state());
  s.clubs = [
    { ...club(10, 'Club Série A Top', 10_000_000, 1), reputation: 5 },
    { ...club(11, 'Club Série A Medium', 5_000_000, 1), reputation: 4 },
    { ...club(12, 'Club Série B Low', 2_000_000, 2), reputation: 2 },
    { ...club(13, 'Club Série C Small', 500_000, 3), reputation: 1 },
  ];
  s.nationalDivisions = [
    { division: 1, name: 'Série A', standings: [{ clubId: 10 }, { clubId: 11 }] },
    { division: 2, name: 'Série B', standings: [{ clubId: 12 }] },
    { division: 3, name: 'Série C', standings: [{ clubId: 13 }] },
  ];

  // Manager with reputation 1 (Estadual) cannot access clubs with reputation > 2
  const lowRepManager = { ...s.managers[0], reputationLevel: 1 };
  const vacanciesLow = getOpenJobVacancies(s, lowRepManager);
  assert.ok(vacanciesLow.every(v => v.clubReputation <= 2));

  // Manager with reputation 5 (Mundial) can access any vacancy
  const highRepManager = { ...s.managers[0], reputationLevel: 5 };
  const vacanciesHigh = getOpenJobVacancies(s, highRepManager);
  assert.ok(vacanciesHigh.length > 0);
});

test('SPEC-010: title bonuses and season rollover confidence boost (+50) & prestige decay', () => {
  let s = migrateCareer(state());
  s.managers[0].boardRating = 40;
  s.managers[0].fanRating = 30;
  s.managers[0].prestigePoints = 100;
  s.managers[0].reputationLevel = 3;

  // Win Série A
  const titleRecord = {
    seasonYear: 2026,
    competitionName: 'Campeonato Brasileiro Série A',
    competitionType: 'nacional',
    championClubId: 1,
    runnerUpClubId: 2,
    topScorerName: 'Artilheiro',
    topScorerGoals: 20
  };

  const afterTitle = applyCompetitionTitleBonus(s, titleRecord);
  const mgrAfterTitle = afterTitle.managers.find(m => m.id === s.humanManagerId);
  // Série A gives +40 fan, +30 board, +600 prestige
  assert.equal(mgrAfterTitle.fanRating, 70);
  assert.equal(mgrAfterTitle.boardRating, 70);
  assert.equal(mgrAfterTitle.prestigePoints, 700);

  // Rollover season gives +50 to ratings (capped at 100) and applies al.kk() decay
  afterTitle.championshipHistory = [titleRecord];
  const rolled = rolloverManagers(afterTitle);
  const mgrRolled = rolled.managers.find(m => m.id === s.humanManagerId);

  // 70 + 50 = 120 -> capped at 100
  assert.equal(mgrRolled.boardRating, 100);
  assert.equal(mgrRolled.fanRating, 100);
  // For reputation 3: prestige decays by -50 (700 - 50 = 650)
  assert.equal(mgrRolled.prestigePoints, 650);
});

