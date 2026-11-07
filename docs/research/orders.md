Research and arithmetic done; nothing was written to the repo. Report follows.

REPORT: orders board + ⭐ second currency for tiles (research only)

Method: read DECISIONS/PLAN/PRD/balance.ts/state.ts and both previous reports; pulled the wiki pages for Hay Day, Township, Stardew, Farm Together, Egg Inc, Moonlighter, Sun Haven, Coral Island, Dinkum, ACNH, Satisfactory, plus Reddit threads; modelled order sizes, ⭐ rates and the rule-3 check in Python on balance.ts values (100 % uptime, same basis as the two earlier reports; rerun tests/sim.test.ts bots before pinning anything).

Two things in tiles shape the whole design and the cash-sinks sketch missed them: (1) harvest sells instantly, there is no crop inventory (PLAN deviation "no sell action"), so crop orders cannot be "deliver from storage"; (2) only items (stone/coal/ore/bars) have storage. So an order needs two fill paths, which turns out to be a feature (see rec. 4).

======================================================================
1. SUMMARY — recommended design (reject by number)
======================================================================

1. Noticeboard = a thing you own: 🛒 Shop card "📋 Noticeboard", 💰100 (+10 stone), hidden until 50 sales (same gate style as sellPrice). Not automation, so no certificate; it is bought, not free.

2. Board = N offers, each one good + count + size tier. Start 2 slots; the 3rd and 4th slots are the first ⭐ purchases (Hay Day grows 1 → 9 slots with level; Township grows with population; Moonlighter/Farm Together cap at 3 active). One good per order in v1; v2 "large" orders may ask two goods (Hay Day boats ask 3–5).

3. Generator on run.rngState, rolled in the action that opens a slot (complete/discard/buy slot), so runs replay. Good pool = exactly what the player can make now: licensed crops; items in the current vein's drop table (stone from the mine license, coal Lv1+, copper ore Lv2+, iron/gold later); bars once the furnace is built; Workshop products once it exists (batch 14 — the generator reads the same tables, no new rule). Hay Day asks only for what your level can make (truck page); its one famous failure is asking for a machine you unlocked but have not built yet ("Impossible Boat Order" thread) — reading owned licenses/vein/furnace avoids that. Count = sizeMinutes × capacityPerMinute(good, state): crops = tiles ÷ growTicks × 60; items = NOMINAL_ROCKS_PER_MIN (balance constant, start 12) × drop share; bars = furnace bars/min. Size tiers 5 / 10 / 20 min with weights 50/35/15 %. Item orders clamp count ≤ ⌊bagCapacity ÷ 2⌋ (sim-asserted, like stone prices; a 20-min copper-ore order at vein Lv2 would be 36 > 20).

4. Two fill paths, one rule each. Crops: while an accepted order for crop c is open, every harvest of c (player, tool press, worker) goes to the order instead of the market and pays base × (1 + ORDER_BONUS) at the harvest (no escrow, nothing lost if abandoned); the order counts down. Items: a "Deliver" button moves the count from storage (0 energy, like sell). This is Stardew's "Crop Order" (ship N, bonus on top) for crops and Hay Day's truck for materials.

5. Reward = cash bonus + ⭐. ORDER_BONUS start 0.25 of base sell value on the ordered goods (bars valued at their inputs, 6). Stardew's Crop Order pays +50 %, Help Wanted/Coral Island pay 3× for one item; 0.25 is the conservative start because tiles routes a large share of harvests through orders (arithmetic §2) — 0.5 is the ceiling. ⭐ by size tier: 1 / 2 / 4. Since count = minutes × capacity, ⭐ is paced by time, not by tile count or crop price: 12 ⭐ per hour of production routed through orders, for a 9-tile carrot farm and a 24-tile lemon farm alike. That is the anti-inflation property (Satisfactory's coupon curve, Nook Miles+ tasks worth a fixed 100–500 each); ⭐ prices stay meaningful for every player.

6. No expiry, no timers in v1. Offers sit until completed or discarded (Hay Day truck orders never expire; only boats do, and boats are the complaint magnet). Discard = free, the slot refills after a 10-min cooldown counted in step() (Hay Day 6–30 min by level, Township 30 min or 4 T-cash, FarmVille 2 CE 10 min "no penalty"). Worst-case 8 h offline loss = 💰0 and ⭐0: nothing expires, nothing is charged; accepted crop orders keep filling from worker harvests (bounded by the missing planter, as batch 8 measured); offers that appear while away simply wait. If Toon ever wants rush orders (×2 bonus, 30-min timer), the timer must run on live ticks only (the loan rule), so offline can never fail one.

7. ⭐ is cash-proof: no ⭐ item has a resale price or a cash equivalent, cash cannot buy ⭐ (correcting the brief: Hay Day vouchers CAN be bought with diamonds, 2/3/5/8 each — only the premium path; Dinkum sells permit points for Dinks at 500:1; Stardew Qi gems have no purchase path and convert out at ≤ 300 g each). First ⭐ shop (8 rows): name plate 5; 3rd order slot 10; three tile themes 8 each; reroll token 2 (consumable: refill every slot now, ignores cooldown); weather vane / pump skin 12; 4th slot 30; order-clerk certificate 20 ⭐ + 🥉6 + 💰200 (rec. 9). Total ≈ 103 ⭐ ≈ 13–26 h of goals at 4–8 ⭐/h. No tiles and no cash-rate upgrades in the ⭐ shop (land stays cash + bars per the cash-sinks report), so rule 3 cannot leak through ⭐.

8. State: run.orders = { unlocked, slots, offers: {good, count, done, tier, accepted}[], cooldown per slot }, run.stars, counters.orders (completed; gates the clerk), lifetime.ordersCompleted / starsEarned; ORDER_* numbers and the ⭐ shop table in balance.ts; v9 → v10 adds them with defaults (nothing taken away). Cosmetics bought with ⭐ go to meta (survive prestige).

9. Automation (Q5): yes, as a worker, and only for the chores. The clerk's action (5-s clock, 💰1 wage, same pool) = deliver an item order that storage can fill, else accept any offer whose good the farm currently grows or the vein drops. Discard stays manual (it is the one decision). Ladder holds: manual board → certificate (⭐ + bars, gated by 20 orders completed) → no machine tier (nothing to make instant). Offline value: without a clerk, ⭐/h offline is 0 after the accepted orders complete; with one, wages bound it at 💰1 per accept/deliver.

10. Market + prestige (Q6): ordered crops bypass the market (no saturation push, paid at base × 1.25) — orders are the outlet the PRD market needs, exactly as the brief guessed. Generator weight in v1: uniform over licensed crops; v2 lever: weight ∝ 0.5 + (1 − marketPrice/base) so the town asks for what you flooded. Prestige: ⭐ lives in run; at "Sell the farm" unspent ⭐ convert to deeds (e.g. 25 ⭐ → 1 deed) so nothing earned is lost; ⭐ cosmetics, slots and lifetime order stats sit in meta. Do not make ⭐ the deed currency itself — then mining orders would buy prestige power at the same rate as farming.

11. Batch fit: after batch 11 (plant worker, iron, mine worker), before 12 — the goods pool is then 4 crops + stone/coal/copper/iron ore + bars, and every later batch (gold, Workshop recipes, Fields) extends the pool through the tables with no generator change. If Fields lands first, capacity reads the total tile count and the crop path hooks the "ready → harvested" transition of the aggregate bars; nothing else changes.

======================================================================
2. ARITHMETIC
======================================================================

Basis (balance.ts): lemon 360 ticks, seed 20, sell 110 (net 90, 10 cycles/h, 💰900 per tile-hour); pumpkin 240/10/60; chilli 160/5/25; carrot 100/2/10.

Order sizes (count = minutes × capacity), 5 / 10 / 20-min tiers:
- lemon 9 tiles: 8 / 15 / 30 lemons; 24 tiles: 20 / 40 / 80.
- pumpkin 9: 11 / 22 / 45; 24: 30 / 60 / 120. chilli 9: 17 / 34 / 68. carrot 9: 27 / 54 / 108.
- vein Lv2 at 12 rocks/min: stone 39 / 78 / 156, coal 12 / 24 / 48, copper ore 9 / 18 / 36 (20-min clamped to 20 at storage 40). Vein Lv4: iron ore 6 / 12 / 24, gold ore 5 / 10 / 19. Bars (1/min base furnace): 5 / 10 / 20.
- The cash-sinks sketch's "20–40 lemons per ~10 min" matches the 24-tile medium tier; at 9 tiles it would be a 15–25-min order, which is why sizes must come from capacity, not fixed numbers.

Cash bonus (ORDER_BONUS 0.25 on base value) as % of net income, lemon:
- 24 tiles, 21,600/h: 40 % of harvests through orders → +💰2,640/h (+12 %); 60 % → +3,960 (+18 %).
- 9 tiles, 8,100/h: 40 % → +990/h (+12 %). At 0.5 the same shares give +24 % / +37 % — that is why 0.25 is the start; the cash-sinks "≤ +2,000/h at ×1.3" assumed ~15 % utilisation and undersold the board.
- Item orders are ⭐ carriers, not cash: a 10-min copper-ore order pays 💰4–5 bonus; 10 bars pay 💰15.

Rule 3 (mining < farming per energy): orders multiply every good's sale by the same 1.25, so the hierarchy is unchanged. Vein Lv2, copper pickaxe ≈ 1 rock/energy: base 0.65×2 + 0.2×4 + 0.15×1 = 2.25; everything through orders 2.81; cap 0.9 × pumpkin 8.18 = 7.36 (and farming through orders rises too). Bars at 💰7.5 per bar through orders imply ore at (7.5 − 5)/2 = 1.25 — nothing moves. The ⭐ side is cash-free by rec. 7. The sim should assert "max mining cash/energy with every sale at (1 + ORDER_BONUS) < 0.9 × pumpkin without orders" so a future bonus raise cannot slip past.

⭐ per hour: 12 ⭐ per production-hour routed through orders. Realistic utilisation 25–60 % (offers for goods not currently planted, slot limits) → 3–7 ⭐/h from the farm + ~1–3 from item orders mined with idle energy → 4–10 ⭐/h, independent of tile count. First shop ≈ 103 ⭐ → 13–26 h of goals; 3rd slot (10 ⭐) in the first 1–2 h, 4th slot (30 ⭐) at ~5–8 h.

Storage fit: every item order count ≤ ⌊bagCapacity/2⌋ at the vein level it can appear (copper ore 20-min at Lv2 = 36 → clamped to 20; bars 20 ≤ 20). Sim-enforced like the stone-price rule.

Offline worst case (rule 4): 💰0 upkeep, nothing expires; with a clerk, ≤ 💰1 per clerk action and the clerk idles when there is nothing to accept or deliver (same "no target = no wage" rule as every worker). Bounded by the action count, which is bounded by what workers harvest offline (batch 8 measured 15 worker actions in 8 h without a planter).

======================================================================
3. FINDINGS PER QUESTION
======================================================================

Q1 — How real games do it
- Hay Day truck/order board [1]: unlocked L4; 1 order → max 9 at L32; orders ask only crops/products the player can make at their level (lures, nets, ore, feed excluded); each order filled all at once; completed orders are replaced when the truck leaves; discard → 6–30 min penalty by level; rewards coins + XP (high-coin orders give less XP); June 2025 rebalance ×2.5 coins ×2 XP, plus random vouchers for smelter/jeweller orders, and jewellery orders can beat max roadside price. Boat [2]: L17; 3–5 item types in up to 4 crates each, quantity per crate scales with the item's production time; same ingredients never in one shipment; stays 18 h (was 12–18), auto-leaves; next boat 4 h later and only arrives when you load the game ("not accounting for off-game time"); skip free by casting off before asking for help; since 2025 you pick easy/medium/hard destinations with a refresh button. Town visitors [3]: arrive by train every 6 h, want services, pay coins/XP/reputation, can be rejected. Vouchers [4]: five colours, buy pets, decorations, customisation and lure materials; measured rarity 1 gold : 5 purple : 10 blue : 25 green; buyable with diamonds 2/3/5/8.
- Township helicopter [5]: from the start; order count grows with population; "some even offer less coins than selling the goods in barn"; trash → 30 min or 4 T-cash (falling to 1 near the end).
- FarmVille 2 CE (third-party guide only) [6]: order board, reject an order → new one in 10 min, "no penalty".
- Farm Together [7][8]: three quests at once, discard one per 24 h; medals from quests, stalls (20 honey → 1 medal) and jobs; medals buy "pretty much any building that isn't a shop or a house".
- Stardew Help Wanted [9]: one random quest per day, 2-day limit, no penalty for not finishing; item delivery asks only for things the player can access (season, Mines floor, Desert); pays 3× the item's normal-quality sell price + 150 friendship; Clint asks 20–40 ore. Special Orders [10]: board from Fall 2 Y1, two new orders every Monday, 7–28 days, the clock runs whether accepted or not, cannot be cancelled; rewards are gold (500–6,000 g) + recipes you cannot buy (Geode Crusher, Mini-Obelisk, Bone Mill…); "Crop Order"/"Island Ingredients" = ship the crop, get +50 % of base price on top. Qi's board [10][11]: two per Monday, 3–28 days, 20–50 Qi gems each (Danger in the Deep 50, Four Precious Stones 40, Qi's Cuisine 25 for 100,000 g of cooking).
- Moonlighter [12]: quests from Shop Level 2; one per day, max 3 active, 3 days to deliver, must open the shop on the due day or it fails; fetch pay "should be greater than selling (requires confirmation)".
- Sun Haven [13]: regional bulletin boards, random tasks that refresh daily and expire at the daily reset; gold + XP (+ regional items). Coral Island [14]: errand boards, randomised, time-limited; Town Courier asks seasonal crops at the player's town rank or animal products only if the building is owned; pays 3× base + 250 friendship.
- Egg Inc contracts [15]: weekly, 13 per season, "deliver as many eggs as specified within a time limit", ≤ 3 contract farms active, up to 3 rewards (prophecy/soul/golden eggs, boosts, epic research), goals and rewards scaled by a grade (C–AAA) from earnings bonus + 30-day history; a missed deadline fails the contract.
- Potion Craft [16]: every customer is a request with conditions; refusing or serving dubious customers moves popularity/reputation — customer-stream, not a board. Shop Titans: not researched (see gaps).

Q2 — Love vs hate (quotes)
- Impossible asks: "12 hours later, I get a boat order with 4 duck feathers!? What a joke" / "the game can't detect whether you already opened the unlocked machine" / "Surely it should only ask for things once we are past each level it unlocks" [17]. → Generate from owned licenses/vein/furnace, never from "unlocked".
- Rewards below selling: Township "I've gotten some offers for less money than if I just sold directly from my inventory"; "I don't fill any order that's not around 1,000 coin"; "I don't fill any orders where they want more than 1 of any product" [18][19]. Hay Day pre-2025 "trucks not being worth it" became "a truck order pays more than max roadside stand" after the ×2.5 rebalance [20]. → The bonus must be visibly above the market price, and one-good orders avoid the "multi-product" dump reflex.
- Timers: Stardew "Robin's Rush is BS — it says a week time limit, yet I only had 3 days left" [21]; Hay Day's boat timer is the thing players "just send away" [17]. Nook Miles+ (no timer, tasks complete from normal play) draws no such threads; its late-game complaint is the opposite: "nothing for purchase with Nook Points that I even want anymore" [22]. → No expiry; a shop that keeps getting items (Workshop recipes, themes).
- Grind vs. reuse: Qi players value challenges you can finish "immediately" from stock or with staircases and skip the rest ("none provide a good return on your time to do repeatedly") [23][24]. → Small orders fill from what the farm already does.

Q3 — Second currencies
- Stardew Qi gems [11]: earned only from Qi orders (20–50), dangerous-mine drops and walnut trades; cannot be sold; shop 1–100 gems (Hopper 10, Enricher/Pressure Nozzle/Key to the Town 20, Mini-Shipping Bin 60, Golden Egg 100); best cash-out ≈ 300 g per gem via deconstructed hoppers — trivial for a player who has 100 walnuts. Rule: unique permanent items, no inflow from gold.
- Hay Day vouchers [4]: pets/decor/customisation; the sink is cosmetic and rare (1 gold per 41 vouchers) — but diamonds buy them, so they are not cash-proof.
- Farm Together medals [7][8]: earned from quests and stalls; buy almost every non-shop building; a second gate on content, not cosmetics.
- Satisfactory coupons [25]: 1,895 coupons buy every non-producible item (≈ 11.4 h at max sink rate), 347 for every non-repeatable; prices 1–50 (Golden Factory Cart 50); the sink's quadratic coupon cost is what keeps the currency slow.
- Dinkum permit points [26]: 100 per bulletin task, 50 per daily NPC task, 100 per museum donation; buy licences and boat items; Dinks convert at 500 : 1 (a floor, not a path).
- ACNH Nook Miles [27]: tasks pay 100–500 each; redeem for tickets, inventory upgrades, recipes; 500 miles → 3,000 bells (1 mile = 6 bells, poor); cap 9,999,999.
- Design rules that fall out: (a) time-paced earn rate, not scale-paced; (b) sinks are permanent unlocks, slots and cosmetics, plus one cheap consumable; (c) no cash → ⭐ path at all, or only a ruinous one; (d) keep adding items or the currency goes "pointless" (ACNH); (e) never price the main progression gate in it or it becomes a second cash (Farm Together medals).

Q4 — Fit: recs 1–8, arithmetic §2.

Q5 — Automation: rec. 9. Precedent is thin: no farm game automates its board (Hay Day's "ask for help" is social); Stardew's Special Orders auto-complete when conditions are met, which is the crop-routing idea. The crop path needs no worker (harvests route themselves), so the clerk only owns deliver/accept and is wage-bounded.

Q6 — Market + prestige: rec. 10. Stardew's Crop Order is the one shipped example of "orders pay on base price regardless of what you ship elsewhere"; no researched game lets orders bypass a saturation market, so the bypass is tiles' own rule — it is systemic (one routing rule) rather than special-cased.

======================================================================
4. SOURCES
======================================================================
1 https://hayday.fandom.com/wiki/Truck
2 https://hayday.fandom.com/wiki/Boat
3 https://hayday.fandom.com/wiki/Town_Visitors ; https://hayday.fandom.com/wiki/Town
4 https://hayday.fandom.com/wiki/Voucher
5 https://township.fandom.com/wiki/Helicopter
6 https://discover.hubpages.com/games-hobbies/Farmville-2-Country-Escape-Tips-Guide
7 https://farmtogether.fandom.com/wiki/Quests
8 https://farmtogether.fandom.com/wiki/Medals
9 https://stardewvalleywiki.com/Quests
10 https://stardewvalleywiki.com/Special_Orders
11 https://stardewvalleywiki.com/Qi_Gem ; https://stardewvalleywiki.com/Qi%27s_Walnut_Room
12 https://moonlighter.fandom.com/wiki/Quests
13 https://sunhaven.wiki.gg/wiki/Sun_Haven_Bulletin_Board
14 https://coralisland.wiki/wiki/Quest
15 https://egg-inc.fandom.com/wiki/Contracts
16 https://potion-craft.fandom.com/wiki/Requests
17 https://www.reddit.com/r/HayDay/comments/1spy4nh/impossible_boat_order/
18 https://www.reddit.com/r/TownshipGame/comments/1nryues/these_orders_are_such_a_joke/
19 https://www.reddit.com/r/TownshipGame/comments/1i6irha/helicopter_orders_dont_pay/
20 https://www.reddit.com/r/HayDay/comments/1qgm1d9/are_truck_orders_really_not_worth_it/
21 https://www.reddit.com/r/StardewValley/comments/opyu2t/robins_rush_is_bs/
22 https://www.reddit.com/r/AnimalCrossing/comments/1ub4q29/anyone_else_think_miles_have_become_pointless/
23 https://www.reddit.com/r/StardewValley/comments/1o3z51m/qi_gems/
24 https://www.reddit.com/r/StardewValley/comments/1akde34/most_liked_and_disliked_qi_challenge/
25 https://satisfactory.wiki.gg/wiki/AWESOME_Shop
26 https://dinkum.fandom.com/wiki/Permit_Points
27 https://nookipedia.com/wiki/Nook_Miles%2B

Could not confirm: Shop Titans' request/quest system and its currencies (not researched — only guide/FAQ hits came back); FarmVille 2's order rules beyond a third-party tips page (Zynga's help pages were not reached); Hay Day's exact coin formula per order and the voucher rarity ratio (a wiki editor's own measurement); Moonlighter's "fetch pays more than selling" (the wiki itself marks it unconfirmed); ACNH's Nook Miles+ slot count (the page I pulled lists task values but not the five-task limit) and the Nook Miles Ticket price (not in the extracted text); Egg Inc's exact contract durations (the wiki says "a certain time limit", no numbers pulled); any design article on order-board generation — searches returned nothing usable, so the generator rules above are derived from the games, not from a published method. All tiles numbers in §2 are my model on balance.ts values, not the repo sim.
