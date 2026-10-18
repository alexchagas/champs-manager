import type { Club, StandingRow, OtherLeagueStandings, LeagueInfo } from '../types/index.ts';
import { generateLeagueCalendar, initializeStandings, sortStandings, sortClubsByMeritocracy } from '../data/calendarGenerator.ts';
import { getLeaguesByCountry, getClubsByLeague, getAllLeagues } from '../data/teamsDatabase.ts';
import { getStateDivisionInfo, getUserStateDivision, getStateLeagueRule } from '../data/stateLeagueFormulas.ts';
import { getDivisionConfig, formatGroupLabel } from '../data/leagueConfigurations.ts';
import {
  getContinentalTournamentField,
  SOUTH_AMERICA_COUNTRY_IDS,
  type ContinentalTournamentOptions,
} from '../data/continentalRepresentatives.ts';

// Países europeus / hemisfério norte com temporada cruzada (Agosto a Maio)
export const CROSS_SEASON_COUNTRY_IDS = new Set([
  65,  // Espanha
  97,  // Inglaterra
  104, // Itália
  3,   // Alemanha
  72,  // França
  154, // Portugal
  85,  // Holanda
  21,  // Bélgica
  186, // Suíça
  188, // Turquia
  162, // Rússia
  190, // Ucrânia
  62,  // Escócia
  15,  // Áustria
  54,  // Dinamarca
  148, // Noruega
  174, // Suécia
  52,  // Croácia
  152, // Polônia
  78,  // Grécia
]);

export function isCrossSeasonCountry(countryId: number): boolean {
  return CROSS_SEASON_COUNTRY_IDS.has(countryId);
}

/**
 * Pseudo-random generator simples e determinístico para resultados realistas
 */
function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Pré-simula uma quantidade de rodadas para uma liga fechada (ex: Turno 1 de 19 rodadas)
 * ou competição dividida em múltiplos grupos regionais (ex: Série D com 8 grupos de 8).
 */
export function preSimulateLeagueRounds(
  clubs: Club[],
  roundsToPlay: number,
  seed = 42,
  groupCount = 1
): StandingRow[] {
  const effectiveGroups = groupCount > 1 && clubs.length >= groupCount * 2 ? groupCount : 1;
  const teamsPerGroup = Math.max(1, Math.ceil(clubs.length / effectiveGroups));

  if (clubs.length < 2 || roundsToPlay <= 0) {
    return sortStandings(
      initializeStandings(
        clubs,
        effectiveGroups > 1
          ? (_c, idx) => formatGroupLabel(Math.min(effectiveGroups - 1, Math.floor(idx / teamsPerGroup)))
          : undefined
      )
    );
  }

  const rand = seededRandom(seed);
  const standingsMap = new Map<number, StandingRow>();
  clubs.forEach((c, idx) => {
    const groupLabel = effectiveGroups > 1
      ? formatGroupLabel(Math.min(effectiveGroups - 1, Math.floor(idx / teamsPerGroup)))
      : undefined;
    standingsMap.set(c.id, {
      clubId: c.id,
      clubName: c.name,
      primaryColor: c.primaryColor || '#3b82f6',
      points: 0,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      form: [],
      ...(groupLabel ? { group: groupLabel } : {}),
    });
  });

  const targetFixtures = (() => {
    if (effectiveGroups > 1) {
      const groupedFixtures = [];
      for (let gIdx = 0; gIdx < effectiveGroups; gIdx++) {
        const gClubs = clubs.slice(gIdx * teamsPerGroup, (gIdx + 1) * teamsPerGroup);
        if (gClubs.length >= 2) {
          groupedFixtures.push(
            ...generateLeagueCalendar(gClubs).filter((f) => f.round <= roundsToPlay)
          );
        }
      }
      groupedFixtures.sort((a, b) => a.round - b.round || (a.id || 0) - (b.id || 0) || a.homeClubId - b.homeClubId);
      return groupedFixtures;
    }
    const fixtures = generateLeagueCalendar(clubs).filter((f) => f.round <= roundsToPlay);
    fixtures.sort((a, b) => a.round - b.round || (a.id || 0) - (b.id || 0) || a.homeClubId - b.homeClubId);
    return fixtures;
  })();

  for (const fix of targetFixtures) {
    const home = clubs.find((c) => c.id === fix.homeClubId);
    const away = clubs.find((c) => c.id === fix.awayClubId);
    if (!home || !away) continue;

    const homeStrength = (home.reputation || 2) * 15 + (home.level || 10) * 2 + 5; // +5 vantagem de casa
    const awayStrength = (away.reputation || 2) * 15 + (away.level || 10) * 2;
    const diff = (homeStrength - awayStrength) / 20; // -2.0 a +2.0

    // Cálculo de gols
    const homeExpected = Math.max(0.3, 1.4 + diff * 0.5 + (rand() - 0.5) * 1.2);
    const awayExpected = Math.max(0.2, 1.0 - diff * 0.4 + (rand() - 0.5) * 1.2);

    const homeGoals = Math.min(6, Math.max(0, Math.round(homeExpected + (rand() < 0.2 ? 1 : 0))));
    const awayGoals = Math.min(6, Math.max(0, Math.round(awayExpected + (rand() < 0.15 ? 1 : 0))));

    const homeRow = standingsMap.get(home.id)!;
    const awayRow = standingsMap.get(away.id)!;

    homeRow.played += 1;
    homeRow.goalsFor += homeGoals;
    homeRow.goalsAgainst += awayGoals;
    homeRow.goalDiff = homeRow.goalsFor - homeRow.goalsAgainst;

    awayRow.played += 1;
    awayRow.goalsFor += awayGoals;
    awayRow.goalsAgainst += homeGoals;
    awayRow.goalDiff = awayRow.goalsFor - awayRow.goalsAgainst;

    if (homeGoals > awayGoals) {
      homeRow.won += 1;
      homeRow.points += 3;
      homeRow.form.unshift('V');
      awayRow.lost += 1;
      awayRow.form.unshift('D');
    } else if (homeGoals === awayGoals) {
      homeRow.drawn += 1;
      homeRow.points += 1;
      homeRow.form.unshift('E');
      awayRow.drawn += 1;
      awayRow.points += 1;
      awayRow.form.unshift('E');
    } else {
      homeRow.lost += 1;
      homeRow.form.unshift('D');
      awayRow.won += 1;
      awayRow.points += 3;
      awayRow.form.unshift('V');
    }

    if (homeRow.form.length > 5) homeRow.form.length = 5;
    if (awayRow.form.length > 5) awayRow.form.length = 5;
  }

  return sortStandings(Array.from(standingsMap.values()));
}

/**
 * Inicializa as outras divisões nacionais simultâneas do mesmo país do clube principal (ex: Séries B, C e D do Brasil)
 */
export function buildInitialNationalDivisions(
  sourceClub: Club,
  allAvailableClubs: Club[] = [],
  seasonYear = 2026
): OtherLeagueStandings[] {
  const sourceCountryId = sourceClub.countryId || 29;
  const sameCountryLeagues = getLeaguesByCountry(sourceCountryId);
  const userDivision = sourceClub.division >= 5 && sourceCountryId === 29 ? 4 : (sourceClub.division ?? 1);
  const results: OtherLeagueStandings[] = [];

  for (const sLeague of sameCountryLeagues) {
    if (sLeague.division === userDivision) continue;
    if (sLeague.division > 4) continue;

    let sClubs = allAvailableClubs && allAvailableClubs.length > 0
      ? allAvailableClubs.filter((c) => c.countryId === sourceCountryId && c.division === sLeague.division)
      : [];
    if (sClubs.length < 4) {
      sClubs = getClubsByLeague(sLeague);
    }
    if (sClubs.length < 2) continue;

    const divConfig = getDivisionConfig(sourceCountryId, sLeague.division, sourceClub.countryName, sClubs.length);
    const groupCount = Math.max(1, divConfig.groupCount || 1);
    const targetTeamCount = divConfig.teamCount || 20;
    const fieldClubs = groupCount > 1
      ? sClubs.slice(0, targetTeamCount)
      : (sClubs.length > targetTeamCount ? sClubs.slice(0, targetTeamCount) : sClubs);
    const teamsPerGroup = Math.max(2, Math.floor(fieldClubs.length / groupCount));
    const turns = divConfig.rounds === 1 ? 1 : 2;
    const totalRounds = (teamsPerGroup - 1) * turns;

    const standings = preSimulateLeagueRounds(
      fieldClubs,
      0,
      1000 + sourceCountryId * 13 + sLeague.division * 7,
      groupCount
    );

    const divLetter = sLeague.division === 1 ? 'A' : sLeague.division === 2 ? 'B' : sLeague.division === 3 ? 'C' : sLeague.division === 4 ? 'D' : '';
    const canonicalName = sourceCountryId === 29 && divLetter
      ? `Brasileirão Série ${divLetter}`
      : (divConfig.name || `${sLeague.name} ${sLeague.divisionName}`);

    results.push({
      id: `league-${sourceCountryId}-div${sLeague.division}`,
      countryId: sourceCountryId,
      countryName: sourceClub.countryName || 'Brasil',
      leagueName: canonicalName,
      division: sLeague.division,
      seasonLabel: `${seasonYear}`,
      currentRound: 0,
      totalRounds,
      standings,
    });
  }

  return results;
}

/**
 * Constrói a divisão estadual paralela (ex: 2ª Divisão se o usuário estiver na Série A1,
 * ou 1ª Divisão com todos os gigantes se o usuário estiver na Série A2).
 * Não fabrica torneios nem clubes inexistentes.
 */
export function buildInitialStateDivisions(
  sourceClub: Club,
  allAvailableClubs: Club[] = [],
  seasonYear = 2026,
  promotedStateClubIds?: number[],
  relegatedStateClubIds?: number[]
): OtherLeagueStandings[] {
  const sourceCountryId = sourceClub.countryId || 29;
  if (sourceCountryId !== 29) return [];
  const stateCode = sourceClub.stateCode;
  if (!stateCode) return [];

  const userStateDiv = getUserStateDivision(
    sourceClub,
    allAvailableClubs,
    seasonYear,
    promotedStateClubIds,
    relegatedStateClubIds
  );

  if (!userStateDiv.parallelTier) return [];

  const parallel = userStateDiv.parallelTier;
  const fieldClubs = parallel.fieldClubs;
  const totalTeams = fieldClubs.length;
  if (totalTeams < 4) return [];

  const stateRule = getStateLeagueRule(stateCode);
  const isFormula7 = parallel.tier === 1 && stateRule?.formulaId === 7 && totalTeams === 16;
  const groupCount = isFormula7 ? 4 : 1;
  const totalRounds = isFormula7 ? 12 : (totalTeams - 1) * 2;

  const standings = preSimulateLeagueRounds(
    fieldClubs,
    0,
    2000 + (sourceClub.stateId || 1) * 17 + parallel.tier * 31,
    groupCount
  );

  return [{
    id: `state-${stateCode.toLowerCase()}-div${parallel.tier}`,
    countryId: 29,
    countryName: 'Brasil',
    leagueName: parallel.leagueName,
    division: parallel.tier,
    seasonLabel: `${seasonYear}`,
    currentRound: 0,
    totalRounds,
    standings,
  }];
}

/**
 * Inicializa a competição continental irmã na América do Sul (ex: Copa Sul-Americana com 32 clubes em 8 grupos A-H
 * quando o torneio principal é a Copa Libertadores, ou vice-versa), garantindo que ambas apareçam simultaneamente nas abas.
 */
export function buildInitialContinentalCompetitions(
  sourceClub: Club,
  allAvailableClubs: Club[] = [],
  seasonYear = 2026,
  options?: ContinentalTournamentOptions
): OtherLeagueStandings[] {
  const sourceCountryId = sourceClub.countryId || 29;
  if (!SOUTH_AMERICA_COUNTRY_IDS.has(sourceCountryId)) return [];

  const primaryContinental = getContinentalTournamentField(sourceClub, allAvailableClubs, undefined, {
    teamCount: 32,
    seed: seasonYear,
    ...options,
  });
  const sisterType = primaryContinental.type === 'sulamericana' ? 'libertadores' : 'sulamericana';
  const primaryIds = new Set(primaryContinental.clubs.map((c) => c.id));
  const sisterContinental = getContinentalTournamentField(sourceClub, allAvailableClubs, undefined, {
    forceType: sisterType,
    userParticipates: false,
    teamCount: 32,
    seed: seasonYear + 100,
    excludeClubIds: primaryIds,
    ...options,
  });
  if (sisterContinental.clubs.length < 16) return [];

  const sisterGroupCount = Math.max(1, Math.ceil(sisterContinental.clubs.length / 4));
  return [
    {
      id: 'continental-sister',
      countryId: sourceCountryId,
      countryName: sourceClub.countryName || 'América do Sul',
      leagueName: sisterContinental.name,
      division: 1,
      seasonLabel: `${seasonYear}`,
      currentRound: 0,
      totalRounds: 6,
      standings: preSimulateLeagueRounds(
        sisterContinental.clubs,
        0,
        3000 + seasonYear,
        sisterGroupCount
      ),
    },
  ];
}

/**
 * Inicializa tabelas e ligas ativas de outros países selecionados.
 * Se o país principal for o Brasil (Janeiro), ligas europeias ativas começam com 19 rodadas já jogadas.
 */
export function buildInitialActiveOtherLeagues(
  sourceClub: Club,
  activeCountryIds: number[] = [],
  allAvailableClubs: Club[] = [],
  seasonYear = 2026
): OtherLeagueStandings[] {
  const sourceCountryId = sourceClub.countryId || 29;
  const isSourceBrazil = sourceCountryId === 29;
  const otherCountryIds = activeCountryIds.filter((cid) => cid !== sourceCountryId);

  const results: OtherLeagueStandings[] = [];

  for (const cid of otherCountryIds) {
    const leagues = getLeaguesByCountry(cid);
    const topLeague = leagues.find((l) => l.division === 1) || leagues[0];
    if (!topLeague) continue;

    // Buscar clubes da liga
    let leagueClubs = getClubsByLeague(topLeague);
    if (leagueClubs.length < 4) {
      leagueClubs = allAvailableClubs.filter((c) => c.countryId === cid && (c.division === 1 || !c.division));
    }
    if (leagueClubs.length < 4) {
      leagueClubs = allAvailableClubs.filter((c) => c.countryId === cid);
    }
    if (leagueClubs.length < 2) continue;

    const totalTeams = leagueClubs.length;
    const totalRounds = (totalTeams - 1) * 2;
    const halfRounds = totalTeams - 1;

    let roundsToPreSimulate = 0;
    let seasonLabel = `${seasonYear}`;

    const isOtherCrossSeason = isCrossSeasonCountry(cid);

    if (isSourceBrazil && isOtherCrossSeason) {
      // Começou no Brasil em Janeiro de 2026: Europa começou em Agosto de 2025, já jogou o 1º Turno (19 rodadas)
      roundsToPreSimulate = halfRounds;
      seasonLabel = `${seasonYear - 1}/${seasonYear}`;
    } else if (!isSourceBrazil && !isOtherCrossSeason) {
      // Começou na Europa em Agosto de 2026: Brasil começou em Janeiro de 2026, já jogou o 1º Turno
      roundsToPreSimulate = halfRounds;
      seasonLabel = `${seasonYear}`;
    } else {
      // Calendários alinhados (ex: ambos da América do Sul ou ambos da Europa)
      roundsToPreSimulate = 0;
      seasonLabel = isOtherCrossSeason ? `${seasonYear - 1}/${seasonYear}` : `${seasonYear}`;
    }

    const standings = preSimulateLeagueRounds(
      leagueClubs,
      roundsToPreSimulate,
      1000 + cid * 37
    );

    const countryName = topLeague.countryName || (cid === 65 ? 'Espanha' : cid === 97 ? 'Inglaterra' : cid === 104 ? 'Itália' : 'Liga Internacional');
    const flagEmoji = cid === 65 ? '🇪🇸' : cid === 97 ? '🏴󠁧󠁢󠁥󠁮󠁧󠁿' : cid === 104 ? '🇮🇹' : cid === 3 ? '🇩🇪' : cid === 72 ? '🇫🇷' : cid === 154 ? '🇵🇹' : '🌍';

    results.push({
      id: `league-${cid}-${topLeague.division || 1}`,
      countryId: cid,
      countryName,
      leagueName: `${topLeague.name || 'Liga Nacional'} ${flagEmoji}`,
      division: topLeague.division || 1,
      seasonLabel,
      currentRound: roundsToPreSimulate,
      totalRounds,
      standings,
    });
  }

  return results;
}

export interface LeagueAdvanceContext {
  currentSemester?: 1 | 2;
  currentRound?: number;
  totalRounds?: number;
  currentDate?: string;
}

/**
 * Atualiza o progresso das outras ligas ativas à medida que o save avança.
 */
export function advanceOtherLeaguesProgress(
  currentOtherLeagues: OtherLeagueStandings[],
  userProgressRatio: number, // 0.0 (início) a 1.0 (fim do ano do usuário)
  allClubs: Club[],
  isMainBrazil = true,
  context?: LeagueAdvanceContext
): OtherLeagueStandings[] {
  return currentOtherLeagues.map((entry) => {
    const isOtherCrossSeason = isCrossSeasonCountry(entry.countryId);
    const halfRounds = Math.floor(entry.totalRounds / 2);

    let targetRound = entry.currentRound;

    if (context && isMainBrazil) {
      if (entry.id.startsWith('state-')) {
        // Estaduais (1º semestre: semanas 0 a 13)
        if (context.currentSemester === 1) {
          const stateProgress = Math.min(1.0, Math.max(0.0, (context.currentRound || 1) / 14));
          targetRound = Math.min(entry.totalRounds, Math.round(entry.totalRounds * stateProgress));
        } else {
          // 2º semestre: estaduais já estão 100% finalizados
          targetRound = entry.totalRounds;
        }
      } else if (entry.id.startsWith('league-29-div')) {
        // Séries nacionais (A, B, C, D) no Brasil (2º semestre: a partir da semana 14)
        if (context.currentSemester === 1) {
          targetRound = 0;
        } else {
          const natProgress = Math.min(
            1.0,
            Math.max(0.0, ((context.currentRound || 14) - 13) / Math.max(1, (context.totalRounds || 38) - 13))
          );
          targetRound = Math.min(entry.totalRounds, Math.round(entry.totalRounds * natProgress));
        }
      } else if (entry.id === 'continental-sister') {
        // Fase de grupos continental (2º semestre: semanas 16 a 26 = 6 rodadas)
        if (context.currentSemester === 1) {
          targetRound = 0;
        } else {
          const contRound = Math.max(0, (context.currentRound || 14) - 14);
          const contPlayed = Math.min(entry.totalRounds, Math.floor(contRound / 2));
          targetRound = contPlayed;
        }
      } else if (isOtherCrossSeason) {
        if (userProgressRatio <= 0.4) {
          const europeanSpringProgress = userProgressRatio / 0.4;
          targetRound = Math.min(entry.totalRounds, Math.round(halfRounds + (entry.totalRounds - halfRounds) * europeanSpringProgress));
        } else if (userProgressRatio > 0.4 && userProgressRatio < 0.6) {
          targetRound = entry.totalRounds;
        } else {
          const autumnProgress = (userProgressRatio - 0.6) / 0.4;
          targetRound = Math.min(halfRounds, Math.max(1, Math.round(halfRounds * autumnProgress)));
        }
      } else {
        targetRound = Math.min(entry.totalRounds, Math.round(entry.totalRounds * userProgressRatio));
      }
    } else if (isMainBrazil && isOtherCrossSeason) {
      // Sem context explícito (fallback linear / compatibilidade com testes legados)
      if (userProgressRatio <= 0.4) {
        const europeanSpringProgress = userProgressRatio / 0.4;
        targetRound = Math.min(entry.totalRounds, Math.round(halfRounds + (entry.totalRounds - halfRounds) * europeanSpringProgress));
      } else if (userProgressRatio > 0.4 && userProgressRatio < 0.6) {
        targetRound = entry.totalRounds;
      } else {
        const autumnProgress = (userProgressRatio - 0.6) / 0.4;
        targetRound = Math.min(halfRounds, Math.max(1, Math.round(halfRounds * autumnProgress)));
      }
    } else {
      // Progressão linear proporcional
      targetRound = Math.min(entry.totalRounds, Math.round(entry.totalRounds * userProgressRatio));
    }

    if (targetRound === entry.currentRound) {
      return entry;
    }

    // Obter clubes da liga preservando o agrupamento original
    const clubsById = new Map(allClubs.map((c) => [c.id, c]));
    const distinctGroups = Array.from(new Set(entry.standings.map((s) => s.group).filter(Boolean)));
    const groupCount = distinctGroups.length > 1 ? distinctGroups.length : 1;

    const orderedRows = groupCount > 1
      ? [...entry.standings].sort((a, b) => (a.group || '').localeCompare(b.group || '') || a.clubId - b.clubId)
      : entry.standings;

    const leagueClubs = orderedRows
      .map((s) => clubsById.get(s.clubId))
      .filter((c): c is Club => Boolean(c));

    if (leagueClubs.length < 2) return entry;

    // Semente determinística e estável por liga para garantir integridade e invariância histórica rodada a rodada
    const stableSeed = 2000 + entry.countryId * 41 + (entry.division || 1) * 31;

    const newStandings = preSimulateLeagueRounds(
      leagueClubs,
      targetRound,
      stableSeed,
      groupCount
    );

    return {
      ...entry,
      currentRound: targetRound,
      standings: newStandings,
    };
  });
}
