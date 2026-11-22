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

## Plant worker (batch 10)

- **Plant worker before iron, priced in copper bars** (🥉10 + 💰300 after 60 plants): water and harvest workers come
  before the furnace, so gating planting behind iron would leave the farm half-automated for a long time and keep
  the 8 h offline gap. Copper bars still force the mine → furnace path first.
- **A worker's action = the player's tap on that tile** (till, else plant the selected crop), with the same seed
  pouch and auto-buy rules, so no new rule exists that the player cannot see.
- **No dig-for-seeds worker, confirmed again (Toon agreed):** dig finds a carrot seed 20 % of the time, so at 💰1 a
  dig a worker pays ~💰5 for a 💰2 seed; a free one prints seeds; and the dig floor exists for broke players, who
  cannot pay wages. Revisit only if digging gets better drops.

## Iron tier + mine worker (batch 11)

- **Mine worker waits for iron** (Toon + Hermes): it makes the whole mine → furnace → bars chain run alone, the
  biggest automation step, so it sits one metal tier above the farm and furnace workers. Its certificate is paid
  in iron bars (furnace/forge outputs, per the batch-8 scope rule).
- **Iron pickaxe durability 1200**, not the earlier 500 guess: the existing rule "each tier's base durability beats
  the previous tier's Lv10 lifetime" is kept (copper Lv10 = 1000), which closes the open question from round 5.
- **Iron needs a copper pickaxe or better**; the furnace smelts one ore kind at a time (player picks); iron costs
  twice the fire of copper per bar.
- **Iron farm tools are a later batch** (moisture 4, 20 % double harvest, 35 % seed keep were the round-4 numbers).

## Iron dev-gate (after batch 11, Toon)

- **Iron ships switched off on the live site.** `src/app/devFlags.ts`: without `?dev=iron` (remembered in localStorage
  `tiles.dev`, cleared by `?dev=off`) the upgrade to vein Lv3, the iron-rock hint, the locked ⛏️ mine-worker row and
  zero iron stats are hidden, and the vein line shows the old "🔒 Lv3: iron ore — coming" teaser. UI only: core, save
  v11 and every number are unchanged; a player already on vein Lv3 sees everything. Remove the gate when iron is ready.

## Feedback form + reset confirm (batch 11.1)

- **Feedback goes to Toon's Google Form** (no backend on GitHub Pages; no secret in the bundle; responses kept in the
  form's sheet). Mail with a `[tiles] <kind>: <title> (<build>)` subject comes from an Apps Script on the form that
  Toon owns, outside the repo. Rejected: Web3Forms/Formspree/EmailJS (third-party quota, no history), Discord webhook
  (public URL = spam), mailto (no mail client on most phones).
- **no-cors POST:** the game cannot read the reply, so "Sent" means "the request left"; network errors keep the text.
- **Context is a summary, not the save** (build, save version, screen, UA, one-line game summary).
- **Reset lives in 📊 Stats under Feedback** with a two-press in-game confirm and a `tiles.save.backup.reset` copy.

## Crop market, timeline, deed meter (batch 12, 2026-11-08, Toon go)

- **Why now, before more content:** real players idle after two workers and one holds 💰1M+ (Toon's field report).
  Every planned batch adds automation, so the economy is fixed first. Research: docs/research/cash-sinks.md,
  fields-market.md, pacing-liveops.md, orders.md, prestige.md.
- **Market = glut per crop, 30 min half-life, 50 % floor (PRD §4.2), depth 120 tiles.** A 24-tile one-crop farm
  sits at ~90 %; spreading crops keeps prices up. Items (stone/coal/ore) stay out of the market. The price is
  always shown before the sale (a hidden curve read as a trap in Graveyard Keeper; a visible bar read as a
  puzzle in Slime Rancher).
- **Rich players are not touched:** no cash is taken, nothing is priced by wealth. New late content is gated by
  materials (bars cannot be bought with cash); the deed meter shows what a big lifetime total will be worth
  when prestige ("Sell the farm", deeds = ⌊√(lifetime cash ÷ 10,000)⌋) opens.
- **Feedback without a backend:** milestones (tick reached) are recorded in the save from v12 on; Stats shows a
  timeline and a "Copy report"; Export/Import save (base64) lets a player paste their save. Milestones are a table
  of predicates over state, so a new feature adds one row, never a special case. Nothing is back-dated.
- **Meta stores levels, not multipliers** (prestige research): multipliers are derived in balance.ts so prestige
  can be rebalanced without a migration.
- **Iron stays hidden** behind `?dev=iron` until batch 13 (early-game pacing) is live.
- **Plan after this (Toon, 2026-11-08):** 13 pacing (certificates need the job's Lv3 tool, repriced certificates
  and hire, hand-picked ×1.25) and lifting the iron gate; 14 orders board + ⭐; 15 iron farm tools; 16 gold;
  17 Workshop + sprinklers (coal pump); 18–19 Fields; 20 prestige. No playtest pauses: players' feedback is read
  back from their reports. Sim pin: no unlock step longer than 60 game-minutes.

## Early-game pacing, hand-picked bonus, iron opens (batch 13, 2026-11-08, Toon go)

- **A worker replaces a press, so the press must exist at its top level first:** a farm job's certificate needs
  that job's level-3 tool (research docs/research/pacing-liveops.md A1). Water worker lands ~16 min, harvest ~40 min
  instead of 5–19 min. Owned certificates/workers are never taken back.
- **First automation costs 5–10 min of income at unlock** (AdCap-style): water 💰500 + 20 stone, harvest 💰750 +
  20 stone + 5 coal, hire base 💰150. Cash-only, no migration; rich players unaffected.
- **Hand-picked ×1.25:** what the player harvests (energy spent) sells at 1.25 × the market price; workers ×1. Active
  play pays, offline loses nothing (8 h offline loss = 0). Applied after the market factor so it never bypasses it.
- **Iron opens to everyone** in this batch (the `?dev=iron` gate from batch 11 is removed).

## 📋 Noticeboard + ⭐ (batch 14, 2026-11-08, Toon go)

- **⭐ is paced by time, not tile count:** an order's count = minutes × the player's current capacity, so ⭐ per hour is
  about the same for a 9-tile carrot farm and a 24-tile lemon farm; ⭐ prices stay meaningful for rich players.
  Cash cannot buy ⭐ and nothing bought with ⭐ sells for cash (docs/research/orders.md).
- **Orders are the market's outlet:** ordered crops bypass the glut and pay base × 1.25 (hand-picked ×1.25 still
  applies on player harvests). Item orders are delivered from storage with one press.
- **No timers, no expiry** (Hay Day boat-timer complaints): 8 h offline loss = 0. Discard is free; the slot refills
  after 10 min counted in step().
- **Order clerk = a worker** (⭐ + bar certificate, after 20 orders) that accepts and delivers but never discards;
  no machine tier.
- **⭐ shop v1 = slots, reroll token, clerk.** Themes/name plate wait for art. Board placed at the top of the 🌾 Farm
  side tab (no 7th tab: 375 px is full).

## Iron farm tools (batch 15, 2026-11-08, Toon go)

- Iron is the last watering can (no gold can: worker + iron can beats a sprinkler on 24 tiles, research
  docs/research/sprinkler-gold.md); gold later only for sickle 30 % and dibber 50 %.
- Numbers: moisture 4, double harvest 20 %, seed keep 35 %; price 4 iron bars + a cash part the sim sets to 0.5–1.5 h
  of measured income at unlock (rounded to 💰500). Workers use the tier like the player.
- No save change: `run.toolTier` is a number per job.

## Economy retune + gold tier (batch 16, 2026-11-08, Toon go: retune items not rejected)

- **Order bonus 0.25 → 0.10, market depth 120 → 60:** batch 14's sim measured the board adding +27–41 % income
  (research expected +12–18 %) and depth 120 touching a 24-tile farm by only −4…5 %; both work against the goal of
  slowing cash inflation. ⭐ rates are untouched. Depth 60 must make a 2-crop split ≥ mono at 24 tiles (sim pin);
  if mining ≥ 0.9 × farming at depth 60, raise depth in steps of 10 until the hierarchy pin holds.
- **Gold:** vein Lv4 (stone 45 + iron bars 8 + cash set by the sim; needs the iron pickaxe), drops stone 50 / coal 20 /
  copper 12 / iron 10 / gold 8 %, gold rock 5 hits; gold bar 2 ore + 6 fire; gold pickaxe 5 bars + 💰500, durability
  6,500; gold farm tools = sickle 30 % double + dibber 50 % keep ONLY (no gold can: worker + iron can already covers
  watering, docs/research/sprinkler-gold.md). Orders pool and milestones extend through their tables.
- **Price rule:** every new cash price = 0.5–1.5 h of the ladder bot's measured income at that unlock, rounded to
  💰500 (batch 15 set IRON_TOOL_CASH 10,000 the same way).

## Workshop + sprinklers (batch 17, 2026-11-08, Toon go)

- The sprinkler is the machine tier of WATERING only: its value is returning a worker slot (pool cap 6) and eating
  coal so the mine stays loaded — not saving wage money (wages are 0.8–3 % of profit, docs/research/sprinkler-gold.md).
- Coverage counts TILES, never rows/radius (columns change with viewport): each machine auto-waters the 6 driest
  growing tiles every 5 s at iron-can moisture. Max 4 machines. No placement UI.
- Coal pump: ~12 coal/h per machine, hopper 24 (≈ 2 h); the EXISTING fuel loader refills hoppers below half (no new
  worker job). No coal → crops stall, never die; worst-case 8 h offline loss is bounded by hopper coal (sim reports
  the number). Smart valve (gold 2) holds moisture while a machine is stalled.
- Gold can stays unreleased (worker + iron can already covers watering). Workshop recipes are visible greyed with
  per-material reason lines — no hidden or random recipes.
- Cash prices set by the sim per the standing rule (0.5–1.5 h of measured income at unlock, rounded to 💰500).

## Fields part 1 (batch 18, 2026-11-08, Toon go: numbered items 1–3 not rejected)

- **Fields is the earned late game, not a replacement:** the home plot keeps the grid, tools and mastery; Fields is
  an unbounded COUNT shown as 3 bars (to plant / growing / ready). Games that deleted the hands-on layer lost it;
  both layers stay (docs/research/fields-market.md §1).
- **Systemic, not new jobs:** existing planter/harvester workers work the Fields automatically when the home plot
  has nothing for them (same 5-s clock, same wage). Watering in Fields = pipes (coverage counted in TILES, sharing
  the batch-17 coal pump), never a water worker. Machines come in batch 19 and need the job's certificate first
  (manual → worker → machine ladder holds).
- **Fields costs energy 0:** Fields income is cash per hour, not per energy — the cash/energy hierarchy pin stays a
  home-plot comparison. Buying a field = 💰100 × (count + 1); the market (depth 60) is the real throttle; the UI
  shows the sim-computed payback hours. Crop gate: 50 home-plot harvests of that crop first.
- **Cohorts, never per-tile loops:** state is grouped cohorts (crop, count, readyTick); 8 h offline over 1,000+
  tiles must stay under the perf pin (2,000 ms). Stalled (unwatered) tiles pause growth; nothing dies offline.

## Fields part 2: throughput machines (batch 19, 2026-11-08, Toon go)

- With land unbounded the bottleneck is processing speed, not tiles (docs/research/fields-market.md §4): machines
  are the purchases after workers. The ladder holds — a machine's recipe needs its job's certificate first
  (manual → worker → machine).
- Machines are flat-maintenance (cash/h while working), never a % of holdings; watering stays pipes-only.
- The batch-18 sim found the pipe cap (300 tiles) is the real income plateau — this batch's machines (and any
  later pipe tier) push past it; the sim re-derives the curve.

## Prestige: "Sell the farm" (batch 20, 2026-11-08, Toon go: items 4–5 not rejected)

- Deeds = ⌊√(lifetime cashEarned ÷ 10,000)⌋ (the v12 meter's formula, unchanged). Gate: every farm job covered by
  a worker or machine AND ≥ 8 deeds (research: run 2's first hour ≈ ×2.2). Reset is design, not a migration — no
  save version bump unless the shape changes.
- Resets: tiles, cash, market, licenses, tools + tiers + mastery, mine/vein/pickaxes, furnace, workers +
  certificates, storage, orders, ⭐ BALANCE (converted first at 25 ⭐ = 1 deed, floor 0), fields, machines,
  milestones (with trackingStarted). Carries: meta upgrades (deed shop, as LEVELS), ⭐ shop rows + cosmetics,
  lifetime stats, run history. Nothing is silently lost — the confirm screen lists both sides (research anti-pattern).
- Deed shop: 7 rows priced 2/4/8/16/32 by level (growTime −4 %, sellPrice +5 %, cost −4 %, energyMax +2, startTiles
  +2, workerSpeed −0.5 s, plus one-time keepCarrotLicense 2 / keepFirstCertificates 3). No row multiplies ⭐, deeds
  or mining.
- Sim pin: run 2 reaches the first fields unlock ≥ 1.8× faster than run 1 (research says ×2.2 at 8 deeds; slack for
  tuning).

## The harvester machine inherits the sickle (batch 20.1, 2026-11-08, Toon go)

Each ladder step inherits the previous: the harvester machine rolls the player's BEST owned sickle's per-tile
double-harvest chance, exactly like the harvester worker (`reapFields` in `fields.ts`). This replaces batch 19's
"a machine has no sickle and is never hand-picked" — the never-hand-picked half stays. The seeder machine already
inherited the dibber's seed-keep via the planter's seed rules; no price, maintenance, machine rate or save change.

## Market pacing retune + prestige UI home (batch 21, 2026-11-08, Toon go)

- Market depth in tiles is the real "when does selling hurt" dial: at 60, a 12-tile mono farm already paid 0.90×
  and a 24-tile farm 0.80× forever (measured on Toon's save report). Depth 60→240: the early game is safe (0.95×
  at 24 tiles), pressure starts ~48 tiles/crop, floor at 240/crop, mono at Fields scale still hits 0.5× —
  diversification stays worth it. Half-life 1800→900 so a stop-selling farm bounces 2× faster.
- NO glut-mitigation upgrade now (Toon's idea, parked): depth 240 already fixes the early fear; if the late game
  tightens again the lever is a MILESTONE row (mid-game reach), never the deed shop — deed-shop things must stay
  cross-run meta only, and the first prestige comes ~17+ game-hours in.
- Price tags show trend ▲▼ + a floor badge (cosmetic state in `tiles.ui` only).
- Furnace: switching ore kind is allowed whenever the tray is empty — two-press confirm forfeits the partial slot
  (bounded by the slot cap); bars must be collected first (free). The picker says how many more ore complete a
  cycle. Removes the NOT_EMPTY soft lock.
- The prestige group (SellCard, 🏆 Legacy shop, deed meter) lives in the 🏦 Bank tab, shown pre-gate as a locked
  teaser. Bank = all money, in-run (loan) and cross-run (sell/Legacy). Stats keeps stats + feedback + reset.
- Storage max level 5 → 10, same formula (Toon: mine-era bags are too tight at cap 50; Lv10 = cap 100).

## Four new crops (batch 22, 2026-11-09, Toon go)

🍅 tomato, 🌽 corn, 🍇 grape, 🍓 strawberry (Toon approved the set; all Unicode 6 — no font risk). The ladder
keeps the curve's compression: sell ×~1.8 and seed ×~1.9 per step, floor margin ≥ 2.2×, per-tick income rising
per tier (lemon 0.31 → strawberry 1.20 cash/tile/tick). License cash = sim-set in the 0.5–1.5 h band at the
unlock stage. Save v19 adds the four market keys + licenses; earned value never taken away.

## docs/IDEAS.md is tracked (2026-11-09, Toon)

Toon's forward roadmap notes — intentionally unpolished, committed on purpose ("เอาติดไปได้"). Do not treat it as
untouchable or delete it from the tree; Hermes may commit updates to it.

## Stats becomes modals: 💾 Data / 🗺 Roadmap / 💬 Feedback (batch 23, 2026-11-09, Toon go)

The inline Save section, feedback card and reset button leave Stats; three buttons open one shared modal
primitive. **💾 Data** = export/import per the TILES1 spec (`docs/research/save-import-export.md`: base64url +
CRC32 checksum over the text, legacy plain-base64 codes still accepted, .txt download, save-ID = the CRC) plus a
**Danger zone** whose reset keeps EXACTLY today's behavior, UI restyle only. **🗺 Roadmap** = the 7 parked
IDEAS.md ideas in English, "Parked — not promises". **💬 Feedback** = the existing 4-field form, endpoint
unchanged. No core or balance change; no save bump. Deferred until Toon adds a long-text field to the Google
Form: attach-save-to-feedback.


## Import must not be overwritten; feedback carries the save (batch 23.1, 2026-11-09, Toon go)

An import freezes this tab's autosave (debounce, hidden-visibility, pagehide) before writing, so the reload cannot
save the old run over the imported one. 💬 Feedback always appends the live save as a `TILES1` code (no opt-in
checkbox: the save holds only game numbers, and a checkbox would lose the data that makes feedback useful); the
Timeline lines leave the feedback body because the save carries `milestones`. The Google Form's "Tell us more"
field has no length validation, so no new form field is needed — this replaces batch 23's "deferred until a
long-text field exists". "Copy report" is removed; the Timeline stays in Stats for players to read. Offline gains
already live in the welcome-back banner, so the timeline does not become an offline summary.

## Minor-feedback layout pass + bars sell as disposal (batch 24, 2026-11-09, Toon go)

Toon walked 11 minor-feedback items one by one (Discord, 2026-11-09). Accepted for this batch: items 2 (cramped UI),
4 (seed pouch Buy ×10 wraps), 11 (inventory rows wrap) and making bars sellable. Later batches: 24.1 order states +
worker activity (items 5, 10), 25 mine QoL (ore sorting, pickaxe rack, mastery ore bonus, hit carry-over, gold
pickaxe, sickle seed drop; save v20), 26 furnace molds (item 8; save v21). Item 9 (storage weight) is parked until
the big crafting round.

- **Spacing is a hierarchy, not a bigger gap.** Tokens `--s1..--s4` = 4/8/12/16 px; 8 px inside a group, 16 px
  between groups, a divider + sub-heading before Upgrades. The furnace is four groups: Fire / Smelt / Output /
  Upgrades. Why: Toon rejected a uniform gap bump — a card of flat siblings reads as one wall at any gap.
- **Wide screens widen the side columns** (caps 320 → 440, 380 → 480); at ≥ 1440 px the panel is always open with no
  toggle, and a saved `collapsed` is ignored there so nobody is stuck collapsed without a button.
- **Repeated rows share one grid** (seed pouch + sell list): fixed columns, price inside the button, ellipsis names,
  so a row's shape never depends on name length or price digits. One column is reserved for batch 25's sort toggle.
- **Bars sell below input value (disposal, never profit)** — replaces "Bars never sell" (round 5). Why: `bagCount`
  counts bars, so a bag full of unused bars blocked digging, Collect and the stone-paid storage upgrade; the only
  escape was discarding orders until one asked for that bar (Toon: a boring lottery). The old fear was a
  cash → wood → bar → cash loop; one furnace makes at most ~180 copper bars/h (≈ 💰900/h at 💰5), against
  ≈ 💰26k/h for 24 lemon tiles, so there is no income threat, only the correctness guard: price ≤ ⌊input sell value
  at the cheapest recipe⌋ − 1 → copper 2, iron 3, gold 5. Bars stay out of "Sell all when full" (they pay for
  upgrades).
- **Design stance (Toon):** tiles is an integrated "everything together" game — build systems first, balance and
  weight them later. No feature is blocked because one system out-earns another. Hard guards only: no infinite cash
  loop, no soft lock or stall, prices ≤ storage capacity, nothing negative, saves migrate. The sim's hierarchy
  asserts become reported numbers in batch 25.

## Layout follow-up, order states, worker activity (batch 24.1, 2026-11-09, Toon go)

- **Repeated rows share columns for real.** Columns are declared once on the grid container and rows use
  `subgrid`; a container query (not a viewport media query) turns a row into two lines when its panel is narrow.
  Why: batch 24 gave each row its own `auto` grid, so columns drifted row to row and the name cell collapsed to 0 px
  in the 1024 px Mine column — the panel width, not the viewport, decides whether one line fits.
- **Recipe buttons carry only the verb and the price.** Effect text and "needs … more" move under the name; every
  button in a card has the same width; owned recipes show "✓ Built" instead of a disabled button. Why: Toon found
  the Workshop/Fields cards cramped — buttons sized to their text gave three different placements in one card.
- **An emoji never wraps away from its number** (word joiner in `priceText`).
- **Order rows show their state** (New / Accepted with progress / Ready); Discard is a small ✕ away from the primary
  button, two presses once an order has progress.
- **Worker activity is visible** (ring, per-job dot, "· N working"). This CSS pass is a stopgap: Toon will bring
  animation references for a proper pass later (Motion AI Kit reviewed and deferred — tiles has no Motion dependency).

## 🗺 Roadmap Changelog tab (batch 24.2, 2026-11-10, Toon go)

- **The 🗺 Roadmap modal has two tabs: Planned (parked ideas, unchanged) and Changelog** — one English line per
  batch, newest first, with the ship date (from git). Why: Toon wants players to see what each update brought, next
  to what is planned.
- **Player-facing wording only**: no sim pins, save versions or task numbers. Lines are written by Hermes in the
  plan and copied verbatim by the worker, so the worker makes no wording calls.
- **Every batch adds its own line** at the top of `CHANGELOG` (`src/app/changelog.ts`); a test fails when a
  `## Batch N results` heading in `docs/PLAN.md` has no entry, so it cannot be forgotten. The tab choice is not
  persisted (opens on Planned) — cosmetic, no `tiles.ui` change.

## Big farm: blocks, sockets, plots, one surface (batches 25–31, 2026-11-10, Toon "pick หมด")

Full list and reasons: `docs/research/bigfarm-decisions.md`. Base = Design C (`docs/research/bigfarm-design-c.md`).
Research and earlier rounds: `bigfarm-design.md` (A), `-b.md`, `-d.md`, `placement-scaleview.md`,
`field-watering.md`, `incremental-community.md`.

- **LOCKED by Toon (design around these):**
  - L1: a sprinkler is placed, cannot move, and its tiles always have full water.
  - L2: the Tractor unlock changes the MAIN UI (zoom out to an estate), not a side card.
  - L3: systems may change but must not drift far; the test is "always something to do".
  - L4: every object answers The Door Problem (Liz England 2014) questions.
- **Block + socket rule.** Position only means something inside fixed-shape blocks. A block's shape is derived from
  the index and flows with the viewport, never from rows. Everything placeable is built on a socket that the block
  shows before purchase. A socket is paid on Build, is permanent, and has no placement mode. Why: free placement on
  24 identical tiles has one right answer and only adds the power to be wrong forever (lossy placement is what
  sprinkler players rage about). Real fixed irrigation is zoned plumbing with risers, so a socket is the real thing.
  This replaces the `ceil(sqrt(n))` grid, the root of "no rows".
- **Home lot = 4 beds of 3×2.** Bed k = tiles 6k…6k+5. A sprinkler is built on a bed's socket (max 4, recipe
  unchanged) and its tiles never need water: no moisture bar, and the can, tool and worker skip them. No upkeep:
  hoppers, the pump's coal and the loader's hopper branch are deleted. Why: coal was 32 of 372 coal/h and its only
  effect was a stall. Any save with a sprinkler gets all 4 beds, because one machine already watered all 24 tiles
  (iron moisture 4 × 60 ticks against 6 tiles per 5 s).
- **Fields = plots and fields.**
  - A plot is 10 tiles, the unit of land and of work. A field is 5 plots, the unit of water and of crop.
  - Each field has one pivot, built on its socket. A dry field cannot be sown.
  - Pump tiers (today's pipe recipes) cap wet fields at 2 / 6 / 12 / 20, and a field the pump cannot feed cannot
    be started.
  - Plots replace cohorts, with absolute ripening. The prefix coverage rule and `coalCarry` are deleted.
  - Field 1 arrives with the Tractor, already plumbed.
- **Coal = pressure, fields only.**
  - A tank with coal → field growth ×2; empty → ×1. Fields never dry out and never stall.
  - The tank holds 8 h at the pump's cap, and the fuel loader feeds it.
  - The smart valve is kept and gets a new job: no idle burn. It is not refunded.
  - Pressure ships together with plots, so there is never a release where ×2 is free.
- **Who picks the crop:** chips by hand (marginal 💰/h shown) → 🧑‍💼 Manager worker (certificate, wage, pool slot).
  Seeders and planters never decide. Why: today's seeder rule earns about half of the best plan (Design C S4), and
  automation must be earned (manual → certificate worker → upgrade).
- **Estate contracts are core.** After the Tractor, a crop order is sized by the estate. Off-crop orders pay ×1.1
  with no glut. Only the player accepts them. This is the recurring "flip a field" decision.
- **Renown** (own batch): home harvests deepen that crop's market. It resets on Sell the farm, and a deed row keeps
  the reached tiers.
- **One surface, two stops** (🚜 Estate / 🏡 Home, FLIP, wide screens show both). On phones the cards move to a 📋
  sheet. A plot is always one cell, and the mini home lot is one tap target. A spike checks the feel before batch 27.
- **Parked** (separate goes): irrigated-bed ×1.1 bonus, desktop free zoom, field traits, the valley + free posts,
  rain-fed land, counted tractors, a Manager machine tier, a deed keep for the beds, a review of the 8 h offline cap.
- **Renumbered:** mine QoL (was "batch 25 / save v20" above) → batch 32 / save v23. Furnace molds (was "26 / v21")
  → batch 33 / save v24. Toon chose big farm first. The reserved Keep ↔ Sell column in the shared item grid now
  waits for batch 32.

## Batch 27 refined: Estate surface details (2026-11-11, Hermes after the spike verdict)

- **Spike verdict (Toon):** the pull-back reads as "my farm got bigger" → two stops kept, desktop free zoom dropped;
  52 px rows fine; long lists get a bottom bar (the "⬇ next" button waits for batch 30, when there are 20 field rows —
  today's Estate has at most 8 crop rows).
- **1024 fit:** beds pair from a 400 px container (was 480) and the tile floor is 52 px (was 72), with cells that hide
  their text label below 80 px and the "rots in" text below 64 px. Why: measured live at 1024 × 768, no layout fits
  24 tiles at 72 px; paired at 54 px fits with no scroll and no overflow, and the wider screens keep their tile size.
- **Where the Fields content lives:** the Estate stop holds the crop rows (the by-crop ledger with Plant / Stop), the
  ghost row and the machines; the side Fields card shrinks to one summary line with "Open Estate". Why: one place to
  act on the fields, and the ledger is the rows themselves rather than a second read-only copy.
- **Phones:** the 📋 sheet and the Estate bar apply only after the Tractor; before it phones are unchanged. Reap on the
  bar is a disabled count with a hint until batch 28 adds hand reaping.

## Big farm numbers from the crop-mix calculator (2026-11-11, Toon accepted Hermes's recommendations)

Calculator on the real `balance.ts` / `market.ts` (steady glut, pressure ×2, 50 tiles per field); it reproduces
Design C's base table (best 2.42M/h, mono 2.36M/h at 20 fields).
- **Renown reward = a higher price floor per crop** (0.55 / 0.6 / 0.7 at 250 / 1,000 / 4,000), not market depth.
  Why: with sell 5 + fertilizer 5 every crop hits the floor from 60 tiles, so depth ×2 added only +1.3 %.
- **Pump cash 💰500k / 1.5M / 3M** (≈ 0.5 h of income at 2 / 6 / 12 fields). **Pivot cash kept** at 💰50,000 × (n − 1).
- **Manager plans with an exact DP** and the sim pins ≥ 0.99 × best; greedy fell to 0.73–0.83 in some stages.
- **Manager wage 💰28 per action** (≈ 💰20k/h). Unlock stays at 3 hand-delivered contracts.
- Noted for batch 28's sim: 20 fields need 15,000 tiles/h sown and reaped — more than the machines' 12,600 + 5,400,
  so report labor-bound income too. The crop mix is not a decision at the fields stage (mono strawberry is best from
  2 fields); the recurring decision has to come from contracts.

## Batch 28 refined: plots model details (2026-11-11, Hermes from the code at 72ec00a)

Full spec in PLAN.md "Batch 28". The calls made while refining (Toon may reject any):
- **Migration packs plots contiguously** (planted plots by crop, then empty), so a field may hold two crops; its chip
  is the crop with the most plots. Why: one-crop-per-field packing opens up to 8 partial fields and pushes old saves
  past the pump cap.
- **The tank counts integer burn units** (7,200 per coal = one plot for one tick at 0.5 coal/plot/h), so "a full
  Pump-3 tank lasts exactly 8 h at 20 fields" is an exact pin, not a float edge.
- **A dry field's growing plot (migration leftovers) grows at ×1 and burns nothing**; the pivot gates sowing only.
  Fields never stall.
- **Without the valve, empty plots in a pivoted field burn too** (the design's "every plot burns"); the worst case is
  the tank's content, bounded by the tank cap. The valve keeps its old price (2 Au + 💰8,000).
- **Hand reap sells at ×1 in batch 28**; the ×1.25 into orders and contracts comes with contracts (batch 29).
- **The Manager job is added hidden in batch 28** (save shape only, decision 16): certificate 💰500,000 + 4 Au (est.,
  batch 29's sim pins it), glyph 💼 because 🧑‍💼 is an Emoji 12.1 sequence (tofu on Toon's device).
- **Fields beyond the pump cap collapse into one row now** (only migrated big saves have them), not in batch 30.
- Measured for the migration pin: on the v20 code every committed fixture (v16–v20) ends 8 h offline with 0 coal and
  all field tiles still growing — the old pump ran dry. The new model must earn at least the old 8 h cash delta per
  fixture (💰439,579–458,346).

## Batch 28.1: a blunt pickaxe can be replaced by any other tier (2026-11-11, Toon: "แก้บัคก่อน")

The batch 28 sims stopped with a blunt gold pickaxe and 1 Au: `craftPickaxe` refused every tier at or below the one in
hand, a blunt pickaxe mines by hand, hand mining cannot break gold (or iron) rock, and the gold repair costs 2 Au —
a soft lock older than batch 28. Fix is systemic, not a gift: a blunt pickaxe may be replaced by any OTHER tier at
its normal craft price (same tier = repair, which is cheaper). Copper rock needs no pickaxe, so hand → copper → iron →
gold always exists. The Mine card shows the craft-instead row only while the pickaxe is blunt and the repair is
unaffordable. No save change. Spec: PLAN.md "Batch 28.1" (task 158).

## Pivot recipe stays 3 Au; PIN28a measures purchases (2026-11-11, Toon: "ok")

The batch 28 worker blamed the 1,188 game-minute gap pump1 → plots30 on pivots waiting for gold. A Hermes probe of
the batch 19/28 ladder (`571815a`) showed every pivot bought the moment cash reached its price, with 5 Au and 6 Fe in
hand; cash bound every plot and pivot, one every 47–58 min. The gap was PIN28a counting only milestones and rungs.
Decision: keep the pivot recipe (3 Au + 6 Fe + 6 Cu, kin to the sprinkler); batch 29 makes PIN28a count purchases.
The real longest waits are saving for pump1 (228 min) and pump2 (233 min); pump prices are looked at after that.

## Batch 28.2: Ore sorting's sell-on-dig pulled forward from batch 32 (2026-11-11, Toon: "รวมเข้าไปเลย แล้วปล่อย 28.2")

Toon, playing v21: the Fields tank needs coal, but the miner idles on a full storage (vein Lv4 is 50 % stone), so he
cleared storage by hand, and "Sell all when full" also sold the tank's coal. The per-kind Keep ↔ Sell on dig of the
"🧺 Ore sorting" milestone (accepted 2026-11-09, minor-feedback items 3 + 6) moves to batch 28.2, priced as agreed:
each kind paid in itself (stone 30, coal 15, copper / iron ore 15, gold ore 10) + one cash part = 0.5 h of the ladder
bot's income at vein Lv3 (sim-set). Toon's rule: every convenience costs some of what it eases, priced in surplus.
A Sell kind never fails BAG_FULL and sells exactly like `sellItem` at drop time. Run state (reset on prestige). Coal
leaves "Sell all when full" (it is fuel now). "Keep N" stays in batch 32. Folded in: three batch 28 UI nits
("1 plots", the Workshop line overflowing at 1024, the Reload label at 375). The two sim carry-ins (PIN28a purchase
marks, bot gold smelting) stay in batch 29: they touch no player and move the batch 18/19 pins.

## Batch 29 refined: contracts, Manager, chips (2026-11-11, Hermes, against `c4a83d4`)

Spec: PLAN.md "Batch 29" (tasks 149–151). No save bump — the v21 shape already holds `contractsByHand`, `pinned` and
the `manager` job. Calls made while refining (sent to Toon as a reject-list):
- A contract = any crop offer after the Tractor; its price is today's crop-order price (base × 1.1, no glut). A crop
  under the 🏡 50 gate keeps today's order size.
- Hand bonus ×1.25 applies only to the units a hand-reaped Fields plot puts into an order; its market units sell at ×1.
  `contractsByHand` counts a contract whose LAST units came from the player's own reap or harvest.
- The Manager is paid per chip it changes (💰28), idle and unpaid when its plan is already applied, like every worker.
  The calculator's ≈ 💰20,000/h was the upper bound of a change every round; the real cost is the pool slot (M4).
- The Manager plans on the steady-glut model, not the live market, so it does not chase its own sales. A partial field
  counts as full in the DP. Contract fields first: ceil(shortfall ÷ (50 tiles × yield)), standing plots counted.
- Picking a crop by hand while a Manager is assigned pins that field; 📌 shows once the certificate is owned.
- The crop picker stays the `<select>` until batch 30; its options carry marginal ≈💰/h, the price factor and 🏡 n/50.
- Sim "old rule" = greedy-by-marginal (the seeder rule was deleted in batch 28). The "with renown floors" pin moves to
  batch 31, where the floors exist.
- The Manager's emoji is 💼 (as in the code); 🧑‍💼 is Emoji 12.1 and shows as tofu on Toon's device.
- **Renumbered:** renown = batch 31 / save v22 → v23 (batch 28.2 took v22); mine QoL = batch 32 / save v24; furnace
  molds = batch 33 / save v25.

## Batch 30 refined: Estate map (2026-11-11, Hermes against `b30892a`)

Spec: PLAN.md "Batch 30" (tasks 152–154). UI only, no save bump. Calls made while refining (Toon may reject any):
- Row = 56 px chip + five 52 px cells, gap 5 = 341 px (the spike's 354 px overflows today's 344 px column at 375).
- A legend line "1 square = 1 plot of 10 tiles · a field = 5 plots under one ⛲ pivot" (Toon read a cell as a tile).
- One field sheet per chip holds the pivot Build, the crop list (today's option texts) and the 📌 toggle; the pivot
  badge on the chip is decorative, because a 20 px badge is under the 44 px tap minimum.
- The 🚜 marker sits on the plot the machine fleet works next (harvester: oldest ready; seeder: next sowable), only
  with that machine owned. Workers get no marker.
- A growing cell's tap answers "Not ready yet"; its label carries the % and "ripe in".
- The ghost field is text, not a button; the Expand "＋ Plot" row goes (the ghost cell replaces it).
- The spike's "⬇ next" bottom bar is dropped: the phone bar's Sow / Reap already act on the next plot.
- The strip keeps today's text (the spike's "sow 3.2/min · need 2.8" wording is not adopted).
- Keyboard = native Tab order + focus ring, no roving tab index. The side-panel Fields summary line stays.

## Batch 31 refined: Renown (2026-11-11, Hermes against `d50ff3d`)

Spec: PLAN.md "Batch 31" (tasks 155–157, save v22 → v23). Toon: "ร่าง 31 แล้วปล่อยเลย". Calls made while refining
(Toon may reject any):
- "By hand" = the hand-picked test (`energy > 0`: a tap or a tool press) → +2; a worker → +1; a double harvest is one
  gain. Estate plots give no renown (they never counted as home harvests).
- Migration seeds renown from lifetime harvests, which carry across sales, so a player who sold before starts higher.
- Kept renown deed: one-time 3 deeds (like Kept certificates); it keeps each crop's reached tier threshold, not its
  points.
- The floor applies everywhere a market price is computed, including the 💼 Manager's plan and the Estate option texts.
- Shown as a Stats row per licensed crop ("n · floor x % · next t") and the Sell card's Resets list; no toast or
  milestone on reaching a tier.
- Worker-only top tier is capped at 48 game-hours (est. 44 h at base grow time with 24 strawberry tiles).
- Carried in: the batch-30 flaky Manager offline test gets a 20 s timeout.

## Batch 31.1 refined + the ⭐ / deeds direction so far (2026-11-12, Toon delegated the batch order to Hermes)

Spec: PLAN.md "Batch 31.1" (tasks 163–166), no save bump. Calls made while refining (Toon may reject any):
- The 💼 Manager counts contracts delivered by anyone (harvesters too), unlock at 10, price 🥇4 + ⭐40 + 💰1.5M (est.;
  the sim on the real v22 save pins it, and the worker stops rather than pick another number). Why: on old saves the
  harvesters reap every contract, so "by hand" stayed at 0, and 💰500k was ~3 % of a late save's cash.
- One formatter: exact grouped digits below 1M, then M / B / T / Qa; the balance rounds down, prices round up, so
  the screen never shows a price as affordable when it is not. ⭐, bars and counters are never abbreviated. No
  rescaling of money, no price snapping in balance.ts, no notation setting yet. All rates stay per hour.
- HUD income and wages per hour come from a 10-game-minute window kept in the app (not the save).
- 🌱 Farm and ⛏️ Mine nav items get badge dots (certificates, orders, pickaxe tiers) and a certificate unlock toasts
  once; 🏦 Bank and 📊 Stats never badge. A manual seed buy switches "Crop to plant" to that crop (auto-buy does not).
- **Batch order:** 31.1 → 32 mine QoL (save v24; first task: pickaxe info under Dig + the Keep/Sell table) → 33
  furnace molds (v25) → 34 ⭐ Favours + bar prices (v26) → 35 crops: potato, eggplant, re-ladder (v27) → prestige
  variety after crops. Why: the no-bump fixes first; mine and furnace before the ⭐ rows that extend them; crops last
  because they re-pin the whole sim ladder.
- **⭐ / deeds so far** (reports: docs/research/star-currency.md, star-toys.md, prestige-variety.md; design continues
  in its own session): ⭐ is a second currency from orders, not a prestige currency. Deeds stay the permanent
  buffs. ⭐ purchases belong to the run and reset on Sell the farm; the ⭐ balance carries. A ⭐ row extends a cash
  ladder past its max (fresh and veteran players both meet it new), never re-sells something that exists and never
  duplicates a deed row. Accepted so far (prices est.): 🏠 Bunkhouse (pool cap past 6), 💧 Fine mist (fertilizer
  past Lv5), a ⭐ sell-price multiplier (past Lv5), ⭐ furnace speed + batch (past Lv2), ⛏ Seam survey, 🔥 Stoker,
  ⭐ co-price on the Clerk and Manager certificates. Rejected: Whetstone, ⭐ storage, order-only rows, Work bell,
  pump past tier 4 (parked: Estate map risk), a fixed "pick your next land" menu. Bars: Toon wants 🥉100 🥈500 🥇1000
  (today 2 / 3 / 5); the copper price waits for the calculator (research warns a miner out-earns the farm from vein
  Lv2 at 🥉100). Toon intends many prestiges, each changing how the run plays.
- The sold-run sim pin shipped as ≥ 1.4× faster to the fields unlock (`tests/sim/prestige-crops.test.ts`, "pinned ≥ 1.4×"; was `tests/sim.test.ts:3977–3999` before batch 35.1); the 1.8× in
  the batch 20 prestige entry above is superseded.
- Worker rework (unique hires with traits) recorded as docs/IDEAS.md §8.

## Batch 32 refined: Manager ⭐20 + Mine QoL (2026-11-12, Hermes against `ef663a1`)

Toon (Discord thread 1570171044218536097): "32.1 Manager ปรับเป็น 20 ⭐", then "เอาเป็น task แรกของ 32 แล้วปล่อย 32
เลย". So the Manager certificate price change (⭐40 → ⭐20, 🥇4 and 💰1.5M unchanged) is batch 32's first task, not a
separate 32.1. Batch 31.1's sims showed ⭐ is not what blocks a fresh player (⭐18 but 🥇0 at the 10th contract); the
re-pinned sim reports it again.

Scope (accepted earlier, renumbered from "batch 25 / save v20"): pickaxe rack, mastery → more ore, hit carry-over,
gold pickaxe strong-but-fragile, Keep N, sickle seed drop, hierarchy asserts → reports; plus the 2026-11-12
new-player feedback items 1 (pickaxe card under Dig) and 4 (Sell on dig as a readable table).

Hermes's calls while refining (Toon may reject by number):
1. Bars stay out of ore sorting and Keep N (they never auto-sell): `docs/research/star-toys.md:123` rule 14 —
   storage is the only brake on away income. The 2026-11-09 draft had bars join the sort list; this replaces it.
2. Keep N = one purchase (🥈10 🥇5 💰7,000; 💰 = 0.5 × 14,118 💰/h measured in the batch-16 vein-Lv4 phase), then a
   per-kind "keep up to N" stepper (step 10, 0 … storage) on each kind checked Sell on dig. N = 0 is today's Sell on
   dig, so nothing changes for a player who never sets it.
3. Sorting is one table in 🧺 Ore sorting (Unlock button / Sell on dig checkbox / keep-up-to stepper); the toggle
   column leaves the item grid.
4. Crafting a pickaxe selects it. The miner worker uses the selected pickaxe and never switches by itself; repair
   stays manual. The batch-28.1 "craft a lower tier instead" escape is replaced by the rack row.
5. A press that fills storage mid-way leaves the rock unbroken at full progress; that press's remaining hits are lost.
6. Seed drop rolls per harvested tile on Fields too (a 10-tile plot → ~3 seeds with a gold sickle; sowing takes 10).
7. Migration scales an owned gold pickaxe's durability by 600 / 6500 (Toon's-style save: 3800 → 351).
8. Mine card order: Dig → Pickaxe → vein → furnace → wood → items → 🧺 Ore sorting.
- **Renumbered:** none. Batch 32 keeps save v24; batch 33 (furnace molds) and later batches keep their numbers.

## Estate worker speed (batch 32.2, 2026-11-12, Toon go: "ทำ")

- **A worker's land per hour is equal at every scale.** A Fields worker action is ONE tile of work (was a whole
  10-tile plot): 720 tiles/h per worker on the home plot and on the Estate alike. Why: at a plot per action one worker
  moved 7,200 tiles/h for 💰720/h, equal to the top harvester tier and 4× the first, so the machines were pointless
  (Toon: "a 10-tile plot should take 10× the time"). Supersedes the throughput implied by "Fields part 1" (batch 18:
  "same 5-s clock, same wage"); the clock and the 💰1 wage stay, a plot now costs 💰10 of wages.
- **One shared counter, not per-plot progress.** Workers add 1 tile to `fields.machines.carry` (harvest / plant), the
  counter the machines already use; at a plot's worth the oldest ready plot is reaped (or the next plot sown). Why:
  no save bump (carry is already saved), and a machine and a worker finish each other's plots. Rejected: progress per
  plot (save bump + migration for every plot).
- **No lock-in.** A worker still checks the home plot first every round, so it returns to home work within one round
  (5 s); its Estate progress stays on the counter.
- **Seeds are paid when the plot is sown** (the 10th tile), and a worker with no seeds or cash banks nothing.
- **Known trade-off:** a hand reap of the "next" plot leaves the counter untouched, so banked progress moves to the
  next ready plot. Nothing is lost.
- **UI:** the "🚜 next" marker also shows when only workers can reach the Estate, and adds "n/10" once progress ≥ 1.
- **Button ripple (task 176, Toon 2026-11-12 23:38):** every `<button>` gets a Material-style press ripple from one
  shared utility (a delegated `pointerdown` listener in `src/app/ripple.ts` + one `:where(button)::after` CSS block),
  never per-button code. Why `::after` + an animated `@property` gradient and no `overflow: hidden`: no DOM nodes or
  React state per tap (cheap on Dig and farm tiles), no layout shift, and the `.cell-pop` float is not clipped. Off
  under `prefers-reduced-motion` and on disabled buttons; no save bump. A CSS stopgap until Toon brings animation
  references.
- **Renumbered:** none. "32.1" was the Manager ⭐20 change, folded into batch 32, so this batch is 32.2. Batch 33
  (furnace molds, save v25) keeps its number and runs after 32.2.

## Batch 33 refined: furnace molds + the Speed/Batch overlap with batch 34 (2026-11-13, Toon: "ปล่อย 33")

Spec: PLAN.md "Batch 33" (tasks 177–180), save v24 → v25. The molds design itself is the batch 24 entry above (minor-
feedback item 8, accepted 2026-11-09) and is not reopened.

- **Option A (Toon, 2026-11-13):** Speed and Batch stay metal-bar, in-run furnace upgrades in batch 33 (speed ×0.8
  cycle time per level, 2 levels: 🥈10 / 🥇8; batch 3 → 4 → 5: 🥈8 / 🥇5). The ⭐ Favours of batch 34 become EXTRA
  furnace boosts on top of that ladder (more speed / batch levels past the bar-paid max), bought with ⭐ and reset on
  Sell the farm like every ⭐ row. Why: one ladder per stat, so a fresh player and a veteran both climb the bar rows
  first and meet ⭐ only past them (the ⭐ rule "a ⭐ row extends a cash ladder past its max"). Supersedes the batch 34
  draft's "⭐ furnace batch past Lv2 (batch 4 ⭐15, batch 5 ⭐30)" and "⭐ speed from Lv1"; batch 34's furnace rows are
  re-sized at its refine.

Hermes's calls while refining (Toon may reject by number):
1. Speed is a progress RATE (`1.25 ** level`: 1, 1.25, 1.5625) and a running mold burns fire at the same rate, so fuel
   per bar stays the same (item 8.2) and only time shrinks; a cycle's overflow carries into the next one. Cycle
   seconds: copper 60 / 48 / 39, iron 120 / 96 / 77, gold 180 / 144 / 116.
2. Cash parts: copper-bar rows (tray Lv1, ore slot Lv1, iron mold, Collect all) 💰6,500 = 0.5 h of the measured
   vein-Lv3 income (💰12,842/h); iron/gold-bar rows (speed, batch Lv3–4, fire Lv3–4, tray Lv2, slot Lv2, gold mold)
   💰7,500 = 0.53 h of the measured vein-Lv4 income (💰14,118/h). Same yardsticks as Ore sorting and the gold vein.
3. Batch 4 and 5 are locked until tray ≥ 2 × batch and ore slot ≥ 2 cycles (both need tray Lv1 + slot Lv1), the
   item 8.4 guard written as a rule computed from the balance functions.
4. Migration gives a built furnace a mold for every kind its vein drops today (vein Lv3 iron, Lv4 gold) plus the old
   slot's kind, which keeps its ore, progress and tray. Why: today's furnace already smelts every dropped kind, so a
   migration that charged for those molds would take something away.
5. The ore loader collects first (copper → iron → gold), else loads one cycle into the owned mold with the fewest whole
   cycles loaded ("order of need", item 8.6).
6. The iron / gold mold rows appear once the vein drops that ore (the old kind picker's rule), so copper players see
   no change.
7. A plain furnace with no mold smelting burns 1 fire tick per tick (today's waste rule); running molds burn only their
   own rate. Worst-case offline loss stays the fire cap (160 units = 80 coal).
8. Bars keep 🥉2 🥈3 🥇5 this batch. At batch 5 a gold bar sells above its ore + coal (💰5 vs 💰4.4); allowed because
   ore cannot be bought (no cash loop) and batch 34 replaces bar prices. The disposal test pins batch 3.
9. The ladder bot buys only the two molds; it never spends bars on the optional furnace rows inside the ladder. A
   separate max-furnace pin reports their throughput (copper 468.75 bars/h per mold by construction).
10. Collect all (🥉10 🥈5 💰6,500) shows only with ≥ 2 molds owned.
- **Renumbered:** none. Batch 33 = save v25 (as recorded in the batch 29 and 31.1 entries); batch 34 = save v26.

## Batch 34 refined: ⭐ Favours, bar prices, order ⭐ by production-minutes, ⭐ carries a sale (2026-11-13, Hermes against `6fbb6eea`)

Spec: PLAN.md "Batch 34" (tasks 181–187), save v25 → v26. Design sources: the "⭐ / deeds so far" bullet of the batch 31.1
entry above, Toon's answers to the calc34 25-item list (docs/research/calc34.md §11, accepted 2026-11-12, with two later
changes: copper 🥉100 not 🥉60, Manager ⭐20 not ⭐25), the prestige-layers answers q1–q2 (⭐ carry cap 50, ⭐ no longer
converts to deeds; accepted 2026-11-13) and Option A of the "Batch 33 refined" entry. The ⭐ → deed rule of the batch 20
entry (":395 ⭐ BALANCE converted first at 25 ⭐ = 1 deed") is superseded here.

- **calc34 item 8 re-run on molds** (docs/research/calc34-item8-molds.md): with hit carry-over (batch 32) and parallel
  molds (batch 33), one miner never needs a ⭐ furnace row; the ⭐ rows pay from 2 miners (+8 %; +33 % with 4 mastered
  tiers), 3 miners (+52 %) and clickers (+135–237 %). One miner at vein Lv4 makes 💰240k/h of bars at sell 5, against
  the pre-Fields farm's 💰161–336k/h — reported, not held down (2026-11-09 rule).

Hermes's calls while refining (Toon may reject by number):
1. Batch 33.1 (sim per-run log, task 181, test-only) is folded into batch 34 as its FIRST task instead of a separate
   batch: 34 re-pins the sim anyway, the log helps diagnose those re-pins, and no extra worker spin-up is paid.
2. Bar orders pay the bar's own sell price × 1.1 (like crop orders), so a bar order never pays less than selling the
   bars; ore / stone / coal orders keep base × bonus. The old "bar = its ore + coal" value was written for
   disposal-priced bars.
3. ⭐ levels live on the existing ladders: Fine mist = fertilizer Lv6+, ⭐ sell = sellPrice Lv6+, ⭐ furnace speed =
   speed Lv3+, ⭐ batch = batch Lv5+ (6 bars …). No parallel level state, and every reader of those levels picks the ⭐
   part up. Grow time past Lv5 = 0.5 × 0.95^(level − 5).
4. ⭐ furnace speed uncapped at ⭐ `round(10 × 1.5^k)` (calc34's price, now from speed Lv3); ⭐ batch 6 … 10 at
   ⭐ `round(15 × 1.5^k)`, capped at 10 because the top tray (20) and ore slot (48) cannot hold two cycles past it.
5. Seam survey re-aim is free and immediate (star-toys.md proposed "after 50 rocks"; no exploit found, one counter
   less). Aim weights: chosen ore ×2, other ores ×0.5, stone absorbs the difference, coal unchanged.
6. Stoker: certificate bought in the ⭐ Favours sheet, assigned in the Workers card, at most 1. "Hidden until the
   furnace is busy" is read as: shown once the fuel certificate is owned and the bar ladder is done (speed Lv2, batch
   5 bars). The boost lasts `workerActionTicks` ticks per paid action, so an unpaid stoker stops it.
7. Fractional ⭐ is a separate `starsFrac`; `stars` stays a whole number everywhere it is shown or spent.
8. Each offer stores its ⭐ when it is rolled (shown on the card, one decimal under 10); offers in a migrated v25 save
   keep their tier's old ⭐ (1 / 2 / 4).
9. Bunkhouse is buyable at any pool size once hiring is unlocked (not only with 6 hired).
10. The Favours sheet lists every row with its lock reason (discoverability), except Stoker, hidden until ready. The
    Sell card shows "⭐ N carried to the next farm · ⭐ M lost above 50".
11. The ladder bot does not buy Favours; scenario pins set Favour levels directly.
12. Chore: `tests/manager.test.ts:122` (8 h offline with a Manager on 20 fields) gets a 20 s timeout (flaky under load).
- **Order slots** bought with ⭐ keep carrying across a sale as shipped in batch 20 (`prestige.ts:77`); not changed.
- **Renumbered:** batch 33.1 is folded into batch 34 (its task 181 kept); batch 34 = tasks 181–187, save v26 as
  recorded; batch 35 stays save v27.

## Batch 35 refined: potato, eggplant, the 10-crop ladder with chilli on top (2026-11-13, Hermes against `1a961fff`)

Spec: PLAN.md "Batch 35" (tasks 188–190), save v26 → v27. Design sources (Toon): the new ladder potato < carrot < corn <
eggplant < pumpkin < tomato < lemon < grape < strawberry < chilli and potato as the new starting / dig crop (accepted
2026-11-11, "Crops — ACCEPTED A + B"); the licence migration "swap by tier/count, potato free, chilli renown kept,
planted crops finish and sell" (2026-11-12, decisions draft item 3). Edge cases a–k of that item are settled here
under "a migration never takes earned value away". No newer batch 35 refinement by Toon exists in the drafts or the
repo (checked 2026-11-13: no b35 draft, no PLAN section); batch 33.1 is already folded into batch 34 (task 181), so
nothing runs before 35.

Hermes's calls while refining (Toon may reject by number):
1. **Stat rows keep their rank.** The 8 shipped rows (grow / seed / sell / licence) stay at their rung and the crops are
   re-labelled: corn takes chilli's old row (rung 3), eggplant pumpkin's, pumpkin lemon's, lemon corn's; carrot,
   tomato, grape and strawberry keep theirs. The pinned economy holds rung for rung, and the sim re-pins stay small.
   Corn drops from 💰360 to 💰25 a sale (the "nerf overnight" Toon accepted with the order).
2. **Two new rows (est., the sim pins them):** potato 60 ticks / seed 1 / sell 5 / free; chilli 1,160 ticks / seed 460 /
   sell 2,070 / licence 💰32,000 (the batch-22 compression continued: sell ×1.8, seed ×1.77, licence ×1.45).
3. **Carrot licence 💰25 (est.)**, about one potato harvest in. Carrot was free; it is now the first paid rung.
4. **Licences map by rank** (old rung k → new paid rung k). This equals "N licences → the N lowest paid rungs" for
   every save that bought in shop order, and keeps the price row for a save that skipped rungs (radish + strawberry
   stays radish + strawberry instead of sliding to radish + corn).
5. **Settings and promises follow the row:** home crop-to-plant, field chips (pins kept) and every crop offer (accepted
   or not) move by the rank map, so planters, the Manager and order cash keep the same value. Chips are not cleared.
6. **Fields access follows the row:** a mapped crop whose source crop was fields-plantable is granted (new
   `lifetime.fieldsGranted`), so a migrated estate does not drop back to carrot until 50 home harvests.
7. **Planted crops keep their crop and finish** (Toon). Where the base sale price falls (only corn), the migration credits
   the difference for what is planted; where it rises (chilli, lemon, pumpkin), the one harvest sells at the new price.
   That is a bounded one-time windfall, and it is not clawed back.
8. **Seeds:** stock of a crop that is no longer licensed, or whose seed got cheaper (corn), is refunded at the old seed
   price; other stock stays.
9. **Renown, lifetime harvests, milestones and market glut stay on their crop id** (Toon: chilli renown kept). Toon's
   own fixture keeps lemon renown 2,427 on lemon, which it no longer licenses; it waits until lemon is bought (💰10,000).
10. Old migrations iterate a frozen `CROP_IDS_V26`, so v1 … v25 fixtures migrate exactly as before.
11. calc34 items 5–7 (soil traits, listing soil, dig finds) re-run on the 10-crop ladder moves to batch 36's refine:
    those systems ship in 36.
- **Renumbered:** none. Batch 35 = tasks 188–190, save v27, as recorded in the batch 34 entry.

## Batch 35.2 refined (2026-11-21, Toon's v27 playtest feedback; save v28)
Source: Discord threads 1573391746082017432 / 1573414528245567489; calculator on two of Toon's v27 saves (8 game-h of the
shipped `step()` per variant). Toon's words in quotes.
- **Bars Keep N after the Tractor** (Toon: agree). Rule 14 above ("bars never auto-sell", star-toys rule 14) now holds
  only before the Tractor; the early storage brake stays. Measured after it: bar auto-sale = 0.5–2.9 % of Estate income
  (💰7–17M/h).
- **Item orders take partial deliveries; the ordered good skips Sell on dig until the order is full** (Toon: agree).
- **Auto-buy wood (toggle) when coal runs out — furnace fuel only**; the Fields tank burns coal only (Toon: "รับ").
- **Seam aim on coal: withdrawn** (Toon accepted 2026-11-21, after first asking for it). Coal drops 828/h at full press
  vs ≈ 230/h needed at 20 fields; his coal vanished because storage was full (a Sell kind is sold when there is no
  room), the gold pickaxe was blunt, and Σ Keep N (200) exceeded storage (120). Aim coal changed nothing in any run.
  Replaced by mine status lines (storage full / pickaxe blunt / keeps exceed storage). Refs: Rosewater, GDC 2016
  "Twenty Years, Twenty Lessons" lesson 19; Factorio EntityStatus (full-output, no-fuel).
- **Σ Keep N is not capped to storage** (Hermes rec; open at dispatch): a cap still lets storage fill, and a stepper
  that stops without a reason is worse than a status line saying the keeps exceed storage.

Hermes's calls (Toon may reject by number; dispatched on "ปล่อย 35.2" with none rejected):
1. Bars Keep N is free (comes with the Tractor + Keep N), no extra price.
2. Bars auto-sell on collect only; lowering N waits for the next collect.
3. The clerk delivers partial amounts too (frees storage sooner).
4. An ordered Sell-on-dig good falls back to selling when storage is full (the miner never jams).
5. Auto-bought wood goes straight into the fire, never via storage; off by default.
6. Fixture v27 = Toon's own live save (12 fields, storage full).
- **Renumbered:** none. Next: 35.3 (fixed ⭐ per order tier, reroll → 💰500 ×2, reset on each completed order and on
  sale; save v29), 35.4 (Favours rows in Upgrades, pre-sale info page, full-width ＋ Field N), 36 → save v30.

## Batch 35.3 refined (2026-11-21, ⭐ pace after Toon's v27 feedback; save v29)
Source: Discord threads 1573391746082017432 / 1573414528245567489 / 1573420437554200597; calculator Q1 (fixed ⭐ per
tier, farm-size check, contract cap check) and Q3 (reroll cash, fresh player) on two of Toon's v27 saves. Toon's words
in quotes.
- **⭐ is a fast in-run "research point" currency** (Toon, final, supersedes "Favour levels kept across sales"): an
  early Favour level every 5–10 min of active play, never slower than 10–15 min; later levels slower through the
  geometric Favour prices. Favours still RESET on farm sale (2026-11-12 decision stands): fast ⭐ plus permanent Favours
  would be a second prestige layer outpacing deeds (Egg, Inc.: common research fast and reset, epic research scarce and
  permanent). No slowdown-triggered "sell now" nudge.
- **Order ⭐ fixed per tier = 8 / 16 / 32** (Toon: "รับ q1", then "รับ ×8"). Replaces batch 34's 0.2 ⭐ per minute of
  full output. Measured: shipped rule ⭐2.25–6/h active on the 12-field save; 1/2/4 = ⭐6.5–10.75/h (5–9× short of the
  ⭐48–90/h levels 1–10 need); ×8 = ⭐52–86/h (12 fields), ⭐116–134/h (4 fields). Offline (clerk item orders only)
  ⭐0.38/h at 1/2/4, far below active at any multiplier.
- **Every other ⭐ price ×8** so it keeps its old pace (Toon: "รับ ×8"): clerk ⭐160, manager ⭐160, stoker ⭐120,
  order slots ⭐80 / 240, ⭐ carry cap 400. Favour prices unchanged. Order slots stay priced in ⭐ (Toon OK).
- **Migration**: ⭐ balance (with starsFrac) ×8, floored; starsFrac dropped; nothing refunded (silent accept of the ×8
  sub-list).
- **Reroll for cash** (Toon: "ผมรับตามคุณเสนอ reset order แพงขึ้นครั้งละ ×2 และกลับไปราคาเริ่มต้นทุกครั้งที่ทำ order เสร็จ
  รวมถึงตอนขายฟาร์มด้วย"): 💰500, ×2 per reroll, back to 💰500 on every completed order and on farm sale; no income
  scaling. Q3: a fresh player meets the board at game-min 15.5 with 💰9.5–12.2k/h income, so 1–2 rerolls cost < 8 min of
  income (today he has ⭐0 there and cannot reroll at all); free discard + cooldown stays. Reroll fishing at 💰500 ×2
  gives +54 % ⭐/h but spent 💰150M in 4 h (≈ 3× income): a cash sink, not a ⭐ exploit. "Reroll" here is the ORDER
  reroll (Noticeboard), not batch 36's listing reroll.
- **Contract size cap** (Toon: "รับ cap contract"): a contract asks at most what its share of the managed fields grows in
  one cycle, `max(1, ⌊managed fields / slots⌋) × plot cells × plot tiles × (1 + double-harvest chance)`. The farm-size
  check showed 12 fields paid LESS ⭐/h than 4 (contracts of 521–727 units competing for the managed fields, some 20–45
  min); with the perSlot cap 12 fields ⭐112–132/h, 4 fields ⭐126–150/h, Estate cash/h +15–23 %. perSlot chosen over
  oneField (94–148 ⭐/h, swings more). A field-gated tier 3 waits until after Toon playtests 35.3.

Hermes's calls (Toon may reject by number; dispatched on the launch message with the draft as written):
1. CHANGELOG line shortened to 179 code points (the draft's 254 fail `tests/changelog.test.ts`'s 180 cap); same four
   points. Draft text: "Orders now pay ⭐8 / 16 / 32 by size, so Favours come every few minutes. ⭐ prices and your ⭐
   balance scale up ×8 to match. Rerolls cost cash and double each time until you finish an order. 🚜 Contracts never
   ask for more than your fields grow in one round."
2. Fixture v28 = Toon's live 12-field save as re-saved by the live v28 build after the 35.2 push (the same save as
   save-v27.json, migrated by shipped code), not a fresh capture.
3. Anchors re-measured on 33b76521 (the draft cited a64c68b1); `tests/sim/market-orders.test.ts` added to the files to
   touch (it reads the ⭐ order rules).
- **Renumbered:** none. Batch 35.3 = tasks 196–200, save v29. Next: 35.4 (⭐ Favours section in Upgrades, pre-sale info
  page, full-width ＋ Field N), then 36 → save v30 (36's ⭐ prices open until Toon playtests 35.3).

## Batch 35.3 follow-ups (2026-11-21)
- **35.3 Deviation 5 ACCEPTED** (Toon (Trin) 2026-11-21 08:25 Asia/Bangkok: "ผมว่ารับ แล้วเริ่มปล่อย 35.4 เลย"): the
  PIN311b looser assertion stands — "💰 ≥ 1.5M at the unlock" dropped (💰1,363,896 at minute 330); the pin is "unlock
  at minute 330 holding ⭐ ≥ 160, Manager buyable at minute 371". Closed; not reopened or "fixed" in 35.4. The same
  message is the go for batch 35.4.
- **Live width sweep of 35.3's UI** (2026-11-21 08:19): the Reroll button, the Favours carry-over line and the Sell card
  at 375 / 1024 / 1440 / 2560 / 3440 — all 5 widths OK. Minor notes, not 35.4 tasks: at 375 the Reroll button sits
  flush (0 px) against the Workers card (pre-existing, before 35.3); its disabled style is the dashed beige "blocked"
  frame, not grey.

## Batch 35.4 refined (2026-11-21, UI after Toon's v27 playtest; no save bump, stays v29)
Source: Discord threads 1573391746082017432 / 1573420437554200597 (reject-list 2026-11-21: "⭐ Favours" section at the
end of the Upgrades panel, shown when ⭐ > 0 or any Favour level > 0, HUD ⭐ scrolls there, old ⭐ sheet removed;
full-width "＋ Field N" button), the ⭐-pace decision (pre-sale page information only, always reachable, no
slowdown-triggered "sell now" nudge — Toon: players keep grinding while anything is clickable), batch 35.3 Deviation 8
(contractCap shown on the Orders card). Go: Toon (Trin) 2026-11-21 08:25 "ผมว่ารับ แล้วเริ่มปล่อย 35.4 เลย".
- **⭐ Favours live in ⬆️ Upgrades**, a section after the cash ladders, not a HUD sheet: the late-run progress sits where
  the player already looks for upgrades. The HUD ⭐ stays as the shortcut.
- **The pre-sale page only informs**: what selling gives, resets and keeps, reachable at every stage; the pull to sell
  comes from batch 36 (run variety + deeds), never from a nudge. 36.1 adds its listings to this page.
- **The contract cap is visible**: a contract smaller than the fields now says why.

Hermes's calls (Toon may reject by number; dispatched on the 08:25 go with these as written):
1. With the board bought but ⭐0 and no Favour level, the HUD ⭐ is plain text (title "⭐ comes from orders"), not a
   button: the section is hidden then, so there is nothing to jump to. With ⭐ or any level it is the jump button.
2. The section heading is "⭐ Favours", last in the Upgrades panel (after ⛏ Mine); no Upgrades-tab badge dot for
   affordable Favour rows.
3. The HUD ⭐ jump opens ⬆️ Upgrades wherever it lives in that layout (phone panel view, tablet slide-over, desktop
   1024–1439 expands a collapsed panel), then scrolls the section into view — smooth, instant under reduced motion; a
   transient request, not saved in `tiles.ui`.
4. The pre-sale page is the existing 🏆 Sell the farm card in the 🏦 Bank tab, now always shown (no new tab or
   screen); before the gate its button is the locked "🔒 Sell the farm · needs …" teaser. The deed meter line stays.
5. "Sell now: +N deeds (💰N)" becomes "Selling gives +N deeds (💰N)" (no "now"); the rest of the card's text is kept.
6. The ＋ Field N fix moves both the buy button and the "needs Pump" line out of the 341 px map grid to a full-width
   row after it; the "Fields N–M · beyond Pump" row is unchanged.
7. contractCap is shown once, in the Orders card note ("at most N each"), not on every contract row.
8. CHANGELOG line written by Hermes (178 code points): Favours in Upgrades + the Bank's sale info + the contract size;
   the full-width ＋ Field row is not mentioned (cosmetic).
9. New tests go into the existing test files (FavoursSheet, BankTab, Legacy, Estate, OrdersCard, App); no new test file.
10. Worker: Opus via Max, `--max-turns 200` (UI-only, 5 tasks, no sims; 35.2 used 190 with a save bump, 35.3 325 with
    sim re-pins), retry deadline 2026-11-22 09:00 (a short UI batch; leaves the rest of the weekly quota before Sunday
    21:00 for 36.x); live relay into thread 1573420437554200597 (the 35.3 / 36 planning thread; no separate 35.4 thread).
11. The live width sweep (375 / 1024 / 1440 / 2560 / 3440) of the new UI is Hermes's verify step after the worker, not
    the worker's.
- **Renumbered:** none. Batch 35.4 = tasks 201–205, no save bump (v29). Next: 36.1 → save v30 (dispatch after 35.4 is
  live; re-anchor its pre-sale mount on 35.4's card).

## Batch 35.4 follow-ups (2026-11-21): Toon rejects 202; ⭐ is display-only
- **35.4 task 202 REJECTED** (Toon (Trin) 2026-11-21 11:37 Asia/Bangkok, after watching a clip of the HUD ⭐ jump): the
  ⭐ in the top bar is a display-only currency, like 💰 — not a control. It is not a button, has no tap handler, no
  pointer cursor and no focus. Task 202's behaviour (tapping ⭐ switches to ⬆️ Upgrades and scrolls to ⭐ Favours) is
  removed. 202 misread his intent: he asked for Favours as rows in ⬆️ Upgrades, not for a shortcut. The ⭐ Favours
  section at the end of the Upgrades panel (35.4 task 201) stays unchanged. This reverses 35.4 refined calls 1 and 3
  and the "HUD ⭐ stays as the shortcut" line of "Batch 35.4 refined".
- **35.4 Deviations 2 and 5 → rename**: the leftover "Favours sheet" wording (the `src/core/balance.ts:248` comment and
  the test describe names in `tests/FavoursSheet.test.tsx`) becomes "Favours section".
- **35.4 Deviation 4 → hide**: the "Selling gives +N deeds" line on the 🏆 Sell the farm card shows only once selling is
  unlocked (`sellFarmUnlocked`). The card itself stays always reachable in 🏦 Bank (35.4 task 204).
- Same message: "ปล่อยรอบแก้เลย ⭐ กดไม่ได้ แก้ชื่อข้อ 1 และซ่อนบรรทัด Selling gives ก่อนปลดล็อก" = the go for this tiny
  fix batch 35.5 (tasks 206–208, no save bump). 35.4 Deviation 3 (re-scroll when already on ⬆️ Upgrades) is moot.
  Batch 36.1 still waits for its own "ปล่อย".

## Batch 35.5 refined (2026-11-21, ⭐ display-only + 35.4 leftovers; no save bump, stays v29)
Source: "Batch 35.4 follow-ups" above (Toon (Trin) 11:37). UI-only; no balance number, no sims, no save bump.

Hermes's calls (Toon may reject by number; dispatched on the 11:37 go with these as written):
1. The HUD ⭐ is one `span.hud-stars` in every case, titled "⭐ comes from orders" (35.4's existing pre-⭐ title, no new
   string); it keeps its padding so the HUD does not shift; the button reset `font: inherit` is dropped.
2. Removed with the jump: Hud's `showFavours` prop, App's `showFavours` and the one-shot scroll ref + effect. The
   section keeps `id="favours"` (harmless anchor, tests use it). No other Favours shortcut anywhere.
3. Test file renamed `tests/FavoursSheet.test.tsx` → `tests/FavoursSection.test.tsx` (`Favours.test.tsx` would
   case-clash with `tests/favours.test.ts`). Reject → keep the file name, rename the describes only.
4. Before the gate only the "Selling gives" line is hidden; the ⭐ carry line, Resets, Carries and the locked
   "🔒 Sell the farm · needs …" button stay, and nothing replaces the line (the Bank deed meter above already says
   "→ N deeds when "Sell the farm" opens"). After the gate "+0 deeds" still shows when nothing is left to gain.
5. CHANGELOG: the shipped 35.4 line is AMENDED — "tap ⭐ in the top bar to jump there" dropped and "what selling the
   farm gives" → "what selling the farm resets and keeps" — because the in-game Changelog tab would tell players to
   tap a ⭐ that does nothing and promise a gain line that is now hidden pre-gate. New 35.4 line (153 code points):
   "⭐ Favours now sit at the end of ⬆️ Upgrades. The 🏦 Bank always shows what selling the farm resets and keeps, and
   Orders say how big a 🚜 contract can get." Reject → leave the 35.4 line as history.
6. CHANGELOG 35.5 line (158 code points): "The ⭐ in the top bar is now just your ⭐ count, not a button; Favours stay
   at the end of ⬆️ Upgrades. The sale card shows the deeds you get once selling opens."
7. Worker: Opus via Max, `--effort medium`, `--max-turns 120` (3 small UI tasks, no save bump, no sims; 35.4 used 118
   of 200 for 5 tasks), retry deadline 2026-11-22 09:00 (as 35.4: one 5-hour-reset retry still fits, the rest of the
   weekly quota stays for 36.x before Sunday 21:00).
8. Live relay into thread 1573420437554200597 (the 35.3 / 35.4 / 36 planning thread; no separate 35.5 thread exists).
9. The live width sweep (375 / 1024 / 1440 / 2560 / 3440: ⭐ not tappable, Favours section still last in ⬆️ Upgrades,
   "Selling gives" hidden before the gate and shown after) and the v29-save load check are Hermes's verify step after
   the worker, not the worker's.
- **Renumbered:** none. Batch 35.5 = tasks 206–208, no save bump (v29). Next: 36.1 → save v30 (waits for its own
  "ปล่อย"; re-anchor on 35.5's HEAD).

## Batch 36.1 refined (2026-11-21, sale listings + soil + ⭐ reroll + roll memory; save v29 → v30)
Sources: Toon's batch 36 decisions (Hermes drafts, outside the repo: `b36-decisions.md`, `b36-split.md` row 36.1 +
reject-list 2 "×8 → reroll ⭐40/80/160/320", accepted "รับหมด"; `b36-calculator.md` items 2–3 "listing soil ±20 %",
groups roots = potato, carrot, corn / fruit-veg = eggplant, pumpkin, tomato, chilli / berry = lemon, grape,
strawberry, accepted; districts Direction C accepted, pool of 3 (Orchard Valley, Iron Hills, Wetlands); listing roll
memory in 36 accepted). Go: Toon 2026-11-21 11:38 — start 36.1 right away once 35.5 is pushed (35.5 pushed 12:10,
9b227822). Draft `tiles-b36.1-plan.md` (anchors d0c52954) re-anchored on 9b227822.

Hermes's calls (Toon may reject by number; dispatched on the 11:38 go with these as written):
1. Plain carries NO soil — the plain row is today's farm exactly, the zero-RNG exit.
2. Districts are offered from the first sale (the 2026-11-13 "first sale soil-only" ramp predates Direction C and is
   superseded by the accepted 36.1 row "3 listings (plain + 2)"). Reject → gate the district axis on
   `prestigeCount >= 1` (one line in `currentListings`).
3. A soil pair uses two distinct groups (6 ordered pairs, uniform); the two rolled rows name two distinct districts.
4. The roll hashes `(listingSeed, prestigeCount, listingRerolls)`, never `run.rngState` — actions never move the
   offers, reload / import shows the same ones.
5. One reroll replaces BOTH rolled rows for one price; a rerolled offer is uniform over all 3 districts (it can fetch
   the last-played one). Only the first offer of a sale applies the memory: last-played excluded, unplayed ×3,
   played ×1 (est.).
6. The reroll ⭐ is paid from the run balance before the sale; ⭐600 max per sale sits above the 400 carry cap on
   purpose (the sale-time ⭐ sink).
7. NEW at refine: the reroll works only once the sale gate is open (LOCKED before) — ⭐ spent on a sale hours away
   would be lost value; the rows themselves show at every stage (the card is information before the gate, 35.4 /
   35.5). Reject → allow rerolls before the gate.
8. Soil threads into every grow-time reader: tiles, rot grace (2 × the soil grow ticks; slow crops get no extra rot
   protection), harvest, field plots, order sizing (`orderPerMinute`), the Manager's income curves and
   `marketSteadyFactor`, so the ±20 % shows wherever the game plans (the calculator's −16.7 % … +25 % band assumes it).
9. `sellFarm(state, choice = PLAIN_LISTING)` validates the choice against the recomputed offer (BAD_CHOICE on a stale
   pick) — one transition, nothing half-sold to migrate; every existing `sellFarm(state)` (tests, sims) sells into
   plain, so no pin moves.
10. NEW at refine: migrated saves get `listingSeed` from a hash of prestigeCount + deedsClaimed + floor(lifetime
    cash) (the draft hashed only the first two, which is 0 / 0 for every player who never sold — Toon included —
    so every migrated save would see the same first offer); a new game starts at seed 0.
11. Card copy shows group names only ("roots", "fruit-veg", "berry"), never crop lists, and promises no district
    mechanics (36.2 / 36.3). Plain row "🏡 The plain farm · today's farm, no soil"; glyphs 🏡 🌳 ⛏️ 🌊 🔄 all
    Unicode ≤ 11. A reroll resets the selection to the plain row (no sale into a row the player did not look at).
12. Stats gains one "This farm" row (the active listing), so a mid-run player can see the soil.
13. NEW at refine: two new errors `REROLL_MAX` ("No rerolls left this sale") and `BAD_CHOICE` ("That listing changed —
    pick again").
14. NEW at refine: the only sim is PIN36a — the SHIPPED ladder bot (unchanged licence list: carrot, corn, eggplant,
    pumpkin) to the Fields unlock on plain + 3 soils, each within ±20 % of plain. The draft's plain10-licence-list
    bot needed a new bot knob; the shipped bot already covers the roots and fruit-veg groups that soil moves before
    Fields. PIN36b (estate income per soil within −16.7 % … +25 %) is a pure-function test on
    `fieldsMarginalIncomePerHour`, not a bot run.
15. Fixture `tests/fixtures/save-v29.json` = `post-deploy-v29.json` (Toon's 12-field save, written by the live v29
    build; 35.4 / 35.5 added no save fields), committed with this plan.
16. CHANGELOG 36.1 line (176 code points): "Selling now offers your next farm: the plain farm or two rolled listings
    where one crop group grows 20 % faster, another 20 % slower. 🔄 Reroll them for ⭐40–320, up to 4 a sale."
17. Worker: Opus via Max (`--effort medium`, `--max-turns 250`; 4 tasks with a save bump, a new core module, a
    threaded argument over ~15 call sites, UI and one sim; 35.3 used 325 turns for 5 tasks with sims). The
    b36-split reject-list item 4 named GLM for 36.1; the launch message asked for Opus. Retry deadline 2026-11-22
    09:00; live relay into thread 1573420437554200597 (the 36 planning thread).
- **Renumbered:** 36.1 = tasks 209–212 (the draft's 36.1-1 … 36.1-4), save v30. Next: 36.2 (Orchard Valley + Iron
  Hills, save v31) is planned only after 36.1 is dispatched, re-anchored on 36.1's HEAD.

## Batch 36.2 refined (2026-11-21, Orchard Valley + Iron Hills play differently; distinct listing soils; save v30 → v31)
Sources: Toon's batch 36 decisions (Hermes drafts, outside the repo: `b36-split.md` row 36.2 "District framework:
top-5 supply lists, Orchard berry sell ×1.4, Orchard tree bed (1 bed, 1.25 × grow), Iron Hills forge (bars + coal →
order goods, margin ≤ 30 %). Sim pins: each district within ±20 % to Fields; bot licence lists per district. v31",
accepted "รับหมด"; `b36-decisions.md` Direction C + the 6 calculator items; `research/b36-synthesis.md` items 4–6
(tree bed 1.25 × growTicks, supply lists vary only the top 5, Iron Hills = forge), accepted; `b36-calculator.md` items
1–4). Draft `tiles-b36.2-plan.md` (anchors d0c52954) re-anchored on 8113458b (after 36.1). Go: Toon (Trin) 2026-11-21
15:05 "ปล่อย" for 36.2.

Toon-approved (not a Hermes call): **distinct soils** — the two rolled listings of one offer must not share a soil
(36.1 live check: both rows can roll the same soil, ≈ 1 in 6 per offer, which empties the soil part of the choice).
Toon approved folding this fix into 36.2 (2026-11-21, relayed by Side Project Bot). Task 213.

Hermes's calls (Toon may reject by number; dispatched on the 15:05 go with these as written):
1. Distinct soils, how: soil B is redrawn from the same rng while it equals soil A (draws after the existing four, so
   every already-distinct offer — the 36.1 fixture pin included — stays byte-identical; colliding offers get a uniform
   pick among the other 5). "Distinct" = a different ordered pair; the rows may share the fast group when the slow
   group differs. Reject → require different fast groups.
2. Numbering 213–218 (six tasks: 213 soils, 214 district framework, 215 save v31, 216 tree bed, 217 forge, 218 pins +
   changelog). The save bump (state shapes + migration) is its own commit BEFORE the mechanics, so no task has to
   carry another's bump (36.1 Deviation 1).
3. Wetlands keeps 36.1's behaviour in 36.2 (full shop, no berry ×1.4, no hint); its list, ×1.4, no-mine and barge go
   live together in 36.3. The draft turned on Wetlands' ×1.4 here; a Wetlands list without the rest would only make it
   −33 %.
4. The supply list binds the shop only: licences already owned (keepLicenses deed) keep working in every district —
   nothing is taken away. Reject → owned-but-unlisted licences go dormant in a district run (then the deed loses value).
5. Berry ×1.4 is an optional `district` argument on `cropSellPrice` (default plain), passed at the 6 runtime call
   sites (market sale, order price, the Manager's curve, the payback label, Estate text, Orders card); tests and the
   v26 migration keep it off, so no existing pin moves.
6. Unlisted licences stay visible in the Shop as disabled rows "not sold in {district}"; the new error NOT_SOLD_HERE
   reads "Not sold in this district". Reject → hide the rows.
7. The Next farm rows gain one hint line on the two districts that now differ: Orchard Valley "sells 8 of 10 crops ·
   berries ×1.4 · 🌳 fruit tree", Iron Hills "sells 7 of 10 crops · 🔨 forge" (counts, not crop lists — 36.1's 375 px
   rule). Without it the choice 36.2 creates is invisible at the sale.
8. Tree bed rules beyond the accepted q6 numbers: the cadence uses BASE grow ticks — fertilizer, the Legacy growTime
   rows and the listing soil do not apply (est.; keeps the 101–103 % pin exact); the bed must be empty to plant (new
   error BED_BUSY "Harvest that bed first"); a sprinkler already on that bed stays (harmless); first fruit after 2
   cadences; 3 fruit per tile then it pauses; one harvest takes the whole tile stock as one action (+1 harvest, renown
   +2 hand / +1 worker, ×1.25 by hand, no sickle double, no seed roll); harvest targets put tree tiles after ripe crops.
9. Tree tiles stay ordinary `tilled` tiles in `run.tiles`, marked by `run.tree.bed` (no new TileStatus, so every
   status switch in the UI and sims is untouched); `run.tree = { bed, crop, ticks[6], stock[6] }`.
10. Forge: the PLAYER picks the recipe (Off by default); the ore loader loads only that recipe, after its furnace work,
    and never picks one itself. The draft had the loader load the cheapest runnable recipe, which would spend bars the
    player keeps for certificates without asking. Reject → loader picks the cheapest runnable recipe.
11. Forge prices and glyphs (est.): build stone 30 + coal 10 + 🥉5 + 💰1,500 (the draft said "anchored on the furnace
    price"; the furnace is 💰150, so this is simply an est.); recipes 🔧 Toolbox 🥉4 + coal 1 → 💰520, ⚙️ Plough blade
    🥈2 + coal 1 → 💰1,250, ⛓️ Anchor chain 🥇3 + coal 2 → 💰3,600 (+28.7 / +24.5 / +19.7 %; the signatures doc's
    💰700 toolbox was +73 %); one good per 300 ticks; tray 10; 🔨 for the forge. All glyphs Unicode ≤ 11.
12. A forge good joins the order pool only once its bar is in the pool (anchor chain needs gold bars) — the pool's
    "goods the player can make now" rule.
13. Pins: the only sim is PIN36c (shipped ladder bot to the Fields unlock per district licence list, through the
    existing `licenses` / `crops` options — no new bot knob). The draft's 24 game-h Iron Hills bot run for the
    goods-order share (≤ 35 %) and its bars-diverted report needed a forge-running bot (a new knob) — replaced by a
    pure `orderPool` share test (PIN36g); the estate pin (PIN36d, −10 % … +25 %, est. band) and the tree pin (PIN36e,
    ±15 %) are pure-function tests.
14. Fixture `tests/fixtures/save-v30.json` = `post-deploy-v30.json` (Toon's save migrated v29 → v30 and re-saved by the
    live v30 build, 2026-11-21 14:06; browser workspace `local-db523ba8…`), committed with this plan.
15. CHANGELOG 36.2 line (177 code points): "Orchard Valley and Iron Hills now play their own way: each sells its own
    seeds; Orchard berries pay ×1.4 and grow a 🌳 fruit tree; Iron Hills stamps bars into goods at a 🔨 forge." The
    distinct-soils fix is not in the line (it would pass the 180 cap; players see only that rows differ).
16. One batch, not split into 36.2a / 36.2b (the draft's fallback): the forge is the last mechanic task (217), and an
    out-of-turns stop resumes the same session through the retry watcher. Split only if a resume also stalls.
17. Worker: Opus via Max (`--effort medium`, `--max-turns 450`: six tasks, two new systems, a save bump, UI in four
    places and one sim; 36.1 used 243 of 250 for four tasks); retry deadline 2026-11-22 09:00 (as 35.4–36.1); live
    relay into thread 1573420437554200597 (the 36 planning thread; no separate 36.2 thread exists).
18. Deferred, as in the draft: ⭐ Favour rows for the tree bed and the forge (36's ⭐ prices wait for Toon's single
    playtest), the almanac deed. Renown comes free through tree fruit (the crop's own renown).
19. The live checks (v30 → v31 migration, width sweep of the hints, Shop rows, 🌳 sheet + tree bed, Forge card) are
    Hermes's verify step after the worker, not the worker's.
- **Renumbered:** none. Batch 36.2 = tasks 213–218, save v31. Next: 36.3 (Wetlands: no mine, barge, its list + berry
  ×1.4) → save v32, planned only after 36.2 is dispatched, re-anchored on 36.2's HEAD.

## Batch 36.3 refined (2026-11-22, Wetlands: no mine, river bank beds, the 🌊 barge, its list + berry ×1.4; save v31 → v32)
Sources: Toon's batch 36 decisions (Hermes drafts, outside the repo: `b36-split.md` row 36.3 "Wetlands: no mine, bank
beds count for the Fields gate, barge shop (bars ×1.25, stone 3, coal 5), bar certificates paid through the barge. Pins:
no-mine bot within ±20 % to Fields, Fields-tank coal, no soft-lock. v32", accepted "รับหมด"; `b36-decisions.md` crux
(Wetlands has no mine, full reroute, contract ⭐ bonus only on a gap) and calculator items 1, 3, 5, 6 accepted;
`b36-calculator.md` item 4 (barge model); `research/b36-signatures.md` §4 (bank beds 0–1, the two bricked-run traps);
`research/b36-districts-pool.md` §2 / §4.3). Draft `tiles-b36.3-plan.md` of 2026-11-21 08:19 (anchors d0c52954,
SAVE_VERSION 29) re-anchored on ad3075d0 (= origin/main 974e4dc6 after batch 36.2 + the local 36.2 archive commit).
Go: Toon (Trin) 2026-11-22 16:29 "งั้นปล่อยให้หมดเลยทีเดียว" — batches 36.3, 36.4, 36.5, 36.6 one after another; this
entry covers 36.3 only.

Hermes's calls (Toon may reject by number; dispatched on the 16:29 go with these as written):
1. Numbering 219–223 (five tasks: 219 save v32, 220 Wetlands framework, 221 bank beds + reroutes, 222 barge + River
   view, 223 bot knob + pins + changelog). The save bump is its own first commit (36.2 call 2).
2. Save v32 is a version stamp only: 36.3 adds no run or meta field (barge prices are static; bank beds and every
   reroute derive from the district and the mine licence). Kept so the accepted chain holds (36.4 = v33 … 36.6 = v35)
   and the real v31 fixture proves the migration chain. Reject → no bump, and 36.4–36.6 renumber to v32–v34.
3. "No mine" = a Wetlands run that does not own the mine licence. A Wetlands run that already bought the licence under
   36.1 / 36.2 (Wetlands then had a full shop) keeps its whole mine — nothing is taken away; it still gets the bank
   beds, the barge, the list and ×1.4. A fresh Wetlands run can never buy the licence (buyMineLicense → LOCKED).
4. Wetlands supply list = the 5 cheap rungs + tomato, lemon, grape, strawberry (9 of 10, no chilli; calculator
   assumption 3) and berries ×1.4 (calculator item 1, same constant as Orchard). Next farm hint: "sells 9 of 10 crops ·
   berries ×1.4 · 🌊 river beds, no mine" (58 code points; 36.2's Orchard hint is 49).
5. Bank beds = beds 0–1 (tiles 0–11) on EVERY Wetlands run from tick 0 (signatures §4 rule 2; `BANK_BEDS = 2`, est.):
   the fresh run's 9 starting tiles never need water. No 18-tile home cap (the pool doc's variant; rejected for v1 in the
   synthesis). Reject → bank bed 0 only.
6. The Fields water gate is true on every Wetlands run (the bank beds always exist), so the Shop's 🚜 Fields row shows
   without a workshop and never asks for "1 bed sprinkler" there.
7. Workshop, sprinklers and the smart valve stay unreachable on a no-mine run (vein Lv4 gate; no vein): pumps skip the
   workshop check on Wetlands, storage levels skip the mine-licence check on a no-mine run (stone from the barge), and
   a sprinkler socket on a bank bed is LOCKED (only a grandfathered run can have a workshop). Without the valve,
   pivoted fields burn tank coal on every plot — priced into barge coal.
8. The tank hand: on a no-mine run the fuel certificate unlocks with the Fields (its old gate, 30 bars collected, can
   never be reached), same price (🥉8 + 💰200 via the barge). With no coal in storage it buys ONE barge coal straight
   into the tank when the tank has room (no toggle, no new state), so an 8 h away keeps the Fields pressured like a plain
   run whose miner digs coal. Reject → the player buys tank coal by hand only.
9. Barge prices: bars ×1.25 of their sell price (🥉125 / 🥈625 / 🥇1,250), 🪨3, ⚫5 (accepted, est.), scaled by the cost
   deed like wood — plus a floor the calculator did not need: the barge price is always at least the item's current
   sell price + 1. Why: the Better prices levels continue through the uncapped ⭐ sell Favour and the sell deed, so a
   fixed ×1.25 would turn into a buy → sell cash loop for a veteran. PIN36i pins it.
10. Where the barge lives: a no-mine run shows a "🌊 River" view in place of the Mine view (storage count, the barge
    rows with ×1 / ×10, the item grid with sell buttons), and the phone tab reads "🌊 River" instead of "⛏️ Mine". The
    draft put the barge in the Shop; barge buys land in storage, and storage + its sell rows live in this view. The Shop
    shows no Mine license or wood row on Wetlands. Reject → barge rows in the Shop's Supplies row instead.
11. Hidden on a no-mine run: the ore and mine worker rows (the stoker is already hidden until owned) and the vein row in
    Upgrades (the storage row shows alone under "📦 Storage"). The ⭐ Favours section is NOT touched (36's ⭐ prices wait
    for Toon's playtest), so its furnace rows show on Wetlands as they do before the furnace on plain.
12. No contract ⭐ bonus in 36.3. The accepted rule ships it only if the numbers show a gap; Hermes measured the rule
    instead of simming it: an order's ⭐ is its tier's fixed 8 / 16 / 32 and the offer rate does not depend on the pool,
    and every Wetlands offer is a crop the farm grows (PIN36j pins both). The gap, if any, is in filling effort, which
    Toon judges in his playtest. Reject → Wetlands contracts pay ×1.25 ⭐ now.
13. Sims: ONE sim, PIN36h (plain10 to the Fields + a 24 game-h Wetlands run), with a priced new bot knob `barge`
    (WETLANDS_LADDER = FIELDS_LADDER minus every mine / furnace / workshop goal; the goal's shortfall bought at the barge;
    no mining). The draft's pin (b) "tank never empty while cash ≥ one barge coal" tested the bot, not the game: it is
    now PIN36h's after-unlock report plus PIN36k's pure check that an empty tank still ripens plots (Fields never stall,
    `fields.ts:409–414`, so coal cannot soft-lock a run). The draft's pin (c) ⚡-overflow report is dropped (accepted
    overflow; Toon sees it in play). The gate-by-gate table is a pure test (PIN36k).
14. Pre-approved PIN36h fallback (the accepted free variable, calculator item 5): if Wetlands reaches the Fields more
    than 20 % SLOWER than plain10, the bars drop to ×1.0 (🥉100 / 🥈500 / 🥇1,000; the +1 floor still applies) and the
    pin is re-run once. Still out of band, FASTER than −20 %, or a bot deadlock → `it.fails` with the measurement and a
    Deviation; the worker tunes nothing else.
15. Fixture `tests/fixtures/save-v31.json` = a live re-save: the committed save-v30.json seeded on the live v31 build
    (bundle CAC14g-7) on 2026-11-22, migrated and re-saved by the live code after its 8 h offline catch-up (version 31,
    plain listing, ⭐79, 24 tiles, 10 licences, mine licence, tree null, forge unbuilt), committed with this plan.
16. CHANGELOG 36.3 line (139 code points): "🌊 Wetlands is the farm with no mine: the river waters two beds for free, a
    barge sells bars, stone and coal for cash, and berries pay ×1.4."
17. Worker: Opus via Max (`--effort medium`, `--max-turns 400`: five tasks, a bot knob + one sim, UI in seven files; 36.2
    used 294 of 450 for six); retry deadline 2026-11-29 09:00 (the next weekly reset at the panel time 35.4–36.2 used,
    2026-11-22 09:00, which has passed); live relay into thread 1573420437554200597 (the 36 planning thread; no separate
    36.3 thread exists).
18. Deferred, as in the draft: ⭐ Favour rows Mill race / Leat, fishing, the almanac deed. Not in this batch either: the
    open 36.2 nits (1024 tree fruit count, empty Orchard tree sheet hint, Forge Collect reason when storage is full) and
    the 375 top-bar wrap.
19. The live checks (v31 → v32 migration, width sweep of the River view, tab label, bank beds, Shop Fields row,
    storage row, Wetlands hint) are Hermes's verify step after the worker, not the worker's.
- **Renumbered:** none. Batch 36.3 = tasks 219–223, save v32. Next: 36.4 (dig finds + relics, v33), planned only after
  36.3 is pushed, re-anchored on 36.3's HEAD.
