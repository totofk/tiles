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
for batches 1–35, plus the big-farm roadmap. Lines 1–7436 of that file are the old `docs/PLAN.md` line for line, so a
`PLAN.md:N` citation from before 2026-11-14 points at the same line there. References like PLAN.md "Batch 24 results"
in tests and `docs/DECISIONS.md` resolve there too.

The archive is append-only and large (7,400+ lines, ~680 KB). Never read it whole: read only the line range a brief
cites, or `grep -n '^## Batch N'` and read that range.

## Active batches
New batch plans are appended below, and workers write `## Batch N results` + `### Deviations` at the end of this file.
After a batch is pushed, Hermes moves its plan and results to the end of the archive.

## Batch 35.1 — Split `tests/sim.test.ts` by system (task 191, test refactor only, no save bump, no number change)

Why: `tests/sim.test.ts` is 300 KB / ~5,500 lines. Worker transcripts from 2026-11-11 to 11-13 show it read 194× for
797K chars, the largest single cost in worker context and Max quota (Toon's retro, 2026-11-14). Split it so that a
batch reads one ~30–60 KB file plus the shared bot.

- [x] 191. Move every `describe` in `tests/sim.test.ts` into per-system files under `tests/sim/`, and move the shared
  bot and helpers into `tests/sim/bot.ts`. Change no test body, no pinned number and no test name.
  - `tests/sim/bot.ts` (no `describe`/`it`): imports, the `market` / `rules` / `OLD_CERTIFICATE` switches,
    `withoutMarket`, `withBatch13`, `runBot` and every ladder, plus each later top-level helper that more than one
    new file uses. A helper used by only one file moves into that file.
  - The `vi.mock('../src/core/balance', …)` block (now lines 114–134) must apply in EVERY new test file, with the same
    behaviour. `vi.mock` is hoisted per test file, so it cannot live only in `bot.ts`. Export the factory from
    a small module (for example `tests/sim/balanceMock.ts`, holding the `market` / `rules` state it reads) and call
    `vi.mock('../../src/core/balance', balanceMock)` at the top of each test file. Every bot and pin must see the
    mocked balance exactly as it does today.
  - Files, by the current `describe` line ranges (re-measure with `grep -n '^describe(' tests/sim.test.ts`):
    - `sim/early.test.ts`: soft-lock recovery, tool bot, batches 6 / 6.1 / 7 / 7.1 / 8 (1172–1862)
    - `sim/furnace-iron.test.ts`: batches 9 / 10 / 11 (1863–2440)
    - `sim/market-orders.test.ts`: batches 12 / 13 / 14 (2441–2964)
    - `sim/tools-workshop.test.ts`: batches 15 / 16 / 17 (2965–3495)
    - `sim/fields.test.ts`: batch 28 offline plots, batches 18 / 19 (3496–4262)
    - `sim/prestige-crops.test.ts`: batches 20 / 22 (4263–4641)
    - `sim/mine-estate.test.ts`: batches 28.1 / 28.2 / 32 / 32.2 / 33 / 31.1 / 29 (4642–5221)
    - `sim/bars-ladder.test.ts`: batches 34 / 35 (5222–end)
  - Module-level runs (for example `const ironLadder = withoutMarket(…)`) move into the file that uses them, so a file
    never computes another file's ladder at import.
  - Delete `tests/sim.test.ts`. `tests/simLog.ts` stays where it is (fix import paths only).
  - Acceptance (record each in the results):
    1. Before the split, save `npx vitest list tests/sim.test.ts` → `sim-logs/names-before.txt (gitignored)`. After the split,
       `npx vitest list tests/sim/` → after. The two sets of `describe > it` names, without file prefixes, are
       identical: same count, no name added, dropped or renamed.
    2. `sort` of every line of old `tests/sim.test.ts` vs `cat tests/sim/*.ts | sort`: the only differing lines are
       `import` / `export` / `vi.mock` / `vi.hoisted` lines and blank lines. Paste the differing-lines count by kind.
    3. Full `pnpm test` gives the same totals as before the split (record both; batch 35 ended at 1137 passed + 3
       expected failures).
    4. `pnpm lint`, `pnpm build`, `rm -f node_modules/.tmp/*.tsbuildinfo && npx tsc -b --force` are green, and no new
       file is over 80 KB (`wc -c tests/sim/*.ts`).
  - Update in-repo references to `tests/sim.test.ts` (`grep -rn "sim.test" docs src tests CLAUDE.md`) to the new paths.
    Leave the archive (`docs/archive/PLAN-history.md`) as it is.

CHANGELOG line (copy verbatim): "Behind the scenes: the game's balance checks were reorganised so updates ship faster. Nothing changes in play."

## Batch 35.1 results

`tests/sim.test.ts` (300,456 bytes / 5,529 lines / 172 tests) → `tests/sim/`: eight per-system test files plus shared
`bot.ts` and `balanceMock.ts`. Every code line moved verbatim; only imports, exports and the `vi.mock` wiring are new.
`tests/simLog.ts` stays in `tests/`; its imports still resolve from there (checked, no change needed). Doc references
updated: `docs/PLAN.md` layout tree + task 5, `docs/DECISIONS.md` sold-run pin pointer (now
`tests/sim/prestige-crops.test.ts`); the archive is untouched.

New files (`wc -c`, all under 80 KB — was one 300 KB file):

```
2018  tests/sim/balanceMock.ts      31824 tests/sim/furnace-iron.test.ts   22280 tests/sim/prestige-crops.test.ts
18505 tests/sim/bars-ladder.test.ts 51999 tests/sim/fields.test.ts         30883 tests/sim/tools-workshop.test.ts
63463 tests/sim/bot.ts              27481 tests/sim/market-orders.test.ts  29589 tests/sim/mine-estate.test.ts
32583 tests/sim/early.test.ts
```

Acceptance:

1. Name sets: `npx vitest list` before (`sim-logs/names-before.txt`) = 172 `describe > it` names, after
   (`tests/sim/`, `sim-logs/names-after.txt`) = 172. Sets identical — 0 only-before, 0 only-after, none renamed.
2. Sorted line multiset, old file vs `cat tests/sim/*.ts` (blank lines excluded): differing lines by kind —
   OLD-ONLY 39 (import 33, vi.mock 1, vi.hoisted 3 — the `market` / `rules` / `OLD_CERTIFICATE` switches, now plain
   exports in `balanceMock.ts`, plus 2 import/export continuation fragments); NEW-ONLY 465 (import 162, export 7,
   vi.mock 8 — the hoisted mock line in each test file, plus 288 specifier/continuation fragments of those multi-line
   imports and `bot.ts`'s export list). Lines outside import/export/vi.mock/vi.hoisted: 0 on both sides. One line
   inside the extracted factory differs only by module path (`'../src/core/balance'` → `'../../src/core/balance'`).
3. Full-suite totals: before 1137 passed + 3 expected failures (1140 tests); after the split 63/63 files,
   1137 passed + 3 expected failures (1140). Identical.
4. Gates: `pnpm lint` green, `pnpm build` green, `rm -f node_modules/.tmp/*.tsbuildinfo && npx tsc -b --force` green;
   `git ls-files | sed -E 's/\.(tsx?|jsx?)$//' | sort -f | uniq -di` prints nothing; no scratch scripts or `sim-logs/`
   output committed.

### Deviations

- The suggested call `vi.mock('../../src/core/balance', balanceMock)` (factory statically imported) crashes on
  Vitest 5.1: the hoisted `vi.mock` call reads the `balanceMock` import binding before initialisation
  (`ReferenceError: Cannot access '__vi_import_12__' before initialization`). Each test file instead calls
  `vi.mock('../../src/core/balance', async (importOriginal) => (await import('./balanceMock')).balanceMock(importOriginal))`
  — same shared factory, same behaviour, resolved lazily inside the factory so hoisting cannot see the binding.
- Before-totals note (flake, not a spec deviation): the raw first before-run printed 1134 passed + 3 expected +
  3 failed; all three failures were 5.4–6.4 s timeouts under load and each reran green standalone, so the recorded
  before-totals are 1137 + 3 expected, matching batch 35's record.
