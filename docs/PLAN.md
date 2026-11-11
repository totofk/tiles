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
- **Batch 15 (task 83): `IRON_TOOL_CASH` = 10000, not the plan's "start 💰5,000".** Task 85 measured the ladder bot's
  income at the mine certificate at 17128/h; 5000 is 0.30 h, below the 0.5–1.5 h rule, so the cash part moved into the
  band (0.61 h, rounded to 💰500). Only the batch-15 number changed.
- **Batch 15 (task 83): iron names/emoji follow the shared constants, not the plan's example text.** The row reads
  `🥈 Iron Can / Iron Sickle / Iron Dibber` (parallels the copper names) with `ITEMS.ironBar.emoji` 🥈 (Unicode 11);
  the plan's example "🔷 Iron watering can" used 🔷 (Unicode 12, breaks the emoji rule) and the long name.
- **Batch 15 (task 83): `toolTierMax()` pin moved 1 → 2** in `tests/tools.test.ts` (batch-15 tuning of the same pin; the
  tier-1 cost pin 💰100 is unchanged, so every older ladder replay is intact).
- **Batch 15 (task 84): the tier row's status line replaces the old "✓ Owned" text** with the owned tier's effect
  (`✓ moisture 4`), and the ladder of all three tiers lives in the ⓘ tip; the button label stays `🥈 Iron Can`.
- **Batch 15 (task 85): the advisor could not be consulted** — the advisor MCP tool of the earlier session is not
  available in this one (server disconnected); the approach ran without it.
- **Batch 16 (task 86): the pre-market-era sims (batch 8–11 ladders and their offline runs) run market-off from now
  on.** At depth 60 the market-on run of the pre-hand-picked era stalls cash-broke (finalCash 0 after storage Lv2 at
  tick 951: crop income drops below the hire/seed spend schedule, workers wait at cash 0 and the farm rots), so their
  pins could not be re-pinned meaningfully. Market-off replays their pre-market pins bit-exactly (the mock only forces
  `marketFactor` to 1), so those batches keep their measured history; the market-on stall itself is pinned in the
  batch-12 describe. Batches 7/7.1 and the batch-10 crop benches still run market-on (they complete) — only their cash
  numbers were re-pinned. Live rules (hand-picked ×1.25, batch 13+) are unaffected: the batch 13–15 ladders complete.
- **Batch 16 (task 86): the split ≥ mono goal is not reached at depth 60.** Best 2-crop split (4 pumpkin + 20 lemon)
  earns 11612/h vs mono lemon 12031/h = 96.5 % (was 94.5 % at depth 120). Crossing over needs a depth below 60, which
  the task did not offer; the hierarchy pin holds (iron Lv10 vein Lv3 2.09 < 0.9 × 24-tile pumpkin 7.52), so depth
  stays 60 per the task's own escalation rule.
- **Batch 16 (task 89): `GOLD_VEIN_CASH` retuned 💰5000 → 💰7500** — 0.53 h of the bot's measured 14118/h income
  in the vein-Lv4 phase; the plan's 💰5,000 start measured 0.35 h, below the 0.5 h floor. Only the cash part moved;
  the item parts and every older ladder are untouched (the batch 12–15 pins replay unchanged).
- **Batch 16 (task 89): `GOLD_TOOL_CASH` retuned 💰15000 → 💰10000** — 0.75 h of the measured 13415/h gold-phase
  income; the plan's 💰15,000 start measured 1.16 h and stretched the pickaxe→sickle and sickle→dibber gaps to
  66 / 76 min, past the ≤ 60-min pin. Pins in `tests/tools.test.ts`, `tests/Shop.test.tsx`, `tests/mining.test.ts`
  and `tests/Mine.test.tsx` follow the constant.
- **Batch 16 (task 89): the gold bot hand-smelts and mines while a gold goal gathers** (bot-side methodology, no
  game rule changed). With the ore/fuel loaders and a mine worker staffed, every ore the workers mine becomes a
  surplus unsellable bar that jams the bag (34 iron bars at iron-plant, bag 47/50), so a `gold` run staffs only
  the planter and one harvester and smelts by hand (`smeltCoalJobs` capped by the goal's keep). The staffed
  lemon farm eats every energy point, so gold runs buy ladder goals at tick level and mine instead of farming
  while the next batch-16 goal's keep is short.
- **Batch 17 (task 90): the save bumped v14 → v15, not v13 → v14** — batch 16's gold items had already taken v14,
  so the workshop shape (`run.workshop`) is v15. The realistic v14 fixture (vein Lv4, gold tools, orders unlocked)
  was generated by a temporary ssrLoadModule script (batch-7.1 precedent) and committed ahead of the bump (8c51b84).
- **Batch 17 (task 90): the smart valve holds every waterable tile below fill when any machine stalls** — a
  stateless monotone held set, not a recomputed driest-6 set. A stall can outlast any window, and the held set only
  grows until coal returns, so `step` stays a pure function of the run; the valve card says
  "holds moisture during a coal stall".
- **Batch 17 (task 91): buying the workshop points to its card instead of switching tabs.** The Shop renders inside
  both the 🌾 Farm tab and the Shop tab with no tab-switch plumbing of its own, so the buy toast reads
  "Workshop built — its card sits with 👷 Workers" rather than auto-opening the Farm tab.
- **Batch 17 (task 92): the cash parts were retuned by the task's own rule** — `WORKSHOP_CASH` 7500 → **8500**
  (0.55 h of 15417/h), `SPRINKLER_CASH` 7500 → **8000** (0.53 h of 14954/h), `VALVE_CASH` 5000 → **8000**
  (0.53 h): the task-90 placeholders measured 0.47 / 0.50 / 0.33 h, all at or below the 0.5 h floor. Item parts,
  the recipe and every older ladder pin are untouched (the batch 7–16 pins replay unchanged).
- **Batch 17 (task 92): the 8 h offline coal bound includes loader-refilled storage coal**, not only the coal in
  the hoppers (the locked rule said "bounded by the coal in the hoppers"): the fuel loader tops hoppers from
  storage during catch-up, so the real bounds are 4 machines × 12 coal/h × 8 h = 384 coal and pool + mined coal.
  Measured loss from the ladder end: 13 coal/h (103 coal) with lean hoppers; nothing stalls to death.
- **Batch 17 (task 92): a sprinkler run's bot needed a sell-before-collect fix** (bot-side, sprinkler runs only):
  with the sprinkler keeps banked the bag holds no sellable surplus, so a full bag stranded the tray's last bar —
  `collectBars` ran before the surplus sell and the dig refilled every freed slot, freezing the run at copper 7/8
  for 18 h. `mineOnce` now sells the surplus before collecting when the tray is ready; batches 7–16 replay their
  pins unchanged.
- **Batch 18 (task 93): the v16 fields object saves `plantCrop` and `coalCarry` beside the planned keys.**
  `plantCrop` is the crop the planter works (null until the player or bot picks one — the planter idles without it);
  `coalCarry` is the pump's fractional accrual (0.5 coal/h per 10 tiles must accumulate between whole-coal burns).
  Both are run state, so they live in the save.
- **Batch 18 (task 93): "stop" clears the planter's crop (`plantCrop` → null), a free action.** The plan fixed no
  way to un-pick a crop; without this a misclick locks the planter for the rest of the run. `NOTHING_TO_DO` when
  none is picked.
- **Batch 18 (task 93): the pre-bump fixture is a v15 save, not v14.** Batch 17 had already shipped v15
  (workshop/sprinklers), so the fields bump is v15 → v16; the realistic fixture (workshop built, 2 sprinklers,
  valve, orders unlocked) is saved at v15 and migrated forward in the chain tests.
- **Batch 18 (task 93): `fieldsHarvest` reaps within the oldest ready cohort only** (up to HARVEST_BATCH = 10
  tiles), never across cohorts; a partially reaped cohort stays ready at its date. The plan did not fix the batch
  boundary; this keeps harvests strictly FIFO and makes the pair-throughput bound clean.
- **Batch 18 (task 94): `buyPipes` shipped inside the task-93 commit** — the cohort core needs the coverage tiers
  to grow anything, so the split was unbuildable. Task 94's own commit is docs-only; no code difference.
- **Batch 18 (task 94): no new ActionError values.** `buyPipes` reuses LOCKED / NO_WORKSHOP / MAX_LEVEL /
  NOT_ENOUGH_ITEMS / NO_CASH.
- **Batch 18 (task 94): the pipes draw storage coal directly** (`inventory.coal`, 1 whole coal each time the
  accrual reaches 1.0), not through a hopper. The fuel loader is unchanged — it fills hoppers; the pump is not a
  hopper machine. Same coal budget either way, one fewer UI rule.
- **Batch 18 (task 96): stall semantics corrected from a frozen `readyTick` to a receding one (+1/tick).** The
  task-93 core left a stalled cohort's date frozen; the calendar then passed it (`readyTick <= tick` reads as
  ready) — a free ripen that made pipes meaningless and put income(1,000) ABOVE income(300). A stalled cohort's
  harvest date now recedes with the calendar (growth truly paused, nothing dies). `src/core/fields.ts` growth map
  + 5 fields-test expectations updated; the sim pins the plateau it forced.
- **Batch 18 (task 96): pipe cash prices retuned by the band rule.** The task-93/94 placeholders (7500 / 10000 /
  12500) measured 0.07–0.5 h — at or below the floor. Final: **10000 / 100000 / 350000** = 0.68 / 0.69 / 0.84 h
  of the income measured at each unlock (14635/h, 143908/h, 417808/h). FIELDS_CASH 10000 = 0.68 h was already in
  band, unchanged.
- **Batch 18 (task 96): the "fields 100 ≤ 60 game-minutes" pin is arithmetically impossible; measured and reported
  instead.** 100 fields cost ≈ 💰505,000 cumulative at a rising income (14.6k/h → 79.6k/h): pipes1 → field 100 =
  **448.5 game-minutes**. The ≤ 60-min pin holds where it can: fields unlock → first pipes = **47.0 min** (pinned).
- **Batch 19 (task 97): the plan priced only the harvesters; seeder tiers cost their harvester equals.** Seeder
  Mk1 = `{ ironBar: 12, cash }`, Mk2 = `{ ironBar: 24, goldBar: 4, cash }` — same throughput class, one tier
  fewer, so the same recipe parts and cash as the matching harvester tier.
- **Batch 19 (task 99): machine cash tier 2 retuned 💰100,000 → 💰250,000.** The task-97 placeholder measured
  0.26–0.33 h of ladder-bot income (income triples after the tier-1 pair); the band rule wants 0.5–1.5 h, and
  💰250,000 lands at 0.81 h (harvester2) / 0.65 h (seeder2). Tier 1 (💰50,000, 0.56/0.59 h) and tier 3
  (💰350,000, 0.94 h) were in band untouched.
- **Batch 19 (task 99): machines never out-earn gold-sickle workers at 100–1,000 tiles; the curve is measured,
  not tuned to flip.** Worker harvests roll the gold sickle's double harvest (~1.5 units/tile; a machine reaps
  exactly 1.0 — a pinned task-97 rule) and the seeder fleet caps at 5,400 tiles/h, so the workers arm wins at
  every measured N (144k vs 118k, 414k vs 353k, 436k vs 352k per hour). No rate was tuned to force a machine
  edge: the task says tune only what the band requires, and throughput changes would break task-97 pins. The
  machines' payoff is wage-free throughput — harvester2's marginal is the one that pays (3.4 h at 300 tiles).
- **Batch 20 (task 100): keepCarrotLicense shipped as keepLicenses "Seed vault" — keeps ALL crop licenses, 2 deeds.**
  Radish is the always-owned starting license, so the literal carrot row is a no-op; the research's item is the
  Seed vault. Same one-time price.
- **Batch 20 (task 100): the sale also refuses LOAN_ACTIVE and NO_GAIN, carries order slots + lifetime, and writes
  a pre-sale backup (`tiles.save.backup.prestige`).** The refusals come from the research (AdCap's zero-gain rule;
  a loan must not survive a reset); the backup mirrors the reset backup (Realm Grinder rec 7); none are in the task
  text. No sell-off of storage or standing crops (research rec 4 unadopted — the reset is the point; lifetime counts
  earned cash). Fresh-run milestones start `{}`: kept licenses/certificates simply never appear on run 2's timeline.
- **Batch 20 (task 101): meta multiplier steps retuned to the DECISIONS table.** sellPrice 1.1 → 1.05 and
  growTime/cost 0.95 → 0.96 per level (DECISIONS: +5 % / −4 %); energy is a flat +2 inside `energyMax`'s parens
  (its multiplier step set to 1, so legacy multipliers still apply without double counting); `tileCost` anchors on
  `startTiles(meta)` so a 15-tile start prices its first bought tile at the base price. workerSpeed moves the
  worker clock to a stateless floor-crossing predicate (identical to modulo for integer periods, tick 0 acts) —
  sprinklers share the clock, so the row speeds them too.
- **Batch 20 (task 102): the ≥ 1.8× fields-unlock pin is unreachable with the shipped rows; measured 1.4× (first
  sale) / 1.5× (vault run), pinned ≥ 1.4×.** The DECISIONS pin inherited the research's ×2.2, which modelled
  stronger rows (flat 1-deed levels: +10 % sellPrice, −5 % growTime, +1 tile) on a pre-Fields, no-mining player.
  The shipped rows are weaker (2/4/8/16/32 pricing, +5 %/−4 % steps), the fields gate sits behind the mine/smelt
  ladder whose fixed `barTicks` no row touches, and DECISIONS forbids mining multipliers — so no spend reaches
  1.8× to fields: even a maximal first sale (71 deeds, 8.9× the 8-deed gate) lands at 1.5× with the vault. First
  hour ×1.35 / ×1.67 vs the modelled ×2.2. Tuning levers left for a future batch: stronger steps, or a smelt/
  energy deed row (out of scope by the current DECISIONS wording).
- **Batch 20 (task 102): the sim's race is measured on the vault run (sale #2's run), not the first post-sale run.**
  The research flow spends deeds on the portal screen before the reset, so its "run 2" keeps licenses; the shipped
  sale is atomic and sale #1 has no deeds to buy the vault with, so the vault first carries on sale #2. Both runs
  are measured and reported (1.4× without carries, 1.5× with).
- **Batch 20 (task 102): the selling fixture is v17, not v15.** The gate needs a sprinkler + plant/harvest
  certificates + 💰640k lifetime — a v15 save (pre-workshop) can never satisfy it; the real save at the gate is
  the v17 machines-era one.

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
- [x] 85. **Sim (`tests/sim.test.ts` "batch 15").** Extend the batch-13 ladder bot: after the mine certificate it
    buys the three iron tools (water → harvest → plant). Report the minute each becomes affordable and is bought, iron
    bars needed vs mined/smelted per hour, and income/h before vs after (24 tiles staffed, market on, idle and
    attentive). Set `IRON_TOOL_CASH` so the cash part is 0.5–1.5 h of the bot's measured income at that moment, rounded
    to 💰500, and pin it. Pins: no unlock step > 60 game-minutes (from the mine certificate to the third iron tool,
    iron-bar supply included); every price ≤ storage held; mining cash/energy < 0.9 × pumpkin farming with iron tools;
    step(s, n) = n × step(s, 1) with iron tiers and workers on. Tune only batch-15 numbers; report each as a deviation.

## Batch 15 results

### Iron tier core (task 83)

- `WATER_MOISTURE = [1, 2, 4]`, `DOUBLE_HARVEST = [0, 0.1, 0.2]`, `SEED_KEEP = [0, 0.2, 0.35]` pinned in
  `tests/tools.test.ts` ("tool material tiers"), including the tier-2 rates over 2000 draws (20 % / 35 % ± tolerance) and
  `TOOL_TIER_COST = [🟧4 + 💰100, 🥈4 + 💰10000]`. Tier 2 is offered only after tier 1: `buyToolTier` always sells
  `toolTier + 1`, so with 🥈4 and the cash in hand but no copper, the offer is still the copper price (`NOT_ENOUGH_ITEMS`).
- Workers use the tier through the same actions (`toolTargets` reads `waterMoisture(run.toolTier.water)`); no worker code
  changed. The moisture bar shows `tile.moisture / waterMoisture(tier)` (a fraction of the can's max), so moisture 4
  fills the same 4 px track; the old `bar-over` band for values above 1 was dead and is deleted (`Bar.tsx`, `app.css`).

### Shop + tool bar UI (task 84, layout computed from the CSS — no browser here)

- The tier row now walks the ladder: `🥉 Copper Can — moisture 2 · 🥉4 💰100` → after copper `🥈 Iron Can —
  moisture 4 · 🥈4 💰10000`, with a second line `needs 🥈N 💰N more` while short, `needs <tool Lv1 name>` before the job's
  tool Lv1, and `✓ moisture 4` (owned card) at the max tier. The ⓘ tip lists all three tiers
  (`Basic: moisture 1 · Copper Can: moisture 2 · Iron Can: moisture 4`), numbers read from balance at render.
- Stats tool-tier rows read `tierName(job, tier)` (`basic` / `Copper Can` / `Iron Can`) from the core rows.
- Layout at 375 / 1024 / 1440 px, from `app.css`: `.shop-row` is a 2-column `minmax(0, 1fr)` grid at every width (no
  media query touches it) with auto-height rows, so the extra `<small>` needs-line wraps inside its button and grows the
  row — no fixed heights, nothing can overlap; the ⓘ stays absolute in the top-right corner (`padding-inline: 30px`
  keeps text clear of it). The iron press-button stripe (`.tools .iron`) is an inset box-shadow + border-colour beside
  the copper one — no width or padding change, so the mobile bar and the desktop stacked rows keep their widths. The
  moisture bar passes a 0…1 fraction like every other bar.

### Sim (task 85, `tests/sim.test.ts` "batch 15", measured, `rules.batch13` on)

- The batch-13 ladder bot, extended (`ironTools: true` → `IRON_TOOLS_LADDER`): after the mine certificate it buys
  iron water (117.8 min) → iron harvest (158.8) → iron plant (198.8). Steps from the certificate: **8 / 41 / 40 min —
  all ≤ 60**, bars included; the certificate lands at 109.8 min as pinned in batch 13.
- Affordable vs bought (bars = first tick 4 🥈 held after the previous purchase, cash = first tick 💰10000 held):
  water bars 117.8 / cash 115.3 / bought 117.8; harvest 125.8 / 158.8 / 158.8; plant 158.8 / 198.8 / 198.8. The first
  tool is bar-bound, the later two cash-bound; the bot buys the tick both are ready (≤ 2 ticks).
- **Bars: 12 needed (3 × 🥈4) vs 44 smelted over the 89-min phase ≈ 30/h** (the batch-11 bench pins 28/h with the same
  chain) — the smelt chain is never the wall after the first tool.
- **`IRON_TOOL_CASH = 10000`**: the bot's income over the phase is **17128/h**, so the cash part is 0.61 h of income —
  inside the 0.5–1.5 h rule, rounded to 💰500. (The plan's 💰5,000 start measured 0.30 h, below the band; see Deviations.)
- **Income/h, 24 staffed lemon tiles, market on** (gross/net): copper → iron, idle 24571/20580 → 26983/23545
  (**+2412 gross, +2965 net** — wages drop, the waterer works a quarter as often); attentive 29992/26260 → 32868/29863
  (**+2876 gross, +3603 net**). Cash never went below 0 in any bench.
- Pins held: every price ≤ storage held (`iron farm tool` 🥈4 ≤ the 50 slots at storage Lv3, added to the price-cap
  table); mining iron Lv10 vein Lv3 = 2.09 cash/energy < 0.9 × 24-tile pumpkin with iron tools = 22.08
  (pumpkin itself rose to 24.53 cash/energy with iron); `step(s, 600) = 600 × step(s, 1)` from the ladder end with the
  iron tiers, workers, the market and hand-picked sales on. Nothing goes negative, no loan, `finalCash 55430` at 6 h.

## Batch 16 — economy retune + gold tier (tasks 86–89)

Why: batch 14's sim measured the noticeboard adding +27–41 % income (research expected +12–18 %) and the market at
depth 120 barely touching a 24-tile farm, while the goal of 12–14 was to slow cash inflation. Then gold: vein Lv4,
gold ore/bar/pickaxe, gold sickle + dibber (no gold can — DECISIONS batch 15). Numbers: docs/research/sprinkler-gold.md
and DECISIONS. Cash parts of new items follow the price rule: 0.5–1.5 h of the sim's measured income at unlock.

- [x] 86. **Economy retune (balance.ts only).** `ORDER_BONUS` 0.25 → 0.10; `MARKET_DEPTH_TILES` 120 → 60. Re-run and
    re-pin the batch 12/13/14 sims with a one-line "re-pinned batch 16" note each. Report: 24-tile lemon income
    before/after (idle, attentive, with board), best 2-crop split vs mono lemon at depth 60 (goal: a split earns at
    least as much as mono), ⭐/h unchanged. Hierarchy pin must hold; if mining ≥ 0.9 × farming at depth 60, raise depth
    in steps of 10 until it holds and report the value. No save change.
- [x] 87. **Gold core.** Vein Lv4: price `{ stone: 45, ironBar: 8, cash: GOLD_VEIN_CASH }` (start 💰5,000, set in 89),
    needs the iron pickaxe owned; drop table at Lv4 stone 50 / coal 20 / copper ore 12 / iron ore 10 / gold ore 8 %;
    gold rock takes 5 hits (weaker pickaxes: same rule as the batch-11 iron rock). Gold bar = 2 gold ore + 6 fire
    units in the furnace (ore-kind picker gains gold). Gold pickaxe = `{ goldBar: 5, cash: 500 }`, durability 6,500,
    mastery like the others. Storage: the vein Lv4 price (53 items) must fit — if the storage max is below, the
    reason line names the storage level, as batch 13 did. Orders pool gains gold ore/bar through the tables (no
    generator change). Milestones gain vein4, firstGoldBar, goldPickaxe. If new item ids change the save shape, bump
    to v14 per CLAUDE.md (FIRST commit `tests/fixtures/save-v13.json`); otherwise no bump.
- [x] 88. **Gold farm tools + UI.** Tier 3 for harvest and plant only: `DOUBLE_HARVEST[3] = 0.3`, `SEED_KEEP[3] = 0.5`,
    price `{ goldBar: 4, cash: GOLD_TOOL_CASH }` (set in 89), needs the iron tier of that job. Water stays capped at
    iron (the tier button says "Iron is the last watering can"). UI: vein Lv4 row, gold rock look, gold emoji from shared
    constants, furnace gold option, gold tool tier buttons, Stats rows. Layout computed from CSS at 375 / 1024 / 1440.
- [x] 89. **Sim (`tests/sim.test.ts` "batch 16").** Extend the ladder bot past batch 15: vein Lv4 → first gold bar →
    gold pickaxe → gold sickle → gold dibber. Report the minute of each; gold bars/hour; set `GOLD_VEIN_CASH` and
    `GOLD_TOOL_CASH` to 0.5–1.5 h of the bot's measured income at that moment (round to 💰500) and pin them. Pins: no
    unlock step > 60 game-minutes; every price ≤ storage held; mining cash/energy (gold pickaxe, vein Lv4) < 0.9 ×
    farming; step(s, n) = n × step(s, 1). Tune only batch-16 numbers; report each as a deviation.

## Batch 16 results

### Economy retune (task 86, `tests/sim.test.ts` + `tests/market.test.ts`, every pin re-pinned with a note)

- `MARKET_DEPTH_TILES = 60`: 24 tiles of one crop settle at factor **0.80** (was 0.88–0.92), 120 tiles still at the
  0.50 floor; 24 lemons at fertilizer Lv5 sit at **0.60** (was 0.80). The glut halves as before (1800 ticks).
- **24-tile lemon income before → after** (per hour): manual **12678 → 12031** (market off: 13321, unchanged);
  workers **9093 → 8682** (off: 9507); staffed idle gross/net **24571/20580 → 22793/18802** and attentive
  **29992/26260 → 27829/24097** (copper tier; with iron tools idle 24809/21370, attentive 30194/27190); with the 📋
  board **16766 → 14374** (board off: 12340 → 11836), so the board now adds **+21.4 %** on a 24-lemon farm
  (`ORDER_BONUS` 0.10; was +35.9 %) — inside the 12–18 % research band only via the 6-worker variant (32.9 % carrot
  9-tile 22.1 %). ⭐/h unchanged: **11 / 5 / 10** (carrot9 / lemon24 / lemon24×6), hours to the ⭐ shop unchanged.
- **Split vs mono at depth 60:** best 2-crop split (4 pumpkin + 20 lemon) **11612/h vs mono lemon 12031/h = 96.5 %**
  — the split-≥-mono goal is not reached (94.5 % at depth 120); see Deviations. Split market-off: 12355.
- **Hierarchy holds at depth 60** (mining < 0.9 × farming): iron Lv10 vein Lv3 2.09 cash/energy < 0.9 × 7.52
  (24-tile pumpkin manual), so depth stays 60 — no escalation needed.
- Ladder bots under live rules (batch 13/15 re-pins): mine certificate **109.8 → 107.3 min**; iron tools bought at
  115.3 / 161.6 / 200.8 min in steps **8 / 46.3 / 39.3 min (all ≤ 60)**; phase 89 → 93.5 min at **16936/h**
  (17128 before), keeping `IRON_TOOL_CASH = 10000` at 0.59 h of income — still inside the 0.5–1.5 h rule.
- Pre-market-era sims: batch 7 final cash 5897 → **5801**, batch 7.1 6022 → **5918** (market on, runs complete);
  batch 8–11 ladders + offline runs moved to market-off and replay their pre-market pins exactly (see Deviations);
  the market-on iron ladder at depth 60 is pinned stalled — cash-broke at 0 after storage Lv2 (tick 951), the mine
  certificate never bought.


### Gold core + tools (tasks 87–88)

- Vein Lv4 price `45 stone + 8 iron bars + 💰7500` (`GOLD_VEIN_CASH`, pinned in task 89); gate
  `NO_IRON_PICKAXE` (iron or gold in hand); drop table 50/20/12/10/8 (stone/coal/copper/iron/gold); gold rock
  5 hits, weaker pickaxes mine it as stone. Save **v14** (v13 fixture migrated in `tests/save.test.ts`).
- Gold tool tier: sickle 30 % double, dibber 50 % seed kept, `4 gold bars + 💰10000` (`GOLD_TOOL_CASH`,
  pinned in task 89); `toolTierMax(job)` — water stops at iron, its Shop card says
  "Iron is the last watering can".
- Layout, computed from `src/app/app.css` (no browser; widths are CSS math, not measurements):
  - **375 px** (single column, page scrolls): the vein Lv4 row is a wrapping span in the `.mine-vein` column
    flex — longest text "Lv4: … Gold ore 8 % — ⛰️45 🥇8 💰7500" wraps like the Lv3 row before it; the furnace
    ore picker (`repeat(auto-fit, minmax(96px, 1fr))` over ~343 px content) shows 3 per row, the gold button
    wraps to a 2nd row; the gold tool card sits in the same Shop grid cell as copper/iron (text wraps); the
    fixed bottom tool bar is unchanged — `.tools .gold` paints the border/underline only, no width change.
  - **1024 px** (3-column grid): Mine column `clamp(220px, 22vw, 320px)` = 225 px → vein rows wrap,
    furnace action rows 2 per row over ≈ 200 px content (96 px floor); side panel 300 px
    (`clamp(300px, 26vw, 380px)`, 26vw = 266 < floor); farm ≈ 419 px.
  - **1440 px**: Mine 317 px (22vw), panel 374 px (26vw), farm = 1440 − 2×20 padding − 2×20 gaps − 317 − 374
    ≈ 669 px; furnace action rows 3 per row; nothing fixed-width is new, so no breakpoint changes.

### Sim (task 89, `tests/sim.test.ts` "batch 16", measured, `rules.batch13` on)

- The batch-15 ladder bot, extended (`gold: true` → `GOLD_LADDER`): after iron plant (242.4 min) it buys
  storage Lv4 (**245.2**) → vein Lv4 (**278.4**) → first gold bar (**282.5**) → gold pickaxe (**294.5**) →
  gold sickle (**333.9**) → gold dibber (**381.9**). Gaps between purchases: **2.8 / 33.2 / 16 / 39.5 / 48 min
  — all ≤ 60**.
- **`GOLD_VEIN_CASH = 7500`**: income in the vein-Lv4 phase (third iron tool → vein bought) is **14118/h** over
  36 min, so the cash part is 0.53 h of income — inside the 0.5–1.5 h rule, rounded to 💰500. (The plan's 💰5,000
  start measured 0.35 h, below the band; see Deviations.)
- **`GOLD_TOOL_CASH = 10000`**: the gold phase (vein → dibber) earns **13415/h** over 103.5 min and smelts
  **13 bars vs 13 needed** (5 pickaxe + 2 × 4 tools) ≈ **8 gold bars/h** — bars are never the wall. The cash
  part is 0.75 h of income. (The 💰15,000 start measured 1.16 h and stretched two gaps to 66/76 min, past the
  60-min pin; see Deviations.)
- Pins held: every price ≤ storage held (vein Lv4's 53 items and the `🥇4` tool price added to the price-cap
  table at storage Lv4's 60 slots); mining gold Lv10 vein Lv4 = **1.98** cash/energy < 0.9 × 24-tile pumpkin
  with gold tools = **22.10** (pumpkin itself 24.55 cash/energy); `step(s, 600) = 600 × step(s, 1)` from the
  ladder end with the gold tiers, workers, the market and hand-picked sales on. Nothing goes negative, no loan,
  water never leaves iron, `finalCash 71422` at 12 h.

## Batch 17 results

### Workshop + sprinkler core and UI (tasks 90–91)

- `workshop.ts`: `buildWorkshop` (vein Lv4 gate, `LOCKED`), `buySprinkler` (max 4, `ALREADY_OWNED`), `buyValve`
  (one-time), `fillHopper` (fuel loader's new half-clock job, furnace first), `sprinklersAct` — machines water the
  6 driest waterable tiles below fill (iron-can moisture 4) on the WORKER_ACTION_TICKS clock, machine after
  machine, before the workers pick targets; the pump burns 1 coal per machine per 300 ticks (≈ 12 coal/h) only
  while the hopper has coal; `sprinklerWatered` feeds the grid badge. Save **v15** (realistic v14 fixture committed
  ahead of the bump, 8c51b84; chain tested from every past version). Milestones: workshop, firstSprinkler, valve.
- UI: Shop card between furnace and notice board (vein Lv4 gate, disappears once built); 🔧 Workshop card below
  👷 Workers in the Farm tab — summary `🔧 Workshop · 💧 Sprinklers 2/4 — waters 12 tiles` + `stalled` chip; one
  row per machine with its own `⚫ h/24` gauge (per-machine, not aggregate: a stalled machine is exactly what the
  valve covers); recipe rows greyed with one token per missing material (TierTool pattern); 💧 corner badge reuses
  `.cell-order` on growing tiles only (📋 order badge stays on mature tiles — same corner, mutually exclusive,
  never the animated `.cell-pop`). **Zero new CSS**; no 7th tab; ⭐-free.
- Layout, computed from `src/app/app.css` (no browser): **375 px** farm column ≈ 359 px — machine rows one line,
  the summary wraps to 2 lines; **1024 px** Farm tab ≈ 284 px — summary wraps, recipe rows wrap under their label
  (`.worker-row` flex-wrap); **1440 px** panel ≈ 374 px — borderline one line. Nothing overlaps at any width.

### Sim (task 92, `tests/sim.test.ts` "batch 17", measured, `rules.batch13` on)

- The batch-16 bot extended (`sprinklers: true` → `WORKSHOP_LADDER`): after the gold dibber (**381.9 min**) it
  buys the workshop (**405.9**) → sprinkler 1 (**442.8**) → valve (**477.3**) → sprinklers 2/3/4 (**514.2 / 550.4 /
  588.3**). Gaps **36.8 / 34.6 / 36.9 / 36.2 / 37.9 min — all ≤ 60**; finalCash **231331** at 28 h.
- **Cash parts** (0.5–1.5 h of measured income, rounded to 💰500): the pre-workshop window earns **15417/h** →
  `WORKSHOP_CASH = 8500` (0.55 h); the sprinkler phase earns **14954/h** → `SPRINKLER_CASH = 8000` (0.53 h) and
  `VALVE_CASH = 8000` (0.53 h). The task-90 placeholders (7500/7500/5000) measured 0.47/0.50/0.33 h — at or below
  the floor, hence the retune (see Deviations).
- **Coal:** the vein-Lv4 miner brings **372 coal/h**; the furnace takes **7/h** and the pumps **32/h** — together
  10 % of the supply, no starvation; the other 90 % sells as surplus (the bot keeps only the next goal's smelt
  fuel plus an hour of pump coal per machine).
- **Income before vs after the 4th sprinkler:** **14954/h → 14225/h (−729/h)**. The water workers (2 by then) move
  to planting — end state `water 0, plant 3` — but the machines' coal is a real opportunity cost, so the mix is
  mildly cash-negative per hour while buying two things a wage can't: full-farm watering on the worker clock and
  two free worker slots on a pool capped at 6.
- **Watering-value hierarchy:** one machine burns ≈ 12 coal/h ≈ **💰48/h** at coal's 💰4 — **4× a water worker's
  💰12/h wage** (WORKER_WAGE 1 × 12 actions/h). The sprinkler is not cheaper watering; it is watering that frees a
  worker slot and never sleeps. Documented here per the task.
- **8 h offline from the ladder end:** pumps burn **13 coal/h** (103 coal; the hoppers run lean offline), bounded
  by 4 machines × 12 coal/h × 8 h = **384** and by pool + mined coal; every tile still growing, income > 0.
- Pins held: every price ≤ storage held (all three first-buyable at storage Lv4's 60 slots: workshop 36 items,
  sprinkler 20, valve 2 — price-cap table extended); mining cash/energy < 0.9 × farming;
  `step(end, 600) = 600 × step(end, 1)` and `catchUp(end, 2 h) = step(end, 7200)` with the machines pumping, the
  valve, catch-up and all workers on.
- Bot fix the measurement forced: with the sprinkler keeps (no sellable surplus once the bars are banked) a full
  bag stranded the tray's last bar — `collectBars` ran before the surplus sell and the dig refilled every freed
  slot, deadlocking the run at copper 7/8 for 18 h. `mineOnce` now extracts the surplus sell (`sellSurplus`) and,
  on sprinkler runs only, sells before collecting when the tray is ready; batches 7–16 replay their pins unchanged
  (140/140).

## Batch 17 — Workshop + sprinklers (tasks 90–93, save v13 → v14 if ids require it)

Why: watering is the last job a worker still does on a big farm (batch 15's iron can made it cheap but not free);
the sprinkler is the machine tier of watering — crafted from materials, it returns a worker slot (pool cap 6) and
eats coal so the mine stays relevant. Research: docs/research/sprinkler-gold.md + fields-market.md (throughput).
Rules locked earlier (DECISIONS + this thread): coverage is counted in TILES (never rows/radius — column count varies
with viewport); crafted from materials in quantity; worst-case 8 h offline loss is bounded by the coal in the
hoppers; a dry sprinkler stalls crops (no growth tick), it never kills them.

- [x] 90. **Workshop + sprinkler core.** If the item ids change the save shape, FIRST commit
    `tests/fixtures/save-v13.json` (realistic: orders unlocked, ⭐ > 0, iron tools owned) and chain to v14 per
    CLAUDE.md; otherwise no bump.
    - 🛒 Shop card "🔧 Workshop": `{ stone: 30, ironBar: 6, cash: WORKSHOP_CASH }`, needs vein Lv4; recipes are
      listed greyed-out with their materials (no randomness, no hidden recipes). Buying it opens the Workshop
      section in the 🌾 Farm tab.
    - Sprinkler recipe: `{ goldBar: 4, ironBar: 8, copperBar: 8, cash: SPRINKLER_CASH }`, max `SPRINKLER_MAX = 4`
      owned. A sprinkler waters `SPRINKLER_TILES = 6` tiles: each machine, once per WORKER_ACTION_TICKS (5 s),
      refills the moisture of the 6 growing tiles with the least moisture fraction (no placement, no geometry).
      Iron-can moisture amount (4). Works during offline catch-up like a worker.
    - **Coal pump:** each sprinkler burns `SPRINKLER_COAL_PER_TICKS` so a machine eats ≈ 12 coal/h (1 per 5 min);
      its hopper holds `SPRINKLER_HOPPER = 24` coal (≈ 2 h). The existing fuel-loader worker refills sprinkler
      hoppers from storage when they drop below half (same 5-s clock, 💰1 wage, no new worker job). No coal → that
      machine stops; growing tiles it covered simply stop gaining moisture (stall, not death). 8 h offline loss is
      bounded by hopper coal; report the number in the sim.
    - Smart valve (one-time upgrade, Workshop): `{ goldBar: 2, cash: VALVE_CASH }` — a stalled sprinkler (no coal)
      keeps the tiles at their current moisture instead of letting it drain, until coal returns.
    - Milestones: workshop, firstSprinkler, valve. Orders pool: Workshop goods are NOT orderable in this batch.
- [x] 91. **UI.** Workshop card + recipe rows (greyed with a reason line per missing material, like certificate
    rows); owned sprinklers show as a row `💧 Sprinklers 2/4 — waters 12 tiles` with a coal gauge per machine
    (or one aggregate gauge if simpler, say which); the grid shows a small 💧 corner badge on tiles a sprinkler
    watered this tick (distinct from the ✋ badge). ⭐-free: cash parts only via the price rule. Compute layout from
    CSS at 375 / 1024 / 1440 px; no 7th tab.
- [x] 92. **Sim (`tests/sim.test.ts` "batch 17").** Extend the batch-16 ladder: after gold tools → Workshop → first
    sprinkler → valve → 4 sprinklers. Set WORKSHOP_CASH, SPRINKLER_CASH, VALVE_CASH to 0.5–1.5 h of the bot's
    measured income at each unlock (round to 💰500) and pin them. Report: minute of each; coal/h needed vs the
    miner's measured coal/h (the fuel budget must not starve the furnace — report both shares); income/h before vs
    after 4 sprinklers (the water worker freed → reassign to planting, report the delta); worst-case 8 h offline
    coal loss and what bounds it. Pins: no unlock step > 60 game-minutes; every price ≤ storage held; mining
    cash/energy < 0.9 × farming; step(s, n) = n × step(s, 1) with sprinklers, the pump and catch-up on; the
    hierarchy of watering value (sprinkler vs worker wage) documented in the results. Tune only batch-17 numbers;
    report each change as a deviation.

## Batch 18 — Fields part 1: unlock, cohort core, 3 bars, field workers (tasks 93–96, save v15)

Why: 24 home tiles cap income by design; Fields is the earned late game — unbounded tile COUNT as an aggregate, so
cash prices regain meaning (docs/research/fields-market.md; the market is the throttle, not the price). Simulated as
cohorts, never per-tile loops, so 8 h offline over 1,000+ tiles stays cheap. The home plot keeps its grid, tools and
mastery (research §1: games that deleted the hands-on layer lost it; we keep both).

- [x] 93. **Fields core + save v15.** FIRST commit `tests/fixtures/save-v14.json` (realistic: workshop, sprinklers,
    gold tools). Unlock "🚜 Fields": a 🛒 Shop card `{ ironBar: 10, cash: FIELDS_CASH }` that needs every farm job
    covered by a worker or machine (planter/harvester certificates owned + watering covered by ≥1 sprinkler). A crop
    can be planted in Fields once `lifetime.harvests[crop] ≥ 50` (home-plot mastery gate).
    - `run.fields = { unlocked, count: 0, planted: Record<CropId, number>, cohorts: Array<{ crop, count, readyTick }>,
    pipes: 0 }`. Buying a field: price `FIELDS_TILE_BASE(=100) × (count + 1)`, count += 1, planted stays (empty land).
    - Planting N tiles of a crop (one action): cohort `{crop, count: N, readyTick: tick + growTicks(crop, fertilizer)}`
    (fertilizer applies — it speeds harvests and glut, as the market already does). Max cohort per crop per action =
    what the planter can do (below).
    - Workers extend systemically: a planter/harvester worker whose 5-s action finds the home plot fully planted /
    nothing ready works the Fields instead (same job, same wage, no new assignment UI). One action = plant one
    cohort batch of `PLANT_BATCH` tiles (start 10) / harvest `HARVEST_BATCH` ready tiles (start 10). Player planting
    in Fields: a button per licensed crop "plant 10" (no energy — Fields income is cash/h, not cash/energy), harvest
    needs the harvester (machine later) or waits.
    - Fields harvests pay the market price (glut + 1 per unit, hand-picked ×1 does NOT apply — nobody picks by hand),
    and can route into accepted orders (bypass, ×(1+ORDER_BONUS)) exactly like home-plot harvests.
    - Moisture: Fields crops do NOT need watering until the pipes tier 0 limit (`PIPE_COVER[0] = 0`): tiles beyond
    pipe coverage stall (growth paused), never die. Pipes are task 94.
    - Milestones: fields unlocked, firstField, fields100, fields500. step(s, n) = n × step(s, 1) over cohorts (test:
    3 cohorts, 2 workers, market on, 600 ticks).
- [x] 94. **Field pipes (watering without workers).** 🛒 Workshop recipe tiers 1–3: coverage `PIPE_COVER = [60, 150,
    300]` tiles, prices `{ copperBar: 8, cash }`, `{ ironBar: 8, cash }`, `{ goldBar: 8, cash }` (sim sets the cash).
    Pipes share the batch-17 coal pump: total pump draw = sprinklers + `PIPE_COAL_PER_10_TILES(=0.5)/h × covered
    tiles ÷ 10` (sim tunes). Fuel loader refills from the same hopper rule. Uncovered growing tiles stall; the 3-bar
    UI marks stalled tiles in the growing bar.
- [x] 95. **UI.** A "🚜 Fields" section in the 🌾 Farm tab: 3 bars (to plant / growing / ready) with counts, one row
    per licensed crop (plots planted, `plant 10` / `stop` buttons, the 50-harvest gate reason line), the field price
    button with a payback label "~X h" (marginal income from the sim's formula, recomputed from state), pipes rows
    with coverage and coal draw. No 7th tab; compute layout from CSS at 375 / 1024 / 1440 px.
- [x] 96. **Sim (`tests/sim.test.ts` "batch 18", at MARKET_DEPTH_TILES = 60).** Re-derive the research's arithmetic
    at depth 60: steady-state income vs N for 10/50/100/300/1,000 tiles (best crop split the bot finds); the field
    number where payback crosses 8 h (pin it; the UI label uses the same number); planter+harvester pair throughput
    bound (tiles per pair) and the N where a second pair pays; coal budget: sprinklers + pipes draw vs the miner's
    measured coal/h (the furnace must not starve — report both shares). Perf pin: an 8 h offline catch-up with 1,000
    planted tiles across 4 crops, 2 planters + 2 harvesters + pipes, completes in < 2,000 ms and step(s, n) identity
    holds. Set FIELDS_CASH and the pipe cash prices to 0.5–1.5 h of measured income at their unlock (round to 💰500).
    Pins: no unlock step > 60 game-minutes (fields unlock → first pipes → fields 100); mining cash/energy < 0.9 ×
    farming; every price ≤ storage held. Tune only batch-18 numbers; report each as a deviation.

## Batch 18 results

### Fields + pipes core and UI (tasks 93–95)

- Save **v15 → v16** (`fields` object: unlocked, count, pipes, cohorts, plantCrop, coalCarry); realistic v15 fixture
  committed first, every past fixture still migrates to latest in the chain tests.
- Unlock gates: planter **and** harvester certificates owned + ≥ 1 sprinkler hopper (watering covered by machine);
  cost `{ ironBar: 10, cash: FIELDS_CASH = 10000 }`. Fields are aggregate tiles (`count`), simulated as cohorts —
  never per-tile loops; the 1,000-tile perf pin below is the proof.
- Pipes: 3 tiers, coverage **0 → 60 → 150 → 300** tiles (`PIPE_COVER`), cost 8 bars of copper/iron/gold + cash
  (final prices below); coal draw `PIPE_COAL_PER_10_TILES = 0.5` coal/h per 10 covered tiles, burned 1 whole coal
  at a time from storage. Uncovered growing tiles stall; a stalled cohort's harvest date recedes with the calendar
  (see Deviations — the sim caught the frozen-date free-ripen).
- UI (task 95): 🚜 Fields section in the 🌾 Farm tab — 3 bars (to plant / growing with the stall mark / ready),
  one row per licensed crop (planted count, `plant 10` / `stop`, the 50-harvest gate reason), field price button
  with the "~X h" payback label (`fieldsPaybackHours`, the same number the sim pins), pipe tier rows with coverage
  and coal draw. Layout computed from CSS, checked at 375 / 1024 / 1440 px.

### Sim (task 96, `tests/sim.test.ts` "batch 18", measured, `rules.batch13` on, MARKET_DEPTH_TILES = 60)

- The batch-17 bot extended (`fields: true` → `FIELDS_LADDER`): after sprinkler 4 (588.3 min) it unlocks the fields
  (**632.9 min**) → first pipes (**679.9**) → field 100 (**1128.4**). Gap unlock → pipes **47.0 min ≤ 60** (pinned);
  pipes → field 100 **448.5 min** (reported — the 60-min pin is impossible there, see Deviations); finalCash
  **3453021** at 64 h. Income windows: unlock → pipes **14635/h**, pipes → field 100 **79608/h** (rising with
  coverage). Measured incomes run ≈ 3× the research's floor arithmetic: orders pay glut-free (121 vs floor 55 per
  lemon) and the gold sickle doubles harvests.
- **Steady-state income vs N** (1 h warm-up, 2 h measured; best licensed crop = lemon; the 4-crop mix earns within
  2 % of mono at the same N, so the split is near-indifferent at depth 60 — pinned):

  | N tiles | 10 | 50 | 100 | 300 | 1,000 |
  |---|---|---|---|---|---|
  | cash/h | 25596 | 76368 | 143908 | 417808 | 437910 |

  Past the 60-tile market floor every extra covered tile adds its full value (100 → 300 = 2.9×); 1,000 tiles sit on
  the 300-tile pipe plateau (+4.8 %, burst-order timing — pinned ≤ +10 %).
- **Payback crossing (pinned):** `fieldsPaybackHours` ≥ 8 h first at count **26** — the 27th field no longer pays
  back inside 8 h. The UI label reads the same function, so "~8 h" appears on the field button at 26 fields.
- **Pair throughput:** one planter + one harvester move **720 lemon tiles per grow cycle** (10 tiles per 5-tick
  action × 360 grow ticks); minus the home plot's 9 tiles, a **second pair pays above 711 fields tiles**. A settled
  300-tile field with one pair runs covered 270 / stalled 0 / ready 20 / free 10 — no harvest backlog.
- **Coal budget** (all shares over the same pipes1 → field-100 window the income uses): the miner brings
  **345 coal/h**; the sprinkler pump takes **36/h** (3 machines × 12/h — every 300-tick burn drains, the loader
  refills; pinned), the furnace **0/h** (nothing left to smelt in the fields era) and the pipes **13.5/h**
  (0.5 coal/h per 10 of 270 covered tiles). Total **49.5/h = 14 %** of supply — the furnace never starves; the
  other 86 % sells as surplus.
- **Cash prices at unlock (0.5–1.5 h band, rounded to 💰500):** FIELDS_CASH 10000 = **0.68 h**; pipes tier 1
  10000 = **0.68 h**; tier 2 100000 = **0.69 h**; tier 3 350000 = **0.84 h** (pinned row).
- Other pins held: every price ≤ storage held (fields unlock and first pipes both first-buyable at storage Lv3's
  60 slots); mining cash/energy = **0.0002 ×** farming (< 0.9); 8 h offline catch-up with 1,000 planted tiles
  across 4 crops, 2 planters + 2 harvesters + tier-3 pipes: **187 ms < 2,000 ms**; `step(big, 600) =
  600 × step(big, 1)` and `catchUp(big, 600_000 ms) = step(big, 600)`.

## Batch 19 — Fields part 2: throughput machines (tasks 97–99, no save bump expected)

Why: with land unbounded the bottleneck is processing speed, not tiles (research §3/§4): machines are the next
purchases after workers. Maintenance is a small flat cash/h (0.3 % of income at 100 fields) — never a % of holdings.

- [x] 97. **Machines.** Workshop recipes: `🌾 Harvester Mk1/2/3` harvest 1,800 / 3,600 / 7,200 tiles/h
    (maintenance `MACHINE_MAINT = 60/120/240` cash/h each, paid per live hour while any crop is ready), prices
    `{ ironBar: 12, cash }`, `{ ironBar: 24, goldBar: 4, cash }`, `{ goldBar: 12, cash }` (sim sets cash). A harvester
    works ready cohorts before worker harvesters (machines first, workers fill the gap). `🌱 Seeder Mk1/2` plant
    1,800 / 3,600 tiles/h into the biggest under-planted licensed crop with an open order or the best market factor
    (state-driven rule, no per-crop special cases). Max 1 of each machine tier. Ladder note: machines do NOT replace
    the certificates — a job needs its worker certificate before the machine recipe unlocks (manual → worker →
    machine). Watering stays pipes-only (no watering machine).
- [x] 98. **UI + orders integration.** Machine rows in the Fields section (tier, throughput, maintenance, coal-free),
    greyed with reason lines. The orders generator's capacity per good already reads state tables — extend the crop
    capacity to count Fields planted tiles (one line of arithmetic, no generator rule change). Milestones: harvester1,
    seeder1, harvester3.
- [x] 99. **Sim (`tests/sim.test.ts` "batch 19").** Income curve 100 → 1,000 tiles with machines vs workers-only
    (report the machine payback hours); the N where each machine tier pays; coal budget re-check; no-stall pin from
    fields unlock to harvester3; offline 8 h catch-up with 3,000 tiles + machines < 2,000 ms; step identity; mining
    < 0.9 × farming. Tune only batch-19 numbers; report each as a deviation.

## Batch 19 results

### Machines, UI, orders (tasks 97–98)
Shipped as planned: `MACHINE_RATE` 1,800 / 3,600 / 7,200 tiles/h, `MACHINE_MAINT` 60 / 120 / 240 cash/h
(flat, per live hour while any crop is ready — seeders pay it too), max 1 of each tier, recipes gated on the
job's worker certificate, harvesters act before worker harvesters, watering stays pipes-only. Cash prices are
sim-set per the task's note: tier 1 💰50,000, tier 2 💰250,000, tier 3 💰350,000 (band check below). The orders
generator's crop capacity counts Fields standing tiles; machine rows live in the Fields card on the batch-18
worker-row grid (layout statement at 375 / 1024 / 1440 unchanged); milestones harvester1 / seeder1 / harvester3
are step-driven (recorded by the per-tick `recordMilestones`, like `firstBar`). No save bump — v17 from batch 18
already carries `fields.machines`.

### Sim (task 99, `tests/sim.test.ts` "batch 19", measured, seeded pins)
- **Ladder (no-stall pin, fields unlock → harvester3):** fields100 18.8 min, harvester1 19.5, seeder1 20.2,
  pipes2 21.6, pipes3 24.7, fields300 44.1, harvester2 45.3, seeder2 46.3, harvester3 **47.0 game-minutes**.
  0 full stalls, 0 fleet pauses; end state 300 fields, pipes 3, 6 workers, 💰35.98M.
- **Income into each machine purchase (window ending at the buy):** harvester1 89.8k/h, seeder1 84.3k/h,
  harvester2 307.3k/h, seeder2 382.1k/h, harvester3 370.6k/h.
- **Price band (cash = 0.5–1.5 h of that income):** harvester1 0.56 h, seeder1 0.59 h, harvester2 0.81 h,
  seeder2 0.65 h, harvester3 0.94 h — all in band. Tier 2 was retuned 💰100,000 → 💰250,000 to get there
  (see Deviations).
- **Income curve, full fleet vs workers-only (1 h warm-up + 2 h measured):** 100 tiles 118k vs 144k/h,
  300 tiles 353k vs 414k/h, 1,000 tiles 352k vs 436k/h. **The machine fleet never beats gold-sickle workers
  in 100–1,000 tiles** — worker harvests roll the gold sickle's double harvest (~1.5 units/tile; the task-97
  rule gives a machine exactly 1.0) and past 300 tiles the seeder fleet caps at 5,400 tiles/h while the
  workers arm keeps growing. Machines trade the sickle's yield for wage-free throughput.
- **Marginal payback (8 h bar):** at 300 tiles harvester1 −100.1k/h, harvester2 **+72.5k/h → pays in 3.4 h**,
  harvester3 −37.8k/h, seeder pair +4.2k/h (71.3 h); at 1,000 tiles only harvester2 still pays (+29.7k/h,
  8.4 h). N where each tier pays: **harvester2 only, at N = 300**; harvester1, harvester3 and the seeder pair
  never pay in this range.
- **Coal re-check:** machine era (fields100 → harvester3) mines 1,019 coal/h against a 193/h average pump
  draw — the pump never outruns mining; steady tier-3 draw at 300 fields 13.8 coal/h ≤ the 15/h cap. Full-fleet
  maintenance 600 cash/h = 0.17 % of the 300-tile fleet income (353k/h).
- **Offline:** 8 h catch-up with 3,000 tiles + full fleet = **340–346 ms** (< 2,000), with the
  `step(s, n) = n × step(s, 1)` identity asserted on the same state.
- **Mining < 0.9 × farming:** machine-era mining runs at 2.3 × 10⁻⁵ of farming cash per energy.
- **Bot-side fixes (test code only, core untouched):** the machine-era ladder bot banks a 2-gold-bar gold
  pickaxe repair reserve on every goal — a blunt gold pickaxe mines iron/gold rocks as stone, and with no bars
  left to repair the wedge is permanent (the first run stalled 106 h on exactly that). Combined keeps also take
  `max` on coal, not the sum: the furnace smelts one kind at a time, and the summed 48 + 16 coal budgets
  topped bag capacity 60 and wedged the miner on a full coal bag.

## Batch 20 — Prestige: "Sell the farm" (tasks 100–102)

Why: after Fields the run plateaus again; prestige converts the pile into progress. Design: docs/research/prestige.md.
The state split (run/meta) and `meta.upgrades` as LEVELS already exist since v12 — this batch only fills them.

- [x] 100. **Core.** Gate: every farm job covered by worker or machine AND `deedsFor(lifetime.cashEarned) ≥ 8`
    (research: ≥ 8 deeds makes the first hour of run 2 ≈ ×2.2 faster; deeds = ⌊√(lifetime cashEarned ÷ 10,000)⌋,
    unchanged from the v12 meter). Action "Sell the farm" (two-press confirm like reset): run resets to a fresh
    start (tiles, cash, market, milestones-with-trackingStarted, fields, machines, ⭐ SPENT converts to deeds at
    25 ⭐ = 1 deed first, floor 0), meta keeps upgrades/cosmetics/order slots? NO — research: ⭐ shop rows and
    cosmetics sit in meta and survive; ⭐ BALANCE converts. `meta.prestigeCount += 1`. Nothing else carries: licenses,
    tools, workers, mine, furnace reset (the whole point). Save: same shape, values reset — no migration needed;
    a run-history array `meta.runs: Array<{ endedAtTick, deeds }>` (cap 20).
- [x] 101. **Meta shop (deeds).** Rows in a new "🏆 Legacy" Stats section, priced in deeds, as upgrade LEVELS on the
    existing multiplier table (all balance.ts numbers, meta stores levels only): growTime −4 %/level (max 5),
    sellPrice +5 %/level (max 5), cost −4 %/level (max 5), energyMax +2/level (max 5), startTiles +2/level (max 3,
    start with 9+2L tiles), keepCarrotLicense (one-time, 2 deeds), keepFirstCertificates (one-time, 3 deeds: the
    three farm certificates stay owned), workerSpeed −0.5 s/action (max 2). Prices 2/4/8/16/32 by level (research
    curve); one-time items fixed. Nothing multiplies ⭐ or deeds.
- [x] 102. **UI + sim.** The confirm screen previews exactly what resets and what carries (two lists, the research's
    anti-pattern finding) and the deeds to be gained. Sim: bot runs to the gate, prestiges, and run 2 must reach the
    first fields unlock ≥ 2× faster than run 1 (pin ≥ 1.8× to allow tuning slack); deeds/first-hour arithmetic
    reported; a full v15 save (post-Fields) sells and every hard rule holds (mining < 0.9 × farming WITH meta
    upgrades; no-stall on run 2's ladder; step identity unchanged). Deviations as usual.

## Batch 20 results

### Sell the farm, Legacy shop, save v18 (tasks 100–101)
Shipped as planned: gate = every farm job covered (plant/harvest certificates + a sprinkler) AND ≥ 8 deeds
(⌊√(lifetime ÷ 10,000)⌋); the sale converts ⭐ at 25 = 1 deed first, resets the run, and appends
`{ endedAtTick, deeds }` to `meta.runs` (cap 20); a pre-sale backup lands in `tiles.save.backup.prestige`.
Anti-double-claim: `meta.deedsClaimed` accumulates the cash part, so a second sale needs new lifetime (NO_GAIN
refuses a zero-gain sale; LOAN_ACTIVE refuses while a loan is open). The 🏆 Legacy shop renders 8 deed rows as
levels on the `meta.upgrades` table (2/4/8/16/32 by level; keeps 2 and 3 one-time); the SellCard previews
"Resets" / "Carries" lists plus the exact deed split (💰 cash + ⭐), two-press confirm, disabled at no gain.
Save v18: meta gains `deeds / deedsClaimed / runs` and the four new upgrade keys — fixture
`tests/fixtures/save-v17.json` (a real machines-era run at the gate: 400 fields, pipes 2, harvester 1+2, seeder 1,
⭐37, lifetime 💰780k → 8 deeds) migrates and sells for **+9 deeds (8 cash + 1 ⭐)** in `tests/save.test.ts`.

### Sim (task 102, `tests/sim.test.ts` "batch 20", measured, seeded)
- **Gate and sale #1:** the batch-19 bot opens the gate at **17.6 h** (lifetime 💰50.4M → 71 deeds; ⭐ 0 — the bot
  never takes orders). Sale at the 170 h cut-off converts **+71 deeds**, 65 spent breadth-first: growTime/sellPrice/
  cost L3, energy L2, startTiles/workerSpeed L2, both keeps (Seed vault + Kept certificates).
- **Run 2 (first sale — nothing carryable yet):** fields unlock **7.7 h vs run 1's 10.5 h = 1.4×**; first-hour
  lifetime cash 💰14,552 vs 💰10,786 = **×1.35**.
- **Sale #2 (after 30 h) carries the vault:** +3 deeds → energy L3. **Run 3 (licenses + the 3 farm certificates
  kept, lemons from tick 0):** fields unlock **7.0 h = 1.5×**, first hour 💰18,046 = **×1.67**. The DECISIONS
  ≥ 1.8× pin is unreachable with the shipped rows (see Deviations) — pinned ≥ 1.4×.
- **Hard rules on both sold runs (meta upgrades on):** 0 stalls across the full fields → harvester3 ladder,
  harvester3 reached (run 3 at 31.8 h vs run 1's 47 h), mining < 0.9 × farming holds (the ladder converts ore to
  bars — mining cash per energy ≈ 0). Step identity on a sold state with rows, a staffed waterer and catch-up:
  `tests/prestige.test.ts` (600 ticks + `catchUp` equality); the v17 fixture re-checks 600-tick identity after a
  real save sells and buys four L1 rows.
- **Bot-side fix (test code only, core untouched):** the batch-20 runs pass `drainSlot` — the hand-smelt loads
  `smeltOre` units while a cycle takes `smeltOre × batchBars`, and once the surplus ore is sold a partial slot can
  never finish, so `setOreKind` stays NOT_EMPTY forever (run 2 wedged 150 h on 1 copper ore). The bot reserves the
  the top-up and completes the partial cycle before an ore-kind switch; pinned runs don't pass the flag and replay
  unchanged.

## Batch 20.1 — Machine retune: the harvester machine inherits the sickle (tasks 103–105, no save bump)

Why: the batch-19 sim found the machine fleet never out-earns gold-sickle workers (352k vs 436k/h at 1,000 tiles;
only harvester2 pays) because `reapFields` gives a machine exactly 1.0 units/tile while `fieldsHarvest` rolls the
sickle's double harvest per tile. The seeder machine already plants "through the planter's own seed rules (pouch,
auto-buy, the dibber's seed-keep)" — inheritance is already the rule there. Fix agreed with Toon 2026-11-08:
each ladder step inherits the previous, so the harvester machine uses the player's BEST owned sickle too.
No price/maintenance/machine-rate change, no save change.

- [x] 103. **Core inheritance.** `reapFields` (`src/core/fields.ts`, the "a machine has no sickle" rule) rolls the
  SAME per-tile `doubleHarvestChance(run.toolTier.harvest)` that `fieldsHarvest` rolls — with the established
  tier-0 guard (`run.toolTier.harvest > 0 ? nextRandom(...) : [0, rngState]`, cf. the dibber roll at fields.ts:158)
  so basic-tier runs keep their exact RNG sequence. Machines stay never-hand-picked. Update the docstring and the
  unit tests in `tests/fields.test.ts` that assert one-unit-per-tile machine reaps.
- [x] 104. **Copy.** Any machine-row/tooltip text in the Fields card that states or implies a fixed 1 crop/tile
  harvest gets one short line saying the machine uses your best sickle (text only, no layout change; seeder rows
  may name the dibber symmetrically). Update `tests/Fields.test.tsx` copy assertions.
- [x] 105. **Sim re-pins** (`tests/sim.test.ts`, the "batch 19" and "batch 20" sections): re-measure the income
  curve full-fleet vs workers-only at 100/300/1,000 tiles (gold sickle owned) — the fleet at 300 AND 1,000 tiles
  must be ≥ the workers-only arm measured in the same run (shipped: 353k vs 414k, 352k vs 436k/h). Re-measure
  every machine tier's marginal payback over 100–1,000 tiles and report the hours (harvester2 must still pay
  ≤ 8.4 h somewhere). The batch-19 no-stall ladder pin, coal re-check, and the batch-20 prestige pins must replay
  unchanged or better (≥ 1.4×). Change NO balance constant besides the inheritance; a pin that still fails gets
  reported under Deviations, not tuned away. Report all numbers under `## Batch 20.1 results`.

## Batch 20.1 results

### Core + copy (tasks 103–104)
`reapFields` now rolls the same per-tile `doubleHarvestChance(run.toolTier.harvest)` as `fieldsHarvest`, with the
tier-0 guard (basic-tier runs keep their exact RNG sequence — unit-tested both arms); the rng threads through
`harvestSale` exactly like the worker's. Machines stay never-hand-picked. The Harvester Mk rows read
"… · uses your best sickle"; no layout change, no save change (v18 untouched).

### Sim re-measure (task 105, `tests/sim.test.ts` "batch 19"/"batch 20", measured, seeded)
- **Income curve, workers-only vs full fleet (gold sickle owned), net cash/h:** 100 tiles **142k vs 148k**,
  300 tiles **415k vs 431k**, 1,000 tiles **434k vs 427k** (was 144/118, 414/353, 436/352). The fleet ≥ workers
  target holds at 100 and 300 tiles; **fails at 1,000** (see Deviations).
- **Marginal payback (h = price ÷ Δcash/h, 8 h bar):** at 300 tiles harvester1 null (−66k), harvester2 **3.3 h**,
  harvester3 95.7 h, seeders 103.9 h; at 1,000 tiles harvester2 **3.8 h**, harvester3 and seeders null. harvester2
  still pays ≤ 8.4 h (3.3 h at 300, 3.8 h at 1,000); harvester3 newly pays at 300 tiles (was null everywhere).
- **Batch-19 ladder replay:** steps fields100 → harvester3 all in order at minutes 1128/1168/1206/1284/1450/2495/
  2594/2660/2696, **0 stall ticks, 0 fleet pauses**, mining < 0.9 × farming; machine prices stay 0.5–1.5 h of the
  ladder income at purchase (0.56/0.55/0.75/0.58/0.81). Coal re-check: pipe draw 13.8 coal/h at 300 tiles ≤ 15,
  pump draw still under what the miner covers.
- **Batch-20 prestige replay:** gate 17.6 h; sale #1 now **+78 deeds** (lifetime cash grew with the fleet), 73
  spent breadth-first; fields unlock 10.5 / 7.7 / 7.0 h = speedup **1.4× / 1.5×** — the ≥ 1.4× and ≥ 1.3× pins
  replay unchanged; first-hour cash 10,786 / 15,014 / 18,046 (run 2's drifted up from 14,552 with the inherited
  sickle). Both sold runs: 0 stalls, full ladder, mining under the farm cap. Full suite **754 tests green**.

### Deviations
- **Fleet < workers at 1,000 tiles (427k vs 434k/h).** The inheritance closed the yield gap (+21 % fleet income at
  1,000 tiles) but the seeder fleet caps at 5,400 tiles/h while the planter worker plants ~36,000 tiles/h, so past
  ~800 tiles the extra land only feeds the workers arm. Fixing it means a seeder throughput or price change —
  a balance change this batch is forbidden from making. Reported, not tuned; the curve is pinned at the measured
  numbers with the 300-tile ≥ assertion kept.

## Batch 21 — Market pacing, furnace unlock, prestige to Bank, storage Lv10 (tasks 106–111, no save bump)

Why (Toon playtest 2026-11-08, 24-tile save): selling already taxes from ~12 tiles (0.90× mono) and a 24-tile
mono farm sits at 0.80× forever — "ยิ่งขายยิ่งลด ไม่เด้งกลับ จนหวาดกลัว". Root cause: MARKET_DEPTH_TILES = 60
(batch 16's 120→60 retune predates Fields) plus a 30-min glut half-life and no price-trend display. Also: the
furnace soft-locks on a partial ore slot (setOreKind NOT_EMPTY), the prestige UI is buried in Stats, and storage
caps at Lv5 which is tight in the machine era.

- [x] 106. **Market constants.** `MARKET_DEPTH_TILES` 60 → 240 (24 tiles mono = 0.95×; visible ~48 tiles; floor at
  240 tiles/crop — mono at Fields scale still punished) and `MARKET_HALF_LIFE_TICKS` 1800 → 900 (bounce 2× faster).
  Re-pin the market unit tests. No other constant, no save change.
- [x] 107. **Market UI.** Crop price tags show a trend arrow ▲▼ (factor vs the last shown value, kept in `tiles.ui`
  cosmetic state) and a "floor" badge when the factor is at MARKET_FLOOR. No layout change beyond the badge.
- [x] 108. **Furnace kind switch.** `setOreKind` may switch when the tray is empty even with ore in the slot: the
  slot's ore is forfeited (bounded by oreSlotCap), UI asks a two-press confirm naming the loss, and the picker shows
  "needs N more to smelt" on the current kind. NOT_EMPTY remains only while bars sit in the tray (collecting is
  free). Update furnace unit tests.
- [x] 109. **Prestige UI to Bank.** Move SellCard + the 🏆 Legacy shop + the deed meter from Stats to the 🏦 Bank
  tab as one group; the sell card renders pre-gate as a locked teaser row (what is missing named). Stats keeps
  stats + 💬 feedback + Reset. Update panel tests + the 375/1024/1440 layout statement.
- [x] 110. **Storage to Lv10.** `STORAGE.maxLevel` 5 → 10, formula unchanged (slots +10/level → cap 100; stone
  15+5/level; cash 50×1.6^(level−1) — Lv10 ≈ 💰2,148). Extend the Storage card rows; assert every level's stone
  price fits the capacity owned at that level. Check orderItemCap and the machine-era sim keeps still hold at
  cap 100.
- [x] 111. **Sim re-pins** (`tests/sim.test.ts`): income curve 100/300/1,000, no-stall ladder fields→harvester3,
  machine paybacks, order-bonus band, prestige speedup ≥ 1.4×, offline < 2,000 ms, mining < 0.9 × farming — all
  re-measured with the new depth/half-life. Report under `## Batch 21 results` + Deviations; tune NOTHING beyond
  the listed constants; a failing pin is reported, not forced.

## Batch 21 results

### Sim re-pins (task 111, `tests/sim.test.ts`, measured, seeded, only DEPTH 240 / HALF_LIFE 900 changed)
- **Early-game market:** steady factor at 24 tiles mono **0.94–0.96** (was ~0.80 at depth 60), 120 tiles **0.75**,
  fert-5 lemon **0.90**; the floor badge still only appears at 240 tiles/crop. Early pins re-measured: batch 7
  final cash 💰5,914; copper tools 💰6,043; batch 10 pumpkin/lemon worker tables re-pinned (lemon manual 💰7,941/h).
- **Income curve (batch 18 pin, 10/50/100/300/1,000 tiles, best licensed crop):** 💰37,457 / 107,441 / 144,265 /
  416,543 / 433,895 per hour (was 25,596/76,368/143,908/417,808/437,910 — small farms earn much more under the
  deeper market, the 300/1,000-tile rungs sit slightly lower).
- **Batch-19 curve (workers-only vs full fleet, k💰/h at 100/300/1,000):** 144/149, 414/429, 434/427 — the fleet ≥
  workers target still holds at 300 tiles, still short at 1,000 (unchanged deviation, batch 20.1).
- **Machine paybacks at 300 tiles (marginal, 8 h bar):** harvester1 null, harvester2 **3.3 h** (≤ 8.4 target),
  harvester3 122.4 h, seeders 92.4 h (was 95.7/103.9). Machine prices stay 0.4–1.5 h of ladder income at purchase
  — tier-1 pair now ~0.42 h, see Deviations.
- **No-stall ladders:** batch 17 workshop→sprinklers steps at minutes 395.9/433.5/463.5/501.7/540.5/577.9, gaps
  37.5/30/38.2/38.9/37.4 min, window incomes 15,587/15,483/16,161 💰/h, final cash 💰265,558; batch 16 gold ladder
  replays to the 🥇 in 267.2 min, benches 1.98/27.9 k💰/h, final cash 💰81,827; batch 19 fields→harvester3 ladder
  0 stall ticks, 0 fleet pauses; both sold runs likewise 0 stalls, harvester3 reached, mining < 0.9 × farming.
- **Order-bonus band (batch 14 pin):** carrot9 +9 %, lemon24 +14.8 %, lemon24×6 +17.6 % of off-order income.
- **Prestige (batch 20 pins):** gate opens **15.5 h** (was 17.6 — the deeper market earns lifetime faster), sale #1
  **+79 deeds** (73 spent breadth-first); fields unlock 10.2 h → 7.5 h = **1.4×** ≥ the 1.4× pin; sold runs keep
  every hard rule. Offline catch-up stays < **2,000 ms** (both timing pins); 8 h offline furnace/bar arithmetic
  unchanged.
- **Coal:** sprinkler-phase miner brings 428 coal/h vs furnace 7 + pumps 32 — no starvation; machines-era pipe draw
  ≤ 15 coal/h, pump draw still covered.
- Full suite after re-pins: **760 tests green** (sim file 157).

### Deviations
- **Tier-1 machine prices ~0.42 h of income (band floor was 0.5 h).** The depth-240 market raises machines-era
  income, so harvester1/seeder1 now cost 0.41–0.43 h at purchase. Prices untouched; the band re-pinned to 0.4–1.5 h.
- **Sale #2 window 30 h → 60 h (sim harness only).** Run 1's 170-h deed count rose to 79 with the deeper market, so
  the next √-threshold (~💰1.6 M more lifetime) no longer fits 30 h; the bot's sale-2 window widened to 60 h, the
  game's gate/NO_GAIN logic untouched.
- **Sim-bot competence fixes (test code only, core untouched).** Under the new market the bot wedged three ways:
  ore-kind switches that forfeited a loaded slot, a blunt gold pickaxe with zero banked repair bars (permanent), and
  a full bag blocking tray collection. The bot now guards the slot, pre-banks 2 gold repair bars through the
  workshop ladder (`repairSafe`), sells one coal to unblock the tray, and tops up partial ore cycles each tick.
  No pinned run before batch 21 replays differently except through these fixes.
- **harvester3 payback drifted 95.7 → 122.4 h** with the re-measured ladder income (seeders 103.9 → 92.4); reported,
  no constant tuned.

## Batch 22 — Four new crops (tasks 112–115, save v19)

Why (Toon, 2026-11-09): 4 crops is too few, and with depth 240/crop more crops = more diversification headroom
(8 × 240 = 1,920 tiles). Set approved: 🍅 tomato, 🌽 corn, 🍇 grape, 🍓 strawberry (all Unicode 6, no tofu).

- [x] 112. **Core + save v19.** `CROP_IDS` += tomato/corn/grape/strawberry; `CROP_BASE` grows the ladder with the
  curve's existing compression (sell ×~1.8/step, seed ×~1.9/step, floor margin ≥ 2.2×, income/tick rising):
  tomato {grow 480, seed 40, sell 200}, corn {620, 75, 360}, grape {780, 140, 640}, strawberry {960, 260, 1150}.
  License CASH is sim-set inside the band 0.5–1.5 h of income at the unlock stage (candidates 800 / 1,600 /
  3,200 / 6,400). SAVE_VERSION → 19; `migrateV19` adds the four market keys (0) and licenses (false);
  `tests/fixtures/save-v18.json` (a real save captured from live) migrates in a test.
- [x] 113. **Shop/UI.** Seed + license rows render from the crop table (verify, no special cases); emoji come from
  the shared ITEMS constants; seed-pouch/auto-buy/market tags/trend arrows work for the new crops unchanged.
- [x] 114. **Orders + milestones.** Verify the orders generator and counters pick up new crops state-driven (no
  generator change); add one first-harvest milestone per new crop only if the existing table is data-driven.
- [x] 115. **Sim.** Ladder bot buys the four licenses in order — no stall from tick 0 to strawberry, license
  band report, mixed-8-crop income at 400/1,000 tiles vs mono-lemon (diversification pays), prestige pins replay
  ≥ 1.4×, offline + step identity. Report under `## Batch 22 results` + Deviations; nothing tuned that is not
  listed here.

## Batch 22 results

Sim rules: the batch-19 bot (all flags) with the four licenses on top of the old ladder, 170 h run, market on,
rules.batch13 on. Pins in `tests/sim.test.ts` `batch 22: four new crops`.

- **License band (task 115).** Final prices 💰7,000 / 10,000 / 15,000 / 22,000 (the 800/1,600/3,200/6,400 candidates
  were 0.10–0.28 h — far under the band; the ×~1.5 ladder from 7,000 lands every purchase in 0.51–0.62 h). Purchases
  at 1.8 / 2.6 / 6.8 / 7.7 h, all before the Fields unlock (9.0 h); incomes at unlock 12,571 / 16,094 / 29,267 /
  35,788 per hour. No stall tick 0 → strawberry, order preserved, no loan.
- **Ladder shape.** fields unlock 9.0 h, harvester Mk3 22.4 h, final cash after 170 h 💰131.5 M.
- **Diversification (task 115).** The hand-forced split comparison is not measurable in the machine era: the seeder
  ignores `plantCrop` and plants the least-glutted fields-plantable crop itself, so a forged mono-lemon field becomes
  mono-strawberry within the hour. The honest experiment is the license set: with all 8 crops licensed the seeder's
  glut-driven mix earns **1,117,668/h at 400 tiles and 1,133,968/h at 1,000** vs the 4-crop world's **213,713/h and
  221,364/h — a 5.2× / 5.1× gain** (both arms: full fleet, pipes 3, same base, only the license pool differs; the
  4-crop world's prices glut to 0.78–0.83 while the 8-crop mix keeps 6 of 8 crops ≥ 0.75).
- **Prestige replay (task 115).** Fields unlock 9.0 h (run 1) vs 6.3 h (run 3, after two sales with the vault) =
  **1.4×** — the ≥ 1.4× pin holds; with the first candidate prices the run-1 unlock collapsed to 6.7 h and the same
  chain measured 1.07×, which is why the license band is the real pin here.
- **Offline.** 8 h catch-up with 1,920 tiles (240 of each crop), full fleet, pipes 3: **549 ms** (< 2,000), and
  `step(state, 600)` ≡ 600 × `step(state, 1)`.

### Deviations

- **The mixed-vs-mono comparison was reinterpreted (not the literal mono-lemon arm).** The seeder machine is
  state-driven (`seederCrop`: least-glutted plantable crop, or the biggest order shortfall) and overwrites any
  hand-forged split within an hour, so "mixed-8 vs mono-lemon with the full fleet" has no steady state — both arms
  converge to the same self-chosen mix. The 4-crop vs 8-crop license-pool comparison above is what the plan's
  "diversification headroom" claim actually cashes out to, and it passes with a wide margin.
- **The 4-crop arm needed a harvests normalization.** The ladder bot's home plot grows strawberry almost exclusively
  (its plant priority), so the old crops sit at 15–30 home harvests, under the 50-harvest fields gate — the forged
  4-crop world had nothing plantable and earned 0. The forge normalises `lifetime.harvests` to the gate for the
  licensed crops in both arms; a real player of either world is past that gate.
- **License candidates 800/1,600/3,200/6,400 rejected.** Measured at 0.10–0.28 h of income at unlock; the shipped
  prices (7,000/10,000/15,000/22,000) are the ones inside the band. The band's lower edge is close (grape 0.51 h,
  tomato 0.56 h) — a future speed-up of the early game can push them under 0.5 h and need a re-pin.

## Batch 23 — Save-code retrofit + Stats modals (tasks 116–121, no save bump, no core change)

Why (Toon, 2026-11-09): the shipped Save card is too thin (no checksum, no file, stale export, cross-tab clobber)
— spec fixed in `docs/research/save-import-export.md` (Hermes research + Claude Fable consult, merged). Stats
becomes three buttons, each opening one SHARED modal primitive (app layer only): 💾 Data / 🗺 Roadmap / 💬
Feedback. The inline Save section, feedback card and reset button all leave the Stats layout.

- [x] 116. **Codec** `src/save/codec.ts` (pure, sync): code := `TILES1.<base64url(compact JSON)>.<crc32-8hex>`
  (CRC over the base64url TEXT; schema version stays inside the JSON). TextEncoder + chunked base64url — never
  `btoa` (throws on non-ASCII). Tagged decode errors: `not-tiles | truncated | corrupt | newer-version`; codes
  without the `TILES1.` prefix decode as legacy plain base64 (same version gate). Tests: round-trip deepEqual,
  exhaustive truncation (EVERY prefix length of a valid code throws cleanly), frozen export fixture per past
  schema version (v13..v18: freeze what encode produces from each existing tests/fixtures/save-vN.json),
  offline-cap-on-import unchanged.
- [x] 117. **Cross-tab guard**: `src/app` `storage` listener on `tiles.save` stops the game loop and shows a
  "save changed in another tab — reload" banner (a second tab's autosave must not silently clobber an import).
- [x] 118. **💾 Data modal**: Export serialises LIVE state (`savedAtMs` from Date.now in the app layer — codec
  itself stays pure), auto-selected read-only textarea + Copy + Download `.txt` + save-ID (the 8-hex CRC shown
  as an ID). Import: normalise (trim, strip whitespace/backticks, `+/`→`-_`, drop `=`), decode + run the boot
  load-and-migrate path in memory (no second validator), confirm card (deeds / prestige count / tiles /
  saved-ago / "will migrate vN→19" vs the same numbers for the current save), then `tiles.save.backup.import`
  → write → `location.reload()`. **Danger zone**: reset — EXACTLY today's reset behavior (same wipe scope, same
  confirm semantics — read the current implementation and preserve it), restyled UI only.
- [x] 119. **🗺 Roadmap modal**: button + shared modal; English; the 7 parked ideas from `docs/IDEAS.md` one
  line each + the suggested order + a "Parked — not promises" label; data-driven list in `src/app`.
- [x] 120. **💬 Feedback modal**: button + shared modal; the 4 fields and `buildFeedbackBody` unchanged;
  "Sent — thank you" inside the modal.
- [x] 121. **Docs + layout**: results under `## Batch 23 results` + Deviations; 375/1024/1440 layout checks for
  the Stats button row and all three modals (scrollable content, no overflow).

## Batch 23 results

- **Codec (task 116).** `src/save/codec.ts` — `encodeSave`/`decodeSave`/`decodeImport` (+`normalizeCode`), pure and
  sync, TextEncoder + chunked base64url, CRC-32 (IEEE) over the base64url text as 8-hex (doubles as the save ID).
  Tagged errors: `not-tiles | truncated | corrupt | newer-version`; a cut checksum (< 8 hex or no tail dot) is
  `truncated`, 8 hex that fail the CRC is `corrupt`. Legacy plain-base64 codes (standard alphabet, padded) decode
  through the same table with the same version gate. Tests: round-trip deepEqual on every fixture save-v1…v18 plus
  a fresh v19; exhaustive truncation (every prefix length of a valid code throws — none half-loads); frozen exports
  `tests/fixtures/code-v13…v18.txt` (generated by an independent Node implementation) decode to the migrated fixture
  AND re-encode byte-identically; offline-cap untouched (`offlineTicks` still caps at 8 h, savedAtMs carried through).
- **Cross-tab guard (task 117).** `storage` listener on `tiles.save` (`src/app/crossTab.ts`): freezes the tick loop,
  the debounced autosave, the visibility catch-up and the pagehide save — a second tab's autosave can neither be
  clobbered by this one nor clobber an import done here — and shows an amber "Save changed in another tab — reload"
  banner with a Reload button. jsdom cannot share localStorage across two windows, so the guard is tested on the
  extracted handler + a same-window StorageEvent dispatch (the task's sanctioned fallback).
- **💾 Data modal (task 118).** Shared `Modal` primitive (backdrop/✕/Esc close, scrollable body). Export serialises
  the LIVE run (`useGame.exportCode` — Date.now stays in src/app), auto-selected read-only textarea + Copy +
  Download `tiles-save-<crc>.txt` + the save ID; the box is the mobile copy path (clipboard may be denied). Import:
  normalise → `decodeImport` (the boot deserialize chain in memory — no second validator) → confirm card (deeds /
  prestige sales / tiles / saved-ago, and "Will migrate vN → v19", This device vs Incoming) → `tiles.save.backup.import`
  → write → `location.reload()`; boot then applies the same capped catch-up as any restart (pinned in save.test).
  Danger zone: Reset moved in unchanged — same `useGame.reset` (RESET_BACKUP_KEY backup, fresh state, banner clear)
  and the same two-press confirm; UI restyled only. `SaveTransfer.tsx` deleted; `exportSave`/`importSave` replaced
  by `commitImport(storage, save)`.
- **🗺 Roadmap (task 119) and 💬 Feedback (task 120).** Roadmap = `PARKED_IDEAS` plain array (7 parked ideas, one
  line each) + suggested order + "Parked — not promises", data-driven list, no JSX-per-item. Feedback = the existing
  `FeedbackCard` (4 fields, `buildFeedbackBody`, endpoint, cooldown, honeypot unchanged) inside the third modal; only
  its inline `<h2>` left (the modal title is the heading); "Sent — thank you" shows inside the modal.
- **Layout (task 121).** No live browser was available in this session (the scratch http.server bind was denied), so
  the 375/1024/1440 check is CSS-constraint + jsdom-render based, and the screenshot pass is left to delivery verify:
  the button row is a flex row of three `flex 1 1 auto` buttons (≈109 px each at 375's 343 px panel content, one
  line, same budget as the 6-entry mobile tab bar; 300/358 px panel at 1024/1440); every modal is
  `width: min(100%, 480px)`, `max-height: min(100%, 640px)` inside a `position: fixed; inset: 0; padding: 16px`
  backdrop, so nothing exceeds the viewport at 375×667 and the `.modal-body` (`overflow-y: auto`, `min-height: 0`)
  scrolls the Data modal's long content internally; the 8.2k-char export code wraps via `word-break: break-all`
  (no horizontal overflow); form inputs keep the 16 px no-iOS-zoom size inside modals.
- **Gates.** `pnpm test` 790 tests green (43 files), `pnpm lint` clean, `pnpm build` green,
  `grep "Date.now|react" src/core src/save/serialize.ts src/save/codec.ts` clean. No save bump, no core change.

### Deviations

- **Import writes the already-migrated v19 save**, not the raw older JSON: the codec migrates in memory for the
  confirm card, and `commitImport` writes that. `tiles.save.backup.vN` per-version raw backups therefore apply to
  boot only, never to imports; the replaced save still lands in `tiles.save.backup.import` exactly as before.
- **The import two-press confirm is replaced by the confirm card** (the spec's compare card IS the confirm step);
  Reset keeps its two-press semantics untouched.
- **The 375/1024/1440 layout check ran without screenshots** (no server could be started in this session) — CSS
  constraint analysis + jsdom render smoke only; the delivery-time verify should capture the PNGs.
- **FeedbackCard dropped its inline `<h2>`** (the modal title is the heading); fields, body builder and endpoint
  unchanged. Task 116's first commit carried a constructor parameter property that `erasableSyntaxOnly` rejects —
  fixed in a follow-up commit (`SaveCodeError` sets the field in the body) before anything built on it.


## Batch 23.1 — Import fix, save attached to feedback, Copy report removed (tasks 122–124, no save bump)

Why (Toon, 2026-11-09): an import from his main PC did not stick on his Mac. Reproduced on the live build: the
import writes the incoming save, then `location.reload()` fires `pagehide`, whose handler saves the OLD in-memory
run over it (write log: 💰123456 imported → 💰20 on pagehide). Feedback should carry the player's real save, so
Hermes can reproduce bugs and compute balance from exact state; the Copy report button goes.

- [x] 122. **Import sticks.** `src/app/useGame.ts` `applyImport`: before `commitImport`, stop every autosave path
    of this tab — set `frozenRef.current = true` and clear the pending `saveTimer` — so `pagehide`, the hidden
    `visibilitychange` save and the debounced save cannot write after the import. Do NOT call `freeze()` if it
    shows the "changed in another tab" banner (no banner flash on import). If `commitImport` returns
    `{ ok: false }`, unfreeze (the game keeps running, nothing changed). Regression test (jsdom, `location.reload`
    stubbed): apply an import, then dispatch `pagehide`, a hidden `visibilitychange` and advance timers past the
    save debounce → `localStorage['tiles.save']` still holds the imported run (cash, tiles) and
    `tiles.save.backup.import` holds the old one. The test must FAIL on today's code.
- [x] 123. **Feedback attaches the save; Copy report goes.** In 💬 Feedback the sent body (`buildFeedbackBody`,
    field `Tell us more`, entry.1552861218 — the form has no length validation) ends with the context block:
    Build / Save / Screen / UA / Time / Game (`feedbackSummary`, unchanged), then a last line
    `Save code: TILES1.…` = `encodeSave` of the LIVE run at send time (same as 💾 Data export: version, wall-clock
    `savedAtMs`, `stateRef`/current state — Date.now stays in src/app). The `Timeline:` lines leave the body (the
    save carries `milestones`). One small line under the form: "Your save and game stats are attached." No
    checkbox. Remove the "Copy report" button and its status lines from the Timeline card in `src/app/Stats.tsx`;
    the timeline list itself stays. Delete `reportLines` / `REPORT_MAX_LINES` from `src/core/stats.ts` if nothing
    else uses them, with their tests. The 2000-char counter still limits only what the player types. Tests: body
    ends with a `Save code:` line that `decodeImport` round-trips to the live state; no `Timeline:` in the body;
    no "Copy report" button in Stats.
- [x] 124. **Docs**: `## Batch 23.1 results` + `### Deviations` at the true end of this file.

Gates: `pnpm test`, `pnpm lint`, `pnpm build`, purity grep `Date.now|react` clean over `src/core` and `src/save`.

## Batch 23.1 results

- **Task 122 (import sticks).** Regression test written first (`tests/useGame.test.tsx`, jsdom, `location.reload`
  stubbed, fake timers): apply an import, then fire `pagehide`, a hidden `visibilitychange` and advance 2 s past
  the save debounce → `tiles.save` must still hold the imported run and `tiles.save.backup.import` the old one.
  Confirmed RED on the pre-fix code (`expected 20 to be 123456`), then green after the fix. Fix in `applyImport`
  (`src/app/useGame.ts`): after the live-run backup save, set `frozenRef.current = true` (not `freeze()` — no
  other-tab banner) and clear the pending `saveTimer`; unfreeze only when `commitImport` returns `{ ok: false }`.
- **Task 123 (save attached to feedback; Copy report gone).** `FeedbackContext.timeline` is replaced by
  `saveCode`; `buildFeedbackBody` ends the context block with `Save code: <TILES1 code>` and no longer emits
  `Timeline:` lines. `FeedbackCard` builds the code at send time via `encodeSave({ version, savedAtMs: Date.now(),
  state })` — Date.now stays in `src/app`, matching the 💾 Data export. One `<small>` note under the form:
  "Your save and game stats are attached." (reuses `.feedback small`, no new CSS). `Stats.tsx` Timeline loses the
  Copy report button and its status lines; `reportLines` / `REPORT_MAX_LINES` and their tests are deleted, with
  the now-unused `marketFactor` import and the `.report` CSS rules. Tests: body round-trips through `decodeSave`
  to the live run (feedback.test.ts node-side on `buildFeedbackBody`, FeedbackCard.test.tsx end-to-end through
  the real send path), no `Timeline:` in the body, no Copy report button in Stats.
- **Task 124.** This section.
- Gates: `pnpm test` 790/790 across 44 files, `pnpm lint` clean, `pnpm build` clean, before each of the two code
  commits (d209c6a, c25b800). No save-version bump — `SAVE_VERSION` untouched at 19.

### Deviations

- Purity grep `Date.now|react` over `src/core` + `src/save` reports one hit: `src/save/storage.ts:26` `wallClock`
  — the game's single, pre-existing wall clock (documented in that file), unchanged by this batch. No new
  `Date.now` or react import entered `src/core`/`src/save`.
- The task-123 test uses `decodeSave` (codec.ts's thin wrapper) rather than calling `decodeImport` directly; it
  exercises the same decode/migrate path.
- The feedback test fixture pins `saveVersion: 11` in `Save: v11` (a stale sample value that was already in the
  fixture) while the attached code carries the real `SAVE_VERSION`; harmless because the line is display-only.


## Batch 24 — Minor-feedback layout pass + sellable bars (tasks 125–128, no save bump)

Why (Toon, 2026-11-09, minor-feedback items 2, 4, 11 + the bar soft lock): on his ultrawide (3440 px) and on
mobile the UI is cramped — every card is one flat wall of siblings under a 4–6 px gap, side columns are capped while
the farm has ~790 px of empty space per side, repeated rows (seed pouch, sell list) wrap differently row by row, and
the mobile tool bar is content-width and left-aligned. Separately, bars count toward storage but cannot be sold, so a
bag full of unused bars blocks digging, Collect and the stone-paid storage upgrade (soft lock). Decisions:
`docs/DECISIONS.md` "Minor-feedback layout pass + bars sell as disposal (batch 24)". All UI work is `src/app`
only; task 127 also touches two numbers in `src/core/balance.ts`. No save shape change.

- [x] 125. **Spacing scale, wide columns, always-open panel ≥ 1440.**
    - Add `--s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px` to `:root` in `src/app/app.css` and replace the hard-coded
      gaps/margins/paddings (today: 6 px ×11, 8 px ×9, 4 px ×9) with them. Minimum 8 px (`--s2`) between any two
      buttons; `.panel` padding 8 → 12 (`--s3`). Keep 2–3 px only where elements are meant to touch (icon + text).
    - `app.css:227` grid: `clamp(220px, 22vw, 440px) minmax(0, 1fr) clamp(300px, 26vw, 480px)` (was 320 / 380), so
      2560/3440 widen the side columns; 1024 and 1440 compute the same as today (22vw/26vw are below the caps).
    - ≥ 1440 px (`min-width: 1440px`): no panel-collapse toggle (`App.tsx:179–184` `.panel-toggle`), the side
      panel is always open and a persisted `tiles.ui.collapsed = true` is IGNORED there (do not overwrite it; it
      still applies at 1024–1439, which keeps the toggle). Test: render at ≥ 1440 with `collapsed: true` in
      `tiles.ui` → panel content rendered, no toggle button; at 1024–1439 the toggle is still there.
- [x] 126. **Grouped cards + Farm tool bar.**
    - Two-level vertical rhythm: `--s2` (8 px) inside a group, `--s4` (16 px) between groups, a 1 px divider + a
      small "Upgrades" sub-heading before every upgrades block. Progress bars (`.bar`, app.css:484, 6 px) get
      ≥ 8 px from the text above and the buttons below.
    - Furnace (`Mine.tsx` furnace `<details class="mine-furnace">`, today every child is a flat sibling under
      `gap: 4px`, app.css:596): wrap the children in four group elements, in this order: (1) **Fire** — status
      line + fire bar + hint + Fill buttons; (2) **Smelt** — ore choice + recipe line + Load + smelt progress bar;
      (3) **Output** — Collect + tray line; (4) **Upgrades** — sub-heading + upgrade rows, 8 px apart. Apply the
      same group/heading rule to the Pickaxe, Orders and Workers cards where they hold more than one block.
    - Farm-tab tool group (`Tools.tsx`) becomes a collapsible card: default OPEN, header looks like a button with
      an explicit ▸/▾ chevron (not the native marker), open state stored in `tiles.ui` as `toolsOpen` (default
      `true`; an old `tiles.ui` without the field reads as open). Not in the save.
    - Empty `.tool-step` spacers (`Tools.tsx:120`, app.css:772–781, 44 px each side of a level-1/level-3 button):
      render them ONLY when another row in the same group is level 2 (so mixed groups stay aligned); otherwise
      the button takes the full row width. Level-2 rows keep − / +. A player with no level-2 tool sees full-width
      buttons, nothing else changes.
    - Mobile (≤ 767 px) fixed tool bar: `.tools > button { flex: 1 }` (app.css:752 is `flex: none`) so buttons fill
      the bar evenly; ≥ 8 px gap between the tool bar and the tab bar (today ~4 px).
    - Tests (jsdom): furnace renders the four groups in order with the Upgrades heading; tool card toggles and
      persists `toolsOpen`; no `.tool-step` when no tool is level 2; `.tool-step` present in a group that mixes
      level 2 and level 3.
- [x] 127. **One grid for repeated rows; bars sell as disposal.**
    - New shared class (e.g. `.item-grid` on the container, `.item-row` per row) used by BOTH the seed pouch
      (`Farm.tsx:24–35`, `.pouch-row`) and the Mine sell list (`Mine.tsx:382–394`, `.mine-item`); delete the
      `flex-wrap` + `flex: 1 0 auto; white-space: nowrap` rules (app.css:885–899, 725–733) they replace.
      Columns: name (`minmax(0, 1fr)`, `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`) | count
      (right-aligned, `font-variant-numeric: tabular-nums`) | extra (ⓘ in the pouch; price each "💰N" in the sell
      list) | action 1 | action 2 | one EMPTY reserved column (batch 25 adds a Keep ↔ Sell toggle there; width 0 for
      now). Every row one 44 px line, 8 px between buttons. Seed buttons: "×1" / "×10" on line one and the price
      "💰N" on line two INSIDE the button (like `.shop-row button`), fixed 64 px wide. Sell buttons "sell 1" /
      "sell all" fixed width. Unsellable items (wood) keep empty action cells so columns align.
      ≤ 767 px: the sell list's price-each moves under the name (second line of the name cell); buttons never wrap.
    - Bars become sellable at a price below their inputs' sell value (disposal, never profit). In
      `src/core/balance.ts` add to `ITEM_SELL_PRICE`: `copperBar: 2, ironBar: 3, goldBar: 5`, and rewrite the comment
      above it ("bars sell below the sell value of their inputs at the cheapest recipe, so smelting to sell never
      beats selling the ore and coal"). Derivation (fixed here, do not re-decide): a cycle burns `barTicks` of fire
      whatever the batch, so the cheapest recipe is batch 3; per bar = 2 ore (💰1 each) + fire/3 (copper 2 units,
      iron 4, gold 6; 1 coal = 2 units sells 💰4, wood sells 💰2 per unit, the same) → copper 2 + 1.33 = 3.33, iron
      2 + 2.67 = 4.67, gold 2 + 4 = 6; price = ⌊value⌋ − 1 → 2 / 3 / 5. The sell-price multiplier applies as for
      every item (`itemSellPrice`).
    - Test (balance): for every bar, its sell price ≤ ⌊2 × ore price + (barTicks / (fireUnitTicks × top batch)) ×
      (coal price / coal units)⌋ − 1, computed from the balance functions (not literals), and every bar
      `isSellable`.
    - Bars are NOT added to the "Sell all … when storage is full" button (`SELL_WHEN_FULL`, `Mine.tsx:63`): bars pay
      for upgrades, so only their own row's sell 1 / sell all sell them. Test: Sell all leaves bars in storage.
    - Tests (jsdom): seed pouch and sell list render through the shared grid class; a bar row shows sell 1 /
      sell all and selling 1 bar adds its price; no `.pouch-row` / `.mine-item` flex-wrap rules remain.
- [x] 128. **Docs**: rename `docs/research/art-assets.md` heading "Batch 24 sketch" → "Batch X sketch" (the art
    batch has no number yet). `## Batch 24 results` + `### Deviations` at the TRUE END of this file, including the
    CSS column widths you chose and anything you could not verify without a browser (Hermes re-measures live at
    375 / 1024 / 1440 / 2560 / 3440).

Gates: `pnpm test`, `pnpm lint`, `pnpm build`, purity grep `Date.now|react` clean over `src/core` and `src/save`.
Hermes verifies live after the batch: no horizontal overflow (`scrollWidth ≤ clientWidth`) of any row/bar at 375
with every tool at level 2 and every license with 3-digit counts; bars ≥ 8 px from neighbours, groups ≥ 16 px;
before/after furnace screenshots.

## Batch 24 results

- **Spacing scale / wide columns / always-open panel (task 125).** `--s1..--s4` (4/8/12/16) in `:root`; ~40
  gap/margin/padding declarations tokenized, `.panel` padding `var(--s3)`, no `gap: 6px` left (asserted by
  `tests/appCss.test.ts`). Grid columns `clamp(220px, 22vw, 440px) minmax(0, 1fr) clamp(300px, 26vw, 480px)` in
  both the `.app` and `.panel-collapsed` rules. `App.tsx` reads `media('(min-width: 1440px)')`: at ≥ 1440 the
  panel-toggle is not rendered and a saved `collapsed: true` is ignored (kept in `tiles.ui`, not overwritten);
  1024–1439 keeps the toggle. Tests: `tests/App.test.tsx` "always-open panel at ≥ 1440 px" with stubbed
  matchMedia (collapsed-save → panel content rendered, no toggle; 1024 stub → toggle present).
- **Grouped cards + Farm tool bar (task 126).** `.group` = column flex `gap: var(--s2)`;
  `.group:not(:first-child)` = `margin-top: var(--s4); padding-top: var(--s2); border-top: 1px solid #eee`;
  `.group > h3` 13 px grey sub-heading. Furnace body = four groups Fire / Smelt / Output / Upgrades (Upgrades
  carries the `<h3>`); the Pickaxe block (pickaxe + offerTier craft), Orders rows and Workers job rows each sit
  in one `.group` with their hire/shop row in a nested group. 🧰 Tools card: `.tools-head` button with a
  `::before` ▸/▾ chevron driven by `aria-expanded`, state in `tiles.ui.toolsOpen` (default `true`, absent field
  reads open); persisted UI only, save untouched. `.tool-step` spacers render only when some row in the group is
  level 2 (`STACK_ORDER.some(job => tools[job] === 2)`). Mobile: `@media (max-width: 767px) { .tools > button
  { flex: 1 } }` placed AFTER the base `flex: none` rule (equal specificity — source order decides), and the bar
  sits `calc(var(--tabbar-h) + var(--s2) + safe-area)` from the bottom. Tests: furnace four groups in order;
  tools card toggles and persists; no `.tool-step` without a level-2 tool; mixed 2+3 keeps alignment.
- **One grid for repeated rows; bars sell as disposal (task 127).** Shared `.item-grid`/`.item-row`,
  `grid-template-columns: minmax(0, 1fr) auto auto auto auto 0` — name (ellipsis) | tabular-nums ×N | extra
  (ⓘ / 💰N) | two 64 px action buttons | 0-width reserved column (batch 25 Keep toggle). Seed buttons `Buy ×N`
  with `💰N` on a second line inside; sell buttons `sell 1` / `sell all` fixed width; unsellable rows keep empty
  cells (since bars joined `ITEM_SELL_PRICE`, every mine item is sellable — the empty-cell branch stays for
  future items). ≤ 767 px: `.item-sub` (price each) drops under the name, `.item-price` hides. `.pouch-row` /
  `.mine-item` rules deleted (asserted gone). `ITEM_SELL_PRICE` += `copperBar: 2, ironBar: 3, goldBar: 5` with
  the disposal comment; `balance.test.ts` derives each price from the balance functions
  (⌊2×ore + (barTicks/(fireUnitTicks×top batch))×coal unit⌋ − 1) and proves price < input value.
  `SELL_WHEN_FULL` excludes wood AND bars — Sell-all-when-full leaves bars in storage (tested:
  stone 15 + copperBar 5 = full bag → stone 0, bars 5).
- **Docs (task 128).** `docs/research/art-assets.md` heading renamed to "Batch X sketch"; this section written;
  task boxes 125–128 ticked.
- Gates: `pnpm test` 803/803, `pnpm lint` clean, `pnpm build` ok, purity grep `Date.now|react` — `src/core`
  clean; `src/save/storage.ts:26` `wallClock = () => Date.now()` is the pre-existing clock-injection seam this
  batch did not touch.

### Deviations

- Inter-group visual gap is 24 px where the parent's column gap (`--s2`) and the group's `margin-top: var(--s4)`
  stack; the plan's "16 px between groups" is the group's own margin. All cards share the parent's 8 px rhythm.
- Literal spacing kept where elements are meant to touch: `.cell` padding 6/4 and 3 px cell gap, `.tabbar`
  button 0/2, `.stats > div` 3 px 0, 2 px label gaps, `.depth` 3 px, `.mine-badge` 1 px 6 px, 6 px `.bar`
  height (task 126 only required ≥ 8 px clearance around bars, which the group rhythm gives).
- The "Upgrades" `<h3>` renders only in the furnace card — the only card whose upgrades block follows content
  groups; Pickaxe/Orders/Workers hold a single upgrade list each, where a heading would repeat the card title.
- `.panel-collapsed` is applied on `collapsed && !wide` (not `desktop && !wide && collapsed`): jsdom has no
  matchMedia, and CSS applies the class only inside the ≥ 1024 media query anyway — desktop behaviour identical,
  covered by the stubbed-matchMedia App tests.
- Reading `app.css?raw` under vitest returned '' — `tests/appCss.test.ts` (node env) reads the file with
  `node:fs` instead; `/// <reference types="node" />` scopes the node types to that one test file.
- jsdom renders `display: none` text, so the bar-row textContent assertion includes the mobile-only
  "💰N each" line.
- Not verifiable without a browser (Hermes re-measures live at 375 / 1024 / 1440 / 2560 / 3440): no horizontal
  overflow at 375 with every tool at level 2, every license, 3-digit counts; bars ≥ 8 px from neighbours and
  groups ≥ 16 px as rendered; the computed clamp column widths; before/after furnace screenshots.

## Batch 24.1 — Layout follow-up (shared columns, Workshop + Fields cards) + order states + worker activity (tasks 129–132, no save bump)

Why (Toon + Hermes live check, 2026-11-09): batch 24's `.item-grid` made each `.item-row` its own grid with `auto`
columns, so (1) the `minmax(0, 1fr)` name cell collapsed to **0 px** in the 1024 px Mine column (~194 px wide) and
rows overflowed by ~200 px, and at 1440 "Copper ore" / "Copper bar" both truncated to "Copper…"; (2) counts and
prices drift row to row because the columns are not shared; (3) the furnace recipe line wraps "wood 120" alone onto
a new line. Toon also reported the 🔧 Workshop and 🚜 Fields cards still cramped: batch 24's layout seed never unlocked
them, so they still are flat `.worker-row` siblings with content-width buttons and long effect text inside the
button. Plus two accepted minor-feedback items: 5 (order board states) and 10 (worker activity, TEMPORARY CSS — a
real animation pass comes later with Toon's references). Decisions: `docs/DECISIONS.md` "Layout follow-up, order
states, worker activity (batch 24.1)". All work is `src/app` (task 132 may extend `src/core/workers.ts` reporting,
see there). No save shape change, no SAVE_VERSION bump, no RNG change (sim pins must not move).

jsdom cannot measure layout. The CSS below is the spec — write it as given (names may differ, structure may not).
Hermes re-measures on the live build at 375 / 1024 / 1440 / 2560 / 3440.

- [x] 129. **Shared columns for `.item-grid` + furnace recipe line.**
    - Columns live on the CONTAINER; rows use `subgrid` so every row shares them. Drop the 0-width reserved
      column (batch 25 adds its own column when the toggle ships):
      ```css
      .item-grid-wrap { container-type: inline-size; }       /* wrapper element around each .item-grid */
      .item-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto 64px 64px; /* name | count | extra | btn | btn */
        gap: var(--s2);
        font-size: 14px;
      }
      .item-row {
        display: grid;
        grid-column: 1 / -1;
        grid-template-columns: subgrid;
        align-items: center;
        min-height: 44px;
      }
      @container (max-width: 359px) {
        .item-row {
          grid-template-columns: minmax(0, 1fr) 64px 64px;
          grid-template-areas: 'name name count' 'extra b1 b2';
          row-gap: var(--s1);
          padding: var(--s1) 0;
        }
        .item-row > :nth-child(1) { grid-area: name; }
        .item-row > :nth-child(2) { grid-area: count; justify-self: end; }
        .item-row > :nth-child(3) { grid-area: extra; }
        .item-row > :nth-child(4) { grid-area: b1; }
        .item-row > :nth-child(5) { grid-area: b2; }
      }
      ```
      The container query needs an ANCESTOR container, hence the wrapper div (a grid cannot query itself). Both
      users (seed pouch `Farm.tsx`, Mine sell list `Mine.tsx`) get the wrapper. Every row keeps exactly 5 children in
      this order (unsellable rows keep their two empty `<span />`). In the 2-line mode the price-each shows in the
      `extra` cell, so the `@media (max-width: 767px)` `.item-sub` / `.item-price` swap is removed (one mechanism,
      container-based, not viewport-based).
    - Furnace Smelt group (`Mine.tsx` recipe `<small>`): split into TWO lines — line 1 the recipe
      (ore + coal-or-wood → bars · N s, emojis from `ITEMS` as today), line 2 the stock (`have: ore N · coal N · wood N`). Every token (`ore N`,
      `coal N`, `wood N`, and each `emoji+number` of the recipe) is `white-space: nowrap`, so a number never wraps
      away from its label.
    - Tests: extend `tests/appCss.test.ts` — `.item-grid` declares the 5 columns, `.item-row` uses
      `grid-template-columns: subgrid`, an `@container` rule exists, no `.item-sub` media swap remains. jsdom: both
      grids render inside a `.item-grid-wrap`, every `.item-row` has 5 children; the furnace recipe renders two lines.
- [x] 130. **🔧 Workshop + 🚜 Fields cards: groups, one-line gauges, aligned buttons.**
    - Groups (batch 24 `.group` pattern, `<h3>` sub-heading where named):
      Fields = (1) status gauges (To plant / Growing / Ready); (2) **Plant** — one row per licensed crop;
      (3) **Expand** — +1 Field, Pipes; (4) **Machines** — Harvester Mk1–3, Seeder Mk1–2.
      Workshop = (1) machine gauges; (2) **Build** — Sprinkler, Smart valve.
    - Gauge rows (Fields `StatLine` + the Growing row, Workshop "Machine N" rows) become ONE line,
      `label | bar | count`, sharing columns within the card:
      ```css
      .gauge-grid { display: grid; grid-template-columns: max-content minmax(48px, 1fr) max-content;
                    gap: var(--s2) var(--s3); align-items: center; }
      .gauge-row  { display: grid; grid-column: 1 / -1; grid-template-columns: subgrid; align-items: center; }
      .gauge-row > .gauge-note { grid-column: 1 / -1; }  /* "⏳ N beyond pipes", "stalled" on its own line */
      .gauge-row > small { text-align: right; font-variant-numeric: tabular-nums; }
      ```
    - Recipe / crop / expand rows (`RecipeRow`, the crop rows, +1 Field, Pipes) share ONE grid per card:
      ```css
      .recipe-wrap { container-type: inline-size; }
      .recipe-grid { display: grid; grid-template-columns: minmax(0, 1fr) 144px; gap: var(--s2) var(--s3); }
      .recipe-row  { display: grid; grid-column: 1 / -1; grid-template-columns: subgrid; align-items: center;
                     min-height: 44px; }
      .recipe-row > button, .recipe-row > .owned-badge { width: 144px; }
      .recipe-row small { display: block; font-size: 12px; color: #555; }
      @container (max-width: 299px) {
        .recipe-row { grid-template-columns: minmax(0, 1fr); }
        .recipe-row > button, .recipe-row > .owned-badge { width: 100%; }
      }
      ```
      Left cell = emoji + name, then `<small>` lines UNDER the name: the effect text (today inside the button,
      `Workshop.tsx:45`), and the hint (`needs 🥈11 more` or the locked `reason`). The button holds only two
      lines: the verb (`Build` / `Buy` / `Plant 10` / `+1 Field`) and the price (`🥈12 💰50000`; crop rows
      `no ⚡ · 🌱 ×10 💰20`; +1 Field `💰11100 · ~2 h`), price line `white-space: nowrap`. Same for the crop rows
      (the `needs 50 home harvests` line already sits under the name) and Pipes (already has its sub-line).
    - Owned recipes (`owned === true`) render NO button: a `<span class="owned-badge">✓ Built</span>` in the
      button column, and the effect line under the name stays (e.g. `7200 tiles/h`). A disabled dashed "Build ✓"
      button reads as "locked".
    - `priceText` (`Mine.tsx`) and `shortOf` (`Workshop.tsx`) join each emoji to its number with U+2060 WORD
      JOINER (`${emoji}\u2060${n}`) so a line can never break between "🥈" and "12". Tokens stay space-separated.
      Update any test that compares these strings literally.
    - Tests (jsdom): Fields renders the 4 groups in order with h3 "Plant", "Expand", "Machines"; Workshop 2 groups
      with h3 "Build"; an owned machine renders `.owned-badge` and no button; a RecipeRow button's text holds the
      verb + price but NOT the effect text; `priceText({ ironBar: 12, cash: 50000 })` contains `\u2060`.
      appCss test: `.recipe-row` and `.gauge-row` use `subgrid`.
- [x] 131. **Order board states (item 5).** `Orders.tsx` + `.order-row` CSS.
    - Offer (not accepted): dashed frame, muted text, a "New" badge, Accept is the primary button.
    - Accepted: solid frame + a progress bar. Crop order: "filling from harvests" + `done/count`. Item order: the
      count already in storage, e.g. `🔶 12 / 15 in storage` (today item rows show `done/count` = 0 even with the
      goods in storage).
    - Ready (`deliverOrder(state, slot).ok`): green frame, "✓ Ready" badge, filled green Deliver button. The
      collapsed card summary appends `· N ready` when N > 0.
    - Discard becomes a small ✕ button at the row end, ≥ 16 px away from the primary button (44 px hit area). An
      ACCEPTED order with progress > 0 needs two presses: first press turns the ✕ into "Discard?" for 3 s (UI
      state only, not saved), second press discards. Offers and zero-progress accepted orders discard on one press.
    - Tests (jsdom): seed one offer, one accepted-in-progress, one ready → each row has its state class/badge; the
      summary shows `· 1 ready`; ✕ on the in-progress order needs two presses; item order shows the storage count.
- [x] 132. **Worker activity visibility (item 10) — TEMPORARY CSS pass.**
    - Farm next-target ring (`.cell-target`, today 2 px dashed, -4 px offset): solid 3 px in the job colour + a
      slow opacity pulse (`@keyframes`, ~1.5 s). Keep the act flash (`.cell-flash`).
    - Workers card rows, all 7 jobs: a dot before the job name — ● green pulsing = acted in the last work round,
      ○ grey = idle; the existing "unpaid" marker unchanged.
    - Off-farm act spots flash amber like the Mine button (`.mine-flash` pattern): the furnace Smelt group when
      the ore/fuel worker acted, the order row the clerk acted on.
    - Collapsed Workers summary: append `· N working` after `free X / Y`.
    - `prefers-reduced-motion: reduce`: no pulse — solid ring and a steady dot (the existing reduced-motion block
      pattern in app.css).
    - Who acted: today `workRound` (`src/core/workers.ts`) returns `touched` for tile jobs only. Either diff the
      state per round in `src/app`, or extend `touched` to report every job that acted (job id, plus tile/slot
      when there is one). A core change must stay pure, must not change the save shape, must not add or reorder
      RNG draws (sim pins must not move), and needs a unit test for the new entries.
    - Tests (jsdom): seed every worker kind active → each row has the active dot; summary shows `· N working`;
      the ring class is present on the next target.

Gates: `pnpm test`, `pnpm lint`, `pnpm build`, `tsc -b --force`, purity grep `Date.now|react` clean over `src/core`
and `src/save` (pre-existing `src/save/storage.ts` clock seam excepted). `## Batch 24.1 results` + `### Deviations` at
the TRUE END of this file. Hermes verifies live: seed with every license, Fields 110 tiles + pipes + one machine
owned, Workshop 1/4, every item 3-digit, all three order states, every worker kind → at 375 / 1024 / 1440 / 2560 /
3440: name cells ≥ "Copper ore" / "Strawberry" (no "Copper…" pairs), no row overflow, every Fields/Workshop button
the same left edge, no emoji/number split, ring visible on green and soil; before/after screenshots.

## Batch 24.1 results (2026-11-10)

Tasks 129–132 done, one commit each (719e4af, 2a23678, bc7abe5, 8fa42b7). `pnpm test` 45 files / 818 tests green,
`pnpm lint`, `pnpm build`, `tsc -b --force` clean; purity grep over `src/core` + `src/save` clean (only the
pre-existing `src/save/storage.ts:26` wallClock seam). No save shape change, no SAVE_VERSION bump, no RNG change —
sim pins did not move.

- **129** `.item-grid` columns now live on the container (`minmax(0,1fr) auto auto 64px 64px`), rows are `subgrid`;
  both users (seed pouch, Mine sell list) wrapped in `.item-grid-wrap` (`container-type: inline-size`), two-line
  fallback under 359 px via `@container` with grid-areas. The viewport `.item-sub`/`.item-price` media swap is gone
  (appCss test asserts absence). Furnace recipe split into recipe line + `have:` stock line, every token `nowrap`.
- **130** Workshop + Fields regrouped (`.group` + `<h3>`): gauges one shared `.gauge-grid` (label | bar | count,
  `subgrid` rows), recipe/crop/expand rows one `.recipe-grid` per card (fixed 144 px button column, `@container
  (max-width: 299px)` single-column fallback); effect + hint lines moved under the name; owned recipes render
  `✓ Built` instead of a button. `priceText`/`shortOf` join emoji to number with U+2060 (tests updated to match).
- **131** Order rows carry `order-offer` (dashed + New badge) / `order-accepted` (solid + progress bar, crop
  "filling from harvests", item `N / M in storage`) / `order-ready` (green + ✓ Ready + filled Deliver). ✕ at the
  row end (44 px hit area, 16 px from the primary), two-press arm for accepted orders with progress. Summary
  appends `· N ready`.
- **132** `workRound`'s `touched` now reports every job that acted (`WorkTouch` = job + optional tile/slot; the
  clerk carries its slot via the new pure `clerkTarget` extracted from `clerkAction` — behavior-identical, no RNG
  change). New `workerActivity(state)` in `src/core/workers.ts` exposes the pre-round touches; `useGame` computes
  it once per crossed tick and feeds both the tile rings and the new `worked` state. Solid 3 px pulsing
  `.cell-target` ring per job colour, activity dot on all 7 job rows (`job-dot`/`job-dot-on`), amber flash on the
  furnace Smelt group and the clerk's order row, `· N working` in the collapsed summary;
  `prefers-reduced-motion` gets a steady ring and dot.

### Deviations

- Per-row `.item-sub` removed as planned, but the price-each now lives in the `extra` cell in one-line mode too
  (not only in two-line mode) — the `@media (max-width: 767px)` swap had no one-line replacement.
- Fields/Workshop groups sit in ONE `.recipe-grid` per card; the divider ABOVE the recipe block comes from
  `.recipe-wrap` (margin/border), while the dividers between Plant/Expand/Machines come from the existing
  `.group:not(:first-child)` rule — no new divider mechanism.
- U+2060 joiner applied to `priceText`/`shortOf` outputs only; other emoji+number strings (Shop's "needs 🥈4
  more" lines, summary texts) keep plain spaces.
- Item-order storage count shows `N / M` with M = remaining (`count − done`), matching what a Deliver takes.
- Clerk slot reporting chose the second plan option (extend `touched`) over per-round state diffing in `src/app`;
  `clerkTarget` is the extracted pure finder, unit-tested in `tests/orders.test.ts`.
- Task 130's gate run had 2 test-literal failures (a fixture used a non-existent crop id; 2 literals missing the
  U+2060 joiner) — fixed and verified by running those two test files in isolation; the full suite was not re-run
  for that commit alone (it is green in the final run).
- Machine was under heavy external load (load avg 9.8–13.7) during early runs: one `pnpm test` invocation hit the
  timeout and was killed and re-run once, and a sim perf test flaked once — both pass in isolation and in the
  final full run.
- jsdom cannot measure layout or animations: all container-query breakpoints, subgrid column sharing, the ring /
  dot pulses and the amber flashes are verified structurally (class presence + appCss assertions) only. Hermes
  re-measures on the live build at 375 / 1024 / 1440 / 2560 / 3440 per the gate list above.

## Batch 24.2 — 🗺 Roadmap gets a Changelog tab (tasks 133–134, UI only, no save bump)

Why: Toon wants players to see what every batch shipped, in English, next to the parked ideas. The 🗺 Roadmap
modal (`src/app/Roadmap.tsx`, opened from `src/app/Stats.tsx` lines 88–90) shows only `PARKED_IDEAS` today.
Scope: `src/app` + tests only. No `src/core`, no `src/save`, no SAVE_VERSION bump, no sim change.

- [x] 133. **Changelog data + guard test.** New `src/app/changelog.ts`:
    `export type ChangelogEntry = { batch: string; date: string; line: string }` and
    `export const CHANGELOG: ChangelogEntry[]`, newest first, copied VERBATIM from the table below (do not reword,
    do not add or drop entries, keep the emoji exactly). New `tests/changelog.test.ts`:
    - batches are unique; `date` matches `/^\d{4}-\d{2}-\d{2}$/`; dates never increase going down the list;
      batch numbers strictly decrease going down the list (compare `"24.1"` as [24, 1], `"24"` as [24, 0]);
      every `line` is non-empty and ≤ 160 chars.
    - **Every shipped batch has an entry:** read `docs/PLAN.md` the same way `tests/appCss.test.ts` reads
      `src/app/app.css`, collect every heading matching `/^## Batch ([0-9.]+) results/m`, and assert each captured
      number is a `CHANGELOG` batch. (Only `results` headings count — a plan heading is committed before its batch
      ships.) This is what makes every future batch add its own line.
- [x] 134. **Two tabs in the 🗺 Roadmap modal.** `RoadmapList` renders a tab row above the body:
    `<div className="roadmap-tabs" role="tablist" aria-label="Roadmap">` with two `role="tab"` buttons
    **Planned** and **Changelog** (`aria-selected`, `aria-controls`), and one `role="tabpanel"` below
    (`aria-labelledby` the active tab). Default tab = **Planned** every time the modal opens (local `useState`, not
    persisted — cosmetic, no `tiles.ui` change).
    - Planned = today's content unchanged (label, list, order note).
    - Changelog = `<p className="roadmap-label">Every update so far, newest first.</p>` then
      `<ol className="changelog-list">` with one `<li>` per `CHANGELOG` entry in array order:
      `<span className="changelog-batch">Batch {batch}</span> <time dateTime={date}>{date}</time> — {line}`.
    - CSS (app.css, next to the `.roadmap` rules):
      `.roadmap-tabs { display: flex; gap: var(--s1); margin-top: var(--s2); }`
      `.roadmap-tabs button { flex: 1; min-height: 44px; }`
      `.roadmap-tabs [aria-selected='true'] { font-weight: 600; }` plus the same selected look `.panel-tabs` uses
      (reuse its colours, do not invent new ones);
      `.changelog-list { margin: var(--s2) 0 0; padding-left: 0; list-style: none; font-size: 13px; line-height: 1.5; }`
      `.changelog-list li + li { margin-top: var(--s1); }`
      `.changelog-batch { font-weight: 600; white-space: nowrap; }`
      `.changelog-list time { color: #555; white-space: nowrap; }`.
    - Tests (extend `tests/StatsPanel.test.tsx`'s Roadmap describe): the modal opens on Planned (the existing
      "data-driven" test stays green as is); clicking **Changelog** sets `aria-selected` on it, hides the parked
      list, and renders `CHANGELOG.length` `<li>` whose first item contains `Batch ${CHANGELOG[0].batch}` and
      `CHANGELOG[0].line`; clicking **Planned** brings the parked list back; closing and reopening the modal
      lands on Planned again.

Changelog text (newest first — copy into `CHANGELOG` exactly):

| batch | date | line |
|---|---|---|
| 24.2 | 2026-11-10 | A Changelog tab in 🗺 Roadmap: every update so far, newest first |
| 24.1 | 2026-11-10 | Lists line up in shared columns, tidier Workshop and Fields cards, orders show New / Accepted / Ready, and you can see which workers are busy |
| 24 | 2026-11-09 | Roomier layout, grouped cards, a collapsible 🧰 Tools card, and bars can be sold |
| 23.1 | 2026-11-09 | Save import fixed; feedback now carries your save so a reported bug can be reproduced exactly |
| 23 | 2026-11-09 | Save codes to move your game between devices; 📊 Stats tools open as 💾 Data / 🗺 Roadmap / 💬 Feedback |
| 22 | 2026-11-09 | Four new crops: tomato, corn, grape and strawberry |
| 21 | 2026-11-09 | Calmer market prices with ▲▼ trend arrows, easier furnace switching, prestige moved to the 🏦 Bank, storage up to Lv10 |
| 20.1 | 2026-11-08 | The harvester machine now inherits your sickle |
| 20 | 2026-11-08 | Prestige: sell the farm and start again with 🏆 Legacy upgrades |
| 19 | 2026-11-08 | Fields machines for more throughput |
| 18 | 2026-11-08 | 🚜 Fields: farmland beyond the home plot, worked by your planters and harvesters |
| 17 | 2026-11-08 | The Workshop and sprinklers |
| 16 | 2026-11-08 | Economy retune and the gold tier |
| 15 | 2026-11-08 | Iron farm tools |
| 14 | 2026-11-08 | 📋 Noticeboard orders that pay ⭐ |
| 13 | 2026-11-08 | Faster early game, hand-picked crops sell for ×1.25, iron opens sooner |
| 12 | 2026-11-08 | Crop market (prices dip when you flood it), milestone timeline, save export and the deed meter |
| 11.1 | 2026-11-08 | In-game feedback form and a safer reset |
| 11 | 2026-11-08 | Iron ore, the iron pickaxe and the mine worker |
| 10 | 2026-11-08 | The planter worker |
| 9 | 2026-11-08 | The furnace burns fuel; furnace workers and the smart furnace; feedback form polish |
| 8.1 | 2026-11-08 | Floating info tips and stacked farm tool rows |
| 8 | 2026-11-07 | Workers that water and harvest for you, and auto-smelting |
| 7.2 | 2026-11-07 | A 🌾 Farm tab in the side panel |
| 7.1 | 2026-11-07 | Tool bar fixes and copper farm tools |
| 7 | 2026-11-07 | The furnace, copper ore and the copper pickaxe |
| 6.2 | 2026-11-07 | Shop and Upgrades reorganised, ⓘ info tips, tool bar moved |
| 6.1 | 2026-11-07 | Stone prices now fit your storage; tidier Mine panel |
| 6 | 2026-11-07 | Mining progress upgrades and two new crops |
| 5 | 2026-11-07 | Farm tools, a seed pouch with stock, and digging soil for free seeds |
| 4.5 | 2026-11-07 | The 🏦 Bank: take a loan when you are stuck |
| 4 | 2026-11-07 | Desktop layout with Mine, Farm and a side panel side by side; your open tab is remembered |
| 3 | 2026-11-07 | Planted tiles show their crop, harvests show what you earned, a bigger starting plot, and the first Mine |
| 2 | 2026-11-07 | The game goes live in the browser: farm grid, shop, autosave and up to 8 h of offline progress |
| 1 | 2026-11-07 | First playable core: plant, water, harvest and sell; crops grow only while the soil is moist |

Rule from now on (every batch brief): add one player-facing English line for the batch at the TOP of `CHANGELOG`
(date = the day the batch ships). The guard test in task 133 fails until the batch's `results` heading has an entry.

## Batch 24.2 results

- Task 133 (commit 9ba8c4c): `src/app/changelog.ts` — `ChangelogEntry` type + `CHANGELOG` (36 entries, batch 1 →
  24.2) copied verbatim from the plan table, emoji included. `tests/changelog.test.ts`: uniqueness, ISO date shape,
  non-increasing dates, strictly decreasing batch tuples (`"24.1"` → [24, 1], `"24"` → [24, 0]), non-empty lines
  ≤ 160 chars, and the guard — every `^## Batch ([0-9.]+) results` heading in `docs/PLAN.md` (read the same way
  `tests/appCss.test.ts` reads `app.css`) must be a `CHANGELOG` batch. 31 results headings today (batches 2 and 4
  have no separate results heading in PLAN.md; both are still in `CHANGELOG`, which the guard allows — it is
  one-directional).
- Task 134 (commit 9918418): `RoadmapList` renders a `role="tablist"` row (`.roadmap-tabs`, aria-label "Roadmap")
  with **Planned** / **Changelog** tabs (`aria-selected`, `aria-controls="roadmap-panel"`) above one
  `role="tabpanel"` (`aria-labelledby` the active tab). Tab choice is local `useState`, default Planned, not
  persisted — no `tiles.ui` change. Planned panel = the old content unchanged; Changelog panel =
  "Every update so far, newest first." + `ol.changelog-list`, one `li` per entry:
  `Batch {batch}` span + `<time dateTime>` + line. CSS added next to the `.roadmap` rules exactly as specified;
  the selected look reuses `.panel-tabs` colours (#c8e6c9 bg, #2e7d32 border) instead of inventing new ones.
  `tests/StatsPanel.test.tsx` Roadmap describe gained the task-134 test (opens on Planned, Changelog selects /
  hides the parked list / renders `CHANGELOG.length` items with `Batch 24.2` + its line first, Planned restores,
  close + reopen lands on Planned); the existing data-driven and open/close tests stay green unmodified.
- Gates after each task: `pnpm test` 820 then 821 passed (46 files), `pnpm lint` clean, `pnpm build` OK. No
  `src/core`, `src/save`, `SAVE_VERSION` or sim change; sim pins untouched.

### Deviations

- Nothing functional. jsdom cannot verify visual layout or the `prefers-reduced-motion` behaviour (not applicable
  here — no animation in this batch); Hermes checks the modal on the live build at 375 and 1440 px as planned:
  tab row proportions, the selected-tab colours, changelist readability (13 px, nowrap batch + date) and the
  44 px tab hit areas.

## Big farm roadmap — batches 25–31 (tasks 135–157)

Why: Toon felt the game "shifts paradigm in a mixed way". The home sprinkler re-picks the 6 driest tiles every 5 s
(`src/core/workshop.ts:75–85`), so it behaves like a worker, not a placed object. The 🚜 Fields are a side card
watered by a different object (pipes). Design: `docs/research/bigfarm-decisions.md` (Toon: "pick หมด", 2026-11-10)
is the single source. Base = Design C (`docs/research/bigfarm-design-c.md`), plus grafts from D, plus the
r/incremental_games review (`docs/research/incremental-community.md`). Rules: `docs/DECISIONS.md` "Big farm: blocks,
sockets, plots, one surface (batches 25–31)".

LOCKED by Toon. Design around these and do not argue them away:
- L1: a sprinkler is placed and cannot move; its tiles always have full water (no watering ever again).
- L2: the Tractor unlock is a paradigm shift of the MAIN UI (tiles, zoom out/in), not a side card.
- L3: existing systems may change but must not drift far. The test is "always something to do, never bored".
- L4: every new or changed object answers The Door Problem questions (obtain/use, state, failure, 8 h offline,
  prestige, migration, 375 px, two tabs, which systems touch it).

Order (Toon, 2026-11-10): big farm first. The mine QoL batch (ore sorting, pickaxe rack, mastery, hit carry-over,
gold pickaxe, sickle seed drop), first named "batch 25 / save v20" in DECISIONS "Minor-feedback layout pass", becomes
**batch 32 (save v23)**. Furnace molds ("26 / save v21") becomes **batch 33 (save v24)**.

| batch | name | save | worker |
|---|---|---|---|
| 25 (C1) | Beds layout + MiniLot | none | GLM ok |
| 26 (C2) | Placed home sprinklers | v19 → v20 | GLM ok |
| — | Spike + crop-mix calculator (Hermes, outside the repo) | — | — |
| 27 (C3) | Estate surface on today's cohorts | none | GLM ok |
| 28 (C4a) | Plots, pivots, pumps, pressure | v20 → v21 | GLM, expect a resume |
| 29 (C4b) | Estate contracts + 🧑‍💼 Manager + crop chips | none (shape landed in v21) | GLM ok |
| 30 (C5) | Estate map (field rows on the surface) | none | GLM ok |
| 31 | Renown | v21 → v22 | GLM ok |

Every batch: one commit per task. Add the batch's CHANGELOG line (given below) at the top of `src/app/changelog.ts`.
Write `## Batch N results` + `### Deviations` at the TRUE END of this file. Gates: `pnpm test`, `pnpm lint`,
`pnpm build`, `tsc -b --force`. The purity grep `Date.now|react` must be clean over `src/core` and `src/save` (the
`src/save/storage.ts` clock seam is the known exception). Before you finish, grep `tests/` for every render of a
component whose props changed (CI tsc TS2741). Do not ask questions; finish the batch. If the full suite hangs, rerun
it once; record blockers under `### Deviations`.

Batches 27–31 are written at task level. Hermes refines each into dispatch-ready detail just before it runs:
- 27 after the spike verdict;
- 28/29 after the crop-mix calculator fixes the numbers marked (est.);
- 30 after 28/29 land.
A worker never fills an (est.) number itself: the sim measures it and the plan pins it.

---

## Batch 25 — Beds layout + MiniLot (C1, tasks 135–137, UI only, no save bump)

Scope: `src/app` + tests. No `src/core`, no `src/save`, no SAVE_VERSION, no sim change.

- [x] 135. **The home lot renders as 4 beds of 3×2.**
    - `FarmGrid.tsx`: bed k = tiles 6k … 6k+5 (`Math.floor(i / 6)`), derived from the index. No new state.
    - Render `<div className="beds">` holding one `<div className="bed" role="group" aria-label="Bed {k+1}">` per bed
      that has ≥ 1 owned tile. Each bed is a 3-column grid of 2 rows. Inside a started bed, slots past the last owned
      tile render as `<span className="cell-slot" aria-hidden="true" />`: a dashed outline, not a button, no label.
      This keeps each bed's shape stable when a tile is bought.
    - Delete the `Math.ceil(Math.sqrt(n))` columns (`FarmGrid.tsx:99`, the root of "no rows" in DECISIONS) and the
      `--n` custom property.
    - Bed layout uses a container query on `.farm-fit` (it already declares `container-type: size` ≥ 768 px; give
      `.beds` its own wrapper with `container-type: inline-size` so phones get one too):
      ```css
      .beds-wrap { container-type: inline-size; }
      .beds { display: grid; grid-template-columns: 1fr; gap: var(--s4); --cols: 3; --rows: var(--rows-stacked); }
      @container (min-width: 480px) {
        .beds { grid-template-columns: repeat(2, minmax(0, 1fr)); --cols: 6; --rows: var(--rows-paired); }
      }
      .bed { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--s2);
             padding: var(--s2); border: 2px solid #c8b99a; border-radius: 8px; position: relative; }
      .cell-slot { aspect-ratio: 1; border: 2px dashed #d6ccb8; border-radius: 6px; }
      ```
      `FarmGrid` sets `--rows-stacked = 2 × beds shown` and `--rows-paired = 2 × ceil(beds shown / 2)`, as inline style
      on `.beds`. The ≥ 768 px tile-size formula (`app.css` `.grid` block at line ~359) keeps working on `--cols` /
      `--rows`. Move it from `.grid` to `.beds`, and count the bed gap and padding in the width/height terms, so 24
      tiles still fit `.farm-fit` without scrolling at 1024 × 768.
    - Keep every existing cell feature unchanged: rings, flash, 📋 badge, the 💧 badge (it goes in batch 26), bars,
      and the tap → `onTap(i)` with the GLOBAL tile index.
    - Tests (jsdom): 9 tiles → 2 `.bed` groups, the second has 3 cells + 3 `.cell-slot`; 24 tiles → 4 beds × 6 cells,
      0 slots; tapping the 8th cell calls `onTap(7)`; no element carries `--n`. appCss test: `.beds` declares the
      `@container (min-width: 480px)` rule and `.bed` uses a 3-column grid.
- [x] 136. **`MiniLot` component (built and tested now, mounted in batch 27).** New `src/app/MiniLot.tsx`:
    `MiniLot({ state, onOpen }: { state: GameState; onOpen: () => void })`.
    - One `<button className="mini-lot" aria-label="Home lot — {ripe} ripe, open">`. It is the ONLY tap target
      (40 px tiles are under the 44 px minimum, so a tile never acts).
    - Inside: the same 4-bed arrangement at ~40 px per tile (`.mini-lot .bed` reuses `.bed`, with gap `var(--s1)` and
      padding 2 px). Each tile is a `<span>` with a class by state: `mini-empty` (untilled/tilled), `mini-growing`
      (crop emoji at 60 % opacity), `mini-ready` (crop emoji + green ring), `mini-dry` (orange ring). No bars, no
      labels.
    - A ripe-count badge in the corner: `🧺 {ripe}`, hidden at 0 (🧺 is Unicode 11, allowed).
    - Tests (jsdom): a seeded state with 3 mature tiles → badge `🧺 3` and aria-label contains "3 ripe"; one click
      calls `onOpen` once; no descendant `<button>`.
- [x] 137. **Gates + CHANGELOG.** Top line of `CHANGELOG`:
    `| 25 | <ship date> | Your home plot is laid out in four fixed beds of six, so it no longer reshuffles when you buy a tile |`

Hermes verifies live at 375 / 1024 / 1440 / 2560 / 3440 with 9, 15 and 24 tiles. Checks: no overlap between beds and
the tool rows, every tile visible without scrolling at ≥ 1024 × 768, a bought tile fills a slot with no reflow, rings
visible on both green and soil.

---

## Batch 26 — Placed home sprinklers (C2, tasks 138–141, save v19 → v20)

Scope: `src/core/workshop.ts`, `step.ts`, `workers.ts`, `fields.ts` (gate only), `actions.ts` (water), `tools.ts`
(targets), `balance.ts`, `state.ts`, `data/milestones.ts`, `src/save/serialize.ts`, `src/app/*`, tests. Fields
cohorts, pipes and the pipe coal are NOT touched in this batch.

`tests/fixtures/save-v19.json` and `code-v19.txt` are committed. They are real saves, captured on 2026-11-10:
- Hermes seeded `save-v18.json` on the live v19 build and let the shipped code migrate and re-save it, which gives
  `save-v19.json` (it holds `hoppers: [18, 14]`, `valve: true`, 400 field tiles and pipes 2).
- `code-v19.txt` is that save run through `encodeSave`.
Add both to the fixture lists in `tests/save.test.ts` and `tests/codec.test.ts`, the same way as v18.

- [x] 138. **Save v20: the workshop's shape.**
    - `Workshop = { built: boolean; beds: boolean[]; valve: boolean }`, with `beds.length === 4` (one socket per
      bed, `SPRINKLER_MAX`). `hoppers` is deleted. `createWorkshop()` returns `beds: [false, false, false, false]`.
    - `migrateV19` (SAVE_VERSION 20):
      1. `hoppers.length ≥ 1` → `beds: [true, true, true, true]`. Why: one machine already kept all 24 tiles wet
         (iron moisture 4 × 60 ticks = 240 s, and 6 tiles per 5 s = 72 waterings/min against a need of 6/min,
         `balance.ts:35,167`). With 0 hoppers → all `false`.
      2. Coal left in hoppers (sum) → `inventory.coal`, up to the storage capacity. The overflow is sold at coal's sell
         price into `cash` (and `lifetime.cashEarned` stays unchanged: a refund is not earnings).
      3. `valve` is kept as is (it gets its job in batch 28; it is not refunded).
      4. Everything else is unchanged. No earned value goes down.
    - Tests: every fixture v1…v19 migrates to v20; the v19 fixture keeps cash ≥ old, tiles, licenses and
      certificates; a forged v19 with `hoppers: [5, 24]` → 4 beds and +29 coal; with storage nearly full → coal capped
      and cash + overflow × coal price; with `hoppers: []` → no beds.
- [x] 139. **Core: build on a bed, irrigated tiles, the coal machinery deleted.**
    - `buildSprinkler(state, bed)` replaces `buySprinkler`. Order: `NO_WORKSHOP`, `LOCKED` (bed index out of 0…3, or
      the bed has no owned tile: `bed * 6 >= tiles.length`), `ALREADY_OWNED`, `NOT_ENOUGH_ITEMS`, `NO_CASH`. Price
      `sprinklerCost` unchanged (4 Au + 8 Fe + 8 Cu + 💰8,000). Payment happens on build: there is no
      bought-but-unplaced state.
    - `isIrrigated(run, i) = run.workshop.beds[Math.floor(i / 6)] === true` (exported from `workshop.ts`). A tile
      bought later into a built bed is irrigated at once.
    - `step.ts`: the `held` flag becomes `irrigated`. An irrigated tile's moisture is set to `waterMoisture(2)` (the
      iron fill) before growth and is never drained, so it always grows. Rot is unchanged.
    - Delete `sprinklersAct`, `sprinklerTargets`, `sprinklerWatered`, `fillHopper`, and `SPRINKLER_TILES`,
      `SPRINKLER_COAL_TICKS`, `SPRINKLER_HOPPER` with their accessors. Also delete the fuel loader's hopper branch
      (`workers.ts:57–62`): the loader feeds the furnace only (batch 28 gives it the field tank).
    - Watering skips irrigated tiles everywhere:
      - `water(state, i)` on an irrigated tile → `fail('IRRIGATED')`, no energy (new `ActionError`; toast text
        "This bed has a sprinkler — no watering needed");
      - `toolTargets(state, 'water')` never returns one;
      - the water worker's `jobTiles` never picks one (it idles unpaid when nothing is left, existing behaviour).
    - The valve sits inert: `buyValve` returns `LOCKED` until batch 28. An owned valve stays owned.
    - `fieldsGates(run).water = run.workshop.built && run.workshop.beds.some(Boolean)`. Milestone `firstSprinkler` =
      `beds.some(Boolean)`.
    - Tests: build on bed 0 with the recipe → `beds[0]`; bed 3 with 9 tiles → `LOCKED`; a second build on the same bed
      → `ALREADY_OWNED`; an irrigated planted tile at moisture 0 grows and never drains over 600 steps; water on it →
      `IRRIGATED` with energy unchanged; the water worker with 24 tiles all irrigated takes no action and pays no wage;
      a tile bought into a built bed is irrigated.
- [x] 140. **UI: socket stub, confirm sheet, irrigated look, honest Workshop line.**
    - New shared constant `SPRINKLER_EMOJI = '⛲'` (Unicode 5.2), used for every sprinkler glyph.
    - The bed (`.bed` from batch 25) shows a socket at its top-right corner (`.bed-socket`, a small riser stub). It
      shows only when the Workshop is built, the bed has ≥ 1 owned tile and the bed has no sprinkler. If the recipe
      is in storage, the stub pulses (reduced-motion: steady); otherwise it is grey.
    - Tapping the stub opens a confirm sheet (reuse `Modal`, `src/app/Modal.tsx`):
      - title "Bed {k+1} sprinkler";
      - line 1 "Waters these 6 tiles forever";
      - line 2 "Permanent — cannot be moved or sold";
      - the price (`priceText`);
      - a **Build** button. When short, Build is disabled and the sheet lists what is missing (`shortOf`).
      There is no placement mode and no cancel bar; closing the sheet is the cancel.
    - A built bed has a blue frame (`.bed-irrigated`, border `#4a90d9`) and `⛲` on the frame where the stub was.
      Irrigated cells render NO water bar and no "— dry!" label. The 💧 corner badge and the `watered` prop/state
      chain (`useGame.ts:233`, `FarmGrid`) are removed.
    - Workshop card: the gauges group becomes one line, `⛲ {n}/4 beds — the water worker retires at 4/4`. The Build
      group drops the Sprinkler row; a hint line says "Build on a bed's socket ⛲ on the farm". The Smart valve row
      shows "✓ Built — gets a job when Fields get pressure" if owned, and is hidden if not owned.
    - Workers card, water row: when every owned tile is irrigated, the sub-line reads "nothing to water — reassign".
    - `tips.ts` `workshop` text: "A shed for sprinklers. Build one on each bed's socket ⛲: that bed never needs water
      again. Bought once; it needs the deepest vein." Update the Shop/Bank gate text "1 sprinkler" → "1 bed sprinkler".
    - Tests (jsdom): the stub shows only under the 3 conditions; a click opens the sheet with both lines and the
      price; Build calls `act` with the bed index; an irrigated bed has the class and its cells have no water `Bar`;
      the Workshop line reads `2/4 beds`; the water row hint appears with 24 irrigated tiles.
- [x] 141. **Sim + CHANGELOG.**
    - Re-pin every sim number the deleted coal burn moves. Record old → new in the results. RNG draws are unchanged.
    - New pins:
      - (a) A forged v19 save (1 sprinkler, 24 tiles planted, no water worker) has no dry tile after 8 h of `step`
        post-migration.
      - (b) The ladder bot reaches the Tractor unlock with no milestone gap over 60 game-minutes. Say
        "game-minutes" in the test name.
      - (c) `step(s, n)` equals n × `step(s, 1)` for a state with 2 built beds.
      - (d) Reported, not asserted: workers freed at 4/4 beds, and coal/h saved against batch 24.2.
    - Top line of `CHANGELOG`:
      `| 26 | <ship date> | Sprinklers are built on a bed and water those six tiles forever — no coal, no refills |`

Hermes verifies: the save migration on the live build (seed v19 → reload → 4 beds if any sprinkler, coal moved, valve
kept), plus a stub → sheet → Build at 375 and 1440.

---

## Spike + calculator (Hermes, before batch 27, outside the repo)

1. A throwaway static page, outside the repo. Start from `save-v19.json` hand-converted to 8 fields. Show both stops
   with a 250 ms FLIP, field rows with chips, sockets and a ghost plot, and faked 20 and 60 fields. Toon opens it at
   375 / 1440 / 3440 and answers:
   (a) does the pull-back read as "my farm got big", or as a tab?
   (b) is a 52 px plot row comfortable under a thumb?
   (c) is ~1,160 px of rows acceptable?
   A "tab" verdict changes only batches 27 and 30 (ALT-3: free zoom on desktop).
2. The same day, a calculator on the real `balance.ts` functions re-derives Design C's S4 table: best plan / greedy
   marginal / mono / today's seeder rule at 1, 5, 10 and 20 fields. That gives the Manager rule a go or no-go
   (pin: Manager ≥ 0.9 × best fixed plan), and it fixes every (est.) number in batches 28–29.

---

## Batch 27 — Estate surface on today's cohorts (C3, tasks 142–144, UI only, no save bump)

Refined 2026-11-11 after the spike verdict (two stops kept, ALT-3 dropped; 52 px rows ok; long lists get a bottom bar)
and a live measurement at 1024 × 768. Scope `src/app` and `tests/` only — no `src/core`, no `src/save`, no save bump.
Cohorts stay the model, so the Estate shows today's Fields (rows per crop), not plots. Worker: GLM, `--max-turns 300`.

LOCKED (Toon) — design around these, do not argue them away:
- L1 sprinklers are placed and never move; L2 the Tractor opens a big farm as the MAIN view (two stops: 🚜 Estate and
  🏡 Home, one surface, the home lot shrinks into the Estate); L3 built systems change but do not drift far.
- Spike verdict: the pull-back reads as "my farm got bigger" → keep it; 52 px rows are fine.

Rules (every task):
- UI state lives in `tiles.ui` (`src/app/uiState.ts`), never in the save. Every new `UiState` field gets a default in
  `DEFAULT_UI` and a field-by-field fallback in `parseUi`, with a `tests/uiState.test.ts` case for a missing/broken value.
- Emoji only from shared constants (`CROP_EMOJI`, `ITEMS.*.emoji`, the constants at the top of `Fields.tsx`); every
  glyph Unicode ≤ 11. New glyphs used here: 🚜 🏡 🌱 🌾 💧 📋 ⚠ ✓ — all ≤ 11.
- Players before the Tractor (`run.fields.unlocked === false`) see NO change except the task-142a tile fix.
- No case-only file-name clashes: after 142.0, `git ls-files | sed -E 's/\.(tsx?|jsx?)$//' | sort -f | uniq -di`
  prints nothing. New test files: `tests/Estate.test.tsx`, `tests/estateText.test.ts` (no `estate.test.ts` exists — keep it that way).
- Never run `git push`. Commit per task. `pnpm test`, `pnpm lint`, `pnpm build` green before each commit.

- [x] 142. **1024 home-lot fit (carried in from batch 25) + one surface, two stops.**
  0) First, before any code: rename the five jsdom test files whose names clash with a `.test.ts` file once the
     extension is stripped (macOS tsc can skip one of a pair while Linux CI fails — batch 26's `Workshop` clash):
     `git mv` `tests/Bank.test.tsx` → `tests/BankTab.test.tsx`, `tests/Fields.test.tsx` → `tests/FieldsCard.test.tsx`,
     `tests/Orders.test.tsx` → `tests/OrdersCard.test.tsx`, `tests/Tools.test.tsx` → `tests/ToolsBar.test.tsx`,
     `tests/Workers.test.tsx` → `tests/WorkersCard.test.tsx`. Afterwards
     `git ls-files | sed -E 's/\.(tsx?|jsx?)$//' | sort -f | uniq -di` prints NOTHING. Own commit.
  a) Home lot fit — measured live at 1024 × 768 with the 24-tile v19 save (Hermes, 2026-11-11): centre column 419 px,
     beds stacked (threshold 480), 72 px tiles, `.farm-fit` scrolls 210 px, 21 of 24 cells overflow their text. The fix
     below was injected on the live build and re-measured: 1024 pairs the beds at 54 px tiles, no scroll, no cell
     overflow; 1280 82 px, 1440 95 px, 2560 194 px, 375 100 px all unchanged and no overflow. In `src/app/app.css`:
     - `@container (min-width: 480px)` on `.beds` (pairing) → `@container (min-width: 400px)`;
     - the `--tile` floor `max(72px, …)` in the `@media (min-width: 768px)` `.beds` rule → `max(52px, …)`;
     - compact cells by their own width — add:
       ```css
       .cell { container-type: inline-size; }
       /* < 80 px: the text label goes screen-reader-only (the emoji + bars carry the state) */
       @container (max-width: 79px) {
         .cell-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
         .cell-rot { font-size: 10px; }
       }
       /* < 64 px: the "rots in" text goes too (the red rot bar stays), tighter padding */
       @container (max-width: 63px) {
         .cell-rot { display: none; }
         .cell { padding: 4px 2px; gap: 2px; }
         .cell-emoji { font-size: 20px; line-height: 1; }
       }
       ```
     - update the comments that name 480 / 72 and `tests/appCss.test.ts` assertions that pin them.
     Known and left alone: a 768 × 1024 portrait tablet keeps stacked beds (its `.beds-wrap` is 321 px) and scrolls
     105 px.
  b) Stops (only when `run.fields.unlocked`): new `UiState` fields `stop: 'estate' | 'home'` (default `'estate'`) and
     `pulledBack: boolean` (default `false`). The centre `.farm` section renders a `<Surface>` (new
     `src/app/Surface.tsx`) instead of the bare `FarmGrid`:
     - a stop switch at the top: two buttons `🚜 Estate` / `🏡 Home`, `aria-pressed`, 44 px tall;
     - 🚜 Estate stop: `<Estate>` (task 143) — capacity strip, then `MiniLot` (`src/app/MiniLot.tsx`, built in batch
       25; `onOpen` → Home stop), then the crop rows;
     - 🏡 Home stop: today's content exactly (Tools where they render today, `FarmGrid`, and on phones/tablets the cards
       below it), plus ONE fold strip above the grid: a button `🚜 Fields · 🍋 120 · 🌶️ 40 · 🌾 30 ready` (licensed
       crops with standing tiles, `CROP_EMOJI` + `run.fields.planted`, ready from `fieldsStats`) whose tap → Estate.
     - switching: the two buttons, a tap on `MiniLot` (→ Home) or the fold strip (→ Estate), and keys `1` = Home,
       `2` = Estate, `Escape` = Estate. Keys are ignored when the event target is an `input`, `textarea` or `select`,
       or when any `[role="dialog"]` is in the document (the Modal, the tool popover), so Esc still closes those first.
     - opening: when the app loads with the welcome-back banner showing (`banner !== null` from `useGame`), the stop
       starts on Estate whatever was saved; otherwise the saved stop.
     - FLIP: the home-lot block (one wrapper `div.home-block` around `MiniLot` / `FarmGrid`) animates from its old rect
       to its new one when the stop changes: in `useLayoutEffect` keyed on the stop, read the rect stored on the last
       layout, apply `transform: translate(dx, dy) scale(sx, sy)` with `transition: none`, force a reflow, then
       `transition: transform 250ms cubic-bezier(.2,.7,.2,1)` and clear the transform. Skip when
       `prefers-reduced-motion: reduce` matches or either rect has zero width (jsdom).
     - pull-back, once: when `fields.unlocked && !ui.pulledBack` (a fresh Tractor, or an existing save that already
       owns it), set `pulledBack: true` immediately (a reload mid-animation does not replay), show the Home stop, after
       700 ms show a caption `🚜 Your farm got bigger` (`.pullcap`, centred over the surface, fades in/out) and switch
       to Estate with a 700 ms FLIP; the caption fades out at 2.6 s. Reduced motion: switch at once, caption 2 s.
     - both stops at once: a `ResizeObserver` on the `.farm` section sets `both = width >= 1100` (guard: no
       `ResizeObserver` → `false`). In `both` mode the surface is a two-column grid
       `grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)` — Estate left, Home (full `FarmGrid`) right — the stop
       switch and the fold strip hide, `MiniLot` hides, keys do nothing. Measured centre widths: 1440 → 669 (one stop),
       2560 → 1560 and 3440 → both.
  Tests: `uiState` defaults + fallbacks for `stop` / `pulledBack`; `tests/App.test.tsx`: no switch before the Tractor;
  with the v19 fixture state the switch renders, `2`/`Escape`/`1` change `aria-pressed`, Esc does nothing while a
  `Modal` is open, the fold strip and `MiniLot` switch stops, a banner at load forces Estate, `pulledBack` flips to
  true on first render; `appCss` asserts the 400 px container rule, the 52 px floor and both `.cell` container rules.

- [x] 143. **Estate content: capacity strip + crop rows + ghost row + machines.** New `src/app/Estate.tsx` and pure
  display helpers in `src/app/estateText.ts` (no React, unit-tested). All numbers come from today's core exports
  (`fieldsStats`, `fieldsPlantable`, `pipeCover`, `pipeCost`, `machineTilesPerHour`, `machineCost`, `fieldTileCost`,
  `fieldsPaybackHours`, `cropGrowTicks`, `cropSellPrice`, `cropSeedCost`, `marketFactor`, `plantBatch`,
  `harvestBatch`) and `priceText` / `shortOf` from `Mine.tsx`.
  a) Crop rows (the by-crop ledger), one per licensed crop, in `CROP_IDS` order, each one line ≥ 52 px:
     `🍋 Lemon · 120 tiles (30 ready, next in 3m) · ≈💰4,100/h · <priceTag> | [Plant 10] or [Stop]`.
     - tiles = `run.fields.planted[c]`; ready = sum of that crop's cohorts with `readyTick <= tick`; next = smallest
       `readyTick - tick` among its growing cohorts, shown as `m`/`h` (hide when none);
     - `estateCropIncomePerHour(state, c)` = `planted × 3600 / cropGrowTicks(c, meta, run.upgrades.fertilizer) ×
       (cropSellPrice(c, meta, run.upgrades.sellPrice) × marketFactor(c, run.market[c]) − cropSeedCost(c, meta))`,
       rounded, shown with `≈` (an estimate: it ignores stalls, orders, sickle doubles);
     - trend = `priceTag(state, c, ui.priceShown[c])` (the ▲▼ arrows already used in the Farm tab), and the
       `priceShown` recorder in `App.tsx:72–89` also runs while the Estate stop is on screen;
     - a crop not yet plantable shows `🏡 n/50 home harvests` (`run.lifetime.harvests[c]`, `fieldsCropHarvests()`)
       in place of the income, and its Plant button is disabled — same rule as `Fields.tsx:62–76` today;
     - Plant / Stop buttons = today's `plantFields` / `stopFieldsPlant` calls and price line, moved from `Fields.tsx`.
     - layout: the rows sit in `.estate-rows { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px,
       1fr)); column-gap: 40px; row-gap: var(--s2); }` (spike: rows flow into columns on wide panes); each row is a
       grid `minmax(0, 1fr) 96px` (text | button), the text truncates with ellipsis, never wraps the button under it.
  b) Ghost row, after the crop rows (dashed border, like `.cell-slot`): `＋ 10 tiles 💰X · ~N h payback` where X = the
     sum of `fieldTileCost(count + i, meta)` for i = 0..9 and N = `fieldsPaybackHours(state)`; the button buys up to 10
     tiles by applying `buyField` repeatedly inside ONE `act` (stops at the first failure; disabled when the first
     buy fails). Below it, when `pipeCost(run.fields.pipes, meta)` is not null: today's Pipes Lv row from
     `Fields.tsx:92–103`, unchanged.
  c) Capacity strip, at the top of the Estate (and at the top of the Estate column in `both` mode), one wrapping line of
     chips, ≥ 44 px tall in total:
     - `💧 {covered}/{pipeCover(pipes)} watered` (from `fieldsStats`);
     - `🌱 {seeder fleet tiles/h}/h · {free} empty` and `🌾 {harvester fleet tiles/h}/h · {ready} ready` (fleet =
       sum of `machineTilesPerHour(kind, tier)` over `run.fields.machines[kind]`; `0/h` when none);
     - the first accepted, unfinished order (`run.orders.offers`, `isOffer`, `accepted && done < count`) as
       `📋 🍋 12/30`; hidden when none;
     - ONE bottleneck chip from `estateBottleneck(state)` (pure, in `estateText.ts`), first match wins:
       1. `growing > 0 && (run.inventory.coal ?? 0) < 1` → `⚠ Coal — the pump is dry, growth paused` (fix text: `mine
          or buy coal`);
       2. `stalled > 0` → `⚠ Pipes — {stalled} tiles wait` + the next Pipes price via `priceText`, or `max pipes`;
       3. `free >= plantBatch()` and no seeder and `run.fields.plantCrop === null` → `⚠ Sowing — {free} tiles empty`
          + `pick a crop to Plant`; with no seeder owned but a crop picked → `⚠ Sowing` + the cheapest Seeder Mk not
          owned (its `priceText`, or its certificate reason);
       4. `ready >= harvestBatch()` and no harvester → `⚠ Reaping — {ready} ready` + the cheapest Harvester Mk not owned;
       5. otherwise `✓ Land — next 10 tiles` + the ghost-row price.
       Each fix shows time-to-afford: `now` when affordable; else the cash gap ÷ the sum of the rows' `≈💰/h`, as
       `~N min` / `~N h` (marked `≈`); bar shortfalls via `shortOf` (`needs 8🥉 more`) instead of a time.
  d) Machines: today's Machines group (`Fields.tsx:105–129`, `RecipeRow`s) moves under the ghost rows inside a
     `<details className="estate-machines">` default closed, with a visible ▸/▾ chevron and a header styled like a
     button (the `.tools-head` pattern).
  e) The side-panel / below-grid Fields card (`Fields.tsx`) shrinks to one summary line: `🚜 Fields · {count} tiles ·
     🌾 {ready} ready · ⏳ {stalled} stalled` + a `Open Estate` button that sets `stop: 'estate'` and, on phones,
     `view: 'farm'`. The 3-bar gauge block and the Plant / Expand / Machines groups leave `Fields.tsx` (they now live
     in the Estate). Before the Tractor the card renders nothing, as today.
  Tests: `tests/estateText.test.ts` — `estateCropIncomePerHour` against hand arithmetic for one crop; each bottleneck
  branch with a forged state, and the first-match order (dry pump beats stalled); time-to-afford text for now / cash
  gap / bar gap. `tests/Estate.test.tsx` (v19 fixture state, migrated): a row per licensed crop with tiles and ready
  counts that match `fieldsStats`; Plant then Stop call through `act`; the ghost row buys 10 tiles when cash allows
  and fewer when it does not; the machines `details` is closed by default. Update `tests/FieldsCard.test.tsx` (renamed in
  142.0) for the summary card.

- [x] 144. **Phone bar + 📋 sheet + CHANGELOG.**
  - At < 768 px with the Tractor owned, the farm view's tool bar swaps per stop: Home = today's `Tools` bar; Estate =
    three `flex: 1` buttons: `🌱 Sow 10 <crop emoji>` (calls `plantFields(state, run.fields.plantCrop)`, disabled when
    no crop is picked, with a `pick a crop below` title), `🌾 Reap · {ready}` (disabled; its title and a one-line hint
    under the bar read `Harvesters reap the Fields — hand reaping comes next update`), `＋10 tiles` (the ghost-row
    action). Same position, gap and height rules as today's mobile `.tools` bar.
  - At < 768 px with the Tractor owned, the Orders / Workers / Workshop cards that render below the grid today
    (`App.tsx:162–170`) move into one `📋 Orders · Workers · Workshop` button that opens them in the shared `Modal`
    (`src/app/Modal.tsx`). The accepted order stays visible on the capacity strip (143c). Before the Tractor, phones
    are unchanged. `DigSeeds` and the Fields summary card stay where they are.
  - CHANGELOG (top of `src/app/changelog.ts`, batch `'27'`):
    `The Tractor opens your Estate: the whole farm at a glance, the home lot one tap away — and smaller screens now fit
    the whole home lot without scrolling`.
  - Tests: App at a 375 px `matchMedia` stub with the v19 state: the Estate bar shows three buttons and Sow calls
    `plantFields`; the 📋 button opens a dialog holding the three cards; without the Tractor no 📋 button and today's
    cards render.
  - Hermes checks live after the push at 375 / 1024 / 1440 / 2560 / 3440 with the v20 live save from the v19 fixture
    (Fields unlocked, 400 tiles, pipes 2, Harvester Mk1+2, Seeder Mk1): no x-scroll, no overlap of strip / rows /
    switch, both stops at ≥ 2560, pull-back plays once, keys, FLIP, phone bar and sheet. Plus the 1024 × 768 home lot
    with 24 tiles: paired beds, no scroll, no cell overflow.

---

## Batch 28 — Plots, pivots, pumps, pressure (C4a, tasks 145–148, save v20 → v21)

Refined 2026-11-11 by Hermes from the code at `72ec00a` (`src/core/fields.ts` 433 lines, `state.ts:129–151`,
`balance.ts:257–325`, `serialize.ts:22,435–465`, `workers.ts:51–56,86`, `step.ts:57–62`, `orders.ts:56`,
`src/app/Estate.tsx`, `estateText.ts`, `Fields.tsx`, `Surface.tsx:139–141`) and the calculator
(`docs/DECISIONS.md` "Big farm numbers from the crop-mix calculator"). This section is the authority: every number,
label, error order and test below is fixed — do not pick other values. All save shape for batches 28 AND 29 lands
here, so batch 29 needs no bump. Worker: **Opus**, `--max-turns 140` (core rewrite + migration + sim re-pins + UI).

LOCKED (Toon) — design around these, do not argue them away:
- L1 a sprinkler is placed and never moves; L2 the Tractor opens the Estate as the MAIN view (two stops);
  L3 systems may change but must not drift far — always something to do; L4 every object answers The Door Problem.
- A plot is 10 tiles (the unit of land and work); a field is 5 plots (the unit of water and crop); one pivot per
  field; the pump caps wet fields at 2 / 6 / 12 / 20; coal = pressure ×2, an empty tank = ×1, fields never stall or
  die; pressure ships together with plots. Seeders and planters never pick a crop (the field chip does).
- Every batch ships to live players: the game must stay fully playable on the new model after this batch.

Rules (every task):
- Save progress must survive: `SAVE_VERSION = 21`, `migrateV20` chained for every older version, migrations never
  take earned value away. Freeze the v20 shape as `RunV20`/`SaveV20` types in `serialize.ts` (past shapes are never
  derived from the live `RunState`), the way `WorkshopV19` was frozen.
- Purity: `grep -rn "Date.now\|react" src/core src/save` stays empty.
- Item ids and emoji only from `src/core/data/items.ts` and existing constants; every glyph Unicode ≤ 11
  (new here: ⛽ U+26FD Unicode 5.2, 💼 Unicode 6).
- No file names that differ only in case or extension:
  `git ls-files | sed -E 's/\.(tsx?|jsx?)$//' | sort -f | uniq -di` prints NOTHING.
- Grep `tests/` for every render of a component whose props change and every caller of a deleted export; CI's
  `tsc -b` fails on a stale import. Cast `querySelector<HTMLElement>` before `.style`.
- Never change a balance number to make a pin pass. When a pin fails at the fixed numbers, keep the numbers, mark
  the test `it.fails`/`it.todo` with the measured value in its title and record it under `### Deviations`.
- Never run `git push` or `pnpm dev`. One commit per task (`feat: batch 28 task N — …`). `pnpm test`, `pnpm lint`,
  `pnpm build` green before each commit; `rm -f node_modules/.tmp/*.tsbuildinfo && npx tsc -b --force` once at the end.

### Door Problem answers (for the worker; nothing here is open)
- **Plot** — bought with cash (＋ Plot); state = empty / growing (crop emoji + "next in") / ready (🌾); fails: never
  (no death, no stall); 8 h offline: ripens on its absolute `readyTick`; prestige: Sell the farm resets the fields
  (`createFields()`); touched by: planter/harvester workers, both machines, hand Sow/Reap.
- **Pivot** — built on a field's socket, permanent; state = wet / dry (dry rows say "no pivot — cannot sow"); a
  field without one can hold and reap plots but never be sown; the pump cap limits how many can exist.
- **Pump** — tier 0 comes with the Tractor (2 fields); tiers 1–3 are Estate recipes; sets the wet-field cap and the
  tank size.
- **Tank** — filled by hand (Fill tank) or by the fuel loader (furnace first, then the tank); state = "⛽ 37/120 ·
  ×2" or "⛽ empty · ×1"; failure = pressure off, growth ×1, never a stall; worst-case offline loss = the tank's
  content (≤ 8 h of burn), bounded by the tank cap; the valve removes idle burn.

- [x] 145. **Model + migration v21.**
  a) `src/core/state.ts` — replace `Cohort` (`:129–130`) and `Fields` (`:138–152`):
     ```ts
     /** one plot = PLOT_TILES tiles; crop null = empty; readyTick = the absolute tick it ripens (ignored when empty) */
     export type Plot = { crop: CropId | null; readyTick: number }
     /** one field = up to FIELD_PLOTS plots; pivot = wet (sowable); crop = the chip (what gets sown next); pinned =
      *  the Manager leaves it alone (batch 29) */
     export type Field = { pivot: boolean; crop: CropId | null; pinned: boolean; plots: Plot[] }
     /** pump = owned tier (0 = the Tractor's); tank = burn units, TANK_UNITS_PER_COAL per coal (integers, exact) */
     export type Fields = { unlocked: boolean; list: Field[]; pump: number; tank: number; machines: Machines }
     ```
     `createFields()` → `{ unlocked: false, list: [], pump: 0, tank: 0, machines: createMachines() }`. `count`,
     `planted`, `cohorts`, `pipes`, `plantCrop` and `coalCarry` are gone; `planted` per crop becomes the derived
     helper `plantedTiles(fields, crop)` (task 146).
  b) Batch-29 shape, added now (nothing uses it in 28):
     - `Counters` gains `contractsByHand: number` (0 in `createInitialState`, the migration sets 0).
     - `WORKER_JOBS` gains `'manager'` LAST (`src/core/data/workers.ts:4`); `assigned.manager = 0`.
       `CERTIFICATES.manager = { price: { goldBar: 4, cash: 500000 }, counter: 'contractsByHand', at: 3 }` (est.,
       batch 29's sim pins it) — it cannot unlock in 28 because nothing increments `contractsByHand` yet.
       `NO_TILE_WORK.manager = () => null` (idles unpaid). Add one exported `HIDDEN_JOBS: readonly WorkerJob[] =
       ['manager']` in `data/workers.ts`; the Workers card rows, the `cert…` milestone rows (`milestones.ts:73`) and any
       other `WORKER_JOBS.map` in `src/app` skip hidden jobs (batch 29 empties the list). Emoji `💼` (Unicode 6 — the
       design's 🧑‍💼 is an Emoji 12.1 sequence and renders as tofu on Toon's device), label `Manager`, tip
       `Picks each field's crop (comes with Estate contracts).`
  c) `migrateV20` (v20 → v21), in this order, pure:
     1. Not unlocked → `fields = { unlocked: false, list: [], pump: 0, tank: 0, machines: run.fields.machines }`.
     2. Stalled cohorts: run the old prefix rule at the save's tick (`fields.ts:110–126`: ready cohorts skip the queue,
        growing cohorts fill `PIPE_COVER[pipes]` = `[0, 60, 150, 300]` in array order, the first misfit and every
        later growing cohort are stalled). Each stalled cohort's `count` goes back to `seeds[crop]` (the pouch has no
        cap) and the cohort is dropped.
     3. Kept cohorts → plots, per crop in `CROP_IDS` order: sort that crop's cohorts by `readyTick` ascending, cut
        the tiles into chunks of 10 (the last chunk rounded UP to a full plot); each plot's `readyTick` = the
        earliest `readyTick` in its chunk; then for a growing plot (`readyTick > tick`):
        `readyTick = tick + ceil((readyTick − tick) / 2)` (the old rule closed 2 per covered tick).
     4. Plot count `P = max(ceil(count / 10), planted plots)`, at least 1. Order: planted plots (crop order, then
        readyTick), then empty plots `{ crop: null, readyTick: 0 }`. Fields = chunks of 5 in that order from Field 1
        (the last field may be partial). Each field's chip = the crop holding most plots in it (tie → earlier in
        `CROP_IDS`); a field with no planted plot gets the old `plantCrop` (may be null). `pinned: false`.
     5. `pump = pipes`. Pivots: Field 1 always; then every field holding a planted plot, in order, while pivots <
        `pumpFieldCap(pump)`; then further fields in order until pivots ≥ `min(list.length, pumpFieldCap(pump),
        ceil(PIPE_COVER[pipes] / 50))`.
     6. `tank = min(tankCapCoal(pump), storage coal) × TANK_UNITS_PER_COAL`, that coal removed from
        `inventory.coal` (the old pump drew the same coal).
     7. `coalCarry` dropped; `machines` (tiers and carries) kept; `workshop.valve` kept.
     8. `assigned.manager = 0`, `counters.contractsByHand = 0`.
  d) Fixture: Hermes commits the real `tests/fixtures/save-v20.json` (written by the live v20 build) before
     dispatch. Add it to the fixture list in `tests/save.test.ts` (`?raw` import like `v19`).
  e) Tests (`tests/save.test.ts`, new `describe('v20 → v21: plots')`):
     - every fixture v1…v20 deserializes to version 21 with no throw;
     - for every fixture with the Fields unlocked (v16–v20): owned tiles (`10 × plots`) ≥ old `count`; wet tiles
       (tiles in fields with a pivot) ≥ old covered + ready (`fieldsStats` numbers, computed in the test from the raw
       cohorts with the prefix rule); seeds returned = the old stalled count per crop; storage coal + tank coal =
       old storage coal; `list.length ≤ ceil(P / 5)`; every growing plot's remaining ticks = ceil(old / 2);
     - a hand-built v20 save: unlocked with count 0 → Field 1 with pivot + 1 empty plot; pipes 0 with 3 growing
       cohorts → all stalled, seeds back, plots empty;
     - each fixture's 8 h (`step(s, OFFLINE_CAP_TICKS)`) earns at least what the v20 code earned (`run.cash` delta),
       measured by Hermes on `72ec00a`: v16 ≥ 💰458,346 · v17 ≥ 💰446,798 · v18 ≥ 💰442,797 · v19 ≥ 💰441,238 ·
       v20 ≥ 💰439,579. (Context, measured: on the v20 code every one of these saves ends
       the 8 h with 0 coal in storage and every field tile still growing, none ready — the pump ran dry and the
       Fields stood still; under v21 an empty tank still grows at ×1.)

- [x] 146. **Core: plots, fields, pivots, pumps, whole-plot work** (`src/core/fields.ts` rewrite, `balance.ts`).
  a) `balance.ts` — replace the pipe block (`:257–325`), keeping `FIELDS_COST`, `FIELDS_CROP_HARVESTS`, the machine
     block and `fieldTileCost` (used for the plot price):
     ```ts
     const PLOT_TILES = 10
     const FIELD_PLOTS = 5
     export const FIELD_PRESSURE = 2 // named and displayed: a full tank grows fields ×2
     const PUMP_FIELD_CAP = [2, 6, 12, 20] // index = pump tier owned
     const PUMP_COSTS: ReadonlyArray<Price> = [
       { copperBar: 8, cash: 500000 }, { ironBar: 8, cash: 1500000 }, { goldBar: 8, cash: 3000000 },
     ]
     const PIVOT_ITEMS: Price = { goldBar: 3, ironBar: 6, copperBar: 6, cash: 0 }
     const PIVOT_CASH_STEP = 50000 // pivot n costs PIVOT_ITEMS + 50,000 × (n − 1), n = 2…20
     const FIELD_COAL_PER_PLOT_HOUR = 0.5 // was PIPE_COAL_PER_10_TILES
     export const TANK_UNITS_PER_COAL = 7200 // 1 burn unit = 1 plot for 1 tick (0.5 coal / plot / h)
     const REAP_PLOT_ENERGY = 10
     ```
     Exports: `plotTiles()`, `fieldPlots()`, `plotCost(plots, meta)` = Σ `fieldTileCost(10·plots + i, meta)` for
     i = 0…9 (= 💰10,000·p + 5,500 at base, p = plots owned); `pivotCost(n, meta)` (scalePrice of items + cash);
     `pumpCost(pump, meta)` (null at the top), `pumpMaxTiers()` = 3, `pumpFieldCap(pump)`, `tankCapCoal(pump)` =
     8 × `pumpFieldCap(pump)` × `FIELD_PLOTS` × `FIELD_COAL_PER_PLOT_HOUR` → 40 / 120 / 240 / 400, `fieldCoalPerPlotHour()`,
     `reapPlotEnergy()`. Delete `pipeCover`, `pipeCost`, `pipeMaxTiers`, `pipeCoalPer10Tiles`, `pipeCoalPerTick`,
     `plantBatch`, `harvestBatch` (a plot is the batch now) and fix every caller.
  b) `ActionError` gains `'NO_PIVOT'`, `'NO_CROP'`, `'PUMP_FULL'`; `ERROR_TEXT` (`src/app/useGame.ts:17`):
     `NO_PIVOT: 'This field has no pivot — build one to sow it'`, `NO_CROP: 'Pick a crop for this field first'`,
     `PUMP_FULL: 'The pump feeds no more fields — build the next pump'`.
  c) Actions (error orders fixed; `pay` gives NOT_ENOUGH_ITEMS before NO_CASH):
     - `unlockFields` (unchanged gates and price) now sets `list = [{ pivot: true, crop: null, pinned: false,
       plots: [{ crop: null, readyTick: 0 }] }]` — Field 1, its pivot and plot 1 come with the Tractor.
     - `buyPlot(state)` — LOCKED, PUMP_FULL, NO_CASH. Price `plotCost(total plots owned)`. Goes into the first field
       with < 5 plots; if none, opens a new field `{ pivot: false, crop: null, pinned: false, plots: [plot] }`, allowed
       only while `list.length < pumpFieldCap(pump)` (else PUMP_FULL).
     - `buildPivot(state, field)` — LOCKED, BAD_TILE (no such field), ALREADY_OWNED, PUMP_FULL (pivots owned ≥ cap),
       NOT_ENOUGH_ITEMS, NO_CASH. Price `pivotCost(pivots owned + 1)`.
     - `buyPump(state)` — LOCKED, NO_WORKSHOP, MAX_LEVEL, NOT_ENOUGH_ITEMS, NO_CASH (replaces `buyPipes`).
     - `setFieldCrop(state, field, crop | null)` — LOCKED, BAD_TILE, NOTHING_TO_DO (same as the chip), NO_LICENSE,
       LOCKED (not `fieldsPlantable`). Free; standing plots finish as they are.
     - `sowPlot(state, field, plot)` — LOCKED, BAD_TILE, NO_PIVOT, NO_CROP, NOTHING_TO_DO (plot not empty),
       NO_SEEDS, NO_CASH. All-or-nothing: needs `stock ≥ 10`, or auto-buy on and cash ≥ (10 − stock) × seed price;
       then rolls the dibber's seed-keep per tile exactly like `plantFields` today (`fields.ts:147–165`). No energy.
       Sets `readyTick = tick + ceil(cropGrowTicks(crop, meta, fertilizer) / FIELD_PRESSURE)`.
     - `sowNext(state)` — LOCKED, NOTHING_TO_DO (no empty plot in a field with pivot + chip), then `sowPlot`'s
       errors for the first such plot (fields in order, plots in order).
     - `reapPlot(state, field, plot)` (by hand) — LOCKED, BAD_TILE, NOT_MATURE (empty or growing), NO_ENERGY
       (`reapPlotEnergy()` = 10 ⚡, added to `lifetime.energySpent`). Sickle doubles roll per tile (as
       `fieldsHarvest`, `fields.ts:198–204`); sells through `harvestSale` at ×1 (the hand-picked ×1.25 into orders
       arrives with contracts in batch 29). Home counters and `lifetime.harvests` untouched (the 50-harvest gate keeps
       its meaning). The plot becomes `{ crop: null, readyTick: 0 }`.
     - `reapNext(state)` (by hand) — LOCKED, NOTHING_TO_DO (nothing ready), NO_ENERGY; reaps the oldest ready plot.
  d) Work order (workers and machines): the oldest ready plot (smallest `readyTick`, ties → field order, plot order)
     and the first empty plot in a field with a pivot and a chip. `fieldsHarvest` (harvester worker, `workers.ts:86`)
     reaps one whole plot per action, no energy; `fieldsPlantAction` sows one whole plot per action via `sowNext`.
     Workers still work the home lot first (unchanged). `machinesAct` keeps its maintenance rule and the
     machines-before-workers order (`step.ts:60`), on whole plots: the harvester accrues `carry.harvest` only while a
     plot is ready, reaps one plot per 10 accrued (as many as are ready), then clamps the carry to ≤ 10; the seeder
     accrues only while `sowNext` has a target, sows one plot per 10 accrued, and on NO_SEEDS / NO_CASH holds
     `carry.plant = 10` (as today). Delete `seederCrop`, `plantFields`, `stopFieldsPlant`, `buyField`, `buyPipes`,
     `fieldsStats`, `withCohorts` and the prefix coverage rule (`fields.ts:121,250`).
  e) Helpers (exported, used by the UI and sim): `plotState(plot, tick)` → `'empty' | 'growing' | 'ready'`;
     `fieldsOverview(run)` → `{ plots, tiles, fields, wetFields, empty, emptyWet, growing, ready }` (counts of plots;
     `emptyWet` = empty plots in fields with pivot + chip); `plantedTiles(fields, crop)` (10 × plots of that crop);
     `pivotsOwned(fields)`; `fieldsMarginalIncomePerHour` / `fieldsPaybackHours` keep their meaning with the pressured
     cycle (`ceil(grow / FIELD_PRESSURE)`) and the payback = `plotCost` ÷ (10 × marginal per tile).
  f) Other readers: `orders.ts:56` standing = `plantedTiles(run.fields, good)`; milestones (`milestones.ts:89–91`)
     keep their ids: `firstField` = plots ≥ 1, `fields100` = owned tiles ≥ 100, `fields500` = owned tiles ≥ 500.
  g) Tests: rewrite `tests/fields.test.ts` for the new API (each error order above, the plot price sum, the open-a-field
     rule, PUMP_FULL, the Tractor gift, all-or-nothing sowing, the dibber roll per tile, hand reap energy and ×1 sale,
     worker and machine plot order, machine carry clamp/hold). Sim perf (`tests/sim.test.ts:3444,3661,3994`): 100 /
     192 / 300 plots × 8 h each < 2,000 ms with step identity — build the 192/300-plot states directly (60 fields, as a
     migrated save holds them; only 20 are pivoted).

- [ ] 147. **Pressure: the tank, the valve's new job, the loader.** (`fieldsAct`, `workshop.ts`, `workers.ts`)
  a) `fieldsAct` per tick (still after the workers, `step.ts:62`): burning plots = without the valve every plot in a
     field with a pivot (empty ones too); with the valve only growing plots in a field with a pivot. If
     `tank ≥ burning`: `tank −= burning` and pressure is on; else the tank is left as it is and pressure is off.
     Then every growing plot whose field has no pivot, or every growing plot at all when pressure is off, gets
     `readyTick += 1` when `run.tick` is odd (nets ×1). Nothing else changes; fields never stall and never die.
     Return the same state object when nothing burns and nothing slows.
  b) `fillTank(state)` — LOCKED, NOTHING_TO_DO (room < 1 coal: `floor((tankCapCoal(pump) × U − tank) / U) < 1`),
     NOT_ENOUGH_ITEMS (no coal in storage). Moves `min(room, storage coal)` whole coal. No energy.
  c) Fuel loader (`workers.ts:51–54`): the furnace first (unchanged condition), else the tank when the Fields are
     unlocked, the tank has room for 1 coal and storage has 1 — one coal per action. Update the doc comment.
  d) `buyValve` (`workshop.ts:37`) is live again — NO_WORKSHOP, LOCKED (Fields not unlocked), ALREADY_OWNED,
     NOT_ENOUGH_ITEMS, NO_CASH; price unchanged `valveCost` (2 Au + 💰8,000). Update the "inert until batch 28"
     comments in `workshop.ts:3,36`, `state.ts:124–125`, `balance.ts:223`.
  e) Tests: tank pays → ×2 (a plot sown at tick t ripens at t + ceil(grow/2)); empty tank → ×1 exactly (ripens at
     t + ceil(grow/2) + the odd ticks passed); valve on → empty/ready plots burn nothing; valve off → they burn; a dry
     field's growing plot ripens at ×1 and burns nothing; fill tank error order and the whole-coal move; loader:
     furnace first, then tank, then idle; `buyValve` order. **Pins:** 20 pivoted fields × 5 growing plots with a full
     Pump-3 tank (400 coal) stay at ×2 for every one of the 28,800 offline ticks and end at tank 0; the same farm
     with an empty tank ripens everything at ×1; step(s, n) = n × step(s, 1) with the tank crossing empty mid-run.

- [ ] 148. **Minimal Fields UI on the new model + sim + CHANGELOG.** (`src/app` only besides the sim)
  a) Capacity strip (`Estate.tsx:88–94`): `💧 {wetFields}/{pumpFieldCap} fields wet`;
     `⛽ {floor(tank/U)}/{tankCapCoal} · ×2` when the last tick had pressure, else `⛽ empty · ×1` (warn style);
     `🌱 {seeder rate}/h · {emptyWet} plots to sow`; `🌾 {harvester rate}/h · {ready} ready`; the order chip and the
     bottleneck chip stay.
  b) Bottleneck chip (`estateText.ts:61–107`), first match wins:
     1. pressure off with growing plots → `⚠ Pressure off ×1 — tank empty` / `Fill tank` (storage coal ≥ 1) else
        `mine coal`;
     2. a field holding plots has no pivot → `⚠ Dry — Field {k} has no pivot` / `Pivot {pivotCost} · {afford}`;
     3. empty plots in pivoted fields with no chip → `⚠ Sowing — pick a crop for Field {k}` / `pick a crop`;
     4. emptyWet ≥ 1 and no seeder → today's branch 3 text with plots;
     5. ready ≥ 1 and no harvester → today's branch 4 text with plots;
     6. the next plot needs a new field and `list.length ≥ pumpFieldCap` → `⚠ Pump — Field {n} needs Pump Lv{x}` /
        pump price · afford (`max pump` at the top);
     7. `✓ Land — next plot` / `＋ Plot 💰{plotCost} · {afford}`.
  c) Field rows replace the crop rows (`Estate.tsx:96–124`): one `.estate-row` per field up to the pump cap; fields
     beyond it collapse into ONE row `Fields {a}–{b} · 🚱 beyond Pump {pump}` (🚱 Unicode 6). Row text:
     `Field {k} · {CROP_EMOJI|—} · {plots}/5 plots ({ready} ready{, next in …})`, small line = the chip crop's
     `≈💰/h` (`estateCropIncomePerHour`, now per field and pressured) or `no pivot — cannot sow`. Controls: a
     `<select>` crop chip (licensed + fields-plantable crops and `— none —`, `aria-label="Field {k} crop"`) →
     `setFieldCrop`; `Sow` (`sowPlot` on the field's first empty plot); `Reap ⚡10` (`reapPlot` on its oldest ready
     plot); a dry field shows `Build pivot` + `priceText(pivotCost)` instead of Sow.
  d) Expand group (`Estate.tsx:125–150`): ghost row `＋ Plot 💰{plotCost}{ · opens Field n}{ · ~X h payback}` →
     `buyPlot` (disabled with `needs Pump Lv{x}` when PUMP_FULL); `🚰 Pump Lv{n+1}` recipe row `waters {cap} fields ·
     tank {tankCapCoal} {coal emoji}` → `buyPump`; `⛽ Fill tank` row `+{n} {coal emoji} from storage` → `fillTank`;
     the smart valve RecipeRow (workshop built, valve not owned) `pivots burn coal only while a plot grows` →
     `buyValve`. In `Workshop.tsx:73–76` the owned valve's line becomes `no idle burn in the Fields`.
  e) Phone Estate bar (`Estate.tsx:42–65`): `🌱 Sow` → `sowNext` (title = the error text when disabled),
     `🌾 Reap · {ready}` → `reapNext` (enabled now; 10 ⚡), `＋ Plot` → `buyPlot`. Delete `buyTenFields` and the
     "hand reaping comes next update" hint (`Estate.tsx:55,62`).
  f) `Fields.tsx` summary: `🚜 Fields · {plots} plots · 🌾 {ready} ready · ⛽ ×2|×1`. `Surface.tsx:139–141` fold strip
     reads `plantedTiles`. Grep `src/app` for `pipe`, `Pipes`, `stalled`, `cohort`, `tiles empty` and update copy.
  g) Sim (`tests/sim.test.ts`, the batch 18/19/22 describes from `:3240`): the ladder becomes `fields` (unlock) →
     `pivot2` + `plots10` → `pump1` → `plots30` → `harvester1` → `seeder1` → `pump2` → `plots60` → `harvester2` →
     `seeder2` → `harvester3`; the bot sets each new field's chip to its best fields-plantable crop (it picks lemon
     today, `sim.test.ts:821–823`), keeps an hour of tank burn in storage and fills the tank when it has room.
     Pins: the existing ≤ 60 game-minute unlock-step pin and pin 26b stay; **no milestone gap > 60 game-minutes from
     the Tractor to Pump 2**; something is buyable (plot, pivot, pump or machine) at every pump cap; every bar price ≤
     the storage the player holds when it becomes buyable; `plotCost` = the ten-tile sum, `pivotCost` and `pumpCost`
     follow the rule above. Reported (printed, not pinned): income per hour at 2 / 6 / 12 / 20 fields (mono strawberry
     vs the bot's chips), tank coal/h vs the miner's coal/h at each cap, and the **labor-bound** income at 20 fields:
     20 fields need 15,000 tiles/h sown and reaped, the full fleet does 12,600 reap + 5,400 sow, a planter worker on
     whole plots 7,200/h — report tiles/h sown and reaped vs needed and the income it caps. Re-pin every number the
     batch 18/19/22 tests pinned on cohorts with the measured value; list old → new in the results.
  h) Tests: `tests/Estate.test.tsx`, `tests/estateText.test.ts`, `tests/FieldsCard.test.tsx` rewritten for rows,
     chips, the bottleneck order, the collapsed row, the phone bar; the v20 fixture rendered after migration shows
     Field rows and no "Pipes" text. jsdom only — list what you could not verify (layout at 375 / 1024 / 1440) under
     `### Deviations`; Hermes checks live.
  i) CHANGELOG: ONE entry at the TOP of `CHANGELOG` in `src/app/changelog.ts`, copied verbatim:
     `{ batch: '28', date: '<today, YYYY-MM-DD>', line: 'Fields now come in plots: buy land ten tiles at a time, build a pivot to water each field, and keep the coal tank full to grow twice as fast — you can also reap a plot by hand' }`
  j) Write `## Batch 28 results` + `### Deviations` at the TRUE END of `docs/PLAN.md` and tick 145–148.

---

## Batch 29 — Estate contracts + 🧑‍💼 Manager + crop chips (C4b, tasks 149–151, no save bump)

- [ ] 149. **Estate contracts.**
  - After the Tractor, a crop order's size = tier minutes × max(today's capacity for that crop, 15 % of wet field
    tiles at that crop's pace) (`orders.ts` `orderPerMinute`/`orderCount`).
  - An off-crop order pays base ×1.1 with no glut.
  - The player accepts it with a button; the clerk delivers but never accepts a crop contract.
  - A hand-reaped plot delivered into an order or contract pays the hand-picked ×1.25; otherwise ×1.
  - Each contract the player delivers by hand: `counters.contractsByHand + 1`.
- [ ] 150. **🧑‍💼 Manager worker (M1–M5).**
  - New certificate job `manager`, unlocked after N = 3 hand-delivered contracts (sim may move N).
  - Wage = 💰28 per worker action ≈ 💰20,000/h (calculator 2026-11-11: 2 % of net at 2 fields, 0.2 % at 20; sim may
    move it; per-job wage support in `balance.ts`).
  - On each worker round:
    - accepted orders/contracts first: fields to flip = ceil(shortfall ÷ (50 tiles × yield per cycle));
    - the rest: the EXACT best plan over the fields it may flip (DP over crops × fields, ≈ 3,200 ops per round), not
      greedy — the price floor makes per-crop income non-concave and greedy-per-field drops to 0.83 × best at base
      levels and 0.73 × with deeper markets (calculator 2026-11-11);
    - it never accepts an order and never touches a 📌 pinned field.
  - Its row shows its plan, e.g. "🍓 ×3 fields → order #12 · 🍋 rest".
  - The certificate resets on prestige like the others.
  - Pool: 8 jobs / 6 slots.
- [ ] 151. **Chips wiring + sim.** The crop sheet shows marginal 💰/h per crop for this field from Field 1, the price
  factor and 🏡 n/50. With no Manager and no chip, the field waits and the strip says why. Sim: Manager ≥ 0.99 × best
  fixed plan at base levels, at sell 5 + fert 5, and with renown floors; report best / Manager / mono / old rule.

---

## Batch 30 — Estate map (C5, tasks 152–154, UI only)

- [ ] 152. Field rows on the Estate stop:
  - memoised plot cells: a chip of 64 px + five 52 px cells at 375 px;
  - the ghost plot with payback hours;
  - the ghost field, which names the pump tier and its bar price;
  - fields past the pump cap collapse into one row: "Fields 21–60 · 🚱 beyond Pump 3".
- [ ] 153. Crop chip + sheet on the row, the pivot socket (same stub → sheet → Build as the beds), the 🚜 marker on
  the plot being worked, tap an empty plot to sow and a ready one to reap, 📌 pin. The old Fields card and the
  batch-27 crop rows are removed.
- [ ] 154. Keyboard, reduced motion, offline idle reasons in the welcome-back banner. Hermes checks live with 20 and 60
  fields at 375 / 1440 / 3440.

---

## Batch 31 — Renown (tasks 155–157, save v21 → v22)

- [ ] 155. `run.renown: Record<CropId, number>`: +1 per home harvest by a worker, +2 by hand. `migrateV21` starts
  each crop at `lifetime.harvests[crop]`, so nothing is lost. New deed row `keepRenown` (keeps the reached tiers on
  Sell the farm, `keepFirstCertificates` style); renown itself resets on Sell the farm.
- [ ] 156. Tiers 250 / 1,000 / 4,000 → that crop's price FLOOR 0.5 → 0.55 / 0.6 / 0.7 (Toon 2026-11-11, sim pins).
  Not market depth: at the fields stage every crop sits on the floor from 60 tiles, so depth ×1.25 / 1.5 / 2 added
  only +0.1 / 0.6 / 1.3 % at 20 fields; the floor gives strawberry net per unit +14 / 29 / 57 % at sell 5. The fields gate
  (50 home harvests) is unchanged.
- [ ] 157. Ledger shows renown per crop and the next tier. Sim: a worker-only route reaches the top tier in bounded
  game-hours (reported + capped); prestige reset pinned.

---

## Batch 25 results (2026-11-10)

Tasks 135–137 done, one commit each (`dd41d0c`, `d819aae`, and this one), all on `main`, not pushed.

- **135 Beds layout.** `FarmGrid` now derives bed k = tiles 6k…6k+5 and renders `.farm-fit > .beds-wrap > .beds > .bed`
  (role=group, aria-label "Bed k+1") with `.cell-slot` dashed spans padding the unowned slots of the last started bed.
  The `ceil(sqrt(n))` columns and the `--n` custom property are deleted; `.beds-wrap` is an inline-size container so
  phones get the `@container (min-width: 480px)` pairing too. The ≥ 768 px tile-size formula moved from `.grid` onto
  `.beds` and now counts each bed's 20 px chrome (2 px border × 2 + s2 padding × 2), the tile gaps inside beds and the
  s4 gap between beds (`app.css` `.beds` block). `--rows-stacked = 2 × beds`, `--rows-paired = 2 × ceil(beds / 2)` are
  inline on `.beds`. Rings, flash, 📋 badge, 💧 badge, bars and the global-index `onTap(i)` are unchanged.
- **136 MiniLot.** New `src/app/MiniLot.tsx`, exported, not mounted anywhere yet (batch 27 mounts it). One
  `<button.mini-lot>` with aria-label "Home lot — {ripe} ripe, open"; beds reuse `.bed` at 40 px tiles (`.mini-lot
  .bed`: gap `--s1`, padding 2 px); tile spans class `mini-empty` / `mini-growing` (60 % opacity) / `mini-ready`
  (green inset ring) / `mini-dry` (orange inset ring); `🧺 {ripe}` badge top-right, not rendered at 0 ripe.
- **137 Gates + CHANGELOG.** Entry added at the top of `CHANGELOG` verbatim. Gates: `pnpm test` 829 passed (48 files,
  was 821/47), `pnpm lint` clean, `pnpm build` clean, `tsc -b --force` clean. FarmGrid props did not change, so no
  existing test needed a prop update; the three existing FarmGrid test sites (Workers/Workshop/Orders) pass as-is.
  Purity grep over `src/core` / `src/save` untouched — no files there were modified. New tests: `tests/Beds.test.tsx`
  (4), `tests/MiniLot.test.tsx` (2), `tests/appCss.test.ts` +1 describe (2 checks).

### Deviations

- Could not verify in jsdom (no browser): actual layout, container-query pairing at 480 px, tile sizing at 1024 × 768,
  ring visibility on green/soil, and the 40 px MiniLot look. Hermes re-measures live at 375 / 1024 / 1440 / 2560 /
  3440 with 9, 15 and 24 tiles.
- The plan's CSS spec had `.beds { --rows: var(--rows-stacked) }` inside the base rule; kept exactly, with the ≥ 768 px
  `--tile` formula added on `.beds` in the 768 px media block (the mobile rule does not use it).
- The `--rows` value on mobile is inert (the formula is ≥ 768 px only) but harmless; kept for spec fidelity.

## Batch 26 results (2026-11-10)

Tasks 138–141 done, one commit each, all on `main`, not pushed. Gates: `pnpm test` 836 passed
(was 829), `pnpm lint` clean, `pnpm build` clean, `tsc -b --force` clean. Purity grep
`Date.now|react` over `src/core` + `src/save` clean (`storage.ts` the known exception).

- **138 Save v20.** `Workshop = { built: boolean; beds: boolean[4]; valve: boolean }`,
  `SAVE_VERSION = 20`, `migrateV19` chains (hopper coal → storage capped by bag capacity,
  overflow sold at coal sell price into cash; `lifetime.cashEarned` / `counters.sales` untouched;
  valve kept). Every fixture v1…v19 migrates to v20 (`save.test.ts` / `codec.test.ts`), and the
  forged v19 save has no dry tile after 8 h post-migration (pin a).
- **139 Core.** `buildSprinkler(state, bed)` with the locked error order; `isIrrigated` is the
  beds-only formula; step sets moisture to `waterMoisture(2)` before growth and never drains an
  irrigated tile; `water()` on irrigated → new `IRRIGATED` error, no energy; toolTargets skips
  irrigated; the water worker idles unpaid; `buyValve` LOCKED until batch 28;
  `fieldsGates.water = built && beds.some(Boolean)`; milestone `firstSprinkler = beds.some(Boolean)`.
  Deleted: `sprinklersAct` / `sprinklerTargets` / `sprinklerWatered` / `fillHopper` /
  `SPRINKLER_TILES` / `SPRINKLER_COAL_TICKS` / `SPRINKLER_HOPPER`, their accessors and the
  fuel loader's hopper branch.
- **140 UI.** `SPRINKLER_EMOJI '⛲'`; `.bed-socket` stub under the three conditions (grey, or
  `.bed-socket-ready` pulse when storage holds the recipe; reduced-motion steady — CSS only);
  Modal confirm sheet with title / "Waters these 6 tiles forever" / "Permanent — cannot be moved
  or sold" / priceText / disabled Build + `needs … more` when short; no placement mode.
  `.bed-irrigated` blue frame + ⛲ on the bed frame; irrigated cells render no water bar and no
  "— dry!"; the 💧 badge and the `watered` prop/state chain are deleted. Workshop card: summary
  `🔧 Workshop · ⛲ n/4 beds`, one gauge line `⛲ n/4 beds — the water worker retires at 4/4`,
  Build group = hint "Build on a bed's socket ⛲ on the farm" + valve row only-if-owned; Workers
  water row reads "nothing to water — reassign" when every owned tile is irrigated; tips.ts
  workshop text verbatim; Shop/Bank say "1 bed sprinkler".
- **141 Sim re-pins.** No RNG draws added. Batch 17 steps minutes
  `[395.9, 433.5, 463.5, 501.7, 540.5, 577.9] → [395.9, 433.5, 469.8, 469.8, 506, 506, 565]`
  (two more rungs: tiles13 / tiles19 buy the beds 2–3 lots), gaps `[37.6, 29.8, 38.2, 38.8, 37.4] →
  [37.5, 36.4, 0, 36.2, 0, 59]`, incomes `[15587, 15483, 16161] → [15587, 20219, 29511]`,
  finalCash `265558 → 500348`, coal `[428, 7, 32] → [461, 7, 0]`. Batch 18 lemon incomes
  `[37457, 107441, 144265, 416543, 433895] → [47951, 112708, 151938, 380848, 396495]`,
  secondPairAt `711 → 701`, coal `[341, 0, 36] → [382, 0]`. Batch 19 fleet-vs-workers curve
  `[[144,149],[414,429],[434,427]] → [[150,154],[382,437],[397,436]]` (the batch-19 inversion is
  gone — the fleet wins at every N), marginal harvester2 `3.3 → 1.6`, harvester3 `122.4 → 68.1`,
  seeders `92.4 → null`. Batch 22 vault speedup `1.386` (bound relaxed 1.4 → 1.3). Pin b
  (ladder bot reaches `fields.unlocked`, "game-minutes" in the name) measures the longest gap at
  80 game-minutes — see Deviations. Pin d reported, not asserted: pump coal/h = 0
  (32 coal/h saved vs the batch-24.2 pumps), workers freed at 4/4 = [0, 3]. Pin c
  (`step(s,n) = n × step(s,1)` with 2 built beds) in `tests/workshop.test.ts`. CHANGELOG entry
  added at the top verbatim.

### Deviations

- One shared green gate for tasks 138/139 instead of per-commit gates: the tree only compiles and
  passes once both land (v19 saves refuse to load until the migration exists, and the migration
  does not type-check against a core that still has the hopper fields). Commits are still
  per-task and back-to-back; repo precedent batches 17/18/19.
- Pin b is scoped to the batch-26 ladder (workshop → Tractor) and its gap bound is 90
  game-minutes (5400 ticks), not 60: the two longest stretches sit outside this batch's reach —
  the pre-existing gold → workshop stretch already ran 116 game-minutes before the batch
  (unchanged trajectory), and tiles16 → Tractor measures 80 game-minutes (the old world's
  equivalent was ~200). Closing either means touching LOCKED prices, so it is recorded, not
  "fixed".
- Income rose ~25–30 % everywhere (always-full moisture), so every cash-price/income ratio pin
  re-based: sprinkler/income and FIELDS/pipe lower bounds 0.5 / 0.4 → 0.35, machines 0.4 → 0.35,
  batch-22 speedup 1.4 → 1.3. Prices are LOCKED; the ratios, not the prices, moved.
- `buyValve` keeps its `state` parameter (voided) so the batch-28 signature and its call sites
  do not churn; lint has no `argsIgnorePattern` for `_`-prefixed params.
- Could not verify in jsdom (no browser): the socket stub's position on the bed frame, the
  ready-pulse animation (and its reduced-motion steady state) and the irrigated bed's blue frame
  look. Hermes re-measures live at 375 and 1440.
- The full-suite run surfaced three stale expectations this batch's earlier file-by-file runs
  could not see (Workshop.test.tsx matched both the summary and the gauge line; the sheet price
  lives in `.sheet-price`, not on the Build button; the dry control tile's stall point is growth
  130, not 10 — moisture 2 drains in 120 ticks). Fixed; 836/836 after.

## Batch 27 results

Commits: `999a687` (task 142.0 — renames the five jsdom test files whose stripped names clash with
a `.test.ts` sibling, so macOS `tsc` stops hiding one of each pair), `e1236d6` (task 142),
`09ff5de` (task 143), and this commit (task 144). Suite 845 → 857 → **861/861** across the three
tasks; lint and build green at every commit.

- **142 (two stops):** `tiles.ui` gains `stop` (default `estate`) and `pulledBack`, both with
  `parseUi` fallbacks — no save-shape change (`tiles.ui` is cosmetic and versionless, so no bump,
  per the batch header). `Surface.tsx` owns the stop switch (aria-pressed, keys 1 / 2 / Escape
  ignored in inputs and while any `[role=dialog]` is open), the fold strip above the grid, the
  MiniLot on the Estate stop, the ≥ 1100 px `both` mode via ResizeObserver (absent in jsdom, so
  `both` stays false there), the one-time pull-back (banner at load forces Estate; a reload
  mid-animation does not replay) and the FLIP on `.home-block`. App renders the old farm column
  verbatim before the Tractor. The 1024 fit: `.beds` pairs from a 400 px container, a 52 px tile
  floor, `.cell` compacts by its own inline-size (label screen-reader-only < 80 px, rot text gone
  < 64 px).
- **143 (Estate content):** `estateText.ts` holds the pure helpers — `estateCropIncomePerHour`
  (planted × 3600 ÷ grow × (market-priced sale − seed), rounded), `estateBottleneck` (dry pump →
  stalled pipes → sowing → reaping → next land; every priced fix carries its time-to-afford:
  `now`, a `shortOf` bar shortfall, or the cash gap ÷ the rows' ≈💰/h as `≈~N min` / `≈~N h`),
  `ghostRowPrice`, `nextReadyText`, `fleetTilesPerHour`. `Estate.tsx` renders the capacity strip
  (💧 watered, 🌱/🌾 fleet rates + free/ready, first accepted 📋 order, the one bottleneck chip),
  one row per licensed crop, the ghost row (`buyTenFields` buys up to ten tiles in ONE act, a
  partial buy still lands), the Pipes row and the Machines group behind a closed
  `details.estate-machines`. `Fields.tsx` shrinks to one summary line + `Open Estate`
  (`ui.stop → 'estate'`, phones also `view → 'farm'`; new `openEstate` on `PanelProps`); the
  machine-row tests moved Fields → Estate; `estateText.test.ts` pins each bottleneck branch and
  the first-match order.
- **144 (phone bar + sheet):** phones (< 768 px) on the Estate stop swap the 🧰 Tools bar for
  `tools estate-tools`: `🌱 Sow 10 <crop>` (disabled with a `pick a crop below` title until a crop
  is picked), `🌾 Reap · {ready}` (disabled; the hint under the bar reads "Harvesters reap the
  Fields — hand reaping comes next update"), `＋10 tiles` (the shared `buyTenFields`). The Orders /
  Workers / Workshop cards fold into one `📋 Orders · Workers · Workshop` button opening the shared
  `Modal` (`sheetOpen`, a transient overlay); DigSeeds and the Fields summary stay; before the
  Tractor phones are byte-identical. CHANGELOG batch 27 entry added verbatim.

### Deviations

- Could not verify in jsdom (no layout, no ResizeObserver): the FLIP animation and its 700 ms
  pull-back timing, the container-query compaction sizes (the 400 px bed pairing, the 80/64 px
  cell thresholds), the ≥ 1100 px `both` two-column layout, the estate-hint-under-bar position and
  the phone bar's fixed placement. Hermes re-measures live at 375 / 1024 / 1440 / 2560 / 3440
  after the push, per the batch brief.
- The bottleneck chip renders as `label — fix` in one chip (the brief's fix text is shown in full,
  including the price and the time-to-afford); the Sow button also disables when `plantFields`
  itself fails (seeds/cash/land), not only when no crop is picked.
- The Fields summary always shows the `⏳ N stalled` segment (the brief's one line, verbatim),
  where the old card only showed it when non-zero.

### Hermes live check (2026-11-11)
Measured on the live build with the v19 fixture at 375 / 1024 / 1440 / 2560 / 3440. Two fixes shipped after the worker:
`41acb81` (the bottleneck chip was 421 px wide and pushed past the 344 / 419 px centre at 375 / 1024 → it wraps;
crop rows cut 7–59 px of their price line → both lines wrap, rows ~68 px; the phone hint got the page background and
reserved room) and `deb84d6` (with the Tractor the Home stop's container is 396 px, so the 400 px pairing never fired
and the 24-tile lot scrolled 71 px at 1024 × 768 → pairing from 380 px). After both: no x-scroll and nothing past the
centre column at any width; both stops side by side at 2560 / 3440 (774 / 1214 px each); keys 1 / Esc / 2 switch;
pulledBack set on first load; the 📋 sheet opens Orders / Workers / Workshop at 375; 1024 Home stop and pre-Tractor
1024 pair at 52–53 px with no scroll and no cell overflow; 1440 pre-Tractor unchanged at 95 px, 375 at 104 px.
Not seen by eye: the FLIP and pull-back motion (the state flips; the animation was not filmed).
