use champs_sim::session::*;

fn team(base: u32, keeper_on_bench: bool) -> MatchSide {
    let players: Vec<_> = (0..25)
        .map(|i| MatchPlayer {
            id: base + i,
            name: format!("P{}", base + i),
            position: if i == 0 || (i == 11 && keeper_on_bench) {
                "GOL"
            } else if i < 5 {
                "ZAG"
            } else if i < 9 {
                "MEI"
            } else {
                "ATA"
            }
            .into(),
            strength: 50.0 + i as f64,
            energy: 100.0,
            eligible: true,
        })
        .collect();
    MatchSide::new(
        base,
        format!("T{base}"),
        "4-4-2".into(),
        players,
        (base..base + 11).collect(),
        (base + 11..base + 22).collect(),
        &MatchRules::default(),
    )
    .unwrap()
}
fn game(keeper: bool, human: bool) -> ActiveMatchSession {
    ActiveMatchSession::new(
        77,
        [team(100, keeper), team(200, true)],
        MatchRules::default(),
        937124901,
        if human { Some(0) } else { None },
    )
}
fn advance(s: &mut ActiveMatchSession) {
    if let Some(d) = s.pending_decision.clone() {
        s.command(if d.kind == "penalty" {
            MatchCommand::ChoosePenaltyTaker {
                player_id: d.default_taker_id.unwrap(),
            }
        } else {
            MatchCommand::ContinueWithoutReplacement
        })
        .unwrap();
    }
    if s.is_finished() {
        return;
    }
    if s.paused {
        s.command(MatchCommand::Resume).unwrap();
    }
    s.command(MatchCommand::Advance).unwrap();
}
#[test]
fn sheet_validation_and_off_sheet_players() {
    let side = team(100, true);
    let make = |starters, bench, players| {
        MatchSide::new(
            1,
            "T".into(),
            "4-4-2".into(),
            players,
            starters,
            bench,
            &MatchRules::default(),
        )
    };
    assert!(make(
        side.starter_ids.clone(),
        (111..123).collect(),
        side.players.clone()
    )
    .is_err());
    assert!(make(
        side.starter_ids.clone(),
        vec![111, 111],
        side.players.clone()
    )
    .is_err());
    assert!(make(side.starter_ids.clone(), vec![100], side.players.clone()).is_err());
    let mut injured = side.players.clone();
    injured[11].eligible = false;
    assert!(make(side.starter_ids.clone(), vec![111], injured).is_err());
    assert!(make(side.starter_ids.clone(), vec![], side.players.clone()).is_ok());
    let mut s = game(true, true);
    let old = s.clone();
    assert!(s
        .command(MatchCommand::Substitute {
            side: 0,
            outgoing: 101,
            incoming: 123
        })
        .is_err());
    assert_eq!(s, old);
}
#[test]
fn five_substitutions_three_windows_halftime_and_atomic_rejection() {
    let mut s = game(false, true);
    for (out, inc) in [(101, 111), (102, 112)] {
        s.command(MatchCommand::Substitute {
            side: 0,
            outgoing: out,
            incoming: inc,
        })
        .unwrap();
    }
    assert_eq!(s.teams[0].opportunities_used, 1);
    s.clock.elapsed = 60;
    s.command(MatchCommand::Substitute {
        side: 0,
        outgoing: 103,
        incoming: 113,
    })
    .unwrap();
    s.clock.elapsed = 65;
    s.command(MatchCommand::Substitute {
        side: 0,
        outgoing: 104,
        incoming: 114,
    })
    .unwrap();
    s.clock.elapsed = 70;
    let old = s.clone();
    assert!(s
        .command(MatchCommand::Substitute {
            side: 0,
            outgoing: 105,
            incoming: 115
        })
        .is_err());
    assert_eq!(s, old);
    s.phase = "halftime".into();
    s.command(MatchCommand::Substitute {
        side: 0,
        outgoing: 105,
        incoming: 115,
    })
    .unwrap();
    assert_eq!(s.teams[0].opportunities_used, 3);
    assert_eq!(s.teams[0].substitutions_used, 5);
    let old = s.clone();
    assert!(s
        .command(MatchCommand::Substitute {
            side: 0,
            outgoing: 106,
            incoming: 116
        })
        .is_err());
    assert_eq!(s, old);
    assert!(s
        .command(MatchCommand::Substitute {
            side: 0,
            outgoing: 107,
            incoming: 111
        })
        .is_err());
}
#[test]
fn goalkeeper_injury_offers_named_keeper_and_restores_outfielder_role() {
    let mut s = game(true, true);
    s.incident(0, 100, true).unwrap();
    assert_eq!(s.pending_decision.as_ref().unwrap().eligible_ids, vec![111]);
    assert!(s.paused);
    assert_eq!(s.teams[0].on_field_role_by_player_id.len(), 10);
    let temp = s.teams[0].temporary_goalkeeper_id.unwrap();
    let old = s.clone();
    assert!(s
        .command(MatchCommand::Substitute {
            side: 0,
            outgoing: 100,
            incoming: 112
        })
        .is_err());
    assert_eq!(s, old);
    s.command(MatchCommand::Substitute {
        side: 0,
        outgoing: 100,
        incoming: 111,
    })
    .unwrap();
    assert_eq!(s.teams[0].on_field_role_by_player_id.len(), 11);
    assert_eq!(
        s.teams[0].on_field_role_by_player_id[&temp],
        s.teams[0].player(temp).position
    );
    assert_eq!(s.teams[0].on_field_role_by_player_id[&111], "GOL");
    assert!(s.teams[0].temporary_goalkeeper_id.is_none());
    assert!(s.pending_decision.is_none());
    assert_eq!(s.teams[0].substitutions_used, 1);
}
#[test]
fn emergency_keeper_persists_is_weaker_and_can_rebuild_the_line() {
    let mut s = game(false, true);
    let defense = s.teams[0].sector_strength(&["GOL", "ZAG", "LAT", "VOL"]);
    s.incident(0, 100, true).unwrap();
    let temp = s.teams[0].temporary_goalkeeper_id.unwrap();
    assert!(s.teams[0].starter_ids.contains(&temp));
    assert!(s.teams[0].sector_strength(&["GOL", "ZAG", "LAT", "VOL"]) < defense);
    let restored: ActiveMatchSession =
        serde_json::from_str(&serde_json::to_string(&s).unwrap()).unwrap();
    assert_eq!(s, restored);
    s.command(MatchCommand::Substitute {
        side: 0,
        outgoing: 100,
        incoming: 111,
    })
    .unwrap();
    assert_eq!(s.teams[0].temporary_goalkeeper_id, Some(temp));
    assert_eq!(s.teams[0].on_field_role_by_player_id.len(), 11);
    assert!(s.events.iter().any(|e| e.event_type == "role_change"));
}
#[test]
fn exhausted_players_or_windows_leave_ten_and_no_extra_substitution() {
    for exhausted_windows in [false, true] {
        let mut s = game(true, true);
        if exhausted_windows {
            s.teams[0].opportunities_used = 3;
        } else {
            s.teams[0].substitutions_used = 5;
        }
        s.incident(0, 100, true).unwrap();
        assert!(s.pending_decision.as_ref().unwrap().eligible_ids.is_empty());
        s.command(MatchCommand::ContinueWithoutReplacement).unwrap();
        assert_eq!(s.teams[0].on_field_role_by_player_id.len(), 10);
        assert!(s.teams[0].temporary_goalkeeper_id.is_some());
    }
}
#[test]
fn expelled_keeper_cannot_be_replaced_reserve_requires_an_outfielder() {
    let mut s = game(true, true);
    s.incident(0, 100, false).unwrap();
    let old = s.clone();
    assert!(s
        .command(MatchCommand::Substitute {
            side: 0,
            outgoing: 100,
            incoming: 111
        })
        .is_err());
    assert_eq!(s, old);
    let temp = s.teams[0].temporary_goalkeeper_id.unwrap();
    s.command(MatchCommand::Substitute {
        side: 0,
        outgoing: temp,
        incoming: 111,
    })
    .unwrap();
    assert_eq!(s.teams[0].on_field_role_by_player_id.len(), 10);
    assert!(s.teams[0].temporary_goalkeeper_id.is_none());
    assert_eq!(s.teams[0].on_field_role_by_player_id[&111], "GOL");
}
#[test]
fn penalty_is_pending_before_random_draw_and_save_restores_taker_choice() {
    let mut s = game(true, true);
    s.teams[0].penalty_taker_id = 109;
    let rng = s.rng_state;
    s.award_penalty(0).unwrap();
    assert_eq!(s.rng_state, rng);
    assert_eq!(s.score, [0, 0]);
    assert!(s.paused);
    assert_eq!(
        s.pending_decision.as_ref().unwrap().default_taker_id,
        Some(109)
    );
    let old = s.clone();
    assert!(s
        .command(MatchCommand::ChoosePenaltyTaker { player_id: 111 })
        .is_err());
    assert_eq!(s, old);
    s.command(MatchCommand::SelectPenaltyTaker { player_id: 108 })
        .unwrap();
    assert_eq!(s.rng_state, rng);
    let mut restored: ActiveMatchSession =
        serde_json::from_str(&serde_json::to_string(&s).unwrap()).unwrap();
    assert_eq!(
        restored.pending_decision.as_ref().unwrap().default_taker_id,
        Some(108)
    );
    for x in [&mut s, &mut restored] {
        x.command(MatchCommand::ChoosePenaltyTaker { player_id: 108 })
            .unwrap();
    }
    assert_eq!(s, restored);
    assert_eq!(s.events.last().unwrap().scorer_id, Some(108));
    assert!(s.pending_decision.is_none());
    let old = s.clone();
    assert!(s
        .command(MatchCommand::ChoosePenaltyTaker { player_id: 108 })
        .is_err());
    assert_eq!(s, old);
}
#[test]
fn replay_pause_save_resume_and_late_substitution_only_change_future() {
    let mut a = game(false, true);
    while a.clock.elapsed < 37 {
        advance(&mut a);
    }
    a.command(MatchCommand::Pause).unwrap();
    let at37 = a.clone();
    let mut b: ActiveMatchSession =
        serde_json::from_str(&serde_json::to_string(&a).unwrap()).unwrap();
    while !a.is_finished() {
        advance(&mut a);
    }
    while !b.is_finished() {
        advance(&mut b);
    }
    assert_eq!(a, b);
    let mut changed = at37.clone();
    changed.teams[0]
        .players
        .iter_mut()
        .find(|p| p.id == 111)
        .unwrap()
        .strength = 1.0;
    let strength = changed.teams[0].sector_strength(&["ATA", "MEI"]);
    changed
        .command(MatchCommand::Substitute {
            side: 0,
            outgoing: 110,
            incoming: 111,
        })
        .unwrap();
    assert!(changed.teams[0].sector_strength(&["ATA", "MEI"]) < strength);
    assert_eq!(&changed.events[..at37.events.len()], &at37.events);
    while !changed.is_finished() {
        advance(&mut changed);
    }
    assert_ne!(a.events, changed.events);
}
#[test]
fn clock_separates_first_half_added_time_from_second_half() {
    let mut s = game(true, false);
    while s.clock.elapsed < 47 {
        advance(&mut s);
    }
    assert_eq!((s.clock.period, s.clock.minute, s.clock.added), (1, 45, 2));
    assert_eq!(s.phase, "halftime");
    advance(&mut s);
    advance(&mut s);
    assert_eq!((s.clock.period, s.clock.minute, s.clock.added), (2, 47, 0));
}
#[test]
fn fast_forward_stops_for_decisions_and_shootout_is_a_separate_score() {
    let mut s = game(true, true);
    s.award_penalty(0).unwrap();
    let old = s.clone();
    assert!(s.command(MatchCommand::Finish).is_err());
    assert_eq!(s, old);
    s.command(MatchCommand::ChoosePenaltyTaker { player_id: 109 })
        .unwrap();
    s.pending_decision = None;
    s.score = [0, 0];
    s.clock.elapsed = 94;
    s.phase = "second_half".into();
    s.rules.extra_time = true;
    s.rules.shootout = true;
    s.command(MatchCommand::Pause).unwrap();
    assert_eq!(s.phase, "extra_time");
    s.clock.elapsed = 124;
    s.command(MatchCommand::Pause).unwrap();
    assert_eq!(s.phase, "shootout");
    let regulation = s.score;
    for _ in 0..200 {
        if s.is_finished() {
            break;
        }
        advance(&mut s);
    }
    assert!(s.is_finished());
    assert_ne!(s.penalty_score[0], s.penalty_score[1]);
    assert_eq!(s.score, regulation);
    assert!(s.events.iter().any(|e| e.event_type == "shootout_kick"));
}
#[test]
fn parallel_sessions_never_expose_future_events_and_finish_same_result() {
    let mut s = game(true, false);
    let mut cpu = game(false, false);
    cpu.fixture_id = 88;
    s.parallel_matches.push(cpu.clone());
    while s.clock.elapsed < 37 {
        advance(&mut s);
    }
    let projected = &s.parallel_matches[0];
    assert_eq!(projected.clock.elapsed, 37);
    assert!(projected.events.iter().all(|e| e.clock.elapsed <= 37));
    while !s.is_finished() {
        advance(&mut s);
    }
    s.finish_parallel();
    while !cpu.is_finished() {
        advance(&mut cpu);
    }
    assert_eq!(s.parallel_matches[0].score, cpu.score);
    assert_eq!(s.parallel_matches[0].events, cpu.events);
}

#[test]
fn boundary_decisions_resolve_before_halftime_or_full_time() {
    for boundary in [47, 94] {
        let mut s = game(true, true);
        s.clock.elapsed = boundary;
        s.clock.minute = if boundary == 47 { 45 } else { 90 };
        s.clock.added = 2;
        s.phase = if boundary == 47 {
            "first_half"
        } else {
            "second_half"
        }
        .into();
        s.rng_state = 1; // deterministic converted penalty
        s.award_penalty(0).unwrap();
        assert!(!s.is_finished());
        let mut restored: ActiveMatchSession =
            serde_json::from_str(&serde_json::to_string(&s).unwrap()).unwrap();
        restored
            .command(MatchCommand::ChoosePenaltyTaker { player_id: 109 })
            .unwrap();
        assert_eq!(restored.score, [1, 0]);
        assert_eq!(restored.stats.shots, [1, 0]);
        assert_eq!(
            restored.phase,
            if boundary == 47 {
                "halftime"
            } else {
                "full_time"
            }
        );
    }
}
#[test]
fn ai_replaces_keepers_and_outfield_injuries_with_valid_reserves() {
    for (injured, keeper) in [(200, true), (201, true), (200, false)] {
        let mut s = game(true, false);
        s.teams[1] = team(200, keeper);
        s.incident(1, injured, true).unwrap();
        assert_eq!(s.teams[1].substitutions_used, 1);
        assert_eq!(s.teams[1].opportunities_used, 1);
        assert_eq!(s.teams[1].on_field_role_by_player_id.len(), 11);
        assert!(s.pending_decision.is_none());
        assert!(s.teams[1]
            .on_field_role_by_player_id
            .values()
            .any(|r| r == "GOL"));
    }
}
#[test]
fn exhausted_ai_squad_forfeits_without_blocking_the_date() {
    let mut unavailable = team(200, true);
    unavailable.starter_ids.pop();
    unavailable.on_field_role_by_player_id.remove(&210);
    let s = ActiveMatchSession::new(
        90,
        [team(100, true), unavailable],
        MatchRules::default(),
        42,
        Some(0),
    );
    assert!(s.is_finished());
    assert_eq!(s.score, [3, 0]);
}
#[test]
fn second_half_interruption_is_distinct_from_first_half_even_before_next_tick() {
    let mut s = game(false, true);
    s.clock.elapsed = 47;
    s.command(MatchCommand::Substitute {
        side: 0,
        outgoing: 101,
        incoming: 111,
    })
    .unwrap();
    assert_eq!(s.phase, "halftime");
    assert_eq!(s.teams[0].opportunities_used, 1);
    s.command(MatchCommand::Substitute {
        side: 0,
        outgoing: 102,
        incoming: 112,
    })
    .unwrap();
    assert_eq!(s.teams[0].opportunities_used, 1);
    s.command(MatchCommand::Resume).unwrap();
    s.command(MatchCommand::Pause).unwrap();
    s.command(MatchCommand::Substitute {
        side: 0,
        outgoing: 103,
        incoming: 113,
    })
    .unwrap();
    assert_eq!(s.teams[0].opportunities_used, 2);
}
