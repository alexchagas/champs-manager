import type { Club, CountryInfo, LeagueInfo, StateInfo } from '../types/index.ts';
import databaseRaw from './teamsDatabase.json' with { type: 'json' };

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
    if (!database.leagues.some((item) => item.id === l.id || (item.countryId === l.countryId && item.division === l.division))) {
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
  const league = findLeagueForClub(selectedClub.id);

  let competitionClubs: Club[] = [];
  let leagueName = league?.name || selectedClub.leagueName || 'Campeonato Nacional';
  let divisionName = league?.divisionName || selectedClub.divisionName || '1ª Divisão';
  const country = countriesById.get(selectedClub.countryId || 29);
  const countryName = country?.name || (selectedClub as { countryName?: string }).countryName || (selectedClub.countryId === 29 ? 'Brasil' : 'Internacional');

  if (league && league.clubIds.length > 0) {
    const allLeagueClubs = customPool
      ? league.clubIds.map((id) => customPool.find((c) => c.id === id) || clubsById.get(id)!).filter(Boolean)
      : getClubsByLeague(league);

    // If it's Série D (64 clubs), take the 8-team subgroup containing the chosen club
    if (allLeagueClubs.length > 24) {
      const idx = allLeagueClubs.findIndex((c) => c.id === selectedClub.id);
      const groupSize = 8;
      const groupIndex = idx >= 0 ? Math.floor(idx / groupSize) : 0;
      const start = groupIndex * groupSize;
      competitionClubs = allLeagueClubs.slice(start, start + groupSize);
      leagueName = `Brasileirão Série D • Grupo ${groupIndex + 1}`;
      divisionName = `Série D (Grupo ${groupIndex + 1})`;
    } else {
      competitionClubs = allLeagueClubs;
    }
  }

  // Fallback if no clubs found or only 1 club:
  if (competitionClubs.length < 2) {
    const pool = customPool || database.clubs;
    const sameCountryClubs = pool.filter((c) => c.countryId === (selectedClub.countryId || 29) && (selectedClub.division ? c.division === selectedClub.division : true));
    if (sameCountryClubs.length >= 4) {
      competitionClubs = sameCountryClubs.slice(0, 20);
    } else {
      const allSameCountry = pool.filter((c) => c.countryId === (selectedClub.countryId || 29));
      if (allSameCountry.length >= 2) {
        competitionClubs = allSameCountry.slice(0, 20);
      } else {
        competitionClubs = pool
          .filter((c) => Math.abs(c.reputation - selectedClub.reputation) <= 1)
          .slice(0, 20);
      }
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
