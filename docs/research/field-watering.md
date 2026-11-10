REPORT: "one sprinkler, two scales" — research only, nothing edited

Builds on placement-scaleview.md (PS), fields-market.md (FM), sprinkler-gold.md (SG). Repo numbers used: sprinkler 4 Au + 8 Fe + 8 Cu + 💰8k, 12 coal/h, 6 tiles; pipes 60/150/300 for 8 Cu + 💰10k / 8 Fe + 💰100k / 8 Au + 💰350k, 0.5 coal per 10 tiles/h; mine worker 720 actions/h ≈ 12 rocks/min, Lv4 coal share 20 % → ~144 coal/h; gold 8 % → ~29 Au bars/h ore-side.

1. VERDICTS

A  One sprinkler, two scales        CHANGE  Right shape (one watering unit per land unit, Dinkum/Stardew/FT2 all do it), wrong physics: the same item cannot burn 12 coal/h on 6 home tiles and 0.5 coal/h on 10 field tiles. At home rate 30 field sprinklers = 360 coal/h (2.5 mine workers); so A as written is C in disguise. Also drops the 300-tile plateau lever.
B  Rename pipes "sprinkler lines"   DROP    Toon's complaint is structural (home buys units, field buys a tier curve), not lexical. Keep the vocabulary idea inside C.
C  Sprinkler tiers / field pivot    KEEP    A second TIER of the same Workshop family, bought per plot, with its own coal law and recipe — plus the shared pump as the capacity cap. This is Dinkum's sprinkler → advanced sprinkler + water tank, Stardew's 4/8/24, FT2's 1×2 → 3×3 [1][2][4].
D  Pump as the plateau lever        ADD     Supply-cap object (Dinkum tank: 24 sprinklers per tank; Egg Inc hab/vehicle triad; CS2 moved pipes INTO the road so land purchase carries infrastructure) [1][FM Q4][7]. Reuse today's pipe prices as pump tiers.

2. FINDINGS

Q1 Scaling watering. Two families exist. (a) Same object, bigger tier: Stardew 4 → 8 → 24 tiles, then Pressure Nozzle; big farms are grids of iridium sprinklers (guides: "space centers five apart") [3][4]. FT2: sprinkler went 1×2 → 3×3 at 2 ribbons; one player runs 318 sprinklers for 2,862 tiles and asks for them to cost MORE because the count stopped meaning anything [2]. Ranch Simulator: bucket → sprinklers that need a windmill [8]. (b) New infrastructure object at scale: Dinkum sprinkler/advanced sprinkler + Water Tank (22×22 range, 24 advanced sprinklers, 25×25 field) [1]; Roots of Pacha: olla (per-tile pot) early, then a late Irrigation Pump + Extender + up to 9 trenches per extender, reviewed as "makes more sense and is easier to use than the typical sprinklers" [5][6]; Farm Manager World/2018: irrigation is bought PER FIELD after a training, 💰10k (FM2018) to 62–92k per field (FMW), players call it "quite expensive but worth it just to remove that need"; FM2021 shipped without it and the thread is "There is currently no way to irrigate" [9][10][11]; Pure Farming 2018: water tank towed to the field, optional +10 % [12]; Factorio Space Age: agricultural tower, 3×3 sectors, 7×7-sector reach — one machine = one land unit [13]; Timberborn: moisture spreads from water, geometry only [14]. Real farming: a center pivot irrigates 125–128 of a 160-acre quarter section — one object per land unit, which is why pivots read as "a sprinkler for a field" [15]. Hay Day/FarmVille: no watering object at all (PS).
Pattern: hand plot = per-tile tiers of one item; big farm = one watering unit per land unit, supplied by a capacity object (tank/pump). Nobody sells coverage as an abstract count curve the way today's pipes do.

Q2 Land + watering together or apart. Apart everywhere, but coupled: Farm Manager World sells irrigation per field as an upgrade button on that field [9]; FT2 binds sprinklers to the plot (deletion loses them — the nightmare thread, PS [6]); Dinkum's tank cap forces "one tank per 25×25 block" layouts [1]; CS2 is the strongest "merge" precedent: pipes/cables now run inside roads, sold as removing a chore [7]. Sentiment: per-unit infrastructure is "meaningful" when it is (a) one decision per land unit, (b) visibly expensive in the scarce resource, (c) bulk-buyable. FT2's complaint is that 2 ribbons per 9 tiles made it trivial [2]; Farm Manager's complaint ("manually go in and do it every time… waste of money") is hidden benefit + per-field menu diving [16]. Bulk: Egg Inc's Max button buys the top hab/vehicle "without scrolling" [17]; idle games treat buy-max as required (FM §6).

Q3 Tractor as transition. In every farm game the tractor is a batch tool, not a land unlock: Farm Together 3×3, 1 gas per tile worked, movement free [18]; FT2 needs a Garage, fuel regenerates [19]; Dinkum 3×1 attachments (harvest/plough/plant), three licence levels, ~1.5M dinks (price from a video title, snippet) [20]; FarmVille tractor 2×2 → 4×4 via Vehicle Parts, 1 fuel per plot, 5,000 coins, harvester/seeder likewise [21][22]; Farm Manager 2018 tractor is episode 3 [10]. So a tractor is a good GATE only if it visibly does the batch thing. tiles already has that thing: PLANT_BATCH/HARVEST_BATCH = 10. Make the Tractor purchase BE the batch (the player's "plant 10" button and the planter's 10-batch appear with it) and the harvester/seeder machines its attachments; PS's objection ("never understood what the tractor did") is answered, and Toon's story holds.

Q4 Unit sizes. Observed units: FarmVille vehicle 4–16 plots, FT tractor 9, Dinkum 3, Factorio sector 9 tiles, Stardew iridium 24 / Junimo hut 17×17, Dinkum tank 24 sprinklers ≈ 576 tiles, pivot = one quarter section. The watering unit is 1–3× the work unit; the supply unit is 20–30 watering units.

3. RECOMMENDED DESIGN (estimates; sim pins prices by the 0.5–1.5 h rule)

Objects (all Workshop, greyed-visible):
- Sprinkler (home, unchanged): 6 picked tiles, 12 coal/h, hopper, max 4.
- 🚜 Tractor = the Fields unlock (replaces "Land Deed"): 10 Fe + 💰10k as today. Grants: Fields tab, batch-of-10 actions, plot purchases. Gate unchanged (planter + harvester certs + ≥ 1 sprinkler).
- Plot = 10 tiles = one tractor pass. Land sold by plot: price = Σ today's 💰100 × (count+1) over the 10 tiles (plot n ≈ 💰1,000 × (10n − 4.5); no save value changes). Buttons ×1 / ×10 / max.
- Field sprinkler (the tier-2 item; call it "sprinkler line" or "pivot" in UI): waters one plot. Recipe estimate 1 Au + 2 Fe + 2 Cu + 💰3,000. A plot without one stalls (never dies). "Fill sprinklers (k missing)" button = k recipes at once (Egg Inc Max). No hopper: it hangs off the shared pump, draws coal from storage like pipes today.
- Pump tiers (the plateau lever; = today's pipe recipes, zero price change): Pump 1 supplies 30 field sprinklers (300 tiles; the batch-18 measured plateau), Pump 2 — 8 Fe + 💰100k — 60, Pump 3 — 8 Au + 💰350k — 100 (1,000 tiles). Pump 1 comes with the Tractor (8 Cu + 💰10k folded in, or kept as the first recipe — sim decides).

Arithmetic:
- Cash per tile to water: pipes 💰167 (60) / 733 (150) / 1,533 (300). Field sprinklers 💰300 flat; cumulative at 60/150/300 = 💰18k / 45k / 90k + pump. Cheaper in cash, far dearer in bars: 300 tiles = 30 Au + 60 Fe + 60 Cu (vs 24 bars today) ≈ 1.5 h gold smelting + ~2 h iron/copper mining per mine worker; 1,000 tiles = 100 Au + 200 Fe + 200 Cu. Materials gate, cash does not — the brief's intent.
- Coal: at 0.5/plot/h, 300 tiles = 15 coal/h, 1,000 = 50; plus 4 home sprinklers 48 → 63 / 98 coal/h vs ~144 coal/h per mine worker (minus furnace use). Fits one mine worker + one fuel loader. At 1.0/plot/h (more legible: "a field sprinkler burns 1 coal/h") 300 tiles = 30, 1,000 = 100 → 148 total at 1,000: needs the kiln or a second mine worker — acceptable as a late lever. Sim chooses.
- Clicks at 1,000 tiles: 100 plots via ×10/max, 100 field sprinklers via Fill (1 click each expansion), 3 pump buys. No per-unit chore.
- Plateau: kept as pump supply (30/60/100 plots), now a visible object (Dinkum tank) rather than a coverage number.
- Ladder: manual (home can) → worker → home sprinkler → Tractor + field sprinklers → pump tiers. Machines stay coal-free.
- Migration (v+1): pipes tier N → pump tier N plus 6/15/30 field sprinklers granted (worth more than paid; nothing taken). fields.count → floor(count/10) plots with the remainder kept as a partial plot. Existing stalled tiles keep stalling identically.
- Why not A verbatim: same-item/different-coal "mixed" feeling returns in the furnace card; why not B: nothing changes for the player. C+D keeps Toon's sentence exactly: sprinklers, then a tractor, then sprinklers to match the land.

4. SOURCES
1 https://dinkum.fandom.com/wiki/Water_Tank
2 https://steamcommunity.com/app/2418520/discussions/0/4354495576373013883/ (FT2 ribbons/318 sprinklers)
3 https://stardewvalleywiki.com/Sprinklers
4 https://www.farmgamehub.com/en/guides/stardew-valley/farm-layout (snippet)
5 https://rootsofpacha.wiki.gg/wiki/Farming ; https://rootsofpacha.wiki.gg/wiki/Irrigation_Extender
6 https://steamcommunity.com/id/Ceaseless_Duality/recommended/1245560/ (snippet)
7 https://www.paradoxinteractive.com/games/cities-skylines-ii/features/electricity-water ; https://gamermatters.com/electricity-and-water-utilities-have-massively-changed-in-cities-skylines-2/ (snippet)
8 https://ranch-simulator.fandom.com/wiki/Crops
9 Farm Manager World per-field irrigation: https://www.youtube.com/watch?v=ooW-Ar-osAk ; https://www.youtube.com/watch?v=64UlurscH9k (transcripts)
10 Farm Manager 2018: http://www.youtube.com/watch?v=99YPznDKJR8 ; http://www.youtube.com/watch?v=i6V5rxvTDaA (snippets)
11 https://steamcommunity.com/app/1123830/discussions/0/5879990700798305669/ (FM2021 "no way to irrigate")
12 https://www.gamepressure.com/pure-farming-2018/field-crops/z0aaf8
13 https://wiki.factorio.com/Agricultural_tower
14 https://timberborn.wiki.gg/wiki/Irrigation (snippet)
15 https://www2.gov.bc.ca/assets/gov/farming-natural-resources-and-industry/agriculture-and-seafood/agricultural-land-and-environment/water/irrigation/sprinkler-irrigation-manual/563000-1_web_chapter_7.pdf ; https://www.ndsu.edu/agriculture/extension/publications/selecting-sprinkler-irrigation-system (snippets)
16 https://www.youtube.com/watch?v=SVcb93gdj74 ; https://www.youtube.com/watch?v=VZs5rwKGwAA (snippets)
17 https://www.reddit.com/r/EggsInc/comments/14632s4/max_button/ (snippet)
18 https://farmtogether.fandom.com/wiki/Tractor ; https://steamcommunity.com/app/673950/discussions/0/3011186818020441626/
19 https://farm-together-2.fandom.com/wiki/Tractor (snippet; page body did not extract)
20 https://dinkum.fandom.com/wiki/Tractor ; price: https://www.youtube.com/watch?v=hJ6mTUtdGVg (snippet)
21 https://farmville.fandom.com/wiki/Tractor
22 https://farmville.fandom.com/wiki/Harvester

Not confirmed: Real Farm and Farm Manager 2021's later irrigation patch (no documentation found); Farm Together 2 tractor fuel details beyond the snippet; the Stardew "cost per square" merchant thread (snippet). All arithmetic is mine on balance.ts constants, not the repo sim.
