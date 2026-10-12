/* tslint:disable */
/* eslint-disable */

export class WasmCareerEngine {
    free(): void;
    [Symbol.dispose](): void;
    accept_ai_offer(offer_id: number): string;
    advance_to_next_round(): string;
    auto_select_best_lineup(club_id: number, formation_str?: string | null): string;
    buy_player(player_id: number, offer_fee: number): string;
    export_save_json(): string;
    generate_ai_offers(): string;
    generate_ai_offers_internal(): number;
    get_free_agents(): string;
    get_state_json(): string;
    import_save_json(json_str: string): void;
    constructor(state_json: string, seed?: number | null);
    play_current_round(user_score_home?: number | null, user_score_away?: number | null, user_events_json?: string | null): string;
    reject_ai_offer(offer_id: number): string;
    release_player(player_id: number): string;
    renew_contract(player_id: number, years: number, new_salary: number): string;
    search_players(filter_json: string): string;
    sign_free_agent(player_id: number, years: number, offered_salary?: number | null): string;
    swap_players(club_id: number, id_a: number, id_b: number): string;
    toggle_starter(club_id: number, player_id: number): string;
    update_tactics(club_id: number, tactics_json: string): string;
}

export function wasm_auto_select_best_lineup(squad_json: string, formation_str: string): string;

export function wasm_calculate_asking_price(market_value: number, age: number): number;

export function wasm_calculate_demanded_salary(salary: number, market_value: number): number;

/**
 * Stateless JSON commands keep the serializable career as the sole authority.
 */
export function wasm_match_command(state_json: string, command_json: string): string;

export function wasm_simulate_match(home_club_json: string, away_club_json: string, seed?: number | null): string;

export function wasm_sort_standings(standings_json: string): string;

export function wasm_version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_wasmcareerengine_free: (a: number, b: number) => void;
    readonly wasm_auto_select_best_lineup: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly wasm_calculate_asking_price: (a: number, b: number) => number;
    readonly wasm_calculate_demanded_salary: (a: number, b: number) => number;
    readonly wasm_match_command: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly wasm_simulate_match: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly wasm_sort_standings: (a: number, b: number, c: number) => void;
    readonly wasm_version: (a: number) => void;
    readonly wasmcareerengine_accept_ai_offer: (a: number, b: number, c: number) => void;
    readonly wasmcareerengine_advance_to_next_round: (a: number, b: number) => void;
    readonly wasmcareerengine_auto_select_best_lineup: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly wasmcareerengine_buy_player: (a: number, b: number, c: number, d: number) => void;
    readonly wasmcareerengine_export_save_json: (a: number, b: number) => void;
    readonly wasmcareerengine_generate_ai_offers: (a: number, b: number) => void;
    readonly wasmcareerengine_generate_ai_offers_internal: (a: number) => number;
    readonly wasmcareerengine_get_free_agents: (a: number, b: number) => void;
    readonly wasmcareerengine_get_state_json: (a: number, b: number) => void;
    readonly wasmcareerengine_import_save_json: (a: number, b: number, c: number, d: number) => void;
    readonly wasmcareerengine_new: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly wasmcareerengine_play_current_round: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly wasmcareerengine_reject_ai_offer: (a: number, b: number, c: number) => void;
    readonly wasmcareerengine_release_player: (a: number, b: number, c: number) => void;
    readonly wasmcareerengine_renew_contract: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly wasmcareerengine_search_players: (a: number, b: number, c: number, d: number) => void;
    readonly wasmcareerengine_sign_free_agent: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly wasmcareerengine_swap_players: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly wasmcareerengine_toggle_starter: (a: number, b: number, c: number, d: number) => void;
    readonly wasmcareerengine_update_tactics: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
