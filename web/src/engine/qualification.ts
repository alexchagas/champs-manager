import type { GameState, MatchFixture, StandingRow } from '../types/index.ts';

const byId = (a: MatchFixture, b: MatchFixture) => a.id - b.id;
const ranking = (a: StandingRow, b: StandingRow) =>
  b.points - a.points || b.won - a.won || b.goalDiff - a.goalDiff ||  b.goalsFor - a.goalsFor || a.clubId - b.clubId;

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
  const estQuarters = estadual.filter(f => f.stage === 'Quartas de Final').sort(byId);
  const semisFirst = estadual.filter(f => f.stage === 'Semifinal' && f.leg === 1).sort(byId);
  const semisSecond = estadual.filter(f => f.stage === 'Semifinal' && f.leg === 2).sort(byId);
  const final = estadual.filter(f => f.stage === 'Final').sort(byId);

  if (estQuarters.length === 4 && estQuarters.every(f => f.pendingQualification)) {
    const groupMatches = estadual.filter(f => f.stage?.startsWith('Rodada') || f.competitionRound?.startsWith('Grupo '));
    const estStandings = state.standingsEstadual || [];
    if (groupMatches.length && groupMatches.every(f => f.played) && estStandings.length >= 8) {
      const groupLabels = [...new Set(estStandings.map(r => r.group).filter(Boolean))] as string[];
      if (groupLabels.length === 4) {
        const pairs: [number, number][] = groupLabels.sort().map(g => {
          const gRows = estStandings.filter(r => r.group === g).sort(ranking);
          return [gRows[0].clubId, gRows[1].clubId] as [number, number];
        });
        updatePairs(estQuarters, pairs);
      } else {
        const ranked = [...estStandings].sort(ranking);
        const pairs: [number, number][] = [
          [ranked[0].clubId, ranked[7].clubId],
          [ranked[1].clubId, ranked[6].clubId],
          [ranked[2].clubId, ranked[5].clubId],
          [ranked[3].clubId, ranked[4].clubId],
        ];
        updatePairs(estQuarters, pairs);
      }
    }
  }

  if (semisFirst.length === 2 && semisFirst.every(f => f.pendingQualification)) {
    if (estQuarters.length === 4) {
      if (estQuarters.every(f => f.played)) {
        estQuarters.filter(f => f.homeScore === f.awayScore).forEach(f => recordPenalties(f.id, [5, 4]));
        const winners = estQuarters.map(q => winner(calendar.find(f => f.id === q.id)!));
        const pairs: [number, number][] = [[winners[0], winners[3]], [winners[1], winners[2]]];
        updatePairs(semisFirst, pairs);
        updatePairs(semisSecond, pairs.map(([home, away]) => [away, home]));
      }
    } else {
      const group = estadual.filter(f => f.stage?.startsWith('Rodada'));
      const ranked = [...(state.standingsEstadual || [])].sort(ranking);
      if (group.length && group.every(f => f.played) && ranked.length >= 4) {
        const pairs: [number, number][] = [[ranked[0].clubId, ranked[3].clubId], [ranked[1].clubId, ranked[2].clubId]];
        updatePairs(semisFirst, pairs);
        updatePairs(semisSecond, pairs.map(([home, away]) => [away, home]));
      }
    }
  }
  if (final.length === 1 && final[0].pendingQualification && semisSecond.length === 2 && semisSecond.every(f => f.played)) {
    semisFirst.forEach((f, i) => recordAggregateTie(f, semisSecond[i]));
    updatePairs(final, [[aggregateWinner(semisFirst[0], calendar.find(f => f.id === semisSecond[0].id)!), aggregateWinner(semisFirst[1], calendar.find(f => f.id === semisSecond[1].id)!)]]);
  }
  if (final.length === 1 && final[0].played && final[0].homeScore === final[0].awayScore) recordPenalties(final[0].id, [5, 4]);

  // Nacional Playoffs (ex: Brasileirão Série D e Série C)
  const nacional = calendar.filter(f => f.competitionType === 'nacional');
  const natPlayoffStageOrder = ['Segunda Fase', 'Oitavas de Final', 'Quartas de Final', 'Semifinal', 'Final'] as const;
  const activeNatPlayoffStages = natPlayoffStageOrder.filter(st => nacional.some(f => f.stage === st));
  if (activeNatPlayoffStages.length > 0) {
    const firstStage = activeNatPlayoffStages[0];
    const firstLeg1 = nacional.filter(f => f.stage === firstStage && f.leg === 1).sort(byId);
    const firstLeg2 = nacional.filter(f => f.stage === firstStage && f.leg === 2).sort(byId);
    const regularMatches = nacional.filter(
      f => f.competitionRound?.startsWith('Grupo ') || f.competitionRound?.startsWith('Rodada ')
    );

    if (
      firstLeg1.length > 0 &&
      firstLeg1.every(f => f.pendingQualification) &&
      regularMatches.length > 0 &&
      regularMatches.every(f => f.played)
    ) {
      const natStandings = state.standingsNacional || [];
      const groupLabels = [
        ...new Set(
          regularMatches
            .map(f => f.competitionRound?.match(/^Grupo ([A-Z]+) •/)?.[1])
            .filter(Boolean)
        ),
      ] as string[];

      const totalQualifiers = firstLeg1.length * 2;
      const pairs: [number, number][] = [];

      if (groupLabels.length >= 2) {
        const standingsMap = new Map(natStandings.map(r => [r.clubId, r]));
        const perGroup = Math.max(1, Math.floor(totalQualifiers / groupLabels.length));
        const qualifiedByGroup = groupLabels.map(letter => {
          const grpMatches = regularMatches.filter(f => f.competitionRound?.startsWith(`Grupo ${letter} •`));
          const ids = [...new Set(grpMatches.flatMap(f => [f.homeClubId, f.awayClubId]))];
          return ids
            .map(id => standingsMap.get(id)!)
            .filter(Boolean)
            .sort(ranking)
            .slice(0, perGroup)
            .map(r => r.clubId);
        });

        if (qualifiedByGroup.every(g => g.length === perGroup)) {
          for (let i = 0; i + 1 < qualifiedByGroup.length; i += 2) {
            const g1 = qualifiedByGroup[i];
            const g2 = qualifiedByGroup[i + 1];
            for (let m = 0; m < perGroup; m++) {
              pairs.push([g1[m], g2[perGroup - 1 - m]]);
            }
          }
        }
      } else if (natStandings.length >= totalQualifiers) {
        const ranked = [...natStandings].sort(ranking).slice(0, totalQualifiers);
        for (let i = 0; i < firstLeg1.length; i++) {
          pairs.push([ranked[i].clubId, ranked[totalQualifiers - 1 - i].clubId]);
        }
      }

      if (pairs.length === firstLeg1.length) {
        updatePairs(firstLeg1, pairs);
        updatePairs(firstLeg2, pairs.map(([home, away]) => [away, home]));
      }
    }

    for (let sIdx = 0; sIdx + 1 < activeNatPlayoffStages.length; sIdx++) {
      const sourceStage = activeNatPlayoffStages[sIdx];
      const targetStage = activeNatPlayoffStages[sIdx + 1];
      const first = nacional.filter(f => f.stage === sourceStage && f.leg === 1).sort(byId);
      const second = nacional.filter(f => f.stage === sourceStage && f.leg === 2).sort(byId);
      const nextFirst = nacional.filter(f => f.stage === targetStage && f.leg === 1).sort(byId);
      const nextSecond = nacional.filter(f => f.stage === targetStage && f.leg === 2).sort(byId);

      if (first.length === nextFirst.length * 2 && second.length === first.length && second.every(f => f.played)) {
        first.forEach((f, i) => recordAggregateTie(f, second[i]));
        const winners = first.map((f, i) => aggregateWinner(f, calendar.find(x => x.id === second[i].id)!));
        const pairs: [number, number][] = nextFirst.map((_, i) => [winners[2 * i], winners[2 * i + 1]]);
        updatePairs(nextFirst, pairs);
        updatePairs(nextSecond, pairs.map(([home, away]) => [away, home]));
      }
    }

    const natFinalFirst = nacional.find(f => f.stage === 'Final' && f.leg === 1);
    const natFinalSecond = nacional.find(f => f.stage === 'Final' && f.leg === 2);
    if (natFinalFirst?.played && natFinalSecond?.played) {
      recordAggregateTie(natFinalFirst, natFinalSecond);
    }
  }

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
  if (quartersFirst.length >= 2 && quartersFirst.every(f => f.pendingQualification)) {
    const groupLabels = [...new Set(continental.map(f => f.competitionRound?.match(/^Grupo ([A-Z]+) •/)?.[1]).filter(Boolean))] as string[];
    const groups = groupLabels.map(letter => continental.filter(f => f.competitionRound?.startsWith(`Grupo ${letter} •`)));
    if (groups.length >= 2 && groups.every(group => group.length > 0 && group.every(f => f.played))) {
      const standings = new Map((state.standingsContinental || []).map(row => [row.clubId, row]));
      const qualified = groups.map(group => {
        const ids = [...new Set(group.flatMap(f => [f.homeClubId, f.awayClubId]))];
        return ids.map(id => standings.get(id)!).filter(Boolean).sort(ranking).slice(0, 2).map(row => row.clubId);
      });
      if (qualified.length >= 2 && qualified.every(group => group.length === 2)) {
        const pairs: [number, number][] = [];
        for (let i = 0; i + 1 < qualified.length; i += 2) {
          pairs.push([qualified[i][0], qualified[i + 1][1]], [qualified[i + 1][0], qualified[i][1]]);
        }
        if (pairs.length !== quartersFirst.length) return calendar === state.calendar ? state : { ...state, calendar };
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
