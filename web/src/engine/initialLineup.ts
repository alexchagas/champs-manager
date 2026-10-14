import type { GameState } from '../types/index.ts';

type AutoSelectLineup = (state: GameState, clubId: number) => GameState | null;

/**
 * Escalação inicial de uma carreira nova.
 *
 * Os elencos vêm dos dados do Brasfoot com a marcação de titulares bagunçada (ex.: Barcelona com 19,
 * só ~25% dos clubes com exatamente 11). Sem ajuste, o jogador não consegue jogar a 1ª partida.
 * Roda uma única vez, ao criar a carreira, a mesma escalação automática do botão "Auto-Escalar Time"
 * para o clube do usuário. Depois disso a escalação é sempre a que o usuário escolher.
 *
 * `autoSelect` é recebido por parâmetro para poder ser testado sem o motor WASM.
 */
export function withInitialLineup(state: GameState, autoSelect: AutoSelectLineup): GameState {
  return autoSelect(state, state.userClubId) ?? state;
}
