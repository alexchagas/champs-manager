//! Gerador pseudoaleatório portável, equivalente em distribuições a `forms.Randoms`.
//!
//! Núcleo: xoshiro256++ (semeado com splitmix64), puro aritmética inteira -> idêntico
//! em x86_64, ARM e WASM32.

#[derive(Debug, Clone)]
pub struct Randoms {
    s: [u64; 4],
    spare_gaussian: Option<f64>,
}

fn splitmix64(state: &mut u64) -> u64 {
    *state = state.wrapping_add(0x9E37_79B9_7F4A_7C15);
    let mut z = *state;
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^ (z >> 31)
}

impl Randoms {
    pub fn new(seed: u64) -> Self {
        let mut sm = seed;
        let s = [
            splitmix64(&mut sm),
            splitmix64(&mut sm),
            splitmix64(&mut sm),
            splitmix64(&mut sm),
        ];
        Self { s, spare_gaussian: None }
    }

    pub fn next_u64(&mut self) -> u64 {
        let result = self.s[0]
            .wrapping_add(self.s[3])
            .rotate_left(23)
            .wrapping_add(self.s[0]);
        let t = self.s[1] << 17;
        self.s[2] ^= self.s[0];
        self.s[3] ^= self.s[1];
        self.s[1] ^= self.s[2];
        self.s[0] ^= self.s[3];
        self.s[2] ^= t;
        self.s[3] = self.s[3].rotate_left(45);
        result
    }

    /// Uniforme em [0, 1).
    pub fn next_f64(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 * (1.0 / (1u64 << 53) as f64)
    }

    /// Inteiro uniforme em [0, bound).
    pub fn next_int(&mut self, bound: u32) -> u32 {
        assert!(bound > 0);
        (self.next_f64() * bound as f64) as u32
    }

    /// Normal padrão via Box-Muller (polar de Marsaglia, como `java.util.Random`).
    pub fn next_gaussian(&mut self) -> f64 {
        if let Some(g) = self.spare_gaussian.take() {
            return g;
        }
        loop {
            let v1 = 2.0 * self.next_f64() - 1.0;
            let v2 = 2.0 * self.next_f64() - 1.0;
            let s = v1 * v1 + v2 * v2;
            if s < 1.0 && s != 0.0 {
                let m = (-2.0 * s.ln() / s).sqrt();
                self.spare_gaussian = Some(v2 * m);
                return v1 * m;
            }
        }
    }

    /// Poisson(lambda) pelo método de Knuth (lambda grande é dividido em blocos).
    pub fn poisson(&mut self, lambda: f64) -> u32 {
        if lambda <= 0.0 {
            return 0;
        }
        let mut remaining = lambda;
        let mut k = 0u32;
        let mut p = 1.0f64;
        loop {
            // evita underflow de exp(-lambda) para lambda grande
            let step = remaining.min(500.0);
            let limit = (-step).exp();
            remaining -= step;
            loop {
                p *= self.next_f64();
                if p <= limit {
                    break;
                }
                k += 1;
            }
            p = 1.0;
            if remaining <= 0.0 {
                return k;
            }
        }
    }

    /// Gama(alpha, 1) — Marsaglia-Tsang.
    pub fn gamma(&mut self, alpha: f64) -> f64 {
        assert!(alpha > 0.0);
        if alpha < 1.0 {
            let u = self.next_f64().max(f64::MIN_POSITIVE);
            return self.gamma(alpha + 1.0) * u.powf(1.0 / alpha);
        }
        let d = alpha - 1.0 / 3.0;
        let c = 1.0 / (9.0 * d).sqrt();
        loop {
            let x = self.next_gaussian();
            let v = 1.0 + c * x;
            if v <= 0.0 {
                continue;
            }
            let v = v * v * v;
            let u = self.next_f64();
            if u < 1.0 - 0.0331 * x * x * x * x
                || u.max(f64::MIN_POSITIVE).ln() < 0.5 * x * x + d * (1.0 - v + v.ln())
            {
                return d * v;
            }
        }
    }

    /// Beta(alpha, beta).
    pub fn beta(&mut self, alpha: f64, beta: f64) -> f64 {
        let x = self.gamma(alpha);
        let y = self.gamma(beta);
        x / (x + y)
    }

    /// Roleta ponderada: devolve o índice sorteado proporcionalmente aos pesos.
    pub fn roulette(&mut self, weights: &[f64]) -> usize {
        let total: f64 = weights.iter().sum();
        assert!(total > 0.0, "roleta sem peso");
        let mut r = self.next_f64() * total;
        for (i, w) in weights.iter().enumerate() {
            if r < *w {
                return i;
            }
            r -= *w;
        }
        weights.len() - 1
    }
}
