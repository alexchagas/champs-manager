//! Importer: `teams/*.ban` → [`TeamsDatabase`], plus asset linking.

use std::collections::{BTreeSet, HashSet};
use std::fs;
use std::path::Path;
use std::rc::Rc;

use crate::error::DataError;
use crate::javaser::{parse_stream, Object, Value};
use crate::model::*;

fn structure(file: &str, message: impl Into<String>) -> DataError {
    DataError::Structure {
        file: file.to_string(),
        message: message.into(),
    }
}

fn convert_player(o: &Object, id: u32) -> PlayerRecord {
    PlayerRecord {
        id,
        name: o.string("a"),
        age: o.int("d"),
        nationality_id: o.int("c"),
        position: PositionKind::from_code(o.int("e")),
        position_code: o.int("e"),
        starter: o.int("f") == 1,
        star: o.boolean("b"),
        world_top: o.boolean("j"),
        trait1: o.int("g"),
        trait2: o.int("h"),
        foot: FootKind::from_code(o.int("i")),
        hash: o.int("hash"),
    }
}

fn convert_players(
    list: Option<&Rc<Object>>,
    base: u32,
    file: &str,
) -> Result<Vec<PlayerRecord>, DataError> {
    let mut out = Vec::new();
    if let Some(l) = list {
        for (i, item) in l.list_items().into_iter().enumerate() {
            match item {
                Value::Object(p) if p.class == "e.g" => {
                    out.push(convert_player(p, base + i as u32))
                }
                _ => return Err(structure(file, "player list contains a non e.g element")),
            }
        }
    }
    Ok(out)
}

/// Converts a decoded `e.t` object into a club record (without assets).
pub fn convert_club(o: &Object, file: &str) -> Result<ClubRecord, DataError> {
    if o.class != "e.t" {
        return Err(structure(file, format!("expected e.t, found {}", o.class)));
    }
    let id = 0;
    let base = 0;
    Ok(ClubRecord {
        id,
        source_id: o.int("id"),
        variant_id: o.int("vid"),
        reputation: o.int("n"),
        base_color: o.int("o"),
        name: o.string("e"),
        file_ref: o.string("d"),
        country_id: o.int("a"),
        state_id: o.int("b"),
        level: o.int("c"),
        stadium: o.string("f"),
        stadium_capacity: o.int("g"),
        coach: o.string("h"),
        coach_nationality_id: o.int("i"),
        primary_color: o.string("cor1"),
        secondary_color: o.string("cor2"),
        valid: o.boolean("valid"),
        squad: convert_players(o.object("l"), base, file)?,
        youth: convert_players(o.object("m"), base + 50, file)?,
        assets: ClubAssets::default(),
    })
}

fn assign_player_ids(c: &mut ClubRecord) {
    let base = c.id as u32 * 100;
    for (i, p) in c.squad.iter_mut().enumerate() {
        p.id = base + i as u32;
    }
    for (i, p) in c.youth.iter_mut().enumerate() {
        p.id = base + 50 + i as u32;
    }
}

/// Parses one `.ban` file's bytes into club records (normally exactly one).
pub fn parse_ban(data: &[u8], file: &str) -> Result<Vec<ClubRecord>, DataError> {
    let values = parse_stream(data)?;
    let mut clubs = Vec::new();
    for v in values {
        match v {
            Value::Object(o) => clubs.push(convert_club(&o, file)?),
            _ => return Err(structure(file, "top-level value is not an object")),
        }
    }
    if clubs.is_empty() {
        return Err(structure(file, "no clubs found"));
    }
    Ok(clubs)
}

fn list_png_stems(dir: &Path) -> BTreeSet<String> {
    let mut set = BTreeSet::new();
    if let Ok(rd) = fs::read_dir(dir) {
        for e in rd.flatten() {
            let p = e.path();
            if p.extension().and_then(|x| x.to_str()) == Some("png") {
                if let Some(s) = p.file_stem().and_then(|x| x.to_str()) {
                    set.insert(s.to_string());
                }
            }
        }
    }
    set
}

/// Links crest/shirt image folders to clubs through `file_ref`.
/// Paths stored are relative to the `teams` directory (e.g. `escudos/x.png`).
pub fn link_assets(clubs: &mut [ClubRecord], teams_dir: &Path) {
    let folders = ["escudos", "escudosMini", "camisas", "camisas2", "camisas3"];
    let sets: Vec<BTreeSet<String>> = folders
        .iter()
        .map(|f| list_png_stems(&teams_dir.join(f)))
        .collect();
    for c in clubs {
        let pick = |i: usize| {
            sets[i]
                .contains(&c.file_ref)
                .then(|| format!("{}/{}.png", folders[i], c.file_ref))
        };
        c.assets = ClubAssets {
            crest: pick(0),
            crest_mini: pick(1),
            shirt: pick(2),
            shirt2: pick(3),
            shirt3: pick(4),
        };
    }
}

/// Imports every `*.ban` in `teams_dir`, in deterministic (sorted) order.
pub fn import_teams(teams_dir: &Path) -> Result<TeamsDatabase, DataError> {
    let mut files: Vec<_> = fs::read_dir(teams_dir)
        .map_err(|e| DataError::io(teams_dir, e))?
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|x| x.to_str()) == Some("ban"))
        .collect();
    files.sort();
    let mut clubs = Vec::new();
    for f in &files {
        let name = f.file_name().unwrap().to_string_lossy().to_string();
        let data = fs::read(f).map_err(|e| DataError::io(f, e))?;
        clubs.extend(parse_ban(&data, &name)?);
    }
    // Brasfoot's own `id` is not unique, so assign stable ids by file_ref.
    clubs.sort_by(|a, b| {
        a.file_ref
            .to_lowercase()
            .cmp(&b.file_ref.to_lowercase())
            .then_with(|| a.file_ref.cmp(&b.file_ref))
    });
    let mut seen = HashSet::new();
    for (i, c) in clubs.iter_mut().enumerate() {
        if !seen.insert(c.file_ref.clone()) {
            return Err(structure(
                "teams",
                format!("duplicate file_ref {}", c.file_ref),
            ));
        }
        c.id = i as i32 + 1;
        assign_player_ids(c);
    }
    link_assets(&mut clubs, teams_dir);
    Ok(TeamsDatabase {
        schema_version: SCHEMA_VERSION,
        source: "Brasfoot 22-23 teams/*.ban".into(),
        clubs,
        leagues: Vec::new(),
        states: Vec::new(),
    })
}

/// Full import: clubs from `<root>/teams`, leagues from
/// `<root>/conf_ligas_nacionais`, states from `<root>/conf_estadual`.
pub fn import_database(root: &Path) -> Result<TeamsDatabase, DataError> {
    let mut db = import_teams(&root.join("teams"))?;
    db.leagues = crate::leagues::import_leagues(&root.join("conf_ligas_nacionais"), &db.clubs)?;
    db.states = crate::leagues::import_states(&root.join("conf_estadual"))?;
    Ok(db)
}

pub fn save_json(db: &TeamsDatabase, path: &Path) -> Result<(), DataError> {
    let s = serde_json::to_string_pretty(db)?;
    fs::write(path, s).map_err(|e| DataError::io(path, e))
}

pub fn load_json(path: &Path) -> Result<TeamsDatabase, DataError> {
    let s = fs::read_to_string(path).map_err(|e| DataError::io(path, e))?;
    Ok(serde_json::from_str(&s)?)
}
