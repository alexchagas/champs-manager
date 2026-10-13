import type { GameState, MatchCommand, MatchFixture } from '../types/index.ts';
import type { BatchSimulationOptions, BatchSimulationProgress } from './types.ts';
import { 
  wasm_match_command, 
  WasmCareerEngine 
} from '../wasm_pkg/champs_core.js';

function executeMatchCommand(state: GameState, command: MatchCommand): GameState {
  const json = wasm_match_command(JSON.stringify(state), JSON.stringify(command));
  const parsed = JSON.parse(json) as GameState;
  return { ...state, ...parsed, options: { ...state.options, ...parsed.options } };
}

function advanceRoundViaWasm(state: GameState): GameState | null {
  try {
    const engine = new WasmCareerEngine(JSON.stringify(state), Date.now() % 100000);
    const updatedStateJson = engine.advance_to_next_round();
    const parsed = JSON.parse(updatedStateJson) as GameState;
    return { ...state, ...parsed };
  } catch {
    return null;
  }
}
import { 
  closeRoundFinances, 
  scoreManagers, 
  changeManagers, 
  runAiMarket, 
  rolloverManagers,
  automaticMatchBench 
} from '../engine/careerEconomy.ts';
import { generateWeeklyNews, createChampionshipNews } from '../engine/newsEngine.ts';
import { resolvePendingFixtures } from '../engine/qualification.ts';
import { detectNewlyCompletedCompetitions } from '../engine/tournamentCompletion.ts';
import { 
  generateTwoSemesterCalendar, 
  initializeStandings, 
  sortStandings 
} from '../data/calendarGenerator.ts';
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

/**
 * Finds user fixture scheduled for the current round date.
 */
function findCurrentRoundUserFixture(state: GameState): MatchFixture | undefined {
  return state.calendar.find(
    (f) =>
      !f.played &&
      !f.pendingQualification &&
      (f.fixtureDateIndex ?? f.round) === state.currentRound &&
      (f.homeClubId === state.userClubId || f.awayClubId === state.userClubId)
  );
}

/**
 * Headlessly plays and finishes an active human match session using Rust wasm commands.
 */
function completeHumanMatchHeadless(
  state: GameState,
  humanFixture: MatchFixture,
  forceUserWinKnockout: boolean
): GameState {
  let s = state;

  // 1. Ensure user has healthy, valid starters and bench
  const userClub = s.clubs.find((c) => c.id === s.userClubId);
  if (userClub) {
    const hasInvalidStarter = userClub.squad.some(
      (p) => p.isStarter && (p.injured || p.suspended)
    );
    const starterCount = userClub.squad.filter((p) => p.isStarter).length;
    if (hasInvalidStarter || starterCount !== 11) {
      try {
        const engine = new WasmCareerEngine(JSON.stringify(s), 42);
        const updatedJson = engine.auto_select_best_lineup(s.userClubId, userClub.tactics?.formation ?? '4-4-2');
        const parsed = JSON.parse(updatedJson) as GameState;
        s = { ...s, clubs: parsed.clubs };
      } catch {
        // Fallback: replace invalid starters directly
        for (const p of userClub.squad) {
          if (p.isStarter && (p.injured || p.suspended)) {
            p.isStarter = false;
            const replacement = userClub.squad.find(
              (r) => !r.isStarter && !r.injured && !r.suspended && r.position === p.position
            ) || userClub.squad.find(
              (r) => !r.isStarter && !r.injured && !r.suspended && (p.position === 'GOL' ? r.position === 'GOL' : r.position !== 'GOL')
            );
            if (replacement) replacement.isStarter = true;
          }
        }
      }
    }

    const freshClub = s.clubs.find((c) => c.id === s.userClubId);
    if (freshClub) {
      freshClub.namedSubstituteIds = automaticMatchBench(freshClub);
    }
  }

  // 2. Start the match if not already active
  if (!s.activeMatch || s.activeMatch.phase === 'committed') {
    s = executeMatchCommand(s, { type: 'start', fixture_id: humanFixture.id });
  }

  // 3. One-shot fast-forward through the match directly in native Rust memory!
  s = executeMatchCommand(s, { type: 'fast_forward' });

  // 4. Force win in knockout if requested
  if (forceUserWinKnockout && s.activeMatch) {
    const active = s.activeMatch;
    const humanSide =
      active.humanSide ??
      (active.teams[0].clubId === s.userClubId ? 0 : active.teams[1].clubId === s.userClubId ? 1 : null);

    if (humanSide !== null) {
      const oppSide = 1 - humanSide;
      const isKnockout =
        active.rules.shootout ||
        !!humanFixture.leg ||
        !!humanFixture.stage?.includes('Final') ||
        !!humanFixture.stage?.includes('Semifinal') ||
        !!humanFixture.stage?.includes('Quartas') ||
        !!humanFixture.stage?.includes('Oitavas') ||
        humanFixture.competitionType === 'copa';

      if (isKnockout) {
        if (humanFixture.leg === 2) {
          const aggUserFirstLeg = humanSide === 0 ? active.rules.aggregate[0] : active.rules.aggregate[1];
          const aggOppFirstLeg = humanSide === 0 ? active.rules.aggregate[1] : active.rules.aggregate[0];
          const currentAggUser = active.score[humanSide] + aggUserFirstLeg;
          const currentAggOpp = active.score[oppSide] + aggOppFirstLeg;
          if (currentAggUser <= currentAggOpp) {
            active.score[humanSide] = Math.max(active.score[humanSide], currentAggOpp - aggUserFirstLeg + 1);
          }
        } else {
          if (active.score[humanSide] <= active.score[oppSide]) {
            active.score[humanSide] = active.score[oppSide] + 2;
          }
        }
      }
    }
  }

  return s;
}

/**
 * Executes a single complete headless round:
 * 1. Simulates matches (human + CPU parallel)
 * 2. Applies finances, managers and standings
 * 3. Resolves pending qualification fixtures
 * 4. Advances calendar to the next round / season rollover
 */
export function executeHeadlessStep(
  state: GameState,
  options?: { forceUserWinKnockout?: boolean }
): GameState {
  const forceWin = options?.forceUserWinKnockout ?? false;
  let current = state;

  // A. Simulate matches for current round
  const userFixture = findCurrentRoundUserFixture(current);
  if (userFixture) {
    current = completeHumanMatchHeadless(current, userFixture, forceWin);
  }

  // B. Commit closed matches or run CPU date
  const closed = executeMatchCommand(current, {
    type: current.activeMatch ? 'commit' : 'complete_cpu_date',
  });

  const fixtures = closed.calendar.filter(
    (f) => (f.fixtureDateIndex ?? f.round) === closed.currentRound && f.played
  );
  const clubs = closeRoundFinances(closed.clubs, fixtures, closed.currentRound);
  const rated = scoreManagers({ ...closed, clubs }, fixtures);
  const { state: managed, dismissals } = changeManagers(rated);

  const completed = closed.activeMatch;
  const injuries = completed
    ? [completed, ...completed.parallelMatches].flatMap((session) =>
        session.teams.flatMap((team) => {
          const club = managed.clubs.find((c) => c.id === team.clubId)!;
          return team.injuredIds.map((id) => ({ club, player: club.squad.find((p) => p.id === id)! }));
        })
      )
    : [];

  const articles = generateWeeklyNews(managed, fixtures, injuries, dismissals);
  const final = resolvePendingFixtures({
    ...managed,
    newsFeed: [...articles, ...(current.newsFeed || [])].slice(0, 40),
    activeScreen: 'overview',
  });

  // C. Detect completed championships
  const newlyCompleted = detectNewlyCompletedCompetitions(final);
  let stateWithTitles = final;
  if (newlyCompleted.length > 0) {
    const history = [...(final.championshipHistory || [])];
    let news = [...(final.newsFeed || [])];
    let currentClubs = [...final.clubs];
    let userBonus = 0;

    for (const record of newlyCompleted) {
      history.push(record);
      const champNews = createChampionshipNews(record, final.currentRound);
      news = [...champNews, ...news];
      if (
        (record.championClubId === final.userClubId || record.runnerUpClubId === final.userClubId) &&
        record.userPrizeMoney
      ) {
        userBonus += record.userPrizeMoney;
      }
    }

    if (userBonus > 0) {
      currentClubs = currentClubs.map((c) =>
        c.id === final.userClubId ? { ...c, balance: c.balance + userBonus } : c
      );
    }

    stateWithTitles = {
      ...final,
      clubs: currentClubs,
      championshipHistory: history,
      newsFeed: news.slice(0, 50),
      pendingTournamentConclusion: newlyCompleted[0],
    };
  }

  // D. Advance round or season rollover
  const lastSlot = Math.max(...stateWithTitles.calendar.map((f) => f.fixtureDateIndex ?? f.round));
  if (stateWithTitles.currentRound >= lastSlot) {
    // Season rollover
    const userClub =
      stateWithTitles.clubs.find((c) => c.id === stateWithTitles.userClubId) || stateWithTitles.clubs[0];
    const nationalIds = new Set(stateWithTitles.standingsNacional?.map((row) => row.clubId));
    const nationalClubs = stateWithTitles.clubs.filter((c) => nationalIds.has(c.id));
    const nextYear = stateWithTitles.seasonYear + 1;
    const next = generateTwoSemesterCalendar(userClub, nationalClubs, stateWithTitles.clubs, nextYear);
    const rolled = rolloverManagers(stateWithTitles);

    let updatedClubs = rolled.clubs;
    if (stateWithTitles.nationalCallups && stateWithTitles.nationalCallups.length > 0) {
      const callupMap = new Map(stateWithTitles.nationalCallups.map((c) => [c.playerId, c.boostedMarketValue]));
      updatedClubs = rolled.clubs.map((c) => ({
        ...c,
        squad: c.squad.map((p) => {
          const boosted = callupMap.get(p.id);
          return boosted ? { ...p, marketValue: boosted } : p;
        }),
      }));
    }

    const nationalTeams = initializeNationalTeams(updatedClubs);
    const worldCup = isWorldCupYear(nextYear) ? createWorldCupTournament(nextYear, nationalTeams) : undefined;
    const superClubWorldCup = isSuperClubWorldCupYear(nextYear)
      ? createSuperClubWorldCup(nextYear, updatedClubs)
      : undefined;
    const intercontinentalCup = isIntercontinentalYear(nextYear)
      ? createIntercontinentalCup(nextYear, updatedClubs)
      : undefined;
    const human =
      rolled.managers?.find((m) => m.id === rolled.humanManagerId) ||
      ({ id: 'human-1', name: stateWithTitles.managerName, reputation: 1, titles: [] } as any);
    const nationalTeamOffers = isWorldCupYear(nextYear)
      ? getAvailableNationalTeamOffers(human, nextYear, nationalTeams)
      : undefined;
    const { callups, newsArticles: callupNews } = isWorldCupYear(nextYear)
      ? evaluateUserSquadCallups(userClub, nextYear, nationalTeams)
      : { callups: [], newsArticles: [] };

    return {
      ...rolled,
      clubs: updatedClubs,
      activeMatch: undefined,
      activeMatchFixtureId: undefined,
      seasonYear: nextYear,
      currentRound: 1,
      currentSemester: 1,
      calendar: next.calendar,
      standings: sortStandings(initializeStandings(next.semester1Clubs)),
      standingsEstadual: sortStandings(initializeStandings(next.semester1Clubs)),
      standingsNacional: sortStandings(initializeStandings(next.semester2Clubs)),
      standingsContinental: sortStandings(initializeStandings(next.continentalClubs)),
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
      newsFeed: [...callupNews, ...(rolled.newsFeed || [])],
    };
  }

  // Normal round advance via Wasm
  const wasmUpdated = advanceRoundViaWasm(stateWithTitles);
  if (wasmUpdated) {
    const nextRound = wasmUpdated.currentRound;
    const nextCompetition = wasmUpdated.calendar.find(
      (f) => (f.fixtureDateIndex ?? f.round) === nextRound
    )?.competitionType;
    const currentSemester = nextCompetition === 'estadual' ? 1 : 2;
    const standings =
      nextCompetition === 'estadual'
        ? wasmUpdated.standingsEstadual || wasmUpdated.standings
        : nextCompetition === 'nacional'
        ? wasmUpdated.standingsNacional || wasmUpdated.standings
        : wasmUpdated.standings;
    return runAiMarket({
      ...wasmUpdated,
      activeMatch: undefined,
      activeMatchFixtureId: undefined,
      currentSemester,
      standings,
      activeScreen: 'overview',
    });
  }

  const nextRound = stateWithTitles.currentRound + 1;
  const nextCompetition = stateWithTitles.calendar.find(
    (f) => (f.fixtureDateIndex ?? f.round) === nextRound
  )?.competitionType;
  const currentSemester = nextCompetition === 'estadual' ? 1 : 2;
  const standings =
    nextCompetition === 'estadual'
      ? stateWithTitles.standingsEstadual || stateWithTitles.standings
      : nextCompetition === 'nacional'
      ? stateWithTitles.standingsNacional || stateWithTitles.standings
      : stateWithTitles.standings;

  return runAiMarket({
    ...stateWithTitles,
    activeMatch: undefined,
    activeMatchFixtureId: undefined,
    currentRound: nextRound,
    currentSemester,
    standings,
    activeScreen: 'overview',
  });
}

/**
 * Runs headless simulation asynchronously in chunks, calling onProgress and allowing cancellation.
 */
export async function runHeadlessSimulation(
  initialState: GameState,
  options: BatchSimulationOptions
): Promise<GameState> {
  let state = initialState;
  const maxRounds = options.targetRounds ?? (options.targetRoundNumber ? options.targetRoundNumber - state.currentRound : 38);
  const totalRoundsToRun = Math.max(1, maxRounds);
  const startingRound = state.currentRound;

  for (let step = 0; step < totalRoundsToRun; step++) {
    if (options.signal?.aborted) {
      break;
    }

    if (options.stopCondition && options.stopCondition(state)) {
      break;
    }

    // Yield control to event loop so browser stays responsive and UI updates progress bar
    await new Promise((resolve) => setTimeout(resolve, 16));

    state = executeHeadlessStep(state, {
      forceUserWinKnockout: options.forceUserWinKnockout,
    });

    // Notify progress
    const currentProgress: BatchSimulationProgress = {
      currentRound: state.currentRound,
      targetRound: startingRound + totalRoundsToRun,
      seasonYear: state.seasonYear,
      stageName: state.calendar.find((f) => (f.fixtureDateIndex ?? f.round) === state.currentRound)?.stage || `Rodada ${state.currentRound}`,
      percent: Math.min(100, Math.round(((step + 1) / totalRoundsToRun) * 100)),
      message: `Simulando Rodada ${state.currentRound} (${state.seasonYear})...`,
    };

    options.onProgress?.(currentProgress);

    if (options.stopCondition && options.stopCondition(state)) {
      break;
    }
  }

  return state;
}
