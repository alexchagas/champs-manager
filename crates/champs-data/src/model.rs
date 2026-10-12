//! Native Champs Manager database model (`teams.json`).

use serde::{Deserialize, Serialize};

pub const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PositionKind {
    Goalkeeper,
    Fullback,
    CentreBack,
    Midfielder,
    Forward,
    Unknown,
}

impl PositionKind {
    pub fn from_code(c: i32) -> Self {
        match c {
            0 => Self::Goalkeeper,
            1 => Self::Fullback,
            2 => Self::CentreBack,
            3 => Self::Midfielder,
            4 => Self::Forward,
            _ => Self::Unknown,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FootKind {
    Right,
    Left,
    Both,
    Unknown,
}

impl FootKind {
    pub fn from_code(c: i32) -> Self {
        match c {
            0 => Self::Right,
            1 => Self::Left,
            2 => Self::Both,
            _ => Self::Unknown,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlayerRecord {
    /// Globally unique, deterministic id: `club_id * 100 + slot`
    /// (professionals use slots 0..49, juniors 50..99).
    pub id: u32,
    pub name: String,
    pub age: i32,
    pub nationality_id: i32,
    pub position: PositionKind,
    /// Raw Brasfoot position code (0..4).
    pub position_code: i32,
    pub starter: bool,
    pub star: bool,
    pub world_top: bool,
    /// Main characteristic id (`cr1`).
    pub trait1: i32,
    /// Secondary characteristic id (`cr2`).
    pub trait2: i32,
    pub foot: FootKind,
    /// Brasfoot's internal per-player hash (kept for fidelity).
    pub hash: i32,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct ClubAssets {
    pub crest: Option<String>,
    pub crest_mini: Option<String>,
    pub shirt: Option<String>,
    pub shirt2: Option<String>,
    pub shirt3: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ClubRecord {
    /// Unique Champs Manager club id (1-based, assigned in case-insensitive
    /// `file_ref` order, so it is stable for a given database).
    pub id: i32,
    /// `id` stored in the `.ban` file. NOT unique in Brasfoot's data (e.g.
    /// several clubs share 2101), so it is kept only for reference.
    pub source_id: i32,
    /// Brasfoot `vid` field.
    pub variant_id: i32,
    /// Brasfoot "reputacao" (`n`).
    pub reputation: i32,
    /// Brasfoot "corBase" (`o`): base colour/kit pattern index.
    pub base_color: i32,
    pub name: String,
    /// Base file name shared by `.ban`, crest and shirt images.
    pub file_ref: String,
    pub country_id: i32,
    pub state_id: i32,
    /// Brasfoot "nivel": initial division / reputation tier.
    pub level: i32,
    pub stadium: String,
    pub stadium_capacity: i32,
    pub coach: String,
    pub coach_nationality_id: i32,
    pub primary_color: String,
    pub secondary_color: String,
    pub valid: bool,
    pub squad: Vec<PlayerRecord>,
    pub youth: Vec<PlayerRecord>,
    pub assets: ClubAssets,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TeamsDatabase {
    pub schema_version: u32,
    pub source: String,
    pub clubs: Vec<ClubRecord>,
    /// National league pyramids (from `conf_ligas_nacionais/*.cfg`) with
    /// derived club membership.
    #[serde(default)]
    pub leagues: Vec<LeagueRecord>,
    /// Brazilian state federations (from `conf_estadual/*.ces`).
    #[serde(default)]
    pub states: Vec<StateRecord>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LeagueRecord {
    pub country_id: i32,
    /// League family name, e.g. "Brasileirão".
    pub name: String,
    /// 1 = top flight.
    pub division: i32,
    /// e.g. "Série A".
    pub division_name: String,
    /// Number of clubs the division is configured for.
    pub team_count: i32,
    pub groups: i32,
    pub relegated: i32,
    pub double_round: bool,
    /// Ids of the clubs placed in this division. Brasfoot's `.ban` files
    /// carry no explicit division; clubs of a country are ranked by `level`
    /// (then reputation, then name) and fill divisions in order.
    pub club_ids: Vec<i32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StateRecord {
    /// Matches `ClubRecord::state_id`.
    pub id: i32,
    /// Two-letter code taken from the `.ces` file name (e.g. "SP").
    pub code: String,
    pub divisions: i32,
}

impl TeamsDatabase {
    pub fn club(&self, id: i32) -> Option<&ClubRecord> {
        self.clubs.iter().find(|c| c.id == id)
    }
    pub fn club_by_file_ref(&self, file_ref: &str) -> Option<&ClubRecord> {
        self.clubs.iter().find(|c| c.file_ref == file_ref)
    }
    pub fn player_count(&self) -> usize {
        self.clubs
            .iter()
            .map(|c| c.squad.len() + c.youth.len())
            .sum()
    }
}
