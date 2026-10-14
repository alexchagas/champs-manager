import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const readTransfers = () => fs.readFileSync(path.join(__dirname, '../src/components/TransfersScreen.tsx'), 'utf8');

test('TransfersScreen.tsx explains why signings are blocked when the squad is full', () => {
  const content = readTransfers();

  // Aviso visível nas abas de contratação, só quando o elenco está cheio
  assert.ok(content.includes('data-testid="squad-full-notice"'), 'Renders a squad-full notice');
  assert.ok(
    content.includes("{isSquadFull && (activeTab === 'free_agents' || activeTab === 'search') && ("),
    'Notice only shows on the signing tabs when the squad is full'
  );
  // Quantos jogadores precisa dispensar para abrir 1 vaga (elenco precisa ficar abaixo de 30)
  assert.ok(content.includes('const playersToFreeUp = Math.max(0, squadCount - 29);'), 'Computes how many players to release');
  assert.ok(content.includes('{playersToFreeUp}'), 'Shows how many players to release');
  // Atalho para a aba de contratos, onde se dispensa
  assert.ok(content.includes('data-testid="squad-full-go-contracts"'), 'Offers a shortcut to the contracts tab');
  assert.ok(content.includes("onClick={() => { setActiveTab('contracts'); sound.playClick(); }}"), 'Shortcut opens the contracts tab');
});

test('TransfersScreen.tsx disabled sign/buy buttons say "Elenco cheio" instead of a silent grey button', () => {
  const content = readTransfers();

  assert.ok(content.includes("{isSquadFull ? 'Elenco cheio' : 'Contratar'}"), 'Free agent button explains the block');
  assert.ok(content.includes("{isSquadFull ? 'Elenco cheio' : 'Comprar'}"), 'Buy button explains the block');
  assert.ok(
    content.split('title={isSquadFull ? squadFullHint : undefined}').length - 1 >= 2,
    'Both buttons show a hint on hover'
  );
});
