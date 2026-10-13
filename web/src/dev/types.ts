import type { GameState } from '../types/index.ts';

export interface BatchSimulationProgress {
  currentRound: number;
  targetRound: number;
  seasonYear: number;
  stageName: string;
  percent: number;
  message?: string;
}

export interface BatchSimulationOptions {
  /** Total number of rounds to simulate */
  targetRounds?: number;
  /** Specific calendar round number to simulate until */
  targetRoundNumber?: number;
  /** Custom predicate condition to stop simulation early */
  stopCondition?: (state: GameState) => boolean;
  /** Human-readable label for stop condition */
  stopConditionLabel?: string;
  /** Guarantee user win in knockout matches so user is not prematurely eliminated */
  forceUserWinKnockout?: boolean;
  /** Callback on each simulated round */
  onProgress?: (progress: BatchSimulationProgress) => void;
  /** Abort signal to cancel running simulation */
  signal?: AbortSignal;
}

export interface DevSnapshot {
  id: string;
  savedAt: string;
  label: string;
  state: GameState;
}

export type DevTab = 'timetravel' | 'scenarios' | 'inspector';
