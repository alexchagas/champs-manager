import type { Club, FinancialEntry, GameState, Manager, MatchFixture, Player, TransferOffer, WeeklyFinancialStatement, RoundAuctionPlayer } from '../types';
import { sanitizePrematureChampionships } from './tournamentCompletion.ts';

const wage = (players: Player[]) => Math.round(players.reduce((n, p) => n + p.salary, 0) / 4);
export const weeklyObligations = (c: Club) => wage(c.squad) + wage(c.youth || []) + Math.round(c.capacity * 0.7) + (c.loans || []).reduce((n, l) => n + Math.min(l.installmentAmount, l.remainingAmount), 0);
export const cashReserve = (c: Club) => weeklyObligations(c) * (c.boardPolicy === 'cautious' ? 4 : c.boardPolicy === 'ambitious' ? 1 : 2);
export const canFundTransfer = (c: Club, fee: number, extraWeeklyWage = 0) => Number.isFinite(fee) && fee > 0 && (c.overdueWages || 0) === 0 && c.balance >= fee && c.balance - fee >= Math.max(0, cashReserve(c) - weeklyObligations(c)) + extraWeeklyWage;

export function canSell(c: Club, p: Player): boolean {
  const rest = c.squad.filter(x => x.id !== p.id);
  const available = rest.filter(x => !x.injured && !x.suspended);
  return rest.length >= 16 && available.length >= 11 && available.some(x => x.position === 'GOL');
}

/**
 * Classical Brasfoot contract rescission fine (f_0.java:2573, jc_0.java:87):
 * Deducts penalty from sales of players with remaining contracts:
 * - <= 0 years / expired: 0%
 * - 1 year: 15%
 * - 2 years: 25%
 * - >= 3 years: 35%
 */
export function calculateRescissionPenalty(contractYears: number = 0, fee: number = 0): number {
  if (contractYears <= 0 || fee <= 0) return 0;
  const rate = contractYears === 1 ? 0.15 : contractYears === 2 ? 0.25 : 0.35;
  return Math.round(fee * rate);
}

/**
 * Classical Brasfoot asking price calculation based on squad depth and position scarcity (best/l.java:574-600).
 */
export function calculateClubAskingPrice(seller: Club, player: Player): number {
  const squad = seller.squad || [];
  const samePos = squad.filter(p => p.position === player.position);
  const posCount = samePos.length;
  const standardLimit = player.position === 'GOL' ? 3 : 4;

  if (posCount >= standardLimit) {
    if (player.strength < 35 || player.age > 33) {
      return Math.max(10_000, Math.round(player.marketValue * 0.85));
    }
    const markup = player.position === 'ATA' ? 1.5 : 1.25;
    return Math.round(player.marketValue * markup);
  } else if (posCount <= 1) {
    const markup = player.position === 'ATA' ? 2.0 : 1.6;
    return Math.round(player.marketValue * markup);
  } else {
    const markup = player.position === 'ATA' ? 1.4 : 1.2;
    return Math.round(player.marketValue * markup);
  }
}

/**
 * Classical Brasfoot transfer refusal checks (best/l.java:622-645).
 */
export function evaluatePlayerTransferAcceptance(
  buyer: Club,
  seller: Club,
  player: Player
): { accepted: boolean; reason?: string } {
  const sellerCountry = seller.countryId || 29;
  const buyerCountry = buyer.countryId || 29;
  const sellerRep = seller.reputation ?? (seller.division === 1 ? 4 : 2);
  const buyerRep = buyer.reputation ?? (buyer.division === 1 ? 4 : 1);
  const isEuropean = sellerCountry !== 29 && sellerRep >= 4;

  if (isEuropean && buyerCountry === 29) {
    if (buyerRep < 4 && (buyer.division || 1) > 1) {
      return {
        accepted: false,
        reason: 'O atleta recusou a proposta pois prefere continuar atuando no futebol europeu.',
      };
    }
  }

  if (sellerRep >= 4 && player.strength >= 55) {
    if (buyerRep <= 2 || (buyer.division || 1) >= 3) {
      return {
        accepted: false,
        reason: 'O atleta recusou a proposta por considerar o clube sem prestígio esportivo compatível com sua carreira.',
      };
    }
  }

  if (sellerRep >= 3 && player.strength >= 65) {
    if (buyerRep <= 1 || (buyer.division || 1) >= 4) {
      return {
        accepted: false,
        reason: 'O atleta não aceitou se transferir para uma divisão inferior.',
      };
    }
  }

  return { accepted: true };
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
      const price = c.ticketPrice || (c.division === 1 ? 30 : c.division === 2 ? 20 : c.division === 3 ? 15 : 10);
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
  state = sanitizePrematureChampionships(state);

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
  // Retain canonical Brasfoot contracts and calibrate transfer offers
  state = {
    ...state,
    transferOffers: (state.transferOffers || []).map(o => ({
      ...o,
      expiresRound: o.expiresRound ?? state.currentRound + 2
    }))
  };
  const roundAuctions = state.roundAuctions && state.roundAuctions.length > 0
    ? state.roundAuctions
    : generateRoundAuctions(state.clubs, state.currentRound);
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
    roundAuctions,
    humanManagerId: 'manager-human-1',
    schemaVersion: 2
  };
  const clean = { ...migrated, transferOffers: (migrated.transferOffers || []).filter(o => !validOffer(migrated, o)) };
  return clean;
}

/**
 * Constrói em uma única passagem linear O(N) o mapa de clubId -> StandingRow[] de todas as competições ativas.
 */
export function buildClubRowsMap(state: GameState): Map<number, StandingRow[]> {
  const map = new Map<number, StandingRow[]>();
  const addRow = (row?: StandingRow) => {
    if (!row) return;
    let arr = map.get(row.clubId);
    if (!arr) {
      arr = [];
      map.set(row.clubId, arr);
    }
    arr.push(row);
  };

  if (state.standingsEstadual) state.standingsEstadual.forEach(addRow);
  if (state.stateDivisions) {
    for (const d of state.stateDivisions) {
      if (d.standings) d.standings.forEach(addRow);
    }
  }
  if (state.standingsNacional) state.standingsNacional.forEach(addRow);
  if (state.nationalDivisions) {
    for (const d of state.nationalDivisions) {
      if (d.standings) d.standings.forEach(addRow);
    }
  }
  if (state.standingsContinental) state.standingsContinental.forEach(addRow);
  if (state.continentalCompetitions) {
    for (const d of state.continentalCompetitions) {
      if (d.standings) d.standings.forEach(addRow);
    }
  }
  if (state.otherLeagues) {
    for (const d of state.otherLeagues) {
      if (d.standings) d.standings.forEach(addRow);
    }
  }
  if (state.standings) state.standings.forEach(addRow);
  return map;
}

/**
 * Retorna todas as linhas de classificação associadas a um clube em qualquer divisão ativa.
 */
export function getAllStandingRowsForClub(state: GameState, clubId: number, prebuiltMap?: Map<number, StandingRow[]>): StandingRow[] {
  if (prebuiltMap) {
    return prebuiltMap.get(clubId) || [];
  }
  const map = buildClubRowsMap(state);
  return map.get(clubId) || [];
}

export function findClubStandingRow(state: GameState, clubId: number, prebuiltMap?: Map<number, StandingRow[]>): StandingRow | undefined {
  const rows = getAllStandingRowsForClub(state, clubId, prebuiltMap);
  return rows.find((r) => r.played > 0) || rows[0];
}

export function scoreManagers(state: GameState, fixtures: MatchFixture[] = []): GameState {
  const clubsMap = new Map(state.clubs.map((c) => [c.id, c]));

  // Mapa linear O(N) pré-computado para desempenho instantâneo (< 2ms)
  const clubRowsMap = buildClubRowsMap(state);

  // Mapa de fixtures por clube jogado nesta rodada
  const fixtureByClub = new Map<number, MatchFixture>();
  for (const f of fixtures) {
    if (f.played) {
      if (f.homeClubId > 0) fixtureByClub.set(f.homeClubId, f);
      if (f.awayClubId > 0) fixtureByClub.set(f.awayClubId, f);
    }
  }

  // Mapa de classificação da divisão nacional por clube para cálculo O(1) de posição
  const divStandingsByClub = new Map<number, StandingRow[]>();
  if (state.standingsNacional && state.standingsNacional.length >= 10) {
    const sorted = [...state.standingsNacional].sort((a, b) => b.points - a.points || b.won - a.won || b.goalDiff - a.goalDiff);
    for (const r of state.standingsNacional) divStandingsByClub.set(r.clubId, sorted);
  }
  if (state.nationalDivisions) {
    for (const d of state.nationalDivisions) {
      if (d.standings && d.standings.length >= 10) {
        const sorted = [...d.standings].sort((a, b) => b.points - a.points || b.won - a.won || b.goalDiff - a.goalDiff);
        for (const r of d.standings) divStandingsByClub.set(r.clubId, sorted);
      }
    }
  }

  const managers = (state.managers || []).map((m) => {
    if (!m.currentClubId) return m;
    const club = clubsMap.get(m.currentClubId);
    if (!club) return m;

    const job = m.jobs[m.jobs.length - 1];
    if (!job) return m;

    const rows = clubRowsMap.get(club.id) || [];
    const directMatch = fixtureByClub.get(club.id);

    // Soma estatísticas das competições em que o clube participa
    const totalWins = rows.reduce((acc, r) => acc + (r.won || 0), 0);
    const totalDraws = rows.reduce((acc, r) => acc + (r.drawn || 0), 0);
    const totalLosses = rows.reduce((acc, r) => acc + (r.lost || 0), 0);
    const totalPoints = rows.reduce((acc, r) => acc + (r.points || 0), 0);
    const totalPlayed = totalWins + totalDraws + totalLosses;

    let deltaWins = 0;
    let deltaDraws = 0;
    let deltaLosses = 0;
    let deltaPoints = 0;
    let deltaMatches = 0;

    if (directMatch) {
      const own = directMatch.homeClubId === club.id ? directMatch.homeScore! : directMatch.awayScore!;
      const opp = directMatch.homeClubId === club.id ? directMatch.awayScore! : directMatch.homeScore!;
      const matchPts = own > opp ? 3 : own === opp ? 1 : 0;
      deltaWins = matchPts === 3 ? 1 : 0;
      deltaDraws = matchPts === 1 ? 1 : 0;
      deltaLosses = matchPts === 0 ? 1 : 0;
      deltaPoints = matchPts;
      deltaMatches = 1;
    } else {
      // Para clubes de ligas paralelas que avançaram suas rodadas
      const prevJobMatches = (job.wins || 0) + (job.draws || 0) + (job.losses || 0);
      if (totalPlayed > prevJobMatches) {
        deltaWins = Math.max(0, totalWins - (job.wins || 0));
        deltaDraws = Math.max(0, totalDraws - (job.draws || 0));
        deltaLosses = Math.max(0, totalLosses - (job.losses || 0));
        deltaPoints = deltaWins * 3 + deltaDraws;
        deltaMatches = deltaWins + deltaDraws + deltaLosses;
      }
    }

    // Se não houve partida nem avanço de rodada para esse clube, mantém o treinador como está
    if (deltaMatches === 0 && !directMatch) {
      return m;
    }

    const updatedJob = {
      ...job,
      wins: (job.wins || 0) + deltaWins,
      draws: (job.draws || 0) + deltaDraws,
      losses: (job.losses || 0) + deltaLosses,
      points: (job.points || 0) + deltaPoints,
    };

    const played = updatedJob.wins + updatedJob.draws + updatedJob.losses;
    const results = Math.round((updatedJob.points - played * job.initialExpectation) * 4);
    const competitions = Math.round(((updatedJob.wins * 2 + updatedJob.draws) / Math.max(1, played)) * 8);
    const currentValue = club.squad.reduce((n, p) => n + p.marketValue, 0);
    const squad = Math.round(Math.max(-15, Math.min(15, (currentValue / Math.max(1, job.initialSquadValue) - 1) * 30)));
    const finances = Math.round(
      Math.max(
        -20,
        Math.min(
          20,
          ((club.balance - job.initialBalance) / Math.max(1_000_000, job.initialBalance)) * 12 -
            Math.max(0, (club.overdueWages || 0) - job.initialOverdueWages) / 100_000
        )
      )
    );

    const scoreComponents = { results, competitions, squad, finances };
    const seasonScore = results + competitions + squad + finances;

    // Cálculo do boardRating com penalidades canônicas de salários e pressão de rebaixamento
    let boardDelta = Math.round((deltaPoints - deltaMatches * job.initialExpectation) * 3);
    if ((club.overdueWages || 0) > job.initialOverdueWages) {
      boardDelta -= 5;
    }
    if (club.squad.filter((p) => !p.injured && !p.suspended).length < 11) {
      boardDelta -= 8;
    }

    // Pressão por posição de tabela na liga nacional
    const allDivRows = divStandingsByClub.get(club.id);
    if (allDivRows) {
      const pos = allDivRows.findIndex((r) => r.clubId === club.id) + 1;
      const myRow = allDivRows[pos - 1];
      if (myRow && myRow.played >= 5) {
        if (pos > allDivRows.length - 4) {
          // Z4: diretoria e torcida em crise
          boardDelta -= 2;
        } else if (pos === 1) {
          // Líder
          boardDelta += 1;
        }
      }
    }

    const boardRating = Math.max(0, Math.min(100, Math.round(m.boardRating + boardDelta)));
    const careerScore = seasonScore + m.jobs.slice(0, -1).reduce((n, j) => n + (j.finalScore || 0), 0);
    const reputation = Math.max(0, Math.min(100, Math.round(50 + careerScore / 10)));

    return {
      ...m,
      jobs: [...m.jobs.slice(0, -1), updatedJob],
      seasonScore,
      careerScore,
      reputation,
      scoreComponents,
      boardRating,
    };
  });

  return { ...state, managers };
}

export function changeManagers(state: GameState): {
  state: GameState;
  dismissals: { club: Club; oldCoach: string; newCoach: string }[];
} {
  let managers = [...(state.managers || [])];
  const dismissals: { club: Club; oldCoach: string; newCoach: string }[] = [];
  const clubRowsMap = buildClubRowsMap(state);

  const clubs = state.clubs.map((club) => {
    const current = managers.find((m) => m.id === club.managerId);
    const row = findClubStandingRow(state, club.id, clubRowsMap);
    if (
      !current ||
      !row ||
      row.played < 5 ||
      current.boardRating >= 20 ||
      current.jobs[current.jobs.length - 1]?.startRound === state.currentRound
    ) {
      return club;
    }

    // Demissão
    const end = current.jobs.length - 1;
    managers = managers.map((m) =>
      m.id === current.id
        ? {
            ...m,
            currentClubId: undefined,
            available: true,
            jobs: m.jobs.map((j, i) =>
              i === end
                ? {
                    ...j,
                    endSeason: state.seasonYear,
                    endRound: state.currentRound,
                    reason: 'Demissão pela diretoria',
                    finalScore: m.seasonScore,
                  }
                : j
            ),
            events: [...m.events, `Demitido pelo ${club.name} na rodada ${state.currentRound}`],
          }
        : m
    );

    const next = managers.find((m) => m.available && m.kind === 'ai' && m.id !== current.id);
    const id = next?.id || `manager-ai-${club.id}-${state.seasonYear}-${state.currentRound}`;
    const name = next?.name || `Técnico ${club.name}`;
    const job = {
      clubId: club.id,
      clubName: club.name,
      startSeason: state.seasonYear,
      startRound: state.currentRound,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      initialBalance: club.balance,
      initialSquadValue: club.squad.reduce((n, p) => n + p.marketValue, 0),
      initialExpectation: managerExpectation(club, state.clubs),
      initialOverdueWages: club.overdueWages || 0,
    };

    if (next) {
      managers = managers.map((m) =>
        m.id === id
          ? {
              ...m,
              available: false,
              currentClubId: club.id,
              boardRating: 55,
              jobs: [...m.jobs, job],
              events: [...m.events, `Contratado pelo ${club.name} na rodada ${state.currentRound}`],
            }
          : m
      );
    } else {
      managers.push({
        id,
        name,
        kind: 'ai',
        reputation: 35,
        boardRating: 55,
        riskProfile: 'balanced',
        currentClubId: club.id,
        available: false,
        jobs: [job],
        titles: [],
        events: [`Contratado pelo ${club.name} na rodada ${state.currentRound}`],
        seasonScore: 0,
        careerScore: 0,
        scoreComponents: { results: 0, competitions: 0, squad: 0, finances: 0 },
      });
    }

    dismissals.push({ club, oldCoach: current.name, newCoach: name });
    return {
      ...club,
      managerId: id,
      coach: name,
      managerStrategy: next?.riskProfile || 'balanced',
      boardActions: [
        ...(club.boardActions || []),
        `Novo técnico adota estratégia ${next?.riskProfile || 'balanced'}`,
      ],
    };
  });

  return { state: { ...state, clubs, managers }, dismissals };
}

export function appointHuman(state: GameState, clubId: number): GameState {
  const human = state.managers?.find(m => m.id === state.humanManagerId);
  const club = state.clubs.find(c => c.id === clubId);
  if (!human || !club) return state;
  const incumbent = state.managers?.find(m => m.id === club.managerId);
  const managers = (state.managers || []).map(m => {
    if (m.id === human.id) {
      const baseJobs = !human.available && m.currentClubId
        ? m.jobs.map((j, i) => i === m.jobs.length - 1 ? { ...j, endSeason: state.seasonYear, endRound: state.currentRound, reason: 'Mudança de clube', finalScore: m.seasonScore } : j)
        : m.jobs;
      return {
        ...m,
        available: false,
        currentClubId: clubId,
        boardRating: 55,
        jobs: [...baseJobs, {
          clubId,
          clubName: club.name,
          startSeason: state.seasonYear,
          startRound: state.currentRound,
          wins: 0,
          draws: 0,
          losses: 0,
          points: 0,
          initialBalance: club.balance,
          initialSquadValue: club.squad.reduce((n, p) => n + p.marketValue, 0),
          initialExpectation: managerExpectation(club, state.clubs),
          initialOverdueWages: club.overdueWages || 0
        }],
        events: [...m.events, `Contratado pelo ${club.name} na rodada ${state.currentRound}`]
      };
    }
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
  if (user) {
    // Prioritize players listed for sale by the user
    const listed = user.squad.filter(p => p.listedForSale && canSell(user, p));
    for (const lp of listed) {
      if (offers.some(o => o.playerId === lp.id)) continue;
      const targetFee = lp.listedPrice || Math.round(lp.marketValue * 0.95);
      const buyer = clubs.find(c => c.id !== user.id && c.squad.length < 30 && canFundTransfer(c, targetFee, Math.round(lp.salary / 4)));
      if (buyer) {
        offers.push({
          id: Math.max(0, ...offers.map(o => o.id)) + 1,
          fromClubId: buyer.id,
          fromClubName: buyer.name,
          toClubId: user.id,
          playerId: lp.id,
          playerName: lp.name,
          playerPosition: lp.position,
          playerStrength: lp.strength,
          fee: targetFee,
          expiresRound: state.currentRound + 2
        });
      }
    }

    if (offers.length < 3) {
      const candidate = user.squad.find(p => canSell(user, p) && !offers.some(o => o.playerId === p.id));
      const fee = candidate ? Math.round(candidate.marketValue * 1.1) : 0;
      const buyer = clubs.find(c => c.id !== user.id && c.squad.length < 30 && candidate && canFundTransfer(c, fee, Math.round(candidate.salary / 4)));
      if (candidate && buyer) offers.push({ id: Math.max(0, ...offers.map(o => o.id)) + 1, fromClubId: buyer.id, fromClubName: buyer.name, toClubId: user.id, playerId: candidate.id, playerName: candidate.name, playerPosition: candidate.position, playerStrength: candidate.strength, fee, expiresRound: state.currentRound + 2 });
    }
  }

  // Manage 5 round auction players (best/N.java)
  let roundAuctions = state.roundAuctions || [];
  if (roundAuctions.length === 0 || roundAuctions.every(a => a.completed)) {
    roundAuctions = generateRoundAuctions(clubs, state.currentRound);
  } else {
    // CPU clubs bid on active auctions
    roundAuctions = roundAuctions.map(item => {
      if (item.completed) return item;
      const variation = (item.id * 7919 + state.currentRound * 104729) % 100;
      if (variation < 35 && item.currentBid < Math.round(item.player.marketValue * 1.1)) {
        const potentialBidders = clubs.filter(c => 
          c.id !== item.sellerClubId && 
          c.id !== state.userClubId &&
          c.squad.length < 30 &&
          c.balance > item.minNextBid + weeklyObligations(c)
        );
        if (potentialBidders.length > 0) {
          const bidder = potentialBidders[variation % potentialBidders.length];
          const newBid = Math.min(item.minNextBid + 25_000, Math.round(item.player.marketValue * 1.15));
          return {
            ...item,
            currentBid: newBid,
            highestBidderClubId: bidder.id,
            highestBidderName: bidder.name,
            minNextBid: Math.round(newBid * 1.05)
          };
        }
      }
      return item;
    });
  }

  return { ...state, clubs, freeAgents, transferOffers: offers, roundAuctions, newsFeed: [...transferNews, ...(state.newsFeed || [])].slice(0, 40) };
}

export function rolloverManagers(state: GameState): GameState {
  const champion = state.standings[0]?.clubId;
  const history = state.championshipHistory || [];

  const managers = (state.managers || []).map(m => {
    if (!m.currentClubId) return m;
    const c = state.clubs.find(x => x.id === m.currentClubId);
    if (!c) return m;
    const last = m.jobs.length - 1;

    // Títulos conquistados pelo clube nesta temporada (em qualquer divisão ou copa)
    const clubTitles = history.filter(
      (r) => r.seasonYear === state.seasonYear && r.championClubId === c.id
    );
    const wonAnyTitle = clubTitles.length > 0 || champion === c.id;
    const titleBonus = clubTitles.length > 0 ? clubTitles.length * 20 : (champion === c.id ? 20 : 0);

    const old = { ...m.jobs[last], endSeason: state.seasonYear, endRound: 38, reason: 'Fim da temporada', finalScore: m.seasonScore + titleBonus };
    const next = { clubId: c.id, clubName: c.name, startSeason: state.seasonYear + 1, startRound: 1, wins: 0, draws: 0, losses: 0, points: 0, initialBalance: c.balance, initialSquadValue: c.squad.reduce((n, p) => n + p.marketValue, 0), initialExpectation: managerExpectation(c, state.clubs), initialOverdueWages: c.overdueWages || 0 };

    const earnedTitles = clubTitles.map((r) => `${r.seasonYear} · ${r.competitionName}`);
    if (earnedTitles.length === 0 && champion === c.id) {
      earnedTitles.push(`${state.seasonYear} · ${state.nationalLeagueName || state.leagueName || 'Campeonato'}`);
    }

    const careerScore = m.careerScore + titleBonus;
    const reputation = Math.max(0, Math.min(100, Math.round(50 + careerScore / 10)));
    const boardRating = Math.max(0, Math.min(100, Math.round((m.boardRating ?? 60) + 10)));
    return { ...m, jobs: [...m.jobs.slice(0, -1), old, next], titles: earnedTitles.length > 0 ? [...m.titles, ...earnedTitles] : m.titles, careerScore, seasonScore: 0, scoreComponents: { results: 0, competitions: 0, squad: 0, finances: 0 }, reputation, boardRating };
  });

  // Roll contracts: player ages + 1, contractYears - 1
  const clubs = state.clubs.map(c => ({
    ...c,
    squad: c.squad.map(p => ({
      ...p,
      age: p.age + 1,
      contractYears: Math.max(0, (p.contractYears ?? 3) - 1),
    })),
    youth: (c.youth || []).map(p => ({
      ...p,
      age: p.age + 1,
      contractYears: Math.max(0, (p.contractYears ?? 3) - 1),
    })),
  }));

  // Fresh round auctions for the new season
  const roundAuctions = generateRoundAuctions(clubs, 1);

  return { ...state, clubs, managers, roundAuctions };
}

export function automaticMatchBench(club: Club): number[] {
  return club.squad.filter(p => !p.isStarter && !p.injured && !p.suspended && (p.contractYears === undefined || p.contractYears > 0))
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

/**
 * Generates 5 surplus players from CPU clubs with >= 21 players for round auction (best/N.java, dz_0.java).
 */
export function generateRoundAuctions(clubs: Club[], round: number): RoundAuctionPlayer[] {
  const eligibleClubs = clubs.filter(c => c.squad && c.squad.length >= 21);
  if (eligibleClubs.length === 0) return [];

  const shuffled = [...eligibleClubs].sort((a, b) => {
    const ha = (a.id * 17 + round * 31) % 97;
    const hb = (b.id * 17 + round * 31) % 97;
    return ha - hb;
  });

  const selectedClubs = shuffled.slice(0, 5);
  const items: RoundAuctionPlayer[] = [];

  for (let i = 0; i < selectedClubs.length; i++) {
    const club = selectedClubs[i];
    const candidates = club.squad.filter(p => !p.isStarter && !p.injured && !p.suspended);
    const pool = candidates.length > 0 ? candidates : club.squad;
    const p = pool[(round * 3 + i * 7) % pool.length];
    if (!p) continue;

    const startBid = Math.max(10_000, Math.round(p.marketValue * 0.5));
    items.push({
      id: round * 100 + i + 1,
      player: { ...p },
      sellerClubId: club.id,
      sellerClubName: club.name,
      sellerClubCrest: club.crestMiniUrl || club.crestUrl,
      startingPrice: startBid,
      currentBid: startBid,
      minNextBid: Math.round(startBid * 1.05),
      completed: false,
    });
  }

  return items;
}

export interface AuctionSaleResult {
  sold: boolean;
  buyerClubId?: number;
  buyerClubName?: string;
  finalBid?: number;
  penalty?: number;
  netProceeds?: number;
  error?: string;
  newState?: GameState;
}

/**
 * Conducts an instant auction for a player from the user's squad (components/an.java, ix_0.java).
 */
export function runInstantPlayerAuction(
  state: GameState,
  playerId: number,
  startingBid: number
): AuctionSaleResult {
  const seller = state.clubs.find(c => c.id === state.userClubId);
  if (!seller) return { sold: false, error: 'Clube do usuário não encontrado.' };

  const player = seller.squad.find(p => p.id === playerId);
  if (!player) return { sold: false, error: 'Jogador não encontrado no elenco.' };

  if (!canSell(seller, player)) {
    return { sold: false, error: 'A venda deixaria o elenco com menos de 16 atletas ou sem goleiro.' };
  }

  const candidateBuyers = state.clubs.filter(c =>
    c.id !== seller.id &&
    c.squad.length < 30 &&
    c.balance >= startingBid
  );

  if (candidateBuyers.length === 0) {
    return {
      sold: false,
      error: 'Não há clubes com orçamento disponível para cobrir o lance inicial.',
    };
  }

  const interested = candidateBuyers.map(c => {
    const posCount = c.squad.filter(p => p.position === player.position).length;
    const need = posCount < 3 ? 3 : posCount < 4 ? 2 : 1;
    const maxAffordable = Math.min(c.balance - weeklyObligations(c), Math.round(player.marketValue * 1.3));
    return { club: c, need, maxAffordable };
  }).filter(item => item.maxAffordable >= startingBid);

  if (interested.length === 0) {
    return {
      sold: false,
      error: 'Nenhum clube se interessou pelo jogador por este preço. Tente um lance inicial menor.',
    };
  }

  interested.sort((a, b) => b.maxAffordable - a.maxAffordable);
  const winner = interested[0];
  const second = interested[1];

  let winningBid = startingBid;
  if (second) {
    winningBid = Math.min(winner.maxAffordable, Math.max(startingBid, second.maxAffordable + 10_000));
  } else {
    winningBid = startingBid;
  }

  const penalty = calculateRescissionPenalty(player.contractYears ?? 0, winningBid);
  const netProceeds = winningBid - penalty;

  let updatedSeller = post(seller, state.currentRound, 'income', 'vendas_atletas', `Venda em leilão de ${player.name} para o ${winner.club.name}`, winningBid, `auction-sale-${player.id}`);
  if (penalty > 0) {
    updatedSeller = post(updatedSeller, state.currentRound, 'expense', 'outros', `Multa rescisória na venda de ${player.name} (${Math.round((penalty / winningBid) * 100)}%)`, penalty, `rescission-${player.id}`);
  }
  updatedSeller = {
    ...updatedSeller,
    squad: updatedSeller.squad.filter(p => p.id !== player.id),
  };

  const updatedBuyer = post(winner.club, state.currentRound, 'expense', 'compras_atletas', `Compra em leilão de ${player.name}`, winningBid, `auction-buy-${player.id}`);
  const buyerAfter = {
    ...updatedBuyer,
    squad: [...updatedBuyer.squad, { ...player, isStarter: false, contractYears: 3, listedForSale: false, listedPrice: undefined }],
  };

  const updatedClubs = state.clubs.map(c =>
    c.id === seller.id ? updatedSeller : c.id === winner.club.id ? buyerAfter : c
  );

  const newsArticle = {
    id: `news-auction-${state.seasonYear}-${state.currentRound}-${player.id}`,
    round: state.currentRound,
    category: 'transferencia' as const,
    title: `LEILÃO: ${player.name.toUpperCase()} VENDIDO AO ${winner.club.name.toUpperCase()}`,
    subtitle: `Arrematado por R$ ${winningBid.toLocaleString('pt-BR')}`,
    content: `${seller.name} concluiu o leilão do atleta ${player.name} (${player.position}, força ${player.strength}). O ${winner.club.name} cobriu a maior oferta de R$ ${winningBid.toLocaleString('pt-BR')}.${penalty > 0 ? ` Multa rescisória de R$ ${penalty.toLocaleString('pt-BR')} foi deduzida.` : ''}`,
    clubId: winner.club.id,
    clubName: winner.club.name,
    secondaryClubName: seller.name,
    relatedPlayerName: player.name,
    relatedPlayerPosition: player.position,
    date: `Rodada ${state.currentRound}`,
  };

  return {
    sold: true,
    buyerClubId: winner.club.id,
    buyerClubName: winner.club.name,
    finalBid: winningBid,
    penalty,
    netProceeds,
    newState: {
      ...state,
      clubs: updatedClubs,
      newsFeed: [newsArticle, ...(state.newsFeed || [])].slice(0, 40),
    },
  };
}

export interface RenewalProposalResult {
  success: boolean;
  counterOffer?: number;
  expiredAuction?: boolean;
  error?: string;
  newState?: GameState;
}

/**
 * Evaluates contract renewal with authentic Brasfoot counter-demands (a/fy_0.java).
 */
export function evaluateContractRenewal(
  state: GameState,
  playerId: number,
  years: number,
  offeredSalary: number
): RenewalProposalResult {
  const club = state.clubs.find(c => c.id === state.userClubId);
  if (!club) return { success: false, error: 'Clube não encontrado.' };

  const player = club.squad.find(p => p.id === playerId);
  if (!player) return { success: false, error: 'Jogador não encontrado no elenco.' };

  if (years < 1 || years > 5) return { success: false, error: 'Duração deve ser de 1 a 5 anos.' };

  const minBase = Math.max(player.salary, Math.floor(player.marketValue / 75));
  let demanded = minBase;
  if ((player.contractYears ?? 3) <= 1) {
    demanded = Math.max(player.salary, Math.floor(player.marketValue / 85));
  } else {
    demanded = Math.round(player.salary * 1.15);
  }
  if (years >= 3) {
    demanded = Math.round(demanded * 1.1);
  }

  if (offeredSalary >= demanded) {
    const updatedClubs = state.clubs.map(c => {
      if (c.id === club.id) {
        return {
          ...c,
          squad: c.squad.map(p => p.id === playerId ? { ...p, salary: offeredSalary, contractYears: years } : p),
        };
      }
      return c;
    });

    return {
      success: true,
      newState: { ...state, clubs: updatedClubs },
    };
  }

  return {
    success: false,
    counterOffer: demanded,
    error: `O atleta recusou a proposta inicial e contra-propôs um salário de R$ ${demanded.toLocaleString('pt-BR')}/mês.`,
  };
}

/**
 * Place bid on a Round Auction item (dz_0.java).
 */
export function bidOnRoundAuctionItem(
  state: GameState,
  auctionId: number,
  bidAmount: number
): { success: boolean; error?: string; newState?: GameState } {
  const user = state.clubs.find(c => c.id === state.userClubId);
  if (!user) return { success: false, error: 'Clube do usuário não encontrado.' };

  const auction = (state.roundAuctions || []).find(a => a.id === auctionId);
  if (!auction) return { success: false, error: 'Leilão não encontrado.' };
  if (auction.completed) return { success: false, error: 'Este leilão já foi finalizado.' };

  if (user.squad.length >= 30) return { success: false, error: 'Elenco cheio (limite de 30 atletas).' };
  if (bidAmount < auction.minNextBid) {
    return { success: false, error: `Lance mínimo é de R$ ${auction.minNextBid.toLocaleString('pt-BR')}.` };
  }
  if (!canFundTransfer(user, bidAmount, Math.round(auction.player.salary / 4))) {
    return { success: false, error: 'Saldo insuficiente para cobrir o lance e manter despesas semanais.' };
  }

  const updatedAuctions = (state.roundAuctions || []).map(a => {
    if (a.id === auctionId) {
      return {
        ...a,
        currentBid: bidAmount,
        highestBidderClubId: user.id,
        highestBidderName: user.name,
        minNextBid: Math.round(bidAmount * 1.05),
      };
    }
    return a;
  });

  return {
    success: true,
    newState: {
      ...state,
      roundAuctions: updatedAuctions,
    },
  };
}

/**
 * Concludes a Round Auction item, transferring player to winning club.
 */
export function concludeRoundAuctionItem(
  state: GameState,
  auctionId: number
): { success: boolean; error?: string; newState?: GameState } {
  const auction = (state.roundAuctions || []).find(a => a.id === auctionId);
  if (!auction || auction.completed) return { success: false, error: 'Leilão inválido ou já concluído.' };

  if (!auction.highestBidderClubId) {
    const updatedAuctions = (state.roundAuctions || []).map(a => a.id === auctionId ? { ...a, completed: true } : a);
    return { success: true, newState: { ...state, roundAuctions: updatedAuctions } };
  }

  const buyer = state.clubs.find(c => c.id === auction.highestBidderClubId);
  const seller = state.clubs.find(c => c.id === auction.sellerClubId);
  if (!buyer || !seller) return { success: false, error: 'Clubes envolvidos não encontrados.' };

  const fee = auction.currentBid;
  const player = auction.player;
  const penalty = calculateRescissionPenalty(player.contractYears ?? 0, fee);

  let updatedSeller = post(seller, state.currentRound, 'income', 'vendas_atletas', `Venda no leilão da rodada de ${player.name} para o ${buyer.name}`, fee, `auc-sale-${player.id}`);
  if (penalty > 0) {
    updatedSeller = post(updatedSeller, state.currentRound, 'expense', 'outros', `Multa rescisória de ${player.name}`, penalty, `rescission-${player.id}`);
  }
  updatedSeller = {
    ...updatedSeller,
    squad: updatedSeller.squad.filter(p => p.id !== player.id),
  };

  const updatedBuyer = post(buyer, state.currentRound, 'expense', 'compras_atletas', `Arremate no leilão da rodada de ${player.name}`, fee, `auc-buy-${player.id}`);
  const buyerAfter = {
    ...updatedBuyer,
    squad: [...updatedBuyer.squad, { ...player, isStarter: false, contractYears: 3, listedForSale: false, listedPrice: undefined }],
  };

  const updatedClubs = state.clubs.map(c =>
    c.id === seller.id ? updatedSeller : c.id === buyer.id ? buyerAfter : c
  );

  const updatedAuctions = (state.roundAuctions || []).map(a => a.id === auctionId ? { ...a, completed: true } : a);

  return {
    success: true,
    newState: {
      ...state,
      clubs: updatedClubs,
      roundAuctions: updatedAuctions,
    },
  };
}
