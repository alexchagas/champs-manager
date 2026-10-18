import type { Club, GameState, MatchFixture, NewsArticle, StandingRow } from '../types/index.ts';
import { getStateDivisionInfo, getStateLeagueRule } from '../data/stateLeagueFormulas.ts';
import { getDivisionConfig, COUNTRY_LEAGUE_PRESETS } from '../data/leagueConfigurations.ts';

export interface MobilityMovement {
  clubId: number;
  clubName: string;
  fromDivision: number;
  toDivision: number;
  type: 'promotion' | 'relegation';
  reason: string;
}

export interface StateMobilityMovement {
  clubId: number;
  clubName: string;
  stateCode: string;
  fromTier: 1 | 2;
  toTier: 1 | 2;
  type: 'promotion' | 'relegation';
}

export interface SeasonMobilityResult {
  updatedClubs: Club[];
  nationalPromotions: MobilityMovement[];
  nationalRelegations: MobilityMovement[];
  nextPromotedStateClubIds: number[];
  nextRelegatedStateClubIds: number[];
  statePromotions: StateMobilityMovement[];
  stateRelegations: StateMobilityMovement[];
  newsArticles: NewsArticle[];
  userPromoted: boolean;
  userRelegated: boolean;
  userNewDivision: number;
  userNewStateTier: 1 | 2;
}

/**
 * Ordenação padrão de tabela com critérios de desempate canônicos
 */
export function sortStandingRows(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => {
    return (
      b.points - a.points ||
      b.won - a.won ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      a.clubId - b.clubId
    );
  });
}

/**
 * Obtém a tabela final de qualquer divisão nacional (esteja ela ativa com o usuário ou em nationalDivisions)
 */
export function getNationalStandingsForDivision(state: GameState, division: number): StandingRow[] {
  const userClub = state.clubs.find((c) => c.id === state.userClubId) || state.clubs[0];
  const userDiv = userClub.division >= 5 && (userClub.countryId || 29) === 29 ? 4 : (userClub.division ?? 1);

  if (userDiv === division && state.standingsNacional && state.standingsNacional.length > 0) {
    return sortStandingRows(state.standingsNacional);
  }

  const external = state.nationalDivisions?.find((d) => d.division === division);
  if (external && external.standings && external.standings.length > 0) {
    return sortStandingRows(external.standings);
  }

  return [];
}

/**
 * Identifica os 4 clubes que sobem da Série D para a Série C.
 * No regulamento da CBF, os 4 semifinalistas garantem o acesso à Série C.
 */
export function determineSerieDPromotedClubs(
  state: GameState,
  serieDStandings: StandingRow[]
): number[] {
  // Se o usuário disputou a Série D no calendário principal, verifica os semifinalistas
  const serieDSemis = state.calendar.filter(
    (f) => f.competitionType === 'nacional' && f.stage === 'Semifinal'
  );
  if (serieDSemis.length > 0) {
    const semiClubIds = new Set<number>();
    for (const f of serieDSemis) {
      if (f.homeClubId > 0) semiClubIds.add(f.homeClubId);
      if (f.awayClubId > 0) semiClubIds.add(f.awayClubId);
    }
    const ids = Array.from(semiClubIds).filter((id) => id < 990000);
    if (ids.length === 4) {
      return ids;
    }
  }

  // Fallback / Série D simulada em grupos:
  // Série D possui 8 grupos (A a H). Coleta o 1º colocado de cada um dos 8 grupos
  // e seleciona os 4 melhores por pontuação / saldo de gols.
  const groupWinners: StandingRow[] = [];
  const groups = 'ABCDEFGH'.split('');
  for (const grp of groups) {
    const inGroup = serieDStandings.filter((r) => r.group === grp);
    if (inGroup.length > 0) {
      const sorted = sortStandingRows(inGroup);
      groupWinners.push(sorted[0]);
    }
  }

  if (groupWinners.length >= 4) {
    const bestWinners = sortStandingRows(groupWinners).slice(0, 4);
    return bestWinners.map((r) => r.clubId);
  }

  // Fallback geral: os 4 melhores da classificação geral da Série D
  return sortStandingRows(serieDStandings).slice(0, 4).map((r) => r.clubId);
}

/**
 * Calcula a mobilidade desportiva nacional e estadual para a virada de ano.
 * Regras genéricas aplicadas por igual à IA e ao utilizador.
 */
export function computeSeasonMobility(state: GameState): SeasonMobilityResult {
  const userClub = state.clubs.find((c) => c.id === state.userClubId) || state.clubs[0];
  const userCountryId = userClub.countryId || 29;
  const isBrazil = userCountryId === 29;
  const nextYear = state.seasonYear + 1;

  const nationalPromotions: MobilityMovement[] = [];
  const nationalRelegations: MobilityMovement[] = [];
  const clubsMap = new Map<number, Club>(state.clubs.map((c) => [c.id, { ...c }]));

  let userPromoted = false;
  let userRelegated = false;
  let userNewDivision = userClub.division ?? 1;

  if (isBrazil) {
    // 1. Brasileirão Série A <-> Série B
    const serieA = getNationalStandingsForDivision(state, 1);
    const serieB = getNationalStandingsForDivision(state, 2);
    const serieC = getNationalStandingsForDivision(state, 3);
    const serieD = getNationalStandingsForDivision(state, 4);

    // Série A Z4 (17º ao 20º caem para a Série B)
    if (serieA.length >= 20) {
      const z4A = serieA.slice(16, 20);
      for (const row of z4A) {
        nationalRelegations.push({
          clubId: row.clubId,
          clubName: row.clubName,
          fromDivision: 1,
          toDivision: 2,
          type: 'relegation',
          reason: '17º ao 20º colocado da Série A (Z4)',
        });
        const c = clubsMap.get(row.clubId);
        if (c) {
          c.division = 2;
          c.divisionName = 'Série B';
        }
        if (row.clubId === userClub.id) {
          userRelegated = true;
          userNewDivision = 2;
        }
      }
    }

    // Série B G4 (1º ao 4º sobem para a Série A)
    if (serieB.length >= 4) {
      const g4B = serieB.slice(0, 4);
      for (const row of g4B) {
        nationalPromotions.push({
          clubId: row.clubId,
          clubName: row.clubName,
          fromDivision: 2,
          toDivision: 1,
          type: 'promotion',
          reason: '1º ao 4º colocado da Série B (G4)',
        });
        const c = clubsMap.get(row.clubId);
        if (c) {
          c.division = 1;
          c.divisionName = 'Série A';
        }
        if (row.clubId === userClub.id) {
          userPromoted = true;
          userNewDivision = 1;
        }
      }
    }

    // Série B Z4 (17º ao 20º caem para a Série C)
    if (serieB.length >= 20) {
      const z4B = serieB.slice(16, 20);
      for (const row of z4B) {
        nationalRelegations.push({
          clubId: row.clubId,
          clubName: row.clubName,
          fromDivision: 2,
          toDivision: 3,
          type: 'relegation',
          reason: '17º ao 20º colocado da Série B (Z4)',
        });
        const c = clubsMap.get(row.clubId);
        if (c) {
          c.division = 3;
          c.divisionName = 'Série C';
        }
        if (row.clubId === userClub.id) {
          userRelegated = true;
          userNewDivision = 3;
        }
      }
    }

    // Série C G4 (1º ao 4º sobem para a Série B)
    if (serieC.length >= 4) {
      const g4C = serieC.slice(0, 4);
      for (const row of g4C) {
        nationalPromotions.push({
          clubId: row.clubId,
          clubName: row.clubName,
          fromDivision: 3,
          toDivision: 2,
          type: 'promotion',
          reason: '1º ao 4º colocado da Série C (G4)',
        });
        const c = clubsMap.get(row.clubId);
        if (c) {
          c.division = 2;
          c.divisionName = 'Série B';
        }
        if (row.clubId === userClub.id) {
          userPromoted = true;
          userNewDivision = 2;
        }
      }
    }

    // Série C Z4 (17º ao 20º caem para a Série D)
    if (serieC.length >= 20) {
      const z4C = serieC.slice(16, 20);
      for (const row of z4C) {
        nationalRelegations.push({
          clubId: row.clubId,
          clubName: row.clubName,
          fromDivision: 3,
          toDivision: 4,
          type: 'relegation',
          reason: '17º ao 20º colocado da Série C (Z4)',
        });
        const c = clubsMap.get(row.clubId);
        if (c) {
          c.division = 4;
          c.divisionName = 'Série D';
        }
        if (row.clubId === userClub.id) {
          userRelegated = true;
          userNewDivision = 4;
        }
      }
    }

    // Série D G4 (Os 4 semifinalistas sobem para a Série C)
    if (serieD.length >= 4) {
      const promotedIds = determineSerieDPromotedClubs(state, serieD);
      for (const pId of promotedIds) {
        const row = serieD.find((r) => r.clubId === pId);
        const name = row?.clubName || clubsMap.get(pId)?.name || 'Clube da Série D';
        nationalPromotions.push({
          clubId: pId,
          clubName: name,
          fromDivision: 4,
          toDivision: 3,
          type: 'promotion',
          reason: 'Semifinalista do Brasileirão Série D',
        });
        const c = clubsMap.get(pId);
        if (c) {
          c.division = 3;
          c.divisionName = 'Série C';
        }
        if (pId === userClub.id) {
          userPromoted = true;
          userNewDivision = 3;
        }
      }
    }
  } else {
    // Países internacionais (Inglaterra, Espanha, Itália, França, Alemanha, Portugal, etc.)
    const countryConfig = COUNTRY_LEAGUE_PRESETS[userCountryId];
    if (countryConfig && countryConfig.divisions.length > 1) {
      for (let i = 0; i < countryConfig.divisions.length - 1; i++) {
        const upperDiv = countryConfig.divisions[i];
        const lowerDiv = countryConfig.divisions[i + 1];

        const upperStandings = getNationalStandingsForDivision(state, upperDiv.division);
        const lowerStandings = getNationalStandingsForDivision(state, lowerDiv.division);

        const relegCount = upperDiv.relegationDirect || 3;
        const promoCount = relegCount;

        // Rebaixados da divisão superior
        if (upperStandings.length >= upperDiv.teamCount) {
          const zCount = upperStandings.slice(upperStandings.length - relegCount);
          for (const row of zCount) {
            nationalRelegations.push({
              clubId: row.clubId,
              clubName: row.clubName,
              fromDivision: upperDiv.division,
              toDivision: lowerDiv.division,
              type: 'relegation',
              reason: `Zona de rebaixamento da ${upperDiv.name}`,
            });
            const c = clubsMap.get(row.clubId);
            if (c) {
              c.division = lowerDiv.division;
              c.divisionName = lowerDiv.name;
            }
            if (row.clubId === userClub.id) {
              userRelegated = true;
              userNewDivision = lowerDiv.division;
            }
          }
        }

        // Promovidos da divisão inferior
        if (lowerStandings.length >= promoCount) {
          const gCount = lowerStandings.slice(0, promoCount);
          for (const row of gCount) {
            nationalPromotions.push({
              clubId: row.clubId,
              clubName: row.clubName,
              fromDivision: lowerDiv.division,
              toDivision: upperDiv.division,
              type: 'promotion',
              reason: `Zona de acesso da ${lowerDiv.name}`,
            });
            const c = clubsMap.get(row.clubId);
            if (c) {
              c.division = upperDiv.division;
              c.divisionName = upperDiv.name;
            }
            if (row.clubId === userClub.id) {
              userPromoted = true;
              userNewDivision = upperDiv.division;
            }
          }
        }
      }
    }
  }

  // 2. Mobilidade Estadual (Estaduais Módulos A1 <-> A2 no Brasil)
  let nextPromotedStateClubIds: number[] = [...(state.promotedStateClubIds || [])];
  let nextRelegatedStateClubIds: number[] = [...(state.relegatedStateClubIds || [])];
  const statePromotions: StateMobilityMovement[] = [];
  const stateRelegations: StateMobilityMovement[] = [];
  let userNewStateTier: 1 | 2 = state.stateTier ?? 1;

  if (isBrazil && userClub.stateCode) {
    const divInfo = getStateDivisionInfo(userClub.stateCode, Array.from(clubsMap.values()));
    const stateRule = getStateLeagueRule(userClub.stateCode);

    if (divInfo.hasSecondDivision) {
      const currentTier = state.stateTier ?? 1;
      const rebaixadosCount = stateRule?.rebaixados ?? 2;
      const promovidosCount = rebaixadosCount;

      // Obter tabelas de Tier 1 e Tier 2
      let tier1Standings: StandingRow[] = [];
      let tier2Standings: StandingRow[] = [];

      if (currentTier === 1) {
        tier1Standings = state.standingsEstadual || [];
        tier2Standings = state.stateDivisions?.find((d) => d.division === 2)?.standings || [];
      } else {
        tier2Standings = state.standingsEstadual || [];
        tier1Standings = state.stateDivisions?.find((d) => d.division === 1)?.standings || [];
      }

      // Rebaixados do Módulo A1 (Tier 1)
      if (tier1Standings.length > rebaixadosCount) {
        const sortedTier1 = sortStandingRows(tier1Standings);
        const relegated = sortedTier1.slice(sortedTier1.length - rebaixadosCount);
        for (const row of relegated) {
          stateRelegations.push({
            clubId: row.clubId,
            clubName: row.clubName,
            stateCode: userClub.stateCode,
            fromTier: 1,
            toTier: 2,
            type: 'relegation',
          });
          nextRelegatedStateClubIds.push(row.clubId);
          nextPromotedStateClubIds = nextPromotedStateClubIds.filter((id) => id !== row.clubId);
          if (row.clubId === userClub.id) {
            userNewStateTier = 2;
          }
        }
      }

      // Promovidos do Módulo A2 (Tier 2)
      if (tier2Standings.length >= promovidosCount) {
        const sortedTier2 = sortStandingRows(tier2Standings);
        const promoted = sortedTier2.slice(0, promovidosCount);
        for (const row of promoted) {
          statePromotions.push({
            clubId: row.clubId,
            clubName: row.clubName,
            stateCode: userClub.stateCode,
            fromTier: 2,
            toTier: 1,
            type: 'promotion',
          });
          nextPromotedStateClubIds.push(row.clubId);
          nextRelegatedStateClubIds = nextRelegatedStateClubIds.filter((id) => id !== row.clubId);
          if (row.clubId === userClub.id) {
            userNewStateTier = 1;
          }
        }
      }
    }
  }

  // Desduplica IDs de estado
  nextPromotedStateClubIds = Array.from(new Set(nextPromotedStateClubIds));
  nextRelegatedStateClubIds = Array.from(new Set(nextRelegatedStateClubIds));

  // 3. Geração de Notícias Automáticas de Mobilidade
  const newsArticles: NewsArticle[] = [];
  const baseTimestamp = Date.now();

  // Notícia do clube do jogador (se promovido ou rebaixado)
  if (userPromoted) {
    const targetName = userNewDivision === 1 ? 'Série A' : userNewDivision === 2 ? 'Série B' : 'Série C';
    newsArticles.push({
      id: `mobility_user_promo_${baseTimestamp}`,
      round: 0,
      category: 'geral',
      title: `FESTA DA TORCIDA! ${userClub.name.toUpperCase()} GARANTE O ACESSO À ${targetName.toUpperCase()}!`,
      subtitle: `Campanha memorável coroa o acesso à elite na temporada ${nextYear}`,
      content: `O ${userClub.name} carimbou seu passaporte para a disputa da ${targetName} na próxima temporada. A diretoria comemorou a conquista e já projeta os reforços para a nova divisão.`,
      clubId: userClub.id,
      clubName: userClub.name,
      clubCrest: userClub.crestUrl,
      date: `${nextYear}-01-01`,
      isHeadline: true,
      badgeText: 'ACESSO NACIONAL',
      read: false,
    });
  } else if (userRelegated) {
    const targetName = userNewDivision === 2 ? 'Série B' : userNewDivision === 3 ? 'Série C' : 'Série D';
    newsArticles.push({
      id: `mobility_user_releg_${baseTimestamp}`,
      round: 0,
      category: 'geral',
      title: `CRISE: ${userClub.name.toUpperCase()} É REBAIXADO PARA A ${targetName.toUpperCase()}!`,
      subtitle: `Queda confirmada no encerramento da temporada ${state.seasonYear}`,
      content: `O ${userClub.name} não resistiu à zona de rebaixamento e disputará a ${targetName} em ${nextYear}. A diretoria convocou reunião de emergência para reformulação do elenco.`,
      clubId: userClub.id,
      clubName: userClub.name,
      clubCrest: userClub.crestUrl,
      date: `${nextYear}-01-01`,
      isHeadline: true,
      badgeText: 'REBAIXAMENTO',
      read: false,
    });
  }

  // Notícia de mobilidade estadual do jogador
  if (statePromotions.some((p) => p.clubId === userClub.id)) {
    newsArticles.push({
      id: `mobility_user_state_promo_${baseTimestamp}`,
      round: 0,
      category: 'geral',
      title: `HISTÓRICO! ${userClub.name.toUpperCase()} CONQUISTA O ACESSO À ELITE ESTADUAL!`,
      subtitle: `Clube retorna à 1ª Divisão Estadual para o ano de ${nextYear}`,
      content: `Com grande campanha na divisão de acesso, o ${userClub.name} assegurou sua vaga entre os grandes da elite estadual para a próxima temporada.`,
      clubId: userClub.id,
      clubName: userClub.name,
      clubCrest: userClub.crestUrl,
      date: `${nextYear}-01-01`,
      isHeadline: true,
      badgeText: 'ACESSO ESTADUAL',
      read: false,
    });
  } else if (stateRelegations.some((r) => r.clubId === userClub.id)) {
    newsArticles.push({
      id: `mobility_user_state_releg_${baseTimestamp}`,
      round: 0,
      category: 'geral',
      title: `DECEPÇÃO: ${userClub.name.toUpperCase()} CAI PARA A 2ª DIVISÃO ESTADUAL!`,
      subtitle: `Rebaixamento estadual confirmado para a temporada ${nextYear}`,
      content: `Em campanha aquém do esperado, o ${userClub.name} não evitou o descenso e terá de disputar a 2ª Divisão Estadual no início da próxima temporada.`,
      clubId: userClub.id,
      clubName: userClub.name,
      clubCrest: userClub.crestUrl,
      date: `${nextYear}-01-01`,
      isHeadline: true,
      badgeText: 'DESCENSO ESTADUAL',
      read: false,
    });
  }

  // Notícia resumo do quadro geral de acessos e descensos nacionais
  if (nationalPromotions.length > 0 || nationalRelegations.length > 0) {
    const promoNamesA = nationalPromotions.filter((p) => p.toDivision === 1).map((p) => p.clubName).join(', ');
    const relegNamesA = nationalRelegations.filter((r) => r.fromDivision === 1).map((r) => r.clubName).join(', ');
    const promoNamesB = nationalPromotions.filter((p) => p.toDivision === 2).map((p) => p.clubName).join(', ');
    const relegNamesB = nationalRelegations.filter((r) => r.fromDivision === 2).map((r) => r.clubName).join(', ');

    let summaryText = `A CBF e federações homologaram as promoções e rebaixamentos para a temporada ${nextYear}:\n\n`;
    if (promoNamesA) summaryText += `• Promovidos à Série A: ${promoNamesA}\n`;
    if (relegNamesA) summaryText += `• Rebaixados à Série B: ${relegNamesA}\n`;
    if (promoNamesB) summaryText += `• Promovidos à Série B: ${promoNamesB}\n`;
    if (relegNamesB) summaryText += `• Rebaixados à Série C: ${relegNamesB}\n`;

    newsArticles.push({
      id: `mobility_summary_${baseTimestamp}`,
      round: 0,
      category: 'geral',
      title: `QUADRO OFICIAL DE ACESSOS E DESCENSOS PARA ${nextYear}`,
      subtitle: `Confira a nova composição das divisões nacionais`,
      content: summaryText.trim(),
      date: `${nextYear}-01-01`,
      badgeText: 'MERCADO / LIGAS',
      read: false,
    });
  }

  return {
    updatedClubs: Array.from(clubsMap.values()),
    nationalPromotions,
    nationalRelegations,
    nextPromotedStateClubIds,
    nextRelegatedStateClubIds,
    statePromotions,
    stateRelegations,
    newsArticles,
    userPromoted,
    userRelegated,
    userNewDivision,
    userNewStateTier,
  };
}
