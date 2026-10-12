import type { Club, FinancialEntry, GameState, Manager, MatchFixture, Player, TransferOffer, WeeklyFinancialStatement } from '../types';

const wage = (players: Player[]) => Math.round(players.reduce((n, p) => n + p.salary, 0) / 4);
export const weeklyObligations = (c: Club) => wage(c.squad) + wage(c.youth || []) + Math.round(c.capacity * 0.7) + (c.loans || []).reduce((n, l) => n + Math.min(l.installmentAmount, l.remainingAmount), 0);
export const cashReserve = (c: Club) => weeklyObligations(c) * (c.boardPolicy === 'cautious' ? 4 : c.boardPolicy === 'ambitious' ? 1 : 2);
export const canFundTransfer = (c: Club, fee: number, extraWeeklyWage = 0) => Number.isFinite(fee) && fee > 0 && (c.overdueWages || 0) === 0 && c.balance >= fee && c.balance - fee >= Math.max(0, cashReserve(c) - weeklyObligations(c)) + extraWeeklyWage;

export function canSell(c: Club, p: Player): boolean {
  const rest = c.squad.filter(x => x.id !== p.id);
  const available = rest.filter(x => !x.injured && !x.suspended);
  return rest.length >= 16 && available.length >= 11 && available.some(x => x.position === 'GOL');
}

export function validOffer(state: GameState, offer: TransferOffer): string | null {
  const buyer = state.clubs.find(c => c.id === offer.fromClubId);
  const seller = state.clubs.find(c => c.id === offer.toClubId);
  const player = seller?.squad.find(p => p.id === offer.playerId);
  if (offer.expiresRound !== undefined && state.currentRound > offer.expiresRound) return 'Proposta expirada.';
  if (!buyer || !seller || !player) return 'Proposta inválida.';
  if (!canSell(seller, player)) return 'A venda impediria uma escalação válida ou deixaria menos de 16 atletas.';
  if (buyer.squad.length >= 30) return 'Comprador com elenco lotado.';
  if (!canFundTransfer(buyer, offer.fee, Math.round(player.salary / 4))) return 'Comprador sem cobertura para taxa e próximas obrigações.';
  return null;
}

export function post(c: Club, round: number, type: FinancialEntry['type'], category: FinancialEntry['category'], description: string, amount: number, suffix: string): Club {
  if (!Number.isFinite(amount) || amount <= 0) return c;
  const entry: FinancialEntry = { id: `fin-${round}-${c.id}-${suffix}`, round, type, category, description, amount: Math.round(amount) };
  const updated = { ...c, balance: c.balance + (type === 'income' ? entry.amount : -entry.amount), financialLedger: [entry, ...(c.financialLedger || [])] };
  if ((updated.weeklyStatements || []).some(s => s.round === round)) updated.weeklyStatements = updated.weeklyStatements!.map(s => s.round === round ? statementFromLedger(updated.financialLedger!, round) : s);
  return updated;
}

function statementFromLedger(entries: FinancialEntry[], round: number): WeeklyFinancialStatement {
  const now = entries.filter(e => e.round === round);
  const sum = (type: FinancialEntry['type'], category: FinancialEntry['category']) => now.filter(e => e.type === type && e.category === category).reduce((n, e) => n + e.amount, 0);
  const incomes = { bilheteria: sum('income', 'bilheteria'), vendasAtletas: sum('income', 'vendas_atletas'), emprestimos: sum('income', 'emprestimo'), total: now.filter(e => e.type === 'income').reduce((n, e) => n + e.amount, 0) };
  const salarios = now.filter(e => e.type === 'expense' && e.category === 'salarios');
  const expenses = { salariosProfissional: salarios.filter(e => !e.description.includes('base')).reduce((n, e) => n + e.amount, 0), salariosBase: salarios.filter(e => e.description.includes('base')).reduce((n, e) => n + e.amount, 0), obras: sum('expense', 'obras'), manutencao: sum('expense', 'manutencao'), parcelasEmprestimo: sum('expense', 'emprestimo'), comprasAtletas: sum('expense', 'compras_atletas'), total: now.filter(e => e.type === 'expense').reduce((n, e) => n + e.amount, 0) };
  return { round, incomes, expenses, net: incomes.total - expenses.total };
}

export function closeRoundFinances(clubs: Club[], fixtures: MatchFixture[], round: number): Club[] {
  return clubs.map(original => {
    // An existing statement makes this close idempotent, including after a save reload.
    if ((original.weeklyStatements || []).some(s => s.round === round)) return original;
    let c: Club = { ...original, boardActions: [] };
    const home = fixtures.find(f => f.homeClubId === c.id && f.played);
    let gate = 0;
    if (home) {
      const price = c.ticketPrice || 40;
      const attendance = Math.min(c.capacity, Math.max(0, Math.round(c.capacity * Math.max(0.25, Math.min(0.9, 1.05 - price / 180)))));
      gate = attendance * price;
      const history = [...(c.attendanceHistory || []), attendance];
      c = { ...c, attendanceHistory: history, avgAttendance: Math.round(history.reduce((a, b) => a + b, 0) / history.length) };
      c = post(c, round, 'income', 'bilheteria', `Bilheteria (${attendance} pagantes)`, gate, 'gate');
    }
    const maintenance = Math.round(c.capacity * 0.7);
    c = post(c, round, 'expense', 'manutencao', 'Manutenção do estádio', maintenance, 'maintenance');
    let installments = 0;
    const loans = (c.loans || []).map(l => {
      const due = Math.min(l.installmentAmount, l.remainingAmount);
      const paid = Math.min(due, Math.max(0, c.balance));
      if (paid) c = post(c, round, 'expense', 'emprestimo', `Parcela de empréstimo ${l.id}`, paid, `loan-${l.id}`);
      installments += paid;
      return { ...l, remainingAmount: l.remainingAmount - paid, remainingInstallments: l.remainingInstallments - (paid === due ? 1 : 0) };
    }).filter(l => l.remainingAmount > 0);
    c.loans = loans;
    c.debt = Math.max(loans.reduce((n, l) => n + l.remainingAmount, 0), (original.debt || 0) - installments);
    const oldArrears = c.overdueWages || 0;
    const senior = wage(c.squad);
    const youth = wage(c.youth || []);
    let available = Math.max(0, c.balance);
    const arrearsPaid = Math.min(oldArrears, available);
    if (arrearsPaid) c = post(c, round, 'expense', 'salarios', 'Quitação de salários atrasados', arrearsPaid, 'arrears');
    available = Math.max(0, c.balance);
    const seniorPaid = Math.min(senior, available);
    if (seniorPaid) c = post(c, round, 'expense', 'salarios', 'Salários profissionais', seniorPaid, 'senior');
    available = Math.max(0, c.balance);
    const youthPaid = Math.min(youth, available);
    if (youthPaid) c = post(c, round, 'expense', 'salarios', 'Salários da base', youthPaid, 'youth');
    c.overdueWages = oldArrears - arrearsPaid + senior - seniorPaid + youth - youthPaid;
    if (oldArrears > 0 && c.overdueWages === 0) c.boardActions!.push('Salários atrasados quitados');
    if (c.overdueWages > 0) c.boardActions!.push('Salários atrasados: restringir contratações e buscar vendas');
    if (c.balance < weeklyObligations(c) * 2) c.boardActions!.push('Orçamento de transferências reduzido');
    const statement = statementFromLedger(c.financialLedger || [], round);
    return { ...c, weeklyStatements: [statement, ...(c.weeklyStatements || [])].slice(0, 152) };
  });
}

export function managerExpectation(c: Club, clubs: Club[]): number {
  const strengths = clubs.map(x => x.squad.reduce((n, p) => n + p.strength, 0) / Math.max(1, x.squad.length));
  const mine = c.squad.reduce((n, p) => n + p.strength, 0) / Math.max(1, c.squad.length);
  return Math.max(0.25, Math.min(2.4, 1 + (mine - strengths.reduce((a, b) => a + b, 0) / Math.max(1, strengths.length)) / 25));
}

export function migrateCareer(state: GameState): GameState {
  state = migrateMatchState(state);

  const needsSaveMigration = state.options?.autoSaveMode === undefined || !state.careerId;
  const migratedAutoSaveMode = state.options?.autoSaveMode !== undefined
    ? state.options.autoSaveMode
    : 'legacy_continuous';
  const careerId = state.careerId || `career-${state.userClubId}-${(state.managerName || 'manager').replace(/\s+/g, '_')}`;
  const autoSaveMatchCounter = state.autoSaveMatchCounter ?? 0;
  const optionsWithAutoSave = {
    ...state.options,
    autoSaveMode: migratedAutoSaveMode,
  };

  if (state.schemaVersion === 2 && state.managers?.length) {
    if (needsSaveMigration) {
      return {
        ...state,
        careerId,
        autoSaveMatchCounter,
        options: optionsWithAutoSave,
      };
    }
    return state;
  }
  // Imported database contracts were far above gate receipts across four divisions.
  // Apply the same one-time scale to old careers and new careers; retain cash and debt.
  const scaledClubs = state.clubs.map(c => ({ ...c, squad: c.squad.map(p => ({ ...p, salary: Math.max(1_000, Math.round(p.salary / 35)), marketValue: Math.max(10_000, Math.round(p.marketValue / 10)) })) }));
  state = { ...state, clubs: scaledClubs, transferOffers: (state.transferOffers || []).map(o => ({ ...o, fee: Math.round(o.fee / 10), expiresRound: o.expiresRound ?? state.currentRound + 2 })) };
  const managers: Manager[] = [];
  const clubs = state.clubs.map(c => {
    const human = c.id === state.userClubId;
    const id = human ? 'manager-human-1' : `manager-club-${c.id}`;
    const name = human ? state.managerName : c.coach || 'Técnico interino';
    const squadValue = c.squad.reduce((n, p) => n + p.marketValue, 0);
    managers.push({ id, name, kind: human ? 'human' : 'ai', reputation: 50, boardRating: 60,
      riskProfile: c.id % 3 === 0 ? 'aggressive' : c.id % 3 === 1 ? 'balanced' : 'cautious',
      currentClubId: c.id, available: false, jobs: [{ clubId: c.id, clubName: c.name, startSeason: state.seasonYear, startRound: state.currentRound, wins: 0, draws: 0, losses: 0, points: 0, initialBalance: c.balance, initialSquadValue: squadValue, initialExpectation: managerExpectation(c, state.clubs), initialOverdueWages: c.overdueWages || 0 }], titles: [], events: [], seasonScore: 0, careerScore: 0, scoreComponents: { results: 0, competitions: 0, squad: 0, finances: 0 } });
    return { ...c, managerId: id, coach: name, boardPolicy: c.boardPolicy || (c.id % 3 === 0 ? 'ambitious' : c.id % 3 === 1 ? 'balanced' : 'cautious'), managerStrategy: managers[managers.length - 1].riskProfile, overdueWages: c.overdueWages || 0, boardActions: c.boardActions || [] } as Club;
  });
  const migrated = {
    ...state,
    careerId,
    autoSaveMatchCounter,
    options: optionsWithAutoSave,
    clubs,
    managers,
    humanManagerId: 'manager-human-1',
    schemaVersion: 2
  };
  const clean = { ...migrated, transferOffers: (migrated.transferOffers || []).filter(o => !validOffer(migrated, o)) };
  return clean;
}

export function scoreManagers(state: GameState, fixtures: MatchFixture[]): GameState {
  const managers = (state.managers || []).map(m => {
    const club = state.clubs.find(c => c.id === m.currentClubId);
    if (!club) return m;
    const match = fixtures.find(f => f.played && (f.homeClubId === club.id || f.awayClubId === club.id));
    const job = m.jobs[m.jobs.length - 1];
    if (!job || !match) return m;
    const own = match.homeClubId === club.id ? match.homeScore! : match.awayScore!;
    const opp = match.homeClubId === club.id ? match.awayScore! : match.homeScore!;
    const points = own > opp ? 3 : own === opp ? 1 : 0;
    const updatedJob = { ...job, wins: job.wins + (points === 3 ? 1 : 0), draws: job.draws + (points === 1 ? 1 : 0), losses: job.losses + (points === 0 ? 1 : 0), points: job.points + points };
    const played = updatedJob.wins + updatedJob.draws + updatedJob.losses;
    const results = Math.round((updatedJob.points - played * job.initialExpectation) * 4);
    const competitions = Math.round((updatedJob.wins * 2 + updatedJob.draws) / Math.max(1, played) * 8);
    const currentValue = club.squad.reduce((n, p) => n + p.marketValue, 0);
    const squad = Math.round(Math.max(-15, Math.min(15, (currentValue / Math.max(1, job.initialSquadValue) - 1) * 30)));
    const finances = Math.round(Math.max(-20, Math.min(20, (club.balance - job.initialBalance) / Math.max(1_000_000, job.initialBalance) * 12 - Math.max(0, (club.overdueWages || 0) - job.initialOverdueWages) / 100_000)));
    const scoreComponents = { results, competitions, squad, finances };
    const seasonScore = results + competitions + squad + finances;
    const boardRating = Math.max(0, Math.min(100, m.boardRating + (points - job.initialExpectation) * 3 + ((club.overdueWages || 0) > job.initialOverdueWages ? -5 : 0) + (club.squad.filter(p => !p.injured && !p.suspended).length < 11 ? -8 : 0)));
    const careerScore = seasonScore + m.jobs.slice(0, -1).reduce((n, j) => n + (j.finalScore || 0), 0);
    return { ...m, jobs: [...m.jobs.slice(0, -1), updatedJob], seasonScore, careerScore, reputation: Math.max(0, Math.min(100, Math.round(50 + careerScore / 10))), scoreComponents, boardRating };
  });
  return { ...state, managers };
}

export function changeManagers(state: GameState): { state: GameState; dismissals: { club: Club; oldCoach: string; newCoach: string }[] } {
  let managers = [...(state.managers || [])];
  const dismissals: { club: Club; oldCoach: string; newCoach: string }[] = [];
  const clubs = state.clubs.map(club => {
    const current = managers.find(m => m.id === club.managerId);
    const row = state.standings.find(s => s.clubId === club.id);
    if (!current || !row || row.played < 5 || current.boardRating >= 20 || current.jobs[current.jobs.length - 1]?.startRound === state.currentRound) return club;
    const end = current.jobs.length - 1;
    managers = managers.map(m => m.id === current.id ? { ...m, currentClubId: undefined, available: true, jobs: m.jobs.map((j, i) => i === end ? { ...j, endSeason: state.seasonYear, endRound: state.currentRound, reason: 'Demissão pela diretoria', finalScore: m.seasonScore } : j), events: [...m.events, `Demitido pelo ${club.name} na rodada ${state.currentRound}`] } : m);
    const next = managers.find(m => m.available && m.kind === 'ai' && m.id !== current.id);
    const id = next?.id || `manager-ai-${club.id}-${state.seasonYear}-${state.currentRound}`;
    const name = next?.name || `Técnico ${club.id}-${state.currentRound}`;
    const job = { clubId: club.id, clubName: club.name, startSeason: state.seasonYear, startRound: state.currentRound, wins: 0, draws: 0, losses: 0, points: 0, initialBalance: club.balance, initialSquadValue: club.squad.reduce((n, p) => n + p.marketValue, 0), initialExpectation: managerExpectation(club, state.clubs), initialOverdueWages: club.overdueWages || 0 };
    if (next) managers = managers.map(m => m.id === id ? { ...m, available: false, currentClubId: club.id, boardRating: 55, jobs: [...m.jobs, job], events: [...m.events, `Contratado pelo ${club.name} na rodada ${state.currentRound}`] } : m);
    else managers.push({ id, name, kind: 'ai', reputation: 35, boardRating: 55, riskProfile: 'balanced', currentClubId: club.id, available: false, jobs: [job], titles: [], events: [`Contratado pelo ${club.name} na rodada ${state.currentRound}`], seasonScore: 0, careerScore: 0, scoreComponents: { results: 0, competitions: 0, squad: 0, finances: 0 } });
    dismissals.push({ club, oldCoach: current.name, newCoach: name });
    return { ...club, managerId: id, coach: name, managerStrategy: next?.riskProfile || 'balanced', boardActions: [...(club.boardActions || []), `Novo técnico adota estratégia ${next?.riskProfile || 'balanced'}`] };
  });
  return { state: { ...state, clubs, managers }, dismissals };
}

export function appointHuman(state: GameState, clubId: number): GameState {
  const human = state.managers?.find(m => m.id === state.humanManagerId);
  const club = state.clubs.find(c => c.id === clubId);
  if (!human?.available || !club) return state;
  const incumbent = state.managers?.find(m => m.id === club.managerId);
  const managers = (state.managers || []).map(m => {
    if (m.id === human.id) return { ...m, available: false, currentClubId: clubId, boardRating: 55, jobs: [...m.jobs, { clubId, clubName: club.name, startSeason: state.seasonYear, startRound: state.currentRound, wins: 0, draws: 0, losses: 0, points: 0, initialBalance: club.balance, initialSquadValue: club.squad.reduce((n, p) => n + p.marketValue, 0), initialExpectation: managerExpectation(club, state.clubs), initialOverdueWages: club.overdueWages || 0 }], events: [...m.events, `Contratado pelo ${club.name} na rodada ${state.currentRound}`] };
    if (m.id === incumbent?.id) return { ...m, available: true, currentClubId: undefined, jobs: m.jobs.map((j, i) => i === m.jobs.length - 1 ? { ...j, endSeason: state.seasonYear, endRound: state.currentRound, reason: 'Substituído', finalScore: m.seasonScore } : j) };
    return m;
  }) as Manager[];
  return { ...state, userClubId: clubId, activeScreen: state.calendar.some(f => (f.fixtureDateIndex ?? f.round) === state.currentRound && f.played) ? 'round_results' : 'overview', clubs: state.clubs.map(c => c.id === clubId ? { ...c, managerId: human.id, coach: human.name, managerStrategy: human.riskProfile } : c), managers };
}

export function runAiMarket(state: GameState): GameState {
  let clubs = [...state.clubs];
  let freeAgents = [...(state.freeAgents || [])];
  let offers = (state.transferOffers || []).filter(o => !validOffer(state, o));
  const transferNews: NonNullable<GameState['newsFeed']> = [];
  if (state.currentRound % 3 !== 1) return { ...state, transferOffers: offers };
  for (const club of clubs) {
    if (club.id === state.userClubId) continue;
    let live = clubs.find(c => c.id === club.id)!;
    const variation = (club.id * 1103515245 + state.currentRound * 12345 + state.seasonYear * 97) >>> 0;
    let available = live.squad.filter(p => !p.injured && !p.suspended);
    let needsKeeper = !available.some(p => p.position === 'GOL');
    if ((needsKeeper || available.length < 11 || live.squad.length < 16) && live.squad.length < 30) {
      const youth = (live.youth || []).find(p => !p.injured && !p.suspended && (!needsKeeper || p.position === 'GOL'));
      if (youth) {
        live = { ...live, youth: (live.youth || []).filter(p => p.id !== youth.id), squad: [...live.squad, { ...youth, salary: Math.max(3_000, youth.salary), contractYears: 3, isStarter: false }], boardActions: [...(live.boardActions || []), `Promovido ${youth.name} para recompor o elenco`] };
        clubs = clubs.map(c => c.id === live.id ? live : c);
        available = live.squad.filter(p => !p.injured && !p.suspended);
        needsKeeper = !available.some(p => p.position === 'GOL');
      }
    }
    const desired: Record<string, number> = { GOL: 2, ZAG: 4, LAT: 4, VOL: 3, MEI: 3, ATA: 3 };
    const priority = (Object.keys(desired) as Player['position'][]).find(pos => available.filter(p => p.position === pos).length < desired[pos]);
    const targetSize = live.managerStrategy === 'aggressive' ? 20 : live.managerStrategy === 'cautious' ? 17 : 18;
    if (live.squad.length < targetSize || available.length < 12 || priority) {
      const options = freeAgents.filter(p => (!priority || p.position === priority) && p.salary / 4 < Math.max(1_000, live.balance / 16)).sort((a, b) => a.salary - b.salary);
      const candidate = options[variation % Math.min(3, options.length || 1)];
      if (candidate && live.squad.length < 30 && live.balance >= candidate.salary + cashReserve(live)) {
        live = post(live, state.currentRound, 'expense', 'outros', `Bônus de assinatura: ${candidate.name}`, candidate.salary, `ai-sign-${candidate.id}`);
        live = { ...live, squad: [...live.squad, { ...candidate, contractYears: 2, isStarter: false }] };
        clubs = clubs.map(c => c.id === live.id ? live : c);
        freeAgents = freeAgents.filter(p => p.id !== candidate.id);
      }
    }
    // Financial stress leads to a real sale, provided the seller can still field eleven.
    if (live.balance < weeklyObligations(live) * 2) {
      const player = [...live.squad].sort((a, b) => b.marketValue - a.marketValue).find(p => canSell(live, p));
      const buyer = clubs.find(c => c.id !== live.id && c.id !== state.userClubId && c.squad.length < 30 && player && canFundTransfer(c, Math.round(player.marketValue * 0.8), Math.round(player.salary / 4)));
      if (player && buyer) {
        const fee = Math.round(player.marketValue * 0.8);
        const sellerAfter = post(live, state.currentRound, 'income', 'vendas_atletas', `Venda de ${player.name} ao ${buyer.name}`, fee, `ai-sale-${player.id}`);
        const buyerAfter = post(buyer, state.currentRound, 'expense', 'compras_atletas', `Compra de ${player.name} do ${live.name}`, fee, `ai-buy-${player.id}`);
        clubs = clubs.map(c => c.id === live.id ? { ...sellerAfter, squad: sellerAfter.squad.filter(p => p.id !== player.id) } : c.id === buyer.id ? { ...buyerAfter, squad: [...buyerAfter.squad, { ...player, isStarter: false }] } : c);
        if (fee >= 1_000_000) transferNews.push({ id: `news-ai-transfer-${state.seasonYear}-${state.currentRound}-${player.id}`, round: state.currentRound, category: 'transferencia', title: `${buyer.name.toUpperCase()} CONTRATA ${player.name.toUpperCase()}`, subtitle: `Transferência de R$ ${fee.toLocaleString('pt-BR')}`, content: `${buyer.name} comprou ${player.name} de ${live.name} por R$ ${fee.toLocaleString('pt-BR')}.`, clubId: buyer.id, clubName: buyer.name, secondaryClubName: live.name, relatedPlayerName: player.name, relatedPlayerPosition: player.position, date: `Rodada ${state.currentRound}` });
      }
    }
    live = clubs.find(c => c.id === club.id)!;
    if (live.balance < 0 && (live.debt || 0) < live.squad.reduce((n, p) => n + p.marketValue, 0) * 0.15) {
      const gateAverage = Math.round(live.capacity * Math.max(0.25, Math.min(0.9, 1.05 - live.ticketPrice / 180)) * live.ticketPrice / 2);
      if (gateAverage >= weeklyObligations(live) * 0.8) {
        const amount = Math.round(Math.min(weeklyObligations(live) * 4, live.squad.reduce((n, p) => n + p.marketValue, 0) * 0.05));
        const totalToPay = Math.round(amount * 1.12);
        const borrowed = post(live, state.currentRound, 'income', 'emprestimo', 'Crédito de recuperação aprovado pela diretoria', amount, `ai-credit-${state.seasonYear}`);
        clubs = clubs.map(c => c.id === live.id ? { ...borrowed, debt: (live.debt || 0) + totalToPay, loans: [...(live.loans || []), { id: `ai-${live.id}-${state.seasonYear}-${state.currentRound}`, principal: amount, totalToPay, remainingAmount: totalToPay, installmentAmount: Math.ceil(totalToPay / 20), remainingInstallments: 20, totalInstallments: 20, interestRate: 0.12, takenAtRound: state.currentRound }], boardActions: ['Crédito limitado para manter a operação'] } : c);
      }
    }
  }
  const user = clubs.find(c => c.id === state.userClubId);
  if (user && offers.length < 3) {
    const candidate = user.squad.find(p => canSell(user, p) && !offers.some(o => o.playerId === p.id));
    const fee = candidate ? Math.round(candidate.marketValue * 1.1) : 0;
    const buyer = clubs.find(c => c.id !== user.id && c.squad.length < 30 && candidate && canFundTransfer(c, fee, Math.round(candidate.salary / 4)));
    if (candidate && buyer) offers.push({ id: Math.max(0, ...offers.map(o => o.id)) + 1, fromClubId: buyer.id, fromClubName: buyer.name, toClubId: user.id, playerId: candidate.id, playerName: candidate.name, playerPosition: candidate.position, playerStrength: candidate.strength, fee, expiresRound: state.currentRound + 2 });
  }
  return { ...state, clubs, freeAgents, transferOffers: offers, newsFeed: [...transferNews, ...(state.newsFeed || [])].slice(0, 40) };
}

export function rolloverManagers(state: GameState): GameState {
  const champion = state.standings[0]?.clubId;
  const managers = (state.managers || []).map(m => {
    if (!m.currentClubId) return m;
    const c = state.clubs.find(x => x.id === m.currentClubId);
    if (!c) return m;
    const last = m.jobs.length - 1;
    const titleBonus = champion === c.id ? 20 : 0;
    const old = { ...m.jobs[last], endSeason: state.seasonYear, endRound: 38, reason: 'Fim da temporada', finalScore: m.seasonScore + titleBonus };
    const next = { clubId: c.id, clubName: c.name, startSeason: state.seasonYear + 1, startRound: 1, wins: 0, draws: 0, losses: 0, points: 0, initialBalance: c.balance, initialSquadValue: c.squad.reduce((n, p) => n + p.marketValue, 0), initialExpectation: managerExpectation(c, state.clubs), initialOverdueWages: c.overdueWages || 0 };
    const title = champion === c.id ? `${state.seasonYear} · ${state.nationalLeagueName || state.leagueName || 'Campeonato'}` : undefined;
    return { ...m, jobs: [...m.jobs.slice(0, -1), old, next], titles: title ? [...m.titles, title] : m.titles, careerScore: m.careerScore + titleBonus, seasonScore: 0, scoreComponents: { results: 0, competitions: 0, squad: 0, finances: 0 } };
  });
  return { ...state, managers };
}

export function automaticMatchBench(club: Club): number[] {
  return club.squad.filter(p => !p.isStarter && !p.injured && !p.suspended)
    .sort((a,b) => Number(b.position === 'GOL') - Number(a.position === 'GOL') || b.strength*b.energy-a.strength*a.energy || a.id-b.id)
    .slice(0,11).map(p => p.id);
}
export function migrateMatchState(state: GameState): GameState {
  const active = state.activeMatch;
  return { ...state,
    standingsEstadual: state.standingsEstadual?.length ? state.standingsEstadual : undefined,
    standingsNacional: state.standingsNacional?.length ? state.standingsNacional : undefined,
    standingsContinental: state.standingsContinental?.length ? state.standingsContinental : undefined,
    activeMatch: active ? { ...active, paused: true } : undefined,
    activeMatchFixtureId: active?.fixtureId,
    activeScreen: active && active.phase !== 'committed' ? 'live_match' : !active && state.activeScreen === 'live_match' ? 'tactics' : state.activeScreen,
    clubs: state.clubs.map(club => ({ ...club, namedSubstituteIds: club.namedSubstituteIds === undefined
      ? automaticMatchBench(club)
      : club.namedSubstituteIds.filter((id,i,all) => all.indexOf(id) === i && club.squad.some(p => p.id === id && !p.isStarter && !p.injured && !p.suspended)).slice(0,11) })),
  };
}
