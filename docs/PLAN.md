# Prototype plan — Phase 1 ("manual farm")

Question this prototype must answer: in the first 5–10 minutes, is the manual loop
plant → water → harvest → sell, under an energy limit, fun enough that the player
*wants* a sprinkler? If not, stop and fix the loop before Phase 2.

## Scope
**In:** 6 tiles, 2 crops (fast/cheap; slow/expensive behind a license), till/plant/water/harvest,
energy + regen, moisture bar, on-field rot, instant sell (no inventory), 3 upgrades
(energy max, energy regen, buy tile 7–8), localStorage save, offline catch-up (cap 8 h).

**Out:** workers, machines, dynamic market, inventory spoilage, loans, prestige, art.

## Stack
Vite + TypeScript + React, Vitest. Package manager: pnpm. Repo: this directory.

## Layout
```
src/
  core/            # pure TS, never imports React or DOM
    state.ts       # RunState / MetaState (run/meta split), GameState = { run, meta }
    step.ts        # step(state, ticks): moisture drains, crops grow while moist, energy regen, rot past grace
    actions.ts     # till/plant/water/harvest/sell/buyUpgrade/buyLicense/buyTile — return new state or a typed error
    balance.ts     # every tunable number lives here, read through multiplier fns
    data/crops.ts, data/upgrades.ts
  app/             # React: FarmGrid, Hud (cash/energy), Shop
  save/            # serialize/deserialize + schema version + offline catch-up
tests/
  *.test.ts        # per-action tests; sim/ holds the per-system bot sims (bot.ts + balanceMock.ts)
docs/              # PRD.md, DECISIONS.md, PLAN.md
```

## Tasks (in order)
1. Scaffold Vite + React + TS + Vitest; eslint; scripts `dev` / `build` / `test` / `lint`. Commit.
2. `core/state.ts` + `core/balance.ts` + `core/data/*` — data model and all starting values.
3. `core/step.ts` — tick logic, with tests (grow only while moist, regen caps at max, rot after grace).
4. `core/actions.ts` — 4 manual actions + sell + buy upgrade/license/tile; one test file per action group; errors are values, not throws.
5. `tests/sim/early.test.ts` — greedy bot plays 600 ticks: cash never negative, crop-2 license affordable within ~300 ticks (target, tune `balance.ts` until it passes and report the final numbers). (Was `tests/sim.test.ts` until batch 35.1.)
6. [x] React UI: 6-tile grid (colour/emoji per state), click tile → next sensible action, HUD, Shop. Mobile-width friendly.
7. [x] Save/load (localStorage, versioned) + offline catch-up (step missed seconds, cap 8 h), tested with a fake clock.
8. [x] Deploy to GitHub Pages (Vite `base`, `gh-pages` or Actions workflow).
9. [x] Playtest together in the Discord thread → record verdict + tuned numbers in `docs/PLAYTEST.md`.

Tasks 1–5 are batch 1; 6–8 batch 2. Each batch = one commit series on `main` (prototype repo,
no branch ceremony yet).

## Rules for the implementer
- `src/core/**` must stay free of React/DOM imports; add an eslint `no-restricted-imports` rule or a test that asserts it.
- All numbers in `balance.ts`. If you need a number elsewhere, add it there first.
- Do not start a dev server in headless runs; `pnpm test` and `pnpm build` are the proof.
- Keep `docs/DECISIONS.md` authoritative; if you must deviate, write the deviation and reason into `docs/PLAN.md` under "Deviations".

## Archive
Finished batches live in `docs/archive/PLAN-history.md`: every batch plan, `## Batch N results` and `### Deviations`
for batches 1–39, plus the big-farm roadmap. Lines 1–7436 of that file are the old `docs/PLAN.md` line for line, so a
`PLAN.md:N` citation from before 2026-11-14 points at the same line there. References like PLAN.md "Batch 24 results"
in tests and `docs/DECISIONS.md` resolve there too.

The archive is append-only and large (7,400+ lines, ~680 KB). Never read it whole: read only the line range a brief
cites, or `grep -n '^## Batch N'` and read that range.

## Active batches
New batch plans are appended below, and workers write `## Batch N results` + `### Deviations` at the end of this file.
After a batch is pushed, Hermes moves its plan and results to the end of the archive.

## Batch 40 — 🧪 Flaky timing tests + the it.fails review (tasks 273–277, tests only, save stays v38)

Why: Toon (2026-11-25): tests time out (~5 s) or fail the PIN28perf timing check under the full parallel run and pass
on rerun (batches 30, 36.x, 37, 37.1 each recorded one in Deviations); review the `it.fails` tests. Decisions:
`docs/DECISIONS.md` "Batch 40 refined" D1–D5.

Hard guards: no `src/**` change but the CHANGELOG line (no game rule, balance number or save change; SAVE_VERSION
stays 38); no sim number re-pinned except the ones the it.fails conversions name; no test skipped or deleted to get
green.

Anchors: measured on be21283 (origin/main after batch 38); rebased onto 6828bd3 (main after batch 39, tasks 268–272,
the feedback save) before commit. Batch 39 is archived in this batch's first commit.

## Tasks (273–277)

- [x] 273. **Perf pins on CPU time.** New `tests/sim/cpuTime.ts` `cpuMs(run)` (process.cpuUsage user + system).
  The six `Date.now()` timings become `cpuMs(() => catchUp(big, 8 * HOUR_TICKS * 1000))`: fields.test.ts PIN28perf
  (×3, it.each), PIN18g (1,000 tiles), PIN19e (3,000 tiles); prestige-crops.test.ts PIN22d (1,920 tiles). Bar stays
  2,000 ms; titles say "ms of CPU".
- [x] 274. **Suite timeout.** vite.config.ts top-level `testTimeout: 20_000` (both projects inherit it); manager.test.ts's
  own 20 s override goes (now the default).
- [x] 275. **Price it.fails → waived-target pins** (fields.test.ts): FIELDS_CASH < 0.35 h (measured 0.12 h, income
  > 0); a gap > 60 game-min remains Tractor → Pump 2 (measured 347 min, pump2 > tractor); exactly one of the five
  machine rows < 0.35 h (seeder1, measured 0.19 h).
- [x] 276. **Wetlands bot + open shortfalls.** bot.ts WETLANDS_LADDER puts `tiles13` first (tile index 12 is outside
  the bank beds, so the bot can water by hand and unlock the water tool). districts.test.ts PIN36h becomes a measured
  pin of the new result; market-orders.test.ts's two ⭐/h ≥ 80 `it.fails` become "known shortfall" pins.
- [x] 277. The CHANGELOG line (src/app/changelog.ts, the batch-35.1 "Behind the scenes" precedent), this section's
  results + Deviations; DECISIONS "Batch 40 refined".

## Batch 40 results

Root cause (measured on be21283, a 4-core container): every flake is an absolute wall-clock bar. Quiet: two full runs
1413 passed + 6 expected fail, 528 s, no flake; the six offline perf pins 0.83–1.04 s (bar 2,000 ms, ~2× headroom); the
heavy unit tests 0.6–1.2 s (Vitest's 5 s default). Load repro (12 busy node processes on 4 cores — the load an agent box
or a parallel build adds): the perf pins read 4.1–6.2 s and failed (5 of 5 run), the Manager 8 h test 5.3 s, relics
PIN36l 3.6 s. A probe of the same catch-up read wall 4.1–6.6 s but `process.cpuUsage()` 1.0–1.8 s. Why the suite is
exposed: `fields.test.ts` collects its ladder runs (~75 s at describe scope) while the 64 unit files fill every core.

- 273 (d88360f): `tests/sim/cpuTime.ts` `cpuMs(run)`; PIN28perf ×3, PIN18g, PIN19e (fields.test.ts) and PIN22d
  (prestige-crops.test.ts) time `catchUp` in CPU ms. Under the same 12-process load: PIN28perf 952 / 1,154 / 1,262,
  PIN18g 1,149, PIN19e 1,357, PIN22d 1,119 ms — all under 2,000 ms (were 4.1–6.2 s wall).
- 274 (1c66714): `testTimeout: 20_000` at the top of vite.config.ts `test` (both projects). Under load the PIN28perf / PIN19e
  tests' step-identity half took 6.2–6.6 s and hit the 5 s default once the CPU bar was fixed — why it is suite-wide,
  not unit-only as first planned. manager.test.ts's own 20 s override folded into the default.
- 275 (4336553): fields.test.ts's three price `it.fails` → "waived target (price(s) LOCKED)" pins: FIELDS_CASH / income < 0.35
  with income > 0; longest Tractor → Pump 2 gap > 60 game-min with pump2 > tractor; exactly one of the 5 machine rows
  < 0.35 h (seeder1).
- 276 (c49741d): bot.ts WETLANDS_LADDER = WETLANDS_GOALS with `tiles13` moved first. PIN36h before: Wetlands null at 24 h
  (deadlock at copper:water, 0 waters). After: **Wetlands reaches the Fields at 4.64 h vs plain10 7.39 h (−37 %)**,
  out of band on the fast side → pinned as measured (`< −20 %`, both non-null). market-orders.test.ts's cert ⭐/h ≥ 80
  and accept-all ⭐/h ≥ 80 `it.fails` → "known shortfall" pins (cert 0 < ⭐/h < 80; all ⭐0/h and 0 contracts).
- Plan commit 344b997 (archive batch 39 + DECISIONS "Batch 40 refined").
- 277 (this commit): the CHANGELOG line (139 code points, "Behind the scenes…"); results + Deviations; DECISIONS
  "Batch 40 refined" D1–D5 landed with the plan commit.

Final gates (rebased tree on 6828bd3, Batch 39 in): 74 files, **1435 tests, 0 expected fail** (main had 1429 + 6).
Full run: 1434 passed + 1 failed (changelog.test.ts: no Batch 40 entry), 541 s, no timing flake; after 277's CHANGELOG
line the changelog file re-ran green (only the failing file was re-run). Before the rebase (be21283): 1419 passed + 0
expected fail (was 1413 + 6), 522 s. Lint clean; build clean (97 modules); dist deleted. Load repro after the fix: 9 / 9
targeted tests green under 12 busy processes. No `src/**` file touched except the CHANGELOG line; SAVE_VERSION stays
38; no sim number moved except PIN36h (null → 4.64 h, the deadlock fix).

### Deviations

- Developed on be21283 in parallel with Batch 39, then rebased onto main after Batch 39 merged (6828bd3): the first
  commit archives Batch 39. The measurements above are from be21283; Batch 39 touched no sim, balance or core file, and
  the final full suite was re-run on the rebased tree (Final gates above).
- The full suite ran on the final tree and on the first tree (before the 274 widening), not before every task commit:
  each run is ~9 min here and tasks 273–276 touch tests only; each task's own files were run on their own and under the
  load repro.
- PIN36h is a real finding, not just a test change: with the bot deadlock gone, the no-mine Wetlands ladder reaches the
  Fields 37 % faster than plain10. Per DECISIONS "Batch 36.3 refined" item 14 nothing is tuned here; whether the barge
  prices / bank beds need a balance pass is Toon's call (a future batch).
- The two market shortfalls stay open (DECISIONS D5): on the live v28 save 3 of 4 slots hold ironBar / coal orders that
  storage (full 120 / 120) never feeds and a potato order the fields cannot sow; nothing ever discards them.
- `cpuMs` counts GC helper threads, so a quiet reading can sit a little above the wall time (probe: 1,529 CPU vs 1,152
  wall on the first, unwarmed iteration). It is only valid under the default `forks` pool (noted in the helper).
- The CHANGELOG line is a "Behind the scenes" one (batch 35.1 precedent): nothing a player sees changed, but
  tests/changelog.test.ts requires an entry for every `## Batch N results`. It was missed on the first full run on the
  rebased tree (1 failed: changelog) and added in 277.
- Merged main again after PR #1 (the batch 38 live check, fd9cd8f) landed: one conflict in docs/archive/PLAN-history.md
  — its "### Hermes live check" section and this batch's archived Batch 39 both appended after Batch 38's Deviations;
  resolved by keeping the live check under Batch 38, then Batch 39. The merge adds its 4 appCss pins: merged tree
  1439 passed + 0 expected fail, 74 files, 592 s; lint and build clean.
- The thread brief said "~11 it.fails"; the tree had 6 (batch 37 / 37.1 had already deleted the rest).
