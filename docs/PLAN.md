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
for batches 1–36.7, plus the big-farm roadmap. Lines 1–7436 of that file are the old `docs/PLAN.md` line for line, so a
`PLAN.md:N` citation from before 2026-11-14 points at the same line there. References like PLAN.md "Batch 24 results"
in tests and `docs/DECISIONS.md` resolve there too.

The archive is append-only and large (7,400+ lines, ~680 KB). Never read it whole: read only the line range a brief
cites, or `grep -n '^## Batch N'` and read that range.

## Active batches
New batch plans are appended below, and workers write `## Batch N results` + `### Deviations` at the end of this file.
After a batch is pushed, Hermes moves its plan and results to the end of the archive.
## Batch 36.8 — 🚜 The clerk takes every order + hired rigs for the Estate fleet (tasks 245–250, save v35 → v36)

Why: the order clerk still refuses contracts (DECISIONS.md:551-552, "Only the player accepts them"), so a
post-Tractor player with a clerk still presses Accept by hand all day; and a very big fast estate outruns the
Workshop machines' fixed ladder — Toon's 15-field estate sows only 32 of 75 plots (seeder T1+T2 = 5,400 tiles/h
busy 100 % of ticks vs ≈15,573 tiles/h real demand, calc-rigs-2026-11-23). Hired rigs are HELD capacity: extra
seeder/harvester units on top of the owned tiers, a non-refundable sign-on per rig plus a management fee every
live hour held, returnable any time. Playtest questions: does the clerk alone keep the 📋 board self-driving, and
does hiring rigs feel worth it at 2 rigs and self-limiting at 4–5?
Hard guards (DECISIONS batch 24 stance): no soft lock, no stall, no infinite cash loop, nothing negative, saves
migrate, nothing taken away by a migration, fee debt never grows past 1.
Anchors below are commit 7d6af4bd (origin/main after batch 36.6; 36.7 is UI-only and does not touch src/core or
src/save — `git diff origin/main --stat -- src/core src/save` empty). Re-measure with `grep -n` before editing.
Every new number lives in `src/core/balance.ts`; the rig curve is Toon's accepted values
(feedback-2026-11-23-decisions.md "Round 2", rigs-calculator-2026-11-23.md).

Scope fence: with 0 rigs held and the clerk unassigned, the game plays byte-identically (a v35 save migrates to
two zero-value fields; clerkTakes widens only what the clerk AUTO-accepts, never a payout formula). Sim numbers
do not move from task 246 (no sim assigns a clerk worker — verified, see 246); the only new sim runs are this
batch's own rig pins (task 249).

Words: "rig" = a HIRED extra seeder/harvester unit (kept count, fee every hour); "machine" = an OWNED Workshop
tier (max 1 per tier, today's rule). The clerk never flips a field's crop — that stays the 💼 Manager's job.

## Tasks (245–250)

- [ ] 245. **Save v36 and the rig shape (no mechanic yet).** Commit this task FIRST.
  - `src/core/state.ts:212` `Machines` gains `rigs: MachineKind[]` (hire order, newest last: the Nth entry pays
    the Nth price on the ONE shared ladder across both kinds) and `carry` gains `rigFee: number`;
    `createMachines()` (`state.ts:418-420`) returns `{ harvester: [], seeder: [], carry: { harvest: 0, plant: 0,
    maint: 0, rigFee: 0 }, rigs: [] }`. `Fields` (`state.ts:219`) and `GameState` (`state.ts:292`) unchanged.
  - `src/save/serialize.ts:39` `SAVE_VERSION` 35 → 36. Frozen types after `SaveV34` (`:317`):
    `type MachinesV35 = { harvester: number[]; seeder: number[]; carry: { harvest: number; plant: number; maint: number } }`,
    `type RunV35 = Omit<RunState, 'fields'> & { fields: Omit<Fields, 'machines'> & { machines: MachinesV35 } }`;
    today's `SaveV35` (`:318`) becomes `{ version: 35; savedAtMs: number; state: { meta: MetaState; run: RunV35 } }`;
    new `SaveV36 = { version: 36; savedAtMs: number; state: GameState }`, `export type Save = SaveV36` (`:319`).
  - `migrateV35(save: SaveV35): SaveV36` after `migrateV34` (`:932-944`): returns the same state with
    `run.fields.machines` gaining `rigs: []` and `carry.rigFee: 0`. Nothing granted, nothing taken away (a
    migration never takes value away). Chain it on EVERY branch of `migrate()`: `if (data.version === 36) return
    data as SaveV36`, `if (data.version === 35) return migrateV35(data as SaveV35)`, and wrap the whole v34-and-
    older chain (`toV34` path) in `migrateV35(migrateV34(…))`.
  - The fixture `tests/fixtures/save-v35.json` is ALREADY committed with this batch's docs commit (Toon's live
    v35 save; TILES1 code CRC-verified by Hermes — declared d6aa8458 == computed d6aa8458 over the base64url
    body, codec.ts logic reimplemented outside the repo; decoded JSON text written as-is, one line, credential
    grep api_key|secret|token|password|Bearer|sk-|ghp_|AIza clean; semantically identical to the calculator's
    toon-save-v35-1223.json; never edit any file in tests/fixtures). Its
    shape: tick 619,434 (172 h), 15 fields (grape 1, chilli 10, strawberry 4), pump 3, harvester tiers [3,1,2],
    seeder [1,2], cash 💰422.6M. In `tests/save.test.ts`: import like the others (`:3-51` `?raw` pattern);
    pin that it migrates to v36 with `fields.machines.rigs` deep-equal `[]` and `carry.rigFee` 0 and EVERYTHING
    ELSE deep-equal to the decoded original; every older fixture v1 … v35 reaches v36. Update the version pins:
    `tests/save.test.ts:303` (serialize round-trip → `{ version: 36, … }`), `:579` (`toBe(36)`), `:1119`
    (`expect(SAVE_VERSION).toBe(36)`), and `tests/App.test.tsx:489` → "Will migrate v15 → v36".

- [ ] 246. **The clerk takes every order the run can produce (core).** This overturns DECISIONS.md:551-552
  ("Only the player accepts them") — the DECISIONS "Batch 36.8" entry says so in one line.
  - `src/core/orders.ts:302-306`: `clerkTakes(run, good)` body becomes `orderPool(run).includes(good)` (keep the
    private function and its call site `:316`; rewrite the doc comment: "every good the run can produce —
    licensed crops (contracts included), vein items the pickaxe mines, mold bars, forge goods"). `orderPool`
    (`orders.ts:54-66`) is UNCHANGED — the board already rolls only producible goods. `clerkTarget` / `clerkAction`
    (`:310-330`) and the Manager (`src/core/manager.ts`) are unchanged: the clerk never changes a field's crop.
  - Behaviour delta, all from the one-line body change: (a) ESTATE CONTRACTS (crop goods with `fields.unlocked`)
    are now accepted — the overturn; (b) BAR and FORGE orders whose ore/mold the run works are accepted (today
    only goods the current vein DROPS, `veinDrops(run.vein.level)`); (c) pre-Tractor crop orders no longer need
    the crop planted / set as "Crop to plant" — any LICENSED crop qualifies (widens today's `:305` rule).
  - Call sites (grep both, they are the only ones): `clerkTakes` used at `orders.ts:316` only (private);
    `clerkAction`/`clerkTarget` at `src/core/workers.ts:22, :85, :159` — no signature change, nothing to edit.
  - Tests `tests/orders.test.ts`: re-pin with cause — `:435` (clerk accept flow), `:448-456` (clerkTarget
    deliver/accept/idle), `:562-565` (estate board: `:562` an estate contract the clerk refused → now the
    target; `:563` coal still taken; `:565` unchanged deliver-first). ADD: an accepted-flow pin that a mold-bar
    offer (`furnace.built` + mold owned) and a forge-good offer are taken; a pre-Tractor licensed-but-unplanted
    crop offer is taken (delta (c)); the clerk with a contract accepted never touches `fields.list` crops.
  - Sim pins do NOT move from this task — verified: no sim assigns a clerk worker (`tests/sim/bot.ts:1141`,
    `:1283` clerk: 0; `tests/sim/fields.test.ts:874-918` certRun scripts its own accept policy;
    `tests/sim/furnace-iron.test.ts:42, :463` clerk: 0; `tests/sim/market-orders.test.ts:381` clerk: 0;
    `tests/sim/mine-estate.test.ts` contractRun `bot.ts:1345-1360` is scripted). Do NOT re-run or re-pin sims here.

- [ ] 247. **Hired rigs: balance numbers, hire/return, the fee tick (core).**
  - `src/core/balance.ts` after `machineMaintPerHour` (`:485-487`), all named:
    - `RIG_TILES_PER_HOUR = 1800` — one hired rig of either kind (T1 class; feel knob).
    - `RIG_SIGN_ON = [3_000_000, 6_000_000, 12_000_000, 24_000_000, 48_000_000]` — non-refundable sign-on; the
      Nth rig of EITHER kind pays index N−1 (one shared ladder, ×2 per rig; curve knobs).
    - `RIG_FEE_PER_HOUR = 300_000` — management fee per live hour × rig number (rig n pays 300k × n; n rigs total
      = 300k × n(n+1)/2: 0.3M / 0.9M / 1.8M / 3.0M / 4.5M per h).
    - `RIG_MAX = 5` — rigs of both kinds combined.
    - Exports `rigSignOn(count: number): number` (the NEXT hire's price, `RIG_SIGN_ON[count]`), `rigFeePerHour(count:
      number): number` (the TOTAL fee for `count` rigs held), `rigTilesPerHour(): number`.
    - Gate (verified in code, stated for the worker): the Tractor (`run.fields.unlocked`, set by the Estate
      unlock; `state.ts:412`) PLUS owning that machine kind's tier 1 (`run.fields.machines[kind].includes(1)`,
      `buyMachine` fields.ts:375-383). NO extra certificate (Toon's Q3 answer).
  - `src/core/fields.ts`:
    - `fleetTilesPerTick` (`:486-488`) and `src/app/estateText.ts:164` `fleetTilesPerHour`: add
      `rigs.filter((k) => k === kind).length × RIG_TILES_PER_HOUR (÷ 3600 in the tick version)` — a rig works
      through the same `carry` counters as an owned tier (machines-first, workers fill the gap; accrual only
      while that kind has work, unchanged).
    - After `buyMachine` (`:375-383`): `hireRig(state, kind: MachineKind): ActionResult` — error order LOCKED
      (`!fields.unlocked || !machines[kind].includes(1)`), MAX_RIGS (`rigs.length >= RIG_MAX`), then
      `pay(state, { cash: rigSignOn(rigs.length) }, { fields: { …machines, rigs: [...rigs, kind] } })`
      (NO_CASH from `pay`). Non-refundable. `returnRig(state, kind: MachineKind): ActionResult` — NO_RIGS (no rig
      of that kind held), else remove the NEWEST rig of that kind (last `kind` index in `rigs`); nothing is paid
      back. Add `'MAX_RIGS' | 'NO_RIGS'` to `ActionError` (`src/core/actions.ts:45`) and to `ERROR_TEXT`
      (`src/app/useGame.ts:21`): `MAX_RIGS: 'Rig limit reached (5)'`, `NO_RIGS: 'No rig of this kind hired'`.
    - Fee tick inside `machinesAct` (`:505`): rigs accrue `rigFeePerHour(rigs.length) / 3600` into
      `carry.rigFee` EVERY tick held — working or idle, live and offline catch-up (catchUp runs the same `step`,
      serialize.ts:1039-1044; capped at 8 h offline → worst case 8 h × 4.5M = 36M ≈ 8.5 % of the veteran's cash).
      Payment mirrors the maint pattern (`:512-524`): pay `Math.floor(carry.rigFee)` from cash when affordable;
      if a whole 💰1 is due and cash is 0, RETURN the newest rig (pop `rigs` — Civ VI disband rule) and cap
      `carry.rigFee` at 1 (the debt never grows); accrual next tick uses the lower count. Widen the early return
      guard `:508` to `m.rigs.length === 0` too so a fee is never skipped. Keep purity:
      `step(s, n) = n × step(s, 1)`.
    - Derived ONCE (the UI reads only this): `rigView(state, kind): { count: number; maxed: boolean; signOn:
      number; feePerHour: number; addedPerHour: number }` — `count` = rigs of the kind; `signOn` =
      `rigSignOn(rigs.length)`; `feePerHour` = the NEXT rig's own fee `RIG_FEE_PER_HOUR × (rigs.length + 1)`;
      `addedPerHour` = `RIG_TILES_PER_HOUR × fieldsMarginalIncomePerHour(state)` (the same marginal the payback
      label uses, `fields.ts:558+` — the 💰/h one more 1,800 tiles/h lets through, whichever kind unblocks it).
  - Tests (`tests/fields.test.ts`): hire gate LOCKED pre-Tractor and without the kind's tier 1, buyable with
    tier 1 and NO certificate; MAX_RIGS at 5 combined; the shared ladder (harvester then seeder pays index 1);
    sign-on never refunded on return; `returnRig` removes the newest of that kind only; fee accrues on an IDLE
    fleet (nothing to sow/reap) and during `catchUp`; auto-return at cash 0 returns one rig per tick until the
    fee is payable, debt capped at 1, cash never negative; `step(s, 600)` identity with rigs held; the rig's
    1,800 tiles/h flows through `carry.plant`/`carry.harvest` like a machine tier.

- [ ] 248. **Rigs UI: a rigs row per kind in the Estate Workshop machines card (src/app only).**
  - `src/app/Estate.tsx`: inside `<details className="estate-machines">` (`:133`), after the Machines group
    (`:137-160`), one more `<div className="group">` with `<h3>Hired rigs</h3>` and ONE row per kind, rendered
    only when that kind's tier 1 is owned (`run.fields.machines[kind].includes(1)` — the hire gate; pre-Tractor
    and tier-less kinds show nothing). Row markup reuses `.recipe-row`; the two buttons sit in a
    `<span className="rig-actions">` with `app.css` `.recipe-row .rig-actions { display: flex; gap: 8px; }`
    (one appCss pin). All numbers come from ONE `rigView(state, kind)` call per row (task 247) — no other UI
    part recomputes them. Strings verbatim:
    - Heading: `Hired rigs`
    - Row label: `{HARVESTER_EMOJI} Harvester rigs · {count}/5` / `{SEEDER_EMOJI} Seeder rigs · {count}/5`
    - Row small text: `+1800 tiles/h each · next 💰{price(signOn)} sign-on + 💰{price(feePerHour)}/h · adds ≈💰{price(addedPerHour)}/h`
    - Buttons: `Hire` (disabled when `!hireRig(state, kind).ok`, `title={ERROR_TEXT[error]}`) and `Return`
      (disabled at count 0), `onClick={() => act(hireRig / returnRig)}` — import both from `../core/fields`.
  - The capacity strip and bottleneck chip (`estateText.ts:164, :181`) pick the rigs' tiles/h up automatically
    (task 247's `fleetTilesPerHour` change) — no new string there, no chip-order change.
  - Tests: `tests/Estate.test.tsx` — the group is absent pre-Tractor and for a kind without tier 1; with tier 1
    owned the row shows `Harvester rigs · 0/5`, the Hire price `💰3.00M` + `💰300k/h` fee (strings computed from
    the same balance functions, the file's established pattern `:93-94`), Return disabled at 0; after two hires
    (state-level, not clicks) the label reads `2/5` and the next sign-on is 💰12.00M. `tests/appCss.test.ts`:
    ADD the `.rig-actions` pin. `tests/estateText.test.ts`: `fleetTilesPerHour` with `rigs: ['seeder']` adds
    1800 to seeder only.

- [ ] 249. **Sim pins: the v35 fixture forward with rigs, and the fresh-player guard.**
  - `tests/sim/fields.test.ts` (the fleet system), new describe `batch 36.8: hired rigs on the v35 fixture`:
    import `save-v35.json?raw` + `deserialize` (the mine-estate pattern, `tests/sim/mine-estate.test.ts:29-31`),
    set `fields.machines.rigs` directly on the start state (sign-on NOT paid — the pin measures throughput; the
    REAL fee tick runs), then `step()` 16 game-h with 0 / 2 seeder rigs / 4 seeder rigs. Report a `PIN36.8`
    console.log per variant (net cash/h, unsown plots at the end). Assert: net(2) > net(0) × 1.3; net(4) >
    net(2); the gain 2→4 is SMALLER than 0→2 (the fee-adjusted flattening). Bands from the calculator
    (calc-rigs-2026-11-23, gross of fees): 💰13.83M / 21.48M / 24.90M per h; with the real fee ladder the nets
    land lower (2 rigs −0.9M/h, 4 rigs −3.0M/h). If your measured numbers differ, re-pin the bands old → new
    with the cause under Deviations — the DIRECTIONS above stay hard.
  - Fresh-player guard (`tests/sim/early.test.ts`, the fresh ladder): the ladder bot never holds enough cash to
    hire rig 1 early — assert the run's max cash HELD before tick 144,000 (40 game-h) stays below
    `RIG_SIGN_ON[0]` (calculator: 💰2.1M at 40 h, income ≈💰80k/h at the 8.2 h Fields unlock — a fresh player
    cannot reach rig 1; record the measured max in the pin's log).
  - Re-pins this batch owns: only the new pins above plus any unit pins named in 246/247. No clerk-driven sim
    number exists (see 246). If a `pnpm test` sim number still moves, find the cause BEFORE re-pinning (a moved
    pin with no mechanism named is a blocker, not a re-pin).

- [ ] 250. **CHANGELOG + report.**
  - `src/app/changelog.ts`: ONE entry at the TOP, verbatim (≤ 180 code points):
    `{ batch: '36.8', date: '<today, YYYY-MM-DD>', line: "The order clerk now takes every order you can make, and the Estate Workshop hires extra rigs: more sowing/reaping power for a sign-on fee plus a management cost per hour." }`
    (the line is 170 code points — Python `len()`, under the 180 cap; re-count if you reword it.)
  - Write `## Batch 36.8 results` + `### Deviations` at the TRUE END of docs/PLAN.md: test totals before →
    after, one line per task, the PIN36.8 numbers and the fresh-guard max, every new UI string, and what jsdom
    could not show (the rigs row layout at 375). Tick 245–250.

Scenarios: (A) fresh — nothing new before the Tractor; at the Estate the rigs rows appear only after a kind's
Mk1 is built, and rig 1 (💰3M) is unreachable before ~40 h (guard pin). (B) veteran (the v35 fixture, 15 fields,
5,400/12,600 tiles/h) — both rows visible; hiring 2 seeder rigs lifts net cash/h ≈1.5× and the row shows the
next sign-on 💰12M; the fee (0.9M/h at 2 rigs) is visible next to the ≈💰/h the rig adds.

CHANGELOG line (player-facing, no internals): see task 250 — count with Python `len()` before commit.

Results / Deviations: the worker writes `## Batch 36.8 results` and `### Deviations` (every judgment call,
every re-pinned pin old → new with cause, anything jsdom could not verify) at the true end of docs/PLAN.md.

Out of scope: field sowing order (fields.ts:279-287 stays exactly as-is — rigs do NOT change which field sows
first), UI layout beyond the rigs row, mine changes, renown, any change to `orderPool` / order pricing, the
Manager's plan, machine tier prices, a rig certificate, per-kind fee ladders.
