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
- **Batch 7 (task 37): the v6 shape holds everything batch 7 needs, so one bump.** New: `run.furnace`
  {built, queue, progress, ready}, `run.vein.rock`, `run.lifetime` {cashEarned, energySpent, bars, harvests per
  crop}, items `copperOre` / `copperBar`. "Equipped pickaxe tier" needed no field: `run.pickaxe.tier` already is it;
  the `PickaxeTier` union widens to `copper` (like `CropId` in batch 6). Lifetime totals live in their own object,
  not in `counters`, because counters drive unlocks and the frozen v4 save type shares their shape. Time played =
  `run.tick` (already a lifetime tick count), so no new counter; it includes offline catch-up ticks (time away
  counts as played).
- **Batch 7 (task 37): migrated lifetime totals are lower bounds from the counters that map.** Energy spent =
  harvests + waters + plants + soil digs + mines (1 energy each; tills were never counted). Harvests per crop are
  seeded only when the save holds exactly one license (then every harvest was that crop); otherwise `{}` while the
  total `harvests` counter still shows the real number. Cash earned was never tracked: 0. Cash earned counts harvest
  and item-sale income only, never loans.
- **Batch 7 (task 37): copper bars have no price at all** (`SellableItemId` excludes them, `sellItem` fails
  `NOT_SELLABLE`), rather than a 0 price, which would still be a sell path. Sell-all and the per-item sell buttons
  skip them. Copper ore sells for 1 and is included in "Sell all" when storage is full.
- **Batch 7 (task 38): "full" counts the output tray**: `QUEUE_FULL` when queued jobs + bars waiting ≥ 5, so the tray
  can never outgrow the cap (research: "tray cap = queue cap"). A player with a full tray collects, then smelts.
  `collectBars` moves as many bars as storage has room for and fails `BAG_FULL` only when none fit. `lifetime.bars`
  counts bars collected, not finished, because only actions change counters.
- **Batch 7 (task 38): fuel is the player's choice per job** (two buttons: ⚫1 coal or 🪵2 wood), never automatic, so
  repair wood is never eaten silently. No "Smelt max" (research open question 4); `advanceFurnace` runs inside
  `stepOnce` with 1 tick and is closed form for any tick count.
- **Batch 7 (task 39): the rock's type is rolled when the previous rock breaks and stored in `vein.rock`** (a copper
  rock needs 3 hits, so its type must be known before it breaks). The roll count and order per break are unchanged,
  so every vein-0 run replays exactly (batch-3 pins unchanged); on vein Lv1 the drops shift by one rock. A v5
  half-mined rock migrates as stone. The Mine panel shows the current rock's emoji and hits ("🟤 cracked 2/3").
- **Batch 7 (task 39): extra hits on a break are lost** (was: carried into the next stone). With a 3-hit pickaxe on
  a 2-hit stone, carry-over would bank progress without bound. Wood (2 hits) and hand (1) never had extra hits on
  stone, so nothing changes for them; wood on copper rock takes 2 actions (research's ⌈hits / hits per action⌉).
- **Batch 7 (task 39): vein Lv2 without a furnace fails `NO_FURNACE`** (after `MAX_LEVEL`, before items/cash), shown as
  the Upgrade button's reason. The greyed teaser is "🔒 Lv3: iron ore — coming".
- **Batch 7 (task 40): the copper pickaxe replaces the pickaxe in hand** (one pickaxe slot); crafting a tier at or
  below the one in hand fails `ALREADY_OWNED`. Wooden xp and the mastered reward stay in `run.mastery` /
  `run.masteredTiers`. Pickaxe prices are item records (`pickaxeCraftCost` / `pickaxeRepairCost`), so repair of any
  tier fails `NOT_ENOUGH_ITEMS`; `NOT_ENOUGH_WOOD` was removed.
- **Batch 7 (task 41): the furnace is built from the 🛒 Shop** (Supplies, a thing you own, with ⓘ and a badge key) and
  run from a collapsed `<details>` section in the Mine panel; before it is built, vein Lv1+ shows "🔥 Furnace — buy
  it in the 🛒 Shop". The research's cash-per-node preview for vein Lv1 → Lv2 is not added (not in task 39/41).
- **Batch 7 (task 41): the copper bench charges bars at their inputs' sell value** (2 ore × 1 + 1 coal × 4 = 6 per
  bar; craft 5 bars + 💰50 = 80, repair 2 bars = 12), because bars cannot be bought. The ladder bot is the four-crop
  mine-early session plus a goal list; when storage is full it sells only what the next goal does not need (else
  stops mining), smelts with coal and collects while the copper pickaxe is the goal.
- **Batch 7: 375 px numbers are computed from the CSS, not measured in a browser** (no dev server, same reason as
  batch 6.2).
- **Batch 7: the first five commits (v5 fixture … copper pickaxe) carry a Co-Authored-By trailer; the later ones do
  not.** The batch 6.2 rule (no AI attribution) was noticed mid-batch; rewriting the unpushed messages
  (`git filter-branch --msg-filter`) needed an approval the headless run could not get, so they are left as is.
- **Batch 7.1 (task 43): the ⋯ is a mark inside the press button, not its own button** (DECISIONS: one button per job
  at every level). A click on the ⋯ opens the popover, a click elsewhere on the button presses. Long-press uses touch
  events (450 ms, `LONG_PRESS_MS` in `Tools.tsx`), so a mouse never long-presses; it has right-click and the ⋯. On
  ≥ 768 px the popover opens to the left of the vertical bar, level with its top.
- **Batch 7.1 (task 43): the Collect button's "storage full" reason is shortened too** (same 100 px button as the
  smelt reasons); short reasons sit on their own line under the label. Per-crop harvest rows read "… harvests since
  v6" when the per-crop sum is below the Harvests counter (a migrated multi-license save); no save field is added.
- **Batch 7.1: 375 px numbers are computed from the CSS, not measured in a browser** (no dev server; Hermes measures).
- **Batch 7.1 (task 44): a copper double harvest is one harvest that sells 2 crops**: `harvests` and the per-crop
  lifetime total +1 (tool / fertilizer unlocks keep their meaning, and the Stats "since v6" check stays exact),
  `sales` +2, cash and cash earned ×2. A kept seed still needs one in hand (NO_SEEDS / NO_CASH checks unchanged, no
  draw on a failed action); it only skips the pouch decrement or the auto-buy charge. The water tool's targets are
  tiles below `waterMoisture(tier)`, so a copper hose tops up tiles between 1 and 2. `buyCopperTool` order:
  ALREADY_OWNED (tier at max), LOCKED (job tool < Lv1), NOT_ENOUGH_ITEMS, NO_CASH; price `toolTierCost(tier)` is the
  same for every job. The frozen `RunV6` save type no longer aliases the live `GameState`.
- **Batch 7.1 (task 45): the bonus toast reads "Harvested 6/6 (+1 bonus)"** (the existing done/wanted format, not
  "Harvested 6"); a kept seed reads "(N seeds kept)". The press bonus is counted in `pressTool` from each action's
  state change (sales above 1, or pouch and cash both unchanged), so no action result shape changed. The copper mark
  is a copper border + inset stripe, not an emoji, so it adds no width to the 375 px bar.
- **Batch 7.1 (task 46): the copper-tool ladder bot also buys each job's tool Lv1 when missing** (the batch-7 bot
  never buys farm tools, so the copper rows would stay LOCKED); it buys tool Lv1 and copper tier in one step. Copper
  tool cash/energy is measured with the one-crop bench (`runCropBot` with `toolTier` all 1), not the ladder bot.
- **Batch 7.1: the v6 fixture was captured with a temporary Node script** (Vite `ssrLoadModule` of the current core,
  printed to stdout, written with the editor, then deleted; diffed identical to a second run), because no TS runner
  is installed and temporary test files were not allowed.
- **Batch 7.2 (task 47): a collapsed desktop panel puts the farm actions back on the farm column.** Collapsing hides
  every tab's content, so a Farm tab there would hide the only tool buttons; "side panel next to the farm" is read as
  "≥ 1024 px and expanded". The Planting line, the right-edge tool bar and Dig for seeds return while collapsed.
- **Batch 7.2 (task 47): on desktop only the open side-panel tab shows its name; the other four are icon-only**
  (name kept for screen readers and as the hover title). With names, five tabs need ≈ 351 px and the row has 244 px at
  1024 / 318 px at 1440, so "every tab without overflow" is not reachable with names at either width.
- **Batch 7.2 (task 47): below 1024 px the Shop keeps the crop picker and the seed pouch.** "Nothing moves on mobile"
  plus the Shop being the only place to pick a crop there; the "Shop no longer has a crop picker" test is the
  desktop Shop. Tablet (768–1023 px, slide-over panel) counts as not-beside-the-farm and stays as in 7.1.
- **Batch 7.2 (task 48): the one wood constant is `ITEMS.wood.emoji` in `src/core/data/items.ts`** (it already fed
  every price line through `priceText` and the mine storage list); the three UI literals now read it. That is a
  display string in core data, not behaviour, balance or save shape. The old 🪵 is left in earlier batch notes.
- **Batch 8 (task 49): `run.workers` has no `cooldowns`.** The worker clock is `run.tick`: on every tick that is a
  multiple of `workerActionTicks()` each assigned worker acts once (task 50). `run.tick` is already saved and
  deterministic, so a cooldown field would only duplicate it.
- **Batch 8 (task 49): `wagesPaid` lives in `run.lifetime` only, not in `run.counters`.** It unlocks nothing (counters
  are milestone gates), the batch-7 ladder pin compares `counters` with `toEqual`, and the frozen v4 save type uses
  the live `Counters`. The auto-smelt flag is `run.autoSmelt` (beside `autoBuySeeds`), not a furnace field, and is
  part of the same v8 bump so task 51 needs no second one.
- **Batch 8 (task 49): `assignWorker(job, −1)` at 0 fails `NOTHING_TO_DO`**; hire order LOCKED, POOL_FULL, NO_CASH;
  certificate order ALREADY_OWNED, LOCKED, NOT_ENOUGH_ITEMS, NO_CASH. "Visible" = `hireUnlocked` /
  `certificateUnlocked` (the same check that makes the buy fail `LOCKED`).
- **Batch 8 (task 50): a waterer only waters a tile that would run dry before its next turn** (moisture ≤
  `workerActionTicks() × moistureDrainPerTick`, driest first), not every tile "below its tier's full moisture". With
  PLAN's rule a waterer always finds a tile below full, so it acts every 5 s whatever the tier: measured 240 waters /
  💰276 wages at tier 0 and the same at copper over 1200 ticks, which contradicts DECISIONS "a copper can's worker …
  needs half the actions, i.e. half the wages". With the due rule: 198 waters at tier 0, 90 at copper (halved), and a
  second waterer idles for free. The harvester keeps the tool's target (ripe longest first). `workerTargets` /
  `workerUnpaid` are the selectors.
- **Batch 8 (task 50): worker actions reuse `water` / `harvest` with an `energy` argument of 0** (default
  `ACTION_ENERGY_COST`), so counters, the copper tier and its PRNG draw are the player's; the wage is charged after
  the action in `workersAct` (cash ≥ wage checked first), and `lifetime.energySpent` is not touched. Workers act at the
  start of the tick, before moisture drains, so a tile the player watered (full) or harvested (no longer ripe) in that
  tick is never a target. No tuning was needed: `WORKER_ACTION_TICKS` 5 and `WORKER_WAGE` 1 pass the 80 % check
  (`tests/workers.test.ts`: 9 pumpkin tiles, 1200 ticks, net cash/min incl. standing crops — manual 110.4, 1 waterer +
  1 harvester with the player only tilling/planting 96.8 = 87.7 %; with a copper can 101.7 = 92.1 %). Carrot, measured
  once the same way and not pinned: 59.6 % / 72.3 % (copper), the research's "carrot automation is marginal".
- **Batch 8 (task 51): auto-smelt runs at the end of each tick, after the furnace advanced:** it collects the tray
  first (as much as storage takes), then queues coal jobs, so a job it queues starts on the next tick, like a manual
  one. With storage full the bars stay in the tray and keep counting toward the cap, so the furnace waits instead of
  smelting into nowhere. `setAutoSmelt(on)` fails `NO_FURNACE` before the furnace is built.
- **Batch 8 (task 52): the auto-smelt toggle UI lands in task 52**, as a checkbox inside the 🔥 Furnace section of the
  Mine panel (with an ⓘ). Task 51 shipped the core flag only, so without it the 📊 Stats "Auto-smelt" row would show
  a state the player cannot change. It sits on the furnace, not in the Workers card: it is the furnace's own switch.
- **Batch 8 (task 52): the 👷 Workers card is a `<details>` closed by default** (like the Furnace): the summary line
  "👷 Workers · free N / pool" plus an "unpaid" pill when any job is unpaid, so closed it costs one 44 px row in the
  Farm tab and below the grid. HUD "👷 N" is the hired pool, shown only once N ≥ 1 (nothing to say before).
- **Batch 8 (task 52): emoji sweep constants.** Item glyphs stay in `ITEMS.*.emoji`; the two non-item glyphs are UI
  constants in `src/app/` (`SOIL_EMOJI` in FarmGrid.tsx, `DIG_EMOJI` in Farm.tsx), since they are display only. Unicode
  12+ glyphs found beyond 🪨 and 🪏: 🟫 (untilled tile), 🟤 (copper ore and tilled tile), 🟧 (copper bar): the whole
  U+1F7E0–1F7EB coloured circle/square block is Unicode 12. Tests read the constants, so the next swap is one line.
  The old glyphs stay in earlier batch notes and DECISIONS ("🪏 Dig for seeds", round 2).
- **Batch 8 (task 52): `loadGame` returns `wagesPaid`** (paid during its catch-up) beside `awayMs` / `ticks`, so the
  welcome-back banner on reload can say "wages paid 💰N"; the visibility path diffs the state before `catchUp`. Not a
  save-shape change.
- **Batch 8 (task 53): the sim player leaves a job to the workers once one is assigned to it** (`bestFarmAction` skips
  harvest / water then). Otherwise the greedy player, acting between ticks, reaches every dry or ripe tile first and
  the workers only idle; "the player only planting" is read as this. Without workers nothing is skipped.
- **Batch 8 (task 53): `runBot` counts a tick's own cash change as farming** (worker sales − wages, the only cash
  `step` moves); without workers it is 0, so every older number is unchanged. The ≥ 80 % check uses `runCropBot` with
  workers from tick 0 (certificates owned, cash 1000), not the ladder bot, so it compares like with like.
- **Batch 8 (task 53): the bot hires to the cap (6) "when affordable"**, though 2 workers cover 9 tiles; the extra
  four idle for free (wages are per action), so they cost only their hire price. Reported, not tuned.
- **Batch 8.1 (task 54): an open tip closes on any scroll in the page**, not only its own scroll parent (one capture
  `scroll` listener on `document`). A fixed tip cannot follow any scroll, so closing on every one is the same rule
  with less code. Hover / keyboard focus now set state in JS (`pointerType === 'mouse'`, `:focus-visible`) instead of
  the `@media (hover: hover)` CSS sibling rule: the tip needs coordinates computed when it opens, which CSS cannot give.
- **Batch 8.1 (task 54): the pouch row's ⓘ sits right after the crop name** (`🎃 Pumpkin × 12 ⓘ … [Buy ×1] [Buy ×10]`),
  not last in the row. Name + ⓘ is at most ≈ 168 px (4-digit count), so the ⓘ is on the first line at every width;
  only the buy buttons wrap. Moving it last but non-wrapping would have depended on width estimates.
- **Batch 8.1 (task 55): press labels stay text-only ("Plant 4")**; the plan's `[ 🌱 Plant 4 ]` mock is not followed.
  No shared emoji constant exists for the plant job (`WORKER_JOB_LABEL` covers water and harvest only) and the brief
  allows emoji only from existing constants; the label code is also shared with the mobile bar.
- **Batch 8.1 (task 55): the 768–1023 px tablet layout keeps the vertical bar with ⋯ + popover.** The task names the
  desktop Farm tab, the desktop collapsed-panel fallback and mobile; tablet is neither (desktop = ≥ 1024 px since
  7.2), so `stacked` is `matchMedia('(min-width: 1024px)')`, the same flag that picks the Farm tab.
- **Batch 8.1: widths computed from `app.css`, not measured in a browser** (no dev server in headless runs).
- **Batch 9 (task 57): the auto-smelt removal moved from task 58/59 into task 57** (core `setAutoSmelt` / `autoSmelt`,
  `run.autoSmelt`, the furnace checkbox, its tip and the 📊 "Auto-smelt" row): the v9 migration drops the field, so
  everything that read it goes in the same commit. To keep the build green the 🔥 Furnace card got a minimal bridge
  (summary "fire n/cap · ore n · n ready", buttons Load ore / Fill with 🌲 / Fill with ⚫ / Collect); task 59 replaces
  it with the gauge, counts, hints and upgrades.
- **Batch 9 (task 57): v9 also carries `lifetime.fireBurnt`, `fireWasted` (burn ticks) and `barsSmelted`**, bumped in
  `tickFurnace`, so task 59's Stats ("fire wasted", "bars smelted") and away banner ("fuel burnt") need no v10.
  Migration: 0, 0 and bars collected + tray + queue (every paid job counts as smelted).
- **Batch 9 (task 57): furnace errors are `FULL`, `NO_ORE`, `NO_FUEL`** (the plan's names) and replace `QUEUE_FULL`,
  `NOT_ENOUGH_ORE`, `NOT_ENOUGH_FUEL`, which nothing uses any more.
- **Batch 9 (task 57): `addFuel(state, fuel, max = ∞)` and `loadOre(state, max = ∞)` take an optional item limit**:
  the press fills; the loaders (one coal / one cycle of ore, task 58) and the sim bot pass a limit.
- **Batch 9 (task 57): the furnace advances one tick per `step` tick (`tickFurnace(run)`), no closed form**: `step`
  already loops single ticks, so step(s, n) = n × step(s, 1) holds by construction (tested for every case the plan
  lists); 8 h of catch-up is 28 800 cheap calls.
- **Batch 9 (task 57): the sim ladder bot loads k cycles of ore with exactly k coal** (k ≤ the old 5-job cap counting
  loaded cycles + tray), the fuelled-furnace form of "enqueue coal jobs while it can": the fire then never burns without
  ore, so every batch-7 / 7.1 / 8 pin (ticks, final cash, wages, counters) is unchanged. The batch-8 "8 h offline" check
  now loads the furnace by hand before leaving (auto-smelt is gone); task 58 adds the loaders.
- **Batch 9 (tasks 57–58): one v9 bump finished across the two commits** (`counters.bars` and `workers.assigned.ore /
  fuel` join `migrateV8` in task 58). No build ships between them, so no save exists in the half-way shape; this is
  how batch 8 folded the auto-smelt flag into the v8 bump.
- **Batch 9 (task 58): new counter `counters.bars` (bars collected)**, the plan's "add a counter if CERTIFICATES needs
  a CounterId": `collectBars` bumps it (a loader's collect too), v9 starts it from `lifetime.bars`; `CountersV4` is now
  frozen in `serialize.ts`. 📊 Stats gets a "Copper bars collected" counter row, and "Copper bars smelted" now reads
  `lifetime.barsSmelted` (it showed `lifetime.bars`, i.e. collected). The batch-7 counters pin gains `bars: 5` (the
  copper pickaxe's bars); every other value is unchanged.
- **Batch 9 (task 58): the ore / fuel rows already show in the 👷 Workers card** through the shared `JobRow`
  ("🔶 Ore", "⚫ Fuel" from `ITEMS.*.emoji`, certificate price + "bars n/10" gate, −/n/+ once certified) with an ⓘ tip
  each: `WORKER_JOB_LABEL` and `WORKER_TIPS` are `Record<WorkerJob, …>`, so the build needs them. Task 59 lays them out.
- **Batch 9 (task 58): starting prices (Hermes picks, task 61 tunes):** fire cap 🥉4 + 💰150, 🥉8 + 💰300; batch
  🥉6 + 💰200, 🥉12 + 💰400; smart 🥉10 + 💰400 (above the fuel certificate's 🥉8 + 💰200). Every bar price ≤ 40
  (storage Lv2, the storage the furnace path needs; tested).
- **Batch 9 (task 58 fix): ore slot 12, not the plan's "e.g. 10".** At 10, batch level 2 (6 ore a cycle) could stall:
  a slot holding 5 ore can neither smelt (5 < 6) nor take the ore loader's cycle (room 5 < 6), so the loader idles
  for good while a fuel loader keeps a plain furnace burning on nothing (reproduced: 0 bars in 600 ticks). The slot
  now holds two top-batch cycles (2 × 6 = 12, a balance test), so a slot short of a cycle always has room for one.
- **Batch 9 (task 58): furnace jobs have no tile target**, so `workerTargets(state, job)` is typed for water/harvest
  only and a loader's "something to do" check is its own action (`workerAction` returns null = idle, unpaid);
  `workerUnpaid` uses the same check for every job. Task 60's `workerTargets(state)` will need to replace or rename
  the current two-argument one.
- **Batch 9 (task 58): the sim ladder bot staffs farm jobs only** (`FARM_JOBS`), so the batch-8 worker pins replay
  unchanged; loader bots are task 61.
- **Batch 9 (task 59): `loadGame` returns `before` (the saved state before the catch-up) instead of `wagesPaid`**, and
  `bannerText(awayMs, before, after)` diffs the lifetimes: the banner now needs three deltas (wages, fire burnt, bars
  smelted), and bars smelted cannot be read off the tray once an ore loader moves bars into storage. Not a save change.
- **Batch 9 (task 59): a furnace upgrade at its max level hides** (like the vein upgrade) instead of showing a disabled
  "max" row; the smart furnace shows as " · smart" on the fire line.
- **Batch 9 (task 59): fire is shown in whole units rounded up** (gauge, Stats "Fire wasted", banner "fire burnt"), so a
  part-burnt unit never reads as 0.
- **Batch 9 (task 60): `workerTargets(state)` returns `{ job, tile }[]`, not a tile per worker index**, and replaces task
  58's `workerTargets(state, job): number[]`, which became the private `jobTiles` (one export, no second function).
  It answers "next action" by stepping to the next worker tick inside core, so `workers.ts` imports `step` and
  `step.ts` imports `workersAct`: a cycle of hoisted function bindings only, used at call time (lint and the Vite
  build report nothing). New export `ticksUntilWorkers(run)` is shared by the lookahead and the UI's flash check.
- **Batch 9 (task 60): the flash fires only for a live step of ≤ `workerActionTicks()` ticks** that crosses the worker
  tick; a longer jump (stalled timer, catch-up) shows no flash, because the tiles of more than one round are unknown.
- **Batch 9 (task 61): "8 h offline with both loaders on a plain furnace: waste ≤ one tank" is not asserted.** The
  fuel loader adds coal whenever the fire has room, ore or not (task 58, DECISIONS "Fuelled furnace"), so a plain
  furnace burns the whole coal stock after the ore runs out (40 units from 30 coal, pinned). Asserted instead:
  ≤ one tank for a plain furnace left alone and for plain + ore loader only, 0 for smart. The loader was not changed
  to fit the number: that waste is what the smart furnace sells.
- **Batch 9 (task 61): bars per hour come from a furnace bench (`furnaceBench`), not the ladder bot**: in the ladder,
  bars per hour are set by how much ore mining brings, so the bench gives the furnace unlimited ore and coal and a
  stated player cadence (120 s / 600 s). The ladder bot measures the certificate and smart-furnace timings.
- **Batch 9 (task 61): the furnace ladder runs 7200 ticks** (smart lands at 3741, past the hour), and the bot stops
  doing a loader's job once one is assigned (the batch-8 rule for farm jobs), else it would load and collect before
  the loader's 5-tick clock and the loaders would idle.
- **Batch 9 (task 61): no `balance.ts` change**; the starting numbers pass every check.
- **Batch 10 (task 62): "Crop to plant" moved from React state into the save (`run.plantCrop`, set by the new free
  action `selectCrop`, NO_LICENSE).** The planter acts inside `step()`, also during the offline catch-up, where no UI
  state exists. App reads and writes it through the game state (taps, the plant tool, Farm tab and Shop pickers); it
  survives a reload now instead of resetting to Carrot, and a reset goes back to Carrot through `createInitialState`.
  v9 saves migrate to Carrot, which is what the UI showed after every load before.
- **Batch 10 (task 62): `plant` is first in `WORKER_JOBS`** (action order plant → water → harvest): the Workers card
  gets the plan's Plant / Water / Harvest rows with no second display list, and a seed planted on dry soil is watered in
  the same round. The cost: a tile harvested in a round is replanted on the next round (5 s later). `water, harvest,
  plant` would replant in the same round but needs a separate row order for the card. Either order leaves every
  batch-8 / 9 pin unchanged (no planter in them).
- **Batch 10 (task 62): a planter whose first tile cannot be planted idles instead of tilling another tile.** The plan
  pins "auto-buy off → workers idle when the pouch is empty"; tilling ahead with no seed would charge wages for soil
  nobody can plant.
- **Batch 10 (task 62): wages are checked after the action as well as before** (`paidAction`), see the results: an
  auto-bought seed is the first worker action that spends cash.
- **Batch 10 (task 62): the plant row, its ⓘ tip (`WORKER_TIPS.plant`) and 🌱 (`WORKER_JOB_EMOJI.plant`) ship with the
  core**, because `WORKER_JOB_LABEL` / `WORKER_TIPS` / `WORKER_JOB_EMOJI` are `Record<WorkerJob, …>` and the build needs
  them (as batch 9's loader rows did); task 63 lays out the rest.
- **Batch 10 (task 63): `PLANT_EMOJI` lives in `useGame.ts` next to `FIRE_EMOJI`** and `WORKER_JOB_EMOJI.plant` reads it:
  the banner (useGame) needs it, and importing `Workers.tsx` from `useGame.ts` would make a module cycle
  (useGame → Workers → Mine → useGame). The older 🌱 in the "🌱 Farm" tab labels are left as they were.
- **Batch 10 (task 64): cash per hour runs 1 h (3600 ticks), not the 1200-tick session** of batch 8, on pumpkin and lemon
  as the plan names them; carrot is not measured. "Cash/hour" = net cash per minute × 60, the batch-8 accounting.
- **Batch 10 (task 64): the 8 h offline comparison grants the plant certificate** on batch 8's own start (tick 3600,
  before the furnace ladder could pay 🥉10) and moves one waterer to planting, so the only difference from the +💰1,085
  run is the planter. That the certificate is reachable is a separate ladder run (4341, after the loaders and smart).
- **Batch 10 (task 64): the sim bots leave planting and tilling to a staffed planter** (`bestFarmAction` checks
  `assigned.plant` like water / harvest); with no planter every earlier pin replays unchanged.
- **Batch 10 (task 64): no `balance.ts` change.** Offline income (+💰69,849 in 8 h) is not capped by any batch-10 number;
  see the reading in "Batch 10 results".
- **Batch 11 (task 65): an iron rock mined with less than a copper pickaxe (wooden, by hand, blunt) is a stone rock**:
  stone's 2 hits and a stone drop, not 4 hits for a stone. "Breaks as stone" read as "is mined as stone", so a weak
  pickaxe on vein Lv3 wastes no energy beyond what stone costs.
- **Batch 11 (task 65): vein Lv3 (45 items) is priced for storage Lv3 (50)**, not the storage Lv2 (40) the earlier bar
  prices assume, following the mining.test rule "vein level v + 1 comes after storage level v + 1". Task 69's ladder has
  to buy storage Lv3 before vein Lv3.
- **Batch 11 (task 66): switching the ore kind also needs an empty tray**, not only an empty slot. The tray holds a count
  with no kind, so switching with bars in it would collect copper bars as iron (or the reverse). With an empty slot no
  cycle can be part-way, so nothing paid is lost; the player (or the ore loader) collects first.
- **Batch 11 (task 67): the mine row, its ⓘ tip (`WORKER_TIPS.mine`) and ⛏️ (`MINE_EMOJI` in `useGame.ts`,
  `WORKER_JOB_EMOJI.mine`) ship with the core**, because those tables are `Record<WorkerJob, …>` (as in batch 10). The
  locked row shows only "mines n/200", not the vein Lv3 gate; task 68 lays out the rest.
- **Batch 11 (task 68): the ore picker and the iron pickaxe craft show only from vein Lv3** (the first vein that drops
  iron), or once iron is picked; a copper-only player's furnace and Mine panel stay as they were at 375 px.
- **Batch 11 (task 68): Stats show iron bars smelted and collected, no "iron ore" row.** No lifetime counter of mined
  iron ore exists, and adding one is a save change, out of scope for a UI task; the iron ore in storage is already in
  the Mine panel's item list.
- **Batch 11 (task 68): a vein price with more items than storage holds says "Needs 📦 N storage"** on the Upgrade button,
  for every level, so vein Lv3 (45 items) tells a storage Lv2 (40) player what to buy.
- **Batch 11 (task 68): the craft button offers the tier above the one in hand** instead of "copper unless copper is in
  hand", which would have shown "Craft copper pickaxe — Already owned" with an iron pickaxe.
- **Batch 11 (task 68): the miner flash reads the real step** (`lifetime.workerMines` grew on a live worker tick), not a
  lookahead like `workerTargets`: the Mine button has no ring to predict, and `WorkerTarget` stays tile-only. Its wash is
  amber, not white, because the button is white, and its pop is 14 px in the corner, not the tiles' 18 px, to stay
  above the button's second line.
- **Batch 11 (task 68): the locked mine row puts each missing gate on its own line** (both on one line ≈ 287 px, past the
  284 px Farm tab at 1024). The away banner also gained "🥈 N smelted" (iron bars), which it lacked.
- **Batch 11 (task 69): the ladder bot sells its copper ore to switch the furnace to iron.** Switching needs an empty
  slot and tray (task 66), and the ore loader keeps loading copper while storage has it; selling it before each tick
  (💰1 each) lets the slot drain without unassigning the loader, which `staff` would put straight back.
- **Batch 11 (task 69): the ladder's "copper pickaxe" step counts as done with copper or better**, else an iron pickaxe
  in hand sent the bot back to that step (ALREADY_OWNED) and it never reached the mine certificate. Older runs never
  hold an iron pickaxe, so their pins are unchanged; the bag-full sell list and `mineBench` gained iron ore the same way.
- **Batch 11 (task 69): bars per hour come from `ironBench`, a chain with the miner as the only ore source** and a player
  who only sells (every 120 s / 600 s), not from unlimited stock: with a miner the limit is how fast storage is
  emptied, which an unlimited-stock bench cannot show.
- **Batch 11 (task 69): the 8 h offline run starts after the player sells stone and copper ore**; the bot's own cut-off
  state can be a full storage (it stops mining when full), which would measure a 0-tick stop.
- **Batch 11 (task 69): the miner's "farm cap" is cash per hour vs the three farm workers**, since a worker spends no
  player energy; the player's own presses use the batch-6/7 cash-per-energy bench on vein Lv3.
- **Batch 11 (task 69): no `balance.ts` change.**
- **Batch 11.1 (task 70): the feedback draft and the cooldown live in `App`** (passed to the 📊 Stats tab through
  `PanelProps`), not in the Stats component: App renders only the open tab, so a tab switch unmounts Stats and its state.
- **Batch 11.1 (task 70): the 30 s cooldown starts on a send that went out (or a filled honeypot), not on a failed one**,
  so Retry after a network error is not blocked.
- **Batch 11.1 (task 70): `feedbackSummary(state, hideIron)` takes the gate as a parameter** (core cannot read
  `devFlags`); with it on, the line drops the mine worker, its one iron-only field. The furnace ore kind is never in the
  line. The summary line is labelled `Game:` in the context block.
- **Batch 11.1 (task 70): the cooldown countdown reads `Date.now()` from a 1 s interval into state**, not during render:
  `react-hooks/purity` rejects an impure call in render.
- **Batch 11.1 (task 70): `src/globals.d.ts` declares `__BUILD__`**; `vite.config.ts` falls back to `GITHUB_SHA` only
  when `git rev-parse` fails (the Pages workflow checks out the repo, so CI normally gets the hash from git too).
- **Batch 11.1 (task 71): the reset backup is the live run** (`serialize(stateRef.current)`), not the raw `tiles.save`
  string, which can be up to 1 s older. A blocked storage skips the backup and still resets, as before. The feedback
  draft is not cleared by a reset (it is not part of the save).
- **Batch 11.1 (task 71): the unarmed Reset is a 14 px red link** (12 px before; it now sits alone in its own card); armed it
  becomes a full-width red button.
- **Batch 12 (task 73): the ▼ sits inside the brackets, `🍋 💰99 (90 % ▼)`**, and locked (unlicensed) Shop crop rows get
  no price tag or depth bar (they showed no sell price before; their ⓘ tip carries the market sentence). Reason: the
  shortest tag that still wraps cleanly in the 77 px text box of a Shop button at 1024 px.
- **Batch 12 (task 73): only the Harvest tool press toast changed** (`+💰N` added); a tile tap already toasted the real
  cash received (cash after − before), so it is unchanged.
- **Batch 12 (task 74): the 💬 Feedback context appends `timelineLines`, the timeline part of `reportLines`**, not the
  whole report: the context already carries build, save version and the game summary, so the full report would
  repeat them. Both read the same core function.
- **Batch 12 (task 74): `reportLines(state, header, hideIron)` takes the build/save header lines as a parameter**: core
  knows neither `__BUILD__` nor `SAVE_VERSION` (save depends on core, not the reverse). `hideIron` drops the mine
  worker like `feedbackSummary`.
- **Batch 12 (task 74): "… N earlier milestones before tracking" shows only on saves with `trackingStarted`** (migrated
  from v11 or older). A new run starts with the carrot license, which `earlierMilestones` would otherwise count.
- **Batch 12 (task 74): `importSave` returns `STORAGE` as well as `BAD_SAVE`** (a full or blocked storage; errors are
  values, never throws). The live run is saved first, so the import backup is never up to 1 s stale.
- **Batch 12 (task 75): the "before" (market off) runs use a test-only switch**: `tests/sim.test.ts` mocks
  `marketFactor` to 1 inside `withoutMarket(…)`; every other run (and every older pin) has the market on. No flag
  was added to `balance.ts`.
- **Batch 12 (task 75): the 2-crop split search is manual only, 6 crop pairs × first-crop tiles 4/8/12/16/20 on 24
  tiles** (`splitFarm`); a plant worker plants one crop, so a split cannot be staffed. The best split earns less than
  24 lemon tiles, so DECISIONS' "spreading crops keeps prices up" holds for the price, not (yet) for income at depth
  120. Not tuned: the plan allows `MARKET_DEPTH_TILES` only to rise (which weakens the market further) and only for
  the hierarchy pin, which passes at 120.
- **Batch 12 (task 75): no `balance.ts` number changed** (`MARKET_DEPTH_TILES` 120, half-life 1800, floor 0.5).
- **Batch 13 (task 76): the batch 3–12 sim runs replay the batch-12 rules through a test-only switch.** The task-76 rule
  (tool Lv3 before a farm certificate) means the old workers bots, which never buy tool levels, could never staff a
  farm job, so their pins would be not just shifted but meaningless. `tests/sim.test.ts` already mocks `balance.ts`
  for the market switch; the same mock now gives the old `certificateUnlock` (no `tool`), the old water/harvest
  certificate prices and hire base 80 (and, from task 77, a hand-picked bonus of 1) unless `rules.batch13` is on.
  Only the "batch 13" describe turns it on. Every older pin passes with no number edited, so they stay the measured
  history of each batch. The spec tests (workers, Workers card, save, milestones) use the new rules.
- **Batch 13 (task 76): the reason line uses the job's own emoji**, `needs 💧 Water Cart (tool Lv3)` / `needs 🌾 Reaper
  (tool Lv3)` / `needs 🌱 Seed Spreader (tool Lv3)` (`WORKER_JOB_EMOJI`, the row's icon), not the brief's 🚿: emoji
  come from shared constants and there is no tool emoji. It is one more `<small>` gate line in the locked row, shown
  only while missing, like the counter and vein lines.
- **Batch 13 (task 76): no v12 fixture exists** (v12 is the current version), so the "kept certificates" test loads
  the v9, v10 and v11 fixtures (all hold farm certificates with that job's tool below Lv3: v9/v10 Lv2, v11 Lv1) and a
  v12 save written in-test from the v11 one, then checks the workers still act and get paid over 600 ticks.
- **Batch 13 (task 76): hire 3 costs 💰433, not 434**: `150 × 1.7²` is 433.4999… in floating point; the existing
  `Math.round` is kept. Hires: 150, 255, 433, 737, 1253, 2130.
- **Batch 13 (task 77): the bonus rounds per unit**, `Math.round(marketCropPrice × 1.25)` inside `cropSale` (so cash
  stays whole and a double harvest prices each unit at its own glut); a carrot at 💰10 sells for 💰13 by hand. "Spent
  energy" = the `energy` argument of `harvest` > 0, which is every tap and tool press; the worker calls it with 0.
- **Batch 13 (task 77): where "✋ ×1.25" shows.** Tile-tap toast `+💰13 Carrot ✋ ×1.25`, Harvest press toast `Harvested
  6/6 (+1 bonus) +💰540 ✋ ×1.25`, and every crop's ⓘ tip ends "You harvest it: ✋ ×1.25; workers sell at ×1." The
  price tags (`🍋 💰99 (90 %)`) stay the market price, the one both sellers start from. The Harvest worker row's ⓘ adds
  "Workers sell at ×1; what you harvest yourself sells at ✋ ×1.25." in `Workers.tsx` rather than in `tips.ts`: tips
  are module-level strings, and `tips → marketText → FarmGrid → Workers → tips` is an import cycle that would read
  `HAND_PICKED` before it exists. `HAND_EMOJI` (✋, the old `DIG_EMOJI` of Dig for seeds) and `HAND_PICKED` live in
  `marketText.ts`.
- **Batch 13 (task 77): the batch-8 spec "water + harvest workers net ≥ 80 % of the manual rate"** (`workers.test.ts`)
  now compares against the manual rate at ×1 (manual ÷ 1.25) and also checks that the hand-picked farmer out-earns
  the workers, which is the point of the bonus.
- **Batch 13 (task 77): the iron gate is deleted whole.** Nothing else read `tiles.dev`, so `src/app/devFlags.ts` and
  `tests/devFlags.test.ts` are gone. `ironVein` (also used outside the gate, by the ore picker and the pickaxe offer)
  moved into `Mine.tsx`. `reportLines` / `feedbackSummary` lost their `hideIron` parameter, and the Stats zero-iron row
  filter and the Mine iron teaser are gone. The gate tests became "iron is open" tests. A player's browser may keep a
  stale `tiles.dev` key; nothing reads it.
- **Batch 13 (task 78): the ladder bot got a `buyTools` option** (used by the batch-13 run only). It buys the water and
  harvest tool levels (and plant, with `planter`) as soon as each is unlocked and affordable, keeps the unbought farm
  certificates' stone and coal when it sells a full storage, and hires only once a farm certificate is owned. Without
  the first it could never certify a farm job. Without the second the ladder's sell-off could sell the 20 stone. Without
  the third it would spend 💰150 + 255 + … on workers with no job, because hiring unlocks at 30 harvests, long before any
  certificate.
- **Batch 13 (task 78): certificates land later than the plan's ~16 / ~40 min; nothing retuned.** The bot buys water at
  24.8 min and harvest at 66.5. The research figures assume 100 % uptime on a growing farm. The ladder bot never buys
  tiles (9 tiles all run), spends idle energy mining, and its harvest Lv3 tool waits for 120 harvests (reached at
  65.8 min). The task's pin holds: no wait between two milestones is over 60 game-minutes, and the longest is 15.3 min
  (harvest certificate → plant certificate). So no batch-13 number moved.
- **Batch 13 (task 78): the hand-picked gain is +💰2,820/h gross with basic tools, not ≈ +💰6,600.** The 6,600 figure
  assumes 240 picks an hour at 💰110 × 0.25. With one waterer and no copper can, 24 lemon tiles need 24 waterings a
  minute and get 12, so the farm yields ~116 lemons an hour. With the three copper tools the ladder owns by the time it
  staffs, the farm yields ~222 an hour and the gain is **+💰5,421/h gross** (+💰5,680 net), close to the research figure.
  Both are reported, and neither is a pin target in the brief. Untuned.
- **Batch 13 (task 78): the harvest certificate (20 stone + 5 coal = 25 items) does not fit the starting storage (20).**
  Vein Lv0 already drops coal, so a player who only farms can own the Reaper and 40 harvests without ever buying storage
  Lv1. The brief's price is kept, and storage Lv1 (30, 💰50 + 15 stone) fits it. The locked 🌾 row says `needs 📦 25
  storage` (the vein button's "Needs 📦 N storage" rule, now on certificate rows too), so it is never a silent trap. The
  ladder bot has storage 40 by then. Water (20) and plant (10) fit storage 20. If Toon wants every price to fit the
  start, the option is harvest `{ stone: 15, coal: 5 }`.
- **Batch 13 (task 78): observation for Toon, not tuned (not a batch-13 number):** the 👷 hire button still unlocks at 30
  harvests (`WORKER_HIRE_UNLOCK`, ~8 min in) while the first certificate now comes at ~25 min. A player can hire 💰150
  workers who have no job for ~15 min. Moving the hire unlock to "owns a certificate" would close that gap.
- **Batch 14 (task 79): a cooling slot rolls its new offer inside step(), when the cooldown reaches 0.** The plan lists
  the actions that open a slot (buy board, complete, discard, buy slot, reroll), but a discard only starts the 600-tick
  cooldown and `{ cooldownTicks }` has no room for a pre-rolled offer. The roll uses `run.rngState` inside step(), which
  is deterministic, so runs still replay and step(s, n) = n × step(s, 1) (tested). Completions by a worker's harvest
  roll inside step() too, through the harvest action.
- **Batch 14 (task 79): "can make now" is read literally for items and bars.** An item joins the pool only with the mine
  license and only if the owned pickaxe mines it as itself (iron ore needs a copper pickaxe; otherwise it is mined as
  stone). A bar joins only when the furnace is built *and* its ore is in the pool: a furnace at vein Lv1 has no copper ore
  to smelt, so "bars once the furnace exists" would offer an order nobody can fill. Wood (bought, never mined) is not in
  the pool.
- **Batch 14 (task 79): every offer is accepted first, items too.** Accept routes a crop's harvests; on an item order it
  shows Deliver. Deliver moves the whole rest at once (`NOT_ENOUGH_ITEMS` when storage is short), like the clerk's "an
  item order storage can fill". Delivered items count no sale (they are not sold); their bonus cash counts as cash
  earned. Two accepted orders for one crop fill in slot order.
- **Batch 14 (task 79): new errors `BAD_SLOT` (no such slot, or it is cooling down) and `NO_STARS`;** `pay()` takes an
  optional `stars` in `Price` (checked after items, before cash, never scaled by the cost multiplier).
- **Batch 14 (task 80): the Shop card reads "📋 Notice board", not "📋 Noticeboard".** At 1024 px a Shop button has a
  77 px text box; the one word "Noticeboard" (≈ 91 px) cannot wrap and would run under the ⓘ. Two words wrap cleanly.
  Code names (`buyOrderBoard`, `BOARD_EMOJI`) and the section title "📋 Orders" are unchanged.
- **Batch 14 (task 80): the board is a closed card in the farm column where there is no 🌾 Farm tab.** The plan places
  it only in the desktop Farm tab; mobile, tablet and the collapsed desktop have no Farm tab, so it sits beside 👷
  Workers there (the same rule that put Workers there), closed so the grid keeps its height.
- **Batch 14 (task 81): a reroll refills every slot that holds no accepted order** (open offers and cooling slots);
  accepted orders keep their progress, since rerolling them would throw away harvests already counted. All slots
  accepted = `NOTHING_TO_DO` (no ⭐ spent). The token is spent on press, not held.
- **Batch 14 (task 81): "a good the farm grows" = a crop planted on some tile or set as "Crop to plant"** (the plant
  worker's crop), so a clerk on an empty farm still accepts the crop that is about to be planted. Bars are neither grown
  nor dropped by the vein, so the clerk leaves bar orders to the player (it still delivers one the player accepted).
- **Batch 14 (task 81): the batch-13 sim's certificate table skips `clerk`** (the batch-13 ladder never reaches the
  board); no number in it changed.
- **Batch 14 (task 82): ⭐/h is "about equal" only when the farm makes what the count assumes; not tuned.** A crop
  order's count uses tiles ÷ grow time (the plan's formula). The batch-13 24-tile lemon farm (one worker per job)
  harvests 114 lemons/h, 48 % of that, so it earns 5 ⭐/h against carrot's 11. The same farm with six workers (228/h)
  earns 10. No batch-14 number moves this ratio: tier minutes, weights and ⭐ scale both farms alike. If Toon wants
  understaffed farms to keep pace, the lever is the count basis (e.g. the farm's harvests over the last hour instead
  of tiles ÷ grow time). That is a rule change, so it is not made here. The sim adds the six-worker farm as a third
  data point and pins all three.
- **Batch 14 (task 82): order cash bonus measured at +27 % to +41 % of income, above the research's +12–18 %; not
  tuned.** The plan sets no cash target, and ⭐ is in range. The bot accepts every order for its crop, so nearly all
  harvests go through an order; on 24 tiles the board also skips the ≈ 10 % glut. If Toon wants it nearer the research,
  the lever is `ORDER_BOARD.bonus` (estimated, not run: at 0.1 the glut bypass alone stays, roughly +20 % on 24 lemon
  tiles).
- **Batch 14 (task 79, recorded after review): a delivered item pays only the bonus, base value × 0.25, as the plan
  says; it is not "sold + 25 %".** The research the plan cites reads two ways: rec. 4 says Deliver works "like sell",
  and its §2 hierarchy sums (2.25 → 2.81 cash/energy, bars at 💰7.5) assume an item order pays ×1.25 in total. The plan
  text "its cash = base value × ORDER_BONUS" was implemented literally, because the plan overrides the research and
  item orders are meant as ⭐ carriers. Effect: delivering 18 copper ore pays 💰4.5 (rounded once, so 💰5) plus ⭐,
  where selling them pays 💰18. The row's `+💰` shows that bonus only. The hierarchy pin (task 82) bounds mining at
  ×1.25 in total, so it holds under either reading. To switch to the research reading, Deliver would add the items'
  sale value (`itemOrderValue` × (1 + 1 / bonus)). The pin would still pass (2.62 < 9.20).
- **Batch 14 (follow-up): the item-order storage share is `ORDER_ITEM_BAG_SHARE = 0.5` in balance.ts**, read through
  `orderItemCap()`, instead of a `/ 2` in orders.ts.
- **Batch 14 (task 82): `runBot` got an `onTick` hook** (test code only) so the property test sees the ladder's
  states; every older run passes no hook and replays unchanged.
- **Batch 14 (task 80): `.hud` wraps.** The ⭐ span adds ≈ 58 px; with a loan the 375 px HUD needs ≈ 394 px of 343, so
  it now wraps to a second line rather than overflowing (the overflow with a loan existed before at ≈ 336 + 👷).


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
41. [x] Furnace UI in the Mine panel (queue of 5 with progress, fuel choice, collect, compact at 375 px) + sim:
    report ticks for vein Lv1 → furnace → storage Lv2 → vein Lv2 → first bar → copper pickaxe; copper-pickaxe
    cash/energy < 0.9 × pumpkin; every multi-item price fits the storage capacity when it becomes buyable (sum of
    stone + coal + ore); nothing negative over 3600 ticks; batch-3 greedy numbers pinned. "## Batch 7 results".
42. [x] 📊 Stats tab (side panel + mobile tab bar): (a) lifetime totals — every counter, cash earned, harvests per
    crop, energy spent, time played; (b) current multipliers with their source, e.g. "Sell price ×1.5 (Better
    prices Lv5)", grow time, energy max/regen, pickaxe preserve % (mastery Lv + mastered bonus), storage, tool
    levels, drop table. Values come from the same balance functions the game uses (pure selector, one test).

## Batch 7 results
Save v6 (one bump; fixture `tests/fixtures/save-v5.json` captured from the batch-6.2 code first, chain v1–v5 → v6
tested). Numbers are the DECISIONS.md round-5 values, unchanged: no `balance.ts` number was retuned. Every batch-3
greedy pin (final cash 394 / 132, counters, milestones) and the batch-5/6/6.1 checks pass unchanged.

**Ladder (task 41)** — `tests/sim.test.ts` "batch 7: ladder bot", 3600 ticks: the four-crop mine-early session bot
(licenses chilli → pumpkin → lemon) plus the goal list storage Lv1 → vein Lv1 → furnace → storage Lv2 → vein Lv2 →
copper pickaxe, each bought as soon as it can be paid; when storage is full it sells only what the next goal does
not need. It smelts with coal while the copper pickaxe is the goal.

| Step | tick | min |
|---|---|---|
| storage Lv1 bought | 477 | 8 |
| vein Lv1 bought | 684 | 11 |
| furnace built | 936 | 16 |
| storage Lv2 bought | 1110 | 19 |
| vein Lv2 bought | 1350 | 23 |
| first bar finished | 1776 | 30 |
| copper pickaxe crafted | 2172 | 36 |

- Furnace 4.2 min after vein Lv1, storage Lv2 +2.9 min, vein Lv2 +4 min, first bar +7.1 min, copper pickaxe
  +6.6 min: goals every 3–7 min. The research model expected the pickaxe at 1800–3300 (30–55 min); measured 2172.
- Lowest of any value (cash, energy, storage, pouch, durability, furnace queue / tray / progress) 0, minimum cash 0,
  never borrows, final cash 5980. Mines 447 (1.42 cash/energy incl. storage at the cut-off), harvests 107,
  wooden mastery 247 xp.

**Cash per energy** — `mineBench`, 5000 mine actions, energy refilled, repairs included; bars charged at their
inputs' sell value (6 per bar, see Deviations). Pumpkin farming 8.18 → cap 0.9 × pumpkin = **7.36**.

| Pickaxe | vein Lv1 | vein Lv2 |
|---|---|---|
| wooden Lv10 | 2.34 | 1.89 |
| copper Lv0 | 2.33 | 2.18 |
| copper Lv10 | 2.38 | 2.22 |

Every value < 7.36. Vein Lv2 trades cash for ore (wood Lv10: 2.34 → 1.89), as the research predicted (2.34 → 1.96).

**Prices vs storage** (sum of items when it becomes buyable): furnace 20 stone + 5 coal = 25 ≤ 30 (storage Lv1);
vein Lv2 30 stone + 10 coal = 40 ≤ 40 (storage Lv2, an exact fit: no wood can sit in storage while saving for it);
copper pickaxe 5 bars ≤ 40. Smelting determinism: `step(s, 300)` deep-equals 300 × `step(s, 1)` and the closed form
equals n single ticks for 0 … 1000; 8 h offline with a full queue = 5 bars ready, progress 0.

**Furnace UI at 375 px (computed from `app.css`, not measured):** one collapsed row, the 44 px `<summary>`
"🔥 Furnace · 3 queued · 2 ready · next bar 42s". Open, it adds a progress bar, one recipe/stock line and a 3-column
row of buttons (Smelt with ⚫1 · Smelt with 🪵2 · Collect N 🟧), ≈ 111 px each in the 359 px panel; a disabled
reason wraps under the label. The banner says "… ticks simulated · 🔥 N bars ready" when bars wait after catch-up.

**📊 Stats tab (task 42):** `stats(state)` in `src/core/stats.ts` (pure, `tests/stats.test.ts`); `src/app/Stats.tsx`
only renders its rows. Lifetime: time played (`run.tick`), cash earned, energy spent, the six counters, harvests per
licensed crop, copper bars smelted. Now: sell price ×, grow time × (with their upgrade level), energy max / regen,
the pickaxe in hand's preserve % and "lasts ~N uses" (source "mastery LvL + N mastered × 5 %"), storage slots,
tools per press (with the tool name), drop table (vein level). Prestige multipliers are all 1 until prestige exists
and fold into the values above (`multiplier(meta, …)`), so they get no row of their own. The side panel and the
mobile tab bar gain "📊 Stats" (six tabs; at 375 px the content-sized labels total ≈ 330 px of 375, estimated).

## Batch 7.1 — tool bar fixes + copper farm tools (tasks 43–46)
Question: do ingots give the farm a reason to smelt (fewer presses per crop), and does the farm tool bar fit a phone?
Decisions: DECISIONS.md "Round-4 research outcome (progression)", "Round-5 research outcome (furnace)", "Copper farm
tools (batch 7.1)". Save v7 (capture a real v6 fixture first; chain v1–v6 → v7; backup key).

43. [x] Tool bar + shop fixes found on the live 6.2 build (UI only, first so the copper work lands on the final bar):
    (a) < 768 px the bar overflowed ~30 px right with one level-2 stepper (Plant clipped). The level-2 button shows
    only "Water 3" with a small ⋯ mark; tap = the action; long-press (touch, ~450 ms) or right-click / the ⋯ (mouse)
    opens one shared popover with − / count / +. Three level-2 buttons must fit 375 px with no sideways scroll (same
    popover on the ≥ 768 px vertical bar). (b) Owned farm tools in 🛒 Shop: solid card with "✓ Owned", not the dashed
    grey that reads as disabled. (c) Seed pouch rows: "Carrot × 0" never wraps the count onto its own line; the same for item rows ("🟤 Copper
    ore ×3" wrapped "×3" in the 316 px desktop Mine column). (d) Found on the live batch-7 build: the disabled
    "Smelt with 🪵2 — Not enough fuel" wraps to 4 lines in the desktop Mine column (show the reason under the row or
    as a short "no fuel"); the furnace recipe line orphans "wood 0"; the pickaxe line "187 / 200 · lasts ~200 uses"
    reads as a contradiction (say "~N more uses" from the current durability); Stats shows "Carrot/Pumpkin harvests
    0" next to "Harvests 38" for a migrated save (show per-crop rows as "since v6" or hide zeros when untracked).
44. [x] Save v7 + copper farm tool core (`src/core/tools.ts`): `run.toolTier[job]` 0 = basic, 1 = copper (a number so
    iron/gold extend it). `buyCopperTool(job)` = 4 copper bars + 💰100, requires that job's tool Lv1; typed errors.
    Applies to every action of the job (tile tap and tool press):
    - water: sets moisture to `waterMoisture(tier)` = 2 instead of 1 (a copper-watered tile grows 120 ticks).
    - harvest: 10 % chance (seeded PRNG) to harvest 2 of the crop.
    - plant: 20 % chance (seeded PRNG) to keep the seed (auto-buy does not fire for a kept seed).
    All numbers in balance.ts through functions keyed by tier. Tool press = the same manual actions in sequence
    (same state and PRNG position after) must still hold — extend the existing test to tier 1.
45. [x] Copper tool UI: 🛒 Shop "Farm tools" gets one row per job ("Copper Can / Copper Sickle / Copper Dibber",
    🟧4 💰100, ⓘ tip, locked until the job's tool Lv1); the tool bar button shows a copper mark when tier 1; the tile
    moisture bar shows values above 1 (e.g. a second, darker band); toast for a double harvest / kept seed only in
    the tool-press summary ("Harvested 6 (+1 bonus)"). 📊 Stats: tiers and their effects from the same functions.
46. [x] Sim + results: ticks to the first and the third copper farm tool (after the copper pickaxe, same bot as
    batch 7); carrot and pumpkin cash/energy with all three copper tools vs none (water presses per crop must drop);
    mining stays below farming as in batch 7; every bar + cash price fits storage when buyable; nothing negative over
    3600 ticks; batch-3 greedy numbers pinned. Write "## Batch 7.1 results".

## Batch 7.1 results

**Tool bar (task 43), computed from `app.css` at 16 px system-ui, not measured (see Deviations):** every level is
one button: `.tools > button` = 1 px border × 2 + 12 px padding × 2 + label, no wrap; the level-2 ⋯ mark adds 4 px
margin + ≈ 10 px (12 px font). Labels ≈ 8 px per character (estimated): "Water 3" ≈ 55, "Harvest 3" ≈ 70,
"Plant 3" ≈ 52. Three level-2 buttons ≈ 95 + 110 + 92 = **≈ 297 px**, + 2 × 6 px gaps + 2 × 8 px bar padding =
**≈ 325 px of 375** (≈ 50 px spare; n is at most 8 at the 24-tile cap, always one digit). The bar no longer scrolls
sideways (`overflow-x` removed). The popover (− / count / +, 44 px buttons ≈ 150 px wide) opens above the bar at
8 px from the left; ≥ 768 px it opens left of the vertical bar. Owned farm tools are solid green-bordered cards
"✓ Owned"; pouch and storage item names never wrap their count ("🟤 Copper ore ×3" stays one line, the sell buttons
wrap instead); smelt reasons are "no fuel" / "no ore" / "full" on a second line; the recipe line breaks only
between "ore N · coal N · wood N"; the pickaxe line reads "187 / 200 · ~187 more uses".

**Copper tool UI (task 45):** 🛒 Shop "Farm tools" has 12 cells in the 2-column grid (168.5 px each at 375 px, 30 px
side padding for the ⓘ), each job's copper row right after its three levels, so the pairs read Can / Hose, Cart /
🟧 Copper Can, Sickle / Scythe, Reaper / 🟧 Copper Sickle, Dibber / Drill, Spreader / 🟧 Copper Dibber: 6 rows of
≈ 56 px instead of 5. A copper row says "needs Watering Can" (Sickle, Dibber) until the job's Lv1, then "🟧4 💰100",
then "✓ Owned"; ⓘ texts in `tips.ts` (`COPPER_TIPS`, no numbers); Shop badge keys `copper:<job>` (unlocked) and
`copper:<job>:buy` (affordable). The tool bar marks a copper job with a copper border and a 4 px inset bottom
stripe (`box-shadow`, 0 px wider, so the 375 px sum above is unchanged at ≈ 325 px) and a "Copper Can" tooltip. The
moisture bar draws the part above 1 as a darker blue band over the full bar (moisture 1.5 = full bar, left half
dark). A press toast names the copper luck: "Harvested 6/6 (+1 bonus)", "Planted 6/6 (2 seeds kept)"; tile taps
never toast it. 📊 Stats: "Water tier · waters to 2 (×2 moist time) · Copper Can", "Harvest tier · 10 % double
harvest", "Plant tier · 20 % seed kept" (basic: 1 / ×1, 0 %, 0 %), from `waterMoisture` / `doubleHarvestChance` /
`seedKeepChance`.

**Sim (task 46), `tests/sim.test.ts` "batch 7.1".** Save v7 (one bump; fixture `tests/fixtures/save-v6.json` captured
from the batch-7 code first, chain v1–v6 → v7 tested). No `balance.ts` number was retuned: the copper tool price
stays 🟧4 💰100 (cash is never the limit; bars are). Tier-0 runs replay exactly: the batch-7 ladder pin (ticks,
final cash 5980, counters, PRNG state 1328891991) and every batch-3 greedy pin pass unchanged.

Ladder: the batch-7 ladder bot, then Copper Can → Copper Sickle → Copper Dibber (each bought with the job's tool Lv1
if missing, as soon as 4 bars + 💰100 are in hand; it keeps 4 bars plus the ore and coal to smelt the rest), 3600 ticks:

| Step | tick | min |
|---|---|---|
| copper pickaxe (unchanged) | 2172 | 36 |
| 1st copper tool (Copper Can) | 2598 | 43 |
| 2nd (Copper Sickle) | 2835 | 47 |
| 3rd (Copper Dibber) | 3075 | 51 |

- Goals every 4–7 min after the pickaxe (+7.1, +4.0, +4.0 min). Every batch-7 step tick is unchanged. Lowest value
  0, never borrows, final cash 6119 (batch 7: 5980). Hour counters vs batch 7: waters 454 (525), mines 519 (447 —
  the energy saved on watering goes into mining), sales 417 (386), harvests 107 (107), plants 115 (116).

Cash per energy, one crop on the 9 starting tiles, 1200 ticks (`runCropBot`, same accounting as batch 6):

| Crop | tools | cash/energy | waters | harvests | water presses per crop |
|---|---|---|---|---|---|
| carrot | none | 2.14 | 180 | 99 | 1.82 |
| carrot | all three copper | 3.15 | 90 | 99 | 0.91 |
| pumpkin | none | 8.18 | 180 | 36 | 5.00 |
| pumpkin | all three copper | 14.21 | 90 | 36 | 2.50 |

- Water presses per crop halve for both crops; harvests per session do not change (grow time and tile count still
  bind). Most of the cash/energy gain is the halved watering energy, plus double harvests and kept seeds.
- Mining stays below farming as in batch 7: every copper-pickaxe bench (vein Lv1 / Lv2, mastery Lv0 / Lv10) < 0.9 ×
  pumpkin without copper tools (7.36; benches 2.18–2.38), so with copper tools the gap only grows.
- Prices vs storage: a copper farm tool is 4 bars ≤ 40 (storage Lv2 when buyable, after the copper pickaxe).

## Batch 7.2 — 🌾 Farm tab in the side panel (tasks 47–48)
Question: on desktop, is everything the player presses while farming in one place (Toon's 2026-11-07 feedback)?
UI only — no core numbers, no save-shape change (tab choice lives in `tiles.ui`). Decision: DECISIONS.md "Farm tab
(batch 7.2)".

47. [x] New first side-panel tab **🌾 Farm**, the default tab, in the layout where the side panel sits next to the
    farm (desktop). It holds, top to bottom: the tool buttons Water / Harvest / Plant (with the 7.1 n-step popover
    and copper marks), the crop picker (owned crops only; picking sets the crop to plant, replacing the "Planting:"
    selection in 🛒 Shop), the seed pouch rows + auto-buy toggle, and 🪏 Dig for seeds. The right-edge tool bar on
    the Farm column is removed there, so the grid gets that width back. 🛒 Shop keeps only things you buy: crop
    licenses (and seed price), Supplies, Farm tools, copper tools. In the mobile layout (farm is its own bottom tab)
    nothing moves: the bar above the tab bar stays and the side-panel tabs do not gain a 🌾 Farm tab (the bottom
    🌱 Farm tab already is it). Badge rules unchanged; the side-panel tab row must show every tab without the ›
    overflow at ≥ 1024 px.
48. [x] Wood icon: 🪵 renders as an empty box on Toon's device. Replace it everywhere (UI, tips, prices, Stats) with
    one shared icon constant using an older, widely supported emoji (e.g. 🌲 or 🪓 — pick one and say why), so a
    later change is one line. Tests for 47: the Farm tab renders the three tool buttons and the crop picker; picking
    a crop changes what Plant plants; Shop no longer has a crop picker.

## Batch 7.2 results
UI only; no `balance.ts` number, no save shape (save stays v7), no core behaviour. 318 tests (314 before).

- **Breakpoint:** `(min-width: 1024px)` and the panel expanded = the side panel sits beside the farm (same query as
  the app.css desktop grid). Below it (mobile, and the 768–1023 px slide-over) nothing moved from 7.1.
- **What moved where (task 47), desktop:** new first and default tab 🌾 Farm (`DEFAULT_UI.tab = 'farm'`; a remembered
  `farm` shows 🛒 Shop where the tab does not exist) holds, top to bottom: the tool buttons (same `Tools` component,
  n-step popover opening below the row, copper marks), "Crop to plant" (owned crops only, `seeds N` under each;
  picking sets what Plant and tile taps plant), the Seed pouch rows + auto-buy, 🪏 Dig for seeds. The farm column
  shows only the grid: the Planting line, the right-edge tool bar and Dig are not rendered there. 🛒 Shop keeps
  Seeds (licenses; an owned crop is a ✓ card with its seed price), Supplies, Farm tools, copper tools. Badges
  unchanged (Farm is not a badge tab). New code: `src/app/Farm.tsx` (`Farm`, `SeedPouch`, `DigSeeds`).
- **Side-panel tab row, computed from `app.css` at 14 px system-ui, not measured (see Deviations):** row width =
  panel − 2 × 8 padding − 36 › toggle − 4 gap. **1024 px:** panel clamp(300, 26vw = 266, 380) = 300 → **244 px**.
  **1440 px:** panel 26vw = 374.4 → **318.4 px**. Icon-only tab ≈ 28 px (2 border + 2 × 4 padding + ≈ 18 emoji,
  estimated); the open tab adds its name (≈ 7 px/char, estimated): Farm/Shop/Bank ≈ 60, Stats ≈ 67, Upgrades ≈ 88.
  Row = 4 × 28 + open tab + 4 × 4 gaps ≤ **216 px** (Upgrades open): 28 px spare at 1024, 102 px at 1440; buttons
  stretch to fill. With every name shown the row would need ≈ 351 px.
- **Grid width gained at 1440 px:** the Farm column is 668.8 px (6.2 results). The right-edge bar took ≈ 104 px
  (level-1 "Harvest 1" ≈ 96 + 8 margin) to ≈ 118 px (level-2 "Harvest 3 ⋯"), estimated, so the grid box goes from
  ≈ 551 to **668.8 px (+≈ 118)**. At 1440 × 900 the grid is width-bound (9 tiles: 219 px per tile by width vs 260
  tile-max and ≈ 262 by height; 24 tiles: 129 vs ≈ 155), so the tiles do grow by that width.
- **Wood icon (task 48): 🌲 (U+1F332, Unicode 6.0, 2010)** in `ITEMS.wood.emoji`, read by Shop "🌲 Wood", the furnace
  recipe line, "Smelt with 🌲2", and every price through `priceText` (pickaxe craft/repair). 🪓 (U+1FA93) sits in
  the same Symbols and Pictographs Extended-A block as 🪵 (U+1FAB5), so a font missing 🪵 likely misses 🪓 too.

## Batch 8 — workers v1 (water + harvest) + auto-smelt (tasks 49–53)
Question: once the farm is set up, can it keep running without every tap (and while away), without killing the
reason to spend energy?
Decisions: DECISIONS.md "Workers v1 (batch 8)"; research docs/research/workers.md (§3 certificates, §4 wages,
§6 batch scope — its economy numbers predate batches 5–7, so the sim re-checks every one). Save v8 (capture a real
v7 fixture first; chain v1–v7 → v8; backup key).

49. [x] Save v8 + workers core (`src/core/workers.ts`): `run.workers = { pool, assigned: Record<WorkerJob, number>,
    certificates: WorkerJob[], cooldowns }` with `WorkerJob = 'water' | 'harvest'` (plant/mine later, typed so they
    extend). `hireWorker()` cost 80 × 1.7^(n−1), cap 6; `buyCertificate(job)`: water 💰100 (visible after 40
    waters), harvest 💰150 + 20 stone (visible after 40 harvests); hire button visible after 30 harvests;
    `assignWorker(job, ±1)`. Typed errors (`LOCKED`, `NO_CERTIFICATE`, `POOL_FULL`, `NO_FREE_WORKER`,
    `NOT_ENOUGH_ITEMS`, `NO_CASH`). New counter `wagesPaid` (+ lifetime). Every number in balance.ts.
50. [x] Worker tick inside `step`: every `WORKER_ACTION_TICKS` (5) each assigned worker does its job's existing
    action once on the best target (water: driest tile below its tier's full moisture; harvest: ripe longest first)
    if a target exists and cash ≥ `WORKER_WAGE` (1), paying the wage at that moment; no target or no cash = idle,
    no charge. No player energy. The job's copper tier applies (same action). Closed-form or loop — but step(s, n)
    must equal n × step(s, 1) and 8 h offline must stay fast (test both). Worker actions bump the same counters as
    the player's (they count toward unlocks) and the PRNG draws of the copper sickle stay in action order.
51. [x] Auto-smelt: a toggle on the furnace (available once it is built, off by default). When on, the furnace
    enqueues a job whenever ore ≥ 2, coal ≥ 1 and the queue has room (coal only — never wood, so repair wood is never
    eaten), and moves finished bars into storage when there is room. Runs in `step` and offline, deterministic.
52. [x] Workers UI: a 👷 Workers card in the 🌾 Farm tab on desktop and below the grid in the mobile Farm view:
    "free N / pool", one row per job "💧 Water [−] n [+]" / "🌾 Harvest [−] n [+]", a locked row shows its
    certificate price and gate progress, the hire button with its price, an "unpaid" badge on a row whose worker
    skipped for cash. HUD "👷 N"; away banner adds "wages paid 💰N". ⓘ tips (no numbers in text). 📊 Stats: workers,
    wages paid, auto-smelt state. Also (Toon's device showed ▯ for 🪨 in the Furnace price, like 🪵): every emoji
    from Unicode 12+ (🪨 stone, 🪏 dig, any other — list them) moves to one shared constant with an emoji from
    Unicode ≤ 11, the way batch 7.2 did wood (`ITEMS.*.emoji`); the 👷 icon is fine (Unicode 6).
53. [x] Sim + results: a bot that buys certificates and hires when affordable, assigns water first. Assert: cash never
    negative, including cash 0 with every worker assigned (they idle); a 9-tile pumpkin farm with workers on water +
    harvest and the player only planting nets ≥ 80 % of the manual rate (report both); an 8 h offline catch-up with
    workers and auto-smelt ends with more cash and ≥ the bars the queue allows; mining stays below farming; the
    batch-7/7.1 ladder pins are unchanged when no worker is hired and auto-smelt is off. Report ticks for first
    certificate, first hire, pool 3. Write "## Batch 8 results".

## Batch 8 results
No `balance.ts` number changed in tasks 52–53; save stays v8.

### UI (task 52)
- **Where:** `src/app/Workers.tsx` (`Workers`), rendered at the end of the desktop 🌾 Farm tab and, wherever there is
  no Farm tab (mobile, the 768–1023 px slide-over layout, collapsed desktop), below the grid after Dig for seeds.
  Closed: "👷 Workers · free N / pool" (+ "unpaid"). Open: one row per job — before its certificate, the job label
  with its gate progress while locked ("waters 12/40") and a "Certificate" button with its price (disabled until
  unlocked and affordable); after it, "💧 Water [−] n [+]" with "unpaid" when `workerUnpaid`; then, once hiring is
  unlocked, "👷 Hire worker 💰price" ("pool full" at the cap). Every row has an ⓘ (`WORKER_TIPS`, `TIPS.hire`, no
  numbers). HUD "👷 N" (pool) before ⏱. Banner: "… · wages paid 💰N" when N > 0. 📊 Stats: Lifetime "Wages paid";
  Now "Workers" (hired · free, per-job counts) and "Auto-smelt" (on / off / no furnace). Furnace: auto-smelt checkbox.
- **Widths, computed from `app.css` at 14 px system-ui, not measured** (≈ 7 px/char at 14 px, ≈ 6.5 at 12 px, ≈ 18 px
  per emoji, as in 7.2). Room: mobile farm column 375 − 2 × 8 = **359 px**; desktop Farm tab 300 − 2 × 8 = **284 px**
  at 1024, 374 − 16 = **358 px** at 1440. Job row with workers: "🌾 Harvest" ≈ 71 + [−] 44 + count 2ch ≈ 16 + [+] 44 +
  "unpaid" ≈ 52 + ⓘ 28 + 5 × 4 gap = **≈ 275 px** (fits 284 with ≈ 9 px spare). Certificate row: label column ≈ 91
  ("harvests 12/40" at 12 px under the label) + button ≈ 95 ("Certificate" over its price, both lines in the button) +
  ⓘ 28 + 2 × 4 = **≈ 222 px**. Hire row ≈ 149 px. Rows wrap (`flex-wrap`) rather than overflow if an estimate is off.
  Closed card = one 44 px summary row + 8 px gap below the grid.
- **HUD at 375 px, worst case** (4-digit cash, 5-digit tick, bank debt pill, 👷): content 359 − 16 padding = 343 px;
  💰 1234 ≈ 58 + ⚡ 20 / 20 ≈ 72 + debt pill ≈ 71 + ⏱ 12345 ≈ 67 + 👷 6 ≈ 32 + 4 × 8 gaps = **≈ 332 px** (16 px bold,
  ≈ 8.8 px/digit) — fits with ≈ 11 px spare.
- **Emoji sweep (task 52):** every glyph in `src/` checked by code point; Unicode 12+ ones replaced:
  | Was | Unicode | Now | Unicode | Where (one constant) |
  |---|---|---|---|---|
  | 🪨 stone | 13.0 | ⛰️ U+26F0 FE0F | 5.2 | `ITEMS.stone.emoji` (prices, drop table, vein rock, sell all) |
  | 🟤 copper ore | 12.0 | 🔶 U+1F536 | 6.0 | `ITEMS.copperOre.emoji` (drop table, furnace recipe) |
  | 🟧 copper bar | 12.0 | 🥉 U+1F949 | 9.0 | `ITEMS.copperBar.emoji` (prices, furnace, Collect, copper tool rows) |
  | 🟫 untilled tile | 12.0 | 🌿 U+1F33F | 6.0 | `SOIL_EMOJI.untilled` (FarmGrid.tsx) |
  | 🟤 tilled tile | 12.0 | 🕳️ U+1F573 FE0F | 7.0 | `SOIL_EMOJI.tilled` (FarmGrid.tsx) |
  | 🪏 dig for seeds | 13.0 | ✋ U+270B | 6.0 | `DIG_EMOJI` (Farm.tsx) |

  Why these: no Unicode ≤ 11 emoji is a rock or a metal bar, so stone is the mountain (rock), ore an orange chunk, the
  bar a copper-coloured metal piece (the bronze medal); untilled ground is weeds, a tilled tile a planting hole, and
  dig for seeds is by hand. Everything else in `src/` is Unicode ≤ 9 (🥕 🛒 9.0, 🌶️ 7.0, the rest 6.0 or older, ⓘ ⋯ ≥ ≤
  are text symbols). 👷 is Unicode 6.0.

### Sim (task 53, `tests/sim.test.ts` "batch 8", measured)
- **Workers ladder bot** = the batch-7.1 copper ladder bot (four crops, mine-early) + each tick after the license buy:
  buy any certificate it can, hire while affordable (to the cap), put free workers on water while water has no more
  than harvest. 3600 ticks, pinned: **water certificate tick 628, first hire 643, pool 3 at 1024**, harvest
  certificate 1141, pool 6 (cap) by the hour (3 water / 3 harvest). Cash never below 0, no loan.
- **Same bot without vs with workers** (7.1 pins vs batch 8): final cash 6119 → **3452** (6 hires, 2 certificates,
  💰379 wages); the freed energy mines: mine actions 519 → **868**, so the ladder runs faster — copper pickaxe 2172 →
  1644, last copper tool 3075 → 2361.
- **Cash per minute, one crop on 9 tiles, 1200 ticks** (`runCropBot`: net cash incl. standing crops; workers = 1
  water + 1 harvest from tick 0, the player only tills and plants):

  | Crop | manual | workers | share | wages | copper can: manual | workers | share | wages |
  |---|---|---|---|---|---|---|---|---|
  | pumpkin | 110.4 | 96.8 | **87.7 %** | 234 | 110.4 | 101.7 | **92.2 %** | 126 |
  | carrot | 42.3 | 25.2 | 59.5 % | 296 | 42.3 | 30.6 | 72.2 % | 189 |

  Pumpkin passes the ≥ 80 % check (asserted, with and without the copper can); carrot automation stays marginal
  (reported, not asserted). The sim's greedy order gives the same numbers as task 50's `pumpkinRate` bench.
- **8 h offline** (catch-up from the workers ladder bot's end state, tick 3600, 6 workers, auto-smelt turned on;
  storage 38/40, 4 ore, 9 coal, 4 bars in the tray): cash 💰3452 → **💰4537** (+1085), bars 4 → **6** (= every bar the
  stock allows: 4 + min(⌊4/2⌋, 9)), wages paid **💰15**, catch-up runtime **15 ms** (one run, this machine). Only 15
  worker actions: nobody plants while away, so the workers harvest what stands and then idle for free.
- **Cash 0 with every worker assigned:** 600 ticks from that state, cash stays exactly 0 and no wage is paid.
- **Mining vs farming:** in the workers ladder run farming earns **24.9** cash per player energy (worker income net of
  wages counted as farming, it costs no energy) vs mining **1.54** (batch-7 ladder without workers: 9.23 vs 1.43). No
  balance number changed, so the batch 6 / 7 / 7.1 benches (mining < 0.9 × farming) are unchanged and still pass.
- **Unchanged pins:** batch-7 and 7.1 ladder bots (no worker hired, auto-smelt off) replay exactly: ticks, final cash
  5980 / 6119, counters, PRNG state.
- **Reading:** workers do keep a pumpkin farm running at ≈ 88 % of hand play, and the energy they free goes to the
  mine (+67 % mine actions), not nowhere. Offline value is capped by the missing planter: away, the farm stops after
  one harvest round.

## Batch 8.1 — floating tips + stacked farm tool rows (tasks 54–55)

UI only: no change to `src/core/**`, `balance.ts` or the save shape (save stays v8). Toon's playtest feedback on
the live batch-8 build.

- [x] 54. **Floating ⓘ tips.** `Info` (src/app/Info.tsx) renders the tip in flow today, so opening one pushes every
    row below it down. Make the tip float: `position: fixed`, placed from the ⓘ button's `getBoundingClientRect()`
    — below the button by default, flipped above when it would pass the viewport bottom, clamped to the viewport's
    left/right edges (8 px margin), max-width ~280 px. It must not be clipped by the scrolling side panel, must
    not move any other element, closes on Esc / pointer-down outside / scroll of its scroll parent, and keeps the
    hover-to-show on desktop and tap-to-toggle on touch. Keep `role="tooltip"` + `aria-describedby`. Also fix the
    seed-pouch rows of Pumpkin / Lemon where the ⓘ wraps to its own line: the ⓘ stays on the row's first line at
    every width from 1024 px up and at 375 px.
- [x] 55. **Desktop Farm tab: three stacked tool rows, order Plant / Water / Harvest.** Inside the desktop 🌾 Farm
    tab only, `.tools` becomes `flex-direction: column`; each owned tool is one row
    `[ − ]  [ 🌱 Plant 4 ]  [ + ]` (a flex row: − on the left, the press button with the per-press count in the
    middle, + on the right), in the order plant, water, harvest (the farm loop order). −/+ set the same per-press
    count the level-2 popover sets today (`setToolN`), with the same bounds and disabled states. Level-1 (one tile)
    and level-3 (all tiles) rows have no count to set: hide −/+ but keep their space so every middle button has the
    same width. Copper marks, stop/feedback text and the press behaviour stay as they are. Remove the ⋯ / right-click
    / long-press popover on desktop (−/+ replace it). **Mobile (< 768 px) is unchanged**: the one-row bar above the
    bottom tab bar with ⋯ + popover stays, same order as today. The collapsed-panel fallback (tools beside the farm
    when the side panel is collapsed) uses the stacked rows too. Measure from CSS that each row fits the panel's
    content width at 1024 px (~284 px) and 1440 px; no row may overlap the panel tabs (reset every offset the mobile
    rule sets).

## Batch 8.1 results
UI only; no `src/core/**`, `balance.ts` or save change (save stays v8). 374 tests (365 before).

- **Tip placement (task 54):** `placeTip(anchorRect, tipSize, viewport)` in `src/app/Info.tsx` (pure, unit-tested):
  top = ⓘ bottom + 4 px; flipped to ⓘ top − 4 − tip height when the tip would end below `viewport − 8` and fits above
  (else it stays below); left = centred on the ⓘ, clamped to `[8, viewport width − 8 − tip width]`. CSS caps the tip
  at `min(280px, 100vw − 16px)`, so the clamp always fits. The tip is `position: fixed` (z-index 5, above the toast
  and the slide-over), placed in a layout effect when it opens (measured at 0,0 so its shrink-to-fit width is the
  final one), so it moves no row and the scrolling side panel cannot clip it. No `Info` renders inside `.farm-fit` /
  `.grid` (`container-type` would make them its containing block). Opens on mouse hover / keyboard focus-visible /
  tap; a tap pins it; closes on a second tap, Esc, a pointer-down outside the ⓘ and the tip, or any scroll.
  `role="tooltip"` + `aria-describedby` unchanged.
- **Pouch rows:** `[🎃 Pumpkin × 12] [ⓘ] … [Buy ×1] [Buy ×10]`, name + ⓘ ≤ ≈ 168 px (4-digit count). At 16 px
  (≈ 8 px/char, ≈ 18 px/emoji, 12 px price), Pumpkin: name ≈ 118 + ⓘ 28 + Buy ×1 ≈ 101 + Buy ×10 ≈ 116 + 3 × 6 gaps
  = ≈ 381 px, so at 284 (1024), 343 (375 px Shop view: 375 − 2 × 8 − 2 × 8) and 358 (1440) line 1 is name, ⓘ, Buy ×1
  (≈ 259) and Buy ×10 wraps; Lemon the same (≈ 365). Radish (≈ 346) fits one line at 1440.
- **Stacked rows (task 55), computed at 16 px:** each row = − 44 + 6 + press + 6 + + 44 (`.tool-row`, flex), the
  press button `flex: 1`. Widest label "Harvest all" ≈ 88 + 24 padding + 2 border = **114 px**, so a row needs
  **≈ 214 px**. **1024 px Farm tab:** content 284 → press buttons **184 px** (70 spare). **1440 px:** 374.4 − 16 =
  358.4 → press buttons **258 px**. The rows sit in panel flow 8 px below the panel head; the ≥ 768 `.tools` rule now
  resets `left`, `right` and `bottom` to `auto`, so nothing offsets them onto the tabs. Header and bottom tab bar are
  other grid rows / hidden at ≥ 768.
- **Collapsed-panel fallback:** the same rows in the farm column's `auto` track: 214 + 8 margin = **222 px** (was
  ≈ 118 for the level-2 vertical bar). Farm column collapsed = 1024 − 2 × 20 padding − 2 × 20 gaps − mine 225.3 −
  panel 52 (36 px toggle + 2 × 8) = 666.7 → grid box **≈ 445 px** at 1024 (was ≈ 549; 9 tiles ≈ 144 px each), and
  1440 − 80 − 316.8 − 52 = 991.2 → **≈ 769 px** at 1440.
- **Mobile (< 768 px), 375 px:** unchanged — the fixed one-row bar above the tab bar, water / harvest / plant, ⋯ +
  popover (≈ 325 of 375 px, 7.1). Tips there are ≤ 280 px wide, ≥ 8 px from each edge. The flip checks only the
  viewport bottom (− 8 px), so a tip opened just above the 56 px tab bar (or the tool bar) may draw over them: it is
  z-index 5, on top, and closes on the next tap or scroll, so they are covered only while it is open. Tablet
  (768–1023) keeps the vertical bar + popover (see Deviations).

## Batch 9 — fuelled furnace, furnace workers, smart furnace + feedback polish (tasks 56–61)

Toon's playtest feedback on the live batch-8.1 build: the free auto-smelt toggle is too easy; the furnace should need
fuel that burns away; furnace upgrades and furnace workers replace the toggle. Plus three UI items. Save v8 → v9.

- [x] 56. **UI polish first (no core).** (a) The 🔥 Furnace and 👷 Workers `<summary>` headers do not look pressable
    (`display: flex` on `summary` hides the native ▸ marker; app.css `.mine-furnace summary`, `.workers summary`):
    add a ▸ / ▾ chevron (U+25B8 / U+25BE) on the left that follows `open`, a light button-like background + radius,
    and a hover/focus state, the same for every collapsible card. (b) **Smooth bars:** progress bars (`.bar > span`:
    grow, water, rot, tool, energy and every furnace bar) jump once per 1 s tick. Add `transition: width 1s linear`
    while the value grows; when it goes DOWN (harvest → 0, new bar, refill) the bar jumps with no transition (no
    backwards slide). Honour `prefers-reduced-motion: reduce` (no transition).
- [x] 57. **Save v9 + fuelled furnace core** (`src/core/furnace.ts`). Replace the paid-up-front queue with:
    `furnace = { built, fire, ore, progress, ready, smart, levels: { fireCap, batch } }`.
    - `fire` is in burn ticks. One fire unit = FIRE_UNIT_TICKS (30); wood = 1 unit, coal = 2 units; one smelt cycle
      = BAR_TICKS (60) of fire = 2 units, so cost per bar stays coal 1 or wood 2 as today. Start fire cap 10 units.
    - **Plain furnace: fire burns whenever fire > 0**, also with no ore loaded or the tray full (wasted). A cycle
      progresses only while fire > 0, ore ≥ ORE_PER_BAR × batch and the tray has room; a cycle yields `batch` bars.
    - `addFuel(state, fuel)` = the player's "fill" press: adds as many whole wood/coal items as fit under the cap
      (never over the cap; partial if storage runs short). `loadOre(state)` moves copper ore from storage into the
      furnace's ore slot (slot cap ORE_SLOT, e.g. 10). `collectBars` as today. Typed errors (FULL, NO_FUEL, NO_ORE …).
    - **Smart furnace** (`smart = true`, an upgrade, task 58): fire only burns while a cycle is progressing.
    - step(s, n) must equal n × step(s, 1) for every combination (fire running out mid-cycle, ore running out, tray
      filling) — test it.
    - Save v9 per CLAUDE.md: FIRST commit `tests/fixtures/save-v8.json` (a realistic v8 state from the current code:
      furnace with a queue and ready bars, workers hired and assigned, autoSmelt on). Migration: every paid queued
      job becomes a ready bar (fuel and ore were already paid, nothing is lost; the tray may exceed its cap once);
      fire 0, ore 0, smart false, levels at base; `autoSmelt` is dropped (it was a free toggle, no earned value).
      Chain v1–v8 → v9 with a backup key.
- [x] 58. **Furnace workers, certificates, upgrades** (core). Two new `WorkerJob`s, using the same pool, wage and
    action clock as batch 8:
    - **Ore loader** (`ore`): one action = collect the tray into storage if it has bars and storage has room, else
      load one cycle of ore. Acts only when it has something to do (no wage for idle presses). Certificate: 🥉3 bars
      + 💰100, visible after 10 bars collected.
    - **Fuel loader** (`fuel`): one action = add one coal when the room ≥ 2 units. **Coal only** (wood stays manual,
      kept for pickaxe repairs). Certificate: 🥉8 bars + 💰200, visible after 30 bars collected. On a plain furnace
      it keeps the fire going with or without ore — that is the waste smart furnace removes.
    - Bars-collected unlocks read `lifetime.bars` (add a counter migrated from it if `CERTIFICATES` needs a CounterId).
    - **Furnace upgrades** (one-time or levelled, prices in copper bars + cash, the costs in balance.ts):
      fire capacity (10 → 20 → 40 units), batch (1 → 2 → 3 bars per cycle: more bars per fuel), smart furnace
      (more expensive than the fuel certificate). Shown next to the furnace in the Mine panel, like the vein upgrade.
    - Remove `setAutoSmelt` / `autoSmelt` and its UI (task 59) — the ore loader replaces it.
- [x] 59. **Furnace + worker UI.** Furnace card: a fire gauge (`.bar`, units / cap, 🔥), the ore slot count, buttons
    "Load ore", "Fill with 🌲 wood", "Fill with ⚫ coal" (each shows how many items it will use, disabled with a reason
    when it cannot), the tray + Collect, the three upgrades, and a plain-furnace hint when the fire burns with no ore
    ("burning with nothing to smelt"). Workers card: ore and fuel rows with their certificates, the same −/count/+
    pattern as water/harvest. 📊 Stats: fire wasted (ticks or units) and bars smelted. Away banner: fuel burnt / bars.
    ⓘ tips without numbers in text. Compact at 375 px; no 7th tab.
- [x] 60. **Show which tile a worker works on.** A pure core function `workerTargets(state)` returns, for every
    assigned water/harvest worker, the tile its next action will touch — sharing the selection code the worker uses
    (one rule, not a copy). Not saved. UI: a thin dashed ring on each target tile; when a worker acts on a tile (the UI
    sees it between two ticks), that tile flashes ~0.5 s with a small 💧 / 🌾 pop. No walking figures. Must stay
    readable on 375 px tiles and must not shift layout.
- [x] 61. **Sim + balance** (existing ladder bot / runCropBot). Measure and pin: plain furnace with no ore wastes at
    most one tank; time to first ore/fuel certificate and to smart furnace; bars/hour manual vs ore loader vs both vs
    smart; 8 h offline with both loaders on a plain vs smart furnace (waste ≤ one tank on plain when ore runs out);
    every copper-bar price ≤ what the player can hold; cash never negative; all older pins still pass. Tune only the
    batch-9 numbers in balance.ts and report every change as a deviation.

## Batch 9 results

### UI polish (task 56)
- **Collapsible headers:** one `details > summary` rule for every card (🔥 Furnace, 👷 Workers): `list-style: none` +
  `::-webkit-details-marker` hidden, a `::before` chevron ▸ / ▾ (U+25B8 / U+25BE, 1em wide, a flex item before the
  text) that follows `[open]`, padding 0 8 px, radius 8, a light `rgba(0,0,0,.05)` fill, `.1` on hover, a 2 px outline
  on `:focus-visible`. Widths, computed at 14 px (≈ 7 px/char, 18 px/emoji): summary text room = content − 16 padding −
  14 chevron − 4 gap. **Furnace** (Mine column, `.mine` padding 8): 1024 → 225.3 − 16 = 209.3 → text 175.3; 1440 →
  316.8 − 16 → 266.8; 375 → 343 → 309. The summary already wrapped to two lines at 1024 before (≈ 228 px of text); two
  14 px lines ≈ 34 px stay inside the 44 px min-height, so the card does not grow. **Workers** ("👷 Workers · free 6 / 6"
  + "unpaid" ≈ 221 px): Farm tab 284 → 250 (1024), 358 → 324 (1440), 359 → 325 (375) — one line everywhere. Chevron
  and fill sit inside the summary box, so nothing moves into a neighbour; only the focus outline (2 + 2 px, no layout)
  draws past the box, inside the 4–6 px gaps of `.workers` / `.mine`.
- **Smooth bars:** `.bar > span { transition: width 1s linear }`; `Bar` keeps the previous value in state (React's
  previous-props pattern, StrictMode-safe, no ref read in render) and adds `.bar-down` (`transition: none`) on the render
  where the value drops, so harvest → 0, a new cycle or any drain jumps; `prefers-reduced-motion: reduce` turns the
  transition off. Applies to every `Bar` (grow, water + its over-1 band, rot, tool, energy, furnace, mastery).
  `tests/Bar.test.tsx`.

### Fuelled furnace + save v9 (task 57)
- **Fixture first:** `tests/fixtures/save-v8.json` (own commit) is the real v7 fixture loaded by the batch-8.1 code and
  played 402 ticks with its real actions: water + harvest certificates, 3 hires (2 water, 1 harvest), lemons planted,
  copper ore mined, coal jobs queued, a collect; auto-smelt switched on last. Furnace queue 2, progress 30, ready 3.
- **Shape:** `furnace = { built, fire, ore, progress, ready, smart, levels: { fireCap, batch } }` (`createFurnace()`),
  `run.autoSmelt` gone, lifetime + `fireBurnt`, `fireWasted`, `barsSmelted`. `RunV8` is frozen in `serialize.ts`.
  `migrateV8`: ready = tray + queue (the v8 fixture: 3 + 2 = 5; a migrated tray may exceed the cap once, which only
  blocks smelting until collected, tested), fire 0, ore 0, progress 0, plain, base levels. Chain v1…v8 → v9; backup key per version.
- **Numbers (`balance.ts`):** fire in burn ticks, unit 30; wood 1 unit, coal 2; a cycle burns `barTicks` 60 (coal 1 or
  wood 2 per bar, unchanged); fire cap 10 / 20 / 40 units by level; batch 1 / 2 / 3 bars per cycle (ore 2 × batch);
  tray 5; ore slot 10 (12 since the task-58 fix, see Deviations). Read through `fireUnitTicks`, `fuelUnits`, `fuelTicks`, `fireCapUnits`, `fireCapTicks`,
  `batchBars`, `furnaceTrayCap`, `oreSlotCap`, `smeltOre`, `smeltFuel`, `barTicks`.
- **Rules (`furnace.ts`):** `smelting(f)` = fire > 0, ore ≥ `cycleOre(f)`, ready + batch ≤ tray cap. `tickFurnace`:
  smelting → fire − 1, progress + 1, on 60 the cycle's ore leaves the slot and batch bars enter the tray; lit but not
  smelting → a plain furnace burns 1 (counted wasted), a smart one nothing. Fire running out pauses the cycle where it
  stands. `addFuel` order NO_FURNACE, FULL (not one item fits under the cap), NO_FUEL; `loadOre` NO_FURNACE, FULL,
  NO_ORE; both partial when storage runs short. `fuelRoom(f, fuel)` = whole items that fit now.
- **Bridge UI** (until task 59): the Furnace grid keeps 3 columns, so at 1024 (Mine column content 209 px, buttons
  ≈ 66 px) "Fill with 🌲" wraps inside its button; buttons grow, nothing overlaps.
- **Sim:** all batch-7 / 7.1 / 8 pins replay unchanged (see Deviations for the bot's matched loading).

### Furnace loaders, certificates, upgrades (task 58)
- **Jobs:** `WORKER_JOBS = water, harvest, ore, fuel`, same pool, wage (💰1 at the action) and 5-tick clock; they act
  in that order at the start of the tick, before the furnace burns. **Ore loader:** collects the tray (as much as
  storage takes) when it has bars and storage room, else loads one cycle (`cycleOre` = 2 × batch) when storage has it
  and the slot has room. **Fuel loader:** one coal when `fuelRoom(f, 'coal') ≥ 1` (room ≥ 2 units) and storage has
  coal; never wood. Nothing to do = idle, no wage (`workerAction` null). Tested: each branch, idle cases, both loaders
  on a plain furnace burning on after the ore ran out (wasted > 0) vs smart (wasted 0, coal kept), step(s, n) =
  n × step(s, 1) over 900 ticks plain and smart, 8 h catch-up < 3 s.
- **Certificates:** ore 🥉3 + 💰100, visible / buyable at 10 bars collected; fuel 🥉8 + 💰200 at 30 (`counters.bars`).
- **Upgrades:** `buyFurnaceUpgrade(state, 'fireCap' | 'batch' | 'smart')`, order NO_FURNACE, MAX_LEVEL,
  NOT_ENOUGH_ITEMS, NO_CASH; `furnaceUpgradeLevel(f, id)`, `furnaceUpgradeCost(id, level, meta)` (null at max),
  `furnaceUpgradeMaxLevel(id)` (2, 2, 1), `FURNACE_UPGRADE_IDS`. Fire cap 10 → 20 → 40 units, batch 1 → 2 → 3 bars per
  cycle for the same fire, smart = burns only while smelting.
- **Save:** v9's final shape adds `counters.bars` (= lifetime.bars) and `workers.assigned.ore / fuel` = 0; the real v8
  fixture test asserts the whole migrated run (bars 13, so its ore certificate is already open).

### Furnace + worker UI (task 59)
- **🔥 Furnace card** (`Mine.tsx` `Furnace`, open): "🔥 fire n / cap" (+ " · smart") with an ⓘ, a fire `Bar` (`kind="fire"`,
  orange, burn ticks / cap ticks), the plain-furnace hint "burning with nothing to smelt" (fire > 0, not smart, ore in the
  slot below one cycle), "🔶 ore n / 12" (+ " · p/60 s" and the grow bar while a cycle runs), the recipe line at the current
  batch (🔶2·batch + ⚫1 or 🌲2 → 🥉batch), then the buttons **Load 🔶 ore / Fill with 🌲 wood / Fill with ⚫ coal /
  Collect n 🥉**, each with a second line read off the action's own result: "uses n" (items the press moves), the
  short reason when disabled, "tray n/5" on Collect. Then one `Item` row per furnace upgrade not at max ("Fire cap
  10 → 20", "Batch 1 → 2 bars", "Smart furnace", price + short reason, ⓘ); a maxed upgrade hides like the vein row.
  Summary line unchanged. Tips (`FURNACE_TIPS`) carry no numbers. One `FIRE_EMOJI` (useGame.ts) for every 🔥.
- **👷 Workers card:** the ore / fuel rows (certificate with "bars n/10" / "n/30", then −/n/+) were already rendered by
  task 58's `JobRow`; no change.
- **📊 Stats:** Lifetime "Fire wasted" (`lifetime.fireWasted` in fire units, a part unit counts) next to "Copper bars
  smelted". **Away banner:** "Away for … · 🔥 fire burnt N · 🥉 M smelted · K bars ready · wages paid 💰W", each part
  only when non-zero, all diffs of the state before vs after the catch-up.
- **Widths, computed from `app.css`, not measured** (13 px buttons ≈ 6.5 px/char, 14 px ≈ 7, 12 px ≈ 6.5, emoji ≈ 17).
  Mine column content (task 56): **209.3 px** at 1024, **300.8** at 1440, **343** at 375.
  - Action grid `repeat(auto-fit, minmax(96px, 1fr))`, gap 6: **2 columns of 101.6 px** at 1024 (rows Load + Fill 🌲,
    Fill ⚫ + Collect), **3 of 96.3** at 1440, **3 of 110.3** at 375 (Collect alone on row 2). Text room = column − 2 × 4
    padding − 2 border = 91.6 / 86.3 / 100.3. "Load 🔶 ore" ≈ 76 and "Collect 5 🥉" ≈ 82 are one line; "Fill with 🌲
    wood" ≈ 115 wraps after the emoji (≈ 82) at all three widths, so a fuel button is 2 lines + its 12 px line ≈ 47 px
    (above the 44 px min). Second lines ≤ "storage full" ≈ 78. Grid cells never overlap; a taller cell grows its row.
  - Upgrade rows (`.item`: button full width, `padding-inline: 30px`, ⓘ 28 px absolute at top/right 1 px, i.e. inside
    the right padding): text room 209.3 − 60 − 2 = **147.3** at 1024 (238.8 at 1440, 281 at 375). Labels ≤ "Fire cap
    10 → 20" / "Batch 1 → 2 bars" ≈ 112. Worst second line "🥉12 💰400 · Not enough items" ≈ 195 wraps to two 12 px lines
    at 1024 only (≈ 47 + 15 px tall); one line at 1440 and 375.
  - Fire line "🔥 fire 40 / 40 · smart" ≈ 143 + gap 4 + ⓘ 28 = 175 ≤ 209.3. Ore line "🔶 ore 12 / 12 · 59/60 s" ≈ 185.
    Hint ≈ 189 at 12 px. All one line at 1024.
  - Open card at 1024 ≈ 44 summary + 28 fire line + 6 bar + 20 ore + 6 bar + 34 recipe + 100 actions + 3 × 47
    upgrades + 9 × 4 gaps ≈ **415 px** in the scrolling Mine column; closed it is the 44 px summary, as before.
  - Workers ore / fuel rows: certificate row "⚫ Fuel" + "bars 12/30" ≈ 65 + Certificate 🥉8 💰200 ≈ 95 + ⓘ 28 + 8 ≈
    196; staffed row ≈ 52 + 44 + 16 + 44 + "unpaid" 52 + 28 + 20 = 256 ≤ 284 (Farm tab at 1024) / 359 (375).

### Worker targets on the grid (task 60)
- **Core:** `workerTargets(state): WorkerTarget[]` (`{ job: 'water' | 'harvest', tile }`, one per farm worker that will
  act, in action order). One rule: `workersAct` and `workerTargets` both run `workRound` (every assigned worker, job
  by job, wage at the action, stop at cash < wage); `workerTargets` plays it on `step(state, ticksUntilWorkers(run))`,
  the state at the next worker tick, and keeps the tiles it touched. So two workers on one job, cash running out
  mid-round and the waterer's "due" rule show exactly as they will happen if the player does nothing until then.
  Furnace loaders touch no tile. Not saved. Tested: order, between-tick lookahead, no cash, loaders, and 60 ticks in
  which every ring shown before an action tick equals the tiles `workersAct` then changed.
- **UI:** `FarmGrid` rings each target tile (`.cell-target-water` blue / `-harvest` brown, 2 px dashed `outline` at
  `outline-offset: -4px`). `useGame` keeps `acted` = `workerTargets(before)` when a live step of ≤ 5 ticks crosses the
  worker tick (else []), so the acted tiles get `.cell-flash` (0.5 s white inset-shadow wash) and a `.cell-pop` with
  the job's emoji (`WORKER_JOB_EMOJI`, 💧 / 🌾, 18 px, rises 10 px and fades in 0.5 s) until the next tick. Reduced
  motion: no wash, the pop shows still for that tick. A keyboard-focused tile shows a solid focus outline 2 px outside
  it (`.cell:focus-visible`) in place of the ring while focused (the ring's author outline would otherwise hide the
  browser's focus ring); it draws into the 6 px grid gap, not over a neighbour.
- **Layout, computed from `app.css`:** none of the three takes space: an outline and a box-shadow are not layout, and
  the pop is `position: absolute` (`.cell` is now `position: relative`; nothing else in a cell is absolute). The ring
  sits 2–4 px inside the border box: inside the 4 px side / 6 px top padding, so it never crosses the 1 px border (or
  the 2 px mature / rotting border, which ends where the ring starts) and never covers the emoji, label or bars
  (content starts 5 px in). Tiles: **375 px** (3 columns of the 359 px farm column) ≈ (359 − 2 × 6) / 3 = **115.7 px**;
  **1024 px** farm column 1024 − 40 − 40 − 225.3 − 300 = 418.7 → ≤ **135.6 px**; **1440 px** ≤ 218.9 px (both may be
  smaller when the viewport height limits the grid), floor **72 px**. The pop (18 × 18 at top 4 / right 6) stays in
  the tile's top-right corner at every size; at the 72 px floor it can cover the corner of the crop emoji for its
  0.5 s, never a neighbour tile (the 6 px grid gap is outside the cell box).

### Sim (task 61, `tests/sim.test.ts` "batch 9", measured)
No `balance.ts` number changed: every check below passes on the task-57/58 starting numbers. Save stays v9.
- **Furnace ladder bot** = the batch-8 workers ladder bot (`runBot(…, { furnace: true })`) + after the three copper
  tools: ore certificate → fuel certificate → smart furnace, smelting (k cycles of ore with k coal, collect) while one
  of them is next. A certified loader gets one worker at once (from the bigger farm job when none is free), and the bot
  stops doing that loader's job: no ore loading or collecting once the ore loader works (it only adds coal for the ore
  cycles the fire does not cover yet), nothing once the fuel loader works. 7200 ticks, pinned: **ore certificate tick
  2550, fuel certificate 3141, smart furnace 3741** (≈ 42, 52 and 62 min); every earlier step equals the batch-8
  workers ladder (copper pickaxe 1644, last copper tool 2361). At 2 h: cash 💰13 900, wages 💰898, 80 bars smelted
  and collected, staff water 2 / harvest 2 / ore 1 / fuel 1, fire wasted **0** (mining keeps ore coming, so the
  loaders never run the fire dry of ore), cash never below 0, no loan.
- **Bars per hour, unlimited stock, base levels** (`furnaceBench`: 1000 ore + 500 coal in storage; "manual @ N s" =
  the player collects, loads the slot full and fills the fire with coal every N s; loaders act every 5 s):

  | Setup | bars/h | wages/h | fire wasted |
  |---|---|---|---|
  | manual @ 120 s | **60** | 0 | 0 |
  | manual @ 600 s | **30** | 0 | 0 |
  | ore loader, player fuels @ 600 s | **30** | 66 | 0 |
  | ore loader, player fuels @ 600 s, fire cap Lv1 | **60** | 124 | 0 |
  | both loaders, no player | **60** | 188 | 0 |
  | both loaders + smart | **60** | 188 | 0 |
  | manual @ 600 s + smart | **30** | 0 | 0 |

  60/h is the furnace's ceiling at batch Lv0 (one bar per 60 s). A base tank (10 units = 5 cycles) and the tray (5)
  each last 300 s, so a player who checks every 10 min gets half; the ore loader alone does not change that (the fire
  is the limit) until fire cap Lv1 (600 s of fire). Both loaders run it at full speed for ≈ 💰3.1 wages a bar. Smart
  makes no difference while ore never runs out.
- **Plain furnace left alone:** a full tank and no ore burns away and stops: waste = exactly one tank at every fire cap
  level (**10 / 20 / 40 units**) over 8 h.
- **8 h offline, ore for 10 bars + 30 coal in storage, fire empty:**

  | Setup | bars | fire wasted | coal used | wages |
  |---|---|---|---|---|
  | both loaders, plain | 10 | **40 units** | 30 (all) | 50 |
  | both loaders, smart | 10 | **0** | 15 (10 bars + a full tank kept) | 35 |
  | ore loader only, plain, left with a full tank (ore for 3 bars) | 3 | **4 units** (≤ one tank) | 0 | 6 |

  Both loaders on a plain furnace burn the whole coal stock once the ore runs out (DECISIONS: that is what smart
  buys), so the plan's "≤ one tank" holds only without the fuel loader; see Deviations.
- **Prices fit storage:** both loader certificates (🥉3, 🥉8) and every furnace upgrade level (🥉4, 8, 6, 12, 10) are
  added to the batch-7 table: ≤ 40 items, the storage Lv2 every copper path needs. Cash ≥ 0 in every bench and bot.
- **Unchanged pins:** batch 3–8 sims (ladder ticks, final cash 5980 / 6119 / 3452, wages 379, counters, PRNG state)
  all replay; 421 tests.
- **Reading:** the loaders turn a furnace a 10-minute player runs at half speed into a full-speed one for ~3 cash a
  bar, and the order certificate → certificate → smart lands at ≈ 42 / 52 / 62 min of the ladder, after the copper
  tools. Smart pays off only when ore runs out with the fuel loader on, which in active play (mining feeding ore) did
  not happen in 2 h; offline it saves the whole coal stock.

## Batch 10 — plant worker (tasks 62–64)

Toon: workers for planting next, before iron; dig-for-seeds never gets a worker (a paid dig worker buys a 💰2 carrot
seed for ~💰5 of wages, a free one is a seed printer, and broke players cannot pay it anyway). Save v9 → v10.

- [x] 62. **Plant worker core + save v10.** New `WorkerJob` `plant` (same pool, wage, action clock as batch 8/9).
    One action = what the player's tap does on that tile: till an untilled tile, else plant the crop selected in
    "Crop to plant" on an empty tilled tile, using a seed from the pouch (auto-buy rules apply exactly as for the
    player: buys one seed when the pouch is empty and auto-buy is on and cash allows; else the worker idles, no wage).
    Copper dibber seed-keep applies. Acts only when there is an empty tile; picks tiles by the shared selection code
    so `workerTargets` (batch 9) covers it. Certificate 🥉10 + 💰300, visible after 60 plants. Save v10 per CLAUDE.md:
    FIRST commit `tests/fixtures/save-v9.json` from the current code; chain v1–v9 → v10 (plant assigned 0, no
    certificate). step(s, n) = n × step(s, 1) with all three farm workers on.
- [x] 63. **UI.** Plant row in the Workers card (certificate, −/count/+, ⓘ) in the same order as the tool rows:
    Plant / Water / Harvest, then the furnace jobs. Target ring + flash (🌱) on planted tiles. Stats: plants by
    workers. Away banner: plants by workers. Compact at 375 px.
- [x] 64. **Sim + balance.** With plant + water + harvest workers on pumpkin and lemon: cash/hour vs manual, and 8 h
    offline vs batch 8's +💰1,085 (the gap this batch closes). Pin: the full loop runs offline without going below 0
    cash, auto-buy off → workers idle when the pouch is empty, the certificate is reachable after the furnace
    loaders. Tune only batch-10 numbers; report every change as a deviation.

## Batch 10 results

### Plant worker core + save v10 (task 62)
- **Fixture first:** `tests/fixtures/save-v9.json` (own commit) is the real v8 fixture loaded by the batch-9 code and
  played with its real actions: 10 coal sold, tray collected, ore certificate bought, a 4th hire put on ore, fire cap
  Lv1, coal added, then 46 ticks of taps (lemons), digs and steps. It saves mid-smelt (fire 554, ore 2, progress 43)
  with 100 plants, so the plant certificate is already visible in it.
- **Job:** `WORKER_JOBS = plant, water, harvest, ore, fuel` (farm-loop order; also the round's action order and the
  Workers card's row order). Same pool, wage (💰1 at the action) and 5-tick clock. One action = the player's tap on an
  empty tile with no energy: `till(s, i, 0)` on an untilled tile, else `plant(s, i, run.plantCrop, 0)`, so the pouch,
  auto-buy and the copper dibber's seed-keep roll are the player's own code (`till` / `plant` take the same `energy`
  argument `water` / `harvest` already had). Tiles: the plant tool's targets (tilled, tile order), then the untilled
  ones; when the first cannot be planted (no seed and auto-buy off, or no cash for the seed) the planter idles unpaid
  and does not till ahead.
- **Never below 0:** `workRound` checked `cash ≥ wage` before the action only; an auto-bought seed could then leave less
  than the wage (cash 2, seed 2, wage 1 → −1). The shared rule is now "the wage must be left after the action"
  (`paidAction`), for every job (water / harvest / loaders never lower cash, so nothing else changes); `workerUnpaid`
  uses it too, and also flags a planter that cannot buy the seed at all (NO_CASH), so any planter short of seed + wage
  shows "unpaid"; no seed with auto-buy off is plain idle.
- **Certificate:** 🥉10 + 💰300, visible / buyable at 60 plants (`counters.plants`). **Lifetime:** `workerPlants` (plants
  only, a worker's till does not count) for Stats and the away banner.
- **workerTargets** covers the planter (one rule: `workRound`); the planter acts first, so a seed planted on dry soil is
  the driest due tile and is watered in the same round.
- **Save v10:** `run.plantCrop` (see Deviations), `workers.assigned.plant` 0, `lifetime.workerPlants` 0. `RunV9` is frozen
  in `serialize.ts`; v1…v9 chain to v10 and the raw old save is kept under `tiles.save.backup.v<n>` (v9 added to the
  backup test). Tested: the v9 fixture's whole migrated run, its smelt finishing after the load, the certificate visible
  but not owned; plant / till / auto-buy / no seed / seed + wage − 1 / full farm / copper dibber = player roll / target
  order; step(s, 900) = 900 × step(s, 1) with plant + water + harvest on, and 8 h from that state never below 0.

### UI (task 63)
- **👷 Workers card:** rows in `WORKER_JOBS` order, **🌱 Plant / 💧 Water / 🌾 Harvest / 🔶 Ore / ⚫ Fuel**, through the
  shared `JobRow`: certificate "🥉10 💰300" with "plants n/60" while locked, then −/n/+, "unpaid", ⓘ (`WORKER_TIPS.plant`,
  no numbers). A planter on untilled soil with cash 0 shows "unpaid" (tested).
- **Grid:** `.cell-target-plant` = the same 2 px dashed ring in green `#2e7d32` (on the tan untilled / tilled tiles a
  planter targets); the flash pops `WORKER_JOB_EMOJI.plant` = `PLANT_EMOJI` 🌱 (Unicode 6.0, one constant in
  `useGame.ts` next to `FIRE_EMOJI`, used by the row label, the pop and the banner).
- **📊 Stats:** Lifetime "Plants by workers" after "Wages paid" (`lifetime.workerPlants`). **Away banner:** "· 🌱 N planted"
  right after the catch-up summary, only when non-zero (diff of `workerPlants` before vs after).
- **Layout, computed from `app.css`, not measured** (14 px ≈ 7 px/char, 12 px ≈ 6.5, 13 px buttons ≈ 6.5, emoji ≈ 18).
  Workers rows sit in the Farm tab (content **284 px** at 1024, **358** at 1440) or below the grid at 375 (**359**).
  - Certificate row: label span = max("🌱 Plant" ≈ 57, "plants 59/60" ≈ 78) = 78 + button ("Certificate" ≈ 72 or
    "🥉10 💰300" ≈ 71, + 16 padding + 2 border ≈ 90) + ⓘ 28 + 2 gaps of 4 ≈ **204 px**: one line at all three widths.
  - Staffed row: 57 + − 44 + n 16 + + 44 + "unpaid" 51 + ⓘ 28 + 5 × 4 ≈ **260 px** ≤ 284 / 358 / 359 (the "🌾 Harvest"
    row, label ≈ 74, stays the widest row as before). `.worker-row` wraps, so nothing can overflow into a neighbour.
  - The open card grows by one 44 px row + 4 px gap; closed it is the same 44 px summary (summary text unchanged).
  - Ring and pop take no layout (outline + absolute pop, task 60), so tiles and the grid do not move at any width.
  - Banner: the text span wraps inside the flex banner, ✕ stays right; one more part only lengthens the wrapped text.

### Sim (task 64, `tests/sim.test.ts` "batch 10", measured)
No `balance.ts` number changed: the starting certificate (🥉10 + 💰300 after 60 plants) passes every check. Save stays v10.
- **Cash per hour, one crop on 9 tiles, 1 h** (`runCropBot`, net cash incl. standing crops, from tick 0; "all" = 1 plant
  + 1 water + 1 harvest worker and the player does nothing on the farm; the bot leaves a staffed job to its worker):

  | Crop | manual | water + harvest | all three | share | wages | all three + copper can/sickle/dibber | wages |
  |---|---|---|---|---|---|---|---|
  | pumpkin | 6707 | 5842 | **5636** | **84.0 %** | 855 | **6755** (100.7 %) | 536 |
  | lemon | 8048 | 7262 | **7088** | **88.1 %** | 765 | **8615** (107.0 %) | 448 |

  Player energy on the farm with all three: **0** (manual 810 / 720). Asserted: all three ≥ 80 % of manual, above manual
  with the three copper tools; cash never below 0. The planter's 135 / 90 plants an hour cost 💰140 / 95 more wages than
  water + harvest alone (one wage per till or plant), for −3.5 % / −2.4 % cash per hour and all the player's energy back.
- **8 h offline** (catch-up from the batch-8 workers ladder end, tick 3600, furnace loaded as in batch 8: cash 💰3452,
  9 tiles, empty pouch, auto-buy on; the plant certificate granted and one of the 3 waterers moved to plant, Crop to
  plant = 🍋 lemon, so water 2 / harvest 3 / plant 1):

  | Setup | cash gain | wages | plants by workers |
  |---|---|---|---|
  | batch 8 (no planter) | **+💰1,085** (unchanged, asserted) | 15 | 0 |
  | 1 planter | **+💰69,849** | 3,551 | **711** (= 711 harvests) |
  | 1 planter, auto-buy off, empty pouch | +💰1,085 | 15 | 0 |

  The full loop runs all 8 h (lowest cash 💰3451, never below 0, stepped one tick at a time). With auto-buy off the
  planter idles: cash and wages equal the same run with that worker unassigned (asserted).
- **Ladder** (`runBot(…, { furnace: true, planter: true })` = the batch-9 furnace ladder + the plant certificate after
  the smart furnace; once certified the planter gets one worker (taken from the bigger farm job when none is free) and
  "Crop to plant" follows the best licensed crop), 7200 ticks, pinned: every batch-9 tick unchanged (ore certificate
  2550, fuel 3141, smart 3741), **plant certificate 4341** (≈ 72 min, 600 ticks after smart). At 2 h: cash 💰13 694,
  wages 💰999, 72 plants by the worker, staff plant 1 / water 2 / harvest 1 / ore 1 / fuel 1, cash never below 0, no loan.
- **Prices fit storage:** the plant certificate (🥉10) joins the table: ≤ 40 items (storage Lv2).
- **Unchanged pins:** batch 3–9 sims all replay; 447 tests.
- **Reading:** the planter closes the offline gap completely: 8 h away now earns ≈ 💰8.7k an hour, about the hand-farmed
  lemon rate (💰8,048/h), instead of one harvest round. Nothing in the rules discounts offline time beyond the 8 h cap,
  so from here on offline income is active farm income; if that is too generous it needs a new rule (an offline rate),
  not a batch-10 number.

## Batch 11 — iron tier + mine worker (tasks 65–69)

Metal ladder step 2 (copper → iron → gold). Save v10 → v11. Iron farm tools are NOT in this batch.

- [x] 65. **Iron items + vein Lv3 + save v11.** Items iron ore and iron bar (emoji Unicode ≤ 11, from the shared
    `ITEMS` constants; list your choice). Vein Lv3 drops ~55 % stone / 20 % coal / 15 % copper ore / 10 % iron ore;
    iron rock = 4 hits and needs a copper pickaxe or better (wooden or by hand: it breaks as stone). Price fits the
    storage the player has then (assert in the sim): e.g. 40 stone + 🥉5 + 💰400. Save v11: FIRST commit
    `tests/fixtures/save-v10.json` from the current code; chain v1–v10 → v11 (iron items 0, furnace ore kind copper,
    mine worker 0).
- [x] 66. **Iron smelting + iron pickaxe.** The furnace's ore slot holds one ore kind; the player picks copper or
    iron (switching only when the slot is empty). Iron cycle = 2 iron ore + 4 fire units (120 ticks) → 1 iron bar ×
    batch level. The ore loader loads the selected kind. Iron pickaxe: 5 iron bars + 💰200, durability 1200, 4 hits,
    repair 2 iron bars. **Durability rule kept:** each tier's base durability must beat the previous tier's Lv10
    lifetime (copper Lv10 = 200 × (1 + 0.4 × 10) = 1000), so iron is 1200 instead of the old 500 guess — the existing
    balance test must pass unchanged. Iron mastery thresholds follow the existing tier factor.
- [x] 67. **Mine worker.** New `WorkerJob` `mine`: one action = one press of the player's Mine button (uses the
    active pickaxe's durability and preserve chance, gives mastery xp like a press, no energy). Idles when storage
    is full or the pickaxe is blunt — repair stays manual. Certificate 5 iron bars + 💰500, visible once vein Lv3 is
    owned and after 200 mines. step(s, n) = n × step(s, 1) with the mine and furnace workers on together.
- [x] 68. **UI.** Vein Lv3 row, ore-kind picker on the furnace, iron pickaxe craft/repair, mine row in the Workers
    card (below the furnace jobs), worker flash on the Mine button / rock when the mine worker acts. Stats: iron
    ore/bars, mines by workers. Compact at 375 px; no 7th tab.
- [x] 69. **Sim + balance.** Time to vein Lv3, first iron bar, iron pickaxe and the mine worker; bars/hour with mine +
    ore + fuel workers on a plain vs smart furnace; 8 h offline with the whole chain (storage full is the expected
    stop); every iron price ≤ what the player can hold; mining cash/energy still ≤ the farm cap; all older pins pass.
    Tune only batch-11 numbers; report every change as a deviation.

## Batch 11 results

### Iron items + vein Lv3 + save v11 (task 65)
- **Fixture first:** `tests/fixtures/save-v10.json` (own commit) is the real v9 fixture loaded by the batch-10 code and
  played 765 ticks with its real actions: lemons tapped, copper mined (ore loader on, coal filled), stone sold when full,
  the plant certificate bought, a 5th hire put on plant, Crop to plant = 🎃 pumpkin. It saves mid-smelt (fire 569, ore
  10, progress 3) with 7 plants by workers.
- **Items:** `ironOre` **🔷** (Iron ore, Unicode 6.0) and `ironBar` **🥈** (Iron bar, Unicode 9.0) in `ITEMS`, after the
  copper pair (the medal ladder 🥉 → 🥈 → 🥇 for gold later). Iron ore sells 💰1 (ore ≤ 1); iron bars never sell.
  `ORE_IDS = copperOre, ironOre` / `OreId` (data/items.ts) for the furnace's ore kind.
- **Vein Lv3:** 40 stone + 🥉5 + 💰400 (45 items ≤ storage Lv3's 50: each vein level comes after the same storage level,
  asserted in mining.test and in the sim's prices-fit-storage table) → 55 % stone / 20 % coal / 15 % copper ore / 10 %
  iron ore. `veinMaxLevel()` = 3; the Mine panel's teaser now reads "🔒 Lv4: gold ore — coming".
- **Iron rock:** 4 hits (`rockHits`), needs a copper pickaxe or better (`rockPickaxe('ironOre')` = copper). With less
  (wooden, by hand, or a blunt copper pickaxe, which mines by hand) the rock is mined as a stone rock: stone's 2 hits,
  drops stone (`minedRock(rock, tier)` in mining.ts, used by `dig`). A copper pickaxe (3 hits) takes 2 actions.
- **Save v11:** `furnace.oreKind` (`createFurnace()` = `'copperOre'`). `RunV10` frozen in `serialize.ts`; v1…v10 chain to
  v11, backup key per version (v10 added to the backup test). Iron items are absent (= 0) from migrated bags.

### Iron smelting + iron pickaxe (task 66)
- **Numbers (`balance.ts`):** per ore kind, `barTicks(ore)` copper 60 / iron 120 (4 fire units) and `oreBar(ore)`
  copperBar / ironBar; `smeltOre()` = 2 for both; `smeltFuel(fuel, ore)` iron = 2 coal or 4 wood. `barTicks` and
  `smeltFuel` default to copper, so the copper UI lines and sims read as before.
- **Rules (`furnace.ts`):** `setOreKind(state, 'copperOre' | 'ironOre')`, free, order NO_FURNACE, NOTHING_TO_DO (already
  that kind), NOT_EMPTY (ore in the slot or bars in the tray; see Deviations). `loadOre`, the ore loader and the cycle
  use `furnace.oreKind`; a cycle makes batch bars of its bar for its ticks. `collectBars` puts the tray into that bar;
  copper bars count in `counters.bars` (the loaders' gate) and `lifetime.bars`, iron bars in `lifetime.ironBars` only.
  Smelted: `lifetime.barsSmelted` (copper) / `lifetime.ironBarsSmelted` (iron). New error `NOT_EMPTY` ("Empty the ore slot
  and tray first").
- **Iron pickaxe:** `PICKAXE_TIERS = wooden, copper, iron`; 5 iron bars + 💰200, durability 1200, 4 hits per action
  (breaks any rock in one), repair 2 iron bars; mastery thresholds × 4 of wooden (the existing ×2 per tier). The balance
  test (each tier's durability > the previous Lv10 lifetime: 1200 > 1000) passes unchanged.
- **Save v11 (amended, as batch 9 did in task 58):** lifetime `ironBars` and `ironBarsSmelted` start at 0.
- Tested: iron cycle (119 / 120 ticks, batch 3), loading only the selected kind, collecting iron bars without touching
  the copper counters, every setOreKind branch, step(s, n) = n × step(s, 1) on iron plain / smart / top levels, the ore
  loader on iron, iron pickaxe craft / repair / one-action iron rock / thresholds.

### Mine worker (task 67)
- **Job:** `WORKER_JOBS = plant, water, harvest, ore, fuel, mine` (mine last: the round's action order and the Workers
  card's rows, below the furnace jobs). Same pool, wage (💰1 at the action) and 5-tick clock. One action = `dig(s, 0)`:
  the player's Mine press with no energy (`dig` takes the same `energy` argument `till` / `plant` got in batch 10), so the
  active pickaxe's hits, durability, preserve roll, mastery xp, the iron-rock rule and `counters.mines` are the player's
  own code. No pickaxe or a blunt one = idle (repair stays manual); a failed press (storage full, no license) = idle; all
  unpaid, never "unpaid" badge.
- **Certificate:** 🥈5 + 💰500 (iron bars), visible / buyable at 200 mines **and** vein Lv3 owned
  (`certificateUnlock(job)` now returns `{ counter, at, vein? }`; `certificateUnlocked` checks both). **Lifetime:**
  `workerMines` (mine presses by workers) for Stats and the away banner.
- **Save v11 (amended):** `workers.assigned.mine` 0, `lifetime.workerMines` 0. The v10 fixture test asserts the whole
  migrated run (682 mines but vein Lv2, so the mine certificate stays hidden).
- Tested: certificate gates (vein Lv2 with 5000 mines locked, 199 mines locked, items before cash), one press = the
  player's press minus energy (hits, durability, mastery, PRNG), two miners, every idle case, step(s, 900) = 900 ×
  step(s, 1) with mine + ore + fuel workers on an iron furnace (mined iron ore loaded, iron bars smelted and collected,
  the miner stops when storage fills).

### UI (task 68)
- **⛏️ Mine panel, vein Lv3 row:** the generic next-level line reads "Lv3: ⛰️ Stone 55 % · ⚫ Coal 20 % · 🔶 Copper ore 15 % ·
  🔷 Iron ore 10 % — ⛰️40 🥉5 💰400". When a vein price holds more items than storage, the Upgrade button's reason is
  "Needs 📦 45 storage" instead of a never-ending "Not enough items" (any level; Lv1's 25 stone vs the starting 20 slots
  too). While the pickaxe in hand is weaker than a rock of this or the next level needs, a 12 px line says "🔷 Iron ore
  needs a copper pickaxe or better, else it is mined as ⛰️ stone"; the Dig button shows such a rock as "🔷 as ⛰️ 0/2"
  (`minedRock`, stone's hits), and an iron rock with a copper pickaxe as "🔷 0/4".
- **🔥 Furnace:** from vein Lv3 (or once iron is picked) an "Ore to smelt" group of two buttons, **🔶 Copper ore / 🔷 Iron
  ore**, in the furnace action grid: the picked kind is `aria-pressed` + disabled with "smelting", the other "switch",
  or disabled with "empty first" (`NOT_EMPTY`, short form in `SMELT_SHORT`). The ore line, cycle bar (120 s for iron),
  recipe line ("🔷2 + ⚫2 or 🌲4 → 🥈1 · 120 s"), "ore n" stock, Load button and Collect emoji follow `furnace.oreKind`;
  the summary line is unchanged. `ERROR_TEXT.NO_ORE` = "No ore of the picked kind in storage".
- **Pickaxes:** one craft button for the tier above the one in hand: copper once the furnace is built, **iron (🥈5 💰200)
  once the vein drops iron**; repair was already per tier ("Blunt iron pickaxe — repair (🥈2)").
- **👷 Workers:** the ⛏️ Mine row (last, below Ore / Fuel) lists only the gates still missing, one 12 px line each:
  "mines n/200" and / or "vein Lv3"; certificate "🥈5 💰500".
- **Miner flash:** `useGame` steps once, and when a live step of ≤ 5 ticks crosses the worker tick and
  `lifetime.workerMines` grew, `minerActed` is true for that tick: the Dig button gets `.mine-flash` (0.5 s amber inset
  wash, as the white button would not show the tiles' white one) and the `.cell-pop` ⛏️ in its top-right corner
  (`.mine-dig` is now `position: relative`). Reduced motion: no wash, still pop. Off on the next tick and after a catch-up.
- **📊 Stats:** "Iron bars smelted" and "Iron bars collected" after "Copper bars smelted"; "Mines by workers" after
  "Plants by workers". **Away banner:** "· ⛏️ N mined" after the planted part and "· 🥈 N smelted" after the copper one,
  each only when non-zero.
- **Layout, computed from `app.css`, not measured** (13 px ≈ 6.5 px/char, 14 px ≈ 7, 12 px ≈ 6.5, emoji ≈ 17). Mine column
  **209.3 / 300.8 / 343 px** at 1024 / 1440 / 375; Farm-tab / below-grid Workers **284 / 358 / 359 px**.
  - Ore picker: `repeat(auto-fit, minmax(96px, 1fr))` with 2 items: **2 × 101.6** at 1024, and since auto-fit collapses
    the empty track, **2 × 147.4** at 1440 and **2 × 168.5** at 375. Text room at 1024 = 91.6: "🔶 Copper ore" ≈ 88.5,
    "🔷 Iron ore" ≈ 75.5, second lines ≤ "empty first" ≈ 72: one line each, the 44 px min height. Grid cells cannot
    overlap; the open card grows by 44 + 4 px.
  - Dig line worst case "⚡1 → 1 hit · 🔷 as ⛰️ cracked 1/2" ≈ 233: two lines at 1024 (content 195), one at 1440 / 375;
    the button grows, the column scrolls. Second line's top: 23 px (one line, 32 px of content centred in 44) or 19 px
    (wrapped, 51 px button). The tile pop (18 px at top 4 / right 6) would reach 22–24 px and, at 1024, cover the end
    of "… cracked" (its first row ends ≈ 20 px from the right edge), so on the button it is **14 px at top 2 / right 2**
    (`.mine-dig > .cell-pop`): 3–17 px down, 16.8 px at the 1.2 start scale (1.6–18.4), above 19 at every width; the
    centred "⛏️ Dig" ≈ 45 px spans 82–127 of 209, far from the 3–17 px right corner.
  - Pickaxe hint ≈ 489 px of 12 px text in a block span: 3 lines at 1024, 2 at 1440 and 375; it pushes the column down.
  - Mine row, locked, worst case: label span = max("⛏️ Mine" ≈ 49, "mines 199/200" ≈ 85) + certificate button (max
    "Certificate" ≈ 77, "🥈5 💰500" ≈ 67) + 16 + 2 ≈ 95 + ⓘ 28 + 2 gaps of 4 ≈ **216 px** ≤ 284 / 358 / 359 (the two gates
    on one line would be ≈ 287, past 284, hence one line each); the label column is 3 lines ≈ 47 px tall, so that row is
    3 px over the 44 px row height. Staffed row = the Fuel row's width (label ≈ 49 ≤ 52).
  - Flash wash and pop take no layout (box-shadow, absolute); banner and Stats rows only lengthen wrapping text.

### Sim (task 69, `tests/sim.test.ts` "batch 11", measured)
No `balance.ts` number changed: the task 65–67 numbers pass every check. Save stays v11.
- **Ladder** (`runBot(…, { iron: true })` = the batch-10 plant ladder + storage Lv3 → vein Lv3 → iron pickaxe → mine
  certificate; while an iron goal is next and the furnace is on copper the bot sells the copper ore in storage before
  each tick, collects the tray and picks iron once the slot and tray are empty; the certified miner gets one worker,
  taken from the bigger farm job), 7200 ticks, pinned: every batch-10 tick unchanged (plant certificate 4341), then
  **storage Lv3 4389, vein Lv3 4641 (≈ 77 min), iron picked 4938, first iron bar 5060 (≈ 84 min), iron pickaxe 5541
  (≈ 92 min), mine certificate 6141 (≈ 102 min)**. At 2 h: cash 💰12 550, wages 💰1 189, 18 iron bars smelted, 205 mine
  presses by the worker, staff plant 1 / water 1 / harvest 1 / ore 1 / fuel 1 / mine 1, cash never below 0, no loan.
- **Iron bars per hour with mine + ore + fuel workers** (`ironBench`: vein Lv3, storage Lv3 = 50, fresh iron pickaxe,
  furnace on iron at base levels, cash 💰1000; the player only sells stone, copper ore and coal above 10 every N s):

  | Setup | iron bars/h | miner presses | wages/h | fire wasted | cash/h |
  |---|---|---|---|---|---|
  | plain, sells @ 120 s | **28** | 679 | 801 | 4 units | +278 |
  | smart, sells @ 120 s | **28** | 679 | 799 | 0 | +288 |
  | plain, sells @ 600 s | **15** | 329 | 418 | 60 units | −55 |
  | smart, sells @ 600 s | **11** | 269 | 315 | 0 | +48 |
  | miner only (sells all @ 120 s) | 0 | 720 | 720 | 0 | **+771** |

  30/h is the iron ceiling (one bar per 120 s at batch Lv0); a 2-minute seller gets 28 (the first iron ore takes a while).
  A 10-minute seller lets storage fill, so the miner (and with it the ore) stalls half the time. Smart gives *fewer*
  bars than plain there: the coal it does not burn stays in storage and fills it sooner, so the miner stalls more.
- **8 h offline** (catch-up one tick at a time from the 2 h ladder end; the player sells stone and copper ore before
  leaving, storage 17/50 with 8 iron bars, 5 copper bars, 3 coal, 1 iron ore): **the miner stops at tick 981 (≈ 16 min)
  with storage full** (20 stone, 12 copper ore, 12 iron bars, 5 copper bars, 1 coal), pickaxe 878/1200, after 54 presses
  and 9 iron bars. The farm workers keep running all 8 h: +💰69 387, wages 💰3 633, 711 plants; cash never below 0;
  step(start, 28 800) equals the 28 800 single steps.
- **Prices fit storage:** vein Lv3 (45 items) ≤ storage Lv3 (50); storage Lv3 (25 stone) ≤ storage Lv2 (40); iron
  pickaxe (🥈5), its repair (🥈2) and the mine certificate (🥈5) ≤ 50.
- **Mining below the farm cap** (`mineBench`, vein Lv3, repairs at input value, iron bars at 2 iron ore + 2 coal): cash per
  energy wooden Lv10 **1.89**, copper Lv10 **1.92**, iron Lv0 **2.08**, iron Lv10 **2.09**, all < 0.9 × pumpkin (8.175).
  The miner nets **💰771/h** (sales − wages) vs the three pumpkin farm workers' **💰5 636/h**.
- **Unchanged pins:** batch 3–10 sims all replay; 486 tests.
- **Reading:** after the plant certificate the first iron bar comes ≈ 12 min later, the iron pickaxe ≈ 20 and the mine
  certificate ≈ 30 (10 min after the pickaxe), all inside 2 h. The mine → furnace chain runs at its 28–30 bars/h only while someone empties storage: alone
  it fills 50 slots in ≈ 16 min, because stone, copper ore and the unsellable bars pile up. That is the stop the plan
  expects; a sell worker or an auto-sell rule would be the next lever, not a batch-11 number.

## Batch 11.1 — feedback form + safer reset (tasks 70–71, UI only, no save bump)

Toon: a way for players to send feedback / ideas that reaches his mail and is kept; put it on the 📊 Stats tab and
move Reset there with a confirm. Transport = his Google Form (responses kept in Forms/Sheets; mail via an Apps Script
on the form that Toon installs — not part of this repo).

- [x] 70. **💬 Feedback card at the end of 📊 Stats.** Fields: kind (Feedback / Idea / Bug report — segmented buttons,
    default Feedback), short title (required, ≤ 80 chars, counter), details (required textarea, ≤ 2000 chars),
    contact (optional, "name or email if you want a reply"). Hidden honeypot input (`website`, off-screen, not
    `display:none`, `tabindex=-1`, `autocomplete=off`): if filled, pretend success and send nothing. Send button
    disabled until both required fields are non-blank; one send per 30 s (UI clock, `src/app/`).
    - Transport (all constants in `src/app/feedback.ts`, no secrets exist): `fetch(FORM_URL, { method: 'POST', mode:
      'no-cors', body: new URLSearchParams(...) })` with FORM_URL = `https://docs.google.com/forms/d/e/1FAIpQLSd_rX4oEt82dSuZcnVBX1sB-Yp_VP9WgQeiMpGKtR6GUwfTBQ/formResponse` and fields
      `entry.247767374` = kind (exact strings `Feedback`, `Idea`, `Bug report`), `entry.544014453` = title,
      `entry.1552861218` = details + a context block, `entry.767920014` = contact (may be empty).
    - Context block appended to details, plain text, one item per line, after a `---` line:
      `Build: <short git hash>` (inject at build time with Vite `define` from `git rev-parse --short HEAD`, falling
      back to `GITHUB_SHA` in CI and `dev`), `Save: v<N>`, `Screen: <w>×<h> @<dpr>`, `UA: <navigator.userAgent>`,
      `Time: <ISO>`, and a one-line game summary built by a pure core selector `feedbackSummary(state)` (cash,
      licensed crops, tool levels, workers per job, vein level, furnace smart/levels, play time) — never the raw save.
    - The response is opaque (no-cors): resolve = "Sent — thank you" and clear the fields; a network error = keep the
      text, show "Could not send — check your connection" with Retry. Draft text survives a tab switch (React state
      lifted to the Stats tab is fine; not saved).
    - Tests: the field mapping + context block (pure function `buildFeedbackBody`), honeypot, cooldown, blank
      required fields, error path (mock fetch). No real network in tests.
- [x] 71. **Reset moves under Feedback, with an in-game confirm.** Remove the Farm-panel "Reset save" link and
    `window.confirm`. In 📊 Stats, a "Danger zone" row below Feedback: first press turns the button into a red
    "Press again to erase everything" for 5 s (then reverts); the second press copies the current save to
    `tiles.save.backup.reset` (overwrite) and resets as before. Keyboard: Esc cancels the armed state. Tests for
    arm → revert after 5 s, arm → confirm, backup written.
    Layout: both cards compact at 375 px (Stats tab under the mobile tab bar) and inside the desktop panel at 1024 /
    1440; textarea `resize: vertical`, max-width 100 %; no overlap with neighbours; no 7th tab.

## Batch 11.1 results

UI only: no save bump (`SAVE_VERSION` 11), no `balance.ts` change, iron dev-gate unchanged.

### 💬 Feedback card (task 70)

- `src/app/feedback.ts`: form URL and entry ids, `FEEDBACK_KINDS` (`Feedback` / `Idea` / `Bug report`), `TITLE_MAX` 80,
  `DETAILS_MAX` 2000, `COOLDOWN_MS` 30 000, pure `buildFeedbackBody(draft, context)`, `canSend`, `cooldownLeft`,
  `sendFeedback(draft, context, post = fetch)` → `'sent' | 'failed'` (no throw; a filled honeypot → `'sent'`, no fetch).
- `src/app/FeedbackCard.tsx`: segmented kind buttons (`aria-pressed`), title / details with `n/max` counters, optional
  contact, off-screen `website` honeypot (`tabIndex -1`, `autoComplete off`, `aria-hidden`), Send disabled until both
  required fields are non-blank and during the cooldown ("Send (wait N s)"); "Sent — thank you" clears the fields; a
  network error keeps them, says "Could not send — check your connection" and the button reads Retry.
- Context block after `---`: `Build` (Vite `define __BUILD__` from `git rev-parse --short HEAD`, else `GITHUB_SHA`,
  else `dev`), `Save: v11`, `Screen: w×h @dpr`, `UA`, `Time` (ISO), `Game: feedbackSummary(state, ironHidden(vein))`.
  `feedbackSummary` (core, `stats.ts`): cash, licenses, tool level + tier per job, pickaxe, workers per job, vein level,
  furnace plain/smart + levels, play time. Gated: no "iron", no mine worker (tested).
- The 📊 Stats tab is `StatsTab` = `Stats` + `FeedbackCard` + `DangerZone`; the draft survives a tab switch (App test).

### Reset in 📊 Stats (task 71)

- The Farm-view and side-panel "Reset save" links and `window.confirm` are gone (and their `.reset-farm` /
  `.reset-panel` CSS). `src/app/DangerZone.tsx`: first press → red "Press again to erase everything" for `ARM_MS`
  5000, then back; second press resets; Esc disarms (timer and keydown listener keyed on the armed state).
- `useGame.reset` first writes the live run to `tiles.save.backup.reset` (`RESET_BACKUP_KEY`, `storage.ts`), overwriting.
- Tests: arm → revert at 5 s, arm → confirm, Esc (DangerZone.test); App: Reset only in Stats, backup holds the old
  run (cash 777) and `tiles.save` the fresh one, no `window.confirm`.

### Layout (computed from `app.css`, no browser)

- Panel content width: **375 px** 343 (app 8 + panel 8 padding each side); **768–1023** slide-over 364 (380 − 16);
  **1024** 284 (panel column clamp floor 300 − 16); **1440** 358 (26vw = 374 − 16).
- Kind buttons: 3 × `minmax(0, 1fr)`, gap 6 → 110 / 91 / 115 px at 375 / 1024 / 1440; "Bug report" at 14 px is
  ≈ 78 px with padding and border, so it fits on one line at 1024 (`nowrap`). Inputs and textarea `width: 100%`
  (border-box), textarea `resize: vertical`, 16 px text (no iOS focus zoom).
- Stacking: Stats rows → 💬 Feedback (margin-top 12) → Danger zone (margin-top 24, top rule), one flex column, so
  nothing overlaps; the honeypot is absolutely positioned at left −10 000 px (negative overflow does not scroll).
  At 375 the `.app` bottom padding (tab bar 56 + 16) keeps the Danger zone above the fixed tab bar; at ≥ 1024 the
  panel scrolls on its own (`overflow-y: auto`). Armed, the button stretches to the content width (343 / 284 / 358).
  No new tab.

## Batch 12 — crop market, milestone timeline + save export, deed meter (tasks 72–75)

Why (Toon, 2026-11-08): real players idle with two workers and one already holds 💰1M+; more automation would only
inflate cash further. Economy first: a market that answers oversupply, a timeline so players' pasted saves show
where pacing is slow, and a deed meter that turns a big pile into a score. Save v11 → v12. Numbers from
docs/research/fields-market.md, pacing-liveops.md, prestige.md (copied in this batch's docs commit).
Task numbers assume 11.1 = 70–71 and the iron gate (11.2) took no number; renumber only if PLAN.md says otherwise.

- [x] 72. **Market core + milestones + save v12.** FIRST commit `tests/fixtures/save-v11.json`, a realistic save
    made by the current code (licenses, workers staffed, iron unlocked through the core even though the UI hides
    it, furnace mid-cycle).
    - `run.market: Record<CropId, number>` = glut per crop (units, float ≥ 0). Every crop unit sold by any path
      (player tap, tool press, worker harvest, double harvest) is priced at the glut BEFORE that unit's sale is
      added, then adds 1. Selling n units in one action = price each unit in sequence (or the exact closed sum);
      a test pins that selling 2 at once = selling 1 then 1.
    - Decay once per tick inside `step`: `glut ×= MARKET_DECAY` where `MARKET_DECAY = 0.5 ** (1 / MARKET_HALF_LIFE_TICKS)`,
      `MARKET_HALF_LIFE_TICKS = 1800`; snap below the existing residue epsilon to 0.
    - `marketFactor(crop, glut) = max(MARKET_FLOOR, 1 − 0.5 × glut / marketDepthGlut(crop))`, `MARKET_FLOOR = 0.5`,
      `marketDepthGlut(crop) = MARKET_DEPTH_TILES / (CROP_BASE[crop].growTicks × (1 − MARKET_DECAY))`,
      `MARKET_DEPTH_TILES = 120` (the steady-state glut of a 120-tile farm of that crop; base grow ticks, so
      fertilizer speeds harvests and therefore glut — intended). Crop sale price =
      `Math.round(cropSellPrice(...) × marketFactor)`; items (stone, coal, ore) are NOT in the market.
    - `marketRecoveryTicks(crop, glut)` = ticks until the factor is back ≥ 0.99 with no more sales (closed form via
      log; UI uses it for "recovers in ~N min").
    - `run.milestones: Partial<Record<MilestoneId, number>>` (tick reached). Milestones are a table of
      predicates over state in `src/core/data/milestones.ts`; one pure `recordMilestones(prev, next)` runs after
      every action and at the end of every `step` tick batch, writing the tick only when absent and the predicate
      just became true. Set: firstHarvest, sales25, each crop license, each farm tool level, each copper/iron farm
      tool tier, each certificate, hire2/hire4/hire6, mineLicense, vein1/2/3, furnace, firstBar, copper/iron
      pickaxe, tiles12/16/20/24, cash1k/10k/100k/1M (lifetime cashEarned), and `trackingStarted` (written by the
      migration with the save's current tick). A milestone already true at migration time is NOT back-dated: it stays
      absent and the timeline says "before tracking".
    - `meta.upgrades: Record<MetaUpgradeId, number>` (levels, all 0) replaces the stored `meta.multipliers`;
      `multiplier(meta, key)` derives from levels through a balance.ts table (all 1 at level 0). Migration: if every
      stored multiplier is 1 (always true today) drop it; if any is not 1, keep it as `meta.legacyMultipliers` and
      multiply it in (never take value away) and add a test for that branch.
    - Save v12: chain v1–v11 → v12 with the backup key: market all 0, milestones `{ trackingStarted: tick }`,
      meta.upgrades all 0. step(s, n) = n × step(s, 1) with market decay and milestones (test with workers on).
- [x] 73. **Market UI.** Wherever a crop's price shows (Shop seed rows, Crop to plant, ⓘ tips, harvest toast) show
    the current price and factor: `🍋 💰99 (90 %)` with ▼ when < 100 %, plus "recovers in ~N min" in the ⓘ tip, and a
    thin 3-colour depth bar per crop (green ≥ 85 %, yellow ≥ 65 %, red below) on the Shop crop rows. The harvest toast
    shows the real cash received. The away banner shows "market: lemon 72 % → 95 %" for crops that moved > 5 points.
    Compact at 375 px; compute layout from CSS and check overlap with neighbours at 375 / 1024 / 1440 px.
- [x] 74. **📊 Stats: timeline, report, export/import, deed meter.**
    - "Timeline" list: one line per reached milestone, `Lemon license — 1h 12m` (play time from tick 0), ordered by
      tick; milestones reached before tracking show once as "… N earlier milestones before tracking".
    - "Copy report" button: copies ≤ 30 lines of plain text (build hash and save version as 11.1's feedback context
      uses, play time, cash, lifetime cash, tiles, workers per job, vein level, market factors, then the timeline).
      If 11.1's feedback form exists, append the same timeline to its context block (reuse one pure
      `reportLines(state)` in core; never the raw save).
    - "Export save": copies the raw `tiles.save` JSON as base64 to the clipboard (and shows it in a read-only
      textarea for phones). "Import save": paste box + the same two-press confirm 11.1 uses for reset; the current
      save is copied to `tiles.save.backup.import` first; the pasted save goes through the normal load + migration
      path; invalid input = an error line, nothing changes.
    - Deed meter row: `Lifetime cash 💰1,040,000 → 10 deeds when "Sell the farm" opens`, from
      `deedsFor(lifetimeCash) = floor(sqrt(lifetimeCash / DEED_DIVISOR))`, `DEED_DIVISOR = 10000` in balance.ts.
      Prestige itself is NOT in this batch; the row is a meter only.
    - Compact at 375 px; no 7th tab.
- [x] 75. **Sim + balance (`tests/sim.test.ts` "batch 12").**
    - Market pins: pure-function check of the steady-state factor for t tiles of one crop: 24 → 0.88–0.92,
      120 → 0.50; the 24-tile lemon farm with fertilizer Lv5 reported (expect ~0.80).
    - Income: the existing ladder bots re-run with the market on; report cash/hour before vs after for the 24-tile
      lemon farm (manual and with workers) and for the best 2-crop split the bot can find on 24 tiles.
    - Hierarchy: mining cash/energy must stay below farming cash/energy WITH the market on. If the pin fails, raise
      `MARKET_DEPTH_TILES` (up to 240) until it passes; never touch mining numbers. Report the value used.
    - No-stall pin: the ladder bot from tick 0 to its last unlock never waits more than 60 game-minutes between two
      consecutive milestones. If a pre-existing step fails it, do NOT retune old numbers: mark the test with the
      measured gap, list it under Deviations, and keep it passing at the measured value + 10 %.
    - Every price still ≤ the storage the player holds at that moment (existing pins pass unchanged).
    - Tune only batch-12 numbers; report every change as a deviation.

## Batch 12 results

### Market core + milestones + save v12 (task 72)

See commit a4a8799 (market, milestones, `meta.upgrades`, save v12) and bc63cb9 (`tests/fixtures/save-v11.json`).

### Market UI (task 73)

- `src/app/marketText.ts`: `priceTag(state, crop)` = `🍋 💰99 (90 % ▼)` (the price of the next unit, `marketCropPrice`
  at the current glut; ▼ while the rounded factor is below 100 %), `depthBand(factor)` (green ≥ 0.85, yellow ≥ 0.65,
  red below; display-only constants in `src/app/`), `marketTip` ("Sells for … now; … Recovers in ~N min if you stop
  selling." from `marketRecoveryTicks`, the recovery part only while glutted), `marketMoves(before, after)`.
- 🛒 Shop: every owned crop row gets the price tag under "seed 💰N" and a 3 px depth bar (grey track, coloured fill
  = factor × 100 %); every crop's ⓘ tip (owned or locked) ends with the market sentence. 🌾 Farm "Crop to plant"
  buttons show the price tag under "seeds N".
- Toasts: a tile tap already showed the real cash (`+💰N Carrot`, cash after − before); a Harvest tool press now
  adds it too (`Harvested 6/6 (+1 bonus) +💰540`). The away banner ends with `market: lemon 72 % → 95 %` for crops
  whose factor moved more than 5 points.
- **Layout (computed from `app.css`, no browser):** a Shop crop button's text box = cell − 2 × 30 px (the ⓘ
  padding) − 2 px border: **375** (343 − 6) / 2 − 62 = 106 px, **1024** (284 − 6) / 2 − 62 = 77 px, **1440**
  (358 − 6) / 2 − 62 = 114 px. The longest tag, `🍋 💰NNN (90 % ▼)` at 12 px, is ≈ 107 px: one line at 1440, at the
  edge at 375, two lines at 1024. It wraps inside the button (flex column), the button and its grid row grow, so
  nothing overlaps; the ⓘ (absolute, 28 px, top-right) sits in the 30 px right padding the text never enters. The
  depth bar is the button's last flex child (`align-self: stretch`), so it spans the text box below the tag. Crop to
  plant buttons (desktop panel only) have 6 px padding: 125 px at 1024, 160 px at 1440, one line. Banner and toast
  already wrap (`.banner` flex row with the ✕, toast `max-width: calc(100% − 32px)`).

### 📊 Stats: timeline, report, export/import, deed meter (task 74)

- Core (`stats.ts`): `timelineLines(run)` = `Lemon license — 1h 12m` per recorded milestone by tick (play time from
  tick 0, ties in table order), led by `… N earlier milestones before tracking (tracking since 2h 0m)` only on a
  migrated save (the only kind with `trackingStarted`); a new run's carrot license is not a milestone reached.
  `reportLines(state, header, hideIron)` = header (`Build`, `Save: v12`, passed in by the app: core knows neither) +
  played, cash, lifetime cash, tiles, workers per job (mine dropped while iron is gated), vein, market factor per crop,
  `Timeline:` + the timeline; capped at `REPORT_MAX_LINES` 30, the 30th line then reads `… N more`.
- The 💬 Feedback context block ends with `Timeline:` + the same `timelineLines` (nothing when empty).
- `storage.ts`: `exportSave(storage)` = base64 of the stored save's UTF-8 JSON; `importSave(storage, text)` →
  `{ ok } | { ok: false, error: 'BAD_SAVE' | 'STORAGE' }`: whitespace stripped, base64 + strict UTF-8 decode,
  `deserialize` (so a future version or a non-save is `BAD_SAVE`), then the current save is copied to
  `tiles.save.backup.import` (`IMPORT_BACKUP_KEY`, overwritten) and the pasted one written; nothing is written on an
  error. `useGame.importCode` first saves the live run (the stored one lags by ≤ 1 s), then runs the normal
  `loadGame` path (version backup, migration, offline catch-up from the export's time, welcome-back banner).
- UI (📊 Stats, in order): Lifetime / Now rows → **deed meter** `Lifetime cash 💰1,040,000 → 10 deeds when "Sell the
  farm" opens` (`deedsFor`, meter only) → **Timeline** (`<ol>`, or "No milestones yet …") + **Copy report** (status
  line; "Could not copy" when the clipboard refuses) → 💬 Feedback → **Save** (Export save: copies, says "Copied" or
  "Copy it from the box below", shows the code in a read-only textarea that selects on focus; Import save: paste box,
  button disabled while blank, the same two-press confirm as Reset — `useTwoPress`, now shared by `DangerZone` —
  red while armed; "That is not a tiles save — nothing changed" on a bad paste, the paste is kept) → Danger zone.
- **Layout (computed from `app.css`, no browser):** every new block is a normal-flow child of the panel's column at
  the content width (343 / 284 / 358 px at 375 / 1024 / 1440). The deed line (~60 chars at 14 px ≈ 420 px) wraps
  to two lines at all three widths; the timeline is an `<ol>` (13 px, line-height 1.4 ≈ 18 px a line, 20 px
  indent); the Save card reuses the Feedback card's column (gap 8, textareas `width: 100%`, 16 px text, `resize:
  vertical`), its buttons stretch to the content width. Nothing is positioned, so nothing overlaps; at 375 the
  `.app` bottom padding still keeps the last card (Danger zone) above the fixed tab bar. No new tab.

### Sim (task 75, `tests/sim.test.ts` "batch 12", measured)

No `balance.ts` number changed: `MARKET_DEPTH_TILES` stays **120**. "Before" = the same run with the market off
(test-only switch, see Deviations).
- **Steady state (pure, `marketSteadyFactor`, base grow time):** one crop on 24 tiles **0.900**, on 120 tiles **0.500**,
  every crop (the depth scales with grow time, so the factor depends on tile count only). 24 lemon tiles with
  fertilizer Lv5 (grow × 0.5): **0.800**.
- **Income, 24 tiles, 2 h, net cash per hour (runCropBot accounting):**

  | Farm | before | after | change |
  |---|---|---|---|
  | 24 lemon, by hand | 13 321 | 12 678 | −4.8 % |
  | 24 lemon, plant + water + harvest worker (1 each) | 9 507 | 9 093 | −4.4 % |
  | best 2-crop split: 4 pumpkin + 20 lemon, by hand | 12 355 | 11 980 | −3.0 % |
  | best one-crop farm (lemon), same bot | 13 321 | 12 678 | −4.8 % |

  The real loss is half the steady-state 10 %: a tile sells once per *real* cycle (grow + waits for water and the
  player), longer than the base grow time the depth assumes. The split search (6 pairs × 4/8/…/20 tiles) finds no
  split above lemon alone: lemon's lead per tile is bigger than the glut it adds.
- **Ladder (batch-11 iron ladder, 7200 ticks):** final cash **💰12 550 → 💰11 508** (−8.3 %, ≈ 💰6 275 → 💰5 754 per
  hour); mine certificate 6141 → 6117. Off, the run replays the batch-11 pins exactly (6141), so the market is the only
  change. Every older pin (batch 3–11, re-pinned once in task 72) passes unchanged, including every "price ≤ storage
  the player holds" check.
- **Hierarchy with the market on:** iron pickaxe Lv10 on vein Lv3 **2.09** cash/energy < 0.9 × 24-tile pumpkin by hand
  (**7.87** → cap 7.08). The batch-6/7/11 benches (9 tiles, market on) still pass. Depth 120 kept.
- **No stall:** the iron ladder bot records 30 milestones (core `recordMilestones`) from firstHarvest (tick 100) to the
  mine certificate (6117); the longest wait is **840 ticks (14 min), vein Lv3 → iron pickaxe**, well under 60 min.
- **step(s, n) = n × step(s, 1)** from the ladder end (glut > 0, workers on, milestones recording) over 600 ticks.
- **Reading:** the market takes ~5 % off a full one-crop farm and ~8 % off the ladder's 2 h cash: at depth 120 the
  glut bites only when many tiles of one crop sell close to the base grow time. If batch 13 wants splitting to pay, the lever is depth (lower `MARKET_DEPTH_TILES`) — the
  hierarchy pin has a ×3.4 margin to spend.

## Batch 13 — early-game pacing, hand-picked bonus, iron opens (tasks 76–78, no save bump)

Why (Toon 2026-11-08 field report + docs/research/pacing-liveops.md A1, A2, A4): workers arrive before the job's tool
ladder is finished, so manual → tool → worker is broken in the numbers, and once water + harvest are staffed the
player has nothing to do with their energy. Balance-only changes plus one rule; save shape unchanged (v12).

- [x] 76. **Certificates need the job's top farm tool; repriced.**
    - `CERTIFICATES` gains `tool?: number` = the job's TOOL_LEVELS level that must be owned (water/harvest/plant:
      3, i.e. the last level). `certificateUnlock` returns it; the buy check and every UI reason line read it
      ("needs 🚿 Water Cart (tool Lv3)"). The old counter gate stays alongside (both must hold).
    - Prices: water `{ stone: 20, cash: 500 }`, harvest `{ stone: 20, coal: 5, cash: 750 }`, plant unchanged
      (`{ copperBar: 10, cash: 300 }` + tool Lv3). `WORKER_HIRE_BASE = 150` (growth 1.7 unchanged).
    - Owned certificates and hired workers are never taken back (no migration; a test loads save-v11 and v12
      fixtures with certificates bought before their tool and checks they still work).
- [x] 77. **Hand-picked ×1.25 + iron gate lifted.**
    - A crop unit harvested by the player (tap or tool press — anything that spent energy) sells at
      `HAND_PICKED_BONUS = 1.25` × the market price; worker harvests ×1. Applied after the market factor; the glut
      added is the same 1 per unit. Toast/ⓘ tip show "✋ ×1.25" on player harvests; Harvest worker row tip says
      "workers sell at ×1".
    - Remove the `?dev=iron` UI gate from batch 11 (vein Lv3 row and every iron element visible to everyone). Keep
      the `tiles.dev` reader if anything else uses it; otherwise delete it with its test.
- [x] 78. **Sim + balance (`tests/sim.test.ts` "batch 13").**
    - Ladder bot from tick 0: report the minute each certificate becomes buyable and the minute it is bought
      (expect water ~16 min, harvest ~40 min; research model, 100 % uptime). Pin: no unlock step > 60 game-minutes.
    - Income with the market on: 24-tile lemon fully staffed — idle (workers harvest) vs attentive (player picks
      every ready tile with tools, 4 energy/min); report both and the hand-picked gain (expect ≈ +💰6,600/h on the
      gross).
    - Hierarchy pin with hand-picked on: max mining cash/energy < 0.9 × pumpkin farming cash/energy.
    - Every price ≤ storage held at that moment (existing pins pass unchanged).
    - Tune only batch-13 numbers; report each change as a deviation.

## Batch 13 results

### Tool-gated certificates + prices (task 76)

- `CERTIFICATES` rows carry `tool` (water / harvest / plant: 3). `certificateUnlock` returns it, and `certificateUnlocked`
  (the buy check, `LOCKED`) needs `run.tools[job] ≥ tool` as well as the counter (and vein) gate. Prices: water
  `{ stone: 20, cash: 500 }`, harvest `{ stone: 20, coal: 5, cash: 750 }`, plant unchanged. `WORKER_HIRE_BASE` 150:
  hires cost 150, 255, 433, 737, 1253, 2130.
- 👷 Workers card: a locked farm row lists each missing gate on its own line: `waters 12/40`, `needs 💧 Water Cart (tool
  Lv3)` (`needs 🌾 Reaper …`, `needs 🌱 Seed Spreader …`), and, from task 78, `needs 📦 25 storage` when the price holds
  more items than storage. The ⓘ tips name what the certificate is paid in and
  which tool it needs.
- Owned certificates are never re-checked. The v9, v10, v11 fixtures and a v12 round trip load with farm certificates
  whose tool is below Lv3, and their workers keep acting and getting paid.
- **Layout (computed from `app.css`, no browser):** `.worker-row` is a wrapping flex row; the label span is
  `nowrap`, and its gate lines are 12 px `<small>` blocks. The longest, `needs 🌱 Seed Spreader (tool Lv3)` (≈ 33 chars),
  is ≈ 200 px. The certificate button's price is a block `<small>`, so the button is two lines, ≈ 100 px wide (`⛰️20 ⚫5
  💰750` at 12 px + 16 px padding), and the ⓘ is 28 px. The row needs ≈ 200 + 4 + 100 + 4 + 28 = 336 px. At **1024**
  (284 px content) the button and ⓘ wrap to a second flex line. At **375** (343) and **1440** (358) the row is at the edge
  and fits or wraps the same way. A fresh 🌾 row stacks three gate lines (≈ 3 × 17 px), so the row grows taller, not
  wider. Everything is in normal flow, so nothing overlaps.

### Hand-picked ×1.25 + iron open (task 77)

- `HAND_PICKED_BONUS = 1.25` (`handPickedBonus()`). `harvest` passes it to `cropSale` when the action spends energy
  (taps, tool presses), and a worker's harvest (energy 0) sells at ×1. Each unit is `Math.round(market price × 1.25)`,
  and the glut still adds 1 a unit.
- UI: tile-tap toast `+💰13 Carrot ✋ ×1.25`, Harvest press toast `… +💰540 ✋ ×1.25`. Every crop ⓘ ends "You harvest
  it: ✋ ×1.25; workers sell at ×1.", and the Harvest worker ⓘ adds "Workers sell at ×1; …". The toasts already wrap
  (`max-width: calc(100% − 32px)`), and the tips float (batch 8.1), so the longer texts move nothing.
- The `?dev=iron` gate is removed: everyone sees the vein Lv3 upgrade, the iron-rock hint, the ⛏️ mine-worker row, the
  iron stats and the mine worker in Copy report / feedback context. Those elements are the batch-11 layout, already
  computed in "Batch 11 results".

### Sim (task 78, `tests/sim.test.ts` "batch 13", measured, `rules.batch13` on)

No `balance.ts` number changed in this task.
- **Ladder bot from tick 0** (the batch-11 iron ladder + `buyTools`, 2 h). Minutes: gates met (counter, tool, vein) →
  bought. Water and harvest are bought on the first tick the bot can pay, so their lag is cash. Plant, ore, fuel and
  mine are ladder goals bought one at a time, so their lag is the ladder working on earlier goals, not the price.

  | Certificate | gates met | bought |
  |---|---|---|
  | 💧 water | 23.3 | 24.8 |
  | 🥉 ore loader | 38.0 | 52.5 |
  | 🌱 plant | 59.8 | 81.8 |
  | ⚫ fuel loader | 61.8 | 61.9 |
  | 🌾 harvest | 65.8 | 66.5 |
  | ⛏️ mine | 86.8 | 109.8 |

  Tool Lv3: water 23.3 min, plant 59.8, harvest 65.8 (each certificate became buyable the tick its tool did, except
  ore / fuel / mine). Hires: first 25.9 min, pool 3 at 31.0, 6 at 50.9. Final cash 💰10,651 (batch-12 ladder 💰11,508).
  Never negative, never borrows.
- **No stall:** 36 recorded milestones from firstHarvest (tick 100) to certMine (6588). Longest wait **920 ticks
  (15.3 min), harvest certificate → plant certificate**, under the 60-minute pin.
- **Storage:** water 20 items, harvest 25, plant 10, all ≤ the 40 storage the bot held when each became buyable. At the
  starting storage (20), harvest does not fit: it needs storage Lv1 (30), and its row says so (see Deviations). Every
  older price-vs-storage pin passes unchanged.
- **24-tile lemon, fully staffed (1 planter, 1 waterer, 1 harvester), market on, 2 h, per hour:**

  | Farm | idle gross | attentive gross | gain gross | idle net | attentive net | gain net |
  |---|---|---|---|---|---|---|
  | basic tools | 12,346 | 15,166 | **+2,820** | 9,093 | 12,340 | +3,247 |
  | three copper tools | 24,571 | 29,992 | **+5,421** | 20,580 | 26,260 | +5,680 |

  Attentive = 4 energy/min of player harvests ahead of the harvester (227 / 390 picks in 2 h). The harvester then idles
  unpaid, so net gains more than gross. Why the basic-tools gain is below ≈ 6,600: see Deviations.
- **Hierarchy with hand-picked on:** iron pickaxe Lv10 on vein Lv3 **2.09** cash/energy < 0.9 × 24-tile pumpkin by hand
  (**10.22**, was 7.87 at ×1 → cap 9.20).
- **step(s, n) = n × step(s, 1)** over 600 ticks from the ladder end, with workers on, glut > 0 and hand-picked
  sales just made.
- **Older pins:** every batch 3–12 run replays under the batch-12 rules (test-only switch, see Deviations) with no
  number edited.

## Batch 14 — 📋 Noticeboard (orders) + ⭐ (tasks 79–82, save v12 → v13)

Why: cash is trivial for veteran players; ⭐ is paced by time, not tile count, so its prices stay meaningful for
everyone, and crop orders are the outlet for a flooded market. Design: docs/research/orders.md §1 recs 1–10
(state shape adapted to save v13; Workshop goods join the pool later through the same tables).

- [x] 79. **Orders core + save v13.** FIRST commit `tests/fixtures/save-v12.json` (realistic, market glut > 0,
    milestones present).
    - 🛒 Shop card "📋 Noticeboard": `{ stone: 10, cash: 100 }`, visible after 50 sales. Bought, not automation.
    - `run.orders = { unlocked, slots, offers: Array<Offer | { cooldownTicks: number }> }`,
      `Offer = { good, count, done, tier, accepted }`; `run.stars`; `counters.orders`; `lifetime.ordersCompleted`,
      `lifetime.starsEarned`. All numbers in balance.ts (`ORDER_*`).
    - Generator on `run.rngState`, rolled only inside the action that opens a slot (buy board, complete, discard,
      buy slot, reroll) so runs replay. Pool = what the player can make now: licensed crops; items in the current
      vein's drop table; bars once the furnace exists. Count = tier minutes × capacity/min (crops: tiles ÷
      growTicks × 60 per crop; items: `ORDER_ROCKS_PER_MIN = 12` × drop share; bars: furnace bars/min); tiers
      5 / 10 / 20 min, weights 50 / 35 / 15 %; item counts clamp ≤ ⌊bag capacity ÷ 2⌋; minimum count 1.
    - Fill: while an accepted crop order is open, every harvest of that crop (player, tool, worker) goes to it,
      bypasses the market (no glut added) and pays base × `(1 + ORDER_BONUS)`, `ORDER_BONUS = 0.25`, at harvest
      (hand-picked ×1.25 still applies on player harvests). Items: a "Deliver" action moves the count from storage
      (0 energy); its cash = base value × ORDER_BONUS (bars valued at their inputs).
    - Reward on completion: ⭐ 1 / 2 / 4 by tier. No expiry, no timers. Discard = free; the slot refills after
      `ORDER_COOLDOWN_TICKS = 600`, counted in step(). Start with 2 slots.
    - step(s, n) = n × step(s, 1) with accepted crop orders and worker harvests (test).
- [x] 80. **Noticeboard UI.** A "📋 Orders" section at the top of the 🌾 Farm side-panel tab (no 7th tab): one row
    per slot — good emoji + `12 / 40`, tier dots, ⭐ reward, cash bonus, Accept / Deliver / Discard; cooldown rows
    show `next order in 7:12`. Accepted crop orders mark ready tiles of that crop with a small 📋 corner badge.
    ⭐ total in the HUD next to cash only once the board is bought. Compact at 375 px; compute layout from CSS and
    check overlap at 375 / 1024 / 1440 px.
- [x] 81. **⭐ shop + order clerk.** Rows in the Noticeboard section (⭐ only, cash cannot buy ⭐, nothing sells
    for cash): 3rd slot 10 ⭐; 4th slot 30 ⭐; reroll token 2 ⭐ (refill every open slot now, ignores cooldown).
    Order clerk = new worker job: certificate `{ stars: 20, copperBar: 6, cash: 200 }`, needs `counters.orders ≥ 20`;
    action every WORKER_ACTION_TICKS, 💰1 wage, same pool cap 6: deliver an item order storage can fill, else accept
    any offer whose good the farm grows or the vein drops; never discards. Milestones table gains: board bought,
    first order, 10 ⭐, clerk certificate.
- [x] 82. **Sim (`tests/sim.test.ts` "batch 14").** Report ⭐/hour and order cash bonus as % of income for a 9-tile
    carrot farm and the 24-tile lemon farm (expect ⭐ rate about equal, 4–12 ⭐/h); hours to buy the whole ⭐ shop;
    hierarchy pin (mining cash/energy incl. item-order bonus < 0.9 × pumpkin farming); every item order count ≤ bag
    capacity at its moment; generator only offers goods the state can produce (property test over the ladder bot's
    states). Tune only batch-14 numbers; report each change as a deviation.

## Batch 14 results

### Orders core + save v13 (task 79)

- `src/core/orders.ts` (tests `tests/orders.test.ts`): `orderPool`, `orderPerMinute`, `orderCount`, `rollOffer`,
  `harvestSale` (the harvest's order-then-market split), `buyOrderBoard`, `acceptOrder`, `discardOrder`,
  `deliverOrder`, `tickOrders` (step). Numbers in balance.ts: `ORDER_BOARD` (price, 50-sales gate, bonus 0.25,
  2 slots), `ORDER_TIERS` (5 / 10 / 20 min, 50 / 35 / 15 %, ⭐ 1 / 2 / 4), `ORDER_ROCKS_PER_MIN` 12,
  `ORDER_COOLDOWN_TICKS` 600. Icons `STAR_EMOJI` / `BOARD_EMOJI` in `src/core/data/orders.ts`.
- `harvest()` sends each unit to the first accepted open order of its crop (price = unglutted price × 1.25 × the
  hand-picked ×1.25 when the player harvests; no glut), the rest to the market as before. Completing an order pays ⭐
  by tier, `counters.orders` +1, `lifetime.ordersCompleted` / `starsEarned`, and rolls a fresh offer into the slot.
- Save v13 (`migrateV12`): board not bought, starting slots, ⭐ 0, `counters.orders` 0, lifetime order totals 0. Real
  v12 fixture `tests/fixtures/save-v12.json` (the v11 ladder end + 3 tiles + 930 ticks: lemon glut 25, `tiles12`
  milestone) committed first; every fixture v1–v12 chains to v13 and keeps its raw backup (`tiles.save.backup.v12`).
  The v1–v11 expectations are unchanged: `asV12()` strips the v13 additions and a separate test checks them.

### Noticeboard UI (task 80)

- `src/app/Orders.tsx` (tests `tests/Orders.test.tsx`): one row per slot, `🥕 12 / 40` over `●●○ · ⭐2 · +💰100`
  (tier dots, ⭐ reward, the order's cash above base price / for delivery); Accept + Discard on an open offer, Discard
  on an accepted crop order, Deliver + Discard on an accepted item order (Deliver disabled until storage holds the
  rest); a cooling slot reads `⏳ next order in 7:12`.
- Placement: a section at the top of the desktop 🌾 Farm tab (above the tool rows). Where there is no Farm tab (mobile,
  tablet, collapsed desktop) it is a closed `<details>` card in the farm column after "Dig for seeds", before 👷
  Workers, so the grid keeps its height (the Workers card rule). No 7th tab.
- 🛒 Shop: `📋 Notice board ⛰️10 💰100` in Supplies from 50 sales until bought, with an ⓘ tip. HUD: `⭐ n` right of
  cash once the board is bought. A ready tile of an accepted crop order shows a 📋 badge in its top-left corner.
- **Layout, computed from `app.css` (no browser; system-ui at 14 px ≈ 7.7 px per digit, 12 px ≈ 6.6, emoji ≈ 1.2 em):**
  - Order row = good span (two lines, the wider is the 12 px line `●●○ · ⭐4 · +💰2200` ≈ 120 px) + 4 px + at most
    two buttons (Deliver ≈ 65, Discard ≈ 68 px incl. 8 px padding and border) + 4 px ≈ **261 px**. Room: 375 px →
    farm column 359 px (98 spare); 1024 → Farm tab content 300 − 16 = 284 px (23 spare); 1440 → 374 − 16 = 358 px
    (97 spare); tablet / collapsed farm column ≥ 428 px. `flex-wrap` moves the buttons down rather than overflowing.
    Rows, the note and the cooldown line are in-flow in a flex column (4 px gap), so nothing overlaps the tool rows
    below (Farm tab) or the 👷 card below (farm column).
  - Shop card at 1024: column (284 − 6) / 2 = 139 px, text box 139 − 60 (padding-inline 30) − 2 = 77 px. "📋 Notice"
    ≈ 71 px fits line 1 and sits at x 34–105, left of the ⓘ (x 110–138); "board" goes to line 2. (One word
    "Noticeboard" ≈ 91 px would overflow under the ⓘ, see Deviations.) 375: 168 − 62 = 106 px, 1440: 176 − 62 = 114
    px, one line each.
  - HUD at 375 (343 px content): 💰 5 digits 67 + ⭐ 50 + energy 72 + 👷 32 + ⏱ 5 digits 67 + 4 gaps 32 = 320 px
    fits; with a loan (+74) it would be 394 px, so `.hud` now wraps (row gap 4 px) instead of overflowing. That
    overflow already existed with a loan and 👷 before this batch. 1024 / 1440: the HUD spans the full top row.
  - Tile badge: 14 px at top 4 / left 6, absolute, no layout space; the worker pop is top-right, so they never meet.
    In the smallest tile (72 px, 24 tiles) the 28 px crop emoji leaves a 22 px gutter each side, ≥ 6 + 14.

### ⭐ shop + order clerk (task 81)

- ⭐ shop row under the order rows: `+ Slot 3 ⭐10` (then `+ Slot 4 ⭐30`, hidden at 4 slots) and `🔄 Reroll ⭐2`.
  `buyOrderSlot` / `rerollOrders` pay through `pay()` with `{ cash: 0, stars }`, so cash can never buy ⭐ and nothing
  bought sells. Numbers: `ORDER_SLOT_STARS = [10, 30]`, `ORDER_REROLL_STARS = 2`, read through `orderSlotStars`,
  `orderMaxSlots`, `orderRerollStars`.
- Order clerk = `WORKER_JOBS` entry `clerk` (acts last in a round, 💰1 wage, same pool cap 6): certificate
  `{ stars: 20, copperBar: 6, cash: 200 }` after `counters.orders ≥ 20`. Action (`clerkAction`): deliver the first
  accepted item order storage can fill, else accept the first open offer for a crop on a tile / the "Crop to plant",
  or an item the current vein drops; never discards; nothing to do = idles unpaid. v13 adds
  `workers.assigned.clerk = 0`.
- Milestones: `orderBoard` (Notice board), `firstOrder`, `stars10` (Earned ⭐10); `certClerk` comes from the
  per-job certificate rows.
- Layout (computed, as above): ⭐ shop row = `+ Slot 3`/⭐10 ≈ 70 px + 4 + `🔄 Reroll`/⭐2 ≈ 81 px ≈ 155 px ≤ 284
  (1024), 358 (1440), 359 (375). 👷 Clerk row = label + `orders 0/20` ≈ 70 + Certificate button over
  `🥉6 ⭐20 💰200` ≈ 108 + ⓘ 28 + gaps 8 ≈ 214 px ≤ 284, the width every other certificate row already fits.

### Sim (task 82, `tests/sim.test.ts` "batch 14", measured, `rules.batch13` on)

Bot (`orderFarm`): one crop, 2 h, 💰1000 start, the board bought at tick 0 (refunded, so both runs start alike) vs no
board. Before each tick it accepts every offer for its crop and discards every other one (the 10-min cooldown then
refills the slot); it never rerolls and never spends ⭐. Income = cash change + standing crops per hour.

| farm | harvests/h | ⭐/h | orders/h | income/h with board | without | order cash bonus | h to ⭐ shop (60) |
|---|---|---|---|---|---|---|---|
| 9-tile carrot, by hand | 320 | **11** | 6.5 | 💰4,500 | 💰3,542 | **+27 %** | **5.5** |
| 24-tile lemon, 1 planter/waterer/harvester + attentive player (batch 13 farm) | 114 | **5** | 3 | 💰16,766 | 💰12,340 | **+35.9 %** | **12** |
| 24-tile lemon, 2 per job (pool 6) + attentive player | 228 | **10** | 6.5 | 💰29,814 | 💰21,117 | **+41.2 %** | **6** |

- **⭐/h:** all three are inside 4–12. Carrot by hand (320 of a nominal 324/h) and the six-worker lemon farm (228 of
  240/h) are equal within 1 ⭐/h, so ⭐ is paced by time, not tile count or crop price. The three-worker lemon farm
  earns half: its one waterer caps it at ~120 lemon cycles/h (48 % of the 240/h the count assumes), so each order
  takes twice its tier minutes. See Deviations.
- **Order cash bonus** (income with board ÷ without − 1): +27 % to +41 %, above the research's +12–18 %. The research
  assumed 40–60 % of harvests routed through orders; this player accepts every order for its crop, so ~all harvests
  go through one, and on 24 lemon tiles the board also removes the glut (≈ 0.9 → 1, so ×1.25 on top of ×1.11).
  Not tuned (no target in the plan); see Deviations for the lever.
- **Hours to the whole ⭐ shop** (3rd slot 10 + 4th slot 30 + clerk certificate 20 = 60 ⭐; rerolls are consumables):
  5.5 h (carrot), 6 h (six-worker lemon), 12 h (three-worker lemon), at 2 slots, without the rate a 3rd slot adds.
- **Hierarchy:** the best mining bench (iron Lv10, vein Lv3, repairs at input value) earns 2.09 cash/energy; with every
  mined item paid at (1 + 0.25) it is 2.62, against the cap 0.9 × 24-tile pumpkin by hand = 0.9 × 10.22 = 9.20. Delivered
  items actually earn less than selling (base × 0.25 and the item is gone), so this is an upper bound.
- **Storage fit:** over the batch-13 iron ladder (2 h, 120 states, one per minute), every item order count of every
  good in the pool at every tier is ≤ ⌊bag ÷ 2⌋ (the largest is exactly half) and ≥ 1.
- **Generator property:** for the same 120 states, every good in `orderPool` and 20 rolled offers per state pass an
  independent "can produce" predicate (licensed crop; mine license + the vein drops it + a copper pickaxe for iron;
  furnace + its ore for bars). The pool grows from 1 good (carrot) to 10 (4 crops, stone, coal, copper and iron ore,
  both bars).
- **No batch-14 number changed** (`ORDER_BOARD`, `ORDER_TIERS`, `ORDER_ROCKS_PER_MIN`, `ORDER_COOLDOWN_TICKS`,
  `ORDER_SLOT_STARS`, `ORDER_REROLL_STARS`, the clerk certificate are the plan's values). Every older pin replays
  unchanged (the older bots never buy the board).
- step(s, n) = n × step(s, 1) is tested with workers, the market, accepted crop orders and a cooling slot
  (`tests/orders.test.ts`, task 79) and with the clerk, a harvester, crop + item orders and the market (task 81).

## Batch 15 — iron farm tools (tasks 83–85, no save bump: `run.toolTier` is already a number)

Why: the round-4 numbers (DECISIONS "Iron farm tools are a later batch") — moisture 4, 20 % double harvest, 35 % seed
keep — finish the metal ladder for farm tools before gold. Price rule (batch 12+ direction): late items are gated by
materials; their cash part = 0.5–1.5 h of income at unlock, measured by the sim, never guessed.

- [x] 83. **Iron tier for all three farm jobs.** `WATER_MOISTURE = [1, 2, 4]`, `DOUBLE_HARVEST = [0, 0.1, 0.2]`,
    `SEED_KEEP = [0, 0.2, 0.35]`, `TOOL_TIER_COST[1] = { ironBar: 4, cash: IRON_TOOL_CASH }` with
    `IRON_TOOL_CASH` set in task 85 (start 💰5,000). Buying tier 2 needs tier 1 of the same job. Workers on that job use
    the tier like the player (watering worker fills to 4 → the "watering worker wage halves again" effect). The
    toolTier comments in balance.ts/state.ts say "0 basic, 1 copper, 2 iron". Moisture 4 must not break the tile's
    moisture bar (bar shows fraction of the tier's max; check FarmGrid).
- [x] 84. **UI.** The tool bar tier button shows the iron step (`🔷 Iron watering can — moisture 4`, price with 🔷 bars),
    disabled with the reason line when iron bars or the copper tier are missing; ⓘ tips list all three tiers' effects;
    Stats tool rows show the tier name. Iron emoji from the shared constants. Compute layout from CSS at 375 / 1024 /
    1440 px.
- [ ] 85. **Sim (`tests/sim.test.ts` "batch 15").** Extend the batch-13 ladder bot: after the mine certificate it
    buys the three iron tools (water → harvest → plant). Report the minute each becomes affordable and is bought, iron
    bars needed vs mined/smelted per hour, and income/h before vs after (24 tiles staffed, market on, idle and
    attentive). Set `IRON_TOOL_CASH` so the cash part is 0.5–1.5 h of the bot's measured income at that moment, rounded
    to 💰500, and pin it. Pins: no unlock step > 60 game-minutes (from the mine certificate to the third iron tool,
    iron-bar supply included); every price ≤ storage held; mining cash/energy < 0.9 × pumpkin farming with iron tools;
    step(s, n) = n × step(s, 1) with iron tiers and workers on. Tune only batch-15 numbers; report each as a deviation.
