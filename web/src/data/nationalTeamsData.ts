import type { Club, MatchFixture, Player, StandingRow, NationalTeam, WorldCupGroup, WorldCupTournament, SuperClubWorldCup, IntercontinentalCup, NationalTeamOffer, NationalCallup, Manager, NewsArticle } from '../types/index.ts';
import { getCountryFlag } from './countryFlags.ts';
import { getOfficialDates } from './officialCalendars.ts';
import { generateLeagueCalendar, initializeStandings, sortStandings } from './calendarGenerator.ts';
import { simulateFullMatch } from '../engine/simulationEngine.ts';

// Catalog of 32 official World Cup participating nations aligned with Brasfoot assets
export interface NationalTeamSeed {
  countryId: number;
  code: string;
  name: string;
  reputation: number; // 1-5
  pot: 1 | 2 | 3 | 4;
  isElite?: boolean;
}

export const WORLD_CUP_QUALIFIED_TEAMS: NationalTeamSeed[] = [
  // Pot 1: Elite seeds & top world giants
  { countryId: 29, code: 'BRA', name: 'Brasil', reputation: 5, pot: 1, isElite: true },
  { countryId: 11, code: 'ARG', name: 'Argentina', reputation: 5, pot: 1, isElite: true },
  { countryId: 72, code: 'FRA', name: 'França', reputation: 5, pot: 1, isElite: true },
  { countryId: 3, code: 'ALE', name: 'Alemanha', reputation: 5, pot: 1, isElite: true },
  { countryId: 65, code: 'ESP', name: 'Espanha', reputation: 5, pot: 1, isElite: true },
  { countryId: 97, code: 'ING', name: 'Inglaterra', reputation: 5, pot: 1, isElite: true },
  { countryId: 104, code: 'ITA', name: 'Itália', reputation: 5, pot: 1, isElite: true },
  { countryId: 154, code: 'POR', name: 'Portugal', reputation: 5, pot: 1, isElite: true },

  // Pot 2: Strong tier
  { countryId: 85, code: 'HOL', name: 'Holanda', reputation: 4, pot: 2 },
  { countryId: 195, code: 'URU', name: 'Uruguai', reputation: 4, pot: 2 },
  { countryId: 52, code: 'CRO', name: 'Croácia', reputation: 4, pot: 2 },
  { countryId: 21, code: 'BEL', name: 'Bélgica', reputation: 4, pot: 2 },
  { countryId: 46, code: 'COL', name: 'Colômbia', reputation: 4, pot: 2 },
  { countryId: 54, code: 'DIN', name: 'Dinamarca', reputation: 4, pot: 2 },
  { countryId: 180, code: 'SUI', name: 'Suíça', reputation: 4, pot: 2 },
  { countryId: 131, code: 'MEX', name: 'México', reputation: 4, pot: 2 },

  // Pot 3: Medium competitive contenders
  { countryId: 68, code: 'EUA', name: 'Estados Unidos', reputation: 3, pot: 3 },
  { countryId: 107, code: 'JAP', name: 'Japão', reputation: 3, pot: 3 },
  { countryId: 129, code: 'MAR', name: 'Marrocos', reputation: 3, pot: 3 },
  { countryId: 169, code: 'SEN', name: 'Senegal', reputation: 3, pot: 3 },
  { countryId: 49, code: 'CSR', name: 'Coreia do Sul', reputation: 3, pot: 3 },
  { countryId: 171, code: 'SER', name: 'Sérvia', reputation: 3, pot: 3 },
  { countryId: 152, code: 'POL', name: 'Polônia', reputation: 3, pot: 3 },
  { countryId: 42, code: 'CHI', name: 'Chile', reputation: 3, pot: 3 },

  // Pot 4: Emerging & challenging nations
  { countryId: 14, code: 'AUS', name: 'Austrália', reputation: 2, pot: 4 },
  { countryId: 36, code: 'CAM', name: 'Camarões', reputation: 2, pot: 4 },
  { countryId: 141, code: 'NIG', name: 'Nigéria', reputation: 2, pot: 4 },
  { countryId: 60, code: 'EQU', name: 'Equador', reputation: 2, pot: 4 },
  { countryId: 38, code: 'CAN', name: 'Canadá', reputation: 2, pot: 4 },
  { countryId: 51, code: 'CRS', name: 'Costa Rica', reputation: 2, pot: 4 },
  { countryId: 9, code: 'ARS', name: 'Arábia Saudita', reputation: 2, pot: 4 },
  { countryId: 57, code: 'EGI', name: 'Egito', reputation: 2, pot: 4 },
];

/** Additional authentic national teams pool available for offers or friendly tournaments */
export const ADDITIONAL_NATIONAL_TEAMS: NationalTeamSeed[] = [
  { countryId: 179, code: 'SUE', name: 'Suécia', reputation: 3, pot: 3 },
  { countryId: 142, code: 'NOR', name: 'Noruega', reputation: 3, pot: 3 },
  { countryId: 192, code: 'TUR', name: 'Turquia', reputation: 3, pot: 3 },
  { countryId: 193, code: 'UCR', name: 'Ucrânia', reputation: 3, pot: 3 },
  { countryId: 150, code: 'PAR', name: 'Paraguai', reputation: 3, pot: 3 },
  { countryId: 151, code: 'PER', name: 'Peru', reputation: 3, pot: 3 },
  { countryId: 159, code: 'RTC', name: 'República Tcheca', reputation: 3, pot: 3 },
  { countryId: 160, code: 'ROM', name: 'Romênia', reputation: 2, pot: 4 },
  { countryId: 1, code: 'AFS', name: 'África do Sul', reputation: 2, pot: 4 },
  { countryId: 26, code: 'BOL', name: 'Bolívia', reputation: 1, pot: 4 },
  { countryId: 198, code: 'VEN', name: 'Venezuela', reputation: 2, pot: 4 },
];

/**
 * Quadrennial cycle check: FIFA World Cup is played every 4 years in even years (2026, 2030, 2034, 2038).
 */
export function isWorldCupYear(seasonYear: number): boolean {
  return seasonYear % 4 === 2;
}

/**
 * Super Club World Cup check: played in odd pre-World Cup years (2029, 2033, 2037).
 */
export function isSuperClubWorldCupYear(seasonYear: number): boolean {
  return (seasonYear + 1) % 4 === 2 && seasonYear % 2 !== 0;
}

/**
 * Intercontinental Cup check: annual in December.
 */
export function isIntercontinentalYear(_seasonYear: number): boolean {
  return true;
}

/**
 * Builds a full 23-player national squad matching authentic Brasfoot requirements:
 * At least 2 goalkeepers and 15 outfield players (standard 23 players: 3 GK, 7 DEF, 8 MID, 5 ATT).
 */
export function buildNationalTeamSquad(
  countryId: number,
  reputation: number,
  clubsPool: Club[] = []
): Player[] {
  // Collect matching players from available clubs pool
  const matchingPlayers: Player[] = [];
  for (const club of clubsPool) {
    if (club.countryId === countryId) {
      for (const p of club.squad) {
        matchingPlayers.push({ ...p });
      }
    }
  }

  // Sort by strength descending
  matchingPlayers.sort((a, b) => b.strength - a.strength);

  const gks = matchingPlayers.filter(p => p.position === 'GOL');
  const defs = matchingPlayers.filter(p => p.position === 'ZAG' || p.position === 'LAT');
  const mids = matchingPlayers.filter(p => p.position === 'VOL' || p.position === 'MEI');
  const atts = matchingPlayers.filter(p => p.position === 'ATA');

  // Realistic strength scaling matching teamsDatabase.json (max 71, median 26)
  // Rep 5 (Elite): ~54-62; Rep 4: ~46-53; Rep 3: ~38-45; Rep 2: ~30-37; Rep 1: ~24-30
  const targetBaseStrength = 22 + reputation * 7;
  let nextId = 900000 + countryId * 100;

  const generatePlayer = (pos: 'GOL' | 'LAT' | 'ZAG' | 'VOL' | 'MEI' | 'ATA', i: number): Player => {
    const strengthVar = Math.floor(Math.random() * 7) - 3;
    const str = Math.min(72, Math.max(22, targetBaseStrength + strengthVar));
    return {
      id: nextId++,
      name: `${pos} ${i + 1}`,
      age: 22 + Math.floor(Math.random() * 10),
      position: pos,
      foot: Math.random() > 0.3 ? 'D' : 'E',
      strength: str,
      energy: 100,
      salary: str * 12000,
      marketValue: str * 350000,
      isStarter: i < 11,
      isStar: str >= 54,
      isWorldTop: str >= 64,
      skill1: 'Armação',
      skill2: 'Finalização',
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      injured: false,
      suspended: false,
      contractYears: 3,
    };
  };

  const squad: Player[] = [];

  // 3 Goalkeepers
  for (let i = 0; i < 3; i++) {
    squad.push(gks[i] || generatePlayer('GOL', i));
  }
  // 7 Defenders (4 ZAG, 3 LAT)
  for (let i = 0; i < 7; i++) {
    squad.push(defs[i] || generatePlayer(i % 2 === 0 ? 'ZAG' : 'LAT', i));
  }
  // 8 Midfielders (4 VOL, 4 MEI)
  for (let i = 0; i < 8; i++) {
    squad.push(mids[i] || generatePlayer(i % 2 === 0 ? 'VOL' : 'MEI', i));
  }
  // 5 Attackers
  for (let i = 0; i < 5; i++) {
    squad.push(atts[i] || generatePlayer('ATA', i));
  }

  // Ensure first 11 are marked starters
  squad.forEach((p, idx) => {
    p.isStarter = idx < 11;
  });

  return squad;
}

/**
 * Builds all 32 NationalTeam objects with shirts and metadata.
 */
export function initializeNationalTeams(clubsPool: Club[] = []): NationalTeam[] {
  return WORLD_CUP_QUALIFIED_TEAMS.map((seed) => {
    const flag = getCountryFlag(seed.countryId);
    const shirtUrl = `/selecoes/camisas/${seed.code}.png`;
    const shirt2Url = `/selecoes/camisas2/${seed.code}.png`;
    const squad = buildNationalTeamSquad(seed.countryId, seed.reputation, clubsPool);

    return {
      id: 9000 + seed.countryId,
      name: seed.name,
      countryId: seed.countryId,
      code: seed.code,
      reputation: seed.reputation,
      flag,
      shirtUrl,
      shirt2Url,
      isElite: seed.isElite ?? (seed.reputation >= 5),
      coach: `Técnico da ${seed.name}`,
      squad,
      tactics: {
        formation: '4-4-2',
        mentality: 'Equilibrada',
        penaltyTakerId: squad[10]?.id || 0,
        freeKickTakerId: squad[9]?.id || 0,
        cornerTakerId: squad[8]?.id || 0,
        captainId: squad[0]?.id || 0,
      },
    };
  });
}

/**
 * Converts a NationalTeam into a pseudo-Club object for the simulation engine.
 */
export function nationalTeamToClub(nt: NationalTeam): Club {
  return {
    id: nt.id,
    name: nt.name,
    countryId: nt.countryId,
    reputation: nt.reputation,
    stadium: `Estádio Nacional de ${nt.name}`,
    capacity: 75000,
    coach: nt.coach,
    primaryColor: '#10b981',
    secondaryColor: '#f59e0b',
    balance: 50000000,
    ticketPrice: 50,
    crestUrl: nt.shirtUrl,
    crestMiniUrl: nt.shirtUrl,
    squad: nt.squad,
    tactics: nt.tactics || {
      formation: '4-4-2',
      mentality: 'Equilibrada',
      penaltyTakerId: nt.squad[10]?.id || 0,
      freeKickTakerId: nt.squad[9]?.id || 0,
      cornerTakerId: nt.squad[8]?.id || 0,
      captainId: nt.squad[0]?.id || 0,
    },
  };
}

/**
 * Generates official national team job offers based on manager reputation and career titles.
 * Rules aligned with Brasfoot:
 * - Low reputation (1-2 stars): Minor nations accept any coach.
 * - Medium reputation (3-4 stars): Requires reputation >= 3 or at least 1 career title.
 * - Elite nations (5 stars: Brazil, Argentina, France, Germany): Requires reputation >= 4 and at least 2 titles.
 */
export function getAvailableNationalTeamOffers(
  manager: Manager,
  seasonYear: number,
  allTeams: NationalTeam[]
): NationalTeamOffer[] {
  const titlesCount = manager.titles?.length || 0;
  const managerRep = manager.reputation || 1;

  const eligibleTeams = allTeams.filter((team) => {
    if (team.isElite || team.reputation >= 5) {
      return managerRep >= 4 && titlesCount >= 2;
    }
    if (team.reputation >= 3) {
      return managerRep >= 3 || titlesCount >= 1;
    }
    return true; // reputation 1-2 accepts any coach
  });

  // Pick up to 4 varied offers (one lower, one medium, and one high if eligible)
  const offers: NationalTeamOffer[] = [];
  let offerId = 1;

  // Shuffle candidate pool deterministically
  const shuffled = [...eligibleTeams].sort((a, b) => b.reputation - a.reputation);
  const selected = shuffled.slice(0, 4);

  for (const team of selected) {
    offers.push({
      id: offerId++,
      nationalTeamId: team.id,
      nationalTeamName: team.name,
      countryId: team.countryId,
      code: team.code,
      flag: team.flag,
      reputation: team.reputation,
      date: `${seasonYear}-06-01`,
      status: 'pending',
    });
  }

  return offers;
}

/**
 * Evaluates and calls up top players from the user's club for their national teams.
 * Players with isStar, isWorldTop, or high strength are called up and appreciate in market value.
 */
export function evaluateUserSquadCallups(
  userClub: Club,
  seasonYear: number,
  nationalTeams: NationalTeam[]
): { callups: NationalCallup[]; newsArticles: NewsArticle[] } {
  const callups: NationalCallup[] = [];
  const newsArticles: NewsArticle[] = [];
  const teamByCountry = new Map(nationalTeams.map(t => [t.countryId, t]));

  for (const player of userClub.squad) {
    // Determine player's nationality (from club countryId or default 29 Brazil)
    const playerCountryId = userClub.countryId || 29;
    const nt = teamByCountry.get(playerCountryId);
    if (!nt) continue;

    // Minimum strength threshold tailored to national team reputation:
    // Rep 5 (Elite): >= 48 (or isStar/isWorldTop)
    // Rep 4: >= 40
    // Rep 3: >= 32
    // Rep 1-2 (Minor nations): >= 22 (accessible for lower divisions and modest clubs)
    const minStrengthRequired =
      nt.reputation >= 5 ? 48 :
      nt.reputation >= 4 ? 40 :
      nt.reputation >= 3 ? 32 : 22;

    const isDeserving =
      player.isWorldTop ||
      player.isStar ||
      player.strength >= minStrengthRequired;

    if (!isDeserving) continue;

    const boostPct = player.isWorldTop ? 35 : player.isStar ? 25 : 20;
    const currentVal = player.marketValue || (player.strength * 200000);
    const boostedVal = Math.round(currentVal * (1 + boostPct / 100));

    const callup: NationalCallup = {
      playerId: player.id,
      playerName: player.name,
      clubId: userClub.id,
      countryId: playerCountryId,
      nationalTeamName: nt.name,
      tournamentName: 'Copa do Mundo FIFA',
      marketValueBoostPercent: boostPct,
      originalMarketValue: currentVal,
      boostedMarketValue: boostedVal,
      date: `${seasonYear}-06-05`,
    };

    callups.push(callup);

    newsArticles.push({
      id: `callup_${player.id}_${seasonYear}`,
      round: 18,
      category: 'geral',
      title: `CONVOCAÇÃO OFICIAL: ${player.name} vai à Copa do Mundo!`,
      subtitle: `${nt.flag} O craque do ${userClub.name} foi chamado pela Seleção ${nt.name}`,
      content: `O técnico da Seleção ${nt.name} anunciou a lista final para a Copa do Mundo FIFA ${seasonYear}. O destaque ${player.name} (${player.position}, força ${player.strength}) está confirmado entre os convocados e deve valorizar consideravelmente no mercado internacional!`,
      clubId: userClub.id,
      clubName: userClub.name,
      clubCrest: userClub.crestMiniUrl || userClub.crestUrl,
      relatedPlayerName: player.name,
      relatedPlayerPosition: player.position,
      date: `${seasonYear}-06-05`,
      isHeadline: true,
      badgeText: 'COPA DO MUNDO',
      statsHighlight: `Força ${player.strength} • Valor atualizado pós-torneio`,
      read: false,
    });
  }

  return { callups, newsArticles };
}

/**
 * Creates the complete FIFA World Cup tournament structure with 8 groups of 4 (32 teams)
 * and reserved knockout brackets (Round of 16, Quarter-Finals, Semi-Finals, and Final).
 * Matches are scheduled on the official Brasfoot June/July pause dates.
 */
export function createWorldCupTournament(
  seasonYear: number,
  allTeams: NationalTeam[]
): WorldCupTournament {
  const letters: WorldCupGroup['groupLetter'][] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const dates = getOfficialDates('supermundial', seasonYear); // 7 dates: 21/06, 25/06, 29/06, 02/07, 06/07, 10/07, 15/07
  const fallbackDates = [
    { date: `${seasonYear}-06-21`, dayOfWeek: 'domingo' as const },
    { date: `${seasonYear}-06-25`, dayOfWeek: 'quinta' as const },
    { date: `${seasonYear}-06-29`, dayOfWeek: 'segunda' as const },
    { date: `${seasonYear}-07-02`, dayOfWeek: 'quinta' as const },
    { date: `${seasonYear}-07-06`, dayOfWeek: 'segunda' as const },
    { date: `${seasonYear}-07-10`, dayOfWeek: 'sexta' as const },
    { date: `${seasonYear}-07-15`, dayOfWeek: 'quarta' as const },
  ];
  const scheduleDates = dates.length >= 7 ? dates : fallbackDates;

  // Group teams into 4 pots of 8 teams each
  const pot1 = allTeams.filter(t => WORLD_CUP_QUALIFIED_TEAMS.find(s => s.countryId === t.countryId)?.pot === 1);
  const pot2 = allTeams.filter(t => WORLD_CUP_QUALIFIED_TEAMS.find(s => s.countryId === t.countryId)?.pot === 2);
  const pot3 = allTeams.filter(t => WORLD_CUP_QUALIFIED_TEAMS.find(s => s.countryId === t.countryId)?.pot === 3);
  const pot4 = allTeams.filter(t => WORLD_CUP_QUALIFIED_TEAMS.find(s => s.countryId === t.countryId)?.pot === 4);

  const groups: WorldCupGroup[] = [];
  const allFixtures: MatchFixture[] = [];
  let fixtureId = 80000;

  for (let i = 0; i < 8; i++) {
    const letter = letters[i];
    const groupTeams: NationalTeam[] = [
      pot1[i] || allTeams[i * 4],
      pot2[i] || allTeams[i * 4 + 1],
      pot3[i] || allTeams[i * 4 + 2],
      pot4[i] || allTeams[i * 4 + 3],
    ];

    const standings = initializeStandings(groupTeams.map(nationalTeamToClub));

    // Generate Berger round-robin fixtures (3 rounds of 2 matches each)
    const rawMatches = generateLeagueCalendar(groupTeams.map(nationalTeamToClub)).slice(0, 6);
    const groupFixtures: MatchFixture[] = [];

    // Round 1 (matches 0, 1) -> 21/06
    // Round 2 (matches 2, 3) -> 25/06
    // Round 3 (matches 4, 5) -> 29/06
    for (let m = 0; m < rawMatches.length; m++) {
      const matchRound = Math.floor(m / 2) + 1;
      const sched = scheduleDates[matchRound - 1];
      const fix: MatchFixture = {
        ...rawMatches[m],
        id: fixtureId++,
        round: matchRound,
        date: sched.date,
        competitionType: 'copa_do_mundo',
        competitionName: 'Copa do Mundo FIFA',
        competitionRound: `Grupo ${letter} • Rodada ${matchRound}`,
        stage: `Grupo ${letter}`,
        dayOfWeek: sched.dayOfWeek as any,
        played: false,
      };
      groupFixtures.push(fix);
      allFixtures.push(fix);
    }

    groups.push({
      groupLetter: letter,
      teamIds: groupTeams.map(t => t.id),
      teams: groupTeams,
      standings,
      fixtures: groupFixtures,
    });
  }

  // Knockout stage 1: Round of 16 (8 matches on 02/07)
  const dateR16 = scheduleDates[3];
  for (let k = 0; k < 8; k++) {
    allFixtures.push({
      id: fixtureId++,
      round: 4,
      date: dateR16.date,
      homeClubId: 0,
      awayClubId: 0,
      played: false,
      pendingQualification: true,
      competitionType: 'copa_do_mundo',
      competitionName: 'Copa do Mundo FIFA',
      competitionRound: 'Oitavas de Final',
      stage: 'Oitavas de Final',
      dayOfWeek: dateR16.dayOfWeek as any,
    });
  }

  // Knockout stage 2: Quarter-Finals (4 matches on 06/07)
  const dateQF = scheduleDates[4];
  for (let k = 0; k < 4; k++) {
    allFixtures.push({
      id: fixtureId++,
      round: 5,
      date: dateQF.date,
      homeClubId: 0,
      awayClubId: 0,
      played: false,
      pendingQualification: true,
      competitionType: 'copa_do_mundo',
      competitionName: 'Copa do Mundo FIFA',
      competitionRound: 'Quartas de Final',
      stage: 'Quartas de Final',
      dayOfWeek: dateQF.dayOfWeek as any,
    });
  }

  // Knockout stage 3: Semi-Finals (2 matches on 10/07)
  const dateSF = scheduleDates[5];
  for (let k = 0; k < 2; k++) {
    allFixtures.push({
      id: fixtureId++,
      round: 6,
      date: dateSF.date,
      homeClubId: 0,
      awayClubId: 0,
      played: false,
      pendingQualification: true,
      competitionType: 'copa_do_mundo',
      competitionName: 'Copa do Mundo FIFA',
      competitionRound: 'Semifinal',
      stage: 'Semifinal',
      dayOfWeek: dateSF.dayOfWeek as any,
    });
  }

  // Knockout stage 4: Final (1 match on 15/07)
  const dateF = scheduleDates[6];
  allFixtures.push({
    id: fixtureId++,
    round: 7,
    date: dateF.date,
    homeClubId: 0,
    awayClubId: 0,
    played: false,
    pendingQualification: true,
    competitionType: 'copa_do_mundo',
    competitionName: 'Copa do Mundo FIFA',
    competitionRound: 'Grande Final',
    stage: 'Final',
    dayOfWeek: dateF.dayOfWeek as any,
  });

  return {
    seasonYear,
    status: 'groups',
    groups,
    fixtures: allFixtures,
  };
}

/**
 * Resolves World Cup matches for a given round or stage, updating standings or advancing knockout winners.
 */
export function advanceWorldCupRound(
  tournament: WorldCupTournament,
  round: number,
  teamsMap: Map<number, NationalTeam>
): WorldCupTournament {
  const updatedFixtures = [...tournament.fixtures];
  const roundFixtures = updatedFixtures.filter(f => f.round === round);

  // Play matches if not already played
  for (const fix of roundFixtures) {
    if (!fix.played && fix.homeClubId > 0 && fix.awayClubId > 0) {
      const homeTeam = teamsMap.get(fix.homeClubId);
      const awayTeam = teamsMap.get(fix.awayClubId);
      if (homeTeam && awayTeam) {
        const sim = simulateFullMatch(nationalTeamToClub(homeTeam), nationalTeamToClub(awayTeam));
        fix.homeScore = sim.homeScore;
        fix.awayScore = sim.awayScore;
        fix.played = true;

        // If knockout match tied, decide with penalties
        if (round >= 4 && fix.homeScore === fix.awayScore) {
          const homePen = 4 + Math.floor(Math.random() * 2);
          const awayPen = homePen === 5 ? 4 : 5;
          fix.penaltyScore = [homePen, awayPen];
        }
      }
    }
  }

  // If group stage (rounds 1 to 3), update standings
  if (round <= 3) {
    for (const group of tournament.groups) {
      const groupFix = updatedFixtures.filter(f => f.stage === `Grupo ${group.groupLetter}` && f.played);
      const rows = initializeStandings(group.teams.map(nationalTeamToClub));

      for (const fix of groupFix) {
        const homeRow = rows.find(r => r.clubId === fix.homeClubId);
        const awayRow = rows.find(r => r.clubId === fix.awayClubId);
        if (homeRow && awayRow && fix.homeScore != null && fix.awayScore != null) {
          homeRow.played++;
          awayRow.played++;
          homeRow.goalsFor += fix.homeScore;
          homeRow.goalsAgainst += fix.awayScore;
          homeRow.goalDiff = homeRow.goalsFor - homeRow.goalsAgainst;

          awayRow.goalsFor += fix.awayScore;
          awayRow.goalsAgainst += fix.homeScore;
          awayRow.goalDiff = awayRow.goalsFor - awayRow.goalsAgainst;

          if (fix.homeScore > fix.awayScore) {
            homeRow.won++;
            homeRow.points += 3;
            awayRow.lost++;
            homeRow.form.push('V');
            awayRow.form.push('D');
          } else if (fix.homeScore < fix.awayScore) {
            awayRow.won++;
            awayRow.points += 3;
            homeRow.lost++;
            awayRow.form.push('V');
            homeRow.form.push('D');
          } else {
            homeRow.drawn++;
            awayRow.drawn++;
            homeRow.points += 1;
            awayRow.points += 1;
            homeRow.form.push('E');
            awayRow.form.push('E');
          }
        }
      }
      group.standings = sortStandings(rows);
    }

    // Check if group stage finished (all 3 rounds played) -> Fill Round of 16
    const groupMatches = updatedFixtures.filter(f => f.round <= 3);
    if (groupMatches.every(f => f.played)) {
      const r16Fixtures = updatedFixtures.filter(f => f.round === 4);
      // Traditional bracket pairing: 1A x 2B, 1C x 2D, 1E x 2F, 1G x 2H, 1B x 2A, 1D x 2C, 1F x 2E, 1H x 2G
      const pairLetters: [WorldCupGroup['groupLetter'], WorldCupGroup['groupLetter']][] = [
        ['A', 'B'], ['C', 'D'], ['E', 'F'], ['G', 'H'],
        ['B', 'A'], ['D', 'C'], ['F', 'E'], ['H', 'G'],
      ];

      for (let k = 0; k < 8; k++) {
        const [g1Letter, g2Letter] = pairLetters[k];
        const g1 = tournament.groups.find(g => g.groupLetter === g1Letter);
        const g2 = tournament.groups.find(g => g.groupLetter === g2Letter);
        if (g1 && g2 && g1.standings.length >= 2 && g2.standings.length >= 2) {
          const homeTeamId = g1.standings[0].clubId;
          const awayTeamId = g2.standings[1].clubId;
          r16Fixtures[k].homeClubId = homeTeamId;
          r16Fixtures[k].awayClubId = awayTeamId;
          r16Fixtures[k].pendingQualification = false;
        }
      }
      tournament.status = 'round_of_16';
    }
  }

  // Knockout progression:
  const getWinner = (fix: MatchFixture): number => {
    if ((fix.homeScore ?? 0) !== (fix.awayScore ?? 0)) {
      return (fix.homeScore ?? 0) > (fix.awayScore ?? 0) ? fix.homeClubId : fix.awayClubId;
    }
    return (fix.penaltyScore?.[0] ?? 0) > (fix.penaltyScore?.[1] ?? 0) ? fix.homeClubId : fix.awayClubId;
  };

  // After Round of 16 (round 4) -> Fill Quarter-Finals (round 5)
  if (round === 4) {
    const r16 = updatedFixtures.filter(f => f.round === 4);
    if (r16.every(f => f.played)) {
      const qf = updatedFixtures.filter(f => f.round === 5);
      for (let i = 0; i < 4; i++) {
        qf[i].homeClubId = getWinner(r16[i * 2]);
        qf[i].awayClubId = getWinner(r16[i * 2 + 1]);
        qf[i].pendingQualification = false;
      }
      tournament.status = 'quarter_finals';
    }
  }

  // After Quarter-Finals (round 5) -> Fill Semi-Finals (round 6)
  if (round === 5) {
    const qf = updatedFixtures.filter(f => f.round === 5);
    if (qf.every(f => f.played)) {
      const sf = updatedFixtures.filter(f => f.round === 6);
      for (let i = 0; i < 2; i++) {
        sf[i].homeClubId = getWinner(qf[i * 2]);
        sf[i].awayClubId = getWinner(qf[i * 2 + 1]);
        sf[i].pendingQualification = false;
      }
      tournament.status = 'semi_finals';
    }
  }

  // After Semi-Finals (round 6) -> Fill Final (round 7)
  if (round === 6) {
    const sf = updatedFixtures.filter(f => f.round === 6);
    if (sf.every(f => f.played)) {
      const fn = updatedFixtures.find(f => f.round === 7);
      if (fn) {
        fn.homeClubId = getWinner(sf[0]);
        fn.awayClubId = getWinner(sf[1]);
        fn.pendingQualification = false;
      }
      tournament.status = 'final';
    }
  }

  // After Final (round 7) -> Crown champion
  if (round === 7) {
    const fn = updatedFixtures.find(f => f.round === 7);
    if (fn && fn.played) {
      const champId = getWinner(fn);
      const runnerId = champId === fn.homeClubId ? fn.awayClubId : fn.homeClubId;
      const champTeam = teamsMap.get(champId);
      const runnerTeam = teamsMap.get(runnerId);

      if (champTeam && runnerTeam) {
        tournament.champion = { id: champTeam.id, name: champTeam.name, flag: champTeam.flag };
        tournament.runnerUp = { id: runnerTeam.id, name: runnerTeam.name, flag: runnerTeam.flag };
      }
      tournament.status = 'finished';
    }
  }

  tournament.fixtures = updatedFixtures;
  return tournament;
}

/**
 * Creates the Super Club World Cup in odd pre-World Cup years (e.g. 2029, 2033).
 * Brings together continental giants (Libertadores, Champions, etc.) in a knockout tournament.
 */
export function createSuperClubWorldCup(
  seasonYear: number,
  clubsPool: Club[]
): SuperClubWorldCup {
  const dates = getOfficialDates('supermundial', seasonYear);
  const selectedClubs = [...clubsPool].sort((a, b) => b.reputation - a.reputation).slice(0, 8);
  const fixtures: MatchFixture[] = [];
  let fixId = 85000;

  // Quarter-Finals (4 matches)
  const qfDate = dates[3]?.date || `${seasonYear}-07-02`;
  for (let i = 0; i < 4; i++) {
    fixtures.push({
      id: fixId++,
      round: 1,
      date: qfDate,
      homeClubId: selectedClubs[i * 2]?.id || 1,
      awayClubId: selectedClubs[i * 2 + 1]?.id || 2,
      played: false,
      competitionType: 'supermundial',
      competitionName: 'Super Mundial de Clubes FIFA',
      competitionRound: 'Quartas de Final',
      stage: 'Quartas de Final',
      dayOfWeek: 'quinta',
    });
  }

  // Semi-Finals (2 matches)
  const sfDate = dates[5]?.date || `${seasonYear}-07-10`;
  for (let i = 0; i < 2; i++) {
    fixtures.push({
      id: fixId++,
      round: 2,
      date: sfDate,
      homeClubId: 0,
      awayClubId: 0,
      played: false,
      pendingQualification: true,
      competitionType: 'supermundial',
      competitionName: 'Super Mundial de Clubes FIFA',
      competitionRound: 'Semifinal',
      stage: 'Semifinal',
      dayOfWeek: 'sexta',
    });
  }

  // Final (1 match)
  const finalDate = dates[6]?.date || `${seasonYear}-07-15`;
  fixtures.push({
    id: fixId++,
    round: 3,
    date: finalDate,
    homeClubId: 0,
    awayClubId: 0,
    played: false,
    pendingQualification: true,
    competitionType: 'supermundial',
    competitionName: 'Super Mundial de Clubes FIFA',
    competitionRound: 'Grande Final',
    stage: 'Final',
    dayOfWeek: 'quarta',
  });

  return {
    seasonYear,
    status: 'knockout',
    participantClubIds: selectedClubs.map(c => c.id),
    fixtures,
  };
}

/**
 * Creates the annual Intercontinental Cup in December following official calendario_intercontinental.txt.
 * Champions of Libertadores and Champions League clash for the world club crown.
 */
export function createIntercontinentalCup(
  seasonYear: number,
  clubsPool: Club[]
): IntercontinentalCup {
  const dates = getOfficialDates('intercontinental', seasonYear);
  const topClubs = [...clubsPool].sort((a, b) => b.reputation - a.reputation).slice(0, 4);
  const fixtures: MatchFixture[] = [];
  let fixId = 88000;

  // Semifinals (dates 0 and 1: 16/12 and 19/12)
  const sf1Date = dates[0]?.date || `${seasonYear}-12-16`;
  const sf2Date = dates[1]?.date || `${seasonYear}-12-19`;
  fixtures.push({
    id: fixId++,
    round: 1,
    date: sf1Date,
    homeClubId: topClubs[0]?.id || 1,
    awayClubId: topClubs[3]?.id || 4,
    played: false,
    competitionType: 'intercontinental',
    competitionName: 'Copa Intercontinental da FIFA',
    competitionRound: 'Semifinal 1',
    stage: 'Semifinal',
    dayOfWeek: 'terça',
  });

  fixtures.push({
    id: fixId++,
    round: 1,
    date: sf2Date,
    homeClubId: topClubs[1]?.id || 2,
    awayClubId: topClubs[2]?.id || 3,
    played: false,
    competitionType: 'intercontinental',
    competitionName: 'Copa Intercontinental da FIFA',
    competitionRound: 'Semifinal 2',
    stage: 'Semifinal',
    dayOfWeek: 'sexta',
  });

  // Final (date 4: 29/12)
  const fDate = dates[4]?.date || `${seasonYear}-12-29`;
  fixtures.push({
    id: fixId++,
    round: 2,
    date: fDate,
    homeClubId: 0,
    awayClubId: 0,
    played: false,
    pendingQualification: true,
    competitionType: 'intercontinental',
    competitionName: 'Copa Intercontinental da FIFA',
    competitionRound: 'Grande Final',
    stage: 'Final',
    dayOfWeek: 'terça',
  });

  return {
    seasonYear,
    status: 'in_progress',
    participantClubIds: topClubs.map(c => c.id),
    fixtures,
  };
}
