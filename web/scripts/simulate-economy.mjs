import fs from 'node:fs';
import { migrateCareer, closeRoundFinances, scoreManagers, changeManagers, runAiMarket, rolloverManagers } from '../src/engine/careerEconomy.ts';

const db = JSON.parse(fs.readFileSync(new URL('../src/data/teamsDatabase.json', import.meta.url), 'utf8'));
const selected = [1, 2, 3, 4].flatMap(d => db.clubs.filter(c => c.countryId === 29 && c.division === d).slice(0, 8).map(c => ({ ...structuredClone(c), youth: Array.from({ length: 13 }, (_, i) => ({ id: 900_000 + c.id * 20 + i, salary: 3_000, marketValue: 100_000 })) })));
const sample = c => ({ club: c.name, division: c.division, balance: c.balance, monthlyPayroll: c.squad.reduce((n, p) => n + p.salary, 0), weeklyGate: Math.round(c.capacity * Math.max(.25, Math.min(.9, 1.05 - c.ticketPrice / 180)) * c.ticketPrice), squadValue: c.squad.reduce((n, p) => n + p.marketValue, 0) });
console.log('BASELINE', JSON.stringify([1, 2, 3, 4].map(d => sample(selected.find(c => c.division === d)))));
let state = migrateCareer({ userClubId: selected[0].id, managerName: 'Humano', clubs: selected, seasonYear: 2026, currentRound: 1, standings: selected.map(c => ({ clubId: c.id, played: 0, points: 0, form: [] })), calendar: [], transferOffers: [], freeAgents: [] });
for (let season = 0; season < 3; season++) {
  for (let round = 1; round <= 38; round++) {
    state.currentRound = round;
    const fixtures = [];
    for (const d of [1, 2, 3, 4]) {
      const group = state.clubs.filter(c => c.division === d);
      for (let i = 0; i < group.length; i += 2) {
        const home = group[(i + round) % group.length];
        const away = group[(i + round + 1) % group.length];
        fixtures.push({ id: season * 10000 + round * 100 + d * 10 + i, round, homeClubId: home.id, awayClubId: away.id, homeScore: (round + i + d) % 4, awayScore: (round * 3 + i + d) % 3, played: true });
      }
    }
    state.clubs = closeRoundFinances(state.clubs, fixtures, round + season * 38);
    state = scoreManagers(state, fixtures);
    state = changeManagers(state).state;
    state = runAiMarket(state);
    state.standings = state.standings.map(row => ({ ...row, played: row.played + 1 }));
  }
  state = rolloverManagers(state);
  state.seasonYear++;
  state.standings = state.standings.map(row => ({ ...row, played: 0, points: 0, form: [] }));
}
const values = xs => ({ min: Math.min(...xs), median: [...xs].sort((a,b) => a-b)[Math.floor(xs.length/2)], max: Math.max(...xs) });
for (const d of [1, 2, 3, 4]) {
  const c = state.clubs.filter(x => x.division === d);
  console.log('DIVISION', d, JSON.stringify({ balance: values(c.map(x => x.balance)), debt: values(c.map(x => x.debt || 0)), monthlyPayroll: values(c.map(x => x.squad.reduce((n,p) => n+p.salary,0))), overdueWages: values(c.map(x => x.overdueWages || 0)), squadSize: values(c.map(x => x.squad.length)) }));
}
const entries = state.clubs.flatMap(c => c.financialLedger || []);
console.log('TOTALS', JSON.stringify({ sales: entries.filter(e => e.category === 'vendas_atletas').length, purchases: entries.filter(e => e.category === 'compras_atletas').length, managersChanged: state.managers.filter(m => m.jobs.length > 1 || m.jobs[0].endRound).length, clubsWithArrears: state.clubs.filter(c => (c.overdueWages || 0) > 0).length, invalidLineups: state.clubs.filter(c => c.squad.filter(p => !p.injured && !p.suspended).length < 11 || !c.squad.some(p => p.position === 'GOL')).length }));
