/**
 * Utilitários de formatação e manipulação de datas para o calendário do Champs Manager.
 */

/**
 * Formata uma data ISO (YYYY-MM-DD) para exibição amigável em português.
 * @param dateStr String ISO (ex: "2026-05-14")
 * @param format 'short' (Qua, 14/05), 'full' (14 de Maio de 2026), 'weekday' (Quarta-feira, 14/05/2026), 'dayMonth' (14/05)
 */
export function formatMatchDate(
  dateStr?: string,
  format: 'short' | 'full' | 'weekday' | 'dayMonth' = 'short'
): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  if (isNaN(date.getTime())) return dateStr;

  if (format === 'dayMonth') {
    return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}`;
  }

  if (format === 'short') {
    // Ex: "Qua, 14/05"
    const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' }).format(date).replace('.', '');
    const dayMonth = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}`;
    return `${capitalize(weekday)}, ${dayMonth}`;
  }

  if (format === 'weekday') {
    // Ex: "Quarta-feira, 14/05/2026"
    const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' }).format(date);
    return `${capitalize(weekday)}, ${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
  }

  // format === 'full' -> Ex: "14 de Maio de 2026"
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(date);
  return `${day} de ${capitalize(monthName)} de ${year}`;
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
