//! Small deterministic PRNG (SplitMix64) used by the career simulation.
//! Kept inside champs-core so the macro layer has no extra dependencies and
//! its state can be serialized with the save game.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CoreRng {
    state: u64,
}

impl CoreRng {
    pub fn new(seed: u64) -> Self {
        Self { state: seed ^ 0x9E37_79B9_7F4A_7C15 }
    }

    pub fn next_u64(&mut self) -> u64 {
        self.state = self.state.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.state;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    /// Uniform in `[0, 1)`.
    pub fn next_f64(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 / (1u64 << 53) as f64
    }

    /// Uniform integer in `[lo, hi)`; returns `lo` when the range is empty.
    pub fn range(&mut self, lo: u32, hi: u32) -> u32 {
        if hi <= lo {
            return lo;
        }
        lo + (self.next_u64() % (hi - lo) as u64) as u32
    }

    /// Uniform float in `[lo, hi)`.
    pub fn range_f64(&mut self, lo: f64, hi: f64) -> f64 {
        lo + self.next_f64() * (hi - lo)
    }

    /// True with probability `p` (clamped to 0..=1; NaN counts as 0).
    pub fn chance(&mut self, p: f64) -> bool {
        if !(p > 0.0) {
            return false;
        }
        self.next_f64() < p.min(1.0)
    }

    /// Poisson sample (Knuth); `lambda` is clamped to `0..=20`.
    pub fn poisson(&mut self, lambda: f64) -> u32 {
        let lambda = if lambda.is_finite() { lambda.clamp(0.0, 20.0) } else { 0.0 };
        let limit = (-lambda).exp();
        let mut k = 0u32;
        let mut p = 1.0;
        loop {
            p *= self.next_f64();
            if p <= limit || k >= 100 {
                return k;
            }
            k += 1;
        }
    }

    /// Fisher-Yates shuffle.
    pub fn shuffle<T>(&mut self, items: &mut [T]) {
        for i in (1..items.len()).rev() {
            let j = self.range(0, i as u32 + 1) as usize;
            items.swap(i, j);
        }
    }
}
