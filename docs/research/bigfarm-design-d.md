TILES — DESIGN D: HANDS AND ENGINES

Design only: nothing edited, created or committed, no git. I read the repo files and docs in the brief, PLAYTEST.md, and designs A and B (to know what to avoid). I did not run the tests, the sim or the live build. Numbers marked (est.) are for the repo sim to pin. New URLs were read from search extracts, not full pages.

CORE IDEA

A changes the unit and B makes space real. D keeps land the honest number it already is, and changes the player's seat and the fuel instead. The home plot stays the place for hands: a sprinkler is installed head by head on individual tiles and never moves. Buying the Tractor puts a second workplace on the main screen, the Cab. It has no tiles and no map. It is an engine room where tractors (a counted machine with drivers) break land, sow and reap, and where three levers from three existing systems set the size of the farm: cash ploughs land, bars lay water on it, coal puts pressure behind the water. Water can never fail: unsprinkled field land grows slowly on rain, sprinkled land grows at normal speed for good, and coal only ever adds speed. The crop mix is left to a rule the game can solve. The player's crop influence moves to the home plot, whose harvests earn each crop renown that deepens its market for the whole farm. Energy runs the home plot; coal runs the fields.

1. DIAGNOSIS — ONLY WHAT IS NEW

I agree with A's points a–g and B's additions. New:

- A and B both read "Fields are an aggregate" as the fault. The code supports another reading: the aggregate was hidden and dishonest, not wrong.
  - Hidden: a closed details element after three other cards (Fields.tsx:41, App.tsx:168).
  - Dishonest: an invisible prefix decides which tiles are dry (fields.ts:117–123); growth runs at twice the stated speed (fields.ts:167 with :278); one pump follows two coal laws (workshop.ts:122, fields.ts:256–265).
  - Egg Inc's hens "are a number from the start" on the main stage (docs/research/fields-market.md:59).
- Coal in watering exists only as a failure state. No coal means stall (fields.ts:260–266), and the smart valve is a purchase that patches the stall (workshop.ts:117–121). A and B delete coal. Neither asked whether its sign was wrong.
- The sprinkler is paid like a place and pays like an agent. It costs bars; its benefit is a worker slot, at −729 💰/h (PLAN.md:2843). Nothing gets better on the tiles under it.
- The tractor has never been an object. 🚜 is a card emoji (Fields.tsx:12) and machines are rates (fields.ts:286–294). One worker does 10 tiles per 5 s = 7,200 tiles/h, equal to Harvester Mk3 (balance.ts:188, :285, :353). That is why "the machine fleet never beats gold-sickle workers" (PLAN.md:3046). The rung between worker and machine is missing.
- The home plot's only tie to Fields is a one-time gate (fields.ts:65–67). After 8 × 50 harvests the hand layer has no job. Playtest round 1's "I feel idle, I need something else to do" returns there.
- "+1 Field" is a click with no object behind it: 448 minutes of it in batch 18's sim (PLAN.md:2972).

2. THE DESIGN

2.1 Rule (keeps DECISIONS 117–119 and 356; A and B overturn them)
Nothing binds by geometry. A home sprinkler binds tile indices; field water binds a count. The grid keeps reflowing and no mechanic can see it.

2.2 Home plot: heads on tiles
- A sprinkler (recipe and max 4 unchanged) arrives as 6 heads. A tap pushes a head into one owned tile, where it stays for the run.
- A tile with a head ("plumbed") is always at full moisture. The code path exists: stepTile already skips the drain for held tiles (step.ts:28–41). Plumbed tiles are held every tick.
- The 5-s action, the target list and the re-pick go (workshop.ts:75–116).
- The 💧 corner badge stays. The badge that used to jump (FarmGrid.tsx:74–78) now marks the fixture and never moves.
- No moisture bar on a plumbed tile (FarmGrid.tsx:82). This is L1 itself, not a borrowed idea.
- 4 × 6 heads = 24 = the tile cap, and tiles are identical, so no placement can be wrong. No confirm is needed. "Place for me" uses the lowest free indices.

2.3 One pump: coal is pressure, never water
- The hoppers merge into one pump tank: 24 coal per sprinkler owned as today, est. +24 per big gun. The fuel loader's second job (workers.ts:59–62) becomes "tank below half".
- While the tank has coal, every bound tile, home and field, grows ×2. Without coal it grows ×1 and is still never dry.
- This gives today's Fields speed an owner. Covered, fuelled field tiles already grow ×2 (fields.ts:278), and no coal means 0 today. In D no coal means ×1, so no save gets slower.
- Draw: est. 0.2 coal per bound tile per hour, one law.
  - Home, 24 tiles: about 5/h (today 48).
  - 1,000 field tiles: about 200/h (today 50), a bit over half of one vein-Lv4 miner (345–372/h, PLAN.md:2840).
  - Pressure at scale is what keeps the mine staffed.
- The smart valve keeps its name and gets a new job: the pump burns only for bound tiles that are planted. That is the smart-furnace pattern (DECISIONS 235). It removes "burns with nothing to water" (workshop.ts:122).
- Precedents: Farm Together's sprinkler keeps tiles watered and halves growth time (https://farmtogether.fandom.com/wiki/Sprinkler). Pure Farming 2018 treats irrigation as a bonus, not a gate (field-watering.md [12]).

2.4 The Tractor, land and big guns
- 🚜 Tractor = today's Fields unlock: same price, same gate (fields.ts:49–56; "≥ 1 sprinkler owned").
- A tractor is a counted machine. Each worker round, each tractor gives one field action to a driver:
  - Reap 10 or Sow 10 (today's batches), or Plough 1 (est.).
  - Harvester workers drive reaping. Planters drive sowing and ploughing; they already till (workers.ts:31).
  - The order is fixed: Reap › Sow › Plough.
- Extra tractors are Workshop recipes (est. 12 Fe + 💰50k, then 24 Fe + 4 Au + 💰150k; cap 4).
- Harvester and Seeder Mk1–3 stay as they are: self-driving, no driver, no tractor. The ladder reads worker → worker + tractor → machine. Machines get a reason: each returns a pool slot, and D needs slots for miners.
- Land is ploughed, not clicked.
  - A plough switch (Off / When idle / First) lets a tractor break one tile per action.
  - Each tile is paid as it is broken, at today's price 💰100 × (count + 1). With no cash the plough waits.
  - Farming Simulator's plough has a "create fields" function (https://www.farming-simulator.com/newsArticle.php?news_id=290).
- Land has three speeds: rain-fed ×½ (est.), sprinkled ×1, sprinkled under pressure ×2. Rain-fed is new; today unwatered land stalls forever.
- 💦 Big gun = the field sprinkler.
  - Workshop recipe, est. 3 Au + 6 Fe + 6 Cu + 💰25k.
  - It binds 50 tiles (est.), oldest unbound land first, for the run.
  - Reach beyond current land waits and binds new land as it is ploughed.
  - No tiers and no cap object. Bars are the limit and the market is the plateau (DECISIONS 375: "the real throttle").
- Toon's sentence holds: sprinklers, a tractor, a big farm, then sprinklers to match the land you opened.

2.5 Simulation: two clocks instead of a cohort walk
- Cohorts stay {crop, count} and gain `wet` and `ripeAt`.
- Fields state holds two clocks. Wet advances 2 per tick with pressure, else 1. Dry advances 0.5.
- A cohort is ripe when its clock passes ripeAt. Sowing sets ripeAt = clock + cropGrowTicks.
- Sowing fills free bound land first; a batch may split into a wet and a dry cohort. A new gun re-tags the oldest dry cohorts once, on purchase.
- The per-tick cohort map (fields.ts:269–279) and the prefix rule go. Growth is O(1) per tick; other work is per action, as today. I expect less than today's 340 ms for 8 h at 3,000 tiles (PLAN.md:3057) (est.).
- One seed rule for planters and Seeder:
  - accepted orders' shortfall first (shipped, fields.ts:310–314);
  - else the crop with the best marginal net 💰 per tile-hour at the glut after sowing. That is today's fieldsMarginalIncomePerHour (fields.ts:416–427), taken per crop.
  - The player may lock one crop (shipped plantCrop) or stop.
- Off-limits note: the mix must be either exposed (A's plan, B's targets) or solved. The research already found greedy-by-marginal to be the optimum (fields-market.md:33). D solves it.

2.6 The Cab (the main UI)
- Desktop: the centre is the Cab above and the home grid below (FarmGrid untouched).
- Phone: the Farm tab gets a two-seat switch 🚜 | 🏡 in its header; the last seat is kept in tiles.ui.
- Four fixed blocks; nothing in them changes position:
  - Land.
    - One append-only bar: blue = bound, tan = rain-fed, dashed = spare gun reach. Text: "1,240 tiles · next 💰124,100".
    - Under it, one ground bar (fallow / growing / ripe: today's three bars merged) and eight crop read-outs (emoji + standing count).
    - A tap on a read-out opens the crop sheet: Sow now, lock, renown.
  - Three levers, one unit on each.
    - 💰 Land: "+1 tile ≈ +X/h".
    - 🥇 Water: "+1 gun ≈ +Y/h".
    - ⚫ Pressure: "on · 38/96 · burns 60/h, mined 345/h ≈ +Z/h".
    - The pattern is Cookie Monster's payback (placement-scaleview.md [31]).
  - Engines.
    - A chip per tractor ("🚜1 👷 reaping 🍓", "🚜3 no driver") and per machine.
    - The chips sit between two piles: "ripe waiting 140" and "fallow waiting 30". A growing pile shows the slow side, as in Idle Miner Tycoon's chain (https://gamingroute.com/idle-miner-tycoon-tips/).
  - Gate. Last 5 minutes sold: to orders, to market, at what average factor.
- The shift on purchase is not staged. The Cab drops in and the first tractor ploughs ten free tiles (est.), one every 5 s.

2.7 The brief's options
- (a) A fixed map would remove the rows constraint. D does not need it removed.
- (b) Zoom: none. Both are off-limits this round; D shows they are not forced.
- (c) D's answer is the seat, not the scale.
- Per-tile at 1,000+: rejected again, for a new reason. Rain, sprinklers and pressure are global, so a field tile would hold no state a cohort lacks.
- Phone 375 px: the Cab is about 430 px tall in the 359 px column (est.), all native flow. The home grid is as today.

3. ALWAYS SOMETHING TO DO

Decisions (nothing dies if skipped):
- Which lever next (when cash or bars land). Three numbers in one unit, fed by three systems: farm cash, furnace bars, mine coal.
- Plough switch (minutes). "First" during a push, "When idle" otherwise. If "ripe waiting" grows, land is not what is missing.
- The pool of six (tens of minutes). Drivers vs miners vs loaders vs clerk. Pressure on 1,000+ tiles needs about a miner and a half (est.); each machine returns a driver.
- Orders (minutes). Rules unchanged; an accepted crop order pulls the seed rule.
- Furnace. Iron for tractors and guns, gold for guns, one ore kind at a time.
- Home plot (any time, energy). Which crop it grows — see renown.

Renown (new; the hand layer's lasting job):
- Each home harvest adds 1 renown to its crop; hand-picked adds 2 (est.).
- At 50 the crop may be sown in the fields (today's gate).
- At 250 / 1,000 / 4,000 its market depth is ×1.25 / ×1.5 / ×2 (est.; today 240 tiles, balance.ts:413).
- Depth is the big farm's ceiling: 8 × 240 tiles before every crop sits on its floor. So 24 tiles decide how far 1,000 can go.
- It is the "milestone row" that DECISIONS 417–419 reserved for a glut lever.
- Precedent: Rune Factory 4 raises a crop's level through sickle harvests of your own field (https://therunefactory.fandom.com/wiki/Crops_(RF4)). Batch 25's sickle seed drop points the same way.

Where boredom would set in:
- The Cab has fewer dials than A or B, on purpose. Once tractors and machines are bought and the three levers show similar payback, it is a screen to watch. This is D's weak point.
- The gold wait before the Tractor is shortened (pressure doubles home income, est.), not removed.
- All crops at top renown and floors everywhere: the prestige moment.

4. THE DOOR PROBLEM
(https://lizengland.com/blog/the-door-problem/; [T] = only the designer can answer)

HEADS (home sprinkler)
- D1 Bought but not placed: yes, this state exists. Spare heads sit on a chip "💧 6 to place" (tool bar and Workshop card). They draw no coal, and offline they wait.
- Placement cancelled: leaving the mode keeps the heads.
- Where may a head go? Any owned tile without one, in any state.
- D2 Two on one tile: refused, with a shake and "already plumbed".
- D5 Phone: a fixed bar replaces the tool bar: "💧 4 left · Place for me · Done". Each tap commits, so there is no Cancel.
- Move, remove, sell? No. "Sell the farm" resets it and lists it.
- Tiles bought later? Unplumbed until a head goes in.
- D3 Water worker: no new rule. It only takes tiles about to run dry (workers.ts:78–79), and a plumbed tile never is. When all are plumbed its row says "nothing to water — reassign".
- D3 Manual can: a tap on a plumbed growing tile does nothing, costs no energy and counts no water. No watering mastery exists (DECISIONS 152).
- How do I know it works? A fixed 💧, no moisture bar, and ≫ on the badge under pressure.

PUMP AND PRESSURE
- D4 Out of coal: nothing shows ⏳, because no stall exists. The ≫ goes off and the Cab says "pressure off: ×1". The valve no longer holds moisture; it stops idle burn.
- Who fills the tank? The fuel loader, furnace first as today; or the player, one press per coal.
- Offline bound: growth is never below ×1. The worst case is the bonus not earned.
- [T] Keep coal at all? D says yes, as pressure. Your first idea had none.
- [T] Pressure ×2 on the home plot too, or fields only? It roughly doubles home income from the first sprinkler.

LAND
- How do I get it? The plough switch. The next tile's price is always shown.
- Can it spend while I am away? Yes, if the switch is on. A "keep 💰N" reserve bounds it.
- [T] Or should the plough work only while the game is open?
- D7 No unit exists, so there is no remainder. Any count is valid.
- Rain-fed land: sowable, slow, labelled 🌦 ×½, never ⏳.
- [T] Rain-fed at ½, or keep today's stall? Half makes sprinklers a multiplier; a stall keeps them a gate.

BIG GUN
- D6 No capacity object exists. A gun bought with no unbound land is allowed; the button says "50 reach spare — plough to use it". Nothing stalls.
- Which land does it bind? The oldest unbound. It cannot be chosen, so it cannot be wrong.
- On the home plot? No; heads there.
- Cannot afford? Greyed, with the missing materials (the existing shortOf line).

TRACTOR
- What does it visibly do? One chip each: driver and job this round.
- No driver? The chip says so and nothing happens. Machines need none.
- By hand? "Sow now" on a crop sheet is one Sow action on a free tractor this round. No hand reaping, as today (fields.ts:187).
- [T] Rate-limit Sow now this way, or keep today's unlimited "Plant 10"?
- D8 On the home plot: nothing. Home is hands and energy, and the Lv3 tools own tiles-per-press. [T]
- More tractors than drivers? Allowed; they idle, and the chips say so.

THE CAB
- When does it exist? From the Tractor on.
- Where did the Fields card go? Its rows are in the Cab. Workshop and Workers cards are unchanged.
- After offline? The banner as today; the Gate block shows the offline sales.
- Reduced motion? Bars jump.
- [T] Is a land number a big farm for you, or must field tiles be visible? D stands or falls here.

MACHINES
- Rates, upkeep and sickle inheritance are unchanged. They act before workers and follow the seed rule.
- Cannot pay? As today: pause, never debt.

WORKERS
- Planters and harvesters: home plot first, then the fields if a tractor is free.
- Water worker: unplumbed home tiles only.
- Miner, loaders, clerk: unchanged.

RENOWN
- Where is it shown? Crop sheet and Shop row: "🍓 412/1,000 → depth ×1.5".
- [T] Does it reset on "Sell the farm"? I say yes.
- [T] Does per-crop renown clash with "no farm-job mastery" (DECISIONS 152)?

5. MIGRATION (nothing lost)

- hoppers[n] → n sprinklers with 6n heads placed on the lowest tile indices. They are placed, not handed over, because offline catch-up runs before the player can tap.
- Hopper coal → the tank.
- Valve → smart valve: same owner, new effect, no refund needed.
- Pipes tier N → 2 / 3 / 6 big guns (est.). They bind 100 / 150 / 300 tiles, never less than today's 60 / 150 / 300.
- fields.count is unchanged.
- Cohorts convert 1:1.
  - ripeAt = clock + (readyTick − tick), one formula for covered and stalled alike. The shipped gap is already in grow-ticks.
  - Covered → wet. Stalled → wet if the granted guns reach them, else dry. Either way they start growing.
- coalCarry is dropped (it was a debt). Machines and carries are unchanged.
- Tractors = max(1, planters + harvesters assigned), so no round loses an action.
- plantCrop stays as the lock. A save with a Seeder gets the auto rule its Seeder already used.
- Renown starts at lifetime.harvests per crop.
- Tests are invariants per fixture, not an income run:
  - every cohort ripens no later than before;
  - bound tiles ≥ old coverage;
  - field actions per round ≥ before.

6. BATCH SPLIT
(after the planned batches 25–26; each save bump is +1 on whatever is current)

D1 The Cab on today's state (UI only, no save)
1. Centre split, seat switch, tiles.ui; Cab blocks read shipped state (count, pipeCover, fieldsStats, workers, machines).
2. Fields card rows move into the Cab; unlock copy becomes 🚜 Tractor.
3. Gate read-out (a UI ring buffer, not saved); live measurement at 375 / 1024 / 1440 / 3440.

D2 Heads and pressure at home (core, save +1)
1. Fixture first. Workshop = {built, sprinklers, heads, spare, tank, valve}. The renown field is added inert. Migration.
2. Core:
   - place head; plumbed via held;
   - delete sprinklerTargets and the 5-s action;
   - tank, pressure ×2, valve rule;
   - water() guard; gate.
3. UI: placing bar, fixed badge, tank gauge.
4. Sim re-pin: ladder gaps ≤ 60 min, coal budget, step identity.

D3 Clocks, rain, big guns (core, save +1)
1. Fixture. Fields gains clocks, guns, tractors, plough. Tractors default to the pool cap and plough to off, so behaviour is unchanged. Migration and invariants.
2. Core: the two clocks; delete the prefix rule and the per-tick map; guns; one coal law; the seed rule.
3. Sim: perf at 1,000 / 3,000 tiles; greedy vs best-factor vs a fixed mix (report the gap); income curve.
4. Cab: wire the three levers.

D4 Tractors and plough (core, no bump: D3's fields switch on)
1. Tractor tokens per round; the round runs home actions first, then field actions in hitch order; tractor recipes.
2. Plough switch with pay-per-tile; remove "+1 Field"; Sow now through a tractor.
3. Sim: no step over 60 min from Tractor to 1,000 tiles. Action order changes, so Fields pins re-pin.

D5 Renown (small core + UI, no bump: field from D2)
1. Counter, thresholds, per-crop depth in marketDepthGlut.
2. Crop sheet, Shop row, milestone rows.
3. Sim: time to each tier by hand and by worker; income with deeper markets.

7. RISKS AND THE SPIKE

Risks:
- The Cab reads as a dashboard, not a farm. This is the largest risk and it is not a code risk.
- Fewer field decisions than A or B. If the levers and renown do not carry it, D bores sooner.
- Pressure ×2 at home moves all mid-game pacing.
- Rain-fed land weakens the bar gate: cash alone buys slow growth.
- Valve owners keep the item but its effect changes.
- D4 reorders actions; every Fields pin re-pins.

Spike: D1 itself, behind a dev flag (the batch-11 pattern, DECISIONS 266–271).
- It is not a throwaway page. It reads real saves, so Toon plays his own late save with the Cab for an evening.
- It answers one question: is this a big farm?
- If no, D costs one UI batch and its rules can still be grafted (see the verdict).
- The same day: a calculator on balance.ts for greedy vs best-factor, and for the three levers' marginal values at 300 and 1,000 tiles.

8. BEYOND THE BRIEF (labelled alternatives)

ALT-1, softens L1's "placed": no placing at all. Heads go to the lowest indices on purchase, which keeps DECISIONS 357 "No placement UI". Tiles are identical, so placing is a gesture, not a decision. Take this if 24 taps feel like a chore.

ALT-2, your first idea: no coal anywhere. Then today's ×2 can only stay as a stated constant, which is A's and B's answer, or be fixed with a full re-pin. I see no third way.

ALT-3: a throttle. 10 coal for 60 s of double tractor rate. It is a button on a cooldown; I left it out as a chore.

ALT-4: rain spells. Rain-fed land varies with seeded weather and sprinkled land never does, which would make "stops caring" felt. It is a new system; parked.

ALT-5, against all three designs: give the player no mix control at all. If the sim shows greedy within a few percent of any hand-set mix, painting and steppers are work the computer can do.

9. HEAD-TO-HEAD

- L1 fit — A. Bound tiles are visible at both scales and nothing can be regretted. D is closest to Toon's words at home (heads on tiles), but in the fields "bound" is a count, and coal still matters for speed.
- L2 paradigm-shift feel — B. One world and a camera. D changes the main screen and the player's role, but shows no land. A's two scales sit between.
- L3 drift — D. Cohorts, the land count, per-tile prices, the valve, the fuel loader's job and "never by rows" all stay. The new parts are the tractor count and the meaning of coal.
- Always something to do — B. Survey and placement are decisions D does not have. D's renown gives the hand layer a job A and B lack, but the Cab is quieter minute to minute.
- Phone 375 px — D. No map, no gesture, one stacked column. A is close.
- Perf / offline 8 h — D, narrowly. Growth is O(1) per tick. All three clear the 2,000 ms pin.
- Save migration risk — D. Cohorts convert 1:1 with one formula: no packing, no rounding, no map data. A is second.
- Implementation cost — D. No new grid, no canvas, and fields.ts shrinks. Two of five batches need no bump.
- Door-Problem questions left open — A. Five [T] against B's seven and D's ten, and one of D's decides the whole design.

D wins five rows, A two, B two.

10. VERDICT

D should not beat them as the answer to L2. It wins the engineering rows and loses the two rows Toon's trigger message was about: the feel of a big farm, and things to do in it. A screen of gauges over a number is an honest idle game, but it is not "possibly still tiles". If Toon needs to see his land, D fails at [T] and no tuning saves it.

D is the right whole design in one case: Toon plays the D1 spike on his own save and says the Cab is a farm. Then it is the cheapest, safest and most phone-proof of the three.

Otherwise keep the hybrid's frame and graft these six D rules onto it. Each replaces a weaker part and none needs the Cab:
1. Coal as pressure. It gives the ×2 an owner, keeps the valve and the loader's job, and removes every water failure state.
2. Rain-fed land instead of "dry land cannot be sown".
3. The two clocks, tagged per plot instead of per cohort.
4. The tractor as a counted rung between worker and machine, with the plough as how land is opened.
5. Renown: home harvests deepen a crop's market.
6. The greedy seed rule as the default, with any plan as an override.

11. DECISIONS FOR D (reply with the numbers you reject)

1. Nothing binds by geometry; FarmGrid untouched — keeps a shipped decision, zero layout work.
2. A sprinkler = 6 heads tapped into tiles, permanent — L1 in Toon's words: locked to tiles.
3. Spare heads may wait unplaced; no confirm; "Place for me" — D1 and D5; no placement can be wrong.
4. One head per tile — D2.
5. Plumbed tiles show a fixed 💧 and no moisture bar; can and water worker skip them — D3.
6. One pump tank replaces the hoppers; the fuel loader feeds it — one coal law instead of two.
7. Coal is pressure: bound tiles ×2 with coal, ×1 without, never dry — D4; explains today's hidden ×2.
8. Pressure applies on the home plot too — one rule, and the sprinkler finally pays. [T]
9. The valve becomes "no idle burn"; no refund — the purchase keeps a job.
10. 🚜 Tractor is the unlock and a counted machine: one field action per tractor per round, driven by workers — the missing rung.
11. Fixed order Reap › Sow › Plough, and one plough switch — a visible rule and one real decision.
12. Land is ploughed tile by tile at today's price, paid as broken; "+1 Field" is removed — D7; ends the click loop.
13. Rain-fed land grows ×½ — no stall state anywhere. [T]
14. 💦 Big gun binds 50 tiles, oldest first; spare reach waits; no tiers, no cap — D6.
15. Pipes become 2 / 3 / 6 guns on migration — coverage never drops.
16. Two clocks; cohorts stay; the prefix rule and the per-tick walk are deleted — O(1) growth.
17. One seed rule (orders, then best marginal), with an optional lock; no mix dial — the game can solve the mix.
18. The Cab is the main view after the Tractor: above the home grid on desktop, a second seat on phones — L2 without a map.
19. The Cab is four fixed blocks: Land, three levers in one unit, Engines between two piles, Gate — what, how, how many.
20. Sow now goes through a tractor; no hand reaping — fields are engine work. [T]
21. The tractor does nothing on the home plot — D8; energy for home, coal for fields. [T]
22. Renown: home harvests deepen a crop's market, hand-picked counts double — the hand layer's lasting job. [T]
23. Batch order: D1 UI → D2 save → D3 save → D4 → D5 — UI first, two bumps.
24. The spike is D1 behind a dev flag on real saves — the only risk that matters is feel.
25. Park the throttle, rain spells and auto-placed heads — separate goes.
