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
for batches 1–35.5, plus the big-farm roadmap. Lines 1–7436 of that file are the old `docs/PLAN.md` line for line, so a
`PLAN.md:N` citation from before 2026-11-14 points at the same line there. References like PLAN.md "Batch 24 results"
in tests and `docs/DECISIONS.md` resolve there too.

The archive is append-only and large (7,400+ lines, ~680 KB). Never read it whole: read only the line range a brief
cites, or `grep -n '^## Batch N'` and read that range.

## Active batches
New batch plans are appended below, and workers write `## Batch N results` + `### Deviations` at the end of this file.
After a batch is pushed, Hermes moves its plan and results to the end of the archive.

## Batch 36.1 — Sale listings: the next farm is the plain farm or one of two rolled listings with soil, ⭐ reroll, roll memory (tasks 209–212, save v29 → v30)

Why: Toon's goal for batch 36 is a prestige layer that is varied and never boring. Deeds stop pulling after ~3 sales
(his runs are 159–160 game-h; a first sale gives 167–170 deeds = 61 % of the 276-deed shop, Hermes research). Today
the sale is a confirm card (`SellCard`, `src/app/Legacy.tsx:116–171`): nothing about the next run is chosen. 36.1
puts the choice on that card: the plain farm plus two rolled listings, each = a district name + a listing soil (one
crop group grows 20 % faster, another 20 % slower), with a ⭐ reroll (⭐40/80/160/320, max 4 per sale) and roll
memory, so run N+1 differs from run N by construction. Districts are names + soil only here; their supply lists and
signature features are 36.2 / 36.3. The chosen listing is stored in run state for those batches to read.
Playtest question: does picking a listing feel like a choice?
Decisions: `docs/DECISIONS.md` "Batch 36.1 refined" (sources + Hermes's calls). Anchors below are origin/main
9b227822 (after batch 35.5), SAVE_VERSION 29. Re-measure with `grep -n` before editing.

## Tasks (209–212)

- [x] 209. **Listings core: groups, districts, the roll, the memory, the reroll.**
  - `src/core/data/crops.ts` (beside `CROP_IDS`, `:3`): `GROUP_IDS = ['roots', 'fruitVeg', 'berry'] as const`,
    `type GroupId`, `CROP_GROUPS: Record<GroupId, readonly CropId[]>` = roots: potato, radish (shown as Carrot),
    corn; fruitVeg: eggplant, pumpkin, tomato, chilli; berry: lemon, grape, strawberry (every crop in exactly one
    group), `cropGroup(cropId): GroupId`, `GROUP_NAMES: Record<GroupId, string>` = 'roots' / 'fruit-veg' / 'berry',
    and `type ListingSoil = { fast: GroupId; slow: GroupId }` (fast ≠ slow).
  - New `src/core/data/districts.ts`: `DISTRICT_IDS = ['plain', 'orchardValley', 'ironHills', 'wetlands'] as const`,
    `type DistrictId`, `DISTRICTS: Record<DistrictId, { name: string; emoji: string }>` = plain 'The plain farm' 🏡,
    orchardValley 'Orchard Valley' 🌳, ironHills 'Iron Hills' ⛏️, wetlands 'Wetlands' 🌊; `ROLLED_DISTRICTS` = the 3
    non-plain ids. Identity only; no mechanics.
  - `src/core/balance.ts` (every number here): `LISTING_SOIL_GROW = { fast: 0.8, slow: 1.2 }`,
    `listingGrowFactor(cropId, soil: ListingSoil | null): number` (1 with no soil; 0.8 for the fast group, 1.2 for
    the slow group, 1 for the third), `LISTING_REROLL_STARS = [40, 80, 160, 320]`, `LISTING_REROLL_MAX = 4`,
    `listingRerollStars(rerolls): number` (the price of the next reroll after `rerolls` this sale),
    `LISTING_WEIGHT_UNPLAYED = 3`, `LISTING_WEIGHT_PLAYED = 1` (est.).
  - New `src/core/listings.ts`: `type Listing = { district: DistrictId; soil: ListingSoil | null }`,
    `PLAIN_LISTING = { district: 'plain', soil: null }`, `listingSeedFor(prestigeCount, deedsClaimed, cashEarned)`
    (an integer hash, used by the v30 migration), and `currentListings(meta, lastPlayed: DistrictId): [Listing,
    Listing, Listing]` = `[PLAIN_LISTING, rolledA, rolledB]`:
    - deterministic from `(meta.listingSeed, meta.prestigeCount, meta.listingRerolls)` only — mix them into one
      uint32 and draw with `nextRandom` (mulberry32, `src/core/actions.ts:97–105`, import it or move it to a shared
      core module; never read `run.rngState`, so actions never move the offers and reload/import shows the same ones);
    - the two rolled listings name two DISTINCT districts from `ROLLED_DISTRICTS`. With `meta.listingRerolls === 0`
      (the first offer of a sale) `lastPlayed` is excluded and the rest are drawn without replacement weighted
      `LISTING_WEIGHT_UNPLAYED` for a district not in `meta.districtsPlayed`, `LISTING_WEIGHT_PLAYED` otherwise
      (when `lastPlayed` is a district, the other two are both offered). After a reroll (`listingRerolls > 0`) the
      draw is uniform over all 3, last played included;
    - each rolled listing gets its own soil: one of the 6 ordered pairs of distinct groups, uniform.
  - `rerollListings(state): ActionResult` in listings.ts. Order: `LOCKED` (sale gate closed,
    `sellFarmUnlocked`, `src/core/prestige.ts:29–31`), `REROLL_MAX` (`meta.listingRerolls >= LISTING_REROLL_MAX`),
    `NO_STARS`; pays `{ cash: 0, stars: listingRerollStars(meta.listingRerolls) }` through `pay`
    (`src/core/mining.ts:260–270`) and sets `meta.listingRerolls + 1`. New `ActionError` members `REROLL_MAX` and
    `BAD_CHOICE` (union `src/core/actions.ts:31–73`) with texts in `ERROR_TEXT` (`src/app/useGame.ts`, next to
    `NO_STARS: \`Not enough ${STAR_EMOJI}\`` `:56`): REROLL_MAX "No rerolls left this sale", BAD_CHOICE "That
    listing changed — pick again".
  - `MetaState` (`src/core/state.ts:213–220`) gains `listingSeed: number; listingRerolls: number; districtsPlayed:
    DistrictId[]`; `createInitialMeta` (`:230–238`) sets 0, 0, [].
- [x] 210. **Soil in the run, and the sale takes the chosen listing.**
  - `RunState` (`src/core/state.ts:22–94`) gains `listing: Listing`; `createFreshRun` (`:247–290`) takes it from a
    new optional `RunCarry.listing` (`:243`), default `PLAIN_LISTING`.
  - `cropGrowTicks` (`src/core/balance.ts:723–725`) gains a 4th optional argument `soil: ListingSoil | null = null`,
    multiplied in BEFORE the `Math.round` (`× listingGrowFactor(cropId, soil)`). `cropRotGraceTicks` (`:728–730`)
    gains the same optional argument and passes it through (grace stays 2 × the crop's real grow ticks at that soil).
    With no soil every number is today's, so no existing pin moves.
  - Runtime call sites pass `run.listing.soil` (every grow-time reader must see the soil):
    `src/core/tile.ts:9` (growTicks → isMature / growthProgress) and `:30` (ticksUntilRot);
    `src/core/step.ts:29` stepTile gains a `soil` parameter, used at `:33` and `:38`, passed from `step()` `:70`;
    `src/core/actions.ts:209` (harvest NOT_MATURE); `src/core/orders.ts:66` (orderPerMinute — order sizing);
    `src/core/fields.ts:69` (pressuredCycle → the plots' readyTick), `:215` (fieldsCropIncomeCurve, the Manager's
    plan), `:532` (fieldsMarginalIncomePerHour); `src/core/market.ts:49–50` (marketSteadyFactor gains an optional
    `soil` argument before `floor`, or after it — keep every existing caller compiling); `src/app/estateText.ts:51`
    (Estate cycle text); `src/app/FarmGrid.tsx:50` (rot grace). `tests/sim/bot.ts:147` and `:1274` also pass
    `s.run.listing.soil` / `base.run.listing.soil` (null on every existing run, so no sim number moves).
  - Test call sites keep the argument off (plain numbers, no churn): `tests/balance.test.ts:65,70,78,95,115`,
    `tests/tile.test.ts:9,45`, `tests/step.test.ts:64–65`, `tests/actions.farm.test.ts:38,189,201–205`,
    `tests/workers.test.ts:163`, `tests/tools.test.ts:25`, `tests/orders.test.ts:70,110,119,134,136,330,547–549`,
    `tests/fields.test.ts:261`, `tests/stats.test.ts:120`, `tests/milestones.test.ts:52`, `tests/renown.test.ts:17`,
    `tests/App.test.tsx:89,115`, `tests/OrdersCard.test.tsx:210`, `tests/estateText.test.ts:54`,
    `tests/sim/market-orders.test.ts:88`, `tests/sim/fields.test.ts:271,688`.
  - `sellFarm` (`src/core/prestige.ts:46–84`) gains `choice: Listing = PLAIN_LISTING`. Order: LOCKED, LOAN_ACTIVE,
    NO_GAIN, then BAD_CHOICE unless `choice` deep-equals one of `currentListings(meta, run.listing.district)`.
    `nextMeta` also sets `listingRerolls: 0` and `districtsPlayed: [...meta.districtsPlayed, choice.district]`
    (plain included); `createFreshRun`'s carry passes `listing: choice`. Every existing caller (`sellFarm(state)` in
    tests and sims) keeps working and sells into the plain farm.
  - `sell` in `src/app/useGame.ts:243–255` becomes `sell(choice: Listing)` → `sellFarm(stateRef.current, choice)`;
    the pre-sale backup (`PRESTIGE_BACKUP_KEY`) is unchanged. `PanelProps.sell` (`src/app/panelTabs.tsx:32`) →
    `(choice: Listing) => void`.
- [x] 211. **Save v30.** `SAVE_VERSION` 29 → 30 (`src/save/serialize.ts:34`). `SaveV29` (`:285`) becomes the
  pre-listing shape `{ version: 29; savedAtMs: number; state: { meta: Omit<MetaState, 'listingSeed' |
  'listingRerolls' | 'districtsPlayed'>; run: Omit<RunState, 'listing'> } }`, `SaveV30 = { version: 30; savedAtMs:
  number; state: GameState }`, `Save = SaveV30`. `migrateV29(save: SaveV29): SaveV30` (after `migrateV28`, `:838`):
  `run.listing = PLAIN_LISTING`, `meta.listingSeed = listingSeedFor(meta.prestigeCount, meta.deedsClaimed,
  Math.floor(run.lifetime.cashEarned))`, `listingRerolls = 0`, `districtsPlayed = []`; nothing else changes and no
  value is taken away. `migrate()` (`:851–865`): `version === 30` returns as is, `version === 29` →
  `migrateV29(...)`, and every older branch (`:855–864`) wraps its chain in `migrateV29(...)`.
  The real v29 fixture `tests/fixtures/save-v29.json` is already committed with this plan (Toon's save re-saved by
  the live v29 build: ⭐79, 12 fields, 10 licences, prestigeCount 0, lifetime cash 💰294,333,295). Never edit any
  file in tests/fixtures. In `tests/save.test.ts` import it beside `:30` and test: v29 → v30 gives the plain
  listing, the derived seed (pin the exact number), 0 rerolls, [] played, and everything else deep-equal to the v29
  state; every older fixture (save-v1 … save-v28) migrates through to version 30.
- [x] 212. **The "Next farm" block on the 🏆 Sell the farm card, Stats line, CHANGELOG, PIN36a.**
  - `SellCard` (`src/app/Legacy.tsx:116–171`) gets `act` beside `state` and `sell` (`sell: (choice: Listing) =>
    void`; `src/app/Bank.tsx:80` passes `act`). Mount a block between the ⭐ carry line (`:136–139`) and
    `<h3>Resets</h3>` (`:140`), shown at every stage (the card is information before the gate, 35.4/35.5):
    - `<h3>Next farm</h3>`, then three full-width rows from `currentListings(meta, run.listing.district)`, one
      selected at a time (component state, default the plain row): plain row "🏡 The plain farm" + small "today's
      farm, no soil"; each rolled row "{emoji} {name}" + small "{fast group} 20 % faster · {slow group} 20 % slower"
      with `GROUP_NAMES` (group names only, never the crop lists — fits 375 px). The rows say nothing about
      district mechanics (those come in 36.2 / 36.3).
    - a reroll button `🔄 Reroll ⭐{listingRerollStars(meta.listingRerolls)} · {meta.listingRerolls}/4` →
      `act(rerollListings)`; disabled before the sale gate, without the ⭐, and at 4/4 (then it reads
      `🔄 Reroll · 4/4`). A reroll resets the selection to the plain row.
    - the two-press "Sell the farm" (`:157–160`) sells the selected row: `sell(selected)`. Nothing else on the card
      changes: "Selling gives" still only after the gate (35.5), ⭐ carry line, Resets, Carries, locked button.
  - Stats: `stats()` (`src/core/stats.ts:99`, the `multipliers` rows shown under "Now") gains one row "This farm" =
    "The plain farm" or "{emoji} {name} · {fast} 20 % faster · {slow} 20 % slower".
  - CHANGELOG (top of `src/app/changelog.ts`, above the 35.5 entry): `{ batch: '36.1', date: '<today>', line:
    "Selling now offers your next farm: the plain farm or two rolled listings where one crop group grows 20 %
    faster, another 20 % slower. 🔄 Reroll them for ⭐40–320, up to 4 a sale." }` (176 code points, cap 180; copy
    verbatim as ONE line, the wrap here is only the plan's).
  - PIN36a (the only sim of the batch) in `tests/sim/fields.test.ts`, new describe `'batch 36.1: listing soil'`:
    the shipped ladder bot (unchanged licence list) from a fresh state with `run.listing.soil` set, to the Fields
    unlock; runs: plain, `{ fast: 'roots', slow: 'fruitVeg' }`, `{ fast: 'fruitVeg', slow: 'roots' }`,
    `{ fast: 'berry', slow: 'fruitVeg' }`; `console.log('PIN36a', JSON.stringify({ hours per soil }))`; assert each
    soil's unlock hour is within ±20 % of plain's.

Tests to add (game terms):
- groups: every crop is in exactly one group; `listingGrowFactor` 0.8 / 1.2 / 1; `cropGrowTicks(c, meta, 0, soil)`
  = round(plain × factor); rot grace = 2 × the soil grow ticks; `listingRerollStars` 40 / 80 / 160 / 320.
- the roll (`tests/listings.test.ts`, new): same meta → same three listings (twice, and after `serialize` /
  `deserialize`); plain is always first with no soil; the two rolled districts differ and never equal plain; soils
  have fast ≠ slow; after selling an Orchard Valley run the first offer never contains Orchard Valley (fixed seeds,
  many prestige counts); unplayed districts appear more often than played ones (fixed-seed count over many seeds,
  assert the order, not exact numbers); playing actions (till / plant / harvest, `step`) never changes the offers.
- the reroll: ⭐40 then ⭐80 / 160 / 320; the 5th → REROLL_MAX; with ⭐39 → NO_STARS; before the gate → LOCKED; each
  reroll changes the offer; the counter resets to 0 at the sale; ⭐ is paid from the run balance before the sale,
  so the ⭐ carried after the sale is the balance after rerolls (cap 400 unchanged).
- the sale (`tests/prestige.test.ts`): `sellFarm(s)` sells into the plain farm (existing tests unchanged);
  `sellFarm(s, rolledA)` starts the new run with `run.listing = rolledA`, `districtsPlayed` gains it,
  `listingRerolls` 0; a listing not on offer (or a stale one after a reroll) → BAD_CHOICE.
- soil in play: a strawberry tile under `{ fast: 'berry', … }` is mature at 0.8 × its plain ticks and rots at
  2 × that; a chilli tile under `{ slow: 'fruitVeg' }` at 1.2 ×; harvest NOT_MATURE follows it; a field plot's
  readyTick follows it; orderPerMinute scales by 1 / factor for that crop.
- PIN36b (`tests/fields.test.ts`, pure function, no bot): on a 20-field estate state, the best crop's
  `fieldsMarginalIncomePerHour` under each of the 6 soils is within −16.7 % … +25 % of plain (1 / 1.2 … 1 / 0.8,
  ±0.5 pp).
- save: task 211's tests.
- UI (jsdom, next to the 35.5 SellCard tests in `tests/Legacy.test.tsx` / `tests/BankTab.test.tsx`): the card shows
  "Next farm" with 3 rows before and after the gate; the plain row is selected by default; selecting a rolled row
  and pressing Sell twice calls `sell` with that listing; the reroll button reads "🔄 Reroll ⭐40 · 0/4", is
  disabled before the gate, without ⭐ and at 4/4 ("🔄 Reroll · 4/4"), and after a reroll the selection is back on
  the plain row; Stats shows "This farm". Existing `SellCard` renders (`tests/Legacy.test.tsx:86,110,119,129`,
  `tests/FavoursSection.test.tsx:137`) gain the `act` prop.

Scenarios: (A) fresh — run 1 is plain and identical to today (no existing pin moves: every call without the soil
argument keeps today's numbers, every `sellFarm(state)` sells into plain); the first sale shows plain + 2 rolled
listings; a reroll costs ⭐40 = 5 tier-0 orders (`orderTierStars(0)` = ⭐8, `src/core/balance.ts:579`). (B) veteran —
`save-v29.json` migrated to v30 is on the plain farm with its listings pinned; sold with the berry-fast soil, the new
run's strawberry grow ticks are ×0.8 and chilli's ×1.2 when the soil makes fruit-veg slow. (C) determinism + memory —
reload/import shows the same listings; reroll prices 40/80/160/320, the 5th fails, the counter resets at the sale;
after an Orchard Valley run the first offer has no Orchard Valley.

Sims: only PIN36a (task 212). Run it with `npx vitest run tests/sim/fields.test.ts -t "36.1"` while developing; every
other sim runs only as part of `pnpm test`. Never paste full-suite output into the conversation: grep the lines.

Hermes verify (after the worker, before the push): `pnpm test` ×2, lint, build, `tsc -b --force`, purity grep,
case-clash, no sim-logs/ tracked; push on green (Toon's go 2026-11-21 11:38 covers it); Pages run by headSha; live
bundle has "Next farm" + the 36.1 changelog line; live v29 → v30 migration (seed `save-v29.json` on the OLD live build
first, then load it in the new one: version 30, `tiles.save.backup.v29`, no `tiles.save.bad`, `run.listing` plain,
everything else equal); LIVE width sweep 375 / 1024 / 1440 / 2560 / 3440 of the Sell card's Next farm block (rows,
reroll button, nothing truncated) and the Stats "This farm" row. CSS-only defects → Hermes fix (rule 11).

Out of scope: district supply lists, signatures, Orchard berry ×1.4 local soil, the tree bed, the Iron Hills forge,
Wetlands no-mine / barge (36.2 / 36.3); dig finds + relics (36.4); Soil survey and its ⭐ ladder (36.5); renown tiers,
breadth rule, the 3-column preview (36.6); the almanac; the charter card (37); ⭐ price tuning (Toon's single playtest
after 36); soil on any axis but grow time; per-bed / per-field traits; worker-hire rolls; a reroll priced in cash; any
"sell now" nudge (badge, toast, banner, HUD mark); any change to the ⭐ Favours section or the HUD ⭐.

## Batch 36.1 results

Commits (main, not pushed): 4ce40440 (209), 29edf981 (210), 92520473 (211), f3b6f319 (212), 9307c02b (results), then
a follow-up (jsdom Stats "This farm" test, the `it.fails` pin's timeout, these notes).
Tests: 1165 passed + 6 expected fail (1171) → 1192 passed + 7 expected fail (1199), 64 files. `pnpm lint`, `pnpm build`,
`tsc -b --force` (clean tsbuildinfo) green; purity grep shows only the known `src/save/storage.ts:26`; case-clash check
prints nothing; no dist/, sim-logs/ or scratch file tracked.

- 209: `GROUP_IDS` / `CROP_GROUPS` / `cropGroup` / `GROUP_NAMES` / `ListingSoil` in crops.ts; new `data/districts.ts`;
  balance `LISTING_SOIL_GROW`, `listingGrowFactor`, `LISTING_REROLL_STARS`, `LISTING_REROLL_MAX`, `listingRerollStars`,
  `LISTING_WEIGHT_UNPLAYED/PLAYED`; new `src/core/listings.ts` (`currentListings` hashed from listingSeed + prestigeCount
  + listingRerolls into mulberry32, `rerollListings`, `listingSeedFor`); `MetaState` + `listingSeed / listingRerolls /
  districtsPlayed`; errors `REROLL_MAX`, `BAD_CHOICE`.
- 210: `RunState.listing` (carried by `createFreshRun`); the soil argument on `cropGrowTicks` / `cropRotGraceTicks`
  threaded through tile.ts, step.ts (`stepTile`), actions.ts harvest, orders.ts `orderPerMinute`, fields.ts (`pressuredCycle`,
  `fieldsCropIncomeCurve`, `fieldsMarginalIncomePerHour`), market.ts `marketSteadyFactor` (optional, after `floor`),
  estateText.ts, FarmGrid.tsx and the bot (`tests/sim/bot.ts:147`, `:1274`); `sellFarm(state, choice = PLAIN_LISTING)`
  with BAD_CHOICE, `listingRerolls` 0 and `districtsPlayed` on the sale; `sell(choice)`.
- 211: save v30 tests: the real v29 fixture and every older one (v1 … v28) land on v30.
- 212: the "Next farm" block on the 🏆 Sell the farm card, the reroll button, Stats "This farm" (core + jsdom), the
  CHANGELOG line, PIN36a.

PIN36a (shipped ladder bot to the Fields unlock, game-h): `{"plain":8.24,"rootsFast_fruitVegSlow":9.15,
"fruitVegFast_rootsSlow":null,"berryFast_fruitVegSlow":9.26}` — roots-fast +11.0 %, berry-fast +12.4 % (within ±20 %);
fruit-veg-fast did not reach the unlock within 20 game-h (see Deviations). PIN36b (pure function, 20-field estate, all
crops plantable): every one of the 6 soils within −16.7 % … +25 % of plain.

Migrated fixture (`save-v29.json` → v30): `listingSeed` = 3,706,322,434 (`listingSeedFor(0, deedsClaimed,
294,333,295)`); first offer = 🏡 The plain farm · 🌳 Orchard Valley (berry 20 % faster · roots 20 % slower) · ⛏️ Iron
Hills (fruit-veg 20 % faster · berry 20 % slower). Sold into Orchard Valley: strawberry ×0.8, potato ×1.2, chilli ×1.

New UI strings:
- `<h3>Next farm</h3>`; rows "🏡 The plain farm" + small "today's farm, no soil"; "🌳 Orchard Valley" / "⛏️ Iron Hills" /
  "🌊 Wetlands" + small "{roots|fruit-veg|berry} 20 % faster · {…} 20 % slower".
- Reroll button "🔄 Reroll ⭐40 · 0/4" (⭐80 · 1/4, ⭐160 · 2/4, ⭐320 · 3/4); at the max "🔄 Reroll · 4/4".
- Errors: "No rerolls left this sale", "That listing changed — pick again".
- Stats "This farm": "The plain farm" / "🌳 Orchard Valley · berry 20 % faster · roots 20 % slower".
- CHANGELOG 36.1: "Selling now offers your next farm: the plain farm or two rolled listings where one crop group grows
  20 % faster, another 20 % slower. 🔄 Reroll them for ⭐40–320, up to 4 a sale." (176 code points).

### Deviations

- Commit split 210 / 211: `RunState.listing` cannot load from a v29 save without the migration, so the v30 bump code
  (`SAVE_VERSION` 30, `SaveV29` / `SaveV30` types, `migrateV29`, every `migrate()` branch) and the old save-test helper
  updates (`asV29Meta` / `asV29Run`, `v18Meta`, version literals 29 → 30, the App "v15 → v30" note) are in the 210
  commit so it stays green; 211 holds the v29 fixture tests. The soil argument on `cropGrowTicks` / `cropRotGraceTicks`
  landed in 209, whose group tests use it.
- PIN36a fruit-veg fast / roots slow: the shipped bot hires its 2nd water worker at 0.44 game-h, cash hits 💰0, the
  unpaid water workers stop, every tile dries and the bot never waters by hand while a water worker is assigned
  (`tests/sim/bot.ts:149` `byPlayer = assigned[job] === 0`, used by the hand-water try at `:152`) — it sits at 💰0
  for the rest of the 20 h. A bot deadlock, not a game soft-lock (a player waters by hand or unassigns). Pinned as
  `it.fails` with the measurement; the passing PIN36a asserts the two soils that reach the unlock. The bot was not
  changed (licence list fixed by the plan).
- Why both passing soils are slower than plain: the bot licenses radish, corn, eggplant, pumpkin and plants pumpkin /
  eggplant first, never a berry. roots-fast / fruit-veg-slow slows its main crops (+11.0 %); berry-fast /
  fruit-veg-slow is slow-only for it (+12.4 %). Fruit-veg-fast is the one soil that speeds its main crops — the fast
  start reaches the 2nd hire before the cash for wages, hence the deadlock above.
- The selection is keyed to the offer (`prestigeCount/listingRerolls`), so a reroll or a sale falls back to the plain
  row without an effect; a failed reroll keeps the pick.
- The "stale after a reroll → BAD_CHOICE" check in `tests/prestige.test.ts` runs only when the rerolled offer no longer
  holds the old pick (the not-on-offer case is asserted unconditionally).
- Existing heading assertions (`tests/Legacy.test.tsx`, `tests/BankTab.test.tsx`) now expect `['Next farm', 'Resets',
  'Carries']` — the block the plan adds.
- Not verified (no browser, jsdom only): layout and wrap at 375 / 1024 / 1440 / 2560 / 3440 of the Next farm rows,
  the reroll button and the Stats "This farm" row. The rows reuse `.shop-row.one-col` and `.selected` (the crop-picker
  style); no new CSS.
