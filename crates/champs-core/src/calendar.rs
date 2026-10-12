//! Calendar generation: double round-robin leagues (Series A-D) and
//! single-elimination cups.

use crate::club::Club;
use crate::error::ModelError;
use crate::player::ClubId;
use crate::rng::CoreRng;
use crate::season::{FixtureId, MatchFixture, MatchResult};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

/// National league tiers (`Club::division_level` 1..=4).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum Division {
    A,
    B,
    C,
    D,
}

impl Division {
    pub const ALL: [Division; 4] = [Division::A, Division::B, Division::C, Division::D];

    pub fn level(self) -> u32 {
        match self {
            Division::A => 1,
            Division::B => 2,
            Division::C => 3,
            Division::D => 4,
        }
    }

    pub fn from_level(level: u32) -> Option<Self> {
        Self::ALL.iter().copied().find(|d| d.level() == level)
    }
}

/// Builds a double round-robin (circle method): each pair meets twice, once
/// at each venue, with rounds `1..=n-1` (first leg) and `n..=2(n-1)` (second
/// leg, venues swapped). Odd numbers of clubs get a bye each round.
pub fn double_round_robin(
    club_ids: &[ClubId],
    first_fixture_id: FixtureId,
) -> Result<Vec<MatchFixture>, ModelError> {
    let unique: BTreeSet<_> = club_ids.iter().collect();
    if unique.len() != club_ids.len() {
        let mut seen = BTreeSet::new();
        let dup = club_ids.iter().find(|id| !seen.insert(**id)).copied().unwrap_or(0);
        return Err(ModelError::DuplicateClub(dup));
    }
    let mut ids: Vec<Option<ClubId>> = club_ids.iter().map(|&c| Some(c)).collect();
    if ids.len() < 2 {
        return Err(ModelError::NotEnoughClubs);
    }
    if ids.len() % 2 == 1 {
        ids.push(None);
    }
    let n = ids.len();
    let rounds = n - 1;
    let mut first_leg: Vec<(u16, ClubId, ClubId)> = Vec::new();
    for r in 0..rounds {
        for i in 0..n / 2 {
            if let (Some(a), Some(b)) = (ids[i], ids[n - 1 - i]) {
                let (h, v) = if (r + i) % 2 == 0 { (a, b) } else { (b, a) };
                first_leg.push((r as u16 + 1, h, v));
            }
        }
        let last = ids.pop().expect("non-empty");
        ids.insert(1, last);
    }
    let second_leg: Vec<_> =
        first_leg.iter().map(|&(r, h, v)| (r + rounds as u16, v, h)).collect();
    let mut out = Vec::with_capacity(first_leg.len() * 2);
    let mut next_id = first_fixture_id;
    for (round, h, v) in first_leg.into_iter().chain(second_leg) {
        out.push(MatchFixture::new(next_id, round, h, v)?);
        next_id += 1;
    }
    Ok(out)
}

/// Fixture-id block reserved for a division, so ids never collide.
pub fn division_first_fixture_id(div: Division) -> FixtureId {
    div.level() * 10_000 + 1
}

/// One double round-robin calendar per populated division. Clubs whose
/// `division_level` is outside 1..=4 are rejected; a division with a single
/// club cannot form a league.
pub fn generate_division_calendars(
    clubs: &[Club],
) -> Result<BTreeMap<Division, Vec<MatchFixture>>, ModelError> {
    let mut groups: BTreeMap<Division, Vec<ClubId>> = BTreeMap::new();
    for c in clubs {
        let d = Division::from_level(c.division_level)
            .ok_or(ModelError::InvalidDivision(c.division_level))?;
        groups.entry(d).or_default().push(c.id);
    }
    let mut out = BTreeMap::new();
    for (d, ids) in groups {
        out.insert(d, double_round_robin(&ids, division_first_fixture_id(d))?);
    }
    Ok(out)
}

// ---------------------------------------------------------------- cups

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CupTie {
    pub home: ClubId,
    /// `None` means `home` advances on a bye.
    pub away: Option<ClubId>,
    pub result: Option<MatchResult>,
    /// Shoot-out score `(home, away)`; required when the tie ended level.
    pub penalties: Option<(u8, u8)>,
}

impl CupTie {
    pub fn is_decided(&self) -> bool {
        self.winner().is_some()
    }

    pub fn winner(&self) -> Option<ClubId> {
        let Some(away) = self.away else { return Some(self.home) };
        let r = self.result?;
        match r.home_goals.cmp(&r.away_goals) {
            std::cmp::Ordering::Greater => Some(self.home),
            std::cmp::Ordering::Less => Some(away),
            std::cmp::Ordering::Equal => {
                let (h, a) = self.penalties?;
                if h > a {
                    Some(self.home)
                } else {
                    Some(away)
                }
            }
        }
    }
}

/// Single-leg knockout cup. Non power-of-two fields give byes in round 1.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Cup {
    pub name: String,
    pub rounds: Vec<Vec<CupTie>>,
    pub champion: Option<ClubId>,
}

impl Cup {
    pub fn new(name: impl Into<String>, club_ids: &[ClubId], rng: &mut CoreRng) -> Result<Self, ModelError> {
        let unique: BTreeSet<_> = club_ids.iter().collect();
        if unique.len() != club_ids.len() {
            return Err(ModelError::DuplicateClub(0));
        }
        if club_ids.len() < 2 {
            return Err(ModelError::NotEnoughClubs);
        }
        let mut ids = club_ids.to_vec();
        rng.shuffle(&mut ids);
        let byes = ids.len().next_power_of_two() - ids.len();
        let mut ties = Vec::new();
        for &id in &ids[..byes] {
            ties.push(CupTie { home: id, away: None, result: None, penalties: None });
        }
        for pair in ids[byes..].chunks(2) {
            ties.push(CupTie { home: pair[0], away: Some(pair[1]), result: None, penalties: None });
        }
        let mut cup = Cup { name: name.into(), rounds: vec![ties], champion: None };
        cup.advance_if_complete();
        Ok(cup)
    }

    /// Index of the round currently being played (`None` once finished).
    pub fn current_round(&self) -> Option<usize> {
        if self.champion.is_some() {
            None
        } else {
            Some(self.rounds.len() - 1)
        }
    }

    /// Indices (within the current round) of ties still to be played.
    pub fn pending_ties(&self) -> Vec<usize> {
        match self.current_round() {
            Some(r) => self.rounds[r]
                .iter()
                .enumerate()
                .filter(|(_, t)| !t.is_decided())
                .map(|(i, _)| i)
                .collect(),
            None => Vec::new(),
        }
    }

    /// Records a tie result in the current round and builds the next round
    /// when this one completes. A level score needs a decisive shoot-out.
    pub fn record(
        &mut self,
        tie: usize,
        home_goals: u8,
        away_goals: u8,
        penalties: Option<(u8, u8)>,
    ) -> Result<(), ModelError> {
        let r = self.current_round().ok_or(ModelError::CupFinished)?;
        let t = self.rounds[r].get_mut(tie).ok_or(ModelError::CupTieNotFound(tie))?;
        if t.is_decided() {
            return Err(ModelError::CupTieAlreadyDecided(tie));
        }
        if home_goals == away_goals {
            match penalties {
                None => return Err(ModelError::CupDrawNeedsPenalties),
                Some((h, a)) if h == a => return Err(ModelError::CupDrawNeedsPenalties),
                _ => {}
            }
        }
        t.result = Some(MatchResult { home_goals, away_goals });
        t.penalties = if home_goals == away_goals { penalties } else { None };
        self.advance_if_complete();
        Ok(())
    }

    fn advance_if_complete(&mut self) {
        while self.champion.is_none() {
            let last = self.rounds.last().expect("at least one round");
            if !last.iter().all(CupTie::is_decided) {
                return;
            }
            let winners: Vec<ClubId> = last.iter().filter_map(CupTie::winner).collect();
            if winners.len() == 1 {
                self.champion = Some(winners[0]);
                return;
            }
            let next = winners
                .chunks(2)
                .map(|p| CupTie { home: p[0], away: Some(p[1]), result: None, penalties: None })
                .collect();
            self.rounds.push(next);
        }
    }
}

// ------------------------------------------------ Two-Semester & Continental Tournaments

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CompetitionType {
    Estadual,
    Nacional,
    Copa,
    Libertadores,
    SulAmericana,
    #[serde(rename = "champions")]
    ChampionsLeague,
}

impl CompetitionType {
    pub fn name(self) -> &'static str {
        match self {
            CompetitionType::Estadual => "Campeonato Estadual",
            CompetitionType::Nacional => "Campeonato Nacional",
            CompetitionType::Copa => "Copa do Brasil",
            CompetitionType::Libertadores => "Copa Libertadores",
            CompetitionType::SulAmericana => "Copa Sul-Americana",
            CompetitionType::ChampionsLeague => "UEFA Champions League",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum MatchDay {
    #[serde(rename = "domingo")]
    Weekend,
    #[serde(rename = "quarta")]
    Midweek, // Wednesday (Quartas-feiras)
    #[serde(rename = "quinta")]
    Thursday,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TwoLeggedTie {
    pub id: u32,
    pub home: ClubId,
    pub away: ClubId,
    pub leg1_result: Option<MatchResult>,
    pub leg2_result: Option<MatchResult>,
    pub penalties: Option<(u8, u8)>,
}

impl TwoLeggedTie {
    pub fn new(id: u32, home: ClubId, away: ClubId) -> Self {
        Self {
            id,
            home,
            away,
            leg1_result: None,
            leg2_result: None,
            penalties: None,
        }
    }

    pub fn is_decided(&self) -> bool {
        self.winner().is_some()
    }

    pub fn aggregate_score(&self) -> Option<(u8, u8)> {
        let l1 = self.leg1_result?;
        let l2 = self.leg2_result?;
        // Leg 1: home played at home (l1.home_goals), away played away (l1.away_goals)
        // Leg 2: away played at home (l2.home_goals), home played away (l2.away_goals)
        let home_agg = l1.home_goals + l2.away_goals;
        let away_agg = l1.away_goals + l2.home_goals;
        Some((home_agg, away_agg))
    }

    pub fn winner(&self) -> Option<ClubId> {
        let (home_agg, away_agg) = self.aggregate_score()?;
        match home_agg.cmp(&away_agg) {
            std::cmp::Ordering::Greater => Some(self.home),
            std::cmp::Ordering::Less => Some(self.away),
            std::cmp::Ordering::Equal => {
                let (h, a) = self.penalties?;
                if h > a {
                    Some(self.home)
                } else {
                    Some(self.away)
                }
            }
        }
    }
}

/// Helper mapping state id/code to common tournament name
pub fn state_championship_name(state_id: u32) -> &'static str {
    match state_id {
        25 => "Campeonato Paulista",
        18 => "Campeonato Carioca",
        11 => "Campeonato Mineiro",
        22 => "Campeonato Gaúcho",
        17 => "Campeonato Paranaense",
        23 => "Campeonato Catarinense",
        5 => "Campeonato Baiano",
        16 => "Campeonato Pernambucano",
        6 => "Campeonato Cearense",
        9 => "Campeonato Goiano",
        _ => "Campeonato Estadual",
    }
}

/// Builds a season in chronological date slots with local rounds for each competition.
pub fn generate_two_semester_calendar(
    user_club_id: ClubId,
    clubs: &[Club],
    first_fixture_id: FixtureId,
) -> Result<Vec<MatchFixture>, ModelError> {
    generate_two_semester_calendar_for_year(user_club_id, clubs, first_fixture_id, 2026)
}

pub fn generate_two_semester_calendar_for_year(
    user_club_id: ClubId,
    clubs: &[Club],
    first_fixture_id: FixtureId,
    year: u16,
) -> Result<Vec<MatchFixture>, ModelError> {
    let mut fixtures: Vec<MatchFixture> = Vec::new();
    let mut next_id = first_fixture_id;

    let user_club = clubs.iter().find(|c| c.id == user_club_id).cloned();
    let is_brazil = user_club.as_ref().map(|c| c.country_id == 29).unwrap_or(false);
    let state_id = user_club.as_ref().map(|c| c.state_id).unwrap_or(25);
    let estadual_name = state_championship_name(state_id);

    // Brazilian state clubs must share the user's state and country.
    let mut state_clubs: Vec<ClubId> = clubs
        .iter()
        .filter(|c| is_brazil && c.country_id == 29 && c.state_id == state_id)
        .map(|c| c.id)
        .collect();

    if let Some(position) = state_clubs.iter().position(|id| *id == user_club_id) {
        state_clubs.swap(0, position);
    }
    state_clubs.truncate(12);

    // Generate Estadual round-robin (or double round-robin up to round 14)
    if state_clubs.len() >= 2 {
        let estadual_raw = double_round_robin(&state_clubs, next_id)?;
        next_id += estadual_raw.len() as u32;
        let group_rounds = if state_clubs.len() % 2 == 0 { state_clubs.len() - 1 } else { state_clubs.len() };
        for fix in estadual_raw.into_iter().filter(|f| f.round as usize <= group_rounds) {
            let label = format!("Rodada {}", fix.round);
            fixtures.push(fix.with_competition(CompetitionType::Estadual, estadual_name, label, MatchDay::Weekend, None));
        }
        if state_clubs.len() >= 4 {
            let pairs = [(state_clubs[0], state_clubs[3]), (state_clubs[1], state_clubs[2])];
            for leg in 1..=2u16 {
                for (a, b) in pairs {
                    let (home, away) = if leg == 1 { (a, b) } else { (b, a) };
                    fixtures.push(MatchFixture::new(next_id, group_rounds as u16 + leg, home, away)?
                        .with_competition(CompetitionType::Estadual, estadual_name, "Semifinal", MatchDay::Weekend, Some(leg as u8)));
                    next_id += 1;
                }
            }
            fixtures.push(MatchFixture::new(next_id, group_rounds as u16 + 3, state_clubs[0], state_clubs[1])?
                .with_competition(CompetitionType::Estadual, estadual_name, "Final", MatchDay::Weekend, None));
            next_id += 1;
        }
    }

    // National league fixtures keep all of their own rounds.
    let user_div = user_club.as_ref().map(|c| c.division_level).unwrap_or(1);
    let mut nat_clubs: Vec<ClubId> = clubs
        .iter()
        .filter(|c| c.division_level == user_div && user_club.as_ref().map(|u| c.country_id == u.country_id).unwrap_or(false))
        .map(|c| c.id)
        .collect();

    if nat_clubs.len() < 2 {
        nat_clubs = clubs.iter().filter(|c| user_club.as_ref().map(|u| c.country_id == u.country_id).unwrap_or(false)).take(20).map(|c| c.id).collect();
    }
    if !nat_clubs.contains(&user_club_id) {
        nat_clubs[0] = user_club_id;
    }

    let nat_raw = double_round_robin(&nat_clubs, next_id)?;
    next_id += nat_raw.len() as u32;

    let div_letter = match user_div {
        1 => "A",
        2 => "B",
        3 => "C",
        _ => "D",
    };
    let nat_comp_name = if is_brazil {
        format!("Brasileirão Série {}", div_letter)
    } else {
        "Campeonato Nacional".to_string()
    };

    for fix in nat_raw {
        let stage_str = format!("Rodada {}", fix.round);
        fixtures.push(
            fix.with_competition(
                CompetitionType::Nacional,
                &nat_comp_name,
                stage_str,
                MatchDay::Weekend,
                None,
            )
        );
    }

    // 3. CONTINENTAL CUP: LIBERTADORES / SUL-AMERICANA / CHAMPIONS LEAGUE (Wednesdays / Quartas-feiras)
    // 4 groups of 4 or 8 clubs in continental pool
    let continental_clubs: Vec<ClubId> = std::iter::once(user_club_id).chain(clubs.iter()
        .filter(|c| c.id != user_club_id && user_club.as_ref().map(|u| c.country_id == u.country_id).unwrap_or(false))
        .take(3).map(|c| c.id)).collect();
    if continental_clubs.len() >= 4 {
        let comp_type = if is_brazil { CompetitionType::Libertadores } else { CompetitionType::ChampionsLeague };
        let comp_name = comp_type.name();

        // 3.A. Fase de Grupos (6 match days on Wednesdays: rounds 3, 5, 7, 9, 11, 13)
        let group_pool: Vec<ClubId> = continental_clubs.iter().take(4).copied().collect();
        let group_raw = double_round_robin(&group_pool, next_id)?;
        next_id += group_raw.len() as u32;

        for (i, mut fix) in group_raw.into_iter().enumerate() {
            let r_idx = (i / (group_pool.len() / 2)).min(5);
            fix.round = r_idx as u16 + 1;
            fixtures.push(
                fix.with_competition(
                    comp_type,
                    comp_name,
                    format!("Fase de Grupos • Rodada {}", r_idx + 1),
                    MatchDay::Midweek,
                    None,
                )
            );
        }

        // 3.B. Mata-Mata em Jogos de Ida e Volta nas Quartas-Feiras do 2º Semestre
        // Quartas: Ida (round 17), Volta (round 19)
        // Semifinal: Ida (round 23), Volta (round 25)
        // Final: Ida (round 29), Volta (round 31)
        let knockout_stages = [
            ("Quartas de Final", 7u16, 8u16, group_pool[1]),
            ("Semifinal", 9u16, 10u16, group_pool[2]),
            ("Final", 11u16, 12u16, group_pool[3]),
        ];

        for (stage_name, ida_round, volta_round, opponent) in knockout_stages {
            let team_a = user_club_id;
            let team_b = opponent;
                // Leg 1 (Ida) - Wednesday
                let fix_ida = MatchFixture::new(next_id, ida_round, team_a, team_b)?
                    .with_competition(
                        comp_type,
                        comp_name,
                        format!("{} (Ida)", stage_name),
                        MatchDay::Midweek,
                        Some(1),
                    );
                next_id += 1;
                fixtures.push(fix_ida);

                // Leg 2 (Volta) - Wednesday
                let fix_volta = MatchFixture::new(next_id, volta_round, team_b, team_a)?
                    .with_competition(
                        comp_type,
                        comp_name,
                        format!("{} (Volta)", stage_name),
                        MatchDay::Midweek,
                        Some(2),
                    );
                next_id += 1;
                fixtures.push(fix_volta);
        }
    }

    if nat_clubs.len() >= 2 {
        for (i, opponent) in nat_clubs.iter().copied().filter(|id| *id != user_club_id).take(4).enumerate() {
            let (home, away) = if i % 2 == 0 { (user_club_id, opponent) } else { (opponent, user_club_id) };
            fixtures.push(MatchFixture::new(next_id, i as u16 + 1, home, away)?
                .with_competition(CompetitionType::Copa, if is_brazil { "Copa do Brasil" } else { "Copa Nacional" },
                    ["Primeira Fase", "Oitavas de Final", "Quartas de Final", "Semifinal"][i], MatchDay::Thursday, None));
            next_id += 1;
        }
    }

    // A Sunday is a league or state slot; midweek fixtures receive a separate slot.
    let national_start = if is_brazil { 14u16 } else { 0u16 };
    for fixture in &mut fixtures {
        let (week, offset) = match fixture.competition_type {
            Some(CompetitionType::Estadual) => (fixture.round.saturating_sub(1), 0),
            Some(CompetitionType::Nacional) => (national_start + fixture.round - 1, 0),
            Some(CompetitionType::Copa) => (national_start + (fixture.round - 1) * 4 + 1, 4),
            _ => (national_start + fixture.round * 2, 3),
        };
        fixture.date = Some(calendar_date(year, week, offset));
        fixture.competition_round = fixture.stage.clone();
    }
    fixtures.sort_by(|a, b| a.date.cmp(&b.date).then(a.id.cmp(&b.id)));
    let mut date_index = 0u16;
    let mut last_date = None;
    for fixture in &mut fixtures {
        if fixture.date != last_date { date_index += 1; last_date = fixture.date.clone(); }
        fixture.fixture_date_index = Some(date_index);
    }

    Ok(fixtures)
}

fn calendar_date(year: u16, week: u16, offset: u16) -> String {
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let first_sunday = 1 + (7 - weekday(year as i32, 1, 1)) % 7;
    let mut day = first_sunday + week as u32 * 7 + offset as u32;
    let mut y = year as u32;
    loop {
        let days = if y % 4 == 0 && (y % 100 != 0 || y % 400 == 0) { 366 } else { 365 };
        if day <= days { break; }
        day -= days;
        y += 1;
    }
    let months = [31, if leap && y == year as u32 { 29 } else if y % 4 == 0 && (y % 100 != 0 || y % 400 == 0) { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut month = 1;
    for length in months {
        if day <= length { break; }
        day -= length;
        month += 1;
    }
    format!("{y:04}-{month:02}-{day:02}")
}

// Sunday = 0; proleptic Gregorian calendar.
fn weekday(year: i32, month: i32, day: i32) -> u32 {
    let (year, month) = if month < 3 { (year - 1, month + 12) } else { (year, month) };
    let k = year % 100;
    let j = year / 100;
    ((day + 13 * (month + 1) / 5 + k + k / 4 + j / 4 + 5 * j + 6) % 7) as u32
}

