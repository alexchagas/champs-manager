import type { GameState, MatchFixture, StandingRow } from '../types/index.ts';

const byId = (a: MatchFixture, b: MatchFixture) => a.id - b.id;
const ranking = (a: StandingRow, b: StandingRow) =>
  b.points - a.points || b.won - a.won || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor || a.clubId - b.clubId;

function winner(fixture: MatchFixture): number {
  if ((fixture.homeScore ?? 0) !== (fixture.awayScore ?? 0)) {
    return fixture.homeScore! > fixture.awayScore! ? fixture.homeClubId : fixture.awayClubId;
  }
  // A level single-leg tie is decided by a recorded shoot-out.
  return (fixture.penaltyScore?.[0] ?? 0) > (fixture.penaltyScore?.[1] ?? 0) ? fixture.homeClubId : fixture.awayClubId;
}

function aggregateWinner(first: MatchFixture, second: MatchFixture): number {
  const firstClub = first.homeClubId;
  const firstGoals = (first.homeScore ?? 0) + (second.awayScore ?? 0);
  const secondGoals = (first.awayScore ?? 0) + (second.homeScore ?? 0);
  if (firstGoals === secondGoals) return winner({ ...second, homeScore: 0, awayScore: 0 });
  return firstGoals > secondGoals ? firstClub : first.awayClubId;
}

/** Fill only ties whose qualifying results are complete. Reserved slots remain visible as A definir. */
export function resolvePendingFixtures(state: GameState): GameState {
  let calendar = state.calendar;
  const recordPenalties = (fixtureId: number, score: [number, number]) => {
    if (calendar.find(f => f.id === fixtureId)?.penaltyScore) return;
    calendar = calendar.map(f => f.id === fixtureId ? { ...f, penaltyScore: score } : f);
  };
  const recordAggregateTie = (first: MatchFixture, second: MatchFixture) => {
    const firstGoals = (first.homeScore ?? 0) + (second.awayScore ?? 0);
    const secondGoals = (first.awayScore ?? 0) + (second.homeScore ?? 0);
    if (firstGoals === secondGoals) recordPenalties(second.id, [4, 5]);
  };
  const updatePairs = (fixtures: MatchFixture[], pairs: [number, number][]) => {
    if (fixtures.length !== pairs.length || fixtures.some(f => !f.pendingQualification)) return;
    const assignments = new Map(fixtures.map((f, i) => [f.id, pairs[i]]));
    calendar = calendar.map(f => {
      const pair = assignments.get(f.id);
      return pair ? { ...f, homeClubId: pair[0], awayClubId: pair[1], pendingQualification: false } : f;
    });
  };

  const estadual = calendar.filter(f => f.competitionType === 'estadual');
  const semisFirst = estadual.filter(f => f.stage === 'Semifinal' && f.leg === 1).sort(byId);
  const semisSecond = estadual.filter(f => f.stage === 'Semifinal' && f.leg === 2).sort(byId);
  const final = estadual.filter(f => f.stage === 'Final').sort(byId);
  if (semisFirst.length === 2 && semisFirst.every(f => f.pendingQualification)) {
    const group = estadual.filter(f => f.stage?.startsWith('Rodada'));
    const ranked = [...(state.standingsEstadual || [])].sort(ranking);
    if (group.length && group.every(f => f.played) && ranked.length >= 4) {
      const pairs: [number, number][] = [[ranked[0].clubId, ranked[3].clubId], [ranked[1].clubId, ranked[2].clubId]];
      updatePairs(semisFirst, pairs);
      updatePairs(semisSecond, pairs.map(([home, away]) => [away, home]));
    }
  }
  if (final.length === 1 && final[0].pendingQualification && semisSecond.length === 2 && semisSecond.every(f => f.played)) {
    semisFirst.forEach((f, i) => recordAggregateTie(f, semisSecond[i]));
    updatePairs(final, [[aggregateWinner(semisFirst[0], calendar.find(f => f.id === semisSecond[0].id)!), aggregateWinner(semisFirst[1], calendar.find(f => f.id === semisSecond[1].id)!)]]);
  }
  if (final.length === 1 && final[0].played && final[0].homeScore === final[0].awayScore) recordPenalties(final[0].id, [5, 4]);

  const cup = calendar.filter(f => f.competitionType === 'copa');
  if (cup.some(f => f.leg === 1)) {
    for (const [sourceStage, targetStage] of [
      ['Oitavas de Final', 'Quartas de Final'],
      ['Quartas de Final', 'Semifinal'],
      ['Semifinal', 'Final'],
    ] as const) {
      const first = cup.filter(f => f.stage === sourceStage && f.leg === 1).sort(byId);
      const second = cup.filter(f => f.stage === sourceStage && f.leg === 2).sort(byId);
      const nextFirst = cup.filter(f => f.stage === targetStage && f.leg === 1).sort(byId);
      const nextSecond = cup.filter(f => f.stage === targetStage && f.leg === 2).sort(byId);
      second.forEach(s => {
        if (s.played) {
          const matchingFirst = first.find(f => f.homeClubId === s.awayClubId && f.awayClubId === s.homeClubId);
          if (matchingFirst && matchingFirst.played) {
            recordAggregateTie(matchingFirst, s);
          }
        }
      });
      if (first.length === nextFirst.length * 2 && second.length === first.length && second.every(f => f.played)) {
        const winners = first.map((f, i) => aggregateWinner(f, calendar.find(x => x.id === second[i].id)!));
        const pairs: [number, number][] = nextFirst.map((_, i) => [winners[2 * i], winners[2 * i + 1]]);
        updatePairs(nextFirst, pairs);
        updatePairs(nextSecond, pairs.map(([home, away]) => [away, home]));
      }
    }
    const cupFinalFirst = cup.find(f => f.stage === 'Final' && f.leg === 1);
    const cupFinalSecond = cup.find(f => f.stage === 'Final' && f.leg === 2);
    if (cupFinalFirst && cupFinalSecond && cupFinalSecond.played) {
      recordAggregateTie(cupFinalFirst, cupFinalSecond);
    }
  } else {
    for (let round = 1; round <= 3; round++) {
      const source = cup.filter(f => f.round === round).sort(byId);
      const target = cup.filter(f => f.round === round + 1).sort(byId);
      if (source.length === target.length * 2 && source.every(f => f.played)) {
        source.filter(f => f.homeScore === f.awayScore).forEach(f => recordPenalties(f.id, [5, 4]));
        updatePairs(target, target.map((_, i) => [winner(calendar.find(f => f.id === source[2 * i].id)!), winner(calendar.find(f => f.id === source[2 * i + 1].id)!)]));
      }
    }
    cup.filter(f => f.round === 4 && f.played && f.homeScore === f.awayScore)
      .forEach(f => recordPenalties(f.id, [5, 4]));
  }

  const continental = calendar.filter(f => ['libertadores', 'sulamericana', 'champions'].includes(f.competitionType || ''));
  const quartersFirst = continental.filter(f => f.stage === 'Quartas de Final' && f.leg === 1).sort(byId);
  if (quartersFirst.length === 4 && quartersFirst.every(f => f.pendingQualification)) {
    const groups = 'ABCD'.split('').map(letter => continental.filter(f => f.competitionRound?.startsWith(`Grupo ${letter} •`)));
    if (groups.every(group => group.length === 12 && group.every(f => f.played))) {
      const standings = new Map((state.standingsContinental || []).map(row => [row.clubId, row]));
      const qualified = groups.map(group => {
        const ids = [...new Set(group.flatMap(f => [f.homeClubId, f.awayClubId]))];
        return ids.map(id => standings.get(id)!).filter(Boolean).sort(ranking).slice(0, 2).map(row => row.clubId);
      });
      if (qualified.every(group => group.length === 2)) {
        const pairs: [number, number][] = [
          [qualified[0][0], qualified[1][1]], [qualified[1][0], qualified[0][1]],
          [qualified[2][0], qualified[3][1]], [qualified[3][0], qualified[2][1]],
        ];
        updatePairs(quartersFirst, pairs);
        updatePairs(continental.filter(f => f.stage === 'Quartas de Final' && f.leg === 2).sort(byId),
          pairs.map(([home, away]) => [away, home]));
      }
    }
  }
  for (const [sourceStage, targetStage] of [['Quartas de Final', 'Semifinal'], ['Semifinal', 'Final']] as const) {
    const first = continental.filter(f => f.stage === sourceStage && f.leg === 1).sort(byId);
    const second = continental.filter(f => f.stage === sourceStage && f.leg === 2).sort(byId);
    const nextFirst = continental.filter(f => f.stage === targetStage && f.leg === 1).sort(byId);
    const nextSecond = continental.filter(f => f.stage === targetStage && f.leg === 2).sort(byId);
    if (first.length === nextFirst.length * 2 && second.every(f => f.played)) {
      first.forEach((f, i) => recordAggregateTie(f, second[i]));
      const winners = first.map((f, i) => aggregateWinner(f, calendar.find(x => x.id === second[i].id)!));
      const pairs: [number, number][] = nextFirst.map((_, i) => [winners[2 * i], winners[2 * i + 1]]);
      updatePairs(nextFirst, pairs);
      updatePairs(nextSecond, pairs.map(([home, away]) => [away, home]));
    }
  }
  const continentalFinalFirst = continental.find(f => f.stage === 'Final' && f.leg === 1);
  const continentalFinalSecond = continental.find(f => f.stage === 'Final' && f.leg === 2);
  if (continentalFinalFirst?.played && continentalFinalSecond?.played) recordAggregateTie(continentalFinalFirst, continentalFinalSecond);

  // Single-leg World Cup Knockout
  const wc = calendar.filter(f => f.competitionType === 'copa_do_mundo');
  for (const [sourceStage, targetStage] of [['Oitavas de Final', 'Quartas de Final'], ['Quartas de Final', 'Semifinal'], ['Semifinal', 'Grande Final']] as const) {
    const source = wc.filter(f => f.stage === sourceStage || f.competitionRound === sourceStage).sort(byId);
    const target = wc.filter(f => f.stage === targetStage || f.competitionRound === targetStage).sort(byId);
    if (source.length && target.length && source.length === target.length * 2 && source.every(f => f.played)) {
      source.filter(f => f.homeScore === f.awayScore).forEach(f => recordPenalties(f.id, [5, 4]));
      updatePairs(target, target.map((_, i) => [winner(calendar.find(f => f.id === source[2 * i].id)!), winner(calendar.find(f => f.id === source[2 * i + 1].id)!)]));
    }
  }
  wc.filter(f => (f.stage === 'Final' || f.competitionRound === 'Grande Final') && f.played && f.homeScore === f.awayScore)
    .forEach(f => recordPenalties(f.id, [5, 4]));

  // Super Mundial de Clubes Knockout
  const sm = calendar.filter(f => f.competitionType === 'supermundial');
  for (const [sourceStage, targetStage] of [['Quartas de Final', 'Semifinal'], ['Semifinal', 'Grande Final']] as const) {
    const source = sm.filter(f => f.stage === sourceStage || f.competitionRound === sourceStage).sort(byId);
    const target = sm.filter(f => f.stage === targetStage || f.competitionRound === targetStage).sort(byId);
    if (source.length && target.length && source.length === target.length * 2 && source.every(f => f.played)) {
      source.filter(f => f.homeScore === f.awayScore).forEach(f => recordPenalties(f.id, [5, 4]));
      updatePairs(target, target.map((_, i) => [winner(calendar.find(f => f.id === source[2 * i].id)!), winner(calendar.find(f => f.id === source[2 * i + 1].id)!)]));
    }
  }
  sm.filter(f => (f.stage === 'Final' || f.competitionRound === 'Grande Final') && f.played && f.homeScore === f.awayScore)
    .forEach(f => recordPenalties(f.id, [5, 4]));

  // Copa Intercontinental Knockout
  const ic = calendar.filter(f => f.competitionType === 'intercontinental');
  const icSemis = ic.filter(f => f.stage === 'Semifinal' || f.competitionRound?.startsWith('Semifinal')).sort(byId);
  const icFinal = ic.filter(f => f.stage === 'Final' || f.competitionRound === 'Grande Final').sort(byId);
  if (icSemis.length === 2 && icFinal.length === 1 && icSemis.every(f => f.played)) {
    icSemis.filter(f => f.homeScore === f.awayScore).forEach(f => recordPenalties(f.id, [5, 4]));
    updatePairs(icFinal, [[winner(calendar.find(f => f.id === icSemis[0].id)!), winner(calendar.find(f => f.id === icSemis[1].id)!)]]);
  }
  icFinal.filter(f => f.played && f.homeScore === f.awayScore).forEach(f => recordPenalties(f.id, [5, 4]));

  return calendar === state.calendar ? state : { ...state, calendar };
}
