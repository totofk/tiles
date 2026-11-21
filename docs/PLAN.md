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
for batches 1–36.1, plus the big-farm roadmap. Lines 1–7436 of that file are the old `docs/PLAN.md` line for line, so a
`PLAN.md:N` citation from before 2026-11-14 points at the same line there. References like PLAN.md "Batch 24 results"
in tests and `docs/DECISIONS.md` resolve there too.

The archive is append-only and large (7,400+ lines, ~680 KB). Never read it whole: read only the line range a brief
cites, or `grep -n '^## Batch N'` and read that range.

## Active batches
New batch plans are appended below, and workers write `## Batch N results` + `### Deviations` at the end of this file.
After a batch is pushed, Hermes moves its plan and results to the end of the archive.

## Batch 36.2 — Districts that play differently: Orchard Valley (berry ×1.4, 🌳 fruit tree bed) and Iron Hills (🔨 forge), supply lists, distinct listing soils (tasks 213–218, save v30 → v31)

Why: 36.1 made the sale a choice of listing, but a district is still only a name plus a soil. Direction C (accepted)
says a district = its own supply list + ONE signature; the plain farm sells everything and has no signature. 36.2 gives
Orchard Valley and Iron Hills theirs, so run N+1 plays differently from run N, not just faster or slower. Supply lists
alone break the ±20 % target (a district without chilli loses −33 % estate income, Hermes calculator), so Orchard also
gets the accepted local soil "berry sell ×1.4 (est.)". Orchard's signature is a plant-once fruit tree bed (zero input,
no water, no rot); Iron Hills' is a forge that stamps bars + coal into orderable goods (margin ≤ 30 %). Wetlands keeps
36.1's behaviour (name + soil, full shop) until 36.3 turns on its whole package (no mine, barge, its list, berry ×1.4).
Also folded in (Toon-approved 2026-11-21 15:05): the two rolled listings of one offer never share a soil — in 36.1 both
rows could roll the same soil (1 in 6 per offer), which empties the soil part of the choice.
Playtest question: do Orchard Valley and Iron Hills play differently from the plain farm?
Decisions: `docs/DECISIONS.md` "Batch 36.2 refined" (sources + Hermes's calls). Anchors below are origin/main
8113458b (after batch 36.1), SAVE_VERSION 30. Re-measure with `grep -n` before editing.

Guard rails (districts research): remove nothing outright, every gate stays reachable in every district, plain is
always offered. Every new number lives in `src/core/balance.ts` and is `(est.)` unless a pin below measures it.

## Tasks (213–218)

- [x] 213. **Distinct soils on the two rolled listings (Toon-approved fix).** `currentListings`
  (`src/core/listings.ts:43–60`): draws stay in today's order (district A, soil A, district B, soil B, `:53–58`); when
  soil B deep-equals soil A, draw soil B again from the same rng (repeat until it differs). Every offer that already
  had two different soils stays byte-identical (the extra draw happens only after the last existing draw), so the
  migrated-fixture offer pinned in 36.1 and every non-colliding offer do not move; a colliding offer gets a uniform
  pick among the other 5 soils. "Distinct" = not the same ordered pair `{ fast, slow }` (rows may share the fast group
  if the slow group differs). Tests (`tests/listings.test.ts`): over many seeds × prestige counts × reroll counts the
  two rolled soils never deep-equal; a seed that collided before the fix (find one with the old rule inline in the
  test, assert it existed) now differs and its district names and soil A are unchanged; the 36.1 determinism tests
  still pass. If an existing test pinned a colliding offer, re-pin it old → new and record it under `### Deviations`.
- [x] 214. **District framework: supply lists, Orchard berry ×1.4, the shop, the Next farm rows.**
  - `src/core/data/districts.ts:1–13` gains `DISTRICT_SELLS: Record<DistrictId, readonly CropId[]>`: plain and wetlands
    = every crop (`CROP_IDS`, `src/core/data/crops.ts:3`; wetlands' list goes live in 36.3); every district keeps the
    5 cheap rungs potato, radish (Carrot), corn, eggplant, pumpkin; orchardValley = those + lemon, grape, strawberry
    (8 crops, no tomato / chilli); ironHills = those + tomato, chilli (7 crops, no lemon / grape / strawberry). Plus
    `districtSells(district, crop): boolean`.
  - `buyLicense` (`src/core/actions.ts:268–274`): new first check — `NOT_SOLD_HERE` when
    `!districtSells(run.listing.district, cropId)` and the licence is not owned (order: ALREADY_OWNED, NOT_SOLD_HERE,
    NO_CASH). A licence ALREADY owned keeps working everywhere (the keepLicenses deed carries licences into a district
    run; nothing is taken away). New `ActionError` member `NOT_SOLD_HERE` (union `src/core/actions.ts:31–77`), text in
    `ERROR_TEXT` (`src/app/useGame.ts:21`, beside `BAD_CHOICE` `:59`): "Not sold in this district". No other core
    change: orders (`orderPool`, `src/core/orders.ts:52–58`, reads `run.licenses`), the Manager
    (`fieldsPlantable`, `src/core/fields.ts:126–128`) and the Fields follow the licences. Dig stays potato-only.
  - Berry ×1.4 (est.): `src/core/balance.ts` gains `DISTRICT_BERRY_SELL = 1.4` and `districtSellFactor(cropId,
    district: DistrictId): number` = 1.4 for the berry group (`CROP_GROUPS.berry`, `src/core/data/crops.ts:26–30`) in
    orchardValley, else 1. `cropSellPrice` (`src/core/balance.ts:762–764`) gains a 4th optional argument `district:
    DistrictId = 'plain'`: `sellPrice(CROP_BASE[c].sellPrice * districtSellFactor(c, district), meta, level)` (one
    round, inside `sellPrice`). With no district every number is today's.
    Runtime call sites pass `run.listing.district`: `src/core/orders.ts:118` (cropOrderPrice), `src/core/market.ts:12`
    (marketCropPrice — every market sale and the price texts), `src/core/fields.ts:217` (fieldsCropIncomeCurve, the
    Manager's plan), `:534` (fieldsMarginalIncomePerHour, the payback label), `src/app/estateText.ts:52`,
    `src/app/Orders.tsx:21`. Keep it OFF: `src/save/serialize.ts:808,812` (the v26 migration) and every test call site
    (`tests/market.test.ts`, `workers.test.ts`, `orders.test.ts`, `actions.farm.test.ts`, `estateText.test.ts`,
    `renown.test.ts`, `OrdersCard.test.tsx`, `save.test.ts`, `tools.test.ts` — plain numbers, no churn). Seed costs,
    licence prices, glut, renown floors unchanged.
  - Shop (`src/app/Shop.tsx:104–131`, the licence rows): an unowned licence the district does not sell renders as a
    disabled row with `<small>not sold in {district name}</small>` in place of the price (the row stays visible so the
    player sees the supply list). Owned licences render as today.
  - Next farm rows (`src/app/Legacy.tsx:152–163`): the orchardValley and ironHills rows get a second small line under
    the soil line, from a new `DISTRICT_HINT: Partial<Record<DistrictId, string>>` in `src/core/data/districts.ts`:
    orchardValley "sells 8 of 10 crops · berries ×1.4 · 🌳 fruit tree", ironHills "sells 7 of 10 crops · 🔨 forge".
    The plain and wetlands rows are unchanged (no hint). Stats "This farm" (36.1) is unchanged.
- [x] 215. **Save v31 (state shapes for the tree bed and the forge).** `RunState` (`src/core/state.ts:25–99`) gains
  `tree: TreeBed | null` and `forge: Forge`:
  `type TreeBed = { bed: number; crop: CropId; ticks: number[]; stock: number[] }` (6 entries each, one per tile of the
  bed; `ticks` = ticks toward the tile's next fruit, `stock` = fruit waiting on the tile) and
  `type Forge = { built: boolean; recipe: ForgeRecipeId | null; job: ForgeRecipeId | null; progress: number; tray:
  Partial<Record<ForgeGoodId, number>> }`. `createFreshRun` (`:268–310`) sets `tree: null`, `forge: createForge()`
  (unbuilt, recipe null, job null, progress 0, tray {}) — both are run state, reset by every sale.
  `SAVE_VERSION` 30 → 31 (`src/save/serialize.ts:37`). `SaveV30` (`:292`) becomes the pre-district shape
  `{ version: 30; savedAtMs: number; state: { meta: MetaState; run: Omit<RunState, 'tree' | 'forge'> } }`, `SaveV31 =
  { version: 31; savedAtMs: number; state: GameState }`, `Save = SaveV31`. `migrateV30(save: SaveV30): SaveV31` (after
  `migrateV29`, `:857–867`): `run.tree = null`, `run.forge = createForge()`; district, soil, licences, inventory and
  everything else untouched; nothing refunded or removed. `migrate()` (`:870–884`): `version === 31` returns as is,
  `version === 30` → `migrateV30(...)`, and every older branch wraps its chain in `migrateV30(...)`.
  The real v30 fixture `tests/fixtures/save-v30.json` is ALREADY committed with this plan (Toon's save migrated v29 →
  v30 and re-saved by the live v30 build at 14:06: plain listing, listingSeed 2,737,987,114, ⭐79, 24 tiles, 10
  licences). Never edit any file in tests/fixtures. In `tests/save.test.ts` (imports `:32`) test: v30 → v31 gives
  tree null and an unbuilt forge, everything else deep-equal to the v30 state; save-v29 and every older fixture
  (save-v1 … save-v28) migrate through to version 31.
  Put the types, `createForge`, the migration and its tests in THIS commit (36.1 had to move its bump into the first
  state commit to stay green; doing it first avoids that). ItemIds for the forge goods come in 217 (inventory is a
  partial record, so no migration needs them).
- [x] 216. **Orchard Valley signature: the 🌳 fruit tree bed.** New `src/core/tree.ts`; numbers in balance.ts:
  `TREE_CADENCE = 1.25`, `TREE_MATURE_CYCLES = 2`, `TREE_STOCK_CAP = 3`, `TREE_PLANT_SEEDS = 12`, `TREE_PLANT_ENERGY =
  1` (all est.), `treeCadenceTicks(crop) = Math.round(TREE_CADENCE × CROP_BASE[crop].growTicks)` (lemon 775, grape
  975, strawberry 1,200 — base grow ticks: no fertilizer, no Legacy growTime, no listing soil), `treePlantCost(crop,
  meta) = TREE_PLANT_SEEDS × cropSeedCost(crop, meta)` (lemon 💰900, grape 💰1,680, strawberry 💰3,120 at no deeds).
  - `plantTreeBed(state, bed, crop)`: one home bed (tiles `6·bed … 6·bed+5`, the bed index the sprinkler socket uses,
    never a grid row), locked for the run — no swap, no removal. Order: LOCKED (district is not orchardValley, or
    `run.tree` is already set, or `crop` is not in the berry group), BAD_TILE (bed index not an integer or any of its 6
    tiles not owned), NO_LICENSE, BED_BUSY (a tile of the bed is planted), NO_ENERGY, NO_CASH. Sets every tile of the
    bed to `{ status: 'tilled', growth: 0, moisture: 0, ticksSinceMature: 0 }` and `run.tree = { bed, crop, ticks: six
    × −treeCadenceTicks(crop), stock: six × 0 }` (the negative start = the first fruit after 2 cadences); spends 1 ⚡ and
    the cash. New error `BED_BUSY`, text "Harvest that bed first".
  - `isTreeTile(run, i)`: `run.tree !== null && ⌊i/6⌋ === run.tree.bed`.
  - Growth, in `step` (`src/core/step.ts:71`, beside the tile map; NOT in stepTile): `tickTree(run)` — per tile, if
    `stock < TREE_STOCK_CAP`: `ticks + 1`; at `ticks ≥ cadence`: `stock + 1`, `ticks − cadence`. A full tile pauses.
    Tree tiles are skipped by `stepTile` (`:30–48`): no moisture, no growth, no rot. `step(s, n)` = n × `step(s, 1)`.
  - Actions on a tree tile: `water` → IRRIGATED (`src/core/actions.ts:190–199`, check beside `isIrrigated`); `till` /
    `plant` → LOCKED; `harvest(state, i, energy)` (`:205–239`) → `harvestTreeTile`: NOT_MATURE when that tile's stock
    is 0; else takes ALL its stock as one action: sells through `harvestSale` (`src/core/orders.ts:160`; accepted
    orders first, then the market, glut added normally) with ×`handPickedBonus()` (`src/core/balance.ts:506–510`) when
    energy > 0; renown `RENOWN_BY_HAND` / `RENOWN_BY_WORKER` (`:710`); counters harvests +1, sales + units; lifetime
    harvests[crop] +1 (through `farmAction`, `src/core/actions.ts:110–137`, so the 50-harvest Fields gate walks with
    the tree); no sickle double, no seed roll (no rng read). `tapTile` / `nextTileAction` (`src/core/tile.ts:34–54`)
    send a tap on a tree tile to `harvest`.
  - Tools and workers: `toolTargets` (`src/core/tools.ts:36–52`) — harvest gets the tree tiles with stock > 0 AFTER
    the ripe crop tiles (crops rot, trees do not), most stock first; water and plant never target a tree tile.
    Workers follow `toolTargets` (`src/core/workers.ts:101–108`): the harvester collects tree tiles on its normal
    rounds, the waterer never does, the planter's untilled fallback skips tree tiles.
  - UI: the bed socket sheet (`src/app/FarmGrid.tsx:108–160`, today the sprinkler sheet) gains, on an Orchard Valley
    run with no tree yet, a second block "🌳 Fruit tree" — one button per licensed berry crop "{emoji} {name} ·
    💰{treePlantCost}" (disabled with the error's short text), lines "Fruits every {m} min, no water, never rots" and
    "Permanent for this farm — cannot be moved". The bed's 6 tiles render as tree tiles: 🌳 plus the fruit count on
    the tile when stock > 0 (e.g. "🍋2"); no moisture bar. Before the first fruit a tile shows 🌳 only.
- [x] 217. **Iron Hills signature: the 🔨 forge.** New `src/core/forge.ts`; numbers in balance.ts (all est.):
  `FORGE_COST = { stone: 30, coal: 10, copperBar: 5, cash: 1500 }` (scaled like `furnaceCost`, `:831`),
  `FORGE_CYCLE_TICKS = 300`, `FORGE_TRAY = 10`, `FORGE_RECIPES` = toolbox { copperBar 4, coal 1 } → 🔧 Toolbox,
  ploughBlade { ironBar 2, coal 1 } → ⚙️ Plough blade, anchorChain { goldBar 3, coal 2 } → ⛓️ Anchor chain; sell
  prices in `ITEM_SELL_PRICE` (`src/core/balance.ts:72–82`): toolbox 520, ploughBlade 1,250, anchorChain 3,600
  (inputs at bar sell 🥉100 / 🥈500 / 🥇1,000 and coal 4 → +28.7 % / +24.5 % / +19.7 %).
  - `src/core/data/items.ts:2`: `ITEM_IDS` gains 'toolbox', 'ploughBlade', 'anchorChain' (at the end); `ITEMS` gains
    their names and emoji 🔧 ⚙️ ⛓️ (Unicode ≤ 11). `FORGE_GOOD_IDS` / `ForgeGoodId`, `ForgeRecipeId` (= the good id).
    Goods are storage items: they count toward storage, sell from storage like bars, are never mined.
  - Actions: `buildForge(state)` — LOCKED (district not ironHills), ALREADY_OWNED, NO_FURNACE (`run.furnace.built`
    false), then `pay` (`src/core/mining.ts:261`; NOT_ENOUGH_ITEMS / NO_CASH). `setForgeRecipe(state, recipe | null)`
    — LOCKED (not built); free. `loadForge(state)` — LOCKED (not built), NOTHING_TO_DO (recipe null), FULL (a job is
    loaded), NOT_ENOUGH_ITEMS; removes one cycle's inputs and sets `job = recipe`, `progress = 0`. `collectForge(state)`
    — LOCKED, NOTHING_TO_DO (tray empty), BAG_FULL; moves as many tray goods as storage has room for (the
    `collectBars` rule, `src/core/furnace.ts:152–175`, no Keep N).
  - `tickForge(run)` in `step` right after `tickFurnace` (`src/core/step.ts:77`): with a job, `progress + 1` up to
    `FORGE_CYCLE_TICKS`; at the cycle, when the tray holds < `FORGE_TRAY`, one good into the tray and the job clears;
    a full tray holds the finished job. No fire, no fuel: coal is a recipe input (a third coal sink beside the fire
    and the Fields tank). Furnace speed / batch / the Stoker do not apply.
  - Ore loader (`src/core/workers.ts:50–64`): today's furnace actions first, unchanged; when they return nothing, the
    forge: collect the tray when it has goods and storage has room, else `loadForge` when a recipe is chosen, no job
    is loaded and storage holds a cycle. The loader never picks a recipe (the player does — no bars spent unasked).
    `!f.built` no longer returns before the forge part.
  - Orders: `orderPool` (`src/core/orders.ts:52–58`) adds a forge good once the forge is built AND its bar is in the
    pool's bars (toolbox ← copperBar, ploughBlade ← ironBar, anchorChain ← goldBar) — "goods the player can make now".
    `orderPerMinute` (`:61–76`): a forge good = `60 / FORGE_CYCLE_TICKS` (0.2 / min); counts clamp at
    `orderItemCap` like every item. `itemOrderValue` (`:110–114`): a forge good pays sell price × (1 + orderBonus()),
    the bar rule. ⭐ = the tier's fixed 8 / 16 / 32. The clerk delivers goods like any item.
  - UI (`src/app/Mine.tsx`, a new `Forge` card rendered right after `<Furnace … />` at `:498`, only on an Iron Hills
    run): before it is built, "🔨 Forge · stamps bars into goods for orders" + build button with `priceText`
    (`:97`) and the short reason when disabled (needs the furnace first); after: one row per recipe "🔧 Toolbox · 🥉4
    ⚫1 → 💰520" as a pressed/unpressed choice plus "Off", a "Load one" button, a status line ("Stamping 🔧 · 120 /
    300 s" / "Idle" / "Tray full"), "Tray n / 10" and "Collect".
- [x] 218. **Pins, CHANGELOG, results.**
  - PIN36c (the ONLY sim of the batch; new `tests/sim/districts.test.ts`, describe `'batch 36.2: districts'`): the
    shipped ladder bot (`runBot`, `tests/sim/bot.ts:631–661`, same flags as PIN36a in `tests/sim/fields.test.ts:66–124`)
    from a fresh state with `run.listing = { district, soil: null }`, licence lists passed through the existing
    `licenses` / `crops` options (no new bot knob): plain10 = radish, corn, eggplant, pumpkin, tomato, lemon, grape,
    strawberry, chilli; orchardValley = radish, corn, eggplant, pumpkin, lemon, grape, strawberry; ironHills = radish,
    corn, eggplant, pumpkin, tomato, chilli; `crops` = chilli, strawberry, grape, lemon, tomato, pumpkin, eggplant, corn,
    radish, potato filtered to potato + the list. Run to the Fields unlock (20 game-h cap); `console.log('PIN36c',
    JSON.stringify({ hours per district }))`; assert orchardValley and ironHills each within ±20 % of plain10.
    Reference (Hermes probe on a64c68b1, before berry ×1.4): plain10 7.65 h, Orchard 7.04 h, Iron Hills 7.73 h. The
    shipped `LICENSE_ORDER` pins stay untouched. If a district bot deadlocks like 36.1's PIN36a, pin it `it.fails` with
    the measurement and record it — do not change the bot.
  - PIN36d (`tests/fields.test.ts`, beside PIN36b `:676`, pure function): on the PIN36b 20-field estate state, the best
    crop's `fieldsMarginalIncomePerHour` for an Orchard run (licences = the orchard list, `listing.district`
    orchardValley, soil null) is within −10 % … +25 % of plain (all 10 licences) — est. band, the calculator's −1 % …
    +25 % plus margin; Iron Hills (has chilli) equals plain ±0.5 pp; report both ratios with `console.log('PIN36d', …)`.
    Also report (assert ≥ −30 %) the chilli-renowned case: same states with chilli renown at the top floor tier.
  - PIN36e (`tests/balance.test.ts`, pure): a tree bed's steady cash/h (6 × sell × 3600 / treeCadenceTicks, market
    factor 1, no hand bonus) is within ±15 % of a replanted bed of the same crop (6 × (sell − seed) × 3600 / growTicks)
    for lemon and strawberry (exact arithmetic: 101 % / 103 %).
  - PIN36f (`tests/balance.test.ts`): every forge recipe's sell price ≤ 1.30 × its inputs' sell value (and > 1.0).
  - PIN36g (`tests/orders.test.ts`, pure): on an Iron Hills state with the forge built, every bar mold owned, vein 4
    and the ironHills licences, forge goods are ≤ 35 % of `orderPool` (they are 3 entries of the pool).
  - CHANGELOG (top of `src/app/changelog.ts`, above the 36.1 entry `:7`): `{ batch: '36.2', date: '<today>', line:
    "Orchard Valley and Iron Hills now play their own way: each sells its own seeds; Orchard berries pay ×1.4 and grow a
    🌳 fruit tree; Iron Hills stamps bars into goods at a 🔨 forge." }` (177 code points, cap 180; copy verbatim as ONE
    line, the wrap here is only the plan's).

Tests to add (game terms; the worker greps every caller before editing):
- listings: task 213's tests.
- districts: `districtSells` matches the lists (plain / wetlands all 10, orchard 8, iron 7, the cheap 5 everywhere);
  buyLicense of tomato on Orchard → NOT_SOLD_HERE, of lemon → ok; an owned unlisted licence still plants, buys seeds and
  joins the order pool; strawberry sells ×1.4 on Orchard and ×1 on plain / Iron Hills / Wetlands (market sale, order
  price, the Estate text); `cropSellPrice` with no district = today.
- save: task 215's tests.
- tree (`tests/tree.test.ts`, new): plantTreeBed errors in order; the price (12 × seed) and 1 ⚡; the first fruit at 2
  cadences, then one per cadence per tile; a tile pauses at 3 fruit; no water needed, never rots, never dries; water →
  IRRIGATED, till / plant → LOCKED on its tiles; harvest takes the whole stock, pays ×1.25 by hand and ×1 by a worker,
  +2 / +1 renown, lifetime harvests +1; harvester worker and the harvest tool collect it after ripe crops, the waterer
  and planter skip it; a sale resets `tree` to null; step identity with a tree.
- forge (`tests/forge.test.ts`, new): build errors in order (district, owned, furnace, items, cash); recipe / load /
  collect errors; one good per 300 ticks; tray cap 10 holds a finished job; the loader collects then loads the chosen
  recipe and never loads with recipe Off; goods count toward storage and sell at 520 / 1,250 / 3,600; order pool gains
  each good only with its bar; itemOrderValue = price × 1.1; step identity with a running forge.
- UI (jsdom): Shop shows "not sold in Orchard Valley" on tomato / chilli rows of an Orchard run and nothing new on
  plain; Next farm rows show the two hints only on the orchard / iron rows; the bed socket sheet shows "🌳 Fruit tree"
  only on Orchard before a tree is planted; a tree tile renders 🌳 and its fruit count; the Mine tab shows the Forge
  card only on Iron Hills (build price, recipe rows, Load one, Collect); an order offer of a forge good renders in the
  Orders card.

Scenarios: (A) fresh — a plain run plays exactly as today (no existing pin moves: every call without the new arguments
keeps today's numbers; tree null and forge unbuilt everywhere); an Orchard run: Shop shows tomato / chilli as not sold,
the first tree costs 💰900 (lemon) = 9 % of the lemon licence (💰10,000) — report the hour PIN36c's Orchard bot reaches
the Fields vs plain10; an Iron Hills run: forge built after the furnace, goods appear in orders once their bar does.
(B) veteran — `save-v30.json` migrated to v31 stays on the plain farm (full shop, no tree / forge offer, no hint);
sold into Iron Hills with the keepLicenses deed, his carried lemon / grape / strawberry licences keep working, so the
district differs for him by signature (forge) and soil. (C) determinism — the listings stay a pure function; task 213
changes only colliding offers.

Sims: only PIN36c (task 218, three ladder-bot runs). Run it with `npx vitest run tests/sim/districts.test.ts` while
developing; every other sim runs only as part of `pnpm test`. Never paste full-suite output into the conversation: grep
the lines.

Hermes verify (after the worker, before the push): `pnpm test` ×2, lint, build, `tsc -b --force`, purity grep,
case-clash, no sim-logs/ tracked; push on green (Toon's go 2026-11-21 15:05 covers it); Pages run by headSha; live
bundle has "Fruit tree" / "Forge" + the 36.2 changelog line; live v30 → v31 migration (seed `save-v30.json` on the OLD
live build first, then load it in the new one: version 31, `tiles.save.backup.v30`, no `tiles.save.bad`, tree null,
forge unbuilt, everything else equal); LIVE width sweep 375 / 1024 / 1440 / 2560 / 3440 of the Next farm rows with the
hints, the Shop "not sold" rows (seed an Orchard listing), the bed socket sheet's 🌳 block and a tree bed with fruit,
and the Forge card (seed an Iron Hills listing with the furnace built). CSS-only defects → Hermes fix (rule 11).

Out of scope: Wetlands' supply list, berry ×1.4, no-mine rules and the barge (36.3); ⭐ Favour rows for the tree bed and
forge (in-run ⭐ pool frozen; 36's ⭐ prices wait for Toon's single playtest after 36); the almanac "+1 deed per
district first finish"; dig finds + relics (36.4); Soil survey (36.5); renown tiers and the 4-fields breadth rule (36.6,
where the chilli-renowned −8 % target re-pins); the vein reshuffle / rich vein (rejected with the foundry); dig seeds
for unlisted crops; a loader that picks forge recipes by itself; any "sell now" nudge; any change to the ⭐ Favours
section, the HUD ⭐ or the reroll prices.

## Batch 36.2 results

Tests: 64 files, 1192 passed + 7 expected fail (1199) before → 68 files, 1232 passed + 7 expected fail (1239) after
(`pnpm test`; "before" is derived, not run on 8d167ac5: the first full run on d2c96c04 = 1194 incl. its 2 new tests;
"after" measured on the task 218 commit, unchanged by the follow-up's test edits). Lint clean, `pnpm build` clean (dist/ deleted), forced
`tsc -b --force` clean (src + tests). Purity grep `Date.now|react` over src/core and src/save: only the known
`src/save/storage.ts:26` wallClock line. Case-clash check prints nothing. Not pushed.

Commits, one line each:
- 213 `d2c96c04` — `currentListings` redraws soil B from the same rng while it equals soil A (after the existing four
  draws); `hash` exported for the test's replica of the 36.1 rule.
- 214 `69f4de85` — `DISTRICT_SELLS` / `districtSells` / `DISTRICT_HINT` (districts.ts); `buyLicense` NOT_SOLD_HERE after
  ALREADY_OWNED; `DISTRICT_BERRY_SELL = 1.4`, `districtSellFactor`, `cropSellPrice(…, district = 'plain')` passed at the
  6 runtime sites; Shop "not sold in …" rows; Next farm hint lines.
- 215 `f2327398` — `RunState.tree` / `RunState.forge`, `TreeBed`, `Forge`, `createForge`, `FORGE_GOOD_IDS` (type only, not
  yet ItemIds); `SAVE_VERSION` 31, `SaveV30` frozen as the pre-district shape, `migrateV30` chained on every branch.
- 216 `09b268c7` — `src/core/tree.ts` (`plantTreeBed`, `isTreeTile`, `tickTree`, `harvestTreeTile`); tree numbers in
  balance.ts; water / till / plant / harvest / tapTile / nextTileAction / toolTargets / stepTile skip; FarmGrid tree
  socket block and tree cells (`.cell-tree` reuses the growing green).
- 217 `5fc7ff12` — `src/core/forge.ts` (`buildForge`, `setForgeRecipe`, `loadForge`, `collectForge`, `tickForge`,
  `forgeLoaderAction`); ITEM_IDS + ITEMS + ITEM_SELL_PRICE gain toolbox / ploughBlade / anchorChain; `FORGE_COST`,
  `FORGE_CYCLE_TICKS`, `FORGE_TRAY`, `FORGE_RECIPES`, `forgeCost`; ore loader = furnace work ?? forge work; orderPool /
  orderPerMinute / itemOrderValue; the Mine Forge card.
- 218 (this commit) — PIN36c sim, PIN36d / e / f / g, CHANGELOG 36.2 (177 code points, once), these results.

Pins (all measured with the commands named):
- PIN36c (`npx vitest run tests/sim/districts.test.ts`): `{"plain10":7.65,"orchardValley":6.59,"ironHills":7.73}`
  game-h to the Fields unlock → Orchard −13.9 %, Iron Hills +1.0 % of plain10 (band ±20 %, passes). Hermes's probe
  before berry ×1.4 was 7.65 / 7.04 / 7.73, so the ×1.4 moved Orchard 7.04 → 6.59. No district bot deadlocked.
- PIN36d (`tests/fields.test.ts`): Orchard 1.0136 × plain (band 0.90 … 1.25), Iron Hills 1.0000 × plain (±0.5 pp);
  chilli-renowned (chilli renown 4000, the top tier): Orchard 1.0136, Iron Hills 1.0000 (assert ≥ 0.70) — see Deviation 5.
- PIN36e (`tests/balance.test.ts`): tree bed vs replanted bed, lemon 101 %, strawberry 103 % (band ±15 %).
- PIN36f: toolbox 520 / 404 = 1.287, plough blade 1250 / 1004 = 1.245, anchor chain 3600 / 3008 = 1.197 (each > 1, ≤ 1.30).
- PIN36g (`tests/orders.test.ts`): Iron Hills, forge built, every mold, vein 4, the 7 Iron Hills licences: 3 forge goods
  of an 18-entry pool = 16.7 % (≤ 35 %).

Migrated fixture: `tests/fixtures/save-v30.json` (version 30, plain listing, listingSeed 2,737,987,114, ⭐79, 24 tiles,
10 licences) → version 31 with exactly two new run keys, `tree: null` and `forge: { built: false, recipe: null, job: null,
progress: 0, tray: {} }`; everything else deep-equal to the v30 state. Every fixture save-v1 … save-v30 lands on v31 with
tree null and an unbuilt forge.

Task 213 example (seed 1, prestigeCount 1, rerolls 0; asserted in `tests/listings.test.ts` against a verbatim replica of
the 36.1 body): before, Orchard Valley roots fast · berry slow and Wetlands roots fast · berry slow (same soil) → after,
Orchard Valley unchanged and Wetlands roots fast · fruit-veg slow (districts unchanged). Of seeds 0 … 199
at prestige 1, every non-colliding offer is unchanged (asserted in `tests/listings.test.ts`). No existing test pinned a
colliding offer; the 36.1 migrated-fixture offer (seed 3,706,322,434) is unchanged.

New UI strings:
- Error texts: "Not sold in this district" (NOT_SOLD_HERE), "Harvest that bed first" (BED_BUSY).
- Shop: `not sold in {district name}` (e.g. "not sold in Orchard Valley") on an unowned unlisted licence row (disabled).
- Next farm rows: "sells 8 of 10 crops · berries ×1.4 · 🌳 fruit tree" (Orchard Valley), "sells 7 of 10 crops · 🔨 forge"
  (Iron Hills).
- Bed socket: aria-label "Bed {n} tree socket" (🌳 button); sheet title "Bed {n}" when it has no sprinkler block; heading
  "🌳 Fruit tree"; buttons "{emoji} {name} · 💰{cost}" (+ the error's text when disabled); "Fruits every {m} min, no water,
  never rots"; "Permanent for this farm — cannot be moved".
- Tree tiles: 🌳, plus "{crop emoji}{n}" when fruit waits (e.g. "🍋2").
- Mine Forge card: "🔨 Forge · stamps bars into goods for orders", "Build forge" + price (+ " · {reason}"), "🔨 Forge",
  recipe rows "🔧 Toolbox · 🥉4 ⚫1 → 💰520", "⚙️ Plough blade · 🥈2 ⚫1 → 💰1,250", "⛓️ Anchor chain · 🥇3 ⚫2 → 💰3,600",
  "Off", "Load one" (+ short reason), status "Stamping {emoji} · {p} / 300 s" / "Idle" / "Tray full", "Collect" with
  "Tray {n} / 10".
- Items: 🔧 Toolbox, ⚙️ Plough blade, ⛓️ Anchor chain (storage rows, order rows "Deliver Toolbox order").
- CHANGELOG 36.2 line, verbatim.

### Deviations

1. "Fruits every {m} min": with more than one licensed berry the line lists each button's minutes in button order
   ("Fruits every 13 / 16 / 20 min, …"); with one berry it reads exactly as the plan.
2. Tree socket reach: on an Orchard run with no tree, every whole bed (6 owned tiles) shows a socket, even before the
   workshop is built (🌳, "Bed {n} tree socket"); a bed that can still take a sprinkler keeps its sprinkler socket and its
   sheet shows both blocks; an irrigated bed shows the fountain plus the 🌳 socket. The plan did not say how the sheet is
   reached without a workshop; without this the tree would wait for the workshop. Side effect: a fresh Orchard run
   (potato only) shows the 🌳 socket on bed 1 at tick 0, and its sheet has the "🌳 Fruit tree" heading and the
   "Permanent…" line but no crop buttons and no "Fruits every" line until a berry licence is bought — left for Hermes /
   Toon to judge in the live sweep (no new gate invented).
3. "Sell all when storage full" (`SELL_WHEN_FULL`, Mine) leaves forge goods out, like bars (the plan: goods "sell from
   storage like bars"). They still sell one by one / all from their own storage row.
4. Recipe rows list inputs in recipe order ("🥉4 ⚫1", the plan's text); `priceText` would print "⚫1 🥉4" (ITEM_IDS order).
5. PIN36d chilli-renowned case reports the same ratios as the base case: the pure-function state (20 empty fields, an
   empty market) never pushes chilli to its floor, so the top renown floor does not change the best crop's margin. The
   ≥ −30 % assert passes; the −8 % chilli-renowned target re-pins in 36.6 as planned.
6. Small exports for the tests / modules: `hash` (listings.ts), `farmAction` (actions.ts, used by tree.ts);
   `nextTileAction` gained an optional tile index (tapTile passes it). `FORGE_GOOD_IDS` / `ForgeGoodId` landed in 215
   (the Forge type needs them) and joined `ITEM_IDS` in 217.
7. `loadForge`'s FULL toast reads the existing "Furnace is full" text (ERROR_TEXT is shared); on the card the short reason
   is "full".
8. Existing tests changed: the 36.1 Next farm row text now ends with the hint (Legacy.test); save version pins 30 → 31
   (save.test ×3, App.test "Will migrate v15 → v31"); `asV29Run` now strips `tree` / `forge` through a new `asV30Run`.
9. Not verified (no browser; jsdom only): layout and wrapping at 375 / 1024 / 1440 / 2560 / 3440 px of the Next farm hint
   lines, the Shop "not sold in …" rows, the bed socket sheet's 🌳 block and the tree cells (`.cell-tree`), and the Mine
   Forge card (recipe row width — the anchor chain row is the longest).
