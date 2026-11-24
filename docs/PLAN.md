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
for batches 1–36.8.1, plus the big-farm roadmap. Lines 1–7436 of that file are the old `docs/PLAN.md` line for line, so a
`PLAN.md:N` citation from before 2026-11-14 points at the same line there. References like PLAN.md "Batch 24 results"
in tests and `docs/DECISIONS.md` resolve there too.

The archive is append-only and large (7,400+ lines, ~680 KB). Never read it whole: read only the line range a brief
cites, or `grep -n '^## Batch N'` and read that range.

## Active batches
New batch plans are appended below, and workers write `## Batch N results` + `### Deviations` at the end of this file.
After a batch is pushed, Hermes moves its plan and results to the end of the archive.

## Batch 37 — ⛏️ Mine floors: zones, a hidden ladder and seals replace the vein's one rock (tasks 252–258, save v36 → v37)

Why: the mine is one rock that re-rolls forever; the only progress is buying vein levels. Toon wants a Stardew-style
descent (decisions 1–3, 30–35): a stack of floors, each a 4 × 3 rock grid whose rows open one at a time, a ladder
hidden under one rock, and zones of 5 floors whose first floor is SEALED at the old vein price. No monsters, HP or
death (M2). Playtest question: does descending a grid with a hidden ladder feel better than the one-rock vein?

Hard guards (blockers, record under `### Deviations` and stop): Fields unlock within ±20 % of the parent commit's
ladder bot (PIN37a); no soft lock (stone always drops, the floor above a seal stays playable); nothing negative;
saves migrate; a migration never takes value away; worker/offline income unchanged with the miners' zone at its
default.

Scope fence (refine call R1): `run.vein` stays and becomes the MINERS' rock (the mine worker's press, `dig`, is
byte-identical); `run.vein.level` stays the number of seals broken = the deepest zone reached, so every gate that
reads it today (furnace :1017, ore sorting :181, Keep N, mine certificate :252, Seam :272, workshop :339, orders
:55/:78) keeps its meaning — decision 29's "max depth reached" holds by construction because zone n's first floor
can only be reached by breaking seal n. The PLAYER mines a new `run.floor` grid instead of `run.vein`.

Words: floor = one grid; zone = 5 floors with one drop table (zone index = old vein level); seal = the locked
passage into a zone's first floor; checkpoint = a zone's first floor once its seal is broken (elevator stop).
Zone names (UI): 0 ⛰️ Stone (floors 1–5), 1 ⚫ Coal (6–10), 2 🔶 Copper (11–15), 3 🔷 Iron (16–20), 4 🌟 Gold (21–25).
Bottom of M1 = floor 25 (decision 34).

Anchors: measured on 60e71680 (origin/main after batch 36.8.1). Context: `docs/DECISIONS.md` "Batch 37 refined".

## Tasks (252–258)

- [ ] 252. **Save v37 and the floor shape (no mechanic yet).** Commit FIRST.
  - `src/core/state.ts:50` RunState gains, next to `vein`:
    `floor: { n: number; deepest: number; rocks: FloorRock[]; ladder: number; found: boolean; rng: number }` with
    `type FloorRock = { kind: ItemId; hits: number; broken: boolean }` (12 rocks, index = row × 4 + col), and
    `minerZone: number | null` (null = the deepest zone, today's behaviour).
    `floor.rng` is the floor's OWN random stream (R2): rolling rocks and the ladder never advances `run.rngState`,
    so every existing random sequence (worker presses, crops, orders) stays byte-identical.
  - New pure roll in `src/core/mining.ts`: `rollFloor(n, mastered, aim, rng): { rocks, ladder, rng }` — 12 kinds
    from `floorWeights(n, mastered, aim)` (task 253) with `nextRandom`, then the ladder index uniform 0–11.
  - `createInitialRun` (state.ts:335–360): `floor` = rollFloor(1, 0, null, FLOOR_SEED) with `deepest: 1, found:
    false`, `minerZone: null`. `FLOOR_SEED` (new, balance.ts) = `0x51f1a2b3` (est., any constant).
  - `src/save/serialize.ts`: SAVE_VERSION 36 → 37 (:39); freeze `RunV36`/`SaveV36`; `migrateV36` (after :948):
    `floor` = rollFloor(5 × vein.level + 1, masteredTiers.length, favours.aim, run.rngState) — the seed COPIES
    run.rngState, never advances it — with `deepest` = that floor, `found: false`; `minerZone: null`; `vein`
    untouched (the miners keep their rock in progress, R3). Chain it on every branch of `migrate` (:957–964).
  - Fixture: `tests/fixtures/save-v36.json` is ALREADY committed (the v35 fixture migrated and re-saved by the live
    v36 build BrEDKfNT; vein Lv4, plain listing). Never edit any file in tests/fixtures. Test it
    and every fixture v1…v36 lands on v37; the v36 one: vein 4 → floor 21, deepest 21, everything else deep-equal.
  - Pins: round trip 37, future 38 (tests/save.test.ts:592–595), App "Will migrate v15 → v37"; every full-run
    literal in tests gains `floor`/`minerZone` (grep `vein: {` in tests/).
  - Prestige (`src/core/prestige.ts:88–90`): a new run starts at floor 1 (createInitialRun); ⛏️ Miner's start
    changes nothing else.
- [ ] 253. **Floor numbers + drop weights (balance.ts only).**
  - New constants next to VEIN_DROPS (:165): `FLOORS_PER_ZONE = 5`, `FLOOR_COLS = 4`, `FLOOR_ROWS = 3`,
    `MINE_BOTTOM_FLOOR = 25` (= FLOORS_PER_ZONE × VEIN_DROPS.length), `FLOOR_ORE_GRADIENT = 0.05` (est., decision 33).
  - `floorZone(n) = min(⌊(n − 1) / 5⌋, VEIN_DROPS.length − 1)`; `zoneFirstFloor(z) = 5z + 1`; `sealFloor(z) = 5z`
    (the floor whose ladder leads into zone z, z ≥ 1).
  - `floorWeights(n, mastered, aim)` = `veinWeights(floorZone(n), mastered, aim)` with every ore weight × (1 +
    FLOOR_ORE_GRADIENT × (n − zoneFirstFloor(zone))), stone absorbing the change like :1179 (coal unchanged, as
    mastery). Floor 21 = exactly veinWeights(4, …); floor 25 = ores × 1.2.
  - Unit pins: floorZone 1/5/6/21/25 → 0/0/1/4/4; floorWeights(21) deep-equals veinWeights(4); floor 25 gold
    weight = 0.08 × 1.2; weights stay ≥ 0 at mastered 3 + aim (stone never negative — guard).
- [ ] 254. **Player floor actions (core).** All in `src/core/mining.ts`; new ActionErrors `NO_LADDER`, `SEALED`,
  `NOT_AT_SEAL`, `MINE_BOTTOM` (actions.ts:45 union + `ERROR_TEXT` in useGame.ts:21, a `Record` — add all four).
  - Extract today's per-press bookkeeping from `dig` (:171–185: energy spend, preserve roll on `run.rngState`,
    durability, `counters.mines`, lifetime, mastery) into a helper both presses call. `dig` stays byte-identical
    (its tests in tests/mining.test.ts must pass unchanged).
  - `mineRock(state, i?: number)`: order NO_MINE_LICENSE, BAD_TILE (i not an unbroken rock of the OPEN row; default
    i = the open row's first unbroken rock), BAG_FULL (that rock's drop, `breakDrop` :147 — Sell-on-dig kinds never
    fail), NO_ENERGY. Hits = `mineHits(tier)`; a rock the pickaxe is too weak for is mined as stone (`minedRock`
    :129), as today. Carry-over (batch 32 rule): leftover hits go to the next unbroken rock of the open row left to
    right, then into the next row once it opens; a drop that hits full storage stops there at full progress
    (remaining hits lost), like :193. The open row = the first row with an unbroken rock (rows open in order).
  - Breaking the ladder rock sets `found: true` (its item still drops). When all 12 are broken the floor re-rolls in
    place (same n, `rollFloor` on `floor.rng`); `found` stays true if it was (R4).
  - `descend(state)`: NO_LADDER (!found), MINE_BOTTOM (n = 25), SEALED (n + 1 is a zone's first floor and that zone
    > vein.level). Else n + 1, deepest = max, fresh roll, found false. No energy.
  - `breakSeal(state)` replaces the player's use of `upgradeVein` (:296–304): NOT_AT_SEAL unless found and
    n = sealFloor(vein.level + 1); then `upgradeVein`'s checks and price unchanged (MAX_LEVEL, NO_FURNACE,
    NO_IRON_PICKAXE, NOT_ENOUGH_ITEMS, NO_CASH); success = vein.level + 1 AND the player moves to the new zone's first
    floor (fresh roll). `upgradeVein` stays exported for tests; nothing in src/app calls it after task 256.
  - `rideElevator(state, zone)`: LOCKED (zone > vein.level), BAD_SLOT (already on that zone's first floor with an
    untouched grid — free no-op guard); else n = zoneFirstFloor(zone), fresh roll, found false. Free, no energy.
  - `setMinerZone(state, zone | null)`: LOCKED unless null or 0 ≤ zone ≤ vein.level. `minerZone(run)` = run.minerZone
    ?? run.vein.level. `dig` rolls from `veinWeights(minerZone(run), …)` (:186); orders.ts:55 and :78 read
    `veinDrops(minerZone(run))` (decision 29: orders size from the miners' floor). favours.ts:126 (Seam aim) keeps
    vein.level. With minerZone null all three are byte-identical.
  - Tests (tests/mining.test.ts, new `describe('batch 37: floors')`): same seed → same grid and ladder; over 2,000
    seeds the mean rocks broken to find the ladder (mining in order) is 6.5 ± 0.3; rows open in order; carry-over
    across rocks and rows; BAG_FULL leaves full progress; every error order above; descend into a sealed zone fails
    and the floor stays playable; breakSeal only at floor 5/10/15/20 with found; elevator; minerZone default and set;
    `run.rngState` unchanged by rolls.
- [ ] 255. **Sim bot + pins.** `tests/sim/bot.ts`:
  - The hand press (:914) becomes `mineRock(s)` (the open row's first rock); after a successful press: if found and
    n < sealFloor(vein.level + 1) → `descend`. The ladder goals `veinLv1…4` (:305/:308/:377/:453) buy with
    `breakSeal` (keep their names and keep() prices). So the bot dives to the seal floor of the next zone, mines
    there until the seal is affordable, breaks it. `cashPerEnergy` (:1184–1222) keeps `dig` (miners' path).
  - New pins in `tests/sim/mine-estate.test.ts` (one `describe('batch 37')`):
    PIN37a — plain ladder bot (the same options as the existing Fields pin): Fields unlock within ±20 % of the
    parent commit's value (measure it on 60e71680 first and write both into the results; Hermes's probe on e9590304
    gave 7.65 h). PIN37b — vein (seal) Lv1–4 ticks reported next to the parent's (0.23 / 0.50 / 1.51 / 4.44 h on
    e9590304). PIN37c — the bot is never stuck on a floor > 10 game-min with ⚡ full and nothing bought (stall guard).
  - Every other moved sim number: re-pin old → new with its cause; a failing correctness guard is a blocker.
- [ ] 256. **Mine card UI (src/app/Mine.tsx, app.css).** Replace the Dig button block (Mine.tsx:534–552) and the
  vein block (:607–647) with:
  - Status line (one `<p className="floor-status">`): `Floor 13 · Row 2/3 · ⛏️ 5 left · ⬇️ not found` /
    `⬇️ found`. Emoji ≤ Unicode 11 (🪨 and 🪜 are 13 — banned, items.ts:27).
  - `.floor-grid`: 4 columns × 3 rows of rock buttons (`ITEMS[kind].emoji`, `hits/need` small; a too-weak rock shows
    "🔷 as ⛰️" as :480 does). Broken = empty cell; locked rows `aria-disabled` + dimmed; each rock ≥ 44 × 44 px; the
    grid fits a 344 px column at 375 (4 × 44 + 3 gaps ≤ 200 px). A tap = `mineRock(s, i)`; the old ⛏️ Dig button
    stays as "⛏️ Mine next" (default rock) so one-thumb play works (R5). `minerActed` flash/pop moves to the miners'
    line.
  - `⬇️ Down to floor N+1` button when found; when the next floor is sealed: the seal block instead —
    `🔒 Seal to floor 6 · ⚫ Coal zone: <priceText>` + `Break seal` button with the same disabled reason logic as
    :485–489 (storage-too-small text kept). At floor 25: "The way down is blocked… (deeper zones come later)".
  - `↕️ Elevator:` one button per built checkpoint (`Floor 1`, `Floor 6`, …), pressed = current.
  - Drop line: `Floor 13 · 🔶 Copper zone:` + the dropText of `floorWeights(n, …)` (today's `.vein-drops` spans).
    Seam row unchanged.
  - Miners line (only with ≥ 1 mine worker or the certificate): `⛏️ Miners: <zone name> zone (floor F)` + a small
    select of built zones + `Deepest` (default). Shows their rock as today's `:538` text.
  - `src/app/Upgrades.tsx:52–90`: the vein row becomes info only — `⛏️ Zone L/4 · next seal at floor X: <price>`
    (no button; seals are broken in the mine). `badges.ts:56`: badge when `breakSeal(state).ok`.
  - Texts that say "vein Lv": Workers.tsx:40 → `<zone name> zone`; Favours.tsx:65 → `needs the 🔷 Iron zone`;
    stats.ts:127/:173 → miners' zone + "deepest floor N"; milestones.ts:82–85 labels → `⚫ Coal zone` … `🌟 Gold
    zone` (ids unchanged); tips.ts:68 (`vein`) → floors/ladder/seal tip; :70 and :95 → "the gold zone".
  - jsdom tests (tests/Mine.test.tsx new describe): grid renders 12 cells, locked rows disabled, tap mines that
    rock, Down/seal/elevator states, the 375 class names exist in app.css (appCss pin). No browser: list unverified
    widths under Deviations; Hermes sweeps 375/1024/1440/2560/3440 live.
- [ ] 257. **CHANGELOG + docs.** One entry at the TOP of `CHANGELOG` (≤ 180 code points), exactly:
  `⛏️ The mine has floors: find the hidden ⬇️ ladder in each 4×3 grid, break a 🔒 seal to enter each new zone. Your vein level became that zone's first floor.`
  (count it with Python `len()`; Hermes counted 154).
- [ ] 258. **Results.** `## Batch 37 results` + `### Deviations` at the true end of docs/PLAN.md: one line per task
  with SHAs, PIN37a/b numbers (parent vs this), every re-pinned sim number old → new with cause, unverified UI.

Not in this batch (later): monsters, HP, flee, death, dive bag (M2); gear, food, attributes (M3); ⛏️ relics (M4);
miners following the dive + offline (M5); bonus zones below 25 and the 💎 set (M6); turning ore sorting / Keep N /
bars Keep N into milestone upgrades (open item, own decision).
