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
  *.test.ts        # per-action tests + sim.test.ts (bot plays 600 ticks)
docs/              # PRD.md, DECISIONS.md, PLAN.md
```

## Tasks (in order)
1. Scaffold Vite + React + TS + Vitest; eslint; scripts `dev` / `build` / `test` / `lint`. Commit.
2. `core/state.ts` + `core/balance.ts` + `core/data/*` — data model and all starting values.
3. `core/step.ts` — tick logic, with tests (grow only while moist, regen caps at max, rot after grace).
4. `core/actions.ts` — 4 manual actions + sell + buy upgrade/license/tile; one test file per action group; errors are values, not throws.
5. `tests/sim.test.ts` — greedy bot plays 600 ticks: cash never negative, crop-2 license affordable within ~300 ticks (target, tune `balance.ts` until it passes and report the final numbers).
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

## Batch 1 results
Final starting balance (`src/core/balance.ts`), 1 tick = 1 s:

| Crop | License | Seed | Sell | Grow (ticks) | Rot grace (ticks) |
|---|---|---|---|---|---|
| radish | 0 (owned at start) | 2 | 10 | 100 | 200 |
| pumpkin | **100** (was 150) | 10 | 60 | 240 | 480 |

- Energy: max 20, regen 1/3 per tick, each farm action costs 1, shop actions cost 0.
- Moisture: watering sets 1, drains 1/60 per tick (empty in 60 s); from a dry tile radish needs 2 waterings,
  pumpkin 4. Harvest and rot keep the soil's moisture, so a quick replant may need one fewer.
- Upgrades: `energyMax` cost 50 × 1.6^level, +5 max per level; `energyRegen` cost 75 × 1.7^level,
  +25 % of base regen per level; both cap at level 10. Buying `energyMax` does not refill energy.
- Tiles: start 6, cap 24, next tile costs 100 × 1.5^(owned − 6); new tiles are untilled.
- Starting cash: 20.

Step semantics: growth checks moisture **before** that tick's drain, so a full bar buys exactly 60 growth
ticks. A crop's `ticksSinceMature` starts counting on the tick after it matures; it rots on the tick that
count exceeds the grace window.

Greedy bot (`tests/sim.test.ts`, no upgrades or tiles bought; "dry" = moisture exactly 0), milestone ticks:

| Milestone | Tick |
|---|---|
| first radish harvest | 100 |
| pumpkin license affordable | 200 |
| pumpkin license bought | 201 |
| first pumpkin planted | 300 |
| first pumpkin harvest | 540 |

Lowest cash in the run: 4. Cash at tick 600: 304.

## Deviations
- **Harvest sells instantly; there is no `sell` action.** With no inventory in Phase 1, `harvest` credits the
  crop's sell price straight to cash and leaves the tile tilled. A separate sell step would only cost a click.
- **ESLint instead of oxlint; TypeScript pinned `~6.0.3`.** typescript-eslint does not support TS 7 yet.
  ESLint rules enforce the pure core (no React/DOM imports, no `window`/`document`, no `Date.now()` / `new Date`).
- **Pumpkin license 150 → 100.** At 150 the license becomes affordable only at tick 300 (after the 3rd
  radish cycle). All 6 tiles are then replanted with radish until tick 400, so the first pumpkin matures at
  640, past the 600-tick target. At 100 it is affordable after the 2nd cycle (tick 200). DECISIONS.md values
  (energy, regen, moisture, rot factor) are unchanged.
- **UI lives in `src/app/`; `src/App.tsx` moved there.** Tap logic (`nextTileAction` / `tapTile`) and display helpers
  (`isMature`, `isDry`, `growthProgress`, `ticksUntilRot`) are pure functions in `src/core/tile.ts` with tests.
  "Dry" = moisture exactly 0, same as the sim bot. Since batch 3 (round-1 playtest) tapping any growing tile waters it:
  a moist tile is topped up to 1 for 1 energy, so the player decides when to top up. The old "Growing — water it
  when dry" refusal is gone, and `tapTile` always returns a result.
- **Rot warning threshold (last 25 % of grace) is a display constant in `FarmGrid.tsx`**, not in `balance.ts`: it
  changes colour only, never game state.
- **`serialize(state, savedAtMs)` takes the wall time as an argument** (brief said `serialize(state)`), so
  `src/save/serialize.ts` stays pure and lint-checked like core; `Date.now()` lives only in `wallClock` in
  `src/save/storage.ts`, injected into `loadGame` / `saveGame`.
- **Save is throttled, not debounced:** the first change schedules a save 1 s later. A resetting debounce never fires,
  because ticks change state every second. Saves also run on `visibilitychange`→hidden and `pagehide`.
- **Returning to a hidden tab catches up by wall clock** through the same `catchUp()` and 8 h cap as a reload, and
  shows the same "Away for …" banner. The rAF/interval timer only pauses: `performance.now()` may not advance
  during device sleep.
- **Unreadable saves (corrupt JSON, unknown or future version) are copied to `tiles.save.bad`** and the game starts
  fresh, so a newer build's save is not silently overwritten.
- **`OFFLINE_CAP_TICKS = 8 * 3600` added to `balance.ts`**; no existing number changed.
- **Upgrade max level 10** added in `balance.ts` so `buyUpgrade` can return `MAX_LEVEL`; no cap was specified before.
- **Batch 3: `fertilizer` also speeds up crops already in the ground**, and `cropGrowTicks` now rounds to whole ticks.
  The **rot grace window stays 2× the unfertilized grow time**, so fertilizer never shortens the harvest window.
- **Batch 3: milestone upgrades are locked in the core too.** `buyUpgrade` returns `LOCKED` before the counter
  reaches the threshold; hiding them in the shop is not the only gate.
- **Batch 3: tile helpers (`isMature`, `growthProgress`, `ticksUntilRot`, `nextTileAction`) take `GameState`** instead
  of `MetaState`, because grow time now depends on the fertilizer level in `run.upgrades`.
- **Batch 3: the v1 → v2 save migration pads any save with fewer than 9 tiles** (the brief said "6 tiles"; v1 saves
  could hold 7–8 bought tiles, and `tileCost` would drop below its base price for them). It also **clamps current
  energy to the new, lower max**, and sets the new upgrade levels to 0 (`sellPrice`, `fertilizer`). Without that,
  `buyUpgrade` would read `undefined` and buy level NaN.
  Fields v1 lacks are taken from a new run's defaults (`createInitialState().run`), so a migrated run has no mine
  license, no pickaxe, an empty bag, vein 0 and `rngState = INITIAL_RNG_SEED`.
- **Batch 3: `sales` counts units sold**, not sell calls: a harvest is 1 sale, "sell all" of 7 stone is 7, the same
  as "sell 1" tapped 7 times. Mining therefore pulls the `sellPrice` unlock (25 sales) earlier.
- **Batch 3: `sellPrice` raises item prices too** (stone and wood), not only crops. It scales both activities alike,
  so the "mining < farming per energy" ratio is unchanged.
- **Batch 3: wood takes bag space** (one bag for all items): `buyWood` returns `BAG_FULL` when the bag is full.
  Wood resells for 2, below its buy price of 4 (even at `sellPrice` level 5 it sells for 3), so there is no money loop.
- **Batch 3: `craftPickaxe` with a pickaxe already in hand returns `ALREADY_OWNED`** so wood is not wasted.
  Buy, craft, license and sell cost no energy; only `dig` does. `buyWood` does not need the mine license.
- **Batch 3: amounts are validated.** `buyWood(n)` and `sellItem(id, n)` return `BAD_AMOUNT` unless n is an
  integer ≥ 1. ESLint now also bans `Math.random` in core and in serialize.
- **Batch 3 UI: a shop card is a single button, so "dim only the button" means** a disabled button no longer uses
  `opacity`. Its background goes grey with a dashed border while the label and price keep full-contrast text.
  Mine panel buttons (Dig, craft, buy wood) are disabled using the core action's own result. The Dig button shows that
  error's text as the reason ("No pickaxe", "Bag is full — sell something", "Not enough energy"). The 375 px layout
  is CSS only (flex-wrap rows) and was not checked in a browser in this batch (no dev server in headless runs).


## Batch 3 — round-1 fixes + mining v1 (tasks 10–14)
Question: does digging while crops grow remove the "idle" feeling, without out-earning farming?

10. [x] Fix the "radish became pumpkin" report: crop emoji + name on planted tiles, harvest toast "+💰N <crop>",
    tap guard after harvest (UI constant), watering allowed any time. Update `tile.ts` helpers + tests.
11. [x] Rebalance: START_TILES 9, ENERGY_MAX_BASE 10. Milestone counters in run state + `sellPrice` and `fertilizer`
    upgrades (hidden until unlocked). Save version 2 with migration from v1 (fill new fields with defaults).
12. [x] Mining core: `src/core/mining.ts` + `data/items.ts` — mine license, buy wood, craft wooden pickaxe (durability),
    dig (energy + durability → 1 drop from the vein table via seeded PRNG in run state), inventory with capacity,
    sell item. Typed errors: NO_MINE_LICENSE, NO_PICKAXE, BAG_FULL, NOT_ENOUGH_ITEMS, …
13. [x] Mining UI: a "Mine" panel under the farm (dig button with pickaxe durability bar, bag N/cap, item rows with
    sell buttons, craft/buy buttons). Shop: mine license. Fix the three UI nits: unaffordable cards unreadable
    (dim the button, not the price), "💰 75" wrapping in the HUD, Reset button too easy (small, bottom, confirm).
14. [x] Sim: bot farms 9 tiles and digs whenever energy is idle and no farm action is possible. Assert: cash never
    negative; mining cash per energy spent < farming cash per energy spent (report both); mine license affordable
    within ~150 ticks; first pickaxe never leaves cash below 0. Record tuned numbers under "Batch 3 results".

Starting numbers (tune via the sim): mine license 50, wood 4 each, wooden pickaxe = 3 wood, durability 20,
stone sells 2, bag capacity 20, `sellPrice` +10 %/level cost 80 × 1.6^level (unlock 25 sales), `fertilizer`
−10 % grow time/level cost 120 × 1.7^level (unlock 15 harvests), both max level 5.

## Batch 3 results
The sim passes on the **starting numbers above, unchanged**. `balance.ts` changes in batch 3: START_TILES 9,
ENERGY_MAX_BASE 10, and the new mining and upgrade numbers exactly as listed. Wood resells for 2 (below its buy
price of 4). Everything else is as in Batch 1 results.

Greedy bot (`tests/sim.test.ts`): it farms first on 9 tiles (same priority as batch 1, no upgrades or tiles bought).
When no farm action is possible and energy ≥ 1, it digs: buy the license, buy wood and craft a pickaxe when it has
none, sell all stone when the bag is full. It runs with two mine-license policies:
- **pumpkin-first:** buys the mine license only once the pumpkin license is owned.
- **mine-early:** buys the mine license as soon as it is affordable while energy is idle (what a player is likely to do).

| Milestone (tick) | Batch 1 (6 tiles, energy 20) | pumpkin-first | mine-early |
|---|---|---|---|
| first radish harvest | 100 | 100 | 100 |
| mine license affordable | — | 124 | 124 |
| mine license bought | — | 455 | 129 |
| first dig | — | 464 | 147 |
| pumpkin license affordable | 200 | 200 | 336 |
| pumpkin license bought | 201 | 207 | **337** |
| first pumpkin planted | 300 | 215 | 354 |
| first pumpkin harvest | 540 | 455 | 594 |

| At tick 600 | pumpkin-first | mine-early |
|---|---|---|
| lowest cash | 2 | 0 |
| final cash | 394 | 116 |
| harvests / sales / digs | 31 / 31 / 19 | 30 / 70 / 43 |
| **farming cash per energy** | **4.20** ((536 + 178) / 170) | **3.34** ((202 + 353) / 166) |
| **mining cash per energy** | **1.37** ((−12 + 38) / 19) | **1.16** ((44 + 6) / 43) |

Cash per energy is net, per energy spent on that activity. Farming = harvest income − seeds, per farm action.
Mining = stone sold − wood bought, per dig. Unfinished work at tick 600 is valued the same way for both: crops in
the ground at sell price × growth progress (178 / 353), items in the bag at sell price (38 / 6). Licenses
(pumpkin 100, mine 50) are one-off capital, left out of both.

Findings for round-2 playtest:
- **Buying the mine license early delays the pumpkin license by ~130 ticks** (207 → 337). Before ~250 it cannot pay
  for itself: 50 license + 12 wood, while digging nets ~1.4 per idle energy, about 11 digs by tick 250. No mining
  price in a sane range fixes that. Pumpkin by ~250 holds only if the player saves for the pumpkin first.
  **The brief's bot is the mine-early policy, and it misses the ~250 target.** Its bound was loosened to ≤ 350 and
  `balance.ts` was not tuned for it. The ≤ 250 assertion holds only for the added pumpkin-first policy.
- **Mining stays clearly below farming per energy:** about 3× under both policies (1.37 vs 4.20, 1.16 vs 3.34).
  Mining nets ~1.4 per dig at best (stone 2 − 12 wood per 20-dig pickaxe), so it stays a filler.
- With energy 10 the farm alone uses ~170 of the ~210 energy in 600 ticks. Mining fills the other ~20–40.


## Batch 4 — desktop-first responsive layout (tasks 15–17)
Question: does the game feel like a desktop game at full screen while still playable on a phone?
UI only: no change to `src/core/**` numbers or the save format.

15. [ ] Layout shell: drop the 480 px cap. ≥ 1024 px three columns (Mine | Farm | side panel); 768–1023 px
    Farm + Mine side by side and the side panel as a slide-over; < 768 px one view at a time with a bottom tab bar
    and a sticky HUD. Farm tiles scale with the space (square, readable at 375 px and 1440 px). Before the mine
    license the Mine column/tab shows a locked card with the license price.
16. [ ] Side panel with tabs **Shop / Upgrades** (Bank added in batch 4.5): split the current Shop into Shop
    (seeds, licenses, wood, tiles) and Upgrades (energy max, regen, sell price, fertilizer; milestone-hidden ones
    stay hidden). Collapse/expand button on desktop; when collapsed the farm grows. Toasts stay visible in every
    layout.
17. [ ] UI state (active tab/view, panel collapsed) persisted under localStorage key `tiles.ui`, separate from the
    game save; a broken/missing value falls back to defaults. Component tests for the tab switching and the
    persisted UI state. Reset save stays a small confirm-guarded button at the bottom of the side panel / Farm view.

## Batch 4.5 — bank v0, rough (tasks 18–20)
Question: does a loan get a broke player out of the soft-lock without becoming a free-money exploit?
Numbers are placeholders, retuned after docs/research/round2-mining.md.

18. [ ] Core `src/core/bank.ts`: `run.loan: { principal, debt } | null`. `takeLoan()` (only when no loan; principal
    = `LOAN_PRINCIPAL`, cash += principal, debt = principal × (1 + `LOAN_FEE`)), `repay(amount)` (partial or full,
    capped at debt and cash; loan cleared at 0). `step` grows debt by principal × `LOAN_RATE_PER_TICK` per tick,
    capped at principal × `LOAN_DEBT_CAP` (2.0). Typed errors: LOAN_ACTIVE, NO_LOAN, NOT_ENOUGH_CASH. Save v3 with
    v2 → v3 migration (`loan: null`) tested on a real v2 fixture.
19. [ ] Bank tab in the side panel (and the mobile tab bar): borrow button with principal + fee + growth explained
    in one line, current debt with its cap, a "time until cap" hint, repay 💰N / repay all. HUD shows a small debt
    badge while a loan is active.
20. [ ] Tests: the round-2 soft-lock state (cash 1, 9 tilled tiles, empty bag, no pickaxe) recovers via a loan —
    the bot takes the loan, farms, repays in full, and ends with more cash than it started. Exploit check: borrow →
    repay immediately always loses cash (fee > 0). Existing sim: the greedy bot never borrows and its batch-3
    numbers do not change. Record the placeholder numbers under "Batch 4.5 results".

Starting numbers (placeholders): LOAN_PRINCIPAL 30, LOAN_FEE 0.1, LOAN_RATE_PER_TICK 0.002 (debt reaches the 200 %
cap after ~450 ticks ≈ 7.5 min), LOAN_DEBT_CAP 2.0.
