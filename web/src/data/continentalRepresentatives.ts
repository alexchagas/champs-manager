/**
 * Continental Tournaments Selection Engine.
 * Selects authentic 16-club fields for international competitions:
 * - Copa Libertadores / Sul-Americana (CONMEBOL)
 * - UEFA Champions League / Europa League (UEFA)
 * - CONCACAF Champions Cup (North & Central America)
 * - AFC / CAF / OFC / FIFA Club World Cup
 *
 * Ensures that even when the user plays in Single-League mode (e.g. Brazil solo),
 * international competitions are authentically populated with elite foreign clubs
 * (e.g. Boca Juniors, River Plate, Peñarol, Real Madrid, Bayern Munich, Man City).
 */

import type { Club } from '../types/index.ts';
import { getAllClubs } from './teamsDatabase.ts';

// South American country IDs
const SOUTH_AMERICA_COUNTRY_IDS = new Set([
  29,  // Brasil
  11,  // Argentina
  195, // Uruguai
  46,  // Colômbia
  42,  // Chile
  150, // Paraguai
  151, // Peru
  60,  // Equador
  26,  // Bolívia
  198, // Venezuela
]);

// European country IDs
const EUROPE_COUNTRY_IDS = new Set([
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

// North and Central America country IDs
const CONCACAF_COUNTRY_IDS = new Set([
  131, // México
  68,  // EUA
  38,  // Canadá
  51,  // Costa Rica
  86,  // Honduras
  147, // Panamá
  58,  // El Salvador
  79,  // Guatemala
  106, // Jamaica
]);

export type ContinentalCompetitionType =
  | 'libertadores'
  | 'sulamericana'
  | 'champions'
  | 'europa_league'
  | 'concacaf'
  | 'mundial';

export interface ContinentalTournamentInfo {
  type: ContinentalCompetitionType;
  name: string;
  clubs: Club[];
}

/**
 * Derives the appropriate continental competition and selects the 16 participating clubs.
 */
export function getContinentalTournamentField(
  userClub: Club,
  availableClubs?: Club[],
  activeCountryIds?: number[]
): ContinentalTournamentInfo {
  const userCountryId = userClub.countryId ?? 29;
  const allClubs = getAllClubs();

  // Combine availableClubs with global database pool to guarantee foreign giants are found
  const poolMap = new Map<number, Club>();
  for (const c of allClubs) {
    poolMap.set(c.id, c);
  }
  if (availableClubs) {
    for (const c of availableClubs) {
      poolMap.set(c.id, c);
    }
  }
  const pool = Array.from(poolMap.values());

  // Determine continent
  const isSouthAmerica = SOUTH_AMERICA_COUNTRY_IDS.has(userCountryId);
  const isEurope = EUROPE_COUNTRY_IDS.has(userCountryId);
  const isConcacaf = CONCACAF_COUNTRY_IDS.has(userCountryId);

  let type: ContinentalCompetitionType = 'libertadores';
  let name = 'Copa Libertadores';

  if (isSouthAmerica) {
    const isElite = (userClub.reputation ?? 3) >= 3 || (userClub.division ?? 1) <= 1;
    type = isElite ? 'libertadores' : 'sulamericana';
    name = isElite ? 'Copa Libertadores' : 'Copa Sul-Americana';
  } else if (isEurope) {
    const isElite = (userClub.reputation ?? 3) >= 4 || (userClub.division ?? 1) <= 1;
    type = isElite ? 'champions' : 'europa_league';
    name = isElite ? 'UEFA Champions League' : 'UEFA Europa League';
  } else if (isConcacaf) {
    type = 'concacaf';
    name = 'CONCACAF Champions Cup';
  } else {
    type = 'mundial';
    name = 'Mundial de Clubes FIFA';
  }

  // Target pool of eligible clubs
  const targetContinentSet = isSouthAmerica
    ? SOUTH_AMERICA_COUNTRY_IDS
    : isEurope
    ? EUROPE_COUNTRY_IDS
    : isConcacaf
    ? CONCACAF_COUNTRY_IDS
    : null;

  // Filter candidates from the target continent (excluding user club for now)
  const candidates = pool.filter((c) => {
    if (c.id === userClub.id) return false;
    if (targetContinentSet && !targetContinentSet.has(c.countryId ?? 29)) return false;
    // Prefer first division / top reputation teams
    return (c.division ?? 1) === 1 || (c.reputation ?? 1) >= 3;
  });

  // Sort candidates by reputation and level
  candidates.sort((a, b) => (b.reputation ?? 1) - (a.reputation ?? 1) || (b.level ?? 10) - (a.level ?? 10));

  // Balanced continental selection:
  // We want representation from multiple countries of the continent!
  const selected: Club[] = [userClub];
  const countPerCountry = new Map<number, number>();
  countPerCountry.set(userCountryId, 1);

  // Maximum allowed clubs from user's own country in the 16-club field (e.g. max 5 from Brazil or Spain)
  const maxOwnCountry = 5;

  for (const candidate of candidates) {
    if (selected.length >= 16) break;
    const cid = candidate.countryId ?? 29;
    const current = countPerCountry.get(cid) || 0;

    if (cid === userCountryId && current >= maxOwnCountry) {
      continue;
    }

    // Limit any single foreign country to 4 clubs to ensure international diversity
    if (cid !== userCountryId && current >= 4) {
      continue;
    }

    selected.push(candidate);
    countPerCountry.set(cid, current + 1);
  }

  // If still fewer than 16, fill with highest remaining candidates
  if (selected.length < 16) {
    const selectedIds = new Set(selected.map((c) => c.id));
    for (const candidate of candidates) {
      if (selected.length >= 16) break;
      if (!selectedIds.has(candidate.id)) {
        selected.push(candidate);
        selectedIds.add(candidate.id);
      }
    }
  }

  // Fallback safety to guarantee exactly 16 clubs
  if (selected.length < 16) {
    const selectedIds = new Set(selected.map((c) => c.id));
    for (const candidate of pool) {
      if (selected.length >= 16) break;
      if (!selectedIds.has(candidate.id)) {
        selected.push(candidate);
        selectedIds.add(candidate.id);
      }
    }
  }

  return {
    type,
    name,
    clubs: selected.slice(0, 16),
  };
}
