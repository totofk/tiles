# calc34 item 8 re-run: the ⭐ furnace rows on top of batch 33's molds

Hermes, Opus via Max, 2026-11-13. Calculator: `tiles-drafts/calc34-item8/calc.test.ts` (+ `out.json`), the REAL
`balance.ts` at `6fbb6eea` (batch 33 pushed) imported by path; closed form, no game state stepped. Labels: [C] computed
from the shipped functions, (est.) until the batch 34 sim pins it.

## What changed since calc34 §4
- calc34 (frozen 9130c07, before batch 32) assumed ONE furnace slot, one kind at a time, and a pickaxe press that breaks
  at most one rock. Batch 32 made hits carry over (`dig`, `src/core/mining.ts:150–188`: one press can break several
  rocks) and batch 33 gave every ore kind its own mold smelting in parallel.
- Per gold-pickaxe press at vein Lv4 [C]: 3.125 rocks = 1.56 stone, 0.63 coal, 0.375 copper ore, 0.31 iron ore,
  0.25 gold ore (8 hits ÷ 2.56 average rock hits). calc34 used ≈ 1 rock per press, star-toys.md 1 rock per press at
  5 hits. One miner (720 presses/h) therefore brings 270 / 225 / 180 ore/h, about 3–6× the earlier figures.

## Capacity needed per mold (b·r = batch bars × speed rate) [C]
Bar ladder top (batch 33) = batch 5 × speed Lv2 (1.5625) = 7.81.

| Stage, supply | need copper / iron / gold | max | bars 💰/h at batch 3 | at the bar top | unbound | ⭐ gain over the bar top | fewest ⭐ levels that unbind |
| --- | --- | --- | --- | --- | --- | --- | --- |
| vein Lv3 iron pick, 1 miner | 1.53 / 2.04 / – | 2.04 | 59.7k | 59.7k | 59.7k | 0 | none |
| vein Lv3, 2 miners | 3.06 / 4.09 | 4.09 | 94.6k | 119.5k | 119.5k | 0 | none |
| vein Lv4 gold pick, 1 miner | 2.25 / 3.75 / 4.5 | 4.5 | 178.0k | 239.6k | 239.6k | 0 | none |
| vein Lv4, 2 miners | 4.5 / 7.5 / 9 | 9 | 185.9k | 443.7k | 479.3k | +8 % | speed Lv3 (⭐10) |
| vein Lv4, 3 miners (needs Bunkhouse) | 6.75 / 11.25 / 13.5 | 13.5 | 187.2k | 471.8k | 718.9k | +52 % | batch 7 + speed Lv3, or speed Lv5 |
| vein Lv4, hand 2,700 + 1 miner | 10.7 / 17.8 / 21.4 | 21.4 | 189.6k | 483.4k | 1.14M | +135 % | batch 6 + speed Lv6 |
| vein Lv4, hand 4,200 + 1 miner | 15.4 / 25.6 / 30.8 | 30.8 | 192.4k | 486.3k | 1.64M | +237 % | past batch 10 + speed Lv6 |
| vein Lv4, 4 tiers mastered, 1 miner | 2.9 / 4.8 / 5.8 | 5.8 | 184.0k | 308.5k | 308.5k | 0 | none |
| same, 2 miners | 5.8 / 9.7 / 11.6 | 11.6 | 186.7k | 462.8k | 617.0k | +33 % | batch 6 + speed Lv3 (⭐25) |

Bars at 🥉100 🥈500 🥇1000 and sell Lv5 (×1.5); ore the furnace has no time for sells as ore. Coal never binds: one
miner mines 450 coal/h and the bar top burns ≈ 126/h for its ore [C].

## Findings
1. One miner never needs a ⭐ furnace row: the metal-bar ladder already smelts all of it (molds work in parallel).
   The ⭐ rows pay from 2 miners (+8 %, +33 % with mastered tiers), 3 miners (+52 %, needs the Bunkhouse) and clickers
   (+135 % to +237 %).
2. Bars are big money now: one miner at vein Lv4 = 💰240k/h of bars at sell 5, against the A3 farm before Fields at
   💰161k/h (18 grape) to 💰336k/h (24 strawberry) (calc34 §2 [S]). calc34 §3 said 47 %; the difference is hit carry-
   over. Under Toon's 2026-11-09 rule this is reported, not held down. Away income stays bounded by storage + trays
   (bars never auto-sell; `SELL_WHEN_FULL` excludes them).
3. Clicker case: at the bar top a clicker + miner makes 💰483k/h; ⭐ batch 6 + speed Lv6 costs ⭐97 (⭐15 + 10 + 15 + 23 +
   34), ≈ 11 h of ⭐ at the ~9 ⭐/h pre-Tractor yardstick, so the 💰1.14M/h case stays outside the 1.6–8.7 h pre-Fields
   window.

## Prices adopted in the batch 34 plan
- ⭐ Furnace speed: furnace speed Lv3, 4, … (rate 1.25^level, uncapped), ⭐ `Math.round(10 × 1.5^k)` = 10, 15, 23, 34,
  51, 76 … (calc34's accepted ⭐10 × 1.5, now starting past the bar ladder).
- ⭐ Furnace batch: batch 6 … 10 (5 levels; batch 10 is the most the top tray 20 / ore slot 48 can carry under the
  "tray ≥ 2 × batch, slot ≥ 2 cycles" lock), ⭐ `Math.round(15 × 1.5^k)` = 15, 23, 34, 51, 76 (calc34 started batch at
  ⭐15; the growth follows the speed row).
