//! Error types for champs-core.

use thiserror::Error;

/// Domain-level (model validation) errors.
#[derive(Debug, Error, PartialEq, Eq)]
pub enum ModelError {
    #[error("invalid position code: {0}")]
    InvalidPositionCode(u8),
    #[error("invalid skill code: {0}")]
    InvalidSkillCode(u8),
    #[error("invalid foot code: {0}")]
    InvalidFootCode(u8),
    #[error("strength must be within 1..=100, got {0}")]
    InvalidStrength(u8),
    #[error("invalid hex color: {0:?}")]
    InvalidColor(String),
    #[error("professional squad is full (max {0})")]
    SquadFull(usize),
    #[error("youth squad is full (max {0})")]
    YouthFull(usize),
    #[error("duplicate player id: {0}")]
    DuplicatePlayer(u32),
    #[error("duplicate club id: {0}")]
    DuplicateClub(u32),
    #[error("player not found: {0}")]
    PlayerNotFound(u32),
    #[error("club not found: {0}")]
    ClubNotFound(u32),
    #[error("formation must have 10 outfield players, got {0}")]
    InvalidFormation(u8),
    #[error("lineup must have exactly 11 distinct players, got {0}")]
    InvalidLineup(usize),
    #[error("a club cannot play against itself (club {0})")]
    SelfFixture(u32),
    #[error("fixture not found: {0}")]
    FixtureNotFound(u32),
    #[error("fixture {0} was already played")]
    FixtureAlreadyPlayed(u32),
    #[error("at least 2 clubs are required to build a calendar")]
    NotEnoughClubs,
    #[error("invalid division level: {0} (expected 1..=4)")]
    InvalidDivision(u32),
    #[error("cup tie not found: {0}")]
    CupTieNotFound(usize),
    #[error("cup tie {0} was already decided")]
    CupTieAlreadyDecided(usize),
    #[error("a level cup tie needs a decisive penalty shoot-out")]
    CupDrawNeedsPenalties,
    #[error("the cup is already finished")]
    CupFinished,
    #[error("insufficient balance: required {0}, available {1}")]
    InsufficientBalance(i64, i64),
    #[error("credit limit exceeded: requested {0}, available {1}")]
    CreditLimitExceeded(u64, u64),
}

/// Persistence errors (save/load/export).
#[derive(Debug, Error)]
pub enum SaveError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("binary encoding error: {0}")]
    Bincode(#[from] bincode::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("not a .cmsav file (bad magic bytes)")]
    BadMagic,
    #[error("unsupported schema version {found} (this build supports up to {supported})")]
    UnsupportedVersion { found: u32, supported: u32 },
    #[error("checksum mismatch: save file is corrupted")]
    ChecksumMismatch,
    #[error("save file truncated")]
    Truncated,
}
