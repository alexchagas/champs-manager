import type { GameState, MatchFixture, ChampionshipRecord, StandingRow } from '../types/index.ts';

function winner(fixture: MatchFixture): number {
  if ((fixture.homeScore ?? 0) !== (fixture.awayScore ?? 0)) {
    return (fixture.homeScore ?? 0) > (fixture.awayScore ?? 0) ? fixture.homeClubId : fixture.awayClubId;
  }
  const penHome = fixture.penaltyScore?.[0] ?? 0;
  const penAway = fixture.penaltyScore?.[1] ?? 0;
  if (penHome !== penAway) {
    return penHome > penAway ? fixture.homeClubId : fixture.awayClubId;
  }
  return fixture.homeClubId;
}

function aggregateWinner(first: MatchFixture, second: MatchFixture): { winnerId: number; runnerUpId: number; scoreText: string } {
  const homeGoals = (first.homeScore ?? 0) + (second.awayScore ?? 0);
  const awayGoals = (first.awayScore ?? 0) + (second.homeScore ?? 0);
  
  if (homeGoals !== awayGoals) {
    const winId = homeGoals > awayGoals ? first.homeClubId : first.awayClubId;
    const runnerId = winId === first.homeClubId ? first.awayClubId : first.homeClubId;
    return {
      winnerId: winId,
      runnerUpId: runnerId,
      scoreText: `${homeGoals} x ${awayGoals} (Agregado)`
    };
  }
  
  // Shootout tiebreaker
  const penHome = second.penaltyScore?.[0] ?? 0;
  const penAway = second.penaltyScore?.[1] ?? 0;
  const winId = penHome > penAway ? second.homeClubId : second.awayClubId;
  const runnerId = winId === second.homeClubId ? second.awayClubId : second.homeClubId;
  return {
    winnerId: winId,
    runnerUpId: runnerId,
    scoreText: `${homeGoals} x ${awayGoals} (Pên: ${penHome} x ${penAway})`
  };
}

export function getCompetitionPrizeMoney(type: string, isChampion: boolean, isRunnerUp: boolean): number {
  if (type === 'libertadores' || type === 'champions') {
    return isChampion ? 35_000_000 : isRunnerUp ? 15_000_000 : 2_000_000;
  }
  if (type === 'nacional') {
    return isChampion ? 45_000_000 : isRunnerUp ? 25_000_000 : 5_000_000;
  }
  if (type === 'copa') {
    return isChampion ? 30_000_000 : isRunnerUp ? 12_000_000 : 1_500_000;
  }
  if (type === 'sulamericana') {
    return isChampion ? 15_000_000 : isRunnerUp ? 6_000_000 : 1_000_000;
  }
  // Estadual
  return isChampion ? 5_000_000 : isRunnerUp ? 2_000_000 : 500_000;
}

/**
 * Sanitizes championshipHistory by removing any records for tournaments whose final matches
 * have not actually concluded (e.g., if a tournament was prematurely marked complete due to a bug).
 */
export function sanitizePrematureChampionships(state: GameState): GameState {
  if (!state.championshipHistory || state.championshipHistory.length === 0 || !state.calendar) {
    return state;
  }

  const cupMatches = state.calendar.filter(f => f.competitionType === 'copa');
  if (cupMatches.length === 0) return state;

  const isTwoLegged = cupMatches.some(f => f.leg === 1);
  const finals = cupMatches.filter(f => f.stage === 'Final' || (!isTwoLegged && f.round === 4));
  const finalsCompleted = finals.length > 0 && finals.every(f => f.played && f.homeClubId > 0 && f.awayClubId > 0);

  // If Copa matches exist in calendar but the final is not completed, remove any premature copa record for this season
  const hasPrematureCopa = !finalsCompleted && state.championshipHistory.some(r => r.competitionType === 'copa' && r.seasonYear === state.seasonYear);

  if (hasPrematureCopa) {
    return {
      ...state,
      championshipHistory: state.championshipHistory.filter(r => !(r.competitionType === 'copa' && r.seasonYear === state.seasonYear)),
      pendingTournamentConclusion: state.pendingTournamentConclusion?.competitionType === 'copa' ? undefined : state.pendingTournamentConclusion,
    };
  }

  return state;
}

/**
 * Checks which competitions have concluded dynamically by analyzing match fixtures and standings,
 * completely independent of hardcoded calendar week or round numbers.
 */
export function detectNewlyCompletedCompetitions(rawState: GameState): ChampionshipRecord[] {
  const state = sanitizePrematureChampionships(rawState);
  const records: ChampionshipRecord[] = [];
  const existingHistory = state.championshipHistory || [];
  const calendar = state.calendar || [];
  const seasonYear = state.seasonYear;

  const isAlreadyRecorded = (type: string, name: string) => {
    return existingHistory.some(r => r.seasonYear === seasonYear && (r.competitionType === type || r.competitionName === name));
  };

  const getClub = (id: number) => state.clubs.find(c => c.id === id);

  // Helper to determine top scorer in a set of clubs
  const getTopScorer = (clubIds: number[]) => {
    const clubIdSet = new Set(clubIds);
    let topPlayer: { name: string; clubName: string; goals: number } | undefined;
    for (const club of state.clubs) {
      if (!clubIdSet.has(club.id)) continue;
      for (const player of club.squad) {
        if (player.goals > 0 && (!topPlayer || player.goals > topPlayer.goals)) {
          topPlayer = { name: player.name, clubName: club.name, goals: player.goals };
        }
      }
    }
    return topPlayer;
  };

  // 1. ESTADUAL (Knockout final or all matches played)
  const estadualMatches = calendar.filter(f => f.competitionType === 'estadual');
  if (estadualMatches.length > 0) {
    const estadualName = state.stateChampionshipName || estadualMatches[0].competitionName || 'Campeonato Estadual';
    if (!isAlreadyRecorded('estadual', estadualName)) {
      const finalMatch = estadualMatches.find(f => f.stage === 'Final');
      if (finalMatch && finalMatch.played && finalMatch.homeClubId > 0 && finalMatch.awayClubId > 0) {
        const champId = winner(finalMatch);
        const runnerId = champId === finalMatch.homeClubId ? finalMatch.awayClubId : finalMatch.homeClubId;
        const champ = getClub(champId);
        const runner = getClub(runnerId);
        const pen = finalMatch.penaltyScore ? ` (Pên: ${finalMatch.penaltyScore[0]} x ${finalMatch.penaltyScore[1]})` : '';
        const scoreText = `${finalMatch.homeScore} x ${finalMatch.awayScore}${pen}`;
        
        const isUserChamp = champId === state.userClubId;
        const isUserRunner = runnerId === state.userClubId;
        const userPosition = isUserChamp ? 'Campeão 🏆' : isUserRunner ? 'Vice-campeão 🥈' : 'Participante';
        const prize = getCompetitionPrizeMoney('estadual', isUserChamp, isUserRunner);
        const topScorer = getTopScorer(estadualMatches.flatMap(m => [m.homeClubId, m.awayClubId]));

        records.push({
          id: `${seasonYear}-estadual`,
          seasonYear,
          competitionType: 'estadual',
          competitionName: estadualName,
          championClubId: champId,
          championClubName: champ?.name || 'Campeão',
          championClubCrest: champ?.crestMiniUrl || champ?.crestUrl,
          runnerUpClubId: runnerId,
          runnerUpClubName: runner?.name || 'Vice-campeão',
          runnerUpClubCrest: runner?.crestMiniUrl || runner?.crestUrl,
          topScorerName: topScorer?.name,
          topScorerClubName: topScorer?.clubName,
          topScorerGoals: topScorer?.goals,
          finalScoreText: scoreText,
          userPositionText: userPosition,
          userPrizeMoney: isUserChamp || isUserRunner ? prize : undefined,
          managerName: isUserChamp ? state.managerName : undefined,
        });
      }
    }
  }

  // 2. COPA NACIONAL (Two-legged or Single-match Final played)
  const cupMatches = calendar.filter(f => f.competitionType === 'copa');
  if (cupMatches.length > 0) {
    const cupName = cupMatches[0].competitionName || 'Copa do Brasil';
    if (!isAlreadyRecorded('copa', cupName)) {
      const isTwoLegged = cupMatches.some(f => f.leg === 1);
      const finals = cupMatches.filter(f => f.stage === 'Final' || (!isTwoLegged && f.round === 4));

      if (finals.length === 1 && finals[0].played && finals[0].homeClubId > 0 && finals[0].awayClubId > 0) {
        // Single-match final
        const finalMatch = finals[0];
        const champId = winner(finalMatch);
        const runnerId = champId === finalMatch.homeClubId ? finalMatch.awayClubId : finalMatch.homeClubId;
        const champ = getClub(champId);
        const runner = getClub(runnerId);
        const pen = finalMatch.penaltyScore ? ` (Pên: ${finalMatch.penaltyScore[0]} x ${finalMatch.penaltyScore[1]})` : '';
        const scoreText = `${finalMatch.homeScore} x ${finalMatch.awayScore}${pen}`;

        const isUserChamp = champId === state.userClubId;
        const isUserRunner = runnerId === state.userClubId;
        const userPosition = isUserChamp ? 'Campeão 🏆' : isUserRunner ? 'Vice-campeão 🥈' : 'Eliminado';
        const prize = getCompetitionPrizeMoney('copa', isUserChamp, isUserRunner);
        const topScorer = getTopScorer(cupMatches.flatMap(m => [m.homeClubId, m.awayClubId]));

        records.push({
          id: `${seasonYear}-copa`,
          seasonYear,
          competitionType: 'copa',
          competitionName: cupName,
          championClubId: champId,
          championClubName: champ?.name || 'Campeão',
          championClubCrest: champ?.crestMiniUrl || champ?.crestUrl,
          runnerUpClubId: runnerId,
          runnerUpClubName: runner?.name || 'Vice-campeão',
          runnerUpClubCrest: runner?.crestMiniUrl || runner?.crestUrl,
          topScorerName: topScorer?.name,
          topScorerClubName: topScorer?.clubName,
          topScorerGoals: topScorer?.goals,
          finalScoreText: scoreText,
          userPositionText: userPosition,
          userPrizeMoney: isUserChamp || isUserRunner ? prize : undefined,
          managerName: isUserChamp ? state.managerName : undefined,
        });
      } else if (finals.length >= 2 && finals[0].played && finals[1].played && finals[0].homeClubId > 0 && finals[1].homeClubId > 0) {
        // Two-legged final (Ida e Volta)
        const leg1 = finals.find(f => f.leg === 1) || finals[0];
        const leg2 = finals.find(f => f.leg === 2) || finals[1];
        const { winnerId, runnerUpId, scoreText } = aggregateWinner(leg1, leg2);
        const champ = getClub(winnerId);
        const runner = getClub(runnerUpId);

        const isUserChamp = winnerId === state.userClubId;
        const isUserRunner = runnerUpId === state.userClubId;
        const userPosition = isUserChamp ? 'Campeão 🏆' : isUserRunner ? 'Vice-campeão 🥈' : 'Eliminado';
        const prize = getCompetitionPrizeMoney('copa', isUserChamp, isUserRunner);
        const topScorer = getTopScorer(cupMatches.flatMap(m => [m.homeClubId, m.awayClubId]));

        records.push({
          id: `${seasonYear}-copa`,
          seasonYear,
          competitionType: 'copa',
          competitionName: cupName,
          championClubId: winnerId,
          championClubName: champ?.name || 'Campeão',
          championClubCrest: champ?.crestMiniUrl || champ?.crestUrl,
          runnerUpClubId: runnerUpId,
          runnerUpClubName: runner?.name || 'Vice-campeão',
          runnerUpClubCrest: runner?.crestMiniUrl || runner?.crestUrl,
          topScorerName: topScorer?.name,
          topScorerClubName: topScorer?.clubName,
          topScorerGoals: topScorer?.goals,
          finalScoreText: scoreText,
          userPositionText: userPosition,
          userPrizeMoney: isUserChamp || isUserRunner ? prize : undefined,
          managerName: isUserChamp ? state.managerName : undefined,
        });
      }
    }
  }

  // 3. CONTINENTAL (Libertadores / Champions / Sulamericana)
  const continentalTypes = ['libertadores', 'sulamericana', 'champions'] as const;
  for (const cType of continentalTypes) {
    const cMatches = calendar.filter(f => f.competitionType === cType);
    if (cMatches.length === 0) {
      const parallelComp = state.continentalCompetitions?.find(c => {
        if (cType === 'sulamericana') return c.leagueName.includes('Sul-Americana');
        if (cType === 'libertadores') return c.leagueName.includes('Libertadores');
        if (cType === 'champions') return c.leagueName.includes('Champions');
        return false;
      });
      if (parallelComp && parallelComp.standings.length >= 2) {
        const allNationalPlayed = calendar.filter(f => f.competitionType === 'nacional').every(f => f.played);
        if (parallelComp.currentRound >= parallelComp.totalRounds || allNationalPlayed) {
          const cName = parallelComp.leagueName;
          if (!isAlreadyRecorded(cType, cName)) {
            const sorted = [...parallelComp.standings].sort(
              (a, b) => b.points - a.points || b.won - a.won || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor
            );
            const champRow = sorted[0];
            const runnerRow = sorted[1];
            const champ = getClub(champRow.clubId);
            const runner = getClub(runnerRow.clubId);
            const isUserChamp = champRow.clubId === state.userClubId;
            const isUserRunner = runnerRow.clubId === state.userClubId;
            const userPosition = isUserChamp ? 'Campeão 🏆' : isUserRunner ? 'Vice-campeão 🥈' : 'Participante';
            const prize = getCompetitionPrizeMoney(cType, isUserChamp, isUserRunner);

            records.push({
              id: `${seasonYear}-${cType}`,
              seasonYear,
              competitionType: cType,
              competitionName: cName,
              championClubId: champRow.clubId,
              championClubName: champ?.name || champRow.clubName,
              championClubCrest: champ?.crestMiniUrl || champ?.crestUrl,
              runnerUpClubId: runnerRow.clubId,
              runnerUpClubName: runner?.name || runnerRow.clubName,
              runnerUpClubCrest: runner?.crestMiniUrl || runner?.crestUrl,
              finalScoreText: `${champRow.points} pts`,
              userPositionText: userPosition,
              userPrizeMoney: isUserChamp || isUserRunner ? prize : undefined,
              managerName: isUserChamp ? state.managerName : undefined,
            });
          }
        }
      }
      continue;
    }
    const cName = state.continentalCupName || cMatches[0].competitionName || (cType === 'champions' ? 'UEFA Champions League' : 'Copa Libertadores');
    if (isAlreadyRecorded(cType, cName)) continue;

    const finals = cMatches.filter(f => f.stage === 'Final');
    if (finals.length === 1 && finals[0].played) {
      // Single-match final
      const finalMatch = finals[0];
      const champId = winner(finalMatch);
      const runnerId = champId === finalMatch.homeClubId ? finalMatch.awayClubId : finalMatch.homeClubId;
      const champ = getClub(champId);
      const runner = getClub(runnerId);
      const pen = finalMatch.penaltyScore ? ` (Pên: ${finalMatch.penaltyScore[0]} x ${finalMatch.penaltyScore[1]})` : '';
      const scoreText = `${finalMatch.homeScore} x ${finalMatch.awayScore}${pen}`;

      const isUserChamp = champId === state.userClubId;
      const isUserRunner = runnerId === state.userClubId;
      const userPosition = isUserChamp ? 'Campeão 🏆' : isUserRunner ? 'Vice-campeão 🥈' : 'Participante';
      const prize = getCompetitionPrizeMoney(cType, isUserChamp, isUserRunner);
      const topScorer = getTopScorer(cMatches.flatMap(m => [m.homeClubId, m.awayClubId]));

      records.push({
        id: `${seasonYear}-${cType}`,
        seasonYear,
        competitionType: cType,
        competitionName: cName,
        championClubId: champId,
        championClubName: champ?.name || 'Campeão',
        championClubCrest: champ?.crestMiniUrl || champ?.crestUrl,
        runnerUpClubId: runnerId,
        runnerUpClubName: runner?.name || 'Vice-campeão',
        runnerUpClubCrest: runner?.crestMiniUrl || runner?.crestUrl,
        topScorerName: topScorer?.name,
        topScorerClubName: topScorer?.clubName,
        topScorerGoals: topScorer?.goals,
        finalScoreText: scoreText,
        userPositionText: userPosition,
        userPrizeMoney: isUserChamp || isUserRunner ? prize : undefined,
        managerName: isUserChamp ? state.managerName : undefined,
      });
    } else if (finals.length >= 2 && finals[0].played && finals[1].played) {
      // Two-legged final
      const leg1 = finals.find(f => f.leg === 1) || finals[0];
      const leg2 = finals.find(f => f.leg === 2) || finals[1];
      const { winnerId, runnerUpId, scoreText } = aggregateWinner(leg1, leg2);
      const champ = getClub(winnerId);
      const runner = getClub(runnerUpId);

      const isUserChamp = winnerId === state.userClubId;
      const isUserRunner = runnerUpId === state.userClubId;
      const userPosition = isUserChamp ? 'Campeão 🏆' : isUserRunner ? 'Vice-campeão 🥈' : 'Participante';
      const prize = getCompetitionPrizeMoney(cType, isUserChamp, isUserRunner);
      const topScorer = getTopScorer(cMatches.flatMap(m => [m.homeClubId, m.awayClubId]));

      records.push({
        id: `${seasonYear}-${cType}`,
        seasonYear,
        competitionType: cType,
        competitionName: cName,
        championClubId: winnerId,
        championClubName: champ?.name || 'Campeão',
        championClubCrest: champ?.crestMiniUrl || champ?.crestUrl,
        runnerUpClubId: runnerUpId,
        runnerUpClubName: runner?.name || 'Vice-campeão',
        runnerUpClubCrest: runner?.crestMiniUrl || runner?.crestUrl,
        topScorerName: topScorer?.name,
        topScorerClubName: topScorer?.clubName,
        topScorerGoals: topScorer?.goals,
        finalScoreText: scoreText,
        userPositionText: userPosition,
        userPrizeMoney: isUserChamp || isUserRunner ? prize : undefined,
        managerName: isUserChamp ? state.managerName : undefined,
      });
    }
  }

  // 4. CAMPEONATO NACIONAL (League / Points or Groups + Playoffs)
  const nationalMatches = calendar.filter(f => f.competitionType === 'nacional');
  if (nationalMatches.length > 0) {
    const nationalName = state.nationalLeagueName || state.leagueName || 'Campeonato Nacional';
    if (!isAlreadyRecorded('nacional', nationalName)) {
      const natFinals = nationalMatches.filter(f => f.stage === 'Final');
      const allNationalPlayed = nationalMatches.every(f => f.played);
      if (natFinals.length >= 2 && natFinals.every(f => f.played && f.homeClubId > 0 && f.awayClubId > 0)) {
        const leg1 = natFinals.find(f => f.leg === 1) || natFinals[0];
        const leg2 = natFinals.find(f => f.leg === 2) || natFinals[1];
        const { winnerId, runnerUpId, scoreText } = aggregateWinner(leg1, leg2);
        const champ = getClub(winnerId);
        const runner = getClub(runnerUpId);
        const isUserChamp = winnerId === state.userClubId;
        const isUserRunner = runnerUpId === state.userClubId;
        const userPosition = isUserChamp ? 'Campeão 🏆' : isUserRunner ? 'Vice-campeão 🥈' : 'Participante';
        const prize = getCompetitionPrizeMoney('nacional', isUserChamp, isUserRunner);
        const topScorer = getTopScorer(nationalMatches.flatMap(m => [m.homeClubId, m.awayClubId]));

        records.push({
          id: `${seasonYear}-nacional`,
          seasonYear,
          competitionType: 'nacional',
          competitionName: nationalName,
          championClubId: winnerId,
          championClubName: champ?.name || 'Campeão',
          championClubCrest: champ?.crestMiniUrl || champ?.crestUrl,
          runnerUpClubId: runnerUpId,
          runnerUpClubName: runner?.name || 'Vice-campeão',
          runnerUpClubCrest: runner?.crestMiniUrl || runner?.crestUrl,
          topScorerName: topScorer?.name,
          topScorerClubName: topScorer?.clubName,
          topScorerGoals: topScorer?.goals,
          finalScoreText: scoreText,
          userPositionText: userPosition,
          userPrizeMoney: isUserChamp || isUserRunner ? prize : undefined,
          managerName: isUserChamp ? state.managerName : undefined,
        });
      } else if (natFinals.length === 0 && allNationalPlayed) {
        const standings = state.standingsNacional || state.standings || [];
        if (standings.length >= 2) {
          const champRow = standings[0];
          const runnerRow = standings[1];
          const champ = getClub(champRow.clubId);
          const runner = getClub(runnerRow.clubId);

          const userRank = standings.findIndex(s => s.clubId === state.userClubId) + 1;
          const isUserChamp = champRow.clubId === state.userClubId;
          const isUserRunner = runnerRow.clubId === state.userClubId;
          const userPosition = isUserChamp ? 'Campeão 🏆' : `${userRank}º Lugar`;
          const prize = getCompetitionPrizeMoney('nacional', isUserChamp, isUserRunner);
          const topScorer = getTopScorer(standings.map(s => s.clubId));

          records.push({
            id: `${seasonYear}-nacional`,
            seasonYear,
            competitionType: 'nacional',
            competitionName: nationalName,
            championClubId: champRow.clubId,
            championClubName: champ?.name || champRow.clubName,
            championClubCrest: champ?.crestMiniUrl || champ?.crestUrl,
            runnerUpClubId: runnerRow.clubId,
            runnerUpClubName: runner?.name || runnerRow.clubName,
            runnerUpClubCrest: runner?.crestMiniUrl || runner?.crestUrl,
            topScorerName: topScorer?.name,
            topScorerClubName: topScorer?.clubName,
            topScorerGoals: topScorer?.goals,
            finalScoreText: `${champRow.points} pts`,
            userPositionText: userPosition,
            userPrizeMoney: isUserChamp || isUserRunner ? prize : Math.max(1_000_000, 20_000_000 - userRank * 1_000_000),
            managerName: isUserChamp ? state.managerName : undefined,
          });
        }
      }
    }
  }

  return records;
}

/**
 * Returns true if the entire season calendar is complete.
 * Agnostic of total dates/rounds.
 */
export function isSeasonComplete(state: GameState): boolean {
  if (!state.calendar || state.calendar.length === 0) return false;
  return state.calendar.every(f => f.played);
}
