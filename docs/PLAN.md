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
for batches 1–36.5, plus the big-farm roadmap. Lines 1–7436 of that file are the old `docs/PLAN.md` line for line, so a
`PLAN.md:N` citation from before 2026-11-14 points at the same line there. References like PLAN.md "Batch 24 results"
in tests and `docs/DECISIONS.md` resolve there too.

The archive is append-only and large (7,400+ lines, ~680 KB). Never read it whole: read only the line range a brief
cites, or `grep -n '^## Batch N'` and read that range.

## Active batches
New batch plans are appended below, and workers write `## Batch N results` + `### Deviations` at the end of this file.
After a batch is pushed, Hermes moves its plan and results to the end of the archive.

## Batch 36.6 — 🏅 Renown: 5 tiers that carry over a sale, the 4-fields breadth rule, 5 new Legacy rows, Lv 6–10, the sale preview (tasks 234–238, save v34 → v35)

Why: deeds stop pulling after about sale 3 (the 276-deed shop is bought out), and renown is lost at every sale unless
the Kept renown row is owned. Renown with 5 tiers that carry by default is the permanent chase. The 4-fields-per-crop
breadth rule ships in the SAME batch, because carried one-crop renown alone stops every listing-soil flip (the crux,
prestige-layers q7). Five new one-time keep rows plus Fast crops / Rich harvest Lv 6–10 give estate sellers a sink past
sale 5. Playtest question: is selling worth it beyond deeds?
Hard guards (DECISIONS batch 24 stance): no soft lock, no stall, no infinite cash loop, nothing negative, saves
migrate, nothing taken away by a migration.
Anchors below are commit a05af886 (origin/main after batch 36.5), SAVE_VERSION 34. Re-measure with `grep -n` before
editing. Every new number lives in `src/core/balance.ts`; numbers marked (est.) are Hermes picks (DECISIONS "Batch 36.6
refined"); the tier table, deed prices and the Lv 6–10 curve are Toon's accepted values (prestige-layers q3–q8).

Scope fence: with renown 0 on every crop and no new Legacy row owned, the game plays byte-identically EXCEPT the sale
(renown now carries). Every new core parameter is OPTIONAL with a default that reproduces today. Unlike 36.5, sim
numbers MAY move in this batch, but only for the causes named in task 238 (the T2+ grow bonus, renown carried into
run 2, start seeds, the deed buy order). Each moved sim pin is re-pinned old → new with its cause in the results.

Words: "renown tier" is per crop (🥉🥈🥇🏅🏆); a "Legacy row" is a deed purchase. "Kept renown" (`keepRenown`) is
renamed "Apprentices" in the UI only; the id stays.

## Tasks (234–238)

- [x] 234. **Save v35 and the new shape (no mechanic yet).** Commit this task FIRST.
  - `src/core/state.ts:257` `MetaUpgradeId` and `:287` `META_UPGRADE_KEYS` gain, in this order after `keepRenown`:
    `'keepClerk', 'keepCertificates2', 'mineStart', 'keepBoard', 'keepManager'`.
  - `src/core/balance.ts:740` `DEED_ROW_IDS` gains the same 5 ids after `keepRenown`; `DEED_MAX_LEVEL` (:742–752) 1
    each; `DEED_ONE_TIME_COST` (:753) gains `keepClerk: 6, keepCertificates2: 8, mineStart: 4, keepBoard: 4,
    keepManager: 24`. The rows exist (buyable, the Legacy shop lists them) but have NO effect until task 237.
  - `src/save/serialize.ts:39` `SAVE_VERSION` 34 → 35. New frozen `MetaV34` (`MetaState` with `upgrades` minus the 5
    keys); today's `SaveV34` (:308) becomes `{ version: 34; savedAtMs; state: { meta: MetaV34; run: RunState } }`;
    new `SaveV35 = { version: 35; savedAtMs; state: GameState }`, `Save = SaveV35` (:309).
    `migrateV34(save: SaveV34): SaveV35` after `migrateV33` (:916–918):
    - `meta.upgrades` gains the 5 keys at 0;
    - renown re-seed: for every crop id in `CROP_IDS` (never `ancientFruit`), `run.renown[c] = max(run.renown[c] ?? 0,
      run.lifetime.harvests[c] ?? 0)`, writing the key only when the result is > 0 (a crop at 0 stays absent).
      `lifetime.harvests` counts home harvests only (`actions.ts:110`; field reaps leave it alone, `fields.ts:310`), the
      same source the v22 → v23 migration seeded renown from (:739). A player who sold before 36.6 gets back what the
      old reset took; a player who never sold already has renown ≥ harvests, so nothing changes for them;
    - nothing else (growTime / sellPrice levels untouched, no deed refunded, the `keepRenown` level kept).
    Chain it on EVERY branch of `migrate()` (:926–941): `if (data.version === 35) return data as SaveV35`, v34 →
    `migrateV34(data as SaveV34)`, and wrap every older branch's chain in `migrateV34(…)`.
  - The fixture `tests/fixtures/save-v34.json` is ALREADY committed (live re-save: the v33 export migrated by the live
    v34 build CgJXbpZh on 2026-11-23 01:18; never edit any file in tests/fixtures). tests/save.test.ts: import it like
    `v33` (:35); pin that it migrates to v35 with exactly the 5 zero keys added to `meta.upgrades` and `run.renown`
    unchanged (its renown equals its lifetime harvests: radish 1,310, chilli 18,811, pumpkin 657, lemon 2,100, tomato
    866, corn 326, strawberry 11,184, grape 1,695), everything else deep-equal; a hand-built v34 save that sold before
    (renown `{ lemon: 1000 }`, harvests `{ lemon: 2416, pumpkin: 300 }`) migrates to `{ lemon: 2416, pumpkin: 300 }`;
    every older fixture v1 … v34 reaches v35. Update the version pins (`tests/save.test.ts:567–569`, `:1109`) and
    `tests/App.test.tsx:489` → "Will migrate v15 → v35".

- [x] 235. **Renown: 5 tiers, grow bonus, carry by default, Apprentices, start seeds (core).**
  - `src/core/balance.ts:776–797`: `RENOWN_TIERS = [250, 1000, 4000, 12000, 30000]`; `RENOWN_FLOORS = [0.55, 0.6, 0.7,
    0.7, 0.75]` (tiers 1–3 unchanged); new `RENOWN_GROW = [1, 0.95, 0.9, 0.85, 0.8]` (grow-time factor for tiers 1–5;
    tier 0 = 1); `RENOWN_BADGES = ['🥉', '🥈', '🥇', '🏅', '🏆']`; `RENOWN_START_SEEDS = [6, 6, 6, 24, 24]` (tiers 1–5;
    6 = one sprinkler bed, 24 = the 4 beds); `RENOWN_COVER_FIELDS = 4`. Exports `renownGrow(points)` (the factor),
    `renownBadge(points)` ('' at tier 0), `renownStartSeeds(points)` (0 at tier 0), `renownShare(fields) = fields <=
    RENOWN_COVER_FIELDS ? 1 : RENOWN_COVER_FIELDS / fields`. Comment "tiers reached (0–3)" → "(0–5)".
  - `cropGrowTicks` (:812) gains a 5th optional parameter `renown = 1` (a factor, multiplied inside the existing
    `Math.round(…)`). `cropRotGraceTicks` (:817) does NOT pass it: the harvest window stays on the unboosted grow time,
    like fertilizer. The 🌳 tree cadence (`treeCadenceTicks`, BASE ticks) and the ancient crop get no grow bonus.
  - `src/core/market.ts`: new `cropRenownGrow(run, crop, fields = 0)` = `renownGrow(points)` when `renownShare(fields)`
    is 1, else `1 − (1 − renownGrow(points)) × renownShare(fields)`. HOME callers pass `cropRenownGrow(run, crop)` (full
    bonus): `src/core/step.ts:53` (stepTile — add a `renown: number` parameter after `tick`; the call at :105 passes it),
    `src/core/actions.ts:251` (harvest maturity), `src/core/tile.ts:11` (`growTicks`), `src/core/orders.ts:70`
    (orderPerMinute's home part), `src/core/fields.ts:228` (`hc` in the income curve). ESTATE callers are task 236.
    `marketSteadyFactor` (market.ts:55) keeps its signature; leave its callers.
  - Carry: `src/core/prestige.ts:77–86`: the keepRenown branch becomes `renown: run.renown` (points, every crop, tier 0
    included, no deed needed). Drop the `RENOWN_TIERS` / `renownTier` imports (:10, :16) if nothing else uses them; fix
    the comment.
  - Apprentices (`keepRenown`, same id, same 3 deeds, owners keep their level): a worker harvest earns `RENOWN_BY_HAND`
    instead of `RENOWN_BY_WORKER` when `state.meta.upgrades.keepRenown > 0`, at `actions.ts:284` and at the 🌳 tree pick
    `tree.ts:81` (both read `energy > 0 ? HAND : WORKER` today). Taps and tool presses stay +2.
  - Start seeds: `createFreshRun` (`state.ts:317`; `seeds: {}` at :346) gives `renownStartSeeds(carry.renown[c])` seeds
    of every crop `c` in the NEW run's `licenses` (`carry.licenses`) with tier ≥ 1. A new game (no carry) keeps `{}`.
    Without the Seed vault only the starting crop is licensed, so only it gets a kit (intended: the vault and renown
    stack).
  - Tests (PIN36t, `tests/renown.test.ts`; rewrite `:66–92` "renown and Sell the farm"): tier / floor / next / badge /
    grow at 249, 250, 999, 1,000, 3,999, 4,000, 11,999, 12,000, 29,999, 30,000 (floors 0.5 0.55 0.55 0.6 0.6 0.7 0.7 0.7
    0.7 0.75; grow 1 1 1 0.95 0.95 0.9 0.9 0.85 0.85 0.8; next null only at ≥ 30,000); `cropGrowTicks('strawberry',
    meta, 0, null, 0.8) === Math.round(cropGrowTicks('strawberry', meta, 0) × 0.8)`; a home strawberry tile with renown
    1,000 matures at `Math.round(base × 0.95)` ticks (stepTile, `harvest` and `isMature` agree); rot grace unchanged by
    renown; the sale keeps `{ lemon: 1000, pumpkin: 100 }` with NO deed owned (tier-0 pumpkin kept too); a worker
    harvest +2 with Apprentices and +1 without, a tap +2 either way (also on the tree bed, `tests/tree.test.ts:104–129`);
    the next run starts with 6 radish seeds at radish 250, 24 at 12,000, 0 at 249; with the Seed vault and lemon 4,000
    also 6 lemon, without the vault no lemon seeds. Update `tests/sim/mine-estate.test.ts:523–545` (the "sold without
    Kept renown → {}" pin): renown now carries either way; keep its 0.7-floor sale check.

- [x] 236. **The breadth rule: renown covers 4 fields per crop (the economy-rule guard).**
  - market.ts: `cropFieldCount(run, crop)` = `run.fields.unlocked ? run.fields.list.filter((f) => f.crop ===
    crop).length : 0` (CHIP-based, `Field.crop` state.ts:206: stable mid-cycle; a chip without a pivot counts too).
    `cropFloor(run, crop, fields = cropFieldCount(run, crop))` (:8–9): the renown part becomes `MARKET_FLOOR +
    (renownFloor(points) − MARKET_FLOOR) × renownShare(fields)`; when the share is exactly 1 use `renownFloor(points)`
    unchanged (byte-identical floats); the 📉 relic lift and `RELIC_FLOOR_CAP` apply after it, unchanged. The floor
    belongs to the crop's ONE market, so the shared floor applies to every sale of that crop, home included, once more
    than 4 fields show its chip.
  - Grow: home tiles always keep the full bonus (task 235). ESTATE callers pass `cropRenownGrow(run, crop,
    cropFieldCount(run, crop))`: `src/core/fields.ts:73` (`pressuredCycle`; sowPlot's readyTick and every estate read go
    through it), `src/core/fields.ts:558` (`fieldsMarginalIncomePerHour`), `src/app/estateText.ts:51`.
  - The Manager's DP: `fieldsCropIncomeCurve(state, crop, breadth = true)` (fields.ts:225–237): inside `income(T)` take
    `n = breadth ? Math.ceil(T / (fieldPlots() × plotTiles())) : 1` and use `cropFloor(run, crop, n)` and a pressured
    cycle on `cropRenownGrow(run, crop, n)` for that T (the home part `hc` stays full). `breadth = false` is today's
    rule (share 1 at every T); only PIN36u passes it. `managerPlan` (manager.ts:47–76) is unchanged: each crop's value
    row still depends only on its own field count, so the DP stays exact on the non-concave share curve.
    `fieldsCropIncomePerHour` (:220) follows through the curve.
  - Tests:
    - `tests/manager.test.ts:58` ("≥ 0.999 × an exhaustive enumeration at 1–6 fields"): add the same check with renown
      30,000 on chilli only and with 12,000 on every crop.
    - PIN36u: pure DP on the shipped functions, no bot. Put it next to PIN31model in `tests/sim/mine-estate.test.ts`
      (:547), reusing that describe's `at` / `emptyField` / `enumerate` helpers (:326–360), at the estate stage
      `at(true, …)` with 20 managed empty fields. On the 10-crop ladder the estate best is CHILLI (b36-calculator item 2:
      plain plan = 20 chilli; Toon's own save holds chilli 18,811), so the guard is written on chilli:
      (a) crux regression: chilli 30,000 only, `breadth = false` → the best split is 20 chilli on the plain listing AND on
      listing soil `{ fast: 'berry', slow: 'fruitVeg' }`;
      (b) with the share, the same chilli-30,000 state on `{ fast: 'berry', slow: 'fruitVeg' }` (the only ±20 % flip)
      plans FEWER than 20 chilli fields; print the split;
      (c) every crop at 30,000, share on, plain listing: the plan uses ≥ 2 crops; print the split;
      (d) `managerPlan` ≥ 0.99 × the exhaustive best for (b) and (c) at n = 2, 6, 10, and print its 20-field split.
      (est.) Hermes's closed-form estimate: (b) ≈ 4 chilli + 16 strawberry, (c) ≈ 16 chilli + 4 strawberry, margins of
      3–5 %. If (b) or (c) fails on the real code, do NOT tune any number: mark that one `it.fails` with the measured
      split in its title, record it under `### Deviations` as a design finding for Toon, and go on.
    - `tests/renown.test.ts`: `cropFloor` for chilli 30,000 with 0 / 4 / 5 / 8 / 20 chilli chips = 0.75 / 0.75 / 0.7 /
      0.625 / 0.55 (± 1e-9), and 0.75 with the Fields locked; `pressuredCycle` for 4 vs 8 chilli chips at 30,000 =
      `ceil(round(g × 0.8) / FIELD_PRESSURE)` vs `ceil(round(g × 0.9) / FIELD_PRESSURE)` with `g =
      cropGrowTicks('chilli', meta, 0)`; a home chilli tile keeps the full 0.8 with 20 chips.

- [x] 237. **The five new rows take effect + Fast crops / Rich harvest Lv 6–10.**
  - `DEED_MAX_LEVEL` growTime 5 → 10 and sellPrice 5 → 10 (balance.ts:743–744); `deedCost` unchanged (2^(level+1):
    Lv 6–10 cost 64 / 128 / 256 / 512 / 1,024 = 1,984 per row); `multiplier` unchanged (growTime Lv 10 ≈ ×0.66,
    sellPrice Lv 10 ≈ ×1.63 — read META_UPGRADE_STEP, do not change it). Fix the doc comments at :736–739 and :757.
  - `sellFarm` (prestige.ts:48–90) certificates, in WORKER_JOBS order (`src/core/data/workers.ts:5`): plant / water /
    harvest (keepFirstCertificates, unchanged) + `ore`, `fuel`, `mine` (keepCertificates2) + `clerk` (keepClerk) +
    `manager` (keepManager). No stoker row. Without `keepManager` the Manager certificate is still dropped
    (`tests/prestige.test.ts:86` keeps holding).
  - 📋 Kept Noticeboard (`keepBoard`): the sold run starts with `orders.unlocked: true` and every slot filled exactly as
    `buyOrderBoard` fills it (orders.ts:209–214, `rollOffers` :197), but free. Do it in `sellFarm` on the fresh run
    through a small exported `openBoard(state)` in orders.ts that `buyOrderBoard` uses too (its result must stay
    byte-identical).
  - ⛏️ Miner's start (`mineStart`): the sold run starts with `mineLicense: true`, `rack: { copper:
    pickaxeDurability('copper') }`, `selectedPickaxe: 'copper'` (the `craftPickaxe` shape, mining.ts:87–91), EXCEPT on
    a Wetlands listing (wetlands.ts:9 `noMine`: no mine there, the row does nothing on that run).
  - Kept Manager / Kept Clerk / Kept certificates II: certificates only (no worker, no assignment).
  - Tests (PIN36v): `tests/prestige.test.ts` — each row's carry on its own (clerk cert; ore/fuel/mine certs; board open
    at tick 0 with `slots` offers equal to `buyOrderBoard`'s roll on the same rngState; licence + copper pickaxe
    selected; no mine kit on a Wetlands listing; manager cert) and all five together; `deedCost('growTime', 5…9)` =
    64 / 128 / 256 / 512 / 1,024 (same for sellPrice), `deedMaxLevel` 10, one-time prices 6 / 8 / 4 / 4 / 24,
    `legacyMaxed` needs Lv 10 on both rows.

- [x] 238. **Visibility: 🏆 Legacy chip, renown badges, the 3-column sale preview; pins, CHANGELOG, report.**
  - Legacy chip: new `LegacyChip` in `src/app/Legacy.tsx`, a `<button className="legacy-chip">` (≥ 44 px tall) at the
    TOP of the 🌾 Farm tab (`src/app/Farm.tsx`, before `<Orders>` ~:160) and, where the Farm tab is not shown, at the
    top of the 🛒 Shop panel (`src/app/Shop.tsx`, before `<h2>Seeds</h2>` ~:103, `{!farmTab && …}` like `SeedPouch`
    at :146). Text: gate open (`sellFarmUnlocked`) → `🏆 {meta.deeds} · sale +{deedsClaimable(state)}`; before it →
    `🏆 next deed at 💰{count(nextDeedCash)} lifetime`, with a new balance export `nextDeedCash(lifetimeCash) =
    (deedsFor(lifetimeCash) + 1)² × DEED_DIVISOR` (:659). Shown from tick 0. Tap → the 🏦 Bank tab: `PanelProps`
    (panelTabs.tsx:20–37) gains `openBank: () => void`; `App.tsx:133` passes `openBank: () => setTab('bank')` (:37).
  - Badges: `renownBadge(points)` after the crop name in the 🌾 "Crop to plant" buttons (Farm.tsx ~:166), the 🛒 Seeds
    list's licensed buttons (Shop.tsx:117–128, both branches) and the Seed pouch label (Farm.tsx ~:36); on the Estate a
    `map-badge map-badge-renown` on the field chip (EstateMap.tsx:110–125) when the chip's crop has tier ≥ 1, in a corner
    the pivot / soil badges do not use (app.css :809–825). The "Crop to plant" and Seeds buttons get a `title`:
    "Strawberry 🥈 1,240 / 4,000" (top tier "Chilli 🏆 31,020 · top tier"; tier 0 "Radish 120 / 250"). FieldSheet
    (EstateMap.tsx:166+, next to the 🧭 line :215), for a chip crop with tier ≥ 1: `{badge} {Name} covers {min(n, 4)} of
    {n} fields · floor {pct} %` plus ` · grow −{x} %` when the factor is below 1 (n = `cropFieldCount`; pct / x from
    `cropFloor` / `cropRenownGrow` with n, whole %), e.g. chilli 4,000 on 6 chips: "🥇 Chilli covers 4 of 6 fields ·
    floor 63 % · grow −7 %". Stats (`src/core/stats.ts:79–83`) already reads 5 tiers; put the badge in front of the
    value.
  - Legacy rows (Legacy.tsx:28–77). NAMES: `keepRenown: 'Apprentices'`, `keepClerk: 'Kept Clerk'`, `keepCertificates2:
    'Kept certificates II'`, `mineStart: "Miner's start"`, `keepBoard: 'Kept Noticeboard'`, `keepManager: 'Kept
    Manager'`. TIPS: Apprentices "One-time: worker harvests earn renown like a hand harvest (+2 instead of +1)."; Kept
    Clerk "One-time: selling the farm keeps the Clerk certificate."; Kept certificates II "One-time: selling the farm
    keeps the ore, fuel and mine certificates."; Miner's start "One-time: every new farm starts with the mine license
    and a copper pickaxe (not in Wetlands)."; Kept Noticeboard "One-time: every new farm starts with the order board
    open."; Kept Manager "One-time: selling the farm keeps the Manager certificate.". effect(): "Workers earn +2
    renown", "The Clerk certificate survives the sale", "Ore, fuel and mine certificates survive the sale", "Mine
    license + copper pickaxe at the start", "Order board open from the start", "The Manager certificate survives the
    sale".
  - Sale preview (SellCard, Legacy.tsx:149–182): replace the ⭐ carry line (:149–152) and the Resets / Carries lists
    (:166–182) with three columns in a `<div className="sell-cols">` (CSS next to `.sell-list` app.css:2083: `display:
    grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0.5rem 1rem` — one column at 375, three
    from ~600 px), each an `<h3>` + `ul.sell-list`, all below the Next farm block and above the Sell button:
    - **Gain** — `+{gain} deed(s)` (only when the gate is open); `⭐{carried} carried`; one row per crop with tier ≥ 1:
      `{badge} {Name} {points}` ("Renown: none yet" when none); `Start seeds: {n} {emoji} …` for the next run's kit as
      createFreshRun gives it (only when non-empty).
    - **Lost** — `⭐{over} above {cap} — spend or reroll listings first` with `className="lost"` (red) when `run.stars >
      STAR_CARRY_CAP`; "Every ⭐ Favour level"; "Tiles, cash, market, storage, tools"; "Mine, furnace, workshop, fields,
      machines"; "Licenses, workers and certificates not kept"; "This run's timeline".
    - **Kept** — "🏆 deeds and every Legacy row bought"; one row per owned keep: "Seed vault — every crop license",
      "Kept certificates — plant, water, harvest", "Kept Clerk — the Clerk certificate", "Kept certificates II — ore,
      fuel, mine", "Kept Noticeboard — the order board", "Miner's start — mine license + copper pickaxe", "Kept Manager —
      the Manager certificate", "Apprentices — workers earn +2 renown"; "The ⭐-bought order slots ({slots})";
      "Lifetime totals — the deed meter keeps counting"; "Renown — every crop's points".
    The Next farm listings and the reroll (36.1) stay as they are.
  - Sims and pins: sims run only inside `pnpm test`. Moved sim pins are expected ONLY in `tests/sim/prestige-crops.test.ts`
    (run-2 / vault-run speed-ups :134–165, :170–183, :326–345, harvester3 hours :197–199, :341–343, the v17 save
    :209–217; causes: renown carried, start seeds, T2+ grow), `tests/sim/mine-estate.test.ts` (PIN31worker hours
    :500–521, the T2/T3 grow bonus; :523–545 carry), `tests/sim/fields.test.ts:716` (the top tier is now 30,000 / floor
    0.75), and any long-run ladder pin where a crop passes 1,000 renown at home. Re-pin each old → new with its cause.
    Correctness guards are BLOCKERS and are never re-pinned: `stallTicks` 0, every ladder rung defined (`plots30`,
    `fields`), `lowest ≥ 0`, `borrowed` false, mining < 0.9 × farming cash per ⚡, PIN31model ≥ 0.99, the DP pins ≥
    0.999, PIN22d < 2,000 ms, no negative cash or stock. PIN36h in `tests/sim/districts.test.ts` stays `it.fails` as it
    is. While developing run only the describe you touch (`npx vitest run tests/sim/<file>.test.ts -t "<describe>"`).
  - PIN36w (report, in `tests/save.test.ts` next to the v34 fixture pin): the migrated v34 fixture (Toon's own
    12-chilli estate, chilli 18,811 = 🏅): its chilli `cropFloor` with share 1 (0.70) and with its 12 chips (`0.5 + 0.2 ×
    4/12` ≈ 0.567), and 2 game-hours of `step` cash gained on that save vs the same save with every field chip but 4
    cleared (shows the rule's cost on a mono estate, prestige-layers :175); `console.log('PIN36w', …)`; assert only no
    negative cash and both runs > 0. A report for Toon, not a gate; give it a 60 s timeout.
  - jsdom tests: `tests/Legacy.test.tsx` (chip in both states and its tap calls openBank; the 5 new rows' names, tips
    and prices; "Apprentices" for a `keepRenown` owner; the three columns' exact rows for a fixture run with ⭐450,
    chilli 18,811, lemon 300, Seed vault + Kept Clerk owned — rewrite :84–135, including the batch-31 Kept renown pin
    :130), `tests/Estate.test.tsx` (renown badge on a chilli chip at 250, none at 249; the sheet line string for chilli
    4,000 on 6 chips), a Farm / Shop test for the badge + title.
  - CHANGELOG (`src/app/changelog.ts`): ONE entry at the TOP of `CHANGELOG`, verbatim, one line (174 code points):
    `{ batch: '36.6', date: '<today, YYYY-MM-DD>', line: "🏅 Renown now carries over a sale and climbs 5 tiers 🥉🥈🥇🏅🏆 (higher tiers grow faster, covering 4 fields per crop). 5 new Legacy keeps; Fast crops and Rich harvest go to Lv 10." },`
  - Write `## Batch 36.6 results` + `### Deviations` at the TRUE END of docs/PLAN.md: test totals before → after, one
    line per task, the PIN36t–w numbers, every moved sim pin old → new with its cause, the v34 fixture's v35 check,
    every new UI string, and what jsdom could not show (the wrap at 375, the chip placement, the red "lost" row); tick
    234–238.

Scenarios: (A) fresh — nothing changes before the first sale except the badges, the T2+ grow bonus at home and the
chip; run 2 starts with its renown, a 6-seed radish kit (radish 🥉 comes in the first session) and whatever keeps were
bought (8 gate deeds → e.g. Kept Clerk 6 + Bigger start Lv1 2). (B) veteran — Toon's save (never sold; the v34
fixture): the migration leaves renown alone (renown = harvests already); chilli 18,811 → 🏅 (floor 0.70, grow −15 % at
home), strawberry 11,184 → 🥇; his 12 chilli fields share the bonus 4/12 (floor 0.70 → ≈0.567, estate grow −5 %) —
PIN36w measures it. A pre-36.6 seller gets the max(renown, harvests) re-seed. A `keepRenown` owner sees "Apprentices",
level kept.

Out of scope: the charter card (batch 37), almanac tiers, a stoker or sprinkler-bed keep row, renown from Estate reaps
(stays home-only), any ⭐ price, re-timing the tier table on the 10-crop ladder, the labour-cap re-measure, the 🌰
Ancient fruit button missing from the phone / tablet Shop seeds list (open for Toon), the 36.2 nits, the 375 top-bar
wrap, PIN36h.

## Batch 36.6 results

Tests: 1,313 passed + 8 expected fail (1,321) → 1,340 passed + 8 expected fail (1,348). The 8 expected fails are
unchanged (PIN36h and the older `it.fails`). Lint clean, `pnpm build` clean, `tsc -b --force` clean, purity grep clean
(only the known `src/save/storage.ts:26` wallClock line), no case-duplicate file names.

Commits (one per task, main, not pushed): 234 `297b6efd`, 235 `d1d0043b`, 236 `2360c781`, 237 `afc6b9f4`, 238 (this
commit).

- 234: `MetaUpgradeId` / `META_UPGRADE_KEYS` / `DEED_ROW_IDS` gain keepClerk, keepCertificates2, mineStart, keepBoard,
  keepManager (max 1; one-time 6 / 8 / 4 / 4 / 24). `SAVE_VERSION` 35, frozen `MetaV34`, and `migrateV34`: the 5 keys at
  0 plus the renown re-seed max(renown, lifetime home harvests) over `CROP_IDS`. It is chained after every older version:
  `migrate()` → `toV34()` (the old switch) → `migrateV34`.
- 235: 5 renown tiers with floors .55 / .6 / .7 / .7 / .75. Grow factor RENOWN_GROW goes inside `cropGrowTicks`'
  rounding; rot grace stays unboosted. Home callers pass the full factor via `cropRenownGrow`, and bot.ts:150 mirrors
  it. The sale keeps every crop's points with no deed needed. Apprentices: a worker harvest or tree pick earns +2.
  `createFreshRun` gives a start-seed kit to each licensed crop at tier ≥ 1.
- 236: `cropFieldCount` (chip-based) and `cropFloor(run, crop, fields)` share the renown floor over more than 4 chips.
  Estate grow is shared through `pressuredCycle` / `fieldsMarginalIncomePerHour` / `estateText`, and bot.ts forgePlots
  mirrors it. `fieldsCropIncomeCurve(state, crop, breadth = true)` values each T on its own field count.
- 237: growTime / sellPrice max 10 (Lv 6–10 cost 64 … 1,024). The sale keeps certificates in WORKER_JOBS order per
  keep row. Kept Noticeboard opens the board through the new `openBoard` (`buyOrderBoard` uses it). Miner's start gives
  the licence and a selected copper pickaxe, except on a Wetlands listing.
- 238: the 🏆 `LegacyChip` (top of 🌾 Farm; top of 🛒 Shop with no Farm tab; tap → 🏦 Bank via `PanelProps.openBank`,
  plus `nextDeedCash`). Renown badges and titles on "Crop to plant", the Shop seeds (both branches), the Seed pouch, the
  Estate chip (`.map-badge-renown`, bottom-right corner) and the Stats renown row. The FieldSheet renown line
  (`renownSheetLine`). The Legacy names / tips / effects. The Gain / Lost / Kept sale preview (`.sell-cols`). PIN36w.
  The CHANGELOG 36.6 line (174 code points).

Pins:
- PIN36t (tests/renown.test.ts, tree.test.ts): tier / floor / next / badge / grow at 0, 249, 250, 999, 1,000, 3,999,
  4,000, 11,999, 12,000, 29,999, 30,000 and 99,999, as specified.
  - `cropGrowTicks('strawberry', meta, 0, null, 0.8) = round(base × 0.8)`.
  - At renown 1,000 a home strawberry matures at round(base × 0.95): stepTile, `harvest` and `isMature` agree. Rot
    grace is 2 × base, unboosted.
  - The sale keeps `{ lemon: 1000, pumpkin: 100 }` with no deed.
  - Apprentices: worker +2 with the row, +1 without; a tap is +2 either way, the tree included.
  - Start seeds: potato 6 at 250, 24 at 12,000, 0 at 249. Lemon 4,000 gets 6 only with the Seed vault.
- PIN36u (tests/sim/mine-estate.test.ts, next to PIN31model, 20 managed fields at the estate stage):
  - (a) breadth off, chilli 30,000 → chilli×20 on plain AND on berry-fast / fruit-veg-slow.
  - (b) share on, same state, berry-fast → **strawberry×16 chilli×4** (Hermes's estimate exactly).
  - (c) every crop 30,000, plain → **chilli×13 strawberry×4 grape×3** (Hermes estimated 16 + 4).
  - (d) `managerPlan` / exhaustive = 1.0 at n = 2 / 6 / 10 for both. Its 20-field plans match: b20 "strawberry×16
    chilli×4", c20 "grape×3 strawberry×4 chilli×13".
  - (b) and (c) both PASS; no `it.fails`.
- PIN36u renown.test: `cropFloor` for chilli 30,000 on 0 / 4 / 5 / 8 / 20 chips = 0.75 / 0.75 / 0.7 / 0.625 / 0.55, and
  0.75 with the Fields locked. `pressuredCycle` on 4 vs 8 chips = ceil(round(g × 0.8) / 2) vs ceil(round(g × 0.9) / 2).
  A home chilli keeps 0.8 with 20 chips. manager.test's 0.999 DP pin also holds with chilli 30,000 and with every crop
  at 12,000.
- PIN36v (tests/prestige.test.ts): each keep carries on its own (clerk; ore / fuel / mine; manager — certificates only,
  no worker). The board is open at tick 0 with `slots` offers equal to `openBoard` / `buyOrderBoard`'s roll on the same
  rngState. Miner's start gives the licence and a selected copper pickaxe, and nothing on a Wetlands listing. All five
  rows together work. Lv 6–10 cost 64 / 128 / 256 / 512 / 1,024 on both rows, max 10; one-time prices are 6 / 8 / 4 / 4
  / 24; `legacyMaxed` needs Lv 10.
- PIN36w (report): Toon's migrated v34 save, chilli 18,811 🏅 on 12 chips. The chilli floor is 0.70 with share 1 and
  0.5667 on its 12 chips. 2 game-hours of `step` cash: 💰20,519,038 with its 12 chilli chips vs 💰20,051,853 with every
  chip but 4 cleared. No negative cash.
- Correctness guards all held: stallTicks 0, ladder rungs defined, lowest ≥ 0, borrowed false, mining < 0.9 × farming.
  PIN31model ratios are all 1.0 and the DP pins ≥ 0.999. PIN22d took 655 ms. PIN31worker: strawberry 🥇 4,000 at
  21.9 h (≤ 48 h). Its title now names 🥇 4,000 instead of "the top tier"; the target is unchanged.
- tests/fields.test.ts:716 (PIN36d) needed no re-pin. It reads the top tier as `RENOWN_TIERS[length − 1]`, so it now
  runs at chilli 30,000 / floor 0.75, and its ≥ 0.7 district ratios hold.

Migrated fixture: `tests/fixtures/save-v34.json` → v35. `meta.upgrades` gains exactly the 5 zero keys. `run.renown` is
unchanged (radish 1,310, chilli 18,811, pumpkin 657, lemon 2,100, tomato 866, corn 326, strawberry 11,184, grape 1,695
= its lifetime harvests), and everything else is deep-equal. A hand-built pre-36.6 seller (renown `{ lemon: 1000 }`,
harvests `{ lemon: 2416, pumpkin: 300, radish: 0 }`) migrates to `{ lemon: 2416, pumpkin: 300 }`. Every fixture v1 … v34
reaches v35.

Moved pins, old → new with cause. Re-pinned in the task that moved them; each arrow names its task:
- prestige-crops PIN20 run1 / run3 Fields speed-up: 1.66 → 1.56 (234, deed buy order: the new keeps soak up deeds) →
  1.48 (235, renown carried + start seeds + T2+ grow) → 1.65 (236, Estate grow / 4-field share) → **1.69** (237, the
  keeps act).
- PIN20 run1 / run2: 1.37 → 1.24 (234) → **1.42** (236).
- PIN34carry: ≥ 1.35 was lowered to ≥ 1.24 with the tick budget widened to run 1's Fields time in 234 (the capped run
  missed the Fields and read NaN). Both were restored in 237: measured **1.42**, original budget and floor.
- PIN28_1b harvester3: [105.1, 100.1] → [116.9, 115.5] (234) → [122.4, 121.3] (235) → [124.1, 123.4] (236) →
  **[124.1, 123.1]** (237).
- PIN28_1c harvester3: [108.1, 72.6] → [108.1, 81.6] (234) → [105.5, 73.4] (235) → [105.5, 74.8] (236) →
  **[105.5, 74.3]** (237).
- fields batch 18:
  - lemon income: [42249, 82167 ×4] → [45123, 82704 ×4] (235) → **[48091, 83180 ×4]** (236).
  - mix: [77476, 65169] → [76881, 66160] (235) → **[77304, 66926]** (236).
  - PIN18c payback crossing: 10 → **12** (236).
  - coal: [974, 11] → [984, 11] (235) → **[986, 11]** (236).
- fields batch 19:
  - curve: [80,210] [80,598] [80,756] → [82,232] [82,652] [82,816] (235) → **[81,285] [81,649] [81,599]** (236, the
    1,000-tile arm is 20 fields of one crop, so it shares its renown 4/20).
  - paybacks: 0.4 / null / null / 0.8 → 0.3 / 1004 / null / 0.7 (235) → **0.4 / null / null / 0.7** (236).
- market-orders carrot9: harvests/h 320 → 323, income 3861 → 3890, off 3542 → 3567, bonus 9 → 9.1 (235: carrot passes
  🥈 in the window).
- mine-estate PIN311b (the v22 save): 10th contract at minute 330 → 367 (235) → **439** (236). Manager buyable at
  371 → 370 (235) → **439** (236). ⭐ ≥ 160 holds.
- tools-workshop (235):
  - pumpkin gold 29.153 → 29.08; batch-16 finalCash 84717 → 84467.
  - incomeAfter 28612 → 29573; batch-17 finalCash 545928 → 564749.
  - PIN26d coal [482, 7] → [473, 7].
- save.test scenario B (the v27 save): tank [182.5, 399.4] → 399.5 (235) → **399.2** (236). Storage-full ticks 1125 →
  1195 (235) → **1105** (236).
- Unit text pins:
  - stats Lemon 4,000: "top tier" → "next 12000" (235), then the badge in front (238).
  - Estate v26 chip "🎃F2⛲" → "🎃F2⛲🥉" (238).
  - mine-estate "sold without Kept renown → {}" → carries (235).
  - renown.test's 2,000-tile income pin now reads the pre-36.6 rule (breadth false) and checks the 🥉 step (235–236).

New UI strings:
- Chip: "🏆 {deeds} · sale +{n}" / "🏆 next deed at 💰{X} lifetime".
- Badges 🥉 🥈 🥇 🏅 🏆. Titles "{Name} {badge} {pts} / {next}", "{Name} {badge} {pts} · top tier", "{Name} {pts} /
  250".
- Sheet: "{badge} {Name} covers {k} of {n} fields · floor {p} %[ · grow −{x} %]".
- Legacy names "Apprentices", "Kept Clerk", "Kept certificates II", "Miner's start", "Kept Noticeboard", "Kept
  Manager", with their tips and effects as in task 238.
- Preview Gain: "+{n} deeds", "⭐{n} carried", "{badge} {Name} {pts}", "Renown: none yet", "Start seeds: {n} {emoji} …".
- Preview Lost: "⭐{n} above 400 — spend or reroll listings first", "Every ⭐ Favour level", "Tiles, cash, market,
  storage, tools", "Mine, furnace, workshop, fields, machines", "Licenses, workers and certificates not kept", "This
  run's timeline".
- Preview Kept: "🏆 deeds and every Legacy row bought", "{keep} — {what}" ×8, "The ⭐-bought order slots ({n})",
  "Lifetime totals — the deed meter keeps counting", "Renown — every crop's points".
- Stats: "{badge} {pts} · floor …".

### Deviations

- **Starting crop is 🥔 potato, not radish** (batch 35). PIN36t's no-vault start-seed pins are therefore written on
  potato (6 at 250, 24 at 12,000, 0 at 249), and radish gets its kit only with the Seed vault. Scenario A's "6-seed
  radish kit" is a potato kit in the shipped game.
- **A sixth sim cause: the 4-field share itself.** Task 236's shared floor and Estate grow move sim pins too. That
  cause is not in the named list (T2+ grow, carry, start seeds, buy order), but it is this batch's own rule. The largest
  moves:
  - the batch-19 1,000-tile machines arm, 816k → 599k/h;
  - PIN311b's 10th contract, minute 367 → 439.
  No correctness guard moved.
- **Re-pins per task, not all in 238.** Each task's commit had to pass `pnpm test`, so every pin was re-pinned in the
  task that moved it. The chains above give the per-task cause.
- **Task 234 shipped the five rows' final names, tips and effect lines.** `Record<DeedRowId, …>` must be complete for
  tsc. The rows did nothing until 237 and were never shipped in between. "Kept renown" → "Apprentices" landed in 238.
- **`migrate()` structure.** It became `migrate` (shape check, v35 pass-through) → `toV34` (the old switch, unchanged)
  → `migrateV34`. This is equivalent to wrapping every branch in `migrateV34(…)`.
- **PIN36w reads as total estate cash, not the rule's pure cost.** Clearing 8 chips also stops 8 fields producing, so
  the 4-chip save earns less (−2.3 %). The pure cost of the share (the same 12 chips with breadth off vs on) would need
  a rule toggle in `step`. No such toggle exists, and none was added.
- **PIN36u (c)** is 13 chilli + 4 strawberry + 3 grape, not Hermes's 16 + 4. It still passes the ≥ 2-crop guard.
- **The renown sheet line sits directly above the 🧭 soil line** in the FieldSheet, after the ≈💰/h line.
- **The 🛒 Shop chip renders only when `openBank` is passed** (the Panel always passes it; direct test renders of
  `<Shop>` do not).
- **The "Selling gives +N deeds (💰N)" line above Next farm is kept**, so the Gain column repeats "+N deeds".
- **Not verified (no browser; jsdom only).** Hermes's live sweep at 375 / 1024 / 1440 / 2560 / 3440 should check:
  - the `.sell-cols` wrap (one column at 375, three from ~600 px) and the three columns' layout;
  - the red `.lost` row's colour;
  - the 🏆 chip's placement and its 44 px height on the Farm tab and the Shop panel;
  - whether a phone tap on the chip shows the 🏦 Bank panel (`setTab('bank')` only, like the tab bar);
  - the `.map-badge-renown` bottom-right corner against the plot bar and the "F1" label;
  - the badge spacing in the Seed pouch's item grid.
