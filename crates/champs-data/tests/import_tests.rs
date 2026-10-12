//! Integration tests running against the real Brasfoot 22-23 data in the
//! repository root (`teams/`, `conf_ligas_nacionais/`, `conf_estadual/`).

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use champs_data::{import_database, load_json, save_json, ClubRecord, PositionKind, TeamsDatabase};

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn db() -> &'static TeamsDatabase {
    static DB: OnceLock<TeamsDatabase> = OnceLock::new();
    DB.get_or_init(|| import_database(&root()).expect("import real data"))
}

const BRAZIL: i32 = 29;
const SPAIN: i32 = 65;

fn assert_full_squad(c: &ClubRecord) {
    assert!(
        (17..=40).contains(&c.squad.len()),
        "{}: squad size {}",
        c.name,
        c.squad.len()
    );
    assert!(c.youth.len() <= 15, "{}: {} juniors", c.name, c.youth.len());
    assert!(
        c.squad
            .iter()
            .any(|p| p.position == PositionKind::Goalkeeper),
        "{}: no goalkeeper",
        c.name
    );
    assert!(
        // Brasfoot ships a default line-up; a few clubs are irregular (8..=15).
        (8..=15).contains(&c.squad.iter().filter(|p| p.starter).count()),
        "{}: implausible starter count",
        c.name
    );
    for p in c.squad.iter().chain(&c.youth) {
        assert!(!p.name.is_empty(), "{}: unnamed player", c.name);
        // The source data has a handful of placeholder ages (0) and veterans (56).
        assert!(
            (0..=60).contains(&p.age),
            "{}: {} age {}",
            c.name,
            p.name,
            p.age
        );
        assert_ne!(p.position, PositionKind::Unknown, "{}: {}", c.name, p.name);
    }
}

fn division_clubs(country: i32, division: i32) -> Vec<&'static ClubRecord> {
    let d = db();
    let l = d
        .leagues
        .iter()
        .find(|l| l.country_id == country && l.division == division)
        .unwrap_or_else(|| panic!("league {country}/{division} missing"));
    l.club_ids.iter().map(|id| d.club(*id).unwrap()).collect()
}

#[test]
fn imports_every_ban_file() {
    let ban_files = std::fs::read_dir(root().join("teams"))
        .unwrap()
        .flatten()
        .filter(|e| e.path().extension().and_then(|x| x.to_str()) == Some("ban"))
        .count();
    let d = db();
    assert_eq!(d.clubs.len(), ban_files);
    assert!(d.clubs.len() >= 700, "only {} clubs", d.clubs.len());
    let ids: HashSet<_> = d.clubs.iter().map(|c| c.id).collect();
    assert_eq!(ids.len(), d.clubs.len(), "club ids must be unique");
    let refs: HashSet<_> = d.clubs.iter().map(|c| c.file_ref.as_str()).collect();
    assert_eq!(refs.len(), d.clubs.len());
    let pids: HashSet<_> = d
        .clubs
        .iter()
        .flat_map(|c| c.squad.iter().chain(&c.youth).map(|p| p.id))
        .collect();
    assert_eq!(pids.len(), d.player_count(), "player ids must be unique");
}

#[test]
fn every_club_has_a_complete_squad() {
    for c in &db().clubs {
        assert_full_squad(c);
    }
}

#[test]
fn known_club_details_are_decoded() {
    let c = db().club_by_file_ref("BeitarJer_isr").expect("Beitar");
    assert_eq!(c.name, "Beitar Jerusalem");
    assert_eq!(c.stadium, "Teddy Kollek");
    assert_eq!(c.stadium_capacity, 33500);
    assert_eq!(c.coach, "Yossi Abukasis");
    assert_eq!(c.primary_color, "#000000");
    assert_eq!(c.secondary_color, "#ffff00");
    assert_eq!(c.country_id, 103);
    assert_eq!(c.squad.len(), 20);
    assert_eq!(c.squad[0].name, "Netanel Daloya");
    assert_eq!(c.squad[0].position, PositionKind::Goalkeeper);
    assert!(c.squad[0].starter);
}

#[test]
fn brazilian_series_a_b_c_are_complete() {
    let names = |div| -> HashSet<String> {
        division_clubs(BRAZIL, div)
            .iter()
            .map(|c| c.name.clone())
            .collect()
    };
    for div in 1..=3 {
        let clubs = division_clubs(BRAZIL, div);
        assert_eq!(clubs.len(), 20, "Série {div}");
        clubs.iter().for_each(|c| assert_full_squad(c));
    }
    let a = names(1);
    for n in [
        "Flamengo",
        "Palmeiras",
        "Corinthians",
        "São Paulo",
        "Santos",
        "Fluminense",
    ] {
        assert!(a.contains(n), "Série A is missing {n}");
    }
    let b = names(2);
    for n in ["Grêmio", "Vasco", "Cruzeiro", "Sport", "Bahia"] {
        assert!(b.contains(n), "Série B is missing {n}");
    }
    let c = names(3);
    for n in ["Figueirense", "Remo", "Paysandu", "Vitória"] {
        assert!(c.contains(n), "Série C is missing {n}");
    }
    // Series D is configured for 64 clubs.
    assert_eq!(division_clubs(BRAZIL, 4).len(), 64);
    // Divisions are disjoint.
    let all: Vec<_> = (1..=4).flat_map(|d| division_clubs(BRAZIL, d)).collect();
    let set: HashSet<_> = all.iter().map(|c| c.id).collect();
    assert_eq!(set.len(), all.len());
}

#[test]
fn spanish_top_divisions_are_complete() {
    for (div, n) in [(1, 20), (2, 22)] {
        let clubs = division_clubs(SPAIN, div);
        assert_eq!(clubs.len(), n);
        clubs.iter().for_each(|c| assert_full_squad(c));
    }
    let top: HashSet<_> = division_clubs(SPAIN, 1)
        .iter()
        .map(|c| c.name.clone())
        .collect();
    assert!(top.contains("Real Madrid") && top.contains("Barcelona"));
}

#[test]
fn international_leagues_are_imported_with_full_squads() {
    let mut by_country: HashMap<i32, Vec<&ClubRecord>> = HashMap::new();
    for c in &db().clubs {
        by_country.entry(c.country_id).or_default().push(c);
    }
    let big: Vec<_> = by_country.iter().filter(|(_, v)| v.len() >= 8).collect();
    assert!(big.len() >= 10, "expected many countries with 8+ clubs");
    assert!(by_country.len() >= 50, "{} countries", by_country.len());
    for (_, clubs) in big {
        clubs.iter().for_each(|c| assert_full_squad(c));
    }
    // Non-Brazilian clubs outnumber Brazilian ones.
    let foreign = db().clubs.iter().filter(|c| c.country_id != BRAZIL).count();
    assert!(foreign > 400, "{foreign} foreign clubs");
}

#[test]
fn state_federations_are_listed() {
    let d = db();
    let sp = d.states.iter().find(|s| s.code == "SP").expect("SP");
    assert_eq!(sp.id, 25);
    assert!(d.states.len() >= 25);
    let sp_clubs = d
        .clubs
        .iter()
        .filter(|c| c.country_id == BRAZIL && c.state_id == sp.id);
    assert!(sp_clubs.count() >= 15);
}

#[test]
fn crests_and_shirts_are_linked_to_clubs() {
    let d = db();
    let teams = root().join("teams");
    let with_crest = d.clubs.iter().filter(|c| c.assets.crest.is_some()).count();
    assert!(
        with_crest as f64 >= d.clubs.len() as f64 * 0.99,
        "{with_crest} crests"
    );
    for c in &d.clubs {
        for rel in [
            &c.assets.crest,
            &c.assets.crest_mini,
            &c.assets.shirt,
            &c.assets.shirt2,
            &c.assets.shirt3,
        ]
        .into_iter()
        .flatten()
        {
            assert!(teams.join(rel).is_file(), "{}: {rel} missing", c.name);
            assert!(rel.ends_with(&format!("{}.png", c.file_ref)));
        }
    }
    // Every Brazilian Série A club has crest and shirt.
    for c in division_clubs(BRAZIL, 1) {
        assert!(
            c.assets.crest.is_some() && c.assets.shirt.is_some(),
            "{}",
            c.name
        );
    }
    let fla = d.clubs.iter().find(|c| c.name == "Flamengo").unwrap();
    assert!(fla.assets.crest.as_deref().unwrap().starts_with("escudos/"));
    assert!(fla.assets.shirt.as_deref().unwrap().starts_with("camisas/"));
}

#[test]
fn json_roundtrip_preserves_database() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("teams.json");
    save_json(db(), &path).unwrap();
    let back = load_json(&path).unwrap();
    assert_eq!(&back, db());
}

#[test]
fn rejects_corrupt_streams() {
    assert!(champs_data::import::parse_ban(b"not java", "x").is_err());
    let data = std::fs::read(root().join("teams/BeitarJer_isr.ban")).unwrap();
    assert!(champs_data::import::parse_ban(&data[..data.len() / 2], "x").is_err());
}
