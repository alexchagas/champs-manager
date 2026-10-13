import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('MainMenu.tsx contains prominent Continuar Carreira button conditional on hasActiveCareer', () => {
  const menuPath = path.join(__dirname, '../src/components/MainMenu.tsx');
  assert.ok(fs.existsSync(menuPath), 'MainMenu.tsx exists');

  const content = fs.readFileSync(menuPath, 'utf8');

  // Conditioned on hasActiveCareer
  assert.ok(content.includes('hasActiveCareer'), 'Destructures hasActiveCareer');
  assert.ok(content.includes('data-testid="continue-career-btn"'), 'Has continue-career-btn test id');
  assert.ok(content.includes('Continuar Carreira'), 'Has text Continuar Carreira');
  assert.ok(content.includes('{userClub.name} · {gameState.seasonYear} · Rodada {gameState.currentRound}'), 'Displays club, year and round format');

  // Header "Voltar ao Jogo" only rendered when hasActiveCareer is true
  assert.ok(content.includes('{hasActiveCareer && ('), 'Conditionally renders header return button');
  assert.ok(content.includes('data-testid="return-to-game-header-btn"'), 'Has return-to-game header button test id');
});

test('MainMenu.tsx organizes all classic buttons including lekD Games credits', () => {
  const menuPath = path.join(__dirname, '../src/components/MainMenu.tsx');
  const content = fs.readFileSync(menuPath, 'utf8');

  assert.ok(content.includes('⚽ Novo Jogo'), 'Has Novo Jogo button');
  assert.ok(content.includes('💾 Carregar Jogo'), 'Has Carregar Jogo button');
  assert.ok(content.includes('🛠️ Editor de Equipes'), 'Has Editor de Equipes button');
  assert.ok(content.includes('⚙️ Opções & Áudio'), 'Has Opções & Áudio button');
  assert.ok(content.includes('🏆 Créditos (lekD Games)'), 'Has Créditos button');

  // Credits tab contains studio identity, Brasfoot tribute and tech specs
  assert.ok(content.includes('activeTab === \'credits\''), 'Has credits tab condition');
  assert.ok(content.includes('lekD'), 'Credits mention lekD');
  assert.ok(content.includes('GAMES'), 'Credits mention GAMES');
  assert.ok(content.includes('Futebol Tático Raiz'), 'Credits mention slogan Futebol Tático Raiz');
  assert.ok(content.includes('A Essência do Gerenciamento de Futebol'), 'Credits feature game philosophy');
  assert.ok(!content.includes('Emmanuel dos Santos'), 'Does not credit external creators');
  assert.ok(content.includes('Rust 1.85+ & WASM'), 'Credits detail Rust and WASM engine');
});

test('App.tsx esc handling and GameContext contract guarantee safe title navigation', () => {
  const appPath = path.join(__dirname, '../src/App.tsx');
  const content = fs.readFileSync(appPath, 'utf8');

  // Overview Esc -> menu
  assert.ok(content.includes("else if (activeScreen === 'overview') {\n          setScreen('menu');"), 'Esc from overview goes to menu');

  // Menu Esc -> overview only if hasActiveCareer is true
  assert.ok(content.includes("else if (activeScreen === 'menu') {\n          if (hasActiveCareer) {\n            setScreen('overview');\n          }\n        }"), 'Esc from menu only goes to overview if hasActiveCareer is true');

  // GameContext contract includes hasActiveCareer
  const contextPath = path.join(__dirname, '../src/state/GameContext.tsx');
  const contextContent = fs.readFileSync(contextPath, 'utf8');
  assert.ok(contextContent.includes('hasActiveCareer: boolean;'), 'GameContextType declares hasActiveCareer');
});

test('MainMenu.tsx replaces native browser alerts with polished floating toast notifications', () => {
  const menuPath = path.join(__dirname, '../src/components/MainMenu.tsx');
  const content = fs.readFileSync(menuPath, 'utf8');

  // Must not use window.alert or alert()
  assert.ok(!content.includes('alert('), 'MainMenu.tsx must not use native browser alert()');

  // Must have toast notification element and showToast
  assert.ok(content.includes('data-testid="mainmenu-toast"'), 'MainMenu.tsx must render floating toast with testid');
  assert.ok(content.includes('Pelo menos 1 liga ativa deve permanecer selecionada'), 'Provides friendly message for minimum active leagues');
  assert.ok(content.includes('Máximo de 5 ligas ativas'), 'Provides friendly message for maximum active leagues');
});

