//! Position, Skill and preferred-foot enums (see rea/02, section 2.A).

use crate::error::ModelError;
use serde::{Deserialize, Serialize};

/// Base tactical position. Codes match the original `.ban` encoding (`e.g.e`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Position {
    Goalkeeper,
    FullBack,
    CenterBack,
    Midfielder,
    Forward,
}

impl Position {
    /// Legacy numeric code: 0=GK, 1=lateral, 2=zagueiro, 3=volante/meia, 4=atacante.
    pub fn code(self) -> u8 {
        match self {
            Position::Goalkeeper => 0,
            Position::FullBack => 1,
            Position::CenterBack => 2,
            Position::Midfielder => 3,
            Position::Forward => 4,
        }
    }

    pub fn from_code(code: u8) -> Result<Self, ModelError> {
        Ok(match code {
            0 => Position::Goalkeeper,
            1 => Position::FullBack,
            2 => Position::CenterBack,
            3 => Position::Midfielder,
            4 => Position::Forward,
            n => return Err(ModelError::InvalidPositionCode(n)),
        })
    }
}

/// Player characteristic (`cr1` / `cr2`). The legacy ID table is only
/// partially documented (Desarme, Passe, Finalização, ...); codes here are
/// Champs Manager's own stable numbering, `0` being reserved for "none".
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Skill {
    Tackling,
    Passing,
    Finishing,
    Dribbling,
    Heading,
    Crossing,
    Saving,
    Pace,
    Stamina,
    Leadership,
}

impl Skill {
    pub fn code(self) -> u8 {
        match self {
            Skill::Tackling => 1,
            Skill::Passing => 2,
            Skill::Finishing => 3,
            Skill::Dribbling => 4,
            Skill::Heading => 5,
            Skill::Crossing => 6,
            Skill::Saving => 7,
            Skill::Pace => 8,
            Skill::Stamina => 9,
            Skill::Leadership => 10,
        }
    }

    /// `0` means "no skill" and maps to `Ok(None)`.
    pub fn from_code(code: u8) -> Result<Option<Self>, ModelError> {
        Ok(Some(match code {
            0 => return Ok(None),
            1 => Skill::Tackling,
            2 => Skill::Passing,
            3 => Skill::Finishing,
            4 => Skill::Dribbling,
            5 => Skill::Heading,
            6 => Skill::Crossing,
            7 => Skill::Saving,
            8 => Skill::Pace,
            9 => Skill::Stamina,
            10 => Skill::Leadership,
            n => return Err(ModelError::InvalidSkillCode(n)),
        }))
    }
}

/// Preferred side/foot (`e.g.i`): 0=right, 1=left, 2=both.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PreferredFoot {
    Right,
    Left,
    Both,
}

impl PreferredFoot {
    pub fn from_code(code: u8) -> Result<Self, ModelError> {
        Ok(match code {
            0 => PreferredFoot::Right,
            1 => PreferredFoot::Left,
            2 => PreferredFoot::Both,
            n => return Err(ModelError::InvalidFootCode(n)),
        })
    }
}
