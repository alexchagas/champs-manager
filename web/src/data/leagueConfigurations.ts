/**
 * League and Division Configurations for Champs Manager 2026.
 * Inspired by Brasfoot's ConfigLigaType, providing authentic structures per country
 * (team count, 1 or 2 turns, groups, mata-mata playoffs, promotion and relegation rules).
 */

export type LeagueFormat = 'round_robin' | 'groups_and_playoffs' | 'apertura_clausura';
export type TiebreakCriteria = 'wins' | 'goal_diff' | 'head_to_head';

export interface DivisionConfig {
  division: number;                   // 1 = 1ª Divisão, 2 = 2ª Divisão, etc.
  name: string;                       // Ex: "Série A", "Premier League", "LaLiga"
  teamCount: number;                  // 20, 18, 16, 24, 64, etc.
  rounds: 1 | 2;                      // 1 = turno único, 2 = turno e returno (ida e volta)
  format: LeagueFormat;               // Formato da disputa
  groupCount?: number;                // Quantidade de grupos (ex: 8 na Série D)
  playoffTeams?: number;              // Quantidade de times no mata-mata
  relegationDirect: number;           // Rebaixamento direto
  relegationPlayoff?: number;         // Repescagem de permanência
  promotionPlayoff?: number;          // Playoff de acesso (mata-mata que sobe)
  tiebreakPriority: TiebreakCriteria; // Critério primário de desempate
}

export interface CountryLeagueConfig {
  countryId: number;
  countryName: string;
  bundleKey: string;
  divisions: DivisionConfig[];
  hasStateChampionships?: boolean;    // Exclusivo Brasil
  hasNationalCup?: boolean;           // Copa do Brasil, FA Cup, Copa del Rey, etc.
}

/**
 * Official country division presets with authentic historical rules.
 */
export const COUNTRY_LEAGUE_PRESETS: Record<number, CountryLeagueConfig> = {
  // Brasil (ID 29)
  29: {
    countryId: 29,
    countryName: 'Brasil',
    bundleKey: 'brazil',
    hasStateChampionships: true,
    hasNationalCup: true,
    divisions: [
      { division: 1, name: 'Brasileirão Série A', teamCount: 20, rounds: 2, format: 'round_robin', relegationDirect: 4, tiebreakPriority: 'wins' },
      { division: 2, name: 'Brasileirão Série B', teamCount: 20, rounds: 2, format: 'round_robin', relegationDirect: 4, tiebreakPriority: 'wins' },
      { division: 3, name: 'Brasileirão Série C', teamCount: 20, rounds: 1, format: 'groups_and_playoffs', groupCount: 1, playoffTeams: 8, promotionPlayoff: 4, relegationDirect: 4, tiebreakPriority: 'wins' },
      { division: 4, name: 'Brasileirão Série D', teamCount: 64, rounds: 2, format: 'groups_and_playoffs', groupCount: 8, playoffTeams: 32, promotionPlayoff: 4, relegationDirect: 0, tiebreakPriority: 'wins' },
    ],
  },

  // Inglaterra (ID 97)
  97: {
    countryId: 97,
    countryName: 'Inglaterra',
    bundleKey: 'england',
    hasStateChampionships: false,
    hasNationalCup: true,
    divisions: [
      { division: 1, name: 'Premier League', teamCount: 20, rounds: 2, format: 'round_robin', relegationDirect: 3, tiebreakPriority: 'goal_diff' },
      { division: 2, name: 'Championship', teamCount: 24, rounds: 2, format: 'round_robin', relegationDirect: 3, promotionPlayoff: 1, tiebreakPriority: 'goal_diff' },
      { division: 3, name: 'League One', teamCount: 24, rounds: 2, format: 'round_robin', relegationDirect: 4, promotionPlayoff: 1, tiebreakPriority: 'goal_diff' },
      { division: 4, name: 'League Two', teamCount: 24, rounds: 2, format: 'round_robin', relegationDirect: 2, promotionPlayoff: 1, tiebreakPriority: 'goal_diff' },
    ],
  },

  // Espanha (ID 65)
  65: {
    countryId: 65,
    countryName: 'Espanha',
    bundleKey: 'spain',
    hasStateChampionships: false,
    hasNationalCup: true,
    divisions: [
      { division: 1, name: 'LaLiga', teamCount: 20, rounds: 2, format: 'round_robin', relegationDirect: 3, tiebreakPriority: 'head_to_head' },
      { division: 2, name: 'LaLiga Hypermotion', teamCount: 22, rounds: 2, format: 'round_robin', relegationDirect: 4, promotionPlayoff: 1, tiebreakPriority: 'head_to_head' },
      { division: 3, name: 'Primera Federación', teamCount: 40, rounds: 2, format: 'groups_and_playoffs', groupCount: 2, playoffTeams: 8, relegationDirect: 10, tiebreakPriority: 'head_to_head' },
    ],
  },

  // Alemanha (ID 3)
  3: {
    countryId: 3,
    countryName: 'Alemanha',
    bundleKey: 'germany',
    hasStateChampionships: false,
    hasNationalCup: true,
    divisions: [
      { division: 1, name: 'Bundesliga', teamCount: 18, rounds: 2, format: 'round_robin', relegationDirect: 2, relegationPlayoff: 1, tiebreakPriority: 'goal_diff' },
      { division: 2, name: '2. Bundesliga', teamCount: 18, rounds: 2, format: 'round_robin', relegationDirect: 2, relegationPlayoff: 1, promotionPlayoff: 1, tiebreakPriority: 'goal_diff' },
      { division: 3, name: '3. Liga', teamCount: 20, rounds: 2, format: 'round_robin', relegationDirect: 4, promotionPlayoff: 1, tiebreakPriority: 'goal_diff' },
    ],
  },

  // Itália (ID 104)
  104: {
    countryId: 104,
    countryName: 'Itália',
    bundleKey: 'italy',
    hasStateChampionships: false,
    hasNationalCup: true,
    divisions: [
      { division: 1, name: 'Serie A', teamCount: 20, rounds: 2, format: 'round_robin', relegationDirect: 3, tiebreakPriority: 'head_to_head' },
      { division: 2, name: 'Serie B', teamCount: 20, rounds: 2, format: 'round_robin', relegationDirect: 3, relegationPlayoff: 1, promotionPlayoff: 1, tiebreakPriority: 'head_to_head' },
    ],
  },

  // França (ID 72)
  72: {
    countryId: 72,
    countryName: 'França',
    bundleKey: 'france',
    hasStateChampionships: false,
    hasNationalCup: true,
    divisions: [
      { division: 1, name: 'Ligue 1', teamCount: 18, rounds: 2, format: 'round_robin', relegationDirect: 2, relegationPlayoff: 1, tiebreakPriority: 'goal_diff' },
      { division: 2, name: 'Ligue 2', teamCount: 20, rounds: 2, format: 'round_robin', relegationDirect: 2, promotionPlayoff: 1, tiebreakPriority: 'goal_diff' },
      { division: 3, name: 'National 1', teamCount: 20, rounds: 2, format: 'round_robin', relegationDirect: 4, promotionPlayoff: 1, tiebreakPriority: 'goal_diff' },
      { division: 4, name: 'National 2', teamCount: 20, rounds: 2, format: 'round_robin', relegationDirect: 4, tiebreakPriority: 'goal_diff' },
    ],
  },

  // Portugal (ID 154)
  154: {
    countryId: 154,
    countryName: 'Portugal',
    bundleKey: 'portugal',
    hasStateChampionships: false,
    hasNationalCup: true,
    divisions: [
      { division: 1, name: 'Liga Portugal', teamCount: 20, rounds: 2, format: 'round_robin', relegationDirect: 2, relegationPlayoff: 1, tiebreakPriority: 'head_to_head' },
      { division: 2, name: 'Liga Portugal 2', teamCount: 20, rounds: 2, format: 'round_robin', relegationDirect: 2, promotionPlayoff: 1, tiebreakPriority: 'head_to_head' },
      { division: 3, name: 'Liga 3', teamCount: 20, rounds: 2, format: 'round_robin', relegationDirect: 4, tiebreakPriority: 'head_to_head' },
      { division: 4, name: 'Campeonato de Portugal', teamCount: 20, rounds: 2, format: 'round_robin', relegationDirect: 4, tiebreakPriority: 'head_to_head' },
    ],
  },

  // Argentina (ID 11)
  11: {
    countryId: 11,
    countryName: 'Argentina',
    bundleKey: 'argentina',
    hasStateChampionships: false,
    hasNationalCup: true,
    divisions: [
      { division: 1, name: 'Liga Profesional', teamCount: 30, rounds: 1, format: 'round_robin', relegationDirect: 2, tiebreakPriority: 'goal_diff' },
      { division: 2, name: 'Primera Nacional', teamCount: 20, rounds: 2, format: 'round_robin', relegationDirect: 2, promotionPlayoff: 1, tiebreakPriority: 'goal_diff' },
      { division: 3, name: 'Primera B Metropolitana', teamCount: 20, rounds: 2, format: 'round_robin', relegationDirect: 2, promotionPlayoff: 1, tiebreakPriority: 'goal_diff' },
      { division: 4, name: 'Primera C', teamCount: 20, rounds: 2, format: 'round_robin', relegationDirect: 2, tiebreakPriority: 'goal_diff' },
    ],
  },

  // México (ID 131)
  131: {
    countryId: 131,
    countryName: 'México',
    bundleKey: 'mexico',
    hasStateChampionships: false,
    hasNationalCup: true,
    divisions: [
      { division: 1, name: 'Liga MX', teamCount: 18, rounds: 1, format: 'apertura_clausura', playoffTeams: 8, relegationDirect: 0, tiebreakPriority: 'goal_diff' },
      { division: 2, name: 'Liga de Expansión MX', teamCount: 15, rounds: 1, format: 'apertura_clausura', playoffTeams: 8, relegationDirect: 0, tiebreakPriority: 'goal_diff' },
    ],
  },

  // Estados Unidos (ID 68)
  68: {
    countryId: 68,
    countryName: 'Estados Unidos',
    bundleKey: 'usa',
    hasStateChampionships: false,
    hasNationalCup: true,
    divisions: [
      { division: 1, name: 'MLS (Major League Soccer)', teamCount: 30, rounds: 2, format: 'groups_and_playoffs', groupCount: 2, playoffTeams: 18, relegationDirect: 0, tiebreakPriority: 'wins' },
    ],
  },

  // Holanda (ID 85)
  85: {
    countryId: 85,
    countryName: 'Holanda',
    bundleKey: 'netherlands',
    hasStateChampionships: false,
    hasNationalCup: true,
    divisions: [
      { division: 1, name: 'Eredivisie', teamCount: 18, rounds: 2, format: 'round_robin', relegationDirect: 2, relegationPlayoff: 1, tiebreakPriority: 'goal_diff' },
      { division: 2, name: 'Eerste Divisie', teamCount: 20, rounds: 2, format: 'round_robin', relegationDirect: 0, promotionPlayoff: 1, tiebreakPriority: 'goal_diff' },
    ],
  },
};

/**
 * Derives a valid league division config for any country, applying the official preset
 * or falling back to Brasfoot's automatic slicing rule based on available clubs.
 */
export function getCountryLeagueConfig(countryId: number, countryName = 'Nacional', totalClubs = 20): CountryLeagueConfig {
  const preset = COUNTRY_LEAGUE_PRESETS[countryId];
  if (preset) {
    return preset;
  }

  // Fallback automático clássico do Brasfoot
  const divisions: DivisionConfig[] = [];
  let remainingClubs = totalClubs;
  let divNum = 1;

  while (divNum <= 4 && remainingClubs >= 10) {
    let size = 20;
    let relegation = 4;

    if (remainingClubs >= 20) {
      size = 20;
      relegation = divNum === 1 ? 4 : 2;
    } else if (remainingClubs >= 18) {
      size = 18;
      relegation = 2;
    } else if (remainingClubs >= 16) {
      size = 16;
      relegation = 2;
    } else if (remainingClubs >= 14) {
      size = 14;
      relegation = 2;
    } else if (remainingClubs >= 12) {
      size = 12;
      relegation = 2;
    } else {
      size = 10;
      relegation = 2;
    }

    divisions.push({
      division: divNum,
      name: `${countryName} • ${divNum}ª Divisão`,
      teamCount: size,
      rounds: 2,
      format: 'round_robin',
      relegationDirect: relegation,
      tiebreakPriority: 'goal_diff',
    });

    remainingClubs -= size;
    divNum++;
  }

  if (divisions.length === 0) {
    divisions.push({
      division: 1,
      name: `${countryName} • Divisão Única`,
      teamCount: Math.max(2, totalClubs),
      rounds: 2,
      format: 'round_robin',
      relegationDirect: 0,
      tiebreakPriority: 'goal_diff',
    });
  }

  return {
    countryId,
    countryName,
    bundleKey: 'world_rest',
    divisions,
    hasNationalCup: true,
  };
}

/**
 * Returns the DivisionConfig for a specific country and division (falling back to the last configured division if division > 4).
 */
export function getDivisionConfig(
  countryId: number = 29,
  division: number = 1,
  countryName = 'Nacional',
  totalClubs = 20
): DivisionConfig | undefined {
  const countryConfig = getCountryLeagueConfig(countryId, countryName, totalClubs);
  const effectiveDiv = countryId === 29 && division >= 4 ? 4 : division;
  return (
    countryConfig.divisions.find((d) => d.division === effectiveDiv) ||
    countryConfig.divisions[countryConfig.divisions.length - 1]
  );
}

/**
 * Converts a 0-based group index to an uppercase alphabetic label (0 -> 'A', 1 -> 'B', ..., 7 -> 'H', 26 -> 'AA').
 */
export function formatGroupLabel(groupIndex: number): string {
  let label = '';
  let value = Math.max(0, groupIndex);
  do {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return label;
}

