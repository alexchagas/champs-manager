// Sprite Atlas Manager for Champs Manager
// Supports SVG viewBox rendering over WebP texture atlases for instant, crisp crest displays.

export type RegionKey = 'brazil' | 'europe_top' | 'conmebol' | 'world_rest';

export interface MiniSpriteInfo {
  x: number;
  y: number;
  atlasUrl: string;
  sheetWidth: number;
  sheetHeight: number;
}

export interface NormalSpriteInfo {
  region: RegionKey;
  x: number;
  y: number;
  atlasUrl: string;
  sheetWidth: number;
  sheetHeight: number;
}

const REGION_DIMENSIONS: Record<RegionKey, { w: number; h: number }> = {
  brazil: { w: 2040, h: 1980 },
  europe_top: { w: 2040, h: 1380 },
  conmebol: { w: 2040, h: 780 },
  world_rest: { w: 2040, h: 11700 },
};

const MINI_DIMENSIONS = { w: 2034, h: 1350 };

let miniMap: Record<string, [number, number]> | null = null;
let normalMap: Record<string, [RegionKey, number, number]> | null = null;
const listeners = new Set<() => void>();

let initStarted = false;

export function initSpriteMaps() {
  if (initStarted || typeof window === 'undefined') return;
  initStarted = true;

  // 1. Fetch Mini Atlas Map
  fetch('/sprites/mini_crests_map.json')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data) {
        miniMap = data;
        listeners.forEach((cb) => cb());
      }
    })
    .catch(() => {});

  // 2. Fetch Normal Atlas Map
  fetch('/sprites/crests_map.json')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data) {
        normalMap = data;
        listeners.forEach((cb) => cb());
      }
    })
    .catch(() => {});

  // 3. Smart Preload Priority Atlases
  preloadPriorityAtlases();
}

/** Preloads primary WebP textures into browser image cache during splash / idle */
export function preloadPriorityAtlases() {
  if (typeof window === 'undefined') return;

  const preloads = [
    '/sprites/mini_crests_global.webp',
    '/sprites/crests_brazil.webp',
    '/sprites/crests_europe_top.webp',
  ];

  preloads.forEach((url) => {
    const img = new Image();
    img.src = url;
  });
}

export function subscribeSpriteMaps(callback: () => void): () => void {
  listeners.add(callback);
  if (!initStarted) {
    initSpriteMaps();
  }
  return () => {
    listeners.delete(callback);
  };
}

export function getMiniSprite(slug: string): MiniSpriteInfo | null {
  if (!miniMap || !slug) return null;
  const coords = miniMap[slug];
  if (!coords) return null;

  return {
    x: coords[0],
    y: coords[1],
    atlasUrl: '/sprites/mini_crests_global.webp',
    sheetWidth: MINI_DIMENSIONS.w,
    sheetHeight: MINI_DIMENSIONS.h,
  };
}

export function getNormalSprite(slug: string): NormalSpriteInfo | null {
  if (!normalMap || !slug) return null;
  const info = normalMap[slug];
  if (!info) return null;

  const region = info[0];
  const dims = REGION_DIMENSIONS[region] || { w: 2040, h: 2040 };

  return {
    region,
    x: info[1],
    y: info[2],
    atlasUrl: `/sprites/crests_${region}.webp`,
    sheetWidth: dims.w,
    sheetHeight: dims.h,
  };
}

// Auto-initialize when client loads
if (typeof window !== 'undefined') {
  initSpriteMaps();
}
