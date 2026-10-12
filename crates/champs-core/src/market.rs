//! Transfer market: free agents, purchases, AI proposals, contract renewal.

use crate::club::{MAX_SQUAD};
use crate::error::ModelError;
use crate::player::{ClubId, Player, PlayerId};
use crate::position::Position;
use crate::rng::CoreRng;
use crate::season::SeasonState;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use thiserror::Error;

/// A club can never be reduced below this many professionals by a sale/release.
pub const MIN_SQUAD: usize = 16;
pub const MAX_CONTRACT_YEARS: u8 = 5;
/// AI clubs try to keep at least this many professionals.
pub const AI_TARGET_SQUAD: usize = 22;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum MarketError {
    #[error(transparent)]
    Model(#[from] ModelError),
    #[error("free agent not found: {0}")]
    FreeAgentNotFound(PlayerId),
    #[error("insufficient funds: need {needed}, club has {available}")]
    InsufficientFunds { needed: u64, available: i64 },
    #[error("offer too low, asking price is {asking}")]
    OfferTooLow { asking: u64 },
    #[error("club {0} would drop below the minimum squad size")]
    SquadTooSmall(ClubId),
    #[error("buyer and seller are the same club")]
    SameClub,
    #[error("player {0} does not belong to a club")]
    PlayerHasNoClub(PlayerId),
    #[error("transfer offer not found: {0}")]
    OfferNotFound(u32),
    #[error("contract length must be within 1..={MAX_CONTRACT_YEARS} years, got {0}")]
    InvalidContractYears(u8),
    #[error("salary too low, the player demands at least {demanded}")]
    SalaryTooLow { demanded: u64 },
}

/// A bid from `from_club` for a player of `to_club`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TransferOffer {
    pub id: u32,
    pub from_club: ClubId,
    pub to_club: ClubId,
    pub player_id: PlayerId,
    pub fee: u64,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Market {
    pub free_agents: Vec<Player>,
    /// Remaining contract years per player.
    pub contracts: BTreeMap<PlayerId, u8>,
    /// Pending proposals made to the user's club.
    pub offers: Vec<TransferOffer>,
    next_offer_id: u32,
}

/// What the AI did in one transfer window.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct WindowReport {
    pub signings: u32,
    pub purchases: u32,
}

/// Seller's asking price: youngsters cost more, veterans less.
pub fn calculate_asking_price(market_value: u64, age: u8) -> u64 {
    if age <= 23 {
        market_value.saturating_mul(12) / 10
    } else if age >= 32 {
        market_value.saturating_mul(7) / 10
    } else {
        market_value
    }
}

pub fn asking_price(p: &Player) -> u64 {
    calculate_asking_price(p.market_value, p.age)
}

/// Minimum salary the player accepts to renew or sign.
pub fn calculate_demanded_salary(salary: u64, market_value: u64, morale: f64) -> u64 {
    let base = salary.max(market_value / 100);
    if morale < 0.8 {
        base.saturating_mul(11) / 10
    } else {
        base
    }
}

pub fn demanded_salary(p: &Player) -> u64 {
    calculate_demanded_salary(p.salary, p.market_value, p.morale)
}

fn can_afford(balance: i64, needed: u64) -> bool {
    balance as i128 >= needed as i128
}

impl Market {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn contract_years(&self, id: PlayerId) -> u8 {
        self.contracts.get(&id).copied().unwrap_or(0)
    }

    /// Gives every player without a contract 1..=3 years.
    pub fn init_contracts(&mut self, season: &SeasonState, rng: &mut CoreRng) {
        for c in &season.clubs {
            for p in c.squad.iter().chain(c.youth.iter()) {
                self.contracts.entry(p.id).or_insert_with(|| rng.range(1, 4) as u8);
            }
        }
    }

    pub fn add_free_agent(&mut self, mut p: Player) {
        p.club_id = None;
        self.free_agents.push(p);
    }

    /// Signs a free agent: no fee, but a signing bonus equal to one salary.
    pub fn sign_free_agent(
        &mut self,
        season: &mut SeasonState,
        club_id: ClubId,
        player_id: PlayerId,
        years: u8,
    ) -> Result<(), MarketError> {
        if !(1..=MAX_CONTRACT_YEARS).contains(&years) {
            return Err(MarketError::InvalidContractYears(years));
        }
        let idx = self
            .free_agents
            .iter()
            .position(|p| p.id == player_id)
            .ok_or(MarketError::FreeAgentNotFound(player_id))?;
        let bonus = self.free_agents[idx].salary;
        let club = season.club_mut(club_id).ok_or(ModelError::ClubNotFound(club_id))?;
        if !can_afford(club.balance, bonus) {
            return Err(MarketError::InsufficientFunds { needed: bonus, available: club.balance });
        }
        let p = self.free_agents[idx].clone();
        club.add_player(p)?; // validates squad limit / duplicates
        club.balance -= bonus as i64;
        self.free_agents.remove(idx);
        self.contracts.insert(player_id, years);
        Ok(())
    }

    /// Releases a player into the free-agent pool.
    pub fn release_player(
        &mut self,
        season: &mut SeasonState,
        club_id: ClubId,
        player_id: PlayerId,
    ) -> Result<(), MarketError> {
        let club = season.club_mut(club_id).ok_or(ModelError::ClubNotFound(club_id))?;
        if club.squad.len() <= MIN_SQUAD && club.squad.iter().any(|p| p.id == player_id) {
            return Err(MarketError::SquadTooSmall(club_id));
        }
        let mut p = club.remove_player(player_id)?;
        p.is_starter = false;
        self.contracts.remove(&player_id);
        self.free_agents.push(p);
        Ok(())
    }

    fn execute_transfer(
        &mut self,
        season: &mut SeasonState,
        player_id: PlayerId,
        buyer: ClubId,
        seller: ClubId,
        fee: u64,
    ) -> Result<(), MarketError> {
        if buyer == seller {
            return Err(MarketError::SameClub);
        }
        let b = season.club(buyer).ok_or(ModelError::ClubNotFound(buyer))?;
        let s = season.club(seller).ok_or(ModelError::ClubNotFound(seller))?;
        if !s.squad.iter().any(|p| p.id == player_id) {
            return Err(ModelError::PlayerNotFound(player_id).into());
        }
        if s.squad.len() <= MIN_SQUAD {
            return Err(MarketError::SquadTooSmall(seller));
        }
        if b.squad.len() >= MAX_SQUAD {
            return Err(ModelError::SquadFull(MAX_SQUAD).into());
        }
        if !can_afford(b.balance, fee) {
            return Err(MarketError::InsufficientFunds { needed: fee, available: b.balance });
        }
        let mut p = season.club_mut(seller).unwrap().remove_player(player_id)?;
        p.is_starter = false;
        season.club_mut(seller).unwrap().balance += fee as i64;
        let bc = season.club_mut(buyer).unwrap();
        bc.balance -= fee as i64;
        bc.add_player(p)?;
        self.contracts.insert(player_id, 3);
        self.offers.retain(|o| o.player_id != player_id);
        Ok(())
    }

    /// Buys a player from another club; `fee` must meet the asking price.
    pub fn buy_player(
        &mut self,
        season: &mut SeasonState,
        buyer: ClubId,
        player_id: PlayerId,
        fee: u64,
    ) -> Result<(), MarketError> {
        let seller = season
            .clubs
            .iter()
            .find(|c| c.squad.iter().any(|p| p.id == player_id))
            .map(|c| c.id)
            .ok_or(MarketError::PlayerHasNoClub(player_id))?;
        let asking = asking_price(season.club(seller).unwrap().player(player_id).unwrap());
        if fee < asking {
            return Err(MarketError::OfferTooLow { asking });
        }
        self.execute_transfer(season, player_id, buyer, seller, fee)
    }

    /// Renews a contract; the salary must meet the player's demand.
    pub fn renew_contract(
        &mut self,
        season: &mut SeasonState,
        club_id: ClubId,
        player_id: PlayerId,
        years: u8,
        new_salary: u64,
    ) -> Result<(), MarketError> {
        if !(1..=MAX_CONTRACT_YEARS).contains(&years) {
            return Err(MarketError::InvalidContractYears(years));
        }
        let club = season.club_mut(club_id).ok_or(ModelError::ClubNotFound(club_id))?;
        let p = club.player_mut(player_id).ok_or(ModelError::PlayerNotFound(player_id))?;
        let demanded = demanded_salary(p);
        if new_salary < demanded {
            return Err(MarketError::SalaryTooLow { demanded });
        }
        p.salary = new_salary;
        p.morale = (p.morale + 0.05).min(1.5);
        self.contracts.insert(player_id, years);
        Ok(())
    }

    /// AI clubs make proposals for players of `user_club`.
    pub fn generate_ai_offers(
        &mut self,
        season: &SeasonState,
        user_club: ClubId,
        rng: &mut CoreRng,
    ) -> usize {
        let Some(user) = season.club(user_club) else { return 0 };
        if user.squad.is_empty() {
            return 0;
        }
        let mut made = 0;
        for c in season.clubs.iter().filter(|c| c.id != user_club && c.squad.len() < MAX_SQUAD) {
            if made >= 3 || !rng.chance(0.2) {
                continue;
            }
            let p = &user.squad[rng.range(0, user.squad.len() as u32) as usize];
            if self.offers.iter().any(|o| o.player_id == p.id) {
                continue;
            }
            let fee = (asking_price(p) as f64 * rng.range_f64(0.85, 1.25)).round() as u64;
            if fee == 0 || !can_afford(c.balance, fee) {
                continue;
            }
            self.next_offer_id += 1;
            self.offers.push(TransferOffer {
                id: self.next_offer_id,
                from_club: c.id,
                to_club: user_club,
                player_id: p.id,
                fee,
            });
            made += 1;
        }
        made
    }

    pub fn accept_offer(&mut self, season: &mut SeasonState, offer_id: u32) -> Result<(), MarketError> {
        let o = self
            .offers
            .iter()
            .find(|o| o.id == offer_id)
            .cloned()
            .ok_or(MarketError::OfferNotFound(offer_id))?;
        let res = self.execute_transfer(season, o.player_id, o.from_club, o.to_club, o.fee);
        if res.is_err() {
            // The bid can no longer be honoured (funds/squad changed).
            self.offers.retain(|x| x.id != offer_id);
        }
        res
    }

    pub fn reject_offer(&mut self, offer_id: u32) -> Result<(), MarketError> {
        let before = self.offers.len();
        self.offers.retain(|o| o.id != offer_id);
        if self.offers.len() == before {
            return Err(MarketError::OfferNotFound(offer_id));
        }
        Ok(())
    }

    /// Proposals are only valid for the window in which they were made.
    pub fn expire_offers(&mut self) {
        self.offers.clear();
    }

    /// AI activity: fill squad holes with free agents and occasionally buy
    /// from other AI clubs. The user's club is never touched.
    pub fn run_ai_window(
        &mut self,
        season: &mut SeasonState,
        user_club: Option<ClubId>,
        rng: &mut CoreRng,
    ) -> WindowReport {
        let mut report = WindowReport::default();
        let ids: Vec<ClubId> =
            season.clubs.iter().map(|c| c.id).filter(|id| Some(*id) != user_club).collect();
        for &cid in &ids {
            // 1) free agents for positional needs
            let (need, balance, len) = {
                let c = season.club(cid).unwrap();
                (Self::needed_position(c.squad.iter().map(|p| p.position)), c.balance, c.squad.len())
            };
            if len < AI_TARGET_SQUAD || need.is_some() {
                let pick = self
                    .free_agents
                    .iter()
                    .filter(|p| can_afford(balance, p.salary))
                    .filter(|p| need.map_or(true, |n| p.position == n))
                    .max_by_key(|p| (p.max_strength, std::cmp::Reverse(p.id)))
                    .map(|p| p.id);
                if let Some(pid) = pick {
                    let years = rng.range(1, 4) as u8;
                    if self.sign_free_agent(season, cid, pid, years).is_ok() {
                        report.signings += 1;
                    }
                }
            }
            // 2) occasional purchase from another AI club
            if rng.chance(0.15) && ids.len() > 1 {
                let seller = ids[rng.range(0, ids.len() as u32) as usize];
                if seller == cid {
                    continue;
                }
                let (avg, balance, len) = {
                    let b = season.club(cid).unwrap();
                    (b.average_strength(), b.balance, b.squad.len())
                };
                if len >= MAX_SQUAD - 1 {
                    continue;
                }
                let target = season.club(seller).and_then(|s| {
                    if s.squad.len() <= MIN_SQUAD + 2 {
                        return None;
                    }
                    s.squad
                        .iter()
                        .filter(|p| p.max_strength as f64 > avg)
                        .filter(|p| asking_price(p) <= (balance.max(0) as u64) / 2)
                        .max_by_key(|p| (p.max_strength, std::cmp::Reverse(p.id)))
                        .map(|p| (p.id, asking_price(p)))
                });
                if let Some((pid, price)) = target {
                    if self.execute_transfer(season, pid, cid, seller, price).is_ok() {
                        report.purchases += 1;
                    }
                }
            }
        }
        report
    }

    /// First position below its minimum squad coverage.
    fn needed_position(positions: impl Iterator<Item = Position>) -> Option<Position> {
        let mut count: BTreeMap<u8, usize> = BTreeMap::new();
        for p in positions {
            *count.entry(p.code()).or_default() += 1;
        }
        [
            (Position::Goalkeeper, 2usize),
            (Position::CenterBack, 4),
            (Position::FullBack, 3),
            (Position::Midfielder, 5),
            (Position::Forward, 3),
        ]
        .into_iter()
        .find(|(pos, min)| count.get(&pos.code()).copied().unwrap_or(0) < *min)
        .map(|(pos, _)| pos)
    }

    /// End-of-season contract handling: each contract loses a year; expiring
    /// ones are renewed by AI clubs when the player is good enough (or the
    /// squad is too thin), otherwise the player becomes a free agent. The
    /// user's club is treated alike, so renew in time with `renew_contract`.
    /// Returns the ids of released players.
    pub fn process_contract_expiry(
        &mut self,
        season: &mut SeasonState,
        rng: &mut CoreRng,
    ) -> Vec<PlayerId> {
        let mut released = Vec::new();
        let club_ids: Vec<ClubId> = season.clubs.iter().map(|c| c.id).collect();
        for cid in club_ids {
            let (avg, ids): (f64, Vec<PlayerId>) = {
                let c = season.club(cid).unwrap();
                (c.average_strength(), c.squad.iter().map(|p| p.id).collect())
            };
            for pid in ids {
                let years = self.contracts.entry(pid).or_insert(1);
                *years = years.saturating_sub(1);
                if *years > 0 {
                    continue;
                }
                let c = season.club_mut(cid).unwrap();
                let p = c.player_mut(pid).unwrap();
                let keep = p.max_strength as f64 >= avg - 5.0 || c.squad.len() <= MIN_SQUAD;
                if keep {
                    let p = c.player_mut(pid).unwrap();
                    p.salary = p.salary.saturating_mul(105) / 100;
                    self.contracts.insert(pid, rng.range(1, 4) as u8);
                } else if self.release_player(season, cid, pid).is_ok() {
                    released.push(pid);
                }
            }
        }
        released
    }
}
