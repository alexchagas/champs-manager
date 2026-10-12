import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 
  deriveClubAtmosphere, 
  detectAtmosphereFamily, 
  getContrastRatio, 
  FAMILY_BASE_PALETTES 
} from '../src/theme/clubTheme.ts';

test('detectAtmosphereFamily correctly classifies club color combinations', () => {
  // Cruzeiro: Deep blue + white
  assert.equal(detectAtmosphereFamily('#000099', '#ffffff'), 'azuis');
  // Grêmio: Sky blue + black
  assert.equal(detectAtmosphereFamily('#0d80bf', '#000000'), 'azuis');

  // Flamengo: Red + black
  assert.equal(detectAtmosphereFamily('#ff3333', '#000000'), 'vermelhos');
  // São Paulo: Red + white + black
  assert.equal(detectAtmosphereFamily('#e11d48', '#ffffff'), 'vermelhos');
  // Internacional: Red + white
  assert.equal(detectAtmosphereFamily('#dc2626', '#ffffff'), 'vermelhos');

  // Santos: White + black (alvinegro)
  assert.equal(detectAtmosphereFamily('#f0f0f0', '#000000'), 'alvinegros');
  // Corinthians / Vasco / Botafogo / Atlético-MG: Black + white
  assert.equal(detectAtmosphereFamily('#000000', '#ffffff'), 'alvinegros');
  assert.equal(detectAtmosphereFamily('#1a1a1a', '#f5f5f5'), 'alvinegros');

  // Palmeiras: Green + white
  assert.equal(detectAtmosphereFamily('#028b4c', '#ffffff'), 'verdes');
  // Coritiba / Juventude / Goiás: Green
  assert.equal(detectAtmosphereFamily('#15803d', '#ffffff'), 'verdes');

  // Dourados / Ouro: Gold + black
  assert.equal(detectAtmosphereFamily('#ffd700', '#000000'), 'dourados');
  assert.equal(detectAtmosphereFamily('#eab308', '#000000'), 'dourados');
});

test('deriveClubAtmosphere derives correct palette and tokens for Cruzeiro (Azul)', () => {
  const cruzeiro = {
    id: 1,
    name: 'Cruzeiro',
    primaryColor: '#000099',
    secondaryColor: '#ffffff'
  };

  const atmosphere = deriveClubAtmosphere(cruzeiro);

  assert.equal(atmosphere.family, 'azuis');
  assert.equal(atmosphere.familyName, 'Azuis');

  // Check all 6 required CSS variables in tokens
  assert.ok(atmosphere.tokens['--app-bg-deep'], '--app-bg-deep must be defined');
  assert.ok(atmosphere.tokens['--app-surface-1'], '--app-surface-1 must be defined');
  assert.ok(atmosphere.tokens['--app-surface-2'], '--app-surface-2 must be defined');
  assert.ok(atmosphere.tokens['--app-border-subtle'], '--app-border-subtle must be defined');
  assert.ok(atmosphere.tokens['--app-border-highlight'], '--app-border-highlight must be defined');
  assert.ok(atmosphere.tokens['--app-text-accent'], '--app-text-accent must be defined');

  // Check style object injection
  assert.equal(atmosphere.style['--app-bg-deep'], atmosphere.tokens['--app-bg-deep']);
  assert.equal(atmosphere.style['--app-surface-1'], atmosphere.tokens['--app-surface-1']);
  assert.equal(atmosphere.style['--app-surface-2'], atmosphere.tokens['--app-surface-2']);
  assert.equal(atmosphere.style['--app-border-subtle'], atmosphere.tokens['--app-border-subtle']);
  assert.equal(atmosphere.style['--app-border-highlight'], atmosphere.tokens['--app-border-highlight']);
  assert.equal(atmosphere.style['--app-text-accent'], atmosphere.tokens['--app-text-accent']);

  // Verify WCAG AA safe contrast (>= 4.5:1) of text accent against surfaces
  const accent = atmosphere.tokens['--app-text-accent'];
  assert.ok(
    getContrastRatio(accent, atmosphere.tokens['--app-bg-deep']) >= 4.5,
    `Cruzeiro accent contrast on bg-deep must be >= 4.5:1 (got ${getContrastRatio(accent, atmosphere.tokens['--app-bg-deep'])})`
  );
  assert.ok(
    getContrastRatio(accent, atmosphere.tokens['--app-surface-1']) >= 4.5,
    `Cruzeiro accent contrast on surface-1 must be >= 4.5:1 (got ${getContrastRatio(accent, atmosphere.tokens['--app-surface-1'])})`
  );
  assert.ok(
    getContrastRatio(accent, atmosphere.tokens['--app-surface-2']) >= 4.5,
    `Cruzeiro accent contrast on surface-2 must be >= 4.5:1 (got ${getContrastRatio(accent, atmosphere.tokens['--app-surface-2'])})`
  );
});

test('deriveClubAtmosphere derives correct palette and tokens for Flamengo (Rubro-negro)', () => {
  const flamengo = {
    id: 2,
    name: 'Flamengo',
    primaryColor: '#ff3333',
    secondaryColor: '#000000'
  };

  const atmosphere = deriveClubAtmosphere(flamengo);

  assert.equal(atmosphere.family, 'vermelhos');
  assert.equal(atmosphere.familyName, 'Vermelhos');

  // Check all 6 required CSS variables
  assert.ok(atmosphere.tokens['--app-bg-deep']);
  assert.ok(atmosphere.tokens['--app-surface-1']);
  assert.ok(atmosphere.tokens['--app-surface-2']);
  assert.ok(atmosphere.tokens['--app-border-subtle']);
  assert.ok(atmosphere.tokens['--app-border-highlight']);
  assert.ok(atmosphere.tokens['--app-text-accent']);

  // Verify WCAG AA safe contrast
  const accent = atmosphere.tokens['--app-text-accent'];
  assert.ok(getContrastRatio(accent, atmosphere.tokens['--app-bg-deep']) >= 4.5);
  assert.ok(getContrastRatio(accent, atmosphere.tokens['--app-surface-1']) >= 4.5);
  assert.ok(getContrastRatio(accent, atmosphere.tokens['--app-surface-2']) >= 4.5);
});

test('deriveClubAtmosphere derives correct palette and tokens for Santos (Alvinegro)', () => {
  const santos = {
    id: 3,
    name: 'Santos',
    primaryColor: '#f0f0f0',
    secondaryColor: '#000000'
  };

  const atmosphere = deriveClubAtmosphere(santos);

  assert.equal(atmosphere.family, 'alvinegros');
  assert.equal(atmosphere.familyName, 'Alvinegros');

  // Check all 6 required CSS variables
  assert.ok(atmosphere.tokens['--app-bg-deep']);
  assert.ok(atmosphere.tokens['--app-surface-1']);
  assert.ok(atmosphere.tokens['--app-surface-2']);
  assert.ok(atmosphere.tokens['--app-border-subtle']);
  assert.ok(atmosphere.tokens['--app-border-highlight']);
  assert.ok(atmosphere.tokens['--app-text-accent']);

  // Verify WCAG AA safe contrast
  const accent = atmosphere.tokens['--app-text-accent'];
  assert.ok(getContrastRatio(accent, atmosphere.tokens['--app-bg-deep']) >= 4.5);
  assert.ok(getContrastRatio(accent, atmosphere.tokens['--app-surface-1']) >= 4.5);
  assert.ok(getContrastRatio(accent, atmosphere.tokens['--app-surface-2']) >= 4.5);
});

test('deriveClubAtmosphere derives correct palette and tokens for Palmeiras (Verde)', () => {
  const palmeiras = {
    id: 4,
    name: 'Palmeiras',
    primaryColor: '#028b4c',
    secondaryColor: '#ffffff'
  };

  const atmosphere = deriveClubAtmosphere(palmeiras);

  assert.equal(atmosphere.family, 'verdes');
  assert.equal(atmosphere.familyName, 'Verdes');

  // Check all 6 required CSS variables
  assert.ok(atmosphere.tokens['--app-bg-deep']);
  assert.ok(atmosphere.tokens['--app-surface-1']);
  assert.ok(atmosphere.tokens['--app-surface-2']);
  assert.ok(atmosphere.tokens['--app-border-subtle']);
  assert.ok(atmosphere.tokens['--app-border-highlight']);
  assert.ok(atmosphere.tokens['--app-text-accent']);

  // Verify WCAG AA safe contrast
  const accent = atmosphere.tokens['--app-text-accent'];
  assert.ok(getContrastRatio(accent, atmosphere.tokens['--app-bg-deep']) >= 4.5);
  assert.ok(getContrastRatio(accent, atmosphere.tokens['--app-surface-1']) >= 4.5);
  assert.ok(getContrastRatio(accent, atmosphere.tokens['--app-surface-2']) >= 4.5);
});

test('deriveClubAtmosphere derives correct palette for Dourados family', () => {
  const goldClub = {
    id: 5,
    name: 'Criciúma',
    primaryColor: '#ffd700',
    secondaryColor: '#000000'
  };

  const atmosphere = deriveClubAtmosphere(goldClub);

  assert.equal(atmosphere.family, 'dourados');
  assert.equal(atmosphere.familyName, 'Dourados');

  const accent = atmosphere.tokens['--app-text-accent'];
  assert.ok(getContrastRatio(accent, atmosphere.tokens['--app-bg-deep']) >= 4.5);
  assert.ok(getContrastRatio(accent, atmosphere.tokens['--app-surface-1']) >= 4.5);
  assert.ok(getContrastRatio(accent, atmosphere.tokens['--app-surface-2']) >= 4.5);
});

test('deriveClubAtmosphere handles null/undefined club and invalid color fallbacks gracefully', () => {
  const atmosphereNull = deriveClubAtmosphere(null);
  assert.equal(atmosphereNull.family, 'verdes');
  assert.ok(atmosphereNull.tokens['--app-bg-deep']);
  assert.ok(atmosphereNull.tokens['--app-text-accent']);

  const atmosphereInvalid = deriveClubAtmosphere({
    id: 99,
    name: 'Invalid FC',
    primaryColor: 'not-hex',
    secondaryColor: ''
  });
  assert.equal(atmosphereInvalid.family, 'verdes');
  assert.ok(atmosphereInvalid.tokens['--app-border-subtle']);
  assert.ok(atmosphereInvalid.tokens['--app-border-highlight']);
});

test('all 5 family base palettes have valid WCAG AA contrast for default textAccent', () => {
  for (const [key, palette] of Object.entries(FAMILY_BASE_PALETTES)) {
    const crBg = getContrastRatio(palette.textAccent, palette.bgDeep);
    const crS1 = getContrastRatio(palette.textAccent, palette.surface1);
    const crS2 = getContrastRatio(palette.textAccent, palette.surface2);

    assert.ok(crBg >= 4.5, `${key} base textAccent must have >= 4.5:1 on bgDeep (got ${crBg})`);
    assert.ok(crS1 >= 4.5, `${key} base textAccent must have >= 4.5:1 on surface1 (got ${crS1})`);
    assert.ok(crS2 >= 4.5, `${key} base textAccent must have >= 4.5:1 on surface2 (got ${crS2})`);
  }
});
