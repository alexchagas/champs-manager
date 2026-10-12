use champs_core::wasm::wasm_simulate_match;
use serde_json::{json, Value};
use tauri::Manager;

#[tauri::command]
fn save_club_edits(app: tauri::AppHandle, clubs: Vec<Value>) -> Result<(), String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("teams.json");
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let source = if path.exists() {
        std::fs::read_to_string(&path).map_err(|e| e.to_string())?
    } else {
        include_str!("../../data/teams.json").to_owned()
    };
    let mut data: Value = serde_json::from_str(&source).map_err(|e| e.to_string())?;
    let raw_clubs = data["clubs"]
        .as_array_mut()
        .ok_or("Invalid club database")?;
    let mut old_players = std::collections::HashMap::new();
    for club in raw_clubs.iter() {
        if let Some(players) = club["squad"].as_array() {
            for player in players {
                if let Some(id) = player["id"].as_u64() {
                    old_players.insert(id, player.clone());
                }
            }
        }
    }
    let clubs_for_storage = clubs.clone();
    let mut membership_updates = Vec::new();
    for club in clubs {
        let id = club["id"].as_u64().ok_or("Invalid club ID")?;
        let old = raw_clubs
            .iter()
            .find(|c| c["id"].as_u64() == Some(id))
            .cloned();
        let mut raw = old.unwrap_or_else(|| json!({"id": id, "source_id": id, "variant_id": 0, "base_color": 0, "coach_nationality_id": 29, "state_id": 0, "level": 1, "file_ref": "", "valid": true, "youth": [], "assets": {"crest": null, "crest_mini": null, "shirt": null, "shirt2": null, "shirt3": null}}));
        for (raw_key, web_key) in [
            ("name", "name"),
            ("stadium", "stadium"),
            ("stadium_capacity", "capacity"),
            ("country_id", "countryId"),
            ("reputation", "reputation"),
            ("primary_color", "primaryColor"),
            ("secondary_color", "secondaryColor"),
            ("coach", "coach"),
            ("level", "level"),
            ("file_ref", "fileRef"),
            ("division", "division"),
        ] {
            if !club[web_key].is_null() {
                raw[raw_key] = club[web_key].clone();
            }
        }
        let country_id = club["countryId"].as_u64().unwrap_or(29);
        let division = club["division"].as_u64().unwrap_or(1);
        membership_updates.push((id, country_id, division));
        let mut squad = Vec::new();
        for player in club["squad"].as_array().ok_or("Invalid squad")? {
            let player_id = player["id"].as_u64().ok_or("Invalid player ID")?;
            let mut item = old_players.get(&player_id).cloned().unwrap_or_else(|| json!({"id": player_id, "trait1": 0, "trait2": 0, "hash": 0, "nationality_id": country_id}));
            for (raw_key, web_key) in [
                ("name", "name"),
                ("age", "age"),
                ("strength", "strength"),
                ("skill1", "skill1"),
                ("skill2", "skill2"),
                ("starter", "isStarter"),
                ("star", "isStar"),
                ("world_top", "isWorldTop"),
            ] {
                item[raw_key] = player[web_key].clone();
            }
            let position = match player["position"].as_str().unwrap_or("MEI") {
                "GOL" => ("goalkeeper", 0),
                "LAT" => ("fullback", 1),
                "ZAG" => ("centre_back", 2),
                "VOL" => ("midfielder", 3),
                "ATA" => ("forward", 4),
                _ => ("midfielder", 3),
            };
            item["position"] = json!(position.0);
            item["position_code"] = json!(position.1);
            item["foot"] = json!(match player["foot"].as_str().unwrap_or("D") {
                "E" => "left",
                "A" => "both",
                _ => "right",
            });
            squad.push(item);
        }
        raw["squad"] = Value::Array(squad);
        if let Some(index) = raw_clubs.iter().position(|c| c["id"].as_u64() == Some(id)) {
            raw_clubs[index] = raw;
        } else {
            raw_clubs.push(raw);
        }
    }
    if let Some(leagues) = data["leagues"].as_array_mut() {
        for (id, country_id, division) in membership_updates {
            let already_in_target = leagues.iter().any(|league| {
                league["country_id"].as_u64() == Some(country_id)
                    && league["division"].as_u64() == Some(division)
                    && league["club_ids"]
                        .as_array()
                        .is_some_and(|ids| ids.iter().any(|item| item.as_u64() == Some(id)))
            });
            if already_in_target {
                continue;
            }
            for league in leagues.iter_mut() {
                if let Some(ids) = league["club_ids"].as_array_mut() {
                    ids.retain(|item| item.as_u64() != Some(id));
                }
            }
            if let Some(target) = leagues.iter_mut().find(|league| {
                league["country_id"].as_u64() == Some(country_id)
                    && league["division"].as_u64() == Some(division)
            }) {
                if let Some(ids) = target["club_ids"].as_array_mut() {
                    ids.push(json!(id));
                }
            }
        }
    }
    let mut edits = std::collections::BTreeMap::new();
    if let Some(existing) = data["editor_clubs"].as_array() {
        for club in existing {
            if let Some(id) = club["id"].as_u64() {
                edits.insert(id, club.clone());
            }
        }
    }
    for club in &clubs_for_storage {
        if let Some(id) = club["id"].as_u64() {
            edits.insert(id, club.clone());
        }
    }
    data["editor_clubs"] = Value::Array(edits.into_values().collect());
    let temporary = path.with_extension("json.tmp");
    std::fs::write(
        &temporary,
        serde_json::to_vec_pretty(&data).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    std::fs::rename(temporary, path).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_club_edits(app: tauri::AppHandle) -> Result<Vec<Value>, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("teams.json");
    if !path.exists() {
        return Ok(Vec::new());
    }
    let data: Value = serde_json::from_slice(&std::fs::read(path).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    Ok(data["editor_clubs"].as_array().cloned().unwrap_or_default())
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!(
        "Bem-vindo ao Champs Manager, {}! Motor Rust Desktop Ativo.",
        name
    )
}

#[tauri::command]
fn simulate_match_native(
    home_club_json: String,
    away_club_json: String,
    seed: Option<f64>,
) -> Result<String, String> {
    wasm_simulate_match(&home_club_json, &away_club_json, seed).map_err(|e| format!("{:?}", e))
}

#[tauri::command]
fn get_engine_info() -> String {
    format!(
        "Champs Manager Desktop Rust Core v{}",
        env!("CARGO_PKG_VERSION")
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            simulate_match_native,
            get_engine_info,
            save_club_edits,
            load_club_edits
        ])
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
