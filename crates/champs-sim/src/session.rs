//! Incremental, serializable match domain. All random draws occur only on commands.
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MatchPlayer {
    pub id: u32,
    pub name: String,
    pub position: String,
    pub strength: f64,
    pub energy: f64,
    pub eligible: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct MatchRules {
    pub bench_limit: usize,
    pub substitution_limit: u8,
    pub opportunity_limit: u8,
    pub extra_time: bool,
    pub shootout: bool,
    pub aggregate: [u32; 2],
}
impl Default for MatchRules {
    fn default() -> Self {
        Self {
            bench_limit: 11,
            substitution_limit: 5,
            opportunity_limit: 3,
            extra_time: false,
            shootout: false,
            aggregate: [0; 2],
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MatchSide {
    pub club_id: u32,
    pub name: String,
    pub formation: String,
    pub players: Vec<MatchPlayer>,
    pub starter_ids: Vec<u32>,
    pub named_substitute_ids: Vec<u32>,
    pub off_sheet_ids: Vec<u32>,
    pub on_field_role_by_player_id: BTreeMap<u32, String>,
    pub temporary_goalkeeper_id: Option<u32>,
    pub substitutions_used: u8,
    pub opportunities_used: u8,
    pub last_opportunity: Option<u32>,
    pub unavailable_ids: Vec<u32>,
    pub injured_ids: Vec<u32>,
    pub sent_off_ids: Vec<u32>,
    pub used_substitute_ids: Vec<u32>,
    pub minutes_played: BTreeMap<u32, u32>,
    pub yellow_cards: BTreeMap<u32, u8>,
    pub penalty_taker_id: u32,
    pub free_kick_taker_id: u32,
    pub corner_taker_id: u32,
}
impl MatchSide {
    pub fn new(
        club_id: u32,
        name: String,
        formation: String,
        players: Vec<MatchPlayer>,
        starters: Vec<u32>,
        bench: Vec<u32>,
        rules: &MatchRules,
    ) -> Result<Self, String> {
        Self::from_sheet(
            club_id, name, formation, players, starters, bench, rules, true,
        )
    }
    pub fn new_ai(
        club_id: u32,
        name: String,
        formation: String,
        players: Vec<MatchPlayer>,
        starters: Vec<u32>,
        bench: Vec<u32>,
        rules: &MatchRules,
    ) -> Result<Self, String> {
        Self::from_sheet(
            club_id, name, formation, players, starters, bench, rules, false,
        )
    }
    fn from_sheet(
        club_id: u32,
        name: String,
        formation: String,
        players: Vec<MatchPlayer>,
        starters: Vec<u32>,
        bench: Vec<u32>,
        rules: &MatchRules,
        human: bool,
    ) -> Result<Self, String> {
        if (human && starters.len() != 11) || starters.len() > 11 || bench.len() > rules.bench_limit
        {
            return Err("Selecione 11 titulares e até 11 reservas.".into());
        }
        let sheet: BTreeSet<_> = starters.iter().chain(&bench).copied().collect();
        if sheet.len() != starters.len() + bench.len()
            || sheet
                .iter()
                .any(|id| !players.iter().any(|p| p.id == *id && p.eligible))
        {
            return Err(
                "Súmula contém atleta duplicado, lesionado, suspenso ou desconhecido.".into(),
            );
        }
        if human
            && players
                .iter()
                .filter(|p| starters.contains(&p.id) && p.position == "GOL")
                .count()
                != 1
        {
            return Err("Escale exatamente um goleiro titular.".into());
        }
        let roles = players
            .iter()
            .filter(|p| starters.contains(&p.id))
            .map(|p| (p.id, p.position.clone()))
            .collect();
        let off_sheet_ids = players
            .iter()
            .filter(|p| !sheet.contains(&p.id))
            .map(|p| p.id)
            .collect();
        Ok(Self {
            club_id,
            name,
            formation,
            players,
            starter_ids: starters,
            named_substitute_ids: bench,
            off_sheet_ids,
            on_field_role_by_player_id: roles,
            temporary_goalkeeper_id: None,
            substitutions_used: 0,
            opportunities_used: 0,
            last_opportunity: None,
            unavailable_ids: vec![],
            injured_ids: vec![],
            sent_off_ids: vec![],
            used_substitute_ids: vec![],
            minutes_played: BTreeMap::new(),
            yellow_cards: BTreeMap::new(),
            penalty_taker_id: 0,
            free_kick_taker_id: 0,
            corner_taker_id: 0,
        })
    }
    pub fn player(&self, id: u32) -> &MatchPlayer {
        self.players
            .iter()
            .find(|p| p.id == id)
            .expect("validated match player")
    }
    pub fn bench(&self) -> Vec<u32> {
        self.named_substitute_ids
            .iter()
            .copied()
            .filter(|id| {
                !self.used_substitute_ids.contains(id) && !self.unavailable_ids.contains(id)
            })
            .collect()
    }
    fn effective(&self, id: u32) -> f64 {
        let p = self.player(id);
        let minutes = *self.minutes_played.get(&id).unwrap_or(&0) as f64;
        let mut strength = p.strength * ((p.energy - minutes * 0.16).max(20.0) / 100.0);
        if self.temporary_goalkeeper_id == Some(id) {
            strength *= 0.28;
        }
        strength.max(1.0)
    }
    pub fn sector_strength(&self, positions: &[&str]) -> f64 {
        let ids: Vec<_> = self
            .on_field_role_by_player_id
            .iter()
            .filter(|(_, role)| positions.contains(&role.as_str()))
            .map(|(id, _)| *id)
            .collect();
        if ids.is_empty() {
            return 1.0;
        }
        // Numerical disadvantage applies to all sectors; goalkeeper quality has an explicit impact.
        let mut value = ids.iter().map(|id| self.effective(*id)).sum::<f64>() / ids.len() as f64;
        value *= self.on_field_role_by_player_id.len() as f64 / 11.0;
        if positions.contains(&"GOL") {
            let gk = self
                .on_field_role_by_player_id
                .iter()
                .find(|(_, role)| role.as_str() == "GOL")
                .map(|(id, _)| self.effective(*id))
                .unwrap_or(1.0);
            value = value * 0.6 + gk * 0.4;
        }
        value.max(1.0)
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct MatchClock {
    pub period: u8,
    pub minute: u32,
    pub added: u32,
    pub elapsed: u32,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LiveEvent {
    pub id: String,
    pub minute: u32,
    pub clock: MatchClock,
    #[serde(rename = "type")]
    pub event_type: String,
    pub team: String,
    pub description: String,
    pub scorer_id: Option<u32>,
    pub scorer_name: Option<String>,
    pub assist_id: Option<u32>,
    pub assist_name: Option<String>,
    pub incoming_id: Option<u32>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PendingDecision {
    pub kind: String,
    pub side: usize,
    pub player_id: Option<u32>,
    pub eligible_ids: Vec<u32>,
    pub default_taker_id: Option<u32>,
    pub severity: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct LiveStats {
    pub shots: [u32; 2],
    pub shots_on_target: [u32; 2],
    pub possession: [u32; 2],
    pub corners: [u32; 2],
    pub fouls: [u32; 2],
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ActiveMatchSession {
    pub schema_version: u8,
    pub fixture_id: u32,
    pub phase: String,
    pub clock: MatchClock,
    pub paused: bool,
    pub speed: u8,
    pub seed: u32,
    pub rng_state: u32,
    pub human_side: Option<usize>,
    pub teams: [MatchSide; 2],
    pub rules: MatchRules,
    pub events: Vec<LiveEvent>,
    pub score: [u32; 2],
    pub stats: LiveStats,
    pub pending_decision: Option<PendingDecision>,
    pub parallel_matches: Vec<ActiveMatchSession>,
    pub penalty_score: [u32; 2],
    pub penalty_attempts: [u32; 2],
    pub shootout_used_ids: [Vec<u32>; 2],
    pub committed_at: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum MatchCommand {
    Advance,
    Pause,
    Resume,
    Speed {
        speed: u8,
    },
    Substitute {
        side: usize,
        outgoing: u32,
        incoming: u32,
    },
    SelectPenaltyTaker {
        player_id: u32,
    },
    ChoosePenaltyTaker {
        player_id: u32,
    },
    ContinueWithoutReplacement,
    Finish,
}
impl ActiveMatchSession {
    pub fn new(
        fixture_id: u32,
        teams: [MatchSide; 2],
        rules: MatchRules,
        seed: u32,
        human_side: Option<usize>,
    ) -> Self {
        let mut session = Self {
            schema_version: 1,
            fixture_id,
            phase: "first_half".into(),
            clock: MatchClock {
                period: 1,
                ..Default::default()
            },
            paused: true,
            speed: 2,
            seed,
            rng_state: seed.max(1),
            human_side,
            teams,
            rules,
            events: vec![],
            score: [0; 2],
            stats: LiveStats::default(),
            pending_decision: None,
            parallel_matches: vec![],
            penalty_score: [0; 2],
            penalty_attempts: [0; 2],
            shootout_used_ids: [vec![], vec![]],
            committed_at: None,
        };
        for side in 0..2 {
            session.ensure_goalkeeper(side);
        }
        let unavailable = [
            session.teams[0].starter_ids.len() < 11,
            session.teams[1].starter_ids.len() < 11,
        ];
        if unavailable.iter().any(|b| *b) {
            session.score = if unavailable == [true, false] {
                [0, 3]
            } else if unavailable == [false, true] {
                [3, 0]
            } else {
                [0, 0]
            };
            session.event(
                0,
                "commentary",
                None,
                "W.O.: equipe sem onze atletas disponíveis para iniciar.".into(),
            );
            session.end();
        }
        session
    }
    fn random(&mut self) -> f64 {
        let mut x = self.rng_state;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        self.rng_state = x;
        x as f64 / 4294967296.0
    }
    fn pick(&mut self, side: usize) -> Option<u32> {
        let pool: Vec<_> = self.teams[side]
            .on_field_role_by_player_id
            .keys()
            .copied()
            .collect();
        if pool.is_empty() {
            None
        } else {
            Some(pool[(self.random() * pool.len() as f64) as usize])
        }
    }
    fn event(&mut self, side: usize, kind: &str, id: Option<u32>, description: String) {
        let name = id.map(|id| self.teams[side].player(id).name.clone());
        self.events.push(LiveEvent {
            id: format!("{}:{}", self.fixture_id, self.events.len()),
            minute: self.clock.minute,
            clock: self.clock.clone(),
            event_type: kind.into(),
            team: if side == 0 { "home" } else { "away" }.into(),
            description,
            scorer_id: id,
            scorer_name: name,
            assist_id: None,
            assist_name: None,
            incoming_id: None,
        });
    }
    pub fn is_finished(&self) -> bool {
        self.phase == "full_time" || self.phase == "committed"
    }
    pub fn command(&mut self, command: MatchCommand) -> Result<(), String> {
        // Atomic rejection, including multi-field substitutions and pending decisions.
        let mut candidate = self.clone();
        candidate.apply(command)?;
        *self = candidate;
        Ok(())
    }
    fn apply(&mut self, command: MatchCommand) -> Result<(), String> {
        if self.phase == "committed" {
            return Err("Partida já consolidada.".into());
        }
        match command {
            MatchCommand::Pause => self.paused = true,
            MatchCommand::Speed { speed } => {
                if ![1, 2, 5].contains(&speed) {
                    return Err("Velocidade inválida.".into());
                }
                self.speed = speed;
            }
            MatchCommand::Resume => {
                if self.pending_decision.is_some() || self.is_finished() {
                    return Err("Resolva a decisão pendente.".into());
                }
                if self.phase == "halftime" {
                    self.phase = "second_half".into();
                    self.clock.period = 2;
                    self.clock.minute = 45;
                    self.clock.added = 0;
                }
                self.paused = false;
            }
            MatchCommand::Substitute {
                side,
                outgoing,
                incoming,
            } => self.substitute(side, outgoing, incoming)?,
            MatchCommand::SelectPenaltyTaker { player_id } => {
                let pending = self
                    .pending_decision
                    .as_mut()
                    .ok_or("Nenhum pênalti pendente.")?;
                if pending.kind != "penalty" || !pending.eligible_ids.contains(&player_id) {
                    return Err("Cobrador inelegível.".into());
                }
                pending.default_taker_id = Some(player_id);
            }
            MatchCommand::ChoosePenaltyTaker { player_id } => self.resolve_penalty(player_id)?,
            MatchCommand::ContinueWithoutReplacement => {
                if self.pending_decision.as_ref().map(|d| d.kind.as_str()) != Some("injury") {
                    return Err("Nenhuma lesão pendente.".into());
                }
                self.pending_decision = None; // emergency goalkeeper was already designated
            }
            MatchCommand::Advance => {
                if self.paused || self.pending_decision.is_some() || self.is_finished() {
                    return Err("Partida pausada ou encerrada.".into());
                }
                self.advance_minute();
                self.advance_parallel();
            }
            MatchCommand::Finish => {
                if self.pending_decision.is_some() {
                    return Err("Resolva a decisão pendente.".into());
                }
                // Fast-forward stops at every human decision and at halftime.
                if self.phase == "halftime" {
                    return Err("Continue após o intervalo.".into());
                }
                self.paused = false;
                for _ in 0..300 {
                    if self.is_finished()
                        || self.pending_decision.is_some()
                        || self.phase == "halftime"
                    {
                        break;
                    }
                    self.advance_minute();
                    self.advance_parallel();
                }
                self.paused = true;
            }
        }
        self.settle_boundary();
        Ok(())
    }
    fn stoppage_key(&self) -> u32 {
        self.clock.elapsed * 8 + self.clock.period as u32
    }
    fn can_substitute(&self, side: usize) -> bool {
        let t = &self.teams[side];
        t.substitutions_used < self.rules.substitution_limit
            && (self.phase == "halftime"
                || t.last_opportunity == Some(self.stoppage_key())
                || t.opportunities_used < self.rules.opportunity_limit)
    }
    fn substitute(&mut self, side: usize, outgoing: u32, incoming: u32) -> Result<(), String> {
        if side > 1 || self.is_finished() || self.phase == "shootout" || !self.paused {
            return Err("Pause para substituir.".into());
        }
        if let Some(human) = self.human_side {
            if human != side {
                return Err("Adversário é somente leitura.".into());
            }
        }
        if self
            .pending_decision
            .as_ref()
            .is_some_and(|d| d.kind != "injury")
        {
            return Err("Resolva o pênalti primeiro.".into());
        }
        let t = &self.teams[side];
        let injury = t.injured_ids.contains(&outgoing) && !t.unavailable_ids.contains(&outgoing);
        if (!t.on_field_role_by_player_id.contains_key(&outgoing) && !injury)
            || t.sent_off_ids.contains(&outgoing)
            || !t.bench().contains(&incoming)
            || !self.can_substitute(side)
        {
            return Err(
                "Troca inválida: confira convocação, cinco atletas e três oportunidades.".into(),
            );
        }
        let incoming_gk = t.player(incoming).position == "GOL";
        let outgoing_role = t
            .on_field_role_by_player_id
            .get(&outgoing)
            .cloned()
            .unwrap_or_else(|| t.player(outgoing).position.clone());
        let has_gk = t.on_field_role_by_player_id.iter().any(|(id, role)| {
            *id != outgoing && role == "GOL" && Some(*id) != t.temporary_goalkeeper_id
        });
        if incoming_gk && has_gk {
            return Err("Já existe um goleiro em campo.".into());
        }
        if injury
            && outgoing_role == "GOL"
            && !incoming_gk
            && t.bench().iter().any(|id| t.player(*id).position == "GOL")
        {
            return Err("Escolha o goleiro convocado para esta lesão.".into());
        }
        let t = &mut self.teams[side];
        if self.phase != "halftime"
            && t.last_opportunity != Some(self.clock.elapsed * 8 + self.clock.period as u32)
        {
            t.opportunities_used += 1;
            t.last_opportunity = Some(self.clock.elapsed * 8 + self.clock.period as u32);
        }
        t.substitutions_used += 1;
        t.on_field_role_by_player_id.remove(&outgoing);
        if t.temporary_goalkeeper_id == Some(outgoing) {
            t.temporary_goalkeeper_id = None;
        }
        t.unavailable_ids.push(outgoing);
        t.used_substitute_ids.push(incoming);
        if incoming_gk {
            if let Some(temp) = t.temporary_goalkeeper_id.take() {
                if temp != outgoing {
                    let natural = t.player(temp).position.clone();
                    t.on_field_role_by_player_id.insert(temp, natural);
                }
            }
        }
        let role = if incoming_gk {
            "GOL".into()
        } else if injury && outgoing_role == "GOL" {
            t.player(incoming).position.clone()
        } else {
            outgoing_role
        };
        if role == "GOL" && !incoming_gk {
            t.temporary_goalkeeper_id = Some(incoming);
        }
        t.on_field_role_by_player_id.insert(incoming, role);
        self.event(
            side,
            "substitution",
            Some(outgoing),
            format!(
                "Sai {}; entra {}.",
                self.teams[side].player(outgoing).name,
                self.teams[side].player(incoming).name
            ),
        );
        self.events.last_mut().unwrap().incoming_id = Some(incoming);
        if self.teams[side].temporary_goalkeeper_id == Some(incoming) {
            self.event(
                side,
                "role_change",
                Some(incoming),
                format!(
                    "{} assume o gol (força de goleiro reduzida a 28%).",
                    self.teams[side].player(incoming).name
                ),
            );
        }
        if self
            .pending_decision
            .as_ref()
            .is_some_and(|d| d.side == side && d.player_id == Some(outgoing))
        {
            self.pending_decision = None;
        }
        self.ensure_goalkeeper(side);
        Ok(())
    }
    fn ensure_goalkeeper(&mut self, side: usize) {
        if self.teams[side]
            .on_field_role_by_player_id
            .values()
            .any(|r| r == "GOL")
        {
            return;
        }
        let t = &self.teams[side];
        let chosen = t.on_field_role_by_player_id.keys().copied().max_by(|a, b| {
            let aptitude = |id| {
                let p = t.player(id);
                let defense = match p.position.as_str() {
                    "ZAG" => 1.3,
                    "VOL" | "LAT" => 1.15,
                    _ => 1.0,
                };
                p.strength * p.energy * defense
            };
            aptitude(*a).total_cmp(&aptitude(*b)).then_with(|| b.cmp(a))
        });
        if let Some(id) = chosen {
            self.teams[side]
                .on_field_role_by_player_id
                .insert(id, "GOL".into());
            self.teams[side].temporary_goalkeeper_id = Some(id);
            self.event(
                side,
                "role_change",
                Some(id),
                format!(
                    "{} assume o gol (força de goleiro reduzida a 28%).",
                    self.teams[side].player(id).name
                ),
            );
        }
    }
    /// Incidents are public domain operations for deterministic replay/testing.
    pub fn incident(&mut self, side: usize, id: u32, injury: bool) -> Result<(), String> {
        if side > 1
            || !self.teams[side]
                .on_field_role_by_player_id
                .contains_key(&id)
            || self.is_finished()
            || self.pending_decision.is_some()
        {
            return Err("Incidente inválido.".into());
        }
        self.teams[side].on_field_role_by_player_id.remove(&id);
        let name = self.teams[side].player(id).name.clone();
        if injury {
            self.teams[side].injured_ids.push(id);
            self.event(
                side,
                "injury",
                Some(id),
                format!("{name} se lesiona e deixa o campo. Gravidade: moderada."),
            );
        } else {
            self.teams[side].sent_off_ids.push(id);
            self.teams[side].unavailable_ids.push(id);
            self.event(side, "red_card", Some(id), format!("{name} é expulso."));
        }
        if self.teams[side].temporary_goalkeeper_id == Some(id) {
            self.teams[side].temporary_goalkeeper_id = None;
        }
        self.ensure_goalkeeper(side);
        if self.human_side == Some(side) {
            self.paused = true;
            if injury {
                let mut eligible = if self.can_substitute(side) {
                    self.teams[side].bench()
                } else {
                    vec![]
                };
                if self.teams[side].player(id).position == "GOL"
                    && eligible
                        .iter()
                        .any(|id| self.teams[side].player(*id).position == "GOL")
                {
                    eligible.retain(|id| self.teams[side].player(*id).position == "GOL");
                }
                let natural_keeper_in_field = self.teams[side]
                    .on_field_role_by_player_id
                    .iter()
                    .any(|(id, r)| {
                        r == "GOL" && Some(*id) != self.teams[side].temporary_goalkeeper_id
                    });
                if natural_keeper_in_field {
                    eligible.retain(|id| self.teams[side].player(*id).position != "GOL");
                }
                self.pending_decision = Some(PendingDecision {
                    kind: "injury".into(),
                    side,
                    player_id: Some(id),
                    eligible_ids: eligible,
                    default_taker_id: None,
                    severity: Some("moderada".into()),
                });
            }
        } else {
            let bench = self.teams[side].bench();
            let gk_missing = self.teams[side].temporary_goalkeeper_id.is_some();
            let incoming = if gk_missing {
                bench
                    .iter()
                    .find(|id| self.teams[side].player(**id).position == "GOL")
                    .copied()
                    .or_else(|| if injury { bench.first().copied() } else { None })
            } else {
                bench
                    .iter()
                    .find(|candidate| {
                        self.teams[side].player(**candidate).position
                            == self.teams[side].player(id).position
                    })
                    .copied()
                    .or_else(|| {
                        bench
                            .iter()
                            .find(|candidate| {
                                self.teams[side].player(**candidate).position != "GOL"
                            })
                            .copied()
                    })
            };
            if let Some(incoming) = incoming {
                if self.can_substitute(side) && (injury || gk_missing) {
                    let outgoing = if injury {
                        id
                    } else {
                        self.teams[side].temporary_goalkeeper_id.unwrap()
                    };
                    let paused = self.paused;
                    let human = self.human_side;
                    self.paused = true;
                    self.human_side = None;
                    self.substitute(side, outgoing, incoming)?;
                    self.paused = paused;
                    self.human_side = human;
                }
            }
        }
        Ok(())
    }
    pub fn award_penalty(&mut self, side: usize) -> Result<(), String> {
        if side > 1 || self.pending_decision.is_some() || self.is_finished() {
            return Err("Pênalti inválido.".into());
        }
        let mut eligible: Vec<_> = self.teams[side]
            .on_field_role_by_player_id
            .keys()
            .copied()
            .collect();
        if self.phase == "shootout" {
            // Reduce to equal numbers and require a full cycle before repeating a taker.
            let count = self.teams[0]
                .on_field_role_by_player_id
                .len()
                .min(self.teams[1].on_field_role_by_player_id.len());
            eligible.truncate(count);
            if eligible
                .iter()
                .all(|id| self.shootout_used_ids[side].contains(id))
            {
                self.shootout_used_ids[side].clear();
            }
            eligible.retain(|id| !self.shootout_used_ids[side].contains(id));
        }
        let preferred = self.teams[side].penalty_taker_id;
        let default = if eligible.contains(&preferred) {
            Some(preferred)
        } else {
            eligible.iter().copied().max_by(|a, b| {
                self.teams[side]
                    .effective(*a)
                    .total_cmp(&self.teams[side].effective(*b))
                    .then_with(|| b.cmp(a))
            })
        };
        self.event(
            side,
            "penalty",
            None,
            if self.phase == "shootout" {
                "Disputa por pênaltis: escolha o cobrador."
            } else {
                "Pênalti marcado! Escolha o cobrador."
            }
            .into(),
        );
        self.pending_decision = Some(PendingDecision {
            kind: "penalty".into(),
            side,
            player_id: None,
            eligible_ids: eligible,
            default_taker_id: default,
            severity: None,
        });
        if self.human_side == Some(side) {
            self.paused = true;
        } else if let Some(id) = default {
            self.resolve_penalty(id)?;
        } else {
            self.end();
        }
        Ok(())
    }
    fn resolve_penalty(&mut self, id: u32) -> Result<(), String> {
        let d = self
            .pending_decision
            .clone()
            .ok_or("Nenhum pênalti pendente.")?;
        if d.kind != "penalty"
            || !d.eligible_ids.contains(&id)
            || !self.teams[d.side]
                .on_field_role_by_player_id
                .contains_key(&id)
        {
            return Err("Cobrador inelegível.".into());
        }
        let side = d.side;
        let gk = self.teams[1 - side]
            .on_field_role_by_player_id
            .iter()
            .find(|(_, r)| r.as_str() == "GOL")
            .map(|(id, _)| self.teams[1 - side].effective(*id))
            .unwrap_or(1.0);
        let probability = (0.72 + (self.teams[side].effective(id) - gk) * 0.003).clamp(0.45, 0.94);
        let goal = self.random() < probability;
        let shootout = self.phase == "shootout";
        if shootout {
            self.penalty_attempts[side] += 1;
            self.shootout_used_ids[side].push(id);
            if goal {
                self.penalty_score[side] += 1;
            }
        } else {
            self.stats.shots[side] += 1;
            self.stats.shots_on_target[side] += 1;
            if goal {
                self.score[side] += 1;
            }
        }
        self.event(
            side,
            if shootout {
                "shootout_kick"
            } else if goal {
                "goal"
            } else {
                "penalty_missed"
            },
            Some(id),
            format!(
                "{}: {} na cobrança de pênalti.",
                self.teams[side].player(id).name,
                if goal { "gol" } else { "não converte" }
            ),
        );
        self.pending_decision = None;
        if shootout {
            self.check_shootout_end();
        } else {
            self.settle_boundary();
        }
        Ok(())
    }
    fn check_shootout_end(&mut self) {
        let [a, b] = self.penalty_attempts;
        let [x, y] = self.penalty_score;
        if (a <= 5 && b <= 5 && (x > y + 5 - b || y > x + 5 - a)) || (a >= 5 && a == b && x != y) {
            self.end();
        }
    }
    fn tied(&self) -> bool {
        self.score[0] + self.rules.aggregate[0] == self.score[1] + self.rules.aggregate[1]
    }
    fn end(&mut self) {
        self.phase = "full_time".into();
        self.paused = true;
        self.event(0, "fulltime", None, "Fim de jogo.".into());
    }
    fn advance_minute(&mut self) {
        if self.phase == "shootout" {
            let side = if self.penalty_attempts[0] <= self.penalty_attempts[1] {
                0
            } else {
                1
            };
            let _ = self.award_penalty(side);
            return;
        }
        self.clock.elapsed += 1;
        let elapsed = self.clock.elapsed;
        let (period, minute, added) = if elapsed <= 47 {
            (1, elapsed.min(45), elapsed.saturating_sub(45))
        } else if elapsed <= 94 {
            (2, (elapsed - 2).min(90), elapsed.saturating_sub(92))
        } else if elapsed <= 109 {
            (3, elapsed - 4, 0)
        } else {
            (4, elapsed - 4, 0)
        };
        self.clock.period = period;
        self.clock.minute = minute;
        self.clock.added = added;
        for t in &mut self.teams {
            for id in t.on_field_role_by_player_id.keys() {
                *t.minutes_played.entry(*id).or_default() += 1;
            }
        }
        let mid = [
            self.teams[0].sector_strength(&["VOL", "MEI"]) * 1.1,
            self.teams[1].sector_strength(&["VOL", "MEI"]) * 0.9,
        ];
        let raw_p = mid[0] / (mid[0] + mid[1]);
        let p_home = raw_p.clamp(0.24, 0.76);
        let side = if self.random() < p_home {
            0
        } else {
            1
        };
        self.stats.possession[side] += 1;
        let incident_roll = self.random();
        if let Some(id) = self.pick(side) {
            if incident_roll < 0.0025 {
                let _ = self.incident(side, id, true);
            } else if incident_roll < 0.0038 {
                let _ = self.incident(side, id, false);
            } else if incident_roll < 0.025 {
                *self.teams[side].yellow_cards.entry(id).or_default() += 1;
                self.stats.fouls[side] += 1;
                self.event(
                    side,
                    "yellow_card",
                    Some(id),
                    format!("Cartão amarelo para {}.", self.teams[side].player(id).name),
                );
                if self.teams[side].yellow_cards[&id] >= 2 {
                    let _ = self.incident(side, id, false);
                }
            } else if incident_roll < 0.030 {
                let _ = self.award_penalty(side);
            } else {
                let attack = self.teams[side].sector_strength(&["ATA", "MEI"]);
                let defense = self.teams[1 - side].sector_strength(&["GOL", "ZAG", "LAT", "VOL"]);
                
                // Efeito retranca: se o adversário tem 5 ou mais defensores em campo
                let def_count = self.teams[1 - side]
                    .on_field_role_by_player_id
                    .values()
                    .filter(|r| r.as_str() == "ZAG" || r.as_str() == "LAT")
                    .count();
                let retranca_factor = if def_count >= 5 { 0.75 } else { 1.0 };

                // Desaceleração de ritmo (tirar o pé com placar elástico)
                let lead = (self.score[side] as i32) - (self.score[1 - side] as i32);
                let momentum_factor = if lead >= 4 {
                    0.45
                } else if lead >= 3 {
                    0.70
                } else {
                    1.0
                };

                let base_create = crate::engine::BASE_CREATION * 2.0 * attack.powi(2)
                    / (attack.powi(2) + defense.powi(2));
                let p_create = (base_create * retranca_factor * momentum_factor).clamp(0.08, 0.52);

                if self.random() < p_create {
                    self.stats.shots[side] += 1;

                    // Matrizes anti-goleada clássicas do Brasfoot (TU, TV, TW, TX)
                    let vs_stronger = self.teams[1 - side].sector_strength(&["GOL", "ZAG", "LAT", "VOL", "MEI", "ATA"])
                        > self.teams[side].sector_strength(&["GOL", "ZAG", "LAT", "VOL", "MEI", "ATA"]);
                    let matrix = crate::engine::finishing_matrix(self.score[side], vs_stronger);
                    let base_goal_prob = matrix[0] / (matrix[0] + matrix[1] + matrix[2]);

                    let ratio = (attack / defense).clamp(0.4, 2.2);
                    let goal_probability = (base_goal_prob * ratio).clamp(0.015, 0.22);
                    let roll = self.random();
                    let shooter = self.teams[side]
                        .on_field_role_by_player_id
                        .iter()
                        .filter(|(_, r)| r.as_str() != "GOL")
                        .map(|(id, _)| *id)
                        .collect::<Vec<_>>();
                    let scorer = if shooter.is_empty() {
                        id
                    } else {
                        shooter[(self.random() * shooter.len() as f64) as usize]
                    };
                    let goal = roll < goal_probability;
                    let on_target = goal || roll < 0.65;
                    if on_target {
                        self.stats.shots_on_target[side] += 1;
                    }
                    let kind = if goal {
                        self.score[side] += 1;
                        "goal"
                    } else if on_target {
                        "save"
                    } else {
                        "near_miss"
                    };
                    let set_piece = self.random();
                    let preferred = if set_piece < 0.07 {
                        self.teams[side].free_kick_taker_id
                    } else if set_piece < 0.12 {
                        self.teams[side].corner_taker_id
                    } else {
                        scorer
                    };
                    let scorer = if self.teams[side]
                        .on_field_role_by_player_id
                        .contains_key(&preferred)
                    {
                        preferred
                    } else {
                        scorer
                    };
                    if set_piece >= 0.07 && set_piece < 0.12 {
                        self.stats.corners[side] += 1;
                    }
                    self.event(
                        side,
                        kind,
                        Some(scorer),
                        format!(
                            "{}: {}.",
                            self.teams[side].player(scorer).name,
                            if goal {
                                "gol"
                            } else if on_target {
                                "defesa do goleiro"
                            } else {
                                "chute para fora"
                            }
                        ),
                    );
                    if goal && set_piece >= 0.12 {
                        let assistants: Vec<_> = self.teams[side]
                            .on_field_role_by_player_id
                            .iter()
                            .filter(|(id, role)| **id != scorer && role.as_str() != "GOL")
                            .map(|(id, _)| *id)
                            .collect();
                        if !assistants.is_empty() {
                            let assistant =
                                assistants[(self.random() * assistants.len() as f64) as usize];
                            let name = self.teams[side].player(assistant).name.clone();
                            let event = self.events.last_mut().unwrap();
                            event.assist_id = Some(assistant);
                            event.assist_name = Some(name);
                        }
                    }
                }
            }
        }
        self.settle_boundary();
    }
    fn settle_boundary(&mut self) {
        if self.pending_decision.is_some() {
            return;
        }
        let elapsed = self.clock.elapsed;
        if elapsed == 47 && self.phase == "first_half" {
            self.phase = "halftime".into();
            self.paused = true;
            self.event(
                0,
                "halftime",
                None,
                "Intervalo: as trocas não gastam oportunidade.".into(),
            );
        } else if elapsed == 94 && self.phase == "second_half" {
            if self.tied() && self.rules.extra_time {
                self.phase = "extra_time".into();
            } else if self.tied() && self.rules.shootout {
                self.phase = "shootout".into();
            } else {
                self.end();
            }
        } else if elapsed == 124 && self.phase == "extra_time" {
            if self.tied() && self.rules.shootout {
                self.phase = "shootout".into();
            } else {
                self.end();
            }
        }
    }
    fn advance_parallel(&mut self) {
        for parallel in &mut self.parallel_matches {
            while !parallel.is_finished() && parallel.clock.elapsed < self.clock.elapsed {
                if parallel.phase == "halftime" {
                    parallel.phase = "second_half".into();
                }
                parallel.paused = false;
                parallel.advance_minute();
            }
        }
    }
    pub fn finish_parallel(&mut self) {
        for parallel in &mut self.parallel_matches {
            for _ in 0..1000 {
                if parallel.is_finished() {
                    break;
                }
                if parallel.phase == "halftime" {
                    parallel.phase = "second_half".into();
                }
                parallel.paused = false;
                parallel.advance_minute();
            }
        }
    }
}
