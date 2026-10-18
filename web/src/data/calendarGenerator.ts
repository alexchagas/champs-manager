import type { Club, MatchFixture, StandingRow } from '../types/index.ts';
import {
  computeContinentalQualifiers,
  getContinentalTournamentField,
  seedClubsByPots,
  type ContinentalTournamentOptions,
} from './continentalRepresentatives.ts';
import { formatGroupLabel, getDivisionConfig, getNationalCupConfig } from './leagueConfigurations.ts';
import { getStateLeagueRule, getUserStateDivision, sortClubsByMeritocracy } from './stateLeagueFormulas.ts';
import { getCanonicalNationalLeagueName, isPreLibPlaceholderId } from './teamsDatabase.ts';

export { sortClubsByMeritocracy };

// Standard Berger / round-robin scheduling algorithm
export function generateLeagueCalendar(clubs: Club[]): MatchFixture[] {
  const n = clubs.length;
  if (n < 2) return [];

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
  seasonYear = 2026,
  continentalOptions?: ContinentalTournamentOptions,
  stateOverrides?: { promotedStateClubIds?: number[]; relegatedStateClubIds?: number[] }
): {
  calendar: MatchFixture[];
  estadualName: string;
  nacionalName: string;
  continentalName: string;
  semester1Clubs: Club[];
  semester2Clubs: Club[];
  continentalClubs: Club[];
  estadualTier: 1 | 2;
} {
  const isBrazil = userClub.countryId === 29;
  let estadualName = getStateChampionshipName(userClub.stateCode, userClub.stateId);
  const nacionalName = getCanonicalNationalLeagueName(userClub);

  const pool = allAvailableClubs && allAvailableClubs.length > 0 ? allAvailableClubs : nationalClubs;
  const stateRule = isBrazil ? getStateLeagueRule(userClub.stateCode) : undefined;

  let semester1Clubs: Club[] = [];
  let userStateTier: 1 | 2 = 1;
  if (isBrazil) {
    const userStateDiv = getUserStateDivision(
      userClub,
      pool,
      seasonYear,
      stateOverrides?.promotedStateClubIds,
      stateOverrides?.relegatedStateClubIds
    );
    semester1Clubs = userStateDiv.fieldClubs;
    estadualName = userStateDiv.leagueName;
    userStateTier = userStateDiv.tier;
  }

  const semester2Clubs = nationalClubs.length >= 2 ? nationalClubs : pool.slice(0, 20);

  const continentalInfo = getContinentalTournamentField(userClub, pool, undefined, {
    seasonYear,
    ...continentalOptions,
  });
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
    for (const fix of fixtures.filter(f => f.round === localRound)) {
      const isPending = isPreLibPlaceholderId(fix.homeClubId) || isPreLibPlaceholderId(fix.awayClubId);
      allFixtures.push({
        ...fix,
        id: nextId++,
        date: dateAt(week, offset),
        competitionType: type,
        competitionName: name,
        competitionRound: label,
        stage: label,
        dayOfWeek: offset === 3 ? 'quarta' : offset === 4 ? 'quinta' : 'domingo',
        pendingQualification: isPending ? true : fix.pendingQualification,
      });
    }
  };

  const isFormula7 = userStateTier === 1 && stateRule?.formulaId === 7 && semester1Clubs.length === 16;
  let estadualGroupRounds = Math.min(11, Math.ceil(semester1Clubs.length / 2) * 2 - 1);

  if (isFormula7) {
    // Paulistão Fórmula 7: 16 clubes em 4 grupos de 4 (com 1 cabeça de chave por grupo).
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
    label: string, stage: string, dayOfWeek: 'domingo' | 'quarta' | 'quinta', leg?: 1 | 2, homeClubId = 0, awayClubId = 0) => {
    allFixtures.push({ id: nextId++, round, date: dateAt(week, dayOfWeek === 'domingo' ? 0 : dayOfWeek === 'quarta' ? 3 : 4),
      homeClubId, awayClubId, played: false, pendingQualification: true,
      competitionType: type, competitionName: name, competitionRound: label, stage, dayOfWeek, leg });
  };

  // Knockout slots have no participants until qualification is decided.
  if (semester1Clubs.length >= 4) {
    if (isFormula7) {
      // Paulistão Fórmula 7: Quartas de Final (1º x 2º de cada grupo A, B, C, D) -> Semifinal -> Final
      // Rodadas 1..12 terminam em week 11 (domingo). Quartas em week 12 (domingo), Semi Ida em week 12 (quarta), Semi Volta em week 13 (domingo), Final em week 13 (quarta).
      for (let tie = 0; tie < 4; tie++) {
        reserve('estadual', estadualName, 13, 12, 'Quartas de Final', 'Quartas de Final', 'domingo');
      }
      for (let tie = 0; tie < 2; tie++) {
        reserve('estadual', estadualName, 14, 12, 'Semifinal (Ida)', 'Semifinal', 'quarta', 1);
      }
      for (let tie = 0; tie < 2; tie++) {
        reserve('estadual', estadualName, 15, 13, 'Semifinal (Volta)', 'Semifinal', 'domingo', 2);
      }
      reserve('estadual', estadualName, 16, 13, 'Final', 'Final', 'quarta');
    } else {
      for (let leg = 1; leg <= 2; leg++) for (let tie = 0; tie < 2; tie++) reserve('estadual', estadualName,
        estadualGroupRounds + leg, estadualGroupRounds + leg - 1,
        `Semifinal (${leg === 1 ? 'Ida' : 'Volta'})`, 'Semifinal', 'domingo', leg as 1 | 2);
      reserve('estadual', estadualName, estadualGroupRounds + 3, estadualGroupRounds + 2, 'Final', 'Final', 'domingo');
    }
  }

  const nationalStart = isBrazil ? 14 : 0;
  const divConfig = getDivisionConfig(
    userClub.countryId || 29,
    userClub.division || 1,
    undefined,
    semester2Clubs.length
  );
  const nationalGroupCount =
    divConfig?.groupCount && divConfig.groupCount > 1 && semester2Clubs.length >= divConfig.groupCount * 2
      ? divConfig.groupCount
      : 1;

  let nationalPhaseRounds = 0;
  if (nationalGroupCount > 1) {
    const groupSize = Math.ceil(semester2Clubs.length / nationalGroupCount);
    for (let gIdx = 0; gIdx < nationalGroupCount; gIdx++) {
      const label = formatGroupLabel(gIdx);
      const groupClubs = semester2Clubs.slice(gIdx * groupSize, (gIdx + 1) * groupSize);
      if (groupClubs.length < 2) continue;
      const raw = generateLeagueCalendar(groupClubs);
      const singleTurnRounds = groupClubs.length % 2 === 0 ? groupClubs.length - 1 : groupClubs.length;
      const maxRound = divConfig?.rounds === 1 ? singleTurnRounds : Math.max(...raw.map(f => f.round), 0);
      if (maxRound > nationalPhaseRounds) nationalPhaseRounds = maxRound;
      for (let r = 1; r <= maxRound; r++) {
        addRound(raw, r, nationalStart + r - 1, 'nacional', nacionalName, `Grupo ${label} • Rodada ${r}`);
      }
    }
  } else {
    const nationalRaw = generateLeagueCalendar(semester2Clubs);
    const singleTurnRounds = semester2Clubs.length % 2 === 0 ? semester2Clubs.length - 1 : semester2Clubs.length;
    const totalRawRounds = nationalRaw.length ? Math.max(...nationalRaw.map(f => f.round)) : 0;
    nationalPhaseRounds = divConfig?.rounds === 1 ? Math.min(singleTurnRounds, totalRawRounds) : totalRawRounds;
    for (let r = 1; r <= nationalPhaseRounds; r++) {
      addRound(nationalRaw, r, nationalStart + r - 1, 'nacional', nacionalName, `Rodada ${r}`);
    }
  }

  if (divConfig?.format === 'groups_and_playoffs' && (divConfig.playoffTeams ?? 0) >= 2) {
    const playoffTeams = divConfig.playoffTeams ?? 0;
    const allPlayoffStages = [
      { stage: 'Segunda Fase', ties: 16, minTeams: 32 },
      { stage: 'Oitavas de Final', ties: 8, minTeams: 16 },
      { stage: 'Quartas de Final', ties: 4, minTeams: 8 },
      { stage: 'Semifinal', ties: 2, minTeams: 4 },
      { stage: 'Final', ties: 1, minTeams: 2 },
    ] as const;

    let nextNatRound = nationalPhaseRounds + 1;
    let nextNatWeek = nationalStart + nationalPhaseRounds;
    for (const { stage, ties, minTeams } of allPlayoffStages) {
      if (playoffTeams < minTeams) continue;
      for (let leg = 1; leg <= 2; leg++) {
        for (let tie = 0; tie < ties; tie++) {
          reserve(
            'nacional',
            nacionalName,
            nextNatRound,
            nextNatWeek,
            `${stage} (${leg === 1 ? 'Ida' : 'Volta'})`,
            stage,
            'domingo',
            leg as 1 | 2
          );
        }
        nextNatRound++;
        nextNatWeek++;
      }
    }
  }

  if (continentalClubs.length >= 4) {
    const continentalType = continentalInfo.type === 'sulamericana' ? 'sulamericana' : continentalInfo.type === 'libertadores' ? 'libertadores' : 'champions';
    const preLibClubs = continentalInfo.preLibertadoresClubs || [];

    // Fase Preliminar: Pré-Libertadores (2ª Fase com 16 clubes / 8 confrontos e 3ª Fase com 8 clubes / 4 confrontos)
    if (continentalType === 'libertadores' && preLibClubs.length >= 16) {
      for (let i = 0; i < 8; i++) {
        allFixtures.push({
          id: nextId++,
          round: 1,
          date: dateAt(1, 3),
          homeClubId: preLibClubs[i * 2 + 1].id,
          awayClubId: preLibClubs[i * 2].id,
          played: false,
          competitionType: continentalType,
          competitionName: continentalName,
          competitionRound: 'Pré-Libertadores • 2ª Fase (Ida)',
          stage: 'Pré-Libertadores (2ª Fase)',
          dayOfWeek: 'quarta',
          leg: 1,
        });
      }
      for (let i = 0; i < 8; i++) {
        allFixtures.push({
          id: nextId++,
          round: 2,
          date: dateAt(3, 3),
          homeClubId: preLibClubs[i * 2].id,
          awayClubId: preLibClubs[i * 2 + 1].id,
          played: false,
          competitionType: continentalType,
          competitionName: continentalName,
          competitionRound: 'Pré-Libertadores • 2ª Fase (Volta)',
          stage: 'Pré-Libertadores (2ª Fase)',
          dayOfWeek: 'quarta',
          leg: 2,
        });
      }
      for (let leg = 1; leg <= 2; leg++) {
        for (let tie = 0; tie < 4; tie++) {
          reserve(
            continentalType,
            continentalName,
            2 + leg,
            leg === 1 ? 6 : 9,
            `Pré-Libertadores • 3ª Fase (${leg === 1 ? 'Ida' : 'Volta'})`,
            'Pré-Libertadores (3ª Fase)',
            'quarta',
            leg as 1 | 2
          );
        }
      }
    }

    const groupCount = Math.max(1, Math.ceil(continentalClubs.length / 4));
    const groupLabels = Array.from({ length: groupCount }, (_, index) => formatGroupLabel(index));
    const groups = groupLabels.map((label, index) => ({ label, clubs: continentalClubs.slice(index * 4, (index + 1) * 4) })).filter(group => group.clubs.length >= 2);
    for (const [groupIndex, group] of groups.entries()) {
      const raw = generateLeagueCalendar(group.clubs);
      const rounds = Math.max(...raw.map(f => f.round), 0);
      for (let r = 1; r <= rounds; r++) addRound(raw, r, nationalStart + r * 2, continentalType, continentalName,
        `Grupo ${groupLabels[groupIndex]} • Rodada ${r}`, 3);
    }

    // 8 grupos (32 clubes) -> Oitavas (rounds 7-8), Quartas (9-10), Semifinal (11-12), Final (13-14)
    // 4 grupos (16 clubes) -> Quartas (rounds 7-8), Semifinal (9-10), Final (11-12)
    const hasOitavas = groups.length >= 8;
    const continentalStages = hasOitavas
      ? ([
          ['Oitavas de Final', 7, 8],
          ['Quartas de Final', 9, 4],
          ['Semifinal', 11, 2],
          ['Final', 13, 1],
        ] as const)
      : ([
          ['Quartas de Final', 7, 4],
          ['Semifinal', 9, 2],
          ['Final', 11, 1],
        ] as const);

    const knockoutRounds = Math.max(0, Math.floor(groups.length / 2));
    for (const [stage, firstRound, ties] of continentalStages) {
      if (stage === 'Oitavas de Final' && groups.length < 8) continue;
      if (stage === 'Quartas de Final' && knockoutRounds < 2) continue;
      if (stage === 'Semifinal' && knockoutRounds < 1) continue;
      for (let leg = 1; leg <= 2; leg++) for (let tie = 0; tie < ties; tie++) reserve(continentalType, continentalName,
        firstRound + leg - 1, nationalStart + (firstRound + leg - 1) * 2,
        `${stage} (${leg === 1 ? 'Ida' : 'Volta'})`, stage, 'quarta', leg as 1 | 2);
    }
  }

  // Copa Nacional / Copa do Brasil configurável via getNationalCupConfig
  if (semester2Clubs.length >= 16 || pool.length >= 16) {
    const cupConfig = getNationalCupConfig(userClub.countryId ?? 29);
    const cupName = cupConfig.name;
    const sameCountryPool = pool.filter(c => c.countryId === (userClub.countryId ?? 29));
    const sortedCountryClubs = sortClubsByMeritocracy(
      [...new Map([userClub, ...semester2Clubs, ...sameCountryPool].map(c => [c.id, c])).values()]
    );

    const hasEarlyPhases =
      isBrazil &&
      cupConfig.stages.some(s => s.stage === 'Primeira Fase') &&
      sortedCountryClubs.length >= (cupConfig.teamsCount || 72);

    if (hasEarlyPhases) {
      // Regra Oficial Copa do Brasil:
      // - 8 clubes (Libertadores / Elite) entram diretamente nas Oitavas de Final (Pote 1 das Oitavas).
      // - 64 clubes disputam a Primeira Fase (Jogo Único, 32 confrontos) -> Segunda Fase (Jogo Único, 16 confrontos) -> Terceira Fase (Ida e Volta, 8 confrontos).
      // - Os 8 classificados da Terceira Fase enfrentam os 8 pré-classificados nas Oitavas de Final!
      const directCount = cupConfig.directEntryCount ?? 8;
      const qualifiers = computeContinentalQualifiers(sortedCountryClubs);
      const preferredDirectIds = new Set(
        continentalOptions?.qualifiedLibertadoresIds ?? qualifiers.copaDirectOitavasIds
      );

      const directEntryClubs: Club[] = [];
      for (const c of sortedCountryClubs) {
        if (directEntryClubs.length >= directCount) break;
        if (preferredDirectIds.has(c.id)) {
          directEntryClubs.push(c);
        }
      }
      for (const c of sortedCountryClubs) {
        if (directEntryClubs.length >= directCount) break;
        if (!directEntryClubs.some(dc => dc.id === c.id)) {
          directEntryClubs.push(c);
        }
      }

      const directIds = new Set(directEntryClubs.map(c => c.id));
      let earlyCandidates = sortedCountryClubs.filter(c => !directIds.has(c.id));
      if (!directIds.has(userClub.id)) {
        earlyCandidates = [userClub, ...earlyCandidates.filter(c => c.id !== userClub.id)];
      }
      const firstPhaseClubs = sortClubsByMeritocracy(earlyCandidates.slice(0, 64));

      // 1. Primeira Fase (32 confrontos, Jogo Único - Mando do clube menor vs clube maior, week 2)
      for (let i = 0; i < 32; i++) {
        const strongClub = firstPhaseClubs[i];
        const modestClub = firstPhaseClubs[63 - i];
        allFixtures.push({
          id: nextId++,
          round: 1,
          date: dateAt(2, 4),
          homeClubId: modestClub.id,
          awayClubId: strongClub.id,
          played: false,
          competitionType: 'copa',
          competitionName: cupName,
          competitionRound: 'Primeira Fase (Jogo Único)',
          stage: 'Primeira Fase',
          dayOfWeek: 'quinta',
        });
      }

      // 2. Segunda Fase (16 confrontos, Jogo Único, week 5)
      for (let tie = 0; tie < 16; tie++) {
        reserve('copa', cupName, 2, 5, 'Segunda Fase (Jogo Único)', 'Segunda Fase', 'quinta');
      }

      // 3. Terceira Fase (8 confrontos, Ida e Volta, weeks 8 e 10)
      for (let leg = 1; leg <= 2; leg++) {
        for (let tie = 0; tie < 8; tie++) {
          reserve(
            'copa',
            cupName,
            2 + leg,
            leg === 1 ? 8 : 10,
            `Terceira Fase (${leg === 1 ? 'Ida' : 'Volta'})`,
            'Terceira Fase',
            'quinta',
            leg as 1 | 2
          );
        }
      }

      // 4. Oitavas de Final (8 confrontos, Ida e Volta, weeks nationalStart + 1 e nationalStart + 3)
      // Os 8 clubes da Libertadores/Elite já ficam pré-alocados aguardando os 8 vencedores da 3ª Fase!
      for (let tie = 0; tie < 8; tie++) {
        reserve(
          'copa',
          cupName,
          5,
          nationalStart + 1,
          'Oitavas de Final (Ida)',
          'Oitavas de Final',
          'quinta',
          1,
          directEntryClubs[tie].id,
          0
        );
      }
      for (let tie = 0; tie < 8; tie++) {
        reserve(
          'copa',
          cupName,
          6,
          nationalStart + 3,
          'Oitavas de Final (Volta)',
          'Oitavas de Final',
          'quinta',
          2,
          0,
          directEntryClubs[tie].id
        );
      }

      // 5. Quartas (rounds 7-8), Semifinal (rounds 9-10) e Final (rounds 11-12)
      const finalStages = [
        { stage: 'Quartas de Final', firstRound: 7, ties: 4, startWeek: nationalStart + 7 },
        { stage: 'Semifinal', firstRound: 9, ties: 2, startWeek: nationalStart + 13 },
        { stage: 'Final', firstRound: 11, ties: 1, startWeek: nationalStart + 19 },
      ] as const;

      for (const { stage, firstRound, ties, startWeek } of finalStages) {
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
    } else {
      const cupField = [userClub, ...sortedCountryClubs.filter(c => c.id !== userClub.id)].slice(0, 16);

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
    estadualTier: userStateTier,
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

export function initializeEstadualStandings(userClub: Club, clubs: Club[], tier: 1 | 2 = 1): StandingRow[] {
  const isBrazil = (userClub.countryId ?? 29) === 29;
  const stateRule = isBrazil ? getStateLeagueRule(userClub.stateCode) : undefined;
  const isFormula7 = tier === 1 && stateRule?.formulaId === 7 && clubs.length === 16;
  return sortStandings(
    initializeStandings(clubs, isFormula7 ? (_c, idx) => formatGroupLabel(Math.floor(idx / 4)) : undefined)
  );
}

export function initializeNacionalStandings(userClub: Club, clubs: Club[]): StandingRow[] {
  const divConfig = getDivisionConfig(userClub.countryId || 29, userClub.division || 1, undefined, clubs.length);
  const groupCount =
    divConfig?.groupCount && divConfig.groupCount > 1 && clubs.length >= divConfig.groupCount * 2
      ? divConfig.groupCount
      : 1;
  const groupSize = groupCount > 1 ? Math.ceil(clubs.length / groupCount) : clubs.length;
  return sortStandings(
    initializeStandings(
      clubs,
      groupCount > 1 ? (_c, idx) => formatGroupLabel(Math.floor(idx / groupSize)) : undefined
    )
  );
}

export function initializeContinentalStandings(clubs: Club[]): StandingRow[] {
  const groupCount = Math.max(1, Math.ceil(clubs.length / 4));
  return sortStandings(
    initializeStandings(clubs, (_c, idx) => {
      const groupIndex = Math.floor(idx / 4);
      return groupIndex < groupCount ? formatGroupLabel(groupIndex) : undefined;
    })
  );
}

