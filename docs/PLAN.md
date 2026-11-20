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
for batches 1–35.1, plus the big-farm roadmap. Lines 1–7436 of that file are the old `docs/PLAN.md` line for line, so a
`PLAN.md:N` citation from before 2026-11-14 points at the same line there. References like PLAN.md "Batch 24 results"
in tests and `docs/DECISIONS.md` resolve there too.

The archive is append-only and large (7,400+ lines, ~680 KB). Never read it whole: read only the line range a brief
cites, or `grep -n '^## Batch N'` and read that range.

## Active batches
New batch plans are appended below, and workers write `## Batch N results` + `### Deviations` at the end of this file.
After a batch is pushed, Hermes moves its plan and results to the end of the archive.
## Batch 35.2 — Storage flow after the Tractor (tasks 192–195, save v28)

Why: Toon's v27 saves (2026-11-21) sit at storage 120/120 for 99.8–100 % of 8 game-h: the 2 miners press 22–64 times
(0.2–0.6 % of capacity), coal on Sell on dig is sold instead of stored (a Sell kind is stored only with room,
`src/core/mining.ts:139–148`), the furnace stalls (trays cannot be collected), and the Fields tank runs dry. Coal drops
are not short (828 coal/h at full press vs ≈ 230/h needed at 20 fields). With the gold pickaxe repaired and bars on
Keep 10 the tank fills to its cap and coal sits in storage 99.9 % of the time; bar auto-sale = 0.5–2.9 % of Estate
income. Decisions: `docs/DECISIONS.md` "Batch 35.2 refined". Seam aim on coal was withdrawn (Toon, 2026-11-21).

- [x] 192. **Bars Keep N after the Tractor + save v28.**
  - Run field `barKeep: Partial<Record<'copperBar' | 'ironBar' | 'goldBar', number>>` (missing = off). Shown and
    settable only when `run.fields.unlocked` (the Tractor) and `run.keepN`; `setBarKeep(state, bar, n)` mirrors
    `setOreKeep` (`src/core/mining.ts:213–221`: LOCKED / BAD_AMOUNT, 0 … storage capacity).
  - Rule: when bars enter storage in `collectBars` (`src/core/furnace.ts:134–153`, so Collect all and the ore loader
    too), every bar of a kind with a Keep value above that value is sold at `itemSellPrice` (cash and
    `lifetime.cashEarned` grow; use `sellItem`). Bars an accepted, unfilled bar order still needs are not sold (count
    − done of every accepted order for that bar is reserved on top of N). Lowering N sells nothing at once; the next
    collect does. Before the Tractor nothing changes (DECISIONS rule 14 holds before it).
  - UI: three bar rows (🥉 🥈 🥇) in the 🧺 Ore sorting table (`src/app/Mine.tsx:519–588`) under the ores, same
    keep-up-to stepper (step 10), no Unlock / Sell-on-dig columns for bars (Keep N on = auto-sell above N; a row at
    "off" keeps all). Hidden before the Tractor.
  - Save v28: `barKeep: {}` and `autoBuyWood: false` (task 194) in `createInitialRun` (`src/core/state.ts:~261–272`);
    `SAVE_VERSION` 27 → 28 (`src/save/serialize.ts:33`), `migrateV27` (adds both fields, takes nothing away) chained
    after `migrateV26` on every version branch (`serialize.ts:~778–837`). `tests/fixtures/save-v27.json` is committed
    (Toon's live v27 save, 12 fields, storage full): migrate it to v28 in `tests/save.test.ts` like save-v26
    (`tests/save.test.ts:28`) and assert Keep N bars off, auto-buy wood off, everything else equal.
- [x] 193. **Item orders: partial delivery; the ordered good skips Sell on dig.**
  - `deliverOrder` (`src/core/orders.ts:242–262`): delivers min(storage, count − done) when that is ≥ 1, pays per unit
    as today (`itemOrderValue`, rounded once per delivery), completes through `fillOrder` at the count. Error order:
    LOCKED, BAD_SLOT, NOTHING_TO_DO, NOT_ENOUGH_ITEMS (storage holds 0).
  - Clerk (`clerkTarget`, `orders.ts:~297–303`): delivers whenever storage holds ≥ 1 of an accepted item order's good.
  - `breakDrop` (`mining.ts:139–148`): a Sell-on-dig kind that an accepted, unfilled item order asks for is stored
    while storage has room (ignoring its Keep N); with storage full it is sold as today, so the miner never jams.
  - UI (`src/app/Orders.tsx:43, 70, 95`): Deliver is enabled with ≥ 1 in storage and reads "Deliver n"; the ready
    badge counts only orders storage can fill completely.
- [x] 194. **Auto-buy wood for the furnace.** `autoBuyWood` toggle (save field from task 192) on the furnace fuel row
  (`src/app/Mine.tsx:~220–232`). When on, the fuel loader (`src/core/workers.ts:~75–80`) with 0 coal in storage and
  fire room for one wood (`fuelRoom(f, 'wood') ≥ 1`) buys one wood at `WOOD_BUY_COST` (`balance.ts:68`) straight into
  the fire (never into storage, never into the Fields tank); with cash below the price it idles. Off by default.
  The manual fill buttons do not change.
- [x] 195. **Mine status lines (src/app only).** Under 📦 Storage (`src/app/Mine.tsx:~368`), one line per active blocker,
  Factorio-style machine status, plain text:
  - storage full: "⚠️ Storage full: miners stopped, Sell-on-dig finds are sold";
  - the selected pickaxe is blunt while a miner is assigned: "⚠️ Pickaxe blunt: miners idle until you repair it";
  - Σ Keep N of every Sell-on-dig kind (and bars from task 192) > storage capacity: "⚠️ Keeps add up to N, storage
    holds M". No line when nothing blocks. Emoji ≤ Unicode 11.
- CHANGELOG line (top of `src/app/changelog.ts`, batch '35.2'): "After the Tractor bars get Keep N and extras sell as they
  leave the furnace. Orders take part deliveries, the furnace can buy wood, and the mine tells you why miners stop."

Scenarios: (A) fresh player — nothing changes before the Tractor; Keep N bars and auto-buy wood are off; sim ladder pins
should hold, except bots with a clerk (task 193 delivers earlier): re-pin and report old → new. (B) veteran — the v27
fixture migrates with everything off; a test sets Keep 10 on every bar, repairs the gold pickaxe and steps 1 game-h:
storage is no longer full at the end and the Fields tank holds more coal than at the start.

Tests to add (game terms): collecting a tray with Keep 10 iron bars sells the bars above 10 and adds their price; before
the Tractor bars never auto-sell and the rows are hidden; an accepted gold bar order keeps its bars above Keep N;
delivering 5 of an ore order's 20 pays 5 and leaves 15; the 20th completes it and pays ⭐; the clerk delivers whatever
storage holds; an ordered ore on Sell on dig is stored while there is room and sold when storage is full; auto-buy
wood on: no coal → the fuel loader buys one wood for 💰4 into the fire, off: it idles, the tank never gets wood; each
status line shows for its blocker and hides without it; v27 fixture → v28.

## Batch 35.2 results

Commits (main, not pushed): b9b3a09e task 192, 846874f3 task 193, 1a63ea0d task 194, 38e2f7e8 task 193 fix (an ordered
Sell-on-dig good is stored while there is room, ignoring Keep N — the first 193 commit capped it at Keep N + the order's
need), task 195 (this commit).

1. Test totals: before 1137 passed + 3 expected failures (1140; batch 35.1 record); after 1152 passed + 4 expected
   failures (1156), 63/63 files. The 4th expected failure is the scenario B clause below.
2. Sim pins: none moved. Every sim file passes unchanged after tasks 192–195, including the clerk bots
   (tests/sim/market-orders, fields, furnace-iron): their clerks never hold a part of an order in storage at a pinned
   moment, so part deliveries change no pinned number. Scenario A holds: before the Tractor nothing changes.
3. Save v28: `SAVE_VERSION` 27 → 28, `migrateV27` adds `barKeep: {}` and `autoBuyWood: false` and is chained after
   `migrateV26` on every branch. tests/fixtures/save-v27.json (Toon's live save: 12 fields, storage 120 / 120) migrates
   with both off and everything else equal (deep-equal after removing the two fields); every fixture v1 … v27 lands on
   v28 with both off.
4. Scenario B (tests/save.test.ts "save v28"; v27 fixture, Keep 10 on 🥉 🥈 🥇, gold pickaxe repaired to 600, 3600
   single steps):
   | | storage full (ticks of 3600) | storage at end | tank coal start → end | coal > 0 in storage |
   |---|---|---|---|---|
   | v27 as is | 3565 | 120 / 120 | 182.5 → 160.4 | 0 ticks |
   | bars Keep 10 only (gold at durability 5) | 4 | 54 / 120 | 182.5 → 160.4 | 0 ticks |
   | gold repaired only | 3565 | 120 / 120 | 182.5 → 160.4 | 0 ticks |
   | both (scenario B) | 1125 | 120 / 120 | 182.5 → 399.4 (cap 400 reached) | 3446 ticks (95.7 %) |
   The tank fills to its cap and coal sits in storage, as the calculator in "Why" says. Storage is full at the end:
   see Deviations.
5. Gates: `pnpm test`, `pnpm lint`, `pnpm build` green before each commit; `npx tsc -b --force` clean; purity grep over
   src/core and src/save shows only the known `src/save/storage.ts:26` wallClock line; the case-collision check prints
   nothing.

### Deviations

- **Scenario B: "storage is no longer full at the end" does not hold — measured 120 / 120 at tick 3600** (full on 1125 of
  3600 ticks, down from 3565). Pinned as `it.fails` in tests/save.test.ts with the measured value; the tank half of the
  scenario holds (182.5 → 399.4 coal, cap 400). Cause: the save's own Keep N adds up to 230 (Sell-on-dig coal 50, stone
  30, copper / iron / gold ore 40 each = 200, plus bars 3 × 10) against 120 slots, so once the tank is full the kept coal
  (41 at the end), stone 30 and ores refill storage; the new status line reads "⚠️ Keeps add up to 230, storage holds 120".
  Not one of the listed correctness guards, so the batch went on. Hermes decides: keep the clause as a player-fixable
  state (the status line), or change the scenario's keeps.
- `setBarKeep(state, bar, null)` turns a bar back to off (keeps all); the UI's − from 0 does that and + from off sets 0.
  The plan names only 0 … storage capacity; off needed a way back.
- The Deliver button reads "Deliver 0" (disabled) when storage holds none.
- The auto-buy wood toggle sits under the fuel fill buttons, reusing the `.pouch-auto` checkbox style from the seed
  pouch.
- UI verified with jsdom render tests only (no browser): bar rows, Deliver n / ready badge, the wood toggle and the three
  status lines. Hermes re-measures live.
- One full-suite run timed out the 8 h offline perf test in tests/sim/fields.test.ts (2134 ms vs < 2000 ms); it passes
  rerun standalone (the batch 35.1 load flake).
