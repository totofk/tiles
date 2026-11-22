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
for batches 1–36.3, plus the big-farm roadmap. Lines 1–7436 of that file are the old `docs/PLAN.md` line for line, so a
`PLAN.md:N` citation from before 2026-11-14 points at the same line there. References like PLAN.md "Batch 24 results"
in tests and `docs/DECISIONS.md` resolve there too.

The archive is append-only and large (7,400+ lines, ~680 KB). Never read it whole: read only the line range a brief
cites, or `grep -n '^## Batch N'` and read that range.

## Active batches
New batch plans are appended below, and workers write `## Batch N results` + `### Deviations` at the end of this file.
After a batch is pushed, Hermes moves its plan and results to the end of the archive.

## Batch 36.4 — Dig finds: 🏺 relic shards, ✨ star dust, 🦴 the ancient seed, 6 relics and the 📖 collection book (tasks 224–228, save v32 → v33)

Why: the farm dig (`digForSeeds`, the anti-soft-lock floor) pays one potato seed 20 % of the time; after the first
licences it is a dead button. Toon's locked finds (shards 0.5 %, star dust 0.3 %, ancient seed 0.05 % per dig; the 6
relic rules with their buffed numbers; the collection book with a set bonus lost on the sale) turn it into a small
lottery that still costs ⚡. Digging stays hand-only (no farm-dig worker job; the ladder bot never digs the farm), so
nothing here waits offline. Playtest question: is digging worth ⚡ again?
Hard guards (DECISIONS batch 24 stance): no soft lock, no stall, no infinite cash loop, nothing negative, saves
migrate, nothing taken away.
Anchors below are commit 2788495 (origin/main after batch 36.3), SAVE_VERSION 32. Re-measure with `grep -n` before
editing. Every new number lives in `src/core/balance.ts`; numbers marked (est.) are Hermes picks (DECISIONS "Batch 36.4
refined"), the rest are Toon's locked values.

Scope fence: plain / Orchard Valley / Iron Hills / Wetlands play byte-identically until the player digs the farm. With
no relic owned and nothing dug, every existing pin and sim number stays; the only sims that move are the two that call
`digForSeeds` (task 228).

## Tasks (224–228)

- [x] 224. **Save v33 and the new shape (no mechanic yet).** Commit this task FIRST.
  - Crop identity (`src/core/data/crops.ts:3–18`): `CROP_IDS` stays the 10 shop crops in licence order (the Shop,
    milestones, the Manager, districts, stats and the sims iterate it — unchanged). New `ANCIENT_CROP = 'ancientFruit'
    as const` and `ALL_CROP_IDS = [...CROP_IDS, ANCIENT_CROP] as const`; `CropId` becomes
    `(typeof ALL_CROP_IDS)[number]`. `CROPS.ancientFruit = { name: 'Ancient fruit' }`. It is in NO `CROP_GROUPS` group
    (`:26–30`), so `listingGrowFactor` (`balance.ts:644–648`) already returns 1 and `districtSellFactor` (`:770–771`) 1
    for it; `tests/listings.test.ts:35` (groups cover `CROP_IDS`) stays as is.
  - Every `Record<CropId, …>` literal gains the key: `CROP_BASE` (`balance.ts:20–38`) `ancientFruit: { growTicks: 1_440,
    seedCost: 0, sellPrice: 1_500, licenseCost: 0 }` (Toon's locked grow 1,440 / sell 1,500; seed and licence 0 because
    it is never bought); `CROP_EMOJI` (`src/app/FarmGrid.tsx:20–31`) `ancientFruit: '🌰'`; `CROP_TIPS`
    (`src/app/tips.ts:10–21`) `ancientFruit: 'Grows only from 🦴 ancient seeds you dig up; no shop sells it. Each
    harvest gives its seed back, sometimes two, and it has its own deep market.'`.
  - `RunState` (`src/core/state.ts:55–103`) gains `finds: Finds` (`{ shards: number; starDust: number; ancientSeeds:
    number; book: boolean }` — shards HELD, the run's dust and ancient-seed counts, the run's book), `relics:
    RelicId[]` (owned this run, pick order) and `energyReserve: number`. `Lifetime` (`:201–220`) gains `shardsFound`,
    `starDustFound`, `ancientSeedsFound` (numbers) and `relicsEver: RelicId[]` (every rule ever picked, no repeats).
    New `src/core/data/relics.ts`: `RELIC_IDS = ['orderBonus', 'marketFloor', 'orderCooldown', 'energyRegen',
    'overflowReserve', 'stoneFuel'] as const`, `RelicId`, and `RELICS: Record<RelicId, { name: string; text: string }>`
    with the names and texts of task 227.
  - `createFreshRun` (`state.ts:285–330`): `finds: { shards: 0, starDust: 0, ancientSeeds: 0, book: false }`,
    `relics: []`, `energyReserve: 0`, `market` built from `ALL_CROP_IDS` (`:321`, so `market.ancientFruit = 0`), and the
    default lifetime literal (`:309`) gains `shardsFound: 0, starDustFound: 0, ancientSeedsFound: 0, relicsEver: []`. A
    sold run carries `lifetime` (already, `src/core/prestige.ts:74`) and with it the book page; it carries NO finds,
    relics or reserve (the fresh run's defaults) — the set bonus is lost on the sale, as decided.
  - Save (`src/save/serialize.ts`): `SAVE_VERSION` 32 → 33 (`:38`). `SaveV32` (`:297`) becomes a frozen past shape `{
    version: 32; savedAtMs: number; state: { meta: MetaState; run: RunV32 } }` with `RunV32 = Omit<RunState, 'finds' |
    'relics' | 'energyReserve' | 'lifetime' | 'market'> & { lifetime: LifetimeV32; market: Record<CropIdV32, number>
    }` (freeze `CropIdV32` = the 10 crops and `LifetimeV32 = Omit<Lifetime, 'shardsFound' | 'starDustFound' |
    'ancientSeedsFound' | 'relicsEver'>` next to `CropIdV26` `:41–45`; `SaveV31` `:296` moves to the same frozen run
    shape so `migrateV31` stays a stamp). New `SaveV33 = { version: 33; savedAtMs: number; state: GameState }`, `Save =
    SaveV33`. `migrateV32(save: SaveV32): SaveV33` after `migrateV31` (`:878–880`) adds exactly the defaults above
    (finds zero / book false, relics [], energyReserve 0, market.ancientFruit 0, the four lifetime fields 0 / []) —
    nothing granted, refunded or removed; a veteran digs for the first shard like anyone. `migrate()` (`:885–902`):
    `version === 33` returns as is, `32` → `migrateV32(...)`, and every older branch (`:889–901`, incl. the `toV20`
    tail) wraps its chain in `migrateV32(...)`.
  - Fixture `tests/fixtures/save-v32.json` is ALREADY committed with this plan: a real live v32 save (the committed
    save-v31.json seeded on the old live v31 build, loaded by the live v32 build rH8CzeUZ on 2026-11-22, migrated and
    re-saved by the live code; plain listing, ⭐79, 24 tiles, 10 licences, mine licence, digs 23). Never edit any file in
    tests/fixtures. `tests/save.test.ts` (v32 describe `:1699–1712`): import save-v32; new describe 'save v33: dig
    finds, relics and the reserve (batch 36.4)': v32 → v33 adds exactly the new keys at their defaults (no other run /
    meta / top-level key added or removed; cash, ⭐, the 10 crops' market, offers, licences and the old lifetime fields
    deep-equal) and stamps 33; every fixture save-v1 … save-v32 lands on 33. Update every `SAVE_VERSION` / "→ v32" pin
    (`save.test.ts:1678`, `:1687`, `:1709–1710`; App.test "Will migrate v15 → v32" `tests/App.test.tsx:487`) to 33.
  - Grep `src/` and `tests/` for every `Lifetime` / `RunState` literal, `createFreshRun` caller and `market` literal
    with the 10 crop keys; CI `tsc -b` fails on a stale one.
- [x] 225. **Dig finds and the ancient crop (core + the dig/pouch UI).**
  - `digForSeeds` (`src/core/actions.ts:248–262`): the potato roll stays FIRST and unchanged (`r1 < 0.2`,
    `digSeedDrop()` `balance.ts:489–490`, `:1200–1202`). Then, on every successful dig, THREE more draws in this fixed
    order whether or not anything dropped (a fixed count keeps runs replayable): `r2` shard (`< DIG_SHARD_CHANCE
    0.005`), `r3` star dust (`< DIG_DUST_CHANCE 0.003`), `r4` ancient seed (`< DIG_ANCIENT_CHANCE 0.0005`). The finds
    are independent of the potato roll (a dig can drop a seed and a find). Effects: shard → `finds.shards` +1 and
    `lifetime.shardsFound` +1; dust → `run.stars` +1 (1 ✨ = ⭐1, est.), `finds.starDust` +1, `lifetime.starDustFound` +1
    (NOT `lifetime.starsEarned`, which stays the orders' total); ancient → `run.seeds.ancientFruit` +1,
    `finds.ancientSeeds` +1, `lifetime.ancientSeedsFound` +1. After the set (all 6 relics owned, task 226) the shard
    draw no longer pays a shard: `r2 < DIG_ANCIENT_CHANCE` pays a SECOND ancient seed instead (est.; dust stays 0.3 %).
    📖 book: no draw — the run's first successful dig sets `finds.book = true` (est.). New balance export
    `digFindChances(): { shard: number; dust: number; ancient: number }`. Keep the existing energy check here; task 226
    swaps it for `spendEnergy`.
  - The ancient crop is licence-free and pouch-only:
    - `plant` (`actions.ts:164–189`): for `ANCIENT_CROP` skip the licence check (`:174`) and NEVER auto-buy (stock 0 →
      `NO_SEEDS` even with `autoBuySeeds` on, `:175`). When the plant takes the LAST ancient seed (stock 1 → 0, not kept
      by the dibber), `plantCrop` switches to the top licensed crop the run owns (the last of `CROP_IDS` in
      `run.licenses`), so the plant worker (`src/core/workers.ts:34`) never idles on an empty ancient pouch (est.).
    - `selectCrop` (`:192–194`): `ancientFruit` selects when `run.seeds.ancientFruit > 0`, else `NO_SEEDS`; other crops
      unchanged.
    - `harvest` (`:211–246`): for `ancientFruit`, after the existing sickle rolls, its seed always comes back (+1 into
      the pouch) and one more draw `< ANCIENT_SEED_EXTRA 0.25` adds a second; no renown (skip `addRenown`, `:239`).
      Every other crop draws nothing new (its replay stays exact). Hand and worker harvests alike.
    - Market: `marketDepthGlut` (`balance.ts:704–706`) × `ANCIENT_MARKET_DEPTH` 4 for `ancientFruit` only;
      `decayMarket` (`src/core/market.ts:27–37`) loops `ALL_CROP_IDS`.
    - Not on the Estate in 36.4: `fieldsPlantable` (`src/core/fields.ts:127–129`) is already false for it (no licence),
      so fields, the Manager and contracts never plant it — leave it so (est.). Orders never ask for it (offers draw from
      `run.licenses`). The Orchard tree takes berries only (`src/core/tree.ts:21`) — unchanged.
  - UI (`src/app/Farm.tsx`):
    - `DigSeeds` (`:74–93`) gains a `state` prop (callers `Farm.tsx:114`, `src/app/App.tsx:197`, `:232`). The result
      line: a seed-only dig keeps `Found a 🥔 Potato seed!`, an empty dig keeps `Nothing this time`; any find shows
      `Found ` + the parts joined by ` + ` + `!`, parts in this order: `a 🥔 Potato seed`, `the 📖 collection book`,
      `a 🏺 relic shard`, `✨ star dust (⭐+1)`, `a 🦴 ancient seed` (`2 🦴 ancient seeds` when both draws hit after the
      set). Build it by comparing prev/next state.
    - `SeedPouch` (`:20–71`): after the licence rows, one `🦴 Ancient seed` row with `×{run.seeds.ancientFruit ?? 0}`,
      the ⓘ `TIPS.ancient` = `'Dug up, never sold in a shop. Plant it like any seed; each harvest gives it back.'` and
      no Buy buttons (keep the row's grid cells with empty spans); shown while `run.finds.ancientSeeds > 0` or the pouch
      holds one.
    - "Crop to plant" (`Farm.tsx:103–112`): an `🌰 Ancient fruit` button after the licensed crops while
      `run.seeds.ancientFruit > 0` or it is the selected crop, same markup.
- [x] 226. **The 6 relics (core): picks, the set ×1.5, the reserve, stone fuel.** New `src/core/relics.ts`. Toon's
  locked numbers; `RELIC_SET_FACTOR` 1.5 is already applied in the set column:
  | Relic | none | owned | set (all 6) | Hook (today) |
  |---|---|---|---|---|
  | `orderBonus` | 0.1 | 0.2 | 0.3 | `orderBonus()` `balance.ts:565–567` → `orderBonus(relics: readonly RelicId[] = [])`; callers `src/core/orders.ts:118`, `:123`, `src/app/Orders.tsx:21`, `:93` pass `run.relics` |
  | `marketFloor` | +0 | +0.10 | +0.15, capped at `RELIC_FLOOR_CAP` 0.9 | `cropFloor` `src/core/market.ts:8` = `min(0.9, renownFloor(points) + lift)`; MARKET_DECAY and `marketDepthGlut` untouched (the floor alone moves the steady price) |
  | `orderCooldown` | 600 | 300 | 200 ticks | `orderCooldownTicks()` `balance.ts:605–607` → `(relics = [])`, ×½ / ×⅓ rounded; caller `orders.ts:238` |
  | `energyRegen` | ×1 | ×1.10 | ×1.15 | regen in `step` `src/core/step.ts:67` × `relicRegenFactor(run.relics)`; also the Stats "Energy regen" row (`src/core/stats.ts:105`); Upgrades' per-level preview (`src/app/Upgrades.tsx:39`) stays the base |
  | `overflowReserve` | — | cap 20 × ⚡ max | cap 30 × ⚡ max | `step.ts:66–69`: regen past ⚡ max adds to `energyReserve`, up to `reserveCap(run, meta)` = factor × `energyMax(level, meta)`; never fills without the relic |
  | `stoneFuel` | LOCKED | stone = 2 fire units | 3 units | `FUEL_UNITS` `balance.ts:116` gains `stone: 2`; `fuelTicks(fuel, relics = [])` `:918–920` → stone ×1.5 units in a set; `fuelRoom(f, fuel, relics = [])` `src/core/furnace.ts:42–44`; `addFuel` `:50–62` order LOCKED (stone without the relic), NO_FURNACE, FULL, NO_FUEL |
  - `spendEnergy(run, cost): { energy: number; energyReserve: number } | null` pays ⚡ first, then the reserve; null when
    both together are short. Use it at every ⚡ check/spend: `farmAction` `actions.ts:132`/`:136`, `digForSeeds`
    `:252`/`:256`, Fields reap `fields.ts:326` with its checks `:340` and in `reapNext`, the mine `dig`
    `src/core/mining.ts:170`/`:175`, `plantTree` `src/core/tree.ts:27`/`:32`. Cost 0 (workers) always succeeds and
    changes nothing; with `energyReserve` 0 every result equals today's.
  - `pickRelic(state, id)`: order ALREADY_OWNED, NOT_ENOUGH_ITEMS (`finds.shards < RELIC_PICK_SHARDS` 5); then
    `finds.shards` −5, `relics` + id, `lifetime.relicsEver` + id when new. Every unowned rule is offered (no random
    offer). `relicSet(run)` = all 6 owned. 30 shards = the set.
  - The fuel loader (`src/core/workers.ts:71–81`) keeps loading coal / wood only (never stone, est.).
- [x] 227. **UI: the 📖 collection book, stone in the furnace, the order bonus label.**
  - In `DigSeeds`, under the result line, once `run.finds.book`: a `<section className="relic-book">` with
    `<h3>📖 Collection book</h3>` and, in order:
    1. `🏺 Shards {finds.shards} · 5 buy one rule`; once the set is complete: `🏺 Set complete — every rule ×1.5`.
    2. One row per relic in `RELIC_IDS` order: name + text; an owned rule shows `✓ owned`, an unowned rule a button
       `Take 🏺5`, disabled while `pickRelic` fails. Names / texts (`RELICS`, est.): orderBonus `📋 Order bonus` —
       `Orders pay +20 % instead of +10 % (+30 % in a set).`; marketFloor `📉 Market floor` — `Every crop's price floor
       +0.10 (+0.15 in a set).`; orderCooldown `⏳ Quick notices` — `A discarded order refills in half the time (a
       third in a set).`; energyRegen `⚡ Second wind` — `⚡ regen +10 % (+15 % in a set).`; overflowReserve `🔋 Reserve`
       — `⚡ regen past full is banked, up to 20 × your ⚡ max (30 × in a set).`; stoneFuel `⛰️ Stone fire` (the
       `ITEMS.stone.emoji`) — `Stone burns in the furnace: 2 fire units each (3 in a set).`
    3. With `overflowReserve` owned: `🔋 Reserve {Math.floor(energyReserve)} / {reserveCap}` and a `<Bar kind="energy">`.
    4. A `<small>` lifetime line: `Ever found: 🏺 {shardsFound} · ✨ {starDustFound} · 🦴 {ancientSeedsFound} · rules
       {relicsEver.length} / 6 · relics are lost when the farm is sold`.
    No HUD change (the 375 top bar is not touched in this batch).
  - Furnace fuel buttons (`src/app/Mine.tsx:286–296`): the stone button (`Fill with ⛰️ stone`) shows only while
    `stoneFuel` is owned; its `uses(...)` text and `smeltFuel` read `run.relics`.
  - Orders card (`src/app/Orders.tsx:21`, `:93`): the bonus value and text read `orderBonus(state.run.relics)`.
  - jsdom tests (no browser): `tests/OrdersCard.test.tsx` (+20 % with the relic), `tests/Mine.test.tsx` (stone button
    hidden / shown), a DigSeeds render test (book hidden before the first dig, shown after; Take disabled at 4 shards,
    enabled at 5; the set line), the pouch 🦴 row and the 🌰 crop button.
- [x] 228. **Pins, sim re-pins, CHANGELOG, results.**
  - New `tests/relics.test.ts` (pure, no bot):
    - PIN36l dig find odds: 200,000 digs from a fixed seed with ⚡ refilled — shards / dust / ancient within ±15 % of
      0.5 % / 0.3 % / 0.05 %, potato still 0.2 ± 0.01, the book on dig 1 only, same seed → same state; with the set
      owned no shard drops and the ancient rate is ≈ 0.1 % (±25 %).
    - PIN36m the rule table above (each rule none / owned / set; the floor cap 0.9 on a renown-0.7 crop; the reserve
      fills only from overflow and only with the relic, and `spendEnergy` drains it after ⚡; stone LOCKED → 2 → 3 fire
      units; `pickRelic` errors and the 5-shard price; `sellFarm` drops relics / finds / reserve and keeps the four
      lifetime book fields).
    - PIN36n closed-form ceilings from `balance.ts` (report with `console.log('PIN36n', …)`): digs/h at ⚡ regen Lv10
      = 3600 × `energyRegenPerTick(10, freshMeta)` (= 4,200); dust ⭐/h = digs/h × 0.003 ≤ 12.6, with the regen relic
      set (×1.15) ≤ 14.5, both under 19.2 (the ×8-scaled dust ceiling); first rule pick at 25 % of Lv0 regen = 5 / (0.25
      × 1,200 × 0.005) = 3.3 h.
    - PIN36o report only: the migrated save-v32 fixture stepped 2 game-h with no relic vs with all 6 granted — log cash
      gained, ⭐ gained and the reserve; no band (Toon judges the relic's worth in his playtest).
  - Ancient crop pins (in `tests/actions.farm.test.ts` beside digForSeeds `:135–157`): plant without a licence, never
    auto-buys, the last seed switches the crop to plant, harvest returns 1 seed + a 25 % second, no renown, market depth
    ×4.
  - Sims: every farm dig now draws 3 more values, so the two sim files that call `digForSeeds` replay differently after
    their first dig: `tests/sim/early.test.ts` (`:218` the greedy bot's dig, `:340–348` `digBench`, the affordable pin
    `:335` and any other pin there that moves) and `tests/sim/bars-ladder.test.ts` PIN35stingy (`:248`, report `:258`).
    Re-pin what moves, old → new with its cause, in the results. The ladder bot never digs the farm (`tests/sim/bot.ts`
    has no `digForSeeds`), so `fields`, `mine-estate`, `market-orders`, `prestige-crops`, `tools-workshop`,
    `furnace-iron` and `districts` must NOT move — a moved number there is a bug to fix, not a re-pin.
  - CHANGELOG (top of `CHANGELOG` in `src/app/changelog.ts`, batch '36.4', 158 code points): "🏺 Digging the farm now
    finds relic shards (5 buy one of 6 run-long rules, ×1.5 as a set), ✨ star dust worth ⭐1 and a rare 🦴 ancient seed
    the shop never sells."
  - `## Batch 36.4 results` + `### Deviations` at the true end of this file; tick 224–228.

Out of scope: a farm-dig worker job (hand-only); the ancient crop on the Estate fields; growing the relic pool past 6;
relics as district signatures; the almanac; dust as its own spendable currency; any ⭐ Favour row; the open 36.2 nits
(tree fruit count at 1024, empty Orchard tree sheet hint, Forge Collect reason) and the 375 top-bar wrap; the PIN36h
sim-bot ladder deadlock (36.3 Deviation, stays `it.fails`).

## Batch 36.4 results

Tests 1264 passed / 1274 total (8 expected-fail) before → **1285 passed / 1293 total (8 expected-fail, 71 files)** after;
`pnpm lint`, `pnpm build`, `npx tsc -b --force` clean, `dist/` deleted, purity grep clean (`src/save/storage.ts:26`
wallClock excepted), case-clash check empty. Commits: d2a68a2 (224), 34b017b (225), fc888f1 (226), fdf66e5 (227), this
commit (228).

- 224 — save v33: `finds` / `relics` / `energyReserve` run fields, the 4 find lifetime counters, the licence-free
  `ancientFruit` crop id, `migrateV32` defaults, frozen v32 shapes; every fixture v1…v32 lands on v33.
- 225 — dig finds: 4 fixed draws per dig (potato, shard 0.5 %, dust 0.3 % = ⭐1, ancient 0.05 %; a second ancient after
  the set), the book on the run's first dig, the ancient crop (seed back + 25 % second, no renown, depth ×4, no
  auto-buy, last-seed switch), the dig result line, 🦴 pouch row, 🌰 crop button.
- 226 — the 6 relics: `RELIC_*` tables + `relicTier` in balance, `src/core/relics.ts` (`pickRelic` 5 shards,
  `spendEnergy` ⚡→reserve, `reserveCap`, `relicRegenFactor`), orderBonus / cooldown / cropFloor / fuelTicks / fuelRoom
  relic-aware, reserve banking + regen ×factor in `step`, `spendEnergy` at every ⚡ site.
- 227 — panels read the relics: the 📖 collection book section (shards line, 6 `Take 🏺5` rows → `✓ owned`, set line,
  🔋 reserve + Bar, lifetime line), `Fill with ⛰️ stone` behind the Stone fire relic, Orders note `+20 %`; jsdom tests
  `tests/DigSeeds.test.tsx`, OrdersCard +20 %, Mine stone hidden/shown.
- 228 — `tests/relics.test.ts` PIN36l–o, CHANGELOG 36.4 (158 code points), this results section; no sim re-pin needed.

PINs (`tests/relics.test.ts`, all from the fresh fixed seed):

- PIN36l (200,000 digs): shards 991 = **0.4955 %**, dust 609 = **0.3045 %**, ancient 98 = **0.049 %** (targets
  0.5 / 0.3 / 0.05, all inside ±15 %), potato 39,811 = **19.9055 %** (0.2 ± 0.01), book on dig 1, 100-dig replay
  deep-equal. Set owned: 0 shards, ancient 207 = **0.1035 %** (≈ 0.1 % ± 25 %).
- PIN36m: none/owned/set — orderBonus 0.1/0.2/0.3, cooldown 600/300/200, regen ×1/×1.10/×1.15, floor 0.7/0.8/0.85 on a
  renown-4,000 crop (cap 0.9), reserve caps 0/200/300 (20 × / 30 × the ⚡ max 10), stone 0/60/90 fire ticks and `addFuel`
  LOCKED without the rule; reserve fills only past ⚡ max and only with the rule (100 ticks at max → 33.33, capped at
  300); `spendEnergy` pays ⚡ first then the reserve; `pickRelic` NOT_ENOUGH_ITEMS at 4 / price 5 / ALREADY_OWNED;
  `sellFarm` drops run finds/relics/reserve, keeps the 4 lifetime book fields.
- PIN36n (closed form, logged): digs/h at Lv10 regen **4,200**; dust ⭐/h **12.6**, **14.49** with the set (≤ 14.5),
  both < 19.2; first rule pick **3.33 h**.
- PIN36o (report only, the migrated v32 fixture, 2 game-h): cash gained **+23,665,652** (no relic) vs **+28,909,457**
  (all 6), ⭐ **+0 / +0** (step-only runs no order deliveries), 🔋 reserve **0 / 1800**.

Sims: **nothing re-pinned** — `tests/sim/early.test.ts` 81 passed unchanged and bars-ladder PIN35stingy passes unchanged
(report now firstDugSeed 0.1 min, firstHarvest 1.2 min, carrot 3.0 min, 31 digs, lowest 0): both scenarios' pins are
bands/defined-ness and absorbed the 3-extra-draw PRNG shift; `fields`, `mine-estate`, `market-orders`, `prestige-crops`,
`tools-workshop`, `furnace-iron`, `districts` byte-identical inside `pnpm test` (PIN36h still `it.fails`, untouched).

v32 fixture check (`tests/save.test.ts`): `deserialize(save-v32)` → version 33, `finds` at zero/book false, `relics` [],
`energyReserve` 0, `market.ancientFruit` 0, the four lifetime fields added — nothing else moved.

New UI strings (all jsdom-verified except the visual notes below): dig result parts `a 🥔 Potato seed`, `the 📖
collection book`, `a 🏺 relic shard`, `✨ star dust (⭐+1)`, `a 🦴 ancient seed` / `N 🦴 ancient seeds`;
`📖 Collection book`; `🏺 Shards {n} · 5 buy one rule`; `🏺 Set complete — every rule ×1.5`; `Take 🏺5`; `✓ owned`;
`🔋 Reserve {n} / {cap}`; `Ever found: 🏺 n · ✨ n · 🦴 n · rules n / 6 · relics are lost when the farm is sold`;
`🦴 Ancient seed` pouch row (TIPS.ancient); `🌰 Ancient fruit` crop button; `Fill with ⛰️ stone` (Mine, hidden without
the relic); Orders note `at +20 %`; CHANGELOG 36.4 line.

### Deviations

- The Mine `Fill with ⛰️ stone` gate was committed with task 226 (fc888f1), not 227: FUEL_UNITS gaining stone broke
  the Mine "three groups" pin mid-batch, and the gate (planned for 227) was the fix; 227 then added its hidden/shown
  test only.
- `balance.ts`: the dead `ORDER_BOARD.bonus` field and `ORDER_COOLDOWN_TICKS` constant were removed (their values live
  on as `RELIC_ORDER_BONUS[0]` / `RELIC_COOLDOWN_TICKS[0]`; lint no-unused forced the deletion, no number changed).
- `tests/App.test.tsx` batch-35 dig text pins: with 4 draws per dig the first potato seed moved to dig 11, past a fresh
  run's ⚡10 = 10 digs — both tests now pin the deterministic first-dig `Found the 📖 collection book!`; potato odds stay
  pinned at unit level (PIN36l 200,000 digs + the 2,000-dig rate test in `tests/actions.farm.test.ts`).
- `tests/relics.test.ts` float notes: the reserve below ⚡ max is asserted `< 1e-9`, not `=== 0` (the integer rounding
  of ⚡ banks 4.4e-16 dust per tick); PIN36n's 4,199.999… digs/h asserted via `Math.round = 4200`.
- PIN36o's ⭐ gained is +0 in both runs — the migrated fixture's 2 game-h of pure `step` delivers no orders; report-only
  as planned, Toon judges the relic's worth in the playtest.
- jsdom only, no browser (per brief): layout, wrap and the Bar's visual fill at 375 / 1024 / 1440 / 2560 / 3440 are
  unverified.
