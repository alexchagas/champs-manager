import type { Player, Position, GameState } from '../types/index.ts';

export interface SectorGroup {
  key: string;
  name: string;
  players: Player[];
  avgStrength: number;
}

export interface ClubCampaignSummary {
  competitionName: string;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  winRate: number; // 0 to 100%
  position?: number;
  totalTeams?: number;
  form: ('V' | 'E' | 'D')[];
}

/**
 * Calculates current season campaign summary for a given club.
 */
export function getClubCampaign(clubId: number, gameState: GameState): ClubCampaignSummary {
  const currentCompetition = (gameState.calendar || []).find(
    (f) => (f.fixtureDateIndex ?? f.round) === gameState.currentRound
  )?.competitionType;

  // Build candidate sources, starting with current active competition
  const activeSources: { name: string; list?: typeof gameState.standings }[] = [];
  if (currentCompetition === 'estadual') {
    activeSources.push({ name: gameState.stateChampionshipName || 'Campeonato Estadual', list: gameState.standingsEstadual });
  } else if (currentCompetition === 'libertadores' || currentCompetition === 'sulamericana' || currentCompetition === 'champions') {
    activeSources.push({ name: gameState.continentalCupName || 'Copa Continental', list: gameState.standingsContinental });
  } else if (gameState.standingsNacional && gameState.standingsNacional.length > 0) {
    activeSources.push({ name: gameState.nationalLeagueName || gameState.leagueName || 'Campeonato Nacional', list: gameState.standingsNacional });
  }

  const allSources = [
    ...activeSources,
    { name: gameState.nationalLeagueName || gameState.leagueName || 'Campeonato Nacional', list: gameState.standingsNacional },
    { name: gameState.stateChampionshipName || 'Campeonato Estadual', list: gameState.standingsEstadual },
    { name: gameState.continentalCupName || 'Copa Continental', list: gameState.standingsContinental },
    { name: gameState.leagueName || 'Campeonato', list: gameState.standings },
  ];

  let candidateZero: ClubCampaignSummary | null = null;

  for (const src of allSources) {
    if (src.list && src.list.length > 0) {
      const idx = src.list.findIndex((r) => r.clubId === clubId);
      if (idx !== -1) {
        const row = src.list[idx];
        const played = row.played || 0;
        const maxPts = played * 3;
        const winRate = maxPts > 0 ? Math.round((row.points / maxPts) * 100) : 0;
        const summary: ClubCampaignSummary = {
          competitionName: src.name,
          points: row.points,
          played: row.played,
          won: row.won,
          drawn: row.drawn,
          lost: row.lost,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          goalDiff: row.goalDiff,
          winRate,
          position: idx + 1,
          totalTeams: src.list.length,
          form: row.form || [],
        };

        if (played > 0) {
          return summary;
        }
        if (!candidateZero) {
          candidateZero = summary;
        }
      }
    }
  }

  if (candidateZero) {
    return candidateZero;
  }

  // Fallback to calendar match results
  const matches = (gameState.calendar || []).filter(
    (f) => f.played && (f.homeClubId === clubId || f.awayClubId === clubId) && f.homeScore !== undefined && f.awayScore !== undefined
  );

  let points = 0;
  let won = 0;
  let drawn = 0;
  let lost = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  const form: ('V' | 'E' | 'D')[] = [];

  for (const m of matches) {
    const isHome = m.homeClubId === clubId;
    const scored = isHome ? (m.homeScore ?? 0) : (m.awayScore ?? 0);
    const conceded = isHome ? (m.awayScore ?? 0) : (m.homeScore ?? 0);
    goalsFor += scored;
    goalsAgainst += conceded;

    if (scored > conceded) {
      won++;
      points += 3;
      form.push('V');
    } else if (scored === conceded) {
      drawn++;
      points += 1;
      form.push('E');
    } else {
      lost++;
      form.push('D');
    }
  }

  const played = matches.length;
  const maxPts = played * 3;
  const winRate = maxPts > 0 ? Math.round((points / maxPts) * 100) : 0;

  return {
    competitionName: gameState.leagueName || 'Temporada Atual',
    points,
    played,
    won,
    drawn,
    lost,
    goalsFor,
    goalsAgainst,
    goalDiff: goalsFor - goalsAgainst,
    winRate,
    form,
  };
}

/**
 * Groups a squad into 5 sectors: Goleiros, Zagueiros, Laterais, Meias, Atacantes.
 */
export function groupSquadBySector(squad: Player[]): SectorGroup[] {
  const sectorsConfig: { key: string; name: string; match: (pos: Position) => boolean }[] = [
    { key: 'gol', name: 'Goleiros', match: (p) => p === 'GOL' },
    { key: 'zag', name: 'Zagueiros', match: (p) => p === 'ZAG' },
    { key: 'lat', name: 'Laterais', match: (p) => p === 'LAT' },
    { key: 'mei', name: 'Meias', match: (p) => p === 'VOL' || p === 'MEI' },
    { key: 'ata', name: 'Atacantes', match: (p) => p === 'ATA' },
  ];

  return sectorsConfig.map((sec) => {
    const players = (squad || []).filter((p) => sec.match(p.position));
    const sorted = [...players].sort((a, b) => {
      if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
      return b.strength - a.strength;
    });
    const avgStrength = sorted.length > 0
      ? Math.round(sorted.reduce((acc, p) => acc + p.strength, 0) / sorted.length)
      : 0;
    return {
      key: sec.key,
      name: sec.name,
      players: sorted,
      avgStrength,
    };
  });
}
