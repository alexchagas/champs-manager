import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, '..');

test('index.html supports dynamic viewport 100dvh and responsive overflow', () => {
  const html = fs.readFileSync(path.join(webDir, 'index.html'), 'utf-8');
  assert.ok(html.includes('100dvh'), 'index.html must include 100dvh for iOS Safari dynamic toolbar support');
  assert.ok(html.includes('md:overflow-hidden'), 'index.html body must preserve overflow-hidden on desktop/tablet');
  assert.ok(html.includes('overflow-x-hidden'), 'index.html body must prevent unwanted horizontal overflow on mobile');
});

test('index.css defines 100dvh, -webkit-fill-available, and desktop overflow-hidden', () => {
  const css = fs.readFileSync(path.join(webDir, 'src/index.css'), 'utf-8');
  assert.ok(css.includes('100dvh'), 'index.css must include 100dvh');
  assert.ok(css.includes('-webkit-fill-available'), 'index.css must include -webkit-fill-available for iOS Safari');
  assert.ok(css.includes('@media (min-width: 768px)'), 'index.css must have media query for tablet and desktop');
  assert.ok(css.includes('overflow: hidden;'), 'index.css must keep overflow hidden on tablet and desktop');
});

test('App.tsx AppShell and main implement mobile scroll with desktop lock', () => {
  const app = fs.readFileSync(path.join(webDir, 'src/App.tsx'), 'utf-8');
  assert.ok(app.includes('h-[100dvh]'), 'AppShell must use dynamic 100dvh viewport height');
  assert.ok(app.includes('md:overflow-hidden'), 'AppShell must be overflow-hidden on desktop/tablet');
  assert.ok(app.includes('overflow-y-auto md:overflow-hidden'), 'main element must enable vertical scroll on mobile and lock on desktop');
  assert.ok(app.includes('safe-area-inset-bottom'), 'main element must account for iOS safe area inset');
});

test('MainMenu.tsx provides responsive mobile tabs and sticky career start button', () => {
  const menu = fs.readFileSync(path.join(webDir, 'src/components/MainMenu.tsx'), 'utf-8');
  assert.ok(menu.includes('flex md:hidden') && menu.includes('overflow-x-auto'), 'MainMenu must include horizontal scrollable tabs on mobile');
  assert.ok(menu.includes('hidden md:flex') && menu.includes('w-64'), 'MainMenu must preserve classic 256px sidebar on desktop/tablet');
  assert.ok(menu.includes('grid-cols-1 md:grid-cols-12'), 'MainMenu club selection grid must collapse to 1 column on mobile');
  assert.ok(menu.includes('start-career-mobile-sticky-btn'), 'MainMenu must provide sticky start career CTA on mobile');
  assert.ok(menu.includes('continue-career-mobile-btn'), 'MainMenu must provide mobile-accessible continue career banner');
});

test('BottomNavBar.tsx dynamically calculates safe area height', () => {
  const nav = fs.readFileSync(path.join(webDir, 'src/components/BottomNavBar.tsx'), 'utf-8');
  assert.ok(nav.includes('calc(3.5rem+env(safe-area-inset-bottom'), 'BottomNavBar must compute total height with safe area inset');
  assert.ok(nav.includes('h-14 relative'), 'BottomNavBar buttons must retain minimum 56px touch height');
});

test('Gameplay screens unlock vertical scroll on mobile while preserving desktop lock', () => {
  const overview = fs.readFileSync(path.join(webDir, 'src/components/ClubOverview.tsx'), 'utf-8');
  assert.ok(overview.includes('lg:overflow-hidden'), 'ClubOverview must preserve desktop fixed dashboard with lg:overflow-hidden');
  assert.ok(!overview.includes('h-full min-h-0 select-none overflow-hidden'), 'ClubOverview must not force rigid unconditional overflow-hidden');

  const tactics = fs.readFileSync(path.join(webDir, 'src/components/TacticsScreen.tsx'), 'utf-8');
  assert.ok(tactics.includes('lg:overflow-hidden'), 'TacticsScreen must preserve desktop layout with lg:overflow-hidden');

  const results = fs.readFileSync(path.join(webDir, 'src/components/RoundResultsScreen.tsx'), 'utf-8');
  assert.ok(results.includes('lg:overflow-hidden'), 'RoundResultsScreen must preserve desktop layout with lg:overflow-hidden');
  assert.ok(!results.includes('h-screen w-full select-none overflow-hidden'), 'RoundResultsScreen must not force rigid h-screen overflow-hidden');

  const transfers = fs.readFileSync(path.join(webDir, 'src/components/TransfersScreen.tsx'), 'utf-8');
  assert.ok(transfers.includes('md:overflow-hidden'), 'TransfersScreen must use md:overflow-hidden');

  const finances = fs.readFileSync(path.join(webDir, 'src/components/FinancesScreen.tsx'), 'utf-8');
  assert.ok(finances.includes('md:overflow-hidden'), 'FinancesScreen must use md:overflow-hidden');
});
