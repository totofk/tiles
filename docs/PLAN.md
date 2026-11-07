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
- **Batch 4: breakpoints are CSS only** (no `matchMedia` in the app). Every column is always rendered and media
  queries pick what shows, so the tablet slide-over and the desktop column are the same `<aside>`. The 375 / 768 /
  1440 px layouts were not checked in a browser (no dev server in headless runs).
- **Batch 4: the tablet slide-over's open state is not persisted.** It is an overlay and always starts closed;
  of the panel's open/closed state, `tiles.ui` keeps only the desktop collapse flag, which the slide-over ignores.
- **Batch 4: farm tiles are `aspect-ratio: 1` with a 96 px floor**, so a tile with long text on a narrow screen grows
  taller instead of clipping. Columns: 3 below 768 px, ⌈√tiles⌉ above (9 → 3, 16 → 4, 24 → 5), tiles capped at 260 px.
  Desktop side columns scale with the viewport (`clamp(…vw…)`), so the farm is ~450 px wide at 1024 px and ~670 px
  at 1440 px (9 tiles ≈ 147 / 219 px); collapsing the panel at 1440 px grows them to the 260 px cap.
- **Batch 4: the Farm view shows "Planting: 🥕 Radish"**, because on mobile the seed picker sits in the Shop view and
  a tap on a tilled tile plants the selected crop (the round-1 "radish became pumpkin" report).
- **Batch 4: the locked Mine card also has the buy button** for the mine license (same action as the Shop card).
- **Batch 4: buy wood is in both Shop and the Mine panel.** Shop holds wood per the task; the Mine panel keeps its
  button next to "craft" so a mobile player does not switch views to craft a pickaxe. The Shop shows wood only after
  the mine license (it replaces the license card there). The unlock toast now says "New upgrade: …".
- **Batch 4: Reset save is rendered twice** (bottom of the side panel and of the Farm view). CSS shows the panel one at
  ≥ 768 px and the Farm one below, so it is never hidden behind the Shop tab on mobile.
- **Batch 4: `tiles.ui` is parsed field by field**: a broken or non-object value gives the defaults, and a single bad
  field (unknown view, a tab id not in `PANEL_TABS`) falls back alone. A storage that throws also gives the defaults.
  DOM tests use `@testing-library/react` + `jsdom` through a per-file `// @vitest-environment jsdom` comment;
  every other test still runs in node.
- **Batch 4.5: `repay(amount)` never pays part of the requested amount when cash is short.** "Capped at debt and
  cash" is read as: the payment is `min(amount, debtDue)`, and if cash is below that it returns `NOT_ENOUGH_CASH`
  instead of silently paying less. The Bank buttons then use the action result as their disabled reason, like Dig.
  Amounts must be whole (`BAD_AMOUNT` otherwise), so cash stays an integer. Debt stays a float; the amount due is
  `Math.ceil(debt − FLOAT_EPSILON)` so float drift (36.000…01) never adds 1. Leftover debt ≤ `FLOAT_EPSILON` clears
  the loan.
- **Batch 4.5: the loan principal and the "repay 💰N" step (`LOAN_REPAY_STEP` 10, added to `balance.ts`) follow the
  `cost` meta multiplier**, so a loan always buys the same number of seeds. Fee, rate and cap are ratios of the
  principal and take no multiplier. The bank's errors join the shared `ActionError` union, so `ERROR_TEXT` covers them.
- **Batch 4.5 UI: the HUD debt badge reads "🏦 −💰N"** (debt rounded up) and sits before the tick counter. The
  mobile tab bar now has five buttons; at 375 px each is ~75 px wide. Not checked in a browser (no dev server in
  headless runs).
- **Batch 5: planting takes a pouch seed first; auto-buy only covers an empty pouch.** With stock > 0 the seed comes
  from the pouch and costs no cash. With 0 in stock and `autoBuySeeds` on, `plant` charges the seed price, which is
  the pre-v4 cost, so a player who never touches the pouch plays exactly as before (the greedy sim numbers are
  unchanged). With auto-buy off and 0 in stock it returns the new error `NO_SEEDS`. `buySeeds` needs the crop's
  license (`NO_LICENSE`) and validates n like `buyWood` (`BAD_AMOUNT`). The pouch is `Partial<Record<CropId, number>>`
  like the bag. The Farm view's "Planting" line also shows the pouch count; the Shop seed rows come in task 24.
- **Batch 5: `tests/fixtures/save-v3.json` was produced by a throwaway vitest file run against the unmodified
  batch-4.5 code** (scripted till/plant/water/harvest cycles, mine license, 7 digs, a stone sale, `energyMax` 1, a
  loan, then a mixed field of growing, ripe and tilled tiles), then the file was deleted. Past save types in
  `serialize.ts` are now frozen (`RunV3` / `RunV2` spelled out) instead of derived from the live `RunState`.
- **Batch 5: the save backup runs before `deserialize`**, so it survives a migration that throws. Any raw save whose
  `version` is a number below `SAVE_VERSION` is copied to `tiles.save.backup.v<old>`, even one that then fails to
  load (it also goes to `tiles.save.bad`). The mining action is still called `dig()`; only its counter was renamed.
- **Batch 5: `nextRandom` moved from `mining.ts` to `actions.ts`** (next to `fail` / `withRun` / `isAmount`), so
  `digForSeeds` in actions can roll without a circular import between actions and mining. The dig's crop and
  chance are `DIG_SEED_CROP` / `DIG_SEED_CHANCE` in `balance.ts`, read through `digSeedDrop()`. The Farm view shows
  the last dig's result ("Found a 🥕 Carrot seed!" / "Nothing this time") next to the button, not as a toast; it is
  UI state only and starts empty after a reload.
- **Batch 5: tool levels and `toolN` are folded into save v4** (`run.tools`, `run.toolN`; `migrateV3` sets no tools
  and `toolN` 1). v4 was committed in task 21 but never deployed, so there is no v4 save in the wild and no
  `save-v4.json` fixture (v4 is the current version, not a past one).
- **Batch 5: farm tools (`src/core/tools.ts`).** `pressTool(state, job, crop)` returns `LOCKED` at level 0 and
  `NOTHING_TO_DO` when no tile is eligible (nothing spent). Otherwise it is ok with `{ done, wanted, stoppedBy }`,
  even when `done` is 0 because the first tile already failed (e.g. no energy: state unchanged, `stoppedBy:
  'NO_ENERGY'`). Eligible water tiles are growing (not ripe) with moisture < 1, so a press never spends energy on a
  full tile or a ripe crop. Ties in priority keep tile order. `toolN` defaults to 1 and is **clamped on read**
  (`toolCount`, 1 … ceil(tiles × 1/3)) instead of rewritten when tiles change: tiles only ever grow, so a stored value
  never goes stale, and `setToolN` rejects values outside the range (`BAD_AMOUNT`). `buyTool(job)` always buys the
  next level (so level k needs k − 1): `MAX_LEVEL` at 3, `LOCKED` below the counter threshold, `NO_CASH`. Tool
  prices follow the `cost` meta multiplier like every other price. The numbers are the PLAN.md starting values,
  not yet tuned (task 25).
- **Batch 5 UI: the auto-buy toggle needed a core action**, `setAutoBuySeeds(state, on)` in `actions.ts` (one flag for
  every crop, costs nothing). The pouch rows show licensed crops only, with "Buy ×1" / "Buy ×10" disabled by
  `buySeeds`'s own result.
- **Batch 5 UI: one tool button per owned job, at its current level** ("Water 1", "− Water 2 +", "Water all"); jobs
  with no tool show nothing above the farm. The toast is "Watered 5/9 — out of energy"; NO_CASH / NO_SEEDS read "out of
  cash" / "out of seeds", any other stop reason uses `ERROR_TEXT`. A press with nothing eligible toasts "Nothing to do".
  There is no "new tool unlocked" toast: `useGame`'s unlock toast covers `UPGRADE_IDS` only.
- **Batch 5 UI: Upgrades lists all 9 tool levels under a "Tools" heading.** Status per level: "owned", the counter
  progress while locked ("harvest 7/15", the job's name for its counter), "needs <previous tool>" when unlocked but
  level k − 1 is missing, otherwise the effect and price. Only the next level can be enabled (`buyTool(...).ok`).
  `tests/Upgrades.test.tsx` now reads the upgrade names from the row under the "Upgrades" heading, since the tool
  buttons share the tab.
- **Batch 5 UI: at ≥ 768 px the page no longer scrolls.** `.app` is exactly the viewport height (`100dvh`, rows
  `auto minmax(0, 1fr)`); the Mine, Farm and side-panel columns scroll on their own. The grid sits in `.farm-fit`, a
  `container-type: size` box that takes the farm column's leftover height, and a tile is
  `max(72px, min(--tile-max, width per column, height per row))` from that box (`--rows` set by `FarmGrid`). Below
  768 px nothing changed: the page scrolls and the tab bar is fixed.
- **Batch 5 UI: tab fixes.** The desktop panel's floor went 260 → 300 px (`clamp(300px, 26vw, 380px)`), the panel tabs
  are one line (`nowrap`, 14 px, 4 px gaps) and the › toggle is 36 px wide: at 1024 px the old 266 px panel pushed the
  toggle 30 px past the window edge. The mobile tab bar sizes its buttons by content (`flex: 1 1 auto`, 12 px,
  `nowrap`), so "⬆️ Upgrades" is on one line at 375 px; before, it wrapped its icon above the label.
- **Batch 5 UI: measured in headless Chrome** (CDP script, prod `pnpm preview`, throwaway and not committed), worst case
  seeded: all three tools at level 2 (three stepper groups), every tile planted, Upgrades tab open.

  | Viewport | tiles | page scroll (scrollHeight / innerHeight) | grid top..bottom | tile px | panel tabs + › inside panel |
  |---|---|---|---|---|---|
  | 1920×824 | 9 | none (824 / 824) | 155..716 | 183 | yes |
  | 1920×824 | 24 | none (824 / 824) | 155..716 | 107 | yes |
  | 1440×900 | 9 | none (900 / 900) | 155..792 | 208 | yes |
  | 1440×900 | 24 | none (900 / 900) | 155..792 | 123 | yes |
  | 1280×720 | 9 | none (720 / 720) | 155..612 | 148 | yes |
  | 1024×768 | 9 | none (768 / 768) | 205..624 | 136 | yes (toggle 960..996, panel ends 1004) |
  | 800×600 | 9 | none (600 / 600) | 205..504 | 96 | slide-over |
  | 375×740 | 9 | page scrolls (846 / 740) | 251..610 | 116 | tab bar fixed at 683..740 before and after scrolling to the end |

  The 375×740 Shop (pouch rows), Upgrades (3 upgrades + 9 tools) and Bank views: no horizontal overflow
  (scrollWidth 375 = innerWidth) and no clipped or off-screen button or label.
- **Batch 5: offline catch-up keeps the loan as it was** instead of `step()` learning about "offline". `catchUp` steps
  the whole run, then puts back the pre-catch-up `loan`: no action runs during catch-up, so debt growth is the only
  loan change it can undo. `step()` is unchanged, so live ticks still grow the debt. The batch-4.5 test "offline
  catch-up charges it too" in `bank.test.ts` now asserts the opposite; `save.test.ts` checks both paths with the
  injected clock (load after 1 h: debt unchanged, everything else caught up; then 5 live ticks grow it), and
  `App.test.tsx` runs the real hook under vitest fake timers (borrow, 10 s live → 💰34, tab hidden 1 h → still 💰34
  and the "Away for 1h 0m" banner, 10 s live → 💰35).
- **Batch 5 sim: the tool bot's "affordable" tick is when `buyTool` succeeds**, which also needs level k − 1. The bot
  buys at once, so k − 1 is always owned by the time k unlocks; the two definitions give the same ticks in this run.
- **Batch 6: `tests/fixtures/save-v4.json` was produced by a throwaway vitest file run against the unmodified batch-5
  code** (greedy carrot farming to tick 420, mine license at 150, a pickaxe at 200 mined 9 times → 11/20, 2 of 9 stone
  sold, a level-1 Watering Can, 6 soil digs, 4 pouch seeds bought), then the file was deleted. Committed on its own
  before any shape change.
- **Batch 6: the whole v5 save shape lands with task 26** (one `SAVE_VERSION` bump for 26–28): `vein.progress`,
  `mastery`, `masteredTiers` and `storageLevel`. `storageLevel` is stored next to `bagCapacity` (the upgrade adds its
  slots to `bagCapacity`, so every reader of capacity is unchanged). `migrateV4` keeps the pickaxe's durability (a v4
  wooden pickaxe stays at its x/20 against the new max of 25), the bag and `bagCapacity`; progress, mastery and storage
  level start at 0. `RunV4` is now spelled out field by field and `RunV3`/`RunV2` derive from it, not from the live
  `RunState`.
- **Batch 6: the mine action is still `dig()`.** It mines by hand (1 hit) with no pickaxe or a blunt one, so it no
  longer returns `NO_PICKAXE`; its order is NO_MINE_LICENSE, BAG_FULL, NO_ENERGY. `BAG_FULL` applies even to a hand hit
  that would not drop a stone yet. The PRNG rolls only on the action that drops a stone (a half hit rolls nothing).
  Hits per action live in `PICKAXES[tier].hits` / `HAND_HITS`, read through `mineHits(tier | null)` and `stoneHits()`.
- **Batch 6: `repairPickaxe` uses the new error `NOT_ENOUGH_WOOD`** (named in the brief) and `NOT_BLUNT`; `craftPickaxe`
  keeps `NOT_ENOUGH_ITEMS`. Repair needs no mine license and no energy and restores the tier's full durability.
- **Batch 6 sim: the greedy bot repairs a blunt pickaxe** (buys the missing wood, then `repairPickaxe`) and never mines
  by hand. Mine-early's pinned final cash moved **116 → 132**: durability 25 plus one repair (2 wood) replace the 3rd
  craft over its 43 mines. Every other pinned number (milestones, lowest cash, counters, pumpkin-first) is unchanged;
  `balance.ts` was not retuned. Mine-early mining cash/energy is now 1.53 (was 1.16), farming 3.34.
- **Batch 6: pickaxe tiers are listed in `data/items.ts` (`PICKAXE_TIERS`)**; a tier's index n multiplies its mastery
  thresholds by 2^n (`masteryThresholds(tier)`). `PickaxeTier` moved there and `state.ts` re-exports it.
- **Batch 6: a pickaxe mine action rolls preserve first, at the mastery level before that action's xp**, then the drop
  roll (if a stone drops). It always rolls, even at Lv0 where the chance is 0. Preserve =
  `min(0.8, 1 − 1/(1 + 0.4·L) + 0.05 × masteredTiers)` (`preserveChance`, read for a run through `pickaxePreserve`).
  Reaching Lv10 adds the tier to `masteredTiers` once. With mastery, the mine-early bot still repairs once in its 43
  mines, so its pins did not move again.
- **Batch 6: `expectedUses(tier, run)` (in `mining.ts`) is the lifetime of a fresh pickaxe of that tier**: the tier's
  base durability / (1 − preserve), per DECISIONS.md ("25 at Lv0 → 125 at Lv10"), not the remaining uses of the
  pickaxe in hand. It returns a float; the UI rounds it for "lasts ~N uses".
- **Batch 6: vein and storage upgrades are `upgradeVein` / `buyStorage` in `mining.ts`**, paid in stone from storage plus
  cash (cash follows the `cost` multiplier, stone does not), no energy. Order: NO_MINE_LICENSE, MAX_LEVEL,
  NOT_ENOUGH_ITEMS, NO_CASH. A vein upgrade keeps a half-mined stone's progress. Storage prices are
  `storageCost(level)` = round(20 × 1.6^L) stone, round(50 × 1.6^L) cash: 20/50, 32/80, 51/128, 82/205, 131/328.
  Vein max level is 1 (`veinMaxLevel()`, `veinUpgradeCost` returns null past it).
- **Batch 6 UI (minimal, the Mine panel is task 29):** the Upgrades tab gets a "Mine" heading after the mine license with
  "📦 Storage Lv L/5" and "⛏️ Vein Lv L/1", disabled by their own action results. The Mine panel header reads
  "📦 Storage N / cap", `BAG_FULL` reads "Storage is full — sell something", the Dig button shows hits and the current
  stone's progress, and a blunt pickaxe shows a "Blunt pickaxe — repair (2 🪵)" button. Coal is ⚫ and sells from the
  existing item rows.
- **Finding (not fixed, numbers are task 31's): the stone prices lock storage and vein out.** Every item takes a slot.
  Storage L1 costs 20 stone at capacity 20 (payable only with nothing else in storage); L2 costs 32 stone at capacity 30,
  so it can never be paid, and neither can L3–L5 (51/82/131 stone at 40/50/60). Vein Lv1 needs 40 stone = capacity 40 =
  storage L2, so **vein Lv1 is unreachable in play**. A sim that sets vein Lv1 directly would hide this.
- **Batch 6 Mine panel (task 29):** the drop % is each `veinDrops` weight over their sum, rounded. Below the current vein
  ("Vein Lv0: 🪨 100 %") the next level shows greyed with its drops and cost while one exists ("Lv1: 🪨 80 % · ⚫ 20 % —
  40 🪨 + 💰100", per DECISIONS "next vein level greyed with its cost"); the iron row is a UI constant in `Mine.tsx` and
  always shows, with no numbers. The mastery row (level, a bar to the next threshold, "lasts ~N uses" =
  `expectedUses` rounded) shows for the pickaxe in hand; the "+5 %" on the badge is read through the new
  `masteredPreserveBonus()`. The crack is text on the Dig button ("🪨 cracked 1/2"). **"Sell from the panel when storage
  is full"** = while `dig` returns `BAG_FULL`, a "Sell all 🪨 ⚫ 💰N" button under Dig sells every stone and coal in one
  tap (wood stays, it is crafting material); the per-item rows are unchanged. The 375 px layout is CSS only (stacked
  rows, 12–14 px text) and was not checked in a browser (no dev server in headless runs).
- **Batch 6 crops (task 30):** `CROP_IDS` is in license order (carrot, chilli, pumpkin, lemon), so the Shop lists the
  🔒 license cards that way. The batch-3 greedy, tool and dig bots keep planting only carrot and pumpkin (their numbers
  are pinned); chilli and lemon enter the sim through task 31's per-crop and progression bots. The frozen `RunV4` type
  still names the live `CropId`, which only widens; no save shape changed and `SAVE_VERSION` stays 5.
- **Batch 6 sim (task 31): mining and dig rates come from benches, not a session.** Mastery climbs during play (Lv1 after
  10 xp), so "pickaxe Lv0" cannot be held in a session. `mineBench` mines 5000 times with energy refilled before each
  action and the mastery xp put back after it (Lv0 = 0 xp; Lv10 = 400 xp with the tier in `masteredTiers`); it crafts
  the first pickaxe, repairs when blunt (wood bought and charged to mining), sells stone and coal before storage runs
  out of room and values what is left. Vein Lv1 is set directly in the bench state, because vein Lv1 cannot be bought in
  play (open blocker in "Batch 6 results"). `digBench` digs 5000 times the same way, seeds at their buy price.
- **Batch 6 sim: per-crop farming starts with 💰1000 and the crop's license**, so seed cost never blocks the bot and the
  value is the crop's own rate; same accounting as `runBot`. `bestFarmAction` takes the crops to plant (best first);
  its default (pumpkin, carrot) keeps every pinned bot identical.
- **Batch 6 sim: the four-crop session bot is `runBot` with options** (ticks, license order, plant order,
  `saveForStorage`); the defaults are the pinned batch-3 bot. It records "license affordable" only for the license it is
  saving for (the next one in order), which for the pinned bots is the old pumpkin milestone. Storage affordability
  is checked with `buyStorage(...).ok` and never bought except by the `saveForStorage` variant, so the pins hold.
- **Batch 6 sim: "(d) storage Lv1 within ~600 ticks of mine-early play" is measured on the four-crop mine-early session
  (tick 579, checked only) and asserted on a saving variant of the pinned bot (tick 594)**; the pinned bot itself sells
  its stone each time storage fills and never has 20 stone and 💰50 at once by tick 600.
  "Normal session" for (c) and (e) is 1200 ticks (20 min).
- **Batch 6.1 sim (task 32): the `saveForStorage` bot now buys as soon as it can pay**, not only once storage is full,
  and after storage Lv1 it keeps its stone for vein Lv1 the same way; it runs 1200 ticks instead of 600 so vein Lv1
  fits in the session. Its batch-6 assertion "bought = affordable" is gone: the bot buys only on idle energy, so the
  buy lands a few ticks after the first affordable tick (324 → 330). The "fits storage" rule test also asserts vein
  Lv1 costs more stone than the starting storage, so the order storage → vein is enforced, not only allowed.
- **Batch 6.1 UI (task 33): every item in the drop table is named** ("🪨 Stone 100 %"), not only coal, so the rows
  read alike. The vein Upgrade button sits in the Mine panel as well as the Upgrades tab (both call `upgradeVein`).
- **Batch 6.2 (task 34): milestone upgrades stay hidden until unlocked, and a group with no unlocked row is hidden**
  (a fresh game shows only ⚡ Energy). The brief's "Energy max 15 → 20" is an example: level 0 reads "Energy max
  10 → 15" from `energyMax()`. Upgrade rows are one per line (`.shop-row.one-col`) because "now → next" lines are
  long; the vein row shows the drop table now → next (Mine panel's `dropText`, now exported).
- **Batch 6.2 (task 35): the ⓘ is a sibling of the row's buy button, not inside it** (a button cannot hold a
  button), wrapped by `Item` in `Info.tsx`. The tip opens in flow under the row rather than as a floating popover, so
  a 2-column row at 375 px never clips it. Hover uses CSS `@media (hover: hover)` (also on keyboard focus), not JS
  mouseenter, because a tap fires mouseenter then click and would close it at once. Seed pouch rows share one text
  (`TIPS.pouch`); tool tips are per level. The ⓘ hit area is 28 × 28 px (WCAG 2.5.8 minimum 24), below the 44 px of
  the game buttons, to keep it out of the label.
- **Batch 6.2 (task 36): "opened" = the tab's content is on screen**, not "the tab is selected": ≥ 1024 px the panel
  is open (not collapsed), 768–1023 px the slide-over is open, < 768 px the Panel view is showing (`matchMedia`, same
  breakpoints as the CSS). A tab on screen never shows its own dot and marks new keys seen as they appear. The
  remembered `ui.tab` on mobile is not "open" while the Farm view shows. "Unlocked or affordable" = `availableKeys`
  in `src/app/badges.ts` (licenses, mine license, next tile, tool level milestone reached / affordable, upgrade
  unlocked / level affordable, storage / vein affordable). Seeds and wood are left out (always buyable, never news).
  Seen keys accumulate (a thing seen once, then unaffordable, then affordable again does not badge again); the level
  is in the key, so each next level is news. **First load after this patch** (no `seen` in `tiles.ui`) shows a dot
  for whatever is available once. The "seen" update runs during render, guarded, so `tiles.ui` is written only when
  a key is new, never every tick. At 768–1023 px the tabs sit in the closed slide-over, so the "🛒 Shop" opener
  button also shows the dot when Shop or Upgrades has news (an addition to the brief, so that layout gets a signal).
- **Batch 6.2: the 375 / 1440 px numbers in "Batch 6.2 results" are computed from the CSS, not measured in a
  browser** (no dev server or browser in this headless run; the brief forbids `pnpm dev` and files under `dist/` for
  browser checks). Button widths in them are estimates.
- **Batch 6.2: commits carry no AI co-author trailer**, unlike the batch 6.1 commits: the user-level delivery rules
  say no AI attribution in commits, and user rules take precedence over the session default.


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

15. [x] Layout shell: drop the 480 px cap. ≥ 1024 px three columns (Mine | Farm | side panel); 768–1023 px
    Farm + Mine side by side and the side panel as a slide-over; < 768 px one view at a time with a bottom tab bar
    and a sticky HUD. Farm tiles scale with the space (square, readable at 375 px and 1440 px). Before the mine
    license the Mine column/tab shows a locked card with the license price.
16. [x] Side panel with tabs **Shop / Upgrades** (Bank added in batch 4.5): split the current Shop into Shop
    (seeds, licenses, wood, tiles) and Upgrades (energy max, regen, sell price, fertilizer; milestone-hidden ones
    stay hidden). Collapse/expand button on desktop; when collapsed the farm grows. Toasts stay visible in every
    layout.
17. [x] UI state (active tab/view, panel collapsed) persisted under localStorage key `tiles.ui`, separate from the
    game save; a broken/missing value falls back to defaults. Component tests for the tab switching and the
    persisted UI state. Reset save stays a small confirm-guarded button at the bottom of the side panel / Farm view.

## Batch 4.5 — bank v0, rough (tasks 18–20)
Question: does a loan get a broke player out of the soft-lock without becoming a free-money exploit?
Numbers are placeholders, retuned after docs/research/round2-mining.md.

18. [x] Core `src/core/bank.ts`: `run.loan: { principal, debt } | null`. `takeLoan()` (only when no loan; principal
    = `LOAN_PRINCIPAL`, cash += principal, debt = principal × (1 + `LOAN_FEE`)), `repay(amount)` (partial or full,
    capped at debt and cash; loan cleared at 0). `step` grows debt by principal × `LOAN_RATE_PER_TICK` per tick,
    capped at principal × `LOAN_DEBT_CAP` (2.0). Typed errors: LOAN_ACTIVE, NO_LOAN, NOT_ENOUGH_CASH. Save v3 with
    v2 → v3 migration (`loan: null`) tested on a real v2 fixture.
19. [x] Bank tab in the side panel (and the mobile tab bar): borrow button with principal + fee + growth explained
    in one line, current debt with its cap, a "time until cap" hint, repay 💰N / repay all. HUD shows a small debt
    badge while a loan is active.
20. [x] Tests: the round-2 soft-lock state (cash 1, 9 tilled tiles, empty bag, no pickaxe) recovers via a loan —
    the bot takes the loan, farms, repays in full, and ends with more cash than it started. Exploit check: borrow →
    repay immediately always loses cash (fee > 0). Existing sim: the greedy bot never borrows and its batch-3
    numbers do not change. Record the placeholder numbers under "Batch 4.5 results".

Starting numbers (placeholders): LOAN_PRINCIPAL 30, LOAN_FEE 0.1, LOAN_RATE_PER_TICK 0.002 (debt reaches the 200 %
cap after ~450 ticks ≈ 7.5 min), LOAN_DEBT_CAP 2.0.

## Batch 4.5 results
The placeholder numbers are in `balance.ts` **unchanged**: principal 30, fee 0.1, rate 0.002 per tick, cap 2.0, plus
`LOAN_REPAY_STEP` 10 for the Bank tab's partial-repay button. Borrowing gives 💰30 and a debt of 33 that grows by
0.06 per tick and stops at 60 after 450 ticks (7 m 30 s).

Soft-lock recovery (`tests/sim.test.ts`). Start: cash 1, 9 tilled tiles, mine license but no pickaxe, empty bag,
energy full at max 10, no upgrades, tick 0. The bot borrows only when stuck (no loan, nothing planted, cash below a
radish seed). It farms with the greedy bot's `bestFarmAction`, radish only (it buys no licenses and does not mine).
It repays in full once the payment still leaves a radish seed's worth of cash.

| Measure | Value |
|---|---|
| loans taken | 1, at tick 0 |
| repaid in full | tick 100 (first radish harvest), so **100 ticks to repay** |
| amount repaid | 💰39 (debt 33 + 100 × 0.06) |
| cash at tick 600 | **💰334** (started with 💰1), no loan left |

- **Exploit check** (`tests/bank.test.ts`): borrow, then repay all at any tick from 0 to 600, with the `cost`
  multiplier at 0.5, 1 and 2. Every case ends with less cash than before the loan. Repaying at once loses exactly the
  fee (💰3).
- **Greedy bot**: it never borrows. Its batch-3 milestones, lowest cash, final cash and counters are now pinned in
  `sim.test.ts` for both policies (394 / 116 final cash), and they are unchanged.
- **Finding:** at these numbers, one radish cycle on 9 tiles (9 × 💰10 = 💰90) pays back the loan. The 💰6 of interest
  over those 100 ticks is small against the harvest, so the loan is a cheap way out. It is still no free-money loop:
  the fee alone makes borrow → repay a loss. A player who never repays keeps the 💰30, because v0 has no forced
  collection, but one loan at a time limits that to a single +30.

## Batch 5 — farm tools, seed stock, dig for seeds (tasks 21–25)
Question: does tending the farm stop being tedious (no hunting tile by tile), and can a broke player always recover?
Decisions: DECISIONS.md "Round-2 research outcome", "Farm tools", "Save compatibility". Save v4.

21. [x] Save v4 + seed stock + rename. Follow CLAUDE.md "Save compatibility": v3 → v4 migration, a real v3 fixture
    in `tests/fixtures/`, chain test from every fixture (v1, v2, v3) to v4, and `storage.ts` keeps the raw old save
    under `tiles.save.backup.v<old>` before migrating. Counters: the existing `digs` (mine actions) moves to `mines`
    in the migration; new `digs` (soil) starts at 0; add `waters` and `plants`. `run.seeds` pouch (not in the bag),
    `buySeeds(crop, n)`, planting uses 1 seed, `run.autoBuySeeds` (default true) buys one when stock is 0. Radish
    displays as **Carrot** (id stays `radish`).
22. [x] Dig for seeds: farm action `digForSeeds()` — 1 energy, `DIG_SEED_CHANCE` 0.2 radish seed via the seeded PRNG,
    `counters.digs++`, available from tick 0, no license. Dug seeds go to the pouch and cannot be sold (no
    sell-seed action exists at all). Farm view button "🪏 Dig for seeds" with the last result.
23. [x] Farm tools core (`src/core/tools.ts`): for each job water / harvest / plant a tool level 0–3. Level 1 =
    1 tile per press, level 2 = n tiles per press with `run.toolN[job]` set by the player (1 … ceil(tiles ×
    `TOOL_N_RATIO`), ratio 1/3), level 3 = all eligible tiles. Tiles chosen by priority: harvest = ripe longest
    first, water = driest first, plant = first empty tilled tile (selected crop). Per tile the cost is exactly the
    manual action (1 energy, a seed); when energy/seeds/cash run out it does as many as it can and returns
    `{ done, wanted, stoppedBy }`. Each level is unlocked by the job's counter and bought once (numbers below).
24. [x] Farm tools UI + UI fixes: tool buttons above the farm ("Water 1" / "Water 3 −/+" / "Water all"), locked
    tools listed in the Upgrades tab with their milestone progress, toast "Watered 5/9 — out of energy", seed
    pouch rows in Shop (stock, ×1 / ×10, auto-buy toggle). Fix batch-4 nits: farm must fit the viewport height on
    wide-but-short screens (1920×824: no scroll, size tiles by min(width, height)); all side-panel tabs visible at
    ≥ 1024 px (no › overflow); Upgrades tab icon inline like the others.
25. [x] Loan + sim: debt grows only on live ticks — offline catch-up does not grow it (fake-clock test). Sim:
    (a) a tool press equals the same manual actions in sequence (same state after, any level); (b) the round-2
    soft-lock state (cash 1, 9 tilled, empty bag, no pickaxe, no loan) recovers by digging for seeds alone;
    (c) dig cash/energy (seed valued at buy price) < farming cash/energy; (d) cash never negative over 1200 ticks
    with a bot that buys tools when unlocked; greedy batch-3 numbers unchanged when tools are not used. Write
    "## Batch 5 results" (milestone ticks when each tool level becomes affordable).

Starting numbers (unlock counter / price), tune via the sim so level 1 lands within ~5 minutes:
water 20 / 40 → 60 / 120 → 150 / 300; harvest 15 / 50 → 50 / 150 → 120 / 350; plant 15 / 40 → 50 / 120 → 120 / 300.
Names: Watering Can → Garden Hose → Water Cart; Sickle → Scythe → Reaper; Dibber → Seed Drill → Seed Spreader.

## Batch 5 results
The tool numbers are the **starting values above, unchanged**: every level-1 tool is affordable by tick 233, inside the
~300-tick target, so `balance.ts` was not retuned. No other number changed.

Tool-buying bot (`tests/sim.test.ts`, 1200 ticks from a new run): greedy farming as in batch 3, pumpkin license first,
then it buys each tool level the tick `buyTool` allows it (unlocked, cash ≥ price, level k − 1 owned) and presses its
tools before tapping: harvest, then water only while some growing tile is dry, then plant (pumpkin when it has the
license and the cash, else carrot). No digging, mining or loans. "Affordable" and "bought" are the same tick.

| Tool level (unlock / price) | affordable at tick |
|---|---|
| Watering Can (20 waters / 40) | **120** |
| Garden Hose (60 waters / 120) | 655 |
| Water Cart (150 waters / 300) | 984 |
| Sickle (15 harvests / 50) | **233** |
| Scythe (50 harvests / 150) | 886 |
| Reaper (120 harvests / 350) | not by 1200 (63 harvests) |
| Dibber (15 plants / 40) | **200** |
| Seed Drill (50 plants / 120) | 683 |
| Seed Spreader (120 plants / 300) | not by 1200 (72 plants) |

Lowest cash 0, final cash 480, counters at 1200: 63 harvests, 184 waters, 72 plants. The level-3 harvest and plant
tools are gated by their counters, not cash: ~5 harvests per 100 ticks puts 120 harvests near tick 2300.

Other batch 5 checks:
- **(a) tool press = the same manual actions:** the `tools.test.ts` case "a press equals the same manual actions in
  sequence, at every level" (all 3 jobs × levels 1–3, mixed field, `toEqual` on the whole state). Not repeated in the sim.
- **(b) soft-lock recovery by digging alone** (cash 1, 9 tilled, empty bag, no pickaxe, no loan; greedy farming, dig
  when no farm action is possible; never borrows or mines), 600 ticks: first harvest at tick 102, final cash 💰279
  (from 💰1), lowest cash 1, 52 digs found 8 seeds.
- **(c) dig vs farming, same run, seeds valued at the buy price (💰2):** dig **0.31** cash/energy (8 × 2 / 52) vs
  farming **1.99** ((262 + field) / 157; the pouch seeds it planted are charged at 💰2 each).
- **(d)** the tool bot above never goes below 0. The greedy batch-3 bot (no tools) keeps its pinned milestones, lowest
  cash, final cash (394 / 116) and counters.
- **Loan offline:** debt no longer grows during `catchUp` (reload and hidden-tab return); it still grows on live ticks.

## Batch 6 — mining progress + two new crops (tasks 26–31)
Question: does mining feel like progress now (visible goals, mastery, repairs), and do more crops give the farm a next goal?
Decisions: DECISIONS.md "Round-2 research outcome", "Round-4 research outcome (progression)". Save v5, same
compatibility rules as v4 (capture a real v4 fixture BEFORE changing the shape; chain v1–v4 → v5; backup key).

26. [x] Stone = 2 hits (`run.vein.progress`, crack shown at 1/2). After the mine license, hand mining works with no
    pickaxe (1 hit per energy); pickaxe = 2 hits per energy. Wooden pickaxe durability 25. Durability 0 = **blunt**:
    the pickaxe stays owned but cannot mine until repaired (`repairPickaxe`, wooden = 2 wood; craft stays 3 wood);
    hand mining still works while blunt. `counters.mines` counts mine actions.
27. [x] Pickaxe mastery **per tier** (only wood exists now): `run.mastery: Partial<Record<PickaxeTier, xp>>`, 1 xp per
    mine action with that pickaxe (hand mining earns none), thresholds 10/25/45/70/100/140/190/250/320/400, next tier
    thresholds ×2 (balance fn). Preserve chance 1 − 1/(1 + 0.4·L). **Mastered reward:** a tier reaching Lv10 is added
    to `run.masteredTiers`; each mastered tier gives +5 % preserve chance to every pickaxe tier, permanently. Total
    preserve capped at 0.8. Balance test encodes the tier rule: base durability of tier k+1 > Lv10 lifetime of tier k
    (wood Lv10 = 125 uses) — with one tier it documents the rule for the furnace batch.
28. [x] Vein Lv1: 40 stone + 100 cash → 80 % stone / 20 % coal, coal sells 4 (`ItemId` gains `coal`). **Storage
    upgrade:** +10 capacity per level, level 1 = 20 stone + 50 cash, ×1.6 both per level, max 5, in the Upgrades tab
    once the mine license is owned. Display rename "Bag" → "📦 Storage" everywhere (code ids `bagCapacity`,
    `inventory` unchanged). The seed pouch stays separate.
29. [x] Mine panel: drop table with % for the current vein; a greyed row "🔒 Lv2: iron ore — needs Furnace (coming)"
    with no numbers; mastery bar with "lasts ~N uses" (expected uses incl. preserve), "Mastered ✓ +5 % all pickaxes"
    badge; crack on half-mined stone; blunt state + Repair button with its cost; sell from the panel when storage
    is full. Usable at 375 px.
30. [x] Two crops: **Chilli 🌶️** (seed 5 → sells 25, 160 ticks, license 50) and **Lemon 🍋** (seed 20 → sells 110,
    360 ticks, license 400). Starting numbers; licenses in Shop, seeds in the pouch like the others, dig table stays
    carrot only. No save-shape change beyond the CropId union (old saves load unchanged — test it).
31. [x] Sim (two-tier hierarchy, decided 2026-11-07): (a) dig < hand mining < pickaxe Lv0 < 0.9 × carrot farming;
    (b) pickaxe Lv10 and vein Lv1 + Lv10 (repair cost included) < 0.9 × **pumpkin** farming, both farming values
    measured by the sim (watering counted); (c) farming cash/energy order carrot < chilli < pumpkin < lemon, and
    each license affordable in order within a normal session (report ticks); (d) storage level 1 affordable within
    ~600 ticks of mine-early play; (e) nothing negative over 1200 ticks; batch-3 greedy numbers stay pinned. Retune
    crop numbers only if (c) fails. Write "## Batch 6 results" with every measured cash/energy value.

## Batch 6 results
Every check passes on the **starting numbers, unchanged**: no crop or mining number in `balance.ts` was retuned in
task 31. The batch-3 greedy pins (milestones, lowest cash, final cash 394 / 132, counters) and the batch-5 tool and dig
bot numbers are unchanged.

Cash per energy (`tests/sim.test.ts`, "batch 6: two-tier cash/energy hierarchy"). Farming uses the sim's own definition:
harvest income − seeds, per farm action (till, plant, water and harvest each 1 energy), plus the crops standing at the
cut-off at sell price × growth progress. Each crop is farmed alone on the 9 starting tiles for 1200 ticks by the greedy
bot's priority, license owned and 💰1000 to start so seeds never block it. Mining and dig are long-run benches (5000
actions, energy refilled before each), see Deviations.

| Activity | cash / energy | detail |
|---|---|---|
| dig for seeds (seed at buy price 💰2) | **0.39** | 976 seeds in 5000 digs |
| hand mining (vein Lv0) | **1.00** | 2 energy per stone 💰2 |
| pickaxe, mastery Lv0 (vein Lv0) | **1.68** | craft 3 wood + a repair (2 wood) every 25 mines |
| pickaxe, mastery Lv10 (vein Lv0) | **1.94** | preserve 0.8: a repair every ~125 mines |
| pickaxe Lv10 on vein Lv1 | **2.34** | 80 % stone 💰2 / 20 % coal 💰4 |
| carrot farming | **2.14** | (774 + 72.7) / 396, 99 harvests |
| chilli farming | **4.01** | (1215 + 85.8) / 324, 63 harvests |
| pumpkin farming | **8.18** | (1710 + 497.3) / 270, 36 harvests |
| lemon farming | **10.03** | (2250 + 277.8) / 252, 27 harvests |

- **(a)** dig 0.39 < hand 1.00 < pickaxe Lv0 1.68 < 0.9 × carrot = **1.92**.
- **(b)** pickaxe Lv10 1.94 and vein Lv1 + Lv10 2.34 < 0.9 × pumpkin = **7.36**. The Lv10-before-pumpkin check was not
  needed; for the record, both 1200-tick session bots end at 79 mastery xp (Lv4), far from Lv10 (400 xp), while the
  pumpkin license is affordable by tick 369.
- **(c)** carrot 2.14 < chilli 4.01 < pumpkin 8.18 < lemon 10.03. Lemon is time-bound, not energy-bound: it used only
  252 of the ~410 energy a session gives.

Four-crop session bot (1200 ticks): greedy farming that buys the licenses in order chilli → pumpkin → lemon, each as
soon as it is affordable, plants the best licensed crop it can pay for (lemon, pumpkin, chilli, carrot) and mines with
idle energy like the batch-3 bot under both mine-license policies. It never borrows.

| Milestone (tick) | pumpkin-first | mine-early |
|---|---|---|
| chilli license affordable / bought | 124 / 125 | 124 / 125 |
| pumpkin license affordable / bought | 311 / 312 | 369 / 370 |
| lemon license affordable / bought | 630 / 631 | 660 / 661 |
| storage Lv1 affordable (checked, not bought) | 516 | 579 |
| lowest cash / lowest of any value (e) | 0 / 0 | 0 / 0 |
| final cash at 1200 | 840 | 860 |
| harvests / mines | 45 / 79 | 46 / 79 |

- **(c)** each license is affordable inside the session; lemon at ~630–660 (~11 min). The order itself is by
  construction (the bot saves for the next license only, and the costs rise 50 < 100 < 400); the measured check is
  "≤ 1200".
- **(d) storage level 1:** the four-crop mine-early session above reaches it at **tick 579** with no change to its
  play (checked only). The pinned 600-tick mine-early bot (carrot and pumpkin only, sells all stone when storage is
  full) never holds 20 stone and 💰50 at once by tick 600; a variant of it that keeps a full storage of stone (and
  stops mining) until it can pay buys storage Lv1 at **tick 594**. Lowest cash 0.
- **(e)** cash, energy, storage, pouch and durability never go below 0 in either session bot or the storage variant.
- **Finding, chilli first delays pumpkin:** with chilli bought at 125, the pumpkin license is affordable at 311 in the
  pumpkin-first session, against 200 (bought 207) in the carrot-and-pumpkin-only batch-3 bot. The runs differ in
  length and licenses, so this is not measured as a gain or a loss.
- **Open blocker (from the task 28 finding, not fixed): storage Lv2+ and vein Lv1 are still unpayable in play.**
  Storage L2 costs 32 stone at capacity 30 and vein Lv1 needs 40 stone at capacity 30. The vein Lv1 rate above is
  measured by setting the vein level directly. The stone prices are DECISIONS.md numbers and outside task 31's
  retune list (vein coal share, repair cost); fixing them needs a decision.

## Batch 6.1 — stone costs fit storage + mine panel polish (tasks 32–33)
Question: can the player actually buy storage → vein Lv1, and is the Mine panel readable?
No save-shape change (numbers and UI only).

32. [x] Storage stone cost +5 per level: 15 / 20 / 25 / 30 / 35 (cash stays 50 × 1.6ⁿ). Vein Lv1 = 25 stone + 100
    cash (so storage Lv1 comes first). Test: every stone/ore price ≤ the storage capacity the player has when it
    becomes buyable (each storage level vs capacity before it; vein Lv1 vs capacity after storage Lv1). Sim: the
    stone-keeping mine-early bot buys storage Lv1 then vein Lv1 — report both ticks in "## Batch 6.1 results".
33. [x] Mine panel polish: "lasts ~N uses" moves to the pickaxe durability line (mastery line shows level + xp
    only, e.g. "Mastery Lv 0/10 · 5/10 xp"); drop-table and storage text at readable contrast (≥ 4.5:1); coal named
    in the drop table ("⚫ Coal 20 %"); the offline banner says "1 tick" / "N ticks"; the next vein level shows an
    Upgrade button (disabled with the reason when unaffordable).

## Batch 6.1 results
- **Task 32, prices:** storage stone 15 / 20 / 25 / 30 / 35 (cash 50 / 80 / 128 / 205 / 328, unchanged), vein Lv1
  25 stone + 💰100. `tests/mining.test.ts` "every stone price fits the storage…" checks each storage price against the
  capacity before it (20 / 30 / 40 / 50 / 60) and vein Lv1 against the capacity after storage Lv1 (30, and > 20).
- **Task 32, sim** (`tests/sim.test.ts`, "batch 6.1: stone-keeping mine-early bot", 1200 ticks): storage Lv1
  affordable at **tick 324**, bought at **tick 330**; vein Lv1 bought at **tick 753**. Lowest of any value 0, final
  cash 906, no loan. The batch-6 blocker "storage Lv2+ and vein Lv1 unpayable" is closed.
- Checked only, not bought (the other bots never buy storage): storage Lv1 now becomes affordable at tick 534
  (batch-3 pumpkin-first bot), 324 (batch-3 mine-early bot), 495 / 360 (four-crop session, pumpkin-first / mine-early;
  was 516 / 579). Every batch-3 greedy pin (final cash 394 / 132) is unchanged.
- **Task 33:** pickaxe line "Wooden pickaxe 25 / 25 · lasts ~25 uses"; mastery line "Mastery Lv 0/10 · 5/10 xp"
  ("Lv 10/10 · 400 xp" at max); drop table "🪨 Stone 80 % · ⚫ Coal 20 %"; banner "1 tick simulated" / "N ticks
  simulated"; "Upgrade vein to Lv1" button, disabled as "— Not enough items" / "— Not enough cash" from
  `upgradeVein`'s own error. Contrast (WCAG ratio, computed with node from the CSS hex values): the greyed next-vein
  and iron lines were #888 on white = 3.54:1, now #555 = 7.46:1; storage text was already #555 on white = 7.46:1
  (6.10:1 on a disabled button), unchanged. Not checked in a browser (no dev server in headless runs).

## Batch 6.2 — shop/upgrades structure, info tips, tool bar placement (tasks 34–36)
Question: can the player tell where to buy things and what each upgrade does, and are the farm tool buttons easy to
reach? UI only — no core numbers, no save-shape change (badge "seen" state lives in `tiles.ui`).

34. [x] Tab rule: 🛒 Shop = things you buy to own (seeds, licenses, farm tools Watering Can … Seed Spreader with their
    milestone progress, wood, tiles); ⬆️ Upgrades = numbers that go up, grouped ⚡ Energy / 🌱 Farm / ⛏ Mine (energy
    max + regen; sell price, fertilizer; storage, vein). Every row shows its effect as "now → next" (e.g. "Energy max
    15 → 20", "Sell price +10 % → +20 %"); maxed rows say "max".
35. [x] ⓘ info button on every Shop and Upgrades row: hover shows it on desktop, tap toggles it on touch; one shared
    component; texts in one UI data file (one or two plain sentences each: what it does, what it costs over time).
36. [x] Farm tool buttons: ≥ 768 px a vertical tool bar on the right edge of the Farm column; < 768 px a bar fixed
    above the bottom tab bar (thumb reach), not scrolling with the grid. Badge dot on the Shop / Upgrades tabs (and
    mobile tab bar) when something became unlocked or affordable since the tab was last opened; cleared on open.

## Batch 6.2 results
UI only; no `balance.ts` number and no save shape changed (save stays v5). 244 tests (234 before).

- **What moved where (task 34):** Farm tools (Watering Can … Seed Spreader, with milestone progress) moved from
  ⬆️ Upgrades to 🛒 Shop under "Farm tools", after Seeds / Seed pouch / Supplies (mine license or wood, tiles).
  ⬆️ Upgrades now has ⚡ Energy (Bigger stamina, Faster recovery), 🌱 Farm (Better prices, Fertilizer, each shown once
  its milestone unlocks it) and ⛏ Mine (📦 Storage, ⛏️ Vein, once the mine license is owned). Row texts, fresh game:
  "Energy max 10 → 15 · 💰50", "Regen 0.33/s → 0.42/s", "Sell price +0 % → +10 %", "Grow time −0 % → −10 %",
  "Storage 20 → 30 slots · 🪨15 💰50", "🪨 Stone 100 % → 🪨 Stone 80 % · ⚫ Coal 20 % · 🪨25 💰100". Maxed:
  "Energy max 60 · max", "Storage 70 slots · max", "🪨 Stone 80 % · ⚫ Coal 20 % · max".
- **ⓘ (task 35):** 26 rows carry one (4 crops, wood or mine license, tile, 9 tool levels, 4 pouch rows, auto-buy,
  4 upgrades, storage, vein; `tests/Info.test.tsx` checks every row). Texts in `src/app/tips.ts`, no numbers.
- **Tool bar (task 36), computed from `app.css`, not measured in a browser (see Deviations):**
  - **375 px:** the bar is fixed 56 px tall directly above the 56 px tab bar (its top 112 px above the viewport
    bottom) and does not scroll with the grid. The Farm view gets 56 px extra bottom padding, so the last tile, Dig
    for seeds and Reset save scroll clear of both bars (16 px gap). The toast moves up to 128 px. Three level-1 or
    level-3 buttons fit the 375 px width; three level-2 steppers (≈ 176 px each, estimated) do not, so the bar
    scrolls sideways. Shop / Upgrades 2-column cells are 168.5 px wide (30 px side padding for the ⓘ).
  - **1440 px:** the Farm column is 668.8 px (1440 − 2 × 20 padding − 316.8 Mine − 374.4 panel − 2 × 20 gaps). The
    bar sits on its right edge, one button wide (the level-2 stepper stacks + / count / −), ≈ 118 px with its 8 px
    margin (estimated), leaving ≈ 550 px for the grid. Upgrade rows are one full-width 358 px button per line.
  - **768 px, for the narrowest bar layout:** Farm column 428 px, grid ≈ 310 px, 3 columns ≈ 99 px per tile (floor
    72 px).
- **Badges (task 36):** `availableKeys` + `tiles.ui` `seen`; App test: a fresh game dots ⬆️ Upgrades only, opening it
  clears it, borrowing to 💰50 dots 🛒 Shop (chilli and mine licenses) and ⬆️ Upgrades (Bigger stamina Lv1), opening
  clears each, and the seen state survives a reload.

## Batch 7 — furnace, copper ore, copper pickaxe (tasks 37–42)
Question: does the mine get a clear goal after vein Lv1 (furnace → copper → copper pickaxe)?
Decisions: DECISIONS.md "Round-5 research outcome (furnace)"; research docs/research/furnace.md. Save v6 (capture a
real v5 fixture first; chain v1–v5 → v6; backup key).

37. [x] Save v6 (also new lifetime counters: cash earned, harvests per crop, energy spent, ticks played) + furnace building: `buildFurnace` = 20 stone + 5 coal + 💰150, requires vein Lv1. Items
    `copperOre` (sells 1) and `copperBar` (no sell path — test it). Ore and bars take storage slots.
38. [x] Smelting core (`src/core/furnace.ts`): `enqueueSmelt(fuel)` pays 2 copper ore + fuel (1 coal or 2 wood,
    player picks) on enqueue; cap 5 jobs; 60 ticks per bar; finished bars wait in an output tray; `collectBars`.
    0 energy. Progress advances inside `step`, closed-form for any tick count (offline catch-up identical), no RNG.
39. [x] Vein Lv2 = 30 stone + 10 coal + 💰200, requires the furnace; drops 65 % stone / 20 % coal / 15 % copper ore;
    copper rock needs 3 hits (hits per rock type in balance.ts). Drop table: Lv2 row becomes copper ore; greyed
    "🔒 Lv3: iron ore — coming" with no numbers.
40. [x] Copper pickaxe: 5 copper bars + 💰50, durability 200, 3 hits per energy, repair 2 copper bars; it becomes
    the equipped pickaxe (the wooden one's mastery and mastered reward persist). Copper mastery thresholds ×2.
41. [ ] Furnace UI in the Mine panel (queue of 5 with progress, fuel choice, collect, compact at 375 px) + sim:
    report ticks for vein Lv1 → furnace → storage Lv2 → vein Lv2 → first bar → copper pickaxe; copper-pickaxe
    cash/energy < 0.9 × pumpkin; every multi-item price fits the storage capacity when it becomes buyable (sum of
    stone + coal + ore); nothing negative over 3600 ticks; batch-3 greedy numbers pinned. "## Batch 7 results".
42. [ ] 📊 Stats tab (side panel + mobile tab bar): (a) lifetime totals — every counter, cash earned, harvests per
    crop, energy spent, time played; (b) current multipliers with their source, e.g. "Sell price ×1.5 (Better
    prices Lv5)", grow time, energy max/regen, pickaxe preserve % (mastery Lv + mastered bonus), storage, tool
    levels, drop table. Values come from the same balance functions the game uses (pure selector, one test).
