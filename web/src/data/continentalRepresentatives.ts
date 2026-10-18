/**
 * Continental Tournaments Selection & Seeding Engine.
 * Selects authentic 32-club fields (8 groups of 4: Grupo A to Grupo H) for international competitions:
 * - Copa Libertadores & Copa Sul-Americana (CONMEBOL)
 * - UEFA Champions League & UEFA Europa League (UEFA)
 * - CONCACAF Champions Cup (North & Central America)
 * - AFC / CAF / OFC / FIFA Club World Cup
 */

import type { Club, StandingRow, TournamentRecord } from '../types/index.ts';
import { getAllClubs, PRE_LIB_PLACEHOLDER_CLUBS } from './teamsDatabase.ts';

// South American country IDs
export const SOUTH_AMERICA_COUNTRY_IDS = new Set([
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
export const EUROPE_COUNTRY_IDS = new Set([
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
export const CONCACAF_COUNTRY_IDS = new Set([
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

export interface ContinentalQualificationResult {
  libertadoresDirectClubIds: number[];
  preLibertadoresClubIds: number[];
  libertadoresClubIds: number[];
  sulAmericanaClubIds: number[];
  copaDirectOitavasIds: number[];
}

export interface ContinentalTournamentOptions {
  userParticipates?: boolean;
  forceUserParticipation?: boolean;
  forceType?: ContinentalCompetitionType;
  teamCount?: number;
  excludeClubIds?: Set<number>;
  qualifiedLibertadoresIds?: number[];
  qualifiedPreLibertadoresIds?: number[];
  qualifiedSulAmericanaIds?: number[];
  seasonYear?: number;
}

export interface ContinentalTournamentInfo {
  type: ContinentalCompetitionType;
  name: string;
  clubs: Club[];
  preLibertadoresClubs?: Club[];
  userParticipates: boolean;
}

const SP_TRADITIONAL_HEADS = new Set(['Palmeiras', 'Corinthians', 'São Paulo', 'Santos']);

/**
 * Distributes clubs into balanced groups using seeded Pots (Cabeças de Chave).
 * Pot 1 (top `groupCount` clubs) places 1 club in each group (Grupo A .. Grupo N),
 * followed by Pot 2, Pot 3, Pot 4, etc.
 * Returns the clubs ordered group-by-group so `slice(g * groupSize, (g + 1) * groupSize)` yields each group.
 */
export function seedClubsByPots(
  clubs: Club[],
  groupCount: number,
  seed = 2026,
  prioritizeSpGiants = false
): Club[] {
  if (groupCount <= 1 || clubs.length < groupCount * 2) {
    return clubs;
  }

  const sorted = [...clubs].sort((a, b) => {
    if (prioritizeSpGiants) {
      const aGiant = SP_TRADITIONAL_HEADS.has(a.name) ? 1 : 0;
      const bGiant = SP_TRADITIONAL_HEADS.has(b.name) ? 1 : 0;
      if (aGiant !== bGiant) return bGiant - aGiant;
    }
    const divA = a.division ?? 5;
    const divB = b.division ?? 5;
    if (divA !== divB) return divA - divB;
    const repDiff = (b.reputation ?? 1) - (a.reputation ?? 1);
    if (repDiff !== 0) return repDiff;
    const levelDiff = (b.level ?? 10) - (a.level ?? 10);
    if (levelDiff !== 0) return levelDiff;
    return a.name.localeCompare(b.name);
  });

  const groups: Club[][] = Array.from({ length: groupCount }, () => []);
  const potCount = Math.ceil(sorted.length / groupCount);

  for (let p = 0; p < potCount; p++) {
    const potClubs = sorted.slice(p * groupCount, (p + 1) * groupCount);
    // Deterministic rotation per pot and season so groups vary slightly across seasons while keeping 1 club per pot
    const offset = p === 0 ? 0 : (seed + p * 3) % groupCount;
    for (let i = 0; i < potClubs.length; i++) {
      const targetGroup = (i + offset) % groupCount;
      groups[targetGroup].push(potClubs[i]);
    }
  }

  return groups.flat();
}

/**
 * Computes which Brazilian clubs qualify for Copa Libertadores (Direct Group Stage + Pré-Libertadores),
 * Copa Sul-Americana, and Copa do Brasil Oitavas de Final based on Série A standings and cup titles.
 */
export function computeContinentalQualifiers(
  pool: Club[],
  serieAStandings?: StandingRow[],
  seasonRecords?: TournamentRecord[]
): ContinentalQualificationResult {
  const brazilSerieA = pool
    .filter((c) => (c.countryId ?? 29) === 29 && (c.division ?? 1) === 1)
    .sort((a, b) => (b.reputation ?? 1) - (a.reputation ?? 1) || (b.level ?? 10) - (a.level ?? 10) || a.name.localeCompare(b.name));

  const orderedSerieAIds =
    serieAStandings && serieAStandings.length >= 12
      ? serieAStandings.map((r) => r.clubId)
      : brazilSerieA.map((c) => c.id);

  const libertadoresDirectSet = new Set<number>();

  // 1. Cup winners (Libertadores, Sul-Americana, Copa do Brasil) get direct spots in Libertadores Group Stage
  if (seasonRecords && seasonRecords.length > 0) {
    for (const rec of seasonRecords) {
      if (
        rec.competitionType === 'libertadores' ||
        rec.competitionType === 'sulamericana' ||
        rec.competitionType === 'copa'
      ) {
        const winnerClub = pool.find((c) => c.id === rec.winnerClubId);
        if (winnerClub && (winnerClub.countryId ?? 29) === 29) {
          libertadoresDirectSet.add(winnerClub.id);
        }
      }
    }
  }

  // 2. Top 4 from Brasileirão Série A get direct spots in Libertadores Group Stage (opening G5/G6 if cup winners are in top 4)
  let directLeagueSpotsAdded = 0;
  for (const clubId of orderedSerieAIds) {
    if (directLeagueSpotsAdded >= 4) break;
    if (!libertadoresDirectSet.has(clubId)) {
      libertadoresDirectSet.add(clubId);
      directLeagueSpotsAdded++;
    }
  }

  // 3. Next 2 from Brasileirão Série A (5º and 6º places) qualify for Pré-Libertadores
  const preLibertadoresSet = new Set<number>();
  for (const clubId of orderedSerieAIds) {
    if (preLibertadoresSet.size >= 2) break;
    if (!libertadoresDirectSet.has(clubId)) {
      preLibertadoresSet.add(clubId);
    }
  }

  const libertadoresSet = new Set<number>([...libertadoresDirectSet, ...preLibertadoresSet]);

  // 4. Next 6 from Brasileirão Série A qualify for Copa Sul-Americana
  const sulAmericanaSet = new Set<number>();
  for (const clubId of orderedSerieAIds) {
    if (sulAmericanaSet.size >= 6) break;
    if (!libertadoresSet.has(clubId)) {
      sulAmericanaSet.add(clubId);
    }
  }

  // 5. 8 clubs enter directly in Copa do Brasil Oitavas de Final (Libertadores qualifiers + best remaining Série A)
  const copaDirectSet = new Set<number>(libertadoresSet);
  for (const clubId of orderedSerieAIds) {
    if (copaDirectSet.size >= 8) break;
    copaDirectSet.add(clubId);
  }

  return {
    libertadoresDirectClubIds: Array.from(libertadoresDirectSet),
    preLibertadoresClubIds: Array.from(preLibertadoresSet),
    libertadoresClubIds: Array.from(libertadoresSet),
    sulAmericanaClubIds: Array.from(sulAmericanaSet),
    copaDirectOitavasIds: Array.from(copaDirectSet).slice(0, 8),
  };
}

/**
 * Derives the appropriate continental competition, selects the 32 participating clubs (8 groups A-H),
 * and builds the 16-club Pré-Libertadores bracket (2ª Fase -> 3ª Fase -> 4 Group Stage Pot 4 spots).
 */
export function getContinentalTournamentField(
  userClub: Club,
  availableClubs?: Club[],
  _activeCountryIds?: number[],
  options?: ContinentalTournamentOptions
): ContinentalTournamentInfo {
  const userCountryId = userClub.countryId ?? 29;
  const targetSize = options?.teamCount ?? 32;
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

  const isSouthAmerica = SOUTH_AMERICA_COUNTRY_IDS.has(userCountryId);
  const isEurope = EUROPE_COUNTRY_IDS.has(userCountryId);
  const isConcacaf = CONCACAF_COUNTRY_IDS.has(userCountryId);

  const qualifiers = computeContinentalQualifiers(pool);
  const libQualifiers = new Set(options?.qualifiedLibertadoresIds ?? qualifiers.libertadoresClubIds);
  const preLibQualifiers = new Set(options?.qualifiedPreLibertadoresIds ?? qualifiers.preLibertadoresClubIds);
  const sulaQualifiers = new Set(options?.qualifiedSulAmericanaIds ?? qualifiers.sulAmericanaClubIds);

  const isLowerDivision = (userClub.division ?? 1) > 1;
  const userInLib = libQualifiers.has(userClub.id);
  const userInSula = sulaQualifiers.has(userClub.id);

  let type: ContinentalCompetitionType = 'libertadores';
  let name = 'Copa Libertadores';
  let userParticipates = false;

  if (options?.forceType) {
    type = options.forceType;
    name =
      type === 'sulamericana'
        ? 'Copa Sul-Americana'
        : type === 'libertadores'
        ? 'Copa Libertadores'
        : type === 'europa_league'
        ? 'UEFA Europa League'
        : type === 'champions'
        ? 'UEFA Champions League'
        : type === 'concacaf'
        ? 'CONCACAF Champions Cup'
        : 'Mundial de Clubes FIFA';
    userParticipates =
      options.forceUserParticipation ??
      (type === 'libertadores' ? userInLib : type === 'sulamericana' ? userInSula : !isLowerDivision);
  } else if (isSouthAmerica) {
    if (options?.forceUserParticipation) {
      type = 'libertadores';
      name = 'Copa Libertadores';
      userParticipates = true;
    } else if (userCountryId === 29) {
      if (userInLib) {
        type = 'libertadores';
        name = 'Copa Libertadores';
        userParticipates = true;
      } else if (userInSula) {
        type = 'sulamericana';
        name = 'Copa Sul-Americana';
        userParticipates = true;
      } else {
        type = 'libertadores';
        name = 'Copa Libertadores';
        userParticipates = options?.userParticipates ?? false;
      }
    } else {
      type = 'libertadores';
      name = 'Copa Libertadores';
      userParticipates = options?.userParticipates ?? !isLowerDivision;
    }
  } else if (isEurope) {
    type = 'champions';
    name = 'UEFA Champions League';
    userParticipates = options?.forceUserParticipation ?? (options?.userParticipates ?? !isLowerDivision);
  } else if (isConcacaf) {
    type = 'concacaf';
    name = 'CONCACAF Champions Cup';
    userParticipates = options?.forceUserParticipation ?? (options?.userParticipates ?? !isLowerDivision);
  } else {
    type = 'mundial';
    name = 'Mundial de Clubes FIFA';
    userParticipates = options?.forceUserParticipation ?? (options?.userParticipates ?? !isLowerDivision);
  }

  const targetContinentSet = isSouthAmerica
    ? SOUTH_AMERICA_COUNTRY_IDS
    : isEurope
    ? EUROPE_COUNTRY_IDS
    : isConcacaf
    ? CONCACAF_COUNTRY_IDS
    : null;

  const excluded = options?.excludeClubIds ?? new Set<number>();

  const isLibertadores32 = type === 'libertadores' && targetSize === 32;
  const directTargetSize = isLibertadores32 ? 28 : targetSize;

  // Filter candidates from the target continent
  const candidates = pool.filter((c) => {
    if (excluded.has(c.id)) return false;
    if (c.id === userClub.id) return false;
    if (targetContinentSet && !targetContinentSet.has(c.countryId ?? 29)) return false;
    if (isSouthAmerica && c.countryId === 29) {
      if (type === 'libertadores') {
        if (preLibQualifiers.has(c.id)) return false;
        return libQualifiers.has(c.id) || (c.division ?? 1) === 1;
      }
      if (type === 'sulamericana') {
        return !libQualifiers.has(c.id) && !preLibQualifiers.has(c.id) && (sulaQualifiers.has(c.id) || (c.division ?? 1) <= 2);
      }
    }
    return (c.division ?? 1) === 1 || (c.reputation ?? 1) >= 3;
  });

  // Sort candidates prioritizing official qualifiers for Brazil, then reputation and level
  candidates.sort((a, b) => {
    if (isSouthAmerica) {
      const aQual =
        (type === 'libertadores' && libQualifiers.has(a.id)) ||
        (type === 'sulamericana' && sulaQualifiers.has(a.id))
          ? 1
          : 0;
      const bQual =
        (type === 'libertadores' && libQualifiers.has(b.id)) ||
        (type === 'sulamericana' && sulaQualifiers.has(b.id))
          ? 1
          : 0;
      if (aQual !== bQual) return bQual - aQual;
    }
    return (b.reputation ?? 1) - (a.reputation ?? 1) || (b.level ?? 10) - (a.level ?? 10);
  });

  const userDirect = userParticipates && (!isLibertadores32 || !preLibQualifiers.has(userClub.id));
  const selected: Club[] = userDirect ? [userClub] : [];
  const countPerCountry = new Map<number, number>();
  if (userDirect) {
    countPerCountry.set(userCountryId, 1);
  }

  const maxOwnCountry = directTargetSize >= 28 ? 7 : 5;
  const maxForeignCountry = directTargetSize >= 28 ? 6 : 4;

  for (const candidate of candidates) {
    if (selected.length >= directTargetSize) break;
    const cid = candidate.countryId ?? 29;
    const current = countPerCountry.get(cid) || 0;

    if (cid === userCountryId && current >= maxOwnCountry) {
      continue;
    }
    if (cid !== userCountryId && current >= maxForeignCountry) {
      continue;
    }

    selected.push(candidate);
    countPerCountry.set(cid, current + 1);
  }

  if (selected.length < directTargetSize) {
    const selectedIds = new Set(selected.map((c) => c.id));
    for (const candidate of candidates) {
      if (selected.length >= directTargetSize) break;
      if (!selectedIds.has(candidate.id)) {
        selected.push(candidate);
        selectedIds.add(candidate.id);
      }
    }
  }

  if (selected.length < directTargetSize) {
    const selectedIds = new Set(selected.map((c) => c.id));
    for (const candidate of pool) {
      if (selected.length >= directTargetSize) break;
      if (!excluded.has(candidate.id) && !selectedIds.has(candidate.id) && !preLibQualifiers.has(candidate.id)) {
        selected.push(candidate);
        selectedIds.add(candidate.id);
      }
    }
  }

  const groupCount = Math.max(1, Math.floor(targetSize / 4));
  let seededClubs = seedClubsByPots(selected.slice(0, directTargetSize), groupCount, options?.seasonYear ?? 2026);
  let preLibertadoresClubs: Club[] | undefined;

  // Build 16-club Pré-Libertadores field for 32-club Copa Libertadores:
  // 4 brackets of 4 clubs (2ª Fase: 8 ties -> 3ª Fase: 4 ties -> 4 winners fill Pot 4 of Groups E, F, G, H)
  if (isLibertadores32 && groupCount === 8) {
    // 28 direct clubs are distributed across 8 groups (4 in A-D, 3 in E-H)
    // Groups E, F, G, H hold the 4 placeholder slots for Pré-Libertadores winners
    const groups: Club[][] = Array.from({ length: 8 }, () => []);
    let directIdx = 0;
    // 4 clubs in Groups A-D
    for (let g = 0; g < 4; g++) {
      for (let i = 0; i < 4; i++) {
        if (directIdx < seededClubs.length) {
          groups[g].push(seededClubs[directIdx++]);
        }
      }
    }
    // 3 clubs in Groups E-H + 1 placeholder slot (Pot 4)
    for (let g = 4; g < 8; g++) {
      for (let i = 0; i < 3; i++) {
        if (directIdx < seededClubs.length) {
          groups[g].push(seededClubs[directIdx++]);
        }
      }
      groups[g].push(PRE_LIB_PLACEHOLDER_CLUBS[g - 4]);
    }
    seededClubs = groups.flat();

    // Now select the 16 clubs for Pré-Libertadores:
    // 1. Brazilian Pré-Libertadores qualifiers (from preLibQualifiers, including userClub if applicable)
    const directIds = new Set(seededClubs.map((c) => c.id));
    const brPreClubs = pool.filter(
      (c) => (c.countryId ?? 29) === 29 && preLibQualifiers.has(c.id)
    );
    if (userParticipates && preLibQualifiers.has(userClub.id) && !brPreClubs.some((c) => c.id === userClub.id)) {
      brPreClubs.unshift(userClub);
    }

    // 2. Foreign South American clubs (excluding direct qualifiers and excluded)
    const foreignPreCandidates = pool
      .filter(
        (c) =>
          !directIds.has(c.id) &&
          !excluded.has(c.id) &&
          !brPreClubs.some((b) => b.id === c.id) &&
          SOUTH_AMERICA_COUNTRY_IDS.has(c.countryId ?? 29) &&
          c.countryId !== 29
      )
      .sort((a, b) => (b.reputation ?? 1) - (a.reputation ?? 1) || (b.level ?? 10) - (a.level ?? 10) || a.name.localeCompare(b.name));

    const totalNeeded = 16 - brPreClubs.length;
    const chosenForeign = foreignPreCandidates.slice(0, totalNeeded);
    const pre16 = [...brPreClubs, ...chosenForeign];

    if (pre16.length >= 16) {
      // Partition into 4 brackets of 4 clubs:
      // Bracket 0: winner -> Grupo E (slot 19)
      // Bracket 1: winner -> Grupo F (slot 23)
      // Bracket 2: winner -> Grupo G (slot 27)
      // Bracket 3: winner -> Grupo H (slot 31)
      preLibertadoresClubs = [];
      for (let b = 0; b < 4; b++) {
        preLibertadoresClubs.push(
          pre16[b * 4],
          pre16[b * 4 + 1],
          pre16[b * 4 + 2],
          pre16[b * 4 + 3]
        );
      }
    }
  }

  return {
    type,
    name,
    clubs: seededClubs,
    preLibertadoresClubs,
    userParticipates,
  };
}

