import type { GameState, NationalTeamOffer, TransferOffer } from '../types/index.ts';
import type { BatchSimulationProgress } from './types.ts';
import { runHeadlessSimulation } from './devBatchEngine.ts';
import {
  initializeNationalTeams,
  isWorldCupYear,
  createWorldCupTournament,
  getAvailableNationalTeamOffers,
} from '../data/nationalTeamsData.ts';

export type CopaStage = 'Oitavas de Final' | 'Quartas de Final' | 'Semifinal' | 'Final';

/**
 * Fast-forwards career until the user reaches the desired Copa do Brasil stage.
 * Uses forceUserWinKnockout so the user is not eliminated prematurely.
 */
export async function jumpToCopaStage(
  initialState: GameState,
  targetStage: CopaStage,
  onProgress?: (p: BatchSimulationProgress) => void,
  signal?: AbortSignal
): Promise<GameState> {
  const isTargetReached = (s: GameState): boolean => {
    return s.calendar.some(
      (f) =>
        f.competitionType === 'copa' &&
        f.stage?.toLowerCase().includes(targetStage.toLowerCase()) &&
        (f.homeClubId === s.userClubId || f.awayClubId === s.userClubId) &&
        (f.fixtureDateIndex ?? f.round) >= s.currentRound
    );
  };

  // If already at stage, stop
  if (isTargetReached(initialState)) return initialState;

  return runHeadlessSimulation(initialState, {
    targetRounds: 50,
    forceUserWinKnockout: true,
    stopCondition: isTargetReached,
    stopConditionLabel: `Chegar em ${targetStage} da Copa`,
    onProgress,
    signal,
  });
}

/**
 * Fast-forwards to the start of the 2nd Semester (National League / Brasileirão).
 */
export async function jumpToSecondSemester(
  initialState: GameState,
  onProgress?: (p: BatchSimulationProgress) => void,
  signal?: AbortSignal
): Promise<GameState> {
  const isSecondSemester = (s: GameState): boolean => {
    if (s.currentSemester === 2) return true;
    const currentFixtures = s.calendar.filter(
      (f) => (f.fixtureDateIndex ?? f.round) === s.currentRound
    );
    return currentFixtures.some((f) => f.competitionType === 'nacional');
  };

  if (isSecondSemester(initialState)) return initialState;

  return runHeadlessSimulation(initialState, {
    targetRounds: 30,
    forceUserWinKnockout: false,
    stopCondition: isSecondSemester,
    stopConditionLabel: 'Início do 2º Semestre (Brasileirão / Nacional)',
    onProgress,
    signal,
  });
}

/**
 * Fast-forwards until the end of the current season (rollover).
 */
export async function jumpToEndOfSeason(
  initialState: GameState,
  onProgress?: (p: BatchSimulationProgress) => void,
  signal?: AbortSignal
): Promise<GameState> {
  const targetYear = initialState.seasonYear + 1;
  const isRolloverComplete = (s: GameState): boolean => s.seasonYear >= targetYear;

  return runHeadlessSimulation(initialState, {
    targetRounds: 45,
    forceUserWinKnockout: false,
    stopCondition: isRolloverComplete,
    stopConditionLabel: 'Fim da Temporada e Rollover',
    onProgress,
    signal,
  });
}

/**
 * Fast-forwards seasons until a FIFA World Cup year is reached.
 */
export async function jumpToWorldCupYear(
  initialState: GameState,
  onProgress?: (p: BatchSimulationProgress) => void,
  signal?: AbortSignal
): Promise<GameState> {
  const isWorldCup = (s: GameState): boolean => isWorldCupYear(s.seasonYear);

  if (isWorldCup(initialState)) return initialState;

  return runHeadlessSimulation(initialState, {
    targetRounds: 160, // multiple seasons
    forceUserWinKnockout: false,
    stopCondition: isWorldCup,
    stopConditionLabel: 'Ano de Copa do Mundo FIFA',
    onProgress,
    signal,
  });
}

/**
 * Instant Mock Injection: Injects a World Cup tournament into current state immediately.
 */
export function injectWorldCupInstant(state: GameState): GameState {
  const nationalTeams = initializeNationalTeams(state.clubs);
  const worldCup = createWorldCupTournament(state.seasonYear, nationalTeams, true);

  return {
    ...state,
    worldCup,
    isWorldCupMode: true,
    activeScreen: 'world_cup',
  };
}

/**
 * Instant Mock Injection: Generates official national team manager job offers.
 */
export function injectNationalTeamOffersInstant(state: GameState): GameState {
  const nationalTeams = initializeNationalTeams(state.clubs);
  const human = state.managers?.find((m) => m.id === state.humanManagerId) || {
    id: 'human-1',
    name: state.managerName,
    reputation: 4,
    titles: ['Campeonato Nacional'],
  };

  const generated = getAvailableNationalTeamOffers(human as any, state.seasonYear, nationalTeams);
  const fallbackOffers: NationalTeamOffer[] = [
    {
      id: Date.now(),
      nationalTeamId: 29,
      nationalTeamName: 'Brasil',
      flag: '🇧🇷',
      code: 'BRA',
      countryId: 29,
      salary: 450000,
      seasonYear: state.seasonYear,
      status: 'pending',
      bonusTitle: 'Proposta Especial de Desenvolvedor',
    },
    {
      id: Date.now() + 1,
      nationalTeamId: 154,
      nationalTeamName: 'Portugal',
      flag: '🇵🇹',
      code: 'POR',
      countryId: 154,
      salary: 380000,
      seasonYear: state.seasonYear,
      status: 'pending',
      bonusTitle: 'Proposta Internacional',
    },
  ];

  const offers = generated.length > 0 ? generated : fallbackOffers;

  return {
    ...state,
    nationalTeamOffers: offers,
    activeScreen: 'national_team_offer',
  };
}

/**
 * Instant Mock Injection: Injects a high-value AI transfer offer for a user squad starter.
 */
export function injectAiTransferOfferInstant(state: GameState): GameState {
  const userClub = state.clubs.find((c) => c.id === state.userClubId);
  if (!userClub || !userClub.squad.length) return state;

  const candidate = userClub.squad.find((p) => p.isStarter && !p.injured) || userClub.squad[0];
  const buyer = state.clubs.find((c) => c.id !== state.userClubId && c.balance > 10000000) || state.clubs.find((c) => c.id !== state.userClubId) || userClub;

  const highFee = Math.round(candidate.marketValue * 1.5 + 2000000);
  const offer: TransferOffer = {
    id: Date.now(),
    fromClubId: buyer.id,
    fromClubName: buyer.name,
    toClubId: userClub.id,
    playerId: candidate.id,
    playerName: candidate.name,
    playerPosition: candidate.position,
    playerStrength: candidate.strength,
    fee: highFee,
    expiresRound: state.currentRound + 3,
  };

  return {
    ...state,
    transferOffers: [offer, ...(state.transferOffers || [])],
    activeScreen: 'transfers',
  };
}
