import type { Club, MatchFixture, StandingRow } from '../types/index.ts';
import { getContinentalTournamentField } from './continentalRepresentatives.ts';
import { getStateLeagueRule } from './stateLeagueFormulas.ts';
import { getCanonicalNationalLeagueName } from './teamsDatabase.ts';

/**
 * Ordenação canônica por mérito esportivo (engenharia reversa do motor h/D.java):
 * 1. Menor divisão nacional (1 = Série A, 2 = Série B, 3 = Série C, 4 = Série D, 5 = Acesso)
 * 2. Maior level técnico do time (descendente)
 * 3. Maior reputação (estrelas, descendente)
 */
export function sortClubsByMeritocracy(clubs: Club[]): Club[] {
  return [...clubs].sort((a, b) => {
    const divA = a.division ?? 5;
    const divB = b.division ?? 5;
    if (divA !== divB) return divA - divB;
    const levelDiff = (b.level ?? 10) - (a.level ?? 10);
    if (levelDiff !== 0) return levelDiff;
    const repDiff = (b.reputation ?? 1) - (a.reputation ?? 1);
    if (repDiff !== 0) return repDiff;
    return a.name.localeCompare(b.name);
  });
}

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
  const nacionalName = getCanonicalNationalLeagueName(userClub);

  const pool = allAvailableClubs && allAvailableClubs.length > 0 ? allAvailableClubs : nationalClubs;
  const sameState = (c: Club) => c.countryId === 29 && (
    (userClub.stateId != null && c.stateId === userClub.stateId) ||
    (userClub.stateCode != null && c.stateCode === userClub.stateCode)
  );

  const stateRule = isBrazil ? getStateLeagueRule(userClub.stateCode) : undefined;
  const targetStateCount = stateRule ? stateRule.nTimes : 12;

  let semester1Clubs: Club[] = [];
  if (isBrazil) {
    const rawStateClubs = pool.filter(sameState);
    const sortedStateClubs = sortClubsByMeritocracy(rawStateClubs);

    // Seleciona a elite do estado (tamanho oficial da regra da federação)
    const eliteStateClubs = sortedStateClubs.slice(0, targetStateCount);

    if (eliteStateClubs.some(c => c.id === userClub.id)) {
      semester1Clubs = eliteStateClubs;
    } else {
      // Substitui o último classificado da elite para garantir o usuário junto com os gigantes
      semester1Clubs = [userClub, ...eliteStateClubs.slice(0, targetStateCount - 1)];
    }
  }

  const semester2Clubs = nationalClubs.length >= 2 ? nationalClubs : pool.slice(0, 20);

  const continentalInfo = getContinentalTournamentField(userClub, pool);
  const continentalName = continentalInfo.name;
  const continentalClubs = continentalInfo.clubs;
  const userParticipatesInContinental = continentalInfo.userParticipates ?? continentalClubs.some(c => c.id === userClub.id);

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

  const isFormula7 = stateRule?.formulaId === 7 && semester1Clubs.length === 16;
  let estadualGroupRounds = Math.min(11, Math.ceil(semester1Clubs.length / 2) * 2 - 1);

  if (isFormula7) {
    // Paulistão Fórmula 7: 16 clubes em 4 grupos de 4.
    // Cada clube joga 12 partidas (contra os clubes dos outros 3 grupos).
    estadualGroupRounds = 12;
    const gA = semester1Clubs.slice(0, 4);
    const gB = semester1Clubs.slice(4, 8);
    const gC = semester1Clubs.slice(8, 12);
    const gD = semester1Clubs.slice(12, 16);

    const pairGroups = (group1: Club[], group2: Club[], startRound: number) => {
      for (let k = 0; k < 4; k++) {
        const roundNum = startRound + k;
        const fixtures: MatchFixture[] = [];
        for (let i = 0; i < 4; i++) {
          const j = (i + k) % 4;
          const isHome = (i + k) % 2 === 0;
          fixtures.push({
            id: 0,
            round: roundNum,
            homeClubId: isHome ? group1[i].id : group2[j].id,
            awayClubId: isHome ? group2[j].id : group1[i].id,
            played: false,
          });
        }
        addRound(fixtures, roundNum, roundNum - 1, 'estadual', estadualName, `Rodada ${roundNum}`);
      }
    };

    pairGroups(gA, gB, 1);
    pairGroups(gC, gD, 1);
    pairGroups(gA, gC, 5);
    pairGroups(gB, gD, 5);
    pairGroups(gA, gD, 9);
    pairGroups(gB, gC, 9);
  } else {
    const estadualRaw = generateLeagueCalendar(semester1Clubs);
    for (let r = 1; r <= estadualGroupRounds; r++) addRound(estadualRaw, r, r - 1, 'estadual', estadualName, `Rodada ${r}`);
  }

  const reserve = (type: MatchFixture['competitionType'], name: string, round: number, week: number,
    label: string, stage: string, dayOfWeek: 'domingo' | 'quarta' | 'quinta', leg?: 1 | 2) => {
    allFixtures.push({ id: nextId++, round, date: dateAt(week, dayOfWeek === 'domingo' ? 0 : dayOfWeek === 'quarta' ? 3 : 4),
      homeClubId: 0, awayClubId: 0, played: false, pendingQualification: true,
      competitionType: type, competitionName: name, competitionRound: label, stage, dayOfWeek, leg });
  };

  // Knockout slots have no participants until qualification is decided.
  if (semester1Clubs.length >= 4) {
    if (isFormula7) {
      // TODO(SPEC-009/SPEC-008): Formula 7 authentic format features 8-club Quartas de Final.
      // Currently using 4-club Semifinais until multi-tier state knockout brackets are expanded.
      for (let tie = 0; tie < 2; tie++) {
        reserve('estadual', estadualName, 13, 11, 'Semifinal (Ida)', 'Semifinal', 'quarta', 1);
      }
      for (let tie = 0; tie < 2; tie++) {
        reserve('estadual', estadualName, 14, 12, 'Semifinal (Volta)', 'Semifinal', 'domingo', 2);
      }
      reserve('estadual', estadualName, 15, 13, 'Final', 'Final', 'domingo');
    } else {
      for (let leg = 1; leg <= 2; leg++) for (let tie = 0; tie < 2; tie++) reserve('estadual', estadualName,
        estadualGroupRounds + leg, estadualGroupRounds + leg - 1,
        `Semifinal (${leg === 1 ? 'Ida' : 'Volta'})`, 'Semifinal', 'domingo', leg as 1 | 2);
      reserve('estadual', estadualName, estadualGroupRounds + 3, estadualGroupRounds + 2, 'Final', 'Final', 'domingo');
    }
  }

  const nationalStart = isBrazil ? 14 : 0;
  const nationalRaw = generateLeagueCalendar(semester2Clubs);
  const nationalRounds = nationalRaw.length ? Math.max(...nationalRaw.map(f => f.round)) : 0;
  for (let r = 1; r <= nationalRounds; r++) addRound(nationalRaw, r, nationalStart + r - 1, 'nacional', nacionalName, `Rodada ${r}`);

  if (continentalClubs.length >= 4) {
    const continentalType = continentalInfo.type === 'sulamericana' ? 'sulamericana' : continentalInfo.type === 'libertadores' ? 'libertadores' : 'champions';
    const groupCount = Math.max(1, Math.ceil(continentalClubs.length / 4));
    const groupLabels = Array.from({ length: groupCount }, (_, index) => {
      let label = '';
      let value = index;
      do { label = String.fromCharCode(65 + (value % 26)) + label; value = Math.floor(value / 26) - 1; } while (value >= 0);
      return label;
    });
    const groups = groupLabels.map((label, index) => ({ label, clubs: continentalClubs.slice(index * 4, (index + 1) * 4) })).filter(group => group.clubs.length >= 2);
    for (const [groupIndex, group] of groups.entries()) {
      const raw = generateLeagueCalendar(group.clubs);
      const rounds = Math.max(...raw.map(f => f.round), 0);
      for (let r = 1; r <= rounds; r++) addRound(raw, r, nationalStart + r * 2, continentalType, continentalName,
        `Grupo ${groupLabels[groupIndex]} • Rodada ${r}`, 3);
    }
    const knockoutRounds = Math.max(0, Math.floor(groups.length / 2));
    for (const [stage, firstRound, ties] of [['Quartas de Final', 7, 4], ['Semifinal', 9, 2], ['Final', 11, 1]] as const) {
      if (stage === 'Quartas de Final' && knockoutRounds < 4) continue;
      if (stage === 'Semifinal' && knockoutRounds < 2) continue;
      if (stage === 'Final' && knockoutRounds < 1) continue;
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
