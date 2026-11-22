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
for batches 1–36.2, plus the big-farm roadmap. Lines 1–7436 of that file are the old `docs/PLAN.md` line for line, so a
`PLAN.md:N` citation from before 2026-11-14 points at the same line there. References like PLAN.md "Batch 24 results"
in tests and `docs/DECISIONS.md` resolve there too.

The archive is append-only and large (7,400+ lines, ~680 KB). Never read it whole: read only the line range a brief
cites, or `grep -n '^## Batch N'` and read that range.

## Active batches
New batch plans are appended below, and workers write `## Batch N results` + `### Deviations` at the end of this file.
After a batch is pushed, Hermes moves its plan and results to the end of the archive.

## Batch 36.3 — Wetlands, the farm with no mine: river bank beds, the 🌊 barge, its supply list and berry ×1.4 (tasks 219–223, save v31 → v32)

Why: Direction C (accepted) gives each district its own supply list + ONE signature. 36.2 did Orchard Valley and Iron
Hills; Wetlands still plays like the plain farm (36.1 name + soil only). Toon accepted the crux (b36-synthesis): Wetlands
has NO mine, with the full reroute — the river waters bank beds and they count as the Fields' sprinkler gate; a barge
sells bars, stone and coal for cash so every bar-priced certificate and the Fields stay reachable; berries pay ×1.4
(accepted calculator item 1, "Orchard/Wetlands"); the contract ⭐ bonus ships only if the numbers show a gap. Research
(districts-pool §2, signatures §4.8): an absent system works only when a full replacement loop exists and fails when it
can soft-lock, so this batch's spine is the gate table and the no-soft-lock test. Hard guards (DECISIONS batch 24
stance): no soft lock, no stall, no infinite cash loop, nothing negative, saves migrate, nothing taken away.
Playtest question: is a run without a mine fun and never stuck?
Anchors below are commit ad3075d0 (origin/main 974e4dc6 after batch 36.2 + the local 36.2 archive commit; src/ and
tests/ identical to 974e4dc6), SAVE_VERSION 31. Re-measure with `grep -n` before editing.

"No-mine run" below = `noMine(run)`: `run.listing.district === 'wetlands' && !run.mineLicense`. A fresh Wetlands run is
always no-mine (the licence cannot be bought there). A Wetlands run that already OWNS the mine licence (bought under
36.1 / 36.2, when Wetlands still had a full shop) keeps its whole mine as today — grandfathered, nothing taken away;
it still gets the bank beds, the barge, the list and ×1.4.

Every new number lives in `src/core/balance.ts` and is `(est.)` unless a pin below measures it.

## Tasks (219–223)

- [ ] 219. **Save v32 (version stamp; no new state).** 36.3 adds no run or meta field: the barge holds static prices,
  bank beds and every reroute derive from `run.listing.district` + `run.mineLicense`. The bump keeps the accepted save
  chain (36.3 = v32, 36.4 = v33 …) and the real v31 fixture proves it. `SAVE_VERSION` 31 → 32
  (`src/save/serialize.ts:38`). `SaveV31` (`:296`) stays `{ version: 31; savedAtMs: number; state: GameState }`; new
  `SaveV32 = { version: 32; savedAtMs: number; state: GameState }`, `Save = SaveV32` (`:297`). `migrateV31(save:
  SaveV31): SaveV32` after `migrateV30` (`:872–874`) returns the same state with version 32 (nothing added, refunded or
  removed). `migrate()` (`:879–895`): `version === 32` returns as is, `version === 31` → `migrateV31(...)`, and every
  older branch (31's `return data`, 30, 29 … 21 and the `toV20` tail) wraps its chain in `migrateV31(...)`.
  Fixture `tests/fixtures/save-v31.json` is ALREADY committed with this plan: a real live v31 save (the committed
  save-v30.json seeded on the live v31 build CAC14g-7, migrated, offline catch-up 8 h, re-saved by the live code on
  2026-11-22; plain listing, ⭐79, 24 tiles, 10 licences, mine licence owned, tree null, forge unbuilt). Never edit any
  file in tests/fixtures. In `tests/save.test.ts` (imports `:3–…`, the v31 describe `:1671`): import save-v31; v31 → v32
  keeps the state deep-equal and stamps 32; every fixture save-v1 … save-v31 lands on version 32; the migration switch
  test (`:546`) accepts v21 … v32. Update every `SAVE_VERSION`/"→ v31" pin (save.test, App.test "Will migrate v15 →
  v31") to 32. Commit this task FIRST, before any mechanic.
- [ ] 220. **Wetlands framework: supply list, berry ×1.4, the Next farm hint, no mine licence.**
  - `src/core/data/districts.ts`: `DISTRICT_SELLS.wetlands` (`:24`, today `CROP_IDS`) = `[...CHEAP_RUNGS, 'tomato',
    'lemon', 'grape', 'strawberry']` (9 crops, no chilli — accepted calculator assumption 3); update the `:19` comment.
    `DISTRICT_HINT` (`:30–33`) gains `wetlands: 'sells 9 of 10 crops · berries ×1.4 · 🌊 river beds, no mine'` (58 code
    points; Legacy.tsx `:158` already renders any hint). New export `noMine(run: { listing: Listing; mineLicense:
    boolean }): boolean` (definition above) — put it where both core and app can import it without a cycle (e.g. a
    new `src/core/wetlands.ts`, which also holds the barge in 222).
  - Berry ×1.4: `districtSellFactor` (`src/core/balance.ts:770–771`) returns `DISTRICT_BERRY_SELL` for the berry group in
    `orchardValley` OR `wetlands`. The 6 runtime call sites already pass `run.listing.district` (36.2); nothing else
    changes. The v26 migration and test call sites stay plain.
  - `buyMineLicense` (`src/core/mining.ts:64–70`): order ALREADY_OWNED, then new `LOCKED` when
    `run.listing.district === 'wetlands'`, then NO_CASH. Every other mine action keeps its own NO_MINE_LICENSE check, so
    a no-mine run can never dig, craft a pickaxe, upgrade the vein, build the furnace (vein 1, `balance.ts:92`) or the
    workshop (vein 4, `src/core/workshop.ts:13–18`) — no new checks needed there.
  - `buyLicense` already returns NOT_SOLD_HERE for unowned unlisted crops (`src/core/actions.ts:275–278`); an owned
    chilli licence (keepLicenses deed, or bought before 36.3) keeps working (36.2 call 4).
- [ ] 221. **Bank beds and the reroutes (core).** All of these apply ONLY where stated; plain, Orchard Valley and Iron
  Hills behave byte-identically (every existing pin and sim number stays).
  | Gate (code today) | Plain | Wetlands |
  |---|---|---|
  | `isIrrigated` (`src/core/workshop.ts:22–24`) | sprinkler bed | ALSO true for beds 0–1 (tiles 0–11, bed index `⌊i/6⌋ < BANK_BEDS`, never grid rows) on every Wetlands run — "the river waters this bed". `step` (`src/core/step.ts:74`), `water` → IRRIGATED (`src/core/actions.ts:202`), `toolTargets` (`src/core/tools.ts:54`) and the waterer (`src/app/Workers.tsx:55`) follow it with no change. |
  | `buildSprinkler` (`workshop.ts:28–34`) | any bed | LOCKED on a bank bed in Wetlands (after NO_WORKSHOP; only a grandfathered run can have a workshop) |
  | `fieldsGates().water` (`src/core/fields.ts:110–117`) | workshop built + ≥ 1 sprinkler | true on every Wetlands run (the bank beds are always there; START_TILES 9 fills bed 0) — "the river irrigates" |
  | `buyPump` (`fields.ts:171–179`, NO_WORKSHOP `:175`) | needs the workshop | the NO_WORKSHOP check is skipped on a Wetlands run (the river powers the pump); prices and PUMP_FIELD_CAP 2/6/12/20 unchanged |
  | `buyStorage` → `buyMineUpgrade` (`src/core/mining.ts:275–280`, `:294–298`) | needs the mine licence | `buyStorage` skips the NO_MINE_LICENSE check on a no-mine run (give `buyMineUpgrade` a flag, or check in buyStorage); stone comes from the barge. `upgradeVein` keeps the check. |
  | fuel certificate gate (`CERTIFICATES.fuel`, `src/core/balance.ts:245`: counter bars ≥ 30, unreachable without a furnace) | bars ≥ 30 | on a no-mine run `certificateUnlocked(run, 'fuel')` (`src/core/workers.ts:204–208`) = `run.fields.unlocked` — the tank hand comes with the Fields. Price unchanged (🥉8 + 💰200, barge bars). |
  | fuel loader (`NO_TILE_WORK.fuel`, `workers.ts:71–81`) | fire coal, wood, then the tank from stored coal | unchanged order; on a no-mine run, when `fillTank` fails for NOT_ENOUGH_ITEMS (no coal stored) and the tank has room, it buys ONE barge coal straight into the tank (cash `bargePrice('coal')`; NO_CASH → idle). New helper in `src/core/wetlands.ts`, e.g. `bargeCoalToTank(state)`. |
  | ore / mine / stoker certificates (`balance.ts:244, 247, 255`) | buyable | never unlock (bars / vein counters stay 0 or the vein stays 0) — no core change; their rows are hidden in 222 |
  | item, ore and bar orders (`orderPool`, `src/core/orders.ts:55–62`) | roll with the mine licence | never roll: the pool is the licences only (already true with no mine licence — no core change). ⭐ per order is the tier's fixed 8 / 16 / 32; see 223 PIN36j. |
  | Noticeboard 🪨10, water / harvest certificates 🪨20 (+ ⚫5), plant 🥉10, clerk 🥉6, Manager 🥇4, tool tiers 🥉4 / 🥈4 / 🥇4, Fields 🥈10, pivots, pumps, machines (`balance.ts:221–223, 240–252, 362, 368–370, 459–465, 524`) | mined / smelted | paid through `pay` (`mining.ts:261–271`) UNCHANGED with barge-bought items — the reroute is supply, not pricing |
  | smart valve (`buyValve`, `workshop.ts:38–44`, needs the workshop) | buyable | absent on a no-mine run: pivoted fields burn tank coal on every plot (`burningPlots`, `fields.ts:397–403`) — priced into barge coal |
  `BANK_BEDS = 2` (est.) in balance.ts. Fields with an empty tank never stall (they grow at the unpressured ×1 pace,
  `fields.ts:409–414`), so coal can never soft-lock a run; it only slows it.
- [ ] 222. **The 🌊 barge and the River view (core + UI).**
  - Core (`src/core/wetlands.ts`; numbers in balance.ts, all est., accepted calculator item 5): `BARGE_ITEMS =
    ['copperBar', 'ironBar', 'goldBar', 'stone', 'coal']`, `BARGE_PRICE = { copperBar: 125, ironBar: 625, goldBar: 1250,
    stone: 3, coal: 5 }` (bars ×1.25 of their sell 100 / 500 / 1,000, `ITEM_SELL_PRICE` `balance.ts:73–82`).
    `bargePrice(item, meta, sellPriceLevel)` = `max(round(BARGE_PRICE[item] × multiplier(meta, 'cost')),
    itemSellPrice(item, meta, sellPriceLevel) + 1)` — scales with the cost deed like `woodCost` (`:838–840`) and is
    ALWAYS above what the item sells for (`itemSellPrice` `:846–848`, which grows with the Better prices levels, the ⭐
    sell Favour and the sell deed), so buy → sell never makes cash.
    `buyBarge(state, item, n)` (the `buyWood` precedent, `mining.ts:72–79`): order LOCKED (district not wetlands, or
    item not in BARGE_ITEMS), BAD_AMOUNT, BAG_FULL (`bagCount + n > bagCapacity`), NO_CASH (`n × bargePrice`); adds to
    `run.inventory`. No energy, no counter (barge buys are not sales and not bars collected).
  - UI: in `src/app/Mine.tsx` `Mine()` (`:375`), a no-mine run renders a River section INSTEAD of the 🔒 Mine card
    (`:377–388`) and the mine body: `<section className="mine mine-river">`, `<h2>🌊 River <small>📦 Storage {n} /
    {cap}</small></h2>`, then a "🌊 Barge" group: one row per BARGE_ITEMS entry "{emoji} {name} 💰{bargePrice}" with
    buttons "×1" and "×10" (each disabled with the error's short text, as the Forge card does `:116`), then the same
    item grid as today (`:566–596` — extract it into a shared component; do not duplicate it). No Dig, pickaxe, vein,
    furnace, wood, Forge or ore-sorting parts. A grandfathered Wetlands run (licence owned) renders the Mine as today
    PLUS the Barge group under the item grid.
  - The tab: `src/app/App.tsx:137` mobile tab label is "🌊 River" on a no-mine run, "⛏️ Mine" otherwise (same view id
    `mine`, same badge). The only other "⛏️ Mine" label is the section heading (`Mine.tsx:441`), replaced by the River
    heading; the Shop's "⛏️ Mine license" (`Shop.tsx:159`) is simply not rendered on a no-mine run.
  - Shop (`src/app/Shop.tsx`): Supplies (`:147–163`) shows neither the ⛏️ Mine license nor wood on a no-mine run. The
    🚜 Fields row (`:180–200`) shows when `!run.fields.unlocked && (run.workshop.built || district === 'wetlands')`;
    its "needs …" text lists "1 bed sprinkler" only when `!fieldsGates(run).water`.
  - Upgrades (`src/app/Upgrades.tsx:52–…`, rendered `:119` only with the mine licence): on a no-mine run render the
    storage row alone under the heading "📦 Storage" (no vein row).
  - Workers (`src/app/Workers.tsx:91`): on a no-mine run hide the ore and mine job rows (the stoker is already hidden
    until owned); the fuel row reads as today (its gate progress shows "Fields" — use the existing locked-row format;
    if it only knows counters, show the text "unlocks with the 🚜 Fields").
  - badges (`src/app/badges.ts:29`, `:52–54`): no mineLicense shop badge on a Wetlands run; the storage badge also
    fires on a no-mine run.
  - FarmGrid (`src/app/FarmGrid.tsx:133–145`): on a Wetlands run beds 0–1 render `bed bed-irrigated bed-bank` with a
    `🌊` span (class `bed-fountain`, title "The river waters this bed forever") in place of the ⛲ fountain; no sprinkler
    socket on a bank bed. Tiles in bank beds render exactly as sprinkler-bed tiles do today.
  - `src/app/tips.ts`: a `barge` tip "Wetlands has no mine: the barge sells bars, stone and coal for cash. Buying costs
    more than selling." if a tip slot is used; no other new copy beyond what this plan names.
- [ ] 223. **The no-mine bot, pins, CHANGELOG, results.**
  - Bot knob (priced here, rule 1g; `tests/sim/bot.ts`): new `runBot` option `barge?: boolean` (`:633–733`, with
    `fields`): goals = `WETLANDS_LADDER` = `FIELDS_LADDER` (`:554`) filtered to the goals that need no mine, kept in order
    — storage levels (`storageLv1`–`4`), the copper / iron / gold farm-tool tiers (`copper:*`, `iron:*`, `gold:*`),
    `plantCertificate`, `tiles13`, `tiles19`, `fields` — i.e. drop every `vein*`, `furnace`, `*Pickaxe`, mold, `smart`,
    ore / fuel / mine certificate, `workshop` and `sprinkler*` goal (check each goal's `buy` against the list). Each
    tick, before the goal buy (`:944–954`, run it for `barge` too), buy the goal's `keep` shortfall of BARGE_ITEMS with
    `buyBarge` when cash covers the shortfall + the goal's cash; `mineOnce` (`:794`) is never called with `barge` (idle
    energy is not spent; `gathering` at `:963` is false); after the Fields unlock keep `hourOfBurn` coal in the tank by
    buying barge coal (the `:955–960` tank fill, from the barge). Every other option keeps today's default, so no
    existing sim number moves.
  - PIN36h (the ONLY sim of the batch; `tests/sim/districts.test.ts`, new describe `'batch 36.3: wetlands'`): the
    PIN36c flag set (`:22–40`) with plain10's licences for plain, and for Wetlands `licenses` = radish, corn, eggplant,
    pumpkin, tomato, lemon, grape, strawberry, `barge: true`, `run.listing = { district: 'wetlands', soil: null }`.
    plain10 runs to the Fields unlock (20 game-h cap); Wetlands runs 24 game-h. `console.log('PIN36h',
    JSON.stringify({ plain10 h, wetlands h, bargeSpendToFields: { cash, copperBar, ironBar, goldBar, stone, coal },
    afterUnlock: { hours, pressuredShare, bargeCoal, tankEmptyTicks } }))`; assert the Wetlands unlock within ±20 % of
    plain10 and zero mine actions (`run.mineLicense` false, vein 0, no pickaxe) for the whole run. References: PIN36c
    plain10 7.65 h; Hermes's model: barge ×1.25 → ≈ +17.8 % (b36-calculator item 4; it counted 🥉22 / 🥈28 / 🥇8 + 🪨70 +
    ⚫5 ≈ 💰24,360 of barge bars vs 💰32,000 sprinkler cash saved and 50.5k mine cash lost). If Wetlands is SLOWER than
    +20 %: set `BARGE_PRICE` bars to ×1.0 (100 / 500 / 1,000; the `+1` rule still keeps them above sell) and re-run once;
    if still out of band, or if it is FASTER than −20 %, or the bot deadlocks: pin it `it.fails` with the measurement and
    record it under `### Deviations` — change no other number and do not tune the bot further.
  - PIN36i (`tests/balance.test.ts`, pure): for every BARGE_ITEMS entry, Better prices level 0 … 30 and the sell / cost
    deeds 0 … 10 (`meta.upgrades.sellPrice` / `.cost`), `bargePrice > itemSellPrice` (no buy → sell cash loop); and at no
    upgrades the prices are 125 / 625 / 1,250 / 3 / 5.
  - PIN36j (`tests/orders.test.ts`, pure): on a no-mine Wetlands state with the 9 Wetlands licences, `orderPool` is
    exactly the licences; rolled offers' ⭐ equal the tier ⭐ (8 / 16 / 32) as on plain for the same tier. Also report
    (`console.log('PIN36j', …)`) the item share of plain's pool at the PIN36g state (vein 4, every mold). Decision
    (Hermes call, see DECISIONS): NO contract ⭐ bonus in 36.3 — ⭐ per order and the offer rate do not depend on the
    pool, and every Wetlands offer is a crop the farm grows. Do not add a ⭐ bonus.
  - PIN36k (new `tests/wetlands.test.ts`, the gate-by-gate no-soft-lock test; pure, no bot): on a fresh Wetlands run
    (cash funded) — buyMineLicense → LOCKED; dig / craftPickaxe / upgradeVein → NO_MINE_LICENSE; buildFurnace,
    buildWorkshop → LOCKED; buyStorage Lv1 … Lv10 succeed with barge stone; buyBarge each item (×1, ×10; BAG_FULL;
    NO_CASH; LOCKED on plain); the Noticeboard, water / harvest / plant / clerk certificates, the three tool tiers and
    the Manager certificate (counters / ⭐ set) are buyable with barge items; `fieldsGates().water` true with no
    workshop; `unlockFields` succeeds with the planter + harvester certificates and barge 🥈10; `buyPump` tiers 1–4 with
    no workshop; `buildSprinkler` on a bank bed → LOCKED (grandfathered run with a workshop); bank-bed tiles never dry
    through `step` and `water` → IRRIGATED there, bed 2 still drains; the fuel certificate unlocks exactly at the Fields
    unlock; the fuel loader with no coal buys one barge coal into the tank; with an empty tank and no coal, a sown plot
    still ripens; `orderPool` has no item. Grandfathered: a Wetlands run that owns the mine licence digs, builds the
    furnace and keeps every mine action as today. Plain / Orchard / Iron Hills: buyBarge LOCKED, isIrrigated and
    fieldsGates and buyPump and the fuel certificate unchanged.
  - CHANGELOG (top of `src/app/changelog.ts`, above the 36.2 entry `:7`): `{ batch: '36.3', date: '<today>', line:
    "🌊 Wetlands is the farm with no mine: the river waters two beds for free, a barge sells bars, stone and coal for
    cash, and berries pay ×1.4." }` (139 code points; copy verbatim as ONE line).

Tests to add (game terms; the worker greps every caller before editing):
- districts (`tests/districts.test.ts`): Wetlands sells 9 (no chilli; buyLicense chilli → NOT_SOLD_HERE, an owned chilli
  still plants); strawberry sells ×1.4 on Wetlands (market sale, order price); `noMine` true on a fresh Wetlands run,
  false on plain and on a Wetlands run with the licence; the Wetlands hint text.
- save: task 219's tests. PIN36h–k as above.
- UI (jsdom): Mine.test — a no-mine Wetlands run shows "🌊 River", the storage count, 5 barge rows with prices and ×1 /
  ×10, the item grid, and no Dig / Mine license / vein / furnace; plain shows today's Mine; a grandfathered Wetlands run
  shows the Mine plus the barge. App.test (or the tab test) — tab label "🌊 River" on Wetlands. Shop.test — no Mine
  license / wood row on Wetlands, 🚜 Fields row without a workshop and no "1 bed sprinkler" need; chilli "not sold in
  Wetlands". Upgrades.test — storage row under "📦 Storage" on Wetlands, no vein row. WorkersCard.test — no ore / mine
  rows on Wetlands. Beds.test — bank beds 1–2 show 🌊, no sprinkler socket; bed 3 unchanged. Legacy.test — the Wetlands
  Next farm row shows its hint (update the 36.2 test that asserted Wetlands has no hint).

Scenarios: (A) fresh Wetlands run — 9 tiles from tick 0, all in bank beds: no watering until tile 13; the first barge
buys are 🪨 for the Noticeboard (🪨10 + 💰100) and the harvest certificate; report PIN36h's Wetlands Fields hour vs
plain10 and the barge spend. (B) veteran — `save-v31.json` (plain run) migrated to v32 stays plain: mine intact, no
barge, no bank beds, no hint changes on the plain row; sold into Wetlands with keepLicenses, his chilli licence keeps
working; the 8 h offline catch-up never needs the player (the tank burns what it holds, the tank hand buys barge coal).
(C) plain, Orchard Valley and Iron Hills runs are byte-identical to 36.2 (every new branch is behind the district).

Sims: only PIN36h (task 223, two ladder-bot runs). Run it with `npx vitest run tests/sim/districts.test.ts -t "36.3"`
while developing; every other sim runs only as part of `pnpm test`. Never paste full-suite output: grep the lines.

Hermes verify (after the worker, before the push): `pnpm test` ×2, lint, build, `tsc -b --force`, purity grep,
case-clash, no sim-logs/ tracked; push on green (Toon's 2026-11-22 16:29 go covers it); Pages run by headSha; live bundle
has "River" / "Barge" + the 36.3 changelog line; live v31 → v32 migration (seed save-v31.json on the OLD live build
first, then load it in the new one: version 32, `tiles.save.backup.v31`, no `tiles.save.bad`, state equal); LIVE width
sweep 375 / 1024 / 1440 / 2560 / 3440 of the River view + barge rows (seed a fresh Wetlands run), the "🌊 River" tab
label (375), the bank beds' 🌊 marks, the Shop 🚜 Fields row with no workshop, the Upgrades storage row, and the
Wetlands Next farm hint. CSS-only defects → Hermes fix (rule 11).

Out of scope: fishing (the river's later fishing spot); ⭐ Favour rows Mill race / Leat (36's ⭐ prices wait for Toon's
single playtest; the in-run ⭐ pool is frozen) and any change to the ⭐ Favours section (its furnace rows stay as they are
on Wetlands); a contract ⭐ bonus (PIN36j call); the pool doc's 18-tile home cap; an auto-buy toggle for barge goods
beyond the tank hand's coal; the almanac "+1 deed per district first finish"; dig finds + relics (36.4); Soil survey
(36.5); renown tiers + the breadth rule (36.6); any change to plain-listing balance or the mine itself; the open 36.2
nits (1024 tree fruit count, empty Orchard tree sheet hint, Forge Collect reason, the 375 top-bar wrap).
