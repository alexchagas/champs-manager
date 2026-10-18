import type { Club, GameState, MatchFixture, StandingRow } from '../types/index.ts';
import { computeSeasonMobility } from './sportsMobility.ts';
import { computeContinentalQualifiers } from '../data/continentalRepresentatives.ts';
import { getCompetitionClubs } from '../data/teamsDatabase.ts';
import {
  generateTwoSemesterCalendar,
  initializeContinentalStandings,
  initializeEstadualStandings,
  initializeNacionalStandings,
  sortStandings,
} from '../data/calendarGenerator.ts';
import { rolloverManagers, scoreManagers, changeManagers } from './careerEconomy.ts';
import {
  buildInitialActiveOtherLeagues,
  buildInitialContinentalCompetitions,
  buildInitialNationalDivisions,
  buildInitialStateDivisions,
  advanceOtherLeaguesProgress,
} from './crossSeasonSimulation.ts';
import { prunePreviousSeasonData, getGameStateMetrics } from './dataPruning.ts';
import { detectNewlyCompletedCompetitions, isSeasonComplete } from './tournamentCompletion.ts';
import { createChampionshipNews } from './newsEngine.ts';
import {
  initializeNationalTeams,
  isWorldCupYear,
  isSuperClubWorldCupYear,
  isIntercontinentalYear,
  createWorldCupTournament,
  createSuperClubWorldCup,
  createIntercontinentalCup,
  getAvailableNationalTeamOffers,
  evaluateUserSquadCallups,
} from '../data/nationalTeamsData.ts';

export interface SeasonTelemetry {
  seasonYear: number;
  userDivision: number;
  userClubName: string;
  titlesWon: number;
  uncompressedKb: number;
  compressedKb: number;
  isUnder2MB: boolean;
  activeClubsCount: number;
  managersCount: number;
}

/**
 * Simula uma única partida em modo rápido (Fast Simulation) de forma determinística e balanceada.
 */
export function fastSimulateFixture(fixture: MatchFixture, clubsMap: Map<number, Club>, seed = 42): MatchFixture {
  if (fixture.played) return fixture;

  const home = clubsMap.get(fixture.homeClubId);
  const away = clubsMap.get(fixture.awayClubId);

  if (!home || !away) {
    return {
      ...fixture,
      homeScore: 1,
      awayScore: 0,
      played: true,
    };
  }

  const homeStrength = home.squad && home.squad.length
    ? home.squad.reduce((s, p) => s + p.strength, 0) / home.squad.length
    : 70;
  const awayStrength = away.squad && away.squad.length
    ? away.squad.reduce((s, p) => s + p.strength, 0) / away.squad.length
    : 70;

  // Gerador determinístico baseado no ID do fixture e seed
  const r1 = Math.sin(fixture.id * 12.9898 + seed * 78.233) * 43758.5453;
  const rand1 = r1 - Math.floor(r1);
  const r2 = Math.sin((fixture.id + 100) * 12.9898 + seed * 78.233) * 43758.5453;
  const rand2 = r2 - Math.floor(r2);

  const homeAdvantage = 1.08;
  const diff = (homeStrength * homeAdvantage - awayStrength) / 20;

  let homeGoals = Math.max(0, Math.floor(rand1 * 3.5 + Math.max(-0.5, diff)));
  let awayGoals = Math.max(0, Math.floor(rand2 * 3.0 - Math.min(0.5, diff)));

  let penaltyScore: [number, number] | undefined = undefined;
  if (fixture.matchRules?.shootout && homeGoals === awayGoals) {
    const penHome = rand1 > rand2 ? 5 : 4;
    const penAway = penHome === 5 ? 4 : 5;
    penaltyScore = [penHome, penAway];
  }

  return {
    ...fixture,
    homeScore: homeGoals,
    awayScore: awayGoals,
    penaltyScore,
    played: true,
  };
}

/**
 * Atualiza uma tabela de classificação (StandingRow[]) com os resultados de partidas jogadas.
 */
function updateStandingsWithFixtures(standings: StandingRow[], playedFixtures: MatchFixture[]): StandingRow[] {
  const standingsMap = new Map<number, StandingRow>();
  for (const s of standings) {
    standingsMap.set(s.clubId, { ...s, form: [...(s.form || [])] });
  }

  for (const f of playedFixtures) {
    if (!f.played || f.homeScore === undefined || f.awayScore === undefined) continue;

    const home = standingsMap.get(f.homeClubId);
    const away = standingsMap.get(f.awayClubId);

    if (home) {
      home.played += 1;
      home.goalsFor += f.homeScore;
      home.goalsAgainst += f.awayScore;
      home.goalDiff = home.goalsFor - home.goalsAgainst;

      if (f.homeScore > f.awayScore) {
        home.won += 1;
        home.points += 3;
        home.form.push('V');
      } else if (f.homeScore === f.awayScore) {
        home.drawn += 1;
        home.points += 1;
        home.form.push('E');
      } else {
        home.lost += 1;
        home.form.push('D');
      }
      if (home.form.length > 5) home.form.shift();
    }

    if (away) {
      away.played += 1;
      away.goalsFor += f.awayScore;
      away.goalsAgainst += f.homeScore;
      away.goalDiff = away.goalsFor - away.goalsAgainst;

      if (f.awayScore > f.homeScore) {
        away.won += 1;
        away.points += 3;
        away.form.push('V');
      } else if (f.homeScore === f.awayScore) {
        away.drawn += 1;
        away.points += 1;
        away.form.push('E');
      } else {
        away.lost += 1;
        away.form.push('D');
      }
      if (away.form.length > 5) away.form.shift();
    }
  }

  return sortStandings(Array.from(standingsMap.values()));
}

/**
 * Executa a virada canônica de temporada (Season Rollover) com mobilidade esportiva,
 * qualificação continental, recomposição de pirâmides e data pruning.
 */
export function executeSeasonRollover(state: GameState): GameState {
  const nextYear = state.seasonYear + 1;

  // 1. Mobilidade desportiva canônica
  const mobility = computeSeasonMobility(state);
  let updatedClubs = mobility.updatedClubs;
  const updatedUserClub = updatedClubs.find((c) => c.id === state.userClubId) || updatedClubs[0];

  // 2. Clubes da divisão do usuário
  const userDivision = (updatedUserClub.division ?? 1) >= 5 && (updatedUserClub.countryId ?? 29) === 29
    ? 4
    : (updatedUserClub.division ?? 1);
  let nationalClubs = updatedClubs.filter(
    (c) => c.countryId === (updatedUserClub.countryId ?? 29) && c.division === userDivision
  );
  if (nationalClubs.length < 2) {
    nationalClubs = getCompetitionClubs(updatedUserClub.id, updatedClubs).competitionClubs;
  }

  // 3. Qualificações continentais
  const serieAStandings =
    (updatedUserClub.countryId ?? 29) === 29 && userDivision === 1
      ? state.standingsNacional
      : state.nationalDivisions?.find((d) => d.countryId === 29 && d.division === 1)?.standings;
  const seasonRecords = (state.championshipHistory || []).filter((r) => r.seasonYear === state.seasonYear);
  const qualifiers = computeContinentalQualifiers(updatedClubs, serieAStandings, seasonRecords);

  // 4. State overrides
  const stateOverrides = {
    promotedStateClubIds: mobility.nextPromotedStateClubIds,
    relegatedStateClubIds: mobility.nextRelegatedStateClubIds,
  };

  const next = generateTwoSemesterCalendar(
    updatedUserClub,
    nationalClubs,
    updatedClubs,
    nextYear,
    {
      qualifiedLibertadoresIds: qualifiers.libertadoresClubIds,
      qualifiedPreLibertadoresIds: qualifiers.preLibertadoresClubIds,
      qualifiedSulAmericanaIds: qualifiers.sulAmericanaClubIds,
    },
    stateOverrides
  );

  const rolled = rolloverManagers(state);

  // Tournaments quadrienais
  const nationalTeams = initializeNationalTeams(updatedClubs);
  const worldCup = isWorldCupYear(nextYear) ? createWorldCupTournament(nextYear, nationalTeams) : undefined;
  const superClubWorldCup = isSuperClubWorldCupYear(nextYear) ? createSuperClubWorldCup(nextYear, updatedClubs) : undefined;
  const intercontinentalCup = isIntercontinentalYear(nextYear) ? createIntercontinentalCup(nextYear, updatedClubs) : undefined;
  const human = rolled.managers?.find((m) => m.id === rolled.humanManagerId) || { id: 'human-1', name: state.managerName, reputation: 1, titles: [] } as any;
  const nationalTeamOffers = isWorldCupYear(nextYear) ? getAvailableNationalTeamOffers(human, nextYear, nationalTeams) : undefined;
  const { callups, newsArticles: callupNews } = isWorldCupYear(nextYear) ? evaluateUserSquadCallups(updatedUserClub, nextYear, nationalTeams) : { callups: [], newsArticles: [] };

  const nextNationalDivisions = buildInitialNationalDivisions(updatedUserClub, updatedClubs, nextYear);
  const nextOtherLeagues = buildInitialActiveOtherLeagues(updatedUserClub, state.activeCountryIds || [], updatedClubs, nextYear);
  const nextStateDivisions = buildInitialStateDivisions(
    updatedUserClub,
    updatedClubs,
    nextYear,
    mobility.nextPromotedStateClubIds,
    mobility.nextRelegatedStateClubIds
  );
  const nextContinentalCompetitions = buildInitialContinentalCompetitions(updatedUserClub, updatedClubs, nextYear, {
    qualifiedLibertadoresIds: qualifiers.libertadoresClubIds,
    qualifiedPreLibertadoresIds: qualifiers.preLibertadoresClubIds,
    qualifiedSulAmericanaIds: qualifiers.sulAmericanaClubIds,
  });

  const nextSeasonRaw: GameState = {
    ...rolled,
    clubs: updatedClubs,
    activeMatch: undefined,
    activeMatchFixtureId: undefined,
    seasonYear: nextYear,
    currentRound: 1,
    currentSemester: 1,
    calendar: next.calendar,
    stateTier: next.estadualTier ?? mobility.userNewStateTier ?? 1,
    promotedStateClubIds: mobility.nextPromotedStateClubIds,
    relegatedStateClubIds: mobility.nextRelegatedStateClubIds,
    standings: sortStandings(initializeEstadualStandings(updatedUserClub, next.semester1Clubs, next.estadualTier)),
    standingsEstadual: sortStandings(initializeEstadualStandings(updatedUserClub, next.semester1Clubs, next.estadualTier)),
    standingsNacional: sortStandings(initializeNacionalStandings(updatedUserClub, next.semester2Clubs)),
    standingsContinental: sortStandings(initializeContinentalStandings(next.continentalClubs)),
    nationalDivisions: nextNationalDivisions,
    stateDivisions: nextStateDivisions,
    continentalCompetitions: nextContinentalCompetitions,
    otherLeagues: nextOtherLeagues,
    stateChampionshipName: next.estadualName,
    nationalLeagueName: next.nacionalName,
    continentalCupName: next.continentalName,
    activeScreen: 'overview',
    transferOffers: [],
    worldCup,
    superClubWorldCup,
    intercontinentalCup,
    nationalTeamOffers,
    nationalCallups: callups,
    newsFeed: [...mobility.newsArticles, ...callupNews, ...(rolled.newsFeed || [])],
  };

  return prunePreviousSeasonData(nextSeasonRaw, mobility);
}

/**
 * Avança 1 rodada completa do universo ativo em modo headless (< 20ms).
 */
export function simulateRoundHeadless(state: GameState, seed = 42): GameState {
  const currentSlot = state.currentRound;
  const clubsMap = new Map(state.clubs.map((c) => [c.id, c]));

  // 1. Simula todas as partidas do slot/rodada atual no calendário
  const roundFixtures = state.calendar.filter(
    (f) => (f.fixtureDateIndex ?? f.round) === currentSlot && !f.played && f.homeClubId > 0 && f.awayClubId > 0
  );

  const playedRoundFixtures = roundFixtures.map((f) => fastSimulateFixture(f, clubsMap, seed + currentSlot));
  const playedFixtureMap = new Map(playedRoundFixtures.map((f) => [f.id, f]));

  const updatedCalendar = state.calendar.map((f) => playedFixtureMap.get(f.id) || f);

  // 2. Atualiza tabelas de classificação com os novos resultados
  const compType = roundFixtures[0]?.competitionType;
  let standingsEstadual = state.standingsEstadual;
  let standingsNacional = state.standingsNacional;
  let standingsContinental = state.standingsContinental;

  if (compType === 'estadual' && standingsEstadual) {
    standingsEstadual = updateStandingsWithFixtures(standingsEstadual, playedRoundFixtures);
  } else if (compType === 'nacional' && standingsNacional) {
    standingsNacional = updateStandingsWithFixtures(standingsNacional, playedRoundFixtures);
  } else if (compType === 'libertadores' || compType === 'sulamericana') {
    if (standingsContinental) {
      standingsContinental = updateStandingsWithFixtures(standingsContinental, playedRoundFixtures);
    }
  }

  const nextSemester: 1 | 2 = compType === 'estadual' ? 1 : 2;
  const activeStandings = nextSemester === 1 ? (standingsEstadual || state.standings) : (standingsNacional || state.standings);

  // 3. Avança ligas paralelas concorrentes proporcionalmente
  const maxSlot = Math.max(...updatedCalendar.map((f) => f.fixtureDateIndex ?? f.round), 1);
  const progressRatio = Math.min(1.0, currentSlot / maxSlot);
  const isMainBrazil = (clubsMap.get(state.userClubId)?.countryId || 29) === 29;

  const advanceContext = {
    currentSemester: nextSemester,
    currentRound: currentSlot,
    totalRounds: maxSlot,
  };

  const updatedNationalDivisions = state.nationalDivisions && state.nationalDivisions.length > 0
    ? advanceOtherLeaguesProgress(state.nationalDivisions, progressRatio, state.clubs, isMainBrazil, advanceContext)
    : state.nationalDivisions;

  const updatedStateDivisions = state.stateDivisions && state.stateDivisions.length > 0
    ? advanceOtherLeaguesProgress(state.stateDivisions, progressRatio, state.clubs, true, advanceContext)
    : state.stateDivisions;

  const updatedContinentalCompetitions = state.continentalCompetitions && state.continentalCompetitions.length > 0
    ? advanceOtherLeaguesProgress(state.continentalCompetitions, progressRatio, state.clubs, true, advanceContext)
    : state.continentalCompetitions;

  const updatedOtherLeagues = state.otherLeagues && state.otherLeagues.length > 0
    ? advanceOtherLeaguesProgress(state.otherLeagues, progressRatio, state.clubs, isMainBrazil, advanceContext)
    : state.otherLeagues;

  // 4. Pontuação e demissão global de treinadores
  const stateBeforeManagers = {
    ...state,
    calendar: updatedCalendar,
    standings: activeStandings,
    standingsEstadual,
    standingsNacional,
    standingsContinental,
    nationalDivisions: updatedNationalDivisions,
    stateDivisions: updatedStateDivisions,
    continentalCompetitions: updatedContinentalCompetitions,
    otherLeagues: updatedOtherLeagues,
    currentSemester: nextSemester,
  };

  const scored = scoreManagers(stateBeforeManagers, playedRoundFixtures);
  const { state: managed } = changeManagers(scored);

  // 5. Detecta conclusão dinâmica de campeonatos
  const newlyCompleted = detectNewlyCompletedCompetitions(managed);
  let updatedHistory = managed.championshipHistory || [];
  if (newlyCompleted.length > 0) {
    updatedHistory = [...updatedHistory, ...newlyCompleted];
  }

  // 6. Avanço de rodada ou conclusão de temporada
  const isComplete = updatedCalendar.every((f) => f.played) || currentSlot >= maxSlot;

  if (isComplete) {
    const finalSeasonState: GameState = {
      ...managed,
      championshipHistory: updatedHistory,
    };
    return executeSeasonRollover(finalSeasonState);
  }

  return {
    ...managed,
    currentRound: currentSlot + 1,
    championshipHistory: updatedHistory,
  };
}

/**
 * Simula múltiplas temporadas de forma headless com telemetria e validação de invariantes.
 */
export async function simulateHeadlessSeasons(
  initialState: GameState,
  seasonsCount: number,
  onSeasonComplete?: (telemetry: SeasonTelemetry, state: GameState) => void
): Promise<{ finalState: GameState; telemetryLog: SeasonTelemetry[] }> {
  let state = initialState;
  const telemetryLog: SeasonTelemetry[] = [];
  const targetYear = state.seasonYear + seasonsCount;

  while (state.seasonYear < targetYear) {
    const startYear = state.seasonYear;

    // Simula as rodadas da temporada até a virada de ano
    while (state.seasonYear === startYear) {
      state = simulateRoundHeadless(state, state.seasonYear * 100 + state.currentRound);
    }

    // Coleta telemetria no encerramento da temporada
    const metrics = await getGameStateMetrics(state);
    const userClub = state.clubs.find((c) => c.id === state.userClubId) || state.clubs[0];
    const titlesWon = (state.championshipHistory || []).filter((h) => h.championClubId === state.userClubId).length;

    const telemetry: SeasonTelemetry = {
      seasonYear: startYear,
      userDivision: userClub.division ?? 1,
      userClubName: userClub.name,
      titlesWon,
      uncompressedKb: metrics.uncompressedKb,
      compressedKb: metrics.compressedKb,
      isUnder2MB: metrics.isUnder2MB,
      activeClubsCount: state.clubs.length,
      managersCount: state.managers?.length || 0,
    };

    telemetryLog.push(telemetry);
    if (onSeasonComplete) {
      onSeasonComplete(telemetry, state);
    }
  }

  return { finalState: state, telemetryLog };
}
