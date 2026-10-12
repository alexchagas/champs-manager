use champs_core::wasm::{WasmCareerEngine, WebGameState};
use champs_core::web_match::*;
use champs_sim::session::MatchCommand;
use serde_json::json;
fn state() -> WebGameState {
    let clubs:Vec<_>=(1..=4).map(|id| {
        let squad:Vec<_>=(0..24).map(|i|json!({"id":id*100+i,"name":format!("P{id}-{i}"),"age":24,"position":if i==0||i==11 {"GOL"}else if i<5 {"ZAG"}else if i<9 {"MEI"}else {"ATA"},"foot":"D","strength":65,"energy":100,"salary":5000,"marketValue":10000,"isStarter":i<11,"isStar":false,"isWorldTop":false,"skill1":"","skill2":"","goals":0,"assists":0,"yellowCards":0,"redCards":0,"injured":false,"suspended":false})).collect();
        json!({"id":id,"name":format!("T{id}"),"stadium":"Arena","capacity":20000,"coach":"Coach","primaryColor":"#ffffff","secondaryColor":"#000000","balance":1000000,"ticketPrice":40,"squad":squad,"tactics":{"formation":"4-4-2","mentality":"Equilibrada","penaltyTakerId":id*100+10,"freeKickTakerId":id*100+9,"cornerTakerId":id*100+8,"captainId":id*100+1}})
    }).collect();
    let standings:Vec<_>=(1..=4).map(|id|json!({"clubId":id,"clubName":format!("T{id}"),"primaryColor":"#fff","points":0,"played":0,"won":0,"drawn":0,"lost":0,"goalsFor":0,"goalsAgainst":0,"goalDiff":0,"form":[]})).collect();
    serde_json::from_value(json!({"careerId":"career-1","userClubId":1,"managerName":"Coach","seasonYear":2026,"currentRound":1,"clubs":clubs,"calendar":[
        {"id":10,"round":1,"fixtureDateIndex":1,"date":"2026-10-11","homeClubId":1,"awayClubId":2,"played":false,"competitionType":"nacional"},
        {"id":11,"round":1,"fixtureDateIndex":1,"date":"2026-10-11","homeClubId":3,"awayClubId":4,"played":false,"competitionType":"nacional"},
        {"id":12,"round":2,"fixtureDateIndex":2,"date":"2026-10-18","homeClubId":1,"awayClubId":3,"played":false,"competitionType":"nacional"}],
        "standings":standings,"standingsNacional":standings,"options":{"soundEnabled":false,"soundVolume":0.5,"simSpeed":2,"autoPauseOnGoal":false,"autoSaveMode":"disabled","liveScores":"date"},"activeScreen":"overview"})).unwrap()
}
fn finish(s: &mut WebGameState) {
    for _ in 0..1000 {
        let active = s.active_match.as_ref().unwrap();
        if active.is_finished() {
            return;
        }
        let cmd = if let Some(d) = &active.pending_decision {
            if d.kind == "penalty" {
                MatchCommand::ChoosePenaltyTaker {
                    player_id: d.default_taker_id.unwrap(),
                }
            } else {
                MatchCommand::ContinueWithoutReplacement
            }
        } else if active.paused {
            MatchCommand::Resume
        } else {
            MatchCommand::Advance
        };
        match_command(s, cmd).unwrap();
    }
    panic!("match did not finish");
}
#[test]
fn legacy_state_bench_validation_start_resume_and_other_dates() {
    let mut s = state();
    assert!(s.active_match.is_none());
    assert!(set_match_bench(&mut s, (111..123).collect()).is_err());
    assert!(set_match_bench(&mut s, vec![111, 111]).is_err());
    assert!(set_match_bench(&mut s, vec![100]).is_err());
    set_match_bench(&mut s, vec![111, 112]).unwrap();
    start_match(&mut s, 10).unwrap();
    assert_eq!(
        s.active_match.as_ref().unwrap().teams[0].named_substitute_ids,
        vec![111, 112]
    );
    assert_eq!(s.active_match.as_ref().unwrap().parallel_matches.len(), 1);
    for _ in 0..37 {
        let active = s.active_match.as_ref().unwrap();
        if active.pending_decision.is_some() {
            break;
        }
        match_command(&mut s, MatchCommand::Advance).unwrap();
    }
    let old = s.active_match.clone();
    start_match(&mut s, 10).unwrap();
    assert_eq!(s.active_match, old);
    assert!(set_match_bench(&mut s, vec![]).is_err());
    assert!(start_match(&mut s, 12).is_err());
    let restored: WebGameState = serde_json::from_str(&serde_json::to_string(&s).unwrap()).unwrap();
    assert_eq!(restored.active_match, s.active_match);
    assert_eq!(restored.options.extra["autoSaveMode"], "disabled");
    let mut engine = WasmCareerEngine::new(&serde_json::to_string(&s).unwrap(), Some(1.0)).unwrap();
    assert!(engine.auto_select_best_lineup(1, None).is_err());
    assert!(engine.toggle_starter(1, 111).is_err());
    assert!(engine.advance_to_next_round().is_err());
}
#[test]
fn commit_uses_session_results_once_and_preserves_stats_injury_and_parallel_results() {
    let mut s = state();
    start_match(&mut s, 10).unwrap();
    assert!(commit_match(&mut s).is_err());
    s.active_match
        .as_mut()
        .unwrap()
        .incident(0, 100, true)
        .unwrap();
    match_command(
        &mut s,
        MatchCommand::Substitute {
            side: 0,
            outgoing: 100,
            incoming: 111,
        },
    )
    .unwrap();
    finish(&mut s);
    let score = s.active_match.as_ref().unwrap().score;
    assert!(commit_match(&mut s).unwrap());
    assert_eq!(s.calendar[0].home_score, Some(score[0]));
    assert!(s.calendar[1].played);
    assert!(!s.calendar[2].played);
    let parallel = &s.active_match.as_ref().unwrap().parallel_matches[0];
    assert_eq!(s.calendar[1].home_score, Some(parallel.score[0]));
    assert!(s.clubs[0].squad[0].injured);
    assert!(s.clubs[0].squad[11].energy < 100);
    assert_eq!(
        s.standings_nacional.iter().map(|r| r.played).sum::<u32>(),
        4
    );
    let saved = serde_json::to_string(&s).unwrap();
    assert!(!commit_match(&mut s).unwrap());
    assert_eq!(saved, serde_json::to_string(&s).unwrap());
    let mut restored: WebGameState = serde_json::from_str(&saved).unwrap();
    assert!(!commit_match(&mut restored).unwrap());
    assert_eq!(saved, serde_json::to_string(&restored).unwrap());
}
#[test]
fn empty_bench_is_preserved_and_a_second_career_has_a_distinct_seed() {
    let mut a = state();
    let mut b = state();
    b.extra.insert("careerId".into(), json!("career-2"));
    set_match_bench(&mut a, vec![]).unwrap();
    start_match(&mut a, 10).unwrap();
    start_match(&mut b, 10).unwrap();
    assert!(a.active_match.as_ref().unwrap().teams[0]
        .named_substitute_ids
        .is_empty());
    assert_ne!(
        a.active_match.as_ref().unwrap().seed,
        b.active_match.as_ref().unwrap().seed
    );
}

#[test]
fn cpu_only_dates_and_absence_duration_use_the_same_commit() {
    let mut s = state();
    s.user_club_id = 99;
    complete_cpu_date(&mut s).unwrap();
    assert_eq!(s.active_match.as_ref().unwrap().phase, "committed");
    assert!(s.calendar[0].played && s.calendar[1].played);
    let before = serde_json::to_string(&s).unwrap();
    assert!(complete_cpu_date(&mut s).is_err());
    assert_eq!(before, serde_json::to_string(&s).unwrap());

    let mut s = state();
    s.clubs[0].squad[12].injured = true;
    s.clubs[0].squad[12]
        .extra
        .insert("injuryMatchesRemaining".into(), json!(3));
    s.clubs[0].squad[13].suspended = true;
    s.clubs[0].squad[13]
        .extra
        .insert("suspensionMatchesRemaining".into(), json!(1));
    start_match(&mut s, 10).unwrap();
    finish(&mut s);
    commit_match(&mut s).unwrap();
    assert!(s.clubs[0].squad[12].injured);
    assert_eq!(s.clubs[0].squad[12].extra["injuryMatchesRemaining"], 2);
    assert!(!s.clubs[0].squad[13].suspended);
}
