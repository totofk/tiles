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
- The sold-run sim pin shipped as ≥ 1.4× faster to the fields unlock (`tests/sim.test.ts:3977–3999`); the 1.8× in
  the batch 20 prestige entry above is superseded.
- Worker rework (unique hires with traits) recorded as docs/IDEAS.md §8.
