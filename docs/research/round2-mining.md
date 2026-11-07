# Round 2 research — mining, soft-locks, mastery, loans

Research only; nothing in the repo was changed. Claims marked **(inference)** are mine, not sourced.

## Summary (verdict per proposal item)

1. **Hand digging, free, from start, 1 hit/energy — KEEP.** This is the genre-standard fix: in Melvor, Stardew, Forager and Cookie Clicker the base gathering action never needs a purchased input; mining v1 broke that norm by gating the gatherer behind a consumable. Floor of 1 cash/energy is correctly below everything else.
2. **Mine license unlocks pickaxe crafting + vein upgrades — KEEP**, but let the license (or the vein) be paid partly in stone so hand-dug stone has a visible first use **(inference)**.
3. **Per-tool mastery, 10 levels, +9%/level preserve, cap 90% — CHANGE.** Cap at **80%** (Melvor's global preservation cap; Minecraft Unbreaking III = 75%). Use a lifetime-linear curve (preserve = 1 − 1/(1+0.4·L)) instead of linear %, because linear % makes the last level alone double pickaxe lifetime. Per-tool XP is fine (Melvor mastery is per item) but carry something across tiers (Melvor's skill-wide pool).
4. **Always-visible drop table with locked rows + % and mastery bar — KEEP.** Melvor shows every rock with its level requirement; RS3's rework added a per-strike progress bar precisely to kill the "nothing happened" feel. Add a hit counter/crack on the node.
5. **Vein Lv1 = 40 stone + 100 cash → 80/20 coal at 5 — KEEP the gate, CHANGE coal to 4.** With coal at 5, max-mastery pickaxe reaches 2.54 cash/energy vs farming 2.7 — only 6% margin. Coal at 4 gives 2.34 (13% margin); coal's real value should be furnace fuel, per DECISIONS.
- Wood price: not the real problem once mastery exists (amortised pickaxe cost falls from 0.6 to 0.06 cash/dig). Fix the Lv0 feel with durability 20 → 25 or wood 4 → 3, not both; logging license is a fine later system, not needed for the soft-lock.
- Loan: **drop for now**. Hand digging removes the need; time-growing repayment in a real-time game with offline catch-up punishes being away.
- Hierarchy check (radish 2.7): hand 1.0 < pickaxe Lv0 1.4 < pickaxe max 1.94 (stone only) / 2.34 (coal at 4) < 2.7. Holds at every stage; pumpkin (~8/energy) makes it trivially true after tick ~600.

## 1. Anti-soft-lock / bankruptcy floors

How comparable games avoid "no action can ever earn money":

- **Free basic action (most common, best feel).**
  - *Cookie Clicker*: the Big Cookie always yields ≥1 cookie per click, no input required [1]. The entire genre is built on an uncapped, free manual action under the automation layer.
  - *Melvor Idle*: gathering skills (Mining, Woodcutting, Fishing) consume nothing. Pickaxes are *permanent shop upgrades*, not consumables ("permanently active once purchased") [3]. Only production skills (Smithing etc.) consume inputs, and those are where preservation bonuses live [5].
  - *Stardew Valley*: rocks and ore on the farm/mines are breakable with the starter pickaxe forever (costs energy only); energy refills by sleeping [7]. No fail state; the "floor" is foraging/mining/fishing, all input-free.
  - *Forager*: pickaxes are permanent upgrades with no durability; resources respawn [10].
  - *Idle Miner Tycoon*: income is autonomous from shafts; nothing you buy can stop cash flow [11].
  - Design codices for the genre state it as a rule: "No click-softlock. Prove the player can always progress" [12].
- **Loan / bailout.** *Game Dev Tycoon*: the bank bails you out once; a second deep debt (> $200K) is game over [13]. *RollerCoaster Tycoon*: every scenario starts with a loan ($1k–$10k); increasing it is "a strategy of last resort" [14]. *OpenTTD*: loan with fixed monthly interest set by difficulty, max loan £300k default [15]. *Recettear*: the whole game is a debt with weekly deadlines; missing one restarts the game [16]. *Animal Crossing*: 0% interest, no deadline, no consequences; players describe it as relaxing and "not something to stress over" [17][18].
- **Starter grant / auto-refill.** I could not find a sourced example of a farming game that hands out free seeds when broke (FarmVille lore says so, but no reliable citation). **(inference)**: refills feel like cheating and are exploitable (sell everything → re-trigger), so games prefer a free action.

**Which feels best for tiles.** The free basic action. It is invisible as a "safety net" (no popup, no shame), it is deterministic (the player can reason "2 energy = 1 stone = 2 cash"), and it doubles as the tutorial for the pickaxe (pickaxe = same action, half the energy). It also fixes the *pre-mine* soft-lock (cash 1 after a license with empty tiles) without a special case.

**Pitfalls to avoid.**
- The free action's cash/energy must be the worst in the game or it becomes the idle default — 1.0 vs 1.4/2.7 is correctly ordered.
- Stone must always be sellable (never let bag-full block the floor: when the bag is full and cash < seed cost, allow sell from the dig screen) **(inference)**.
- Recovery time from the worst state should be seconds, not minutes: at cash 1, two hand digs (6 s of regen) → 3 cash → radish seed. Good.
- Don't add a loan on top: two safety nets confuse the "why am I broke" lesson. Game Dev Tycoon's bailout-then-game-over shows how a loan reads as a warning of failure, not a tool.

## 2. Mastery / tool-preservation systems

**Melvor Idle (the closest model).**
- Mastery is **per item/action**, 1–99, same XP curve as skills: XP between levels ≈ ⌊¼(L−1 + 300·2^((L−1)/7))⌋, doubling roughly every 7 levels; level 99 ≈ 13.0M XP [2]. Each skill also has a **Mastery Pool** (25% of earned mastery XP, 50% after skill 99) with checkpoints at 10/25/50/95% that give skill-wide bonuses [2].
- **Preservation** exists only on input-consuming skills. Smithing per-item mastery: +5% preserve at Lv 20/40/60/80, +10% at 99 (= 30% from mastery), plus pool checkpoints +5%/+5% [5]. **Global cap 80%**, raised only by a few specific items [4].
- Mining mastery does *not* preserve anything; it raises Rock HP (+1/level, rocks start at HP 5 + mastery) and gives 1–15% chance of double ore [3]. Rocks deplete and respawn; HP regenerates 1 per 10 s [3].
- New rock = new mastery (starts at 1), but pool checkpoints and pickaxes carry over — a hybrid of "reset per tier" and "global progress" [2][3].
- Time to max: 99 mastery on one item is tens of hours of actions; nobody hits 100% preserve.

**Minecraft.** Unbreaking I/II/III: chance to consume durability = 1/(level+1) → 50/66.7/75% preserve; average lifetime ×2/×3/×4 [6]. Hard-capped at III; "infinite" tools only via Mending (repair), not preservation.

**RuneScape.** OSRS has no durability on pickaxes; the "mastery-like" bonus is Varrock armour's 10% chance to mine two ores up to gold [8]. RS3's 2019 rework replaced RNG success with **progress per strike shown on a bar**, 10% crit chance, and a **stamina** mechanic that rewards active clicking (+25% at full stamina) [9]. No preservation at all; progression = pickaxe tier + level.

**Stardew.** Mining skill is global (0–10); tools don't break; tier progress is expressed as *hits per node* (starter: copper node in 3 hits; copper pickaxe 2; steel 1) [7]. Level-5/10 professions give +1 ore per vein, etc. [19].

**Takeaways for tiles.**
- Preservation cap: **80%** is the shared industry answer (Melvor 80, Minecraft 75). 90% makes a pickaxe last 200 digs vs 100 — the last level alone doubles lifetime, a hockey stick nobody else ships.
- Shape: linear +9%/level is *lifetime-exponential* (lifetime = 20/(1−p)). Make lifetime linear instead: **preserve(L) = 1 − 1/(1 + 0.4·L)** → L1 29%, L2 44%, L3 55%, L4 62%, L5 67%, L6 71%, L7 74%, L8 76%, L9 78%, L10 80%; expected lifetime 20, 28, 36, 44, 52, 60, 68, 76, 84, 92, 100 digs. Every level = "+8 digs per pickaxe". Show the lifetime, not the % ("lasts ~44 digs") **(inference)**.
- XP: 1 XP per *dig* (energy spent), whether or not durability was consumed. Transparent, no hidden formula.
- Thresholds (cumulative digs): **10, 25, 45, 70, 100, 140, 190, 250, 320, 400**. At 20–30 digs/min with ~half of energy spent in the mine (10–15 digs/min), Lv1 in ~1 min, Lv5 in ~8 min, Lv10 in **~30–40 min** of mixed play. Toon's round-2 session was ~90 min; this maxes wooden before stone pickaxe becomes affordable. Expected durability consumed over those 400 digs ≈ 180 → ~9 pickaxes (108 cash of wood) against 800 cash of stone.
- Next tier: start at Lv0 but double the thresholds (stone pickaxe 800 digs) — and keep one global value across tiers, e.g. a "Mining level" = total digs that gates vein upgrades, mirroring Melvor's pool **(inference)**. A full reset with nothing carried is what Toon's proposal says; players tolerate it in Melvor only because the pool and pickaxe persist.
- Display: Melvor shows per-item mastery as a small bar + level on each rock card; the pool as a skill-wide bar with checkpoint ticks. Copy both.

## 3. Making mining feel like progress

- **Visible locked content.** Melvor lists every rock with its level requirement, greyed until reached [3]. Idle Miner Tycoon shows the next shaft and the worker milestones (Lv 10/50/100/200/400) before you can afford them [11]. Stardew's mines reveal ore by depth (120 floors; "ore type and quantity increases as the player moves deeper") with the elevator as a persistent progress marker [20]. Round-2 feedback ("no idea what the rates are or what the mine can be upgraded into") is exactly what these solve. Show: current table with %, next vein level's table greyed, cost in cash + stone, and the mastery bar.
- **Multi-hit vs one-hit.** Three successful models:
  - Progress-per-strike with a bar (RS3): removes RNG failure, makes every energy spent visible [9].
  - Hits-per-node as the tool-tier language (Stardew: 3 → 2 → 1 hits) [7]. Your proposal (hand 2 energy/stone, pickaxe 1) *is* this; a stone pickaxe at 2 stone/energy or coal in 1 hit continues it.
  - Node HP + respawn (Melvor): turns a node into a budget that mastery enlarges [3]. Good later for "vein depletes, respawns in N s" to cap idle mining.
  - **(inference)**: with 1-second ticks and energy clicks, a 2-hit node with a crack sprite is the cheapest version of the RS3 bar. Avoid RNG "miss" hits.
- **Milestone unlocks tied to counters** already exist in tiles (sales/harvests). Add `digs` milestones in the mine panel: "25 digs → mine license visible", "100 digs → vein Lv1 visible" **(inference)**.
- **First non-stone drop quickly.** With 20% coal and ~1 drop/energy, expected first coal is the 5th dig (~15 s), well under the 3-minute target in DECISIONS.

## 4. Loans (for later)

| Game | Model | Experience |
|---|---|---|
| OpenTTD | Fixed interest (per difficulty), paid monthly, max loan £300k; repaying is a goal [15] | Standard opening move; fun as an accelerator |
| RollerCoaster Tycoon | Start with a loan; cap per scenario [14] | Neutral; paying it off raises company value |
| Farming Simulator 22 | Borrow in €5k steps, small daily interest, no deadline [21] | Routine; guides recommend borrowing early |
| Animal Crossing | 0% interest, no deadline; repayment unlocks the next expansion [17][18] | Widely liked; debt reads as a progress goal |
| Recettear | Debt with weekly deadlines; miss = restart (NG+) [16] | Tense/fun, but it *is* the game |
| Game Dev Tycoon | One bailout, then bankruptcy = game over at −$200k [13] | Punishing; read as failure |

**Assessment of Toon's loan (repayment grows while waiting, cap 200%).** (inference) Growth over *real time* in an idle game with 8-hour offline catch-up charges the player for being away — the opposite of what the genre promises. If a loan is ever added, model it on Animal Crossing/FS22: fixed fee (e.g. borrow 20, repay 25), no deadline, repaid automatically as a % of sales. But with hand digging as the floor, the loan has no job; keep it off the roadmap until the economy has wages/maintenance that can actually go negative (PRD 4.1).

## 5. Verdict and arithmetic

Assumptions: stone sells 2, pickaxe 3 wood × 4 = 12 cash, durability 20, 1 durability per dig, radish ≈ 2.7 cash/energy (profit 8 over 3 actions).

| Stage | cash/energy | Working |
|---|---|---|
| Hand (2 hits/stone) | **1.00** | 0.5 stone × 2 |
| Pickaxe Lv0 | **1.40** | (20×2 − 12)/20 |
| Pickaxe 80% preserve (100 digs) | **1.88** | (200 − 12)/100 |
| Pickaxe 90% preserve (200 digs) | 1.94 | (400 − 12)/200 |
| Vein Lv1, coal 5, Lv0 | 2.00 | drop = 0.8×2 + 0.2×5 = 2.6; (52 − 12)/20 |
| Vein Lv1, coal 5, 90% | **2.54** | (520 − 12)/200 — 6% under farming |
| Vein Lv1, coal 4, 80% | **2.28** | drop 2.4; (240 − 12)/100 |
| Vein Lv1, coal 4, 90% | 2.34 | (480 − 12)/200 |
| Radish farming | 2.7 | 8 / 3 |
| Pumpkin farming | ~8.3 | 50 / (1 + 4 water + 1) |

Hand < Lv0 < max < farming holds everywhere. The `sellPrice` upgrade multiplies stone and crops equally, so ratios survive it; fertilizer changes cash/time not cash/energy. Margin is thin only with coal at 5 and cap 90%; coal 4 + cap 80% fixes it. The sim bot should assert `maxMiningCashPerEnergy(vein, preserveCap) < 0.9 × radishCashPerEnergy`.

Per item:
1. **Keep.** Hand dig from tick 0, no license, 1 hit/energy, stone = 2 hits. Also allow selling from the dig panel when the bag is full.
2. **Keep.** Mine license (50) unlocks crafting + vein. Consider 25 cash + 10 stone instead of 50 cash so hand digging has a goal before the pickaxe **(inference)**.
3. **Change.** Cap 80%; preserve(L) = 1 − 1/(1 + 0.4L); XP = digs; thresholds 10/25/45/70/100/140/190/250/320/400; stone pickaxe ×2 thresholds; a global `digs` counter for vein gating.
4. **Keep.** Drop table with locked rows and %, next-level preview with cost, mastery bar with "lasts ~N digs", crack on the 2-hit node.
5. **Change coal 5 → 4.** Gate (40 stone + 100 cash) is fine: ~2 pickaxes of digging plus 80 cash of foregone stone sales ≈ pumpkin-license scale.
- Wood: pick **one** of durability 25 (Lv0 → 1.52) or wood 3 (Lv0 → 1.55); don't do both (1.7 narrows the mastery payoff). Logging license later as a material source, not as the fix.
- Loan: drop.

## Sources

1. Cookie Clicker wiki — Big Cookie: https://cookieclicker.wiki.gg/wiki/Big_Cookie
2. Melvor Idle wiki — Mastery (XP formula, pool, checkpoints): https://wiki.melvoridle.com/w/Mastery
3. Melvor Idle wiki — Mining (rock HP, mastery unlocks, pickaxes as permanent upgrades): https://wiki.melvoridle.com/w/Mining
4. Melvor Idle wiki — Preservation Chance (80% cap): https://wiki.melvoridle.com/w/Preservation_Chance
5. Melvor Idle wiki — Smithing mastery unlocks (+5% preserve steps): https://wiki.melvoridle.com/w/Smithing
6. Minecraft wiki — Unbreaking (1/(level+1) consumption, 75% at III): https://minecraft.wiki/w/Unbreaking
7. Stardew Valley wiki — Pickaxe (hits per node by tier): https://stardewvalleywiki.com/Pickaxe
8. OSRS wiki — Varrock armour 1 (10% double ore): https://oldschool.runescape.wiki/w/Varrock_armour_1
9. RuneScape wiki — Mining and Smithing rework (progress bar, crits, stamina): https://runescape.wiki/w/Mining_and_Smithing_rework
10. Forager — Tools (permanent upgrades, no durability): https://www.neoseeker.com/forager/faq/Tools
11. Idle Miner Tycoon wiki — Mineshafts (visible milestones): https://idleminertycoon.fandom.com/wiki/Mineshafts
12. Hayao Design Codex — Incremental/Idle ("No click-softlock"): https://hayao.dev/docs/codex/genre-incremental
13. Game Dev Tycoon wiki — Bankruptcy: https://gamedevtycoon.fandom.com/wiki/Bankruptcy
14. IGN — RollerCoaster Tycoon: Corkscrew Follies, Finances: https://www.ign.com/wikis/rollercoaster-tycoon-corkscrew-follies/Finances
15. OpenTTD manual — Economy (Loans): https://wiki.openttd.org/en/Manual/Economy
16. Wikipedia — Recettear: An Item Shop's Tale: https://en.wikipedia.org/wiki/Recettear:_An_Item_Shop's_Tale
17. Nookipedia — Home loan: https://nookipedia.com/wiki/Home_loan
18. r/AnimalCrossing thread on Nook's no-interest, no-deadline loans: https://www.reddit.com/r/AnimalCrossing/comments/1gu6xej/controversial_opinion_tom_nook_was_actually_doing/
19. Stardew Valley wiki — Mining/Skill (professions): https://stardewvalleywiki.com/Mining/Skill
20. Stardew Valley wiki — The Mines (ore by depth): https://stardewvalleywiki.com/The_Mines
21. Gamepressure — Farming Simulator 22: Bank and loan: https://www.gamepressure.com/farming-simulator-22/bank-and-loan/z0f17b
22. GDC Vault — Quest for Progress: The Math and Design of Idle Games (Pecorella; general idle-curve background): https://gdcvault.com/play/1023863/Quest-for-Progress-The-Math
