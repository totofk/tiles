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
for batches 1–37, plus the big-farm roadmap. Lines 1–7436 of that file are the old `docs/PLAN.md` line for line, so a
`PLAN.md:N` citation from before 2026-11-14 points at the same line there. References like PLAN.md "Batch 24 results"
in tests and `docs/DECISIONS.md` resolve there too.

The archive is append-only and large (7,400+ lines, ~680 KB). Never read it whole: read only the line range a brief
cites, or `grep -n '^## Batch N'` and read that range.

## Active batches
New batch plans are appended below, and workers write `## Batch N results` + `### Deviations` at the end of this file.
After a batch is pushed, Hermes moves its plan and results to the end of the archive.

## Batch 37.1 — ⛏️ The floor grid becomes 4 × 4 (tasks 259–261, save v37 → v38)

Why: Toon after batch 37 (Discord thread 1573749154092679272, 2026-11-24): "4x4 ดีกว่า 4x3 มันน้อยไปบวกไม่สมมาตรแฮะ"
(4 × 3 is too few rocks and not symmetric). Rows still open one at a time, top first; the ladder still hides under one
rock, uniform. Expected rocks broken to find it = (N + 1) / 2 = 6.5 → 8.5 (computed). No other rule or number changes.

Hard guards (blockers: record under `### Deviations` and stop, never tune): PIN37a Fields unlock within ±20 % of the
parent 12a1851's 8.41 h; the rootsFast/berryFast PIN36a loop stays green; PIN37c and the mineStall guard stay green;
no negative cash/items; every fixture migrates; a migration never takes value away (no rock progress lost).

Anchors: measured on 12a1851 (origin/main after batch 37). Context: `docs/DECISIONS.md` "Batch 37.1 refined".

## Tasks (259–261)

- [ ] 259. **Save v38: the current floor gains its 4th row.** Commit FIRST.
  - `src/core/balance.ts:179` `FLOOR_ROWS = 3` → `4` (`FLOOR_COLS` stays 4). `rollFloor` (src/core/mining.ts:81–93),
    `openRow` (:245–250), `mineRock` (:259–300) and Mine.tsx read the constants — grep every literal `12` that means
    "rocks per floor" in src/ and tests/ and replace it with `FLOOR_COLS * FLOOR_ROWS`.
  - `src/save/serialize.ts`: SAVE_VERSION 37 → 38 (:40); freeze `RunV37`/`SaveV37` (today `SaveV37 = {…state:
    GameState}` :326 — freeze the floor shape as 12 rocks); `migrateV37` after `migrateV36` (:961): KEEP the 12 saved
    rocks exactly (kind, hits, broken), the ladder index, `found`, `n`, `deepest`; APPEND 4 rocks rolled from the
    floor's own `floor.rng` with `floorWeights(n, run.masteredTiers.length, run.favours.aim)` (the same draw
    `rollFloor` makes) and store the advanced `floor.rng`; `run.rngState` and `run.vein` untouched. Edge: if all 12
    were broken the 4 new rocks are the open row (correct by `openRow`). Chain migrateV37 on every branch of `migrate`
    (:974–981).
  - Fixture `tests/fixtures/save-v37.json` is ALREADY committed (the v36 fixture migrated and re-saved by the live v37
    build D4nGeh8p: floor 21, 12 rocks, vein Lv4). Never edit tests/fixtures. Tests: it lands on v38 with its 12 rocks
    deep-equal + 4 appended unbroken rocks, ladder/found/n unchanged; a hand-built v37 save with hits on rocks keeps
    every hit; every fixture v1…v37 lands on v38 with 16 rocks; same input → same 4 rocks.
  - Re-pins: round trip 38, future 39 (tests/save.test.ts:598–599), `SAVE_VERSION` 38 (:1141), App "Will migrate v15 →
    v38" (tests/App.test.tsx:489), balance pin [4, 4, 5, 25, 0.05] (tests/balance.test.ts:245), every
    `toHaveLength(12)` on a floor → 16 (tests/mining.test.ts:752/:848/:882, tests/save.test.ts:1885/:1900), the
    Mine.test.tsx hand-built floor helper (:38) → 16 kinds.
- [ ] 260. **Ladder pin + sims.** tests/mining.test.ts:759–762 "mean rocks to the ladder 6.5 ± 0.3" → 8.5 ± 0.3
  (2,000 seeds). Run `pnpm test`; every moved sim number: re-pin old → new with the one cause (16 rocks per floor:
  more presses per floor before the ⬇️, more ore per floor). PIN37a: set `PARENT_FIELDS_H` (tests/sim/mine-estate.test.ts
  :637) to 8.41 (12a1851) and report the new value; PIN37b seal hours reported old → new. A guard failure = blocker.
- [ ] 261. **UI + CHANGELOG + results.** The grid shows 4 rows (CSS `.floor-grid` app.css:1233–1245 — rows from the
  constant, no fixed 3-row height; each rock ≥ 44 × 44 at 375; at ≥ 1024 the rock slots grow to ≈ 96 px squares
  with the ore emoji ≈ 40 px and the hit counter on its own line under the emoji, grid centred ≈ 408 px wide — Toon:
  "desktop mine slot มันเล็กไปนะ"). Status line "Row 1/4". jsdom: 16 cells, rows 2–4 disabled on a fresh floor, the
  class names exist in app.css. CHANGELOG: ONE entry at the top of `CHANGELOG` (src/app/changelog.ts), exactly:
  `⛏️ Mine floors are now 4×4: 16 rocks per floor, and bigger rocks on wide screens.` Then `## Batch 37.1 results` +
  `### Deviations` at the true end of docs/PLAN.md (tests before → after, SHAs per task, PIN37a/b old → new, every
  re-pin with cause, the v37 fixture's v38 check, unverified widths).

Not in this batch: the 3-section screen layout (its own UI batch after Toon approves the Superdesign mockups).
