/**
 * Utilitário canônico de normalização de strings para busca:
 * - Converte para minúsculas
 * - Normaliza diacríticos Unicode (NFD) e remove acentos, tils e cedilhas
 * - Remove caracteres especiais, pontuações e comprime espaços
 * - Permite busca flexível tolerante a erros e sem acentuação (ex: 'avai' encontra 'Avaí', 'sao paulo' encontra 'São Paulo')
 */
export function normalizeSearchString(text?: string | null): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos (ex: á, ã, é, í, ó, ú, ç -> a, a, e, i, o, u, c)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')      // Substitui símbolos/pontuações por espaço
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Retorna true se a query normalizada estiver contida em qualquer parte do target normalizado.
 * Se a query estiver vazia, retorna true.
 */
export function matchesSearch(target?: string | null, query?: string | null): boolean {
  if (!query || !query.trim()) return true;
  const normQuery = normalizeSearchString(query);
  if (!normQuery) return true;
  const normTarget = normalizeSearchString(target);
  return normTarget.includes(normQuery);
}
