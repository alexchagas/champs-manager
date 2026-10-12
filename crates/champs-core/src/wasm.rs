//! WASM bindings exposing Champs Manager core engine and state manager to JS/TS.

use wasm_bindgen::prelude::*;

fn js_err(msg: impl std::fmt::Display) -> JsValue {
    #[cfg(target_arch = "wasm32")]
    {
        JsValue::from_str(&msg.to_string())
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = msg;
        JsValue::NULL
    }
}
use serde::{Deserialize, Serialize};
use champs_sim::{
    Attributes, MatchEngine, Player as SimPlayer, Randoms, Team as SimTeam,
};
use crate::market::{
    calculate_asking_price, calculate_demanded_salary, MAX_CONTRACT_YEARS, MIN_SQUAD,
};
use crate::club::MAX_SQUAD;

#[wasm_bindgen]
pub fn wasm_version() -> String {
    format!("Champs Manager WASM Engine v{}", env!("CARGO_PKG_VERSION"))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebPlayer {
    #[serde(flatten, default)]
    pub extra: std::collections::BTreeMap<String, serde_json::Value>,
    pub id: u32,
    pub name: String,
    pub age: u8,
    pub position: String,
    pub foot: String,
    pub strength: u8,
    pub energy: u8,
    pub salary: u32,
    pub market_value: u64,
    pub is_starter: bool,
    pub is_star: bool,
    pub is_world_top: bool,
    pub skill1: String,
    pub skill2: String,
    pub goals: u32,
    pub assists: u32,
    pub yellow_cards: u32,
    pub red_cards: u32,
    pub injured: bool,
    pub suspended: bool,
    #[serde(default = "default_contract_years")]
    pub contract_years: u8,
}

fn default_contract_years() -> u8 {
    3
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebTactics {
    pub formation: String,
    pub mentality: String,
    pub penalty_taker_id: u32,
    pub free_kick_taker_id: u32,
    pub corner_taker_id: u32,
    pub captain_id: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebClub {
    #[serde(flatten, default)]
    pub extra: std::collections::BTreeMap<String, serde_json::Value>,
    pub id: u32,
    pub name: String,
    pub stadium: String,
    pub capacity: u32,
    pub coach: String,
    pub primary_color: String,
    pub secondary_color: String,
    pub balance: i64,
    pub ticket_price: u32,
    pub squad: Vec<WebPlayer>,
    #[serde(default)]
    pub named_substitute_ids: Option<Vec<u32>>,
    pub tactics: WebTactics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebStandingRow {
    pub club_id: u32,
    pub club_name: String,
    pub primary_color: String,
    pub points: u32,
    pub played: u32,
    pub won: u32,
    pub drawn: u32,
    pub lost: u32,
    pub goals_for: u32,
    pub goals_against: u32,
    pub goal_diff: i32,
    pub form: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebMatchEvent {
    #[serde(flatten, default)]
    pub extra: std::collections::BTreeMap<String, serde_json::Value>,
    pub id: String,
    pub minute: u32,
    #[serde(rename = "type")]
    pub event_type: String,
    pub team: String, // "home" | "away"
    pub title: Option<String>,
    pub description: String,
    pub scorer_name: Option<String>,
    pub assist_name: Option<String>,
    pub scorer_id: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebMatchFixture {
    pub id: u32,
    pub round: u32,
    #[serde(default)]
    pub date: Option<String>,
    #[serde(default)]
    pub fixture_date_index: Option<u32>,
    #[serde(default)]
    pub competition_round: Option<String>,
    #[serde(default)]
    pub pending_qualification: bool,
    pub home_club_id: u32,
    pub away_club_id: u32,
    pub home_score: Option<u32>,
    pub away_score: Option<u32>,
    pub played: bool,
    pub events: Option<Vec<WebMatchEvent>>,
    #[serde(default)]
    pub competition_type: Option<String>,
    #[serde(default)]
    pub competition_name: Option<String>,
    #[serde(default)]
    pub stage: Option<String>,
    #[serde(default)]
    pub day_of_week: Option<String>,
    #[serde(default)]
    pub leg: Option<u8>,
    #[serde(default)]
    pub aggregate_score: Option<Vec<u32>>,
    #[serde(default)]
    pub penalty_score: Option<Vec<u32>>,
    #[serde(default)]
    pub match_rules: Option<champs_sim::session::MatchRules>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebGameOptions {
    #[serde(flatten, default)]
    pub extra: std::collections::BTreeMap<String, serde_json::Value>,
    pub sound_enabled: bool,
    pub sound_volume: f64,
    pub sim_speed: u8,
    pub auto_pause_on_goal: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebTransferOffer {
    #[serde(flatten, default)]
    pub extra: std::collections::BTreeMap<String, serde_json::Value>,
    pub id: u32,
    pub from_club_id: u32,
    pub from_club_name: String,
    pub to_club_id: u32,
    pub player_id: u32,
    pub player_name: String,
    pub player_position: String,
    pub player_strength: u8,
    pub fee: u64,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WebMarketFilter {
    pub position: Option<String>,
    pub min_strength: Option<u8>,
    pub max_strength: Option<u8>,
    pub min_age: Option<u8>,
    pub max_age: Option<u8>,
    pub max_value: Option<u64>,
    pub name_query: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebMarketSearchResult {
    pub player: WebPlayer,
    pub club_id: u32,
    pub club_name: String,
    pub asking_price: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebGameState {
    #[serde(flatten, default)]
    pub extra: std::collections::BTreeMap<String, serde_json::Value>,
    pub user_club_id: u32,
    pub manager_name: String,
    pub season_year: u32,
    pub current_round: u32,
    pub clubs: Vec<WebClub>,
    pub calendar: Vec<WebMatchFixture>,
    pub standings: Vec<WebStandingRow>,
    #[serde(default)]
    pub standings_estadual: Vec<WebStandingRow>,
    #[serde(default)]
    pub standings_nacional: Vec<WebStandingRow>,
    #[serde(default)]
    pub standings_continental: Vec<WebStandingRow>,
    pub options: WebGameOptions,
    pub active_screen: String,
    pub active_match_fixture_id: Option<u32>,
    #[serde(default)]
    pub active_match: Option<champs_sim::session::ActiveMatchSession>,
    #[serde(default)]
    pub free_agents: Vec<WebPlayer>,
    #[serde(default)]
    pub transfer_offers: Vec<WebTransferOffer>,
    #[serde(default)]
    pub current_semester: Option<u8>,
    #[serde(default)]
    pub league_name: Option<String>,
    #[serde(default)]
    pub division_name: Option<String>,
    #[serde(default)]
    pub country_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebSimulatedMatchResult {
    pub home_score: u32,
    pub away_score: u32,
    pub home_shots: u32,
    pub away_shots: u32,
    pub home_shots_on_target: u32,
    pub away_shots_on_target: u32,
    pub home_possession: u32,
    pub away_possession: u32,
    pub home_fouls: u32,
    pub away_fouls: u32,
    pub home_corners: u32,
    pub away_corners: u32,
    pub home_yellow_cards: u32,
    pub away_yellow_cards: u32,
    pub home_red_cards: u32,
    pub away_red_cards: u32,
    pub events: Vec<WebMatchEvent>,
}

impl WebClub {
    fn to_sim_team(&self) -> SimTeam {
        let starters: Vec<&WebPlayer> = {
            let s: Vec<&WebPlayer> = self.squad.iter().filter(|p| p.is_starter && !p.injured && !p.suspended).collect();
            if s.len() == 11 {
                s
            } else {
                self.squad.iter().take(11).collect()
            }
        };

        let mut sim_players = Vec::with_capacity(starters.len());
        for p in starters {
            let role_code = match p.position.as_str() {
                "GOL" => 1,
                "ZAG" => 2,
                "LAT" => 4,
                "VOL" => 9,
                "MEI" => 14,
                "ATA" => 20,
                _ => 14,
            };
            let level = (p.strength as f64) * ((p.energy as f64) / 100.0);
            let attrs = Attributes::uniform(level.max(10.0));
            let penalized = p.energy < 50;
            let mut sp = SimPlayer::new(p.id, role_code, attrs);
            sp.name = p.name.clone();
            sp.penalized = penalized;
            sim_players.push(sp);
        }

        SimTeam::new(&self.name, sim_players)
    }
}

pub fn simulate_match_internal(
    home: &WebClub,
    away: &WebClub,
    seed: u64,
) -> WebSimulatedMatchResult {
    let mut rng = Randoms::new(seed);
    let home_sim = home.to_sim_team();
    let away_sim = away.to_sim_team();

    let mut engine = MatchEngine::new(&home_sim, &away_sim, false, seed);
    let raw_sim = engine.simulate_full_match();

    let mut events: Vec<WebMatchEvent> = Vec::new();

    let home_mid = home_sim.midfield();
    let away_mid = away_sim.midfield();
    let total_mid = (home_mid + away_mid).max(1.0);
    let home_possession = ((home_mid / total_mid) * 100.0).round().clamp(35.0, 65.0) as u32;
    let away_possession = 100 - home_possession;

    let fouls = [
        (10 + rng.next_int(8)) as u32,
        (10 + rng.next_int(8)) as u32,
    ];
    let corners = [
        (2 + rng.next_int(6)) as u32,
        (2 + rng.next_int(6)) as u32,
    ];
    let mut yellows = [0u32, 0u32];
    let reds = [0u32, 0u32];

    // Process goal events
    for (i, ge) in raw_sim.events.iter().enumerate() {
        let is_home = ge.team == 0;
        let side_str = if is_home { "home" } else { "away" };
        let scoring_club = if is_home { home } else { away };
        let scorer = scoring_club.squad.iter().find(|p| p.id == ge.scorer);
        let assist = ge.assist.and_then(|aid| scoring_club.squad.iter().find(|p| p.id == aid));

        let scorer_name = scorer.map(|p| p.name.clone()).unwrap_or_else(|| "Atacante".to_string());
        let assist_name = assist.map(|p| p.name.clone());

        let desc = match (&scorer_name, &assist_name) {
            (name, Some(ast)) => format!("GOOOOOOOL de {}! Lindo passe de {} para estufar as redes!", name, ast),
            (name, None) => format!("GOOOOOOOL de {}! Finalização certeira sem chances para o goleiro!", name),
        };

        events.push(WebMatchEvent {
            extra: Default::default(),
            id: format!("event-goal-{}", i),
            minute: ge.minute,
            event_type: "goal".to_string(),
            team: side_str.to_string(),
            title: Some(format!("GOL do {}!", scoring_club.name)),
            description: desc,
            scorer_name: Some(scorer_name),
            assist_name,
            scorer_id: Some(ge.scorer),
        });
    }

    // Add cards and key moments
    for side in 0..2 {
        let team_str = if side == 0 { "home" } else { "away" };
        let club = if side == 0 { home } else { away };
        let rolls = 1 + rng.next_int(3);
        for _ in 0..rolls {
            if rng.next_f64() < 0.45 {
                let minute = 5 + rng.next_int(80);
                yellows[side] += 1;
                let player = &club.squad[rng.next_int(club.squad.len().max(1) as u32) as usize];
                events.push(WebMatchEvent {
            extra: Default::default(),
                    id: format!("event-yellow-{}-{}", side, minute),
                    minute,
                    event_type: "yellow_card".to_string(),
                    team: team_str.to_string(),
                    title: Some("Cartão Amarelo".to_string()),
                    description: format!("Cartão amarelo para {} por falta tática.", player.name),
                    scorer_name: None,
                    assist_name: None,
                    scorer_id: None,
                });
            }
        }
    }

    // Halftime & Fulltime events
    events.push(WebMatchEvent {
            extra: Default::default(),
        id: "event-halftime".to_string(),
        minute: 45,
        event_type: "halftime".to_string(),
        team: "home".to_string(),
        title: Some("Intervalo".to_string()),
        description: "Fim do primeiro tempo! Equipes vão para o vestiário.".to_string(),
        scorer_name: None,
        assist_name: None,
        scorer_id: None,
    });

    events.push(WebMatchEvent {
            extra: Default::default(),
        id: "event-fulltime".to_string(),
        minute: 90,
        event_type: "fulltime".to_string(),
        team: "home".to_string(),
        title: Some("Fim de Jogo".to_string()),
        description: format!("Apito final! Placar final: {} {} x {} {}.", home.name, raw_sim.goals[0], raw_sim.goals[1], away.name),
        scorer_name: None,
        assist_name: None,
        scorer_id: None,
    });

    // Sort events chronologically
    events.sort_by_key(|e| e.minute);

    let home_shots = raw_sim.shots[0].max(raw_sim.goals[0]);
    let away_shots = raw_sim.shots[1].max(raw_sim.goals[1]);
    let home_sot = raw_sim.goals[0] + (home_shots.saturating_sub(raw_sim.goals[0]) / 3).max(1);
    let away_sot = raw_sim.goals[1] + (away_shots.saturating_sub(raw_sim.goals[1]) / 3).max(1);

    WebSimulatedMatchResult {
        home_score: raw_sim.goals[0],
        away_score: raw_sim.goals[1],
        home_shots,
        away_shots,
        home_shots_on_target: home_sot,
        away_shots_on_target: away_sot,
        home_possession,
        away_possession,
        home_fouls: fouls[0],
        away_fouls: fouls[1],
        home_corners: corners[0],
        away_corners: corners[1],
        home_yellow_cards: yellows[0],
        away_yellow_cards: yellows[1],
        home_red_cards: reds[0],
        away_red_cards: reds[1],
        events,
    }
}

pub fn sort_standings_internal(standings: &mut [WebStandingRow]) {
    standings.sort_by(|a, b| {
        if b.points != a.points {
            b.points.cmp(&a.points)
        } else if b.won != a.won {
            b.won.cmp(&a.won)
        } else if b.goal_diff != a.goal_diff {
            b.goal_diff.cmp(&a.goal_diff)
        } else if b.goals_for != a.goals_for {
            b.goals_for.cmp(&a.goals_for)
        } else {
            a.club_name.cmp(&b.club_name)
        }
    });
}

#[wasm_bindgen]
pub fn wasm_simulate_match(
    home_club_json: &str,
    away_club_json: &str,
    seed: Option<f64>,
) -> Result<String, JsValue> {
    let home: WebClub = serde_json::from_str(home_club_json)
        .map_err(|e| js_err(&format!("Invalid home club JSON: {e}")))?;
    let away: WebClub = serde_json::from_str(away_club_json)
        .map_err(|e| js_err(&format!("Invalid away club JSON: {e}")))?;

    let seed_val = seed.map(|s| s as u64).unwrap_or(12345);
    let res = simulate_match_internal(&home, &away, seed_val);
    serde_json::to_string(&res).map_err(|e| js_err(&format!("Serialization error: {e}")))
}

#[wasm_bindgen]
pub fn wasm_sort_standings(standings_json: &str) -> Result<String, JsValue> {
    let mut rows: Vec<WebStandingRow> = serde_json::from_str(standings_json)
        .map_err(|e| js_err(&format!("Invalid standings JSON: {e}")))?;
    sort_standings_internal(&mut rows);
    serde_json::to_string(&rows).map_err(|e| js_err(&format!("Serialization error: {e}")))
}

#[wasm_bindgen]
pub fn wasm_calculate_asking_price(market_value: f64, age: u8) -> f64 {
    calculate_asking_price(market_value as u64, age) as f64
}

#[wasm_bindgen]
pub fn wasm_calculate_demanded_salary(salary: u32, market_value: f64) -> u32 {
    calculate_demanded_salary(salary as u64, market_value as u64, 1.0) as u32
}

pub fn auto_select_best_lineup_web(squad: &mut [WebPlayer], formation_str: &str) -> Vec<u32> {

    if squad.len() < 11 {
        return squad.iter().map(|p| p.id).collect();
    }

    let (def_target, mid_target, fwd_target) = match formation_str {
        "4-3-3" => (4, 3, 3),
        "3-5-2" => (3, 5, 2),
        "4-5-1" => (4, 5, 1),
        "5-3-2" => (5, 3, 2),
        _ => (4, 4, 2),
    };

    for p in squad.iter_mut() {
        p.is_starter = false;
    }

    let score = |p: &WebPlayer| -> f64 {
        let avail_mult = if !p.injured && !p.suspended { 1.0 } else { 0.05 };
        let base = (p.strength as f64) * ((p.energy as f64) / 100.0);
        let tie_breaker = (p.strength as f64) * 0.01 + (p.energy as f64) * 0.001;
        (base + tie_breaker) * avail_mult
    };

    let mut gks: Vec<usize> = Vec::new();
    let mut defs: Vec<usize> = Vec::new();
    let mut mids: Vec<usize> = Vec::new();
    let mut fwds: Vec<usize> = Vec::new();

    for (i, p) in squad.iter().enumerate() {
        match p.position.as_str() {
            "GOL" => gks.push(i),
            "ZAG" | "LAT" => defs.push(i),
            "VOL" | "MEI" => mids.push(i),
            "ATA" => fwds.push(i),
            _ => mids.push(i),
        }
    }

    gks.sort_by(|&a, &b| score(&squad[b]).partial_cmp(&score(&squad[a])).unwrap());
    defs.sort_by(|&a, &b| score(&squad[b]).partial_cmp(&score(&squad[a])).unwrap());
    mids.sort_by(|&a, &b| score(&squad[b]).partial_cmp(&score(&squad[a])).unwrap());
    fwds.sort_by(|&a, &b| score(&squad[b]).partial_cmp(&score(&squad[a])).unwrap());

    let mut selected_indices: Vec<usize> = Vec::with_capacity(11);
    let mut chosen_set: std::collections::HashSet<usize> = std::collections::HashSet::with_capacity(11);

    // 1. Goleiro strictly in goal (GK never plays outfield)
    if let Some(&gk_idx) = gks.first() {
        selected_indices.push(gk_idx);
        chosen_set.insert(gk_idx);
    }

    // 2. Defensores (ZAG e LAT preenchem a defesa)
    let mut def_count = 0;
    for &d_idx in &defs {
        if def_count >= def_target {
            break;
        }
        if chosen_set.insert(d_idx) {
            selected_indices.push(d_idx);
            def_count += 1;
        }
    }

    // 3. Meias (VOL e MEI no meio)
    let mut mid_count = 0;
    for &m_idx in &mids {
        if mid_count >= mid_target {
            break;
        }
        if chosen_set.insert(m_idx) {
            selected_indices.push(m_idx);
            mid_count += 1;
        }
    }

    // 4. Atacantes (ATA no ataque)
    let mut fwd_count = 0;
    for &f_idx in &fwds {
        if fwd_count >= fwd_target {
            break;
        }
        if chosen_set.insert(f_idx) {
            selected_indices.push(f_idx);
            fwd_count += 1;
        }
    }

    // 5. Fill remaining outfield slots if shortage in a category (Goleiro NUNCA vai para zaga ou ataque)
    if selected_indices.len() < 11 {
        let mut outfield_remaining: Vec<usize> = defs
            .iter()
            .chain(mids.iter())
            .chain(fwds.iter())
            .copied()
            .filter(|idx| !chosen_set.contains(idx))
            .collect();
        outfield_remaining.sort_by(|&a, &b| score(&squad[b]).partial_cmp(&score(&squad[a])).unwrap());

        for idx in outfield_remaining {
            if selected_indices.len() >= 11 {
                break;
            }
            if chosen_set.insert(idx) {
                selected_indices.push(idx);
            }
        }
    }

    // 6. Absolute fallback if squad has fewer than 10 outfield players
    if selected_indices.len() < 11 {
        for idx in 0..squad.len() {
            if selected_indices.len() >= 11 {
                break;
            }
            if chosen_set.insert(idx) {
                selected_indices.push(idx);
            }
        }
    }

    selected_indices.truncate(11);

    for &idx in &selected_indices {
        squad[idx].is_starter = true;
    }

    let starter_ids: Vec<u32> = selected_indices.iter().map(|&idx| squad[idx].id).collect();

    // Reorder squad: starters first in tactical order, then bench
    let mut starters_list: Vec<WebPlayer> = Vec::with_capacity(11);
    let mut bench_list: Vec<WebPlayer> = Vec::with_capacity(squad.len() - 11);

    for (idx, p) in squad.iter().enumerate() {
        if !selected_indices.contains(&idx) {
            bench_list.push(p.clone());
        }
    }
    for &idx in &selected_indices {
        starters_list.push(squad[idx].clone());
    }

    bench_list.sort_by(|a, b| {
        let pos_order = |pos: &str| match pos {
            "GOL" => 0,
            "LAT" => 1,
            "ZAG" => 2,
            "VOL" => 3,
            "MEI" => 4,
            "ATA" => 5,
            _ => 6,
        };
        pos_order(&a.position)
            .cmp(&pos_order(&b.position))
            .then(score(b).partial_cmp(&score(a)).unwrap())
    });

    for (i, p) in starters_list.into_iter().chain(bench_list.into_iter()).enumerate() {
        squad[i] = p;
    }

    starter_ids
}

#[wasm_bindgen]
pub fn wasm_auto_select_best_lineup(squad_json: &str, formation_str: &str) -> Result<String, JsValue> {
    let mut squad: Vec<WebPlayer> = serde_json::from_str(squad_json)
        .map_err(|e| js_err(&format!("Invalid squad JSON: {e}")))?;
    auto_select_best_lineup_web(&mut squad, formation_str);
    serde_json::to_string(&squad).map_err(|e| js_err(&format!("Serialization error: {e}")))
}


#[wasm_bindgen]
pub struct WasmCareerEngine {
    state: WebGameState,
    seed_state: u64,
}

#[wasm_bindgen]
impl WasmCareerEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(state_json: &str, seed: Option<f64>) -> Result<WasmCareerEngine, JsValue> {
        let state: WebGameState = serde_json::from_str(state_json)
            .map_err(|e| js_err(&format!("Failed to parse GameState: {e}")))?;
        let seed_state = seed.map(|s| s as u64).unwrap_or_else(|| 42);
        let mut engine = WasmCareerEngine { state, seed_state };
        if engine.state.free_agents.is_empty() {
            engine.state.free_agents = generate_default_free_agents();
        }
        Ok(engine)
    }

    #[wasm_bindgen]
    pub fn get_state_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.state)
            .map_err(|e| js_err(&format!("Failed to serialize GameState: {e}")))
    }

    #[wasm_bindgen]
    pub fn play_current_round(
        &mut self,
        user_score_home: Option<u32>,
        user_score_away: Option<u32>,
        user_events_json: Option<String>,
    ) -> Result<String, JsValue> {
        if self.state.active_match.as_ref().is_some_and(|m| m.phase != "committed") { return Err(js_err("Use o encerramento da sessão ativa.")); }

        let current_round = self.state.current_round;
        let user_club_id = self.state.user_club_id;
        let mut rng = Randoms::new(self.seed_state);
        self.seed_state = self.seed_state.wrapping_add(1013904223);

        let user_events: Option<Vec<WebMatchEvent>> = match user_events_json {
            Some(ref json_str) if !json_str.is_empty() => serde_json::from_str(json_str).ok(),
            _ => None,
        };

        // Find matches for the current round
        let round_fixture_indices: Vec<usize> = self
            .state
            .calendar
            .iter()
            .enumerate()
            .filter(|(_, f)| f.fixture_date_index.unwrap_or(f.round) == current_round)
            .map(|(i, _)| i)
            .collect();

        for &idx in &round_fixture_indices {
            let fixture = self.state.calendar[idx].clone();
            if fixture.pending_qualification || fixture.played { continue; }
            let is_user_match = fixture.home_club_id == user_club_id || fixture.away_club_id == user_club_id;

            let (h_score, a_score, events) = if is_user_match && user_score_home.is_some() && user_score_away.is_some() {
                (
                    user_score_home.unwrap(),
                    user_score_away.unwrap(),
                    user_events.clone().unwrap_or_default(),
                )
            } else {
                let home_club = self.state.clubs.iter().find(|c| c.id == fixture.home_club_id);
                let away_club = self.state.clubs.iter().find(|c| c.id == fixture.away_club_id);

                if let (Some(h), Some(a)) = (home_club, away_club) {
                    let match_seed = self.seed_state.wrapping_add(fixture.id as u64);
                    let sim = simulate_match_internal(h, a, match_seed);
                    (sim.home_score, sim.away_score, sim.events)
                } else {
                    (0, 0, Vec::new())
                }
            };

            // Update fixture
            self.state.calendar[idx].home_score = Some(h_score);
            self.state.calendar[idx].away_score = Some(a_score);
            self.state.calendar[idx].played = true;
            self.state.calendar[idx].events = Some(events);

            // Each competition owns its table. Cup ties do not affect league tables.
            if fixture.competition_type.as_deref() == Some("copa") { continue; }
            let standings = match fixture.competition_type.as_deref() {
                Some("estadual") => &mut self.state.standings_estadual,
                Some("nacional") => &mut self.state.standings_nacional,
                Some("libertadores" | "sulamericana" | "champions") => &mut self.state.standings_continental,
                _ => &mut self.state.standings,
            };
            if let Some(home_row) = standings.iter_mut().find(|s| s.club_id == fixture.home_club_id) {
                home_row.played += 1;
                home_row.goals_for += h_score;
                home_row.goals_against += a_score;
                home_row.goal_diff = home_row.goals_for as i32 - home_row.goals_against as i32;
                if h_score > a_score {
                    home_row.won += 1;
                    home_row.points += 3;
                    home_row.form.insert(0, "V".to_string());
                } else if h_score == a_score {
                    home_row.drawn += 1;
                    home_row.points += 1;
                    home_row.form.insert(0, "E".to_string());
                } else {
                    home_row.lost += 1;
                    home_row.form.insert(0, "D".to_string());
                }
                home_row.form.truncate(5);
            }

            if let Some(away_row) = standings.iter_mut().find(|s| s.club_id == fixture.away_club_id) {
                away_row.played += 1;
                away_row.goals_for += a_score;
                away_row.goals_against += h_score;
                away_row.goal_diff = away_row.goals_for as i32 - away_row.goals_against as i32;
                if a_score > h_score {
                    away_row.won += 1;
                    away_row.points += 3;
                    away_row.form.insert(0, "V".to_string());
                } else if h_score == a_score {
                    away_row.drawn += 1;
                    away_row.points += 1;
                    away_row.form.insert(0, "E".to_string());
                } else {
                    away_row.lost += 1;
                    away_row.form.insert(0, "D".to_string());
                }
                away_row.form.truncate(5);
            }

            // Round finances are closed once by the UI career's ledger engine.
        }

        // Energy fatigue & recovery for user club
        if let Some(user_club) = self.state.clubs.iter_mut().find(|c| c.id == user_club_id) {
            for p in &mut user_club.squad {
                if p.is_starter {
                    let drain = 10 + rng.next_int(8) as u8;
                    p.energy = p.energy.saturating_sub(drain).max(45);
                } else {
                    p.energy = (p.energy + 15).min(100);
                }
            }
        }

        // Sort standings
        sort_standings_internal(&mut self.state.standings_estadual);
        sort_standings_internal(&mut self.state.standings_nacional);
        sort_standings_internal(&mut self.state.standings_continental);
        let competition = round_fixture_indices.first().and_then(|&i| self.state.calendar[i].competition_type.as_deref());
        self.state.standings = match competition {
            Some("estadual") => self.state.standings_estadual.clone(),
            Some("nacional") => self.state.standings_nacional.clone(),
            Some("libertadores" | "sulamericana" | "champions") => self.state.standings_continental.clone(),
            _ => self.state.standings.clone(),
        };
        self.state.active_screen = "round_results".to_string();

        self.get_state_json()
    }

    #[wasm_bindgen]
    pub fn advance_to_next_round(&mut self) -> Result<String, JsValue> {
        if self.state.active_match.as_ref().is_some_and(|m| m.phase != "committed") { return Err(js_err("Partida em curso: comando bloqueado.")); }

        let last_slot = self.state.calendar.iter().map(|f| f.fixture_date_index.unwrap_or(f.round)).max().unwrap_or(1);
        if self.state.current_round < last_slot {
            self.state.current_round += 1;
        }
        self.state.active_screen = "overview".to_string();
        self.get_state_json()
    }

    #[wasm_bindgen]
    pub fn update_tactics(&mut self, club_id: u32, tactics_json: &str) -> Result<String, JsValue> {
        if self.state.active_match.as_ref().is_some_and(|m| m.phase != "committed") { return Err(js_err("Partida em curso: comando bloqueado.")); }

        let tactics: WebTactics = serde_json::from_str(tactics_json)
            .map_err(|e| js_err(&format!("Invalid tactics JSON: {e}")))?;

        if let Some(club) = self.state.clubs.iter_mut().find(|c| c.id == club_id) {
            club.tactics = tactics;
        }
        self.get_state_json()
    }

    #[wasm_bindgen]
    pub fn swap_players(&mut self, club_id: u32, id_a: u32, id_b: u32) -> Result<String, JsValue> {
        if self.state.active_match.as_ref().is_some_and(|m| m.phase != "committed") { return Err(js_err("Partida em curso: comando bloqueado.")); }

        if id_a == id_b {
            return self.get_state_json();
        }
        if let Some(club) = self.state.clubs.iter_mut().find(|c| c.id == club_id) {
            let idx_a = club.squad.iter().position(|p| p.id == id_a);
            let idx_b = club.squad.iter().position(|p| p.id == id_b);
            if let (Some(a), Some(b)) = (idx_a, idx_b) {
                let temp_starter = club.squad[a].is_starter;
                club.squad[a].is_starter = club.squad[b].is_starter;
                club.squad[b].is_starter = temp_starter;
                club.squad.swap(a, b);
            }
        }
        self.get_state_json()
    }

    #[wasm_bindgen]
    pub fn toggle_starter(&mut self, club_id: u32, player_id: u32) -> Result<String, JsValue> {
        if self.state.active_match.as_ref().is_some_and(|m| m.phase != "committed") { return Err(js_err("Partida em curso: comando bloqueado.")); }

        if let Some(club) = self.state.clubs.iter_mut().find(|c| c.id == club_id) {
            if let Some(p_idx) = club.squad.iter().position(|p| p.id == player_id) {
                let is_starter = club.squad[p_idx].is_starter;
                let starters_count = club.squad.iter().filter(|p| p.is_starter).count();

                if !is_starter && starters_count >= 11 {
                    if let Some(bench_cand) = club.squad.iter().position(|p| p.is_starter) {
                        club.squad[bench_cand].is_starter = false;
                        club.squad[p_idx].is_starter = true;
                    }
                } else {
                    club.squad[p_idx].is_starter = !is_starter;
                }
            }
        }
        self.get_state_json()
    }

    #[wasm_bindgen]
    pub fn auto_select_best_lineup(
        &mut self,
        club_id: u32,
        formation_str: Option<String>,
    ) -> Result<String, JsValue> {
        if self.state.active_match.as_ref().is_some_and(|m| m.phase != "committed") { return Err(js_err("Partida em curso: comando bloqueado.")); }

        let club = self
            .state
            .clubs
            .iter_mut()
            .find(|c| c.id == club_id)
            .ok_or_else(|| js_err("Clube não encontrado."))?;

        let form = formation_str.unwrap_or_else(|| club.tactics.formation.clone());
        club.tactics.formation = form.clone();

        auto_select_best_lineup_web(&mut club.squad, &form);

        // Update set-piece takers from starters
        if let Some(captain) = club
            .squad
            .iter()
            .take(11)
            .max_by_key(|p| (p.strength as u32) * 10 + (p.age as u32))
        {
            club.tactics.captain_id = captain.id;
        }
        if let Some(penalty) = club
            .squad
            .iter()
            .take(11)
            .filter(|p| p.position == "ATA" || p.position == "MEI")
            .max_by_key(|p| p.strength)
            .or_else(|| club.squad.iter().take(11).max_by_key(|p| p.strength))
        {
            club.tactics.penalty_taker_id = penalty.id;
        }
        if let Some(free_kick) = club
            .squad
            .iter()
            .take(11)
            .filter(|p| p.position == "MEI" || p.position == "VOL" || p.position == "ATA")
            .max_by_key(|p| p.strength)
            .or_else(|| club.squad.iter().take(11).max_by_key(|p| p.strength))
        {
            club.tactics.free_kick_taker_id = free_kick.id;
        }
        if let Some(corner) = club
            .squad
            .iter()
            .take(11)
            .filter(|p| p.position == "LAT" || p.position == "MEI")
            .max_by_key(|p| p.strength)
            .or_else(|| club.squad.iter().take(11).max_by_key(|p| p.strength))
        {
            club.tactics.corner_taker_id = corner.id;
        }

        self.get_state_json()
    }


    #[wasm_bindgen]
    pub fn get_free_agents(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.state.free_agents)
            .map_err(|e| js_err(&format!("Failed to serialize free agents: {e}")))
    }

    #[wasm_bindgen]
    pub fn search_players(&self, filter_json: &str) -> Result<String, JsValue> {
        let filter: WebMarketFilter = if filter_json.trim().is_empty() {
            WebMarketFilter::default()
        } else {
            serde_json::from_str(filter_json).unwrap_or_default()
        };

        let user_id = self.state.user_club_id;
        let mut results: Vec<WebMarketSearchResult> = Vec::new();

        for club in &self.state.clubs {
            if club.id == user_id {
                continue;
            }

            for p in &club.squad {
                if let Some(ref pos) = filter.position {
                    if !pos.is_empty() && pos != "TODOS" && pos != "Todos" && &p.position != pos {
                        continue;
                    }
                }
                if let Some(min_s) = filter.min_strength {
                    if p.strength < min_s {
                        continue;
                    }
                }
                if let Some(max_s) = filter.max_strength {
                    if p.strength > max_s {
                        continue;
                    }
                }
                if let Some(min_a) = filter.min_age {
                    if p.age < min_a {
                        continue;
                    }
                }
                if let Some(max_a) = filter.max_age {
                    if p.age > max_a {
                        continue;
                    }
                }
                if let Some(max_v) = filter.max_value {
                    if p.market_value > max_v {
                        continue;
                    }
                }
                if let Some(ref query) = filter.name_query {
                    let q = query.trim().to_lowercase();
                    if !q.is_empty() && !p.name.to_lowercase().contains(&q) {
                        continue;
                    }
                }

                let asking = calculate_asking_price(p.market_value, p.age);
                results.push(WebMarketSearchResult {
                    player: p.clone(),
                    club_id: club.id,
                    club_name: club.name.clone(),
                    asking_price: asking,
                });
            }
        }

        // Sort by strength descending, then by market value
        results.sort_by(|a, b| {
            b.player.strength
                .cmp(&a.player.strength)
                .then(b.player.market_value.cmp(&a.player.market_value))
        });

        // Limit results to top 150 for responsiveness
        results.truncate(150);

        serde_json::to_string(&results)
            .map_err(|e| js_err(&format!("Failed to serialize search results: {e}")))
    }

    #[wasm_bindgen]
    pub fn buy_player(&mut self, player_id: u32, offer_fee: f64) -> Result<String, JsValue> {
        if self.state.active_match.as_ref().is_some_and(|m| m.phase != "committed") { return Err(js_err("Elenco bloqueado durante a partida.")); }

        let user_id = self.state.user_club_id;
        let fee_u64 = offer_fee.round() as u64;

        let seller_idx = self
            .state
            .clubs
            .iter()
            .position(|c| c.id != user_id && c.squad.iter().any(|p| p.id == player_id))
            .ok_or_else(|| js_err("Atleta não encontrado em nenhum clube adversário."))?;

        let seller_squad_len = self.state.clubs[seller_idx].squad.len();
        if seller_squad_len <= MIN_SQUAD {
            return Err(js_err(
                &format!("O clube vendedor não pode vender este atleta pois ficaria abaixo do limite mínimo de {} jogadores.", MIN_SQUAD)
            ));
        }

        let buyer_idx = self
            .state
            .clubs
            .iter()
            .position(|c| c.id == user_id)
            .ok_or_else(|| js_err("Clube do usuário não encontrado."))?;

        let buyer_squad_len = self.state.clubs[buyer_idx].squad.len();
        if buyer_squad_len >= MAX_SQUAD {
            return Err(js_err(
                &format!("Seu elenco já atingiu o limite máximo de {} jogadores.", MAX_SQUAD)
            ));
        }

        let player = self.state.clubs[seller_idx]
            .squad
            .iter()
            .find(|p| p.id == player_id)
            .cloned()
            .unwrap();

        let asking = calculate_asking_price(player.market_value, player.age);
        if fee_u64 < asking {
            return Err(js_err(&format!(
                "A proposta de R$ {:.0} foi recusada! O valor mínimo pedido pelo clube vendedor é R$ {}.",
                offer_fee, asking
            )));
        }

        if self.state.clubs[buyer_idx].balance < fee_u64 as i64 {
            return Err(js_err(
                "Saldo financeiro insuficiente no cofre do clube para concretizar esta contratação."
            ));
        }

        // Execute transaction
        self.state.clubs[buyer_idx].balance -= fee_u64 as i64;
        self.state.clubs[seller_idx].balance += fee_u64 as i64;

        // Remove from seller
        self.state.clubs[seller_idx].squad.retain(|p| p.id != player_id);

        // Add to buyer with 3 years contract
        let mut transferred = player;
        transferred.is_starter = false;
        transferred.contract_years = 3;
        self.state.clubs[buyer_idx].squad.push(transferred);

        // Clear any pending offers on this player
        self.state.transfer_offers.retain(|o| o.player_id != player_id);

        self.get_state_json()
    }

    #[wasm_bindgen]
    pub fn sign_free_agent(
        &mut self,
        player_id: u32,
        years: u8,
        offered_salary: Option<u32>,
    ) -> Result<String, JsValue> {
        if self.state.active_match.as_ref().is_some_and(|m| m.phase != "committed") { return Err(js_err("Elenco bloqueado durante a partida.")); }

        let user_id = self.state.user_club_id;
        let buyer_idx = self
            .state
            .clubs
            .iter()
            .position(|c| c.id == user_id)
            .ok_or_else(|| js_err("Clube do usuário não encontrado."))?;

        if self.state.clubs[buyer_idx].squad.len() >= MAX_SQUAD {
            return Err(js_err(
                &format!("Seu elenco já atingiu o limite máximo de {} jogadores.", MAX_SQUAD)
            ));
        }

        if !(1..=MAX_CONTRACT_YEARS).contains(&years) {
            return Err(js_err(
                &format!("A duração do contrato deve ser entre 1 e {} anos.", MAX_CONTRACT_YEARS)
            ));
        }

        let fa_idx = self
            .state
            .free_agents
            .iter()
            .position(|p| p.id == player_id)
            .ok_or_else(|| js_err("Jogador livre não encontrado no mercado."))?;

        let fa = self.state.free_agents[fa_idx].clone();
        let demanded = calculate_demanded_salary(fa.salary as u64, fa.market_value, 1.0) as u32;

        let agreed_salary = if let Some(sal) = offered_salary {
            if sal < demanded {
                return Err(js_err(&format!(
                    "Salário de R$ {} recusado pelo atleta! Ele exige no mínimo R$ {}/mês.",
                    sal, demanded
                )));
            }
            sal
        } else {
            demanded
        };

        // Signing bonus = 1 month of salary
        let bonus = agreed_salary as i64;
        if self.state.clubs[buyer_idx].balance < bonus {
            return Err(js_err(
                "Saldo insuficiente para pagar as luvas/bônus de contratação do atleta livre."
            ));
        }

        self.state.clubs[buyer_idx].balance -= bonus;
        self.state.free_agents.remove(fa_idx);

        let mut signed = fa;
        signed.salary = agreed_salary;
        signed.contract_years = years;
        signed.is_starter = false;
        self.state.clubs[buyer_idx].squad.push(signed);

        self.get_state_json()
    }

    #[wasm_bindgen]
    pub fn release_player(&mut self, player_id: u32) -> Result<String, JsValue> {
        if self.state.active_match.as_ref().is_some_and(|m| m.phase != "committed") { return Err(js_err("Elenco bloqueado durante a partida.")); }

        let user_id = self.state.user_club_id;
        let club_idx = self
            .state
            .clubs
            .iter()
            .position(|c| c.id == user_id)
            .ok_or_else(|| js_err("Clube do usuário não encontrado."))?;

        if self.state.clubs[club_idx].squad.len() <= MIN_SQUAD {
            return Err(js_err(
                &format!("Você não pode dispensar este atleta pois seu elenco ficaria abaixo do mínimo de {} jogadores.", MIN_SQUAD)
            ));
        }

        let p_idx = self.state.clubs[club_idx]
            .squad
            .iter()
            .position(|p| p.id == player_id)
            .ok_or_else(|| js_err("Jogador não encontrado no seu elenco."))?;

        let mut released = self.state.clubs[club_idx].squad.remove(p_idx);
        released.is_starter = false;
        released.contract_years = 0;
        self.state.free_agents.push(released);

        // Remove any offers for this player
        self.state.transfer_offers.retain(|o| o.player_id != player_id);

        self.get_state_json()
    }

    #[wasm_bindgen]
    pub fn generate_ai_offers(&mut self) -> Result<String, JsValue> {
        self.generate_ai_offers_internal();
        self.get_state_json()
    }

    #[wasm_bindgen]
    pub fn accept_ai_offer(&mut self, offer_id: u32) -> Result<String, JsValue> {
        if self.state.active_match.as_ref().is_some_and(|m| m.phase != "committed") { return Err(js_err("Elenco bloqueado durante a partida.")); }

        let user_id = self.state.user_club_id;
        let offer = self
            .state
            .transfer_offers
            .iter()
            .find(|o| o.id == offer_id)
            .cloned()
            .ok_or_else(|| js_err("Proposta não encontrada ou expirada."))?;

        let user_club_idx = self
            .state
            .clubs
            .iter()
            .position(|c| c.id == user_id)
            .ok_or_else(|| js_err("Clube do usuário não encontrado."))?;

        if self.state.clubs[user_club_idx].squad.len() <= MIN_SQUAD {
            return Err(js_err(
                &format!("Não é possível vender este atleta pois seu elenco ficaria abaixo do limite mínimo de {} jogadores.", MIN_SQUAD)
            ));
        }

        let buyer_idx = self
            .state
            .clubs
            .iter()
            .position(|c| c.id == offer.from_club_id)
            .ok_or_else(|| js_err("Clube comprador não encontrado."))?;

        if self.state.clubs[buyer_idx].squad.len() >= MAX_SQUAD {
            return Err(js_err("O clube comprador está com elenco lotado (máx 30 atletas)."));
        }

        if self.state.clubs[buyer_idx].balance < offer.fee as i64 {
            return Err(js_err("O clube comprador não possui fundos suficientes no momento."));
        }

        let p_idx = self.state.clubs[user_club_idx]
            .squad
            .iter()
            .position(|p| p.id == offer.player_id)
            .ok_or_else(|| js_err("Jogador não encontrado no seu elenco."))?;

        let mut sold_player = self.state.clubs[user_club_idx].squad.remove(p_idx);
        sold_player.is_starter = false;
        sold_player.contract_years = 3;

        self.state.clubs[user_club_idx].balance += offer.fee as i64;
        self.state.clubs[buyer_idx].balance -= offer.fee as i64;
        self.state.clubs[buyer_idx].squad.push(sold_player);

        // Remove all offers for this player
        self.state.transfer_offers.retain(|o| o.player_id != offer.player_id);

        self.get_state_json()
    }

    #[wasm_bindgen]
    pub fn reject_ai_offer(&mut self, offer_id: u32) -> Result<String, JsValue> {
        let before = self.state.transfer_offers.len();
        self.state.transfer_offers.retain(|o| o.id != offer_id);
        if self.state.transfer_offers.len() == before {
            return Err(js_err("Proposta não encontrada."));
        }
        self.get_state_json()
    }

    #[wasm_bindgen]
    pub fn renew_contract(&mut self, player_id: u32, years: u8, new_salary: u32) -> Result<String, JsValue> {
        if !(1..=MAX_CONTRACT_YEARS).contains(&years) {
            return Err(js_err(
                &format!("Contrato deve ter entre 1 e {} anos.", MAX_CONTRACT_YEARS)
            ));
        }

        let user_id = self.state.user_club_id;
        let club = self
            .state
            .clubs
            .iter_mut()
            .find(|c| c.id == user_id)
            .ok_or_else(|| js_err("Clube do usuário não encontrado."))?;

        let player = club
            .squad
            .iter_mut()
            .find(|p| p.id == player_id)
            .ok_or_else(|| js_err("Jogador não encontrado no elenco."))?;

        let demanded = calculate_demanded_salary(player.salary as u64, player.market_value, 1.0) as u32;
        if new_salary < demanded {
            return Err(js_err(&format!(
                "Salário de R$ {} recusado pelo atleta! Ele exige no mínimo R$ {}/mês para renovar.",
                new_salary, demanded
            )));
        }

        player.salary = new_salary;
        player.contract_years = years;

        self.get_state_json()
    }

    pub fn generate_ai_offers_internal(&mut self) -> usize {
        let user_club_id = self.state.user_club_id;
        let Some(user_club) = self.state.clubs.iter().find(|c| c.id == user_club_id) else {
            return 0;
        };
        if user_club.squad.len() <= MIN_SQUAD {
            return 0;
        }
        let squad_len = user_club.squad.len();
        let mut rng = Randoms::new(self.seed_state);
        self.seed_state = self.seed_state.wrapping_add(2246892519);

        let other_clubs: Vec<(u32, String, i64)> = self
            .state
            .clubs
            .iter()
            .filter(|c| c.id != user_club_id && c.squad.len() < MAX_SQUAD && c.balance > 1_000_000)
            .map(|c| (c.id, c.name.clone(), c.balance))
            .collect();

        if other_clubs.is_empty() {
            return 0;
        }

        let mut made = 0;
        let current_offer_pids: Vec<u32> = self.state.transfer_offers.iter().map(|o| o.player_id).collect();

        for (other_id, other_name, other_balance) in other_clubs {
            if self.state.transfer_offers.len() >= 5 || made >= 2 {
                break;
            }
            if made > 0 && rng.next_f64() > 0.40 {
                continue;
            }

            let candidate_indices: Vec<usize> = (0..squad_len)
                .filter(|&i| !current_offer_pids.contains(&user_club.squad[i].id))
                .collect();

            if candidate_indices.is_empty() {
                break;
            }

            let pick_idx = candidate_indices[rng.next_int(candidate_indices.len() as u32) as usize];
            let p = &user_club.squad[pick_idx];
            let asking = calculate_asking_price(p.market_value, p.age);
            let mult = 0.90 + rng.next_f64() * 0.35;
            let fee = ((asking as f64) * mult).round() as u64;

            if fee == 0 || (fee as i64) > other_balance {
                continue;
            }

            let next_id = self.state.transfer_offers.iter().map(|o| o.id).max().unwrap_or(0) + 1;
            self.state.transfer_offers.push(WebTransferOffer {
                extra: Default::default(),
                id: next_id,
                from_club_id: other_id,
                from_club_name: other_name,
                to_club_id: user_club_id,
                player_id: p.id,
                player_name: p.name.clone(),
                player_position: p.position.clone(),
                player_strength: p.strength,
                fee,
            });
            made += 1;
        }
        made
    }

    #[wasm_bindgen]
    pub fn export_save_json(&self) -> Result<String, JsValue> {
        self.get_state_json()
    }

    #[wasm_bindgen]
    pub fn import_save_json(&mut self, json_str: &str) -> Result<(), JsValue> {
        let loaded: WebGameState = serde_json::from_str(json_str)
            .map_err(|e| js_err(&format!("Invalid save JSON: {e}")))?;
        self.state = loaded;
        Ok(())
    }
}

fn generate_default_free_agents() -> Vec<WebPlayer> {
    let pool_data = [
        ("GOL", "Goleiro", 1),
        ("ZAG", "Zagueiro", 2),
        ("LAT", "Lateral", 4),
        ("VOL", "Volante", 9),
        ("MEI", "Meia", 14),
        ("ATA", "Atacante", 20),
    ];

    let names = [
        "Lucas Silva", "Matheus Oliveira", "Gabriel Santos", "Rodrigo Costa",
        "Felipe Almeida", "Bruno Pereira", "Thiago Ribeiro", "Gustavo Martins",
        "Rafael Souza", "Danilo Lima", "Eduardo Carvalho", "Leonardo Rocha",
        "Vitor Hugo", "Caio Castro", "Igor Gomes", "Renan Augusto",
        "Marcio Araújo", "Henrique Dourado", "Walter Minhoca", "Alexandre Pato",
        "Michel Bastos", "Cleiton Xavier", "Cicinho", "Jorge Wagner",
        "Diego Souza", "Elkeson", "Aloísio Chulapa", "Leandro Castán",
        "Richarlyson", "Kieza", "Magno Alves", "Obina",
        "Danilinho", "Jorge Henrique", "Fábio Santos", "Jádson"
    ];

    let feet = ["D", "E", "A"];
    let skills = ["Velocidade", "Finalização", "Cabeceio", "Passe", "Desarme", "Drible", "Cruzamento", "Marcação"];

    let mut free_agents = Vec::with_capacity(names.len());

    for (i, &name) in names.iter().enumerate() {
        let (pos_str, _, _) = pool_data[i % pool_data.len()];
        let age = 19 + ((i as u32 * 7) % 17) as u8; // 19 to 35
        let strength = 45 + ((i as u32 * 11) % 35) as u8; // 45 to 79
        let foot = feet[i % feet.len()].to_string();
        let s1 = skills[(i * 2) % skills.len()].to_string();
        let s2 = skills[(i * 2 + 1) % skills.len()].to_string();

        let base_val = (strength as u64) * (strength as u64) * 800;
        let market_value = if age <= 23 {
            base_val * 13 / 10
        } else if age >= 32 {
            base_val * 7 / 10
        } else {
            base_val
        };

        let salary = ((market_value / 95).clamp(3_000, 45_000)) as u32;

        free_agents.push(WebPlayer {
            extra: Default::default(),
            id: 950_000 + (i as u32),
            name: name.to_string(),
            age,
            position: pos_str.to_string(),
            foot,
            strength,
            energy: 100,
            salary,
            market_value,
            is_starter: false,
            is_star: strength >= 75,
            is_world_top: strength >= 85,
            skill1: s1,
            skill2: s2,
            goals: 0,
            assists: 0,
            yellow_cards: 0,
            red_cards: 0,
            injured: false,
            suspended: false,
            contract_years: 0,
        });
    }

    free_agents
}

#[cfg(test)]
mod round_trip_tests {
    use super::*;

    #[test]
    fn web_state_keeps_career_and_finance_extensions() {
        let json = serde_json::json!({
            "userClubId": 1, "managerName": "Alex", "seasonYear": 2026,
            "currentRound": 1, "calendar": [], "standings": [],
            "options": {"soundEnabled": true, "soundVolume": 1.0, "simSpeed": 1, "autoPauseOnGoal": true},
            "activeScreen": "overview", "activeMatchFixtureId": null,
            "managers": [{"id": "manager-human-1"}],
            "clubs": [{"id": 1, "name": "Clube", "stadium": "Estádio", "capacity": 1000,
                "coach": "Alex", "managerId": "manager-human-1", "primaryColor": "#000",
                "secondaryColor": "#fff", "balance": 5, "ticketPrice": 40,
                "squad": [], "tactics": {"formation": "4-4-2", "mentality": "Equilibrada",
                "penaltyTakerId": 0, "freeKickTakerId": 0, "cornerTakerId": 0, "captainId": 0},
                "debt": 3, "financialLedger": [{"amount": 2}]}]
        });
        let state: WebGameState = serde_json::from_value(json.clone()).unwrap();
        let result = serde_json::to_value(state).unwrap();
        assert_eq!(result["managers"], json["managers"]);
        assert_eq!(result["clubs"][0]["managerId"], json["clubs"][0]["managerId"]);
        assert_eq!(result["clubs"][0]["financialLedger"], json["clubs"][0]["financialLedger"]);
    }
}

/// Stateless JSON commands keep the serializable career as the sole authority.
#[wasm_bindgen]
pub fn wasm_match_command(state_json: &str, command_json: &str) -> Result<String, JsValue> {
    let mut state: WebGameState = serde_json::from_str(state_json).map_err(js_err)?;
    let command: serde_json::Value = serde_json::from_str(command_json).map_err(js_err)?;
    match command.get("type").and_then(|v|v.as_str()) {
        Some("start") => crate::web_match::start_match(&mut state,command["fixture_id"].as_u64().ok_or_else(|| js_err("fixture_id obrigatório"))? as u32).map_err(js_err)?,
        Some("set_bench") => crate::web_match::set_match_bench(&mut state,serde_json::from_value(command["ids"].clone()).map_err(js_err)?).map_err(js_err)?,
        Some("complete_cpu_date") => crate::web_match::complete_cpu_date(&mut state).map_err(js_err)?,
        Some("commit") => { crate::web_match::commit_match(&mut state).map_err(js_err)?; },
        _ => crate::web_match::match_command(&mut state,serde_json::from_value(command).map_err(js_err)?).map_err(js_err)?,
    }
    serde_json::to_string(&state).map_err(js_err)
}
