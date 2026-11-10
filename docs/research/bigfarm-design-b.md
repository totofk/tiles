TILES — DESIGN B: ONE VALLEY, ONE CAMERA

Design only: nothing edited, created or committed, no git. I read the repo, the docs and Design A. I did not run the tests, the sim or the live build. Numbers marked (est.) are for the repo sim to pin. URLs that are new in this doc were read from search snippets, not full pages.

CORE IDEA

Design B gives the game a world. Every tile gets a fixed address on one map, and the screen becomes a camera on that map. Everything the player places (a sprinkler, a pivot, a parcel of land) has a real position and a real reach. The tile stays the only unit from the first carrot to field tile 1,000, and the Tractor unlocks the camera. In one sentence: A keeps space abstract and changes the unit (tile → plot, two scales), while B keeps the unit and makes space real (one grid, one camera, radius-based placement).

Borrowed from A, named once:
- no sprinkler upkeep, and the valve refund;
- pay on confirm, with no unplaced state;
- land priced as the sum of today's tile prices;
- pump tiers built from the pipe recipes;
- the ×2 field growth kept as a named constant;
- a player reap for energy;
- the "Auto" crop mode arriving with the Seeder;
- the migrated-income test pin.

1. DIAGNOSIS — ONLY WHERE I DISAGREE WITH A

I agree with A's points a–g, including the ×2 ripening bug. Three disagreements and one addition:

- The root cause is one level deeper than "never by row": the game has no world, and every system is a card. Sprinklers and Fields are only the first two nouns whose identity is a place. IDEAS.md hits the same wall for the next ones ("Where trees grow… rows are not stable, use a tile count/zone", line 40; then barn, pond, buildings). Blocks fix two nouns; a map fixes the class.
- A answers lost agency with a painted plan per plot. But a sale depends only on the crop's glut (state.ts:71, market.ts:16–21), and no plot has a property. Painting 300 plots is the same decision as eight numbers, with more taps. A flags this risk itself in its §7.
- A makes L1 safe by removing the place. A bed slot is an upgrade checkbox, and no wrong choice exists because no choice exists. That meets L1's letter. Toon's reason was "in reality you cannot move a sprinkler easily", which describes an object standing somewhere.
- Addition from field data: playtest round 2 said digging felt pointless with "no idea… what the mine can be upgraded into". Land you can see but not yet afford applies the same lesson to Fields. Today the next field is a button label (Fields.tsx:86–90).

2. THE DESIGN

2.1 Rule (replaces "never rows/radius")
A tile's address is a pure function of its index or its parcel, never of the viewport. The viewport only moves the camera. Rows, neighbours and radius are then legal in mechanics.

2.2 World and camera
- The world is one grid of equal tiles. It holds the home lot (6×4, the 24-tile cap), landmarks for the mine and workshop, and land parcels around them. The landmarks are status chips that open today's panels; they add no rules.
- Home addresses: tiles 1–12 fill a 3×4 block, and tiles 13–24 fill three more columns top to bottom. The owned shape grows 3×3 → 3×4 → 4×4 → 5×4 → 6×4 and no tile ever moves. This replaces ceil(sqrt(n)) (FarmGrid.tsx:99) and the phone's fixed three columns (app.css:333–334).
- Camera = {x, y, zoom}, kept in tiles.ui. Before the Tractor it is clamped to the home lot and auto-fits the owned shape.
- Representation follows rendered tile size, one rule everywhere (est.):
  - ≥ 80 px: the full cell as today.
  - 44–80 px: a compact cell (emoji, bars, one status glyph); a tap still acts.
  - 16–44 px: glyph tiles; a tap selects a stretch or parcel.
  - under 16 px: parcels as shapes striped by crop, with a count badge; a tap flies in.
- Precedents: Factorio's map view switches at a zoom threshold (https://www.factorio.com/blog/post/fff-183); Supreme Commander's strategic zoom (https://en.wikipedia.org/wiki/Supreme_Commander_(video_game)).
- Rendering: the home lot stays DOM (the existing Cell). Field tiles draw on canvas, one per visible parcel, redrawn on a tick or a camera change. Labels and buttons sit in an unscaled DOM overlay, so text stays sharp and parcels stay focusable. DECISIONS line 7 already keeps a canvas layer open.

2.3 Home lot: the placed sprinkler
- A sprinkler is a post on a corner point of the lot grid, so it occupies no tile. It waters every lot tile whose centre is within 1.6 tiles: up to 12, a 4×4 without its corners (est.; today 6).
- The recipe is unchanged (4 Au + 8 Fe + 8 Cu + 💰8,000). The cap goes 4 → 6 (est.). Four posts at (2,1), (4,1), (2,3), (4,3) cover all 24 addresses (checked by hand).
- Wet tiles always grow, never drain and draw no moisture bar. There is no 5-s action, target list, jumping badge, coal, hopper or valve.
- Placement:
  - a ghost post snaps to corner points and the tiles in reach light up;
  - a counter reads "+9 new · 3 already wet";
  - "◎ Best" jumps to the spot with the most new tiles;
  - the confirm names the cost and says "permanent".
- Free placement can survive permanence here for two reasons. The outcome is shown before commit, as in Islanders (https://en.wikipedia.org/wiki/Islanders_(video_game)) and Civ VI districts (https://civ6.fandom.com/wiki/District). And the worst case is one extra sprinkler, never lost crops.
- Rusty's Retirement players already place water stations by reach with future land in mind: "it will cover most of the fields to the left and then if I expand to the right" (https://www.youtube.com/watch?v=4tX_oUPHgTg).

2.4 The Tractor, land, pivots and the pump
- 🚜 Tractor = the Fields unlock renamed, with the same price and the same gate (fields.ts:49–56, reading "≥ 1 placed sprinkler"). Buying it releases the camera clamp and plays one pull-back from the lot to the valley.
- Land is sold as parcels: irregular shapes of 24–64 tiles cut by a river, a road and rocks. MAP_V1 is about 48 parcels and 2,000 tiles (est.), followed by generated 8×8 squares without end.
- The authored valley covers the range that matters. At most 8 × 240 = 1,920 planted tiles fit before every crop sits on its price floor (balance.ts:413; fewer at field speed).
- You buy at the frontier. A parcel's price is the sum of today's tile prices for its tiles. Farming Simulator sells land the same way from its map, where "the width and length of the plot can be important" (https://www.ign.com/wikis/farming-simulator-22/How_to_Buy_Land).
- Pivot = the field member of the sprinkler family. It is a post on a corner point of land you own, radius 3.0, up to 32 tiles, recipe 3 Au + 6 Fe + 6 Cu + 💰9,000 (all est.), permanent, no upkeep.
- A pivot waters owned tiles in reach across parcel borders. Unowned tiles in reach turn wet when bought.
- Real pivots leave corners dry: about 80 % of a square alone, 85–95 % when nested (https://www.ars.usda.gov/ARSUserFiles/21563/center%20pivot%20design%202.pdf). That is the puzzle: tiles per pivot.
- Dry field tiles cannot be sown. "Planted but stalled" and the prefix rule (fields.ts:117–123, 269–279) disappear.
- Pump tiers = today's three pipe recipes, capping wet field tiles at 300 / 600 / 1,000 (est.).
- This is Toon's sentence made literal: sprinklers, then a tractor, then sprinklers to match the land you opened.

2.5 Simulation: cohorts gain a position
- Wet field tiles form one route. Each coverage event (a pivot placed, a parcel bought) appends its newly wet tiles in serpentine order. Because nothing moves (L1), a route index is stable for the whole run.
- A cohort becomes a run {start, length, crop, readyTick} on the route. readyTick is absolute and nothing is touched per tick, which also retires the ×2 bug.
- Two passes travel the route. The reap pass takes ready tiles from its cursor. The sow pass fills fallow stretches behind it in batches of 10 (PLANT_BATCH unchanged).
- Pass speed is what exists today: field workers' 10 tiles per action, plus the Harvester and Seeder rates.
- The map draws a 🚜 at each cursor, so the tractor drives. DECISIONS 240–241 ruled out walking figures only because rows were unstable.
- Per-tile simulation is rejected, as in A: 3,000 tile objects × 28,800 ticks. Runs give every tile an identity at cohort cost.
- Perf (est.): about 300 runs at 3,000 tiles. A tick does work only when a run is ready or a stretch is fallow, with the same per-tile harvest rolls as today. I expect it at or below today's 340–549 ms. Save size stays about today's.

2.6 The ledger: what, how, how many
- The 🌾 tab lists crops, not land. Each crop row shows a target in tiles (± 10), standing / growing / ready, 💰/h, price trend, and "next 10 ≈ +💰X/h". The last number is the existing marginal function (fields.ts:416–427), per crop.
- The sow pass plants the crop furthest below its target. Accepted orders' shortfalls go first, as today (fields.ts:304–319).
- This replaces fields.plantCrop and the "best market factor" pick. That pick is wrong on the numbers: strawberry at the price floor nets about 0.33 per tile-tick, lemon at full price 0.25 (A's arithmetic, re-derived).
- "How": each row shows who works the crop (hand on the home lot, field hands, implements). Capacity lines show wet tiles vs pump and the sow and reap rates, plus one bottleneck word.
- Allocation by count is the Kittens Game job panel (https://wiki.kittensgame.com/en/game-tabs/outpost).

2.7 The brief's options
- (a) A fixed map removes the unstable-rows constraint entirely. Its price is the phone (below) and map data that becomes part of the save contract.
- (b) Adopted as thresholds on tile size, not as named screens.
- (c) Two things I think beat both earlier proposals: positioned cohorts instead of plots or per-tile state, and crop targets instead of per-plot plans.
- Phone, 375 px:
  - Before the Tractor the lot fits the width: about 114 / 84 / 65 / 53 px cells at 3 / 4 / 5 / 6 columns. Cells are compact from 5 columns; pinch or double-tap for full cells.
  - After the Tractor the map fills the space between the HUD and the tool bar, with touch-action: none (https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action). Drag pans and pinch zooms; ＋ / － / 🏡 buttons do the same.
  - The cards under the grid today (App.tsx:162–170) move to a pull-up sheet. No 7th tab.
- A's camera objections, answered:
  - browser pinch: touch-action;
  - small targets: below 44 px a tap selects, never acts;
  - text: the unscaled overlay;
  - getting lost: 🏡 and clamped bounds;
  - jsdom: camera maths and hit-testing are pure functions, and pixels are measured live as layout is today;
  - unbounded land: generated parcels.

3. ALWAYS SOMETHING TO DO

Decisions, none of which punish absence:
- Survey (when cash lands): which frontier parcel. Compact shapes take fewer pivots. Ragged ones pay off only if you plan the overhang onto land you will buy next.
- Place (when bars land): where the next pivot goes. About 36 placements reach 1,000 tiles. "Best" makes each a single tap for players who don't care.
- Mix (every 10–20 min; the glut half-life is 15 min): move targets toward the best marginal 💰/h.
- Orders: a big crop order bypasses the glut. Accept it and the sow pass re-aims by itself.
- Take the wheel (any time): tap a ready stretch to reap 10 tiles for 2 ⚡ (est.). Late-game energy gets a use.
- Home lot: hand-picked ×1.25 and the 50-harvest nursery gate stay. The ledger shows "🏡 32/50" on locked crops.
- Mine and furnace: 1,000 wet tiles need about 108 Au + 216 Fe + 216 Cu (est.). Ore kind and molds (batch 26) are the choices.
- Workers: sprinklers free the water workers. Six slots are shared across mine, furnace, field hands and clerk.

Where boredom would set in:
- The gold wait before the Tractor (about 36 min per sprinkler today). Not fixed here.
- Pivot placement after the tenth. The novelty decays, and "Best" plus a later auto-surveyor is the answer. If greedy placement is near-optimal, the puzzle was never there (see the spike).
- Pump 3 full and targets settled. That is the intended prestige moment.

4. THE DOOR PROBLEM
(https://lizengland.com/blog/the-door-problem/; [T] = only the designer can answer)

HOME SPRINKLER
- Where can it stand? Any corner point touching an owned tile, unless a post is already there.
- When? Workshop built and the recipe in storage. The preview works before you can pay and lists the missing materials.
- D1: no bought-but-unplaced state. Payment happens on confirm; cancel is free.
- D2: reach may overlap, and the preview counts the waste. Two posts on one point are refused.
- D3: a tap on a wet tile is a free no-op with a toast. The Water tool and the water worker skip wet tiles. No watering mastery exists (DECISIONS 152), and the waters-counter gates are passed long before the Workshop.
- D4: gone. No coal anywhere in watering.
- D5: yes, a fixed bar: Cancel · ◎ Best · Place (+9).
- Move, remove, sell? No. "Sell the farm" resets it and lists it.
- Unowned addresses in reach? Shown faintly. A tile bought there arrives wet.
- Regret? Bounded at one extra sprinkler (cap 6).
- [T] Accept that regret, or restrict posts to the four perfect points (A's bed, drawn as a post)?
- How do I know it works? A post on the map, a wet tint, no moisture bar. Tapping the post shows its ring and "waters 12".
- Offline? Wet tiles grow. Loss 0.

PIVOT AND PUMP
- D6: the pump caps wet tiles. Place is disabled with "Pump 1 is full (300/300) — build Pump 2". A pivot that would cross the cap is refused whole. Nothing stalls silently.
- Dry tiles? Pale, 🚱 on inspect, cannot be sown. The ledger counts them ("420 land · 372 wet").
- Is thirty placements a chore? "Best" is one tap; hold for "place 5 best".
- Into the home lot? No. The lot is fenced and the two families do not mix.
- [T] Keep the pump cap? I say yes: it keeps the pipe purchases meaningful and is the sim's plateau lever.
- [T] Keep field growth at ×2 as a displayed constant ("field soil ×2"), or fix it and re-pin every Fields price? I agree with A: keep.

LAND PARCEL
- How do I buy? Tap a for-sale parcel next to owned land. The inspector shows tiles, price, "about 2 pivots for 90 %" and payback.
- Not adjacent? Greyed, "buy a neighbour first".
- States? For sale, dry, wet-fallow, growing, ready. Each has an icon and text, never colour alone.
- D7: no partial unit exists. An old tile count becomes whole parcels, rounded up, free.
- Past the authored valley? Generated squares, unbounded.
- [T] Parcel traits (for example a riverbank that needs no pivot)? Parked.
- [T] A new valley shape after each "Sell the farm"? Parked.

TRACTOR
- What does it visibly do? It unlocks the camera once, then drives: one 🚜 per pass, at its cursor.
- No field hands and no implements? It stands still, and the ledger says "no driver".
- By hand? Sow 10 free (today's button, now a tap on fallow land). Reap 10 for 2 ⚡, never hand-picked.
- D8: nothing on the home lot. The Lv3 tools own tiles-per-press, and a tractor harvest there would erase hand-picked.
- [T] Is energy in the fields acceptable (DECISIONS 374 said 0)? Only the new reap costs any.

MAP AND CAMERA
- When does it move? Zoom inside the lot always; beyond it after the Tractor.
- Controls? Desktop: the wheel zooms at the cursor, drag pans, plus arrows / + / − / Home. Phone: drag, pinch, double-tap, buttons.
- Panning by accident while tapping tiles? While the lot fills the view the camera is docked: a drag that starts on a tile does not pan.
- After offline? The camera opens on fit-all, so the banner's numbers are visible.
- Where did the Fields and Workshop cards go? Fields becomes the ledger tab. Workshop keeps its recipes. On phones both live in the sheet.
- Reduced motion? Cuts instead of flights.
- [T] Compact 53 px home cells on phones from tile 17, or keep three wide and page sideways?

MACHINES
- What do they act on? The route, in order, at today's rates and maintenance. Sickle and dibber inheritance is unchanged.
- Which crop? The targets. "Auto-balance" (today's rule) is offered once a Seeder is owned, so the machine still brings automation.
- Can't pay seeds or maintenance? As today: hold, pause, never debt. The ledger names the reason.

WORKERS
- Planter and harvester: home lot first, then they join the passes (10 tiles per action, same wage).
- Water worker: dry home tiles only. When none exist its row says "nothing to water — reassign".
- Miner, loaders, clerk: unchanged. The fuel loader loses its hopper branch (workers.ts:59–62).

5. MIGRATION (nothing lost; one "what changed" banner)

Home (save +1):
- n hoppers → n posts on the perfect points, in order. Those points are optimal, so there is nothing to regret, and each post waters more tiles than before.
- Hopper coal → storage, with overflow sold at coal's price.
- Valve → refunded in full (2 Au + 💰8,000). Its milestone stays.
- Tile addresses are derived from the index, so no tile data changes.

Fields (save +1):
- fields.count → whole parcels in frontier order, rounded up.
- Pipes tier N → Pump N, plus pivots auto-placed by "Best" until wet tiles ≥ max(old coverage, covered + ready tiles). Capacity is never below what is wet at migration.
- Cohorts → runs in the same order, one to one, with no merging.
- Cohorts stalled beyond the pipes never grew. Their seeds return to the pouch (it has no cap, state.ts:57) and the land stays owned.
- plantCrop and the seeder's pick → targets equal to what stands now. Auto-balance is on if a Seeder is owned.
- coalCarry is dropped (it was a debt). Machines and their carries are unchanged.
- Test pin: each migrated fixture (v17, v18) earns at least as much over 8 h as before.
- New liability: MAP_V1 and the "Best" placer become part of the save contract. A later map edit is a migration.

6. BATCH SPLIT
(batches 25–26 are already planned; each save bump is +1 on whatever is current)

B1 Fixed lot and camera shell (UI only)
1. Address function; FarmGrid renders at fixed addresses; ghost cells; remove the sqrt columns.
2. Camera module (pure maths, wheel and pointer handlers), clamped to the lot; tiles.ui.
3. Size-based cell levels; phone docking; live measurement at 375 / 1024 / 1440 / 3440.

B2 Placed home sprinkler (core, save +1)
1. Fixture first; workshop = {built, posts}; migration.
2. Core:
   - place, the wet set, and the wet rule in stepTile;
   - delete hoppers, the pump burn, the valve and the loader branch;
   - water targets skip wet tiles;
   - gates read posts.
3. UI: placement mode, Best, confirm, posts, wet tint.
4. Sim re-pin: ladder gaps ≤ 60 min, coal budget without pumps, step identity.

B3 The valley, read-only (UI only)
1. MAP_V1 data with validators (connected, sizes, frontier order).
2. Canvas parcel renderer and overlay. It shows today's land count and pipe coverage per parcel, with no field tiles yet: cohorts have no position and would roam, as A notes.
3. Tractor rename and pull-back; ledger tab reading today's cohorts; phone sheet.

B4 Parcels, pivots, runs (core, save +1)
1. Fixture; model (events, runs, cursors, pump, targets); migration.
2. Core: buy parcel, place pivot, route builder, passes, target rule; delete the prefix rule and coalCarry.
3. Sim:
   - perf pins at 1,000 / 1,920 / 3,000 tiles under 2,000 ms;
   - migrated income;
   - no step over 60 min from Tractor to Pump 2;
   - Auto vs best targets (report the gap).
4. UI wiring: inspector, pivot placement, target steppers.

B5 The tractor drives (UI plus one small core action)
1. Field tiles at glyph and compact levels; 🚜 at the cursors.
2. Take the wheel (tap to sow or reap, energy).
3. Keyboard, reduced motion, gesture hardening on real phones.

B6 Polish: "place 5 best", landmarks, after-offline framing.

7. RISKS AND THE SPIKE

Risks:
- Phone gestures are the largest: tap versus drag on the game's most-tapped surface.
- Permanent free placement can feel bad even when the loss is bounded.
- The placement puzzle may be empty. If "Best" is within about 5 % of the optimum, it is a button, not a decision.
- B4 rewrites fields.ts and reorders harvest rolls, so every Fields pin re-pins (same as A).
- Map data is content. Someone must draw 48 parcels and keep them forever.
- Canvas and gestures are outside jsdom, so more rests on Hermes' live checks.

Spike (one sitting, throwaway, outside the repo):
- A static page with a hand-drawn valley, the camera, the v17 fixture's 400 tiles turned into parcels, and pivot placement with the live counter. Toon opens it at 375 and 1440.
- It answers three things: does the pull-back feel like "my farm got big"; is placing a pivot pleasant under a thumb, and still at the tenth; does pan fight tapping.
- The same day, a script compares greedy "Best" with exhaustive placement on that valley and gives the tiles-per-pivot gap.

8. BEYOND THE BRIEF (labelled alternatives)

ALT-1, bends L1: "dig up for scrap". It is a demolition that returns half the bars, not a move. It is the safety valve for free placement and still fits "cannot be moved easily". Without it, regret stays bounded at one sprinkler.

ALT-2: posts only on the four perfect points. This removes regret. It is A's bed with B's look.

ALT-3: a new valley after each "Sell the farm" (a seed in meta). Permanence gets a second life: next farm I lay out better.

ALT-4: the map as the home of the parked ideas. Woodland, pond, barn and processing buildings (IDEAS 2, 3, 4, 6, 7) all need a "where", and dry pivot corners are natural building sites. This is B's real long-term return, and A does not provide it.

ALT-5: if the phone spike fails, keep B on desktop and give phones A's stacked view of the same state. That is two views to maintain; I would not start there.

9. HEAD-TO-HEAD

- L1 fit — B, narrowly. Both satisfy it. B's sprinkler is an object with a reach; A's is a slot on a bed. A is safer.
- L2 "paradigm shift" feel — B. One world and a camera that pulls back. A names its own risk that two scales "may read as a tab".
- L3 drift from existing systems — A. B keeps cohorts and batch sizes but replaces the whole centre column and the phone layout.
- Always something to do — B. Parcel choice and placement are decisions A removed on purpose, and targets are A's plan with fewer taps. The placement novelty is unproven.
- Phone 375 px — A, clearly. Native scroll against gesture capture.
- Perf / offline 8 h — tie. Both do work per event, not per tile. B adds a cheap canvas redraw once a second.
- Save migration risk — A. B's cohort conversion is simpler (one to one, no packing), but map data and an auto-placer enter the save contract.
- Implementation cost — A. Five batches against six heavier ones, with canvas and gestures untestable in jsdom.
- Door-Problem questions left open — A. Five [T] against seven, and B adds a camera's worth of states.

A wins five, B three, one tie.

10. RECOMMENDATION: A HYBRID — "A'S GROUND, B'S SKY"

Do not ship B as written. Its strengths are feel and decisions. Its costs are the phone, the canvas, the map contract and an unproven puzzle. But B's two cheapest parts cover the two risks A admits about itself.

Take from A (the ground): the block rule, beds, the bed sprinkler, no upkeep, plots of 10, fields of 10 plots, one sprinkler per plot, pump tiers, plots replacing cohorts, and the migration.

Take from B (the sky):
- Crop targets instead of the painted plan. The decision is the mix, eight steppers beat 300 taps, and it is literally "what is planted, how, how many".
- One zoomable surface instead of a Home | Estate switch. The home lot sits inside the same surface as the fields, and zoom steps through Tiles → Plots → Fields by tile size.
- That surface is built as layout zoom: a tile-size variable on DOM blocks. It needs no canvas, no transform and no gesture capture. Phones get native scroll with a ＋ / － rocker; desktop gets wheel and drag.
- The sprinkler drawn as a post with a reach ring at the bed's centre, and a 🚜 marker on the plot being worked.
- The pull-back ceremony.

Leave out for now: free-radius placement, irregular parcels, the canvas camera and positioned runs. The spike prices them. If Toon enjoys placing pivots under his thumb and the greedy gap is real, B's field layer (2.4–2.5) replaces plots at roughly two extra batches. That call is made before A's E4, not after.

11. DECISIONS FOR THE HYBRID (reply with the numbers you reject)

1. Geometry only inside fixed blocks [A] — removes the root cause at the lowest cost.
2. Home plot = four 3×2 beds [A] — phone layout unchanged, neighbours stable.
3. Sprinkler installed per bed, permanent, paid on confirm, no unplaced state [A] — L1 with no possible regret; D1, D2, D5.
4. No upkeep; hoppers, pump coal and valve removed, valve refunded [A] — coal was 10 % of supply and only added a stall; D4.
5. Draw the sprinkler as a post at the bed's centre, with a reach ring on tap [B] — an object in a place, at zero rule cost.
6. Wet tiles show no moisture bar; can, tool and worker skip them [A] — "stops caring" made visible; D3.
7. 🚜 Tractor is the unlock, same gate and price, and does nothing on the home plot [A] — Toon's story; D8.
8. Plot = 10 tiles, field = 10 plots, land at today's summed prices, old counts rounded up [A] — matches the batch of 10; D7.
9. One permanent field sprinkler per plot; dry plots cannot be sown [A] — replaces the invisible prefix stall.
10. Pump tiers feed 30 / 60 / 100 sprinklers, and the buy button names its limit [A] — keeps the pipe purchases; D6.
11. Crop control = a target per crop in plots (± steppers, marginal 💰/h shown); workers and machines fill the biggest shortfall, orders first; no painting [B] — the decision is the mix, not the place.
12. "Auto-balance" (today's rule) arrives with the Seeder [A] — the machine still brings automation.
13. One zoomable surface with the home lot inside it, three stops by tile size, instead of a two-state switch [B] — L2 feel; answers "reads as a tab".
14. Zoom is layout zoom on DOM blocks: native scroll and a rocker on phones, wheel and drag on desktop [new] — camera feel without canvas or gesture capture.
15. Buying the Tractor plays one pull-back through the stops [B] — the screen changes the moment the purchase lands.
16. At the Tiles stop a plot shows its ten tiles; a 🚜 marker sits on the plot being worked [B] — "still tiles", and visible work.
17. The 🌾 tab becomes a by-crop ledger with capacity lines and one bottleneck word; no new tab [A + B] — 375 px is full.
18. Plots replace cohorts; no per-tile field simulation [A] — same cost as today, identity for the surface.
19. Player reap pass for energy (5 ⚡ est.), never hand-picked [A] — energy gets a late-game use.
20. Keep the ×2 field growth as a named, displayed constant [A] — prices were pinned on it; the fix is yours to call.
21. Batch order is A's E1–E5 with three changes: E3 gains items 13–15, E4 swaps the plan for item 11, E5 drops the paint bar and adds item 16 — UI-first, two isolated save bumps.
22. Spike before E3: the zoom surface from the v17 fixture at 375 / 1440, plus B's pivot-placement toy — one sitting decides whether B's field layer gets a later go.
23. Park free-radius placement, irregular parcels, the canvas camera, a new valley per prestige, map landmarks and field traits — good levers, separate goes.
