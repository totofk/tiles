# Round 4 research — stacking progression layers on tools (tiers, mastery, convenience, workers)

Research only; nothing in the repo was changed. Claims marked **(inference)** are mine, not sourced. Builds on `round2-mining.md` and `workers.md`; numbers from `balance.ts` / PLAN.md batch 5–6 (carrot ≈ 2.7 cash/energy per the brief, 2.0 if the plant-time watering is counted as a 4th action; pumpkin ≈ 8.3; mining 1.0–2.3).

## Summary

1. Every reference game that stacks layers on one action gives each layer a **different axis**: Stardew tool tier = area/hits, skill level = energy, profession = yield, enchantment = special [1][2][3][4]; OSRS pickaxe tier = roll frequency, level = success chance [8]; Melvor pickaxe = interval, per-rock mastery = rock HP/double ore, pool = skill-wide perks [5][6][7]. A layer that re-uses another layer's axis reads as redundant (Stardew players skip the watering-can upgrade because sprinklers own "watering") [14].
2. Ownership map for tiles: **convenience tool → taps per press · material tier → what the tool can do (reach/access/depth) · mastery → running cost of a consumable · workers → who presses · milestone upgrades → global rates (price, grow time, energy pool)**.
3. Tool tier effect: **per-job distinct effects (option b), not flat energy reduction**. Flat −x % energy duplicates the energy upgrades (layer 5), needs fractional energy (Stardew tracks fractions and rounds the display [3]) and gives no visible change in play. Numbers in §2: watering can moisture ×2/×4/×8, sickle +10/20/30 % double-harvest, dibber seed-keep 20/35/50 %, pickaxe = 1-hit on its own vein depth + durability 200/500/1200. Hierarchy holds: max mining 2.36 < 0.9 × 2.7 = 2.43; farming rises with every farm tier.
4. **Deeper veins trade cash for ore** (ore/ingots unsellable or ≤ 1 cash), so new pickaxe tiers never raise cash/energy above vein Lv1 — the pickaxe's reward is material throughput, not money.
5. Mastery: **mining only, one bar per job that carries across tiers** (change from "per tier, reset, ×2 thresholds"): a Lv0 copper pickaxe lasting fewer uses than a Lv10 wooden one feels like a downgrade. Melvor's per-item mastery is per *rock*, and its pickaxes are permanent upgrades [5][6] — the analogy never supported a reset.
6. **No farm mastery, no dig mastery.** Melvor puts preservation only on input-consuming skills [6]; water/harvest/plant consume nothing worth preserving, and every candidate effect (energy, yield, seed keep) is already owned by tiers or upgrades. The per-job counters already *are* farm mastery — present them as such on the tool card. Dig stays the floor (0.4/energy); its only change ever: licensed crops enter the dig table at low odds (≤ 0.8/energy).
7. Order: batch 6 mining progress (now) → 7 workers v1 (water + harvest) → 8 furnace + vein Lv2 + copper set → 9 iron/gold + plant/mine certificates. Expected first-reach: tools L1 3–5 min, mastery Lv5 ~12 min, Lv10 35–45 min, workers 8–15 min, furnace 35–45 min, copper set 60–90 min, iron 2–3 h, gold 5–8 h.
8. Presentation: one card per tool, three lines (name + tier · effect line · progress bar with "next: …"), 44 pt rows [16]; farm buttons keep only the action and n.
9. Open: shovel tier (recommend none), whether the sim's reference crop becomes "best licensed crop" after the furnace, pickaxe carry-over of surplus hits (recommend none, Stardew-style).

## 1. How comparable games stack layers on one action

| Game | Layer | What it owns | Source |
|---|---|---|---|
| Stardew Valley | Tool tier (copper → iridium, 5 bars + 2k–25k g) | **Reach**: watering can/hoe 1 → 3 → 5 → 9 → 18 tiles per charged use; pickaxe: hits per node on *harder* rocks (copper node 3 → 2 → 1 hits); starter rocks already 1 hit, so a tier never speeds the basic action | [1][2][4] |
| | Skill level 0–10 | **Energy**: −0.1 per level per tool use (2 → 1); fractional, display rounded; "upgrading an Axe, Pickaxe, or Hoe does not alter the amount of energy" | [3] |
| | Profession (Lv5/10) | **Yield/value**: Miner +1 ore per vein, Tiller +10 % crop value, Prospector 2× coal | [11] |
| | Forge enchantment (end-game) | **One special rule**: Efficient = no energy, Reaching = 5×5, Swift = 33 % faster | [12] |
| OSRS | Pickaxe tier | **Roll frequency** only: bronze rolls every 8 ticks, rune 3, dragon ~2.83; "no effect upon the chance" | [8] |
| | Mining level | **Success chance per roll**, per ore | [8] |
| RS3 (2019 rework) | Pickaxe tier + Mining level + stamina | All three feed **progress per strike** on a visible bar; pickaxe penetration vs rock hardness gates which rocks are efficient | [9][10] |
| Melvor Idle | Pickaxe (shop, permanent) | **Interval** −5/−10 % per tier, +1 % double ore | [5] |
| | Mastery per *rock* (1–99) | **Rock HP** +1/level (node budget), 1–15 % double ore | [6] |
| | Mastery pool checkpoints 10/25/50/95 % | **Skill-wide perks** (−10 % respawn, −0.2 s interval) | [6][7] |
| Melvor Farming | Mastery per *crop* | Survival: Lv50 "no compost required"; pool 25 % = crops never die; skillcape +25 % harvest | [13] |
| Graveyard Keeper | Tool tier I/II | **Efficiency %** (100 → 150 %) at the *same* integer energy per use — energy saving without fractions | [15] |
| Forager | Pickaxe/shovel tier | **Flat damage + one new bonus per tier that stacks** (slime: +jelly drops; golden: +coins; water shovel: bigger area + irrigates) | [17] |
| Farm Together | Tractor | **9 tiles per action, 1 gas per tile worked** — tiles' convenience tool exactly: saves taps, not resources | [18] |
| Idle Miner Tycoon | Shaft level vs manager rank | Level = output + free worker at 10/50/100/200/400; manager = removes the tap + timed boost; Junior/Senior/Executive ranks | [19][20] |

Pattern: no game lets two layers touch the same number. Where they do (Stardew can tier vs sprinklers both own "watering"), players drop one: "I don't even upgrade my watering can. I just go for sprinklers" [14]. Kingdom and Moonlighter have no comparable multi-layer tool stack (Moonlighter stacks weapon tier + enchant, same pattern, no farming) — skipped.

**Ownership map for tiles' five layers (inference, built from the table):**

| Layer | Owns | Must never touch |
|---|---|---|
| 1 Convenience tool L1–L3 | taps per press (1 → n → all) | energy per tile, yield |
| 2 Mastery (pickaxe) | lifetime of a consumable (preserve chance) | drop value, hits |
| 3 Material tier | what the tool *can do*: moisture duration, double-harvest, seed keep, 1-hit at depth + base durability + vein access | taps (layer 1), global rates (layer 5) |
| 4 Workers | who presses (own clock, wage) | per-action cost or yield |
| 5 Milestone upgrades | global rates: sell price, grow time, energy max/regen | anything per-tool |

## 2. Tool upgrade effects: flat energy vs per-job vs hybrid

**What real games do.** Flat energy reduction exists only as the *skill* layer (Stardew −0.1/level [3]); no reference uses it as the *tier* effect. Tiers are structural: reach (Stardew, Forager, Farm Together), access/hits (Stardew pickaxe, RS3 penetration, Core Keeper mining damage [21]), interval (Melvor, OSRS). Graveyard Keeper is the one "efficiency" tier, and it keeps energy integer by raising work per use [15].

**Pitfalls.**
- *Fractional energy*: tiles costs 1 energy per tile; −10 % means 0.9 and a rounded HUD, Stardew's exact wart [3]. Only integer-safe forms exist: "2 tiles per energy" (a 50 % jump) or "every Nth action free" (hidden RNG). Both are coarse or opaque **(inference)**.
- *Duplicate axis*: energy/minute is already owned by `energyMax` / `energyRegen`; a flat tier bonus would be a third slider on the same number.
- *Dominant upgrade*: a uniform −x % to *every* job raises farming and mining equally, so it cannot break the hierarchy — but it also changes nothing visible in play, which is why Stardew players notice the hoe's 3×3 and not the −0.1 energy [14].
- *Effects that stop mattering*: a tier that does not change the count of an action for the crop you are on feels empty (×1.5 moisture leaves carrot at 2 waterings). Each tier must cross a threshold for the crop the player holds at that time **(inference)**.

**Recommendation: option (b), one axis per job, each tier crosses a visible threshold.** Tier names copper / iron / gold (ingots from vein Lv2/3/4 ore); keep wooden/stone as the pre-forge tier.

| Tool | Copper | Iron | Gold | Why this axis |
|---|---|---|---|---|
| Watering can | moisture lasts ×2 (120 s) | ×4 (240 s) | ×8 (480 s) | Owns *idle tolerance*: carrot 2 → 1 waterings, pumpkin 4 → 2 → 1; gold is for 480-tick crops and AFK. Sprinkler stays "never drains + upkeep" |
| Sickle | +10 % chance of 2 crops | +20 % | +30 % | Stardew Miner +1 ore, Melvor 1–15 % double [6][11]; a farm-side yield lever that is not `sellPrice` |
| Dibber | keep seed 20 % | 35 % | 50 % | Preserving/Unbreaking pattern; cap 50 % so the pouch and auto-buy keep a job. Weakest tier; alternative: copper = "planting also waters" (Forager water shovel [17]) |
| Pickaxe | 1-hit at vein Lv2 (3-hit rock), durability 200 | 1-hit at Lv3 (4-hit), 500 | 1-hit at Lv4 (6-hit), 1200 | Stardew hits-per-node [1]; tiers never speed stone (still 1 node/energy, no carry-over) so cash/energy is capped by the vein, not the tool |
| Shovel (dig) | none | none | none | It is the floor; Forager's shovel tiers own area, which layer 1 owns here |

Vein ladder: Lv2 = 65 % stone / 20 % coal / 15 % copper ore (3 hits), Lv3 adds iron ore (4 hits), Lv4 gold ore (6 hits); upgrading a vein requires the matching pickaxe tier (Stardew: steel pickaxe required for farm boulders [1]), so the player is never "nerfed" by a vein he cannot 1-hit. Raw ore and ingots: no sell price (or 1 cash as a bag dump). Copper ingot = 2 ore + 1 coal. Pickaxe prices: copper 60 cash + 4 copper ingots, iron 120 + 4 iron, gold 250 + 4 gold.

**Arithmetic (cash/energy; preserve = 1 − 1/(1+0.4L), lifetime = D(1+0.4L); cash price amortised over lifetime; ore worth 0 cash).**

| Stage | Lv0 | Lv10 |
|---|---|---|
| hand, stone | 1.00 | — |
| wooden, vein Lv0 / Lv1 | 1.52 / 1.92 | 1.90 / 2.30 |
| copper, vein Lv1 / Lv2 | 2.10 / 1.80 | 2.34 / 2.04 |
| iron, vein Lv1 / Lv3 | 2.16 / 1.66 | 2.35 / 1.85 |
| gold, vein Lv1 / Lv4 | 2.19 / 1.49 | **2.36** / 1.66 |
| carrot: none / copper / iron / gold set | 2.00–2.7 / 3.13 / 3.57 / 4.00 | |
| pumpkin: none / copper / iron / gold set | 8.33 / 14.5 / 21.8 / 24.3 | |

Max mining is a gold pickaxe parked on the coal-rich vein Lv1: 2.36 < 2.43 (0.9 × 2.7) — thin but true, and every farm tier moves farming up, never down. Deeper veins *lower* cash/energy (2.4 → 2.1 → 1.9 → 1.7 per node) because ore replaces stone — the drop table should show that in cash-equivalent so it reads as a deliberate trade for materials, not a nerf **(inference)**. Durability must dwarf the pickaxe's own ore cost: copper's 4 ingots = 8 ore ≈ 53 nodes at 15 %; at 200 uses the pickaxe eats 27 % of its own ore output at Lv0, 5 % at Lv10 (Minecraft ratios wood 59 / iron 250 / diamond 1561 are the same "each tier ≈ ×2–6 lifetime" shape [22]). Sim assertion stays `maxMining < 0.9 × measured farming`; add `ingot sell price ≤ inputs` so smelting-to-sell is never a loop.

## 3. Mastery scope

- **Mining: yes, one bar per job, carried across tiers.** Round 2 proposed per-tier mastery with a reset and ×2 thresholds, borrowing Melvor; but Melvor's unit of mastery is the *rock* (target), and the pickaxe is a permanent shop upgrade that never resets [5][6]. Stardew's mining level is per skill and carries across pickaxe tiers [3]. With a reset, a fresh copper pickaxe at Lv0 (200 uses) lasts more than a maxed wooden (125) only because of the durability numbers above; with round 2's 25/60-style bases it would be a visible downgrade. Carry-over also keeps one UI bar. If Toon insists on per-tier bars, keep base durability ≥ the previous tier's Lv10 lifetime **(inference)**.
- **Hand: no mastery** (already decided). It has no consumable to preserve.
- **Farm jobs: no.** Candidates and their owners: energy → fractional, layer 5; yield → sickle tier; seed keep → dibber tier; grow time → fertilizer. Melvor grants preservation only where inputs are consumed [6]; Stardew's farming level owns energy and quality, neither of which tiles wants per-job. The counters `waters/harvests/plants` are already per-job XP that gate tools L1–L3 and worker certificates — name them on the card ("Watered 134 · next: Garden Hose at 150") and the player experiences mastery without a new system.
- **Per-crop mastery (Melvor farming):** owns crop survival there [13]; tiles has no failure, only rot. Park it: if more crops arrive, a per-crop "rot grace +10 %/level" is the one non-duplicating effect **(inference)**.
- **Dig/shovel: no mastery, no tier.** Any lift (20 → 40 % = 0.8/energy) crowds hand mining (1.0) and removes the reason to buy the license. One optional change: after the pumpkin license the dig table becomes 15 % carrot / 5 % pumpkin seed = 0.8/energy, still < hand mining.

## 4. Pacing (minutes of play from a fresh run; sim and brief numbers, Toon's 90-min session as the scale)

| Minute | Arrives | Source of estimate |
|---|---|---|
| 1.7 | first carrot harvest; dig available from 0 | sim tick 100 |
| 2–3 | mine license affordable; water tool L1 visible (20 waters, 40 cash) | sim tick 124; 10.8 waters/min |
| 3.5–5.5 | pumpkin license; harvest/plant tool L1 (15 counters) | sim ticks 207–337 |
| 4–12 | pickaxe mastery Lv1 → Lv5 | round-2 estimate 10–15 mines/min |
| 6–14 | tools L2 (60/50/50 counters, 120–150 cash); hire button (30 harvests) | PLAN batch 5; workers.md |
| 8–15 | water certificate (100), vein Lv1 (40 stone + 100), harvest certificate (150 + 20 stone) | workers.md §3 |
| 14–25 | tools L3 (150/120/120 counters, 300–350 cash) | PLAN batch 5 |
| 35–45 | mastery Lv10 (400 mines); **furnace** — price it here: 300 cash + 60 stone + 20 coal **(inference)** | round-2 estimate |
| 50–90 | vein Lv2 + copper pickaxe → copper can → copper sickle/dibber (4 ingots each ≈ 3–4 min of mining + smelting per tool) | §2 arithmetic |
| 2–3 h | iron set, plant + mine certificates priced in ingots | workers.md compromise |
| 5–8 h (with offline) | gold set; tiles 18–24 | tile prices 1.5^n |

Rule applied: a new *system* every ~15 min, a new *goal inside an existing system* every ~3–5 min, never two systems in one batch window. Order batches 6 → 9: **6 mining progress** (mastery, vein Lv1, drop table) → **7 workers v1** (water + harvest only; keeps the 15–30 min band busy while mastery grinds) → **8 furnace + vein Lv2 + copper set** (first ingots land right after mastery Lv10 so the mine has a next goal) → **9 iron/gold + plant/mine certificates + vein Lv3/4**. Stardew's copper tools land weeks into year 1 and Melvor mastery takes tens of hours; tiles compresses the same ladder into 90 min and 8 h, which is right for its session length **(inference)**.

## 5. Presentation on a 375 px phone

- **Melvor**: every item card carries level + XP bar + "next unlock" tooltip; the pool is one skill-wide bar with checkpoint ticks; identical layout on mobile, single column [7].
- **Idle Miner Tycoon**: one shaft card = level number, next milestone (10/50/100…), one upgrade button with price and a ×1/×10/×50/max toggle [19][20].
- **AdVenture Capitalist**: business row = count, a milestone bar under it with the effect of the next milestone ("25 → profit speed doubled") [23].
- **Stardew** shows tier on the tool icon and level on a separate skills page — the split is why players forget proficiency exists **(inference)**.

For tiles **(inference)**: a Tools section in the Upgrades tab, one card per tool, three lines, ≥ 44 pt tall [16]:
```
💧 Water Cart · Copper        Lv 7 ▮▮▮▮▮▮▮▯▯▯
moisture ×2 · all tiles per press
next: Iron can (4 iron ingots + 120) — ore 3/8
```
Line 1 = name + tier + (pickaxe only) mastery level/bar; line 2 = what it does now; line 3 = the single next goal with progress (counter, cash or ingots), greyed until unlocked. Farm buttons above the grid keep only "Water ×3 −/+"; a long-press or tap on the card expands the full tier table. Mastery shows "lasts ~N uses", never %. The mine panel's drop table adds a cash-per-node line per vein level.

## 6. Verdict

- **Ownership**: taps (convenience) · lifetime (mastery, pickaxe only) · capability per job (tier) · who presses (workers) · global rates (upgrades). No two layers on one number.
- **Tiers**: per-job effects, thresholds per crop: can ×2/×4/×8 moisture; sickle +10/20/30 % double; dibber keep 20/35/50 %; pickaxe 1-hit at own depth + 200/500/1200 durability; shovel none. Ore/ingots unsellable; vein needs the matching pickaxe. Max mining 2.36 < 2.43.
- **Mastery**: mining only, one bar, carries across tiers, Lv1–10 as in batch 6; counters double as farm "mastery" on the cards.
- **Order**: 6 mining → 7 workers (water/harvest) → 8 furnace + copper → 9 iron/gold + remaining certificates.

Open questions for the designer:
1. Keep per-tier mastery reset (batch 6 spec) or switch to one carried bar before save v5 ships? (Cheaper to change now.)
2. After the furnace, should the hierarchy assertion compare against pumpkin (always owned by then) instead of carrot? Carrot keeps a 3 % margin at gold; pumpkin would allow ore to sell.
3. Dibber: seed-keep (weak, clean) or "planting waters" (strong, overlaps the can)?
4. Surplus pickaxe hits: wasted (Stardew, legible) or carried over (RS3 bar, raises stone/energy and breaks the cap)?
5. Should the gold watering can exist before a 480-tick crop does, or ship with crop 3?

## Sources

1. Stardew Valley wiki — Pickaxes (hits per node by tier, boulder gating): https://stardewvalleywiki.com/Pickaxes
2. Stardew Valley wiki — Watering Cans (area 3/5/9/18, charge water cost): https://stardewvalleywiki.com/Watering_Cans
3. Stardew Valley wiki — Skills, Proficiency (−0.1 energy/level, fractional tracked, display rounded; tier does not change energy): https://stardewvalleywiki.com/Skills
4. Stardew Valley wiki — Hoes (area per tier): https://stardewvalleywiki.com/Hoes
5. Melvor Idle wiki — Mining/Boosts (pickaxes −5/−10 % interval, +1 % double): https://wiki.melvoridle.com/w/Mining/Boosts
6. Melvor Idle wiki — Mining (mastery per rock: +1 HP/level, 1–15 % double ore; pickaxes permanent): https://wiki.melvoridle.com/w/Mining
7. Melvor Idle wiki — Mastery (per-item levels, pool checkpoints 10/25/50/95 %, in-game display): https://wiki.melvoridle.com/w/Mastery
8. OSRS wiki — Pickaxe (ticks between rolls per tier; no effect on success chance): https://oldschool.runescape.wiki/w/Pickaxe
9. RuneScape wiki — Mining (progress per strike from level, pickaxe tier, stamina): https://runescape.wiki/w/Mining
10. RuneScape wiki — Mining and Smithing rework design documents (damage per swing, penetration vs hardness): https://runescape.wiki/w/Mining_and_Smithing_rework_design_documents
11. Stardew Valley wiki — Mining (professions: Miner +1 ore, Prospector 2× coal): https://stardewvalleywiki.com/Mining
12. Stardew Valley wiki — Forge (enchantments: Efficient, Reaching, Swift, Powerful): https://stardewvalleywiki.com/Forge
13. Melvor Idle wiki — Farming (per-crop mastery: Lv50 no compost; skillcape +25 %): https://wiki.melvoridle.com/w/Farming
14. r/StardewValley — "Upgrade priority": players skip the watering can because sprinklers own watering: https://www.reddit.com/r/StardewValley/comments/1ioe5ge/upgrade_priority_in_stardew_valley/
15. Graveyard Keeper wiki — Anvil II (tool I/II: same energy per use, efficiency 100 → 150 %): https://graveyardkeeper.fandom.com/wiki/Anvil_II
16. Apple Human Interface Guidelines — Accessibility (44×44 pt hit targets): https://developer.apple.com/design/human-interface-guidelines/accessibility
17. Forager wiki — Tools (per-tier damage + stacking bonus effects; water shovel irrigates): https://forager.fandom.com/wiki/Tools
18. Farm Together wiki — Tractor (3×3 per action, 1 gas per tile worked): https://farmtogether.fandom.com/wiki/Tractor
19. Idle Miner Tycoon wiki — Mineshafts (level, workers at 10/50/100/200/400): https://idleminertycoon.fandom.com/wiki/Mineshafts
20. BlueStacks — Idle Miner Tycoon upgrade UI (level button, ×1/×10/×50/max): https://www.bluestacks.com/blog/game-guides/idle-miner-tycoon/idt-tips-tricks-en.html
21. Core Keeper wiki — Pickaxes (mining damage + durability per tier): https://core-keeper.fandom.com/wiki/Pickaxes
22. Minecraft wiki — Durability (tool lifetime per material tier): https://minecraft.wiki/w/Durability
23. AdVenture Capitalist wiki — Unlocks (Earth) (milestone bar: 25 → profit speed doubled): https://adventure-capitalist.fandom.com/wiki/Unlocks_(Earth)
24. Melvor Idle systems reference (teemo.dev) — mastery as a second track on the same actions, pool thresholds: https://teemo.dev/game-design/melvor-idle/systems/skills-and-xp-reference/
