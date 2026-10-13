import type { Club, CountryInfo, LeagueInfo, StateInfo } from '../types/index.ts';
import { getAllClubs, registerClubs } from './teamsDatabase.ts';

export interface ClubIndexItem {
  id: number;
  name: string;
  fileRef: string;
  countryId: number;
  countryName: string;
  stateId?: number | null;
  stateCode?: string | null;
  division: number;
  divisionName: string;
  leagueName: string;
  reputation: number;
  level: number;
  stadium: string;
  capacity: number;
  coach: string;
  primaryColor: string;
  secondaryColor: string;
  bundleKey: string;
}

export interface LeaguesMeta {
  version: number;
  totalClubs: number;
  countries: (CountryInfo & { bundleKey?: string })[];
  leagues: LeagueInfo[];
  states: StateInfo[];
  clubsIndex: ClubIndexItem[];
}

const loadedBundles = new Map<string, Club[]>();
let cachedMeta: LeaguesMeta | null = null;

/**
 * Loads the lightweight leagues metadata index.
 * In browser: fetches `/data/leagues/leagues_meta.json`.
 * Fallback: derives meta from `teamsDatabase.json`.
 */
export async function getLeaguesMeta(): Promise<LeaguesMeta> {
  if (cachedMeta) return cachedMeta;

  try {
    if (typeof fetch !== 'undefined') {
      const res = await fetch('/data/leagues/leagues_meta.json');
      if (res.ok) {
        cachedMeta = (await res.json()) as LeaguesMeta;
        return cachedMeta;
      }
    }
  } catch (err) {
    console.warn('Could not fetch leagues_meta.json, falling back to bundled db:', err);
  }

  // Fallback to bundled database
  const clubs = getAllClubs();
  const index: ClubIndexItem[] = clubs.map((c) => ({
    id: c.id,
    name: c.name,
    fileRef: c.fileRef || '',
    countryId: c.countryId || 29,
    countryName: c.countryId === 29 ? 'Brasil' : 'Internacional',
    stateId: c.stateId,
    stateCode: c.stateCode,
    division: c.division || 1,
    divisionName: c.divisionName || '1ª Divisão',
    leagueName: c.leagueName || 'Campeonato Nacional',
    reputation: c.reputation || 3,
    level: c.level || 10,
    stadium: c.stadium || 'Estádio Municipal',
    capacity: c.capacity || 20000,
    coach: c.coach || 'Técnico',
    primaryColor: c.primaryColor || '#000000',
    secondaryColor: c.secondaryColor || '#ffffff',
    bundleKey: c.countryId === 29 ? 'brazil' : 'world_rest',
  }));

  cachedMeta = {
    version: 2026,
    totalClubs: clubs.length,
    countries: [],
    leagues: [],
    states: [],
    clubsIndex: index,
  };
  return cachedMeta;
}

/**
 * Loads a regional league bundle with full squads (e.g. 'portugal', 'brazil', 'spain').
 */
export async function loadLeagueBundle(bundleKey: string): Promise<Club[]> {
  if (loadedBundles.has(bundleKey)) {
    return loadedBundles.get(bundleKey)!;
  }

  try {
    if (typeof fetch !== 'undefined') {
      const res = await fetch(`/data/leagues/${bundleKey}.json`);
      if (res.ok) {
        const clubs = (await res.json()) as Club[];
        loadedBundles.set(bundleKey, clubs);
        registerClubs(clubs);
        return clubs;
      }
    }
  } catch (err) {
    console.warn(`Could not fetch league bundle ${bundleKey}:`, err);
  }

  // Fallback: clubs from bundled database
  const fallbackClubs = getAllClubs();
  return fallbackClubs;
}

/**
 * Loads all clubs for a list of active countries (e.g. [154, 29] for Portugal + Brazil).
 */
export async function loadClubsForActiveCountries(countryIds: number[]): Promise<Club[]> {
  const meta = await getLeaguesMeta();
  const bundleKeys = new Set<string>();

  for (const cid of countryIds) {
    const country = meta.countries.find((c) => c.id === cid);
    const key = (country as { bundleKey?: string })?.bundleKey || (cid === 29 ? 'brazil' : cid === 154 ? 'portugal' : 'world_rest');
    bundleKeys.add(key);
  }

  const bundlePromises = Array.from(bundleKeys).map((key) => loadLeagueBundle(key));
  const results = await Promise.all(bundlePromises);

  const merged = new Map<number, Club>();
  for (const list of results) {
    for (const club of list) {
      merged.set(club.id, club);
    }
  }

  return Array.from(merged.values());
}
