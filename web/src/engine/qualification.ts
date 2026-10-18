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
  const cupStageOrder = [
    'Primeira Fase',
    'Segunda Fase',
    'Terceira Fase',
    'Oitavas de Final',
    'Quartas de Final',
    'Semifinal',
    'Final',
  ] as const;
  const activeCupStages = cupStageOrder.filter(st => cup.some(f => f.stage === st));

  if (activeCupStages.length >= 2) {
    // Record aggregate ties on any played two-legged cup stage
    for (const st of activeCupStages) {
      const first = cup.filter(f => f.stage === st && f.leg === 1).sort(byId);
      const second = cup.filter(f => f.stage === st && f.leg === 2).sort(byId);
      second.forEach((s, idx) => {
        if (s.played) {
          const matchingFirst =
            first.find(f => f.homeClubId === s.awayClubId && f.awayClubId === s.homeClubId) || first[idx];
          if (matchingFirst && matchingFirst.played) {
            recordAggregateTie(matchingFirst, s);
          }
        }
      });
    }

    for (let sIdx = 0; sIdx + 1 < activeCupStages.length; sIdx++) {
      const sourceStage = activeCupStages[sIdx];
      const targetStage = activeCupStages[sIdx + 1];

      const sourceFirst = cup.filter(f => f.stage === sourceStage && f.leg === 1).sort(byId);
      const sourceSecond = cup.filter(f => f.stage === sourceStage && f.leg === 2).sort(byId);
      const isSourceTwoLegged = sourceFirst.length > 0 && sourceSecond.length === sourceFirst.length;
      const sourceSingle = !isSourceTwoLegged ? cup.filter(f => f.stage === sourceStage).sort(byId) : [];

      let winners: number[] = [];
      if (isSourceTwoLegged) {
        if (sourceSecond.every(f => f.played)) {
          winners = sourceFirst.map((f, i) => aggregateWinner(f, calendar.find(x => x.id === sourceSecond[i].id)!));
        }
      } else if (sourceSingle.length > 0 && sourceSingle.every(f => f.played)) {
        sourceSingle.filter(f => f.homeScore === f.awayScore).forEach(f => recordPenalties(f.id, [5, 4]));
        winners = sourceSingle.map(f => winner(calendar.find(x => x.id === f.id)!));
      }

      if (winners.length === 0) continue;

      const nextFirst = cup.filter(f => f.stage === targetStage && f.leg === 1).sort(byId);
      const nextSecond = cup.filter(f => f.stage === targetStage && f.leg === 2).sort(byId);
      const isTargetTwoLegged = nextFirst.length > 0 && nextSecond.length === nextFirst.length;
      const nextSingle = !isTargetTwoLegged ? cup.filter(f => f.stage === targetStage).sort(byId) : [];

      if (isTargetTwoLegged) {
        if (winners.length === nextFirst.length * 2) {
          const pairs: [number, number][] = nextFirst.map((_, i) => [winners[2 * i], winners[2 * i + 1]]);
          updatePairs(nextFirst, pairs);
          updatePairs(nextSecond, pairs.map(([home, away]) => [away, home]));
        } else if (
          winners.length === nextFirst.length &&
          nextFirst.every(f => f.pendingQualification && (f.homeClubId > 0 || f.awayClubId > 0))
        ) {
          // 8 classificados da Terceira Fase enfrentam os 8 pré-classificados da Libertadores/Elite nas Oitavas!
          const pairs: [number, number][] = nextFirst.map((f, i) => {
            const directClubId = f.homeClubId > 0 ? f.homeClubId : f.awayClubId;
            return [directClubId, winners[i]];
          });
          updatePairs(nextFirst, pairs);
          updatePairs(nextSecond, pairs.map(([home, away]) => [away, home]));
        }
      } else if (nextSingle.length > 0 && winners.length === nextSingle.length * 2) {
        const pairs: [number, number][] = nextSingle.map((_, i) => [winners[2 * i], winners[2 * i + 1]]);
        updatePairs(nextSingle, pairs);
      }
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

  let standingsContinental = state.standingsContinental;
  let continentalCompetitions = state.continentalCompetitions;

  const continental = calendar.filter(f => ['libertadores', 'sulamericana', 'champions'].includes(f.competitionType || ''));

  // Fase Preliminar: Pré-Libertadores (2ª Fase -> 3ª Fase -> Fase de Grupos Pote 4 dos Grupos E, F, G e H)
  const preLib2First = continental.filter(f => f.stage === 'Pré-Libertadores (2ª Fase)' && f.leg === 1).sort(byId);
  const preLib2Second = continental.filter(f => f.stage === 'Pré-Libertadores (2ª Fase)' && f.leg === 2).sort(byId);
  const preLib3First = continental.filter(f => f.stage === 'Pré-Libertadores (3ª Fase)' && f.leg === 1).sort(byId);
  const preLib3Second = continental.filter(f => f.stage === 'Pré-Libertadores (3ª Fase)' && f.leg === 2).sort(byId);

  if (
    preLib2First.length === 8 &&
    preLib2Second.length === 8 &&
    preLib3First.length === 4 &&
    preLib3First.every(f => f.pendingQualification) &&
    preLib2Second.every(f => f.played)
  ) {
    preLib2First.forEach((f, i) => recordAggregateTie(f, preLib2Second[i]));
    const winners2 = preLib2First.map((f, i) => aggregateWinner(f, calendar.find(x => x.id === preLib2Second[i].id)!));
    const pairs3: [number, number][] = preLib3First.map((_, i) => [winners2[2 * i], winners2[2 * i + 1]]);
    updatePairs(preLib3First, pairs3);
    updatePairs(preLib3Second, pairs3.map(([home, away]) => [away, home]));
  }

  const contGroupMatches = continental.filter(f => f.competitionRound?.startsWith('Grupo '));
  const anyContGroupPlayed = contGroupMatches.some(f => f.played);

  if (
    preLib3First.length === 4 &&
    preLib3Second.length === 4 &&
    !preLib3First.some(f => f.pendingQualification) &&
    preLib3Second.every(f => f.played) &&
    !anyContGroupPlayed
  ) {
    preLib3First.forEach((f, i) => recordAggregateTie(f, preLib3Second[i]));
    const winners3 = preLib3First.map((f, i) => aggregateWinner(f, calendar.find(x => x.id === preLib3Second[i].id)!));
    const losers3 = preLib3First.map((f, i) => {
      const w = winners3[i];
      return f.homeClubId === w ? f.awayClubId : f.homeClubId;
    });

    const targetGroupLetters = ['E', 'F', 'G', 'H'];
    const placeholderIds = [990001, 990002, 990003, 990004];
    const replacements = new Map<number, number>();

    for (let b = 0; b < 4; b++) {
      const grpLetter = targetGroupLetters[b];
      const bracketClubIds = new Set<number>();
      if (preLib2First.length === 8) {
        bracketClubIds.add(preLib2First[2 * b].homeClubId);
        bracketClubIds.add(preLib2First[2 * b].awayClubId);
        bracketClubIds.add(preLib2First[2 * b + 1].homeClubId);
        bracketClubIds.add(preLib2First[2 * b + 1].awayClubId);
      }
      bracketClubIds.add(preLib3First[b].homeClubId);
      bracketClubIds.add(preLib3First[b].awayClubId);

      const grpFixtures = calendar.filter(f => f.competitionRound?.startsWith(`Grupo ${grpLetter} •`));
      const grpClubIds = [...new Set(grpFixtures.flatMap(f => [f.homeClubId, f.awayClubId]))];
      const placeholderId = placeholderIds[b];
      const currentPreSlotId = grpClubIds.find(id => id === placeholderId || bracketClubIds.has(id)) || placeholderId;
      const winnerId = winners3[b];

      if (currentPreSlotId && currentPreSlotId !== winnerId) {
        replacements.set(currentPreSlotId, winnerId);
      }
      replacements.set(placeholderId, winnerId);
    }

    if (replacements.size > 0) {
      calendar = calendar.map(f => {
        if (!f.competitionRound?.startsWith('Grupo ')) return f;
        const newHome = replacements.get(f.homeClubId) ?? f.homeClubId;
        const newAway = replacements.get(f.awayClubId) ?? f.awayClubId;
        if (newHome === f.homeClubId && newAway === f.awayClubId) return f;
        const isStillPending = (newHome >= 990001 && newHome <= 990004) || (newAway >= 990001 && newAway <= 990004);
        return { ...f, homeClubId: newHome, awayClubId: newAway, pendingQualification: isStillPending };
      });

      if (standingsContinental && standingsContinental.length > 0) {
        const clubsById = new Map(state.clubs.map(c => [c.id, c]));
        standingsContinental = standingsContinental.map(row => {
          const newClubId = replacements.get(row.clubId);
          if (!newClubId) return row;
          const newClub = clubsById.get(newClubId);
          return {
            ...row,
            clubId: newClubId,
            clubName: newClub?.name || `Clube ${newClubId}`,
            primaryColor: newClub?.primaryColor || row.primaryColor,
            points: 0,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDiff: 0,
            form: [],
          };
        });
      }
    }

    // Regra CONMEBOL: Os 4 eliminados na 3ª Fase da Pré-Libertadores transferem-se para a Fase de Grupos da Copa Sul-Americana
    if (continentalCompetitions && continentalCompetitions.length > 0 && losers3.length === 4) {
      const clubsById = new Map(state.clubs.map(c => [c.id, c]));
      continentalCompetitions = continentalCompetitions.map(comp => {
        if (comp.id !== 'continental-sister' || comp.standings.length < 32) return comp;
        const existingIds = new Set(comp.standings.map(r => r.clubId));
        const updatedRows = [...comp.standings];
        const targetGroups = ['E', 'F', 'G', 'H'];
        losers3.forEach((loserId, idx) => {
          if (existingIds.has(loserId)) return;
          const loserClub = clubsById.get(loserId);
          if (!loserClub) return;
          const g = targetGroups[idx];
          const groupRowIndices = updatedRows
            .map((r, rIdx) => (r.group === g ? rIdx : -1))
            .filter(rIdx => rIdx !== -1);
          const replaceIdx = groupRowIndices[groupRowIndices.length - 1];
          if (replaceIdx !== undefined) {
            updatedRows[replaceIdx] = {
              ...updatedRows[replaceIdx],
              clubId: loserClub.id,
              clubName: loserClub.name,
              primaryColor: loserClub.primaryColor || '#10b981',
            };
          }
        });
        return { ...comp, standings: updatedRows };
      });
    }
  }

  // Enquanto nenhum jogo da Fase de Grupos continental foi disputado, garante que jogos da Pré-Libertadores não somem pontos na tabela de grupos
  if (
    !anyContGroupPlayed &&
    standingsContinental &&
    standingsContinental.some(r => r.played > 0 || r.points > 0)
  ) {
    standingsContinental = standingsContinental.map(r => ({
      ...r,
      points: 0,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      form: [],
    }));
  }

  const updatedContinental = calendar.filter(f => ['libertadores', 'sulamericana', 'champions'].includes(f.competitionType || ''));
  const firstContKnockoutStage = updatedContinental.some(f => f.stage === 'Oitavas de Final')
    ? 'Oitavas de Final'
    : 'Quartas de Final';
  const firstContLeg1 = updatedContinental.filter(f => f.stage === firstContKnockoutStage && f.leg === 1).sort(byId);
  const firstContLeg2 = updatedContinental.filter(f => f.stage === firstContKnockoutStage && f.leg === 2).sort(byId);

  if (firstContLeg1.length >= 2 && firstContLeg1.every(f => f.pendingQualification)) {
    const groupLabels = [...new Set(updatedContinental.map(f => f.competitionRound?.match(/^Grupo ([A-Z]+) •/)?.[1]).filter(Boolean))] as string[];
    const groups = groupLabels.map(letter => updatedContinental.filter(f => f.competitionRound?.startsWith(`Grupo ${letter} •`)));
    if (groups.length >= 2 && groups.every(group => group.length > 0 && group.every(f => f.played))) {
      const standings = new Map((standingsContinental || []).map(row => [row.clubId, row]));
      const qualified = groups.map(group => {
        const ids = [...new Set(group.flatMap(f => [f.homeClubId, f.awayClubId]))];
        return ids.map(id => standings.get(id)!).filter(Boolean).sort(ranking).slice(0, 2).map(row => row.clubId);
      });
      if (qualified.length >= 2 && qualified.every(group => group.length === 2)) {
        const pairs: [number, number][] = [];
        for (let i = 0; i + 1 < qualified.length; i += 2) {
          pairs.push([qualified[i][0], qualified[i + 1][1]], [qualified[i + 1][0], qualified[i][1]]);
        }
        if (pairs.length === firstContLeg1.length) {
          updatePairs(firstContLeg1, pairs);
          updatePairs(firstContLeg2, pairs.map(([home, away]) => [away, home]));
        }
      }
    }
  }
  for (const [sourceStage, targetStage] of [
    ['Oitavas de Final', 'Quartas de Final'],
    ['Quartas de Final', 'Semifinal'],
    ['Semifinal', 'Final'],
  ] as const) {
    const first = updatedContinental.filter(f => f.stage === sourceStage && f.leg === 1).sort(byId);
    const second = updatedContinental.filter(f => f.stage === sourceStage && f.leg === 2).sort(byId);
    const nextFirst = updatedContinental.filter(f => f.stage === targetStage && f.leg === 1).sort(byId);
    const nextSecond = updatedContinental.filter(f => f.stage === targetStage && f.leg === 2).sort(byId);
    if (first.length > 0 && nextFirst.length > 0 && first.length === nextFirst.length * 2 && second.every(f => f.played)) {
      first.forEach((f, i) => recordAggregateTie(f, second[i]));
      const winners = first.map((f, i) => aggregateWinner(f, calendar.find(x => x.id === second[i].id)!));
      const pairs: [number, number][] = nextFirst.map((_, i) => [winners[2 * i], winners[2 * i + 1]]);
      updatePairs(nextFirst, pairs);
      updatePairs(nextSecond, pairs.map(([home, away]) => [away, home]));
    }
  }
  const continentalFinalFirst = updatedContinental.find(f => f.stage === 'Final' && f.leg === 1);
  const continentalFinalSecond = updatedContinental.find(f => f.stage === 'Final' && f.leg === 2);
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

  if (
    calendar === state.calendar &&
    standingsContinental === state.standingsContinental &&
    continentalCompetitions === state.continentalCompetitions
  ) {
    return state;
  }
  return {
    ...state,
    calendar,
    standingsContinental,
    continentalCompetitions,
  };
}
