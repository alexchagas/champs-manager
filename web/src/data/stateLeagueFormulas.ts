/**
 * Catálogo canônico de Fórmulas dos Campeonatos Estaduais do Brasil
 * Engenharia reversa dos 25 arquivos .ces (conf_estadual/*.ces) e do motor original (best/aq.java e best/w.java).
 */

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
