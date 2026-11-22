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
for batches 1–36.4, plus the big-farm roadmap. Lines 1–7436 of that file are the old `docs/PLAN.md` line for line, so a
`PLAN.md:N` citation from before 2026-11-14 points at the same line there. References like PLAN.md "Batch 24 results"
in tests and `docs/DECISIONS.md` resolve there too.

The archive is append-only and large (7,400+ lines, ~680 KB). Never read it whole: read only the line range a brief
cites, or `grep -n '^## Batch N'` and read that range.

## Active batches
New batch plans are appended below, and workers write `## Batch N results` + `### Deviations` at the end of this file.
After a batch is pushed, Hermes moves its plan and results to the end of the archive.

## Batch 36.5 — 🧭 Soil survey: a soil trait per home bed and per Estate field, ⭐ rerolls (tasks 229–233, save v33 → v34)

Why: listings (36.1) and districts (36.2) roll the farm you buy; the survey rolls the ground you own, and rerolls it.
A capped ⭐ ladder in ⭐ Favours: Lv1 ⭐80 gives each of the 4 home beds a trait, Lv2 ⭐200 each Estate field, Lv3 ⭐320
makes every trait 1.5× stronger. Two pools (home per BED = the 6 tiles of one sprinkler socket; Estate per FIELD = the
Manager's chip unit). Every trait is kept as decided, the near-zero ones included (a weak trait is a choice: reroll
it). Playtest question: do soil traits change where I plant?
Hard guards (DECISIONS batch 24 stance): no soft lock, no stall, no infinite cash loop, nothing negative, saves
migrate, nothing taken away.
Anchors below are commit 5f97e77 (origin/main after batch 36.4), SAVE_VERSION 33. Re-measure with `grep -n` before
editing. Every new number lives in `src/core/balance.ts`; numbers marked (est.) are Hermes picks (DECISIONS "Batch 36.5
refined"), the rest are Toon's accepted values.

Scope fence: with survey level 0 (every save, every fresh run, every sim bot — no bot buys the survey) the game plays
byte-identically. Every new parameter is OPTIONAL with a default that reproduces today. No sim file may move: a moved
number in any `tests/sim/*` file is a bug in your change, not a re-pin.

Words: the Sell card already has a listing "soil" (grow speed per crop group, 36.1) and "reroll" means the order
reroll or the listing reroll. In the UI this batch always says "soil trait" and "Reroll this bed's / field's soil".

## Tasks (229–233)

- [x] 229. **Save v34 and the new shape (no mechanic yet).** Commit this task FIRST.
  - New `src/core/data/soil.ts` (identity only): `HOME_TRAITS = ['roots', 'fruitVeg', 'berry', 'clay', 'loose',
    'rich', 'fertile'] as const`, `FIELD_TRAITS = ['rootsPrice', 'fruitVegPrice', 'berryPrice', 'creek', 'dense',
    'contract', 'easySell', 'fertile'] as const`, types `HomeTraitId`, `FieldTraitId`, `SoilTraitId = HomeTraitId |
    FieldTraitId`, `SURVEY_EMOJI = '🧭'` and `SOIL_TRAITS: Record<SoilTraitId, { emoji: string; name: string }>`:
    roots 🥔 'Root soil', fruitVeg 🍅 'Veg soil', berry 🍓 'Berry soil', clay 🧱 'Clay', loose 🍂 'Loose soil', rich 💎
    'Rich soil', fertile 🌻 'Fertile soil', rootsPrice 🥔 'Root soil', fruitVegPrice 🍅 'Veg soil', berryPrice 🍓 'Berry
    soil', creek 💦 'Creek', dense 🌑 'Dense soil', contract 📜 'Contract land', easySell 🤝 'Easy market' (all Unicode
    ≤ 11; 🧭 11.0, 🤝 9.0, the rest 6.0). The group of a price trait: roots/rootsPrice → `roots`, fruitVeg/fruitVegPrice
    → `fruitVeg`, berry/berryPrice → `berry` (`GroupId`, `src/core/data/crops.ts:27–36`).
  - `RunState` (`src/core/state.ts:26–110`) gains, after `energyReserve` (`:109`), `survey: Survey` with
    `export type Survey = { level: number; beds: { trait: HomeTraitId | null; rerolls: number }[]; fields: { trait:
    FieldTraitId | null; rerolls: number }[] }`. `level` 0–3 (⭐ levels bought this run). `beds` always has 4 entries
    (bed k = tiles 6k…6k+5; 4 = `sprinklerMax()`, `balance.ts:349–351`). `fields[k]` belongs to `fields.list[k]` and
    EXISTS ONLY ONCE ROLLED: read it with a helper that treats a missing entry as `{ trait: null, rerolls: 0 }` (it is
    shorter than `fields.list` before Lv2). `createFreshRun` (`:301–351`, after `energyReserve: 0` `:349`): `survey: {
    level: 0, beds: 4 × { trait: null, rerolls: 0 }, fields: [] }`. A sale starts a fresh run, so level, traits and
    reroll counts reset with every ⭐ purchase (`src/core/prestige.ts:69` `createFreshRun`, nothing to carry).
  - Save (`src/save/serialize.ts`): `SAVE_VERSION` 33 → 34 (`:38`). Add `'survey'` to the `Omit<RunState, …>` lists of
    `RunV32` (`:48`) and `RunV30` (`:293`). New frozen `RunV33 = Omit<RunState, 'survey'>`; `SaveV33` (`:304`) becomes `{
    version: 33; savedAtMs: number; state: { meta: MetaState; run: RunV33 } }`; new `SaveV34 = { version: 34; savedAtMs:
    number; state: GameState }`, `Save = SaveV34` (`:305`). `migrateV33(save: SaveV33): SaveV34` after `migrateV32`
    (`:889–908`, same comment convention): adds `survey` at the fresh default above — nothing granted, refunded or
    removed; a veteran buys Lv1 / Lv2 like anyone. `migrate()` (`:913–931`): `version === 34` returns as is, `33` →
    `migrateV33(...)`, and every older branch (`:917–930`, incl. the `toV20` tail) wraps its chain in `migrateV33(...)`.
  - Fixture `tests/fixtures/save-v33.json` is ALREADY committed with this plan: a real live v33 save (the committed
    save-v32.json seeded on the old live v32 build, loaded by the live v33 build CcIYSqqF on 2026-11-22 21:22, migrated
    and re-saved by the live code; plain listing, ⭐79, 24 tiles all 4 beds sprinklered, 10 licences, 12 pivoted fields
    all chilli, Manager 1, pump 3, digs 23, no finds / relics). Never edit any file in tests/fixtures.
    `tests/save.test.ts`: import save-v33 next to v32 (`:34`); new `asV33Run` strips `survey` (expects the fresh
    default) and `asV32Run` (`:165–175`) calls it first; new describe 'save v34: the soil survey (batch 36.5)': v33 →
    v34 adds exactly `run.survey` at its default (no other run / meta / top-level key added or removed, every old key
    deep-equal) and stamps 34; every fixture save-v1 … save-v33 lands on 34. Update every "33" pin to 34:
    `save.test.ts:286`, `:560` title "v21 … v34", `:562`, `:1102`, `:1691`, `:1700`, `:1719`, `:1724`, `:1736`, `:1746`,
    `:1747`, and App.test "Will migrate v15 → v34" (`tests/App.test.tsx:489`).
  - Grep `src/` and `tests/` for every `RunState` literal and `createFreshRun` / `SaveV33` user; CI `tsc -b` fails on a
    stale one.
- [x] 230. **The ladder, the rolls, the rerolls (core).** New `src/core/survey.ts`; numbers in `balance.ts` (new block
  after the listing block `:668–687`):
  - `SURVEY_STARS = [80, 200, 320]` (Lv1 home beds, Lv2 fields, Lv3 strength; ×8 of the accepted ⭐10 / 25 / 40),
    `SURVEY_FIELDS_LEVEL = 2`, `SURVEY_STRONG_LEVEL = 3`, `SOIL_REROLL_BASE = 16`, `SOIL_REROLL_GROWTH = 1.5` and
    `soilRerollStars(n) = Math.round(16 × 1.5 ** n)` → 16, 24, 36, 54, 81, 122 … (n = that bed's / field's rerolls so
    far; est., ×8 of the earlier ⭐2 curve).
  - ⭐ Favours row `soilSurvey` (`src/core/favours.ts`): add `'soilSurvey'` LAST to `FAVOUR_IDS` (`:13`).
    `favourLevel` (`:17–34`) = `run.survey.level`. `favourLock` (`:47–70`): new `FavourLock` `'fields'` = level 1 and
    `!run.fields.unlocked`, else null (Lv1 and Lv3 have no gate). `favourPrice` (`:73–77`): `{ cash: 0, stars:
    SURVEY_STARS[level] }`, null at level 3 (do NOT add it to the `FAVOURS` table `balance.ts:266–273`: its prices are
    not geometric). `favourGain` (`:80–98`) returns `{ survey, rngState }`: level 0 → 1 rolls a trait for each of the 4
    beds (bed order); 1 → 2 rolls a trait for each field in `fields.list` (field order; `fields` becomes exactly
    `list.length` long); 2 → 3 rolls nothing (rngState unchanged). `buyFavour` keeps its order (LOCKED, MAX_LEVEL,
    then pay's NO_STARS). `favoursVisible` (`:42–44`) picks it up through `FAVOUR_IDS`.
  - Rolls use the run's seeded PRNG (`nextRandom(run.rngState)`, never Math.random). Home: one draw, `HOME_TRAITS[
    Math.floor(r × 7)]` (uniform over 7, est.). Field: one draw over 6 entries in this order: group price, creek,
    dense, contract, easySell, fertile (`Math.floor(r × 6)`); group price takes a SECOND draw `GROUP_IDS[Math.floor(r2 ×
    3)]` → `rootsPrice` / `fruitVegPrice` / `berryPrice` (uniform; a berry price field is 1 in 18, est.).
  - A field opened later: `buyPlot` (`src/core/fields.ts:143–156`) — when the plot opens a NEW field (`at < 0`) and
    `run.survey.level >= 2`, roll that field's trait at purchase and append it to `survey.fields` (rngState advances).
    At level < 2 `buyPlot` is unchanged.
  - `rerollSoil(state, where: 'bed' | 'field', k)`: order LOCKED (bed: level < 1; field: level < 2), BAD_TILE (bed k
    outside 0–3; field k outside `fields.list` or not rolled), then `pay(state, { cash: 0, stars: soilRerollStars(n)
    }, …)` (NO_STARS). A reroll is a fresh uniform roll of that unit's pool (it may land on the same trait, est.), its
    `rerolls` +1. Counters are per unit and reset only with the run (the sale).
  - Read helpers (exported from `survey.ts`, used by task 231 and the UI): `bedTrait(run, bed)`, `fieldTrait(run, k)`
    (null when level is too low or the entry is missing), `soilStrong(run)` = level ≥ 3.
- [x] 231. **Trait effects (core) — each one its own multiplicative factor, default = today.** Lv1 value / Lv3 value
  (Lv3 multiplies each trait's DELTA by 1.5). All in `balance.ts` as `[lv1, lv3]` pairs; a tick-rule is `[n, d]` =
  "on n of every d ticks" via `everyNth(tick, [n, d]) = Math.floor(((tick + 1) × n) / d) > Math.floor((tick × n) /
  d)` (integer arithmetic; `everyNth(t, [1, 2])` is exactly `t % 2 === 1`).
  | Trait | Where | Lv1 / Lv3 | Hook |
  |---|---|---|---|
  | roots / fruitVeg / berry | home bed | that group's crops sell ×1.15 / ×1.225 (`SOIL_HOME_PRICE`) | market units of a harvest from that bed, incl. its 🌳 tree tiles |
  | clay | home bed | moisture drain ×0.6 / ×0.4 (`SOIL_CLAY_DRAIN`) | `stepTile` drain (`src/core/step.ts:48`) |
  | loose | home bed | rot grace ×2 / ×2.5 (`SOIL_LOOSE_ROT`) | `stepTile` rot check (`step.ts:42`) |
  | rich | home bed | double-harvest chance +0.10 / +0.15 (`SOIL_RICH_DOUBLE`) | `harvest` (`src/core/actions.ts:246`) |
  | fertile | home bed | grow time ×0.9 / ×0.85: +1 extra growth on [1, 9] / [3, 17] of the ticks it grows (`SOIL_FERTILE_EXTRA`) | `stepTile` growth (`step.ts:37–38`) |
  | rootsPrice / fruitVegPrice / berryPrice | field | that group's crops sell ×1.2 / ×1.3 (`SOIL_FIELD_PRICE`) | market units of a reap from that field |
  | creek | field | unpaid (empty tank or no pivot) it still grows ×1.3 / ×1.45: its readyTick slips on [7, 20] / [11, 40] of the ticks instead of [1, 2] (`SOIL_CREEK_SLIP`) | `fieldsAct` (`src/core/fields.ts:427–435`) |
  | dense | field | tank coal ×0.7 / ×0.55: its plots burn on [7, 10] / [11, 20] of the ticks (`SOIL_DENSE_BURN`) | `burningPlots` (`fields.ts:401–406`) |
  | contract | field | each unit counts ×1.5 / ×1.75 toward an accepted crop order (`SOIL_CONTRACT_COUNT`); the order's ⭐ unchanged | `harvestSale` order loop |
  | easySell | field | each unit sold adds ×0.7 / ×0.55 glut (`SOIL_EASY_GLUT`) | `cropSale` |
  | fertile | field | pressured cycle ×0.9 / ×0.85 (`SOIL_FERTILE_GROW`) | `sowPlot` readyTick (`fields.ts:258`) |
  - Home (`src/core/step.ts`): `stepTile` (`:33–51`) gains the tile's bed trait and the tick (call `:81`, bed =
    `Math.floor(i / 6)`; a bed index ≥ 4 has no trait). fertile: when the tile grows this tick (`:38`), growth +1 and +1
    more when `everyNth(tick, extra)` — `isMature` / `growthProgress` (`src/core/tile.ts:13–26`) stay index-free and
    exact. loose: rot when `ticksSinceMature > cropRotGraceTicks(…) × rot`. clay: `drained = moisture −
    moistureDrainPerTick(meta) × drain`. `ticksUntilRot(tile, s, i?)` (`tile.ts:29–32`) gains an optional index: with
    it, `Math.floor(grace × rot(bed)) − ticksSinceMature + 1`; without it today's value (tests `tile.test.ts:42–44`,
    `listings.test.ts:166` unchanged). `FarmGrid` `Cell` (`src/app/FarmGrid.tsx:54–66`) passes its index (new `i`
    prop from `:163`).
  - rich (`actions.ts:246`): chance = `doubleHarvestChance(tier)` + rich; roll when `tier > 0 || rich > 0` (a tier-0
    tile on a plain bed still rolls nothing — `tierRoll` `:155–159` keeps today's sequence). The seed roll (`:248`)
    is unchanged.
  - Sales: `export type SaleSoil = { price: number; glut: number; order: number }`, `PLAIN_SALE = { price: 1, glut: 1,
    order: 1 }` in `src/core/market.ts`. `marketCropPrice(state, cropId, glut, price = 1)` (`:12–14`) = `Math.round(
    cropSellPrice(…) × price × marketFactor(…))`. `cropSale(state, cropId, units, bonus = 1, soil = PLAIN_SALE)`
    (`:20–25`): unit i priced at `glut + i × soil.glut` with `soil.price`; market glut `+ units × soil.glut`.
    `harvestSale(state, crop, units, bonus = 1, marketBonus = bonus, soil = PLAIN_SALE)` (`src/core/orders.ts:165–185`):
    per open accepted order `need = count − done`, `n = Math.min(left, Math.ceil(need / soil.order))`, cash `n ×
    cropOrderPrice(…)` (the GLOBAL price: survey price traits lift market units only), `fillOrder(s, slot,
    Math.min(need, Math.floor(n × soil.order + 1e-9)))`, `left −= n`; the rest → `cropSale(s, crop, left, marketBonus,
    soil)`. With `PLAIN_SALE` every line equals today. Callers: home `harvest` (`actions.ts:263`) passes `{ price: bed
    price factor if the crop is in the trait's group else 1, glut: 1, order: 1 }`; `harvestTreeTile`
    (`src/core/tree.ts:70`) the same for `tree.bed`; `reapAt` (`fields.ts:323`) the field's `{ price, glut, order }` —
    write both branches with explicit bonuses (`harvestSale(rolled, crop, units, handPickedBonus(), 1, soil)` /
    `harvestSale(rolled, crop, units, 1, 1, soil)`). Glut factor and floor (`marketFactor`, `cropFloor`
    `market.ts:8–9`) are untouched.
  - Fields: `pressuredCycle(state, crop, grow = 1)` (`fields.ts:69–71`) = `Math.ceil(cropGrowTicks(…) × grow /
    FIELD_PRESSURE)`; only `sowPlot` (`:258`) passes the field's fertile factor. `burningPlots` (`:401–406`): a dense
    field's plot counts only on `everyNth(run.tick, dense)` ticks. `fieldsAct` (`:419–438`): a creek field slips on
    `everyNth(run.tick, creek)` ticks, every other field keeps `run.tick % 2 === 1`; keep the "same state when nothing
    burns and nothing slows" return, and keep the even-tick fast path when no field has a creek trait.
  - Manager (`src/core/manager.ts:76–93`): the DP counts stay as they are (traits are not in the DP). Then, BEFORE the
    "keeps its chip" loop `:80–87`, a soil match pass over `free` in field order: a field with a group price trait
    keeps its current chip when that crop is in its group and still has count > 0, else takes the highest crop of its
    group in `CROP_IDS` order with count > 0 (count −1, `restOf(c).fields`, `target[k]`); matched fields leave the pool
    the next two loops walk. No group crop counted → the field falls through unchanged. 📌 pinned fields and the
    contract fields (taken earlier, `:35–43`) are never touched.
  - Not traits: listing soil (36.1 grow axis) and district berry ×1.4 (36.2) stay their own factors; survey price
    traits are the sell axis. Orders, the order count (`orderPerMinute`), the Manager's DP income curves, the payback
    label and `estateText` estimates ignore traits (est.).
- [x] 232. **UI.**
  - ⭐ Favours row (`src/app/Favours.tsx`): `ROWS.soilSurvey = { emoji: SURVEY_EMOJI, name: 'Soil survey' }` (`:24–32`,
    shows "🧭 Soil survey Lv N"); `lockText('fields')` = `'needs the 🚜 Fields'` (`:43–67`); `effectText` (`:70–89`):
    level 0 `'a trait for each home bed'`, 1 `'a trait for each field'`, 2 `'every trait ×1.5'`. `FAVOUR_TIPS.soilSurvey`
    (`src/app/tips.ts:101–109`): `'Level 1 gives each home bed a soil trait, level 2 each field, level 3 makes every
    trait 1.5× stronger. Reroll any one for ⭐. Traits last until you sell the farm.'`
  - Soil list: under the Favours rows (`Favours.tsx:111–123`), while `survey.level ≥ 1`, a `<details
    className="soil-traits">` (closed by default) with `<summary>🧭 Soil traits · 4 beds · {rolled} fields</summary>`
    and one `.soil-row` per bed (`Bed {k+1}`) and per rolled field (`Field {k+1}`): `{emoji} {name}` + `<small>` the
    text, and a button `Reroll ⭐{soilRerollStars(n)}` (`aria-label` "Reroll bed 2's soil" / "Reroll field 3's soil"),
    disabled while `rerollSoil` fails. Row ≥ 44 px, button ≥ 44 px tall.
  - Texts (new `src/app/soilText.ts`, `soilTraitText(id, strong)`, numbers from the balance pairs, one decimal only
    when needed): price `'{group name} crops sell +15 %'` (+22.5 / +20 / +30), clay `'drains 40 % slower'` (60), loose
    `'ripe crops wait ×2 before rotting'` (×2.5), rich `'+10 % double harvest'` (+15), fertile `'grows 10 % faster'`
    (15), creek `'grows ×1.3 with an empty tank'` (×1.45), dense `'burns 30 % less tank coal'` (45), contract `'each crop
    counts ×1.5 toward a contract'` (×1.75), easySell `'gluts the market 30 % less'` (45). Group names from
    `GROUP_NAMES` (`data/crops.ts:38`).
  - Home bed chip (`FarmGrid.tsx:141–152`): a rolled bed shows `<span className="bed-soil" role="img"
    aria-label="Bed {k+1} soil: {name}" title="{name} — {text}">{emoji}</span>`. CSS (`app.css`, next to
    `.bed-fountain` `:484–498`): the same 30 × 30 box as `.bed-fountain` but `left: 8px; right: auto; top: -12px`,
    border `#8d6e63`. It sits in the 12 px `.beds` top padding (`:404–406`), so it adds no width or height.
  - Estate: the field chip (`src/app/EstateMap.tsx:103–113`) gains `<span className="map-badge map-badge-soil"
    aria-hidden="true">{emoji}</span>` for a rolled field and ` · soil {name}` in its aria-label; CSS
    `.map-badge-soil { left: 1px; right: auto; }` (next to `.map-badge-order` `:800–803`). The field sheet
    (`FieldSheet` `:154–220`), above "Crop — applies at the next sowing" (`:202`): `<p className="sheet-line">🧭 Soil:
    {emoji} {name} — {text}</p>` and a `sheet-build` button `Reroll this field's soil · ⭐{cost}`, disabled while
    `rerollSoil` fails.
  - jsdom tests: `tests/FavoursSection.test.tsx` (row Lv 0 → 3 lines, the 'fields' lock text, the soil list hidden at
    level 0, rows + costs at 1 / 2, a reroll click spends ⭐16), `tests/Beds.test.tsx` (chip only for a rolled bed),
    `tests/Estate.test.tsx` (badge, sheet line, reroll button). No HUD change; the 375 top bar is not touched.
- [x] 233. **Pins, CHANGELOG, results.** New `tests/survey.test.ts` (pure, no bot; use `createInitialState()` and
  edited states; the v33 fixture through `deserialize`):
  - PIN36p ladder and rolls: ⭐80 / 200 / 320 then MAX_LEVEL; LOCKED Lv2 before the Fields; Lv1 rolls 4 beds, Lv2 every
    field, Lv3 nothing (rngState equal); a field opened at level ≥ 2 rolls at purchase, at level 1 it does not; 7,000
    home rolls and 6,000 field rolls from a fixed seed: every home trait share 1/7 ± 15 % (relative), every field
    entry 1/6 ± 15 %, the three group prices a third each ± 20 %; reroll costs 16 / 24 / 36 / 54 / 81, per-unit
    counters, NO_STARS, BAD_TILE, LOCKED; `sellFarm` resets the survey; same seed → same state.
  - PIN36q every trait at Lv1 and Lv3, measured on the real hook: fertile bed matures in `round(grow × 0.9)` ± 1 wet
    ticks (0.85 at Lv3); clay keeps a watered tile wet 1 / 0.6 × (0.4) as long; loose rots after grace × 2 (× 2.5) and
    `ticksUntilRot(tile, s, i)` agrees; rich: 20,000 tier-0 harvests double 10 % ± 1 (15 % ± 1); home and field price:
    market unit = `round(cropSellPrice × 1.15 × factor)` (1.225 / 1.2 / 1.3), an order unit pays `cropOrderPrice`
    unchanged; field fertile readyTick = tick + `ceil(grow × 0.9 / 2)`; creek: an unpaid plot ripens ×1.3 (×1.45) of
    the plain unpaid pace ± 1 %; dense: 1,000 ticks burn 700 (550) units per plot; contract: 10 units fill 15 (17) of a
    contract and pay 10 × `cropOrderPrice`; easySell: 10 units leave glut 7 (5.5) (`toBeCloseTo`); and a level-0 run with a trait
    written into `survey` but level 0 equals the plain run on every one of these.
  - PIN36r Manager match (in `tests/manager.test.ts`): managed fields with a berryPrice trait get the counted berry
    crop, a field already showing a counted crop of its group keeps it, a pinned berry field is left alone, a run with
    no traits gives today's plan.
  - PIN36s report (`console.log('PIN36s', …)`): the migrated save-v33 fixture (12 chilli fields, all 4 beds
    sprinklered) stepped 2 game-h at level 0 vs at level 3 with its own rolled traits, for 3 rngStates (the fixture's
    and two fixed ones): cash gained each and the ratio. Band: surveyed ≥ 0.98 × plain for each seed (a trait never
    costs income; the 2 % covers changed RNG sequences). Give this `it` a 60_000 ms timeout (6 runs × 7,200 steps;
    PIN36o's 2 runs fit the default). Plus the closed form: a berryPrice field's market unit at Lv1 /
    Lv3 = ×1.2 / ×1.3 of the plain unit (± rounding).
  - Sims: no sim file changes and no sim number moves; `pnpm test` runs them all. Do not run any sim file on its own.
  - CHANGELOG (top of `CHANGELOG` in `src/app/changelog.ts`, batch '36.5'): "🧭 Soil survey (⭐ Favours): level 1 gives
    each home bed a soil trait, level 2 each field, level 3 makes every trait 1.5× stronger. Reroll one for ⭐; traits
    last until you sell."
  - `## Batch 36.5 results` + `### Deviations` at the true end of this file; tick 229–233.

Scenarios (Hermes, from the plan's numbers; no bot): (A) fresh — Lv1 at ⭐80 against the fresh ⭐ pace ⭐52–134/h
(tiles-b35.3-plan.md:12) = 36–92 min (the old ⭐10 was 1.1–1.6 h at the pre-×8 pace, calc34 :163); rerolls 16 / 24 /
36 / 54 = 7–62 min each at that pace. (B) veteran — the v33 fixture: Lv2 + Lv3 = ⭐520, 12 rolled fields; PIN36s reports
its 2-h cash with and without traits; calc34 :177 prices a berry field at +32.8 % at Lv3 at a strawberry estate.

Out of scope: per-TILE traits (per bed, decided); traits inside listings or district rules; deed keeps for the survey
(⭐ purchases reset on sale); an Info page section; traits in the Manager's DP, orders' sizing or the Estate's ≈💰/h
labels; the 🌰 Ancient fruit button missing from the phone / tablet Shop seeds list (36.4 finding, open for Toon); the
open 36.2 nits (1024 tree fruit count, empty Orchard tree sheet hint, Forge Collect reason); the 375 top-bar wrap;
PIN36h (stays `it.fails`).

## Batch 36.5 results

Tests: 1285 passed | 8 expected fail (before the batch) → **1313 passed | 8 expected fail (1321 total)** after task 233.
`pnpm lint` clean, `pnpm build` OK (dist deleted after), one-time `npx tsc -b --force` clean, purity grep over
`src/core` + `src/save` clean (the known `storage.ts` wallClock line only), case-clash check prints nothing. No sim
file changed and no sim number moved — the full suite's 8 expected failures are the same PIN36h `it.fails` set as
before the batch.

- **229** `aca57e47` — save v34: `SAVE_VERSION` 34, `migrateV33` adds exactly the fresh `run.survey`, `RunV33` frozen;
  the committed save-v33 fixture migrates adding exactly `run.survey` (deep-equal, nothing else touched) and every
  fixture save-v1 … save-v33 lands on 34.
- **230** `4dd47230` — the ladder and rolls: `SURVEY_STARS [80, 200, 320]`, `soilRerollStars` 16 / 24 / 36 / 54 / 81,
  `src/core/survey.ts` (home 1/7, field 1/6 + group 1/3, all `nextRandom`), `rerollSoil` LOCKED / BAD_TILE / NO_STARS,
  `buyPlot` rolls a newly opened field at Lv2+.
- **231** `6d5efa32` — every trait on its real hook: stepTile fertile/clay/loose/rich, sales price, contract/easySell
  in `harvestSale`, pressuredCycle ×0.9, burningPlots 7-of-10, fieldsAct creek slip 7-of-20, Manager soil match.
- **232** `8c968d3a` — the UI: `soilText.ts` + the Favours 🧭 list with Reroll buttons, the FarmGrid bed chip, the
  EstateMap badge and the FieldSheet soil line + reroll; jsdom render tests only (no browser).
- **233** (this commit) — the pins (`tests/survey.test.ts` PIN36p/q/s, PIN36r in `tests/manager.test.ts`), the
  changelog line, these results.

PIN36p — ladder ⭐80 / ⭐200 / ⭐320 then MAX_LEVEL, LOCKED at Lv1 before the Fields; Lv1 rolls the 4 beds, Lv2 every
field, Lv3 rolls nothing (rngState equal); a field opened at Lv2 rolls at purchase, at Lv1 it does not; 7,000 home +
6,000 field rolls from seed 20261123: every home trait 850–1,150 (1/7 ± 15 % relative), every field entry 850–1,150
(1/6 ± 15 %), the three group prices a third each ± 20 %; reroll costs 16 / 24 / 36 / 54 / 81 with per-unit counters
(⭐1,000 → 984 → 960, only that unit redraws), NO_STARS / BAD_TILE / LOCKED; `sellFarm` resets the survey; same seed →
same state.

PIN36q — fertile matures in round(grow × 0.9) ± 1 (0.85 at Lv3); clay keeps a wet tile 1 / 0.6 (1 / 0.4) as long;
loose rots after floor(grace × 2) + 1 (× 2.5) and `ticksUntilRot` agrees; rich 2,000 / 3,000 doubles of 20,000
tier-0 harvests ± 200 (plain 0); home price ×1.15 / ×1.225 and field ×1.2 / ×1.3 of the plain market unit ± 1, an
order unit pays `cropOrderPrice` unchanged; field fertile sows at ceil(grow × 0.9 / 2); an unpaid creek plot ripens
×1.3 / ×1.45 of the plain unpaid pace ± 1 %; dense burns 700 / 550 / 1,000 units per plot per 1,000 ticks; contract
10 units fill 15 / 17 and pay 10 × `cropOrderPrice`; easySell 10 units leave glut 7 / 5.5; a level-0 run with traits
written into `survey` equals the plain run (hooks read PLAIN_SALE, 300 steps deep-equal).

PIN36r — with strawberry + chilli licensed the plain 4-field plan is [strawberry, chilli, chilli, chilli]; a berryPrice
trait on field 4 moves the counted strawberry to it: [chilli, chilli, chilli, strawberry]; a field already showing a
counted crop of its group keeps it (grape chip, both berries counted); a 📌 pinned berry field is left alone
(target null); a run with no traits gives today's plan (deep-equal).

PIN36s — the migrated v33 fixture (12 chilli fields, 2 game-h, Lv3 with its own rolled traits): plain 23,701,028 /
23,828,324 / 23,877,746 vs surveyed 27,078,551 / 27,080,681 / 27,172,279 for seeds 3249475414 / 987654321 / 42 —
ratios 1.143 / 1.136 / 1.138, all ≥ the 0.98 band; the berryPrice closed form ×1.2 / ×1.3 ± 1 holds.

Fixture v34 check — save-v33.json → v34 adds exactly `run.survey` at the fresh default (`{ level: 0, 4 × { trait:
null, rerolls: 0 }, fields: [] }`), every other key deep-equal, version stamped 34; the v1 … v33 chain all lands on 34.

New UI strings — the Favours row "🧭 Soil survey" (tip: "Level 1 gives each home bed a soil trait, level 2 each
field, level 3 makes every trait 1.5× stronger. Reroll any one for ⭐. Traits last until you sell the farm.") with the
level effect line "a trait for each home bed" / "a trait for each field" / "every trait ×1.5"; the `<details>` summary
"🧭 Soil traits · N beds · M fields" and its rows "Bed 1: 🥔 Root soil" + effect + "Reroll ⭐16" (aria-labels "Reroll
bed 1's soil" / "Reroll field 1's soil"); the FarmGrid bed chip (aria "Bed 1 soil: Root soil", title "Root soil —
<effect>"); the EstateMap chip suffix " · soil Berry soil" and the FieldSheet line "🧭 Soil: 🍓 Berry soil — <effect>"
with "Reroll this field's soil · ⭐16"; the 14 effect lines from `soilTraitText` — "roots/fruit-veg/berry crops sell
+15 %" / "+22.5 %" (home) and "+20 %" / "+30 %" (field), "drains 40 % slower" / "60 %", "ripe crops wait ×2 / ×2.5
before rotting", "+10 % / +15 % double harvest", "grows 10 % / 15 % faster", "grows ×1.3 / ×1.45 with an empty tank",
"burns 30 % / 45 % less tank coal", "each crop counts ×1.5 / ×1.75 toward a contract", "gluts the market 30 % / 45 %
less".

### Deviations

- No browser this batch (per brief): all UI verified with jsdom render tests. Not machine-verified: the visual layout
  and spacing of the soil list / bed chip / map badge at 375 px, the bed-soil chip's corner position relative to the
  sprinkler glyph, and the `<details>` open/close feel.
- No correctness-guard blocker fired (no negative value, cash loop, migration key loss, stall, or PIN36s below band);
  nothing was tuned away from the plan's numbers.
