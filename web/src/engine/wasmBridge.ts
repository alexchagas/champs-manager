import initWasm, {
  WasmCareerEngine,
  wasm_simulate_match,
  wasm_match_command,
  wasm_sort_standings,
  wasm_version,
  wasm_calculate_asking_price,
  wasm_calculate_demanded_salary,
  wasm_auto_select_best_lineup,
} from '../wasm_pkg/champs_core.js';
import wasmUrl from '../wasm_pkg/champs_core_bg.wasm?url';
import { Club, GameState, MatchEvent, ClubTactics, Player, MarketFilter, MarketSearchResult, TransferOffer } from '../types';
import { SimulatedMatchResult } from './simulationEngine';
import { canSell, validOffer, post, canFundTransfer, runAiMarket } from './careerEconomy';
import { addBreadcrumb, captureError } from '../observability/sentry';

let wasmInitialized = false;
let wasmInitPromise: Promise<boolean> | null = null;
let activeEngine: WasmCareerEngine | null = null;

function mergeCareerState(current: GameState, parsed: GameState): GameState {
  const merged: GameState = {
    ...current, ...parsed,
    // Rust's web DTO intentionally handles match and roster fields only.
    clubs: parsed.clubs.map(c => {
      const old = current.clubs.find(x => x.id === c.id);
      return old ? { ...old, ...c, balance: old.balance } : c;
    }),
    managers: current.managers,
    humanManagerId: current.humanManagerId,
    schemaVersion: current.schemaVersion,
    newsFeed: current.newsFeed,
    standingsEstadual: parsed.standingsEstadual?.length ? parsed.standingsEstadual : current.standingsEstadual,
    standingsNacional: parsed.standingsNacional?.length ? parsed.standingsNacional : current.standingsNacional,
    standingsContinental: (parsed.standingsContinental?.length ? parsed.standingsContinental : current.standingsContinental)?.map(row => {
      if (row.group) return row;
      const existingGroup = current.standingsContinental?.find(c => c.clubId === row.clubId)?.group;
      if (existingGroup) return { ...row, group: existingGroup };
      const fix = current.calendar?.find(f => (f.homeClubId === row.clubId || f.awayClubId === row.clubId) && f.competitionRound?.startsWith('Grupo '));
      const g = fix?.competitionRound?.match(/Grupo ([A-Z]+)(?:\s|$)/)?.[1];
      return g ? { ...row, group: g } : row;
    }),
    calendar: parsed.calendar.map(fixture => {
      const existing = current.calendar.find(item => item.id === fixture.id);
      return existing?.competitionRound && !fixture.competitionRound ? { ...fixture, competitionRound: existing.competitionRound } : fixture;
    }),
    stateChampionshipName: current.stateChampionshipName,
    nationalLeagueName: current.nationalLeagueName,
    continentalCupName: current.continentalCupName,
    nationalDivisions: parsed.nationalDivisions ?? current.nationalDivisions,
    stateDivisions: parsed.stateDivisions ?? current.stateDivisions,
  };
  merged.transferOffers = (parsed.transferOffers || []).map(o => ({ ...current.transferOffers?.find(old => old.id === o.id), ...o })).filter(o => !validOffer(merged, o));
  return merged;
}


export async function initWasmEngine(): Promise<boolean> {
  if (wasmInitialized) return true;
  if (wasmInitPromise) return wasmInitPromise;

  wasmInitPromise = (async () => {
    try {
      await initWasm(wasmUrl);
      wasmInitialized = true;
      console.log('🦀 [WASM] Champs Manager Rust engine initialized successfully!');
      try {
        const v = wasm_version();
        console.log('🦀 [WASM] Version:', v);
        addBreadcrumb('WASM Rust engine initialized', 'engine', { version: v });
      } catch (_) {
        addBreadcrumb('WASM Rust engine initialized', 'engine');
      }
      return true;
    } catch (err) {
      console.warn('⚠️ [WASM] Failed to load WASM module, falling back to pure JS engine:', err);
      addBreadcrumb('WASM failed to load, fallback to JS', 'engine', { error: String(err) });
      captureError(err, { context: 'initWasmEngine' });
      wasmInitialized = false;
      return false;
    }
  })();

  return wasmInitPromise;
}

export function isWasmReady(): boolean {
  return wasmInitialized;
}

export function getRustWasmVersion(): string {
  if (!wasmInitialized) return 'WASM not loaded';
  try {
    return wasm_version();
  } catch {
    return 'Champs Manager Rust WASM';
  }
}

/**
 * Simulates a full 90-minute match using the Rust engine.
 */
export function simulateMatchWasm(home: Club, away: Club, seed?: number): SimulatedMatchResult | null {
  if (!wasmInitialized) return null;

  try {
    const homeJson = JSON.stringify(home);
    const awayJson = JSON.stringify(away);
    const resultJson = wasm_simulate_match(homeJson, awayJson, seed ?? Date.now() % 100000);
    return JSON.parse(resultJson) as SimulatedMatchResult;
  } catch (err) {
    console.error('Error simulating match with WASM:', err);
    return null;
  }
}

/**
 * Simulates all CPU matches and advances the career round using the Rust WasmCareerEngine.
 */
export function playRoundWasm(
  currentState: GameState,
  userScore?: [number, number],
  userEvents?: MatchEvent[]
): GameState | null {
  if (!wasmInitialized) return null;

  try {
    // Reinitialize or reuse WasmCareerEngine with the current state
    if (activeEngine) {
      try {
        activeEngine.free();
      } catch (_) {}
    }

    activeEngine = new WasmCareerEngine(JSON.stringify(currentState), Date.now() % 100000);

    const userHomeScore = userScore ? userScore[0] : null;
    const userAwayScore = userScore ? userScore[1] : null;
    const userEventsJson = userEvents ? JSON.stringify(userEvents) : null;

    const updatedStateJson = activeEngine.play_current_round(
      userHomeScore,
      userAwayScore,
      userEventsJson
    );

    const parsed = mergeCareerState(currentState, JSON.parse(updatedStateJson) as GameState);
    parsed.clubs = parsed.clubs.map((c) => {
      const prev = currentState.clubs.find((p) => p.id === c.id);
      return prev ? { ...prev, ...c, balance: prev.balance } : c;
    });
    return parsed;
  } catch (err) {
    console.error('Error running play_current_round on WASM:', err);
    return null;
  }
}

/**
 * Advances to the next round via Rust WasmCareerEngine.
 */
export function advanceToNextRoundWasm(currentState: GameState): GameState | null {
  if (!wasmInitialized) return null;

  try {
    activeEngine = new WasmCareerEngine(JSON.stringify(currentState), Date.now() % 100000);
    const updatedStateJson = activeEngine.advance_to_next_round();
    const parsed = mergeCareerState(currentState, JSON.parse(updatedStateJson) as GameState);
    parsed.clubs = parsed.clubs.map((c) => {
      const prev = currentState.clubs.find((p) => p.id === c.id);
      return prev ? { ...prev, ...c } : c;
    });
    return parsed;
  } catch (err) {
    console.error('Error running advance_to_next_round on WASM:', err);
    return null;
  }
}

/**
 * Updates tactics via Rust WasmCareerEngine.
 */
export function updateTacticsWasm(currentState: GameState, clubId: number, tactics: Partial<ClubTactics>): GameState | null {
  if (!wasmInitialized) return null;

  try {
    const club = currentState.clubs.find((c) => c.id === clubId);
    if (!club) return null;
    const mergedTactics = { ...club.tactics, ...tactics };

    activeEngine = new WasmCareerEngine(JSON.stringify(currentState), 42);

    const updatedJson = activeEngine.update_tactics(clubId, JSON.stringify(mergedTactics));
    return mergeCareerState(currentState, JSON.parse(updatedJson) as GameState);
  } catch (err) {
    console.error('Error updating tactics on WASM:', err);
    return null;
  }
}

/**
 * Swaps two players via Rust WasmCareerEngine.
 */
export function swapPlayersWasm(currentState: GameState, clubId: number, idA: number, idB: number): GameState | null {
  if (!wasmInitialized) return null;

  try {
    activeEngine = new WasmCareerEngine(JSON.stringify(currentState), 42);

    const updatedJson = activeEngine.swap_players(clubId, idA, idB);
    return mergeCareerState(currentState, JSON.parse(updatedJson) as GameState);
  } catch (err) {
    console.error('Error swapping players on WASM:', err);
    return null;
  }
}

/**
 * Toggles a starter via Rust WasmCareerEngine.
 */
export function toggleStarterWasm(currentState: GameState, clubId: number, playerId: number): GameState | null {
  if (!wasmInitialized) return null;

  try {
    activeEngine = new WasmCareerEngine(JSON.stringify(currentState), 42);

    const updatedJson = activeEngine.toggle_starter(clubId, playerId);
    return mergeCareerState(currentState, JSON.parse(updatedJson) as GameState);
  } catch (err) {
    console.error('Error toggling starter on WASM:', err);
    return null;
  }
}

/**
 * Auto-selects the best 11 starters strictly according to natural positions:
 * - Goalkeepers strictly in goal (never in defense, midfield or attack)
 * - Centerbacks & fullbacks in defense
 * - Midfielders in midfield
 * - Forwards in attack
 * Based on highest strength and energy.
 */
export function autoSelectBestLineupWasm(
  currentState: GameState,
  clubId: number,
  formation?: string
): GameState | null {
  if (wasmInitialized) {
    try {
      activeEngine = new WasmCareerEngine(JSON.stringify(currentState), 42);
      const updatedJson = activeEngine.auto_select_best_lineup(clubId, formation ?? null);
      const parsed = mergeCareerState(currentState, JSON.parse(updatedJson) as GameState);
      parsed.clubs = parsed.clubs.map((c) => {
        const prev = currentState.clubs.find((p) => p.id === c.id);
        return prev ? { ...prev, ...c } : c;
      });
      return parsed;
    } catch (err) {
      console.warn('WASM auto_select_best_lineup failed, falling back to JS:', err);
    }
  }

  // JS Fallback
  const targetClub = currentState.clubs.find((c) => c.id === clubId);
  if (!targetClub) return null;

  const formationStr = formation || targetClub.tactics.formation || '4-4-2';
  const squad = [...targetClub.squad];

  let defTarget = 4;
  let midTarget = 4;
  let fwdTarget = 2;

  if (formationStr === '4-3-3') {
    defTarget = 4; midTarget = 3; fwdTarget = 3;
  } else if (formationStr === '3-5-2') {
    defTarget = 3; midTarget = 5; fwdTarget = 2;
  } else if (formationStr === '4-5-1') {
    defTarget = 4; midTarget = 5; fwdTarget = 1;
  } else if (formationStr === '5-3-2') {
    defTarget = 5; midTarget = 3; fwdTarget = 2;
  }

  const score = (p: Player) => {
    const avail = !p.injured && !p.suspended ? 1.0 : 0.05;
    return (p.strength * (p.energy / 100) + p.strength * 0.01) * avail;
  };

  const gks = squad.filter((p) => p.position === 'GOL').sort((a, b) => score(b) - score(a));
  const defs = squad.filter((p) => p.position === 'ZAG' || p.position === 'LAT').sort((a, b) => score(b) - score(a));
  const mids = squad.filter((p) => p.position === 'VOL' || p.position === 'MEI').sort((a, b) => score(b) - score(a));
  const fwds = squad.filter((p) => p.position === 'ATA').sort((a, b) => score(b) - score(a));

  const chosenIds = new Set<number>();
  const starters: Player[] = [];

  // 1. Goalkeeper (strictly 1, GK never outfield)
  if (gks.length > 0) {
    starters.push({ ...gks[0], isStarter: true });
    chosenIds.add(gks[0].id);
  }

  // 2. Defenders
  for (const d of defs) {
    if (starters.filter((p) => p.position === 'ZAG' || p.position === 'LAT').length >= defTarget) break;
    if (!chosenIds.has(d.id)) {
      starters.push({ ...d, isStarter: true });
      chosenIds.add(d.id);
    }
  }

  // 3. Midfielders
  for (const m of mids) {
    if (starters.filter((p) => p.position === 'VOL' || p.position === 'MEI').length >= midTarget) break;
    if (!chosenIds.has(m.id)) {
      starters.push({ ...m, isStarter: true });
      chosenIds.add(m.id);
    }
  }

  // 4. Forwards
  for (const f of fwds) {
    if (starters.filter((p) => p.position === 'ATA').length >= fwdTarget) break;
    if (!chosenIds.has(f.id)) {
      starters.push({ ...f, isStarter: true });
      chosenIds.add(f.id);
    }
  }

  // 5. Fill remaining outfield slots if shortage (GK never outfield)
  if (starters.length < 11) {
    const remainingOutfield = [...defs, ...mids, ...fwds]
      .filter((p) => !chosenIds.has(p.id))
      .sort((a, b) => score(b) - score(a));
    for (const p of remainingOutfield) {
      if (starters.length >= 11) break;
      starters.push({ ...p, isStarter: true });
      chosenIds.add(p.id);
    }
  }

  const bench = squad
    .filter((p) => !chosenIds.has(p.id))
    .map((p) => ({ ...p, isStarter: false }));

  const reorderedSquad = [...starters, ...bench];

  const captain = [...starters].sort((a, b) => (b.strength * 10 + b.age) - (a.strength * 10 + a.age))[0];
  const penalty = [...starters].filter((p) => p.position === 'ATA' || p.position === 'MEI').sort((a, b) => b.strength - a.strength)[0] || starters[0];
  const freeKick = [...starters].filter((p) => p.position === 'MEI' || p.position === 'VOL' || p.position === 'ATA').sort((a, b) => b.strength - a.strength)[0] || starters[0];
  const corner = [...starters].filter((p) => p.position === 'LAT' || p.position === 'MEI').sort((a, b) => b.strength - a.strength)[0] || starters[0];

  const updatedClubs = currentState.clubs.map((c) => {
    if (c.id !== clubId) return c;
    return {
      ...c,
      squad: reorderedSquad,
      tactics: {
        ...c.tactics,
        formation: formationStr as any,
        captainId: captain ? captain.id : c.tactics.captainId,
        penaltyTakerId: penalty ? penalty.id : c.tactics.penaltyTakerId,
        freeKickTakerId: freeKick ? freeKick.id : c.tactics.freeKickTakerId,
        cornerTakerId: corner ? corner.id : c.tactics.cornerTakerId,
      },
    };
  });

  return {
    ...currentState,
    clubs: updatedClubs,
  };
}

/**
 * Calculates asking price according to market rules (young bonus +20%, veteran discount -30%).
 */
export function calculateAskingPrice(marketValue: number, age: number): number {

  if (wasmInitialized) {
    try {
      return wasm_calculate_asking_price(marketValue, age);
    } catch (_) {}
  }
  if (age <= 23) {
    return Math.floor((marketValue * 12) / 10);
  } else if (age >= 32) {
    return Math.floor((marketValue * 7) / 10);
  }
  return marketValue;
}

/**
 * Calculates minimum demanded salary for contracts.
 */
export function calculateDemandedSalary(salary: number, marketValue: number): number {
  if (wasmInitialized) {
    try {
      return wasm_calculate_demanded_salary(salary, marketValue);
    } catch (_) {}
  }
  return Math.max(salary, Math.floor(marketValue / 100));
}

/**
 * Lists free agents via Rust WASM engine.
 */
export function getFreeAgentsWasm(currentState: GameState): Player[] {
  if (!wasmInitialized) return currentState.freeAgents || [];

  try {
    activeEngine = new WasmCareerEngine(JSON.stringify(currentState), 42);
    const json = activeEngine.get_free_agents();
    return JSON.parse(json) as Player[];
  } catch (err) {
    console.error('Error getting free agents from WASM:', err);
    return currentState.freeAgents || [];
  }
}

/**
 * Searches players across other clubs by filter.
 */
export function searchPlayersWasm(currentState: GameState, filter: MarketFilter): MarketSearchResult[] {
  if (currentState.schemaVersion === 2 || !wasmInitialized) {
    // JS Fallback
    const results: MarketSearchResult[] = [];
    const userClubId = currentState.userClubId;

    for (const club of currentState.clubs) {
      if (club.id === userClubId) continue;
      for (const p of club.squad) {
        if (filter.position && filter.position !== 'TODOS' && filter.position !== 'Todos' && p.position !== filter.position) {
          continue;
        }
        if (filter.minStrength !== undefined && p.strength < filter.minStrength) continue;
        if (filter.maxStrength !== undefined && p.strength > filter.maxStrength) continue;
        if (filter.minAge !== undefined && p.age < filter.minAge) continue;
        if (filter.maxAge !== undefined && p.age > filter.maxAge) continue;
        if (filter.maxValue !== undefined && p.marketValue > filter.maxValue) continue;
        if (filter.nameQuery && !p.name.toLowerCase().includes(filter.nameQuery.toLowerCase().trim())) continue;

        results.push({
          player: p,
          clubId: club.id,
          clubName: club.name,
          askingPrice: calculateAskingPrice(p.marketValue, p.age),
        });
      }
    }
    return results.sort((a, b) => b.player.strength - a.player.strength).slice(0, 150);
  }

  try {
    activeEngine = new WasmCareerEngine(JSON.stringify(currentState), 42);
    const json = activeEngine.search_players(JSON.stringify(filter));
    return JSON.parse(json) as MarketSearchResult[];
  } catch (err) {
    console.error('Error searching players in WASM:', err);
    return [];
  }
}

/**
 * Buys a player from another club.
 */
export function buyPlayerWasm(
  currentState: GameState,
  playerId: number,
  offerFee: number
): { success: boolean; state?: GameState; error?: string } {
  if (currentState.schemaVersion === 2 || !wasmInitialized) {
    // JS Fallback
    const userClub = currentState.clubs.find((c) => c.id === currentState.userClubId);
    if (!userClub) return { success: false, error: 'Clube do usuário não encontrado.' };
    if (userClub.squad.length >= 30) {
      return { success: false, error: 'Seu elenco já atingiu o limite máximo de 30 atletas.' };
    }

    const sellerClub = currentState.clubs.find(
      (c) => c.id !== userClub.id && c.squad.some((p) => p.id === playerId)
    );
    if (!sellerClub) return { success: false, error: 'Atleta não encontrado em nenhum clube adversário.' };
    const player = sellerClub.squad.find((p) => p.id === playerId)!;
    if (!canSell(sellerClub, player)) {
      return { success: false, error: 'O clube vendedor não pode liberar este atleta pois ficaria abaixo do limite mínimo de 16 jogadores.' };
    }
    const asking = calculateAskingPrice(player.marketValue, player.age);
    if (offerFee < asking) {
      return { success: false, error: `A proposta de R$ ${offerFee.toLocaleString('pt-BR')} foi recusada! O valor mínimo pedido é R$ ${asking.toLocaleString('pt-BR')}.` };
    }

    if (!canFundTransfer(userClub, offerFee, Math.round(player.salary / 4))) {
      return { success: false, error: 'Saldo insuficiente no caixa do clube para concretizar a compra.' };
    }

    const updatedClubs = currentState.clubs.map((c) => {
      if (c.id === userClub.id) {
        return {
          ...c,
          ...post(c, currentState.currentRound, 'expense', 'compras_atletas', `Compra de ${player.name}`, offerFee, `buy-${player.id}`),
          squad: [...c.squad, { ...player, isStarter: false, contractYears: 3 }],
        };
      }
      if (c.id === sellerClub.id) {
        return {
          ...c,
          ...post(c, currentState.currentRound, 'income', 'vendas_atletas', `Venda de ${player.name}`, offerFee, `sale-${player.id}`),
          squad: c.squad.filter((p) => p.id !== playerId),
        };
      }
      return c;
    });

    const updatedOffers = (currentState.transferOffers || []).filter((o) => o.playerId !== playerId);

    return {
      success: true,
      state: {
        ...currentState,
        clubs: updatedClubs,
        transferOffers: updatedOffers,
      },
    };
  }

  try {
    activeEngine = new WasmCareerEngine(JSON.stringify(currentState), 42);
    const updatedJson = activeEngine.buy_player(playerId, offerFee);
    return { success: true, state: mergeCareerState(currentState, JSON.parse(updatedJson) as GameState) };
  } catch (err: any) {
    const msg = typeof err === 'string' ? err : err?.message || 'Falha ao comprar jogador.';
    return { success: false, error: msg };
  }
}

/**
 * Signs a free agent.
 */
export function signFreeAgentWasm(
  currentState: GameState,
  playerId: number,
  years: number,
  offeredSalary?: number
): { success: boolean; state?: GameState; error?: string } {
  if (currentState.schemaVersion === 2 || !wasmInitialized) {
    const userClub = currentState.clubs.find((c) => c.id === currentState.userClubId);
    if (!userClub) return { success: false, error: 'Clube não encontrado.' };
    if (userClub.squad.length >= 30) {
      return { success: false, error: 'Seu elenco já atingiu o limite máximo de 30 atletas.' };
    }
    if (years < 1 || years > 5) {
      return { success: false, error: 'Duração de contrato deve ser de 1 a 5 anos.' };
    }

    const fa = (currentState.freeAgents || []).find((p) => p.id === playerId);
    if (!fa) return { success: false, error: 'Jogador livre não encontrado.' };

    const demanded = calculateDemandedSalary(fa.salary, fa.marketValue);
    const salary = offeredSalary ?? demanded;
    if (salary < demanded) {
      return { success: false, error: `Salário de R$ ${salary.toLocaleString('pt-BR')} recusado! O atleta exige no mínimo R$ ${demanded.toLocaleString('pt-BR')}/mês.` };
    }

    const bonus = salary;
    if (userClub.balance < bonus) {
      return { success: false, error: 'Saldo insuficiente para pagar o bônus de assinatura do atleta.' };
    }

    const updatedClubs = currentState.clubs.map((c) => {
      if (c.id === userClub.id) {
        return {
          ...c,
          ...post(c, currentState.currentRound, 'expense', 'outros', `Bônus de assinatura: ${fa.name}`, bonus, `sign-${fa.id}`),
          squad: [...c.squad, { ...fa, salary, contractYears: years, isStarter: false }],
        };
      }
      return c;
    });

    const updatedFa = (currentState.freeAgents || []).filter((p) => p.id !== playerId);

    return {
      success: true,
      state: {
        ...currentState,
        clubs: updatedClubs,
        freeAgents: updatedFa,
      },
    };
  }

  try {
    activeEngine = new WasmCareerEngine(JSON.stringify(currentState), 42);
    const updatedJson = activeEngine.sign_free_agent(playerId, years, offeredSalary ?? null);
    return { success: true, state: mergeCareerState(currentState, JSON.parse(updatedJson) as GameState) };
  } catch (err: any) {
    const msg = typeof err === 'string' ? err : err?.message || 'Falha ao contratar agente livre.';
    return { success: false, error: msg };
  }
}

/**
 * Releases a player into free agency.
 */
export function releasePlayerWasm(
  currentState: GameState,
  playerId: number
): { success: boolean; state?: GameState; error?: string } {
  if (currentState.schemaVersion === 2 || !wasmInitialized) {
    const userClub = currentState.clubs.find((c) => c.id === currentState.userClubId);
    if (!userClub) return { success: false, error: 'Clube não encontrado.' };
    if (userClub.squad.length <= 16) {
      return { success: false, error: 'Você não pode dispensar este atleta pois seu elenco ficaria abaixo do mínimo de 16 atletas.' };
    }

    const player = userClub.squad.find((p) => p.id === playerId);
    if (!player) return { success: false, error: 'Atleta não encontrado no elenco.' };
    if (!canSell(userClub, player)) return { success: false, error: 'A dispensa impediria uma escalação válida.' };

    const updatedClubs = currentState.clubs.map((c) => {
      if (c.id === userClub.id) {
        return {
          ...c,
          squad: c.squad.filter((p) => p.id !== playerId),
        };
      }
      return c;
    });

    const updatedFa = [
      ...(currentState.freeAgents || []),
      { ...player, isStarter: false, contractYears: 0 },
    ];

    const updatedOffers = (currentState.transferOffers || []).filter((o) => o.playerId !== playerId);

    return {
      success: true,
      state: {
        ...currentState,
        clubs: updatedClubs,
        freeAgents: updatedFa,
        transferOffers: updatedOffers,
      },
    };
  }

  try {
    activeEngine = new WasmCareerEngine(JSON.stringify(currentState), 42);
    const updatedJson = activeEngine.release_player(playerId);
    return { success: true, state: mergeCareerState(currentState, JSON.parse(updatedJson) as GameState) };
  } catch (err: any) {
    const msg = typeof err === 'string' ? err : err?.message || 'Falha ao dispensar jogador.';
    return { success: false, error: msg };
  }
}

/**
 * Generates AI transfer offers.
 */
export function generateAiOffersWasm(currentState: GameState): GameState | null {
  return runAiMarket(currentState);
}

/**
 * Accepts an AI offer.
 */
export function acceptAiOfferWasm(
  currentState: GameState,
  offerId: number
): { success: boolean; state?: GameState; error?: string } {
  if (currentState.schemaVersion === 2 || !wasmInitialized) {
    const userClub = currentState.clubs.find((c) => c.id === currentState.userClubId);
    if (!userClub) return { success: false, error: 'Clube do usuário não encontrado.' };
    if (userClub.squad.length <= 16) {
      return { success: false, error: 'Não é possível vender este jogador pois seu elenco ficaria abaixo do limite mínimo de 16 atletas.' };
    }

    const offer = (currentState.transferOffers || []).find((o) => o.id === offerId);
    if (!offer) return { success: false, error: 'Proposta não encontrada.' };
    const invalid = validOffer(currentState, offer);
    if (invalid) return { success: false, error: invalid, state: { ...currentState, transferOffers: (currentState.transferOffers || []).filter(o => o.id !== offerId) } };

    const buyerClub = currentState.clubs.find((c) => c.id === offer.fromClubId);
    if (!buyerClub) return { success: false, error: 'Clube comprador não encontrado.' };
    if (buyerClub.squad.length >= 30) return { success: false, error: 'O clube comprador está com o elenco lotado (máx 30 atletas).' };
    if (buyerClub.balance < offer.fee) return { success: false, error: 'O clube comprador não possui saldo suficiente.' };

    const player = userClub.squad.find((p) => p.id === offer.playerId);
    if (!player) return { success: false, error: 'Jogador não encontrado no elenco.' };

    const updatedClubs = currentState.clubs.map((c) => {
      if (c.id === userClub.id) {
        return {
          ...c,
          ...post(c, currentState.currentRound, 'income', 'vendas_atletas', `Venda de ${player.name}`, offer.fee, `sale-${player.id}`),
          squad: c.squad.filter((p) => p.id !== offer.playerId),
        };
      }
      if (c.id === buyerClub.id) {
        return {
          ...c,
          ...post(c, currentState.currentRound, 'expense', 'compras_atletas', `Compra de ${player.name}`, offer.fee, `buy-${player.id}`),
          squad: [...c.squad, { ...player, isStarter: false, contractYears: 3 }],
        };
      }
      return c;
    });

    const updatedOffers = (currentState.transferOffers || []).filter(
      (o) => o.id !== offerId && o.playerId !== offer.playerId
    );

    return {
      success: true,
      state: {
        ...currentState,
        clubs: updatedClubs,
        transferOffers: updatedOffers,
      },
    };
  }

  try {
    activeEngine = new WasmCareerEngine(JSON.stringify(currentState), 42);
    const updatedJson = activeEngine.accept_ai_offer(offerId);
    return { success: true, state: mergeCareerState(currentState, JSON.parse(updatedJson) as GameState) };
  } catch (err: any) {
    const msg = typeof err === 'string' ? err : err?.message || 'Falha ao aceitar proposta.';
    return { success: false, error: msg };
  }
}

/**
 * Rejects an AI offer.
 */
export function rejectAiOfferWasm(
  currentState: GameState,
  offerId: number
): { success: boolean; state?: GameState; error?: string } {
  if (!wasmInitialized) {
    const updatedOffers = (currentState.transferOffers || []).filter((o) => o.id !== offerId);
    return {
      success: true,
      state: { ...currentState, transferOffers: updatedOffers },
    };
  }

  try {
    activeEngine = new WasmCareerEngine(JSON.stringify(currentState), 42);
    const updatedJson = activeEngine.reject_ai_offer(offerId);
    return { success: true, state: mergeCareerState(currentState, JSON.parse(updatedJson) as GameState) };
  } catch (err: any) {
    const msg = typeof err === 'string' ? err : err?.message || 'Falha ao recusar proposta.';
    return { success: false, error: msg };
  }
}

/**
 * Renews player contract.
 */
export function renewContractWasm(
  currentState: GameState,
  playerId: number,
  years: number,
  newSalary: number
): { success: boolean; state?: GameState; error?: string } {
  if (!wasmInitialized) {
    const userClub = currentState.clubs.find((c) => c.id === currentState.userClubId);
    if (!userClub) return { success: false, error: 'Clube não encontrado.' };
    if (years < 1 || years > 5) return { success: false, error: 'Duração de contrato deve ser de 1 a 5 anos.' };

    const player = userClub.squad.find((p) => p.id === playerId);
    if (!player) return { success: false, error: 'Jogador não encontrado no elenco.' };

    const demanded = calculateDemandedSalary(player.salary, player.marketValue);
    if (newSalary < demanded) {
      return { success: false, error: `Salário de R$ ${newSalary.toLocaleString('pt-BR')} recusado! O atleta exige no mínimo R$ ${demanded.toLocaleString('pt-BR')}/mês.` };
    }

    const updatedClubs = currentState.clubs.map((c) => {
      if (c.id === userClub.id) {
        return {
          ...c,
          squad: c.squad.map((p) => (p.id === playerId ? { ...p, salary: newSalary, contractYears: years } : p)),
        };
      }
      return c;
    });

    return {
      success: true,
      state: { ...currentState, clubs: updatedClubs },
    };
  }

  try {
    activeEngine = new WasmCareerEngine(JSON.stringify(currentState), 42);
    const updatedJson = activeEngine.renew_contract(playerId, years, newSalary);
    return { success: true, state: mergeCareerState(currentState, JSON.parse(updatedJson) as GameState) };
  } catch (err: any) {
    const msg = typeof err === 'string' ? err : err?.message || 'Falha ao renovar contrato.';
    return { success: false, error: msg };
  }
}


/** The live match requires Rust; a second simulator would break save/replay semantics. */
export function commandMatchWasm(state: GameState, command: import('../types').MatchCommand): GameState {
  if (!wasmInitialized) throw new Error('O motor Rust ainda não está disponível. Aguarde o carregamento ou recarregue o aplicativo.');
  const parsed = JSON.parse(wasm_match_command(JSON.stringify(state), JSON.stringify(command))) as GameState;
  return { ...mergeCareerState(state, parsed), options: { ...state.options, ...parsed.options } };
}
