import type { Club, MatchFixture, StandingRow } from '../types/index.ts';
import { getContinentalTournamentField } from './continentalRepresentatives.ts';

// Standard Berger / round-robin scheduling algorithm
export function generateLeagueCalendar(clubs: Club[]): MatchFixture[] {
  const n = clubs.length;
  if (n < 2) return [];

  const clubIds = clubs.map((c) => c.id);
  const rounds: { home: number; away: number }[][] = [];

  // Berger tables
  const teams: (number | null)[] = clubs.map((c) => c.id);
  if (teams.length % 2 !== 0) {
    teams.push(null); // Dummy team for BYE
  }
  const totalTeams = teams.length;
  const numRounds = totalTeams - 1;
  const halfSize = totalTeams / 2;

  for (let round = 0; round < numRounds; round++) {
    const roundMatches: { home: number; away: number }[] = [];
    for (let i = 0; i < halfSize; i++) {
      const first = teams[i];
      const second = teams[totalTeams - 1 - i];
      if (first !== null && second !== null) {
        if (round % 2 === 0) {
          roundMatches.push({ home: first, away: second });
        } else {
          roundMatches.push({ home: second, away: first });
        }
      }
    }
    rounds.push(roundMatches);
    // Rotate array preserving index 0
    teams.splice(1, 0, teams.pop()!);
  }

  const allFixtures: MatchFixture[] = [];
  let fixtureId = 1;

  // Turno (Rounds 1 to 19)
  for (let r = 0; r < rounds.length; r++) {
    for (const match of rounds[r]) {
      allFixtures.push({
        id: fixtureId++,
        round: r + 1,
        homeClubId: match.home,
        awayClubId: match.away,
        played: false,
      });
    }
  }

  // Returno (Rounds 20 to 38) - Inverted home/away
  for (let r = 0; r < rounds.length; r++) {
    for (const match of rounds[r]) {
      allFixtures.push({
        id: fixtureId++,
        round: r + 1 + numRounds,
        homeClubId: match.away,
        awayClubId: match.home,
        played: false,
      });
    }
  }

  return allFixtures;
}

export function getStateChampionshipName(stateCode?: string, stateId?: number): string {
  const code = (stateCode || '').toUpperCase();
  switch (code) {
    case 'SP': return 'Campeonato Paulista (Paulistão)';
    case 'RJ': return 'Campeonato Carioca';
    case 'MG': return 'Campeonato Mineiro';
    case 'RS': return 'Campeonato Gaúcho';
    case 'PR': return 'Campeonato Paranaense';
    case 'SC': return 'Campeonato Catarinense';
    case 'BA': return 'Campeonato Baiano';
    case 'PE': return 'Campeonato Pernambucano';
    case 'CE': return 'Campeonato Cearense';
    case 'GO': return 'Campeonato Goiano';
    default:
      if (stateId === 25) return 'Campeonato Paulista (Paulistão)';
      if (stateId === 18) return 'Campeonato Carioca';
      if (stateId === 11) return 'Campeonato Mineiro';
      if (stateId === 22) return 'Campeonato Gaúcho';
      return code ? `Campeonato Estadual (${code})` : 'Campeonato Estadual';
  }
}

/** Builds a dated season with independent competition rounds and chronological date slots. */
export function generateTwoSemesterCalendar(
  userClub: Club,
  nationalClubs: Club[],
  allAvailableClubs?: Club[],
  seasonYear = 2026
): {
  calendar: MatchFixture[];
  estadualName: string;
  nacionalName: string;
  continentalName: string;
  semester1Clubs: Club[];
  semester2Clubs: Club[];
  continentalClubs: Club[];
} {
  const isBrazil = userClub.countryId === 29;
  const estadualName = getStateChampionshipName(userClub.stateCode, userClub.stateId);
  const nacionalName = userClub.leagueName || 'Brasileirão Série A';

  const pool = allAvailableClubs && allAvailableClubs.length > 0 ? allAvailableClubs : nationalClubs;
  const sameState = (c: Club) => c.countryId === 29 && (
    (userClub.stateId != null && c.stateId === userClub.stateId) ||
    (userClub.stateCode != null && c.stateCode === userClub.stateCode)
  );
  const stateClubs = isBrazil ? [userClub, ...pool.filter(c => c.id !== userClub.id && sameState(c))] : [];
  const semester1Clubs = stateClubs.slice(0, 12);
  const semester2Clubs = nationalClubs.length >= 2 ? nationalClubs : pool.slice(0, 20);

  const continentalInfo = getContinentalTournamentField(userClub, pool);
  const continentalName = continentalInfo.name;
  const continentalClubs = continentalInfo.clubs;
  const allFixtures: MatchFixture[] = [];
  let nextId = 1;
  const firstSunday = new Date(Date.UTC(seasonYear, 0, 1));
  firstSunday.setUTCDate(firstSunday.getUTCDate() + (7 - firstSunday.getUTCDay()) % 7);
  const dateAt = (week: number, dayOffset = 0) => {
    const date = new Date(firstSunday);
    date.setUTCDate(date.getUTCDate() + week * 7 + dayOffset);
    return date.toISOString().slice(0, 10);
  };
  const addRound = (fixtures: MatchFixture[], localRound: number, week: number, type: MatchFixture['competitionType'], name: string, label: string, offset = 0) => {
    for (const fix of fixtures.filter(f => f.round === localRound)) allFixtures.push({
      ...fix, id: nextId++, date: dateAt(week, offset), competitionType: type,
      competitionName: name, competitionRound: label, stage: label,
      dayOfWeek: offset === 3 ? 'quarta' : offset === 4 ? 'quinta' : 'domingo',
    });
  };
  const estadualRaw = generateLeagueCalendar(semester1Clubs);
  const estadualGroupRounds = Math.min(11, Math.ceil(semester1Clubs.length / 2) * 2 - 1);
  for (let r = 1; r <= estadualGroupRounds; r++) addRound(estadualRaw, r, r - 1, 'estadual', estadualName, `Rodada ${r}`);
  const reserve = (type: MatchFixture['competitionType'], name: string, round: number, week: number,
    label: string, stage: string, dayOfWeek: 'domingo' | 'quarta' | 'quinta', leg?: 1 | 2) => {
    allFixtures.push({ id: nextId++, round, date: dateAt(week, dayOfWeek === 'domingo' ? 0 : dayOfWeek === 'quarta' ? 3 : 4),
      homeClubId: 0, awayClubId: 0, played: false, pendingQualification: true,
      competitionType: type, competitionName: name, competitionRound: label, stage, dayOfWeek, leg });
  };
  // Knockout slots have no participants until qualification is decided.
  if (semester1Clubs.length >= 4) {
    for (let leg = 1; leg <= 2; leg++) for (let tie = 0; tie < 2; tie++) reserve('estadual', estadualName,
      estadualGroupRounds + leg, estadualGroupRounds + leg - 1,
      `Semifinal (${leg === 1 ? 'Ida' : 'Volta'})`, 'Semifinal', 'domingo', leg as 1 | 2);
    reserve('estadual', estadualName, estadualGroupRounds + 3, estadualGroupRounds + 2, 'Final', 'Final', 'domingo');
  }
  const nationalStart = isBrazil ? 14 : 0;
  const nationalRaw = generateLeagueCalendar(semester2Clubs);
  const nationalRounds = nationalRaw.length ? Math.max(...nationalRaw.map(f => f.round)) : 0;
  for (let r = 1; r <= nationalRounds; r++) addRound(nationalRaw, r, nationalStart + r - 1, 'nacional', nacionalName, `Rodada ${r}`);

  if (continentalClubs.length === 16) {
    const continentalType = continentalInfo.type === 'sulamericana' ? 'sulamericana' : continentalInfo.type === 'libertadores' ? 'libertadores' : 'champions';
    for (let group = 0; group < 4; group++) {
      const raw = generateLeagueCalendar(continentalClubs.slice(group * 4, group * 4 + 4));
      for (let r = 1; r <= 6; r++) addRound(raw, r, nationalStart + r * 2, continentalType, continentalName,
        `Grupo ${'ABCD'[group]} • Rodada ${r}`, 3);
    }
    for (const [stage, firstRound, ties] of [['Quartas de Final', 7, 4], ['Semifinal', 9, 2], ['Final', 11, 1]] as const) {
      for (let leg = 1; leg <= 2; leg++) for (let tie = 0; tie < ties; tie++) reserve(continentalType, continentalName,
        firstRound + leg - 1, nationalStart + (firstRound + leg - 1) * 2,
        `${stage} (${leg === 1 ? 'Ida' : 'Volta'})`, stage, 'quarta', leg as 1 | 2);
    }
  }
  // Cup participants advance through a two-legged knockout bracket (Ida e Volta).
  if (semester2Clubs.length >= 16 || pool.length >= 16) {
    const cupName = isBrazil ? 'Copa do Brasil' : 'Copa Nacional';
    const sameCountryPool = pool.filter(c => c.countryId === (userClub.countryId ?? 29) && c.id !== userClub.id);
    const sortedNationalField = [...new Map([...semester2Clubs.filter(c => c.id !== userClub.id), ...sameCountryPool].map(c => [c.id, c])).values()]
      .sort((a, b) => ((a.division ?? 1) - (b.division ?? 1)) || ((b.reputation ?? 1) - (a.reputation ?? 1)));
    const cupField = [userClub, ...sortedNationalField].slice(0, 16);

    // Oitavas de Final (Ida e Volta)
    for (let i = 0; i < 8; i++) {
      allFixtures.push({
        id: nextId++,
        round: 1,
        date: dateAt(nationalStart + 1, 4),
        homeClubId: cupField[i * 2].id,
        awayClubId: cupField[i * 2 + 1].id,
        played: false,
        competitionType: 'copa',
        competitionName: cupName,
        competitionRound: 'Oitavas de Final (Ida)',
        stage: 'Oitavas de Final',
        dayOfWeek: 'quinta',
        leg: 1,
      });
    }
    for (let i = 0; i < 8; i++) {
      allFixtures.push({
        id: nextId++,
        round: 2,
        date: dateAt(nationalStart + 3, 4),
        homeClubId: cupField[i * 2 + 1].id,
        awayClubId: cupField[i * 2].id,
        played: false,
        competitionType: 'copa',
        competitionName: cupName,
        competitionRound: 'Oitavas de Final (Volta)',
        stage: 'Oitavas de Final',
        dayOfWeek: 'quinta',
        leg: 2,
      });
    }

    // Subsequent rounds: Quartas (rounds 3, 4), Semifinal (rounds 5, 6), Final (rounds 7, 8)
    const stages = [
      { stage: 'Quartas de Final', firstRound: 3, ties: 4, startWeek: nationalStart + 7 },
      { stage: 'Semifinal', firstRound: 5, ties: 2, startWeek: nationalStart + 13 },
      { stage: 'Final', firstRound: 7, ties: 1, startWeek: nationalStart + 19 },
    ] as const;

    for (const { stage, firstRound, ties, startWeek } of stages) {
      for (let leg = 1; leg <= 2; leg++) {
        for (let tie = 0; tie < ties; tie++) {
          reserve(
            'copa',
            cupName,
            firstRound + leg - 1,
            startWeek + (leg === 1 ? 0 : 2),
            `${stage} (${leg === 1 ? 'Ida' : 'Volta'})`,
            stage,
            'quinta',
            leg as 1 | 2
          );
        }
      }
    }
  }
  allFixtures.sort((a, b) => a.date!.localeCompare(b.date!) || a.id - b.id);
  let dateIndex = 0;
  let lastDate = '';
  for (const fixture of allFixtures) {
    if (fixture.date !== lastDate) { dateIndex++; lastDate = fixture.date!; }
    fixture.fixtureDateIndex = dateIndex;
  }

  return {
    calendar: allFixtures,
    estadualName,
    nacionalName,
    continentalName,
    semester1Clubs,
    semester2Clubs,
    continentalClubs,
  };
}

export function initializeStandings(
  clubs: Club[],
  groupAssigner?: (club: Club, index: number) => string | undefined
): StandingRow[] {
  return clubs.map((club, index) => ({
    clubId: club.id,
    clubName: club.name,
    primaryColor: club.primaryColor || '#10b981',
    group: groupAssigner ? groupAssigner(club, index) : undefined,
    points: 0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    form: [],
  }));
}

export function sortStandings(standings: StandingRow[]): StandingRow[] {
  return [...standings].sort((a, b) => {
    if (a.group && b.group && a.group !== b.group) {
      return a.group.localeCompare(b.group);
    }
    if (b.points !== a.points) return b.points - a.points;
    if (b.won !== a.won) return b.won - a.won;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.clubName.localeCompare(b.clubName);
  });
}
