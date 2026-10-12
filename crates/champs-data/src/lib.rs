//! `champs-data`: importer for Brasfoot 22-23 team databases.

pub mod error;
pub mod import;
pub mod javaser;
pub mod leagues;
pub mod model;

pub use error::DataError;
pub use import::{import_database, import_teams, load_json, save_json};
pub use model::*;
