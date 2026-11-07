# Round 3 research — workers (hiring, jobs, certificates, wages)

Research only; nothing in the repo was changed. Claims marked **(inference)** are mine, not sourced. Economy numbers are the post-batch-5 ones from the brief (carrot ≈ 2.7 cash/energy, pumpkin ≈ 8.3, mining 1.0–2.3, regen 20 energy/min).

## Summary (verdict per part of Toon's proposal)

1. **Workers do any manual job — KEEP, but not every job.** Water, harvest, plant and mine are worth automating; **till** has nothing to do (24 tiles, tilled once) and **dig for seeds** is worth 0.4 cash/action, below any wage — fold till into plant, leave dig manual (it is the anti-soft-lock floor; a broke player cannot pay a digger anyway).
2. **One-off certificate per job, cash + job resource — KEEP.** Genre-standard (AdCap manager per business, IMT manager per shaft, Factorio research per automation tier). Recommended: water 100 cash → harvest 150 + 20 stone → plant 150 + 20 carrot seeds → mine 200 + 30 stone + 10 coal, each hidden behind a counter of the manual action it replaces.
3. **Pool that grows 1 / 2 / 4 / 8 — CHANGE to +1 per hire, price × 1.7.** Doubling gives only 3–4 decisions before the 8-worker cap this farm can use, and the 4→8 step quadruples the payroll in one click. Closest precedent (Kittens Game hut: +2 kittens, price ratio 2.5) is additive, not doubling. Recommended: hire n costs 80 × 1.7^(n−1) → 80, 136, 231, 393, 668, 1136, 1931, 3283; cap 8 (6 in the first batch).
4. **Wage when they work — KEEP, as cash per action, deducted at the moment of the action; if cash < wage the worker waits.** This is the only model that can never push cash negative and that behaves during the 8 h offline catch-up. Recommended: 1 cash per action, flat. Worker speed 1 action / 5 s (12/min), their own clock, no player energy.
5. **Timing — CHANGE the scope, not the idea.** DECISIONS says automation comes after the forge. Compromise: a first worker batch with **water + harvest** only (the two chores players already complain about), plant and mine certificates later with furnace/forge outputs in their price, so the ladder manual → tooling → automation survives.
6. **Recommended first batch (≤ 5 tasks):** core workers module (pool, certificates, assignment) · worker tick in `step` with per-action wage · water + harvest jobs · Kittens-style assignment rows + HUD payroll + away-banner wages · sim assertions (never negative, auto farm ≥ 80 % of manual on pumpkin, offline 8 h ends with more cash, unpaid workers idle instead of borrowing).

## 1. Hiring progression / pool growth

How the reference games grow and price helpers:

| Game | Unit | Growth of count | Price of next | Source |
|---|---|---|---|---|
| Cookie Clicker | buildings (Cursor, Grandma…) | +1 per buy, unlimited | × 1.15 per owned | [5] |
| AdVenture Capitalist | business units | +1 per buy | × 1.07 (Lemonade) … × 1.15 (Newspaper), falling 0.01 per tier to 1.07 (Oil) | [4][6] |
| Kittens Game | kittens (workers) | +2 per Hut; kittens then *arrive* at 0.05/s while housing is free | Hut 5 wood, price ratio **2.5** per hut; later housing 1.15 | [12][13] |
| Idle Miner Tycoon | workers per shaft | +1 at shaft level 10 / 50 / 100 / 200 / 400, max 6 — free, tied to leveling the shaft | shaft level cost | [2] |
| Stardew Valley | Junimo Hut (3 Junimos) | +3 per hut, no cap | flat 20,000 g + 200 stone + 9 starfruit + 100 fiber, gated by the Wizard quest | [8] |
| Farm Together | Farmhand | +1 per placement, level-gated (lvl 20) | flat 15 medals + 350 XP, then **2 tickets per hour of contract** | [15] |
| Harvest Moon BTN | Harvest Sprites | fixed pool of 7, hire 1 / 3 / 7 days each | no cash; ≥ 2 hearts affection, −2 affection per day worked | [14] |
| Forager | Droids | +1 per craft, no cap | materials, "cost increasing for each additional droid" | [18] |
| Oxygen Not Included | Duplicants | +1 every 3 cycles (choose 1 of 3), no purchase | free, limited by food/oxygen | [21] |
| Rusty's Retirement | bots per job type | +1 per build | biofuel + spare parts, each next bot of a type costs more (water bot 4/8/15/25/38… biofuel) | [17] |

Pecorella's rule for the genre: cost = base × r^owned against linear production; price doubles every ln 2 / ln r purchases (≈ 5 buys at r 1.15, 10 at 1.07), waits shrink until n ≈ 1/(r−1) then grow by ~r each buy [6][7]. Those low r values exist because those games sell hundreds of units; tiles will sell at most ~8 workers, so the curve must be much steeper to make each hire a decision **(inference)**. The repo already uses 1.5–1.7 for tiles and upgrades, so a 1.7 hire curve reads as the same shop.

**Milestone slots vs bought slots.** IMT's free worker at level 10/50/100/200/400 is a reward for leveling (a roughly doubling ladder — the one real precedent for Toon's 1/2/4/8, and it is *free*, max 6). Kittens Game's housing is bought and additive. Prestige-gated (AdCap angels, Egg Inc epic research) is out of scope while prestige is undecided.

**Recommendation: linear +1 hire, cost 80 × 1.7^(n−1), hire button hidden until `counters.harvests ≥ 30`, cap 6 in batch 6 (8 later).**

| Hire | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| cost | 80 | 136 | 231 | 393 | 668 | 1136 | 1931 | 3283 |
| minutes of net income, 9 pumpkin tiles (≈ 112/min) | 0.7 | 1.2 | 2.1 | 3.5 | 5.9 | 10 | 17 | 29 |
| minutes, 24 pumpkin tiles (≈ 300/min) | 0.3 | 0.5 | 0.8 | 1.3 | 2.2 | 3.8 | 6.4 | 11 |

Feel: hires 1–3 arrive a few minutes apart and compete with the pumpkin license (100), vein Lv1 (100 + 40 stone) and tiles 10–12 (100 / 150 / 225); hires 5–8 are 6–30 min goals, the same band as tiles 14–18 (506–2563). Total pool cost 7,858 ≈ tiles 10–17 combined. The farm needs ~3 workers at 9 tiles and ~6 at 24 (see §2), so the last two hires are deliberately luxury. If playtest says hires come too fast, raise r to 2.0, not the base **(inference)**. Keep Toon's step idea in reserve as *housing* (a bunkhouse building = +2 slots, Kittens-style) for a later batch.

## 2. What workers actually do

Three models in the references:

- **Remove the click entirely (manager).** AdCap managers "automatically start a profit cycle after one ends, even if the player is disconnected" — one per business, bought once [3]. IMT managers per shaft/elevator/warehouse, purchasable once the first shaft reaches level 5, "beforehand you need to manually manage your workers" [1]. Melvor has no workers at all: every skill repeats itself once started [22]. These are *rate* games; the manager converts a tap loop into a per-second rate.
- **Autonomous agent with its own throughput (what Toon describes).** Junimos: 3 per hut, harvest one crop at a time inside a 17×17 square, from morning to 7:10 pm, not in rain or winter [8]. Farmhand: works a 13×13 area for the contract hour [15]. Harvest Sprites: one job per request (harvest / water / animals), speed rises with a per-job skill 0–255 [14]. Forager droids act "about once every 3 seconds" [18]. Rusty's bots: fixed priority lists (water bot: recharge → refill at well → water in planting order), 16 s recharge after 3–6 actions [16][17]. Kittens: each kitten in a job adds a flat rate (woodcutter +0.0018 wood/tick, farmer +1 catnip/tick) [11].
- **Multiplier on the player.** Forager droid attached to a building: +50 % production [18]; IMT managers' timed boosts [1].

**Whose energy?** Nobody uses the player's stamina. Junimos, Farmhands, droids and bots run on their own clock; Kittens eat catnip (0.85/tick per kitten, 4.25/s) and *die* if it runs out [9][10]; Slime Rancher drones need water refills, which players call a pointless chore [24]; Harvest Sprites burn affection (−2/day worked). **(inference)** A worker that spends the player's energy is just an auto-clicker competing with the player for the same 20 energy/min — it adds nothing. Workers must have their own throughput; the cost side is the wage.

**Speed for tiles.** Player ceiling = 20 actions/min. Demand per job (actions/min): carrot ×9: water 10.8, harvest 5.4, plant 5.4; pumpkin ×9: water 9, harvest 2.2, plant 2.2; pumpkin ×24: water 24, harvest 6, plant 6. At **1 action per 5 s (12/min)** one waterer exactly covers 9 tiles, a 24-tile pumpkin farm needs 2 waterers + 1 harvester + 1 planter, and the "slow substitute" rule from DECISIONS holds (a worker is 60 % of a player). Harvester/planter are idle most of the time, which is fine under per-action wages. Worker acts only on a tile that needs it (dry / mature / tilled-empty), picks the driest / longest-ripe first, and never undoes a player tap **(inference)**.

**Assignment UI.** Kittens Game's Outpost tab is the model: one row per job with the count and [−] [+] buttons, a "free kittens" line above, jobs appearing only once their prerequisite is researched [11]. Harvest Moon picks one job per sprite at hire time [14]; Rusty's places a bot of a type on the map [16]. For tiles: a "Workers" card with `free 1 / 3`, rows `💧 Water  [−] 1 [+]`, `🌾 Harvest [−] 0 [+]`, a locked row shows the certificate price instead of buttons, and the hire button with its price at the bottom. One job per worker.

## 3. Certificates / job unlocks

Precedents for a one-off unlock paid in materials: Factorio *Automation* = 10 automation science packs → assembling machine 1 [19]; Junimo Hut = cash + stone + crop + fiber, gated by a quest [8]; Forager droids need the Engineering skill then electronics per droid [18]; Rusty's bots cost biofuel (made from crops) + spare parts [17]; AdCap managers cost ~270× the business base price (Lemonade 1,000 vs 3.738), so the player has clicked that business many times before automating it [3][4]; IMT managers unlock at shaft level 5 [1].

Pattern: **the certificate price is paid in the output of the job being automated or the tier below it, and it unlocks only after the player has done the job by hand a few dozen times.** Recommended for tiles (cost multiplier applies to the cash part):

| Order | Job | Certificate | Visible after | Why |
|---|---|---|---|---|
| 1 | Water | 100 cash | 40 waters | Most repetitive chore (50–67 % of farm actions); cash-only like Toon's list |
| 2 | Harvest | 150 cash + 20 stone | 40 harvests | The offline-value job (no rot while away); gives hand-dug stone its first use (round-2 suggestion) |
| 3 | Plant | 150 cash + 20 carrot seeds | 40 plants | Seeds are the job's input; the worker then plants from the pouch |
| 4 | Mine | 200 cash + 30 stone + 10 coal | vein Lv1 + 100 mines | Needs the vein so coal exists; last because mining is the player's energy sink |
| — | Till | drop | — | Planter tills an untilled tile first |
| — | Dig for seeds | drop | — | 0.4 cash/action; below any wage; it is the floor, keep it manual |

Affordability at the economy above: water ~2.5 min of carrot income (after the pumpkin license, ~tick 400–500); harvest once vein-level stone exists (~15 min); plant ~1 min later; mine after vein Lv1 (~25–30 min). If the forge lands first, re-price plant and mine with ingots instead of stone/coal **(inference)**.

## 4. Wages

| Model | Games | Unpaid behaviour | Offline |
|---|---|---|---|
| Per action / per unit of work | Farm Together: 2 tickets per contract hour, holds 4 h [15] | contract runs out, farmhand idles | work stops after stored hours — a natural cap |
| Per second upkeep | Kittens: 4.25 catnip/s per kitten [10] | kittens starve and die | runs while away; catnip-negative is the classic Kittens death spiral |
| Per period salary | Game Dev Tycoon: salary ≈ skill × 10,000 per month [23]; bankruptcy after a bailout | game over | n/a (not idle) |
| No wage, upkeep chore | Slime Rancher drones need water [24]; Rusty's bots recharge 16 s [17] | drone stops | runs |
| No wage at all | Junimos, droids, AdCap/IMT managers, Melvor | — | runs (Egg Inc caps away-time per silo, 1 h each, more via research [20]) |

**(inference)** Per-second wages are the wrong fit for a real-time game with 8 h catch-up: a harvester idling over a 240 s pumpkin would still bill, and an away player bleeds cash exactly like the loan interest the round-2 research told you to remove. Per action = "wage when they work", Toon's own wording, and it is self-limiting: no work, no cost.

**Rule set.** Wage `WORKER_WAGE = 1` per action, charged inside the action; the worker skips the action when `cash < wage` (planter: `cash < wage + seed cost` if auto-buy must trigger). No debt, no auto-loan, no quitting; the row shows an "unpaid" badge. Offline catch-up runs workers like everything else, so a watered-harvested-replanted farm pays for itself; the away banner lists "wages paid N". Cash can never go negative because every debit is gated by a balance check — the sim must assert this with cash 0 and all workers assigned.

**Arithmetic (net cash/min, 9 tiles, 1 action / 5 s, wage 1):**

| Farm | manual | fully worked (water + harvest + plant) | wages/min | share |
|---|---|---|---|---|
| carrot ×9 (4 actions/cycle) | 43.2 | 21.6 | 21.6 | 50 % |
| pumpkin ×9 (6 actions/cycle) | 112.5 | 99.0 | 13.5 | 88 % |
| pumpkin ×24 | 300 | 264 | 36 | 88 % |

At wage 2 carrot automation nets 0 and pumpkin 76 %; at 0.5 the first hire stops being a decision. Wage 1 keeps the hierarchy: a worker action (1) < hand mining (1.0) ≤ pickaxe (1.5–2.3) < carrot (2.7) < pumpkin (8.3), so the wage is always less than what the freed energy earns, and carrot automation being marginal nudges the player to pumpkins. Mining worker (hand, 2 hits/stone): 2 actions → 1 stone (sells 2) − 2 wage = 0 cash, i.e. it buys stone at sell price — no money loop, pure material pipeline; with vein Lv1 the drop is worth 2.4 → +0.2/action. Certificate payback: water (100) = 18 energy freed per carrot cycle × ≥1.0 = ~5 cycles (8 min) at worst; harvest (150 + 20 stone) pays back in one 8 h offline session that would otherwise rot.

## 5. Risks

- **Reverse of the round-1 problem.** Round 1 was "nothing to do while crops grow"; mining fixed it. Workers remove 60–100 % of farm taps, so the player's 20 energy/min flows to mining — the activity designed as a filler. Every reference gates automation behind volume of manual repetition (AdCap 270× price, IMT shaft level 5, Junimo quest + 20k g, Farmhand level 20). The counter gates in §3 do that. Keep the per-energy hierarchy (mining < farming) and give energy new sinks in the same batch window (tiles 10–24, vein, pickaxe mastery), otherwise energy upgrades lose their meaning **(inference)**.
- **Does energy still matter?** Yes if workers are slow (12/min vs 20/min) and only act on needy tiles: the player still tops up, still mines, still digs when broke, and a 24-tile pumpkin farm needs 4–5 workers or player help. Energy upgrades turn from "farm faster" into "mine faster / cover what workers miss". If playtest shows energy is dead, lower worker speed to 1 / 8 s before touching wages.
- **Early automation vs the DECISIONS ladder.** Automating water + harvest before the forge is acceptable because those two are chores, not progression; plant and mine certificates priced in forge outputs keep "manual → tooling → automation" for the rest.
- **Order.** First: water (highest frequency, lowest value per tap). Then harvest (offline value). Then plant (closes the idle loop; needs the seed pouch from batch 5). Last: mine (it is the active game). Never: dig for seeds.
- **Soft-lock check.** Worst state: cash 0, seeds 0, all workers assigned. Workers idle (gated debit), the player hand-digs for seeds or hand-mines exactly as in batch 5 — the floor is untouched. Workers must never auto-buy seeds below `wage + seed`, and never trigger the loan.
- **Save/offline.** Worker cooldowns live in run state (deterministic, no `Date.now`); catch-up of 8 h × up to 6 workers = ≤ 35k worker actions, trivial for `step`.

## 6. Verdict and batch scope

| Part | Verdict |
|---|---|
| Workers for every manual job | Keep for water / harvest / plant / mine; drop till (fold into plant) and dig |
| Certificate per job, cash + resources | Keep; prices and counter gates in §3 |
| Pool 1 / 2 / 4 / 8 | Change: +1 per hire, 80 × 1.7^(n−1), cap 6 → 8; hire visible after 30 harvests |
| Wage when they work | Keep: 1 cash per action, debit gated by balance, worker idles when unpaid |
| Open question (step scaling) | Answered: geometric per-hire price; doubling steps only as optional housing later |

**Batch 6 — workers v1 (≤ 5 tasks)**
1. Core `src/core/workers.ts`: `run.workers = { pool, assigned: Record<JobId, number>, certificates: JobId[], cooldown }`; `hireWorker()`, `buyCertificate(job)`, `assignWorker(job, ±1)` with typed errors (`NO_CERTIFICATE`, `POOL_FULL`, `NO_FREE_WORKER`, `LOCKED`, `NOT_ENOUGH_*`). All numbers in `balance.ts` (`WORKER_HIRE_BASE 80`, growth 1.7, cap 6, `WORKER_ACTION_TICKS 5`, `WORKER_WAGE 1`, certificate table, unlock counters). Save v5 + migration.
2. `step`: every `WORKER_ACTION_TICKS` each assigned worker performs its job's existing action on the best target if one exists and `cash ≥ wage`, charges the wage, bumps `counters.wagesPaid`; runs during offline catch-up.
3. Jobs: water and harvest only (plant/mine in a later batch with furnace/forge-priced certificates). Counters `waters`, `plants` added for the gates.
4. UI: Workers card (Upgrades tab or its own tab): free/total line, Kittens-style rows with [−]/[+], locked rows show the certificate price, hire button with price; HUD "👷 N" and current wage rate; away banner adds "wages paid 💰N".
5. Sim: bot buys certificates and hires when affordable, assigns water first. Assert: cash never negative (including cash 0 with all workers assigned); 9-tile pumpkin farm with 3 workers and zero player taps sustains itself and nets ≥ 80 % of the manual rate; an 8 h offline catch-up with workers ends with more cash than it started; the manual per-energy hierarchy from batch 5 is unchanged. Record "Batch 6 results".

## Sources

1. Idle Miner Tycoon wiki — Managers (unlock at shaft level 5, per-shaft automation, ranks): https://idleminertycoon.fandom.com/wiki/Managers
2. Idle Miner Tycoon wiki — Mineshafts (extra worker at level 10/50/100/200/400, max 6): https://idleminertycoon.fandom.com/wiki/Mineshafts
3. AdVenture Capitalist wiki — Managers (automate a business, cost per business, Lemonade 1,000): https://adventure-capitalist.fandom.com/wiki/Managers
4. AdVenture Capitalist wiki — Coefficient (base costs and 1.07–1.15 growth per business): https://adventure-capitalist.fandom.com/wiki/Coefficient
5. Cookie Clicker wiki — Buildings (price +15 % per purchase): https://cookieclicker.wiki.gg/wiki/Buildings
6. Frame Advance — Exponential cost scaling (b·r^n, doubling every ln2/ln r, wait curve): https://frameadvance.net/mechanics/exponential-cost-scaling/
7. Anthony Pecorella — Quest for Progress, GDC Europe 2016 (slides): https://www.slideshare.net/slideshow/quest-for-progress-gdc-europe-2016/65405507
8. Stardew Valley wiki — Junimo Hut (cost, 3 Junimos, 17×17, no rain/winter, Wizard gate): https://stardewvalleywiki.com/Junimo_Hut
9. Kittens Game wiki — Kittens (jobs, 0.85 catnip/tick, starvation): https://wiki.kittensgame.com/en/general-information/resources/kittens
10. Kittens Game wiki — Catnip (4.25/s per kitten, starve to death): https://wiki.kittensgame.com/en/general-information/resources/catnip
11. Kittens Game wiki — Outpost / Jobs (per-job rates, prerequisites): https://wiki.kittensgame.com/en/game-tabs/outpost
12. Kittens Game wiki — Bonfire (Hut: 5 wood, price ratio 2.5, +2 kittens): https://wiki.kittensgame.com/en/game-tabs/bonfire
13. Kittens Game wiki — Math hacks (kitten arrival 0.01/tick × 5 ticks/s): https://wiki.kittensgame.com/en/guides-and-advice-and-stuff/math-hacks
14. Harvest Moon wiki — Harvest Sprites (BTN) (7 sprites, one job each, 1/3/7 days, affection cost, per-job skill): https://harvestmoon.fandom.com/wiki/Harvest_Sprites_(BTN)
15. Farm Together wiki — Farmhand (15 medals, 2 tickets/hour, 4 h stored, 13×13, level 20): https://farmtogether.fandom.com/wiki/Farmhand
16. Rusty's Retirement wiki — Gameplay Mechanics (bot priority lists): https://rustys-retirement.fandom.com/wiki/Gameplay_Mechanics
17. gameplay.tips — Rusty's Retirement bots guide (16 s recharge, cycles per charge, rising bot costs): https://gameplay.tips/guides/rustys-retirement-bots-guide-harvest-biofuel-berry-feeder-and-others.html
18. Forager wiki — Companions (droids: Engineering skill, electronics, rising cost, ~1 action/3 s, +50 % attached): https://forager.fandom.com/wiki/Companions
19. Factorio wiki — Automation (research) (10 automation science packs → assembling machine): https://wiki.factorio.com/Automation_(research)
20. Egg, Inc. wiki — Grain Silos (1 h offline per silo, research to 3 h): https://egg-inc.fandom.com/wiki/Grain_Silos
21. Oxygen Not Included wiki — Printing Pod (one new Duplicant choice every 3 cycles): https://oxygennotincluded.wiki.gg/wiki/Printing_Pod
22. Melvor Idle wiki — Mining (skills run themselves; no worker layer): https://wiki.melvoridle.com/w/Mining
23. Game Dev Tycoon wiki — Staff (salary formula, hiring cost): https://gamedevtycoon.fandom.com/wiki/Staff
24. Steam discussion — "Why do drones need water to run?" (Slime Rancher upkeep chore complaint): https://steamcommunity.com/app/433340/discussions/0/3342162929521759527/
