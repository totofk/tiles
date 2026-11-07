# Round 5 research — furnace, copper ore, copper pickaxe (batch 7 / 7.1)

Research only; nothing in the repo was changed. Claims marked **(inference)** are mine, not sourced. Builds on `progression.md` (layer ownership, ore ≤ 1 cash, tier durability rule), `round2-mining.md` and `workers.md`; numbers from `balance.ts`, PLAN "Batch 6 / 6.1 results" (vein Lv1 bought at tick 753, storage Lv1 at 330, ~79 mines per 1200 ticks in the session bots, ~95 cash/min after the lemon license).

## Summary

1. Reference recipes cluster at **1–5 ore + 0–1 fuel → 1 bar** and the furnace itself is cheap: Stardew 5 ore + 1 coal, 25 stone + 20 copper ore to build [1][3]; Forager 2 ore + 1 coal, 10 stone to build [7][8]; Melvor 1 ore (+ coal for steel and up), 2 s per action [4]; Factorio 1 ore → 1 plate in 3.2 s, furnace = 5 stone [9]; Minecraft 1 item per 10 s, coal = 8 items, planks = 1.5 [11]. The ore is the gate, the building is not.
2. **Change the recipe to 2 ore + 1 fuel → 1 bar, 60 s.** At tiles' ore rate (0.5–1.5 copper/min, §3) the draft 5-ore/30 s furnace would be busy < 15 % of the time and the queue would read as dead; 2 ore/60 s keeps it 25–75 % busy and makes each bar ≈ 1.5–4 min of mining, a visible unit of progress.
3. **Furnace = 20 stone + 5 coal + 150 cash**, buyable right after vein Lv1 at storage capacity 30 (sum 25 ≤ 30); the draft 30 stone + 200 needs storage Lv2 first and delays it by ~5 min. Model: affordable at tick ~900–1130 (15–19 min) depending on mining rate.
4. **Vein Lv2 = 30 stone + 10 coal + 200 cash → 65 % stone / 20 % coal / 15 % copper ore (3-hit rock)**; needs storage Lv2 (cap 40). Ladder: vein Lv1 (753) → furnace (~1000) → storage Lv2 (~1250) → vein Lv2 (~1300–2100) → copper pickaxe (~1800–3300, i.e. 30–55 min). One new system (furnace), everything else is a goal inside the mine.
5. **Copper pickaxe = 5 copper bars + 50 cash, durability 200, 3 hits per action (copper rock in 1), repair 2 bars.** Time to first copper pickaxe after vein Lv2: 9–20 min. Cash/energy with it: 2.25 on Lv2, 2.34 on Lv1 — below vein Lv1 + wood Lv10 (2.34) and far below 0.9 × pumpkin (7.36). Mining stays a materials pipeline.
6. **Fuel: 1 coal or 2 wood — keep**, coal stays sellable at 4. Wood fuel costs 8 cash/bar vs coal 4, so wood is the fallback, never the plan; no arbitrage because bars are unsellable (or sell ≤ 5).
7. **Queue: inputs consumed on enqueue, cap 5 jobs, output tray, closed-form catch-up** (`done = min(queue, ⌊(progress + ticks) / barTicks⌋)`), no RNG. Offline matters little in batch 7 (no ore arrives while away) and becomes real with the mine worker in batch 8.
8. Draft 5 (copper farm tools in 7.1) — keep: 4 bars + cash each; the set is 12 bars = 24 ore ≈ 16–46 min after the pickaxe.
9. Open: the tier-durability rule breaks at iron (copper Lv10 = 1000 uses > iron 500); furnace-before-ore vs Stardew's ore-before-furnace; auto-smelt toggle now or with workers.

## 1. Smelting numbers in real games

| Game | Ore → bar | Fuel per bar | Time per bar (real) | Capacity / queue | Upgrade | Offline | Src |
|---|---|---|---|---|---|---|---|
| Stardew Valley | 5 ore → 1 bar (all tiers) | 1 coal per job, any tier | copper 30 game-min ≈ 21 s; iron 2 h ≈ 84 s; gold 5 h ≈ 210 s; iridium 8 h ≈ 336 s (10 game-min = 7 s) | 1 job per furnace, output waits inside until collected; players build many | Heavy Furnace (2 furnaces + 3 iron bars + 50 stone): 25 ore + 3 coal → 5–6 bars, i.e. 9 % ore and 45 % coal saved | machines run while you sleep; no cap | [1][2][6] |
| Stardew build cost | furnace = 25 stone + 20 copper ore, blueprint given the day after the first copper ore | | | | | | [1][3] |
| Melvor Idle | bronze 1 copper + 1 tin; iron 1 ore; steel 1 iron + 2 coal; mithril 1 + 4 coal; adamantite 1 + 6; runite 1 + 8 | coal is an ingredient, not a burner | 2 s base per action | continuous: repeats while inputs last | mastery: +5 % preserve at Lv 20/40/60/80 (+10 at 99), +5 % double at 10/30/50/70/90; preserve cap 80 % | computed on return, cap 24 h | [4][5] |
| Melvor coal | coal ore from Mining Lv30; Firemaking gives coal 40 % per log burnt; coal sells 13 | | | | | | [4][5] |
| Forager | iron ingot = 2 iron ore + 1 coal; gold = 2 gold ore + 1 coal; coal = 2 wood (made in the furnace) | 1 coal | seconds per craft; per-building queue | furnace = 10 stone | build more furnaces | — | [7][8] |
| Factorio | 1 iron ore → 1 plate, 3.2 s (0.3125/s) in a stone furnace (5 stone, 90 kW) | fuel by energy: coal 4 MJ = 44 s = 13.9 plates; wood 2 MJ = 6.9 plates | 3.2 s | one input stack; fuel burns only while working | steel furnace ×2 speed, electric furnace | n/a | [9][10] |
| Minecraft | 1 item → 1 item | by burn time: coal/charcoal 80 s = 8 items, planks/logs 15 s = 1.5, stick 0.5, block of coal 80, lava bucket 100 | 10 s | 1 input stack, 1 fuel stack, 1 output stack; leftover fuel keeps burning | blast furnace ×2 speed | n/a | [11] |
| Idle Planet Miner (idle reference; Idle Miner Tycoon has no smelting) | 1,000 ore → 1 bar; copper 20 s, iron 30 s, lead 40 s, silicon 60 s … | none | 20–80 s | each smelter repeats one recipe "until you give it new instructions", no quantity | buy more smelters, −time research | runs while away | [12][13] |

Pattern: ore per bar 1–5; fuel either 1 per job (Stardew, Forager) or a burn budget (Minecraft, Factorio); time per bar scales with tier (Stardew 1 : 4 : 10 : 16); the first furnace costs 5–25 stone; the queue is either one job (Stardew, Minecraft) or continuous (Melvor, IPM). **The value step ore → bar is 2–3×:** Stardew copper ore 5 g + coal 15 g → bar 60 g [3]; Melvor copper + tin → bronze 6 gp [4]; IPM "bars are worth comfortably more than the ores" [12].

**Recommended recipe for tiles (inference from the table and §3 rates):**

| | Draft | Recommended | Why |
|---|---|---|---|
| ore per bar | 5 | **2** | 1 copper node drops 1 ore at 15 %; 5 ore = ~38 mines per bar, too coarse. Forager's 2 : 1 is the closest game shape [7] |
| fuel | 1 coal or 2 wood | **same** | §4 |
| time per bar | 30 s | **60 s** (copper); later iron 90, gold 120 | keeps the furnace 25–75 % busy at tiles' ore rate; a bar every 1.5–4 min of mining |
| queue | "runs offline from a queue" | **cap 5 jobs, inputs paid on enqueue, output tray** | §5 |
| energy | — | **0 energy to enqueue/collect** | it is a machine: fuel is its running cost (DECISIONS "machine = instant substitute with maintenance") |
| bar sell price | — | **none** (or ≤ 5 = 2 ore + coal − 1) | sim rule `barSell ≤ inputs` from progression.md; kills any smelt-to-sell loop |

## 2. Furnace cost and timeline

Reference furnaces are cheap (5–25 stone); the pacing lever is the ore supply, not the building [1][7][9]. In tiles the stone price is the real gate (cash income is ~95/min by tick 700, so 150–200 cash is 2 min; 20 stone is 25 mines ≈ 2.5–6 min).

Storage rule (DECISIONS "Stone prices fit storage"): the **sum** of a price's items must fit the capacity the player has when it becomes buyable, with room for the 2 wood of a repair **(inference: make the test use the sum, not each item)**. Draft 30 stone at cap 30 passes the letter of the rule but leaves no room for coal or wood → effectively needs storage Lv2 (20 stone + 80).

Model (mining on vein Lv1 from tick 753 with 0 stone, 80/20 drops, cash never binding; r = mines per minute: 4 is the batch-6 session bot, 10 is a mine-focused player with an energy upgrade):

| Ladder step | price | cap needed | r = 4 | r = 6 | r = 10 |
|---|---|---|---|---|---|
| vein Lv1 (measured) | 25 stone + 100 | 30 | 753 | 753 | 753 |
| **furnace** | **20 stone + 5 coal + 150** | 30 | 1128 (19 min) | 1003 (17) | 903 (15) |
| storage Lv2 | 20 stone + 80 | 30 | 1503 (25) | 1253 (21) | 1053 (18) |
| **vein Lv2** | **30 stone + 10 coal + 200** | 40 | 2066 (34) | 1628 (27) | 1278 (21) |
| copper pickaxe (5 bars = 10 ore, wood pickaxe on Lv2) | + 50 cash | 40 | 3276 (55) | 2455 (41) | 1798 (30) |
| same ladder with the draft (30 stone + 200; 5 ore × 4 bars) | | | 4583 (76) | 3316 (55) | 2303 (38) |

- The furnace lands 3–6 min after vein Lv1 as the next visible goal; storage Lv2 and vein Lv2 follow 4–9 min apart; the copper pickaxe is the 10–20 min goal after that. Goals every 3–9 min, one new *system* (the furnace) ~15 min after mastery/vein — the round-4 pacing rule holds.
- Coal in the furnace price: 5 coal ≈ 25 mines on Lv1, already in storage by then (the model ends with 11 spare coal); it says "coal belongs to the furnace" before the first smelt **(inference)**. If Toon prefers stone-only: 25 stone + 150, still ≤ 30.
- Visibility: the furnace row appears in the Shop (a thing you own) once vein Lv1 is bought; the Mine panel's greyed row becomes "🔒 Lv2: copper ore — needs Furnace" (task 29 text says iron; update).
- Order alternative: Stardew gives the furnace recipe *after* the first copper ore [1]; tiles' draft gates ore behind the furnace. Keep the draft: the greyed row already creates the pull, and no player holds 1-cash junk with a 30-slot storage **(inference)**.

## 3. Copper ore rate and the copper pickaxe

**Vein Lv2 drop table: 65 % stone / 20 % coal / 15 % copper ore** (progression.md). Copper rock = 3 hits; wooden pickaxe (2 hits/action) needs 2 actions, copper pickaxe (3 hits/action) 1; surplus hits wasted (Stardew hits-per-node [14]). Coal share unchanged so coal supply does not move.

Cash/energy (ore 1, stone 2, coal 4; energy per node = ⌈hits / hits-per-action⌉; repair amortised):

| Pickaxe | vein Lv1 | vein Lv2 | note |
|---|---|---|---|
| wooden Lv10 (measured) | 2.34 | 1.96 | Lv2 is −16 % cash for +0.13 ore/energy: show "≈ 2.3 → 2.0 cash per node" in the drop-table preview so it reads as a trade |
| copper Lv0 (repair 2 bars ≈ 0.06/use) | 2.34 | 2.19 | |
| copper Lv10 | 2.39 | 2.24 | |
| cap: 0.9 × pumpkin 8.18 = 7.36; 0.9 × chilli = 3.61 | | | every mining value is under both; copper never beats wood Lv10 on Lv1 |

**Copper per hour** (copper/energy = 0.15 / 1.15 wood, 0.15 / 1.0 copper; coal/energy ≈ 0.17–0.20):

| mines/min | ore/h wood → copper pickaxe | bars/h (2-ore) | coal/h | 5-bar pickaxe after vein Lv2 | 7.1 set (12 bars = 24 ore) |
|---|---|---|---|---|---|
| 4 | 31 → 36 | 15–18 | 42–48 | 20 min | 40–46 min |
| 6 | 47 → 54 | 23–27 | 62–72 | 13 min | 27–31 min |
| 10 | 78 → 90 | 39–45 | 104–120 | 8 min | 16–18 min |

At 60 s per bar the furnace can do 60 bars/h: always ore-bound, never the frustrating bottleneck, but busy 25–75 % of the time. With the draft (5 ore, 30 s) bars/h would be 6–18 against a capacity of 120 → busy 5–15 %.

**Copper pickaxe:** 5 copper bars + 50 cash (Stardew copper tier = 5 bars + 2,000 g [14]; progression.md said 4 bars + 60). Durability 200 (> wood Lv10 lifetime 125 ✓), mastery thresholds ×2 (20 … 800 xp), Lv10 lifetime 1000 uses. Repair 2 bars when blunt (same 2/3 ratio as wood 2/3 wood). Self-cost: at Lv0 the repair eats 0.02 ore per use = 13 % of its own ore output; 2.7 % at Lv10 — the same shape as Minecraft's tier lifetimes [15]. Bars and ore are items (1 slot each): 5 bars ≤ cap 40 ✓, and the queue holds ore outside storage (§5).

Warning for batch 8 **(inference)**: with the 80 % cap, copper Lv10 = 1000 uses > the planned iron base 500, breaking the DECISIONS rule "base durability of tier k+1 > Lv10 lifetime of tier k". Either iron 1200 / gold 6000, or copper 100 (Lv10 = 500, iron 600), or restate the rule as "base ≥ 2.5 × previous base". Decide before iron; 200 is fine for batch 7 alone.

## 4. Fuel

- Ratios in the references: Factorio coal 4 MJ = 2 wood [10]; Forager coal = 2 wood [7]; Minecraft coal = 5.3 planks [11]; Stardew kiln 10 wood → 1 coal, coal 15 g vs wood 2 g [16][17]. Draft "1 coal or 2 wood" sits at the Factorio/Forager point — keep.
- Arbitrage: wood buys 4 → 2 wood = 8 cash per bar; coal's alternative use sells 4 → coal fuel costs 4. Nobody burns wood unless out of coal; wood is the anti-stall fallback (a player who sold every coal can still smelt). No cash loop: bars are unsellable, and ore cannot be bought. If a bar sell price is ever added, keep it ≤ 2 (ore) + 4 (coal) − 1 = 5 and assert it in the sim.
- Coal supply vs demand on Lv2: 0.2 coal per node vs 0.15 copper → 2.67 coal per 2-ore bar against 1 burnt → ~1.7 surplus coal per bar. **Coal stays sellable at 4**: that surplus is the whole reason vein Lv1 raises cash/energy (2.34 vs 1.6 without coal sales), and Melvor/Stardew both let coal sell [5][17]. With the draft 5-ore recipe demand would be 1 coal per 6.7 mined → fuel would never matter.
- Fuel order inside the furnace: coal first, wood only if the player opts in ("burn wood when out of coal", default off) so repair wood is never eaten silently **(inference)**.

## 5. Offline / queue design

- **State:** `run.furnace = { built: boolean, queue: number, progress: number, ready: number }`. Enqueue consumes 2 ore + 1 fuel from storage immediately (Stardew/Minecraft consume on insert [1][11]); `queue ≤ FURNACE_QUEUE_CAP = 5` (10 ore + 5 fuel inside the furnace, which is also +15 effective storage — the only reason a 30-slot player can accumulate a pickaxe). `ready` is the output tray (Stardew/Forager style: output waits in the machine [1][7]); "Collect" moves bars to storage, fails typed `STORAGE_FULL` like selling. Tray cap = queue cap.
- **Why not continuous (Melvor/IPM) in batch 7:** nothing produces ore while away until the mine worker (batch 8), so an auto-repeat toggle has no inputs to eat; add `autoSmelt` with the worker.
- **Runs out:** cannot run out mid-job (inputs paid at enqueue). Queue empty → idle, `progress = 0`. Tray full → the furnace keeps smelting until `queue` is empty anyway (no job can start without inputs the player put in, so `ready ≤ cap` by construction).
- **Pure step, closed form, no RNG:** `t = progress + ticks; done = min(queue, ⌊t / barTicks⌋); queue −= done; ready += done; progress = queue > 0 ? t mod barTicks : 0`. Identical result for `step(s, 28800)` and 28,800 × `step(s, 1)` — test it. Fixed order in `step`: crops → furnace → workers later. Counter `bars`.
- **Offline:** 8 h cap = 480 bar-times; a full queue finishes in 5 min, so the welcome-back banner just adds "🔥 N bars ready". That is the honest batch-7 value of "runs offline": free, deterministic, and it becomes meaningful with workers. Melvor computes everything on return the same way, capped at 24 h [5].
- **375 px presentation:** one card in the Mine panel under the drop table, three lines, 44 pt rows (Melvor's mobile skill page = recipe card + progress bar + one action; IPM = one row per smelter with bar icon, progress and time [12][13]):
  ```
  🔥 Furnace · 3 queued · next bar 0:42 ▮▮▮▯
  2 🟤 ore + 1 ⚫ coal → 1 🟧 bar · 60 s · ore 7 · coal 4
  [Smelt +1] [Smelt max]        [Collect 2 bars]
  ```
  Disabled reasons from the core's own errors ("— Not enough ore", "— Queue full"). Furnace upgrades (not batch 7): queue +5 (stone + cash), bar time −25 % (bars) — each owns one axis per the round-4 ownership map.

## 6. Verdict

| Draft point | Verdict |
|---|---|
| 1 metal ladder copper → iron → gold, batch 7 copper only | **Keep.** Fix the durability rule before iron (§3). |
| 2 furnace 30 stone + 200 unlocks vein Lv2 | **Change price → 20 stone + 5 coal + 150** (fits cap 30 right after vein Lv1); keep "building it unlocks vein Lv2". Vein Lv2 = 30 stone + 10 coal + 200, needs storage Lv2. |
| 3 5 ore + 1 fuel → 1 bar, 30 s | **Change → 2 ore + 1 fuel, 60 s.** Draft furnace would be idle 85–95 % of the time. |
| 4 offline queue, ore ≤ 1 | **Keep;** queue cap 5, inputs paid on enqueue, output tray, closed-form catch-up, no auto-repeat yet. Ore sells 1, bars unsellable. |
| 5 copper pickaxe 200 / 1-hit / bar repair; 7.1 farm tools | **Keep:** 5 bars + 50 cash, 3 hits/action, repair 2 bars, mastery ×2 thresholds. 7.1 tools 4 bars + cash each (×2 moisture, 10 % double harvest, 20 % seed keep). |

**Batch 7 (≤ 5 tasks)**
1. Core items + furnace: `ItemId` gains `copperOre`, `copperBar` (sell 1 / none); `run.furnace` state, `buildFurnace`, `smelt(n)`, `collectBars` with typed errors; `step` furnace catch-up (closed form); save v6 + migration + v5 fixture. All numbers in `balance.ts` (`FURNACE_COST`, `SMELT_RECIPE`, `BAR_TICKS 60`, `FURNACE_QUEUE_CAP 5`, fuel table coal 1 / wood 2).
2. Vein Lv2 (requires `furnace.built`): 65/20/15, copper rock 3 hits, price 30 stone + 10 coal + 200; storage-fit test uses the sum of items.
3. Copper pickaxe tier: `PICKAXE_TIERS` += copper; recipe 5 bars + 50 cash, repair 2 bars, durability 200, hits 3; mastery per tier as in batch 6; tier-rule test (wood Lv10 125 < 200).
4. UI: Shop row "🔥 Furnace"; Mine panel furnace card (above); copper pickaxe craft/repair rows; drop-table preview shows cash-per-node for Lv1 → Lv2; banner "N bars ready".
5. Sim: pins unchanged; cash/energy for wood and copper on Lv1/Lv2 (repair included) < 0.9 × pumpkin and reported; stone-keeping bot reports ticks for furnace, storage Lv2, vein Lv2, first bar, copper pickaxe (expect ≤ ~3300 at its 4/min rate); catch-up determinism (1-tick vs one call; 8 h with queue 5 → 5 bars, progress 0); no smelt-to-sell loop. Write "Batch 7 results".

**Batch 7.1 (≤ 5 tasks)**
1. `run.toolTier: Partial<Record<ToolJob, 'copper'>>`, recipes 4 bars + 100/120/120 cash in the Shop next to the tool levels; effect numbers in `balance.ts`.
2. Effects: water fills `MOISTURE_FULL_TICKS × 2`; harvest rolls +1 crop at 10 % (seeded RNG); plant keeps the seed at 20 %.
3. Tool cards show tier + effect line + "next: …" (progression.md §5 layout).
4. Sim: farming cash/energy per crop with the copper set (expect carrot ≈ 2.14 → ~2.8 with 1 watering); hierarchy still holds; copper set affordable within ~30–60 min after the pickaxe at 6 mines/min.
5. Info tips (batch 6.2 component) for furnace, vein Lv2, copper tools.

**Open questions for the designer**
1. Tier durability rule vs mastery cap: iron 1200 / gold 6000, copper 100, or restate the rule?
2. Furnace price with coal (20 + 5 coal) or stone-only (25)?
3. Furnace before ore (draft) or Stardew's ore-then-furnace hook?
4. Should "Smelt max" exist in batch 7, and should wood fuel be opt-in or automatic?
5. When the mine worker lands (batch 8): auto-smelt toggle, and does the worker's ore go straight to the furnace?

## Sources

1. Stardew Valley wiki — Furnace (25 stone + 20 copper ore; 5 ore + 1 coal; times per tier; output held; blueprint after first copper ore): https://stardewvalleywiki.com/Furnace
2. Stardew Valley wiki — Heavy Furnace (25 ore + 3 coal → 5–6 bars; 9 % ore / 45 % coal saved): https://stardewvalleywiki.com/Heavy_Furnace
3. Stardew Valley wiki — Copper Ore (sells 5 g; bar 60 g; 5 ore + 1 coal, 30 min): https://stardewvalleywiki.com/Copper_Ore
4. Melvor Idle wiki — Smithing (bar recipes, 2 s base, mastery preserve/double steps): https://wiki.melvoridle.com/w/Smithing
5. Melvor Idle wiki — Offline Progression (computed on return, 24 h cap): https://wiki.melvoridle.com/w/Offline_Progression ; Coal Ore (sells 13, Mining Lv30): https://wiki.melvoridle.com/w/Coal_Ore ; Firemaking (40 % coal per log): https://wiki.melvoridle.com/w/Firemaking
6. Stardew Valley wiki — Day Cycle (10 game-min = 7 s real): https://stardewvalleywiki.com/Day_Cycle
7. Forager wiki — Furnace (coal = 2 wood; iron/gold ingot = 2 ore + 1 coal): https://forager.fandom.com/wiki/Furnace
8. PwrDown — Forager: How to build the Furnace (10 stone): https://www.pwrdown.com/gaming/forager-how-to-build-the-furnace/
9. Factorio wiki — Stone furnace (5 stone, 90 kW, speed 1, iron 0.3125/s): https://wiki.factorio.com/Stone_furnace
10. Factorio wiki — Fuel (wood 2 MJ, coal 4 MJ): https://wiki.factorio.com/Fuel
11. Minecraft wiki — Smelting (10 s per item; coal 8, planks 1.5, stick 0.5, lava 100): https://minecraft.wiki/w/Smelting
12. Idle Planet Miner wiki — Alloys (1,000 ore → 1 bar, 20–80 s, smelter repeats until retargeted): https://idle-planet-miner.fandom.com/wiki/Alloys
13. Idle Planet Miner early-game guide (smelter runs automatically while ore lasts, no quantity field): https://note.com/shiori_vtw/n/n9f53fb817830
14. Stardew Valley wiki — Pickaxes (5 bars + gold per tier; hits per node): https://stardewvalleywiki.com/Pickaxes
15. Minecraft wiki — Durability (tier lifetimes 59 / 131 / 250 / 1561): https://minecraft.wiki/w/Durability
16. Stardew Valley wiki — Charcoal Kiln (10 wood → 1 coal, 30 min): https://stardewvalleywiki.com/Charcoal_Kiln
17. Stardew Valley wiki — Coal (sells 15 g; Clint 150 g): https://stardewvalleywiki.com/Coal
