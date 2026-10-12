import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('ActiveScreen type definition includes splash screen', () => {
  const typesPath = path.join(__dirname, '../src/types/index.ts');
  const content = fs.readFileSync(typesPath, 'utf8');

  assert.match(content, /export type ActiveScreen =\s*\|\s*'splash'/);
});

test('SplashScreen component satisfies all prompt requirements', () => {
  const splashPath = path.join(__dirname, '../src/components/SplashScreen.tsx');
  assert.ok(fs.existsSync(splashPath), 'SplashScreen.tsx exists');

  const content = fs.readFileSync(splashPath, 'utf8');

  // Requirement 1: Studio "lekD Games" vignette with slogan "Futebol Tático Raiz"
  assert.ok(content.includes('lekD'), 'Includes lekD');
  assert.ok(content.includes('GAMES'), 'Includes GAMES');
  assert.ok(content.includes('Futebol Tático Raiz'), 'Includes slogan Futebol Tático Raiz');
  assert.ok(content.includes('studio'), 'Has studio phase');

  // Requirement 2: Champs Manager 2026 logo, subtitle and Rust/WASM badge
  assert.ok(content.includes('Champs Manager'), 'Includes Champs Manager');
  assert.ok(content.includes('2026'), 'Includes 2026');
  assert.ok(content.includes('O clássico gerenciador de futebol'), 'Includes classic subtitle');
  assert.ok(content.includes('WASM') || content.includes('Rust'), 'Includes Rust/WASM indicator');
  assert.ok(content.includes('Pressione Espaço ou clique para continuar'), 'Includes prompt to continue');

  // Requirement 3: Skip support on Space, Enter, Escape and click
  assert.ok(content.includes('Space'), 'Listens for Space');
  assert.ok(content.includes('Enter'), 'Listens for Enter');
  assert.ok(content.includes('Escape'), 'Listens for Escape');
  assert.ok(content.includes('onClick'), 'Listens for click');
  assert.ok(content.includes('onFinish'), 'Invokes onFinish callback');

  // Requirement 4: Audio feedback on transition and skip
  assert.ok(content.includes('sound'), 'Uses sound engine');
});

test('App.tsx integrates SplashScreen and conceals Header during splash', () => {
  const appPath = path.join(__dirname, '../src/App.tsx');
  const content = fs.readFileSync(appPath, 'utf8');

  assert.ok(content.includes("import { SplashScreen } from './components/SplashScreen';"), 'Imports SplashScreen');
  assert.ok(content.includes("activeScreen === 'splash' && ("), 'Renders SplashScreen');
  assert.ok(content.includes("activeScreen !== 'splash'"), 'Conceals in-game header during splash');
});
