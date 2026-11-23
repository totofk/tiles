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
for batches 1–36.8, plus the big-farm roadmap. Lines 1–7436 of that file are the old `docs/PLAN.md` line for line, so a
`PLAN.md:N` citation from before 2026-11-14 points at the same line there. References like PLAN.md "Batch 24 results"
in tests and `docs/DECISIONS.md` resolve there too.

The archive is append-only and large (7,400+ lines, ~680 KB). Never read it whole: read only the line range a brief
cites, or `grep -n '^## Batch N'` and read that range.

## Active batches
New batch plans are appended below, and workers write `## Batch N results` + `### Deviations` at the end of this file.
After a batch is pushed, Hermes moves its plan and results to the end of the archive.

## Batch 36.8.1 — 🚜 Honest rig "adds" + compact fee (task 251, save stays v36)
Source: Hermes's live check of 36.8 (2026-11-23, Toon's v35 save migrated to v36 on bundle BbmDDzer): both rig rows
read "adds ≈💰44.483M/h", but PIN36.8 measured ≈💰3.8M/h gross per seeder rig on the same save (nets 13.81M → 20.49M
with 2 rigs, + 0.9M/h fees, ÷ 2). Cause: `rigView` (src/core/fields.ts:601-610) multiplies `RIG_TILES_PER_HOUR` by
`fieldsMarginalIncomePerHour` (:612-629), which is 💰/h of one STANDING tile (profit × 3600 ÷ cycle) — a rig adds
1,800 SOWN (or reaped) tiles/h, each worth one crop's profit, and only while the other machine kind and the wet land
keep up. It also shows a harvester rig as worth as much as a seeder rig on a seeder-bound estate. Second: the fee
renders with `price()` as "💰300,000/h" beside "💰3M sign-on". Go: Toon "ปล่อย 36.8.1" (2026-11-23).

Rules for this batch: ONE task, one commit. No save change (SAVE_VERSION stays 36), no balance number changes, no
sim pin moves (no sim reads `rigView`; `fieldsMarginalIncomePerHour` keeps its exact value — the payback label and
the 8 h sim pin use it). Anchors measured on 0b85e6ad + docs commit; re-grep before editing.

## Tasks (251)
- [ ] 251. Rig "adds" = the extra tiles the fleet can really sow AND reap × profit per sown tile; fee in `approx()`.
  a. Core (src/core/fields.ts): split the loop of `fieldsMarginalIncomePerHour` (:617-629) into a private
     `bestFieldTile(state): { perHour: number; perTile: number; cycle: number } | null` — the same crop pick (max
     perHour, ties keep the first as today), `perTile = price − cropSeedCost` of that crop, `cycle` its pressured
     ticks — and make `fieldsMarginalIncomePerHour` return `bestFieldTile(state)?.perHour ?? 0` (value unchanged:
     every existing pin in tests/fields.test.ts :386 / :765-795 must pass untouched).
  b. Core: new exported `rigAdds(state, kind): { perHour: number; limit: 'seeder' | 'harvester' | 'land' | 'crop' | null }`:
     `s` / `h` = the seeder / harvester fleet tiles/h (`fleetTilesPerTick(machines, kind) × 3600`, :512-515, rigs
     included); `demand` = `wetTiles(f) × 3600 ÷ best.cycle` (:71-74 — the tiles/h the pivoted land can take);
     `flow(s, h) = min(demand, s, h)`; `perHour = (flow with RIG_TILES_PER_HOUR added to this kind − flow(s, h)) ×
     best.perTile`, rounded down, never below 0. `limit` = null when perHour > 0; else `'crop'` when there is no
     `bestFieldTile`, `'land'` when `demand ≤ min(s, h)` of this kind's side, otherwise the OTHER kind
     (`'harvester'` for a seeder rig, `'seeder'` for a harvester rig). Doc comment says it is a steady-state estimate
     (backlogs of ready / empty plots are not counted).
  c. `rigView` (:601-610): `addedPerHour` now comes from `rigAdds(state, kind).perHour`; add `limit` to its return.
     Nothing else in `rigView` changes.
  d. UI (src/app/Estate.tsx:176): import `approx` beside `price` (:20). The `<small>` text becomes, verbatim:
     - not maxed: `+${rigTilesPerHour()} tiles/h each · next 💰${price(view.signOn)} sign-on + 💰${approx(view.feePerHour)}/h · ${adds}`
     - maxed: `+${rigTilesPerHour()} tiles/h each · ${adds}`
     where `adds` = `adds ≈💰${approx(view.addedPerHour)}/h` when addedPerHour > 0, else by `view.limit`:
     `'seeder'` → `adds nothing now: seeders are the limit`; `'harvester'` → `adds nothing now: harvesters are the
     limit`; `'land'` → `adds nothing now: every wet plot is covered`; `'crop'` → `adds nothing now: no crop to plant`.
  e. Tests:
     - tests/Estate.test.tsx:548-566: update both text pins to the new strings (`approx(RIG_FEE_PER_HOUR * n)`;
       their one-radish-plot states will likely read a limit phrase — pin whichever the core returns, by computing
       the expected string from `rigView`, plus one explicit literal check that "💰300k/h" appears for 0 rigs).
     - tests/fields.test.ts, new `describe('batch 36.8.1: rigAdds')`: (1) on `tests/fixtures/save-v35.json`
       (deserialize → v36, rigs empty): the seeder rig adds between 💰2.3M and 💰5.3M/h (PIN36.8's measured
       ≈💰3.8M/h gross per rig ± 40 %) and log the value; the harvester rig adds 0 with limit `'seeder'` (that save's
       5,400 seeder vs 12,600 harvester tiles/h). (2) a hand-built state where harvesters are slower: the harvester rig
       adds > 0, the seeder rig 0 / `'harvester'`. (3) both kinds fast enough to cover the land: 0 / `'land'`.
       (4) `rigAdds` never exceeds `RIG_TILES_PER_HOUR × perTile` (one-line property over the 3 states).
     - tests/changelog.test.ts:11-15 + :27-30: `parts()` must accept a third number ("36.8.1" → [36, 8, 1]; missing
       parts are 0) and the strictly-decreasing check compares all three in order; keep the comment style.
  f. CHANGELOG: one entry `{ batch: '36.8.1', date: '2026-11-23', line: … }` at the TOP, line verbatim (173 code points):
     "Hired rigs now show what one more rig really adds: the extra tiles/h your slower machine and wet land allow × profit per tile, or which part is the limit; fees read 💰300k/h."
  g. Write `## Batch 36.8.1 results` + `### Deviations` at the TRUE END of docs/PLAN.md (test totals before → after,
     the fixture's seeder / harvester rigAdds values, every new string) and tick 251.
