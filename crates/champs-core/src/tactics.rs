//! Tactics: formation, lineup and set-piece takers.

use crate::error::ModelError;
use crate::player::PlayerId;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Formation {
    pub defenders: u8,
    pub midfielders: u8,
    pub forwards: u8,
}

impl Formation {
    pub fn new(defenders: u8, midfielders: u8, forwards: u8) -> Result<Self, ModelError> {
        let total = defenders as u16 + midfielders as u16 + forwards as u16;
        if total != 10 {
            return Err(ModelError::InvalidFormation(total.min(255) as u8));
        }
        Ok(Self { defenders, midfielders, forwards })
    }
}

impl std::fmt::Display for Formation {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}-{}-{}", self.defenders, self.midfielders, self.forwards)
    }
}

impl std::str::FromStr for Formation {
    type Err = ModelError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let parts: Vec<&str> = s.split('-').collect();
        if parts.len() == 3 {
            if let (Ok(d), Ok(m), Ok(f)) = (
                parts[0].trim().parse::<u8>(),
                parts[1].trim().parse::<u8>(),
                parts[2].trim().parse::<u8>(),
            ) {
                return Formation::new(d, m, f);
            }
        }
        Err(ModelError::InvalidFormation(0))
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Tactics {
    pub formation: Formation,
    pub lineup: Vec<PlayerId>,
    pub free_kick_taker: Option<PlayerId>,
    pub penalty_taker: Option<PlayerId>,
    pub corner_taker: Option<PlayerId>,
}

impl Default for Tactics {
    fn default() -> Self {
        Self {
            formation: Formation { defenders: 4, midfielders: 4, forwards: 2 },
            lineup: Vec::new(),
            free_kick_taker: None,
            penalty_taker: None,
            corner_taker: None,
        }
    }
}

impl Tactics {
    pub fn new(formation: Formation) -> Self {
        Self { formation, ..Self::default() }
    }

    /// Sets the starting eleven; requires exactly 11 distinct ids.
    pub fn set_lineup(&mut self, lineup: Vec<PlayerId>) -> Result<(), ModelError> {
        let distinct: HashSet<_> = lineup.iter().collect();
        if lineup.len() != 11 || distinct.len() != 11 {
            return Err(ModelError::InvalidLineup(distinct.len().min(lineup.len())));
        }
        self.lineup = lineup;
        Ok(())
    }

    pub fn is_complete(&self) -> bool {
        self.lineup.len() == 11
    }
}

/// Automatically selects the best starting 11 for the given formation,
/// allocating players strictly to their natural positions based on highest
/// strength and energy:
/// - Goalkeeper NUNCA vai para a zaga, meio ou ataque.
/// - Zagueiros e Laterais preenchem a defesa.
/// - Meias no meio-campo.
/// - Atacantes no ataque.
///
/// Marks `is_starter = true` on the chosen 11 and places them at the beginning
/// of `squad` in exact tactical slot order: [GOL, ...DEF, ...MID, ...ATA].
pub fn auto_select_best_lineup(
    squad: &mut [crate::player::Player],
    formation: Formation,
) -> Result<Vec<PlayerId>, ModelError> {
    if squad.len() < 11 {
        return Err(ModelError::InvalidLineup(squad.len()));
    }

    use crate::position::Position;

    // Reset starter flags
    for p in squad.iter_mut() {
        p.is_starter = false;
    }

    // Effective score combining strength and energy, heavily penalizing unavailable
    let score = |p: &crate::player::Player| -> f64 {
        let avail_mult = if p.is_available() { 1.0 } else { 0.05 };
        let base = (p.current_strength as f64) * ((p.energy as f64) / 100.0);
        let tie_breaker = (p.max_strength as f64) * 0.01 + (p.energy as f64) * 0.001;
        (base + tie_breaker) * avail_mult
    };

    // Collect player indices partitioned by natural position
    let mut gks: Vec<usize> = Vec::new();
    let mut defs: Vec<usize> = Vec::new();
    let mut mids: Vec<usize> = Vec::new();
    let mut fwds: Vec<usize> = Vec::new();

    for (idx, p) in squad.iter().enumerate() {
        match p.position {
            Position::Goalkeeper => gks.push(idx),
            Position::CenterBack | Position::FullBack => defs.push(idx),
            Position::Midfielder => mids.push(idx),
            Position::Forward => fwds.push(idx),
        }
    }

    // Sort each group descending by effective score
    gks.sort_by(|&a, &b| score(&squad[b]).partial_cmp(&score(&squad[a])).unwrap());
    defs.sort_by(|&a, &b| score(&squad[b]).partial_cmp(&score(&squad[a])).unwrap());
    mids.sort_by(|&a, &b| score(&squad[b]).partial_cmp(&score(&squad[a])).unwrap());
    fwds.sort_by(|&a, &b| score(&squad[b]).partial_cmp(&score(&squad[a])).unwrap());

    let mut selected_indices: Vec<usize> = Vec::with_capacity(11);
    let mut chosen_set: HashSet<usize> = HashSet::with_capacity(11);

    // 1. Pick 1 Goalkeeper (GK strictly never plays outfield)
    if let Some(&gk_idx) = gks.first() {
        selected_indices.push(gk_idx);
        chosen_set.insert(gk_idx);
    }

    // 2. Pick defenders (CenterBack and FullBack)
    let mut def_count = 0;
    for &d_idx in &defs {
        if def_count >= formation.defenders as usize {
            break;
        }
        if chosen_set.insert(d_idx) {
            selected_indices.push(d_idx);
            def_count += 1;
        }
    }

    // 3. Pick midfielders
    let mut mid_count = 0;
    for &m_idx in &mids {
        if mid_count >= formation.midfielders as usize {
            break;
        }
        if chosen_set.insert(m_idx) {
            selected_indices.push(m_idx);
            mid_count += 1;
        }
    }

    // 4. Pick forwards
    let mut fwd_count = 0;
    for &f_idx in &fwds {
        if fwd_count >= formation.forwards as usize {
            break;
        }
        if chosen_set.insert(f_idx) {
            selected_indices.push(f_idx);
            fwd_count += 1;
        }
    }

    // 5. If any outfield group is short due to extreme injuries/roster shortage,
    // fill outfield spots from remaining outfield players (defs, mids, fwds).
    // GOALKEEPERS NEVER GO OUTFIELD!
    if selected_indices.len() < 11 {
        let mut outfield_remaining: Vec<usize> = defs
            .iter()
            .chain(mids.iter())
            .chain(fwds.iter())
            .copied()
            .filter(|idx| !chosen_set.contains(idx))
            .collect();
        outfield_remaining.sort_by(|&a, &b| score(&squad[b]).partial_cmp(&score(&squad[a])).unwrap());

        for idx in outfield_remaining {
            if selected_indices.len() >= 11 {
                break;
            }
            if chosen_set.insert(idx) {
                selected_indices.push(idx);
            }
        }
    }

    // 6. Extreme fallback if squad literally has fewer than 10 outfield players
    if selected_indices.len() < 11 {
        for idx in 0..squad.len() {
            if selected_indices.len() >= 11 {
                break;
            }
            if chosen_set.insert(idx) {
                selected_indices.push(idx);
            }
        }
    }

    selected_indices.truncate(11);

    // Mark starters
    for &idx in &selected_indices {
        squad[idx].is_starter = true;
    }

    let starter_ids: Vec<PlayerId> = selected_indices.iter().map(|&idx| squad[idx].id).collect();

    // Reorder squad so 11 starters are at the beginning in tactical order
    let mut starters_list: Vec<crate::player::Player> = Vec::with_capacity(11);
    let mut bench_list: Vec<crate::player::Player> = Vec::with_capacity(squad.len() - 11);

    for (idx, p) in squad.iter().enumerate() {
        if !selected_indices.contains(&idx) {
            bench_list.push(p.clone());
        }
    }
    for &idx in &selected_indices {
        starters_list.push(squad[idx].clone());
    }

    // Sort bench by position then score descending
    bench_list.sort_by(|a, b| {
        a.position
            .code()
            .cmp(&b.position.code())
            .then(score(b).partial_cmp(&score(a)).unwrap())
    });

    for (i, p) in starters_list.into_iter().chain(bench_list.into_iter()).enumerate() {
        squad[i] = p;
    }

    Ok(starter_ids)
}

