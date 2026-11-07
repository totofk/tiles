Research and modelling done. Full report follows (nothing in the repo was touched; no git/pnpm/build run).

REPORT: prestige for tiles — when, what resets, what carries, how to make the first one feel good (research only)

Method: read DECISIONS/PRD/PLAN/balance.ts/state.ts, docs/research/*, both previous reports; checked 12 games' wikis/FAQs/forums (URLs §4); wrote a 1-tick Python model of a greedy perfect player on balance.ts numbers (9 tiles, energy-bound, buys licenses/upgrades/workers/tiles greedily) to compare run 1 vs run 2 under candidate meta upgrades. Model is an upper bound (perfect play, no mining spend); only ratios are load-bearing. Rerun tests/sim.test.ts before pinning absolutes.

======================================================================
1. SUMMARY — recommended design (reject by number)
======================================================================

Earliest landing: after batch 14 (Workshop + sprinkler), i.e. batch 15/16. Prepare in the next shape migration (rec. 10) at near-zero cost. Reason: every reference game puts the first reset after the whole first layer has been seen once (AdCap all businesses, Trimps zone 20 map, Clicker Heroes hero level 150, FAPI area 1-8-50), and tiles' first layer ends at the sprinkler.

1. Name and fiction: "Sell the farm". Currency = Deeds. deeds_claimable = ⌊√(lifetimeCashEarned ÷ 10,000)⌋ − deedsAlreadyClaimed. Lifetime-based square root (AdCap angels = 150·√(lifetime/1e15), Realm Grinder gems ≈ √(coins/5e11)); doubling deeds needs 4× lifetime, so the same point never pays twice (claimable 0 → button disabled, AdCap rule). Corrects the cash-sinks report's divisor 5,000 → 10,000 (§2).
2. Gate (systemic, derived from state, nothing stored): the Deed office opens when (a) every farm job (plant/water/harvest) is covered by a worker or machine — "the farm runs itself" — and (b) claimable deeds ≥ 8 (lifetime ≥ 💰640k). (b) guarantees the first reset is ≥ ×2 (§2). If Toon prefers a content gate: "sprinkler built" lands at about the same lifetime.
3. Reset scope: everything in `run` resets (tiles, cash, energy/price/fertilizer upgrade levels, licenses, tools+tiers, mine license/vein/pickaxe/mastery xp, furnace+loaders, workers+certificates, storage, counters, loan, Workshop/sprinkler, Fields). Keeps (moved to `meta`): deeds, meta upgrade levels, lifetime totals + a per-run history (milestone ticks), prestigeCount, masteredTiers' +5 % preserve bonus (free carry — it is an achievement, 5 % is small, and it answers DECISIONS' open item). Prefs (autoBuySeeds, toolN) carry as they hold no value. Full table in §3 Q2.
4. Sell-off, not loss: on confirm, every sellable item in storage is sold at the current price into cash and cash is counted into lifetimeCashEarned before the deed roll, so nobody grinds a pre-reset sell-off. Unsellable bars/ore are listed as "will be lost — spend first". Prestige is refused while a loan is open (one line in the preview).
5. Meta shop, 8 items, flat deed prices, total 38 deeds (= lifetime ≈ 💰14.4M, ~4–5 prestiges, the end of the track): Reputation +10 % sell price/level, max 10 (1 deed/level, uses `sellPrice`); Green thumb −5 % grow time/level, max 5 (1 each, `growTime`); Stamina +10 % energy max+regen/level, max 5 (1 each, `energy`); Haggling −5 % cash prices/level, max 5 (1 each, `cost`); Head start +1 starting tile/level, max 6 (1 each, new meta field `startTiles`); Seed vault keep crop licenses (1, flag); Toolshed keep farm tool levels 1/n/all — not tiers (2, flag); Foreman workers act 25 % faster/level, max 2 (2 each, new MultiplierKey `workerSpeed` on workerActionTicks). No starting-cash item (×1.06 in the model, and it reads as a loan).
6. First-prestige payoff (model, 8 deeds: Rep 3, Green 2, Seed vault, Head start 2): first hour ×2.17 cash, lemons from tick 0, tile 24 at 1.8 h vs 2.8 h. Rep 4 + Green 2 + Head start 2 = ×2.64. The rule "first reset ≥ ×2" holds with the 8-deed gate.
7. Make it feel good: the Deed office screen shows (i) "You keep" / "You lose" columns (Clicker Heroes and LBR wikis literally tabulate "You will keep / gain / lose"); (ii) the sell-off total and the bars that die; (iii) the deed count and the spend-before-reset shop (Trimps lets you assign helium to perks on the portal screen, then "Activate Portal"); (iv) after reset, a ghost timeline: "Lemons: 0 min (last run 27 min) · 16 tiles: 38 min (last run 53 min)" from meta.history — the one thing no reference game does and the cheapest way to prove the ×2. Backup the pre-prestige save under tiles.save.prestige.backup (Realm Grinder's wiki tells players to back up before abdicating; storage.ts already does this for migrations).
8. No second layer, ever planned. Single-layer games (Cookie Clicker 12 years, Egg Inc, IMT, Kittens) stay single; multi-layer games were built around it from day one (AD Infinity→Eternity→Reality, Realm Grinder R at 1e27 gems, LBR's four crunches), and LBR's top negative review is exactly "crunch, then prestige, get a head start, crunch, prestige… you might give up after the second or third crunch". Data shape needs nothing extra; a later layer would be a migration anyway.
9. Rule checks: no upkeep → worst-case 8 h offline loss is 0 and catch-up never prestiges. Mining < farming: Reputation multiplies crop and item prices identically (both go through sellPrice()), Green thumb raises farming only, Stamina scales both energy users equally — add a sim assert at max meta. Nothing is free (deeds are earned by cash; workers/machines still need certificates in run 2). Save rule: prestige is a design reset of `run`; `meta` is never touched by migrations.
10. Do now, in the next migration: store meta upgrade LEVELS, not multipliers (`meta.upgrades: Record<MetaUpgradeId, number>`, multipliers derived by a balance.ts function) — today meta.multipliers is a stored value, which breaks "balance numbers live in balance.ts, not the save" the day prestige is rebalanced. Add meta.lifetime (totals) and meta.history ([]). Zero UI.
11. If Fields exist: Fields reset; the Fields unlock becomes a 2-deed "Land registry" keep; the gate (2a) moves to "first Field bought" (Fields are the post-automation phase, so automation alone would open prestige too early); market saturation state resets; Reputation multiplies before saturation. Retune the divisor (10,000) after the Fields income curve is known — with unbounded land, lifetime grows super-linearly and √ behaves exactly like AdCap; without Fields the finite 38-deed shop is what bounds the track (§2).

Corrections to the cash-sinks report: its income cap 💰21,600/h ignored the run upgrades (sellPrice +50 %, fertilizer −50 %) — the maxed 24-lemon farm earns 💰69,600/h net of seeds (79,200 gross), so its sink totals are 2–3 h of income, not 7, and "cash is score" arrives around hour 6–8 of perfect play, not 10–12. Its deeds-at-250–400k would land before gold. Its ×2 claim is right but for the wrong reasons: head start (×1.16) and kept licenses (×1.06) are "felt", price and grow time are what make run 2 fast.

======================================================================
2. ARITHMETIC (balance.ts values; model = perfect play)
======================================================================

Income
- Maxed crops, net per tile-hour: radish 936, chilli 1,485, pumpkin 2,400, lemon 2,900 (lemon 180 s, sells 165, seed 20). 24 lemon tiles = 💰69,600/h net, 79,200 gross; lifetimeCashEarned counts gross.
- Run-1 model: lifetime 23k at 1 h, 87k at 2 h, 162k at 3 h, 241k at 4 h, 400k at 6 h, 558k at 8 h; tile 24 at 2.8 h; marginal 79k/h after. Human play at ~60 % efficiency reaches the same lifetime in ~1.7× the hours.

Deeds = ⌊√(L / 10,000)⌋
- L 160k → 4 · 250k → 5 · 360k → 6 · 490k → 7 · 640k → 8 (gate, ≈ hour 9 perfect, 12–16 human) · 1M → 10 · 2.56M → 16 · 5.76M → 24 · 10.24M → 32 · 14.4M → 38 (shop maxed).
- Deed rate at the cap: d/dt √(L/10k) = 79k / (2·√(L·10k)) → 0.49/h at L = 640k, 0.25/h at 2.56M: the meter visibly flattens, which is the "time to sell" signal.
- Second prestige (16 deeds) needs +1.92M; run 2 earns ≈ 121k/h after its ramp → ≈ 18 h. Third (24): +3.2M at ≈ 159k/h (Rep 5, Green 5) → ≈ 20 h. Fourth (32): +4.5M at ≈ 190k/h → ≈ 24 h. Run lengths 9 → 18 → 20 → 24 h: the 4× rule is tamed because the shop keeps raising the cap (×2.67 at max); no explosive stall, and the track ends at 38 deeds.
- Anti-loop: prestige at L = 700k right after claiming 8 deeds → ⌊√70⌋ − 8 = 0 → disabled.

First-hour multipliers (run 2 ÷ run 1 first-hour cash, same policy)
- Reputation 3 (price ×1.3): ×1.73 · Green thumb 3 (grow ×0.85): ×1.41 · Haggling 3 (cost ×0.85): ×1.18 · Head start +3 tiles: ×1.16 · Seed vault: ×1.06 · Nest egg 💰300: ×1.06 · Stamina 3: ×0.96 (energy stops binding after ~10 min; the bot buys energy upgrades anyway).
- Sets: 5 deeds Rep 5 ×2.16 · 6 deeds Rep 3 + Green 3 ×2.31 · 6 deeds Rep 3 + Green 2 + Seed vault ×1.86 (why the gate is 8, not 6) · 8 deeds Rep 3 + Green 2 + Seed vault + Head start 2 ×2.17 (4 h: 380k vs 241k; tile 24 at 6,629 vs 10,032 ticks) · 8 deeds Rep 4 + Green 2 + Head start 2 ×2.64 · 16 deeds Rep 6 + Green 4 + Seed vault + Head start 3 ×3.73.
- Shop total 38 deeds = 10 + 5 + 5 + 5 + 6 + 1 + 2 + 4.

Comparable curves (from the sources): AdCap and Realm Grinder double prestige at 4× earnings, Cookie Clicker at 8×, Egg Inc at 128× (exponent ≈ 1/7, per-run), Clicker Heroes log-like per-run (Pecorella). Tiles at 4× sits with AdCap/Realm Grinder.

======================================================================
3. FINDINGS PER QUESTION
======================================================================

Q1 — First-prestige timing and the signal
- AdVenture Capitalist: angels = 150·√(lifetime/1e15) − angels spent; +2 % profit each, only after reset [1][2]. Wiki: first reset at 50–150 angels, "a day or two", gives "an automatic ×2–4 multiplier"; later resets "after the number is at least doubled" [3]; Steam guide: 50–300, author did 107; a rebuild takes 2–3 h; reset in the morning [4]. Signal: angel counter in the Unlocks tab, Claim button; "Resetting cannot be done if the amount of angels that can be claimed is zero" [3].
- Cookie Clicker: prestige = ∛(cookies all time / 1e12), +1 % CpS per level, chips 1:1 for heavenly upgrades [5]; FAQ/guide: first ascension at 365 chips = 48.627 quintillion cookies (days) [6][7]. Signal: the number beside the Legacy button and a blue bar that fills faster as you bake more [8][9].
- Egg Inc: prestige unlocks with the first soul egg (challenge/daily gift); resets population, common research, habs, silos, vehicles, egg; keeps permit, epic research, hyperloop, golden eggs, piggy, boosts, mystical eggs, artifacts [10]. "Beyond the first 50 SE… if the game is slowing down and you have no goals that require staying on the current egg, it's time"; gains per prestige shrink, counteracted by epic research [10][11]. Per-run formula with exponent ≈ 0.15–0.21 (wiki piecewise) — "encouraging frequent prestiging over waiting" [11].
- Idle Miner Tycoon: prestige is per mine, 6 levels, costs that continent's cash (shown on the button, confirmation required), resets shafts/elevator/warehouse/managers of that mine only, keeps super managers, items, skills, super cash, cash balance; +100 super cash; multipliers ×4 → ×145; cannot be bought with super cash or ads [12][13].
- NGU Idle: "Is your number at 2? That means you will be twice as strong. Anything more is just a bonus"; no EXP from the first 8 bosses; "No if your current run is under 15 min" [14]. The FAQ has a whole entry "Help I reset and now my number is so low I can't kill boss" — the too-early anti-pattern in the wild [14].
- Kittens Game: paragon = 1 per kitten over 70 at reset (+1 % production each, DR-capped at 200 %) [15]; community: first reset at 120–130 kittens with concrete huts, "you just spent several days getting to this point, you want to get the most out of it"; karma "a very small boost" [16].
- Trimps: portal unlocks by completing the Dimension of Anger map at zone 20; 45 helium; typical first portal at zone 22–24 [17][18][19]. Signal: a new blue button; the portal screen is the perk shop; "Activate Portal" / "Cancel" [18].
- Antimatter Dimensions: Big Crunch is forced at 1.79e308; first Infinity after "5 hours to 2 days", early Infinity era "6 hours to 6 days" [20]; "Everything that doesn't depend on Infinity gets reset… you keep everything related to Infinity" [21].
- Realm Grinder: abdicate any time; gems ≈ √(coins/5e11); "to double your gems you will need to gain 4× the Coins Gained (Max)"; first abdication at 1,000–5,000 gems, later "whenever your gem gains slow down compared to the peak of the run" [22][23][24]. The wiki tells players to back up the save before abdicating [22].
- Farmer Against Potatoes Idle: layer 1 = Reincarnation, unlocked at area 1-8-50 (content gate), per-run EXP from class level × waves × time bonus (peaks ~2 h) [25]; layer 2 = Ascension at 2,500 reincarnation levels + area 3-8-50, "ascend as soon as you can, as most gains past that point will be lost anyway" [26].
- Leaf Blower Revolution: Leaf Portal bought for 300 gold leaves; in-game text "20+ coins recommended at first prestige"; community "around 10 or 20 coins for your first prestige" or "at least 225" [27][28][29]; four reset layers (Prestige, BLC, MLC, ULC) [30].
- Idle farm/tycoon: Idle Farming Empire resets for "magical seeds" (store text only) [31]; Egg Inc is the farm-tycoon reference. Melvor Idle advertises "No prestige mechanics" as a feature [32].
- Pattern: hours before the first reset range from ~2 (Realm Grinder) to days (Cookie Clicker, Kittens); the common trigger is "growth has flattened and the first layer is bought"; the signal is a visible counter from early on plus either a content gate (Trimps, FAPI, Clicker Heroes level 150 [33]) or a number gate (AD).

Q2 — Reset scope; what made run 2 fast vs trivial
- Carry-overs that made run 2 faster everywhere: the meta currency bonus (angels, chips, paragon, soul eggs), permanent research/perks (Egg Inc epic research, Trimps perks, Kittens metaphysics), automation unlocks (AD's first Big Crunch grants the Dimension 1 autobuyer; LBR coins buy auto-buyers [21][27]), achievements/trophies (Realm Grinder keeps trophies and their upgrades [22]). Trivialising carries: AdCap after a few resets "you can literally reset the game every few minutes" [34] (fine for AdCap, wrong for a farm you look at); hayao codex: "Carry too much → the next run is a victory lap… carry too little → punishment. Carry capability and knowledge, gate power" [35].
- Tiles classification (reason): tiles RESET (the climb; Head start is the meta analogue) · cash RESET · energy/sellPrice/fertilizer levels RESET (meta multipliers are their permanent twin) · crop licenses RESET, keepable (knowledge, ×1.06 speed, strongly felt) · tool levels RESET, keepable via Toolshed (convenience, no power) · tool tiers RESET (power + the furnace's reason to exist) · mastery xp RESET, mastered +5 % bonus KEEP (achievement) · mine license/vein/pickaxe/inventory RESET (sold off) · furnace + loaders RESET (automation must be re-earned, rule 1) · workers/certificates RESET (same) · storage level RESET (the stone sink is run content) · loan RESET, prestige blocked while open · counters RESET (they gate run content; re-earned in minutes) · lifetime KEEP + per-run history · Workshop/sprinkler RESET (top of the ladder) · Fields RESET, unlock keepable · rngState reset to seed (no value) · prefs KEEP.

Q3 — Currency formula, loops and stalls
- Pecorella: most prestiges are fractional exponents of lifetime or per-run earnings, not logs; lifetime √ "you can keep resetting at the same point and gain currency… diminishes each time"; per-run formulas are "agnostic to previous performance" and "can create ideal strategies that don't involve much progress beyond a certain point" (Egg Inc, Clicker Heroes) [36]. Community rule in every game: double your currency before resetting [4][22][37]. Bad Duck's summary: ×4 earnings → ×2 prestige in AdCap/Realm Grinder, ×8 Cookie Clicker, ×128 Egg Inc [38].
- For tiles: income is capped per run (linear accumulation), so a per-run √ would make short loops optimal (deeds/hour ∝ 1/√t once the ramp is over) — the "prestige again immediately" trap; lifetime √ with a claimable-zero rule has no loop, and the stall is bounded by the finite shop (§2). Milestone-only deeds would be a special-rule table; rejected on rule 5 but the gate (2a) keeps the content requirement.

Q4 — Meta shop: see rec. 5. Every item maps onto an existing multiplier key except startTiles, two flags and workerSpeed. Cookie Clicker's first heavenly purchases are Legacy (1), permanent upgrade slot (100) — cheap, visible items first [7]; LBR's first-prestige advice is "Unlock Areas (20 coins)" — the big obvious purchase first [29]; AdCap angel upgrades cost angels, which lowers your bonus (a trade-off tiles avoids by having no passive deed bonus).

Q5 — Second layer: see rec. 8. AD's Eternity needs 1.8e308 IP and arrives in the "1.5 to 16 days" era with an entire new tree [20][39]; Realm Grinder's first reincarnation needs 1e27 gems [40]; FAPI's ascension needs 2,500 reincarnation levels [26]; Trimps' Universe 2 is "far in" with its own currency [19]. Minimum content that justified them: a new progression tree the layer unlocks, not a second multiplier. Tiles has none planned; its "second layer" is content (Fields/market).

Q6 — Anti-patterns and "you keep X"
- Too early: NGU's FAQ entry [14]; Trimps' editor's note that the achievement-chasing first-portal advice is "highly questionable" [17]. Punishment: LBR's review quoted above [41]; "This game really suffers with the progress curve… brick wall" [42]. Lost-progress anger is pre-empted by explicit keep/lose tables (LBR wiki "What you lose / What you keep" [27]; Clicker Heroes "You will keep / gain / lose" [33]), by backups (Realm Grinder [22]), and by refusing a zero-gain reset (AdCap [3]). Melvor players chose a game with no prestige because other idles were "filled with the same mechanic" [43] — the sign that prestige must stay optional and late in a management sim.

Q7 — Prestige screens: Cookie Clicker: number beside Legacy + fill bar, Legacy opens the heavenly tree, ascend/reincarnate buttons, "heavenly sound effect" [8]; AdCap: Claim Angels with the count; Egg Inc: prestige screen shows soul eggs to gain and the earnings bonus % [10]; Trimps: perk spending on the portal screen, confirm/cancel [18]; AD: one huge Big Crunch button, the Infinity tab appears after [21]; IMT: cost on the button + confirm [12]; Clicker Heroes: ascend button with a warning pop-up, relic salvage prompt [33]. None shows a "last run vs this run" comparison — rec. 7(iv).

======================================================================
4. SOURCES
======================================================================
1 https://screenzilla.helpshift.com/hc/en/5-adventure-capitalist/faq/3-how-do-i-get-angels/?l=en
2 https://adventure-capitalist.fandom.com/wiki/Angel_Investors
3 https://adventure-capitalist.fandom.com/wiki/Angel/Hard_Reset
4 https://steamcommunity.com/app/346900/discussions/0/618458030681519409
5 https://cookieclicker.wiki.gg/wiki/Ascension
6 https://cookieclicker.wiki.gg/wiki/Frequently_Asked_Questions
7 https://cookieclicker.wiki.gg/wiki/Ascension_guide
8 https://cookieclicker.fandom.com/wiki/Ascension
9 https://www.coolmathgames.com/0-cookie-clicker
10 https://egg-inc.fandom.com/wiki/Prestige
11 https://egg-inc.fandom.com/wiki/Earnings_Bonus/Soul_Eggs
12 https://idleminertycoon.fandom.com/wiki/Prestige
13 https://kolibri-games.helpshift.com/hc/en/3-idle-miner-tycoon/faq/48-how-does-the-prestige-system-work/
14 https://ngu-idle.fandom.com/wiki/Frequently_Asked_Questions ; https://ngu-idle.fandom.com/wiki/Rebirths
15 https://wiki.kittensgame.com/en/general-information/resources/paragon
16 https://steamcommunity.com/app/1097410/discussions/0/766312101614464290/
17 https://trimps.fandom.com/wiki/Guide:New_Player_FAQ
18 https://trimps.fandom.com/wiki/Portal
19 https://coolidlegames.com/games/trimps ; https://steamcommunity.com/sharedfiles/filedetails/?id=2809732346
20 https://antimatter-dimensions.fandom.com/wiki/Guide
21 https://antimatter-dimensions.fandom.com/wiki/Infinity
22 https://realm-grinder.fandom.com/wiki/Abdication
23 https://realm-grinder.fandom.com/wiki/Gems
24 https://steamcommunity.com/app/610080/discussions/0/1779388024840181790/
25 https://farmer-against-potatoes-idle.fandom.com/wiki/Reincarnation
26 https://farmer-against-potatoes-idle.fandom.com/wiki/Ascension
27 https://leafblowerrevolution.wiki.gg/wiki/Leaf_Portal
28 https://www.reddit.com/r/LeafBlowerRevolution/comments/l1xbi5/everything_you_need_to_know_about_this_game/ (search snippet)
29 https://www.reddit.com/r/LeafBlowerRevolution/comments/prbh76/when_to_prestige/ ; https://www.reddit.com/r/LeafBlowerRevolution/comments/t8enif/how_to_exit_prestige/ (snippets)
30 https://leafblowerrevolution.wiki.gg/wiki/Resets
31 https://mwm.ai/apps/idle-farming-empire/1018795567
32 https://apps.appfollow.io/android/melvor-idle-ad-free/com.malcs.melvoridleadfree
33 https://clickerheroes.fandom.com/wiki/Ascension
34 https://www.appgamer.com/adventure-capitalist-cheats-tips-walkthrough/strategy-guide/resetting-the-game
35 https://hayao.dev/docs/codex/system-prestige-and-newgame-plus
36 https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii
37 https://github.com/ac2522/IdleFramework/blob/main/IDLE_GAME_MECHANICS_RESEARCH.md
38 https://badduck.team/articles/math-of-idle-games/
39 https://antimatter-dimensions.fandom.com/wiki/Eternity
40 https://realm-grinder.fandom.com/wiki/Reincarnation
41 https://steamcommunity.com/app/1468260/negativereviews/?browsefilter=toprated
42 https://www.reddit.com/r/incremental_games/comments/lvdlzh/leaf_blower_revolution_is_a_pretty_chill/ (snippet)
43 https://www.reddit.com/r/MelvorIdle/comments/sjnbto/ng_ascension/ (snippet)

Could not confirm: Reddit threads (28, 29, 42, 43) are search snippets only — Reddit blocked both fetch paths; the Melvor "won't be making its way" line may be a player, not the developer. Pecorella's GDC talk text (only his articles were read). Idle Farming Empire's actual reset scope (store copy only). Trimps' real hours to zone 20 (one thread says ~1 h per zone around 12–13, no consensus). Egg Inc's exact SE formula is piecewise on the wiki; I quote the exponent range, not the full expression. All tiles numbers are my Python model of balance.ts (perfect play, no mining, no Fields/market), not the repo sim — the ratios are robust, the hour marks are optimistic by roughly ×1.5–2 for a human.
