//! Full autonomous 38-round season plus unit-level checks of the macro systems.

use champs_core::calendar::{double_round_robin, Cup, Division};
use champs_core::condition::{PlayerStatus, YELLOWS_PER_SUSPENSION};
use champs_core::market::{MarketError, MIN_SQUAD};
use champs_core::standings::{compare_rows, compute_standings};
use champs_core::*;
use std::collections::{BTreeMap, BTreeSet};

const POSITIONS: [Position; 24] = {
    use Position::*;
    [
        Goalkeeper, Goalkeeper, Goalkeeper, FullBack, FullBack, FullBack, FullBack, FullBack,
        CenterBack, CenterBack, CenterBack, CenterBack, CenterBack, Midfielder, Midfielder,
        Midfielder, Midfielder, Midfielder, Midfielder, Forward, Forward, Forward, Forward,
        Forward,
    ]
};

fn make_club(id: u32, level: u32, base: u8) -> Club {
    let mut c = Club::new(id, format!("Club {id}"));
    c.division_level = level;
    c.balance = 20_000_000;
    for (i, pos) in POSITIONS.iter().enumerate() {
        let strength = base + (i as u8 * 7) % 20;
        let mut p = Player::new(
            id * 1000 + i as u32,
            format!("P{id}-{i}"),
            20 + (i as u8 * 3) % 16,
            *pos,
            strength,
            5_000 + strength as u64 * 100,
        )
        .unwrap();
        p.market_value = p.salary * 100;
        c.add_player(p).unwrap();
    }
    c
}

fn league(n: u32, seed: u64) -> Career {
    let mut s = SeasonState::new(2026);
    for id in 1..=n {
        s.add_club(make_club(id, 1, 45 + (id as u8 * 2) % 30)).unwrap();
    }
    s.set_user_club(1).unwrap();
    s.generate_round_robin().unwrap();
    let mut market = Market::new();
    for i in 0..40u32 {
        let pos = POSITIONS[(i as usize * 5) % 24];
        let mut p = Player::new(900_000 + i, format!("FA{i}"), 24 + (i % 10) as u8, pos, 50 + (i % 30) as u8, 3_000).unwrap();
        p.market_value = 300_000;
        market.add_free_agent(p);
    }
    let mut career = Career::new(s, market, seed);
    let Career { season, market, rng, .. } = &mut career;
    market.init_contracts(season, rng);
    career
}

fn assert_numeric_sanity(c: &Career) {
    let mut seen = BTreeSet::new();
    for club in &c.season.clubs {
        assert!(club.squad.len() <= MAX_SQUAD && club.squad.len() >= MIN_SQUAD, "squad size");
        assert!(club.average_strength().is_finite());
        for p in club.squad.iter().chain(club.youth.iter()) {
            assert!(seen.insert(p.id), "player {} duplicated", p.id);
            assert_eq!(p.club_id, Some(club.id));
            assert!(p.energy <= 100);
            assert!((1..=100).contains(&p.current_strength));
            assert!(p.current_strength <= p.max_strength);
            assert!(p.morale.is_finite() && p.motivation.is_finite());
        }
    }
    for p in &c.market.free_agents {
        assert!(seen.insert(p.id), "free agent {} duplicated", p.id);
        assert_eq!(p.club_id, None);
    }
    for st in c.statuses.values() {
        assert!(st.yellow_cards < YELLOWS_PER_SUSPENSION);
        assert_eq!(
            st.total_yellows,
            st.yellow_suspensions * YELLOWS_PER_SUSPENSION as u16 + st.yellow_cards as u16
        );
    }
}

fn run_full_season(seed: u64) -> (Career, Vec<RoundReport>) {
    let mut c = league(20, seed);
    let mut reports = Vec::new();
    for round in 1..=38u16 {
        if round == 1 || round == 20 {
            // transfer windows
            let Career { season, market, rng, .. } = &mut c;
            market.expire_offers();
            market.run_ai_window(season, Some(1), rng);
            market.generate_ai_offers(season, 1, rng);
            let pending: Vec<_> = market.offers.iter().map(|o| o.id).collect();
            for (i, id) in pending.into_iter().enumerate() {
                if i % 2 == 0 {
                    let _ = market.accept_offer(season, id); // may fail legitimately
                } else {
                    market.reject_offer(id).unwrap();
                }
            }
        }
        let r = c.play_current_round().unwrap().expect("round available");
        assert_eq!(r.round, round);
        assert_eq!(r.matches, 10);
        assert_numeric_sanity(&c);
        reports.push(r);
    }
    (c, reports)
}

#[test]
fn full_38_round_season_runs_without_numeric_failures() {
    let (mut c, reports) = run_full_season(2026);
    assert_eq!(reports.len(), 38);
    assert_eq!(c.season.week, 39);
    assert!(c.play_current_round().unwrap().is_none());
    assert_eq!(c.season.fixtures.len(), 380);
    assert!(c.season.fixtures.iter().all(|f| f.is_played()));

    let table = c.season.standings();
    assert_eq!(table.len(), 20);
    let mut gf = 0;
    let mut ga = 0;
    for (i, row) in table.iter().enumerate() {
        assert_eq!(row.position as usize, i + 1);
        assert_eq!(row.played, 38);
        assert_eq!(row.wins + row.draws + row.losses, 38);
        assert_eq!(row.points, row.wins * 3 + row.draws);
        gf += row.goals_for;
        ga += row.goals_against;
        if i > 0 {
            assert_ne!(compare_rows(&table[i - 1], row), std::cmp::Ordering::Greater);
        }
    }
    let total_goals: u32 = reports.iter().map(|r| r.goals).sum();
    assert_eq!(gf, ga);
    assert_eq!(gf, total_goals);
    let per_match = total_goals as f64 / 380.0;
    assert!((1.2..=4.5).contains(&per_match), "goals/match = {per_match}");

    // Conditions happened.
    let yellows: u32 = reports.iter().map(|r| r.yellows).sum();
    let injuries: u32 = reports.iter().map(|r| r.injuries).sum();
    let suspensions: u32 = reports.iter().map(|r| r.suspensions).sum();
    assert!(yellows > 200 && injuries > 10 && suspensions > 10);
    // Squads should keep functioning: no forfeits with healthy rotation.
    assert_eq!(reports.iter().map(|r| r.forfeits).sum::<u32>(), 0);

    // Rollover is sane too.
    let released = c.end_of_season();
    assert_numeric_sanity(&c);
    for id in released {
        assert!(c.market.free_agents.iter().any(|p| p.id == id));
    }
    assert!(c.statuses.values().all(|s| s.total_yellows == 0));
}

#[test]
fn season_is_deterministic_for_a_seed() {
    let (a, _) = run_full_season(7);
    let (b, _) = run_full_season(7);
    assert_eq!(a.season.standings(), b.season.standings());
    let (c, _) = run_full_season(8);
    assert_ne!(a.season.standings(), c.season.standings());
}

#[test]
fn career_roundtrips_through_save() {
    let (c, _) = run_full_season(3);
    let save = SaveGame::new("macro", c.season.clone());
    let bytes = save.to_bytes().unwrap();
    assert_eq!(SaveGame::from_bytes(&bytes).unwrap().season, c.season);
    let json = serde_json::to_string(&c).unwrap();
    let back: Career = serde_json::from_str(&json).unwrap();
    assert_eq!(back, c);
}

// ------------------------------------------------------------- calendar

#[test]
fn division_calendars_for_series_a_to_d() {
    let mut s = SeasonState::new(2026);
    let mut id = 1;
    for (level, n) in [(1u32, 20u32), (2, 20), (3, 20), (4, 24)] {
        for _ in 0..n {
            s.add_club(Club { division_level: level, ..Club::new(id, format!("C{id}")) }).unwrap();
            id += 1;
        }
    }
    s.generate_division_calendars().unwrap();
    assert_eq!(s.fixtures.len(), 380 * 3 + 552);
    let ids: BTreeSet<_> = s.fixtures.iter().map(|f| f.id).collect();
    assert_eq!(ids.len(), s.fixtures.len());
    for (d, n) in [(Division::A, 20), (Division::B, 20), (Division::C, 20), (Division::D, 24)] {
        let clubs: BTreeSet<_> =
            s.clubs.iter().filter(|c| c.division_level == d.level()).map(|c| c.id).collect();
        let fx: Vec<_> = s.fixtures.iter().filter(|f| clubs.contains(&f.home)).collect();
        assert_eq!(fx.len(), n * (n - 1));
        assert!(fx.iter().all(|f| clubs.contains(&f.away)), "no cross-division games");
        assert_eq!(fx.iter().map(|f| f.round).max().unwrap() as usize, 2 * (n - 1));
        for round in 1..=(2 * (n - 1)) as u16 {
            let mut seen = BTreeSet::new();
            for f in fx.iter().filter(|f| f.round == round) {
                assert!(seen.insert(f.home) && seen.insert(f.away));
            }
            assert_eq!(seen.len(), n);
        }
        // every ordered pair exactly once
        let pairs: BTreeSet<_> = fx.iter().map(|f| (f.home, f.away)).collect();
        assert_eq!(pairs.len(), n * (n - 1));
    }
    s.clubs[0].division_level = 9;
    assert_eq!(s.generate_division_calendars().unwrap_err(), ModelError::InvalidDivision(9));
    assert_eq!(
        double_round_robin(&[1, 1, 2], 1).unwrap_err(),
        ModelError::DuplicateClub(1)
    );
}

#[test]
fn cup_knockout_with_byes_and_penalties() {
    let mut rng = CoreRng::new(1);
    for n in [2u32, 5, 8, 13, 16] {
        let ids: Vec<u32> = (1..=n).collect();
        let mut cup = Cup::new("Copa", &ids, &mut rng).unwrap();
        let mut played = 0;
        while let Some(_) = cup.current_round() {
            for t in cup.pending_ties() {
                played += 1;
                // home wins on even ties, level + penalties otherwise
                if t % 2 == 0 {
                    cup.record(t, 2, 1, None).unwrap();
                } else {
                    assert_eq!(cup.record(t, 1, 1, None), Err(ModelError::CupDrawNeedsPenalties));
                    assert_eq!(cup.record(t, 1, 1, Some((3, 3))), Err(ModelError::CupDrawNeedsPenalties));
                    cup.record(t, 1, 1, Some((2, 4))).unwrap();
                }
            }
        }
        assert_eq!(played, n - 1, "a knockout of {n} needs n-1 matches");
        assert!(cup.champion.is_some());
        assert_eq!(cup.record(0, 1, 0, None), Err(ModelError::CupFinished));
    }
    assert_eq!(Cup::new("x", &[1], &mut rng).unwrap_err(), ModelError::NotEnoughClubs);
}

// ----------------------------------------------------------- standings

#[test]
fn tiebreakers_points_wins_goal_difference_goals_for() {
    // Hand-built fixtures so that every criterion decides one pair.
    let mut fx = Vec::new();
    let mut id = 1;
    let mut add = |h, a, hg, ag| {
        let mut f = MatchFixture::new(id, 1, h, a).unwrap();
        f.result = Some(MatchResult { home_goals: hg, away_goals: ag });
        id += 1;
        fx.push(f);
    };
    // Clubs 1,2: 4 pts but 1 has a win (3+0+... ) -> use: 1 = W+L(3), 2 = D+D+D(3)
    add(1, 9, 1, 0); // 1 wins
    add(9, 1, 3, 0); // 1 loses  => 1: 3 pts, 1 win
    add(2, 9, 0, 0);
    add(9, 2, 1, 1);
    add(2, 8, 0, 0); // 2: 3 draws, 3 pts, 0 wins
    // Clubs 3,4: 3 pts, 1 win each, GD differs
    add(3, 8, 3, 0);
    add(4, 8, 1, 0);
    // Clubs 5,6: same pts/wins/GD, goals for differ
    add(5, 8, 3, 2);
    add(6, 8, 1, 0);
    let t = compute_standings(&[1, 2, 3, 4, 5, 6, 8, 9], &fx);
    let pos = |c| t.iter().find(|r| r.club_id == c).unwrap().position;
    assert!(pos(1) < pos(2), "wins break points tie");
    assert!(pos(3) < pos(4), "goal difference");
    assert!(pos(5) < pos(6), "goals for");
    let r5 = t.iter().find(|r| r.club_id == 5).unwrap();
    assert_eq!((r5.goals_for, r5.goals_against, r5.goal_difference()), (3, 2, 1));
}

// ------------------------------------------------------------- market

fn two_clubs() -> (SeasonState, Market) {
    let mut s = SeasonState::new(2026);
    s.add_club(make_club(1, 1, 60)).unwrap();
    s.add_club(make_club(2, 1, 60)).unwrap();
    (s, Market::new())
}

#[test]
fn free_agent_signing_rules() {
    let (mut s, mut m) = two_clubs();
    let mut fa = Player::new(777, "Livre", 27, Position::Forward, 70, 4_000).unwrap();
    fa.market_value = 400_000;
    m.add_free_agent(fa);
    assert_eq!(
        m.sign_free_agent(&mut s, 1, 999, 2),
        Err(MarketError::FreeAgentNotFound(999))
    );
    assert_eq!(m.sign_free_agent(&mut s, 1, 777, 9), Err(MarketError::InvalidContractYears(9)));
    s.club_mut(1).unwrap().balance = 100;
    assert!(matches!(m.sign_free_agent(&mut s, 1, 777, 2), Err(MarketError::InsufficientFunds { .. })));
    s.club_mut(1).unwrap().balance = 10_000;
    m.sign_free_agent(&mut s, 1, 777, 2).unwrap();
    assert_eq!(s.club(1).unwrap().balance, 6_000);
    assert_eq!(s.club(1).unwrap().player(777).unwrap().club_id, Some(1));
    assert_eq!(m.contract_years(777), 2);
    assert!(m.free_agents.is_empty());
    // release returns the player to the pool
    m.release_player(&mut s, 1, 777).unwrap();
    assert_eq!(m.free_agents.len(), 1);
    assert_eq!(m.free_agents[0].club_id, None);
}

#[test]
fn buying_players_and_ai_proposals() {
    let (mut s, mut m) = two_clubs();
    let target = 2000 + 20; // a forward of club 2
    let price = market::asking_price(s.club(2).unwrap().player(target).unwrap());
    assert!(matches!(
        m.buy_player(&mut s, 1, target, price - 1),
        Err(MarketError::OfferTooLow { .. })
    ));
    let (b1, b2) = (s.club(1).unwrap().balance, s.club(2).unwrap().balance);
    s.club_mut(1).unwrap().balance = price as i64 - 1;
    assert!(matches!(m.buy_player(&mut s, 1, target, price), Err(MarketError::InsufficientFunds { .. })));
    s.club_mut(1).unwrap().balance = b1;
    m.buy_player(&mut s, 1, target, price).unwrap();
    assert_eq!(s.club(1).unwrap().balance, b1 - price as i64);
    assert_eq!(s.club(2).unwrap().balance, b2 + price as i64);
    assert!(s.club(1).unwrap().player(target).is_some());
    assert!(s.club(2).unwrap().player(target).is_none());
    assert_eq!(m.buy_player(&mut s, 1, 123_456, price), Err(MarketError::PlayerHasNoClub(123_456)));

    // squad floors / ceilings
    while s.club(2).unwrap().squad.len() > MIN_SQUAD {
        let id = s.club(2).unwrap().squad[0].id;
        m.release_player(&mut s, 2, id).unwrap();
    }
    let id = s.club(2).unwrap().squad[0].id;
    assert_eq!(m.release_player(&mut s, 2, id), Err(MarketError::SquadTooSmall(2)));
    assert_eq!(m.buy_player(&mut s, 1, id, u32::MAX as u64), Err(MarketError::SquadTooSmall(2)));

    // AI proposals for the user's club
    let mut rng = CoreRng::new(5);
    let mut made = 0;
    for _ in 0..50 {
        m.expire_offers();
        made += m.generate_ai_offers(&s, 1, &mut rng);
        if !m.offers.is_empty() {
            break;
        }
    }
    let _ = made;
    // Make sure there is at least one offer from a rich third club.
    let mut s3 = SeasonState::new(1);
    s3.add_club(make_club(1, 1, 60)).unwrap();
    s3.add_club(make_club(3, 1, 60)).unwrap();
    let mut m3 = Market::new();
    while m3.offers.is_empty() {
        m3.generate_ai_offers(&s3, 1, &mut rng);
    }
    let o = m3.offers[0].clone();
    assert_eq!((o.to_club, o.from_club), (1, 3));
    let seller_before = s3.club(1).unwrap().balance;
    m3.accept_offer(&mut s3, o.id).unwrap();
    assert_eq!(s3.club(1).unwrap().balance, seller_before + o.fee as i64);
    assert!(s3.club(3).unwrap().player(o.player_id).is_some());
    assert_eq!(m3.accept_offer(&mut s3, o.id), Err(MarketError::OfferNotFound(o.id)));
    assert_eq!(m3.reject_offer(424242), Err(MarketError::OfferNotFound(424242)));
}

#[test]
fn contract_renewal() {
    let (mut s, mut m) = two_clubs();
    let pid = 1000 + 19;
    let demanded = market::demanded_salary(s.club(1).unwrap().player(pid).unwrap());
    assert_eq!(
        m.renew_contract(&mut s, 1, pid, 3, demanded - 1),
        Err(MarketError::SalaryTooLow { demanded })
    );
    assert_eq!(m.renew_contract(&mut s, 1, pid, 0, demanded), Err(MarketError::InvalidContractYears(0)));
    assert_eq!(
        m.renew_contract(&mut s, 1, 5, 3, demanded),
        Err(MarketError::Model(ModelError::PlayerNotFound(5)))
    );
    m.renew_contract(&mut s, 1, pid, 4, demanded + 500).unwrap();
    assert_eq!(s.club(1).unwrap().player(pid).unwrap().salary, demanded + 500);
    assert_eq!(m.contract_years(pid), 4);
}

// ---------------------------------------------------------- condition

#[test]
fn fatigue_recovery_cards_and_injuries() {
    let mut rng = CoreRng::new(11);
    let mut p = Player::new(1, "A", 25, Position::Midfielder, 80, 1000).unwrap();
    condition::apply_match_fatigue(&mut p, &mut rng);
    assert!(p.energy < 100 && p.energy >= 100 - 35);
    assert!(p.current_strength < 80 && p.current_strength >= 48);
    let after = p.energy;
    condition::weekly_recovery(&mut p, true);
    assert_eq!(p.energy, after + 22);
    p.energy = 90;
    condition::weekly_recovery(&mut p, false);
    assert_eq!(p.energy, 100);
    assert_eq!(p.current_strength, 80);
    for _ in 0..10 {
        condition::apply_match_fatigue(&mut p, &mut rng);
    }
    assert_eq!(p.energy, 0);
    assert_eq!(p.current_strength, 48);
    // veterans tire faster
    let old = Player::new(2, "O", 34, Position::Midfielder, 80, 1000).unwrap();
    assert!(condition::match_drain(&old, &mut rng) >= 29);

    // yellow-card accumulation
    let mut st = PlayerStatus::default();
    assert!(!st.add_yellow());
    assert!(!st.add_yellow());
    assert!(st.add_yellow(), "3rd yellow suspends");
    assert_eq!((st.yellow_cards, st.suspension_rounds, st.yellow_suspensions), (0, 1, 1));
    for _ in 0..6 {
        st.add_yellow();
    }
    assert_eq!((st.yellow_suspensions, st.total_yellows), (3, 9));
    st.sync(&mut p);
    assert!(p.suspended && !p.is_available());
    st.injure(3);
    st.sync(&mut p);
    assert!(p.injured);
}

#[test]
fn suspension_and_injury_are_served_across_rounds() {
    let mut c = league(4, 1);
    let victim = 1000u32;
    let st = c.statuses.entry(victim).or_default();
    st.add_yellow();
    st.add_yellow();
    st.add_yellow();
    let injured = 2000u32;
    c.statuses.entry(injured).or_default().injure(2);
    let Career { season, statuses, .. } = &mut c;
    for club in season.clubs.iter_mut() {
        for p in club.squad.iter_mut() {
            if let Some(s) = statuses.get(&p.id) {
                s.sync(p);
            }
        }
    }
    assert!(c.season.club(1).unwrap().player(victim).unwrap().suspended);
    let lineup = career::select_lineup(c.season.club(1).unwrap()).unwrap();
    assert!(!lineup.contains(&victim), "suspended players are never fielded");
    c.play_current_round().unwrap().unwrap();
    assert!(!c.season.club(1).unwrap().player(victim).unwrap().suspended, "served 1 match");
    assert_eq!(c.status(injured).injury_rounds, 1);
    c.play_current_round().unwrap().unwrap();
    assert_eq!(c.status(injured).injury_rounds, 0);
    assert!(!c.season.club(2).unwrap().player(injured).unwrap().injured);
}

#[test]
fn forfeit_when_club_cannot_field_eleven() {
    let mut c = league(4, 1);
    for p in c.season.club_mut(1).unwrap().squad.iter_mut() {
        p.injured = true;
    }
    // Statuses must back the flags, otherwise they are cleared by sync.
    for id in c.season.club(1).unwrap().squad.iter().map(|p| p.id).collect::<Vec<_>>() {
        c.statuses.entry(id).or_default().injure(5);
    }
    let r = c.play_current_round().unwrap().unwrap();
    assert!(r.forfeits >= 1);
    let f = c.season.fixtures.iter().find(|f| f.round == 1 && (f.home == 1 || f.away == 1)).unwrap();
    let res = f.result.unwrap();
    let (mine, theirs) = if f.home == 1 { (res.home_goals, res.away_goals) } else { (res.away_goals, res.home_goals) };
    assert_eq!((mine, theirs), (0, 3));
}

#[test]
fn rng_basics() {
    let mut r = CoreRng::new(42);
    let mean: f64 = (0..20_000).map(|_| r.poisson(1.5) as f64).sum::<f64>() / 20_000.0;
    assert!((mean - 1.5).abs() < 0.06, "{mean}");
    assert_eq!(r.poisson(f64::NAN), 0);
    assert!(!r.chance(f64::NAN));
    let mut v: Vec<u32> = (0..50).collect();
    r.shuffle(&mut v);
    let set: BTreeMap<_, _> = v.iter().map(|x| (*x, ())).collect();
    assert_eq!(set.len(), 50);
}
