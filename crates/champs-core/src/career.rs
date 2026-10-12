//! Career orchestration: plays league rounds (lineups, scores, fatigue,
//! cards, injuries, weekly recovery) and runs the season rollover.

use crate::condition::{self, PlayerStatus, RED_PROBABILITY};
use crate::error::ModelError;
use crate::market::Market;
use crate::player::{ClubId, PlayerId};
use crate::position::Position;
use crate::rng::CoreRng;
use crate::season::{FixtureId, SeasonState};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Career {
    pub season: SeasonState,
    pub market: Market,
    pub statuses: BTreeMap<PlayerId, PlayerStatus>,
    pub rng: CoreRng,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct RoundReport {
    pub round: u16,
    pub matches: u32,
    pub goals: u32,
    pub yellows: u32,
    pub reds: u32,
    pub injuries: u32,
    pub suspensions: u32,
    pub forfeits: u32,
}

/// Picks the starting eleven: the club's own lineup when all 11 are
/// available, otherwise the best available by current strength following the
/// formation (1 GK + defenders/midfielders/forwards). `None` if fewer than 11
/// players can play.
pub fn select_lineup(club: &crate::club::Club) -> Option<Vec<PlayerId>> {
    let t = &club.tactics;
    if t.lineup.len() == 11
        && t.lineup.iter().all(|id| club.squad.iter().any(|p| p.id == *id && p.is_available()))
    {
        return Some(t.lineup.clone());
    }
    let mut pool: Vec<_> = club.squad.iter().filter(|p| p.is_available()).collect();
    if pool.len() < 11 {
        return None;
    }
    pool.sort_by(|a, b| b.current_strength.cmp(&a.current_strength).then(a.id.cmp(&b.id)));
    let slots: [(&[Position], usize); 4] = [
        (&[Position::Goalkeeper], 1),
        (&[Position::CenterBack, Position::FullBack], t.formation.defenders as usize),
        (&[Position::Midfielder], t.formation.midfielders as usize),
        (&[Position::Forward], t.formation.forwards as usize),
    ];
    let mut chosen: Vec<PlayerId> = Vec::with_capacity(11);
    for (positions, n) in slots {
        chosen.extend(
            pool.iter().filter(|p| positions.contains(&p.position)).take(n).map(|p| p.id),
        );
    }
    // Fill holes with the best remaining players.
    for p in &pool {
        if chosen.len() >= 11 {
            break;
        }
        if !chosen.contains(&p.id) {
            chosen.push(p.id);
        }
    }
    chosen.truncate(11);
    Some(chosen)
}

/// (attack, defence) ratings of a lineup, floored to stay positive.
fn ratings(club: &crate::club::Club, lineup: &[PlayerId]) -> (f64, f64) {
    let (mut att, mut na, mut def, mut nd) = (0.0, 0.0, 0.0, 0.0);
    for id in lineup {
        let Some(p) = club.player(*id) else { continue };
        let s = p.current_strength as f64;
        match p.position {
            Position::Midfielder | Position::Forward => {
                att += s;
                na += 1.0;
            }
            _ => {
                def += s;
                nd += 1.0;
            }
        }
    }
    let avg = |sum: f64, n: f64| if n > 0.0 { (sum / n).max(1.0) } else { 30.0 };
    (avg(att, na), avg(def, nd))
}

impl Career {
    pub fn new(season: SeasonState, market: Market, seed: u64) -> Self {
        Self { season, market, statuses: BTreeMap::new(), rng: CoreRng::new(seed) }
    }

    pub fn status(&self, id: PlayerId) -> PlayerStatus {
        self.statuses.get(&id).copied().unwrap_or_default()
    }

    /// Highest scheduled round (0 without a calendar).
    pub fn last_round(&self) -> u16 {
        self.season.fixtures.iter().map(|f| f.round).max().unwrap_or(0)
    }

    /// Plays every unplayed fixture of the current week and advances it.
    /// Returns `None` when the calendar is finished.
    pub fn play_current_round(&mut self) -> Result<Option<RoundReport>, ModelError> {
        let round = self.season.week;
        if round > self.last_round() {
            return Ok(None);
        }
        self.play_round(round).map(Some)
    }

    /// Plays all rounds until the calendar ends.
    pub fn play_season(&mut self) -> Result<Vec<RoundReport>, ModelError> {
        let mut out = Vec::new();
        while let Some(r) = self.play_current_round()? {
            out.push(r);
        }
        Ok(out)
    }

    pub fn play_round(&mut self, round: u16) -> Result<RoundReport, ModelError> {
        let mut report = RoundReport { round, ..Default::default() };
        let fixtures: Vec<(FixtureId, ClubId, ClubId)> = self
            .season
            .fixtures
            .iter()
            .filter(|f| f.round == round && !f.is_played())
            .map(|f| (f.id, f.home, f.away))
            .collect();

        // Snapshot who is out at the start: only they serve time this round.
        let suspended_at_start: BTreeSet<PlayerId> = self
            .statuses
            .iter()
            .filter(|(_, s)| s.suspension_rounds > 0)
            .map(|(id, _)| *id)
            .collect();
        let injured_at_start: BTreeSet<PlayerId> = self
            .statuses
            .iter()
            .filter(|(_, s)| s.injury_rounds > 0)
            .map(|(id, _)| *id)
            .collect();
        let mut played: BTreeSet<PlayerId> = BTreeSet::new();
        let mut clubs_played: BTreeSet<ClubId> = BTreeSet::new();

        for (fid, home, away) in fixtures {
            let hc = self.season.club(home).ok_or(ModelError::ClubNotFound(home))?;
            let ac = self.season.club(away).ok_or(ModelError::ClubNotFound(away))?;
            let (hl, al) = (select_lineup(hc), select_lineup(ac));
            let (hg, ag) = match (&hl, &al) {
                (Some(h), Some(a)) => {
                    let (h_att, h_def) = ratings(hc, h);
                    let (a_att, a_def) = ratings(ac, a);
                    let lam_h = (1.45 * (h_att / a_def).powf(1.5)).clamp(0.2, 4.5);
                    let lam_a = (1.2 * (a_att / h_def).powf(1.5)).clamp(0.2, 4.5);
                    (
                        self.rng.poisson(lam_h).min(15) as u8,
                        self.rng.poisson(lam_a).min(15) as u8,
                    )
                }
                (Some(_), None) => {
                    report.forfeits += 1;
                    (3, 0)
                }
                (None, Some(_)) => {
                    report.forfeits += 1;
                    (0, 3)
                }
                (None, None) => {
                    report.forfeits += 1;
                    (0, 0)
                }
            };
            self.season.record_result(fid, hg, ag)?;
            report.matches += 1;
            report.goals += hg as u32 + ag as u32;
            for (cid, lineup) in [(home, hl), (away, al)] {
                clubs_played.insert(cid);
                if let Some(l) = lineup {
                    self.apply_match_effects(cid, &l, &mut report, &mut played);
                }
            }
        }

        // Weekly recovery and time served.
        let Career { season, statuses, .. } = self;
        for club in season.clubs.iter_mut() {
            let plays = clubs_played.contains(&club.id);
            for p in club.squad.iter_mut().chain(club.youth.iter_mut()) {
                condition::weekly_recovery(p, played.contains(&p.id));
                let Some(st) = statuses.get_mut(&p.id) else { continue };
                if plays && suspended_at_start.contains(&p.id) {
                    st.suspension_rounds = st.suspension_rounds.saturating_sub(1);
                }
                if injured_at_start.contains(&p.id) {
                    st.injury_rounds = st.injury_rounds.saturating_sub(1);
                }
                st.sync(p);
            }
        }
        statuses.retain(|_, s| *s != PlayerStatus::default());
        self.season.advance_week();
        Ok(report)
    }

    fn apply_match_effects(
        &mut self,
        club_id: ClubId,
        lineup: &[PlayerId],
        report: &mut RoundReport,
        played: &mut BTreeSet<PlayerId>,
    ) {
        let Career { season, statuses, rng, .. } = self;
        let Some(club) = season.club_mut(club_id) else { return };
        for pid in lineup {
            let Some(p) = club.player_mut(*pid) else { continue };
            played.insert(*pid);
            condition::apply_match_fatigue(p, rng);
            let st = statuses.entry(*pid).or_default();
            st.matches_played += 1;
            if rng.chance(condition::yellow_probability(p.position)) {
                report.yellows += 1;
                if st.add_yellow() {
                    report.suspensions += 1;
                }
            }
            if rng.chance(RED_PROBABILITY) {
                report.reds += 1;
                report.suspensions += 1;
                st.add_red(1 + rng.range(0, 2) as u8);
            }
            if rng.chance(condition::injury_probability(p)) {
                report.injuries += 1;
                st.injure(condition::roll_injury_weeks(rng));
            }
            st.sync(p);
        }
    }

    /// Season rollover: contracts expire, everyone ages a year, yellows
    /// reset, bodies recover fully. Returns released player ids.
    pub fn end_of_season(&mut self) -> Vec<PlayerId> {
        let released = self.market.process_contract_expiry(&mut self.season, &mut self.rng);
        for club in self.season.clubs.iter_mut() {
            for p in club.squad.iter_mut().chain(club.youth.iter_mut()) {
                p.age = p.age.saturating_add(1);
                p.energy = 100;
                condition::refresh_strength(p);
            }
        }
        for p in self.market.free_agents.iter_mut() {
            p.age = p.age.saturating_add(1);
        }
        for st in self.statuses.values_mut() {
            st.reset_season();
        }
        let Career { season, statuses, .. } = self;
        for club in season.clubs.iter_mut() {
            for p in club.squad.iter_mut().chain(club.youth.iter_mut()) {
                if let Some(st) = statuses.get(&p.id) {
                    st.sync(p);
                }
            }
        }
        self.statuses.retain(|_, s| *s != PlayerStatus::default());
        released
    }
}
