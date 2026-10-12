//! Champs Manager core domain: models and persistence.

pub mod calendar;
pub mod career;
pub mod club;
pub mod condition;
pub mod error;
pub mod market;
pub mod player;
pub mod position;
pub mod rng;
pub mod save;
pub mod season;
pub mod standings;
pub mod tactics;
pub mod wasm;


pub use club::{Club, Color, MAX_SQUAD, MAX_YOUTH};
pub use error::{ModelError, SaveError};
pub use player::{ClubId, Player, PlayerId};
pub use position::{Position, PreferredFoot, Skill};
pub use save::{SaveGame, SaveMetadata, SCHEMA_VERSION};
pub use season::{FixtureId, MatchFixture, MatchResult, SeasonState};
pub use tactics::{auto_select_best_lineup, Formation, Tactics};
pub use calendar::{
    generate_two_semester_calendar, CompetitionType, Cup, CupTie, Division, MatchDay,
    TwoLeggedTie,
};
pub use career::{Career, RoundReport};
pub use condition::PlayerStatus;
pub use market::{Market, MarketError, TransferOffer};
pub use rng::CoreRng;
pub use standings::{compute_standings, StandingRow};


pub mod web_match;
