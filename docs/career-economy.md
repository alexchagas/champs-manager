# Career and economy implementation

## Active career path

`GameContext.tsx` drives the UI career. It calls `WasmCareerEngine` in `wasm.rs` for matches and lineup operations, then closes the round in `careerEconomy.ts`. The separate `market.rs` operates on the Rust core season model and is not called by this UI career. Its existence alone does not activate its AI window rules. The UI market transactions and AI market window now use the same TypeScript coverage and budget checks whether the match WASM engine is available or not.

The TypeScript ledger is the sole round finance authority. Rust no longer posts gate receipts or home-team wages. Each club has exactly one statement per round, including away clubs. The home club alone receives gate income. Every balance mutation in the UI path posts a ledger entry; `post` refreshes a statement when a transaction occurs after the round close. Unpaid wages are accrued as a separate obligation and only the amounts actually paid reduce cash. Loan principal still due remains debt even if cash is negative. A manager change does not touch cash, debt, wages or contracts.

WASM web DTOs retain unknown JSON fields through `serde(flatten)`, including manager IDs, manager records, financial ledgers, loans, news and future fields. The bridge also merges career state and recreates an engine from the current state for each operation. Old saves migrate once to schema 2: stable manager IDs derive from the original club ID, the human gets a separate ID, job records start at the loaded season and round, and existing balance, debt, loans, results and news remain. Legacy offers are repriced and invalid ones expire. Database contracts and market values are scaled once; this changes ongoing contracts in migrated saves to the new economic scale.

## Balance parameters

The raw database has monthly professional wages far above gate revenue. Migration and new games divide database wages by 35 and market values by 10. Generated youth contracts remain at their existing scale. Weekly professional and youth payroll is one quarter of monthly wages. Weekly stadium maintenance is R$ 0.70 per seat. Home attendance is deterministic from capacity and ticket price, with occupancy clamped to 25–90%. The board transfer reserve is 4, 2 or 1 weeks of obligations for cautious, balanced or ambitious clubs. A proposed transfer must cover the fee, one additional week of the new player's wages and the applicable reserve. Offers expire after two rounds and are checked again when accepted. AI windows run every third round. Cautious, balanced and aggressive managers target 17, 18 or 20 professionals respectively, with position coverage goals, while 16–30 and an available keeper plus eleven available players remain hard rules for sales.

Manager season score is the sum of: 4 × (actual points − expected points from relative squad strength), an achievement component from match results, squad value change capped at ±15, and cash/arrears change capped at ±20. A league title adds 20 to career score at season end. Career score carries completed job scores across clubs and seasons. Board rating is separate and responds to results, new wage arrears and inability to field eleven. The new manager starts at a board rating of 55 and inherits the club's finances without inheriting responsibility for prior wage arrears. At the end of round 38 the career creates the next calendar and resets the season standings while retaining managers, jobs, cash, debt and squads.

## Baseline and deterministic stress run

Raw database samples before migration (monthly professional wages):

| Division | Club | Cash | Wages | Estimated home gate |
|---|---|---:|---:|---:|
| 1 | América-MG | R$ 9.68m | R$ 25.89m | R$ 0.61m |
| 2 | Bahia | R$ 26.00m | R$ 22.70m | R$ 1.66m |
| 3 | ABC | R$ 8.41m | R$ 16.06m | R$ 0.40m |
| 4 | Afogados | R$ 4.12m | R$ 9.44m | R$ 0.16m |

`npm run sim:economy` uses eight clubs from each Brazilian division for three deterministic 38-round seasons, with youth squads and all three board policies. Final medians:

| Division | Cash | Monthly professional wages | Squad size |
|---|---:|---:|---:|
| 1 | R$ 54.57m | R$ 0.74m | 24 |
| 2 | R$ 20.31m | R$ 0.57m | 22 |
| 3 | R$ 9.60m | R$ 0.36m | 21 |
| 4 | R$ 4.17m | R$ 0.30m | 19 |

The run recorded 12 sales and 12 matching purchases, 33 managers with completed or multiple jobs, zero clubs with wage arrears at the end, zero clubs with invalid lineups, and zero debt. Cash minima ranged from R$ 0.28m to R$ 2.91m across divisions. Crisis and arrears paths are exercised separately by unit tests because this baseline run did not naturally trigger borrowing or unpaid wages.

## Verification and limits

Run `npm run test:career`, `npm run sim:economy`, `npx tsc --noEmit`, `npm run wasm:build`, `npm run build`, and `cargo test -p champs-core --lib`. Tests cover save migration, manager identity and job continuity, score updates, dismissal/appointment without cash reset, once-only round close, away payroll, arrears repayment, transaction and statement reconciliation, offer validity/expiry, keeper and roster protection, season rollover, and the original unaffordable Palmeiras–Marinho offer.

The simulation uses deterministic scores and gates, not the full match engine's stochastic injuries and suspensions. Its stronger cash growth at large stadium clubs needs continued tuning against full interactive seasons. The UI career still has a limited free-agent pool, so prolonged injury clusters can require promoting youth; the hard sale check prevents a club from making an existing lineup shortage worse. Existing historical ledgers are retained rather than retroactively rewritten, so reconciliation is guaranteed from the migrated career's first new transaction onward.
