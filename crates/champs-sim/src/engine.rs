//! Motor de partida de 90 minutos (ciclo `vO` -> `vR` -> `vS` -> `vT`).

use crate::rng::Randoms;
use crate::strength::{calculate_effective_strength, Attributes, Role};

/// Matrizes de finalização `[Gol, Defesa do goleiro, Chute fora]`.
pub const TU: [f64; 3] = [5.5, 35.55, 15.0];
pub const TV: [f64; 3] = [4.5, 35.55, 15.0];
pub const TW: [f64; 3] = [3.0, 35.55, 15.0];
pub const TX: [f64; 3] = [0.5, 35.55, 15.0];

/// Probabilidade base de um lance virar finalização quando as forças são iguais.
pub const BASE_CREATION: f64 = 0.27;
/// Bônus/ônus de mando de campo (+0.1 mandante, -0.1 visitante).
pub const HOME_FACTOR: f64 = 0.1;

#[derive(Debug, Clone)]
pub struct Player {
    pub id: u32,
    pub name: String,
    /// Código tático `fT()` (1..=25).
    pub tactical_code: u8,
    pub attrs: Attributes,
    /// Flag `gF()`: fadiga extrema ou fora de posição.
    pub penalized: bool,
}

impl Player {
    pub fn new(id: u32, tactical_code: u8, attrs: Attributes) -> Self {
        Self { id, name: format!("P{id}"), tactical_code, attrs, penalized: false }
    }

    pub fn role(&self) -> Role {
        Role::from_code(self.tactical_code).expect("código tático inválido")
    }

    pub fn strength(&self) -> i32 {
        calculate_effective_strength(self.role(), &self.attrs, self.penalized)
    }
}

#[derive(Debug, Clone)]
pub struct Team {
    pub name: String,
    pub players: Vec<Player>,
}

impl Team {
    pub fn new(name: &str, players: Vec<Player>) -> Self {
        Self { name: name.to_string(), players }
    }

    /// Time padrão 4-4-2 com todos os atributos iguais a `level`.
    pub fn uniform(name: &str, level: f64, id_base: u32) -> Self {
        let codes = [1u8, 2, 3, 4, 9, 11, 14, 15, 10, 19, 20];
        let players = codes
            .iter()
            .enumerate()
            .map(|(i, c)| Player::new(id_base + i as u32, *c, Attributes::uniform(level)))
            .collect();
        Self::new(name, players)
    }

    fn avg_where(&self, f: impl Fn(Role) -> bool) -> f64 {
        let v: Vec<f64> = self
            .players
            .iter()
            .filter(|p| f(p.role()))
            .map(|p| p.strength() as f64)
            .collect();
        if v.is_empty() {
            1.0
        } else {
            v.iter().sum::<f64>() / v.len() as f64
        }
    }

    pub fn midfield(&self) -> f64 {
        self.avg_where(|r| matches!(r, Role::Volante | Role::MeiaCentral | Role::Ponta))
    }
    pub fn attack(&self) -> f64 {
        self.avg_where(|r| matches!(r, Role::Atacante | Role::SegundoAtacante | Role::Ponta | Role::MeiaCentral))
    }
    pub fn defense(&self) -> f64 {
        self.avg_where(|r| matches!(r, Role::Zagueiro | Role::Lateral | Role::Volante | Role::Goleiro))
    }
    pub fn overall(&self) -> f64 {
        let v: f64 = self.players.iter().map(|p| p.strength() as f64).sum();
        v / self.players.len().max(1) as f64
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GoalKind {
    OpenPlay,
    Penalty,
    FreeKick,
    OwnGoal,
    Corner,
}

#[derive(Debug, Clone)]
pub struct GoalEvent {
    pub minute: u32,
    /// 0 = mandante, 1 = visitante (time que pontuou).
    pub team: usize,
    pub kind: GoalKind,
    pub scorer: u32,
    pub assist: Option<u32>,
}

#[derive(Debug, Clone, Default)]
pub struct MatchResult {
    pub goals: [u32; 2],
    pub shots: [u32; 2],
    pub events: Vec<GoalEvent>,
}

/// Escolhe a matriz anti-goleada conforme gols já marcados.
pub fn finishing_matrix(goals_scored: u32, vs_stronger: bool) -> &'static [f64; 3] {
    let base = match goals_scored {
        0..=2 => &TU,
        3..=4 => &TV,
        5 => &TW,
        _ => &TX,
    };
    if vs_stronger && goals_scored >= 2 && goals_scored < 5 {
        &TW
    } else {
        base
    }
}

/// Sorteia o tipo de gol a partir de um inteiro 0..=999.
pub fn goal_kind_from_roll(roll: u32) -> GoalKind {
    match roll {
        0..=899 => GoalKind::OpenPlay,
        900..=949 => GoalKind::Penalty,
        950..=979 => GoalKind::FreeKick,
        980..=989 => GoalKind::OwnGoal,
        990..=994 => GoalKind::Corner,
        _ => GoalKind::OpenPlay, // fallback normal
    }
}

pub struct MatchEngine<'a> {
    teams: [&'a Team; 2],
    neutral: bool,
    rng: Randoms,
}

impl<'a> MatchEngine<'a> {
    pub fn new(home: &'a Team, away: &'a Team, neutral: bool, seed: u64) -> Self {
        Self { teams: [home, away], neutral, rng: Randoms::new(seed) }
    }

    fn mando(&self, side: usize) -> f64 {
        if self.neutral {
            1.0
        } else if side == 0 {
            1.0 + HOME_FACTOR
        } else {
            1.0 - HOME_FACTOR
        }
    }

    fn pick_player(&mut self, side: usize, filter: impl Fn(Role) -> bool, weight: impl Fn(Role) -> f64) -> u32 {
        let team = self.teams[side];
        let cands: Vec<&Player> = team.players.iter().filter(|p| filter(p.role())).collect();
        let pool: Vec<&Player> = if cands.is_empty() { team.players.iter().collect() } else { cands };
        let w: Vec<f64> = pool.iter().map(|p| weight(p.role()) * p.strength() as f64).collect();
        pool[self.rng.roulette(&w)].id
    }

    fn resolve_goal(&mut self, minute: u32, side: usize) -> GoalEvent {
        let kind = goal_kind_from_roll(self.rng.next_int(1000));
        let att_w = |r: Role| match r {
            Role::Atacante => 6.0,
            Role::SegundoAtacante => 5.0,
            Role::Ponta => 3.0,
            Role::MeiaCentral => 2.0,
            Role::Volante => 0.6,
            Role::Lateral => 0.4,
            Role::Zagueiro => 0.3,
            Role::Goleiro => 0.0,
        };
        let not_gk = |r: Role| r != Role::Goleiro;
        let (scorer, assist) = match kind {
            GoalKind::OpenPlay => {
                let s = self.pick_player(side, not_gk, att_w);
                // assistente: meio/laterais, diferente do autor
                let team = self.teams[side];
                let pool: Vec<&Player> = team
                    .players
                    .iter()
                    .filter(|p| {
                        p.id != s
                            && matches!(p.role(), Role::MeiaCentral | Role::Volante | Role::Lateral | Role::Ponta)
                    })
                    .collect();
                let a = if pool.is_empty() {
                    None
                } else {
                    let w: Vec<f64> = pool.iter().map(|p| p.strength() as f64).collect();
                    Some(pool[self.rng.roulette(&w)].id)
                };
                (s, a)
            }
            GoalKind::Penalty | GoalKind::FreeKick | GoalKind::Corner => {
                (self.pick_player(side, not_gk, att_w), None)
            }
            GoalKind::OwnGoal => {
                let other = 1 - side;
                (
                    self.pick_player(other, |r| matches!(r, Role::Zagueiro | Role::Lateral), |_| 1.0),
                    None,
                )
            }
        };
        GoalEvent { minute, team: side, kind, scorer, assist }
    }

    /// Simula os 90 minutos.
    pub fn simulate_full_match(&mut self) -> MatchResult {
        let mut res = MatchResult::default();
        let mid = [self.teams[0].midfield(), self.teams[1].midfield()];
        let att = [self.teams[0].attack(), self.teams[1].attack()];
        let def = [self.teams[0].defense(), self.teams[1].defense()];
        let overall = [self.teams[0].overall(), self.teams[1].overall()];

        for minute in 1..=90u32 {
            // vR: disputa de meio
            let m0 = mid[0] * self.mando(0);
            let m1 = mid[1] * self.mando(1);
            let side = if self.rng.next_f64() < m0 / (m0 + m1) { 0 } else { 1 };
            let other = 1 - side;

            // vS: tentativa de criação
            let a = att[side] * self.mando(side);
            let d = def[other] * self.mando(other);
            let (a2, d2) = (a * a, d * d);
            let p_create = BASE_CREATION * 2.0 * a2 / (a2 + d2);
            if self.rng.next_f64() >= p_create {
                continue; // desarme / interceptação, posse alterna
            }

            // vT: finalização com roleta anti-goleada
            res.shots[side] += 1;
            let vs_stronger = overall[other] > overall[side];
            let matrix = finishing_matrix(res.goals[side], vs_stronger);
            if self.rng.roulette(matrix) == 0 {
                res.goals[side] += 1;
                let ev = self.resolve_goal(minute, side);
                res.events.push(ev);
            }
        }
        res
    }
}

