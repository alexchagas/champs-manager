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
  assert.ok(content.includes('💾 Salvar / Carregar'), 'Has Salvar / Carregar button');
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


test('MainMenu.tsx labels the save/load section as "Salvar / Carregar" on desktop and mobile', () => {
  const menuPath = path.join(__dirname, '../src/components/MainMenu.tsx');
  const content = fs.readFileSync(menuPath, 'utf8');

  assert.ok(content.includes('<span>💾 Salvar / Carregar</span>'), 'Desktop sidebar uses "Salvar / Carregar"');
  assert.ok(content.includes('<span>Salvar / Carregar</span>'), 'Mobile tab uses "Salvar / Carregar"');
  assert.ok(!content.includes('Carregar Jogo</span>'), 'Old "Carregar Jogo" label is gone');
  assert.ok(!content.includes('<span>Carregar</span>'), 'Old short "Carregar" mobile label is gone');
});

test('MainMenu.tsx asks for in-page confirmation before replacing an active career', () => {
  const menuPath = path.join(__dirname, '../src/components/MainMenu.tsx');
  const content = fs.readFileSync(menuPath, 'utf8');

  // Both start buttons (desktop + mobile sticky) go through the guard, never straight to handleStartGame
  assert.equal(content.split('onClick={handleStartGame}').length - 1, 0, 'No start button calls handleStartGame directly');
  assert.ok(content.split('onClick={requestStartGame}').length - 1 >= 2, 'Desktop and mobile start buttons use requestStartGame');

  // Guard: with an active career, open the confirmation instead of starting
  const guard = content.match(/const requestStartGame = \(\) => \{[\s\S]*?\n  \};/);
  assert.ok(guard, 'requestStartGame is defined');
  assert.match(guard[0], /if \(hasActiveCareer\) \{\s*setConfirmReplaceOpen\(true\);\s*return;\s*\}/, 'Active career opens the confirmation');
  assert.ok(guard[0].includes('handleStartGame()'), 'Without an active career, starts the game as before');
  assert.ok(!guard[0].includes('confirm('), 'Guard must not use native window.confirm');

  // In-page dialog with clear message and both actions
  assert.ok(content.includes('data-testid="confirm-replace-career"'), 'Renders confirmation dialog with test id');
  assert.ok(content.includes('Substituir carreira atual?'), 'Dialog has a clear title');
  assert.ok(content.includes('data-testid="confirm-replace-cancel"'), 'Dialog has a cancel action');
  assert.ok(content.includes('data-testid="confirm-replace-accept"'), 'Dialog has a confirm action');
  assert.ok(content.includes('Começar novo jogo'), 'Confirm action label');
});

// ---- Etapa 2: o menu abre primeiro numa lista de opções (hub), não no formulário de Novo Jogo ----

const readMenu = () => fs.readFileSync(path.join(__dirname, '../src/components/MainMenu.tsx'), 'utf8');
const hubBlock = (content) => {
  const start = content.indexOf('{/* MENU HUB START */}');
  const end = content.indexOf('{/* MENU HUB END */}');
  assert.ok(start !== -1 && end > start, 'Hub block is delimited by MENU HUB START/END markers');
  return content.slice(start, end);
};

test('MainMenu.tsx opens on the hub instead of the Novo Jogo form', () => {
  const content = readMenu();
  assert.ok(/type MenuTab = 'hub' \| /.test(content), "MenuTab type includes 'hub'");
  assert.ok(content.includes("useState<MenuTab>('hub')"), "Initial tab is 'hub'");
  assert.ok(!content.includes("('new_game');"), "Initial tab is no longer 'new_game'");
  assert.ok(content.includes("activeTab === 'hub' ? ("), 'Hub replaces the sidebar/tabs layout while active');
});

test('MainMenu.tsx hub highlights Continuar carreira with an active career, Novo jogo otherwise', () => {
  const hub = hubBlock(readMenu());
  assert.ok(hub.includes('data-testid="main-menu-hub"'), 'Hub has test id');
  assert.ok(/\{hasActiveCareer \? \(/.test(hub), 'Primary action depends on hasActiveCareer');
  assert.ok(hub.includes('data-testid="hub-continue-career"') && hub.includes('onClick={returnToGame}'), 'Continuar carreira returns to the game');
  assert.ok(hub.includes('{userClub.name} · {gameState.seasonYear} · Rodada {gameState.currentRound}'), 'Shows club, year and round');
  assert.ok(hub.includes('data-testid="hub-new-game-primary"'), 'Novo jogo is the primary action without a career');
});

test('MainMenu.tsx hub lists every section and the bug report', () => {
  const hub = hubBlock(readMenu());
  for (const tab of ['new_game', 'load_game', 'editor', 'options', 'credits']) {
    assert.ok(hub.includes(`changeTab('${tab}')`), `Hub links to ${tab}`);
  }
  for (const label of ['Novo jogo', 'Salvar / Carregar', 'Editor de equipes', 'Opções & áudio', 'Créditos', 'Reportar bug']) {
    assert.ok(hub.includes(label), `Hub shows "${label}"`);
  }
  assert.ok(hub.includes("new CustomEvent('champs:open-bug-report')"), 'Reportar bug opens the existing bug report');
});

test('MainMenu.tsx hub has no emoji and comfortable touch targets', () => {
  const hub = hubBlock(readMenu());
  assert.ok(!/\p{Extended_Pictographic}/u.test(hub), 'Hub uses icons only, no emoji');
  assert.ok(hub.includes('min-h-[44px]'), 'Hub buttons are at least 44px tall');
});

test('MainMenu.tsx offers a "Menu" button back to the hub from any section', () => {
  const content = readMenu();
  assert.ok(content.includes("{activeTab !== 'hub' && ("), 'Back button only outside the hub');
  assert.ok(content.includes('data-testid="back-to-menu-btn"'), 'Back button has test id');
  assert.ok(content.includes("onClick={() => changeTab('hub')}"), 'Back button returns to the hub');
});
