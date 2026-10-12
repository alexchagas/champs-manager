//! Runtime club model (see rea/02, section 3).

use crate::error::ModelError;
use crate::player::{ClubId, Player, PlayerId};
use crate::tactics::Tactics;
use serde::{Deserialize, Serialize};

/// Recommended limits from the original game's `.ban` templates.
pub const MAX_SQUAD: usize = 30;
pub const MAX_YOUTH: usize = 15;

/// An `#RRGGBB` color.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Color(pub u8, pub u8, pub u8);

impl Color {
    pub fn parse(s: &str) -> Result<Self, ModelError> {
        let err = || ModelError::InvalidColor(s.to_string());
        let h = s.strip_prefix('#').ok_or_else(err)?;
        if h.len() != 6 || !h.is_ascii() {
            return Err(err());
        }
        let p = |i: usize| u8::from_str_radix(&h[i..i + 2], 16).map_err(|_| err());
        Ok(Color(p(0)?, p(2)?, p(4)?))
    }

    pub fn to_hex(self) -> String {
        format!("#{:02X}{:02X}{:02X}", self.0, self.1, self.2)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Club {
    pub id: ClubId,
    pub name: String,
    pub file_ref: String,
    pub country_id: u32,
    pub state_id: u32,
    pub division_level: u32,
    pub stadium_name: String,
    pub stadium_capacity: u32,
    pub coach_name: String,
    pub coach_nationality: u32,
    pub primary_color: Color,
    pub secondary_color: Color,
    pub balance: i64,
    pub debt: u64,
    pub squad: Vec<Player>,
    pub youth: Vec<Player>,
    pub tactics: Tactics,
}

impl Club {
    pub fn new(id: ClubId, name: impl Into<String>) -> Self {
        let name = name.into();
        Self {
            id,
            file_ref: name.to_lowercase().replace(' ', "_"),
            name,
            country_id: 0,
            state_id: 0,
            division_level: 1,
            stadium_name: String::new(),
            stadium_capacity: 0,
            coach_name: String::new(),
            coach_nationality: 0,
            primary_color: Color(255, 255, 255),
            secondary_color: Color(0, 0, 0),
            balance: 0,
            debt: 0,
            squad: Vec::new(),
            youth: Vec::new(),
            tactics: Tactics::default(),
        }
    }

    fn has_player(&self, id: PlayerId) -> bool {
        self.squad.iter().chain(self.youth.iter()).any(|p| p.id == id)
    }

    /// Adds a player to the professional squad, binding it to this club.
    pub fn add_player(&mut self, mut player: Player) -> Result<(), ModelError> {
        if self.has_player(player.id) {
            return Err(ModelError::DuplicatePlayer(player.id));
        }
        if self.squad.len() >= MAX_SQUAD {
            return Err(ModelError::SquadFull(MAX_SQUAD));
        }
        player.club_id = Some(self.id);
        self.squad.push(player);
        Ok(())
    }

    pub fn add_youth_player(&mut self, mut player: Player) -> Result<(), ModelError> {
        if self.has_player(player.id) {
            return Err(ModelError::DuplicatePlayer(player.id));
        }
        if self.youth.len() >= MAX_YOUTH {
            return Err(ModelError::YouthFull(MAX_YOUTH));
        }
        player.club_id = Some(self.id);
        self.youth.push(player);
        Ok(())
    }

    /// Removes a player from the squad (or youth) and clears the club link.
    pub fn remove_player(&mut self, id: PlayerId) -> Result<Player, ModelError> {
        let mut p = if let Some(i) = self.squad.iter().position(|p| p.id == id) {
            self.squad.remove(i)
        } else if let Some(i) = self.youth.iter().position(|p| p.id == id) {
            self.youth.remove(i)
        } else {
            return Err(ModelError::PlayerNotFound(id));
        };
        p.club_id = None;
        self.tactics.lineup.retain(|&x| x != id);
        for slot in [
            &mut self.tactics.free_kick_taker,
            &mut self.tactics.penalty_taker,
            &mut self.tactics.corner_taker,
        ] {
            if *slot == Some(id) {
                *slot = None;
            }
        }
        Ok(p)
    }

    pub fn player(&self, id: PlayerId) -> Option<&Player> {
        self.squad.iter().chain(self.youth.iter()).find(|p| p.id == id)
    }

    pub fn player_mut(&mut self, id: PlayerId) -> Option<&mut Player> {
        self.squad.iter_mut().chain(self.youth.iter_mut()).find(|p| p.id == id)
    }

    /// Salary bill of the professional squad.
    pub fn payroll(&self) -> u64 {
        self.squad.iter().map(|p| p.salary).sum()
    }

    pub fn youth_payroll(&self) -> u64 {
        self.youth.iter().map(|p| p.salary).sum()
    }

    pub fn total_payroll(&self) -> u64 {
        self.payroll() + self.youth_payroll()
    }

    /// Average max strength of the professional squad (0.0 if empty).
    pub fn average_strength(&self) -> f64 {
        if self.squad.is_empty() {
            return 0.0;
        }
        self.squad.iter().map(|p| p.max_strength as f64).sum::<f64>() / self.squad.len() as f64
    }

    /// Promotes a player from the youth academy to the professional squad.
    pub fn promote_youth(&mut self, id: PlayerId) -> Result<(), ModelError> {
        if self.squad.len() >= MAX_SQUAD {
            return Err(ModelError::SquadFull(MAX_SQUAD));
        }
        let pos = self.youth.iter().position(|p| p.id == id).ok_or(ModelError::PlayerNotFound(id))?;
        let mut player = self.youth.remove(pos);
        player.club_id = Some(self.id);
        self.squad.push(player);
        Ok(())
    }

    /// Releases a player from the youth academy.
    pub fn release_youth(&mut self, id: PlayerId) -> Result<Player, ModelError> {
        let pos = self.youth.iter().position(|p| p.id == id).ok_or(ModelError::PlayerNotFound(id))?;
        let mut p = self.youth.remove(pos);
        p.club_id = None;
        Ok(p)
    }

    /// Expands stadium capacity, debiting the cost from club balance.
    pub fn expand_stadium(&mut self, seats: u32, cost: i64) -> Result<(), ModelError> {
        if self.balance < cost {
            return Err(ModelError::InsufficientBalance(cost, self.balance));
        }
        self.balance -= cost;
        self.stadium_capacity += seats;
        Ok(())
    }

    /// Borrows money from bank, crediting balance and increasing debt.
    pub fn take_loan(&mut self, amount: i64, total_debt: u64) {
        self.balance += amount;
        self.debt += total_debt;
    }

    /// Pays off debt, debiting balance and decreasing debt.
    pub fn pay_debt(&mut self, amount: u64) -> Result<(), ModelError> {
        let cost = amount as i64;
        if self.balance < cost {
            return Err(ModelError::InsufficientBalance(cost, self.balance));
        }
        self.balance -= cost;
        self.debt = self.debt.saturating_sub(amount);
        Ok(())
    }
}
