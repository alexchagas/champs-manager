//! Força efetiva por função tática (`c.b.B(f_0)`).

/// Atributos de um jogador (escala 0..100).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Attributes {
    pub defesa: f64,
    pub reflexo: f64,
    pub posicionamento: f64,
    pub passe: f64,
    pub desarme: f64,
    pub cabeceio: f64,
    pub velocidade: f64,
    pub armacao: f64,
    pub cruzamento: f64,
    pub finalizacao: f64,
}

impl Attributes {
    pub fn uniform(v: f64) -> Self {
        Self {
            defesa: v,
            reflexo: v,
            posicionamento: v,
            passe: v,
            desarme: v,
            cabeceio: v,
            velocidade: v,
            armacao: v,
            cruzamento: v,
            finalizacao: v,
        }
    }
}

/// Uma das 8 funções táticas.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    Goleiro,
    Zagueiro,
    Lateral,
    Volante,
    MeiaCentral,
    Ponta,
    Atacante,
    SegundoAtacante,
}

impl Role {
    /// Mapeia o código tático `fT()` (1..=25) para a função.
    pub fn from_code(code: u8) -> Option<Role> {
        Some(match code {
            1 => Role::Goleiro,
            2 | 9 => Role::Lateral,
            3..=8 => Role::Zagueiro,
            10 | 17 => Role::Ponta,
            11..=13 => Role::Volante,
            14..=16 => Role::MeiaCentral,
            18 | 25 => Role::SegundoAtacante,
            19..=24 => Role::Atacante,
            _ => return None,
        })
    }
}

/// Força bruta ponderada (sem penalidades, sem arredondamento).
pub fn raw_strength(role: Role, a: &Attributes) -> f64 {
    match role {
        Role::Goleiro => a.defesa * 0.60 + a.reflexo * 0.15 + a.posicionamento * 0.15 + a.passe * 0.10,
        Role::Zagueiro => {
            a.desarme * 0.50 + a.cabeceio * 0.25 + a.passe * 0.10 + a.velocidade * 0.10 + a.armacao * 0.05
        }
        Role::Lateral => {
            a.desarme * 0.40
                + a.cruzamento * 0.30
                + a.cabeceio * 0.10
                + a.velocidade * 0.10
                + a.armacao * 0.05
                + a.finalizacao * 0.05
        }
        Role::Volante => {
            a.desarme * 0.40
                + a.passe * 0.20
                + a.cabeceio * 0.15
                + a.armacao * 0.10
                + a.velocidade * 0.10
                + a.finalizacao * 0.05
        }
        Role::MeiaCentral => {
            a.armacao * 0.40
                + a.passe * 0.25
                + a.finalizacao * 0.10
                + a.cabeceio * 0.10
                + a.velocidade * 0.10
                + a.desarme * 0.05
        }
        Role::Ponta => {
            a.passe * 0.25
                + a.cabeceio * 0.25
                + a.armacao * 0.20
                + a.velocidade * 0.15
                + a.finalizacao * 0.10
                + a.desarme * 0.05
        }
        Role::Atacante => {
            a.finalizacao * 0.40 + a.cabeceio * 0.25 + a.velocidade * 0.25 + a.passe * 0.05 + a.armacao * 0.05
        }
        Role::SegundoAtacante => {
            a.finalizacao * 0.40
                + a.passe * 0.25
                + a.velocidade * 0.15
                + a.cruzamento * 0.15
                + a.armacao * 0.05
        }
    }
}

/// Força efetiva: aplica penalidade de 50% (fadiga extrema / fora de posição),
/// arredonda e fixa piso mínimo em 1.
pub fn calculate_effective_strength(role: Role, attrs: &Attributes, penalized: bool) -> i32 {
    let mut s = raw_strength(role, attrs);
    if penalized {
        s *= 0.5;
    }
    let r = s.round() as i32;
    if r <= 0 {
        1
    } else {
        r
    }
}
