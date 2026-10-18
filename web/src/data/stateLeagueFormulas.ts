import type { Club } from '../types/index.ts';
import { getAllClubs } from './teamsDatabase.ts';
import { seedClubsByPots } from './continentalRepresentatives.ts';

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
    const repDiff = (b.reputation ?? 1) - (a.reputation ?? 1);
    if (repDiff !== 0) return repDiff;
    const levelDiff = (b.level ?? 10) - (a.level ?? 10);
    if (levelDiff !== 0) return levelDiff;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Catálogo canônico de Fórmulas dos Campeonatos Estaduais do Brasil
 * Engenharia reversa dos 25 arquivos .ces (conf_estadual/*.ces) e do motor original (best/aq.java e best/w.java).
 */

export interface StateTierInfo {
  tier: 1 | 2;
  badge: string;
  divisionName: string;
  leagueName: string;
}

export interface StateDivisionInfo {
  stateCode: string;
  stateName: string;
  hasSecondDivision: boolean;
  totalClubsInState: number;
  eliteClubsCount: number;
  remainingClubsCount: number;
  tier1: StateTierInfo;
  tier2?: StateTierInfo;
}

export interface StateLeagueRule {
  stateCode: string;
  stateName: string;
  formulaId: number;
  /** Número de clubes na 1ª Divisão (Elite / Módulo A1) */
  nTimes: number;
  /** Número de grupos na fase inicial (0 = turno único todos contra todos; 4 = grupos com jogos inter-chaves como SP) */
  nGrupos: number;
  /** Número de clubes classificados para o mata-mata (ex: 8 = quartas, 4 = semifinal, 2 = final direta) */
  mataMata: number;
  /** Se possui 2 turnos (ida e volta) */
  doisTurnos: boolean;
  /** Jogos dentro do próprio grupo (false no Paulistão porque times jogam contra os outros grupos) */
  jogosDentroGrupo: boolean;
  /** Número padrão de clubes rebaixados para a 2ª Divisão (Módulo A2) */
  rebaixados: number;
  /** Descrição resumida da fórmula */
  descricao: string;
}

export const STATE_LEAGUE_RULES: Record<string, StateLeagueRule> = {
  // SP: Fórmula 7 (16 times, 4 grupos de 4, jogos contra outros grupos = 12 rodadas + mata-mata)
  SP: {
    stateCode: 'SP',
    stateName: 'São Paulo',
    formulaId: 7,
    nTimes: 16,
    nGrupos: 4,
    mataMata: 8,
    doisTurnos: false,
    jogosDentroGrupo: false,
    rebaixados: 2,
    descricao: 'Campeonato Paulista: 16 clubes em 4 grupos de 4. Jogos inter-chaves (12 rodadas) + Quartas, Semifinal e Final.',
  },
  // Fórmula 4: 12 times em turno único de 11 rodadas + Semifinais (4 classificados) e Final. 2 rebaixados.
  SC: {
    stateCode: 'SC',
    stateName: 'Santa Catarina',
    formulaId: 4,
    nTimes: 12,
    nGrupos: 0,
    mataMata: 4,
    doisTurnos: false,
    jogosDentroGrupo: true,
    rebaixados: 2,
    descricao: 'Campeonato Catarinense: 12 clubes em turno único (11 rodadas) + Semifinais e Final. 2 rebaixados.',
  },
  RJ: {
    stateCode: 'RJ',
    stateName: 'Rio de Janeiro',
    formulaId: 4,
    nTimes: 12,
    nGrupos: 0,
    mataMata: 4,
    doisTurnos: false,
    jogosDentroGrupo: true,
    rebaixados: 2,
    descricao: 'Campeonato Carioca: 12 clubes em turno único (Taça Guanabara • 11 rodadas) + Semifinais e Final. 2 rebaixados.',
  },
  MG: {
    stateCode: 'MG',
    stateName: 'Minas Gerais',
    formulaId: 4,
    nTimes: 12,
    nGrupos: 0,
    mataMata: 4,
    doisTurnos: false,
    jogosDentroGrupo: true,
    rebaixados: 2,
    descricao: 'Campeonato Mineiro: 12 clubes em turno único (11 rodadas) + Semifinais e Final. 2 rebaixados.',
  },
  RS: {
    stateCode: 'RS',
    stateName: 'Rio Grande do Sul',
    formulaId: 4,
    nTimes: 12,
    nGrupos: 0,
    mataMata: 4,
    doisTurnos: false,
    jogosDentroGrupo: true,
    rebaixados: 2,
    descricao: 'Campeonato Gaúcho: 12 clubes em turno único (11 rodadas) + Semifinais e Final. 2 rebaixados.',
  },
  PR: {
    stateCode: 'PR',
    stateName: 'Paraná',
    formulaId: 4,
    nTimes: 12,
    nGrupos: 0,
    mataMata: 4,
    doisTurnos: false,
    jogosDentroGrupo: true,
    rebaixados: 2,
    descricao: 'Campeonato Paranaense: 12 clubes em turno único (11 rodadas) + Semifinais e Final. 2 rebaixados.',
  },
  GO: {
    stateCode: 'GO',
    stateName: 'Goiás',
    formulaId: 4,
    nTimes: 12,
    nGrupos: 0,
    mataMata: 4,
    doisTurnos: false,
    jogosDentroGrupo: true,
    rebaixados: 2,
    descricao: 'Campeonato Goiano: 12 clubes em turno único (11 rodadas) + Semifinais e Final. 2 rebaixados.',
  },
  // Fórmula 2: 10 times em turno único (9 rodadas) + Semifinais e Final. 2 rebaixados.
  BA: {
    stateCode: 'BA',
    stateName: 'Bahia',
    formulaId: 2,
    nTimes: 10,
    nGrupos: 0,
    mataMata: 4,
    doisTurnos: false,
    jogosDentroGrupo: true,
    rebaixados: 2,
    descricao: 'Campeonato Baiano: 10 clubes em turno único (9 rodadas) + Semifinais e Final. 2 rebaixados.',
  },
  CE: {
    stateCode: 'CE',
    stateName: 'Ceará',
    formulaId: 2,
    nTimes: 10,
    nGrupos: 0,
    mataMata: 4,
    doisTurnos: false,
    jogosDentroGrupo: true,
    rebaixados: 2,
    descricao: 'Campeonato Cearense: 10 clubes em turno único (9 rodadas) + Semifinais e Final. 2 rebaixados.',
  },
  PE: {
    stateCode: 'PE',
    stateName: 'Pernambuco',
    formulaId: 2,
    nTimes: 10,
    nGrupos: 0,
    mataMata: 4,
    doisTurnos: false,
    jogosDentroGrupo: true,
    rebaixados: 2,
    descricao: 'Campeonato Pernambucano: 10 clubes em turno único (9 rodadas) + Semifinais e Final. 2 rebaixados.',
  },
  MT: {
    stateCode: 'MT',
    stateName: 'Mato Grosso',
    formulaId: 2,
    nTimes: 10,
    nGrupos: 0,
    mataMata: 4,
    doisTurnos: false,
    jogosDentroGrupo: true,
    rebaixados: 2,
    descricao: 'Campeonato Mato-Grossense: 10 clubes em turno único (9 rodadas) + Semifinais e Final. 2 rebaixados.',
  },
  // Fórmula 1: 8 times em turno único (7 rodadas) + Semifinais e Final. 2 rebaixados.
  AC: { stateCode: 'AC', stateName: 'Acre', formulaId: 1, nTimes: 8, nGrupos: 0, mataMata: 4, doisTurnos: false, jogosDentroGrupo: true, rebaixados: 2, descricao: 'Campeonato Acriano: 8 clubes em turno único (7 rodadas) + Semifinais e Final.' },
  AL: { stateCode: 'AL', stateName: 'Alagoas', formulaId: 1, nTimes: 8, nGrupos: 0, mataMata: 4, doisTurnos: false, jogosDentroGrupo: true, rebaixados: 2, descricao: 'Campeonato Alagoano: 8 clubes em turno único (7 rodadas) + Semifinais e Final.' },
  AM: { stateCode: 'AM', stateName: 'Amazonas', formulaId: 1, nTimes: 8, nGrupos: 0, mataMata: 4, doisTurnos: false, jogosDentroGrupo: true, rebaixados: 2, descricao: 'Campeonato Amazonense: 8 clubes em turno único (7 rodadas) + Semifinais e Final.' },
  AP: { stateCode: 'AP', stateName: 'Amapá', formulaId: 1, nTimes: 8, nGrupos: 0, mataMata: 4, doisTurnos: false, jogosDentroGrupo: true, rebaixados: 2, descricao: 'Campeonato Amapaense: 8 clubes em turno único (7 rodadas) + Semifinais e Final.' },
  DF: { stateCode: 'DF', stateName: 'Distrito Federal', formulaId: 1, nTimes: 8, nGrupos: 0, mataMata: 4, doisTurnos: false, jogosDentroGrupo: true, rebaixados: 2, descricao: 'Campeonato Brasiliense: 8 clubes em turno único (7 rodadas) + Semifinais e Final.' },
  ES: { stateCode: 'ES', stateName: 'Espírito Santo', formulaId: 1, nTimes: 8, nGrupos: 0, mataMata: 4, doisTurnos: false, jogosDentroGrupo: true, rebaixados: 2, descricao: 'Campeonato Capixaba: 8 clubes em turno único (7 rodadas) + Semifinais e Final.' },
  MA: { stateCode: 'MA', stateName: 'Maranhão', formulaId: 1, nTimes: 8, nGrupos: 0, mataMata: 4, doisTurnos: false, jogosDentroGrupo: true, rebaixados: 2, descricao: 'Campeonato Maranhense: 8 clubes em turno único (7 rodadas) + Semifinais e Final.' },
  MS: { stateCode: 'MS', stateName: 'Mato Grosso do Sul', formulaId: 1, nTimes: 8, nGrupos: 0, mataMata: 4, doisTurnos: false, jogosDentroGrupo: true, rebaixados: 2, descricao: 'Campeonato Sul-Mato-Grossense: 8 clubes em turno único (7 rodadas) + Semifinais e Final.' },
  PA: { stateCode: 'PA', stateName: 'Pará', formulaId: 1, nTimes: 8, nGrupos: 0, mataMata: 4, doisTurnos: false, jogosDentroGrupo: true, rebaixados: 2, descricao: 'Campeonato Paraense: 8 clubes em turno único (7 rodadas) + Semifinais e Final.' },
  PI: { stateCode: 'PI', stateName: 'Piauí', formulaId: 1, nTimes: 8, nGrupos: 0, mataMata: 4, doisTurnos: false, jogosDentroGrupo: true, rebaixados: 2, descricao: 'Campeonato Piauiense: 8 clubes em turno único (7 rodadas) + Semifinais e Final.' },
  RN: { stateCode: 'RN', stateName: 'Rio Grande do Norte', formulaId: 1, nTimes: 8, nGrupos: 0, mataMata: 4, doisTurnos: false, jogosDentroGrupo: true, rebaixados: 2, descricao: 'Campeonato Potiguar: 8 clubes em turno único (7 rodadas) + Semifinais e Final.' },
  RO: { stateCode: 'RO', stateName: 'Rondônia', formulaId: 1, nTimes: 8, nGrupos: 0, mataMata: 4, doisTurnos: false, jogosDentroGrupo: true, rebaixados: 2, descricao: 'Campeonato Rondoniense: 8 clubes em turno único (7 rodadas) + Semifinais e Final.' },
  RR: { stateCode: 'RR', stateName: 'Roraima', formulaId: 1, nTimes: 8, nGrupos: 0, mataMata: 4, doisTurnos: false, jogosDentroGrupo: true, rebaixados: 2, descricao: 'Campeonato Roraimense: 8 clubes em turno único (7 rodadas) + Semifinais e Final.' },
  SE: { stateCode: 'SE', stateName: 'Sergipe', formulaId: 1, nTimes: 8, nGrupos: 0, mataMata: 4, doisTurnos: false, jogosDentroGrupo: true, rebaixados: 2, descricao: 'Campeonato Sergipano: 8 clubes em turno único (7 rodadas) + Semifinais e Final.' },
  TO: { stateCode: 'TO', stateName: 'Tocantins', formulaId: 1, nTimes: 8, nGrupos: 0, mataMata: 4, doisTurnos: false, jogosDentroGrupo: true, rebaixados: 2, descricao: 'Campeonato Tocantinense: 8 clubes em turno único (7 rodadas) + Semifinais e Final.' },
  // Fórmula 0: 6 times em turno e returno (10 rodadas) + Final Direta (PB)
  PB: {
    stateCode: 'PB',
    stateName: 'Paraíba',
    formulaId: 0,
    nTimes: 6,
    nGrupos: 0,
    mataMata: 2,
    doisTurnos: true,
    jogosDentroGrupo: true,
    rebaixados: 2,
    descricao: 'Campeonato Paraibano: 6 clubes em turno e returno (10 rodadas) + Final Direta.',
  },
};

/**
 * Obtém a regra do campeonato estadual pelo código de estado (UF) ou ID.
 * Se o estado não possuir regra explícita, recorre à fórmula padrão (Fórmula 4: 12 times).
 */
export function getStateLeagueRule(stateCode?: string): StateLeagueRule {
  const code = (stateCode || '').toUpperCase();
  if (code && STATE_LEAGUE_RULES[code]) {
    return STATE_LEAGUE_RULES[code];
  }
  return {
    stateCode: code || 'EST',
    stateName: code ? `Estado (${code})` : 'Campeonato Estadual',
    formulaId: 4,
    nTimes: 12,
    nGrupos: 0,
    mataMata: 4,
    doisTurnos: false,
    jogosDentroGrupo: true,
    rebaixados: 2,
    descricao: 'Fórmula Padrão: 12 clubes em turno único + Semifinais e Final.',
  };
}

export function getStateDivisionInfo(stateCode?: string, allClubs?: Club[]): StateDivisionInfo {
  const rule = getStateLeagueRule(stateCode);
  const code = rule.stateCode.toUpperCase();
  const pool = allClubs || getAllClubs();
  const stateClubs = pool.filter((c) => c.countryId === 29 && (c.stateCode || '').toUpperCase() === code);
  const totalClubsInState = stateClubs.length;
  const eliteClubsCount = rule.nTimes;
  const remainingClubsCount = Math.max(0, totalClubsInState - eliteClubsCount);
  const hasSecondDivision = remainingClubsCount >= 8;

  // Tier 1 naming (Elite)
  let tier1LeagueName = rule.stateName ? `Campeonato ${rule.stateName}` : 'Campeonato Estadual';
  let tier1DivName = '1ª Divisão';
  if (code === 'SP') {
    tier1LeagueName = 'Campeonato Paulista (Paulistão)';
    tier1DivName = 'Série A1';
  } else if (code === 'RJ') {
    tier1LeagueName = 'Campeonato Carioca';
    tier1DivName = 'Série A';
  } else if (code === 'MG') {
    tier1LeagueName = 'Campeonato Mineiro';
    tier1DivName = 'Módulo I';
  } else if (code === 'RS') {
    tier1LeagueName = 'Campeonato Gaúcho';
    tier1DivName = 'Série A';
  } else if (code === 'SC') {
    tier1LeagueName = 'Campeonato Catarinense';
    tier1DivName = 'Série A';
  } else if (code === 'PR') {
    tier1LeagueName = 'Campeonato Paranaense';
    tier1DivName = '1ª Divisão';
  } else if (code === 'BA') {
    tier1LeagueName = 'Campeonato Baiano';
    tier1DivName = '1ª Divisão';
  } else if (code === 'PE') {
    tier1LeagueName = 'Campeonato Pernambucano';
    tier1DivName = '1ª Divisão';
  } else if (code === 'CE') {
    tier1LeagueName = 'Campeonato Cearense';
    tier1DivName = '1ª Divisão';
  } else if (code === 'GO') {
    tier1LeagueName = 'Campeonato Goiano';
    tier1DivName = '1ª Divisão';
  }

  const tier1: StateTierInfo = {
    tier: 1,
    badge: '1ª Divisão',
    divisionName: tier1DivName,
    leagueName: tier1LeagueName,
  };

  let tier2: StateTierInfo | undefined = undefined;
  if (hasSecondDivision) {
    let tier2LeagueName = `${tier1LeagueName.split('(')[0].trim()} • 2ª Divisão`;
    let tier2DivName = '2ª Divisão';

    if (code === 'SP') {
      tier2LeagueName = 'Paulistão Série A2';
      tier2DivName = 'Série A2';
    } else if (code === 'RJ') {
      tier2LeagueName = 'Carioca Série A2';
      tier2DivName = 'Série A2';
    } else if (code === 'MG') {
      tier2LeagueName = 'Mineiro Módulo II';
      tier2DivName = 'Módulo II';
    } else if (code === 'RS') {
      tier2LeagueName = 'Gaúcho Divisão de Acesso';
      tier2DivName = 'Divisão de Acesso';
    } else if (code === 'SC') {
      tier2LeagueName = 'Catarinense Série B';
      tier2DivName = 'Série B';
    } else if (code === 'PR') {
      tier2LeagueName = 'Paranaense 2ª Divisão';
      tier2DivName = '2ª Divisão';
    } else if (code === 'GO') {
      tier2LeagueName = 'Goiano Divisão de Acesso';
      tier2DivName = 'Divisão de Acesso';
    } else if (code === 'BA') {
      tier2LeagueName = 'Baiano 2ª Divisão';
      tier2DivName = '2ª Divisão';
    } else if (code === 'PE') {
      tier2LeagueName = 'Pernambucano Série A2';
      tier2DivName = 'Série A2';
    } else if (code === 'CE') {
      tier2LeagueName = 'Cearense Série B';
      tier2DivName = 'Série B';
    } else if (code === 'MT') {
      tier2LeagueName = 'Mato-Grossense 2ª Divisão';
      tier2DivName = '2ª Divisão';
    } else if (code === 'PA') {
      tier2LeagueName = 'Paraense Série B1';
      tier2DivName = 'Série B1';
    } else if (code === 'PB') {
      tier2LeagueName = 'Paraibano 2ª Divisão';
      tier2DivName = '2ª Divisão';
    } else if (code === 'SE') {
      tier2LeagueName = 'Sergipano Série A2';
      tier2DivName = 'Série A2';
    } else if (code === 'AP') {
      tier2LeagueName = 'Amapaense 2ª Divisão';
      tier2DivName = '2ª Divisão';
    } else if (code === 'ES') {
      tier2LeagueName = 'Capixabão Série B';
      tier2DivName = 'Série B';
    } else if (code === 'RN') {
      tier2LeagueName = 'Potiguar 2ª Divisão';
      tier2DivName = '2ª Divisão';
    } else if (code === 'MA') {
      tier2LeagueName = 'Maranhense Série B';
      tier2DivName = 'Série B';
    } else if (code === 'MS') {
      tier2LeagueName = 'Sul-Mato-Grossense Série B';
      tier2DivName = 'Série B';
    } else if (code === 'PI') {
      tier2LeagueName = 'Piauiense Série B';
      tier2DivName = 'Série B';
    } else if (code === 'DF') {
      tier2LeagueName = 'Brasiliense 2ª Divisão';
      tier2DivName = '2ª Divisão';
    } else if (code === 'AL') {
      tier2LeagueName = 'Alagoano 2ª Divisão';
      tier2DivName = '2ª Divisão';
    } else if (code === 'AM') {
      tier2LeagueName = 'Amazonense Série B';
      tier2DivName = 'Série B';
    } else if (code === 'TO') {
      tier2LeagueName = 'Tocantinense 2ª Divisão';
      tier2DivName = '2ª Divisão';
    }

    tier2 = {
      tier: 2,
      badge: '2ª Divisão',
      divisionName: tier2DivName,
      leagueName: tier2LeagueName,
    };
  }

  let tier3: StateTierInfo | undefined = undefined;
  if (code === 'SP' && remainingClubsCount >= 24) {
    tier3 = {
      tier: 3 as any,
      badge: '3ª Divisão',
      divisionName: 'Série A3',
      leagueName: 'Paulistão Série A3',
    };
  }

  return {
    stateCode: code,
    stateName: rule.stateName,
    hasSecondDivision,
    totalClubsInState,
    eliteClubsCount,
    remainingClubsCount,
    tier1,
    tier2,
    tier3,
  };
}

export interface UserStateDivisionResult {
  tier: 1 | 2;
  leagueName: string;
  divisionName: string;
  badge: string;
  fieldClubs: Club[];
  parallelTier?: {
    tier: 1 | 2;
    leagueName: string;
    divisionName: string;
    badge: string;
    fieldClubs: Club[];
  };
}

/**
 * Determina canonicamente em qual divisão estadual o clube do usuário joga (1ª Divisão Elite vs 2ª Divisão Acesso),
 * garantindo que a divisão não jogada fique ativa na aba paralela para acompanhamento.
 */
export function getUserStateDivision(
  userClub: Club,
  allAvailableClubs?: Club[],
  seasonYear = 2026,
  promotedStateClubIds?: number[],
  relegatedStateClubIds?: number[]
): UserStateDivisionResult {
  const pool = allAvailableClubs && allAvailableClubs.length > 0 ? allAvailableClubs : getAllClubs();
  const sameState = (c: Club) =>
    c.countryId === 29 &&
    ((userClub.stateId != null && c.stateId === userClub.stateId) ||
      (userClub.stateCode != null && (c.stateCode || '').toUpperCase() === (userClub.stateCode || '').toUpperCase()));

  const rawStateClubs = pool.filter(sameState);
  let sortedStateClubs = sortClubsByMeritocracy(rawStateClubs);

  const stateRule = getStateLeagueRule(userClub.stateCode);
  const divInfo = getStateDivisionInfo(userClub.stateCode, pool);
  const targetEliteCount = stateRule ? stateRule.nTimes : 12;

  // Aplica sobreposições de acesso/rebaixamento da virada de temporada anterior
  if ((promotedStateClubIds && promotedStateClubIds.length > 0) || (relegatedStateClubIds && relegatedStateClubIds.length > 0)) {
    const promotedSet = new Set(promotedStateClubIds || []);
    const relegatedSet = new Set(relegatedStateClubIds || []);
    const promotedClubs = sortedStateClubs.filter(c => promotedSet.has(c.id));
    const relegatedClubs = sortedStateClubs.filter(c => relegatedSet.has(c.id));
    const regularClubs = sortedStateClubs.filter(c => !promotedSet.has(c.id) && !relegatedSet.has(c.id));
    sortedStateClubs = [...promotedClubs, ...regularClubs, ...relegatedClubs];
  }

  // 1. Estado de divisão única (AC, RO, RR): todos os clubes jogam a 1ª Divisão
  if (!divInfo.hasSecondDivision || !divInfo.tier2) {
    const targetCount = Math.min(sortedStateClubs.length, targetEliteCount);
    let fieldClubs = sortedStateClubs.slice(0, targetCount);
    if (!fieldClubs.some(c => c.id === userClub.id)) {
      fieldClubs = [userClub, ...fieldClubs.slice(0, targetCount - 1)];
    }
    return {
      tier: 1,
      leagueName: divInfo.tier1.leagueName,
      divisionName: divInfo.tier1.divisionName,
      badge: divInfo.tier1.badge,
      fieldClubs,
    };
  }

  // 2. Estado com 2ª Divisão disponível (24 federações)
  const eliteClubs = sortedStateClubs.slice(0, targetEliteCount);
  const remainingClubs = sortedStateClubs.filter(c => !eliteClubs.some(e => e.id === c.id));
  const isUserElite = eliteClubs.some(c => c.id === userClub.id);

  if (isUserElite) {
    // Usuário joga na 1ª Divisão (Elite)
    let fieldClubs = eliteClubs;
    if (stateRule?.formulaId === 7 && fieldClubs.length === 16) {
      fieldClubs = seedClubsByPots(fieldClubs, 4, seasonYear, true);
    }
    const parallelField = remainingClubs.slice(0, Math.min(16, remainingClubs.length));
    return {
      tier: 1,
      leagueName: divInfo.tier1.leagueName,
      divisionName: divInfo.tier1.divisionName,
      badge: divInfo.tier1.badge,
      fieldClubs,
      parallelTier: {
        tier: 2,
        leagueName: divInfo.tier2.leagueName,
        divisionName: divInfo.tier2.divisionName,
        badge: divInfo.tier2.badge,
        fieldClubs: parallelField,
      },
    };
  } else {
    // Usuário joga na 2ª Divisão (Acesso / Série A2)
    const targetA2Count = Math.min(16, Math.max(8, remainingClubs.length));
    const tier2WithoutUser = remainingClubs.filter(c => c.id !== userClub.id);
    const fieldClubs = [userClub, ...tier2WithoutUser.slice(0, targetA2Count - 1)];
    let parallelField = eliteClubs;
    if (stateRule?.formulaId === 7 && parallelField.length === 16) {
      parallelField = seedClubsByPots(parallelField, 4, seasonYear, true);
    }
    return {
      tier: 2,
      leagueName: divInfo.tier2.leagueName,
      divisionName: divInfo.tier2.divisionName,
      badge: divInfo.tier2.badge,
      fieldClubs,
      parallelTier: {
        tier: 1,
        leagueName: divInfo.tier1.leagueName,
        divisionName: divInfo.tier1.divisionName,
        badge: divInfo.tier1.badge,
        fieldClubs: parallelField,
      },
    };
  }
}
