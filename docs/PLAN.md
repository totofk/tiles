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
  "Dry" = moisture exactly 0, same as the sim bot: tapping a planted tile that is still moist and growing does nothing
  (toast "Growing — water it when dry"), so the player cannot top up early. Revisit in playtest.
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


## Batch 3 — round-1 fixes + mining v1 (tasks 10–14)
Question: does digging while crops grow remove the "idle" feeling, without out-earning farming?

10. [ ] Fix the "radish became pumpkin" report: crop emoji + name on planted tiles, harvest toast "+💰N <crop>",
    tap guard after harvest (UI constant), watering allowed any time. Update `tile.ts` helpers + tests.
11. [ ] Rebalance: START_TILES 9, ENERGY_MAX_BASE 10. Milestone counters in run state + `sellPrice` and `fertilizer`
    upgrades (hidden until unlocked). Save version 2 with migration from v1 (fill new fields with defaults).
12. [ ] Mining core: `src/core/mining.ts` + `data/items.ts` — mine license, buy wood, craft wooden pickaxe (durability),
    dig (energy + durability → 1 drop from the vein table via seeded PRNG in run state), inventory with capacity,
    sell item. Typed errors: NO_MINE_LICENSE, NO_PICKAXE, BAG_FULL, NOT_ENOUGH_ITEMS, …
13. [ ] Mining UI: a "Mine" panel under the farm (dig button with pickaxe durability bar, bag N/cap, item rows with
    sell buttons, craft/buy buttons). Shop: mine license. Fix the three UI nits: unaffordable cards unreadable
    (dim the button, not the price), "💰 75" wrapping in the HUD, Reset button too easy (small, bottom, confirm).
14. [ ] Sim: bot farms 9 tiles and digs whenever energy is idle and no farm action is possible. Assert: cash never
    negative; mining cash per energy spent < farming cash per energy spent (report both); mine license affordable
    within ~150 ticks; first pickaxe never leaves cash below 0. Record tuned numbers under "Batch 3 results".

Starting numbers (tune via the sim): mine license 50, wood 4 each, wooden pickaxe = 3 wood, durability 20,
stone sells 2, bag capacity 20, `sellPrice` +10 %/level cost 80 × 1.6^level (unlock 25 sales), `fertilizer`
−10 % grow time/level cost 120 × 1.7^level (unlock 15 harvests), both max level 5.
