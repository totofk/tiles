# tiles — economy calculator report, batch 34+ prep (frozen copy 9130c07)

Labels: **[C]** computed from the real balance functions (file:line given), **[S]** sim on the real core (`step` + actions, 36 h × 3 seeds), **[E]** estimate. "Stage" always means sellPrice 5 and fertilizer 5.

Two reproductions passed before anything else was computed:
- PIN29model fields table, exact at its own assumptions [C, manager.ts:45–76, fields.ts:211]: 413,254 / 763,747 / 1,236,247 / 2,417,497 (base) and 779,526 / 2,587,026 / 4,394,526 / 8,913,276 (sell 5 / fert 5).
- The research's 5.1 and 9.6 cash/⚡ copper figures [C].

## 1. Summary

1. **The 12 ⭐/h ceiling is false.** Option A caps each good at 12 ⭐/h, but goods fill in parallel. Sim: 18.6 ⭐/h at 4 slots, vein Lv2.
2. **Option A does stop the contract leak**: contract ⭐ fall ×5.4 (12.6 → 2.3 ⭐/h at 20 fields, 4 slots). After the Tractor nearly all ⭐ comes from the miner's item and bar orders.
3. **Bag size drives ⭐/h more than stage or slots**: at 20 fields, bag 60 → 1.1 ⭐/h, bag 80 → 5–6, bag 100 → 11 [S, partly my bot's policy].
4. **Star dust at 1 % breaks its own claim**: 2.4 ⭐/h only at regen Lv0; 8.4 ⭐/h at Lv10, more than the board pays. Change to 0.3 %.
5. **Shards at 2 % finish the 30-shard set in 0.4–1.25 h** of all-in digging. Change to 0.5 %.
6. **Copper: 🥉100 does open the window** (9.6 cash/⚡ vs pumpkin's 7.52). 🥉60 gives 6.6, just under the 0.9 × 7.52 cap. 🥈500 and 🥇1000 can stay.
7. **Bars only matter before Fields**: one miner is 38–46 % of farm income at vein Lv3–4, 3.5 % at 2 fields, 0.35 % at the estate.
8. **Furnace ladder**: with one miner, everything past batch 4 or speed Lv1 is worthless (+0.1 %). Two miners bind at ×2.6 capacity; the hardest clicker at ×7.7.
9. **Fine mist cannot continue the −10 %-of-base line**: Lv4 would be +400 % and Lv5 zero grow time. Use ×0.95 per level (+5.3 % each).
10. **Bunkhouse is worth ≤ 0.4 % at the estate on its own.** It only pays once Fine mist outruns labour (19,800 tiles/h at pool 6).
11. **No soil trait and no ±20 % listing flips mono strawberry.** The first flip needs ±40–50 % grow time.
12. **Most traits are worth 0 at the estate**: easy-sell, dense soil, creek-side, roots and fruit-veg price. Only berry price (+21.9 % per field) and fertile (+11.1 %) pay.
13. **Listings are not a trade**: berry-fast is +25 %, berry-slow −17 %, the other pairs 0.
14. **Two district rules are not trades**: Mining district is a pure buff, Short of hands is ≈ 0 on both sides. Co-op is real (−10.9 % cash for +50 % ⭐).
15. **Relics**: glut recovery, overflow reserve and stone fuel are ≈ 0 at the estate; none is too strong.

## 2. ⭐/h table (yardstick)

Option A was scored as 0.2 × count ÷ the board's own per-minute rate for that good [C, orders.ts:58–74]. Under that reading only contracts (×0.15) and bag-clamped item orders change. Active = board checked every 2 min; semi-idle = every 15 min.

### Scenario A — fresh player

| Stage (setup) | 💰/h [S] | ⭐/h today [S] | ⭐/h option A, active [S] | semi-idle [S] | ⚡/h [C] | dust all-in at 1 % [C] |
|---|---|---|---|---|---|---|
| A1 early: 9 pumpkin by hand, vein Lv1 | 15.0k | 15.3 | 9.1 | – | 1,800 | 3.6 |
| A1 hand-heavy (more ⚡) | 16.2k | 15.8 | 9.6 | – | 2,700 | 5.4 |
| A1 stingy (digs seeds, no seed buying) | 3.9k | 3.6 | 3.7 | – | 2,100 | 1,213 digs/h → 2.4 |
| A2 vein Lv2: 12 lemon, copper tools | 55.3k | 15.1 | 12.0 | – | 2,400 | 4.8 |
| A2 hand-heavy, 2 slots / 4 slots | 59.0k / 60.6k | 14.8 / 23.0 | 11.7 / **18.6** | – | 3,600 | 7.2 |
| A2b vein Lv3: 15 corn + 1 miner | 87.8k | 10.4 | 9.1 | – | – | – |
| A3 vein Lv4 before Fields: 18 grape, 2 / 3 / 4 slots | 160k | 6.9 / 9.1 / 9.6 | 6.3 / 8.6 / 9.2 | 1.0–1.5 | 2,700 | 5.4 |
| A3 with bag 40 / bag 80 | 160k | 1.1 / 9.4 | 1.0 / 9.0 | – | – | – |
| A4 Fields, 2 fields, bag 60 / bag 80 | 2.17M | 1.8 / 9.7 | 1.6 / 8.8 | 0.8 | 2,700 | 5.4 |
| A5 Manager, 6 fields, bag 70 / bag 80 | 6.1M | 1.5 / 5.7 | 1.3 / 5.1 | 0.9 | 2,700 | 5.4 |
| A5, every contract accepted | 5.87M | 5.9 | 2.75 | 0.9 | – | – |
| A6 estate 20 fields, bag 80, 2 / 3 / 4 slots | 21.7–22.0M | 6.4 / 6.0 / 7.2 | 5.8 / 5.3 / 6.3 | 2.7 (1.0 hourly) | 2,700 | 5.4 |
| A6, bag 60 / bag 100 (4 slots) | 21.6M / 22.3M | 1.4 / 12.2 | 1.1 / 11.1 | – | – | – |
| A6, every contract, 4 slots | 15.9M | 19.9 | 9.5 (contracts 2.3) | 2.5 | – | – |

- Hand-heavy rows at vein Lv3+ and the A3s (24 strawberry, 2 miners) row are left out: my bot's bag handling collapses under heavy mining (0.2–1 ⭐/h), which is an artefact.
- Chasing every crop order by replanting the lot gives 10.6–13.7 ⭐/h at A3 but costs 33–47 % of cash [S].
- Accepting every contract at the estate costs 4–28 % of cash through field flips [S].
- The "≈ 80 ⭐/h/slot" leak is a theoretical bound. The most contract ⭐ I measured under today's rule is 17.4 ⭐/h across 4 slots; under option A that run pays 3.1.
- Clamped item orders: at A1 (bag 30) item ⭐ drop 10.0 → 3.9; at A6 3.3 → 3.0 [S].

### Scenario B — veteran

What the migrated `save-v22.json` owns:
- **Land**: 24 home tiles (lemon), 4 sprinkler beds, 8 fields of which 3 have pivots.
- **Machines**: Pump 2 (cap 12 wet fields), Harvester Mk1 + Mk2, Seeder Mk1.
- **Workers**: 6 (plant 1, water 1, harvest 2, ore 1, fuel 1). No miner assigned, no Clerk or Manager certificate.
- **Mine**: vein Lv4, gold pickaxe, smart furnace at batch 3, bag 60.
- **Other**: 3 order slots, 4 licenses, sell 3 / fert 3, ⚡ regen Lv4 (2,400/h), renown lemon 2,413 and pumpkin 300, 0 deeds.

I overrode cash to 15M and ⭐ to 37, and for the "B" rows added every license, sell 5 / fert 5, the Manager, a miner, and strawberry at the top renown floor (0.7).

| B variant | 💰/h [S] | ⭐/h today | ⭐/h option A |
|---|---|---|---|
| Fixture as migrated (only cash and ⭐ overridden) | 285k | 5.6 | 1.6 |
| 8 wet fields, strawberry, Manager, bag 60 | 8.43M | 0.7–2.1 | 0.56–0.61 |
| 20 fields, Pump 3, all machines, bag 60, 3–4 slots | 21.6M | 0.9–5.3 | 0.7–1.8 |
| Same with bag 80, 3 / 4 slots | 21.9–22.0M | 7.8 / 5.9 | 7.1 / 5.1 (semi-idle 3.0) |

Dust all-in at B: 2,400 digs/h → 4.8 ⭐/h at 1 %, 1.4 at 0.3 %.

**Yardstick used below**: Y ≈ 9 ⭐/h before the Tractor (active), ≈ 5 ⭐/h at the estate (active, bag ≥ 80), ≈ 1.5–3 ⭐/h semi-idle.

**Change →** drop the "12 ⭐/h whatever the slots" claim; keep option A.

## 3. Bar sell prices (item 2)

Per rock at vein Lv2 [C, balance.ts:856, 718]: 0.65 stone × 2 + 0.2 coal × 4 + 0.075 bars × price = **2.1 + 0.075 × price** at sell 0.
- 🥉40 → 5.1 and 🥉100 → 9.6, so both research numbers are right. The "expected 3.84" forgets the constant 2.1.
- Net of coal burnt at batch 1 and copper-pick repair: 4.4 and 8.3.
- The 0.9 × 7.52 = 6.77 cap is reached at 🥉62 (naive) or 🥉76 (net). **🥉60 → 6.6 naive, 5.7 net.**

Furnace output [C, balance.ts:747, 782], bars/h at batch 1 / 2 / 3: copper 60 / 120 / 180, iron 30 / 60 / 90, gold 20 / 40 / 60. At batch 3 and sell 5 that is 💰16.2k (🥉60), 67.5k (🥈500) or 90k (🥇1000) per hour.

### A — one miner (720 actions/h) against the farm at the same stage

| Stage | Farm net 💰/h [S] | Bars/h Cu / Fe / Au [C] | 🥉2 🥈3 🥇5 | 100/500/1000 | 40/500/1000 | 60/500/1000 | 50/250/500 |
|---|---|---|---|---|---|---|---|
| Vein Lv2 (hand only, batch 1) | 50.0k | 54 / – / – | 2.1k | 10.0k (20 %) | 5.2k | 6.8k (14 %) | 6.0k |
| Vein Lv3 (iron pick, batch 2) | 86.6k | 48 / 36 / – | 2.0k | 35.9k (41 %) | 31.6k | 33.0k (38 %) | 18.8k |
| Vein Lv4 before Fields (gold pick, batch 3) | 161k (336k at 24 strawberry) | 22 / 36 / 29 | 2.1k | 75.1k (47 %) | 73.1k | 73.8k (46 %, 22 %) | 38.4k |
| Fields, 2 fields | 2.17M | same | 2.1k | 75.1k (3.5 %) | – | 73.8k | – |
| Estate, 20 fields | 21.4M | same | 2.1k | 75.1k (0.35 %) | – | 73.8k | – |

Hand-heavy, 2,700 mining actions/h [C]:
- Vein Lv2, batch 3: 35.2k at 🥉100 (70 % of the farm) against 24.4k at 🥉60 (49 %).
- Vein Lv3, batch 3: 75.6k (87 % of the farm). This is the peak, set by 🥈500 and capped by the furnace at 90 iron bars/h.
- Vein Lv4: 98k (61 %).
- Two miners at vein Lv4: 93k, furnace-bound.

After the Tractor the miner's real job is coal for the pump: the sim without a miner drops from 2.17M to 1.52M at 2 fields because the tank runs dry [S].

### B
At 21.6M/h any bar price set is ≤ 0.4 % of income; bars matter to B only as recipe currency.

**Change → 🥉60. Keep 🥈500 and 🥇1000.** If the 87 % hand peak at vein Lv3 worries you, 🥈400 brings it to about 75 % [E].

## 4. ⭐ furnace ladders (item 3)

Vein Lv4, gold pickaxe, sell 5, prices 60/500/1000 [C]. Capacity is batch × speed relative to batch 3; I assumed speed = cycle time ÷ 1.25 per level [E shape].

| Ore supply | Capacity needed | 💰/h at batch 3 | 💰/h once unbound | Binds until |
|---|---|---|---|---|
| 1 miner | ×1.12 | 73.8k | 75.7k | batch 4 or speed Lv1 |
| 2 miners | ×2.24 | 93.1k | 151.8k | batch 5 + speed Lv2 |
| 3 miners (needs pool 8) | ×3.36 | 96.3k | 227.8k | batch 5 + speed Lv4 |
| Hand 2,700 + 1 miner | ×5.3 | 100.2k | 361k | batch 5 + speed Lv6 |
| Hand 4,200 + 1 miner (the maximum) | ×7.65 | 105.0k | 519k | batch 5 + speed Lv8 |

- Rule of thumb: the furnace binds while capacity < 1.12 × (mining actions ÷ 720).
- Past that point a level adds +0.1 % (it only saves coal). Coal never binds: 144 mined per miner against at most 60 burnt per hour.
- Risk: before Fields a clicker with batch 5 + speed Lv8 makes 519k, which is 3.2× the A3 farm. The ⭐ prices must keep that out of reach in the 1.6–8.7 h window.
- At A6 and B the whole ladder is worth ≤ 0.7 % (2 miners) to 2.4 % (clicker) of income.

**Change → batch cap 5** (batch 4 ⭐15, batch 5 ⭐30). **Speed ⭐10 × 1.5 per level**: 10 / 15 / 22 / 34 / 51 / 76 / 114 / 171. Cumulative Lv2 = 25 ⭐ (about 3 h before Fields), Lv4 = 81, Lv8 = 493.

## 5. Favours catalogue (item 4)

| Favour | Effect at A | Effect at B (20 fields) | Recommendation |
|---|---|---|---|
| **Bunkhouse** (pool cap 6 today, balance.ts:196) | A3: a 2nd miner adds +19k/h (+12 %) at new bar prices [C] | 7th worker +0.15–0.27 %, 8th +0.36 % [S]; with Fine mist it unlocks the gain below | Cap at pool 10 (4 levels). ⭐15 × 1.6 → 15 / 24 / 38 / 61 |
| **Fine mist** | ×0.95 per level: +4.4 % home, +5.3 % at 2 fields [C] | +5.3 % per level ≈ +1.15M/h, compounding [C] | Change shape to ×0.95. ⭐8 × 1.35 (Lv10 = 119, cumulative 437) |
| **⭐ sell** (+0.1 per level on 1.5, balance.ts:697) | Lv1 +7.3 % at A3 [S 169.6k vs 158.1k] | Lv1 +7.2 % [S], Lv5 +36 %, Lv10 +73 % [C]; bars too | ⭐10 × 1.4 (Lv5 = 38, cumulative 109; Lv10 = 207, cumulative 698) |
| **Seam survey** (×2 chosen ore, ×0.5 others) | Vein Lv3 aim iron +23k/h (+68 % of the miner); vein Lv4 aim gold +17.7k (+24 %, +11 % of A3 income); 2 miners +1k (furnace-bound) [C] | +17.7k/h = +0.08 % | Keep ⭐12 (about 1.5 h) |
| **Stoker** (×1.5 at ×2 coal) | 1 miner +1.7k/h (a trap); 2 miners +33k/h (+21 % of A3); 3 or hand +43–45k [C] | ≤ 0.2 %; coal runs short with 1 miner (120 + 50 tank > 144) | Keep ⭐15 + 🥈6, but only show it when the furnace is busy |
| **Clerk** (⭐20 today, balance.ts:214) | Hourly checker: 0.6 → 2.9 ⭐/h [S]; pays back in about 9 h | – | Keep ⭐20 |
| **Manager** (⭐40 + 🥇4 + 💰1.5M, balance.ts:216) | Option A cuts post-Tractor ⭐ for a 15-min checker from 2.2 to 0.9 ⭐/h [S] | Owned | Change to ⭐25 |

- Fine mist as a linear continuation gives +25 % / +67 % / +150 % / +400 % and then zero grow time [C, balance.ts:702]. That is not viable.
- Labour limits Fine mist [C, balance.ts:393]. A6 at pool 6 handles 19,800 tiles/h; fert 5 needs 15,000.
  - Sim at ×0.8 grow time: +19.7 % at pool 6 against the model's +25 %.
  - Sim at ×0.6: pool 6 gets only +15 % (it chokes), pool 8 gets +63 %.
  - So Fine mist past about Lv5 (at ×0.95) needs the Bunkhouse. That pairing is the Bunkhouse's real value.
- A fairly active run earns roughly 60 ⭐ before the Tractor and 5 ⭐/h after, so about 200 ⭐ over 30 h [E]. The four ladders alone cost more than 1,500 ⭐ to Lv10, so the list is never bought out.

## 6. Soil survey (item 5)

### A — home beds (Lv1 ⭐10), one 6-tile bed [C, exact search over beds]

| Trait | A3 (18 grape) | A3s (24 strawberry) |
|---|---|---|
| Berry/tree +15 % price | +8.7k/h (+5.5 %) | +13.2k (+4.0 %) |
| Fertile −10 % grow | +5.2k (+3.3 %) | +7.6k (+2.3 %) |
| Rich soil +10 % double harvest | +4.8k (+3.0 %) | +6.8k (+2.1 %) |
| Roots +15 %, fruit-veg +15 % | 0 | 0 |
| Clay soil, loose soil | ≈ 0 with sprinklers and workers [E] | ≈ 0 |

- Four random beds are worth about +6.7 % of home income, or +11k/h at A3 [E], for ⭐10 (1.1–1.6 h).
- The home lot is 1.5 % of estate income, so Lv1 is worth 0.1 % after Fields and its rerolls are never worth buying.

### A6 and B — estate fields (Lv2 ⭐25), per trait field [C, DP with two field classes]

| Trait | Gain per field | Flips the plan? |
|---|---|---|
| Berry/tree +20 % price | +235k/h (+21.9 % of a 1,076k field); +185k at A4 | No |
| Fertile −10 % grow | +120k/h (+11.1 %) | No |
| Roots+grain +20 %, fruit-veg +20 % | 0 | No (a corn field earns about a third of a strawberry field) |
| Easy-sell (glut −30 %) | 0, because strawberry already sits on the floor | Only in the Manager's own model: 1 field → grape, +0.5 % |
| Dense soil (coal −30 %) | 💰4.5/h | – |
| Creek-side | 0 while the tank has coal; a dry field goes 536k → 699k | – |
| Contract field (×1.5 toward contracts) | ≈ +0.1 % [E]; under option A it lowers that contract's ⭐ | – |

- Lv3 (×1.5): berry +32.8 % per field, fertile +17.7 %. All 20 fields on berry is +33 % of the estate, about the same as ⭐ sell Lv5 (109 ⭐). Not too strong.
- B has the same numbers as A6 (same floor and plan).

**Keep** ⭐10 / ⭐25 / ⭐40 and the ×1.5. **Change →** replace the zero-value traits; six of eight estate rolls are blanks at a strawberry estate.

## 7. Sale-listing soil (item 6)

### A and B — estate [C]

| Fast / slow group | 2 fields | 6 fields | 20 fields (A6 = B) | Plan |
|---|---|---|---|---|
| Berry fast (either slow group) | +26.1 % | +25.3 % | +25.1 % | Mono strawberry |
| Berry slow (either fast group) | −17.1 % | −16.8 % | −16.7 % | Mono strawberry |
| Roots and fruit-veg only | 0 | 0 | 0 | Mono strawberry |

- Mono strawberry survives ±20 % and ±30 %. First flips: ±40 % with no renown (roots fast, berry slow → 20 corn, −17.6 %), and ±50 % at the 0.7 floor (20 corn, −32.8 %).
- Home lot at A3 does shift: roots fast + berry slow → 2 corn + 1 grape bed (−9.8 %).
- There is no brake on speed. Strawberry is at the floor from 2 fields, so faster growth is linear income and never a deeper glut.
- Stacking: fert 5 + fast listing + fertile + mist Lv2 takes the field cycle from 240 to 156 ticks, which is 23,077 tiles/h (above the 19,800 labour cap) and 33.6M/h (+54 %).
- Reroll ⭐5 / 10 / 20 / 40 is 0.5–1 h, 1–2 h, 2–4 h and 4–8 h at 5–10 ⭐/h (3–27 h semi-idle). That is cheap for +25 % of a whole run, and fine as a sink.

**Keep** the reroll prices. **Change →** the soil part is a lottery, not a choice: with one plain listing always on offer, the player takes berry-fast when it appears (56 % of sales) and plain otherwise.

## 8. Dig finds (item 7)

Digs/h if all ⚡ goes to digging = regen [C, balance.ts:673–678]: 1,200 + 300 per level, so 1,200 (Lv0) to 4,200 (Lv10). Cap is 10–60.

| Regen Lv | Digs/h | Shards/h at 2 % | Hours to 30 shards | Dust ⭐/h at 1 % | At 0.5 % / 0.3 %: shards/h, hours, dust |
|---|---|---|---|---|---|
| 0 | 1,200 | 24 | 1.25 | 2.4 | 6 / 5.0 h / 0.72 |
| 5 | 2,700 | 54 | 0.56 | 5.4 | 13.5 / 2.2 h / 1.6 |
| 10 | 4,200 | 84 | 0.36 | 8.4 | 21 / 1.4 h / 2.5 |

- If the rolls only happen on the 80 % of digs with no seed, multiply the 2 % / 1 % figures by 0.8 (dust 1.9–6.7).
- A realistic share is about 25 % of regen (300–1,050 digs/h) [E]: the set then takes 1.4–5 h at 2 %, or 5.7–20 h at 0.5 %.
- Seeds: 240–840 carrot seeds/h, worth 💰480–1,680/h. The stingy style earns 26 % of normal play at A1 [S].
- B: 2,400 digs/h all-in costs no cash [S 21.41M vs 21.42M].

**Ancient seed proposal [C for the comparisons, E for the design]:**
- Drop rate 0.05 % per dig: a mean of 2,000 digs, which is 0.5–1.7 h all-in or about 2.5 h at 800 digs/h.
- Crop: grow 1,440 ticks base (720 at fert 5), sell 1,500, not sold in the shop.
- Seeds: every harvest returns its seed plus a 25 % chance of a second. One seed fills 24 tiles in 15 cycles (3.0 h) and reaches 50 harvests in 12 cycles (2.4 h).
- Home, 24 tiles: 12.7k per tile-hour against strawberry's 13.7k (93 %).
- Field: 731k on a normal market at floor 0.5 (68 % of a renowned strawberry field). With its own market 4× deeper: 1st field 1,265k (×1.175), 2nd 1,067k (×0.99), 3rd ×0.81.
- So it is worth 1–2 fields at B (about +190k/h) and never a mono plan.

**Change → shards 0.5 %, dust 0.3 %.**

## 9. Relic rules (item 8)

| Rule | A (before Fields) | A6 / B (estate) | With ×1.5 | Flag |
|---|---|---|---|---|
| Order bonus 0.1 → 0.2 | +1.3k/h at A3 (+0.8 %) [S] | +154k/h at A6 (+0.7 %); +67k at B (+0.3 %) | ×1.5 of those | Small but fine |
| Glut recovers 25 % faster | +2.2 % at A3, +3.2 % at A3s [C] | **0** (on the floor) | +3.0 % / +4.4 %; 0 | Worthless at the estate |
| Slot refills in half the cooldown | +1 ⭐/h at A3 [S, within noise] | +1 to +4 ⭐/h [S, noisy] | No measurable extra | Fine |
| ⚡ regen +10 % | +10 % income at A1 (+1.5k/h); +4–6 % at A2 [E from S] | 0 cash; +10 % dig finds | +15 % | Fine |
| ⚡ overflow reserve (½ cap) | +5 to +30 ⚡ per return visit; 0 for an always-on player [C] | About +17 ⚡ per visit | +7 to +45 | Weakest rule |
| Stone as fuel at ⅓ coal | A loss while coal is in the bag: 3 stone sell for 9, 1 coal for 6 [C] | Only helps if coal is short (Stoker, no miner) | At ½ it breaks even | Worthless at most stages |

The glut rule has a second trap: if it is built by changing `MARKET_DECAY`, `marketDepthGlut` (balance.ts:597) shrinks by the same factor and the steady price does not move at all. It must leave the depth alone.

## 10. District rules (item 9)

The first sale opens at 8 deeds = 💰640k lifetime [C, balance.ts:540–542, 637]. The ladder bot (no shop upgrades) reaches that at about 10.3 h, just after the Tractor [S probe]. A rule then lasts the whole next run, so I give both ends.

| Rule | Before Fields (A3 / A3s) | Estate (A6 / B) | A real trade? |
|---|---|---|---|
| Mining district: bars ×1.5, market depth ×0.75 | Depth −3.6 % / −5.3 %; bars +36k/h per miner (+23 % of A3) → net about +19 % | Depth 0 (floor); bars +0.2 % | **No, a pure buff** |
| Short of hands: wages ×2, hand energy ×0.5 | Wages −1.4k/h (−0.9 %) | Wages −2.7k/h (−0.013 %) | **No**: ≈ 0 for a Manager player. If "energy ×0.5" halves regen it is a pure nerf for hand players; if it halves action cost, a pure buff |
| Co-op: order ⭐ ×1.5, market sales ×0.9 | −11 % cash (−17k/h); +3 to +5 ⭐/h | −10.9 % (−2.4M/h); +0.5 to +3 ⭐/h | **Yes** |

**Keep** Co-op. **Change →** Mining district needs a downside that still bites on the floor (crop prices ×0.9 or floor −0.1). Short of hands needs a real upside.

## 11. Decision list (reply with the numbers you reject)

1. **Option A: keep.** It cuts contract ⭐ ×5.4 and leaves every other order unchanged.
2. **Drop the "12 ⭐/h ceiling" claim**, or add a global ⭐ meter if you want a hard cap; goods fill in parallel (18.6 ⭐/h measured).
3. **Price ⭐ against 9 ⭐/h before the Tractor and 5 ⭐/h at the estate** (1.5–3 semi-idle).
4. **🥉60, not 100 or 40**: 6.6 cash/⚡ stays under the 6.77 cap, where 100 gives 9.6.
5. **🥈500 and 🥇1000: keep.** A miner is 38–46 % of the farm before Fields and under 4 % after.
6. **Furnace batch cap 5** (⭐15, ⭐30): one miner already stops binding at batch 4.
7. **Furnace speed ⭐10 × 1.5, ×1.25 per level**: keeps the 3.2×-farm clicker case out of the pre-Fields window.
8. **Bunkhouse capped at pool 10, ⭐15 × 1.6**: worth ≤ 0.4 % alone, +41 % once Fine mist outruns labour.
9. **Fine mist = ×0.95 grow time per level, ⭐8 × 1.35**: the linear shape reaches zero grow time at Lv5.
10. **⭐ sell = +0.1 per level, ⭐10 × 1.4**: +7.2 % at Lv1, the strongest favour per level.
11. **Seam survey ⭐12: keep.** +24 % to +68 % of a miner before Fields.
12. **Stoker ⭐15 + 🥈6: keep, but hide it until the furnace is busy**; with one miner it adds +2 %.
13. **Clerk ⭐20: keep. Manager ⭐40 → ⭐25**: option A more than halves the ⭐ of a 15-min checker after the Tractor.
14. **Soil survey prices ⭐10 / 25 / 40 and ×1.5: keep.** The best case equals ⭐ sell Lv5.
15. **Replace the zero-value traits** (easy-sell, dense soil, creek-side, contract field; clay and loose at home).
16. **Accept that group-price traits will not create crop variety**: nothing under +100 % moves a field off strawberry.
17. **Listing ±20 %: change so it is a choice**, either ±40–50 % or always slowing the top crop's group.
18. **Listing reroll ⭐5 / 10 / 20 / 40: keep.**
19. **Relic shards 2 % → 0.5 %**: the set takes 5.7–20 h of realistic digging instead of 1.4–5 h.
20. **Star dust 1 % → 0.3 %**: makes "≤ 2.4 ⭐/h" true at max regen.
21. **Ancient seed: 0.05 % per dig, grow 1,440, sell 1,500, +25 % seed, own market 4× deeper**: a goal for A, 1–2 fields at B.
22. **Relic "glut recovers faster": replace or make it lift the floor**; it is 0 at the estate.
23. **Relics "overflow reserve" and "stone fuel": replace or buff**; both are ≈ 0 for most players.
24. **Mining district and Short of hands: redesign**; neither is a trade. Co-op: keep.
25. **Batch 35 (potato, eggplant, chilli on top): re-run items 5, 6 and 7.** The one group that matters becomes fruit-veg instead of berry, and the dug carrot seed is no longer the bottom crop.

## 12. Not computed / unsure

- **⭐/h depends on my bot.** It only accepts item orders that fit in 60 % of the bag and drops the largest when the bag is full. Rows with the same setup differ by ±2 ⭐/h across seeds. Treat the table as ranges; the bag effect itself is real (item orders cap at half the bag) but its size needs a playtest.
- **Hand-heavy ⭐ at vein Lv3+ and the A3s stage were not measured** (bot artefact). The stingy style is only measured at A1.
- **Option A for hand miners**: I divided by the board's 12 rocks/min. If "the player's full output rate" means the real hand rate (up to 70 rocks/min), item ⭐ for clickers fall by up to ×5.8. That is a design choice I could not settle.
- **The sim sells bars at today's 2/3/5.** Every new-price bar figure is closed-form, with a furnace that never idles for lack of loading. The sim's furnace made about 61 bars/h against the model's 87.
- **Furnace speed shape** (÷1.25 per level) and what speed does to fire burn are my assumptions.
- **Realistic dig share** (25 %), the ⭐ a run actually banks, and expected trait values under random rolls are estimates.
- **Stage timing** comes from the ladder bot, which buys no shop upgrades. My forged stages are richer than the bot at the same hour (A3 earns 160k/h; the bot earns about 26k/h at 5 h).
- **Not modelled**: clay and loose soil in play, creek-side during a real coal shortage, the contract-field trait, and what 15M buys B toward the 20-field estate.
- **Estate model against sim**: 21.86M vs 21.42M (−2 %), and A3 159.1k vs 158.1k, so the closed form is trustworthy where labour does not bind.

## 13. Files

All in `/Users/totofk/.hermes/cache/scratch/tiles-calc34/calc/`:
- `model.ts` and `model.test.ts` → `out-model.json` (closed form: DP, bars, ladders, traits, listings, dig finds, relics, districts)
- `lib.ts` and `sim.test.ts` → `out-sim.json` (stage sims) and `out-sim-part.json` (bag-size runs, `ONLY='^x\.'`)
- `probe.json`, `probe.log`, `probe34.appended-block.ts.txt` (ladder-bot probe)
- `show.py` (table printer), `sim.log`

One file sits outside `calc/`: `repo/tests/probe34.test.ts` in the frozen copy. It is a copy of `sim.test.ts` with the suites disabled and the PROBE block appended, rather than an edit of the copied `sim.test.ts` itself. The live repo was only read; `git status` there is clean.
