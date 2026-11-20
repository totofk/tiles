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
for batches 1–35.2, plus the big-farm roadmap. Lines 1–7436 of that file are the old `docs/PLAN.md` line for line, so a
`PLAN.md:N` citation from before 2026-11-14 points at the same line there. References like PLAN.md "Batch 24 results"
in tests and `docs/DECISIONS.md` resolve there too.

The archive is append-only and large (7,400+ lines, ~680 KB). Never read it whole: read only the line range a brief
cites, or `grep -n '^## Batch N'` and read that range.

## Active batches
New batch plans are appended below, and workers write `## Batch N results` + `### Deviations` at the end of this file.
After a batch is pushed, Hermes moves its plan and results to the end of the archive.

## Batch 35.3 — ⭐ pace: fixed ⭐ per order tier ×8, ⭐ prices ×8, reroll for cash, contract cap (tasks 196–200, save v29)

Why: Toon's ⭐ target is an early Favour level every 5–10 min of active play (never slower than 10–15 min). The shipped
rule (0.2 ⭐ per minute of full output; contracts get ⭐ divided by the whole wet output) pays ⭐2.25–6/h active on his
12-field v27 save; fixed 1/2/4 per tier would pay ⭐6.5–10.75/h, 5–9× short of the ⭐48–90/h that levels 1–10
(⭐8–15) need. ×8 → ⭐52–86/h (12 fields), ⭐116–134/h (4 fields); every other ⭐ price ×8 keeps its old pace.
Decisions: `docs/DECISIONS.md` "Batch 35.3 refined". Anchors below are origin/main 33b76521 (after batch 35.2).

- [ ] 196. **Fixed ⭐ per order tier.** `ORDER_TIERS` (`src/core/balance.ts:524–528`) gains `stars: 8 / 16 / 32`;
  `orderTierStars(tier)` replaces `orderStarsPerMinute` (`balance.ts:529–531` constant + comment, `:577–580` function;
  delete the constant). `rollOffer` (`src/core/orders.ts:94–104`) sets `stars = orderTierStars(tier)` for every good
  (crops, contracts, items, bars; a storage-clamped item order pays its tier's full ⭐). `orderFullRate`
  (`orders.ts:81–92`) loses its only reader: delete it. `fillOrder` (`orders.ts:125–150`) adds the whole `offer.stars`
  to `stars` and `lifetime.starsEarned`; drop `starsFrac` from `RunState` (`src/core/state.ts:91`, `createInitialRun`
  `:288`) and every reader. Contract count rule (`CONTRACT_WET_SHARE` 0.15) unchanged.
- [ ] 197. **Every other ⭐ price ×8.** Certificates (`balance.ts:244–248`): clerk ⭐20 → 160, manager ⭐20 → 160,
  stoker ⭐15 → 120. `ORDER_SLOT_STARS` (`balance.ts:540`) [10, 30] → [80, 240]. `STAR_CARRY_CAP` (`balance.ts:622`)
  50 → 400 (`state.ts:287`, `src/app/Favours.tsx:108`, `src/app/Legacy.tsx:109–118` read the constant). Favour prices
  (`FAVOURS`, `balance.ts:254–261`) unchanged. Comments that quote the old numbers are updated.
- [ ] 198. **Reroll for cash, ×2 per reroll.** `ORDER_REROLL_STARS` (`balance.ts:541`, `orderRerollStars` `:612–614`) →
  `ORDER_REROLL_BASE_CASH = 500` (not scaled by the deed cost row); `orderRerollCash(rerolls) = 500 × 2^rerolls`.
  `Orders` (`state.ts:108`) gains `rerolls: number` (0 in `createInitialRun`, `state.ts:286`). `rerollOrders`
  (`orders.ts:274–288`) pays `{ cash: orderRerollCash(orders.rerolls) }` and sets `rerolls + 1`; error order LOCKED,
  NOTHING_TO_DO, NO_CASH. `fillOrder` sets `rerolls: 0` on every completed order; a sale resets it through the fresh
  run. Discard stays free with its cooldown. UI `src/app/Orders.tsx:116–118`: "🔄 Reroll 💰{price}" (next price),
  disabled without the cash.
- [ ] 199. **Save v29.** `SAVE_VERSION` 28 → 29 (`src/save/serialize.ts:33`); `migrateV28` chained after `migrateV27`
  (`serialize.ts:826`) on every version branch (`serialize.ts:837–845`). Rules: `stars = floor((stars + starsFrac) × 8)`,
  `starsFrac` dropped, `lifetime.starsEarned` unchanged (history), every offer's `stars = orderTierStars(tier)`
  (accepted ones too, progress kept), `orders.rerolls = 0`, certificates / slots already owned stay owned (no refund).
  Test: `tests/fixtures/save-v28.json` (committed: Toon's live 12-field save as re-saved by the live v28 build — ⭐9 +
  starsFrac 0.905, 4 slots, 3 accepted offers with part progress) → v29 in `tests/save.test.ts` like save-v27
  (`tests/save.test.ts:29`): ⭐ ×8 (here 79), offers 8/16/32 by tier, rerolls 0, everything else equal.
- [ ] 200. **Contract size cap (one grow cycle of the fields a slot can count on).** In `orderCount`
  (`src/core/orders.ts:76–79`), a contract (`isContract`, `orders.ts:39`, and `fieldsPlantable`,
  `src/core/fields.ts:126`) is capped at
  `contractCap(run) = max(1, floor(F / run.orders.slots)) × fieldPlots() × plotTiles() × (1 + doubleHarvestChance(run.toolTier.harvest))`,
  floored, F = pivot fields not 📌 pinned (the Manager's managed set, `src/core/manager.ts:20`); the tier and its ⭐
  stay. (`fieldPlots` / `plotTiles` `balance.ts:384–391`, `doubleHarvestChance` `balance.ts:1049`.) Export
  `contractCap` for the Orders card. Home-plot crop orders and item orders unchanged. Offers already rolled keep their
  count (no migration step). Calculator Q1 cap check: 12 fields ⭐52–86/h → ⭐112–132/h, contracts fill in 6–12.5 min,
  Estate income +15–23 %; 4 fields ⭐116–134/h → ⭐126–150/h.
- CHANGELOG line (top of `src/app/changelog.ts`, batch '35.3'): "Orders pay ⭐8 / 16 / 32 by size, so Favours come every
  few minutes; ⭐ prices and your ⭐ go ×8. Rerolls cost cash and double until you finish an order. 🚜 Contracts fit
  your fields."

Tests to touch (grep at 33b76521): `tests/orders.test.ts`, `tests/favours.test.ts`, `tests/FavoursSheet.test.tsx`,
`tests/workers.test.ts`, `tests/prestige.test.ts` (carry 400), `tests/save.test.ts`, `tests/sim/mine-estate.test.ts`,
`tests/sim/market-orders.test.ts` (+ fixtures save-v26/v27 migrate through v29). Rendered Orders tests for the reroll
label.

Scenarios: (A) fresh player — clerk/manager first-buy minutes and ⭐ held at the Manager (`certRun`,
`tests/sim/fields.test.ts:~808–850`; PIN311a `:518`, PIN322a `:531`) must stay within ±25 % of the old minutes (⭐
supply and price both ×8): report old → new; re-pin ⭐/h reports (PIN34b `tests/sim/bars-ladder.test.ts:101`, PIN35b
`:279`) and report old → new. (B) veteran — the v28 fixture migrated, 2 game-hours with an accept-all player policy:
⭐/h ≥ 80, every new contract count ≤ contractCap, Estate cash/h not below the uncapped run, and offline (workers only,
8 h) ⭐/h below the active figure.

Tests to add (game terms): a small, a medium and a large order pay ⭐8 / 16 / 32 whatever the good; a storage-clamped
item order still pays its tier's full ⭐; the clerk certificate asks ⭐160, the Manager ⭐160, the Stoker ⭐120; the 3rd /
4th order slot cost ⭐80 / ⭐240; selling the farm carries at most ⭐400; the first reroll costs 💰500, the next 💰1,000,
then 💰2,000; finishing any order brings the reroll back to 💰500; without the cash the reroll is refused; a contract on
12 managed fields with 4 slots never asks for more than 3 fields' one harvest; a home-plot crop order and an ore order
keep their old size; v28 fixture → v29.

Out of scope: a field-gated tier 3 (after the cap, 4 and 12 fields pay about the same ⭐/h; decide after playtest); 35.4
UI (Favours section in Upgrades, pre-sale info page, full-width ＋ Field N button); batch 36's ⭐ prices (open until Toon
playtests 35.3).
