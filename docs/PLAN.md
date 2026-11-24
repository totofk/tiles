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

- [x] 259. **Save v38: the current floor gains its 4th row.** Commit FIRST.
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
- [x] 260. **Ladder pin + sims.** tests/mining.test.ts:759–762 "mean rocks to the ladder 6.5 ± 0.3" → 8.5 ± 0.3
  (2,000 seeds). Run `pnpm test`; every moved sim number: re-pin old → new with the one cause (16 rocks per floor:
  more presses per floor before the ⬇️, more ore per floor). PIN37a: set `PARENT_FIELDS_H` (tests/sim/mine-estate.test.ts
  :637) to 8.41 (12a1851) and report the new value; PIN37b seal hours reported old → new. A guard failure = blocker.
- [x] 261. **UI + CHANGELOG + results.** The grid shows 4 rows (CSS `.floor-grid` app.css:1233–1245 — rows from the
  constant, no fixed 3-row height; each rock ≥ 44 × 44 at 375; at ≥ 1024 the rock slots grow to ≈ 96 px squares
  with the ore emoji ≈ 40 px and the hit counter on its own line under the emoji, grid centred ≈ 408 px wide — Toon:
  "desktop mine slot มันเล็กไปนะ"). Status line "Row 1/4". jsdom: 16 cells, rows 2–4 disabled on a fresh floor, the
  class names exist in app.css. CHANGELOG: ONE entry at the top of `CHANGELOG` (src/app/changelog.ts), exactly:
  `⛏️ Mine floors are now 4×4: 16 rocks per floor, and bigger rocks on wide screens.` Then `## Batch 37.1 results` +
  `### Deviations` at the true end of docs/PLAN.md (tests before → after, SHAs per task, PIN37a/b old → new, every
  re-pin with cause, the v37 fixture's v38 check, unverified widths).

Not in this batch: the 3-section screen layout (its own UI batch after Toon approves the Superdesign mockups).

## Batch 37.1 results

- 259 (2d23f7a): save v38 + the 4×4 core. 1412 → 1414 total (1404 passed + 7 expected fail + 1 flake →
  1408 passed + 6 expected fail, no flake). FLOOR_ROWS 3 → 4 (balance.ts:179) is the only balance number
  that moved; every literal "12 rocks" in src/ and tests/ now reads FLOOR_COLS × FLOOR_ROWS; rollRocks(n,
  mastered, aim, rng, count) is split out of rollFloor so the migration rolls exactly 4 rocks from the
  floor's own stream. SAVE_VERSION 37 → 38 with the frozen v37 shape (RocksV37 = 12-tuple; migrateV36
  keeps rolling the historical 12-rock grid, so the chained v36 → v37 → v38 path lands on 16 rocks);
  migrateV37 appends the 4 rocks from floor.rng with floorWeights(n, run.masteredTiers.length,
  run.favours.aim) and keeps the 12 saved rocks, the ladder, found, n, deepest, run.rngState and
  run.vein exactly; chained on every migrate() branch (v38 direct, v37, v36, v35, v34). The v37 fixture
  (tests/fixtures/save-v37.json, never edited) lands on v38 with rocks[0..11] deep-equal + 4 appended
  unbroken (rng advanced, run.rngState and run.vein untouched); a hand-built v37 save with hits keeps
  every hit; every fixture v1…v37 lands on 16 rocks; same input → same 4 rocks. Re-pins: round-trip 38 /
  future 39 (save.test.ts), SAVE_VERSION 38, App "Will migrate v15 → v38", balance pin [4, 4, 5, 25,
  0.05], every toHaveLength(12) on a floor → 16, Mine.test 16 cells + "Row 1/4" + rows 2–4
  aria-disabled. The ladder pin moved with this commit (6.5 → 8.5 ± 0.3, (N+1)/2 over 16 rocks) so both
  commits are green.
- 260 (f087194): the ladder pin re-verified (2,000 seeds) and every moved sim number re-pinned old → new
  with the one cause — 16 rocks per floor (FLOOR_ROWS 3 → 4): more ore per floor, so bars and the copper
  pickaxe come sooner and the source runs' `end` moves, shifting every downstream sell/smelting choice.
  early: batch-7 pin object (veinLv1 786→936, furnace 1089→1113, storageLv2 1227→1251, veinLv2 1539→1548,
  firstBar 1659→1746, copperPickaxe 1905→2022), finalCash 5591→5663, sales 475→469 (rngState and every
  other counter unchanged — a sell choice), batch-7.1 order [1905, 2235, 2433, 2673]→[2022, 2313, 2562,
  2790], finalCash 6101→5786, batch-8 harvestCertificate 991→997, [finalCash, wages] [3702, 390]→[3564,
  393]. furnace-iron: batch-9/10/11 ladder objects (firstBar 1495→1480 … plantCertificate 4438→4423),
  worker/final tuples ([14243, 920, 81, 83]→[14754, 919, 81, 82], [14389, 1024, 69]→[14853, 1027, 70],
  [6697, 1159, 113, 15]→[7171, 1173, 119, 15]), batch-11 steps {4486/4738/5336/5520/6001/6601}→{4489/
  4726/5321/5510/5992/6592}, batch-10 offline gains (967→1297, [71055, 3555, 711]→[70969, 3551, 710],
  idle/unstaffed [1, 4994, 28]/[0, 4669, 23]→[0, 4861, 23] — seedless again), batch-11 offline [601, 32, 5,
  71337, 3603]→[531, 36, 5, 71133, 3607]. fields: PIN18b lemon [46609, 83004, 83004, 82929, 83101],
  mixed [77155, 66171]→[77751, 66741], PIN18e coal [974, 12]→[982, 11], PIN19b curve, harvester2
  marginal 220.9 → null (incomeAt(h12) − incomeAt(h1) flips sign, delta 1132 → −73), PIN36a loop
  re-pinned (plain 8.41→8.32 h, berryFast 9.39→9.33, rootsFast 9.34). market-orders: batch-11 replay
  (finalCash 6697→7171 off / 5444→6505 on, mineCertificate 6601→6592, ironPickaxe gap 1263→1266),
  batch-13 certificates (mine 86.5/116.7 → 84.7/114.8 etc.), [6055, gap 1215]→[5932, 1209].
  mine-estate: ORE_SORT incomePerHour 13753→13647 (the rule's cash part stays 💰7,000) and
  PARENT_FIELDS_H 8.24→8.41 (12a1851's final plain value — the 4×4 grid moves the measured run, not the
  baseline). prestige-crops: speedups 1.67→1.71 and 1.45→1.43, PIN28_1b [124.5, 123.9]→[124.5, 123.6],
  PIN22 band [0.51, 0.56, 0.31, 0.29]→[0.49, 0.54, 0.31, 0.29], PIN28_1c [105.5, 74.6]→[105.6, 74.5].
  tools-workshop: batch-15 phase 86.6→88.8 min at 💰19,755→19,641/h (43→44 bars, mine certificate
  116.7→114.8 min), batch-16 firstGoldBar 312→310.1, vein phase 30.6→30.7 min at 💰16,152→16,288/h,
  gold phase 109.3→110.4 min at 💰16,426→16,375/h, finalCash 87061→86810; batch-17 incomes [22450, 27398,
  31850]→[23040, 26857, 31700], finalCash 597148→597180, cash parts 0.379→0.369 / 0.292→0.298 /
  0.464→0.46, coal [648, 7]→[639, 7].
- 261 (7bf8a34): the rock buttons split into .rock-emoji over .rock-hits (a flex column) so the hit
  counter sits under the ore emoji; app.css keeps the 44 px base cells (4 × 44 + 3 × 4 = 188 px fits the
  344 px Mine column at 375) and adds @media (min-width: 1024px): repeat(4, 96px), gap 8, min-height
  96 px, 40 px emoji, 14 px counter (4 × 96 + 3 × 8 = 408 px, centred). Rows stay driven by the buttons
  (FLOOR_COLS × FLOOR_ROWS), the status line "Row N/4" is unchanged, and the ⚡ Mine-next hint keeps its
  "🪨 0/3" spacing (rockLabel + hits — only the grid cells are two spans). jsdom: the cell textContent
  loses the old space (`🪨0/3`), .rock-emoji/.rock-hits assert the split, and the appCss pin requires
  repeat(4, 44px), the new classes and the ≥1024 media query. CHANGELOG: the batch 37.1 line at the top,
  verbatim, 81 code points.
- results (this commit): ticks + this section. Final gates: 73 files, 1408 passed + 6 expected fail (no
  flake), lint clean, build clean (95 modules), tsc -b --force clean after rm of the two stale
  tsbuildinfo, dist deleted, purity grep clean over src/core + src/save (storage.ts:26 the only known
  wallClock).

Guards: PIN37a Fields unlock 8.32 h vs parent 8.41 h (−1.1 %, inside ±20 %) green; the PIN36a soil loop
green (berryFast +12.1 %, rootsFast +12.3 %); PIN37b seal hours 0.23/0.50/1.51/4.44 → 0.24/0.43/1.56/
4.26 h; PIN37c and the 255b mineStall guard false/null everywhere; no negative cash or items; every
fixture migrates to v38 with no rock progress lost. No blocker fired.

### Deviations

- 259 and 260 were developed together and split at commit time: the ladder pin and every sim re-pin
  landed in 259's commit so each commit is green; 260's commit re-verifies the ladder (2,000 seeds) and
  carries the re-pin diffs + the PARENT_FIELDS_H re-base.
- The PIN36a fruitVegFast_rootsSlow 20-h it.fails was deleted: with 16 rocks per floor the run reaches
  at 7.44 h (the higher mine income keeps cash above 0 at the 2nd water hire, so the documented batch-36
  bot deadlock no longer fires) — the expected-fail had nothing left to fail at. Expected-fail count
  7 → 6.
- Unverified UI widths: the 44 px base cells and the ≥1024 96 px cells are pinned only in app.css text
  and jsdom, not in a browser; no visual pass at 375/1024/1440 (no browser in this batch; Hermes sweeps
  those live).
- Per-iteration runs were file-scoped (npx vitest run tests/sim/…); the full suite stayed the gate
  before each commit and ran green twice with no flake (batch 37 ended with one PIN28perf-class flake).
- Tooling: `node [...line].length` for the 81 code points (as batch 37); the lowfat git wrapper trims
  even redirected output, so full commit messages were read via `command git cat-file`; compound Bash
  commands and glob `rm` were permission-gated — single-purpose commands only.
