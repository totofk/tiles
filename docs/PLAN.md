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

- [ ] 273. **Perf pins on CPU time.** New `tests/sim/cpuTime.ts` `cpuMs(run)` (process.cpuUsage user + system).
  The six `Date.now()` timings become `cpuMs(() => catchUp(big, 8 * HOUR_TICKS * 1000))`: fields.test.ts PIN28perf
  (×3, it.each), PIN18g (1,000 tiles), PIN19e (3,000 tiles); prestige-crops.test.ts PIN22d (1,920 tiles). Bar stays
  2,000 ms; titles say "ms of CPU".
- [ ] 274. **Suite timeout.** vite.config.ts top-level `testTimeout: 20_000` (both projects inherit it); manager.test.ts's
  own 20 s override goes (now the default).
- [ ] 275. **Price it.fails → waived-target pins** (fields.test.ts): FIELDS_CASH < 0.35 h (measured 0.12 h, income
  > 0); a gap > 60 game-min remains Tractor → Pump 2 (measured 347 min, pump2 > tractor); exactly one of the five
  machine rows < 0.35 h (seeder1, measured 0.19 h).
- [ ] 276. **Wetlands bot + open shortfalls.** bot.ts WETLANDS_LADDER puts `tiles13` first (tile index 12 is outside
  the bank beds, so the bot can water by hand and unlock the water tool). districts.test.ts PIN36h becomes a measured
  pin of the new result; market-orders.test.ts's two ⭐/h ≥ 80 `it.fails` become "known shortfall" pins.
- [ ] 277. The CHANGELOG line (src/app/changelog.ts, the batch-35.1 "Behind the scenes" precedent), this section's
  results + Deviations; DECISIONS "Batch 40 refined".
