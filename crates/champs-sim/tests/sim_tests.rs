use champs_sim::*;
use std::collections::HashMap;

fn attrs_for_test() -> Attributes {
    Attributes {
        defesa: 80.0,
        reflexo: 60.0,
        posicionamento: 40.0,
        passe: 50.0,
        desarme: 70.0,
        cabeceio: 30.0,
        velocidade: 90.0,
        armacao: 20.0,
        cruzamento: 10.0,
        finalizacao: 100.0,
    }
}

fn approx(a: f64, b: f64) {
    assert!((a - b).abs() < 1e-9, "{a} != {b}");
}

// ---------- Nível 1: fórmulas algébricas ----------

#[test]
fn strength_formulas_all_8_roles() {
    let a = attrs_for_test();
    approx(raw_strength(Role::Goleiro, &a), 80.0 * 0.6 + 60.0 * 0.15 + 40.0 * 0.15 + 50.0 * 0.10);
    approx(
        raw_strength(Role::Zagueiro, &a),
        70.0 * 0.5 + 30.0 * 0.25 + 50.0 * 0.1 + 90.0 * 0.1 + 20.0 * 0.05,
    );
    approx(
        raw_strength(Role::Lateral, &a),
        70.0 * 0.4 + 10.0 * 0.3 + 30.0 * 0.1 + 90.0 * 0.1 + 20.0 * 0.05 + 100.0 * 0.05,
    );
    approx(
        raw_strength(Role::Volante, &a),
        70.0 * 0.4 + 50.0 * 0.2 + 30.0 * 0.15 + 20.0 * 0.1 + 90.0 * 0.1 + 100.0 * 0.05,
    );
    approx(
        raw_strength(Role::MeiaCentral, &a),
        20.0 * 0.4 + 50.0 * 0.25 + 100.0 * 0.1 + 30.0 * 0.1 + 90.0 * 0.1 + 70.0 * 0.05,
    );
    approx(
        raw_strength(Role::Ponta, &a),
        50.0 * 0.25 + 30.0 * 0.25 + 20.0 * 0.2 + 90.0 * 0.15 + 100.0 * 0.1 + 70.0 * 0.05,
    );
    approx(
        raw_strength(Role::Atacante, &a),
        100.0 * 0.4 + 30.0 * 0.25 + 90.0 * 0.25 + 50.0 * 0.05 + 20.0 * 0.05,
    );
    approx(
        raw_strength(Role::SegundoAtacante, &a),
        100.0 * 0.4 + 50.0 * 0.25 + 90.0 * 0.15 + 10.0 * 0.15 + 20.0 * 0.05,
    );
}

#[test]
fn weights_sum_to_one() {
    let a = Attributes::uniform(100.0);
    for r in [
        Role::Goleiro,
        Role::Zagueiro,
        Role::Lateral,
        Role::Volante,
        Role::MeiaCentral,
        Role::Ponta,
        Role::Atacante,
        Role::SegundoAtacante,
    ] {
        approx(raw_strength(r, &a), 100.0);
    }
}

#[test]
fn tactical_code_mapping() {
    assert_eq!(Role::from_code(1), Some(Role::Goleiro));
    for c in [2, 9] {
        assert_eq!(Role::from_code(c), Some(Role::Lateral));
    }
    for c in 3..=8 {
        assert_eq!(Role::from_code(c), Some(Role::Zagueiro));
    }
    for c in [10, 17] {
        assert_eq!(Role::from_code(c), Some(Role::Ponta));
    }
    for c in 11..=13 {
        assert_eq!(Role::from_code(c), Some(Role::Volante));
    }
    for c in 14..=16 {
        assert_eq!(Role::from_code(c), Some(Role::MeiaCentral));
    }
    for c in [18, 25] {
        assert_eq!(Role::from_code(c), Some(Role::SegundoAtacante));
    }
    for c in 19..=24 {
        assert_eq!(Role::from_code(c), Some(Role::Atacante));
    }
    assert_eq!(Role::from_code(0), None);
    assert_eq!(Role::from_code(26), None);
}

#[test]
fn penalty_and_floor() {
    let a = Attributes::uniform(80.0);
    assert_eq!(calculate_effective_strength(Role::Atacante, &a, false), 80);
    assert_eq!(calculate_effective_strength(Role::Atacante, &a, true), 40);
    // arredondamento: 0.5 * 51 = 25.5 -> 26
    assert_eq!(calculate_effective_strength(Role::Atacante, &Attributes::uniform(51.0), true), 26);
    // piso mínimo
    assert_eq!(calculate_effective_strength(Role::Goleiro, &Attributes::uniform(0.0), false), 1);
    assert_eq!(calculate_effective_strength(Role::Goleiro, &Attributes::uniform(-5.0), true), 1);
    assert_eq!(calculate_effective_strength(Role::Goleiro, &Attributes::uniform(1.0), true), 1);
}

#[test]
fn anti_blowout_matrices() {
    assert_eq!(finishing_matrix(0, false)[0], 5.5);
    assert_eq!(finishing_matrix(2, false)[0], 5.5);
    assert_eq!(finishing_matrix(3, false)[0], 4.5);
    assert_eq!(finishing_matrix(4, false)[0], 4.5);
    assert_eq!(finishing_matrix(5, false)[0], 3.0);
    assert_eq!(finishing_matrix(6, false)[0], 0.5);
    assert_eq!(finishing_matrix(9, false)[0], 0.5);
    assert_eq!(finishing_matrix(2, true)[0], 3.0);
    assert_eq!(finishing_matrix(1, true)[0], 5.5);
    assert_eq!(TU, [5.5, 35.55, 15.0]);
}

#[test]
fn goal_kind_boundaries() {
    use GoalKind::*;
    assert_eq!(goal_kind_from_roll(0), OpenPlay);
    assert_eq!(goal_kind_from_roll(899), OpenPlay);
    assert_eq!(goal_kind_from_roll(900), Penalty);
    assert_eq!(goal_kind_from_roll(949), Penalty);
    assert_eq!(goal_kind_from_roll(950), FreeKick);
    assert_eq!(goal_kind_from_roll(979), FreeKick);
    assert_eq!(goal_kind_from_roll(980), OwnGoal);
    assert_eq!(goal_kind_from_roll(989), OwnGoal);
    assert_eq!(goal_kind_from_roll(990), Corner);
    assert_eq!(goal_kind_from_roll(994), Corner);
    assert_eq!(goal_kind_from_roll(995), OpenPlay);
    assert_eq!(goal_kind_from_roll(999), OpenPlay);
}

// ---------- RNG ----------

#[test]
fn rng_deterministic() {
    let mut a = Randoms::new(42);
    let mut b = Randoms::new(42);
    for _ in 0..100 {
        assert_eq!(a.next_u64(), b.next_u64());
    }
    assert_ne!(Randoms::new(1).next_u64(), Randoms::new(2).next_u64());
}

fn mean_var(xs: &[f64]) -> (f64, f64) {
    let n = xs.len() as f64;
    let m = xs.iter().sum::<f64>() / n;
    let v = xs.iter().map(|x| (x - m).powi(2)).sum::<f64>() / n;
    (m, v)
}

#[test]
fn rng_distributions() {
    let mut r = Randoms::new(7);
    let n = 200_000;

    let g: Vec<f64> = (0..n).map(|_| r.next_gaussian()).collect();
    let (m, v) = mean_var(&g);
    assert!(m.abs() < 0.02 && (v - 1.0).abs() < 0.03, "gauss {m} {v}");

    let p: Vec<f64> = (0..n).map(|_| r.poisson(2.5) as f64).collect();
    let (m, v) = mean_var(&p);
    assert!((m - 2.5).abs() < 0.03 && (v - 2.5).abs() < 0.06, "poisson {m} {v}");

    let gm: Vec<f64> = (0..n).map(|_| r.gamma(3.0)).collect();
    let (m, v) = mean_var(&gm);
    assert!((m - 3.0).abs() < 0.05 && (v - 3.0).abs() < 0.15, "gamma {m} {v}");

    let b: Vec<f64> = (0..n).map(|_| r.beta(2.0, 5.0)).collect();
    let (m, _) = mean_var(&b);
    assert!((m - 2.0 / 7.0).abs() < 0.01, "beta {m}");

    let mut counts = [0usize; 3];
    for _ in 0..n {
        counts[r.roulette(&[1.0, 2.0, 7.0])] += 1;
    }
    let f: Vec<f64> = counts.iter().map(|c| *c as f64 / n as f64).collect();
    assert!((f[0] - 0.1).abs() < 0.01 && (f[1] - 0.2).abs() < 0.01 && (f[2] - 0.7).abs() < 0.01);
}

// ---------- Nível 2: determinismo ----------

#[test]
fn match_deterministic_with_seed() {
    let h = Team::uniform("H", 70.0, 0);
    let a = Team::uniform("A", 70.0, 100);
    let r1 = MatchEngine::new(&h, &a, false, 99).simulate_full_match();
    let r2 = MatchEngine::new(&h, &a, false, 99).simulate_full_match();
    assert_eq!(r1.goals, r2.goals);
    assert_eq!(r1.events.len(), r2.events.len());
    for (x, y) in r1.events.iter().zip(&r2.events) {
        assert_eq!((x.minute, x.team, x.kind, x.scorer, x.assist), (y.minute, y.team, y.kind, y.scorer, y.assist));
    }
}

// ---------- Nível 3: Monte Carlo ----------

fn varied_team(name: &str, level: f64, base: u32) -> Team {
    let codes = [1u8, 2, 3, 4, 9, 11, 14, 15, 10, 19, 20];
    let players = codes
        .iter()
        .enumerate()
        .map(|(i, c)| {
            let delta = ((i as f64 * 7.0) % 11.0) - 5.0;
            Player::new(base + i as u32, *c, Attributes::uniform((level + delta).max(1.0)))
        })
        .collect();
    Team::new(name, players)
}

#[test]
fn monte_carlo_10000_matches() {
    let n = 10_000u32;
    let matchups = [
        (Team::uniform("Eq-H", 70.0, 0), Team::uniform("Eq-A", 70.0, 100)),
        (varied_team("Fla", 78.0, 0), varied_team("Pal", 72.0, 100)),
        (varied_team("Forte", 85.0, 0), varied_team("Fraco", 60.0, 100)),
    ];
    for (mi, (h, a)) in matchups.iter().enumerate() {
        let mut total_goals = 0u64;
        let mut hist: HashMap<(u32, u32), u32> = HashMap::new();
        let mut max_team = 0;
        let mut max_total = 0;
        let mut scorers_pos = [0u32; 3]; // atacantes, meias, defensores
        let mut kinds = [0u32; 5];
        for i in 0..n {
            let seed = (mi as u64) * 1_000_000 + i as u64 + 1;
            let r = MatchEngine::new(h, a, false, seed).simulate_full_match();
            let t = r.goals[0] + r.goals[1];
            total_goals += t as u64;
            max_total = max_total.max(t);
            max_team = max_team.max(r.goals[0]).max(r.goals[1]);
            *hist.entry((r.goals[0], r.goals[1])).or_default() += 1;
            for ev in &r.events {
                kinds[match ev.kind {
                    GoalKind::OpenPlay => 0,
                    GoalKind::Penalty => 1,
                    GoalKind::FreeKick => 2,
                    GoalKind::OwnGoal => 3,
                    GoalKind::Corner => 4,
                }] += 1;
                if ev.kind == GoalKind::OwnGoal {
                    continue;
                }
                let team = if ev.team == 0 { h } else { a };
                let p = team.players.iter().find(|p| p.id == ev.scorer).unwrap();
                match p.role() {
                    Role::Atacante | Role::SegundoAtacante => scorers_pos[0] += 1,
                    Role::Ponta | Role::MeiaCentral => scorers_pos[1] += 1,
                    _ => scorers_pos[2] += 1,
                }
            }
        }
        let avg = total_goals as f64 / n as f64;
        let zero = *hist.get(&(0, 0)).unwrap_or(&0) as f64 / n as f64;
        println!(
            "[{mi}] avg={avg:.3} max_team={max_team} max_total={max_total} 0x0={zero:.3} kinds={kinds:?} scorers={scorers_pos:?}"
        );
        assert!((2.2..=2.8).contains(&avg), "média de gols fora da faixa: {avg}");
        assert!(max_team <= 8, "placar discrepante: time marcou {max_team}");
        assert!(max_total <= 11, "placar discrepante: total {max_total}");
        assert!(zero < 0.15, "0x0 excessivo: {zero}");

        let gk: u32 = kinds.iter().sum();
        let share = |k: usize| kinds[k] as f64 / gk as f64;
        assert!(share(0) > 0.88 && share(0) < 0.93, "bola rolando {}", share(0));
        assert!((share(1) - 0.05).abs() < 0.015, "pênalti {}", share(1));
        assert!((share(2) - 0.03).abs() < 0.012, "falta {}", share(2));
        assert!((share(3) - 0.01).abs() < 0.008, "gol contra {}", share(3));
        assert!((share(4) - 0.005).abs() < 0.005, "escanteio {}", share(4));

        let sc: u32 = scorers_pos.iter().sum();
        assert!(scorers_pos[0] as f64 / sc as f64 > 0.5);
        assert!((scorers_pos[2] as f64 / sc as f64) < 0.2);
    }
}

#[test]
fn neutral_field_symmetry_and_home_advantage() {
    let h = Team::uniform("H", 70.0, 0);
    let a = Team::uniform("A", 70.0, 100);
    let (mut hg, mut ag, mut nh, mut na) = (0u64, 0u64, 0u64, 0u64);
    for i in 0..10_000u64 {
        let r = MatchEngine::new(&h, &a, false, i + 1).simulate_full_match();
        hg += r.goals[0] as u64;
        ag += r.goals[1] as u64;
        let r = MatchEngine::new(&h, &a, true, i + 1).simulate_full_match();
        nh += r.goals[0] as u64;
        na += r.goals[1] as u64;
    }
    assert!(hg > ag, "mandante deve ter vantagem: {hg} vs {ag}");
    let d = (nh as f64 - na as f64).abs() / (nh + na) as f64;
    assert!(d < 0.04, "campo neutro assimétrico: {nh} vs {na}");
}
