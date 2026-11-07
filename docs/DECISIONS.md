# Design decisions (agreed in Discord thread, 2026-11-07)

These override the PRD where they differ. Source PRD: `docs/PRD.md`.

## Project
- Name: **tiles**. Platform: web (mobile browser must work). Side project, not part of TQM work.
- Stack: Vite + TypeScript + React, Vitest. No Phaser yet (80% of the game is UI/menus + a 6–24 tile grid; DOM is enough). Phaser may be added later for farm visuals because the core is UI-independent.
- No incremental framework (Profectus etc.): they are layer/prestige/big-number engines; this is a management sim with normal-range numbers. We borrow *patterns* only: tick loop, offline catch-up, JSON save + version migration.

## Time model
- **Real-time idle**, no day/night. Core logic advances in fixed **1-second ticks**: `step(state, ticks)`. UI may render at any rate.
- "Daily" costs from the PRD (wages, maintenance, loan interest, market recovery) become **per-second rates**, charged continuously. No end-of-day summary screen (a 60 s "payroll" pulse may be added later; rates make both possible).
- **Offline progress** on load: simulate missed ticks, **capped at 8 hours**. Every system runs during catch-up (crops rot, wages charged) — coming back to rotten crops is the push toward buying a harvester. Emergency Power Off (PRD 4.1) stops cash going deeply negative.

## Energy
- Start max 20, regen 1 per 3 s, each manual action costs 1. Max and regen are upgradable (first shop upgrades). All numbers are starting values to tune in playtest.

## Water (changed from "water once at plant")
- Each tile has a **moisture bar**. Watering fills it; it drains over time (start: empty in 60 s).
- Crops **grow only while moist**. Dry = growth pauses (no death, no rot from dryness).
- Tune so the first crop needs ~2 waterings per growth cycle: repetitive enough to want help, not a clicker.
- Later: **Sprinkler** = tiles in range never drain (maintenance per second). **Waterer worker** = waters the driest tile one at a time with delay, cheaper but imperfect. General principle for every manual action: worker = slow substitute with wage, machine = instant substitute with maintenance. That ladder is Phase 1 → 2 → 3.

## Rot
- On-field rot grace window = **2× that crop's grow time** (fast crops rot fast, expensive license crops last longer).

## Tiles
- Buy tiles one at a time, geometric price. Start 6, cap 24 for now.

## Prestige / end game
- Undecided, but likely later. Prepare now at ~zero cost:
  1. State split into `run` (resettable farm) and `meta` (survives prestige).
  2. Every balance number (prices, wages, grow times) goes through one multiplier function in `core/balance.ts`; never hardcoded at use sites.

## Process
- Planned and tracked in the Discord thread, not ClickUp/Kanban.
- Prototype first: Phase 1 only, answering one question — is the manual loop fun enough to make the player want a sprinkler? If not, fix the loop before Phase 2.


## Round-1 playtest changes (2026-11-07, see docs/PLAYTEST.md)
- **Start: 9 tiles, energy max 10** (regen unchanged 1 per 3 s). Tile cap stays 24.
- **Watering any time.** Tapping a planted, moist tile refills moisture to 1 (costs 1 energy). The player decides
  whether to top up early. Replaces "tapping a moist tile does nothing".
- **Planted tiles show their crop** (emoji + name) while growing, and harvest shows a toast "+💰N <crop>".
  Taps on a tile are ignored for a short guard window after a harvest, so a double tap cannot replant.
- **Milestone unlocks.** Run state keeps counters (`harvests`, `sales`, `digs`, …). Some shop items are hidden
  until a counter passes a threshold, then bought with cash as usual:
  - `sellPrice` upgrade (+10 % per level): unlocked after 25 sales.
  - `fertilizer` upgrade (−10 % grow time per level): unlocked after 15 harvests.
  Thresholds are starting values; tune in playtest.

## Mining (fills idle energy while crops grow)
- Why: the player waits for crops with nothing to spend energy on. Mining is the energy sink while waiting and
  the source of **materials**, so later upgrades cost money *and* materials instead of money alone.
- **v1 (batch 3):** buy a mine license (cash) → buy wood (cash) → craft a wooden pickaxe (wood) → dig (1 energy,
  1 pickaxe durability) → 1 random drop into the inventory → sell items for cash. Pickaxe breaks at 0 durability;
  craft another. Inventory has a capacity (upgradable later); digging with a full bag fails with a typed error.
- **Stone vein v1 drops 100 % stone.** Vein upgrades add ores and shift the table (batch 4). Drop table lives in
  `balance.ts`; the RNG is injected (seeded PRNG in run state) so the core stays deterministic and testable.
- **Balance rule:** mining cash per energy must stay below farming cash per energy (it is a filler, not the main
  loop); stone's real value is as a material later. Sim must assert this.
- **Later (not v1):** vein upgrades (stone → coal → iron …; the player's 98.5/1/0.5 % idea is too slow for a
  ~20 digs/min energy budget — first non-stone drop should land within ~3 minutes of digging), stone pickaxe,
  furnace (ore → ingot, fuel = wood or coal, capacity/fuel upgrades paid in cash → stone → ingots), forge
  (ingots + cash → tool tiers: watering can / hoe / seeder acting on 2+ tiles per energy).

## Automation (moved after tooling)
- Sprinklers, seeders, harvesters and workers come **after the forge**, are crafted from materials in quantity,
  and pay running costs (water/power). The PRD's "Phase 2 semi-auto" dissolves into: manual → tooling → automation.

## Round-2 changes (2026-11-07, see docs/PLAYTEST.md round 2)
- **Desktop-first responsive layout.** The game is meant to be played full-screen on desktop; mobile is a shrunk
  version. Breakpoints: ≥ 1024 px three columns (mine left, farm centre growing with the viewport, side panel right
  with tabs Shop / Upgrades / Bank that collapses so the farm takes the space); 768–1023 px farm + mine side by
  side, side panel as a slide-over; < 768 px one view at a time with a bottom tab bar (Farm / Mine / Shop /
  Upgrades / Bank) and the HUD (cash, energy) sticky on top. Why: the 480 px single column wasted the desktop screen
  and every new system (mine table, mastery, bank) needs its own space.
- **Upgrades are a separate tab from Shop.** Shop = seeds, licenses, wood, tiles. Upgrades = energy, sell price,
  fertilizer and every later upgrade (mastery, vein). UI-only state (open tab, panel collapsed) lives in its own
  localStorage key `tiles.ui`, never in the game save.
- **Bank v0 (rough, numbers pending research).** Fixes the round-2 soft-lock now; hand digging (batch 5) will add
  a free floor later. One loan at a time, borrowed from a Bank tab. Debt starts at principal × (1 + fee) and grows
  linearly per tick while unpaid, capped at 200 % of principal (Toon's cap). Partial or full repayment any time;
  no forced collection in v0. Interest accrues inside `step`, so offline catch-up charges it too. All numbers in
  `balance.ts`; tuned after the round-2 research (docs/research/round2-mining.md).
- **Pending research (Fable, round 2):** hand digging (stone = 2 hits; hand 1 hit/energy, pickaxe 2), per-tool-type
  mastery (chance to preserve durability, cap ~90 %), visible locked drop table, vein Lv1, logging. Batches 5–6 are
  planned after the research returns.

## Round-2 research outcome (2026-11-07, docs/research/round2-mining.md, Fable)
Accepted by Toon after the research; batches 5–6 implement these (PLAN.md).
- **Dig (soil) ≠ mine.** *Dig* = a farm action, button "🪏 Dig for seeds" in the Farm view (not a tile tap), free from
  tick 0, 1 energy, 20 % chance of a radish seed. Dug seeds cannot be sold, only planted. This is the anti-soft-lock
  floor: a broke player with energy always gets back to farming. Dig mastery: **undecided**, revisit after playtest.
- **Mine still needs the license** (50). After it, hand mining works with no pickaxe. Stone = 2 hits; hand = 1 hit
  per energy, pickaxe = 2 hits per energy. Show a crack on a half-mined stone.
- **Pickaxe mastery per tool type.** 1 XP per mine action with that tool; thresholds (cumulative) 10/25/45/70/100/
  140/190/250/320/400 → Lv1–10. Preserve chance (durability not consumed) = 1 − 1/(1 + 0.4·L), cap 80 % at Lv10, so
  expected lifetime = 25 × (1 + 0.4·L): each level adds 10 uses (25 at Lv0 → 125 at Lv10). UI shows "lasts ~N uses", not %. A new
  tool tier starts its own mastery at Lv0 with doubled thresholds; a global `mines` counter keeps total progress.
- **Wooden pickaxe durability 25** (was 20); wood price stays 4 (resell 2, no arbitrage).
- **Always-visible drop table** in the Mine panel: current vein with %, next vein level greyed with its cost.
- **Vein Lv1** = 40 stone + 100 cash → 80 % stone / 20 % coal; **coal sells 4**.
- **Seed stock.** Seeds live in a seed pouch (not counted against the bag). Buy ×1 / ×10. **Auto-buy on by
  default**: planting with 0 stock buys one seed if affordable (today's behaviour).
- **Loan: no interest while offline.** Debt grows only on live ticks; offline catch-up does not grow it. Everything
  else in bank v0 stays.
- **Radish displays as "Carrot"** (matches 🥕; Unicode has no radish). Internal id stays `radish`, no save migration
  for the name.
- **Hierarchy the sim must prove (cash per energy):** dig (~0.4, seeds valued at buy price) < hand mining (1.0) <
  pickaxe Lv0 (~1.5) < pickaxe Lv10 (~1.9; ~2.3 on vein Lv1) < farming (~2.7). Assert max mining < 0.9 × farming.
- **Later:** logging (chop wood), dig mastery.

## Farm tools (2026-11-07, player feedback: "too lazy to watch tile by tile")
- One-time upgrades per job — **water, harvest, plant** — each with three levels: **1 tile per press → n tiles per
  press → all tiles**. Till has no tool (a tile is tilled once). Unlocked by the job's milestone counter, bought once.
- Level 2: the player sets n (1 … ⌈tiles × 1/3⌉; ratio in `balance.ts`, may become 1/2). Tiles are picked by
  priority, never by row (rows change with layout and tile count): harvest ripe-longest first, water driest first,
  plant first empty tilled tile.
- A tool press costs exactly what the manual actions cost (1 energy per tile, seeds). It saves taps, not resources,
  so the cash/energy hierarchy is unchanged. Short on energy/seeds/cash → do as many as possible and say so.
- Names: Watering Can → Garden Hose → Water Cart; Sickle → Scythe → Reaper; Dibber → Seed Drill → Seed Spreader.
  ("Sprinkler" stays reserved for post-forge automation.)
- Workers (research: docs/research/workers.md) come later and remove the press itself; tools first keeps the
  ladder manual → tooling → automation.

## Save compatibility (2026-11-07)
- Players never restart because of a patch. Balance numbers live in `balance.ts`, not the save, so rebalancing
  needs no migration; only shape changes do.
- Every shape change: bump `SAVE_VERSION`, add `migrateVn`, keep a real fixture of every past version and test the
  chain from each fixture to the latest. Migrations never take earned things away; when a field changes meaning,
  convert in the player's favour (e.g. old `digs` = mine actions → `mines`, new soil `digs` starts at 0).
- Before migrating, `storage.ts` keeps the raw old save under `tiles.save.backup.v<old>` so a buggy migration can
  be repaired by a later patch.
- Hermes verifies on the live build: capture a save from the current Pages build before deploy, reload it after.
- A save reset happens only when Toon decides it; prestige wiping `run` but keeping `meta` is design, not a reset.

## Round-4 research outcome (progression, 2026-11-07, docs/research/progression.md, Fable)
- **Layer ownership:** convenience tools (batch 5) own taps per press · material tiers own what a tool can do ·
  mastery owns the running cost of a consumable (durability) · workers own who presses · milestone upgrades own
  global rates (price, grow time, energy). A new upgrade must name the axis it owns; two layers never share one.
- **Ingot tool upgrades = a distinct effect per job, not a flat energy cut** (flat cuts duplicate energy upgrades and
  need fractional energy). Starting direction for copper/iron/gold: watering can moisture ×2/×4/×8, sickle
  double-harvest 10/20/30 %, dibber seed-keep 20/35/50 %, pickaxe deeper veins in one hit + durability 200/500/1200.
  Numbers are set with the furnace batch.
- **Ore from deeper veins sells for ≤ 1;** its value comes from smelting, so new pickaxe tiers never lift mining
  cash/energy above farming.
- **Mastery stays per pickaxe tier (Toon), with a mastered reward:** each tier mastered (Lv10) adds +5 % preserve
  chance to every pickaxe tier, permanently, inside the 80 % cap. No reset-feels-like-downgrade problem as long as
  every new tier's base durability exceeds the previous tier's Lv10 lifetime (wood Lv10 = 125 < copper 200).
  Prestige carry-over of the reward: decided with prestige.
- **No farm-job mastery, no dig mastery, no shovel tiers** (Fable): per-job counters are shown as the job's
  experience on the tool card instead.
- **Durability 0 = blunt, not destroyed** (Toon: break-and-vanish is too harsh): repair costs less than crafting
  (wooden: 2 wood vs 3); later tiers repair with their ingot.
- **Cash/energy hierarchy has two tiers** (the sim measures carrot farming at ~2.0, not the 2.7 estimate): hand
  mining and pickaxe Lv0 stay below carrot farming; pickaxe Lv10 and vein upgrades stay below pumpkin farming —
  mastery takes ~35–45 min, by which time the pumpkin license is affordable. Mining is for materials, not money.
- **Batch order:** 6 mining progress → 7 furnace + ingot tool upgrades → 8 workers (manual play with more energy and
  the n/all tools carries the farm until then; Toon). Furnace/crafting details are designed after batch 6 playtest.
- **Crops:** Chilli 🌶️ and Lemon 🍋 join carrot and pumpkin (batch 6, starting numbers; order carrot < chilli <
  pumpkin < lemon by cash/energy and license cost).
- **Stone sink:** Storage upgrade (+10 slots, 20 stone + 50 cash, ×1.6 per level, max 5); "Bag" displays as "📦 Storage". Worker certificates add more stone sinks later.
- **Stone prices fit storage (2026-11-07):** storage stone cost +5/level (15…35) and vein Lv1 = 25 stone, because 40 stone with 20→30 capacity was unbuyable. Every stone/ore price must be ≤ the capacity the player has when it becomes buyable (sim-enforced).
- **Shop vs Upgrades (2026-11-07, Toon):** Shop = things you buy to own (incl. farm tools); Upgrades = numbers that go up, grouped Energy / Farm / Mine, each row "now → next" plus an ⓘ tip (hover desktop, tap mobile). Farm tool action buttons stay next to the farm (right-edge bar on desktop, bar above the tab bar on mobile).

## Round-5 research outcome (furnace, 2026-11-07, docs/research/furnace.md, Fable)
- Metal ladder copper (vein Lv2) → iron (Lv3) → gold (Lv4); batch 7 = copper only; 7.1 = copper farm tools
  (watering can moisture ×2, sickle double-harvest 10 %, dibber seed-keep 20 %; 4 bars + cash each).
- **Recipe: 2 ore + 1 fuel → 1 bar, 60 s** (Forager-like; 5 ore would mean ~38 mines per bar at 15 % copper).
  Fuel = 1 coal or 2 wood (wood costs 8/bar vs coal 4 — fallback only). Coal stays sellable at 4.
- **Furnace = 20 stone + 5 coal + 150 cash**, buyable right after vein Lv1 within storage 30; it unlocks vein Lv2.
- **Vein Lv2 = 30 stone + 10 coal + 200 cash → 65 % stone / 20 % coal / 15 % copper ore; copper rock = 3 hits.**
- **Copper pickaxe = 5 bars + 50 cash, durability 200, 3 hits/energy, repair 2 bars.** Expected ~30–55 min of play.
- **Queue:** cap 5 jobs, inputs paid on enqueue, output tray, 0 energy, closed-form catch-up, no RNG. Bars never sell.
- Open: the tier-durability rule breaks at iron (copper Lv10 = 1000 uses > iron 500) — revisit at iron. Auto-smelt
  toggle comes with workers (batch 8).
- **Stats tab (Toon, 2026-11-07):** lifetime totals and every current multiplier with its source, computed by the same balance functions; new lifetime counters ride the v6 migration.

## Copper farm tools (batch 7.1, 2026-11-07, Toon go)
- **Material tier is an axis of the job, not a new tool:** `toolTier[job]` (0 basic, 1 copper) sits beside the tool
  level (1 tile / n / all). It changes what each action does, so it applies to tile taps and tool presses alike and
  adds no button. Requires that job's tool Lv1 so the copper row has an obvious place in the Shop.
- **Effects (starting numbers, from Round-4/5):** copper watering fills moisture to 2 (one water per 120 growth ticks
  instead of 60); copper sickle 10 % double harvest; copper dibber 20 % seed kept. Cost 4 copper bars + 💰100 each
  (cash number is a Hermes pick, tune via the sim). Iron/gold later: moisture 4/8, 20/30 %, 35/50 %.
- **Tool bar n-step control moves into a popover** (long-press / right-click / ⋯) so the bar is one button per job
  at every level and fits 375 px; found on the live 6.2 build (one stepper overflowed ~30 px).
- **The UI fixes ride in 7.1 instead of a separate 6.3** (Toon): the copper work touches the same tool bar, so it is
  laid out once.

## Farm tab (batch 7.2, 2026-11-07, Toon)
- **Desktop: farm actions move into a first side-panel tab "🌾 Farm"** (tool buttons, crop picker, seed pouch, dig
  for seeds); 🛒 Shop is only for buying. Supersedes the 6.2 rule "tool buttons on the right edge of the Farm column"
  for the desktop layout. Why: Toon wants everything he presses while farming in one place, and picking a crop is
  not a purchase.
- **Mobile keeps the bar above the tab bar:** farm and side panel are separate tabs there, so putting the buttons in
  a tab would mean switching tabs on every water/harvest.
- **Wood icon is one constant** (🪵 is missing on some fonts; it showed as ▯ on Toon's device).

## Workers v1 (batch 8, 2026-11-07, Toon go; details are Hermes picks from docs/research/workers.md)
- **Scope: water + harvest workers only** (the two chores; offline value). Plant and mine workers later, with
  certificates priced in furnace/forge outputs, so manual → tooling → automation still holds. Never a dig worker
  (dig for seeds is the anti-soft-lock floor).
- **Pool +1 per hire, 💰80 × 1.7^(n−1), cap 6;** certificates water 💰100, harvest 💰150 + 20 stone, gated by 40
  waters / 40 harvests; hire visible after 30 harvests.
- **Wage 💰1 per action, paid at the action; no cash = the worker idles** (never debt, never a loan). Speed 1 action
  per 5 s on their own clock, no player energy — a worker is a slow substitute (12/min vs the player's ~20/min).
- **A worker does the job's own action, so the job's copper tier applies** (a copper can's worker waters to 2 and
  needs half the actions, i.e. half the wages).
- **Auto-smelt = free furnace toggle, coal only,** enqueues and collects by itself; wood stays manual so repair wood
  is never eaten.
- **Workers live in the 🌾 Farm tab (desktop) / below the grid (mobile)** with their certificates and hire button,
  not in Shop: everything about who presses on the farm stays in one place, and no 7th tab is added.

## Floating tips + stacked tool rows (batch 8.1)

- **ⓘ tips float (`position: fixed`) instead of sitting in flow**: an in-flow tip pushed the rows below it; a plain
  `absolute` tip is clipped by the scrolling side panel. Fixed + placed from the ⓘ rect + flipped/clamped to the
  viewport gives neither problem.
- **Desktop Farm tab tool rows are stacked, Plant / Water / Harvest, with − / count / + on each row** (Toon): the
  order follows the farm loop, and direct −/+ replace the hidden ⋯ popover on desktop. Level-1/3 rows keep empty
  −/+ slots so the press buttons line up.
- **Mobile keeps the single-row bar + ⋯ popover**: three stacked rows would be ~132 px plus the 56 px tab bar,
  covering almost half the farm on a 375 px phone.

## Fuelled furnace + furnace workers (batch 9)

- **The furnace burns fuel over time** (Toon): fire is a gauge filled by the player, wood = 1 unit, coal = 2 units,
  one bar = 2 units, so cost per bar is unchanged. A plain furnace burns whenever the fire is lit, ore or not — the
  loss is bounded by the fire cap (start 10 units), so leaving the game never costs more than one tank.
- **Free auto-smelt toggle removed** (too easy): automation follows manual → tooling → automation like the farm.
  Manual first (load ore, fill fuel), then **ore loader** (certificate 🥉3 + 💰100 after 10 bars; it also collects the
  tray), then **fuel loader** (🥉8 + 💰200 after 30 bars; coal only, wood stays manual for pickaxe repairs), then the
  **smart furnace** upgrade (fire burns only while smelting). Both loaders + plain furnace still waste fuel when ore
  runs out — that gap is what the smart furnace buys. Toon chose certificates for both loaders over a free one.
- **Furnace upgrades:** fire capacity and bars per cycle, priced in copper bars + cash, next to the furnace like the
  vein upgrade. "Fire burns slower" was not added: smart furnace already removes the waste.
- **v8 → v9:** paid queued jobs become ready bars (nothing paid is lost); autoSmelt is dropped (free toggle).
- **Worker targets are shown, not walked:** a dashed ring on the next tile and a short flash when a worker acts.
  Farm rows are not stable across widths, so no walking figures. Targets are derived from state, never saved.
- **Progress bars ease between 1 s ticks** (CSS transition while growing, jump on reset, off for reduced motion).
