import type { Club } from '../types';
import { applyClubEdits } from './teamsDatabase';

const STORAGE_KEY = 'champs-manager-club-edits-v1';

export function loadClubEdits(): Club[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) as Club[] : [];
  } catch {
    return [];
  }
}

const isInstalledDesktop = () => !import.meta.env.DEV && '__TAURI_INTERNALS__' in window;

export function applySavedClubEdits(): void {
  if (!isInstalledDesktop()) applyClubEdits(loadClubEdits());
}

export async function loadDesktopClubEdits(): Promise<void> {
  if (!isInstalledDesktop()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  const clubs = await invoke<Club[]>('load_club_edits');
  applyClubEdits(clubs);
}

export async function saveClubEdits(changedClubs: Club[]): Promise<void> {
  // The development server and desktop app write both database files.
  if (import.meta.env.DEV) {
    const response = await fetch('/api/editor/clubs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubs: changedClubs }),
    });
    if (!response.ok) throw new Error(await response.text());
  } else if ('__TAURI_INTERNALS__' in window) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('save_club_edits', { clubs: changedClubs });
  }

  if (!isInstalledDesktop()) {
    const prior = new Map(loadClubEdits().map((club) => [club.id, club]));
    changedClubs.forEach((club) => prior.set(club.id, club));
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...prior.values()]));
  }
  applyClubEdits(changedClubs);
}
