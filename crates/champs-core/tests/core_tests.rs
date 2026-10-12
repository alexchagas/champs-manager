use champs_core::*;

fn make_player(id: u32, pos: Position, strength: u8, salary: u64) -> Player {
    Player::new(id, format!("Player {id}"), 25, pos, strength, salary).unwrap()
}

fn make_club(id: u32, n_players: u32) -> Club {
    let mut c = Club::new(id, format!("Club {id}"));
    c.stadium_name = "Estádio Ação".into();
    c.stadium_capacity = 40_000;
    c.primary_color = Color::parse("#FF0000").unwrap();
    for i in 0..n_players {
        let pos = match i % 5 {
            0 => Position::Goalkeeper,
            1 => Position::FullBack,
            2 => Position::CenterBack,
            3 => Position::Midfielder,
            _ => Position::Forward,
        };
        c.add_player(make_player(id * 1000 + i, pos, 50 + (i % 40) as u8, 1_000 + i as u64 * 100))
            .unwrap();
    }
    c
}

fn make_season() -> SeasonState {
    let mut s = SeasonState::new(2022);
    for id in 1..=4 {
        s.add_club(make_club(id, 22)).unwrap();
    }
    s.set_user_club(2).unwrap();
    s.generate_round_robin().unwrap();
    s.record_result(1, 2, 1).unwrap();
    s.record_result(2, 0, 0).unwrap();
    let c = s.club_mut(2).unwrap();
    let ids: Vec<u32> = c.squad.iter().take(11).map(|p| p.id).collect();
    c.tactics.set_lineup(ids).unwrap();
    c
        .tactics
        .penalty_taker = Some(2000);
    s
}

// ---- Models ----

#[test]
fn position_and_skill_codes_roundtrip() {
    for code in 0..=4 {
        assert_eq!(Position::from_code(code).unwrap().code(), code);
    }
    assert_eq!(Position::from_code(9), Err(ModelError::InvalidPositionCode(9)));
    assert_eq!(Skill::from_code(0).unwrap(), None);
    for code in 1..=10 {
        assert_eq!(Skill::from_code(code).unwrap().unwrap().code(), code);
    }
    assert!(Skill::from_code(99).is_err());
    assert_eq!(PreferredFoot::from_code(2).unwrap(), PreferredFoot::Both);
    assert!(PreferredFoot::from_code(3).is_err());
}

#[test]
fn player_validation_and_energy() {
    assert_eq!(
        Player::new(1, "x", 20, Position::Forward, 0, 1).unwrap_err(),
        ModelError::InvalidStrength(0)
    );
    assert!(Player::new(1, "x", 20, Position::Forward, 101, 1).is_err());
    let mut p = make_player(1, Position::Forward, 80, 500);
    p.drain_energy(150);
    assert_eq!(p.energy, 0);
    p.recover_energy(250);
    assert_eq!(p.energy, 100);
    assert!(p.is_available());
    p.injured = true;
    assert!(!p.is_available());
    p.set_current_strength(95).unwrap();
    assert_eq!(p.current_strength, 80); // capped at max
}

#[test]
fn color_parsing() {
    assert_eq!(Color::parse("#00ff7F").unwrap(), Color(0, 255, 127));
    assert_eq!(Color(0, 255, 127).to_hex(), "#00FF7F");
    for bad in ["00FF00", "#FFF", "#GGGGGG", "#12345é"] {
        assert!(Color::parse(bad).is_err(), "{bad}");
    }
}

#[test]
fn club_squad_creation_and_limits() {
    let mut c = make_club(1, 30);
    assert_eq!(c.squad.len(), MAX_SQUAD);
    assert!(c.squad.iter().all(|p| p.club_id == Some(1)));
    assert_eq!(
        c.add_player(make_player(9999, Position::Forward, 60, 1)).unwrap_err(),
        ModelError::SquadFull(30)
    );
    assert_eq!(
        c.add_player(make_player(1000, Position::Forward, 60, 1)).unwrap_err(),
        ModelError::DuplicatePlayer(1000)
    );
    for i in 0..MAX_YOUTH as u32 {
        c.add_youth_player(make_player(5000 + i, Position::Midfielder, 40, 100)).unwrap();
    }
    assert_eq!(
        c.add_youth_player(make_player(6000, Position::Midfielder, 40, 100)).unwrap_err(),
        ModelError::YouthFull(15)
    );
}

#[test]
fn payroll_calculation() {
    let mut c = Club::new(1, "Test FC");
    assert_eq!(c.payroll(), 0);
    assert_eq!(c.average_strength(), 0.0);
    c.add_player(make_player(1, Position::Goalkeeper, 60, 1_000)).unwrap();
    c.add_player(make_player(2, Position::Forward, 80, 2_500)).unwrap();
    c.add_youth_player(make_player(3, Position::Forward, 40, 300)).unwrap();
    assert_eq!(c.payroll(), 3_500);
    assert_eq!(c.youth_payroll(), 300);
    assert_eq!(c.total_payroll(), 3_800);
    assert_eq!(c.average_strength(), 70.0);

    c.remove_player(2).unwrap();
    assert_eq!(c.payroll(), 1_000);
    assert_eq!(c.remove_player(2).unwrap_err(), ModelError::PlayerNotFound(2));

    let mut s = SeasonState::new(2022);
    s.add_club(c).unwrap();
    s.add_club(make_club(2, 3)).unwrap();
    assert_eq!(s.total_payroll(), 1_000 + 1_000 + 1_100 + 1_200);
}

#[test]
fn removing_player_cleans_tactics() {
    let mut c = make_club(1, 15);
    let ids: Vec<u32> = c.squad.iter().take(11).map(|p| p.id).collect();
    c.tactics.set_lineup(ids.clone()).unwrap();
    c.tactics.penalty_taker = Some(ids[0]);
    let p = c.remove_player(ids[0]).unwrap();
    assert_eq!(p.club_id, None);
    assert_eq!(c.tactics.lineup.len(), 10);
    assert_eq!(c.tactics.penalty_taker, None);
}

#[test]
fn tactics_validation() {
    assert_eq!(Formation::new(4, 4, 2).unwrap().to_string(), "4-4-2");
    assert!(Formation::new(4, 4, 3).is_err());
    let mut t = Tactics::new(Formation::new(3, 5, 2).unwrap());
    assert!(!t.is_complete());
    assert!(t.set_lineup((0..10).collect()).is_err());
    assert!(t.set_lineup(vec![1; 11]).is_err());
    t.set_lineup((0..11).collect()).unwrap();
    assert!(t.is_complete());
}

#[test]
fn fixtures_and_round_robin() {
    assert_eq!(MatchFixture::new(1, 1, 5, 5).unwrap_err(), ModelError::SelfFixture(5));
    let mut s = SeasonState::new(2022);
    assert_eq!(s.generate_round_robin().unwrap_err(), ModelError::NotEnoughClubs);
    for id in 1..=6 {
        s.add_club(Club::new(id, format!("C{id}"))).unwrap();
    }
    assert_eq!(s.add_club(Club::new(1, "dup")).unwrap_err(), ModelError::DuplicateClub(1));
    s.generate_round_robin().unwrap();
    assert_eq!(s.fixtures.len(), 30); // 6*5 for double round-robin
    assert_eq!(s.distinct_pairings(), 15);
    for round in 1..=10 {
        let mut seen = std::collections::HashSet::new();
        for f in s.fixtures_in_round(round) {
            assert!(seen.insert(f.home) && seen.insert(f.away), "club twice in round {round}");
        }
        assert_eq!(seen.len(), 6);
    }
    // each club plays 5 home and 5 away
    for id in 1..=6 {
        assert_eq!(s.fixtures.iter().filter(|f| f.home == id).count(), 5);
        assert_eq!(s.fixtures.iter().filter(|f| f.away == id).count(), 5);
    }
    // odd number of clubs uses byes
    let mut odd = SeasonState::new(2022);
    for id in 1..=5 {
        odd.add_club(Club::new(id, "x")).unwrap();
    }
    odd.generate_round_robin().unwrap();
    assert_eq!(odd.fixtures.len(), 20);
}

#[test]
fn results_and_points_table() {
    let s = make_season();
    assert_eq!(s.fixtures[0].winner(), Some(s.fixtures[0].home));
    assert_eq!(s.fixtures[1].winner(), None);
    let table = s.points_table();
    assert_eq!(table.iter().map(|t| t.1).sum::<u32>(), 3 + 2);
    let mut s = s;
    assert_eq!(s.record_result(1, 1, 1).unwrap_err(), ModelError::FixtureAlreadyPlayed(1));
    assert_eq!(s.record_result(999, 1, 1).unwrap_err(), ModelError::FixtureNotFound(999));
    assert_eq!(s.set_user_club(77).unwrap_err(), ModelError::ClubNotFound(77));
    s.advance_week();
    assert_eq!(s.week, 2);
}

// ---- Persistence ----

#[test]
fn bytes_roundtrip() {
    let save = SaveGame::new("career1", make_season());
    let bytes = save.to_bytes().unwrap();
    assert_eq!(&bytes[..4], b"CMSV");
    let loaded = SaveGame::from_bytes(&bytes).unwrap();
    assert_eq!(save, loaded);
    assert_eq!(loaded.meta.schema_version, SCHEMA_VERSION);
}

#[test]
fn compression_is_effective() {
    let save = SaveGame::new("c", make_season());
    let raw = bincode::serialize(&save).unwrap();
    let packed = save.to_bytes().unwrap();
    assert!(packed.len() < raw.len() / 2, "{} vs {}", packed.len(), raw.len());
}

#[test]
fn file_roundtrip_and_backup() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("sav").join("career.cmsav");
    let save = SaveGame::new("career", make_season());
    save.save_to_file(&path).unwrap();
    assert!(path.exists());
    assert!(path.with_extension("sbck").exists());
    assert!(!dir.path().join("sav/career.cmsav.tmp").exists());
    assert_eq!(SaveGame::load_from_file(&path).unwrap(), save);

    // Corrupt main file: falls back to backup
    let mut bytes = std::fs::read(&path).unwrap();
    let last = bytes.len() - 1;
    bytes[last] ^= 0xFF;
    std::fs::write(&path, bytes).unwrap();
    assert_eq!(SaveGame::load_from_file(&path).unwrap(), save);

    // Both corrupted: error
    std::fs::write(path.with_extension("sbck"), b"garbage").unwrap();
    assert!(SaveGame::load_from_file(&path).is_err());
}

#[test]
fn reader_writer_roundtrip() {
    let save = SaveGame::new("rw", make_season());
    let mut buf = Vec::new();
    save.save_to_writer(&mut buf).unwrap();
    assert_eq!(SaveGame::load_from_reader(buf.as_slice()).unwrap(), save);
}

#[test]
fn detects_corruption_and_bad_headers() {
    let save = SaveGame::new("x", make_season());
    let good = save.to_bytes().unwrap();

    let mut bad_magic = good.clone();
    bad_magic[0] = b'X';
    assert!(matches!(SaveGame::from_bytes(&bad_magic), Err(SaveError::BadMagic)));

    let mut flipped = good.clone();
    let n = flipped.len() - 3;
    flipped[n] ^= 1;
    assert!(matches!(SaveGame::from_bytes(&flipped), Err(SaveError::ChecksumMismatch)));

    let mut future = good.clone();
    future[4..8].copy_from_slice(&(SCHEMA_VERSION + 1).to_le_bytes());
    assert!(matches!(
        SaveGame::from_bytes(&future),
        Err(SaveError::UnsupportedVersion { .. })
    ));

    assert!(matches!(SaveGame::from_bytes(b"CMS"), Err(SaveError::Truncated)));
    assert!(matches!(SaveGame::from_bytes(&good[..20]), Err(SaveError::Truncated)));
    assert!(matches!(SaveGame::from_bytes(b""), Err(SaveError::Truncated)));
}

#[test]
fn json_export_import() {
    let save = SaveGame::new("json", make_season());
    let json = save.to_json().unwrap();
    assert!(json.contains("\"save_name\": \"json\""));
    assert_eq!(SaveGame::from_json(&json).unwrap(), save);

    let dir = tempfile::tempdir().unwrap();
    let p = dir.path().join("export.json");
    save.export_json(&p).unwrap();
    assert_eq!(SaveGame::import_json(&p).unwrap(), save);
    assert!(SaveGame::from_json("{not json").is_err());
}

#[test]
fn stadium_expansion_and_finance() {
    let mut c = Club::new(1, "Clube Teste");
    c.stadium_capacity = 30_000;
    c.balance = 5_000_000;

    // Fail if insufficient balance
    assert_eq!(
        c.expand_stadium(5_000, 6_000_000).unwrap_err(),
        ModelError::InsufficientBalance(6_000_000, 5_000_000)
    );

    // Expand successfully
    c.expand_stadium(2_000, 3_000_000).unwrap();
    assert_eq!(c.stadium_capacity, 32_000);
    assert_eq!(c.balance, 2_000_000);

    // Take bank loan
    c.take_loan(10_000_000, 10_800_000);
    assert_eq!(c.balance, 12_000_000);
    assert_eq!(c.debt, 10_800_000);

    // Pay debt
    c.pay_debt(5_000_000).unwrap();
    assert_eq!(c.balance, 7_000_000);
    assert_eq!(c.debt, 5_800_000);
}

#[test]
fn youth_promotion_and_release() {
    let mut c = Club::new(1, "Base FC");
    let youth_p = make_player(8888, Position::Forward, 50, 2_000);
    c.add_youth_player(youth_p).unwrap();
    assert_eq!(c.youth.len(), 1);
    assert_eq!(c.youth_payroll(), 2_000);

    // Promote to professional
    c.promote_youth(8888).unwrap();
    assert_eq!(c.youth.len(), 0);
    assert_eq!(c.squad.len(), 1);
    assert_eq!(c.payroll(), 2_000);
    assert_eq!(c.youth_payroll(), 0);

    // Add another youth and release
    let youth_p2 = make_player(9999, Position::Midfielder, 55, 3_000);
    c.add_youth_player(youth_p2).unwrap();
    assert_eq!(c.youth.len(), 1);
    let released = c.release_youth(9999).unwrap();
    assert_eq!(released.id, 9999);
    assert_eq!(c.youth.len(), 0);
    assert_eq!(c.youth_payroll(), 0);
}

