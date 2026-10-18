import type { ChampionshipRecord, Club, GameState, Manager, NewsArticle } from '../types/index.ts';
import type { SeasonMobilityResult } from './sportsMobility.ts';

export interface PrunedHistorySummary {
  seasonYear: number;
  recordsCount: number;
  competitions: string[];
}

/**
 * Executa a compactação e limpeza (Data Pruning) do estado de jogo na virada de temporada.
 *
 * Regra Inegociável #3:
 * Ao terminar uma temporada, o histórico detalhado minuto a minuto das partidas anteriores
 * deve ser compactado (guardando apenas campeão, vice, placar da final, promovidos/rebaixados,
 * artilheiros e histórico de treinadores). O save game deve manter-se sempre leve (< 2MB).
 */
export function prunePreviousSeasonData(state: GameState, mobility?: SeasonMobilityResult): GameState {
  const previousSeasonYear = state.seasonYear - 1;

  // 1. COMPACTAÇÃO DO HISTÓRICO DE CAMPEONATOS (ChampionshipRecord)
  let updatedHistory = (state.championshipHistory || []).map((record) => {
    // Mantém o registro enxuto
    const compacted: ChampionshipRecord = {
      id: record.id,
      seasonYear: record.seasonYear,
      competitionType: record.competitionType,
      competitionName: record.competitionName,
      championClubId: record.championClubId,
      championClubName: record.championClubName,
      championClubCrest: record.championClubCrest,
      runnerUpClubId: record.runnerUpClubId,
      runnerUpClubName: record.runnerUpClubName,
      runnerUpClubCrest: record.runnerUpClubCrest,
      topScorerName: record.topScorerName,
      topScorerClubName: record.topScorerClubName,
      topScorerGoals: record.topScorerGoals,
      managerName: record.managerName,
      finalScoreText: record.finalScoreText,
      userPositionText: record.userPositionText,
      userPrizeMoney: record.userPrizeMoney,
      promotedClubNames: record.promotedClubNames,
      relegatedClubNames: record.relegatedClubNames,
      promotedClubIds: record.promotedClubIds,
      relegatedClubIds: record.relegatedClubIds,
    };

    // Se temos os dados de mobilidade da temporada recém-concluída, anexa os promovidos/rebaixados
    if (mobility && record.seasonYear === previousSeasonYear) {
      if (record.competitionType === 'nacional') {
        // Série A: 4 rebaixados para Série B
        if (record.competitionName.includes('Série A') || !record.competitionName.includes('Série')) {
          compacted.relegatedClubNames = mobility.nationalRelegations
            .filter((m) => m.fromDivision === 1)
            .map((m) => m.clubName);
          compacted.relegatedClubIds = mobility.nationalRelegations
            .filter((m) => m.fromDivision === 1)
            .map((m) => m.clubId);
        } else if (record.competitionName.includes('Série B')) {
          compacted.promotedClubNames = mobility.nationalPromotions
            .filter((m) => m.fromDivision === 2)
            .map((m) => m.clubName);
          compacted.promotedClubIds = mobility.nationalPromotions
            .filter((m) => m.fromDivision === 2)
            .map((m) => m.clubId);
          compacted.relegatedClubNames = mobility.nationalRelegations
            .filter((m) => m.fromDivision === 2)
            .map((m) => m.clubName);
          compacted.relegatedClubIds = mobility.nationalRelegations
            .filter((m) => m.fromDivision === 2)
            .map((m) => m.clubId);
        } else if (record.competitionName.includes('Série C')) {
          compacted.promotedClubNames = mobility.nationalPromotions
            .filter((m) => m.fromDivision === 3)
            .map((m) => m.clubName);
          compacted.promotedClubIds = mobility.nationalPromotions
            .filter((m) => m.fromDivision === 3)
            .map((m) => m.clubId);
          compacted.relegatedClubNames = mobility.nationalRelegations
            .filter((m) => m.fromDivision === 3)
            .map((m) => m.clubName);
          compacted.relegatedClubIds = mobility.nationalRelegations
            .filter((m) => m.fromDivision === 3)
            .map((m) => m.clubId);
        }
      } else if (record.competitionType === 'estadual') {
        compacted.relegatedClubNames = mobility.stateRelegations.map((m) => m.clubName);
        compacted.promotedClubNames = mobility.statePromotions.map((m) => m.clubName);
      }
    }

    return compacted;
  });

  // 2. ELIMINAÇÃO DE EVENTOS MINUTO A MINUTO DE PARTIDAS PASSADAS
  // Assegura que nenhum fixture retenha o array detalhado de MatchEvent de temporadas anteriores
  const prunedCalendar = (state.calendar || []).map((f) => {
    if (f.played && f.events && f.events.length > 0) {
      return {
        ...f,
        events: undefined,
      };
    }
    return f;
  });

  // 3. DATA PRUNING DO FEED DE NOTÍCIAS (NewsFeed)
  // Mantém no máximo 40 notícias recentes/relevantes (evitando acúmulo de milhares de notícias em 5-10 temporadas)
  const prunedNewsFeed = (state.newsFeed || [])
    .filter((n) => n.isHeadline || n.category === 'demissao' || n.category === 'transferencia' || n.category === 'geral')
    .slice(0, 40);

  // 4. DATA PRUNING FINANCEIRO E HISTÓRICO DE CLUBES
  // Clubes da IA não necessitam de extratos semanais de 152 semanas nem livros contábeis completos
  const prunedClubs = (state.clubs || []).map((club: Club) => {
    const isHumanClub = club.id === state.userClubId;
    return {
      ...club,
      // Clube humano retém até 52 semanas (1 ano de extrato), IA retém apenas as últimas 4 semanas
      weeklyStatements: (club.weeklyStatements || []).slice(0, isHumanClub ? 52 : 4),
      // Livro contábil: humano retém até 50 transações recentes; IA é limpo
      financialLedger: isHumanClub ? (club.financialLedger || []).slice(0, 50) : [],
      // Histórico de público: limitado a 10 rodadas
      attendanceHistory: (club.attendanceHistory || []).slice(0, 10),
      // Ações de diretoria: limitadas a 10
      boardActions: (club.boardActions || []).slice(0, 10),
    };
  });

  // 5. DATA PRUNING DE TREINADORES (Managers)
  // Preserva integralmente o histórico de empregos (jobs) e títulos (titles), mas poda o log de eventos textuais
  const prunedManagers = (state.managers || []).map((manager: Manager) => ({
    ...manager,
    events: (manager.events || []).slice(0, 12),
    jobs: (manager.jobs || []).map((j) => ({
      clubId: j.clubId,
      clubName: j.clubName,
      startSeason: j.startSeason,
      startRound: j.startRound,
      endSeason: j.endSeason,
      endRound: j.endRound,
      reason: j.reason,
      wins: j.wins,
      draws: j.draws,
      losses: j.losses,
      points: j.points,
      initialBalance: j.initialBalance,
      initialSquadValue: j.initialSquadValue,
      initialExpectation: j.initialExpectation,
      initialOverdueWages: j.initialOverdueWages,
      finalScore: j.finalScore,
    })),
  }));

  // 6. PRUNING DE TORNEIOS INTERNACIONAIS CONCLUÍDOS
  const prunedWorldCup = state.worldCup?.status === 'finished'
    ? {
        seasonYear: state.worldCup.seasonYear,
        status: state.worldCup.status,
        champion: state.worldCup.champion,
        runnerUp: state.worldCup.runnerUp,
        bestPlayer: state.worldCup.bestPlayer,
        topScorer: state.worldCup.topScorer,
        groups: [],
        fixtures: [],
      }
    : state.worldCup;

  const prunedSuperMundial = state.superClubWorldCup?.status === 'finished'
    ? {
        seasonYear: state.superClubWorldCup.seasonYear,
        status: state.superClubWorldCup.status,
        participantClubIds: state.superClubWorldCup.participantClubIds,
        champion: state.superClubWorldCup.champion,
        runnerUp: state.superClubWorldCup.runnerUp,
        fixtures: [],
      }
    : state.superClubWorldCup;

  const prunedIntercontinental = state.intercontinentalCup?.status === 'finished'
    ? {
        seasonYear: state.intercontinentalCup.seasonYear,
        status: state.intercontinentalCup.status,
        participantClubIds: state.intercontinentalCup.participantClubIds,
        champion: state.intercontinentalCup.champion,
        runnerUp: state.intercontinentalCup.runnerUp,
        fixtures: [],
      }
    : state.intercontinentalCup;

  return {
    ...state,
    championshipHistory: updatedHistory,
    calendar: prunedCalendar,
    newsFeed: prunedNewsFeed,
    clubs: prunedClubs,
    managers: prunedManagers,
    worldCup: prunedWorldCup,
    superClubWorldCup: prunedSuperMundial,
    intercontinentalCup: prunedIntercontinental,
    transferOffers: [],
    roundAuctions: [],
    activeMatch: undefined,
    activeMatchFixtureId: undefined,
  };
}

/**
 * Compacta o JSON de um GameState usando a API nativa CompressionStream (gzip).
 * Retorna Uint8Array comprimido.
 */
export async function compressGameState(state: GameState): Promise<Uint8Array> {
  const json = JSON.stringify(state);
  if (typeof CompressionStream === 'function') {
    const stream = new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip')));
    const buf = await stream.arrayBuffer();
    return new Uint8Array(buf);
  }
  // Fallback se CompressionStream não estiver disponível
  return new TextEncoder().encode(json);
}

/**
 * Descompacta um payload de GameState (Uint8Array comprimido ou texto JSON).
 */
export async function decompressGameState(data: Uint8Array | string): Promise<GameState> {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as GameState;
    } catch {
      // Pode ser base64
      if (typeof Buffer !== 'undefined') {
        const buf = Buffer.from(data, 'base64');
        return decompressGameState(new Uint8Array(buf));
      }
      throw new Error('Formato de dados de save inválido.');
    }
  }

  // Verifica assinatura de header gzip (0x1f, 0x8b)
  const isGzip = data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
  if (isGzip && typeof DecompressionStream === 'function') {
    const stream = new Response(new Blob([data as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip')));
    const text = await stream.text();
    return JSON.parse(text) as GameState;
  }

  const text = new TextDecoder().decode(data);
  return JSON.parse(text) as GameState;
}

/**
 * Métricas de tamanho do GameState para diagnóstico e validação do limite de 2MB.
 */
export async function getGameStateMetrics(state: GameState): Promise<{
  uncompressedKb: number;
  compressedKb: number;
  isUnder2MB: boolean;
}> {
  const json = JSON.stringify(state);
  const uncompressedKb = json.length / 1024;
  const compressed = await compressGameState(state);
  const compressedKb = compressed.byteLength / 1024;

  return {
    uncompressedKb,
    compressedKb,
    isUnder2MB: compressedKb < 2048,
  };
}
