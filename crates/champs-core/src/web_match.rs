//! Web career adapter for the incremental match domain.
use crate::wasm::{auto_select_best_lineup_web, WebClub, WebGameState, WebMatchFixture};
use champs_sim::session::{ActiveMatchSession, MatchCommand, MatchPlayer, MatchRules, MatchSide};

fn rules_for(state: &WebGameState, fixture: &WebMatchFixture) -> MatchRules {
    if let Some(rules) = fixture.extra_rules() {
        return rules;
    }
    let mut rules = MatchRules::default();
    let knockout = fixture.competition_type.as_deref() == Some("copa")
        || fixture
            .stage
            .as_ref()
            .is_some_and(|s| s.contains("Final") || s.contains("Semifinal"));
    if knockout && fixture.leg != Some(1) {
        rules.shootout = true;
        // Single-leg cups use extra time; aggregate ties proceed directly to penalties.
        rules.extra_time = fixture.leg.is_none();
        if fixture.leg == Some(2) {
            if let Some(first) = state.calendar.iter().find(|f| {
                f.played
                    && f.leg == Some(1)
                    && f.competition_type == fixture.competition_type
                    && f.stage == fixture.stage
                    && f.home_club_id == fixture.away_club_id
                    && f.away_club_id == fixture.home_club_id
            }) {
                rules.aggregate = [first.away_score.unwrap_or(0), first.home_score.unwrap_or(0)];
            }
        }
    }
    rules
}
impl WebMatchFixture {
    fn extra_rules(&self) -> Option<MatchRules> {
        self.match_rules.clone()
    }
}
fn seed(state: &WebGameState, fixture: u32) -> u32 {
    let career = state
        .extra
        .get("careerId")
        .and_then(|v| v.as_str())
        .unwrap_or(&state.manager_name);
    let mut hash = 2166136261u32;
    for byte in format!("{career}:{}:{fixture}", state.season_year).bytes() {
        hash = (hash ^ byte as u32).wrapping_mul(16777619);
    }
    hash.max(1)
}
fn side(club: &WebClub, rules: &MatchRules, human: bool) -> Result<MatchSide, String> {
    let mut squad = club.squad.clone();
    if !human {
        auto_select_best_lineup_web(&mut squad, &club.tactics.formation);
    }
    let starters: Vec<_> = squad
        .iter()
        .filter(|p| p.is_starter && (human || (!p.injured && !p.suspended)))
        .map(|p| p.id)
        .collect();
    let bench = if human {
        club.named_substitute_ids
            .clone()
            .unwrap_or_else(|| automatic_bench(club, rules.bench_limit))
    } else {
        let mut eligible: Vec<_> = squad
            .iter()
            .filter(|p| !p.is_starter && !p.injured && !p.suspended)
            .collect();
        eligible.sort_by(|a, b| {
            (b.position == "GOL")
                .cmp(&(a.position == "GOL"))
                .then(b.strength.cmp(&a.strength))
                .then(a.id.cmp(&b.id))
        });
        eligible
            .iter()
            .take(rules.bench_limit)
            .map(|p| p.id)
            .collect()
    };
    let players = squad
        .iter()
        .map(|p| MatchPlayer {
            id: p.id,
            name: p.name.clone(),
            position: p.position.clone(),
            strength: p.strength as f64,
            energy: p.energy as f64,
            eligible: !p.injured && !p.suspended,
        })
        .collect();
    let make = if human {
        MatchSide::new
    } else {
        MatchSide::new_ai
    };
    let mut side = make(
        club.id,
        club.name.clone(),
        club.tactics.formation.clone(),
        players,
        starters,
        bench,
        rules,
    )?;
    side.penalty_taker_id = club.tactics.penalty_taker_id;
    side.free_kick_taker_id = club.tactics.free_kick_taker_id;
    side.corner_taker_id = club.tactics.corner_taker_id;
    Ok(side)
}
pub fn automatic_bench(club: &WebClub, limit: usize) -> Vec<u32> {
    let mut eligible: Vec<_> = club
        .squad
        .iter()
        .filter(|p| !p.is_starter && !p.injured && !p.suspended)
        .collect();
    eligible.sort_by(|a, b| {
        (b.position == "GOL")
            .cmp(&(a.position == "GOL"))
            .then(b.strength.cmp(&a.strength))
            .then(a.id.cmp(&b.id))
    });
    eligible.iter().take(limit).map(|p| p.id).collect()
}
pub fn set_match_bench(state: &mut WebGameState, ids: Vec<u32>) -> Result<(), String> {
    if state
        .active_match
        .as_ref()
        .is_some_and(|s| s.phase != "committed")
    {
        return Err("Convocação bloqueada durante a partida.".into());
    }
    let club = state
        .clubs
        .iter_mut()
        .find(|c| c.id == state.user_club_id)
        .ok_or("Clube inexistente.")?;
    let unique: std::collections::BTreeSet<_> = ids.iter().collect();
    if ids.len() > 11
        || unique.len() != ids.len()
        || ids.iter().any(|id| {
            !club
                .squad
                .iter()
                .any(|p| p.id == *id && !p.is_starter && !p.injured && !p.suspended)
        })
    {
        return Err("Banco inválido: até 11 nomes distintos, disponíveis e não titulares.".into());
    }
    club.named_substitute_ids = Some(ids);
    Ok(())
}
fn session(
    state: &WebGameState,
    fixture: &WebMatchFixture,
    human: bool,
) -> Result<ActiveMatchSession, String> {
    let rules = rules_for(state, fixture);
    let home = state
        .clubs
        .iter()
        .find(|c| c.id == fixture.home_club_id)
        .ok_or("Mandante inexistente.")?;
    let away = state
        .clubs
        .iter()
        .find(|c| c.id == fixture.away_club_id)
        .ok_or("Visitante inexistente.")?;
    let human_side = if human {
        Some(if home.id == state.user_club_id { 0 } else { 1 })
    } else {
        None
    };
    let teams = [
        side(home, &rules, human_side == Some(0))?,
        side(away, &rules, human_side == Some(1))?,
    ];
    Ok(ActiveMatchSession::new(
        fixture.id,
        teams,
        rules,
        seed(state, fixture.id),
        human_side,
    ))
}
pub fn start_match(state: &mut WebGameState, fixture_id: u32) -> Result<(), String> {
    if let Some(active) = &state.active_match {
        if active.phase != "committed" {
            if active.fixture_id != fixture_id {
                return Err("Já há uma partida em curso.".into());
            }
            state.active_screen = "live_match".into();
            return Ok(());
        }
    }
    let fixture = state
        .calendar
        .iter()
        .find(|f| f.id == fixture_id)
        .ok_or("Partida inexistente.")?;
    if fixture.played
        || fixture.pending_qualification
        || fixture.fixture_date_index.unwrap_or(fixture.round) != state.current_round
        || (fixture.home_club_id != state.user_club_id
            && fixture.away_club_id != state.user_club_id)
    {
        return Err("Partida indisponível.".into());
    }
    let mut active = session(state, fixture, true)?;
    active.speed = state.options.sim_speed;
    for f in &state.calendar {
        let same_date = if fixture.date.is_some() {
            f.date == fixture.date
        } else {
            f.fixture_date_index.unwrap_or(f.round) == state.current_round
        };
        if same_date && f.id != fixture_id && !f.played && !f.pending_qualification {
            active.parallel_matches.push(session(state, f, false)?);
        }
    }
    active.paused = active.is_finished();
    state.active_match = Some(active);
    state.active_match_fixture_id = Some(fixture_id);
    state.active_screen = "live_match".into();
    Ok(())
}
pub fn match_command(state: &mut WebGameState, command: MatchCommand) -> Result<(), String> {
    let active = state
        .active_match
        .as_mut()
        .ok_or("Nenhuma partida ativa.")?;
    let event_count = active.events.len();
    active.command(command)?;
    if state.options.auto_pause_on_goal
        && active.events[event_count..]
            .iter()
            .any(|e| e.event_type == "goal")
    {
        active.paused = true;
    }
    state.options.sim_speed = active.speed;
    Ok(())
}
pub fn commit_match(state: &mut WebGameState) -> Result<bool, String> {
    let active = state
        .active_match
        .as_mut()
        .ok_or("Nenhuma partida ativa.")?;
    if active.phase == "committed" {
        return Ok(false);
    }
    if active.phase != "full_time" || active.pending_decision.is_some() {
        return Err("Encerre a partida e resolva as decisões antes de consolidar.".into());
    }
    active.finish_parallel();
    if active.parallel_matches.iter().any(|s| !s.is_finished()) {
        return Err("Partida paralela ainda em curso.".into());
    }
    let sessions: Vec<_> = std::iter::once(active.clone())
        .chain(active.parallel_matches.iter().cloned())
        .collect();
    for match_session in sessions {
        let fixture = state
            .calendar
            .iter_mut()
            .find(|f| f.id == match_session.fixture_id)
            .ok_or("Partida removida do calendário.")?;
        if fixture.played {
            continue;
        }
        fixture.home_score = Some(match_session.score[0]);
        fixture.away_score = Some(match_session.score[1]);
        fixture.played = true;
        fixture.events = Some(match_session.events.iter().map(|e| crate::wasm::WebMatchEvent { extra: serde_json::from_value(serde_json::json!({"clock": e.clock, "incomingId": e.incoming_id, "assistId":e.assist_id})).unwrap(), id:e.id.clone(), minute:e.minute, event_type:e.event_type.clone(), team:e.team.clone(), title:None, description:e.description.clone(), scorer_id:e.scorer_id, scorer_name:e.scorer_name.clone(), assist_name:e.assist_name.clone() }).collect());
        if fixture.leg == Some(2) {
            fixture.aggregate_score = Some(vec![
                match_session.score[0] + match_session.rules.aggregate[0],
                match_session.score[1] + match_session.rules.aggregate[1],
            ]);
        }
        if match_session.penalty_attempts != [0; 2] {
            fixture.penalty_score = Some(match_session.penalty_score.to_vec());
        }
        let knockout = match_session.rules.shootout || fixture.leg.is_some();
        if !knockout {
            let table = match fixture.competition_type.as_deref() {
                Some("estadual") => &mut state.standings_estadual,
                Some("nacional") => &mut state.standings_nacional,
                Some("libertadores" | "sulamericana" | "champions") => {
                    &mut state.standings_continental
                }
                _ => &mut state.standings,
            };
            for side in 0..2 {
                if let Some(row) = table
                    .iter_mut()
                    .find(|r| r.club_id == match_session.teams[side].club_id)
                {
                    let goals = match_session.score[side];
                    let conceded = match_session.score[1 - side];
                    row.played += 1;
                    row.goals_for += goals;
                    row.goals_against += conceded;
                    row.goal_diff = row.goals_for as i32 - row.goals_against as i32;
                    let form = if goals > conceded {
                        row.points += 3;
                        row.won += 1;
                        "V"
                    } else if goals == conceded {
                        row.points += 1;
                        row.drawn += 1;
                        "E"
                    } else {
                        row.lost += 1;
                        "D"
                    };
                    row.form.insert(0, form.into());
                    row.form.truncate(5);
                }
            }
        }
        for (side, team) in match_session.teams.iter().enumerate() {
            if let Some(club) = state.clubs.iter_mut().find(|c| c.id == team.club_id) {
                for p in &mut club.squad {
                    if p.injured && !team.injured_ids.contains(&p.id) {
                        let remaining = p
                            .extra
                            .get("injuryMatchesRemaining")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(1)
                            .saturating_sub(1);
                        p.extra
                            .insert("injuryMatchesRemaining".into(), remaining.into());
                        p.injured = remaining > 0;
                    }
                    if p.suspended && !team.sent_off_ids.contains(&p.id) {
                        let remaining = p
                            .extra
                            .get("suspensionMatchesRemaining")
                            .and_then(|v| v.as_u64())
                            .unwrap_or(1)
                            .saturating_sub(1);
                        p.extra
                            .insert("suspensionMatchesRemaining".into(), remaining.into());
                        p.suspended = remaining > 0;
                    }

                    let minutes = *team.minutes_played.get(&p.id).unwrap_or(&0);
                    if minutes > 0 {
                        let drain_rate = match p.position.as_str() {
                            "GOL" => 0.02,
                            "ZAG" | "VOL" => 0.09,
                            _ => 0.13,
                        };
                        p.energy =
                            (p.energy as f64 - minutes as f64 * drain_rate).max(25.0).round() as u8;
                    } else {
                        p.energy = p.energy.saturating_add(22).min(100);
                    }
                    p.yellow_cards += *team.yellow_cards.get(&p.id).unwrap_or(&0) as u32;
                    if team.sent_off_ids.contains(&p.id) {
                        p.red_cards += 1;
                        p.suspended = true;
                        p.extra
                            .insert("suspensionMatchesRemaining".into(), 1.into());
                    }
                    if team.yellow_cards.contains_key(&p.id) && p.yellow_cards % 3 == 0 {
                        p.suspended = true;
                        p.extra
                            .insert("suspensionMatchesRemaining".into(), 1.into());
                    }
                    if team.injured_ids.contains(&p.id) {
                        p.injured = true;
                        p.extra.insert("injuryMatchesRemaining".into(), 3.into());
                    }
                    p.goals += match_session
                        .events
                        .iter()
                        .filter(|e| {
                            e.event_type == "goal"
                                && e.scorer_id == Some(p.id)
                                && e.team == if side == 0 { "home" } else { "away" }
                        })
                        .count() as u32;
                    p.assists += match_session
                        .events
                        .iter()
                        .filter(|e| e.assist_id == Some(p.id))
                        .count() as u32;
                }
            }
        }
    }
    crate::wasm::sort_standings_internal(&mut state.standings);
    crate::wasm::sort_standings_internal(&mut state.standings_estadual);
    crate::wasm::sort_standings_internal(&mut state.standings_nacional);
    crate::wasm::sort_standings_internal(&mut state.standings_continental);
    let competition = state
        .calendar
        .iter()
        .find(|f| Some(f.id) == state.active_match_fixture_id)
        .and_then(|f| f.competition_type.as_deref());
    state.standings = match competition {
        Some("estadual") => state.standings_estadual.clone(),
        Some("nacional") => state.standings_nacional.clone(),
        Some("libertadores" | "sulamericana" | "champions") => state.standings_continental.clone(),
        _ => state.standings.clone(),
    };
    let active = state.active_match.as_mut().unwrap();
    active.phase = "committed".into();
    active.committed_at = Some(format!("{}:{}", state.season_year, active.fixture_id));
    state.active_screen = "round_results".into();
    Ok(true)
}

/// Dates without a human fixture use exactly the same incremental domain.
pub fn complete_cpu_date(state: &mut WebGameState) -> Result<(), String> {
    if state
        .active_match
        .as_ref()
        .is_some_and(|s| s.phase != "committed")
    {
        return Err("Há uma partida em curso.".into());
    }
    let fixtures: Vec<_> = state
        .calendar
        .iter()
        .filter(|f| {
            !f.played
                && !f.pending_qualification
                && f.fixture_date_index.unwrap_or(f.round) == state.current_round
        })
        .cloned()
        .collect();
    if fixtures
        .iter()
        .any(|f| f.home_club_id == state.user_club_id || f.away_club_id == state.user_club_id)
    {
        return Err("Inicie a partida do jogador.".into());
    }
    let first = fixtures
        .first()
        .ok_or("A data já foi consolidada ou não tem partidas.")?;
    let mut active = session(state, first, false)?;
    for fixture in &fixtures[1..] {
        active
            .parallel_matches
            .push(session(state, fixture, false)?);
    }
    for _ in 0..10 {
        if active.is_finished() {
            break;
        }
        active.command(MatchCommand::Resume)?;
        active.command(MatchCommand::Finish)?;
    }
    state.active_match_fixture_id = Some(first.id);
    state.active_match = Some(active);
    commit_match(state)?;
    Ok(())
}
