import type { Club } from '../types/index.ts';

type SearchableClub = Pick<Club, 'name' | 'reputation' | 'stadium' | 'coach' | 'stateName' | 'stateCode'>;

/** Minúsculas e sem acentos: "Avaí" → "avai". */
const normalize = (text?: string) =>
  (text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Quanto menor, mais relevante. null = não combina. */
function relevance(club: SearchableClub, query: string): number | null {
  const name = normalize(club.name);
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.split(/[\s\-.'()/]+/).some((word) => word.startsWith(query))) return 2;
  if (name.includes(query)) return 3;
  if ([club.stadium, club.stateName, club.stateCode, club.coach].some((field) => normalize(field).includes(query))) return 4;
  return null;
}

/**
 * Busca global de clubes na tela de Novo Jogo (a partir de 2 caracteres).
 * Ordena por relevância (nome exato > começa com > palavra começa com > contém > estádio/estado/técnico)
 * e, em empate, pela ordem de antes: reputação maior primeiro, depois nome.
 */
export function searchClubs<T extends SearchableClub>(clubs: T[], rawQuery: string): T[] {
  const query = normalize(rawQuery.trim());
  if (query.length < 2) return [];
  return clubs
    .map((club) => ({ club, score: relevance(club, query) }))
    .filter((item): item is { club: T; score: number } => item.score !== null)
    .sort((a, b) => a.score - b.score || b.club.reputation - a.club.reputation || a.club.name.localeCompare(b.club.name))
    .map((item) => item.club);
}
