import type { Club, StandingRow, OtherLeagueStandings, LeagueInfo } from '../types/index.ts';
import { generateLeagueCalendar, initializeStandings, sortStandings, sortClubsByMeritocracy } from '../data/calendarGenerator.ts';
import { getLeaguesByCountry, getClubsByLeague, getAllLeagues } from '../data/teamsDatabase.ts';
import { getStateDivisionInfo } from '../data/stateLeagueFormulas.ts';

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
 * Pré-simula uma quantidade de rodadas para uma liga fechada (ex: Turno 1 de 19 rodadas).
 */
export function preSimulateLeagueRounds(
  clubs: Club[],
  roundsToPlay: number,
  seed = 42
): StandingRow[] {
  if (clubs.length < 2 || roundsToPlay <= 0) {
    return sortStandings(initializeStandings(clubs));
  }

  const rand = seededRandom(seed);
  const standingsMap = new Map<number, StandingRow>();
  for (const c of clubs) {
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
    });
  }

  const allFixtures = generateLeagueCalendar(clubs);
  const targetFixtures = allFixtures.filter((f) => f.round <= roundsToPlay);

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
  const userDivision = sourceClub.division ?? 1;
  const results: OtherLeagueStandings[] = [];

  for (const sLeague of sameCountryLeagues) {
    if (sLeague.division === userDivision) continue;
    if (sLeague.division > 4) continue;

    let sClubs = getClubsByLeague(sLeague);
    if (sClubs.length < 4) {
      sClubs = allAvailableClubs.filter((c) => c.countryId === sourceCountryId && c.division === sLeague.division);
    }
    if (sClubs.length < 2) continue;

    const fieldClubs = sClubs.length > 20 ? sClubs.slice(0, 20) : sClubs;
    const totalTeams = fieldClubs.length;
    const totalRounds = (totalTeams - 1) * 2;

    const standings = preSimulateLeagueRounds(
      fieldClubs,
      0,
      1000 + sourceCountryId * 13 + sLeague.division * 7
    );

    const divLetter = sLeague.division === 1 ? 'A' : sLeague.division === 2 ? 'B' : sLeague.division === 3 ? 'C' : sLeague.division === 4 ? 'D' : '';
    const canonicalName = sourceCountryId === 29 && divLetter
      ? `Brasileirão Série ${divLetter}`
      : `${sLeague.name} ${sLeague.divisionName}`;

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
 * Constrói a 2ª Divisão Estadual de forma segura apenas onde restarem pelo menos 8 clubes reais
 * após a seleção do elenco de elite do estadual.
 * Não fabrica torneios nem clubes inexistentes.
 */
export function buildInitialStateDivisions(
  sourceClub: Club,
  allAvailableClubs: Club[] = [],
  seasonYear = 2026
): OtherLeagueStandings[] {
  const sourceCountryId = sourceClub.countryId || 29;
  if (sourceCountryId !== 29) return [];
  const stateCode = sourceClub.stateCode;
  if (!stateCode) return [];

  const divInfo = getStateDivisionInfo(stateCode, allAvailableClubs);
  if (!divInfo.hasSecondDivision || !divInfo.tier2) return [];

  const sameState = (c: Club) => c.countryId === 29 && (
    (sourceClub.stateId != null && c.stateId === sourceClub.stateId) ||
    (sourceClub.stateCode != null && c.stateCode === sourceClub.stateCode)
  );

  const rawStateClubs = allAvailableClubs.filter(sameState);
  const sortedStateClubs = sortClubsByMeritocracy(rawStateClubs);
  const eliteCount = divInfo.eliteClubsCount;

  // Os clubes de elite ocupam as primeiras vagas
  const eliteClubs = sortedStateClubs.slice(0, eliteCount);
  const eliteIds = new Set(eliteClubs.map((c) => c.id));
  eliteIds.add(sourceClub.id);

  // Clubes reais remanescentes no estado
  const remainingClubs = sortedStateClubs.filter((c) => !eliteIds.has(c.id));
  if (remainingClubs.length < 8) return [];

  const targetSize = Math.min(remainingClubs.length, 16);
  const fieldClubs = remainingClubs.slice(0, targetSize);
  const totalTeams = fieldClubs.length;
  const totalRounds = (totalTeams - 1) * 2;

  const standings = preSimulateLeagueRounds(
    fieldClubs,
    0,
    2000 + (sourceClub.stateId || 1) * 17
  );

  return [{
    id: `state-${stateCode.toLowerCase()}-div2`,
    countryId: 29,
    countryName: 'Brasil',
    leagueName: divInfo.tier2.leagueName,
    division: 2,
    seasonLabel: `${seasonYear}`,
    currentRound: 0,
    totalRounds,
    standings,
  }];
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

/**
 * Atualiza o progresso das outras ligas ativas à medida que o save avança.
 */
export function advanceOtherLeaguesProgress(
  currentOtherLeagues: OtherLeagueStandings[],
  userProgressRatio: number, // 0.0 (início) a 1.0 (fim do ano do usuário)
  allClubs: Club[],
  isMainBrazil = true
): OtherLeagueStandings[] {
  return currentOtherLeagues.map((entry) => {
    const isOtherCrossSeason = isCrossSeasonCountry(entry.countryId);
    const halfRounds = Math.floor(entry.totalRounds / 2);

    let targetRound = entry.currentRound;

    if (isMainBrazil && isOtherCrossSeason) {
      // No Brasil: de Jan a Mai (ratio 0.0 a 0.4), a Europa joga as rodadas 19 a 38
      if (userProgressRatio <= 0.4) {
        const europeanSpringProgress = userProgressRatio / 0.4; // 0.0 a 1.0
        targetRound = Math.min(entry.totalRounds, Math.round(halfRounds + (entry.totalRounds - halfRounds) * europeanSpringProgress));
      } else if (userProgressRatio > 0.4 && userProgressRatio < 0.6) {
        // Junho e Julho: Férias e pré-temporada europeia (campeão definido, 38/38)
        targetRound = entry.totalRounds;
      } else {
        // Agosto a Dezembro (ratio 0.6 a 1.0): Nova temporada europeia 2026/27 (rodadas 1 a 19)
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

    // Obter clubes da liga
    const leagueClubIds = new Set(entry.standings.map((s) => s.clubId));
    const leagueClubs = allClubs.filter((c) => leagueClubIds.has(c.id));

    if (leagueClubs.length < 2) return entry;

    const newStandings = preSimulateLeagueRounds(
      leagueClubs,
      targetRound,
      2000 + entry.countryId * 41 + targetRound
    );

    return {
      ...entry,
      currentRound: targetRound,
      standings: newStandings,
    };
  });
}
