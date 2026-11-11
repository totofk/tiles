TILES: MORE ⭐ TOYS (research only; nothing edited, created or committed)

1. SUMMARY
- 9 candidates: 8 new mechanics, 1 ladder. None is order-only, none touches the Estate map layout, all reset on "Sell the farm".
- Two differ every run: 🔍 Soil survey and 🏺 Dig finds.
- Bar prices: yes, there is a window. One miner at vein Lv4 brings 💰51k/h of bars against a farm at 16–36k/h; today's furnace caps mining at 60k/h.
- The furnace governs mine income while you play; the 100-slot storage governs it while away. Every ⭐ furnace level lifts the first, so I would open them at the Tractor.
- 🥉100 opens an earlier window at vein Lv2.
- Dropped: a Smith job that switches ore kind (batch 33 molds remove the need).
- My bar numbers are closed-form from balance.ts, not the repo sim. The live site and 375 px fits were not measured. All prices (est.).

2. CANDIDATES
A = fresh player, incl. hand-heavy and stingy. B = veteran with a rich save.

1) 🔍 Soil survey (new mechanic)
- Does: every home bed and every field gets one trait from a per-run seed, e.g. "roots +15 % yield", "fruit −10 %" (est.). The survey reveals and switches them on.
- Axis: which crop suits which land. Hooks: beds, field sheet crop list, Manager plan.
- Gate/price: 12 tiles ⭐10 (≈1 h); fields at the Tractor ⭐25 (≈2 h).
- A: a hand player already plants bed by bed, so it pays at once. A planter worker follows one "Crop to plant" and only hits the matching beds.
- B: 20 fields stop being "mono strawberry everywhere"; the Manager re-plans.
- Build: save bump (seed, traits), Manager DP + calculator, one text line per bed and field sheet. Risk: bounded ±15 %.
- Per-run: yes, the strongest. "Field traits" is already on your parked list.
- Ref: Stardew farm maps, one per save, each favours a skill [S1]; Cookie Clicker garden soils [S2].

2) 🔄 Crop rotation (new mechanic)
- Does: a tile or plot remembers its last crop. Sowing a different one makes that harvest add half the glut (est.). "Crop to plant" gets a "rotate with" partner; planter and seeder alternate.
- Axis: crop sequence on the same land. Hooks: plant, field chip (🍓↔🌽), market.
- Gate/price: 2 licenses + 100 harvests, ⭐15 (≈1–2 h).
- A: a reason to own and switch a second crop early; two crop orders fill at once.
- B: breaks "mono strawberry is best from 2 fields" (DECISIONS:587).
- Build: save bump (last crop per tile/plot, pair per field), Manager DP with pairs (heavy). Risk: price factor stays ≤ 1.
- Per-run: mild. Ref: Farthest Frontier 3-year rotations [S3].

3) 🏆 Prize seed → 🎪 fair (new mechanic, player-triggered, risk)
- Does: a consumable. Plant it on one home tile; it grows 4× as long and sprinklers do not reach it. Each time it runs dry its grade drops 🥇→🥈→🥉; it never dies. Harvest enters it at the fair: no cash, renown +400 / 250 / 150 for that crop (est.).
- Axis: a renown burst. Hooks: tile, renown, one board line.
- Gate/price: first renown tier on any crop; ⭐4 each (≈20–30 min).
- A: one tile to nurse by hand while the rest grows.
- B: 4,000 renown per crop is up to 48 game-hours by workers and resets each sale; 10 seeds (⭐40) top one crop. 10 crops = an endless sink.
- Build: save bump (tile flag, grade); tile badge. Risk: none, the floor stops at 0.7.
- Per-run: low. Ref: Stardew Valley Fair grange display [S4].

4) ⛏ Seam survey (new mechanic, choice)
- Does: aim the vein at one ore: its share ×2, the other ores ×0.5; stone and coal unchanged. Re-aim is free and applies after 50 rocks (est.).
- Axis: vein composition (level owns which kinds, pickaxe owns hits). Hook: veinDrops.
- Gate/price: vein Lv3, ⭐12 (≈1 h).
- A: a hand miner aims at the next recipe (pickaxe, tools).
- B: 20 pivots need 3 Au + 6 Fe + 6 Cu each; he aims by shopping list. Gold aim at Lv4 = 0.16×500 + 0.05×250 + 0.06×50 = 💰95.5 a rock against 71 (+34 %), under the furnace cap.
- Build: one field in run.vein, three buttons on the Mine card. Risk: low.
- Per-run: mild. Ref: Stardew Miner / Geologist choice [S5].

5) 🍯 Preserves pan (new machine behaviour)
- Does: the furnace takes a crop as a fourth kind. Harvests of it fill the slot instead of selling; 10 units + 180 fire ticks = 1 jar, sold at 10 × base with no glut (est.).
- Axis: what a crop becomes (IDEAS #4 at toy size). Hooks: furnace, harvest intercept as orders do.
- Gate/price: furnace + 3 licenses, ⭐20 (≈2 h).
- A: jam or bars for the same fire; at the new bar prices bars win until the market sags.
- B: at batch 3, 60 jars/h take 600 units off a floored market: 600 × 1,150 × (1.0 − 0.5) ≈ 💰345k/h, +14 % of a 20-field estate.
- Build: save bump, sim + calculator, a fourth picker button. Collides with batch 33 molds. Risk: medium.
- Per-run: which crop. Ref: Stardew Preserves Jar [S6].

6) 🔥 Stoker (new worker job)
- Does: a pool worker at the furnace or the pump. While he works: furnace ×1.5 speed at ×2 coal per bar; or tank pressure ×2.5 instead of ×2 at ×3 coal (est.).
- Axis: coal for speed, on demand. Hooks: certificates, fire, Fields tank.
- Gate/price: fuel loader certificate; ⭐15 + 🥈6 (≈1–2 h).
- A: coal becomes a choice (sell, smelt, stoke). A no-worker player skips it.
- B: 20 fields burn 50 coal/h; stoked 150/h is one miner's 144/h, so the mine gets a job again. Sowing is labour-bound at 20 fields (6,170 of 7,500 tiles/h), so it pays only with more planters.
- Build: save bump (job), tick math, tank pins. Offline loss stays one tank. Risk: +25 % field growth at most.
- Per-run: low. Ref: Satisfactory overclock, 2× speed for 2.5× power [S7]; Factorio speed modules [S8].

7) 🔔 Work bell (new mechanic)
- Does: a button: ⚡15 → every assigned worker acts once now (est.).
- Axis: what spare energy does. Hooks: energy, workRound.
- Gate/price: 3 workers assigned, ⭐8 (≈0.5–1 h).
- A: P1 hated a full energy bar; after the first hires it has a use again.
- B: energy is idle on the Estate except hand reaps.
- Arithmetic: regen Lv10 = 1.17 ⚡/s → one bell per 12.9 s against a free round per 5 s = +39 % actions while tapping. It sits near the workerSpeed deed's axis.
- Build: no save change, one button. Risk: none offline. Per-run: no.
- Ref: Idle Miner Tycoon "Activate" all managers [S9]; Kittens hunts cost 100 catpower [S10].

8) 🏺 Dig finds (new mechanic, choice)
- Does: soil digs also find shards; 5 shards = pick 1 of 3 small run rules from a per-run seed, e.g. "stone sells ×3", "one bed never rots" (est.).
- Axis: run rules. Hooks: dig, energy.
- Gate/price: 50 digs; 🔍 sieve ⭐10 (≈1 h), then ⚡ only.
- A: P2 dug soil until the seed rate felt low; digging gets a second payoff.
- B: idle energy gets a sink; first relic inside an hour.
- Build: save bump, one sheet, and about 8 rules that need their own design round. Risk: per rule.
- Per-run: yes. Ref: Realm Grinder excavations [S11].

9) 🚜 Seeder tune-up (ladder)
- Does: seeder +10 %/Lv, 3 levels: 5,400 → 7,020 tiles/h.
- Axis: machine rate past the top tier. Gate/price: Seeder Mk2; ⭐15 / 25 / 40 (≈5–7 h in all).
- A: met after the seeders. B: lifts the measured 6,170 sown/h toward the 7,500 that 20 fields need, up to +21 %.
- Build: one table, no save shape change. Risk: low. Per-run: no. Ref: Factorio [S8].

3. BAR PRICES AND THE FURNACE
- Miner: 1 action per 5 ticks = 720/h. A gold pickaxe (5 hits) breaks any rock in one action = 720 rocks/h.
- Vein Lv4 shares Cu 12 %, Fe 10 %, Au 8 % → 86.4 / 72 / 57.6 ore/h → 43.2 🥉 + 36 🥈 + 28.8 🥇.
- Cash: 4,320 + 18,000 + 28,800 = 💰51,120/h per miner, plus stone 720, minus wage 720. The earlier 54 🥉 used Lv3's 15 %.
- Furnace today, one kind at a time: bars/h = 3,600 ÷ barTicks × batch. At batch 3: 🥉180 = 18k, 🥈90 = 45k, 🥇60 = 60k. At batch 1 gold is 20k.
- One miner's ore needs 43.2×20 + 36×40 + 28.8×60 = 4,032 s of furnace per hour, over 3,600. So 1 miner ≈ 💰49k/h with hand switching, ≈ 29k on gold only. From 2 miners the cap is 60k/h.
- Fuel is free in practice: a full burn is 60 coal/h, one miner digs 144. Batch does not raise coal per cycle.
- Hand: regen Lv10 = 4,200 rocks/h, 5.8 miners' worth, so a hand player sits on the same 60k cap.
- Farm at the same stage (PLAN batch 22 bot): 12.6k/h at 1.8 h, 16.1k at 2.6 h, 29.3k at 6.8 h, 35.8k at 7.7 h; Fields at 9.0 h; 2 fields 153–597k/h; 20 fields 2.4M/h. sellPrice levels multiply bars and crops alike.
- Window: opens with the miner at vein Lv3 (bot minute 107): 36 🥈 + 54 🥉 = 💰23.4k/h against 12.6–16k. Widest at vein Lv4: 49–60k against 16–36k, ×1.4–3.7. Closes at about 2 fields.
- Earlier window: copper at vein Lv2 pays 9.6 cash/⚡ against carrot 2.0 and 24-tile pumpkin 7.52 (repo pins).
- ⭐ levels move the cap, not the ore. Speed ×0.8 twice + batch 4 and 5 (the batch 33 shapes) = ×2.6: gold 156 bars = 💰156k/h. With molds, all three kinds: 123k → 320k/h. Ore still binds at 51k per miner; the gold cap needs 5.4 miners.
- Away: storage 100 fills with bars in under an hour per miner, so 8 h away is one bag, at most 100 🥇 = 💰100k. That holds only while bars never auto-sell.

4. DECISIONS (reply with the numbers you reject; every number is est.)
1. Build 4, 3, 6 first. Reason: no Manager change, smallest saves.
2. 🔍 Soil survey ⭐10 + ⭐25, traits ±15 %. Reason: the one item that makes each run's land different.
3. 🔄 Rotation ⭐15, half glut. Reason: it makes the Estate crop mix a decision; the cost is the Manager DP.
4. 🏆 Prize seed ⭐4, renown +400 / 250 / 150. Reason: endless sink that shortens the renown redo.
5. ⛏ Seam survey ⭐12, ×2 / ×0.5, re-aim after 50 rocks. Reason: cheap, and the mine gets a choice.
6. 🍯 Preserves waits for batch 33; jar at base × 1.0. Reason: +14 % at the floor needs the calculator.
7. 🔥 Stoker is a job, ⭐15 + 🥈6, ×1.5 at ×2 coal. Reason: its price is a pool slot, which only pays when the furnace binds.
8. 🔔 Bell ⭐8, ⚡15. Reason: answers "full energy is waste" once workers exist.
9. 🏺 Dig finds: a content round first, then a price. Reason: the rules are the feature.
10. 🚜 Seeder tune-up ⭐15 / 25 / 40. Reason: sowing is the measured bound at 20 fields.
11. ⭐ furnace rows open at the Tractor. Reason: before it the 60k cap is what bounds the mining window.
12. Speed 2 levels ⭐15 / 30; batch 4 and 5 ⭐20 / 40; no further levels. Reason: ⭐105 ≈ 7–9 h, and ore binds beyond ×2.6.
13. Tray and ore slot grow with batch for free (tray ≥ 2 × batch). Reason: batch 5 on a 5-bar tray stalls a hand player every cycle.
14. Bars never auto-sell, including batch 32's Keep N. Reason: storage is the only brake on away income.
15. 🥉100 → 🥉40. Reason: 5.1 cash/⚡ stays under pumpkin's 7.52; 100 beats it from vein Lv2.
16. Seed items 1 and 8 from the run number; leave "pick one of 4 / 5 / 6 per run" to the prestige-variety research. Reason: you asked for flags, not a design.
17. Before pricing, pin a vein Lv4 miner bench and a hand-only bot in the sim. Reason: my numbers are a model.

5. SOURCES ([snippet] = search text only)
- [S1] https://stardewvalleywiki.com/Farm_Maps
- [S2] https://cookieclicker.fandom.com/wiki/Garden
- [S3] https://farthestfrontier.wiki/wiki/Farming [snippet]
- [S4] https://stardewvalleywiki.com/Stardew_Valley_Fair
- [S5] https://stardewvalleywiki.com/Mining
- [S6] https://stardewvalleywiki.com/Preserves_Jar
- [S7] https://satisfactory.wiki.gg/wiki/Overclocking [snippet]
- [S8] https://wiki.factorio.com/Module
- [S9] https://idleminertycoon.fandom.com/wiki/Managers
- [S10] https://wiki.kittensgame.com/en/general-information/resources/catpower
- [S11] https://realm-grinder.fandom.com/wiki/Excavations [snippet: opened, body not read]
- Repo: balance.ts, mining.ts, furnace.ts, workers.ts, DECISIONS.md, PLAN.md batch 11 / 16 / 22 / 28 results, b24-minor-feedback-decisions.md item 8 (molds).
