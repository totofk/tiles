Research done (wikis, mods, forum threads) and the worker arithmetic was checked with a small 1-tick simulation of the actual `workerTargets` policy (waters a tile only when it would run dry before the worker's next turn). Report follows.

REPORT: gold tier → crafting → sprinkler (research only, nothing edited)

======================================================================
1. SUMMARY — RECOMMENDATIONS (reject by number)
======================================================================

Sprinkler
1. Unlock = Workshop (crafting station), buildable once vein Lv4 is owned, same pattern as "furnace after vein Lv1". Price 30 stone + ⛓6 iron bars + 💰1,000 (36 items ≤ storage 70 at Lv5). The Workshop shows every recipe greyed with its materials (visible-locked, like the drop table); no discovery RNG.
2. Sprinkler recipe (first headline recipe): 🥇4 gold bars + ⛓8 iron bars + 🥉8 copper bars + 💰2,000. 20 items ≤ storage 70. ≈ 20 min of vein-Lv4 mining + 12–36 min of smelting (batch Lv2 vs Lv0) — a 30–45-minute project after gold. One sprinkler per farm (it is a system, not a placed object).
3. Coverage model = tile COUNT by priority, never geometry: the sprinkler keeps the N growing tiles with the longest remaining grow time at full moisture every tick (same rule family as tools/workers: "picked by priority, never by row"). N = 6 → 12 → 24 as coverage upgrades of the same machine (6/12/24 echoes Stardew's 4/8/24). Lv1 → 12: 🥇4 + ⛓8 + 💰4,000; Lv2 → 24: 🥇8 + ⛓16 + 💰8,000. Covered tiles show a 💧 ring. (Alternative if Toon wants agency: player toggles 💧 on tiles, up to N — costs a tile-mode UI; priority needs none.)
4. Upkeep = water tank, fixed pump cost, no per-tile cost. The pump drinks 💧1 per 2 ticks while switched on and the tank has water (1,800 💧/h). Water is bought like wood: 💰1 per 10 💧 ("Fill tank" button, cost = missing/10 rounded up, no energy). So upkeep = 💰180/h flat regardless of covered tiles. Tank cap Lv0 💧3,600 (2 h), Lv1 💧7,200 (4 h), Lv2 💧14,400 (8 h = exactly one offline window); tank upgrades ⛓4 + 💰500 / ⛓8 + 💰1,500 (the fire-cap pattern). Later "smart valve" (🥇2 + 💰1,000): the pump draws only while a covered tile is growing — the smart-furnace analogue, same ladder Toon already chose for fuel.
5. Worst-case 8 h offline: the tank (prepaid, ≤ 💰360 at Lv0, ≤ 💰1,440 at Lv2) runs dry, then covered tiles drain normally; if a water worker is still assigned it takes over at wage, otherwise growth pauses. Nothing is destroyed, no debt, no new rot path (rot only applies to ripe crops and belongs to harvest). Loss is bounded by one tank, exactly like the furnace fire.
6. Worker not erased: coverage starts at 6 of up to 24 tiles, so the water worker keeps the other 18; at full coverage it becomes the empty-tank fallback or is reassigned. Cash crossover (iron can) is ~12 tiles — see §2.
7. Drop the planned GOLD watering can (moisture ×8). It is the Stardew problem in miniature: a gold-can worker costs 💰175/h at 24 lemons vs the sprinkler pump's 💰180/h, so the can would beat the machine forever and players would skip one of them (Stardew players skip the can because sprinklers own watering [11][14]). Gold farm tools = sickle 30 % and dibber 50 % only; iron can (×4) is the last can. The sprinkler is the gold-tier answer to watering.

Gold tier + crafting unlock
8. Vein Lv4 = 45 stone + ⛓8 iron bars + 💰1,000 (53 items ≤ 70); requires the iron pickaxe. Drops 50 % stone / 20 % coal / 12 % copper / 10 % iron / 8 % gold. Gold rock = 5 hits, needs iron pickaxe or better (otherwise breaks as stone). At ~19 rocks/min the expected first gold is 12.5 rocks ≈ 40 s; P(no gold in 3 min) = 0.92^55 ≈ 1 %. Cash-equivalent per rock 0.5×2 + 0.2×4 + 0.3×1 = 2.1 (ore ≤ 1), under the pumpkin cap (8.3) — mining stays a material loop.
9. Gold bar = 2 gold ore + 6 fire units (3 coal, 180 ticks), continuing copper 2 u / iron 4 u. Bars never sell.
10. Gold pickaxe = 🥇5 + 💰500, durability 6,500, 5 hits/action, repair 🥇2. Rule check (balance.ts: lifetime = durability × (1 + 0.4·L), cap 80 % ⇒ Lv10 ×5): iron Lv10 = 1,200 × 5 = 6,000 < 6,500 ✔. Consequence: gold Lv10 = 32,500 uses ≈ 27 h of mining — effectively the last pickaxe. Fine because Lv4 is the last vein; if a 5th tier ever comes the rule must be restated (furnace.md already flagged this).
11. First Workshop recipes (4 at unlock + sprinkler upgrades): Sprinkler; Charcoal Kiln (10 wood → 1 coal, 20 stone + 🥉2 + 💰300: removes the wood-fallback waste and the coal bottleneck for the fuel loader); Grindstone (auto-repairs the blunt pickaxe from bars in storage, 20 stone + ⛓4 + 💰500: the one manual step the mine worker cannot do); Compost Bin (rotten crops → fertilizer ticks or seed pouch, 10 wood + 20 stone + 🥉4 + 💰300: turns the neglect penalty into a sink). Reserve "Harvester" and "Seeder" machines (🥇 + ⛓, maintenance) as later headline recipes — they need the plant/harvest workers to exist first (ladder).

======================================================================
2. ARITHMETIC FOR HARD RULES 3–5
======================================================================

Basis (balance.ts): lemon 360 ticks, seed 20, sell 110 → net 90/crop; moisture bar 60 ticks; water tier fills 1/2/4/(8); worker 1 action per 5 ticks, 💰1 per action, waters only tiles with moisture ≤ 5/60. Simulated 4 h, harvest + replant instant (isolates watering).

Rule 3 — offline loss bounds (sprinkler): tank Lv0 💧3,600 = 2 h at 1,800 💧/h = 💰360 prepaid. Lv2 💧14,400 = 8 h = the whole offline cap. After the tank is empty: covered tiles drain at 1/60 per tick as today; crops pause, never die. No cash drain (water is prepaid), no debt. Same shape as the furnace fire tank Toon accepted.

Rule 4 — storage fit (max storage = 20 + 5×10 = 70): Workshop 36 items; sprinkler 20; coverage Lv2 24; vein Lv4 53; gold pickaxe 5; tank upgrades 4/8. All ≤ 70; the furnace tray (cap 5) feeds bars into storage so 8–16 bars need storage ≥ Lv0 only. Sim should assert as it does for stone.

Rule 5 — crossover, 24-tile lemon farm, cash per hour (sim, 100 % uptime unless stated):
- Gross net of seeds, perfect watering: 24 × 10 cycles × 90 = 💰21,600/h (9 tiles: 8,100).
- Water worker wages: basic can 💰717/h with ONE worker but uptime 50 % (saturated: 24 tiles × 6 waterings = 1,440 needs/h vs 720 capacity) → net 9,948/h; two basic workers 💰1,426/h, uptime 100 %, net 19,634/h.
- Copper can, 1 worker: 💰705/h (29.4/tile-h), uptime 100 % in the sim but exactly at capacity (24 tiles ÷ 120 ticks = 0.2/tick = capacity) → any plant/harvest jitter → dry pauses; net 20,356/h.
- Iron can, 1 worker: 💰354/h (14.8/tile-h), 67 % utilisation, net 20,706/h.
- Gold can (if it existed), 1 worker: 💰174/h (7.3/tile-h), net 20,886/h.
- Sprinkler (fixed pump): 💰180/h at any coverage, uptime 100 %, no capacity limit. Net at 24 tiles 21,420/h.
- Crossover tile count where the sprinkler is cheaper than one worker (T × wage/tile-h = 180): copper 180/29.4 = 6.1 tiles; iron 180/14.8 = 12.2 tiles; gold can 180/7.3 = 24.7 → never inside the 24-tile cap (hence rec. 7). Below the crossover the worker wins (he idles for free, the pump does not); above it the sprinkler wins; at 24 tiles with a basic/copper can the sprinkler also wins on uptime (copper 1 worker is saturated, basic needs 2 workers).
- Honest caveat: at lemon scale wages are 0.8–3 % of net. The cash race is real but small; the sprinkler's felt value is (a) 100 % uptime with no capacity limit, (b) one tank covering an 8 h offline window, (c) freeing a worker slot (pool cap 6 vs jobs water/harvest/plant/mine/ore/fuel). Cash payback of the 💰2,000 craft vs the iron worker (saving 174/h) is ≈ 11 h — do not sell the sprinkler as a money saver in the UI; sell "never dry, N tiles".

======================================================================
3. FINDINGS PER QUESTION
======================================================================

Q1 — How real games gate and price sprinklers
- Stardew Valley: three crafted tiers gated by Farming level, paid in bars only, no cash: Sprinkler (Farming 2) = 1 copper bar + 1 iron bar, waters 4 tiles (+ shape); Quality (Farming 6) = 1 iron + 1 gold + 1 refined quartz, 8 tiles (3×3); Iridium (Farming 9) = 1 gold + 1 iridium + 1 battery pack, 24 tiles (5×5) [1][2][3]. Pressure Nozzle (Qi gem shop) enlarges range to 3×3 / 7×7 [4]. Pattern: each tier uses the previous tier's metal plus the new one; coverage ×2 then ×3; the gate is a skill counter, not the metal.
- Forager: Sprinkler is a building = 3 iron ingots, unlocked by the Farming skill node ("unlocks windmills and sprinklers"); waters the 8 surrounding tiles; the Water Shovel (30 iron ingot + 5 nightshade + bottled water) later irrigates on dig and makes sprinklers obsolete [16][17][18][19].
- Farm Together: Sprinkler bought with cash (110 coins), farm level 5, keeps the TWO adjacent tiles watered, halves growth time and cancels drought penalty; no running cost [21][22]. Players call the watering model flawed (rain hurts, watering often does nothing) [23].
- Sun Haven: no sprinklers in the base game; watering is replaced by the Rain Cloud spell (farming skill) and fertilizers; a mod "brings back the cut sprinklers" with 4 ranges [24][25][26]. Players: "the cloud spell is way better than any sprinkler" [24].
- Coral Island: Sprinkler I at Farming level 2, recipe 5 silver kelp + 5 bronze kelp + 10 scrap (third-party recipe list), waters 8 tiles; later tiers by farming level (Sprinkler II at level 6); Lumina sprinkler I = 2 bronze bars + 10 silver kelp + 1 solar core, bought as a recipe from an NPC [27][28][29][30].
- My Time at Portia: "Sprinkler" is a worktable Level-2 mission item, not a farming machine; planter-box farming uses Irrigation Flooring instead [31]. Sandrock: most machines consume WATER from a water tank as their power source — the only mainstream farming game where water is the running cost [32].
- Hay Day: fields have no watering at all (crop pages list only time and price) — inference from the wiki [33].
- Dinkum: Sprinkler (8 tiles) and Advanced Sprinkler need a WATER TANK to operate and run only 7–9 am; all three recipes come from Irrigation Licence 1 (1,000 permit points, needs Farming Licence 3) — the closest analogue to Toon's certificate gate [34][35][36].
- Core Keeper: Sprinkler = 8 scarlet bar + 8 iron bar at the Automation Table, waters 5×5 every 1–2 s, no upkeep (the trailer showed electricity, shipped without) [37].
- Idle/incremental: Rusty's Retirement waters with Water bots bought with spare parts; dry soil pauses growth (same rule as tiles) [38][39]. Farm RPG sells "Irrigation System I/II" perks for 30/75 gold = +10/+20 % growth, no watering chore at all [40].

Q2 — Running costs
- Free after crafting: Stardew, Forager, Farm Together, Core Keeper, Coral Island. The best-known fix is a mod: Better Sprinklers Plus "balanced mode" charges 0.25 g per covered tile per day, halves per tier, and "if you run out of money your sprinklers stop sprinkling" [9] — i.e. the no-cash-idles rule tiles already uses for workers. Utility Grid / Simple Irrigation System mods add water pipes + power conduits that sprinklers need [10].
- Charged: Dinkum (needs a water tank, time-windowed), Sandrock (water as power for machines) [32][36], Farming Simulator automatic-watering mod ("water fees are charged automatically") [41].
- Sentiment: basic Stardew sprinkler is widely called a waste ("Everyone thinks that basic sprinklers are a waste of resources" [15]; "Most players skip it because it only waters four tiles" [11]; "Normal sprinklers are 100 % not worth the effort" [12]) with a counter-thread defending it mathematically [13]; a 2016 thread proposed irrigation infrastructure because sprinklers "let you forget about watering entirely" [14]. Lesson: a weak first tier reads as a trap; a free top tier erases the chore. Tiles' version: first tier is already 6 tiles and the chore survives as a tank.

Q3 — Coverage without grid geometry
- Farm Together's sprinkler covers "the two adjacent tiles" and Hay Day has whole-field machines, but no mainstream farm game defines sprinkler coverage as a count or zone; Dinkum defines SUPPLY as a count (one Water Tank supplies up to 24 Advanced Sprinklers within 22×22) [35]. Farm RPG's irrigation is a farm-wide % perk [40]. Rusty's bots have a range but act on "the driest plot" — a priority model [38]. So Toon's constraint has no direct precedent in farm sims; the closest fit is tiles' own tool/worker rule (priority order) and Dinkum's count-based tank. Recommendation 3 follows from that.

Q4 — Introducing crafting mid-progression
- Stardew: the crafting menu exists from day 1; recipes arrive 2–3 per Farming level (L1 scarecrow + basic fertilizer; L2 mayonnaise machine, stone fence, sprinkler; L3 bee house, speed-gro; L4 preserves jar; L6 cheese press + quality sprinkler; L8 keg; L9 seed maker + iridium sprinkler) [5]. First recipes are chore-removers and waste-converters.
- Terraria: Work Bench = 10 wood; the station then exposes everything (948 recipes at the Work Bench today), filtered by materials you carry [42].
- Core Keeper: Basic Workbench (wood tools, furnace from 20 dirt, watering can 4 copper bar) → Copper Workbench (8 wood + 6 copper bar) → Tin Workbench (10 wood + 6 copper + 10 tin bar); each tier adds ~5–10 recipes; the Automation Table holds the sprinkler/drills [37][43][44].
- Forager: skills unlock buildings (Farming → windmill + sprinklers), one or two per node [17].
- Dinkum: licences (permit points) unlock recipe groups of 2–3 at the Crafting Table [36].
- Pattern: 3–6 visible recipes at unlock, all showing materials, gated by a station the player builds from the previous tier. Rec. 1 and 11.

Q5 — Gold in mining ladders
- Stardew: copper floors 1–39, iron 40–79, gold 80+ (Skull Cavern 10 % node chance at 60–79, 75 % at 80+); mining XP per node 5/12/18/50 for copper/iron/gold/iridium; gold bar = 5 ore + 1 coal, 5 h; gold tools 5 bars + 10,000 g; non-tool uses: quality sprinkler, charcoal kiln (pre-1.4), solar panel, geode crusher, mini-obelisk, fish-pond quests, sells 250 g [6][7][8].
- Terraria: pre-hardmode tiers copper/tin → iron/lead → silver/tungsten → gold/platinum, gold in Underground and Cavern layers; gold is the 4th of 4 pre-hardmode steps [45][46].
- Forager: iron and gold ore both come from rocks in all biomes; gold ingot = 2 ore + 1 coal; a gold ingot turns into 8 coins at the forge, and gold ore makes yellow dye [20][47].
- Core Keeper: ladder copper → tin → iron → scarlet → octarine → galaxite; pickaxe durability rises per tier (tin 550); no gold tier (uncertain) [44].
- Minecraft: gold tools are fast but fragile (32 uses vs wood 59 / stone 131 / iron 250 / diamond 1,561) — the opposite of tiles' durability rule, so do not copy it [48]. OSRS: gold ore at level 40, 60 s respawn, i.e. two steps above iron (15) [49].
- Patterns: gold is 2 steps above iron in level ladders and ~1/2 to 1/3 as common as copper in drop tables; it is always a crafting currency (sprinklers, jewellery, coins) as well as a tool tier. Rec. 8–10 keep gold at 8 % (vs copper 12 / iron 10) so the "first new drop in ~3 min" rule holds with a wide margin.

======================================================================
4. SOURCES
======================================================================
1. https://stardewvalleywiki.com/Sprinkler
2. https://stardewvalleywiki.com/Quality_Sprinkler
3. https://stardewvalleywiki.com/Iridium_Sprinkler
4. https://stardewvalleywiki.com/Pressure_Nozzle
5. https://stardewvalleywiki.com/Farming
6. https://stardewvalleywiki.com/Gold_Bar
7. https://stardewvalleywiki.com/Gold_Ore
8. https://stardewvalleywiki.com/Mining
9. https://www.nexusmods.com/stardewvalley/mods/17767 (Better Sprinklers Plus)
10. https://www.nexusmods.com/stardewvalley/mods/10197 (Utility Grid); https://www.nexusmods.com/stardewvalley/mods/10198 (Simple Irrigation System)
11. https://www.reddit.com/r/StardewValley/comments/1igrqc0/sprinklers/
12. https://www.reddit.com/r/StardewValley/comments/1k9qfqo/the_sheer_disappointment_of_being_new_to_stardew/
13. https://www.reddit.com/r/StardewValley/comments/199w1li/the_regular_sprinkler_is_useful_a_mathematical/
14. https://www.reddit.com/r/StardewValley/comments/4liupi/idea_make_sprinklers_function_through_a/ ; https://www.reddit.com/r/StardewValley/comments/1ioe5ge/upgrade_priority_in_stardew_valley/
15. https://steamcommunity.com/app/413150/discussions/0/152391285458737126/
16. https://forager.fandom.com/wiki/Building
17. https://forager.fandom.com/wiki/Skills
18. https://forager.fandom.com/wiki/Tools
19. https://steamcommunity.com/app/751780/discussions/0/1679189548074484838/
20. https://forager.fandom.com/wiki/Materials
21. https://farmtogether.fandom.com/wiki/Sprinkler
22. https://farmtogether.fandom.com/wiki/Seasons
23. https://steamcommunity.com/app/673950/discussions/0/3276824488729334024/
24. https://steamcommunity.com/app/1432860/discussions/0/598530767490969888/
25. https://www.nexusmods.com/sunhaven/mods/155
26. https://sunhaven.wiki.gg/wiki/Sun_Haven_Crops
27. https://coralisland.fandom.com/wiki/Sprinkler_I
28. https://coralisland.wiki/wiki/Lumina_sprinkler_I
29. https://coralisland.fandom.com/wiki/Farming
30. https://www.mejoress.com/en/coral-island-crafting-recipes/ ; https://thenerdstash.com/how-to-get-a-sprinkler-in-coral-island/
31. https://mytimeatportia.fandom.com/wiki/Sprinkler ; https://mytimeatportia.fandom.com/wiki/Irrigation_Flooring
32. https://en.wikipedia.org/wiki/My_Time_at_Sandrock
33. https://hayday.fandom.com/wiki/Crops
34. https://dinkum.fandom.com/wiki/Sprinkler
35. https://dinkum.fandom.com/wiki/Water_Tank
36. https://bloxodes.com/wiki/dinkum/licences
37. https://corekeeper.wiki/items/sprinkler ; https://core-keeper.fandom.com/wiki/Sprinkler
38. https://www.reddit.com/r/rustysretirement/comments/1cmw1cz/understanding_rustys_retirement/
39. https://gameplay.tips/guides/rustys-retirement-crops-guide-irrigation-fertilization.html ; https://shapes.inc/fandom/rusty-s-retirement/crops-and-resources
40. https://www.farmrpg.com/supply.php
41. https://www.farming-simulator.com/mod.php?mod_id=256844&title=fs2022
42. https://terraria.wiki.gg/wiki/Work_Benches ; https://www.terraria.tools/recipes/station/work-bench
43. https://core-keeper.fandom.com/wiki/Basic_Workbench ; https://corekeeper.atma.gg/en/Tin_Workbench ; https://corekeeper.atma.gg/en/Crafting
44. https://corekeeper.atma.gg/en/Mining
45. https://terraria.fandom.com/wiki/Ores
46. https://terraria.wiki.gg/wiki/Gold_Ore
47. https://www.neoseeker.com/forager/guide/How_to_Make_Gold
48. https://minecraft.wiki/w/Item_Durability
49. https://oldschool.runescape.wiki/w/Gold_ore

Gaps I could not confirm: Coral Island Sprinkler I ingredients come from third-party lists (fandom page is a stub); whether Core Keeper has any gold ore; whether Rusty's Retirement ships a sprinkler item (threads suggest it is a feature request). The worker wages above are from my own sim of the current `workerTargets` rule, not from the repo's sim — re-run the repo sim before pinning them.
