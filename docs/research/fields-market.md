REPORT: Fields (unbounded aggregate farm) + dynamic market — research only, nothing edited

Method: read DECISIONS/PRD §4.2/PLAN/balance.ts/workers.ts and both previous reports; pulled ~35 wiki/forum/dev pages (URLs §4); built a Python model on balance.ts numbers (lemon net 90 per 360 s per tile = 💰900 per tile-hour; worker 720 actions/h) for the market, cost curves and throughput. Reddit refused scraping; Reddit quotes below are from search-result snippets of the linked threads.

======================================================================
1. SUMMARY — verdict, then recommendations (reject by number)
======================================================================

Verdict: Hermes' counter-proposal, with two amendments. Toon's "the grid stops existing" has exactly one successful precedent (Universal Paperclips), and it works there because the removed layer had nothing invested in it: no mastery, no tool tiers, no counters the player grew, and the change is a one-way story beat. tiles has spent six batches making tiles, tools, tiers and workers meaningful; replacing the grid turns that into sunk cost. Every other game that added an aggregate layer kept the hands-on layer and made the aggregate depend on it (A Dark Room, Egg Inc, Stardew's Junimo huts, Forager drones); the one that bolted on an aggregate layer that did not feed back (Melvor's Township) got "could have been an entirely different game" [10][11]. The two amendments: (a) the home plot needs a standing job after Fields exist, not just nostalgia; (b) "unbounded" is nominal — once the market exists, the market, not the price curve, sets the practical cap (~2–3× market depth across 4 crops). Decide the cap by choosing the depth, and say so in the UI.

1. Build the market first (batch M, before Fields). It is in the PRD, it makes multi-crop planting matter on the home plot today, and Fields are unbalanceable without it. Model: per crop a "glut" G (units on the market). Each unit sold adds 1; every tick G ×= (1 − k), k = 1 − 0.5^(1/1800) ≈ 0.000385 (half-life 30 min). Price multiplier m = max(0.5, 1 − 0.5 × G / Gmax), Gmax = DEPTH_TILES × cycles-per-hour × 0.722 (lemon 866, pumpkin 1,299, chilli 1,948, carrot 3,117 units at depth 120). Floor 50 % (PRD). Slime Rancher's exact shape: sold units accumulate, −25 %/day decay, halved at max volume [14]; Graveyard Keeper 2: base × √(usual/current stock), restock 1/5 per day [16].
2. Depth is Toon's knob; two candidates. DEPTH 120 tiles: the 24-lemon home plot sits at m = 0.90 (−10 %), lemon floors at 120 dedicated tiles, income caps around 💰120k/h at ~400 Fields. DEPTH 240: home plot m = 0.95 (barely visible), caps ~💰215k/h at ~500 Fields. Recommend 120 if the lemon dip is acceptable as "the market was always meant to be there"; 240 if Toon wants the patch to take nothing visible from current players (hard rule 2 spirit; balance numbers need no migration either way).
3. Show the market as a puzzle, not a tax: on each crop card "🍋 💰99 (90 %) ▼ · recovers in ~25 min" plus a 3-colour depth bar (green/yellow/red = Egg Inc's shipping bar [19]). Slime Rancher players learnt "diversify… the price only recovers when you stop selling that plort" from the bar and the daily change [15]; Graveyard Keeper players who found the curve undocumented called it a trap ("why do traders pay less every time I sell the same item") [16]. The number must be visible before the sale.
4. Fields = an earned, separate panel next to the grid (A Dark Room adds a tab per phase and the old tabs stay in use [7]). Unlock = plant + water + harvest certificates owned + Workshop built + a Land Deed (💰20,000 + ⛓8 + 🥇4, ≈ 1 h of 24-tile income per the previous report's price rule). No tile is removed; the grid stays the home plot.
5. Home plot keeps a job: a crop can be planted in Fields only after 50 home-plot harvests of it (per-crop lifetime harvests already exist), and copper/iron tool tiers apply to Fields actions done by workers (already true for workers), not to machines. Stardew players keep hand-harvesting next to Junimo huts and treat the huts as an addition ("I truly enjoy the experience of hand harvesting") [12]; Forager lets drones take over while islands stay hands-on [13].
6. Fields price linear: cost(n) = 💰100 × n for field n (Fields are cheap land; machines are the sink). Time-to-afford stays an idle stream (2 min at n = 10, 8 min at 100, 16 min at 300, 34 min at 1000) while the market makes payback explode (§2) — that is the soft cap, shown in the UI as "payback ~X h" from the current marginal price. Bulk buy ×1/×10/max with the arithmetic-series sum (Cookie Clicker/AdCap convention, closed form for geometric costs in [22]).
7. Simulation = cohorts, per tick, integer counts. Per crop: empty count, growing cohorts {count, progressTicks}, ready cohorts {count, ripeTicks}. Machines and workers act every 5 ticks (the existing worker clock), k tiles per action, so there are no fractional rates and no float drift. Cohorts per crop ≤ (grow + grace)/5 = 216 for lemon; 8 h catch-up ≤ 28,800 × 4 × 216 ≈ 25 M cohort updates, well under 1 s in JS. Keep the per-tick loop (batch 9 precedent: 28,800 cheap calls) — see §3 Q6 for why closed forms break here.
8. Throughput ladder for Fields (manual → worker → machine holds because the manual stage was the home plot): workers first — assign pool workers to Fields jobs by count; one planter+harvester pair carries 36 lemon / 24 pumpkin / 16 chilli / 10 carrot tiles, so the pool of 6 carries ~70–100 lemon Fields and then stalls. Then Workshop recipes: Harvester Mk1 (1 tile/2 s = 1,800/h: 180 lemon or 50 carrot tiles; 💰15,000 + ⛓8 + 🥇4, maintenance 💰60/h while it has work), Seeder Mk1 (same capacity; 💰10,000 + ⛓6 + 🥉8, 💰40/h), Irrigation Line Lv1/2/3 covering 60/120/240 Field tiles (💰8,000/16,000/32,000 + bars), drawing 💧900/1,800/3,600 per hour from the sprinkler tank (tank upgrades keep 8 h). Mk2 (1 tile/s) and Mk3 (2 tile/s) later. Idle Miner Tycoon's shaft/elevator/warehouse triad is the pattern: produce, move, sell, keep the three balanced [20][21].
9. Neglect bound (hard rule 4): the Seeder never plants more than the Harvester can clear inside the grace window (ready + growing ≤ harvest capacity × 2 × grow). So the worst 8 h offline case is: Fields beyond capacity simply sit empty (no income, no loss); standing ripe crops past grace rot once (≤ 1 seed per planted tile: 200 lemon Fields = 💰4,000, 2–3 min of Fields income); machine maintenance is prepaid-style (stops when cash < cost, never debt); irrigation is bounded by the tank as in the sprinkler report. No debt, nothing destroyed.
10. Numbers to keep in normal range: income 💰19k/h (24 tiles) → ~120k/h (400 Fields, depth 120) → ~175k/h at 1,000. Never above 💰250k/h. Fits "no big-number engine".
11. Do not: replace the grid; show Fields as a 24-tile-style grid of 1,000 tiles; price Fields geometrically (1.07 → field 100 costs 💰1.7 M and the curve, not the game, ends it); let workers water Fields (wages at 💰60–80 per tile-hour kill carrot Fields; irrigation is count-based like the sprinkler); add a per-tile land tax.

Build order: M (market: glut per crop in run, v+1 migration defaults 0, card UI, sim asserts the 24-tile dip ≤ 10 % and that a 4-crop split beats mono-crop above ~60 tiles) → F1 (Fields core: deed, cohorts, linear price, worker assignment, 3 bars + capacity bar) → F2 (Harvester/Seeder/Irrigation Line recipes, Mk2/3, "payback ~X h" label).

======================================================================
2. ARITHMETIC (Python on balance.ts values; 100 % uptime; rerun in tests/sim before pinning)
======================================================================

Market (depth 120, half-life 30 min):
- Steady-state glut for t tiles of a crop = t × cycles/h × 0.722 units → m = max(0.5, 1 − 0.5 × t/120). The shape is identical for every crop: 24 tiles 0.90, 48 0.80, 60 0.75, 100 0.58, ≥ 120 0.50.
- Net per tile-hour at m = 1 / m = 0.5: carrot 288 / 108, chilli 450 / 169, pumpkin 750 / 300, lemon 900 / 350 (seed cost does not shrink, so the floor cuts net by 61 %, not 50 %).
- Lemon only: 24 tiles 💰18,960/h (was 21,600), 100 tiles 44,167/h, 120 tiles 42,000/h (worse than 100!), 200 tiles 70,000/h.
- Optimal 4-crop split (greedy by marginal): N = 24 → 19,107/h (20 lemon + 4 pumpkin, −12 % vs today); 50 → 36,392 (32 lemon/18 pumpkin); 100 → 61,914; 200 → 94,186 (72/68/44/16); 300 → 111,951; 400 → 117,043 (~100 of each); 500 → 120,963; 1,000 → 174,963 (everything past ~110 of each crop goes to carrot at its floor, 108/tile-h). So yes, multiple crops stay worth planting from ~30 tiles on, and all four from ~150.
- Depth 240 instead: N = 24 → 20,280 (−6 %); 100 → 86,300; 200 → 133,339; 300 → 167,936; 500 → 213,226; 1,000 → 244,232.
- Marginal income of one more tile (depth 120 / 240): N = 24: 716 / 788 per h; 74: 510 / 664; 124: 373 / 561; 224: 209 / 399; 324: 82 / 289; ≥ 524: 108 / 163→108.

Fields price 💰100 × n (field n = tile 24 + n):
- Payback = cost ÷ marginal income (depth 120 / 240): n = 10: 1.5 h / 1.3 h; 50: 9.7 / 7.5; 100: 26.8 / 17.8; 200: 95 / 50; 300: 351 / 103; 1,000: 926 / 926.
- Payback crosses 8 h (one offline window) at field 44 (depth 120) or 53 (depth 240) with 100n; at 32 / 37 with 150n. That crossing is the natural "stop here" and should be the label.
- Time to afford = cost ÷ total income: n = 10: 2.4 min; 100: 8.4; 300: 15.8; 1,000: 33.8 min (depth 120).
- Cumulative: first 100 fields 💰505,000 ≈ 9.4 h of play; 300 fields 4.5 M ≈ 50 h; 1,000 fields 50 M ≈ 365 h. Alternatives rejected by the numbers: 2,000 × 1.07^n (field 100 = 1.7 M, field 200 = 1.5 B), 300 × n^1.5 (field 100 = 300k, cum 100 = 12 M = 50+ h for the first hundred), 400 × n × 1.003^n (cum 100 = 2.5 M).

Throughput (worker 720 actions/h, 💰1 each):
- Plant + harvest per tile-hour: lemon 20, pumpkin 30, chilli 45, carrot 72 → tiles per planter+harvester pair-worker 36 / 24 / 16 / 10. Pool of 6 (3 + 3) ≈ 108 lemon Fields, 30 carrot Fields.
- Watering per tile-hour (basic/copper/iron can): 60 / 30 / 15 for every crop → 12 / 24 / 48 tiles per waterer. Wages incl. water at iron: lemon 💰35 per tile-hour (4 % of net), carrot 87 (30 % of net) — workers cannot carry carrot Fields; machines with flat maintenance can.
- Harvester Mk1 1,800/h = 180 lemon / 120 pumpkin / 80 chilli / 50 carrot tiles; Mk2 3,600/h = 360/240/160/100; Mk3 7,200/h = 720/480/320/200. Maintenance 💰60/h Mk1 = 0.3 % of income at 100 Fields.
- Cohorts: lemon ≤ 216 per crop; 25 M cohort-updates per 8 h catch-up worst case.

Hard-rule checks: (1) ladder: certificates + Workshop gate the deed, workers before machines ✔; (2) v+1 adds run.market (0) and run.fields (null); nothing removed; the only visible change is the −6…−12 % lemon dip, which is a balance number, not a migration ✔; (3) mining cash/energy untouched; Fields need no energy ✔ (Fields income is cash per hour, not per energy — the sim's farming cash/energy stays the home-plot figure); (4) bound stated in rec. 9 ✔; (5) per-tick cohorts, integer counts, worker clock = run.tick, market decay applied per tick ✔.

======================================================================
3. FINDINGS PER QUESTION
======================================================================

Q1 — Phase transitions
- Universal Paperclips: Stage 1 → 2 is "Release the HypnoDrones" (70,000 ops project) [1]. In the source it is one flag: while humanFlag = 1 the demand curve, sales roll and investment engine run; flipping it stops them and starts power/swarm/matter processing; Space Exploration later switches Stage 2 off the same way and refunds every structure into clips [2]. Kept visible: clips, wire, ops/creativity, trust/processors; gone: price, marketing, stocks. Irreversible, framed as story. Demand there is a pure function of price and marketing with no memory ("nothing depends on how many clips you have already sold") [2] — the opposite of tiles' PRD market.
- A Dark Room: room → village (huts and traps "priced linearly") → dusty path → ship; each phase adds a tab, the earlier ones stay and feed the later ones (the village supplies expeditions) [7][8].
- Kittens Game and Cookie Clicker never have a hands-on grid: buildings are counts from the first purchase (Catnip Field 10 catnip, ratio 1.12; Cookie Clicker one constant 1.15 per building owned) [5][6][23].
- Egg Inc: hens are a number from the start; habitats and the shipping depot are the visuals; the depot's eggs/min vs capacity bar turns green → yellow → red and warns "Your farm is making more eggs than the shipping depot can handle!" [19]. This is the "3 bars" design Toon wants, already proven on mobile.
- Trimps: the portal resets the run but Helium perks carry over (first portal gives 45 Helium) [9]; A Dark Room and Paperclips are irreversible; Egg Inc prestige is player-chosen.
- Melvor Idle Farming: one allotment plot at start, more plots per level bought with GP; never aggregates [24]. Farmer Against Potatoes Idle's "Farming" is a late sub-system unlocked at a map area, separate from the main loop [25]. Rusty's Retirement is an always-hands-on strip farm with bots [26].
- Lesson: nobody removes a layer the player has levelled. Aggregate layers are added as tabs with their own bottleneck display.

Q2 — Grid + aggregate side by side
- Melvor Township (aggregate town over the skill grid): "very short honeymoon… one of the most sloppy/pointless additions" and "it could have been an entirely different game… requires hours upon hours to go through all your ticks" at launch [10][11]; a later counter-thread calls it "fantastic" once it fed GP back into the early grind [27]. The lesson is coupling: the aggregate must consume or reward the hands-on layer.
- Stardew Junimo huts: "I mainly consider them as decoration now… I truly enjoy the experience of hand harvesting" and complaints about "limited harvesting range" [12]; automation is an opt-in addition and the farm stays.
- Forager: players run 79+ drones while still hand-building islands and ask for "more options for the droids, like assigning them to a land" [13].
- Cookie Clicker's Garden is a hands-on grid inside an aggregate game; polled as the minigame that "consumes the majority of your hours" [28].
- Rusty's Retirement: hands-on plot + bots is the whole pitch (strip at the screen edge) [26].

Q3 — Unbounded land pricing
- Genre norm: cost_next = base × r^owned, production linear in owned; Pecorella's seesaw ("costs grow exponentially while production grows at a linear or polynomial rate"), AdCap Lemonade 1.07, Newspaper 1.15 down to Oil 1.07 [3][4]; Cookie Clicker 1.15 [23]; Kittens per-building ratios 1.12 field / 1.15 mine / 1.75 barn / 2.5 hut [5][6]; Egg Inc vehicle price depends on how many of that tier you own [19]. Bulk buy: geometric-series sum b·r^a·(r^k − 1)/(r − 1), Cookie Clicker shows the sum but charges each rounded price, Antimatter Dimensions' max-buy charges only the last set [22]. Max affordable k = ⌊log_r(c(r − 1)/(b r^k) + 1)⌋ [3].
- Payback targets: Pecorella states the shape (wait grows until "prohibitively long" → prestige) but no minute figure; I found no source stating "N minutes payback". Not confirmed.
- Why geometric fails here: in idle games production per unit also climbs (multipliers at 25/50 owned [3]); in tiles production per tile is fixed and the market lowers it, so even 1.07 walls at ~50 fields (§2). The limit that keeps land from exploding should be the market plus throughput, not the price; Kittens uses kitten upkeep (catnip) and RimWorld wealth-based raids the same way (previous report).

Q4 — Throughput as the purchase
- Egg Inc: habs cap hens, vehicles cap eggs/min; the red bar and warning make the cap legible; research raises vehicle capacity [19].
- Idle Miner Tycoon: mineshafts produce, the elevator moves, the warehouse sells; guides: "your elevator cannot haul up any cash that is not in the mine-bins, neither can your warehouse workers haul away any cash that the elevator hasn't brought up first" and "keep the transportation rates of Mineshafts, Elevator and Warehouse as close to equal as possible" [20][21].
- Satisfactory belts: Mk1–5 = 60/120/270/480/780 items/min, each a tier unlock with a dearer part [29].
- For tiles the triad is Seeder (produce) → Harvester (move) → Market (sell); workers are the Mk0 of each. Rec. 8.

Q5 — Dynamic markets
- Slime Rancher: daily ±30 % per plort and ±30 % whole-market noise; every plort sold adds to a volume, price halves at max volume, volume −25 % per day, e.g. 40 pink plorts ≈ halve, 10,000 rock plorts stay halved ~20 days; shown as today's price with up/down arrows [14]. Players: "the price of a plort only recovers when you stop selling that plort for a while… staying at like 40 % of the default" [15].
- Graveyard Keeper 2: unit price = base × √(usual stock ÷ current stock), 75 % of that when selling, restock ≤ 1/5 of usual per day, "a crashed shelf takes about a week"; fixed-price goods exempt [16].
- Offworld Trading Company: buying raises, selling lowers; asymmetric — large buys move price little, large sells move it a lot; HQ inputs are the painful case [17][18].
- Moonlighter: popularity Low sets base value to 75 %, High raises the perfect-sell band by 25 %; customer faces show over/under-pricing [30].
- Farming Simulator 22: "Great Demand" raises a station's price for a window; players report drops after selling large amounts and demand recalculation on reload [31]. Stardew vanilla has no demand; Ferngill Simple Economy adds supply/demand per item with a supply menu and shop indicators ("sell too much of an item and its price may plummet") [32]. Hay Day's roadside shop is player-priced within a min/max, no demand curve [33]. Universal Paperclips: demand ∝ 0.8/price × marketing, no memory [2].
- Pattern: penalty-feel when the curve is hidden and per-unit (Graveyard Keeper), puzzle-feel when a bar/arrow shows the state and recovery is visible (Slime Rancher). Recovery is always toward base, exponential-ish, 1 day to 1 week. Recs 1–3; interaction with Fields in §2.

Q6 — Aggregate simulation
- Antimatter Dimensions: offline is simulated as N ticks of (elapsed/N) each (500–1,000,000, default about 1,000: one hour → 3.6 s ticks); known artefact: autobuyers fire once per fat tick, so results differ from live play [34]. Melvor: no live offline, a replay of the recorded action capped at 24 h; farming does not replant offline [35]. Kittens: "redshift" grants 1 game-day per 2 s of pause, capped (10 → 40 kitten-years ≈ 8.88 h) [36]. Cookie Clicker: % of CpS (previous report).
- Closed form: a producer chain solved as a polynomial, exact only if "every modifier depends on levels and counts, never on live amounts"; an offline ratchet exploit forced a soft cap that made the closed form approximate (5 % error budget vs brute-force stepping) [37]. Fixed timestep as the determinism baseline [38].
- Pitfalls for tiles: fat-tick batching changes results (AD); any rate that depends on live state (coverage/F, market glut) voids closed forms; floats accumulated per tick drift from (1 − k)^n computed once — pick one path and use it live and offline (the repo already loops single ticks). Cohorts keep counts integer and cost O(cohorts) per tick (rec. 7).

======================================================================
4. SOURCES
======================================================================
1 https://universalpaperclips.fandom.com/wiki/Release_the_HypnoDrones
2 https://teemo.dev/game-design/universal-paperclips/systems/phases-and-formulas-reference/
3 https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i
4 https://adventure-capitalist.fandom.com/wiki/Businesses ; https://frameadvance.net/sources/pecorella-2016-math-of-idle-games-1/
5 https://wiki.kittensgame.com/en/game-tabs/bonfire/catnip-field
6 https://wiki.kittensgame.com/en/general-information/game-mechanics/price-ratio
7 https://en.wikipedia.org/wiki/A_Dark_Room
8 https://frameadvance.net/games/a-dark-room/
9 https://trimps.fandom.com/wiki/Portal
10 https://www.reddit.com/r/MelvorIdle/comments/y86ra7/township_has_a_very_short_honeymoon_period_its/
11 https://www.reddit.com/r/MelvorIdle/comments/y8rzha/township_feedback_megathread/
12 https://www.reddit.com/r/StardewValleyMods/comments/1l3nlet/do_you_use_junimo_huts/ ; https://www.reddit.com/r/StardewValley/comments/1unnt86/inefficiency_of_the_junimo_hut/
13 https://www.reddit.com/r/Forager/comments/k4iwcy/79_drones/ ; https://www.reddit.com/r/Forager/comments/bhawn5/ideas_and_suggestions_for_forager/
14 https://slimerancher.fandom.com/wiki/Plort_Market_(Slime_Rancher)
15 https://www.reddit.com/r/slimerancher/comments/1bhnfds/how_do_i_manipulate_the_market/
16 https://keepers-ledger.com/guides/money-making/ ; https://graveyardkeeper2.io/mechanics/traders/
17 https://www.stardock.com/games/article/490528/beginners-guide-to-offworld-trading-company
18 https://steamcommunity.com/app/271240/discussions/0/1621724915774283722/
19 https://egg-inc.fandom.com/wiki/Vehicles
20 https://www.scribd.com/document/410002753/Idle-Miner-Tycoon-Guide-Version-0-1
21 https://www.reddit.com/r/IdleMinerTycoon/comments/109mrw0/ ; https://www.reddit.com/r/IdleMinerTycoon/comments/xbw039/
22 https://frameadvance.net/mechanics/bulk-buying/
23 https://cookieclicker.wiki.gg/wiki/Buildings
24 https://wiki.melvoridle.com/w/Farming
25 https://farmer-against-potatoes-idle.fandom.com/wiki/Farming
26 https://aiptcomics.com/2024/05/13/rustys-retirement-idle-game-review/
27 https://www.reddit.com/r/MelvorIdle/comments/1dpd57q/hot_take_township_is_fantastic_and_makes_the/
28 https://www.reddit.com/r/CookieClicker/comments/1xl82rs/garden/
29 https://satisfactory.wiki.gg/wiki/Conveyor_Belts
30 https://moonlighter.fandom.com/wiki/Selling_and_Reactions
31 https://steamcommunity.com/app/1248130/discussions/0/3937895062993797256/
32 https://www.nexusmods.com/stardewvalley/mods/21414
33 https://hayday.fandom.com/wiki/Roadside_Shop
34 https://antimatter-dimensions.fandom.com/wiki/Offline_Progress
35 https://wiki.melvoridle.com/w/Offline_Progression
36 https://wiki.kittensgame.com/en/game-tabs/time
37 https://uyllii.com/blog/offline-progress-idle-game-closed-form/
38 https://gafferongames.com/post/fix_your_timestep/

Could not confirm: a published payback-minutes target from Pecorella or Alexander King (only the seesaw shape); Spaceplan, Leaf Blower Revolution, Factory Idle and Idle Farming Empire phase/UI details (store pages only, not used in the findings); Offworld's exact elasticity constants (asymmetry only, from a guide and a forum thread); Farming Simulator's per-unit price-drop formula (player reports, not GIANTS documentation); Farm Together and Potion Craft demand mechanics (none found — treated as "no demand system"); Reddit quotes are from search snippets of the linked threads, not full-thread reads. All §2 numbers are my model on balance.ts values (100 % uptime, no energy cap, greedy crop split), not the repo sim — rerun tests/sim before pinning any of them.
