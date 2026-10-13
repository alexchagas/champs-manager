import type { Club, GameOptions, GameState, Manager } from '../types/index.ts';
import { generateLeagueCalendar, generateTwoSemesterCalendar, initializeStandings, sortStandings } from './calendarGenerator.ts';
import { getContinentalTournamentField } from './continentalRepresentatives.ts';
import { getAllClubs, getCompetitionClubs } from './teamsDatabase.ts';
import { generateKickoffNews } from '../engine/newsEngine.ts';
import { buildInitialActiveOtherLeagues } from '../engine/crossSeasonSimulation.ts';
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
} from './nationalTeamsData.ts';

export const DEFAULT_CLUBS: Club[] = getAllClubs();

export const DEFAULT_OPTIONS: GameOptions = {
  soundEnabled: true,
  soundVolume: 0.8,
  simSpeed: 2,
  autoPauseOnGoal: false,
  autoSaveMode: 'disabled',
};

export function generateInitialFreeAgents(): import('../types/index.ts').Player[] {
  const pool = [
    { pos: 'GOL' as const, names: ['Lucas Silva', 'Danilo Lima', 'Rafael Souza', 'Fábio Santos', 'Marcos Rocha', 'Weverton Jr.'] },
    { pos: 'ZAG' as const, names: ['Leandro Castán', 'Vitor Hugo', 'Rodrigo Costa', 'Bruno Pereira', 'Eduardo Carvalho', 'Henrique Silva'] },
    { pos: 'LAT' as const, names: ['Cicinho', 'Michel Bastos', 'Jorge Wagner', 'Caio Castro', 'Renan Augusto', 'Danilo Neves'] },
    { pos: 'VOL' as const, names: ['Richarlyson', 'Marcio Araújo', 'Thiago Ribeiro', 'Felipe Almeida', 'Igor Gomes', 'Gabriel Neves'] },
    { pos: 'MEI' as const, names: ['Cleiton Xavier', 'Diego Souza', 'Jádson', 'Danilinho', 'Walter Minhoca', 'Matheus Oliveira'] },
    { pos: 'ATA' as const, names: ['Alexandre Pato', 'Henrique Dourado', 'Obina', 'Aloísio Chulapa', 'Kieza', 'Magno Alves'] },
  ];

  const feet: ('D' | 'E' | 'A')[] = ['D', 'E', 'A'];
  const skills = ['Velocidade', 'Finalização', 'Cabeceio', 'Passe', 'Desarme', 'Drible', 'Cruzamento', 'Marcação'];

  const freeAgents: import('../types/index.ts').Player[] = [];
  let idCounter = 950000;

  pool.forEach((group, gIdx) => {
    group.names.forEach((name, nIdx) => {
      const idx = gIdx * 6 + nIdx;
      const age = 19 + ((idx * 7) % 17);
      const strength = 48 + ((idx * 11) % 32);
      const baseVal = strength * strength * 800;
      const marketValue = age <= 23 ? Math.floor(baseVal * 1.25) : age >= 32 ? Math.floor(baseVal * 0.75) : baseVal;
      const salary = Math.max(3000, Math.min(45000, Math.floor(marketValue / 95)));

      freeAgents.push({
        id: idCounter++,
        name,
        age,
        position: group.pos,
        foot: feet[idx % feet.length],
        strength,
        energy: 100,
        salary,
        marketValue,
        isStarter: false,
        isStar: strength >= 75,
        isWorldTop: strength >= 85,
        skill1: skills[(idx * 2) % skills.length],
        skill2: skills[(idx * 2 + 1) % skills.length],
        goals: 0,
        assists: 0,
        yellowCards: 0,
        redCards: 0,
        injured: false,
        suspended: false,
        contractYears: 0,
      });
    });
  });

  return freeAgents;
}

export function generateYouthSquad(clubId: number, clubLevel: number = 10): import('../types/index.ts').Player[] {
  const firstNames = [
    'Matheus', 'Kauã', 'Gabriel', 'Lucas', 'Endrick', 'Vinicius', 'Rodrigo', 'Kaio',
    'Davi', 'Igor', 'Caio', 'Pedrinho', 'Bruninho', 'Renan', 'Arthur', 'Guilherme',
    'Samuel', 'Enzo', 'Gustavo', 'Luan', 'Felipe', 'Thiago', 'Danilo', 'Vitor'
  ];
  const lastNames = [
    'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira',
    'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Barbosa', 'Pinto'
  ];

  const positions: import('../types/index.ts').Position[] = [
    'GOL', 'GOL',
    'ZAG', 'ZAG', 'ZAG',
    'LAT', 'LAT',
    'VOL', 'VOL',
    'MEI', 'MEI',
    'ATA', 'ATA',
  ];

  const feet: ('D' | 'E' | 'A')[] = ['D', 'D', 'D', 'E', 'E', 'A'];
  const skills = ['Velocidade', 'Finalização', 'Cabeceio', 'Passe', 'Desarme', 'Drible', 'Cruzamento', 'Marcação', 'Resistência'];

  const youth: import('../types/index.ts').Player[] = [];
  const baseId = 700000 + clubId * 100;

  positions.forEach((pos, idx) => {
    const seed = clubId * 17 + idx * 31;
    const fName = firstNames[(seed + idx) % firstNames.length];
    const lName = lastNames[(seed * 3 + idx) % lastNames.length];
    const name = `${fName} ${lName}`;
    const age = 16 + ((seed + idx) % 4); // 16 to 19
    const baseStr = 40 + Math.floor((clubLevel || 10) * 1.4) + ((seed * 7) % 12);
    const strength = Math.max(38, Math.min(70, baseStr));
    const marketValue = Math.floor(strength * strength * 240 * (age <= 17 ? 1.4 : 1.1));
    const salary = Math.max(1500, Math.min(8000, Math.floor(marketValue / 90)));

    youth.push({
      id: baseId + idx,
      name,
      age,
      position: pos,
      foot: feet[(seed + idx) % feet.length],
      strength,
      energy: 100,
      salary,
      marketValue,
      isStarter: false,
      isStar: strength >= 62,
      isWorldTop: strength >= 68,
      skill1: skills[(seed * 2 + idx) % skills.length],
      skill2: skills[(seed * 3 + idx + 1) % skills.length],
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
      injured: false,
      suspended: false,
      contractYears: 3,
    });
  });

  return youth;
}

export function generateSingleYouthPlayer(clubId: number, nextId: number, clubLevel: number = 10): import('../types/index.ts').Player {
  const firstNames = ['Kaio', 'Davi', 'Igor', 'Caio', 'Pedrinho', 'Bruninho', 'Renan', 'Arthur', 'Samuel', 'Enzo', 'Gustavo'];
  const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa'];
  const positions: import('../types/index.ts').Position[] = ['GOL', 'ZAG', 'LAT', 'VOL', 'MEI', 'ATA'];
  const skills = ['Velocidade', 'Finalização', 'Cabeceio', 'Passe', 'Desarme', 'Drible', 'Cruzamento', 'Marcação'];
  const feet: ('D' | 'E' | 'A')[] = ['D', 'D', 'E', 'A'];

  const seed = Date.now() % 10000;
  const fName = firstNames[seed % firstNames.length];
  const lName = lastNames[(seed * 3) % lastNames.length];
  const pos = positions[seed % positions.length];
  const age = 16 + (seed % 3); // 16 to 18
  const strength = Math.max(42, Math.min(72, 42 + Math.floor(clubLevel * 1.5) + (seed % 14)));
  const marketValue = Math.floor(strength * strength * 260 * 1.3);
  const salary = Math.max(1500, Math.min(7500, Math.floor(marketValue / 90)));

  return {
    id: nextId,
    name: `${fName} ${lName}`,
    age,
    position: pos,
    foot: feet[seed % feet.length],
    strength,
    energy: 100,
    salary,
    marketValue,
    isStarter: false,
    isStar: strength >= 64,
    isWorldTop: strength >= 70,
    skill1: skills[seed % skills.length],
    skill2: skills[(seed + 3) % skills.length],
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    injured: false,
    suspended: false,
    contractYears: 3,
  };
}

export function createNewGame(
  userClubId: number = 255, 
  managerName: string = 'Alex Chagas',
  customOptions?: Partial<GameOptions>,
  activeCountryIds?: number[],
  loadedClubs?: Club[]
): GameState {
  const basePool = loadedClubs && loadedClubs.length > 0
    ? [...new Map([...getAllClubs(), ...loadedClubs].map(c => [c.id, c])).values()]
    : getAllClubs();

  const { competitionClubs, leagueName, divisionName, countryName } = getCompetitionClubs(userClubId, basePool);

  // Deep clone clubs so state is completely isolated and ensure contractYears are initialized
  const sourceClub = competitionClubs.find(c => c.id === userClubId) || basePool.find(c => c.id === userClubId) || competitionClubs[0];
  const candidateCountryIds = activeCountryIds || (customOptions as any)?.activeCountryIds;
  const activeCountries = candidateCountryIds && candidateCountryIds.length > 0
    ? Array.from(new Set([sourceClub.countryId || 29, ...candidateCountryIds]))
    : [sourceClub.countryId || 29];

  const activeCountryClubs = basePool.filter(c => activeCountries.includes(c.countryId || 29));
  const statePool = sourceClub.countryId === 29 ? basePool.filter(c => c.countryId === 29 && (
    (sourceClub.stateId != null && c.stateId === sourceClub.stateId) ||
    (sourceClub.stateCode != null && c.stateCode === sourceClub.stateCode)
  )) : [];
  const continentalField = getContinentalTournamentField(sourceClub, basePool).clubs;
  const activeClubs = [...new Map([...competitionClubs, ...statePool, ...continentalField, ...activeCountryClubs].map(c => [c.id, c])).values()];
  const clonedClubs: Club[] = JSON.parse(JSON.stringify(activeClubs)).map((c: Club) => ({
    ...c,
    debt: c.debt ?? 0,
    loans: c.loans ?? [],
    ticketPrice: c.ticketPrice ?? 40,
    avgAttendance: c.avgAttendance ?? Math.round(c.capacity * 0.76),
    attendanceHistory: c.attendanceHistory ?? [],
    financialLedger: c.financialLedger ?? [],
    weeklyStatements: c.weeklyStatements ?? [],
    youth: c.youth && c.youth.length > 0 ? c.youth : generateYouthSquad(c.id, c.level ?? 10),
    squad: c.squad.map((p, idx) => ({
      ...p,
      contractYears: p.contractYears ?? (1 + ((idx + p.id) % 3)),
    })),
  }));

  const userClub = clonedClubs.find((c) => c.id === userClubId) || clonedClubs[0];

  // Generate one chronological calendar from the clubs active in this season.
  const nationalClubs = competitionClubs.map(c => clonedClubs.find(active => active.id === c.id)!).filter(Boolean);
  const twoSemesterData = generateTwoSemesterCalendar(userClub, nationalClubs, clonedClubs);
  const calendar = twoSemesterData.calendar;
  const standingsEstadual = sortStandings(initializeStandings(twoSemesterData.semester1Clubs));
  const standingsNacional = sortStandings(initializeStandings(twoSemesterData.semester2Clubs));
  const standingsContinental = sortStandings(
    initializeStandings(twoSemesterData.continentalClubs, (_c, idx) => 'ABCD'[Math.floor(idx / 4)] || 'A')
  );
  const standings = twoSemesterData.semester1Clubs.length ? standingsEstadual : standingsNacional;

  const seasonYear = 2026;

  const otherLeagues = buildInitialActiveOtherLeagues(
    userClub,
    activeCountries,
    clonedClubs,
    seasonYear
  );

  const freeAgents = generateInitialFreeAgents();

  // Create 1-2 initial AI proposals for user squad players to start with
  const otherClubs = clonedClubs.filter((c) => c.id !== userClub.id && c.balance > 2000000);
  const initialOffers: import('../types/index.ts').TransferOffer[] = [];

  if (userClub && userClub.squad.length > 16 && otherClubs.length > 0) {
    const buyer = otherClubs[0];
    const candidate = userClub.squad[userClub.squad.length - 1];
    const fee = candidate ? Math.floor(candidate.marketValue * 1.15) : 0;
    if (candidate && buyer.balance >= fee + Math.round(buyer.squad.reduce((sum, p) => sum + p.salary, 0) / 4) * 2 && buyer.squad.length < 30 && userClub.squad.filter(p => p.id !== candidate.id && !p.injured && !p.suspended).some(p => p.position === 'GOL')) {
      initialOffers.push({
        id: 1,
        fromClubId: buyer.id,
        fromClubName: buyer.name,
        toClubId: userClub.id,
        playerId: candidate.id,
        playerName: candidate.name,
        playerPosition: candidate.position,
        playerStrength: candidate.strength,
        fee,
      });
    }
  }

  const options: GameOptions = {
    ...DEFAULT_OPTIONS,
    autoSaveMode: 'disabled',
    ...(customOptions || {}),
  };

  const careerId = `career-${userClubId}-${Date.now()}`;

  const nationalTeams = initializeNationalTeams(clonedClubs);

  const initialHumanManager: Manager = {
    id: 'human-1',
    name: managerName.trim() || 'Alex Chagas',
    kind: 'human',
    reputation: 1,
    boardRating: 60,
    riskProfile: 'balanced',
    currentClubId: userClubId,
    available: false,
    jobs: [],
    titles: [],
    events: [],
    seasonScore: 0,
    careerScore: 0,
    scoreComponents: { results: 0, competitions: 0, squad: 0, finances: 0 },
  };

  const worldCup = isWorldCupYear(seasonYear) ? createWorldCupTournament(seasonYear, nationalTeams) : undefined;
  const nationalTeamOffers = isWorldCupYear(seasonYear) ? getAvailableNationalTeamOffers(initialHumanManager, seasonYear, nationalTeams) : undefined;
  const { callups, newsArticles: callupNews } = isWorldCupYear(seasonYear) ? evaluateUserSquadCallups(userClub, seasonYear, nationalTeams) : { callups: [], newsArticles: [] };
  const superClubWorldCup = isSuperClubWorldCupYear(seasonYear) ? createSuperClubWorldCup(seasonYear, clonedClubs) : undefined;
  const intercontinentalCup = isIntercontinentalYear(seasonYear) ? createIntercontinentalCup(seasonYear, clonedClubs) : undefined;

  const baseState: GameState = {
    careerId,
    autoSaveMatchCounter: 0,
    userClubId,
    managerName: managerName.trim() || 'Alex Chagas',
    humanManagerId: 'human-1',
    managers: [initialHumanManager],
    seasonYear,
    currentRound: 1,
    currentSemester: 1,
    leagueName,
    divisionName,
    countryName,
    activeCountryIds: activeCountries,
    stateChampionshipName: twoSemesterData.estadualName,
    nationalLeagueName: twoSemesterData.nacionalName,
    continentalCupName: twoSemesterData.continentalName,
    standingsEstadual,
    standingsNacional,
    standingsContinental,
    otherLeagues,
    clubs: clonedClubs,
    calendar,
    standings,
    options,
    activeScreen: 'overview',
    freeAgents,
    transferOffers: initialOffers,
    worldCup,
    superClubWorldCup,
    intercontinentalCup,
    nationalTeamOffers,
    nationalCallups: callups,
  };

  const kickoffNews = generateKickoffNews(baseState);
  const newsFeed = [...callupNews, ...kickoffNews];

  return {
    ...baseState,
    newsFeed,
  };
}
