import type { GameState, SaveGameSlot } from '../types/index.ts';
import { addBreadcrumb, captureError } from '../observability/sentry';

const DB_NAME = 'ChampsManagerDB';
const DB_VERSION = 1;
const SAVES_STORE = 'saves';
const ACTIVE_STORE = 'active_game';

const LOCAL_STORAGE_SAVES_KEY = 'champs_manager_saves';
const LOCAL_STORAGE_CURRENT_KEY = 'champs_manager_current_game';

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SAVES_STORE)) {
        db.createObjectStore(SAVES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(ACTIVE_STORE)) {
        db.createObjectStore(ACTIVE_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

let activeWriteQueue: Promise<void> = Promise.resolve();
export async function saveActiveGameToStorage(state: GameState): Promise<void> {
  // Mirror immediately so a reload cannot read an older asynchronous IndexedDB write.
  let mirrored = false;
  try { localStorage.setItem(LOCAL_STORAGE_CURRENT_KEY, JSON.stringify(state)); mirrored = true; } catch { try { localStorage.removeItem(LOCAL_STORAGE_CURRENT_KEY); } catch {} }
  const write = activeWriteQueue.catch(() => {}).then(async () => {
    const db = await openIndexedDB();
    try {
      await new Promise<void>((resolve,reject) => {
        const tx = db.transaction(ACTIVE_STORE,'readwrite');
        tx.objectStore(ACTIVE_STORE).put({key:'current',state});
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error || new Error('Falha na transação do save.'));
      });
    } finally { db.close(); }
  });
  activeWriteQueue = write;
  try {
    await write;
    addBreadcrumb('Saved active game to storage', 'storage', {
      round: state.currentRound,
      season: state.seasonYear,
    });
  } catch (error) {
    if (!mirrored) {
      captureError(error, { context: 'saveActiveGameToStorage' });
      throw error;
    }
  }
}

export async function loadActiveGameFromStorage(): Promise<GameState | null> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CURRENT_KEY);
    if (raw) return JSON.parse(raw) as GameState;
  } catch { /* Fall back to the last completed IndexedDB transaction. */ }
  // Try IndexedDB
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(ACTIVE_STORE, 'readonly');
    const store = tx.objectStore(ACTIVE_STORE);
    const result = await new Promise<any>((resolve, reject) => {
      const req = store.get('current');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (result && result.state) {
      return result.state as GameState;
    }
  } catch (e) {
    // Fall back to LocalStorage
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CURRENT_KEY);
    if (raw) {
      return JSON.parse(raw) as GameState;
    }
  } catch (e) {
    console.error('Error parsing LocalStorage active game:', e);
  }

  return null;
}

export async function saveGameSlotToStorage(slot: SaveGameSlot, state: GameState): Promise<void> {
  let saved = false;
  let lastError: any = null;

  // 1. IndexedDB
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(SAVES_STORE, 'readwrite');
    const store = tx.objectStore(SAVES_STORE);
    await new Promise<void>((resolve, reject) => {
      const req = store.put({ id: slot.id, slot, state });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
    });
    saved = true;
  } catch (e: any) {
    if (e?.message !== 'IndexedDB not supported') {
      lastError = e;
      console.warn('IndexedDB slot save error:', e);
    }
  }

  // 2. LocalStorage mirror
  try {
    const rawSlots = localStorage.getItem(LOCAL_STORAGE_SAVES_KEY);
    const slots: SaveGameSlot[] = rawSlots ? JSON.parse(rawSlots) : [];
    const updated = [slot, ...slots.filter((s) => s.id !== slot.id)];
    localStorage.setItem(LOCAL_STORAGE_SAVES_KEY, JSON.stringify(updated));
    localStorage.setItem(`champs_save_data_${slot.id}`, JSON.stringify(state));
    saved = true;
  } catch (e) {
    lastError = e;
    console.warn('LocalStorage slot save error:', e);
  }

  if (!saved && lastError) {
    throw lastError;
  }
}

export async function loadGameSlotFromStorage(slotId: string): Promise<GameState | null> {
  // 1. IndexedDB
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(SAVES_STORE, 'readonly');
    const store = tx.objectStore(SAVES_STORE);
    const result = await new Promise<any>((resolve, reject) => {
      const req = store.get(slotId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (result && result.state) {
      return result.state as GameState;
    }
  } catch (e) {
    // Try LocalStorage
  }

  try {
    const raw = localStorage.getItem(`champs_save_data_${slotId}`);
    if (raw) {
      return JSON.parse(raw) as GameState;
    }
  } catch (e) {
    console.error('Error reading save slot from LocalStorage:', e);
  }

  return null;
}

export async function deleteGameSlotFromStorage(slotId: string): Promise<void> {
  // 1. IndexedDB
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(SAVES_STORE, 'readwrite');
    tx.objectStore(SAVES_STORE).delete(slotId);
  } catch (e) {
    console.warn('IndexedDB slot deletion error:', e);
  }

  // 2. LocalStorage
  try {
    const rawSlots = localStorage.getItem(LOCAL_STORAGE_SAVES_KEY);
    if (rawSlots) {
      const slots: SaveGameSlot[] = JSON.parse(rawSlots);
      const updated = slots.filter((s) => s.id !== slotId);
      localStorage.setItem(LOCAL_STORAGE_SAVES_KEY, JSON.stringify(updated));
    }
    localStorage.removeItem(`champs_save_data_${slotId}`);
  } catch (e) {
    console.warn('LocalStorage slot deletion error:', e);
  }
}

export async function listAllSaveSlots(): Promise<SaveGameSlot[]> {
  // Try IndexedDB first
  try {
    const db = await openIndexedDB();
    const tx = db.transaction(SAVES_STORE, 'readonly');
    const store = tx.objectStore(SAVES_STORE);
    const results = await new Promise<any[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (results && results.length > 0) {
      return results.map((r) => r.slot as SaveGameSlot);
    }
  } catch (e) {
    // Fall back to LocalStorage
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SAVES_KEY);
    if (raw) {
      return JSON.parse(raw) as SaveGameSlot[];
    }
  } catch (e) {
    console.error('Error reading slots from LocalStorage:', e);
  }

  return [];
}
