TILES: ⭐ AS A REAL SECOND CURRENCY (research only; no repo file touched, nothing created or committed)

SUMMARY

1. ⭐ feels pointless because its whole sink list is ⭐62, about 4–8 engaged hours, and all of it buys more orders. Nothing bought with ⭐ touches the farm, mine, workers or Fields.
2. The only late use is 25 ⭐ = 1 deed, which is what makes ⭐ read as a prestige currency. Drop it completely and let the ⭐ balance survive "Sell the farm".
3. Recommended shape is a hybrid: a flat catalogue of permanent rows grouped by system ("⭐ Favours", est. name), ⭐ as a co-price only on top-of-ladder workers (Clerk, Manager), and two no-timer consumables as the endless sink.
4. No tree. Tiles' candidate rows are independent per system, and a drawn tree costs pan/zoom at 375 px.
5. Nothing on the main chain ever costs ⭐, so a player with 0 ⭐ never stalls.
6. First list is 18 rows (6 exist or are pending, 12 new), about ⭐356 one-time (est.), roughly 28 casual hours, close to one run.
7. Earn rate is enough; keep ⭐ 1/2/4. My model gives 8–16 ⭐/h for a casual player and 15–35 active.
8. Two earn-side leaks need a pin first: item orders clamp to half the bag, and 🚜 contracts fill up to 6.7× faster than time-pacing.
9. Clerk passive income is self-capped at about 1–1.5 ⭐/h away, because the Clerk never discards and slots clog. No cap needed.
10. Veterans start from their current balance with no retroactive grant. Toon's ⭐37 buys about 15 % of the new rows on day 1.
11. The catalogue lives in a sheet opened from the HUD ⭐ chip and a "next favour" line on the board header. The phone tab bar is full: I measured 6 buttons using 360 of 360 px.
12. All ⭐/h numbers are from my own inline Python model on balance.ts values, not the repo sim. Every proposed price is (est.).

WHAT I CHECKED IN THE REPO

- `Price` already carries `stars` and `pay()` charges it (balance.ts:78, mining.ts:177–187), so a ⭐ co-price needs no new plumbing.
- On sale, ⭐-bought slots carry, the ⭐ balance converts, and the Clerk certificate resets (prestige.ts:60–77; only plant/water/harvest are kept).
- The Clerk never accepts bars or contracts and never discards (orders.ts:276–299).
- The committed v22 fixture has 48 ⭐ earned in 6.9 h after the board, about 7 ⭐/h. Its pool is 6/6 with 0 on mine, clerk and manager.
- Phone layout: Orders is a closed card under the grid before the Tractor and inside the 📋 sheet after it (App.tsx:191–231, 278–284).

Q1. WHAT MAKES A QUEST-EARNED SIDE CURRENCY WORTH CHASING

What games do:
- OSRS Slayer points: paid per task with streak bonuses. The shop has permanent unlocks (auto-finishers at 10–120 points, craft unlocks at 150–400), extends, buys and task cancel/block. Everything except cosmetics is 3,580 points, about 250 tasks [S1][S2].
- Melvor Slayer Coins: paid for task kills, buy unique gear and area access "critical to game progression", cannot be sold directly [S3].
- NGU Idle quests: a quest finished by hand pays double an idle one; a late perk automates hand-in. Players praise the slow-earned AP shop: "all QoL stuff… didn't hurt overall game-play if you didn't have it" (11) [S4][R4].
- Egg Inc Epic Research: bought with golden eggs (drones, contracts, trophies), "you keep it forever". The rows mix convenience (Hold to Hatch, Silo Capacity) with cost cuts and power; boosts are the endless sink [S7][S8].
- Cookie Clicker sugar lumps: permanent across ascensions. The wiki's spending guide starts with 1 lump each to unlock four minigames, then building levels, then a reason to bank 100 [S6].
- Dinkum: permit points buy licences (Mining 250 / 1,000 / 3,000) that gate what money may then buy [S10].
- Antimatter Dimensions: each challenge "will provide a unique Autobuyer", so automation is earned through a side activity [S12].
- Kittens: science is "a primary component in any upgrades found in the Workshop", a co-price with capped storage [S15]. Factory Idle research points unlock components and "special upgrades to make things easier" [S14].
- Hay Day: town orders give reputation; levels unlock town items and features [S9]. FarmVille 2 CE: order stamps buy Prized Animals and a farm hand, but stamps are also sold for cash [S17].
- Idle Miner Tycoon: 7 kinds of research points unlock skills [S13]. How they are earned: not confirmed.
- Stardew: 130 golden walnuts found by play; 100 open Qi's room [S16]. Qi gems were settled in orders.md.
- Trimps bones persist through portals and buy Bone Trader items [S11].
- Pokéclicker quest points and Slime Rancher bug reports (drones): [snippet] only [S18][S19].

What works and what does not:
- The currency buys things the main currency cannot, and they change the main loop. Tiles today is the Animal Crossing case from orders.md: "nothing for purchase… that I even want anymore".
- The first purchase is cheap and structural (one lump, one minigame).
- The whole catalogue is visible: "Just don't make us buy an upgrade to be able to see details of next upgrade" (12) [R5].
- One sink never ends (cancel/block, boosts).
- One job per currency: "make sure that each currency is clearly meant for a different purpose… Do not overlap" (2); "I wouldn't want to just buy Currency B with Currency A. What's the point then?" (2) [R2].
- It must not gate progress: "just don't lock progress behind this" (25) [R9].
- Convenience priced against power is disliked: "a QoL feature that harms your progression speed" (4) [R8].

Q2. SHAPE

- Flat shop list (OSRS, Egg Inc, NGU): reads well at 375 px and extends by table rows. Weakness: without gates it becomes "buy as they light up".
- Co-price everywhere (Kittens, Dinkum): no new surface, visible in every card. It fails two standing rules: a hand-only player with few ⭐ would stall, and owned things cannot be re-priced, so veterans would see nothing. orders.md already warned that Farm Together's medals became a second cash this way.
- ⭐-only consumables (Egg Inc boosts, OSRS skip): the only endless sink. Timed boosts break "no timers"; untimed ones fit.
- Node tree (Cookie Clicker heavenly tree, IMT island): worth it only when branches are real choices. "whether it's a tree or not is a question of presentation… What matters much more is the content" (10) [R6]; "avoid the enormous… path of exile style trees" (9) [R5].
- Reputation track (Hay Day): lifetime ⭐ unlocks things free. Nothing is spent, so it is not a currency.

Recommendation: catalogue rows grouped by system and gated by existing state like every other row in tiles. Co-price only where a worker is the top of its ladder. Two consumables. The reason is that it is the only shape that reaches every system, shows veterans new rows on day 1, and keeps ⭐ off the main chain.

Q3. FIRST LIST (all new prices and effects est.; the sim pins them)

Orders:
1. Order slot 3, ⭐10. Exists.
2. Order slot 4, ⭐30. Exists.
3. 🔄 Reroll, ⭐2 each. Exists.
4. 📣 Call a buyer, ⭐3 each, consumable. Gate: 10 orders. You pick the good of one slot's next offer; the tier is still rolled. Worth it: ends waiting for the right vegetable. Average return is 1.8 ⭐, so it is a net sink. No stall: the board works as today without it.
5. 🤝 Preferred supplier Lv1–3, ⭐12 / 20 / 30. Gates: 15 / 40 / 80 orders. Order and contract bonus 10 % to 15 / 20 / 25 %. Worth it: deliveries make the town pay more. No stall: 10 % stays the base.
6. Clerk certificate, ⭐20 + 🥉6 + 💰200. Exists.

Farm:
7. 🧺 Cold cellar, ⭐5. Gate: board owned. Home-lot rot window 2× to 3× grow time. The cheap first buy, aimed at hand players. No stall: workers already beat rot.
8. 🗺 Bed plans, ⭐12. Gate: 2 licenses and 12 tiles. Each bed has its own crop to plant; taps and the planter follow it. Worth it: removes the crop-switching chore and lets two crop orders fill at once. No stall: one crop to plant still works.
9. 💧 Fine mist, ⭐25. Gate: 1 sprinkler. A sprinkled bed grows ×1.1. This is the parked irrigated-bed bonus and needs its own go.

Mine and furnace:
10. 🔧 Whetstone, ⭐8 + 🥉4. Gate: copper pickaxe. A blunt pickaxe is repaired from storage at the normal repair price. Worth it: removes the miner's blunt-pickaxe waste. No stall: manual repair stays.
11. 🍱 Deep tray, ⭐6 + 🥉4. Gate: 10 bars. Output tray 5 to 10 bars. No stall: collecting by hand still works.
12. 🔁 Smelt list, ⭐15. Gate: ore loader and iron. The loader works through a list of ore kinds. Check against batch 33 (molds) before accepting.

Workers:
13. 🏠 Bunkhouse I / II, ⭐30 / ⭐60. Gate: pool 6 full. Pool cap 7, then 8. The hire still costs cash on the existing curve (💰3,621 and 💰6,155). Worth it: the pool cap is the real late constraint. No stall: cap 6 as today.
14. 📑 Rosters, ⭐8. Gate: 3 certificates. Two saved worker assignments, one tap to swap.
15. 💼 Manager certificate, 🥇4 + ⭐40 + 💰1.5M. Pending; keep the ⭐.

Estate and cosmetic:
16. ⚡ Reaper's grip, ⭐20. Gate: Tractor and 5 hand reaps. Hand reap costs ⚡6 instead of ⚡10. Worth it: more of the ×1.25 hand reaps into contracts.
17. 🏷 Farm name, ⭐5. Text only, shown on the Estate header and in the sale history.
18. Held for later, not in the first batch: a discarding Clerk (see Q8).

One-time total: 100 existing or pending + 256 new = ⭐356.
Considered and rejected: a glut reset for ⭐ (gives ⭐ a cash price), ⭐ for bars (bars sell, which breaks "nothing bought with ⭐ sells for cash"), a longer offline cap (the community reads it as paying for something owed).

Q4. INCOME AND PRICE SIZING

Formula: every tier pays 0.2 ⭐ per production-minute (1/5, 2/10, 4/20), so one fully used line earns 12 ⭐/h. The home lot is one crop line; each vein drop is its own parallel line.

Model (est.), ⭐ per online hour by slots owned (1 / 2 / 3 / 4):

    Stage and play style                       1      2      3      4
    Early, hand, checks every 15 min          4.7    8.0   10.1   11.4
    Early, hand, checks every 2 min           9.4   13.2   14.5   15.1
    Mid, workers, every 15 min                3.9    7.5   10.7   13.3
    Mid, workers + Clerk, every 15 min        7.4   13.0   16.4   18.3
    Mid, hand-only, every 15 min              3.0    5.7    8.0    9.9
    Late home, every 15 min                   4.0    7.3   10.1   11.9
    Estate, 8 fields, every 15 min            4.1    8.1   12.0   15.9
    Estate, 8 fields, every 2 min             9.8   18.9   27.1   34.2
    Any stage, by hand, hourly check          1.2    2.3    3.2    4.0

Away for 8 h with 4 slots: 8–12 ⭐ with a Clerk, 2–4 without, 0 for a hand-only farm.
Cross-checks: the batch-14 sim measured 11 / 5 / 10 ⭐/h for crop-only bots, and the fixture shows 7 ⭐/h.

Prices in casual hours (8 ⭐/h early, 12 mid, 15 estate):
- Early: Cold cellar 0.6 h, slot 3 1.25 h, Bed plans 1.5 h, Deep tray 0.75 h. Sum ⭐33, about 4 h.
- Mid: Whetstone, Clerk, slot 4, Supplier I–II, Rosters, Smelt list. Sum ⭐113, about 9.5 h.
- Late home: Fine mist, Bunkhouse I, Supplier III. Sum ⭐85, about 7 h.
- Estate: Bunkhouse II, Reaper's grip, Manager. Sum ⭐120, about 8 h.
- Total about 28 casual hours. The bot's first sale is at 17.6 h, so a human run is roughly 25–40 h.

Two leaks to pin before prices mean anything:
- Half-bag clamp (orders.ts:77): at bag 30 a 5-minute stone order is 48, clamped to 15, at any tier. That is 69 ⭐/h per stone line at 12 rocks/min against the intended 12. Board-wide it adds about 5–15 % for normal play and about 70 % for an items-only discarder (19.6 against 11.7 ⭐/h at bag 20). A smaller bag makes orders cheaper. Fix: item orders deliver in loads, like crop orders, and the clamp goes.
- Contracts: a contract asks for 15 % of wet output, so an estate that serves it earns up to 12 ÷ 0.15 = 80 ⭐/h. The repo's own pin finished a 20-minute, ⭐4 contract in 5 game-minutes (PLAN.md:5410–5412). Acceptance is manual, so this is active income. Keep it, and have the sim report the ceiling.

Q5. PRESTIGE

What games do: Cookie Clicker lumps and levels, Egg Inc epic research and Trimps bones all persist [S6][S7][S11]. The earlier community report found players quit over "Repeatedly getting my automation taken away" (26).

Recommendation:
- Drop 25 ⭐ = 1 deed. Toon's ⭐37 is 1 deed beside the 71 the bot's first sale pays, so it is worthless as a bonus yet it is the only late use.
- The ⭐ balance carries through the sale, so nothing needs converting.
- Convenience rows carry, as slots already do: Cold cellar, Bed plans, Whetstone, Deep tray, Smelt list, Rosters, Reaper's grip, Farm name.
- Rows tied to the farm reset with it: Preferred supplier, Bunkhouse, Fine mist, and the Clerk and Manager certificates as today. That is about ⭐237 to re-buy per run, which keeps ⭐ a currency after run 1.
- One side effect: a player with 0 cash deeds and 25+ ⭐ can sell today and could not afterwards.

Q6. VETERANS

- Start from the current balance. No grant from lifetime ⭐, no refund of spent ⭐, nothing owned re-priced. This follows the earlier pacing report: new gates are accepted, cuts to owned value make people quit.
- Gates read existing state, so every row is open for Toon on day 1. That is not a windfall: ⭐37 against ⭐256 of new rows.
- His likely first buy is Bunkhouse I (⭐30) plus the 💰3,621 hire. The Manager needs 3 more ⭐.
- No loss: 4 slots and the Clerk stay, and the balance is no longer consumed by the sale.

Q7. MAKING THE PURPOSE VISIBLE

- Shop row for the Notice board: one more line naming three things ⭐ buys.
- Board header: "⭐ 4 · next: 🧺 Cold cellar ⭐5 ›". It opens the sheet and always names the cheapest unowned row.
- The sheet shows every row from the first open, with price and gate text, like Workshop recipes.
- Order-complete toast: "+⭐2 · 6/10 to Slot 3".
- Put the row at the wall: Bunkhouse next to "pool full", Bed plans under Crop to plant.
- The HUD ⭐ chip opens the same sheet and carries the batch 31.1 badge dot when a row becomes affordable.

Q8. CLERK AND CONTRACTS

- The Clerk takes 5 of 10 goods mid-game, 6 of 16 late and 5 of 16 after the Tractor. A slot finishes about 1.0 / 0.6 / 0.45 orders before an offer it cannot take blocks it. That is the cap: about 10 % of engaged income.
- A discarding Clerk would lift away-income to roughly 8–10 ⭐/h (est.). If it ever ships, Clerk-finished orders should pay half, as NGU does for idle quests. Do not ship it in the first list.
- The Manager never accepts contracts (locked), so contract ⭐ always needs a press.
- The Manager's 10-contract gate pays about 18 ⭐; the other 22 are saved, about 2 h.

FIRST HOUR AFTER IT SHIPS

A. Fresh player, including hand-only and stingy:
- Minutes 0–15: unchanged. No ⭐ on screen.
- Around 50 sales the Notice board row appears and now says what ⭐ buys.
- After buying it, the header reads "⭐ 0 · next: Cold cellar ⭐5".
- By minute 45–60 a hand player has ⭐5–8 and buys Cold cellar, or saves for slot 3.
- A player who never opens the board loses nothing: every license, tool, certificate, the furnace, veins, Workshop and Tractor cost what they cost today.

B. Veteran with a migrated save (Toon):
- Loads with ⭐37, 4 slots and the Clerk. The changelog line and a dot on the ⭐ chip point at the sheet.
- The sheet shows 3 rows owned and every other row open.
- He picks between Bunkhouse I now and the Manager after 3 more ⭐. That choice is the point.
- The Sell card no longer shows "from ⭐"; it says the ⭐ balance is kept.
- Within the hour at 12–16 ⭐/h he adds one or two small rows.

DECISIONS (reply with the numbers you reject)

1. H1: keep "cash cannot buy ⭐", and add "no ⭐ purchase has a cash price". Reason: a currency bought with another has no job of its own.
2. H2: drop 25 ⭐ = 1 deed entirely, no leftover bonus. Reason: it is under 2 % of a sale and the only thing making ⭐ a prestige currency.
3. The ⭐ balance carries through "Sell the farm". Reason: nothing earned is lost and nothing needs converting.
4. H3: the catalogue is a sheet opened from the HUD ⭐ chip and the board header; no new tab. Reason: the tab bar measured 360 of 360 px.
5. Shape: catalogue rows by system, co-price only on Clerk and Manager, two consumables, no tree. Reason: it reaches every system without gating progress.
6. Name it "⭐ Favours", not research. Reason: the town returns favours for deliveries.
7. No main-chain item ever costs ⭐. Reason: a player with 0 ⭐ must never stall.
8. Ship rows 4, 5, 7, 8, 10, 11, 13, 14, 16, 17 at the listed (est.) prices, sim-pinned. Reason: about 28 casual hours of goals.
9. Rows 9 and 12 wait for their own go. Reason: one is a parked idea, the other may overlap batch 33.
10. Keep ⭐ 1 / 2 / 4 per order. Reason: 8–16 ⭐/h makes prices of 5–60 readable.
11. Item orders deliver in loads and the half-bag clamp goes. Reason: the clamp pays up to 5.8× the intended rate per line and rewards a small bag.
12. Contracts keep their ⭐ and stay player-only; the sim reports the ceiling. Reason: it is the one recurring decision and cannot run unattended.
13. Convenience rows carry on sale; Supplier, Bunkhouse, Fine mist and worker certificates reset. Reason: convenience is never re-earned, and ⭐ keeps a job each run.
14. Veterans start from their balance; no retroactive grant. Reason: ⭐37 is 15 % of the new rows.
15. Keep ⭐40 on the Manager. Reason: it is top of its ladder and the gate itself pays about 18 ⭐.
16. Clerk unchanged; no discarding Clerk now. Reason: slot clogging already caps away-income at about 1–1.5 ⭐/h.
17. Visibility: Shop line, header "next" line, all rows visible, toast progress, rows at the wall. Reason: answers "why deliver" before the first order.
18. Mine and furnace rows carry a small bar line. Reason: the batch 28.2 rule that a convenience costs some of what it eases.
19. This needs a save bump (owned rows, bed crops) and a renumber against batch 32. Reason: the shape changes.
20. Sim pins: ⭐/h for a hand-only bot, a Clerk bot and a contract chaser, plus "a no-orders bot reaches the Tractor unchanged". Reason: my numbers are a model, not the repo sim.

SOURCES ([snippet] = search-result text only)

Wikis opened:
- [S1] https://oldschool.runescape.wiki/w/Slayer_reward_point
- [S2] https://oldschool.runescape.wiki/w/Slayer_Rewards (unlock table read; cancel/block prices [snippet] from https://oldschool.runescape.wiki/w/Blocklist)
- [S3] https://wiki.melvoridle.com/w/Slayer and https://wiki.melvoridle.com/w/Slayer_Coins
- [S4] https://ngu-idle.fandom.com/wiki/Questing
- [S5] https://ngu-idle.fandom.com/wiki/Quirk_Points
- [S6] https://cookieclicker.fandom.com/wiki/Sugar_Lump
- [S7] https://egg-inc.fandom.com/wiki/Research/Epic_Research
- [S8] https://egg-inc.fandom.com/wiki/Golden_Eggs
- [S9] https://hayday.fandom.com/wiki/Reputation and https://hayday.fandom.com/wiki/Town
- [S10] https://dinkum.fandom.com/wiki/Licences
- [S11] https://trimps.fandom.com/wiki/Resources#Bones
- [S12] https://antimatter-dimensions.fandom.com/wiki/Challenges
- [S13] https://idleminertycoon.fandom.com/wiki/Research
- [S14] https://factoryidle.fandom.com/wiki/Research
- [S15] https://wiki.kittensgame.com/en/general-information/resources/science
- [S16] https://stardewvalleywiki.com/Golden_Walnut
- [S17] https://farmvillecountryescape.fandom.com/wiki/Stamp
- [S18] https://slimerancher.fandom.com/wiki/Viktor%27s_Workshop (intro only); rewards [snippet] https://www.thegamer.com/slime-rancher-how-to-unlock-viktors-workshop-slimeulation-guide/
- [S19] [snippet] https://www.reddit.com/r/PokeClicker/comments/1pkizjq/quest_points/

Reddit, read through the Arctic Shift archive (https://arctic-shift.photon-reddit.com/api), scores in brackets above:
- [R1] https://www.reddit.com/r/incremental_games/comments/1n5iqeh/ (read, not quoted)
- [R2] https://www.reddit.com/r/incremental_games/comments/swmnkh/ (post and 25 of 30 comments)
- [R3] https://www.reddit.com/r/incremental_games/comments/1tf2ym5/ (read, not quoted)
- [R4] https://www.reddit.com/r/incremental_games/comments/11kahac/
- [R5] https://www.reddit.com/r/incremental_games/comments/1qg2dsq/
- [R6] https://www.reddit.com/r/incremental_games/comments/1qoix5a/
- [R7] https://www.reddit.com/r/incremental_games/comments/1tc2v48/ (read, not quoted)
- [R8] https://www.reddit.com/r/incremental_games/comments/1x0lglh/
- [R9] https://www.reddit.com/r/incremental_games/comments/1ie0epc/

Reused from earlier reports, not re-opened: the Animal Crossing "miles have become pointless" thread and Farm Together medals (orders.md), the quit-reason threads (incremental-community.md), the veteran-rebalance cases (pacing-liveops.md).

Not confirmed:
- How Idle Miner Tycoon research points are earned.
- Pokéclicker and Slime Rancher details beyond snippets.
- OSRS cancel and block prices.
- The tab-bar width was measured in a 375 px frame on desktop Chrome with a 15 px scrollbar; a phone has about 15 px more.
- Toon's total play hours, so his real ⭐/h is unknown.
