//! Fixtures and season state.

use crate::club::Club;
use crate::error::ModelError;
use crate::player::ClubId;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

pub type FixtureId = u32;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct MatchResult {
    pub home_goals: u8,
    pub away_goals: u8,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MatchFixture {
    pub id: FixtureId,
    pub round: u16,
    #[serde(default)]
    pub date: Option<String>,
    #[serde(default)]
    pub fixture_date_index: Option<u16>,
    #[serde(default)]
    pub competition_round: Option<String>,
    pub home: ClubId,
    pub away: ClubId,
    pub result: Option<MatchResult>,
    #[serde(default)]
    pub competition_type: Option<crate::calendar::CompetitionType>,
    #[serde(default)]
    pub competition_name: Option<String>,
    #[serde(default)]
    pub stage: Option<String>,
    #[serde(default)]
    pub match_day: Option<crate::calendar::MatchDay>,
    #[serde(default)]
    pub leg: Option<u8>,
}

impl MatchFixture {
    pub fn new(id: FixtureId, round: u16, home: ClubId, away: ClubId) -> Result<Self, ModelError> {
        if home == away {
            return Err(ModelError::SelfFixture(home));
        }
        Ok(Self {
            id,
            round,
            date: None,
            fixture_date_index: None,
            competition_round: None,
            home,
            away,
            result: None,
            competition_type: None,
            competition_name: None,
            stage: None,
            match_day: None,
            leg: None,
        })
    }

    pub fn with_competition(
        mut self,
        comp: crate::calendar::CompetitionType,
        name: impl Into<String>,
        stage: impl Into<String>,
        day: crate::calendar::MatchDay,
        leg: Option<u8>,
    ) -> Self {
        self.competition_type = Some(comp);
        self.competition_name = Some(name.into());
        self.stage = Some(stage.into());
        self.match_day = Some(day);
        self.leg = leg;
        self
    }

    pub fn is_played(&self) -> bool {
        self.result.is_some()
    }

    /// `None` for a draw or an unplayed match.
    pub fn winner(&self) -> Option<ClubId> {
        let r = self.result?;
        match r.home_goals.cmp(&r.away_goals) {
            std::cmp::Ordering::Greater => Some(self.home),
            std::cmp::Ordering::Less => Some(self.away),
            std::cmp::Ordering::Equal => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SeasonState {
    pub year: u16,
    pub week: u16,
    pub user_club: Option<ClubId>,
    pub clubs: Vec<Club>,
    pub fixtures: Vec<MatchFixture>,
}

impl SeasonState {
    pub fn new(year: u16) -> Self {
        Self { year, week: 1, user_club: None, clubs: Vec::new(), fixtures: Vec::new() }
    }

    pub fn add_club(&mut self, club: Club) -> Result<(), ModelError> {
        if self.clubs.iter().any(|c| c.id == club.id) {
            return Err(ModelError::DuplicateClub(club.id));
        }
        self.clubs.push(club);
        Ok(())
    }

    pub fn club(&self, id: ClubId) -> Option<&Club> {
        self.clubs.iter().find(|c| c.id == id)
    }

    pub fn club_mut(&mut self, id: ClubId) -> Option<&mut Club> {
        self.clubs.iter_mut().find(|c| c.id == id)
    }

    pub fn set_user_club(&mut self, id: ClubId) -> Result<(), ModelError> {
        if self.club(id).is_none() {
            return Err(ModelError::ClubNotFound(id));
        }
        self.user_club = Some(id);
        Ok(())
    }

    /// Sum of professional payrolls of all clubs.
    pub fn total_payroll(&self) -> u64 {
        self.clubs.iter().map(Club::payroll).sum()
    }

    /// Builds a double round-robin calendar (circle method) among all clubs,
    /// replacing existing fixtures. Rounds are numbered from 1.
    pub fn generate_round_robin(&mut self) -> Result<(), ModelError> {
        let ids: Vec<ClubId> = self.clubs.iter().map(|c| c.id).collect();
        self.fixtures = crate::calendar::double_round_robin(&ids, 1)?;
        Ok(())
    }

    /// Builds one double round-robin per division (Series A-D, by each
    /// club's `division_level`), replacing existing fixtures. Rounds of all
    /// divisions are aligned, so round `r` is played league-wide in week `r`.
    pub fn generate_division_calendars(&mut self) -> Result<(), ModelError> {
        let cals = crate::calendar::generate_division_calendars(&self.clubs)?;
        self.fixtures = cals.into_values().flatten().collect();
        Ok(())
    }

    /// Builds a two-semester season calendar:
    /// - 1st Semester: Campeonato Estadual
    /// - 2nd Semester: Campeonato Nacional
    /// - Continental Cup: Libertadores / Sul-Americana / Champions League on Wednesdays
    pub fn generate_two_semester_calendar(&mut self) -> Result<(), ModelError> {
        let user_id = self.user_club.unwrap_or_else(|| self.clubs.first().map(|c| c.id).unwrap_or(1));
        self.fixtures = crate::calendar::generate_two_semester_calendar_for_year(user_id, &self.clubs, 1, self.year)?;
        Ok(())
    }

    /// Standings filtered by a specific competition type (Estadual, Nacional, Libertadores, etc.)
    pub fn standings_for_competition(&self, comp: crate::calendar::CompetitionType) -> Vec<crate::standings::StandingRow> {
        let comp_fixtures: Vec<MatchFixture> = self
            .fixtures
            .iter()
            .filter(|f| f.competition_type == Some(comp))
            .cloned()
            .collect();
        let mut club_set = std::collections::BTreeSet::new();
        for f in &comp_fixtures {
            club_set.insert(f.home);
            club_set.insert(f.away);
        }
        let ids: Vec<ClubId> = club_set.into_iter().collect();
        crate::standings::compute_standings(&ids, &comp_fixtures)
    }


    /// Full table (tie-breaks: points, wins, goal difference, goals for).
    pub fn standings(&self) -> Vec<crate::standings::StandingRow> {
        let ids: Vec<ClubId> = self.clubs.iter().map(|c| c.id).collect();
        crate::standings::compute_standings(&ids, &self.fixtures)
    }

    /// Table of a single division.
    pub fn division_standings(&self, level: u32) -> Vec<crate::standings::StandingRow> {
        let ids: Vec<ClubId> =
            self.clubs.iter().filter(|c| c.division_level == level).map(|c| c.id).collect();
        crate::standings::compute_standings(&ids, &self.fixtures)
    }

    pub fn fixtures_in_round(&self, round: u16) -> impl Iterator<Item = &MatchFixture> {
        self.fixtures.iter().filter(move |f| f.round == round)
    }

    pub fn record_result(
        &mut self,
        fixture: FixtureId,
        home_goals: u8,
        away_goals: u8,
    ) -> Result<(), ModelError> {
        let f = self
            .fixtures
            .iter_mut()
            .find(|f| f.id == fixture)
            .ok_or(ModelError::FixtureNotFound(fixture))?;
        if f.is_played() {
            return Err(ModelError::FixtureAlreadyPlayed(fixture));
        }
        f.result = Some(MatchResult { home_goals, away_goals });
        Ok(())
    }

    /// Points table: (club id, points) sorted by points desc, then id.
    /// 3 for a win, 1 for a draw.
    pub fn points_table(&self) -> Vec<(ClubId, u32)> {
        let mut pts: Vec<(ClubId, u32)> = self.clubs.iter().map(|c| (c.id, 0)).collect();
        let mut add = |id: ClubId, n: u32| {
            if let Some(e) = pts.iter_mut().find(|e| e.0 == id) {
                e.1 += n;
            }
        };
        for f in self.fixtures.iter().filter(|f| f.is_played()) {
            match f.winner() {
                Some(w) => add(w, 3),
                None => {
                    add(f.home, 1);
                    add(f.away, 1);
                }
            }
        }
        pts.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
        pts
    }

    /// Advances to the next week.
    pub fn advance_week(&mut self) {
        self.week += 1;
    }

    /// Whether every pair of distinct clubs appears as the given fixture set.
    pub fn distinct_pairings(&self) -> usize {
        self.fixtures
            .iter()
            .map(|f| (f.home.min(f.away), f.home.max(f.away)))
            .collect::<HashSet<_>>()
            .len()
    }
}
