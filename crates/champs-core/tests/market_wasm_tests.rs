use champs_core::wasm::{
    wasm_calculate_asking_price, wasm_calculate_demanded_salary, WasmCareerEngine, WebClub,
    WebGameState, WebPlayer, WebTactics,
};

fn create_test_game_state() -> WebGameState {
    let mut clubs = Vec::new();

    for cid in 1..=2 {
        let mut squad = Vec::new();
        for i in 0..18 {
            let pid = cid * 1000 + i;
            let pos = match i % 5 {
                0 => "GOL",
                1 => "ZAG",
                2 => "LAT",
                3 => "VOL",
                _ => "ATA",
            };
            squad.push(WebPlayer {
                extra: Default::default(),
                id: pid,
                name: format!("Player {pid}"),
                age: 22 + (i as u8 % 10),
                position: pos.to_string(),
                foot: "D".to_string(),
                strength: 60 + (i as u8 % 20),
                energy: 100,
                salary: 10_000,
                market_value: 1_000_000,
                is_starter: i < 11,
                is_star: false,
                is_world_top: false,
                skill1: "Passe".to_string(),
                skill2: "Chute".to_string(),
                goals: 0,
                assists: 0,
                yellow_cards: 0,
                red_cards: 0,
                injured: false,
                suspended: false,
                contract_years: 3,
            });
        }

        clubs.push(WebClub {
            named_substitute_ids: None,
            extra: Default::default(),
            id: cid,
            name: format!("Club {cid}"),
            stadium: "Arena".to_string(),
            capacity: 30000,
            coach: "Coach".to_string(),
            primary_color: "#ff0000".to_string(),
            secondary_color: "#ffffff".to_string(),
            balance: 50_000_000,
            ticket_price: 40,
            squad,
            tactics: WebTactics {
                formation: "4-4-2".to_string(),
                mentality: "Equilibrada".to_string(),
                penalty_taker_id: cid * 1000,
                free_kick_taker_id: cid * 1000,
                corner_taker_id: cid * 1000,
                captain_id: cid * 1000,
            },
        });
    }

    WebGameState {
        active_match: None,
        extra: Default::default(),
        user_club_id: 1,
        manager_name: "Manager".to_string(),
        season_year: 2026,
        current_round: 1,
        clubs,
        calendar: Vec::new(),
        standings: Vec::new(),
        standings_estadual: Vec::new(),
        standings_nacional: Vec::new(),
        standings_continental: Vec::new(),
        options: champs_core::wasm::WebGameOptions {
            extra: Default::default(),
            sound_enabled: true,
            sound_volume: 0.8,
            sim_speed: 2,
            auto_pause_on_goal: true,
        },
        active_screen: "overview".to_string(),
        active_match_fixture_id: None,
        free_agents: Vec::new(),
        transfer_offers: Vec::new(),
        current_semester: Some(1),
        league_name: Some("Brasileirão Série A".to_string()),
        division_name: Some("Série A".to_string()),
        country_name: Some("Brasil".to_string()),
    }
}

#[test]
fn test_market_calculations() {
    // Youngster <= 23: +20%
    assert_eq!(wasm_calculate_asking_price(1_000_000.0, 20), 1_200_000.0);
    // Veteran >= 32: -30%
    assert_eq!(wasm_calculate_asking_price(1_000_000.0, 33), 700_000.0);
    // Prime: normal
    assert_eq!(wasm_calculate_asking_price(1_000_000.0, 27), 1_000_000.0);

    // Demanded salary: max(salary, value / 100)
    assert_eq!(wasm_calculate_demanded_salary(5_000, 1_000_000.0), 10_000);
    assert_eq!(wasm_calculate_demanded_salary(25_000, 1_000_000.0), 25_000);
}

#[test]
fn test_free_agents_signing_and_limits() {
    let state = create_test_game_state();
    let json = serde_json::to_string(&state).unwrap();
    let mut engine = WasmCareerEngine::new(&json, Some(42.0)).unwrap();

    // Default free agents populated
    let fa_json = engine.get_free_agents().unwrap();
    let free_agents: Vec<WebPlayer> = serde_json::from_str(&fa_json).unwrap();
    assert!(!free_agents.is_empty());

    let target_fa = free_agents[0].clone();

    // Sign free agent
    let updated_json = engine.sign_free_agent(target_fa.id, 3, None).unwrap();
    let updated_state: WebGameState = serde_json::from_str(&updated_json).unwrap();
    let user_club = &updated_state.clubs[0];
    assert_eq!(user_club.squad.len(), 19);
    assert!(user_club.squad.iter().any(|p| p.id == target_fa.id));
    assert!(user_club.balance < 50_000_000); // signing bonus deducted

    // Release player
    let after_release_json = engine.release_player(target_fa.id).unwrap();
    let after_release_state: WebGameState = serde_json::from_str(&after_release_json).unwrap();
    assert_eq!(after_release_state.clubs[0].squad.len(), 18);
    assert!(after_release_state.free_agents.iter().any(|p| p.id == target_fa.id));
}

#[test]
fn test_buy_player_and_squad_limits() {
    let state = create_test_game_state();
    let json = serde_json::to_string(&state).unwrap();
    let mut engine = WasmCareerEngine::new(&json, Some(42.0)).unwrap();

    // Target a player from club 2
    let target_pid = 2000;
    let asking = wasm_calculate_asking_price(1_000_000.0, 22) as u64;

    // Offer too low fails
    assert!(engine.buy_player(target_pid, (asking - 1000) as f64).is_err());

    // Valid purchase
    let updated_json = engine.buy_player(target_pid, asking as f64).unwrap();
    let updated_state: WebGameState = serde_json::from_str(&updated_json).unwrap();

    let user_club = &updated_state.clubs[0];
    let seller_club = &updated_state.clubs[1];

    assert_eq!(user_club.squad.len(), 19);
    assert_eq!(seller_club.squad.len(), 17);
    assert_eq!(user_club.balance, 50_000_000 - asking as i64);
    assert_eq!(seller_club.balance, 50_000_000 + asking as i64);
    assert!(user_club.squad.iter().any(|p| p.id == target_pid));
    assert!(!seller_club.squad.iter().any(|p| p.id == target_pid));
}

#[test]
fn test_contract_renewal() {
    let state = create_test_game_state();
    let json = serde_json::to_string(&state).unwrap();
    let mut engine = WasmCareerEngine::new(&json, Some(42.0)).unwrap();

    let pid = 1000;
    // Salary too low fails
    assert!(engine.renew_contract(pid, 4, 2_000).is_err());

    // Valid renewal
    let updated_json = engine.renew_contract(pid, 4, 18_000).unwrap();
    let updated_state: WebGameState = serde_json::from_str(&updated_json).unwrap();
    let p = updated_state.clubs[0].squad.iter().find(|p| p.id == pid).unwrap();
    assert_eq!(p.salary, 18_000);
    assert_eq!(p.contract_years, 4);
}

#[test]
fn test_ai_offers_and_accept_reject() {
    let state = create_test_game_state();
    let json = serde_json::to_string(&state).unwrap();
    let mut engine = WasmCareerEngine::new(&json, Some(42.0)).unwrap();

    // Trigger AI offers
    let updated_json = engine.generate_ai_offers().unwrap();
    let updated_state: WebGameState = serde_json::from_str(&updated_json).unwrap();
    assert!(!updated_state.transfer_offers.is_empty());

    let offer = updated_state.transfer_offers[0].clone();

    // Accept offer
    let accepted_json = engine.accept_ai_offer(offer.id).unwrap();
    let accepted_state: WebGameState = serde_json::from_str(&accepted_json).unwrap();

    let user_club = &accepted_state.clubs[0];
    assert_eq!(user_club.squad.len(), 17); // Sold 1 player
    assert_eq!(user_club.balance, 50_000_000 + offer.fee as i64);
    assert!(!user_club.squad.iter().any(|p| p.id == offer.player_id));
}
