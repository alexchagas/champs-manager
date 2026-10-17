import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  GameState, 
  Club, 
  Player,
  ActiveScreen, 
  MatchFixture, 
  SaveGameSlot, 
  GameOptions, 
  ClubTactics, 
  ClubLoan,
  FinancialEntry,
  FormationType,
  Mentality,
  MatchCommand,
} from '../types';
import { createNewGame, generateYouthSquad, generateSingleYouthPlayer } from '../data/initialData';
import { 
  closeRoundFinances, 
  migrateCareer, 
  scoreManagers, 
  changeManagers, 
  appointHuman, 
  runAiMarket, 
  rolloverManagers,
  automaticMatchBench 
} from '../engine/careerEconomy';
import { applySavedClubEdits } from '../data/editorPersistence';
import {
  sortStandings,
  generateTwoSemesterCalendar,
  initializeStandings,
  initializeEstadualStandings,
  initializeNacionalStandings,
  initializeContinentalStandings,
} from '../data/calendarGenerator';
import { advanceOtherLeaguesProgress, buildInitialActiveOtherLeagues, buildInitialNationalDivisions, buildInitialStateDivisions } from '../engine/crossSeasonSimulation';
import { simulateMatchWasm } from '../engine/wasmBridge';
import { sound } from '../audio/soundEngine';
import { 
  commandMatchWasm,
  initWasmEngine, 
  isWasmReady, 
  getRustWasmVersion, 
  updateTacticsWasm, 
  swapPlayersWasm, 
  toggleStarterWasm,
  advanceToNextRoundWasm,
  autoSelectBestLineupWasm,
  buyPlayerWasm,
  signFreeAgentWasm,
  releasePlayerWasm,
  acceptAiOfferWasm,
  rejectAiOfferWasm,
  renewContractWasm,
  generateAiOffersWasm,
  searchPlayersWasm,
} from '../engine/wasmBridge';
import { 
  generateWeeklyNews, 
  generateKickoffNews, 
  createChampionshipNews,
} from '../engine/newsEngine';
import { detectNewlyCompletedCompetitions, isSeasonComplete } from '../engine/tournamentCompletion';
import { resolvePendingFixtures } from '../engine/qualification';
import { withInitialLineup } from '../engine/initialLineup';
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
  advanceWorldCupRound,
  performWorldCupDraw,
  getWorldCupHostInfo,
} from '../data/nationalTeamsData';
import type { MarketFilter, MarketSearchResult, NewsArticle, NationalTeamOffer, WorldCupTournament } from '../types';
import { 
  saveActiveGameToStorage, 
  loadActiveGameFromStorage, 
  saveGameSlotToStorage, 
  loadGameSlotFromStorage, 
  deleteGameSlotFromStorage, 
  listAllSaveSlots 
} from './storage';
import { addBreadcrumb } from '../observability/sentry';

interface GameContextType {
  gameState: GameState;
  activeScreen: ActiveScreen;
  hasActiveCareer: boolean;
  userClub: Club;
  currentRoundFixtures: MatchFixture[];
  userFixture?: MatchFixture;
  nextOpponent?: Club;
  saveSlots: SaveGameSlot[];
  isWasmEngine: boolean;
  rustVersion: string;
  lastSavedText: string;
  viewedClubId: number | null;
  viewClub: (clubId: number) => void;
  closeClubViewer: () => void;
  setScreen: (screen: ActiveScreen) => void;
  startNewGame: (clubId: number, managerName: string, customOptions?: Partial<GameOptions>, activeCountryIds?: number[], loadedClubs?: Club[]) => void;
  loadGame: (slotId: string) => Promise<{ success: boolean; error?: string }>;
  saveGame: (title?: string) => Promise<{ success: boolean; error?: string }>;
  deleteSave: (slotId: string) => void;
  updateOptions: (newOptions: Partial<GameOptions>) => void;
  updateTactics: (tactics: Partial<ClubTactics>) => void;
  changeMatchFormation: (formation: FormationType) => void;
  changeMatchMentality: (mentality: Mentality) => void;
  swapPlayers: (idA: number, idB: number) => void;
  toggleStarter: (playerId: number) => void;
  autoSelectBestLineup: (formation?: FormationType) => { restedCount: number } | void;
  matchError: string;
  dispatchMatch: (command: MatchCommand) => { success: boolean; error?: string; updatedSession?: import('../types').ActiveMatchSession | null };
  setMatchBench: (ids: number[]) => void;
  completeRound: () => void;
  advanceRound: () => void;
  buyPlayer: (playerId: number, fee: number) => { success: boolean; error?: string };
  signFreeAgent: (playerId: number, years: number, salary?: number) => { success: boolean; error?: string };
  releasePlayer: (playerId: number) => { success: boolean; error?: string };
  acceptAiOffer: (offerId: number) => { success: boolean; error?: string };
  rejectAiOffer: (offerId: number) => { success: boolean; error?: string };
  renewContract: (playerId: number, years: number, salary: number) => { success: boolean; error?: string };
  generateAiOffers: () => void;
  searchPlayers: (filter: MarketFilter) => MarketSearchResult[];
  expandStadium: (seats: 2000 | 5000 | 10000) => { success: boolean; error?: string };
  setTicketPrice: (price: number) => void;
  takeLoan: (amount: number, installments: number) => { success: boolean; error?: string };
  payOffLoan: (loanId: string) => { success: boolean; error?: string };
  promoteYouthPlayer: (playerId: number) => { success: boolean; error?: string };
  releaseYouthPlayer: (playerId: number) => { success: boolean; error?: string };
  scoutYouthPlayer: () => { success: boolean; error?: string };
  acceptManagerJob: (clubId: number) => void;
  acceptNationalTeamOffer: (offerId: number) => { success: boolean; error?: string };
  rejectNationalTeamOffer: (offerId: number) => void;
  advanceWorldCup: (round?: number) => void;
  performWorldCupDrawAction: () => void;
  finishWorldCupAndReturnToClub: () => void;
  enterWorldCupMode: () => void;
  markNewsAsRead: (articleId: string) => void;
  markAllNewsAsRead: () => void;
  startNextSeason: () => void;
  dismissTournamentConclusion: () => void;
  applyDevState?: (updater: GameState | ((prev: GameState) => GameState)) => void;
}


const GameContext = createContext<GameContextType | null>(null);

function sanitizeClubData(clubs: Club[]): Club[] {
  return clubs.map((c) => ({
    ...c,
    debt: c.debt ?? 0,
    loans: c.loans ?? [],
    ticketPrice: c.ticketPrice ?? 40,
    capacity: c.capacity ?? 20000,
    avgAttendance: c.avgAttendance ?? Math.round((c.capacity ?? 20000) * 0.76),
    attendanceHistory: c.attendanceHistory ?? [],
    financialLedger: c.financialLedger ?? [],
    weeklyStatements: c.weeklyStatements ?? [],
    youth: c.youth && c.youth.length > 0 ? c.youth : generateYouthSquad(c.id, c.level ?? 10),
  }));
}

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isWasm, setIsWasm] = useState<boolean>(false);
  const [rustVersion, setRustVersion] = useState<string>('Carregando WASM...');
  const [lastSavedText, setLastSavedText] = useState<string>('Salvo');
  const [viewedClubId, setViewedClubId] = useState<number | null>(null);
  const [hasActiveCareer, setHasActiveCareer] = useState<boolean>(false);

  const viewClub = useCallback((clubId: number) => {
    sound.playClick();
    setGameState(previous => ({ ...previous, activeMatch: previous.activeMatch ? { ...previous.activeMatch, paused: true } : undefined }));
    setViewedClubId(clubId);
  }, []);

  const closeClubViewer = useCallback(() => {
    sound.playClick();
    setViewedClubId(null);
  }, []);

  const [gameState, setGameStateRaw] = useState<GameState>(() => {
    applySavedClubEdits();
    const initial = migrateCareer(createNewGame(255, 'Professor'));
    return { ...initial, newsFeed: generateKickoffNews(initial), activeScreen: 'splash' }; // default splash
  });

  // Synchronous authority prevents stale timer/shortcut/double-click closures from committing twice.
  const stateRef = useRef(gameState);
  const hydratedRef = useRef(false);
  const [matchError, setMatchError] = useState('');
  const setGameState = useCallback((update: GameState | ((previous: GameState) => GameState)) => {
    const next = typeof update === 'function' ? update(stateRef.current) : update;
    if (!next.activeMatch || next.activeMatch.phase === 'committed') {
      next.clubs = next.clubs.map(c => ({ ...c, namedSubstituteIds: c.namedSubstituteIds?.filter(id => c.squad.some(p => p.id === id && !p.isStarter && !p.injured && !p.suspended)) }));
    }
    stateRef.current = next;
    if (hydratedRef.current) void saveActiveGameToStorage(next).catch(() => setLastSavedText('Erro ao persistir sessão'));
    setGameStateRaw(next);
  }, []);
  const dispatchMatch = (command: MatchCommand) => {
    try {
      const updated = commandMatchWasm(stateRef.current, command);
      setGameState(updated);
      setMatchError('');
      return { success: true, updatedSession: updated.activeMatch };
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error);
      setMatchError(message);
      return { success: false, error: message };
    }
  };
  const setMatchBench = (ids: number[]) => { dispatchMatch({ type: 'set_bench', ids }); };
  const matchInProgress = () => !!stateRef.current.activeMatch && stateRef.current.activeMatch.phase !== 'committed';

  const [saveSlots, setSaveSlots] = useState<SaveGameSlot[]>([
    {
      id: 'slot-demo-1',
      title: 'Flamengo - Rumo ao Tetra',
      savedAt: '2026-10-10 19:30',
      userClubId: 255,
      userClubName: 'Flamengo',
      managerName: 'Professor',
      seasonYear: 2026,
      currentRound: 1,
    },
  ]);

  // Initialize WASM engine on startup
  useEffect(() => {
    let mounted = true;
    initWasmEngine().then((ready) => {
      if (mounted) {
        setIsWasm(ready);
        if (ready) {
          setRustVersion(getRustWasmVersion());
        } else {
          setRustVersion('Motor JS Fallback');
        }
      }
    });

    // Load persisted state and save slots from IndexedDB/LocalStorage
    loadActiveGameFromStorage().then((saved) => {
      if (mounted && saved) {
        setHasActiveCareer(true);
        const migrated = migrateCareer(saved);
        const sanitized = sanitizeClubData(migrated.clubs);
        const news = saved.newsFeed && saved.newsFeed.length > 0 ? saved.newsFeed : generateKickoffNews(saved);
        setGameState(resolvePendingFixtures({
          ...migrated,
          clubs: sanitized,
          newsFeed: news,
          activeScreen: 'splash',
        }));
      }
    }).finally(() => {
      if (mounted) {
        hydratedRef.current = true;
        void saveActiveGameToStorage(stateRef.current).catch(() => setLastSavedText('Erro ao persistir sessão'));
      }
    });

    listAllSaveSlots().then((slots) => {
      if (mounted && slots.length > 0) {
        setSaveSlots(slots);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  // Sync sound engine options
  useEffect(() => {
    sound.setConfig(gameState.options.soundEnabled, gameState.options.soundVolume);
  }, [gameState.options]);

  // Expose system diagnostics for engine and save inspection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__CHAMPS_DIAGNOSTICS__ = {
        isWasm: isWasmReady(),
        rustVersion: isWasmReady() ? getRustWasmVersion() : 'Motor JS Fallback',
        getEngineInfo: () => ({
          isWasm: isWasmReady(),
          rustVersion: isWasmReady() ? getRustWasmVersion() : 'Motor JS Fallback',
          autoSaveMode: gameState.options.autoSaveMode,
          autoSaveMatchCounter: gameState.autoSaveMatchCounter ?? 0,
          careerId: gameState.careerId,
          currentRound: gameState.currentRound,
          seasonYear: gameState.seasonYear,
        }),
      };
    }
  }, [gameState]);

  const setScreen = (screen: ActiveScreen) => {
    sound.playClick();
    setViewedClubId(null);
    if (screen === 'live_match') {
      const current = stateRef.current;
      if (current.activeMatch && current.activeMatch.phase !== 'committed') {
        setGameState({ ...current, activeScreen: screen });
      } else {
        const fixture = current.calendar.find(f => (f.fixtureDateIndex ?? f.round) === current.currentRound && !f.pendingQualification && !f.played && (f.homeClubId === current.userClubId || f.awayClubId === current.userClubId));
        if (fixture) dispatchMatch({ type: 'start', fixture_id: fixture.id });
        else if (current.calendar.some(f => (f.fixtureDateIndex ?? f.round) === current.currentRound && f.played)) {
          setMatchError('');
          setGameState({ ...current, activeScreen: 'round_results' });
        } else setMatchError('Nenhuma partida disponível para jogar.');
      }
      return;
    }
    setGameState(prev => ({ ...prev, activeScreen: screen, activeMatch: prev.activeMatch ? { ...prev.activeMatch, paused: true } : undefined }));
  };

  const userClub = gameState.clubs.find((c) => c.id === gameState.userClubId) || gameState.clubs[0];

  const currentRoundFixtures = gameState.calendar.filter(
    (f) => (f.fixtureDateIndex ?? f.round) === gameState.currentRound
  );

  const userFixture = currentRoundFixtures.find(
    (f) => f.homeClubId === userClub.id || f.awayClubId === userClub.id
  );

  const nextOpponentId = userFixture
    ? userFixture.homeClubId === userClub.id
      ? userFixture.awayClubId
      : userFixture.homeClubId
    : undefined;

  const nextOpponent = gameState.clubs.find((c) => c.id === nextOpponentId);

  // Dedicated Auto-Save handler per career
  const performAutoSave = async (stateToSave: GameState): Promise<boolean> => {
    const mode = stateToSave.options.autoSaveMode || 'disabled';
    if (mode === 'disabled') {
      return false;
    }

    const club = stateToSave.clubs.find((c) => c.id === stateToSave.userClubId) || stateToSave.clubs[0];
    const careerId = stateToSave.careerId || `career-${stateToSave.userClubId}-${(stateToSave.managerName || 'manager').replace(/\s+/g, '_')}`;
    const slotId = `autosave-${careerId}`;

    const autoSlot: SaveGameSlot = {
      id: slotId,
      title: `[Auto-save] ${club.name} - Rodada ${stateToSave.currentRound} (${stateToSave.seasonYear})`,
      savedAt: new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      userClubId: club.id,
      userClubName: club.name,
      managerName: stateToSave.managerName,
      seasonYear: stateToSave.seasonYear,
      currentRound: stateToSave.currentRound,
      isAutoSave: true,
      careerId,
    };

    setLastSavedText('Salvando...');
    try {
      await saveGameSlotToStorage(autoSlot, stateToSave);
      setSaveSlots((prev) => [autoSlot, ...prev.filter((s) => s.id !== slotId)]);
      setLastSavedText('Salvo');
      return true;
    } catch (err) {
      console.error('Auto-save failed:', err);
      setLastSavedText('Erro ao salvar');
      return false;
    }
  };

  const startNewGame = async (
    clubId: number,
    managerName: string,
    customOptions?: Partial<GameOptions>,
    activeCountryIds?: number[],
    loadedClubs?: Club[]
  ) => {
    if (matchInProgress() && !window.confirm('Abandonar a partida em curso e iniciar outra carreira?')) return;
    // Carreira nova já começa com 11 titulares (os dados de origem trazem escalações inválidas)
    const migrated = withInitialLineup(migrateCareer(createNewGame(clubId, managerName, customOptions, activeCountryIds, loadedClubs)), autoSelectBestLineupWasm);
    const newState = { ...migrated, newsFeed: generateKickoffNews(migrated), activeScreen: 'overview' as const };
    setMatchError('');
    setHasActiveCareer(true);
    setGameState(newState);
    const chosenClub = newState.clubs.find(c => c.id === clubId);
    addBreadcrumb('Started new career', 'career', {
      club: chosenClub?.name || `Club #${clubId}`,
      manager: managerName,
      division: chosenClub?.division,
    });
    if (newState.options.autoSaveMode === 'start_of_year') {
      await performAutoSave(newState);
    }
  };

  const saveGame = async (title?: string): Promise<{ success: boolean; error?: string }> => {
    if (matchInProgress()) dispatchMatch({ type: 'pause' });
    const snapshot = stateRef.current;
    const careerId = snapshot.careerId || `career-${userClub.id}-${(gameState.managerName || 'manager').replace(/\s+/g, '_')}`;
    const slotId = `save-manual-${careerId}-${Date.now()}`;
    const newSlot: SaveGameSlot = {
      id: slotId,
      title: title || `${userClub.name} - Rodada ${gameState.currentRound}`,
      savedAt: new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      userClubId: userClub.id,
      userClubName: userClub.name,
      managerName: gameState.managerName,
      seasonYear: gameState.seasonYear,
      currentRound: gameState.currentRound,
      isAutoSave: false,
      careerId,
    };
    addBreadcrumb('Saved career manually', 'storage', {
      slot: newSlot.title,
      club: userClub.name,
      round: gameState.currentRound,
    });

    setLastSavedText('Salvando...');
    try {
      await saveGameSlotToStorage(newSlot, snapshot);
      setSaveSlots((prev) => [newSlot, ...prev.filter((s) => s.id !== slotId)]);
      setLastSavedText('Salvo');
      sound.playClick();
      return { success: true };
    } catch (err: any) {
      console.error('Manual save failed:', err);
      setLastSavedText('Erro ao salvar');
      return { success: false, error: 'Falha ao salvar jogo no navegador.' };
    }
  };

  const loadGame = async (slotId: string): Promise<{ success: boolean; error?: string }> => {
    if (matchInProgress() && !window.confirm('Abandonar a partida em curso e carregar este save?')) return { success: false, error: 'Carregamento cancelado.' };
    try {
      const loaded = await loadGameSlotFromStorage(slotId);
      if (loaded) {
        const migrated = migrateCareer(loaded);
        const sanitized = sanitizeClubData(migrated.clubs);
        const finalState = resolvePendingFixtures({
          ...migrated,
          clubs: sanitized,
          activeScreen: 'overview',
        });
        setMatchError('');
        setHasActiveCareer(true);
        setGameState(finalState);
        await saveActiveGameToStorage(finalState);
        sound.playClick();
        return { success: true };
      }
      return {
        success: false,
        error: 'Save indisponível ou corrompido no navegador.',
      };
    } catch (err: any) {
      console.error('Failed to load save slot:', err);
      return {
        success: false,
        error: err?.message || 'Falha ao ler dados do save.',
      };
    }
  };

  const deleteSave = async (slotId: string) => {
    const updated = saveSlots.filter((s) => s.id !== slotId);
    setSaveSlots(updated);
    await deleteGameSlotFromStorage(slotId);
  };

  const updateOptions = (newOptions: Partial<GameOptions>) => {
    setGameState((prev) => {
      const updated = {
        ...prev,
        options: { ...prev.options, ...newOptions },
      };
      saveActiveGameToStorage(updated).catch(() => {});
      return updated;
    });
  };

  const updateTactics = (tacticsPatch: Partial<ClubTactics>) => {
    if (matchInProgress()) { setMatchError('Comando bloqueado durante a partida. Volte à escalação da sessão.'); return; }
    if (isWasmReady()) {
      const wasmUpdated = updateTacticsWasm(gameState, gameState.userClubId, tacticsPatch);
      if (wasmUpdated) {
        setGameState(wasmUpdated);
        return;
      }
    }

    // Fallback JS
    setGameState((prev) => {
      const updatedClubs = prev.clubs.map((c) => {
        if (c.id !== prev.userClubId) return c;
        return {
          ...c,
          tactics: { ...c.tactics, ...tacticsPatch },
        };
      });
      return { ...prev, clubs: updatedClubs };
    });
  };

  const changeMatchFormation = (formation: FormationType) => {
    const session = stateRef.current.activeMatch;
    if (!session) return;
    const human = session.humanSide ?? 0;
    const team = session.teams[human];
    if (!team) return;

    sound.playClick();
    const onFieldIds = Object.keys(team.onFieldRoleByPlayerId).map(Number);
    const gkId = onFieldIds.find(id => team.onFieldRoleByPlayerId[id] === 'GOL' || team.players.find(p => p.id === id)?.position === 'GOL') ?? onFieldIds[0];
    const outfieldIds = onFieldIds.filter(id => id !== gkId);

    const rankNatural: Record<string, number> = { ZAG: 1, LAT: 2, VOL: 3, MEI: 4, ATA: 5 };
    outfieldIds.sort((a, b) => {
      const posA = team.players.find(p => p.id === a)?.position || 'MEI';
      const posB = team.players.find(p => p.id === b)?.position || 'MEI';
      return (rankNatural[posA] || 99) - (rankNatural[posB] || 99);
    });

    const formationSlots: Record<FormationType, import('../types').Position[]> = {
      '4-4-2': ['LAT', 'ZAG', 'ZAG', 'LAT', 'VOL', 'VOL', 'MEI', 'MEI', 'ATA', 'ATA'],
      '4-3-3': ['LAT', 'ZAG', 'ZAG', 'LAT', 'VOL', 'MEI', 'MEI', 'ATA', 'ATA', 'ATA'],
      '3-5-2': ['ZAG', 'ZAG', 'ZAG', 'VOL', 'VOL', 'MEI', 'MEI', 'MEI', 'ATA', 'ATA'],
      '4-5-1': ['LAT', 'ZAG', 'ZAG', 'LAT', 'VOL', 'VOL', 'MEI', 'MEI', 'MEI', 'ATA'],
      '5-3-2': ['LAT', 'ZAG', 'ZAG', 'ZAG', 'LAT', 'VOL', 'MEI', 'MEI', 'ATA', 'ATA'],
    };

    const slots = formationSlots[formation] || formationSlots['4-4-2'];
    const newRoles: Record<string, import('../types').Position> = { [String(gkId)]: 'GOL' };
    outfieldIds.forEach((id, idx) => {
      newRoles[String(id)] = slots[idx] || 'MEI';
    });

    setGameState(prev => {
      if (!prev.activeMatch) return prev;
      const updatedTeams = [...prev.activeMatch.teams] as [typeof team, typeof team];
      updatedTeams[human] = {
        ...updatedTeams[human],
        formation,
        onFieldRoleByPlayerId: newRoles,
      };
      return {
        ...prev,
        activeMatch: {
          ...prev.activeMatch,
          teams: updatedTeams,
        },
      };
    });
  };

  const changeMatchMentality = (mentality: Mentality) => {
    sound.playClick();
    setGameState(prev => {
      const updatedClubs = prev.clubs.map(c => {
        if (c.id !== prev.userClubId) return c;
        return {
          ...c,
          tactics: { ...c.tactics, mentality },
        };
      });
      return { ...prev, clubs: updatedClubs };
    });
  };

  // Swap position of two players in user squad
  const swapPlayers = (idA: number, idB: number) => {
    if (matchInProgress()) { setMatchError('Comando bloqueado durante a partida. Volte à escalação da sessão.'); return; }
    const a = userClub.squad.find(p => p.id === idA); const b = userClub.squad.find(p => p.id === idB);
    if (!a || !b || (a.isStarter && (b.injured || b.suspended)) || (b.isStarter && (a.injured || a.suspended))) return;
    if (idA === idB) return;
    sound.playClick();

    if (isWasmReady()) {
      const wasmUpdated = swapPlayersWasm(gameState, gameState.userClubId, idA, idB);
      if (wasmUpdated) {
        setGameState(wasmUpdated);
        return;
      }
    }

    // Fallback JS
    setGameState((prev) => {
      const updatedClubs = prev.clubs.map((c) => {
        if (c.id !== prev.userClubId) return c;
        const squad = [...c.squad];
        const idxA = squad.findIndex((p) => p.id === idA);
        const idxB = squad.findIndex((p) => p.id === idB);
        if (idxA === -1 || idxB === -1) return c;

        const tempStarter = squad[idxA].isStarter;
        squad[idxA] = { ...squad[idxA], isStarter: squad[idxB].isStarter };
        squad[idxB] = { ...squad[idxB], isStarter: tempStarter };

        const temp = squad[idxA];
        squad[idxA] = squad[idxB];
        squad[idxB] = temp;

        return { ...c, squad };
      });
      return { ...prev, clubs: updatedClubs };
    });
  };

  const toggleStarter = (playerId: number) => {
    const candidate = userClub.squad.find(p => p.id === playerId);
    if (!candidate || (!candidate.isStarter && (candidate.injured || candidate.suspended))) return;
    if (matchInProgress()) { setMatchError('Comando bloqueado durante a partida. Volte à escalação da sessão.'); return; }
    sound.playClick();

    if (isWasmReady()) {
      const wasmUpdated = toggleStarterWasm(gameState, gameState.userClubId, playerId);
      if (wasmUpdated) {
        setGameState(wasmUpdated);
        return;
      }
    }

    // Fallback JS
    setGameState((prev) => {
      const updatedClubs = prev.clubs.map((c) => {
        if (c.id !== prev.userClubId) return c;
        const squad = [...c.squad];
        const pIdx = squad.findIndex((p) => p.id === playerId);
        if (pIdx === -1) return c;

        const isCurrentlyStarter = squad[pIdx].isStarter;
        const startersCount = squad.filter((p) => p.isStarter).length;

        if (!isCurrentlyStarter && startersCount >= 11) {
          const firstBenchIdx = squad.findIndex((p) => p.isStarter);
          if (firstBenchIdx !== -1) {
            squad[firstBenchIdx] = { ...squad[firstBenchIdx], isStarter: false };
            squad[pIdx] = { ...squad[pIdx], isStarter: true };
          }
        } else {
          squad[pIdx] = { ...squad[pIdx], isStarter: !isCurrentlyStarter };
        }

        return { ...c, squad };
      });
      return { ...prev, clubs: updatedClubs };
    });
  };

  const autoSelectBestLineup = (formation?: FormationType): { restedCount: number } => {
    if (matchInProgress()) { 
      setMatchError('Comando bloqueado durante a partida. Volte à escalação da sessão.'); 
      return { restedCount: 0 }; 
    }
    sound.playClick();
    const updated = autoSelectBestLineupWasm(gameState, gameState.userClubId, formation);
    if (!updated) return { restedCount: 0 };

    let restedCount = 0;
    const userClubUpdated = updated.clubs.find((c) => c.id === gameState.userClubId);
    if (userClubUpdated) {
      // 1. Rest tired starters (< 75% energy) if fresh subs available
      const tiredStarters = userClubUpdated.squad.filter((p) => p.isStarter && p.energy < 75);
      let availableFreshSubs = userClubUpdated.squad.filter(
        (p) => !p.isStarter && !p.injured && !p.suspended && p.energy >= 75
      );

      for (const starter of tiredStarters) {
        let sub = availableFreshSubs
          .filter((c) => c.position === starter.position)
          .sort((a, b) => b.strength - a.strength || b.energy - a.energy)[0];

        if (!sub && starter.position !== 'GOL') {
          sub = availableFreshSubs
            .filter((c) => c.position !== 'GOL')
            .sort((a, b) => b.strength - a.strength || b.energy - a.energy)[0];
        }

        if (sub) {
          starter.isStarter = false;
          sub.isStarter = true;
          availableFreshSubs = availableFreshSubs.filter((c) => c.id !== sub.id);
          restedCount++;
        }
      }

      // 2. Automatically populate the 11-player match bench with top remaining available players
      userClubUpdated.namedSubstituteIds = automaticMatchBench(userClubUpdated);
    }

    setGameState(updated);
    setMatchError('');
    return { restedCount };
  };

  // One immutable state transition publishes domain results plus the career ledger/news.
  const completeRound = () => {
    const latest = stateRef.current;
    if (latest.activeMatch?.phase === 'committed') return;
    try {
      const closed = commandMatchWasm(latest, { type: latest.activeMatch ? 'commit' : 'complete_cpu_date' });
      const fixtures = closed.calendar.filter(f => (f.fixtureDateIndex ?? f.round) === closed.currentRound && f.played);
      const clubs = closeRoundFinances(closed.clubs, fixtures, closed.currentRound);
      const rated = scoreManagers({ ...closed, clubs }, fixtures);
      const { state: managed, dismissals } = changeManagers(rated);
      const completed = closed.activeMatch!;
      const injuries = [completed, ...completed.parallelMatches].flatMap(session => session.teams.flatMap(team => {
        const club = managed.clubs.find(c => c.id === team.clubId)!;
        return team.injuredIds.map(id => ({ club, player: club.squad.find(p => p.id === id)! }));
      }));
      const articles = generateWeeklyNews(managed, fixtures, injuries, dismissals);
      const count = (latest.autoSaveMatchCounter || 0) + 1;
      const final = resolvePendingFixtures({ ...managed, newsFeed: [...articles, ...(latest.newsFeed || [])].slice(0,40),
        autoSaveMatchCounter: latest.options.autoSaveMode === 'every_3_matches' && count >= 3 ? 0 : count,
        activeScreen: 'round_results' });
      
      const newlyCompleted = detectNewlyCompletedCompetitions(final);
      let stateWithTitles = final;
      if (newlyCompleted.length > 0) {
        const history = [...(final.championshipHistory || [])];
        let news = [...(final.newsFeed || [])];
        let clubs = [...final.clubs];
        let userBonus = 0;

        for (const record of newlyCompleted) {
          history.push(record);
          const champNews = createChampionshipNews(record, final.currentRound);
          news = [...champNews, ...news];
          if ((record.championClubId === final.userClubId || record.runnerUpClubId === final.userClubId) && record.userPrizeMoney) {
            userBonus += record.userPrizeMoney;
          }
        }

        if (userBonus > 0) {
          clubs = clubs.map(c => c.id === final.userClubId ? { ...c, balance: c.balance + userBonus } : c);
        }

        stateWithTitles = {
          ...final,
          clubs,
          championshipHistory: history,
          newsFeed: news.slice(0, 50),
          pendingTournamentConclusion: newlyCompleted[0],
        };
      }

      setGameState(stateWithTitles);
      setMatchError('');
      const mode = latest.options.autoSaveMode;
      if (mode === 'every_match' || mode === 'legacy_continuous' || (mode === 'every_3_matches' && count >= 3)) void performAutoSave(stateWithTitles);
    } catch (error) { setMatchError(String(error instanceof Error ? error.message : error)); }
  };

  function simulateBackgroundCompetitionFixtures(state: GameState): GameState {
    const slot = state.currentRound;
    let calendar = state.calendar;
    for (const fixture of calendar.filter(f => (f.fixtureDateIndex ?? f.round) === slot && !f.played && !f.pendingQualification && f.competitionType && f.competitionType !== 'copa' && f.competitionType !== 'estadual' && f.competitionType !== 'nacional')) {
      const home = state.clubs.find(c => c.id === fixture.homeClubId);
      const away = state.clubs.find(c => c.id === fixture.awayClubId);
      if (!home || !away) continue;
      const result = simulateMatchWasm(home, away, fixture.id + slot);
      if (!result) continue;
      calendar = calendar.map(f => f.id === fixture.id ? { ...f, played: true, homeScore: result.homeScore, awayScore: result.awayScore, events: result.events } : f);
    }
    return calendar === state.calendar ? state : { ...state, calendar };
  }

  const acceptManagerJob = (clubId: number) => { if (!matchInProgress()) setGameState(prev => appointHuman(prev, clubId)); };

  const acceptNationalTeamOffer = (offerId: number) => {
    const offer = gameState.nationalTeamOffers?.find(o => o.id === offerId);
    if (!offer) return { success: false, error: 'Proposta não encontrada.' };

    const updatedOffers = (gameState.nationalTeamOffers || []).map(o =>
      o.id === offerId ? { ...o, status: 'accepted' as const } : { ...o, status: 'rejected' as const }
    );

    const nationalJob = {
      nationalTeamId: offer.nationalTeamId,
      nationalTeamName: offer.nationalTeamName,
      countryId: offer.countryId,
      code: offer.code,
    };

    const newsArticle: NewsArticle = {
      id: `job_national_${Date.now()}`,
      round: gameState.currentRound,
      category: 'geral',
      title: `${gameState.managerName.toUpperCase()} ASSUME A SELEÇÃO ${offer.nationalTeamName.toUpperCase()}!`,
      subtitle: `${offer.flag} O técnico comandará o país na Copa do Mundo FIFA ${gameState.seasonYear}`,
      content: `A confederação oficializou a contratação de ${gameState.managerName} para o comando técnico da Seleção ${offer.nationalTeamName}. Ele acumulará o cargo com o comando de seu clube durante o torneio.`,
      clubId: gameState.userClubId,
      clubName: gameState.clubs.find(c => c.id === gameState.userClubId)?.name,
      date: `Temporada ${gameState.seasonYear}`,
      isHeadline: true,
      badgeText: 'SELEÇÃO NACIONAL',
      read: false,
    };

    setGameState(prev => ({
      ...prev,
      isWorldCupMode: true,
      activeScreen: 'world_cup',
      nationalJob,
      nationalTeamOffers: updatedOffers,
      newsFeed: [newsArticle, ...(prev.newsFeed || [])],
    }));

    return { success: true };
  };

  const enterWorldCupMode = () => {
    sound.playClick();
    setGameState(prev => ({
      ...prev,
      isWorldCupMode: true,
      activeScreen: 'world_cup',
    }));
  };

  const performWorldCupDrawAction = () => {
    if (!gameState.worldCup) return;
    const nationalTeams = initializeNationalTeams(gameState.clubs);
    const { groups, fixtures } = performWorldCupDraw(gameState.seasonYear, nationalTeams);
    sound.playClick();
    setGameState(prev => ({
      ...prev,
      worldCup: {
        ...prev.worldCup!,
        drawCompleted: true,
        groups,
        fixtures,
      },
    }));
  };

  const finishWorldCupAndReturnToClub = () => {
    sound.playClick();
    setGameState(prev => {
      const nextRound = Math.max(prev.currentRound, 19);
      return {
        ...prev,
        isWorldCupMode: false,
        activeScreen: 'overview',
        currentRound: nextRound,
      };
    });
  };

  const rejectNationalTeamOffer = (offerId: number) => {
    setGameState(prev => ({
      ...prev,
      nationalTeamOffers: (prev.nationalTeamOffers || []).map(o =>
        o.id === offerId ? { ...o, status: 'rejected' as const } : o
      ),
    }));
  };

  const advanceWorldCup = (round?: number) => {
    if (!gameState.worldCup) return;
    const nationalTeams = initializeNationalTeams(gameState.clubs);
    const teamsMap = new Map(nationalTeams.map(t => [t.id, t]));

    const targetRound = round || (() => {
      for (let r = 1; r <= 7; r++) {
        const fix = gameState.worldCup!.fixtures.filter(f => f.round === r);
        if (fix.length > 0 && !fix.every(f => f.played)) return r;
      }
      return 7;
    })();

    const updatedWc = advanceWorldCupRound(gameState.worldCup, targetRound, teamsMap);

    // If finished and user was champion, update manager titles
    let updatedManagers = gameState.managers;
    if (updatedWc.status === 'finished' && gameState.nationalJob && updatedWc.champion?.id === gameState.nationalJob.nationalTeamId) {
      updatedManagers = (gameState.managers || []).map(m => {
        if (m.id === gameState.humanManagerId) {
          const title = `${gameState.seasonYear} · Campeão da Copa do Mundo FIFA (${gameState.nationalJob!.nationalTeamName})`;
          return {
            ...m,
            titles: m.titles.includes(title) ? m.titles : [...m.titles, title],
            careerScore: m.careerScore + 50,
            reputation: 100,
          };
        }
        return m;
      });
    }

    setGameState(prev => ({
      ...prev,
      worldCup: { ...updatedWc },
      managers: updatedManagers,
    }));
  };

  const dismissTournamentConclusion = () => {
    setGameState(prev => ({
      ...prev,
      pendingTournamentConclusion: undefined,
    }));
  };

  const startNextSeason = () => {
    const club = gameState.clubs.find(c => c.id === gameState.userClubId) || gameState.clubs[0];
    const nationalIds = new Set(gameState.standingsNacional?.map(row => row.clubId));
    const nationalClubs = gameState.clubs.filter(c => nationalIds.has(c.id));
    const nextYear = gameState.seasonYear + 1;
    const next = generateTwoSemesterCalendar(club, nationalClubs, gameState.clubs, nextYear);
    const rolled = rolloverManagers(gameState);

    // Apply post-World Cup market value boosts to called-up players
    let updatedClubs = rolled.clubs;
    if (gameState.nationalCallups && gameState.nationalCallups.length > 0) {
      const callupMap = new Map(gameState.nationalCallups.map(c => [c.playerId, c.boostedMarketValue]));
      updatedClubs = rolled.clubs.map(c => ({
        ...c,
        squad: c.squad.map(p => {
          const boosted = callupMap.get(p.id);
          return boosted ? { ...p, marketValue: boosted } : p;
        }),
      }));
    }

    // Initialize Quadrennial Cycle Tournaments for next season
    const nationalTeams = initializeNationalTeams(updatedClubs);
    const worldCup = isWorldCupYear(nextYear) ? createWorldCupTournament(nextYear, nationalTeams) : undefined;
    const superClubWorldCup = isSuperClubWorldCupYear(nextYear) ? createSuperClubWorldCup(nextYear, updatedClubs) : undefined;
    const intercontinentalCup = isIntercontinentalYear(nextYear) ? createIntercontinentalCup(nextYear, updatedClubs) : undefined;
    const human = rolled.managers?.find(m => m.id === rolled.humanManagerId) || { id: 'human-1', name: gameState.managerName, reputation: 1, titles: [] } as any;
    const nationalTeamOffers = isWorldCupYear(nextYear) ? getAvailableNationalTeamOffers(human, nextYear, nationalTeams) : undefined;
    const { callups, newsArticles: callupNews } = isWorldCupYear(nextYear) ? evaluateUserSquadCallups(club, nextYear, nationalTeams) : { callups: [], newsArticles: [] };

    const nextNationalDivisions = buildInitialNationalDivisions(
      club,
      updatedClubs,
      nextYear
    );

    const nextOtherLeagues = buildInitialActiveOtherLeagues(
      club,
      gameState.activeCountryIds || [],
      updatedClubs,
      nextYear
    );

    const nextStateDivisions = buildInitialStateDivisions(
      club,
      updatedClubs,
      nextYear
    );

    const nextSeasonState: GameState = {
      ...rolled,
      clubs: updatedClubs,
      activeMatch: undefined, activeMatchFixtureId: undefined,
      seasonYear: nextYear,
      currentRound: 1,
      currentSemester: 1,
      calendar: next.calendar,
      standings: sortStandings(initializeEstadualStandings(club, next.semester1Clubs)),
      standingsEstadual: sortStandings(initializeEstadualStandings(club, next.semester1Clubs)),
      standingsNacional: sortStandings(initializeNacionalStandings(club, next.semester2Clubs)),
      standingsContinental: sortStandings(initializeContinentalStandings(next.continentalClubs)),
      nationalDivisions: nextNationalDivisions,
      stateDivisions: nextStateDivisions,
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
      newsFeed: [...callupNews, ...(rolled.newsFeed || [])],
    };
    setGameState(nextSeasonState);
    if (
      gameState.options.autoSaveMode === 'start_of_year' ||
      gameState.options.autoSaveMode === 'legacy_continuous'
    ) {
      performAutoSave(nextSeasonState);
    }
  };

  const advanceRound = () => {
    if (matchInProgress()) { setMatchError('Comando bloqueado durante a partida. Volte à escalação da sessão.'); return; }
    const lastSlot = Math.max(...gameState.calendar.map(f => f.fixtureDateIndex ?? f.round));
    if (gameState.currentRound >= lastSlot || isSeasonComplete(gameState)) {
      setGameState(prev => ({
        ...prev,
        activeScreen: 'season_review',
      }));
      return;
    }

    const currentLastSlot = Math.max(...gameState.calendar.map(f => f.fixtureDateIndex ?? f.round));
    const targetRoundNum = gameState.currentRound + 1;
    const progressRatio = Math.min(1.0, targetRoundNum / Math.max(1, currentLastSlot));
    const updatedNationalDivisions = gameState.nationalDivisions && gameState.nationalDivisions.length > 0
      ? advanceOtherLeaguesProgress(
          gameState.nationalDivisions,
          progressRatio,
          gameState.clubs,
          (gameState.clubs.find(c => c.id === gameState.userClubId)?.countryId || 29) === 29
        )
      : gameState.nationalDivisions;

    const updatedStateDivisions = gameState.stateDivisions && gameState.stateDivisions.length > 0
      ? advanceOtherLeaguesProgress(
          gameState.stateDivisions,
          progressRatio,
          gameState.clubs,
          true
        )
      : gameState.stateDivisions;

    const updatedOtherLeagues = gameState.otherLeagues && gameState.otherLeagues.length > 0
      ? advanceOtherLeaguesProgress(
          gameState.otherLeagues,
          progressRatio,
          gameState.clubs,
          (gameState.clubs.find(c => c.id === gameState.userClubId)?.countryId || 29) === 29
        )
      : gameState.otherLeagues;

    if (isWasmReady()) {
      const wasmUpdated = advanceToNextRoundWasm(gameState);
      if (wasmUpdated) {
        const nextRound = wasmUpdated.currentRound;
        const nextCompetition = wasmUpdated.calendar.find(f => (f.fixtureDateIndex ?? f.round) === nextRound)?.competitionType;
        const currentSemester = nextCompetition === 'estadual' ? 1 : 2;
        const standings = nextCompetition === 'estadual' ? wasmUpdated.standingsEstadual || wasmUpdated.standings :
          nextCompetition === 'nacional' ? wasmUpdated.standingsNacional || wasmUpdated.standings : wasmUpdated.standings;
        const synchronized = simulateBackgroundCompetitionFixtures({ ...wasmUpdated, otherLeagues: updatedOtherLeagues });
        setGameState(runAiMarket({ 
          ...synchronized,
          activeMatch: undefined, 
          activeMatchFixtureId: undefined, 
          currentSemester, 
          standings, 
          nationalDivisions: updatedNationalDivisions,
          stateDivisions: updatedStateDivisions,
          otherLeagues: updatedOtherLeagues,
          activeScreen: 'overview' 
        }));
        return;
      }
    }
    setGameState((prev) => {
      const nextRound = prev.currentRound + 1;
      const nextCompetition = prev.calendar.find(f => (f.fixtureDateIndex ?? f.round) === nextRound)?.competitionType;
      const currentSemester = nextCompetition === 'estadual' ? 1 : 2;
      const standings = nextCompetition === 'estadual' ? prev.standingsEstadual || prev.standings :
        nextCompetition === 'nacional' ? prev.standingsNacional || prev.standings : prev.standings;
      return runAiMarket(simulateBackgroundCompetitionFixtures({
        ...prev,
        activeMatch: undefined, activeMatchFixtureId: undefined,
        currentRound: nextRound,
        currentSemester,
        standings,
        nationalDivisions: updatedNationalDivisions,
        stateDivisions: updatedStateDivisions,
        otherLeagues: updatedOtherLeagues,
        activeScreen: 'overview',
      }));
    });
  };

  const buyPlayer = (playerId: number, fee: number) => {
    if (matchInProgress()) return { success: false, error: 'Elenco bloqueado durante a partida.' };
    const res = buyPlayerWasm(gameState, playerId, fee);
    if (res.success && res.state) {
      sound.playClick();
      const boughtPlayer = res.state.clubs
        .find((c) => c.id === gameState.userClubId)
        ?.squad.find((p) => p.id === playerId);
      let updatedNews = res.state.newsFeed || gameState.newsFeed || [];
      if (boughtPlayer) {
        const article: NewsArticle = {
          id: `news-buy-${Date.now()}`,
          round: gameState.currentRound,
          category: 'transferencia',
          title: `BOMBA NO MERCADO! ${userClub.name.toUpperCase()} ANUNCIA ${boughtPlayer.name.toUpperCase()}`,
          subtitle: `Negociação de R$ ${fee.toLocaleString('pt-BR')} concretizada com sucesso`,
          content: `O ${userClub.name} acaba de fechar a contratação de ${boughtPlayer.name} (${boughtPlayer.position}, força ${boughtPlayer.strength}) por R$ ${fee.toLocaleString('pt-BR')}. O reforço assinou contrato e já se junta aos companheiros. A torcida comemora a chegada do atleta nas redes sociais.`,
          clubId: userClub.id,
          clubName: userClub.name,
          clubCrest: userClub.crestMiniUrl || userClub.crestUrl,
          relatedPlayerName: boughtPlayer.name,
          relatedPlayerPosition: boughtPlayer.position,
          date: `Rodada ${gameState.currentRound}`,
          isHeadline: true,
          badgeText: '💼 CONTRATAÇÃO DE PESO',
          statsHighlight: `R$ ${(fee / 1000000).toFixed(1)}M`,
        };
        updatedNews = [article, ...updatedNews].slice(0, 40);
      }
      setGameState({ ...res.state, newsFeed: updatedNews });
      return { success: true };
    }
    return { success: false, error: res.error || 'Erro ao comprar jogador.' };
  };

  const signFreeAgent = (playerId: number, years: number, salary?: number) => {
    if (matchInProgress()) return { success: false, error: 'Elenco bloqueado durante a partida.' };
    const res = signFreeAgentWasm(gameState, playerId, years, salary);
    if (res.success && res.state) {
      sound.playClick();
      setGameState(res.state);
      return { success: true };
    }
    return { success: false, error: res.error || 'Erro ao contratar atleta livre.' };
  };

  const releasePlayer = (playerId: number) => {
    if (matchInProgress()) return { success: false, error: 'Elenco bloqueado durante a partida.' };
    const res = releasePlayerWasm(gameState, playerId);
    if (res.success && res.state) {
      sound.playClick();
      setGameState(res.state);
      return { success: true };
    }
    return { success: false, error: res.error || 'Erro ao dispensar atleta.' };
  };

  const acceptAiOffer = (offerId: number) => {
    if (matchInProgress()) return { success: false, error: 'Elenco bloqueado durante a partida.' };
    const res = acceptAiOfferWasm(gameState, offerId);
    if (!res.success && res.state) setGameState(res.state);
    if (res.success && res.state) {
      sound.playClick();
      const offer = (gameState.transferOffers || []).find((o) => o.id === offerId);
      let updatedNews = res.state.newsFeed || gameState.newsFeed || [];
      if (offer) {
        const article: NewsArticle = {
          id: `news-sale-${Date.now()}`,
          round: gameState.currentRound,
          category: 'transferencia',
          title: `VENDA MILIONÁRIA! ${userClub.name.toUpperCase()} NEGOCIA ${offer.playerName.toUpperCase()}`,
          subtitle: `${offer.fromClubName} paga R$ ${offer.fee.toLocaleString('pt-BR')} pelo atleta`,
          content: `Negócio fechado no futebol nacional: o ${userClub.name} concluiu a transferência do atleta ${offer.playerName} para o ${offer.fromClubName} por R$ ${offer.fee.toLocaleString('pt-BR')}. A negociação engorda o caixa do clube e abre espaço para novos investimentos.`,
          clubId: userClub.id,
          clubName: userClub.name,
          clubCrest: userClub.crestMiniUrl || userClub.crestUrl,
          secondaryClubName: offer.fromClubName,
          relatedPlayerName: offer.playerName,
          relatedPlayerPosition: offer.playerPosition,
          date: `Rodada ${gameState.currentRound}`,
          isHeadline: true,
          badgeText: '💼 VENDA OFICIAL',
          statsHighlight: `R$ ${(offer.fee / 1000000).toFixed(1)}M`,
        };
        updatedNews = [article, ...updatedNews].slice(0, 40);
      }
      setGameState({ ...res.state, newsFeed: updatedNews });
      return { success: true };
    }
    return { success: false, error: res.error || 'Erro ao aceitar proposta.' };
  };

  const rejectAiOffer = (offerId: number) => {
    const res = rejectAiOfferWasm(gameState, offerId);
    if (res.success && res.state) {
      sound.playClick();
      setGameState(res.state);
      return { success: true };
    }
    return { success: false, error: res.error || 'Erro ao recusar proposta.' };
  };

  const renewContract = (playerId: number, years: number, salary: number) => {
    const res = renewContractWasm(gameState, playerId, years, salary);
    if (res.success && res.state) {
      sound.playClick();
      setGameState(res.state);
      return { success: true };
    }
    return { success: false, error: res.error || 'Erro ao renovar contrato.' };
  };

  const generateAiOffers = () => {
    if (matchInProgress()) { setMatchError('Comando bloqueado durante a partida. Volte à escalação da sessão.'); return; }
    const res = generateAiOffersWasm(gameState);
    if (res) {
      setGameState(res);
    }
  };

  const searchPlayers = (filter: MarketFilter) => {
    return searchPlayersWasm(gameState, filter);
  };

  const expandStadium = (seats: 2000 | 5000 | 10000) => {
    const costMap: Record<number, number> = {
      2000: 3000000,
      5000: 7000000,
      10000: 13000000,
    };
    const cost = costMap[seats] || 3000000;
    if (userClub.balance < cost) {
      return {
        success: false,
        error: `Saldo insuficiente! Custo de R$ ${cost.toLocaleString('pt-BR')}, saldo atual de R$ ${userClub.balance.toLocaleString('pt-BR')}.`,
      };
    }

    sound.playCash();

    setGameState((prev) => {
      const updatedClubs = prev.clubs.map((c) => {
        if (c.id !== prev.userClubId) return c;
        const entry: FinancialEntry = {
          id: `fin-obras-${Date.now()}`,
          round: prev.currentRound,
          type: 'expense',
          category: 'obras',
          description: `Obras de Expansão (+${seats.toLocaleString('pt-BR')} lugares)`,
          amount: cost,
          timestamp: Date.now(),
        };
        return {
          ...c,
          balance: c.balance - cost,
          capacity: c.capacity + seats,
          financialLedger: [entry, ...(c.financialLedger || [])],
        };
      });
      return { ...prev, clubs: updatedClubs };
    });

    return { success: true };
  };

  const setTicketPrice = (price: number) => {
    const sanitized = Math.max(10, Math.min(250, Math.round(price)));
    sound.playClick();
    setGameState((prev) => {
      const updatedClubs = prev.clubs.map((c) => {
        if (c.id !== prev.userClubId) return c;
        return { ...c, ticketPrice: sanitized };
      });
      return { ...prev, clubs: updatedClubs };
    });
  };

  const takeLoan = (amount: number, installments: number) => {
    if (amount <= 0) {
      return { success: false, error: 'Valor de empréstimo inválido.' };
    }
    const squadVal = userClub.squad.reduce((sum, p) => sum + p.marketValue, 0);
    const maxCredit = Math.max(10000000, Math.round(userClub.capacity * 350 + squadVal * 0.25));
    const currentDebt = userClub.debt || 0;
    const availableCredit = Math.max(0, maxCredit - currentDebt);

    if (amount > availableCredit) {
      return {
        success: false,
        error: `Valor solicitado excede o limite disponível de R$ ${availableCredit.toLocaleString('pt-BR')}.`,
      };
    }

    const validInstallments = installments === 15 ? 15 : installments === 20 ? 20 : 10;
    const rate = validInstallments === 10 ? 0.08 : validInstallments === 15 ? 0.12 : 0.15;
    const totalToPay = Math.round(amount * (1 + rate));
    const installmentAmount = Math.round(totalToPay / validInstallments);

    const newLoan: ClubLoan = {
      id: `loan-${Date.now()}`,
      principal: amount,
      totalToPay,
      remainingAmount: totalToPay,
      installmentAmount,
      remainingInstallments: validInstallments,
      totalInstallments: validInstallments,
      interestRate: rate,
      takenAtRound: gameState.currentRound,
    };

    sound.playCash();

    setGameState((prev) => {
      const updatedClubs = prev.clubs.map((c) => {
        if (c.id !== prev.userClubId) return c;
        const entry: FinancialEntry = {
          id: `fin-loan-in-${Date.now()}`,
          round: prev.currentRound,
          type: 'income',
          category: 'emprestimo',
          description: `Empréstimo Bancário (${validInstallments}x com juros)`,
          amount,
          timestamp: Date.now(),
        };
        return {
          ...c,
          balance: c.balance + amount,
          debt: (c.debt || 0) + totalToPay,
          loans: [...(c.loans || []), newLoan],
          financialLedger: [entry, ...(c.financialLedger || [])],
        };
      });
      return { ...prev, clubs: updatedClubs };
    });

    return { success: true };
  };

  const payOffLoan = (loanId: string) => {
    const loan = (userClub.loans || []).find((l) => l.id === loanId);
    if (!loan) return { success: false, error: 'Empréstimo não encontrado.' };

    const payAmount = Math.round(loan.remainingAmount * 0.95);
    if (userClub.balance < payAmount) {
      return {
        success: false,
        error: `Saldo insuficiente para quitação antecipada! Necessário R$ ${payAmount.toLocaleString('pt-BR')}.`,
      };
    }

    sound.playCash();

    setGameState((prev) => {
      const updatedClubs = prev.clubs.map((c) => {
        if (c.id !== prev.userClubId) return c;
        const remainingLoans = (c.loans || []).filter((l) => l.id !== loanId);
        const entry: FinancialEntry = {
          id: `fin-payoff-${Date.now()}`,
          round: prev.currentRound,
          type: 'expense',
          category: 'emprestimo',
          description: `Quitação Antecipada de Empréstimo com Desconto`,
          amount: payAmount,
          timestamp: Date.now(),
        };
        return {
          ...c,
          balance: c.balance - payAmount,
          debt: Math.max(0, (c.debt || 0) - loan.remainingAmount),
          loans: remainingLoans,
          financialLedger: [entry, ...(c.financialLedger || [])],
        };
      });
      return { ...prev, clubs: updatedClubs };
    });

    return { success: true };
  };

  const promoteYouthPlayer = (playerId: number) => {
    if (matchInProgress()) return { success: false, error: 'Elenco bloqueado durante a partida.' };
    if (userClub.squad.length >= 30) {
      return {
        success: false,
        error: 'O elenco profissional está lotado! Limite de 30 atletas atingido.',
      };
    }

    const candidate = (userClub.youth || []).find((p) => p.id === playerId);
    if (!candidate) {
      return { success: false, error: 'Atleta não encontrado nas categorias de base.' };
    }

    sound.playCash();

    setGameState((prev) => {
      const updatedClubs = prev.clubs.map((c) => {
        if (c.id !== prev.userClubId) return c;
        const updatedYouth = (c.youth || []).filter((p) => p.id !== playerId);
        const proSalary = Math.max(12000, Math.floor(candidate.marketValue / 110));
        const promotedPlayer: Player = {
          ...candidate,
          salary: proSalary,
          contractYears: 3,
          isStarter: false,
        };
        return {
          ...c,
          youth: updatedYouth,
          squad: [...c.squad, promotedPlayer],
        };
      });
      return { ...prev, clubs: updatedClubs };
    });

    return { success: true };
  };

  const releaseYouthPlayer = (playerId: number) => {
    sound.playClick();
    setGameState((prev) => {
      const updatedClubs = prev.clubs.map((c) => {
        if (c.id !== prev.userClubId) return c;
        const updatedYouth = (c.youth || []).filter((p) => p.id !== playerId);
        return {
          ...c,
          youth: updatedYouth,
        };
      });
      return { ...prev, clubs: updatedClubs };
    });
    return { success: true };
  };

  const scoutYouthPlayer = () => {
    const currentYouth = userClub.youth || [];
    if (currentYouth.length >= 15) {
      return { success: false, error: 'As categorias de base já atingiram a capacidade máxima de 15 atletas.' };
    }
    const fee = 50000;
    if (userClub.balance < fee) {
      return { success: false, error: 'Saldo insuficiente para custos de olheiro/peneira (R$ 50.000).' };
    }

    sound.playCash();

    const nextId = 790000 + (Date.now() % 100000);
    const newPlayer = generateSingleYouthPlayer(userClub.id, nextId, userClub.level ?? 10);

    setGameState((prev) => {
      const updatedClubs = prev.clubs.map((c) => {
        if (c.id !== prev.userClubId) return c;
        const entry: FinancialEntry = {
          id: `fin-scout-${Date.now()}`,
          round: prev.currentRound,
          type: 'expense',
          category: 'outros',
          description: `Peneira / Avaliação de Novo Atleta da Base (${newPlayer.name})`,
          amount: fee,
          timestamp: Date.now(),
        };
        return {
          ...c,
          balance: c.balance - fee,
          youth: [...(c.youth || []), newPlayer],
          financialLedger: [entry, ...(c.financialLedger || [])],
        };
      });
      return { ...prev, clubs: updatedClubs };
    });

    return { success: true };
  };

  const markNewsAsRead = useCallback((articleId: string) => {
    setGameState((prev) => {
      if (!prev.newsFeed) return prev;
      const alreadyRead = prev.newsFeed.find((a) => a.id === articleId)?.read;
      if (alreadyRead) return prev;
      return {
        ...prev,
        newsFeed: prev.newsFeed.map((art) =>
          art.id === articleId ? { ...art, read: true } : art
        ),
      };
    });
  }, []);

  const markAllNewsAsRead = useCallback(() => {
    setGameState((prev) => {
      if (!prev.newsFeed) return prev;
      const allAlreadyRead = prev.newsFeed.every((a) => a.read);
      if (allAlreadyRead) return prev;
      return {
        ...prev,
        newsFeed: prev.newsFeed.map((art) => ({ ...art, read: true })),
      };
    });
  }, []);

  return (
    <GameContext.Provider
      value={{
        gameState,
        activeScreen: gameState.activeScreen,
        hasActiveCareer,
        userClub,
        currentRoundFixtures,
        userFixture,
        nextOpponent,
        saveSlots,
        isWasmEngine: isWasm,
        rustVersion,
        lastSavedText,
        viewedClubId,
        viewClub,
        closeClubViewer,
        setScreen,
        startNewGame,
        loadGame,
        saveGame,
        deleteSave,
        updateOptions,
        updateTactics,
        changeMatchFormation,
        changeMatchMentality,
        swapPlayers,
        toggleStarter,
        autoSelectBestLineup,
        matchError,
        dispatchMatch,
        setMatchBench,
        completeRound,
        advanceRound,
        buyPlayer,
        signFreeAgent,
        releasePlayer,
        acceptAiOffer,
        rejectAiOffer,
        renewContract,
        generateAiOffers,
        searchPlayers,
        expandStadium,
        setTicketPrice,
        takeLoan,
        payOffLoan,
        promoteYouthPlayer,
        releaseYouthPlayer,
        scoutYouthPlayer,
        acceptManagerJob,
        acceptNationalTeamOffer,
        rejectNationalTeamOffer,
        advanceWorldCup,
        performWorldCupDrawAction,
        finishWorldCupAndReturnToClub,
        enterWorldCupMode,
        markNewsAsRead,
        markAllNewsAsRead,
        startNextSeason,
        dismissTournamentConclusion,
        applyDevState: setGameState,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};


export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
};
