/**
 * Centralized club color theming utility for Champs Manager.
 * Derives accessible, dark-mode-optimized UI tokens from club primary and secondary colors.
 */

export interface ClubThemeTokens {
  /** Normalized primary hex (e.g. #ff3333) */
  primary: string;
  /** Normalized secondary hex (e.g. #000000) */
  secondary: string;
  /**
   * Primary color adjusted for dark mode surfaces.
   * Guarantees sufficient luminance and visibility against dark UI backgrounds (#09130f - #12231b).
   */
  primaryAccent: string;
  /**
   * Secondary color adjusted for dark mode surfaces.
   */
  secondaryAccent: string;
  /** High-contrast text color when placed directly on top of primaryAccent */
  onPrimaryAccent: string;
  /** High-contrast text color when placed directly on top of secondaryAccent */
  onSecondaryAccent: string;
  /**
   * Translucent background tint based on primary color (e.g. rgba(r, g, b, 0.12))
   */
  subtleBg: string;
  /**
   * Translucent border tint based on primary color (e.g. rgba(r, g, b, 0.28))
   */
  subtleBorder: string;
  /**
   * A kit-inspired dual-color gradient strip (e.g. 50% primary, 50% secondary)
   */
  stripeGradient: string;
  /**
   * Subtle smooth horizontal gradient from primary to transparent
   */
  fadeGradient: string;
  /**
   * True if the club's primary color is predominantly dark (lightness < 0.35)
   */
  isPrimaryDark: boolean;
  /**
   * True if the club's primary color is predominantly light (lightness > 0.8)
   */
  isPrimaryLight: boolean;
}

export type AtmosphereFamily = 'azuis' | 'vermelhos' | 'alvinegros' | 'verdes' | 'dourados';
export type AtmosphereFamilyName = 'Azuis' | 'Vermelhos' | 'Alvinegros' | 'Verdes' | 'Dourados';

export interface ClubAtmosphereTokens {
  /** Family classification */
  family: AtmosphereFamily;
  /** Capitalized family name in Portuguese */
  familyName: AtmosphereFamilyName;
  /** Normalized club primary color */
  primaryColor: string;
  /** Normalized club secondary color */
  secondaryColor: string;
  /** Atmospheric deepest background */
  bgDeep: string;
  /** Atmospheric primary panel/header/sidebar surface */
  surface1: string;
  /** Atmospheric elevated card/tab surface */
  surface2: string;
  /** Atmospheric subtle border */
  borderSubtle: string;
  /** Atmospheric highlighted border */
  borderHighlight: string;
  /** Atmospheric WCAG AA/AAA compliant text accent */
  textAccent: string;
  /** Map of CSS variable names to hex values (tokens alias) */
  tokens: {
    '--app-bg-deep': string;
    '--app-surface-1': string;
    '--app-surface-2': string;
    '--app-border-subtle': string;
    '--app-border-highlight': string;
    '--app-text-accent': string;
    [key: string]: string;
  };
  /** Map of CSS variable names to hex values */
  cssVariables: {
    '--app-bg-deep': string;
    '--app-surface-1': string;
    '--app-surface-2': string;
    '--app-border-subtle': string;
    '--app-border-highlight': string;
    '--app-text-accent': string;
    [key: string]: string;
  };
  /** CSS inline style object suitable for style={...} */
  style: Record<string, string>;
}

const DEFAULT_PRIMARY = '#10B981'; // Emerald 500
const DEFAULT_SECONDARY = '#FFFFFF';


/**
 * Validates and normalizes any color string to a 6-character uppercase hex code (#RRGGBB).
 * If invalid or absent, returns the provided fallback.
 */
export function normalizeHexColor(input?: string | null, fallback = DEFAULT_PRIMARY): string {
  const fb = fallback ? fallback.toUpperCase() : DEFAULT_PRIMARY;
  if (!input || typeof input !== 'string') return fb;
  const trimmed = input.trim();
  if (!trimmed.startsWith('#')) return fb;

  const raw = trimmed.slice(1);
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const r = raw[0];
    const g = raw[1];
    const b = raw[2];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw}`.toUpperCase();
  }
  return fb;
}

/**
 * Converts hex to RGB components [r, g, b] (0-255).
 */
export function hexToRgb(hex: string): [number, number, number] {
  const norm = normalizeHexColor(hex);
  const r = parseInt(norm.slice(1, 3), 16);
  const g = parseInt(norm.slice(3, 5), 16);
  const b = parseInt(norm.slice(5, 7), 16);
  return [r, g, b];
}

/**
 * Converts RGB components to Hex #RRGGBB.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Converts RGB to HSL [h (0-360), s (0-1), l (0-1)].
 */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h *= 60;
  }

  return [h, s, l];
}

/**
 * Converts HSL to RGB [r, g, b] (0-255).
 */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h <= 360) {
    r = c; g = 0; b = x;
  }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

/**
 * Computes standard WCAG relative luminance (0.0 to 1.0).
 */
export function getRelativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const transform = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
}

/**
 * Computes WCAG contrast ratio between two colors (1 to 21).
 */
export function getContrastRatio(colorA: string, colorB: string): number {
  const l1 = getRelativeLuminance(colorA);
  const l2 = getRelativeLuminance(colorB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Adjusts a hex color for dark mode UI backgrounds (#09130F - #12231B).
 * If the color has very low relative luminance (< 0.06, e.g. pure black or deep navy),
 * it is adjusted so that borders, accents, and badges remain clearly discernible.
 */
export function adjustColorForDarkSurface(hex: string): string {
  const normalized = normalizeHexColor(hex);
  const lum = getRelativeLuminance(normalized);

  // If luminance is high enough to be well distinguished on dark surfaces
  if (lum >= 0.06) {
    return normalized;
  }

  const [r, g, b] = hexToRgb(normalized);
  const [h, s] = rgbToHsl(r, g, b);

  // If achromatic or near-achromatic dark (e.g. #000000, #111111)
  if (s < 0.15) {
    return '#E2E8F0'; // Return crisp neutral silver/slate
  }

  // If deeply dark colored (e.g. navy #000099, deep maroon)
  // Target a noticeable luminance by boosting lightness
  const [nr, ng, nb] = hslToRgb(h, Math.max(0.65, s), 0.65);
  return rgbToHex(nr, ng, nb);
}

/**
 * Derives comprehensive UI theme tokens for a given club.
 */
export function getClubTheme(club?: { primaryColor?: string | null; secondaryColor?: string | null } | null): ClubThemeTokens {
  const primary = normalizeHexColor(club?.primaryColor, DEFAULT_PRIMARY);
  const secondary = normalizeHexColor(club?.secondaryColor, DEFAULT_SECONDARY);

  const [pr, pg, pb] = hexToRgb(primary);
  const [, , pL] = rgbToHsl(pr, pg, pb);

  const primaryAccent = adjustColorForDarkSurface(primary);
  const secondaryAccent = adjustColorForDarkSurface(secondary);

  // Choose readable on-accent text (WCAG contrast against accent)
  const onPrimaryAccent = getContrastRatio(primaryAccent, '#FFFFFF') >= 3.0 ? '#FFFFFF' : '#0F172A';
  const onSecondaryAccent = getContrastRatio(secondaryAccent, '#FFFFFF') >= 3.0 ? '#FFFFFF' : '#0F172A';

  // Translucent colors for backgrounds and borders
  const subtleBg = `rgba(${pr}, ${pg}, ${pb}, 0.12)`;
  const subtleBorder = `rgba(${pr}, ${pg}, ${pb}, 0.32)`;

  // Kit stripe gradient (linear gradient angled at 135deg)
  const stripeGradient = `linear-gradient(135deg, ${primary} 0%, ${primary} 50%, ${secondary} 50%, ${secondary} 100%)`;
  const fadeGradient = `linear-gradient(90deg, rgba(${pr}, ${pg}, ${pb}, 0.25) 0%, rgba(${pr}, ${pg}, ${pb}, 0.0) 100%)`;

  return {
    primary,
    secondary,
    primaryAccent,
    secondaryAccent,
    onPrimaryAccent,
    onSecondaryAccent,
    subtleBg,
    subtleBorder,
    stripeGradient,
    fadeGradient,
    isPrimaryDark: pL < 0.35,
    isPrimaryLight: pL > 0.8,
  };
}

export const FAMILY_BASE_PALETTES: Record<AtmosphereFamily, {
  name: AtmosphereFamilyName;
  bgDeep: string;
  surface1: string;
  surface2: string;
  borderSubtle: string;
  borderHighlight: string;
  textAccent: string;
}> = {
  azuis: {
    name: 'Azuis',
    bgDeep: '#08101d',
    surface1: '#0d1a2d',
    surface2: '#132640',
    borderSubtle: '#1e385c',
    borderHighlight: '#2d558a',
    textAccent: '#60a5fa',
  },
  vermelhos: {
    name: 'Vermelhos',
    bgDeep: '#14090b',
    surface1: '#1d0e11',
    surface2: '#2a1418',
    borderSubtle: '#4a1f26',
    borderHighlight: '#702d38',
    textAccent: '#f87171',
  },
  alvinegros: {
    name: 'Alvinegros',
    bgDeep: '#090b0e',
    surface1: '#111419',
    surface2: '#1a1f26',
    borderSubtle: '#2b333e',
    borderHighlight: '#424e5f',
    textAccent: '#e2e8f0',
  },
  verdes: {
    name: 'Verdes',
    bgDeep: '#08140e',
    surface1: '#0e2017',
    surface2: '#142e21',
    borderSubtle: '#1f4532',
    borderHighlight: '#2d6247',
    textAccent: '#34d399',
  },
  dourados: {
    name: 'Dourados',
    bgDeep: '#141007',
    surface1: '#1d180c',
    surface2: '#2b2312',
    borderSubtle: '#493c20',
    borderHighlight: '#705c31',
    textAccent: '#fbbf24',
  },
};

/**
 * Detects chromatic family from primary and secondary colors:
 * Azuis, Vermelhos, Alvinegros, Verdes, Dourados.
 */
export function detectAtmosphereFamily(primaryHex: string, secondaryHex?: string): AtmosphereFamily {
  const normPrimary = normalizeHexColor(primaryHex, DEFAULT_PRIMARY);
  const normSecondary = normalizeHexColor(secondaryHex, DEFAULT_SECONDARY);

  const [pr, pg, pb] = hexToRgb(normPrimary);
  const [ph, ps, pl] = rgbToHsl(pr, pg, pb);

  const [sr, sg, sb] = hexToRgb(normSecondary);
  const [sh, ss, sl] = rgbToHsl(sr, sg, sb);

  const isPrimaryAchromatic = ps < 0.18 || pl < 0.05 || pl > 0.94;
  const isSecondaryAchromatic = ss < 0.18 || sl < 0.05 || sl > 0.94;

  if (isPrimaryAchromatic && isSecondaryAchromatic) {
    return 'alvinegros';
  }

  // If primary is achromatic (e.g. white or black kit), use secondary color hue
  let hue = ph;
  if (isPrimaryAchromatic && !isSecondaryAchromatic) {
    hue = sh;
  }

  // Dourados: 25 <= hue < 68 (warm gold, yellow, amber)
  if (hue >= 25 && hue < 68) {
    return 'dourados';
  }

  // Verdes: 68 <= hue < 168 (green, emerald, lime)
  if (hue >= 68 && hue < 168) {
    return 'verdes';
  }

  // Azuis: 168 <= hue < 295 (cyan, blue, navy, indigo)
  if (hue >= 168 && hue < 295) {
    return 'azuis';
  }

  // Vermelhos: hue >= 295 || hue < 25 (red, crimson, maroon, magenta-red)
  return 'vermelhos';
}

/**
 * Ensures text accent has safe WCAG contrast ratio (min 4.5:1 for AA) against all provided surfaces.
 */
export function ensureWcagContrast(accentHex: string, surfaces: string[], minContrast = 4.5): string {
  let candidate = normalizeHexColor(accentHex);
  const meetsCriteria = (c: string) => surfaces.every((s) => getContrastRatio(c, s) >= minContrast);

  if (meetsCriteria(candidate)) {
    return candidate;
  }

  const [r, g, b] = hexToRgb(candidate);
  let [h, s, l] = rgbToHsl(r, g, b);

  while (l < 0.96) {
    l = Math.min(0.96, l + 0.05);
    const [nr, ng, nb] = hslToRgb(h, Math.max(0.2, s), l);
    candidate = rgbToHex(nr, ng, nb);
    if (meetsCriteria(candidate)) {
      return candidate;
    }
  }

  return '#F8FAFC';
}

/**
 * Derives dynamic Club Atmosphere design tokens with strict WCAG contrast guarantees.
 */
export function deriveClubAtmosphere(
  club?: { primaryColor?: string | null; secondaryColor?: string | null } | null
): ClubAtmosphereTokens {
  const primary = normalizeHexColor(club?.primaryColor, DEFAULT_PRIMARY);
  const secondary = normalizeHexColor(club?.secondaryColor, DEFAULT_SECONDARY);

  const family = detectAtmosphereFamily(primary, secondary);
  const base = FAMILY_BASE_PALETTES[family];

  // Guarantee strict WCAG AA/AAA contrast on all atmospheric dark surfaces
  const safeTextAccent = ensureWcagContrast(
    base.textAccent,
    [base.bgDeep, base.surface1, base.surface2],
    4.5
  );

  const cssVariables = {
    '--app-bg-deep': base.bgDeep,
    '--app-surface-1': base.surface1,
    '--app-surface-2': base.surface2,
    '--app-border-subtle': base.borderSubtle,
    '--app-border-highlight': base.borderHighlight,
    '--app-text-accent': safeTextAccent,
    '--bg-main': base.bgDeep,
    '--bg-panel': base.surface1,
    '--bg-card': base.surface2,
    '--bg-header': base.surface1,
    '--border-color': base.borderSubtle,
    '--border-highlight': base.borderHighlight,
  };

  return {
    family,
    familyName: base.name,
    primaryColor: primary,
    secondaryColor: secondary,
    bgDeep: base.bgDeep,
    surface1: base.surface1,
    surface2: base.surface2,
    borderSubtle: base.borderSubtle,
    borderHighlight: base.borderHighlight,
    textAccent: safeTextAccent,
    tokens: cssVariables,
    cssVariables,
    style: cssVariables,
  };
}

