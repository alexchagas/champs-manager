//! Physical condition and discipline: match fatigue, weekly recovery,
//! yellow-card accumulation (suspension every 3 yellows), red cards, injuries.

use crate::player::Player;
use crate::position::Position;
use crate::rng::CoreRng;
use serde::{Deserialize, Serialize};

/// Yellow cards that trigger a one-match suspension.
pub const YELLOWS_PER_SUSPENSION: u8 = 3;

/// Per-player health/discipline bookkeeping (kept outside `Player` so the
/// save schema of the base model is untouched).
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct PlayerStatus {
    /// Yellows accumulated towards the next suspension (always `< 3`).
    pub yellow_cards: u8,
    /// All yellows received this season.
    pub total_yellows: u16,
    /// Suspensions caused by yellow accumulation.
    pub yellow_suspensions: u16,
    pub red_cards: u8,
    /// Matches still to be missed.
    pub suspension_rounds: u8,
    /// Weeks still to recover.
    pub injury_rounds: u8,
    pub matches_played: u16,
}

impl PlayerStatus {
    /// Registers a yellow; returns `true` when it triggers a suspension.
    pub fn add_yellow(&mut self) -> bool {
        self.total_yellows += 1;
        self.yellow_cards += 1;
        if self.yellow_cards >= YELLOWS_PER_SUSPENSION {
            self.yellow_cards = 0;
            self.yellow_suspensions += 1;
            self.suspension_rounds = self.suspension_rounds.saturating_add(1);
            true
        } else {
            false
        }
    }

    pub fn add_red(&mut self, games: u8) {
        self.red_cards = self.red_cards.saturating_add(1);
        self.suspension_rounds = self.suspension_rounds.saturating_add(games.max(1));
    }

    pub fn injure(&mut self, weeks: u8) {
        self.injury_rounds = self.injury_rounds.max(weeks);
    }

    /// Mirrors the counters into the player's availability flags.
    pub fn sync(&self, p: &mut Player) {
        p.injured = self.injury_rounds > 0;
        p.suspended = self.suspension_rounds > 0;
    }

    /// Season rollover: yellows reset, availability counters kept.
    pub fn reset_season(&mut self) {
        self.yellow_cards = 0;
        self.total_yellows = 0;
        self.yellow_suspensions = 0;
        self.red_cards = 0;
        self.matches_played = 0;
    }
}

/// Recomputes `current_strength` from energy: 60% of max when exhausted,
/// 100% when fresh. Always within `1..=max_strength`.
pub fn refresh_strength(p: &mut Player) {
    let factor = 0.6 + 0.4 * (p.energy.min(100) as f64 / 100.0);
    let s = (p.max_strength as f64 * factor).round() as i64;
    p.current_strength = s.clamp(1, p.max_strength.max(1) as i64) as u8;
}

/// Energy spent in a full match (older players tire faster).
pub fn match_drain(p: &Player, rng: &mut CoreRng) -> u8 {
    let base = 24 + rng.range(0, 7) as u8;
    let age = if p.age >= 31 { 5 } else { 0 };
    base + age
}

pub fn apply_match_fatigue(p: &mut Player, rng: &mut CoreRng) {
    let d = match_drain(p, rng);
    p.drain_energy(d);
    refresh_strength(p);
}

/// Weekly recovery: slower after playing, faster when resting.
pub fn weekly_recovery(p: &mut Player, played: bool) {
    p.recover_energy(if played { 22 } else { 40 });
    refresh_strength(p);
}

pub fn yellow_probability(pos: Position) -> f64 {
    match pos {
        Position::Goalkeeper => 0.04,
        Position::CenterBack | Position::FullBack => 0.20,
        Position::Midfielder => 0.18,
        Position::Forward => 0.12,
    }
}

pub const RED_PROBABILITY: f64 = 0.004;

/// Injury chance per starter per match; doubles from fresh to exhausted.
pub fn injury_probability(p: &Player) -> f64 {
    0.012 * (1.0 + (100 - p.energy.min(100)) as f64 / 100.0)
}

/// Injury length in weeks (mostly short, occasionally long).
pub fn roll_injury_weeks(rng: &mut CoreRng) -> u8 {
    let r = rng.next_f64();
    if r < 0.70 {
        rng.range(1, 3) as u8
    } else if r < 0.95 {
        rng.range(3, 6) as u8
    } else {
        rng.range(6, 11) as u8
    }
}
