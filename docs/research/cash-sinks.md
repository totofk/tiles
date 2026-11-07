Research and arithmetic done. Full report follows (nothing was written to the repo).

REPORT: late-game cash inflation — keeping 💰 meaningful (research only)

Method: read DECISIONS/PLAN/balance.ts and the sprinkler-gold report; summed every cash sink in balance.ts; modelled a lemon-only tile timeline and three options in Python; checked 30+ wiki/forum/design pages (URLs in §4).

======================================================================
1. SUMMARY — recommendations (reject by number), in build order
======================================================================

1. Diagnosis: tiles does NOT have idle-game inflation. Income is already capped by design (24 tiles × top crop = 💰21,600/h; the PRD's dynamic market would lower it further), so cash accumulates linearly. The problem is a finite sink list: every cash price in balance.ts sums to ≈ 💰129,800, the planned batches 9–14 add ≈ 💰22,600 (previous report's numbers), total ≈ 💰152k ≈ 7 h of full income — and the lemon-only timeline buys tiles 10–24 by hour 4.7. After roughly hour 10–12 cash is score. Fix classes that fit: (a) reprice, (b) more land, (g) orders with a second currency, (d) prestige. Not (e) upkeep tax, not (c) cash→materials.

2. NOW (batch 9–10, numbers only, no migration): a pricing rule for every late cash price — the cash part = 0.5–1.5 h of the farm's income at the tile count where the item unlocks, asserted by the sim (20 min ≤ cash ÷ income-at-unlock ≤ 2 h). The previous report's sprinkler 💰2,000/4,000/8,000 becomes ≈ 💰10,800 / 18,000 / 32,400, workshop ≈ 8,100, gold pickaxe ≈ 7,200, smart valve ≈ 16,200. Materials stay the real gate (Hay Day lesson: supplies gate, coins pile). Adds ≈ 4–5 h of cash relevance for zero architecture.

3. NEXT (with the iron/gold batch): land 25 → 36, priced in cash + bars. tileCost already exists; raise TILE_CAP, step the growth down after 24 (1.5 → 1.2) and add a material line: tile n > 24 = 💰20,000 × 1.2^(n−25) + ⛓2·(n−24) iron bars + 🥇(n−24) gold bars (max 24 + 12 = 36 items ≤ storage 70). Buys ≈ 28 h of lemon income (arithmetic §2). Grid ⌈√36⌉ = 6 columns, count-based, no row mechanics. Hay Day players literally ask for "purchasing extra fields" with their idle coins.

4. THEN: an Orders board (g) = the second currency. 1–3 open orders that ask for items (20–40 lemons, 6 bars + 20 coal …), pay cash ×1.3 of sell value plus ⭐ tokens that cash can never buy (farm themes/cosmetics, a 2nd order slot, name plates, later the prestige deed exchange). Satisfactory's AWESOME Sink is the model for turning surplus into a cosmetic currency (quadratic coupon curve); Hay Day's truck/boat orders pay vouchers for pets/decor; Stardew's Qi gems come only from challenges and convert to gold only at a poor rate. Cost: order generator on the seeded PRNG, reward table in balance.ts, one card, v10 migration. Medium.

5. LATER (after batches 9–14 give ≥ 12–15 h of first-layer content): prestige "Sell the farm". Deeds = ⌊√(lifetimeCashEarned ÷ 5,000)⌋ (AdCap's sqrt shape), spent in a short meta shop that maps onto the existing meta.multipliers: head start (+3 start tiles, 2 deeds), reputation (+10 % sellPrice per deed, max 10), keep crop licenses (2), green thumb (−5 % growTime per deed, max 5), mastered-pickaxe bonus carries free (DECISIONS pending). First prestige lands at lifetime ≈ 💰250–400k (hour ≈ 16–24) → 7–8 deeds → next run's first hour ≈ ×2–2.5, which is the genre rule ("the reset must make the early game faster"; NGU "is your number at 2?"; AdCap "wait until angels double"). Everything in run resets; meta keeps deeds, meta upgrades, lifetime stats. Build the meter now: Stats already shows lifetime cash earned.

6. Do not: (i) a cash→ore trader — at vein Lv2 an ore price above ≈ 💰35 makes mining worth more per energy than pumpkin farming (opportunity cost; §2), breaking the sim rule; barter via orders only. (ii) per-tile property tax/upkeep — wages and the sprinkler tank are already the upkeep; RimWorld had to add a "wealth-independent mode" and Animal Crossing players throw bell bags in the bin. (iii) bigger cash numbers alone — Melvor shows that once GP inflates, every later GP price is instabuy for veterans and impossible for newcomers. (iv) pay-to-skip material gates with cash (Hay Day diamonds for deeds).

======================================================================
2. ARITHMETIC
======================================================================

Baseline (balance.ts): lemon net 90 per crop, 10 cycles/h → 💰900 per tile-hour; 9 tiles 8,100/h, 24 tiles 21,600/h.
- Tiles 10–24: 100 × 1.5^n = 100 … 29,193, sum 💰87,380 (10–16 only 3,217; 17–24 84,163).
- Upgrades to max: energyMax 9,079 + energyRegen 21,493 + sellPrice 1,265 + fertilizer 2,263 = 34,099. Hires (6) 2,644. Storage cash 791. Licenses/mine/furnace/vein/certificates/tools/copper tools/furnace upgrades/pickaxe ≈ 4,870.
- Total existing ≈ 💰129,800; + planned ≈ 22,600 → ≈ 152k = 7.1 h at 21,600/h.
- Lemon-only greedy timeline (100 % uptime, no other sinks): tile 20 at 1.1 h, 22 at 2.3 h, 24 at 4.7 h. Payback of tile 22 = 14 h, tile 24 = 32 h at 900/h — already "bad investments" that players buy because nothing else exists.

Option 2 (price rule) examples, income at unlock → price: workshop at ~12 lemon tiles (10,800/h) × 0.75 h = 8,100; sprinkler-6 at ~16 tiles (14,400/h) × 0.75 = 10,800; sprinkler-12 at ~20 tiles (18,000/h) × 1 h = 18,000; sprinkler-24 at 24 tiles × 1.5 h = 32,400; gold pickaxe 14,400 × 0.5 = 7,200; smart valve 21,600 × 0.75 = 16,200. New late total ≈ 💰93k vs the previous 22.6k → +3.3 h of cash goals, all paired with bar prices so cash is never the sole gate.

Option 3 (land 25–36), 24-tile lemon farm, greedy, 100 % uptime:
- 20,000 × 1.2^(n−25): tile 25 20,000 (0.9 h), 27 28,800 (cum. 3.2 h), 30 49,766 (8.2 h), 33 85,996 (16 h), 36 148,602 (28.2 h). Sum 💰791,611.
- Alternatives: growth 1.25 → sum 1.08M, 36 tiles at 38 h; 30,000 × 1.15 → sum 870k, 31.5 h. 1.2 keeps each tile 1–5 h apart (AdCap-like late pacing).
- Material line ⛓2·k + 🥇k (k = n − 24): at vein Lv4 (previous report: 10 % iron, 8 % gold, ~19 rocks/min, 2 ore per bar) ≈ 0.95 iron bars/min and 0.76 gold bars/min, so tile 36's ⛓24 + 🥇12 ≈ 25 + 16 min of mining — cash remains the slower half of the gate as intended.
- Income after: 36 × 900 = 32,400/h (+50 %); grows linearly, cost geometrically, so 36 is a natural cap again.

Option 4 (orders): 24 lemon tiles yield 240 lemons/h; an order for 20–40 lemons is 5–10 min of output; one order per ~10 min, 3 slots. Cash reward 1.3× sell value = +30 % income on ordered goods only (≤ +💰2,000/h) — a bonus, not a new economy; ⭐ 1–3 per order → the ⭐ shop (5/10/20/40 ⭐) gives 8–15 h of ⭐ goals with no cash involved.

Option 5 (prestige) with deeds = ⌊√(lifetime ÷ 5,000)⌋: lifetime 150k (≈ hour 10–12) → 5; 250k (≈ hour 16.6) → 7; 400k (≈ hour 23.6) → 8; 1M (≈ hour 51 at today's speed, ~hour 35 at ×2) → 14; 4M → 28. Doubling deeds needs 4× lifetime, the same shape as AdCap angels (150·√(lifetime/1e15): 50 angels = $1.1e14, 300 = $4e15) and Cookie Clicker's cube root (365 chips = 365³ × 1e12 = 48.6 quintillion, matches the wiki guide). With 7 deeds: head start 12 tiles (2) + licenses kept (2) + 3 × +10 % price (3): first-hour income ≈ 12/9 × 1.3 ≈ ×1.7 plus skipped licenses (💰550) and faster tile ramp → ≈ ×2–2.5 to the lemon license; tune the divisor so the first prestige gives ≥ ×2 or it will read as a loss.

Trader check (why 6.i): vein Lv2 with a copper pickaxe ≈ 1 rock per energy: 0.65 × 💰2 + 0.2 × 💰4 + 0.15 × X. Cap 0.9 × pumpkin = 7.36 → X ≤ 💰35 per copper ore, i.e. any trader price that makes buying ore meaningful also makes mining the best cash/energy in the game.

======================================================================
3. FINDINGS PER QUESTION
======================================================================

Q1 — How games handle it
- Stardew Valley: cash sinks are mostly huge one-offs — Gold Clock 10,000,000g (no debris, fences never decay), Earth/Water Obelisk 500,000g + 10 iridium bars + 10 earth crystals each, Return Scepter 2M [1][2]. Then a second currency: Qi Gems from Mr Qi's special orders, cannot be sold, buy items unavailable elsewhere (Pressure Nozzle, Enricher, Hopper, Key To The Town…); converting them to gold is deliberately poor (Qi Seasoning sells 200g) [3]. Sentiment: "Anything past about 20 million isn't going to be used for anything but making more money… using the money is not the point"; "Sometimes I delete and rebuy the golden clock just to run down my late game money"; "I am gaining money far faster then I can spend it" [4][5].
- Hay Day: farm plots from level 22 need equal counts of land deeds, mallets and marker stakes (6/6/6 … 16/16/16 per plot); supplies are rare drops, buyable for 3–12 diamonds each, "strongly advised not to sell" [6][7]. Coins are the abundant currency: level-128 player "What the hell do I do with my coins… It would be great if I could use my coins for upgrades, like purchasing extra fields" [8]; level-66 player at 1.2M coins asking the same [9]. Truck/boat orders pay coins + XP + occasional vouchers (pets, decorations) [10].
- FarmVille 2: expansions need a level, coins and building materials; premium Farm Bucks skip [11] (support page, no numbers extracted).
- Forager: island prices from 60 to 34,200 coins per land in a fixed map (wiki table), community estimate ≈ $150–200k for all, the four corners ≈ $120k alone; coins come from gold ingots at the forge [12][13]. Land is the only big sink; after it, money is for buildings.
- Farm Together: three currencies — coins, Medals (quests, stalls) and Diamonds (selling goods; buy most buildings, decorations, fences, roads); land plots gated by farm level [14][15].
- Cookie Clicker: ascension at prestige = ∛(cookies all time ÷ 1e12); +1 % CpS per level; heavenly chips 1:1 buy permanent upgrades; wiki guide's first ascension at 365 chips = 48.627 quintillion cookies [16][17].
- AdVenture Capitalist: angels = 150·√(lifetime ÷ 1e15), +2 % profit each, only after reset; community: first reset at 50–300 angels, afterwards "wait until you at least double", a rebuild takes 2–3 h [18][19].
- Egg Inc: prestige unlocks with the first soul egg; resets population, common research, habs, silos, vehicles; keeps soul eggs and epic research; "if the game is slowing down and you have no goals on the current egg, it's time"; diminishing % gain per prestige [20].
- Idle Miner Tycoon: prestige per mine, 6 levels, costs that continent's cash; resets shafts/elevator/warehouse; everything else kept + 100 super cash; cannot be bought with premium currency [21].
- NGU Idle: rebirth when "your number is at 2 — twice as strong", no boss EXP from the first 8 bosses [22].
- Melvor Idle: no prestige by design; GP sinks are bank slots (price rising to a 5,000,000 cap) and the shop; result: "tons of GP with nothing to spend it on… dedicated people have farmed literally trillions"; a proposed "logarithmically scaling currency purchased with GP (think prestige)" is called a cop-out, and "a new expansion needs a new currency" [23][24].
- Antimatter Dimensions: layered resets — dimension boosts/galaxies within minutes–hours, first Infinity after 5 h–2 days, early Infinity 6 h–6 days [25].
- Kittens Game: paragon = 1 per kitten over 70 at reset; community: first reset at ≥ 120 kittens, earlier is a waste [26][27].
- Factorio: no currency; items are the currency, science packs the sink (some players explicitly want an economy instead) [28] — dev rationale not found (see gaps). Satisfactory: AWESOME Sink converts surplus into coupons, cost of the n-th coupon = 250·(⌈n/3⌉−1)² + 1000 (quadratic, not geometric), 1,895 coupons ≈ 125.7 billion points ≈ 11 h 23 min at theoretical max throughput [29][30]. RimWorld: silver is trade money; "storyteller wealth" = items + creatures + 0.5 × buildings feeds raid points above 14,000 wealth — hoarding is punished systemically, and 1.3 added a wealth-independent mode for players who hate it [31][32]. ONI: resources only (common knowledge, no source pulled).

Q2 — Taxonomy
(a) Geometric costs: works while income also grows (idle norm 1.07–1.15 per unit [33]); with income capped (tiles) 1.5 explodes — tile 24 pays back in 32 h. Complaints: "walls". Cost: none, exists.
(b) Land: the sink players ask for (Hay Day, Forager); works if each plot is 1–5 h apart and needs materials too. Complaints when land is premium-gated (Hay Day deeds). Cost: low here (tileCost, cap, grid columns).
(c) Cash → second currency/materials: Stardew Qi gems, Hay Day vouchers, Farm Together medals — works when the second currency is earned by play, not bought; complaints when it is a pay-to-skip (diamonds). A cash→ore trader breaks tiles' hierarchy (§2). Cost: medium.
(d) Prestige: the structural answer to linear accumulation; works when the first reset arrives after the whole first layer is seen and gives ≥ ×2; complaints: "feels like a loss" when early or small [34][22]. Cost: one batch (deeds, meta shop, v10, sim).
(e) Scaling upkeep: already present (wages per action, pump 💰180/h). Property-tax style is hated unless it is the narrative (RimWorld). Cost: low, risk high.
(f) Cosmetic/collection: Satisfactory coupons, Hay Day decor, ACNH; works as a parallel track; complaints only when cosmetics are the only sink.
(g) Orders: Hay Day truck/boat, Stardew special orders (recipes you cannot buy [35]); sink items not cash and give a reason to keep every crop licensed. Cost: medium.
(h) Income caps: already structural (tile cap × top crop; PRD dynamic market saturation to 50 %).

Q3 — fit for tiles: recs 2 (now), 3, 4, 5, in that order; arithmetic in §2.

Q4 — prestige timing: every reference puts the first reset after all first-layer content is bought at least once and the growth rate has flattened: AdCap all 10 businesses + 50–300 angels (a few hours to a day) [19]; Cookie Clicker 365 chips (days) [16]; Egg Inc "when slowing and no goals" [20]; Kittens ≥ 120 kittens [27]; NGU at ×2 [22]. Carry-over is always meta currency + meta upgrades + lifetime stats/achievements; the run resets (IMT resets only the one mine). Minimum content: enough that a second run has something to be faster at — for tiles that is batches 9–14 (≈ 12–15 h). Verdict: later, not now-ish; define the deed formula now and reuse ⭐ or lifetime cash as its visible meter.

Q5 — anti-patterns: coins printed with no gate (Hay Day); premium skip of the real gate; cash prices that inflate into instabuy/impossible (Melvor, Diablo 3's hyperinflated AH that Jay Wilson said "hurt the game" [36]); sinks that read as tax (RimWorld's wealth-independent mode exists because of it); nothing-to-buy cash (Stardew 20M, ACNH 999,651,999 bells "I'd rather not have all of it" [37]); a first prestige that is slower than the run it replaced [34]. Path of Exile's answer — no gold at all, every currency is a consumable material — is the extreme of (c) [38].

======================================================================
4. SOURCES
======================================================================
1 https://stardewvalleywiki.com/Gold_Clock
2 https://gamegeeks.net/games/stardew-valley/wiki/wizards-tower/
3 https://stardewvalleywiki.com/Qi_Gem
4 https://www.reddit.com/r/StardewValley/comments/1c8rpwx/what_to_spend_money_on_in_late_game/
5 https://www.reddit.com/r/StardewValley/comments/wkd16i/late_game_money_sink/
6 https://hayday.fandom.com/wiki/Expansion/Farm
7 https://hayday.fandom.com/wiki/Supplies
8 https://www.reddit.com/r/HayDay/comments/1xebv9p/what_the_hell_do_i_do_with_my_coins/
9 https://www.reddit.com/r/HayDay/comments/1bxqx4s/what_to_do_with_coins/
10 https://hayday.fandom.com/wiki/Trade
11 https://zyngasupport.helpshift.com/hc/en/10-farmville-2/faq/483-what-are-the-expansion-requirements-1688024717/
12 https://forager.fandom.com/wiki/Lands
13 https://www.reddit.com/r/Forager/comments/ixz13p/how_much_do_all_forager_lands_cost/
14 https://farmtogether.fandom.com/wiki/Diamonds ; https://farmtogether.fandom.com/wiki/Medals
15 https://farm-together-2.fandom.com/wiki/Expansion
16 https://cookieclicker.wiki.gg/wiki/Ascension_guide
17 https://cookieclicker.wiki.gg/wiki/Ascension
18 https://adventure-capitalist.fandom.com/wiki/Angel_Investors
19 https://steamcommunity.com/app/346900/discussions/0/618458030681519409
20 https://egg-inc.fandom.com/wiki/Prestige
21 https://idleminertycoon.fandom.com/wiki/Prestige
22 https://ngu-idle.fandom.com/wiki/Frequently_Asked_Questions
23 https://wiki.melvoridle.com/w/Bank
24 https://www.reddit.com/r/MelvorIdle/comments/132f8eu/use_for_lategame_gp/
25 https://antimatter-dimensions.fandom.com/wiki/Guide
26 https://wiki.kittensgame.com/en/general-information/resources/paragon
27 https://steamcommunity.com/app/1097410/discussions/0/766312101614464290/
28 https://steamcommunity.com/app/427520/discussions/0/4844275329482933911/?ctp=2
29 https://satisfactory.wiki.gg/wiki/AWESOME_Sink
30 https://satisfactorybase.com/guides/awesome-sink
31 https://rimworldwiki.com/wiki/Raid_points
32 https://rimworldwiki.com/wiki/Wealth_management
33 https://markdownbin.org/@og/incremental-idle-game-design-research-notes-zxxm3sn9/v/1
34 https://playfox.org/news/idle-game-design/
35 https://stardewvalleywiki.com/Special_Orders ; https://gamegeeks.net/games/stardew-valley/wiki/quests/
36 https://www.zenofdesign.com/goodbye-diablo-3-auction-house/
37 https://www.reddit.com/r/AnimalCrossing/comments/18z1z3p/too_many_bells/
38 https://saschb2b.github.io/game-mechanics/games/path-of-exile/crafting-and-currency
Also read: https://hayao.dev/docs/codex/genre-incremental ; https://www.gdcvault.com/play/1022065/Idle-Games-The-Mechanics-and (Pecorella, not extractable).

Could not confirm: a Wube/Factorio developer statement on why there is no money (only player threads); FarmVille 2's exact permit/material numbers; Forager's full price formula (only the wiki's per-island table and a community total); Kittens paragon's per-point production %; Pecorella's exact "first prestige" guidance (GDC Vault not extractable — the ×2 rule is from NGU's FAQ, AdCap's community guide and the PlayFox article); ONI "no money" is from general knowledge, no page pulled. The income/timeline numbers in §2 are my Python model on balance.ts values (100 % uptime, no energy cap, no market saturation), not the repo sim — rerun `tests/sim.test.ts` bots before pinning any of them.
