//! League table with tie-breaks: points, wins, goal difference, goals for
//! (then club id, so the order is always deterministic).

use crate::player::ClubId;
use crate::season::MatchFixture;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::BTreeMap;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StandingRow {
    /// 1-based table position.
    pub position: u16,
    pub club_id: ClubId,
    pub played: u32,
    pub wins: u32,
    pub draws: u32,
    pub losses: u32,
    pub goals_for: u32,
    pub goals_against: u32,
    pub points: u32,
}

impl StandingRow {
    fn new(club_id: ClubId) -> Self {
        Self {
            position: 0,
            club_id,
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goals_for: 0,
            goals_against: 0,
            points: 0,
        }
    }

    pub fn goal_difference(&self) -> i32 {
        self.goals_for as i32 - self.goals_against as i32
    }

    fn record(&mut self, scored: u8, conceded: u8) {
        self.played += 1;
        self.goals_for += scored as u32;
        self.goals_against += conceded as u32;
        match scored.cmp(&conceded) {
            Ordering::Greater => {
                self.wins += 1;
                self.points += 3;
            }
            Ordering::Equal => {
                self.draws += 1;
                self.points += 1;
            }
            Ordering::Less => self.losses += 1,
        }
    }
}

/// Ranking order: points, wins, goal difference, goals for, club id.
pub fn compare_rows(a: &StandingRow, b: &StandingRow) -> Ordering {
    b.points
        .cmp(&a.points)
        .then(b.wins.cmp(&a.wins))
        .then(b.goal_difference().cmp(&a.goal_difference()))
        .then(b.goals_for.cmp(&a.goals_for))
        .then(a.club_id.cmp(&b.club_id))
}

/// Table for `club_ids`, using only played fixtures between those clubs.
pub fn compute_standings(club_ids: &[ClubId], fixtures: &[MatchFixture]) -> Vec<StandingRow> {
    let mut rows: BTreeMap<ClubId, StandingRow> =
        club_ids.iter().map(|&id| (id, StandingRow::new(id))).collect();
    for f in fixtures {
        let Some(r) = f.result else { continue };
        if !rows.contains_key(&f.home) || !rows.contains_key(&f.away) {
            continue;
        }
        rows.get_mut(&f.home).unwrap().record(r.home_goals, r.away_goals);
        rows.get_mut(&f.away).unwrap().record(r.away_goals, r.home_goals);
    }
    let mut table: Vec<StandingRow> = rows.into_values().collect();
    table.sort_by(compare_rows);
    for (i, row) in table.iter_mut().enumerate() {
        row.position = i as u16 + 1;
    }
    table
}
