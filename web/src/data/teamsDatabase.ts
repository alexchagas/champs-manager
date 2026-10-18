import type { Club, CountryInfo, LeagueInfo, StateInfo } from '../types/index.ts';
import databaseRaw from './teamsDatabase.json' with { type: 'json' };
import { formatGroupLabel, getDivisionConfig } from './leagueConfigurations.ts';

interface DatabaseSchema {
  version: number;
  totalClubs: number;
  countries: CountryInfo[];
  leagues: LeagueInfo[];
  states: StateInfo[];
  clubs: Club[];
}

const database: DatabaseSchema = databaseRaw as DatabaseSchema;

// Index by ID for instant O(1) lookups
const clubsById = new Map<number, Club>();
for (const club of database.clubs) {
  clubsById.set(club.id, club);
}

export const PRE_LIB_PLACEHOLDER_IDS = [990001, 990002, 990003, 990004];

export function isPreLibPlaceholderId(id?: number): boolean {
  return typeof id === 'number' && id >= 990001 && id <= 990004;
}

function makePlaceholderSquad(startId: number) {
  const positions: ('GOL' | 'ZAG' | 'LAT' | 'VOL' | 'MEI' | 'ATA')[] = [
    'GOL', 'GOL',
    'ZAG', 'ZAG', 'ZAG', 'LAT', 'LAT',
    'VOL', 'VOL', 'MEI', 'MEI', 'MEI',
    'ATA', 'ATA', 'ATA', 'ATA',
  ];
  return positions.map((pos, idx) => ({
    id: startId + idx,
    name: `Atleta ${idx + 1}`,
    age: 23,
    position: pos,
    foot: 'D' as const,
    strength: 65,
    energy: 100,
    salary: 15000,
    marketValue: 800000,
    isStarter: idx < 11,
    isStar: false,
    isWorldTop: false,
    skill1: 'Passe',
    skill2: 'Desarme',
    goals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    injured: false,
    suspended: false,
    contractYears: 3,
  }));
}

export const PRE_LIB_PLACEHOLDER_CLUBS: Club[] = [1, 2, 3, 4].map((num) => ({
  id: 990000 + num,
  name: `Vencedor Pré-Lib G${num}`,
  shortName: `Pré-Lib G${num}`,
  countryId: 0,
  division: 1,
  reputation: 3,
  level: 10,
  primaryColor: '#f59e0b',
  secondaryColor: '#1e293b',
  stadium: 'A definir',
  capacity: 25000,
  coach: 'Técnico a definir',
  balance: 50000000,
  ticketPrice: 40,
  crestUrl: '',
  crestMiniUrl: '',
  tactics: { formation: '4-4-2', mentality: 'Equilibrada', penaltyTakerId: 0, freeKickTakerId: 0, cornerTakerId: 0, captainId: 0 },
  squad: makePlaceholderSquad(991000 + num * 50),
}));

for (const ph of PRE_LIB_PLACEHOLDER_CLUBS) {
  clubsById.set(ph.id, ph);
  database.clubs.push(ph);
}

export function applyClubEdits(edits: Club[]): void {
  for (const club of edits) {
    const previous = clubsById.get(club.id);
    const oldMemberships = database.leagues.filter((league) => league.clubIds.includes(club.id));
    const membershipChanged = !previous || previous.countryId !== club.countryId || previous.division !== club.division;
    const target = membershipChanged
      ? database.leagues.find((league) => league.countryId === club.countryId && league.division === club.division)
      : undefined;
    const index = database.clubs.findIndex((item) => item.id === club.id);
    if (index >= 0) database.clubs[index] = club;
    else database.clubs.push(club);
    clubsById.set(club.id, club);
    if (membershipChanged) {
      for (const league of oldMemberships) {
        league.clubIds = league.clubIds.filter((id) => id !== club.id);
        league.teamCount = league.clubIds.length;
      }
      if (target && !target.clubIds.includes(club.id)) {
        target.clubIds.push(club.id);
        target.teamCount = target.clubIds.length;
      }
    }
  }
  database.totalClubs = database.clubs.length;
  for (const country of database.countries) {
    country.clubCount = database.clubs.filter((club) => club.countryId === country.id).length;
  }
}

const countriesById = new Map<number, CountryInfo>();
for (const country of database.countries) {
  countriesById.set(country.id, country);
}

export function registerClubs(newClubs: Club[]): void {
  for (const club of newClubs) {
    if (!clubsById.has(club.id)) {
      clubsById.set(club.id, club);
      database.clubs.push(club);
    } else {
      // Update with full squad if previously had incomplete squad
      const existing = clubsById.get(club.id)!;
      if ((!existing.squad || existing.squad.length === 0) && club.squad && club.squad.length > 0) {
        Object.assign(existing, club);
      }
    }
  }
  database.totalClubs = database.clubs.length;
}

export function registerCountries(newCountries: CountryInfo[]): void {
  for (const c of newCountries) {
    if (!countriesById.has(c.id)) {
      countriesById.set(c.id, c);
      database.countries.push(c);
    }
  }
}

export function registerLeagues(newLeagues: LeagueInfo[]): void {
  for (const l of newLeagues) {
    if (!database.leagues.some((item) => item.countryId === l.countryId && item.division === l.division)) {
      database.leagues.push(l);
    }
  }
}

export function getAllClubs(): Club[] {
  return database.clubs;
}

export function getClubById(id: number): Club | undefined {
  return clubsById.get(id);
}

export function getAllCountries(): CountryInfo[] {
  return database.countries;
}

export function getCountryById(id: number): CountryInfo | undefined {
  return countriesById.get(id);
}

export function getAllLeagues(): LeagueInfo[] {
  return database.leagues;
}

export function getLeaguesByCountry(countryId: number): LeagueInfo[] {
  return database.leagues.filter((l) => l.countryId === countryId);
}

export function getAllStates(): StateInfo[] {
  return database.states;
}

export function getStateByCode(stateCode?: string): StateInfo | undefined {
  if (!stateCode) return undefined;
  return database.states.find((s) => s.code === stateCode);
}

export function getStateById(stateId?: number): StateInfo | undefined {
  if (stateId == null) return undefined;
  return database.states.find((s) => s.id === stateId);
}

export function getClubsByState(stateCode: string): Club[] {
  return database.clubs.filter((c) => c.stateCode === stateCode);
}

export function getClubsByCountry(countryId: number): Club[] {
  return database.clubs.filter((c) => c.countryId === countryId);
}

export function getClubsByLeague(league: LeagueInfo): Club[] {
  const result: Club[] = [];
  for (const cid of league.clubIds) {
    const c = clubsById.get(cid);
    if (c) {
      result.push(c);
    }
  }
  return result;
}

export function findLeagueForClub(clubId: number): LeagueInfo | undefined {
  // First, search explicit leagues with clubIds
  for (const l of database.leagues) {
    if (l.clubIds.includes(clubId)) {
      return l;
    }
  }

  // Fallback: search by club's country
  const club = clubsById.get(clubId);
  if (club && club.countryId) {
    return database.leagues.find((l) => l.countryId === club.countryId);
  }

  return undefined;
}

/**
 * Returns the competitive group of clubs for a new career with the chosen club.
 * If the club is in Série A, B, C (20 teams) -> returns those 20 teams.
 * If in Série D (64 teams) -> returns the 8-team group or up to 20 teams containing this club.
 * If in an international league -> returns the teams of that league.
 * If in an Estadual / Access division -> returns the teams of that state or a balanced 8-12 team pool.
 */
export function getCompetitionClubs(selectedClubId: number, customPool?: Club[]): {
  competitionClubs: Club[];
  leagueName: string;
  divisionName: string;
  countryName: string;
} {
  const selectedClub = (customPool ? customPool.find((c) => c.id === selectedClubId) : undefined) || clubsById.get(selectedClubId) || database.clubs[0];
  const countryId = selectedClub.countryId || 29;
  const isBrazil = countryId === 29;
  const league = findLeagueForClub(selectedClub.id);

  let competitionClubs: Club[] = [];
  let leagueName = league?.name || selectedClub.leagueName || 'Campeonato Nacional';
  let divisionName = league?.divisionName || selectedClub.divisionName || '1ª Divisão';
  const country = countriesById.get(countryId);
  const countryName = country?.name || (selectedClub as { countryName?: string }).countryName || (isBrazil ? 'Brasil' : 'Internacional');

  const isBrazilSerieDOrAccess = isBrazil && ((selectedClub.division ?? 1) >= 4 || league?.division === 4 || (league?.division ?? 1) >= 5);

  if (isBrazilSerieDOrAccess) {
    const serieDLeague = database.leagues.find((l) => l.countryId === 29 && l.division === 4) || league;
    const serieDClubs = serieDLeague
      ? (customPool
          ? serieDLeague.clubIds.map((id) => customPool.find((c) => c.id === id) || clubsById.get(id)!).filter(Boolean)
          : getClubsByLeague(serieDLeague))
      : [];

    competitionClubs = [...serieDClubs];

    // If selectedClub is an access club (Division 5) not already among the 64 Série D clubs,
    // replace the last club in its regional group (matching stateCode) or the 64th club.
    if (competitionClubs.length > 0 && !competitionClubs.some((c) => c.id === selectedClub.id)) {
      let replaceIdx = -1;
      for (let i = competitionClubs.length - 1; i >= 0; i--) {
        if (selectedClub.stateCode && competitionClubs[i].stateCode === selectedClub.stateCode) {
          replaceIdx = i;
          break;
        }
      }
      if (replaceIdx < 0) replaceIdx = competitionClubs.length - 1;
      competitionClubs[replaceIdx] = selectedClub;
    }

    const idx = competitionClubs.findIndex((c) => c.id === selectedClub.id);
    const groupSize = 8;
    const groupIndex = idx >= 0 ? Math.floor(idx / groupSize) : 0;
    leagueName = 'Brasileirão Série D';
    divisionName = `Série D (Grupo ${formatGroupLabel(groupIndex)})`;
  } else if (league && league.clubIds.length > 0) {
    const allLeagueClubs = customPool
      ? league.clubIds.map((id) => customPool.find((c) => c.id === id) || clubsById.get(id)!).filter(Boolean)
      : getClubsByLeague(league);

    const divConfig = getDivisionConfig(countryId, selectedClub.division || league.division || 1, countryName, allLeagueClubs.length);
    const targetCount = divConfig?.teamCount || 20;

    if (divConfig?.groupCount && divConfig.groupCount > 1) {
      competitionClubs = allLeagueClubs.slice(0, Math.max(targetCount, allLeagueClubs.length));
    } else if (allLeagueClubs.length > Math.max(24, targetCount)) {
      competitionClubs = allLeagueClubs.slice(0, targetCount);
      if (!competitionClubs.some((c) => c.id === selectedClub.id)) {
        competitionClubs[competitionClubs.length - 1] = selectedClub;
      }
    } else {
      competitionClubs = allLeagueClubs;
    }
  }

  // Canonicalize Brazilian national competition name
  if (isBrazil) {
    leagueName = getCanonicalNationalLeagueName(selectedClub);
  }

  // If division has fewer than 16 clubs (e.g. incomplete division like Spain Div 7 or England Div 7):
  // Supplement with peers of similar level/reputation from that same country to build a viable competitive tournament group
  if (!isBrazilSerieDOrAccess && competitionClubs.length < 16) {
    const pool = customPool || database.clubs;
    const sameCountry = pool.filter((c) => c.countryId === countryId);
    
    if (sameCountry.length > competitionClubs.length) {
      const existingIds = new Set(competitionClubs.map((c) => c.id));
      const candidates = sameCountry
        .filter((c) => !existingIds.has(c.id))
        .sort((a, b) => {
          const diffA = Math.abs((a.level || 10) - (selectedClub.level || 10)) * 2 + Math.abs((a.reputation || 1) - (selectedClub.reputation || 1));
          const diffB = Math.abs((b.level || 10) - (selectedClub.level || 10)) * 2 + Math.abs((b.reputation || 1) - (selectedClub.reputation || 1));
          return diffA - diffB;
        });

      const targetSize = Math.min(sameCountry.length, 20);
      for (const cand of candidates) {
        if (competitionClubs.length >= targetSize) break;
        competitionClubs.push(cand);
      }
    }

    if (
      divisionName.toLowerCase().includes('acesso') || 
      divisionName.toLowerCase().includes('7ª') || 
      divisionName.toLowerCase().includes('8ª') ||
      divisionName.toLowerCase().includes('estaduais')
    ) {
      divisionName = 'Divisão de Acesso';
      leagueName = `${countryName} • Divisão de Acesso`;
    }
  }

  // Always ensure the selected club is included
  if (!competitionClubs.some((c) => c.id === selectedClub.id)) {
    competitionClubs[0] = selectedClub;
  }

  return {
    competitionClubs,
    leagueName,
    divisionName,
    countryName,
  };
}

export function getCanonicalNationalLeagueName(club: {
  countryId?: number;
  division?: number;
  leagueName?: string;
  divisionName?: string;
}): string {
  const isBrazil = (club.countryId ?? 29) === 29;
  if (isBrazil) {
    const div = club.division;
    const letter = div === 1 ? 'A' : div === 2 ? 'B' : div === 3 ? 'C' : (div && div >= 4) ? 'D' : '';
    if (letter) return `Brasileirão Série ${letter}`;
    if (club.divisionName && /Série ([ABCD])/i.test(club.divisionName)) {
      const match = club.divisionName.match(/Série ([ABCD])/i);
      if (match) return `Brasileirão Série ${match[1].toUpperCase()}`;
    }
    return 'Brasileirão Série A';
  }
  return club.leagueName || 'Campeonato Nacional';
}
