//! Runtime player model (see rea/02, sections 2.A and 2.B).

use crate::error::ModelError;
use crate::position::{Position, PreferredFoot, Skill};
use serde::{Deserialize, Serialize};

pub type PlayerId = u32;
pub type ClubId = u32;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Player {
    pub id: PlayerId,
    pub name: String,
    pub age: u8,
    pub nationality_id: u32,
    pub position: Position,
    pub primary_skill: Option<Skill>,
    pub secondary_skill: Option<Skill>,
    pub foot: PreferredFoot,
    pub is_star: bool,
    pub is_world_top: bool,
    /// Maximum strength, 1..=100.
    pub max_strength: u8,
    /// Current strength, 1..=100 (affected by condition/injury).
    pub current_strength: u8,
    /// Physical energy, 0..=100.
    pub energy: u8,
    pub is_starter: bool,
    pub salary: u64,
    pub market_value: u64,
    pub morale: f64,
    pub motivation: f64,
    pub injured: bool,
    pub suspended: bool,
    pub club_id: Option<ClubId>,
}

impl Player {
    /// Creates a fit player with full energy and neutral morale.
    pub fn new(
        id: PlayerId,
        name: impl Into<String>,
        age: u8,
        position: Position,
        strength: u8,
        salary: u64,
    ) -> Result<Self, ModelError> {
        Self::check_strength(strength)?;
        Ok(Self {
            id,
            name: name.into(),
            age,
            nationality_id: 0,
            position,
            primary_skill: None,
            secondary_skill: None,
            foot: PreferredFoot::Right,
            is_star: false,
            is_world_top: false,
            max_strength: strength,
            current_strength: strength,
            energy: 100,
            is_starter: false,
            salary,
            market_value: salary.saturating_mul(100),
            morale: 1.0,
            motivation: 1.0,
            injured: false,
            suspended: false,
            club_id: None,
        })
    }

    fn check_strength(s: u8) -> Result<(), ModelError> {
        if (1..=100).contains(&s) {
            Ok(())
        } else {
            Err(ModelError::InvalidStrength(s))
        }
    }

    pub fn with_skills(mut self, primary: Option<Skill>, secondary: Option<Skill>) -> Self {
        self.primary_skill = primary;
        self.secondary_skill = secondary;
        self
    }

    pub fn set_current_strength(&mut self, s: u8) -> Result<(), ModelError> {
        Self::check_strength(s)?;
        self.current_strength = s.min(self.max_strength);
        Ok(())
    }

    /// Whether the player can be fielded.
    pub fn is_available(&self) -> bool {
        !self.injured && !self.suspended
    }

    /// Spends energy in a match (saturating at 0).
    pub fn drain_energy(&mut self, amount: u8) {
        self.energy = self.energy.saturating_sub(amount);
    }

    /// Recovers energy (capped at 100).
    pub fn recover_energy(&mut self, amount: u8) {
        self.energy = self.energy.saturating_add(amount).min(100);
    }
}
