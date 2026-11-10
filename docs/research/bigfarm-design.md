TILES — PLACED SPRINKLERS AND THE ESTATE

Design only: nothing edited, created or committed, no git. I read the code and docs but did not run the tests or sim, and did not open the live build. Numbers marked (est.) are for the repo sim to pin.

SUMMARY

One rule carries both locked points: geometry is allowed inside a block whose shape is fixed in world coordinates, never between blocks. Blocks flow with the viewport; tiles inside a block never move.

- Home plot = four beds of 3×2 tiles. A sprinkler is installed on a bed, paid when placed, never moved, no upkeep; its six tiles lose their moisture bar for good (L1). Today's numbers already describe this: 6 tiles × max 4 machines = the 24-tile cap.
- Big farm = fields of 5×2 plots. A plot is 10 tiles, one tractor pass (today's PLANT_BATCH / HARVEST_BATCH). Each plot takes one permanent field sprinkler, fed by pump tiers (today's pipe recipes).
- Buying the 🚜 Tractor changes the main screen: the centre becomes the Estate map, with the home plot as one live card among the fields. There are two zoom levels (Home, Estate), not a free camera. The side panel becomes the ledger of what is planted, by what, how many (L2).
- The player gets back the decision automation took: a crop plan per plot, with marginal 💰/h per crop on screen.
- Cohorts become plots with identity at the same simulation cost; per-tile simulation of field tiles is rejected. Tools, workers, machines, market, orders and prestige keep their rules (L3).
- Door questions: D2, D3, D5 and D6 are answered as raised. D1 and D4 dissolve (no unplaced sprinkler, no coal). D7 is overruled (round up). D8 is no.
- Verify first: Fields crops currently ripen in half their grow time (fields.ts:278), so every Fields income pin includes a hidden ×2.

1. DIAGNOSIS: WHY IT FEELS MIXED

The game runs three paradigms, each fine alone:
- Place: a tile is a thing with state that you tap (tile.ts, FarmGrid.tsx).
- Agent: a worker picks a target by priority every 5 s for a wage (workers.ts:74–80).
- Aggregate: a count with rates (fields.ts cohorts, the 3 bars).

The mixed feeling comes from nouns that promise one paradigm and behave as another.

a. The sprinkler is a Place noun with Agent behaviour.
- It re-picks "the 6 driest" every action (workshop.ts:75–85, 104–112), and its badge jumps (sprinklerWatered, :126–129).
- DECISIONS 356 says "No placement UI"; DECISIONS 354 says its value is "returning a worker slot". It is a seventh worker paid in coal.
- Watered tiles still draw a draining moisture bar (FarmGrid.tsx:82), so the player never stops caring.
- The pump burns coal with nothing to water (workshop.ts:122).

b. Fields are Aggregate nouns inside a Place screen.
- DECISIONS 367–369 defines them as an "unbounded COUNT shown as 3 bars".
- They render as the last collapsed details element after Workers and Workshop (Farm.tsx:103, App.tsx:168, Fields.tsx:41). The biggest system sits in the smallest box.

c. Field watering is a third rule.
- The unlock gate asks for "≥ 1 sprinkler" (fields.ts:54), but fields are watered by pipe tiers (balance.ts:292).
- Coverage is a prefix over cohort order (fields.ts:117–123, 269–279). Planting order decides which tiles are dry; the player can neither see nor choose.
- One "shared pump" follows two coal laws: hoppers through the fuel loader, and a direct storage draw (fields.ts:256–265).

d. Agency shrinks as scale grows.
- The player cannot harvest Fields at all (fields.ts:184–189).
- The seeder picks the crop itself (seederCrop, :304–319). PRD 4.2's "rotate crops" decision is automated away exactly where it starts to matter.

e. The root cause is "never by row, rows change with layout" (DECISIONS 117–119, 240–241, 356).
- FarmGrid.tsx:99 sets columns to ceil(sqrt(n)) on desktop, so the grid goes 3 → 4 → 5 columns when you buy tile 10 and tile 17. app.css:333–334 fixes 3 columns on phones.
- With no stable neighbour, every spatial object had to be built as a count or a priority. Fix this and a–c fall out.

f. Field data says the problem is missing decisions, not missing automation.
- Playtest round 1: "I feel idle, I need something else to do".
- DECISIONS 285: "real players idle after two workers".
- Batch-18 sim: pipes → field 100 took 448 minutes in which the only action is "+1 Field".

g. Fields grow twice as fast as the home plot (read from code and tests, not run).
- plantFields sets readyTick = tick + growTicks. fieldsAct then subtracts 1 per covered tick while run.tick also advances.
- tests/fields.test.ts:232–238 pins it: 600 steps move readyTick 600 closer.
- It matches the sim: 10 lemon tiles earn 25.6k/h, where normal speed gives about 12k. Batch 18 attributed the gap to orders and the sickle.
- All Fields prices were pinned against this income.

2. THE DESIGN

2.1 Rule (replaces "never rows/radius")
A mechanic may use position only inside a fixed-shape block: a bed (3×2 tiles) or a field (5×2 plots). How blocks are arranged on screen is free.

2.2 Home plot: beds and the placed sprinkler
- Bed k = tiles 6k … 6k+5, drawn 3×2. No save change: it is derived from the tile index.
- Phone: beds stack, which is exactly today's 3 columns at the same cell size.
- Desktop: 2×2 beds = 6×4, a better landscape fit than today's 5×5.
- Only beds with an owned tile render. One ghost tile shows the next tile's price; tapping it buys (the Shop row stays).
- Sprinkler: installed on one bed; recipe unchanged (4 Au + 8 Fe + 8 Cu + 💰8,000); max 4.
- Effect: the bed's tiles grow as if moist and never drain. No moisture bar is drawn; the bed gets a blue frame and one static 💧. There is no 5-s action, no target list and no badge.
- No upkeep, for three reasons:
  - Batch 17 measured the pumps at 32 of 372 coal/h, so coal is not a constraint.
  - Its only effect is a failure state (stall) that contradicts "stops caring".
  - It needs three extra objects: hoppers, the loader's second job and the smart valve.
- The mine's load moves to capital: bars for every field sprinkler (§3).
- Why beds rather than "pick any 6 tiles":
  - Every farm sim lets you move sprinklers free because placement can be wrong. Farm Together 2's lossy move is a rage thread (https://steamcommunity.com/app/2418520/discussions/0/4338733186958761567/).
  - Permanent placement is enjoyed where it is previewed and consequential, as in Civ VI districts (https://civ6.fandom.com/wiki/District) and Islanders (https://en.wikipedia.org/wiki/Islanders_(video_game)).
  - Home tiles are identical, so placement has no consequence. The safe form of L1 is one where a wrong placement cannot exist.

2.3 The Estate
- Unlock: the 🚜 Tractor. This is the Fields unlock renamed, with the same gate (fields.ts:49) and price (10 Fe + 💰10k).
- Units: plot = 10 tiles sharing crop, ripening time and sprinkler. Field = 10 plots (5×2), numbered, unbounded in count.
- Plot states: for sale → dry (no sprinkler; cannot be planted) → fallow (no plan) → queued (plan set) → growing → ready → queued.
- Water: one permanent field sprinkler per plot (est. 1 Au + 2 Fe + 2 Cu + 💰3,000), no upkeep.
- Pump tiers: today's three pipe recipes, feeding 30 / 60 / 100 field sprinklers (est.; today 60 / 150 / 300 tiles).
- Plan: every plot has a plan crop. You paint it with the home plot's gesture one scale up: pick a crop chip, tap plots.
- Work ladder repeated at the new scale: you (a tractor pass, one tap per plot) → planter/harvester workers (one plot per action, today's batch) → Seeder/Harvester Mk1–3 (whole plots, following the plan).
- Screen: the centre shows the Estate map, with the home card first (24 emoji-only mini tiles, live) and then the fields.
- The side panel's 🌾 tab shows the ledger in Estate scale:
  - Capacity lines, current vs potential: water k/n plots, seeding, harvest, plus one bottleneck word.
  - Per-crop rows: plots planned / growing / ready, 💰/h, price trend and recovery, and "next plot ≈ +💰X/h".
  - Purchases with time-to-afford and payback.
- The ledger patterns are Anno's current/potential bars and Cookie Monster's payback, already sourced in placement-scaleview.md.

2.4 Options evaluated

(a) Fixed pannable/zoomable world map.
- It does remove the unstable-rows constraint, but fixed blocks remove it too at a fraction of the cost.
- Camera costs in a DOM game:
  - Pinch fights browser zoom and page scroll on phones.
  - Targets fall under 44 px when zoomed out.
  - Text renders at fractional scale.
  - The camera must be saved, bounded and recentred.
  - None of it is testable in jsdom.
  - A fixed map contradicts unbounded land.
- It becomes worth it when real art arrives (DECISIONS line 7 keeps Phaser open). The model stores no screen positions, so a canvas can be laid over it later.

(b) Zoom levels that switch representation: adopted as discrete levels.
- Levels: tile (Home), plot (Estate), and a collapsed field row on phones past about 10 fields.
- Precedents: Supreme Commander's strategic zoom swaps units for icons (https://en.wikipedia.org/wiki/Supreme_Commander_(video_game)). Factorio's map view switches at a zoom threshold (FFF-183, cited in placement-scaleview.md). Microsoft's semantic-zoom guidance is two views of the same grouped content (https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/semantic-zoom).

(c) Recommended: change the unit, not the camera. The shift is tile → plot with the same verbs; the zoom is its presentation.

Perf.
- Today: 3,000 tiles are up to 300 cohorts, re-allocated every tick. 8 h offline measured 340 ms (batch 19).
- Plots: a growing plot holds an absolute readyTick and is untouched per tick. The per-tick work is a scan for ready and queued plots, about 28,800 × 300 ≈ 8.6 M comparisons. Expected at or below today's figure (est.).
- Per-tile: 28,800 × 3,000 immutable tile copies is seconds, not milliseconds, and saves grow about tenfold (they ride in the feedback form). Under L1 a field tile has no individual state left. Rejected.

Phone, 375 px.
- Home scale is unchanged, plus a 12 px gutter and a chip per bed.
- Estate:
  - A sticky strip carries the existing 3 bars.
  - Home card about 190×130 px.
  - Field blocks are 5 columns of about 67 px cells; a field is about 170 px tall, or a 44 px row when collapsed.
  - A crop-chip paint bar replaces the tool bar above the tab bar.
  - Plot sheet and ledger are bottom sheets.
- Scrolling is native and vertical. No 7th tab.

3. ALWAYS SOMETHING TO DO

Minute to minute in the Estate (decisions; nothing dies if skipped):
- Plan (every 10–20 min; market half-life is 15 min).
  - Strawberry at the floor still nets about 0.33 💰/tile/tick against lemon's 0.25 at full price (my arithmetic on balance.ts).
  - So "plant the least glutted crop", today's seeder rule, is clearly not optimal.
  - The puzzle is to put each plot where marginal 💰/h is highest; the ledger shows that number.
- Orders (every few minutes). A big crop order bypasses the glut, so repainting plots to fill it is a real trade against the plan.
- Expand (when cash or bars land). Cash buys plots; bars buy sprinklers. The choice is gold on sprinklers vs Harvester Mk3 vs Pump 3.
- Drive (any time, with energy). Harvest ready plots yourself when harvest is the bottleneck. Late-game energy finally has a use.
- Home plot. Hand-picked ×1.25 and the nursery gate (50 home harvests before a crop may be planted in the Estate, eight crops). The ledger shows "🏡 32/50" on locked crops to pull the player back.
- Mine and furnace.
  - 100 plots need about 100 Au + 200 Fe + 200 Cu.
  - I estimate one mine worker at about 28 gold or 36 iron bars per hour, with the furnace on one ore kind at a time.
  - Choosing the ore kind and buying molds (batch 26) are the decisions; iron is the binding bar.
- Workers. Sprinklers free the water workers; the pool cap of 6 makes reassignment a choice.

Where boredom would set in:
- Pre-Tractor sprinkler ladder: about 36-minute waits on gold. Unchanged by this design; not fixed here.
- Plan in equilibrium, all crops unlocked, pump full. That is the intended prestige moment; the ledger should say "Estate at pump capacity — Sell the farm for N deeds".
- If a good plan beats Auto by under about 10 %, painting is busywork (see §7).

4. THE DOOR PROBLEM
(https://lizengland.com/blog/the-door-problem/; [T] = only the designer can answer)

HOME SPRINKLER
- When can I build one? When the Workshop is built, a bed has ≥ 1 owned tile and no sprinkler, and the recipe is in storage. Otherwise the bed's chip is greyed with the missing materials (the existing shortOf line).
- How do I place it? Tap the bed's "＋💧" chip, or Workshop → Sprinkler → "choose a bed" (beds pulse; a sticky bar holds Cancel). A confirm sheet names the bed and says "permanent". Payment happens on confirm.
- D1: no bought-but-unplaced state exists. Cancel costs nothing.
- D5: a Cancel bar only; one tap selects and the sheet confirms.
- D2: a bed has one slot. After install there is no button.
- Bed with unowned tiles? Allowed. Tiles bought later in that bed arrive irrigated.
- Move, remove, sell? No. Only "Sell the farm" resets it; it joins the Resets list.
- Regret? Beds are identical and all four end up covered. No wrong choice exists.
- How do I know it works? Blue frame, static 💧, no moisture bars, and the tile is never labelled dry.
- D3, manual can and Water tool: a tap on a sprinkled tile is a free no-op with a toast, no energy and no waters count. Water-tool presses skip it. There is no watering mastery to protect (DECISIONS 152).
- D3, water worker: skips sprinkled tiles with no new rule, because it only takes tiles about to run dry (workers.ts:78–79). When every owned tile is sprinkled, its row says "nothing to water — reassign".
- D4: does not exist. Hoppers, pump burn and valve are removed; the fuel loader keeps the furnace.
- Offline? Sprinkled tiles grow. Worst-case loss is 0.
- [T] A later in-place upgrade (for example gold for +10 % growth on that bed)? Parked.

PLOT AND FIELD
- How is land bought? In order. Price is the sum of today's ten tile prices: 💰10,000·p + 5,500 for plot index p. Buttons are ×1 / ×10 / max; a ghost cell shows the next price.
- How are states told apart? By icon and text, never colour alone: ghost + price, tan + 🚱 "needs a sprinkler", brown fallow, faded plan emoji, emoji + bar, gold ready.
- Can a dry plot be planted? No. "Planted but stalled forever" disappears. It survives only for migrated stalled cohorts (⏳, resumes when a sprinkler arrives).
- Not enough seeds or cash for a whole plot? The plot waits, and the ledger names the reason. No partial plots.
- Rot? None, as today. A late harvest costs throughput.
- D7 overruled: round an old count up to a full plot, free. A partial plot is a permanent special case in every loop, to save at most 9 tiles.
- Scale? 3,000 tiles = 300 plots = 30 fields.
- [T] Keep the hidden ×2 field growth as a named, displayed constant, or fix it and re-pin every Fields price? I recommend keeping it: prices were set against it, and halving live incomes breaks the spirit of the save rule.

FIELD SPRINKLER AND PUMP
- How is it bought? On the plot sheet, or "Fill sprinklers ×k" in the ledger with the total price.
- D6: k = min(dry plots, pump room, what storage and cash afford). The button names the binding limit, for example "Fill 12 · Pump 1 feeds 30 — build Pump 2". Never silent.
- Land beyond the pump? Buyable, shown dry with the reason.
- Coal? None.
- [T] Keep the pump cap at all? I recommend yes: three owned purchases stay meaningful, it is the sim's plateau lever, and Dinkum's water tank is the precedent (https://dinkum.fandom.com/wiki/Water_Tank).

TRACTOR
- What does it visibly do?
  - The screen zooms out once.
  - Plots can be bought.
  - One tap works a plot: plant is free, as "Plant 10" is today.
  - New: harvest a ready plot for 5 ⚡ (est.; continuous tapping should be about Harvester Mk1). It sells like a worker harvest and is never hand-picked.
- D8: nothing on the home plot. The Lv3 tools already own "tiles per press" (the round-4 axis rule), and a tractor harvest there would blur hand-picked.
- The machines are its attachments; the workers' batch of 10 is "workers on the tractor".
- Locked state: the Shop card is greyed with the three gate lines, as today.
- [T] Is an energy cost in the Estate acceptable? DECISIONS 374 said Fields cost 0 energy. Only the new harvest pass costs energy; nothing existing gets dearer.

ESTATE VIEW
- When does it exist? After the Tractor. Before that there is no switch.
- How do I move between scales? A Home | Estate control above the grid. Tapping the home card zooms in; Esc or back zooms out. The last scale is kept in tiles.ui, never the save.
- First time? A banner plus one automatic zoom-out.
- What does a tap do? With a crop chip selected it sets the plot's plan. With none it opens the plot sheet (state, plan, Plant/Harvest now, Install sprinkler).
- Painting many plots? The field header has "plan whole field".
- Where does the old Fields card go? It becomes one line in Home scale: "🚜 Estate · 40 plots · 12 ready →".
- Mine, Shop, Orders, Bank? Unchanged.
- Reduced motion? Cross-fade.

MACHINES
- What do they act on? Whole plots, when carry reaches the plot's tiles. The seeder already works in whole batches (fields.ts:399). A 🚜 flash shows on the plot.
- Which plot? Oldest ready, oldest queued.
- Which crop? The plot's plan. An "Auto" plan is today's seederCrop rule and becomes available once a Seeder is owned, so the machine still brings the automation.
- Can't pay seeds or maintenance? As today: hold, pause, never debt. The ledger says why.
- Tiers, maintenance, sickle and dibber inheritance are unchanged.

WORKERS
- Planter and harvester: home plot first, then one plot per action following the plan. A planter with no planned plot idles unpaid.
- Water worker: unsprinkled home beds only, never the Estate.
- Mine worker, loaders, clerk: unchanged.
- [T] The parked "workers draw from energy" idea is untouched by this design.

5. MIGRATION (nothing lost; a one-time "what changed" banner lists every conversion)

- Sprinklers: n owned → installed on beds A.. in order. Tiles are owned in index order, so these are the fullest beds.
- Hopper coal → storage; overflow → cash at coal's sell price.
- Smart valve → refunded in full (2 Au + 💰8,000). Its milestone stays.
- Water workers stay assigned. The fuel loader stays on the furnace.
- fields.count → ceil(count / 10) plots.
- Cohorts → plots:
  - Pack by crop, 10 per plot.
  - The earliest readyTick of the merged parts wins.
  - Add a free plot if fragments do not fit.
- Pipes tier N → Pump N plus 6 / 15 / 30 field sprinklers. They go on the plots holding the cohorts that were covered. Formerly stalled cohorts stay planted-dry (⏳).
- Plan = each plot's current crop. Empty plots take fields.plantCrop, or Auto if a Seeder is owned.
- coalCarry is dropped (it was a debt). Machines and their carries are unchanged. Milestones and lifetime are untouched.
- Test pin: each migrated fixture (v17, v18) earns at least as much over 8 h as before migration.
- One edge to watch: ready cohorts used to take no coverage, so a farm whose harvester lags could lose a little throughput. The pin catches it; if it shows, grant a few extra sprinklers.

6. BATCH SPLIT
Slot around the planned batches 25–26; each save bump is +1 on whatever is current.

E1 Beds (UI only, no save)
1. FarmGrid renders beds (3×2, bed = floor(i/6)); beds flow 1 column under 768 px and 2×2 above; remove the sqrt columns; add the ghost next-tile cell.
2. Compact cell (emoji + growth bar) and a MiniLot component, reused by the Estate home card.
3. DECISIONS entry for the block rule; jsdom tests; live measurement at 375 / 1024 / 1440 / 3440.

E2 Placed sprinklers (core, save +1)
1. Fixture first. Workshop state = built + bed list. Migration as in §5.
2. Core:
   - Install on a bed replaces buySprinkler.
   - The sprinkled rule goes into stepTile.
   - Delete hoppers, the pump burn, the valve and the loader's hopper branch.
   - water and toolTargets skip sprinkled tiles.
   - The Fields gate reads beds.
3. UI: bed chip, confirm sheet, placement mode, blue frame, hidden bars, the water-worker hint.
4. Sim re-pin: ladder gaps ≤ 60 min, income around the 4th sprinkler, coal budget without pumps, step identity.

E3 Estate shell (UI only, no save)
1. Scale switch, tiles.ui scale, the one-time ceremony, copy "Fields" → "🚜 Tractor / Estate".
2. Centre view on today's cohort state: home card plus ledger. No plot cells yet, because cohorts have no identity and would visibly roam. The Fields card becomes the one-line link.
3. Phone layout: sticky 3-bar strip, ledger sheet.

E4 Plots (core, save +1)
1. Fixture; plot model; migration; the growth-factor decision as a named constant.
2. Core:
   - Buy plot ×n.
   - Field sprinkler and Fill.
   - Pump tiers.
   - Plan per plot, including Auto.
   - Whole-plot plant and reap for the player (energy), workers and machines.
   - Delete the prefix rule and the coal carry.
3. Sim:
   - Perf pins at 1,000 / 1,920 / 3,000 tiles under 2,000 ms, plus step identity.
   - The migrated-income pin.
   - Auto vs best fixed plan (report the gap).
   - No step over 60 min from Tractor to Pump 2 with bars as pacing.
   - Machine re-pins.
4. Ledger wired to plots.

E5 Estate map (UI only)
1. Field blocks, memoised plot cells, ghost cell, collapsed field row.
2. Paint bar, plot sheet, "plan whole field".
3. Zoom transition, keyboard, reduced motion, live measurements.

Later, each on its own go: per-bed crop pin, field traits, sprinkler upgrade.

7. RISKS AND THE SPIKE

Risks:
- E4 rewrites fields.ts and shifts the RNG stream, so every Fields-era pin re-pins. Budget for it.
- The plan may not matter (Auto within 10 % of the best plan). Then painting is a chore. Fallback: Auto for everyone, and move the decision to field traits.
- With coal gone the mine may feel idle until the Tractor. Bars per plot must bind without stalling.
- Paint versus scroll on phones. Tap only, no drag.
- The ×2 growth decision changes every number downstream.
- Feel: two discrete scales may read as "a tab" rather than a zoom if the transition is weak.

Spike (one sitting, throwaway, outside the repo):
- A static page drawing the Estate from tests/fixtures/save-v17.json hand-converted to 40 plots: home card, 4 fields, ledger, scale switch with the zoom transition, paint. Toon opens it at 375 and 1440.
- It answers three things: does it feel like "my farm got big"; are 67 px plots readable and tappable; is painting pleasant at 40 plots and at a faked 300.
- A no means only E5 changes. Beds, sprinklers and the plot model stand.
- Same day, a calculator on balance.ts functions for Auto vs even split vs marginal-greedy at 300 and 1,000 tiles gives the go/no-go number for the plan mechanic.

8. BEYOND THE BRIEF (labelled alternatives)

ALT-A, overturns batch 17: no upkeep anywhere. Detailed above. If Toon wants a running cost anyway, the least bad form is one estate-wide coal draw from storage that pauses new planting when empty and never un-waters anything.

ALT-B, overturns the draft's "pick 6 tiles, move free": beds. Pick-6 with L1 adds a multi-step mode, partial picks and permanent regret, for a choice that has no content.

ALT-C, on L2's form: two discrete scales now, a real camera only with real art.

ALT-D, making permanence matter: field traits.
- Each new field offers one of three permanent traits, for example faster growth, better order prices, or plots that need no sprinkler.
- Then "cannot be moved" produces Civ VI-style planning.
- "Sell the farm" gains a second meaning: next farm I lay out better.
- This is the strongest long-term answer to boredom. It is new content, so it needs its own go.

ALT-E, an honest note on "buy sprinklers to match the land": through a Fill button it is a materials toll, not a decision. Its job is to load the mine. If play shows it dull, sell "irrigated plot" as one purchase in cash plus bars.

ALT-F: a per-bed crop pin on the home plot. It is useful for orders today and teaches the plan gesture before the Tractor.

9. DECISIONS (reply with the numbers you reject)

1. Geometry only inside fixed blocks — removes the root cause of every count-based workaround.
2. Home plot = four 3×2 beds — phone layout unchanged, neighbours stable.
3. Sprinkler installed on a bed, permanent — L1 with no possible misplacement.
4. Pay at placement, with a confirm; no unplaced state — D1, D2 and D5 answered.
5. No upkeep; hoppers, pump coal and valve removed, valve refunded — coal was 10 % of supply and only added a stall (D4).
6. Sprinkled tiles show no moisture bar; can, tool and worker skip them — "stops caring" made visible (D3).
7. The unlock is the 🚜 Tractor, same gate and price; it does nothing on the home plot — Toon's story, and the tool axis stays single-owner (D8).
8. Plot = 10 tiles, field = 10 plots, land sold by plot at today's summed prices — matches the existing batch of 10, no price change.
9. Old counts round up to a full plot — generous and removes a permanent special case (D7 overruled).
10. One permanent field sprinkler per plot; dry plots cannot be planted — replaces the invisible prefix stall.
11. Pipes become pump tiers feeding 30 / 60 / 100 sprinklers; Fill names its limit — keeps owned purchases and the plateau lever (D6).
12. Crop plan per plot, painted; Auto arrives with the Seeder — returns the PRD's rotation decision without taking automation away.
13. Player harvest pass for energy (5 ⚡ est.), never hand-picked — the Tractor visibly does something, and energy gets a late-game use.
14. Workers and machines act on whole plots, following the plan — one visible unit of work.
15. Estate is the main view after the Tractor; two zoom levels, no free camera now — L2 at DOM cost, phone-safe.
16. The 🌾 tab becomes the ledger in Estate scale; no new tab — 375 px is full.
17. Plots replace cohorts; no per-tile field simulation — same cost as today, and identity for the map.
18. Keep the ×2 field growth as a named, displayed constant — prices were pinned on it; the fix is yours to call.
19. Order: E1 UI → E2 save → E3 UI → E4 save → E5 UI — UI-first, with two isolated save bumps.
20. Spike the Estate page from the v17 fixture before E3 — the risk is feel, not code.
21. Park field traits, per-bed crop pin and sprinkler upgrades — good levers, separate goes.
