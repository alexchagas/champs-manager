import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 
  getClubTheme, 
  normalizeHexColor, 
  adjustColorForDarkSurface, 
  getContrastRatio, 
  getRelativeLuminance 
} from '../src/theme/clubTheme.ts';

test('normalizeHexColor handles 3-digit, 6-digit, uppercase, missing, and invalid colors', () => {
  assert.equal(normalizeHexColor('#fff'), '#FFFFFF');
  assert.equal(normalizeHexColor('#ff3333'), '#FF3333');
  assert.equal(normalizeHexColor('#028b4c'), '#028B4C');
  assert.equal(normalizeHexColor(null), '#10B981');
  assert.equal(normalizeHexColor(undefined), '#10B981');
  assert.equal(normalizeHexColor('not-a-color'), '#10B981');
  assert.equal(normalizeHexColor('#xyz'), '#10B981');
});

test('adjustColorForDarkSurface lifts pure black and deep dark colors for dark background visibility', () => {
  // Pure black (like Vasco / Athletico / Atlético-MG primary) should not be invisible on dark surfaces
  const liftedBlack = adjustColorForDarkSurface('#000000');
  assert.notEqual(liftedBlack, '#000000');
  assert.ok(getRelativeLuminance(liftedBlack) > 0.4, 'Lifted black should be clearly luminescent');

  // Deep dark navy (like Cruzeiro #000099) should be lightened to be distinct on dark surface
  const liftedNavy = adjustColorForDarkSurface('#000099');
  assert.notEqual(liftedNavy, '#000099');
  assert.ok(getRelativeLuminance(liftedNavy) > 0.08, 'Navy should have improved luminance');

  // Red (Flamengo #ff3333) should remain vibrant red
  const red = adjustColorForDarkSurface('#ff3333');
  assert.equal(red, '#FF3333');

  // Green (Palmeiras #028b4c) should remain vibrant green
  const green = adjustColorForDarkSurface('#028b4c');
  assert.equal(green, '#028B4C');

  // White (Santos / Corinthians #ffffff) should remain readable white/off-white
  const white = adjustColorForDarkSurface('#ffffff');
  assert.ok(white.startsWith('#F'), 'White stays high contrast');
});

test('getClubTheme generates correct tokens for rubro-negro (Flamengo)', () => {
  const theme = getClubTheme({ primaryColor: '#ff3333', secondaryColor: '#000000' });
  assert.equal(theme.primary, '#FF3333');
  assert.equal(theme.secondary, '#000000');
  assert.equal(theme.primaryAccent, '#FF3333');
  assert.notEqual(theme.secondaryAccent, '#000000', 'Secondary black accent should be adjusted for visibility');
  assert.ok(theme.stripeGradient.includes('#FF3333'));
  assert.ok(theme.stripeGradient.includes('#000000'));
  assert.ok(theme.subtleBg.startsWith('rgba('));
});

test('getClubTheme generates correct tokens for light club (Santos)', () => {
  const theme = getClubTheme({ primaryColor: '#f0f0f0', secondaryColor: '#000000' });
  assert.equal(theme.primary, '#F0F0F0');
  assert.equal(theme.secondary, '#000000');
  assert.equal(theme.isPrimaryLight, true);
  assert.ok(theme.stripeGradient.includes('#F0F0F0'));
});

test('getClubTheme generates correct tokens for green club (Palmeiras)', () => {
  const theme = getClubTheme({ primaryColor: '#028b4c', secondaryColor: '#ffffff' });
  assert.equal(theme.primary, '#028B4C');
  assert.equal(theme.secondary, '#FFFFFF');
  assert.equal(theme.primaryAccent, '#028B4C');
  assert.ok(theme.stripeGradient.includes('#028B4C'));
});

test('getClubTheme fallback when colors are missing or invalid', () => {
  const themeNull = getClubTheme(null);
  assert.equal(themeNull.primary, '#10B981');
  assert.equal(themeNull.secondary, '#FFFFFF');

  const themeInvalid = getClubTheme({ primaryColor: 'invalid', secondaryColor: '' });
  assert.equal(themeInvalid.primary, '#10B981');
  assert.equal(themeInvalid.secondary, '#FFFFFF');
});
