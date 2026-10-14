import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const readTransfers = () => fs.readFileSync(path.join(__dirname, '../src/components/TransfersScreen.tsx'), 'utf8');

test('TransfersScreen.tsx contracts table sorts when a column header is clicked', () => {
  const content = readTransfers();

  // Estado de ordenação: começa sem ordenação (ordem atual do elenco)
  assert.ok(content.includes('useState<{ key: ContractSortKey; asc: boolean } | null>(null)'), 'Starts unsorted');
  // Tabela usa a lista ordenada, não o elenco cru
  assert.ok(content.includes('sortedContractsSquad.map((p) =>'), 'Table renders the sorted list');
  assert.ok(!content.includes('userClub.squad.map((p) => {\n                    const posStyle'), 'Table no longer maps the raw squad');

  // Todas as colunas de dados são clicáveis; "Ações" não
  for (const key of ['name', 'position', 'age', 'strength', 'salary', 'marketValue', 'contractYears']) {
    assert.ok(content.includes(`sortKey="${key}"`), `Column ${key} is sortable`);
  }
  assert.ok(content.includes('<th className="py-2.5 px-3 text-center">Ações</th>'), 'Actions column stays plain');

  // Acessibilidade e indicador visual
  assert.ok(content.includes('aria-sort='), 'Headers expose aria-sort');
  assert.ok(content.includes('<ChevronUp') && content.includes('<ChevronDown'), 'Shows the sort direction arrow');
});

test('TransfersScreen.tsx contract sort: 2nd click on the same column inverts the order', () => {
  const content = readTransfers();
  const toggle = content.match(/const toggleContractSort = \(key: ContractSortKey\) =>[\s\S]*?\n  \};/);
  assert.ok(toggle, 'toggleContractSort is defined');
  assert.match(toggle[0], /prev && prev\.key === key \? \{ key, asc: !prev\.asc \}/, 'Same column inverts');
  // 1º clique: texto em ordem crescente (A→Z / GOL→ATA), números do maior para o menor
  assert.match(toggle[0], /asc: key === 'name' \|\| key === 'position'/, 'First click: text ascending, numbers descending');
});

test('TransfersScreen.tsx "Passes Livres" table sorts by column, starting by Força (as before)', () => {
  const content = readTransfers();

  assert.ok(
    content.includes("useState<{ key: FreeAgentSortKey; asc: boolean } | null>({ key: 'strength', asc: false })"),
    'Starts sorted by strength, highest first (same order as before)'
  );
  assert.ok(!content.includes('.sort((a, b) => b.strength - a.strength)'), 'Hard-coded strength sort is gone');
  assert.ok(content.includes('sortedFreeAgents.map((p) =>'), 'Table renders the sorted (and filtered) list');
  for (const key of ['name', 'position', 'age', 'foot', 'strength', 'demandedSalary', 'marketValue']) {
    assert.ok(content.includes(`sortKey="${key}"`), `Column ${key} is sortable`);
  }

  const toggle = content.match(/const toggleFreeAgentSort = \(key: FreeAgentSortKey\) =>[\s\S]*?\n  \};/);
  assert.ok(toggle, 'toggleFreeAgentSort is defined');
  assert.match(toggle[0], /prev && prev\.key === key \? \{ key, asc: !prev\.asc \}/, 'Same column inverts');
  assert.match(toggle[0], /asc: key === 'name' \|\| key === 'position' \|\| key === 'foot'/, 'First click: text ascending, numbers descending');
});

test('TransfersScreen.tsx "Buscar Jogadores" table sorts by column', () => {
  const content = readTransfers();

  assert.ok(content.includes('useState<{ key: SearchSortKey; asc: boolean } | null>(null)'), 'Starts in the search order');
  assert.ok(content.includes('sortedSearchResults.map((item) =>'), 'Table renders the sorted list');
  for (const key of ['club', 'askingPrice']) {
    assert.ok(content.includes(`sortKey="${key}"`), `Column ${key} is sortable`);
  }
  // Ação continua sem ordenação nas duas tabelas
  assert.equal(content.split('<th className="py-2.5 px-3 text-center">Ação</th>').length - 1, 2, 'Both "Ação" columns stay plain');

  const toggle = content.match(/const toggleSearchSort = \(key: SearchSortKey\) =>[\s\S]*?\n  \};/);
  assert.ok(toggle, 'toggleSearchSort is defined');
  assert.match(toggle[0], /prev && prev\.key === key \? \{ key, asc: !prev\.asc \}/, 'Same column inverts');
  assert.match(toggle[0], /asc: key === 'name' \|\| key === 'club' \|\| key === 'position'/, 'First click: text ascending, numbers descending');
});
