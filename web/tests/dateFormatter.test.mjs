import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMatchDate } from '../src/utils/dateFormatter.ts';

test('formatMatchDate formats correctly in various styles', () => {
  // Test short format: "Qua, 13/05"
  const short = formatMatchDate('2026-05-13', 'short');
  assert.match(short, /Qua.*13\/05/i);

  // Test dayMonth format: "13/05"
  const dayMonth = formatMatchDate('2026-05-13', 'dayMonth');
  assert.equal(dayMonth, '13/05');

  // Test weekday format: "Quarta-feira, 13/05/2026"
  const weekday = formatMatchDate('2026-05-13', 'weekday');
  assert.match(weekday, /Quarta-feira, 13\/05\/2026/i);

  // Test full format: "13 de Maio de 2026"
  const full = formatMatchDate('2026-05-13', 'full');
  assert.match(full, /13 de Maio de 2026/i);

  // Test edge cases
  assert.equal(formatMatchDate(undefined), '');
  assert.equal(formatMatchDate(''), '');
});
