import type { GameState } from '../types/index.ts';
import type { DevSnapshot } from './types.ts';

const DEV_FLAG_KEY = 'champs_dev_mode_enabled';
const DEV_SNAPSHOTS_KEY = 'champs_dev_snapshots';
const MAX_SNAPSHOTS = 5;

// In-memory snapshot cache for fast rollback without storage quota issues
let memorySnapshots: DevSnapshot[] = [];

/**
 * Checks if dev mode is enabled via environment or localStorage flag.
 */
export function isDevModeEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return localStorage.getItem(DEV_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Toggles dev mode flag in localStorage.
 */
export function setDevModeEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(DEV_FLAG_KEY, 'true');
    } else {
      localStorage.removeItem(DEV_FLAG_KEY);
    }
  } catch (err) {
    console.warn('Falha ao gravar flag do modo dev:', err);
  }
}

/**
 * Saves a pre-simulation snapshot so the user can rollback immediately.
 */
export function saveDevSnapshot(state: GameState, label = 'Snapshot Pré-Simulação'): DevSnapshot {
  const clonedState: GameState = JSON.parse(JSON.stringify(state));
  const snapshot: DevSnapshot = {
    id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    savedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    label,
    state: clonedState,
  };

  memorySnapshots.unshift(snapshot);
  if (memorySnapshots.length > MAX_SNAPSHOTS) {
    memorySnapshots = memorySnapshots.slice(0, MAX_SNAPSHOTS);
  }

  // Backup lightly to sessionStorage if small
  try {
    const summary = memorySnapshots.map(s => ({
      id: s.id,
      savedAt: s.savedAt,
      label: s.label,
    }));
    sessionStorage.setItem(DEV_SNAPSHOTS_KEY + '_meta', JSON.stringify(summary));
  } catch {
    // SessionStorage quota exceeded is safe to ignore
  }

  return snapshot;
}

/**
 * Gets the most recent snapshot for rollback.
 */
export function getLastDevSnapshot(): DevSnapshot | null {
  return memorySnapshots[0] || null;
}

/**
 * Gets all available snapshots in current session.
 */
export function getAllDevSnapshots(): DevSnapshot[] {
  return [...memorySnapshots];
}

/**
 * Clears snapshot history.
 */
export function clearDevSnapshots(): void {
  memorySnapshots = [];
  try {
    sessionStorage.removeItem(DEV_SNAPSHOTS_KEY + '_meta');
  } catch {}
}

/**
 * Exports current game state to a pretty JSON string for inspection.
 */
export function exportDevStateJson(state: GameState): string {
  return JSON.stringify(state, null, 2);
}

/**
 * Imports and validates a JSON string into GameState.
 */
export function importDevStateJson(jsonString: string): { success: boolean; state?: GameState; error?: string } {
  try {
    const parsed = JSON.parse(jsonString) as GameState;
    if (!parsed.clubs || !parsed.calendar || !parsed.userClubId) {
      return { success: false, error: 'JSON não parece ser um GameState válido do Champs Manager.' };
    }
    return { success: true, state: parsed };
  } catch (err) {
    return { success: false, error: String(err instanceof Error ? err.message : err) };
  }
}
