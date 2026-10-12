//! League/state configuration import (`.cfg` / `.ces` Java streams).

use std::fs;
use std::path::Path;

use crate::error::DataError;
use crate::javaser::{parse_stream, Object, Value};
use crate::model::{ClubRecord, LeagueRecord, StateRecord};

fn sorted_files(dir: &Path, ext: &str) -> Result<Vec<std::path::PathBuf>, DataError> {
    let mut v: Vec<_> = fs::read_dir(dir)
        .map_err(|e| DataError::io(dir, e))?
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|x| x.to_str()) == Some(ext))
        .collect();
    v.sort();
    Ok(v)
}

fn config_items(path: &Path) -> Result<Vec<std::rc::Rc<Object>>, DataError> {
    let data = fs::read(path).map_err(|e| DataError::io(path, e))?;
    let mut out = Vec::new();
    for top in parse_stream(&data)? {
        if let Value::Object(wrapper) = top {
            if wrapper.class.ends_with("ArrayList") {
                for item in wrapper.list_items() {
                    if let Value::Object(o) = item {
                        out.push(o.clone());
                    }
                }
            } else if let Some(list) = wrapper.object("a") {
                for item in list.list_items() {
                    if let Value::Object(o) = item {
                        out.push(o.clone());
                    }
                }
            } else if wrapper.class.ends_with("ConfigLigaType") || wrapper.class.ends_with("ConfigEstadualType") {
                out.push(wrapper.clone());
            }
        }
    }
    Ok(out)
}

/// Reads national league configs and distributes each country's clubs over
/// its divisions by descending `level` (then reputation, then name).
pub fn import_leagues(dir: &Path, clubs: &[ClubRecord]) -> Result<Vec<LeagueRecord>, DataError> {
    let mut leagues = Vec::new();
    for path in sorted_files(dir, "cfg")? {
        let mut divs: Vec<LeagueRecord> = config_items(&path)?
            .iter()
            .filter(|o| o.class.ends_with("ConfigLigaType"))
            .map(|o| LeagueRecord {
                country_id: o.int("pais"),
                name: o.string("nome"),
                division: o.int("divisao"),
                division_name: o.string("nomeDivisao"),
                team_count: o.int("nTimes"),
                groups: o.int("nGrupos"),
                relegated: o.int("nRebaixados"),
                double_round: o.boolean("doisTurnos"),
                club_ids: Vec::new(),
            })
            .collect();
        divs.sort_by_key(|d| d.division);
        let Some(country) = divs.first().map(|d| d.country_id) else {
            continue;
        };
        let mut members: Vec<&ClubRecord> =
            clubs.iter().filter(|c| c.country_id == country).collect();
        members.sort_by(|a, b| {
            b.level
                .cmp(&a.level)
                .then(b.reputation.cmp(&a.reputation))
                .then_with(|| a.name.cmp(&b.name))
        });
        let mut iter = members.into_iter();
        for d in &mut divs {
            for _ in 0..d.team_count.max(0) {
                match iter.next() {
                    Some(c) => d.club_ids.push(c.id),
                    None => break,
                }
            }
        }
        leagues.extend(divs);
    }
    Ok(leagues)
}

pub fn import_states(dir: &Path) -> Result<Vec<StateRecord>, DataError> {
    let mut out = Vec::new();
    let files = {
        let mut v = sorted_files(dir, "cfg").unwrap_or_default();
        if v.is_empty() {
            v = sorted_files(dir, "ces")?;
        }
        v
    };
    for path in files {
        let items = config_items(&path)?;
        let first = items.iter().find(|o| o.class.ends_with("ConfigEstadualType") || o.class.ends_with("ConfigLigaType"));
        let Some(first) = first else {
            continue;
        };
        let state_id = if first.class.ends_with("ConfigLigaType") {
            first.int("pais")
        } else {
            first.int("id")
        };
        out.push(StateRecord {
            id: state_id,
            code: path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default(),
            divisions: items.len() as i32,
        });
    }
    out.sort_by_key(|s| s.id);
    Ok(out)
}
