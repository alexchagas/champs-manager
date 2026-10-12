//! Tests for Intelligent Auto-Lineup and Two-Semester Tournaments + Continental Cups.

use champs_core::calendar::{
    generate_two_semester_calendar, CompetitionType, MatchDay, TwoLeggedTie,
};
use champs_core::club::Club;
use champs_core::player::Player;
use champs_core::position::Position;
use champs_core::tactics::{auto_select_best_lineup, Formation};
use std::collections::HashSet;

fn make_test_player(
    id: u32,
    name: &str,
    pos: Position,
    strength: u8,
    energy: u8,
    injured: bool,
    suspended: bool,
) -> Player {
    let mut p = Player::new(id, name, 25, pos, strength, 10_000).unwrap();
    p.energy = energy;
    p.injured = injured;
    p.suspended = suspended;
    p
}

#[test]
fn test_auto_select_best_lineup_natural_positions() {
    let mut squad = vec![
        // Goleiros:
        make_test_player(1, "Goleiro Titular", Position::Goalkeeper, 90, 100, false, false),
        make_test_player(2, "Goleiro Reserva", Position::Goalkeeper, 75, 100, false, false),
        make_test_player(3, "Goleiro Lesionado (Estrela)", Position::Goalkeeper, 98, 100, true, false),

        // Zagueiros e Laterais:
        make_test_player(10, "Zagueiro 1", Position::CenterBack, 85, 95, false, false),
        make_test_player(11, "Zagueiro 2", Position::CenterBack, 84, 90, false, false),
        make_test_player(12, "Zagueiro Fraco", Position::CenterBack, 60, 100, false, false),
        make_test_player(13, "Lateral D", Position::FullBack, 83, 90, false, false),
        make_test_player(14, "Lateral E", Position::FullBack, 82, 85, false, false),
        make_test_player(15, "Lateral Cansado", Position::FullBack, 88, 30, false, false),
        make_test_player(16, "Zagueiro Suspenso", Position::CenterBack, 92, 100, false, true),

        // Meias:
        make_test_player(20, "Volante 1", Position::Midfielder, 88, 95, false, false),
        make_test_player(21, "Meia 1", Position::Midfielder, 87, 90, false, false),
        make_test_player(22, "Meia 2", Position::Midfielder, 85, 90, false, false),
        make_test_player(23, "Volante 2", Position::Midfielder, 82, 95, false, false),
        make_test_player(24, "Meia Reserva", Position::Midfielder, 70, 100, false, false),
        make_test_player(25, "Meia Lesionado", Position::Midfielder, 95, 100, true, false),

        // Atacantes:
        make_test_player(30, "Atacante 1", Position::Forward, 89, 95, false, false),
        make_test_player(31, "Atacante 2", Position::Forward, 86, 90, false, false),
        make_test_player(32, "Atacante 3", Position::Forward, 84, 90, false, false),
        make_test_player(33, "Atacante Reserva", Position::Forward, 65, 100, false, false),
        make_test_player(34, "Atacante Suspenso", Position::Forward, 95, 100, false, true),
    ];

    let formation_442 = Formation::new(4, 4, 2).unwrap();
    let starters = auto_select_best_lineup(&mut squad, formation_442).unwrap();

    assert_eq!(starters.len(), 11, "Must pick exactly 11 players");
    let distinct: HashSet<u32> = starters.iter().copied().collect();
    assert_eq!(distinct.len(), 11, "All 11 players must be distinct");

    // 1. Goalkeeper check: Slot 0 must be Goalkeeper and GK NEVER plays in defense/midfield/attack
    let gk = &squad[0];
    assert_eq!(gk.id, 1, "Best available GK must be player 1");
    assert_eq!(gk.position, Position::Goalkeeper);
    assert!(gk.is_starter);

    // Make sure no other GK was put into outfield
    for p in &squad[1..11] {
        assert_ne!(
            p.position,
            Position::Goalkeeper,
            "Goleiro NUNCA pode jogar na zaga, meio ou ataque! Player {} is GK.",
            p.name
        );
    }

    // 2. Defenders check: Slots 1..=4 must be CenterBack or FullBack
    for (i, p) in squad[1..=4].iter().enumerate() {
        assert!(
            p.position == Position::CenterBack || p.position == Position::FullBack,
            "Slot {} must be DEF, found {:?}",
            i + 1,
            p.position
        );
        assert!(p.is_starter);
        assert!(!p.injured && !p.suspended, "Suspended/injured must not start");
    }

    // 3. Midfielders check: Slots 5..=8 must be Midfielder
    for (i, p) in squad[5..=8].iter().enumerate() {
        assert_eq!(
            p.position,
            Position::Midfielder,
            "Slot {} must be Midfielder, found {:?}",
            i + 5,
            p.position
        );
        assert!(p.is_starter);
        assert!(!p.injured && !p.suspended);
    }

    // 4. Forwards check: Slots 9..=10 must be Forward
    for (i, p) in squad[9..=10].iter().enumerate() {
        assert_eq!(
            p.position,
            Position::Forward,
            "Slot {} must be Forward, found {:?}",
            i + 9,
            p.position
        );
        assert!(p.is_starter);
        assert!(!p.injured && !p.suspended);
    }

    // Check reserves (indices 11..)
    for p in &squad[11..] {
        assert!(!p.is_starter, "Reserve player {} marked as starter", p.name);
    }

    // Test with 4-3-3: 1 GK, 4 DEF, 3 MID, 3 ATA
    let formation_433 = Formation::new(4, 3, 3).unwrap();
    let starters_433 = auto_select_best_lineup(&mut squad, formation_433).unwrap();
    assert_eq!(starters_433.len(), 11);
    assert_eq!(squad[0].position, Position::Goalkeeper);
    for p in &squad[1..=4] {
        assert!(p.position == Position::CenterBack || p.position == Position::FullBack);
    }
    for p in &squad[5..=7] {
        assert_eq!(p.position, Position::Midfielder);
    }
    for p in &squad[8..=10] {
        assert_eq!(p.position, Position::Forward);
    }

    // Test with 3-5-2: 1 GK, 3 DEF, 5 MID, 2 ATA
    let formation_352 = Formation::new(3, 5, 2).unwrap();
    let starters_352 = auto_select_best_lineup(&mut squad, formation_352).unwrap();
    assert_eq!(starters_352.len(), 11);
    assert_eq!(squad[0].position, Position::Goalkeeper);
    for p in &squad[1..=3] {
        assert!(p.position == Position::CenterBack || p.position == Position::FullBack);
    }
    for p in &squad[4..=8] {
        assert_eq!(p.position, Position::Midfielder);
    }
    for p in &squad[9..=10] {
        assert_eq!(p.position, Position::Forward);
    }
}

#[test]
fn test_brazilian_club_plays_estadual_and_nacional_same_civil_year() {
    // Construct Brazilian clubs for São Paulo (SP, state_id = 25) and Rio de Janeiro (RJ, state_id = 18)
    let mut clubs: Vec<Club> = Vec::new();

    // 4 SP clubs
    let sp_club_names = ["Palmeiras", "Corinthians", "São Paulo", "Santos"];
    for (i, name) in sp_club_names.iter().enumerate() {
        let mut c = Club::new((i + 1) as u32, *name);
        c.country_id = 29; // Brasil
        c.state_id = 25;   // São Paulo (SP)
        c.division_level = 1; // Série A
        // Add 16 players so the club is complete
        for p_idx in 0..16 {
            let pos = match p_idx % 4 {
                0 => Position::Goalkeeper,
                1 => Position::CenterBack,
                2 => Position::Midfielder,
                _ => Position::Forward,
            };
            c.add_player(Player::new((c.id * 100) + p_idx, format!("P-{}-{}", c.name, p_idx), 24, pos, 80, 5000).unwrap()).unwrap();
        }
        clubs.push(c);
    }

    // 4 RJ clubs
    let rj_club_names = ["Flamengo", "Fluminense", "Vasco", "Botafogo"];
    for (i, name) in rj_club_names.iter().enumerate() {
        let mut c = Club::new((i + 10) as u32, *name);
        c.country_id = 29; // Brasil
        c.state_id = 18;   // Rio de Janeiro (RJ)
        c.division_level = 1; // Série A
        for p_idx in 0..16 {
            let pos = match p_idx % 4 {
                0 => Position::Goalkeeper,
                1 => Position::CenterBack,
                2 => Position::Midfielder,
                _ => Position::Forward,
            };
            c.add_player(Player::new((c.id * 100) + p_idx, format!("P-{}-{}", c.name, p_idx), 24, pos, 80, 5000).unwrap()).unwrap();
        }
        clubs.push(c);
    }

    // Brazilian club under test: Palmeiras (ID 1, state_id 25)
    let user_club_id = 1;
    let calendar = generate_two_semester_calendar(user_club_id, &clubs, 1).unwrap();

    // Filter fixtures where Palmeiras (ID 1) plays
    let palmeiras_fixtures: Vec<_> = calendar
        .iter()
        .filter(|f| f.home == user_club_id || f.away == user_club_id)
        .collect();

    assert!(
        !palmeiras_fixtures.is_empty(),
        "Palmeiras must have scheduled fixtures"
    );

    // 1. Verify 1st Semester (Estadual) matches
    let estadual_matches: Vec<_> = palmeiras_fixtures
        .iter()
        .filter(|f| f.competition_type == Some(CompetitionType::Estadual))
        .collect();

    assert!(
        !estadual_matches.is_empty(),
        "Palmeiras must play in the Campeonato Estadual in Semester 1!"
    );
    for m in &estadual_matches {
        assert!(m.round <= 14, "Estadual matches must be in Semester 1 (rounds <= 14)");
        assert_eq!(
            m.competition_name.as_deref(),
            Some("Campeonato Paulista"),
            "SP club must play Campeonato Paulista"
        );
        assert_eq!(m.match_day, Some(MatchDay::Weekend));
    }

    // 2. Verify 2nd Semester (Campeonato Nacional) matches
    let nacional_matches: Vec<_> = palmeiras_fixtures
        .iter()
        .filter(|f| f.competition_type == Some(CompetitionType::Nacional))
        .collect();

    assert!(
        !nacional_matches.is_empty(),
        "Palmeiras must play in the Campeonato Nacional in Semester 2!"
    );
    for m in &nacional_matches {
        assert!(m.round >= 1, "National competition rounds start at one");
        assert!(m.fixture_date_index.unwrap() > estadual_matches.iter().map(|f| f.fixture_date_index.unwrap()).max().unwrap(),
            "National dates follow the state calendar");
        assert_eq!(
            m.competition_name.as_deref(),
            Some("Brasileirão Série A"),
            "Club in div 1 must play Brasileirão Série A"
        );
        assert_eq!(m.match_day, Some(MatchDay::Weekend));
    }

    // 3. Verify Continental Cup (Libertadores) on Wednesdays
    let continental_matches: Vec<_> = palmeiras_fixtures
        .iter()
        .filter(|f| f.competition_type == Some(CompetitionType::Libertadores))
        .collect();

    assert!(
        !continental_matches.is_empty(),
        "Palmeiras must play in Copa Libertadores on Wednesdays!"
    );
    for m in &continental_matches {
        assert_eq!(
            m.match_day,
            Some(MatchDay::Midweek),
            "Continental cup must be played on Wednesdays (Midweek)"
        );
        assert_eq!(m.competition_name.as_deref(), Some("Copa Libertadores"));
    }

    // 4. Verify Two-Legged ties (Ida e Volta) in Continental Knockout
    let knockout_two_legged: Vec<_> = calendar
        .iter()
        .filter(|f| {
            f.competition_type == Some(CompetitionType::Libertadores)
                && (f.leg == Some(1) || f.leg == Some(2))
        })
        .collect();

    assert!(
        !knockout_two_legged.is_empty(),
        "Libertadores knockout must feature two-legged ties (ida e volta)"
    );

    let ida = knockout_two_legged.iter().any(|f| f.leg == Some(1));
    let volta = knockout_two_legged.iter().any(|f| f.leg == Some(2));
    assert!(ida && volta, "Must have both Ida (leg 1) and Volta (leg 2) ties");

    // TwoLeggedTie aggregate helper test
    let mut tie = TwoLeggedTie::new(1, 10, 10);
    tie.leg1_result = Some(champs_core::season::MatchResult { home_goals: 2, away_goals: 1 });
    tie.leg2_result = Some(champs_core::season::MatchResult { home_goals: 1, away_goals: 1 });
    // Leg 1: team 10 (home) 2 x 1 team 1 (away)
    // Leg 2: team 1 (home) 1 x 1 team 10 (away)
    // Aggregate: team 10 has (2 + 1) = 3 goals, team 1 has (1 + 1) = 2 goals -> team 10 wins
    assert_eq!(tie.aggregate_score(), Some((3, 2)));
    assert_eq!(tie.winner(), Some(10));
}
