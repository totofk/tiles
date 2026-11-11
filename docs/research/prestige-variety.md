TILES: PRESTIGE VARIETY (research only; nothing edited, created or committed; repo read at 3c5ca0f)

1. SUMMARY
- Recommendation: on "Sell the farm" the player picks the next farm from 3 listings. Two are rolled from a seed (a soil plus a district rule, each a trade); one is always the plain farm.
- Idle players dislike rare, strong rolls they cannot steer, and anything that waits for a pick mid-run. They like resets that change the plan when conditions are visible and chosen.
- Deeds stay pure speed. ⭐ rerolls the listings. Conditions never change deeds earned.
- Smallest build (est.): 1 save bump, about 30 call sites, one block on the Sell card, 6 rules, about 10 extra sim runs.
- Repo facts: the sim pins run 2 at ≥ 1.4×, not 1.8× (tests/sim.test.ts:3977–4000; measured 1.4×, 1.5× at 71 deeds), so speed was never going to carry run 2. prestige.ts:29,60 still converts ⭐ to deeds.
- Not done: no calculator or sim run; the live site and 375 px were not measured.
- Sentiment base is small and enthusiast-heavy: 6 r/incremental_games threads plus Steam, wiki and forum pages.

2. PATTERNS (Q1)
"10+" lines without a source number are my inference.
1) Pure multiplier. AdVenture Capitalist, Cookie Clicker [P1].
   - 10+: rote. "we've all played through the 'prestige for x% bonus to things' style so many times it's completely uninteresting" [R5].
   - Cost: lowest. Fit: tiles has it; keep it as the spine.
2) Challenges (opt-in restricted run, permanent reward). Kittens Game: each repeat is harder and pays more, up to a cap [W1].
   - 10+: holds, but finite and hand-made.
   - Cost: medium per challenge (own balance and sim). Fit: later, as an opt-in clause on a listing.
3) Branch / faction menu. Realm Grinder factions; Shark Game's 8 worlds [W2 snippet].
   - 10+: a guide ends up picking. "most of them are just plain wrong"; "the factions start to merge together" [S1].
   - Cost: high (each branch is its own upgrade set). Fit: poor; this is your rejected land menu.
4) New layers. Antimatter Dimensions [P1].
   - 10+: best retention, highest cost. Fit: no (earlier research, rec. 8).
5) Meta-progress unlocks a mechanic per reset. "Unlock a new mechanic after every prestige. Realm Grinder does a good job at this" [R5].
   - 10+: lasts as long as the content does.
   - Cost: high per unlock. Fit: partly; drip the rule pool, one new rule per sale.
6) Run modifiers / seeds.
   - Evolve: pick a planet (biome, trait, geology bonuses); "each Probe increases the number of options by 1" [W3].
   - Trimps dailies: random rules with "a reward modifier based on the overall difficulty of the modifiers", a 7-day buffer [W4].
   - Antimatter Dimensions glyphs: "choose 1 glyph out of 4" per Reality [W5].
   - Idle Superpowers: random power picks, the failure case [R3][S2].
   - 10+: holds when it is a choice among visible trades; fails when one roll dominates.
   - Cost: low per row once the hooks exist. Fit: best.
7) Opt-in difficulty for more reward. Synergism corruptions, dials unlocked by ascension challenges [W6]; "over four billion different combinations" [W7 snippet].
   - 10+: good for optimisers, invisible to others.
   - Cost: low to medium. Fit: later.
8) Rotating / timed content. Egg Inc contracts [W8 snippet]; Trimps dailies run on the calendar.
   - 10+: strong, but needs live ops and pulls players to a clock. Fit: no.
9) Carry one thing. Cookie Clicker permanent slot [P1]; superpowers idle lets you "'save' some powers to bring with you" [R2].
   - 10+: builds identity across runs. Cost: low. Fit: later, as a deed row.

3. PLAYER SENTIMENT (Q2) AND MITIGATIONS (Q3)
EVIDENCE: what players dislike
- Rare, strong rolls: "Rolls are rare (happen just once or few times during prestige loop) and powerfull. In which case you will be irritated every time numbers did not roll the way to allow you to have an optimal run." (14 points) [R1]
- Lost planning: "Annoying, preventing you from theorycrafting and optimising" (13 points) [R1]
- Random prestige rewards: "put me off from playing couple of games because prestige rewards were random" [R1]
- Reset fishing: "the game devolved into constantly prestiging until you get lucky enough to be offered the right skills" [R3]
- Bad offers: "quitting after some time because I only got terrible choices" [R3]
- Waiting on a pick: "I generally don't want to come back after several hours and discover that the game stopped making meaningful progress because it was waiting for me to choose" [R3]
- Flat refusals: "bad game design in my opinion to have progression locked behind RNG"; "when I see a roguelike (3 choices), I will definitely not play it" [R3]
- Fatigue: "after enough runs, the roguelike layer may become another chore" [R3]
- Bricked runs: "The summoning RNG will brick entire runs" [S3]; "sometimes can't beat an early boss because your powers are hard countered" [S2]
- Seed tools: "a huge handicap to not use an external tool to predict artifact excavations, it seems to be balanced around exploiting the seed generation" [S1]
- Save-scumming for a good roll: "reset, check the planets, restore backup if need be … Avoiding stuff like Mellow, Flare, Ozone, Unstable and looking for good geology bonuses" [R6]
- Reroll paid in prestige currency: Clicker Heroes' four random Ancients, with a reroll costing Hero Souls, is filed as a Scrappy Mechanic [W9].
- Pure negatives: "Any daily with automatic death (Plague) … Nobody likes those." [R7]
- Fewer choices as difficulty: "either you get f***** by RNG or you don't"; a dearer reroll "still leaves you the option … which is fine" [S4, not an idle game]
- Random raw rewards: "I love the remixed bundles but I hate the remixed mine rewards." [F1, a farm game]

EVIDENCE: what players like
- "a prestige reset that changes how the early game plays instead of only speeding it up"; "so you can't just autopilot the same build again" [R4]
- "it can also make you consider new interactions because you have to make do with what is available"; "critical to have some control/automation for the randomized choices, especially after many prestiges" [R3]
- "Luck that averages out over a big number of samples good. Luck that boils down to a single big decision bad, maybe."; "RNG needs to be low risk or able to be manipulated" [R2]
- "it's important for the user to have the feeling of control" [R1]
- Evolve: "you want to target planets types you haven't been to before" [R8]; extra options are "nice but not critical" [R9]
- "knowing what I need for the bundle before I unlock it seems boring to me" [F1]
- "I love RNG in idle games." [R1] (a minority voice in that thread)

INFERENCE (mine)
- The complaint is about lost control, not about variety. A run in tiles lasts many hours, so one roll is exactly the "rare and powerful" case and has to be a choice.
- The idle objection is to picks during a run. A pick at the sale lands when the player is already at a confirm screen.
- Players fish for seeds when one roll is plainly better or worse. If every condition is a trade, there is less to fish for.
- Tiles already blocks reset fishing: `sellFarm` fails with NO_GAIN when the sale gives no deeds.

MITIGATIONS that map to the evidence
- Pick 1 of N, with a plain option: [R1] control, [R3] refusals.
- Trades only, no pure buff or nerf: [R6][R7].
- Seed stored in the save, listings visible before selling, no hidden traits: [S1][W9].
- Reroll priced in a side currency, never fewer options: [S4][W9].
- Bounded size, no effect on prestige currency: [R1][S3].
- Opt-in harder terms for more reward: [W1][W4].
- A list of conditions already played: [R8].

4. RECOMMENDED SHAPE (Q4) (every number est.)
What changes per run
- The Sell card shows "Next farm": 3 listings, pick one, then sell. Listing 3 is always the plain farm.
- A rolled listing has two parts:
  - Soil: 2 crops sell +15 %, 2 crops sell −15 %, farm-wide. That is 420 soils on today's 8 crops and 1,260 on the planned 10.
  - District rule: one from a pool, each 2–3 factors on existing numbers and always a trade. Examples: "Mining district: bars ×1.5, crop market depth ×0.75"; "Short of hands: wages ×2, hand energy ×0.5"; "Co-op: order ⭐ ×1.5, market sales ×0.9".
- "Short of hands" gives the hand-heavy new player (P1 in your notes) a run built for him.
- Listings come from a seed in meta and carry a lot number. Reloading or importing a save shows the same listings.
- No condition changes deeds earned or the offline cap, and none adds upkeep. A poor pick costs strategy, not progress.

Deeds
- Unchanged: the 9 rows of speed and keeps.
- The shop totals 276 deeds, which is lifetime 💰762M, about 300 h at the 20-field peak of 2.4M/h (my arithmetic, no ramp). It will not run dry soon.

⭐
- The balance carries (your rule), so the player arrives at the sale holding ⭐ with nothing run-bound to buy.
- Reroll the two rolled listings for ⭐5 / 10 / 20 / 40, resetting each sale. ⭐10 is about 1 h of orders (star-toys estimate). Orders already have a ⭐2 reroll (balance.ts:463).
- Soil survey's ⭐ "reveal" goes: nothing is hidden.

After 20+ sales
- 10 crops × 6 rules gives 7,560 lots. Felt variety is lower, since only the top 3–4 crops matter; my guess is 40–60 runs that feel distinct.
- The pool starts at 3 rules and gains one per sale.
- An almanac ticks each rule finished; the first finish of a rule pays +1 deed.
- New systems add axes at no design cost to this feature: the crops batch, per-field traits (parked, needs the Manager DP), and the worker rework.
- Worker rework: the same run seed can roll which hires and quirks this district offers, with ⭐ rerolling a hire. Noted, not designed.

First version and cost per item
- Save: one bump. meta gets seed, reroll count, almanac; run gets conditions. Every existing run migrates as plain; the seed is derived from existing meta fields so fixtures stay deterministic.
- Core: an optional conditions argument on `cropSellPrice` (7 src call sites), `itemSellPrice` (7), `marketDepthGlut` (3), `workerWage`, order stars and energy cost. About 30 src call sites; tests stay untouched while the argument is optional.
- UI at 375 px, not measured:
  - Three stacked full-width rows on the Sell card (name plus two chips, 52 px or more) and a ⭐ reroll button.
  - One "This farm" line in Stats.
  - A 🌱 / 🥀 mark on affected crops. Not ▲▼, which is the price trend (batch 21).
- Sim: the unchanged ladder bot on each rule and on 4 extreme soils must reach the Fields unlock within ±20 % of plain. PIN20 stays on plain. Cost is about 10 more ladder runs in a 4,515-line file.
- Content: a calculator round for 6 rules. It must show that ±15 % flips the best crop in some lots (DECISIONS:587 says mono strawberry wins from 2 fields); if not, widen it or act on market depth.

Scenario A, fresh player
- Run 1 is plain and identical to today, so no pin moves.
- The first sale (17+ h) shows plain plus two soil-only listings. Rules start at sale 2.

Scenario B, veteran who already sold
- The current run stays plain, so nothing changes overnight.
- Listings appear on the Sell card at once, with the rule pool pre-unlocked by `prestigeCount`. The almanac starts with "Plain ✓".
- A ⭐-rich veteran can reroll 4 times for ⭐75 at most per sale.

5. DECISIONS (reply with the numbers you reject; every number est.)
1. Pick 1 of 3 listings on the Sell card. Reason: the choice lands where the player is already deciding, and nothing waits offline.
2. Listing 3 is always the plain farm. Reason: players who refuse RNG keep an exit.
3. Every condition is a trade; no pure buff or nerf. Reason: Evolve players skip the pure negatives and save-scum for the good ones.
4. Soil = 2 crops +15 %, 2 crops −15 % sell price, farm-wide. Reason: one hook, and the Manager re-plans from prices.
5. One district rule per farm from a pool of 6. Reason: a rule is a table row, not code.
6. Rules start at sale 2; pool of 3, plus 1 per sale. Reason: the first sale stays simple and a small pool still gives something new each time.
7. Seed in the save, listings shown before selling, lot number visible. Reason: no reload fishing, and the next farm becomes a reason to sell.
8. ⭐ reroll 5 / 10 / 20 / 40, reset each sale. Reason: a priced reroll is accepted; fewer options is not.
9. No hidden traits; drop the ⭐ reveal. Reason: hidden rolls send players to seed tools.
10. Conditions never touch deeds, the offline cap or upkeep. Reason: no bricked run, and the 8 h offline loss stays 0.
11. Almanac with +1 deed on the first finish of each rule. Reason: players chase conditions they have not played.
12. Deed rows unchanged. Reason: deeds are speed, as settled; 276 deeds is far away.
13. Run 1 and all migrated runs are plain. Reason: no pin moves and no overnight nerf.
14. Veterans get the pool pre-unlocked by `prestigeCount`. Reason: past sales count.
15. Build after the crops batch and the ⭐ Favours batch, as one save bump. Reason: soil keys on the 10-crop ladder, and ⭐ must carry first.
16. Sim pin: each rule and 4 extreme soils within ±20 % of plain to Fields. Reason: it proves no roll stalls a run.
17. Dig finds is not built as a rule picker; its rules join this pool. Reason: mid-run 1-of-3 is the form players object to, and one pool is enough to balance.
18. Seed each run's `rngState` from the lot seed. Reason: every run starts from the same seed today (state.ts:245).
19. Later, not now: opt-in hard clause for +25 % deeds from that sale; deed rows "4th listing" (16) and "keep one soil crop" (8); per-field traits; a mid-run ⭐ re-pick. Reason: each needs its own sim or Manager work.
20. Worker rework reuses the run seed for the district's hiring pool. Reason: it is the next axis and needs no new roll system.
21. Correct DECISIONS:401 to the measured ≥ 1.4×. Reason: the doc and the sim disagree.

6. SOURCES ([snippet] = search text only)
Reddit pages were opened through the extract tool. R2–R5 came back without user names or votes.
- R1 https://www.reddit.com/r/incremental_games/comments/hy0wa8/rng_in_idle_games/
- R2 https://www.reddit.com/r/incremental_games/comments/1h4gbtm/luck_in_incremental_games/
- R3 https://www.reddit.com/r/incremental_games/comments/1vn4xuc/do_roguelike_mechanics_actually_work_well_in/
- R4 https://www.reddit.com/r/incremental_games/comments/1xdl6bn/mechanics_twists_you_would_like_to_see_on_an/
- R5 https://www.reddit.com/r/incremental_games/comments/7z3wfe/some_random_ideas_for_making_prestige_systems_in/
- R6 https://www.reddit.com/r/EvolveIdle/comments/ks7wfg/farming_planets/
- R7 https://www.reddit.com/r/Trimps/comments/cgd9a1/how_do_i_evaluate_how_good_a_daily_is/
- R8 https://www.reddit.com/r/EvolveIdle/comments/ijpa6c/bioseed_planet_best_planet_type_to_choose_early/
- R9 https://www.reddit.com/r/EvolveIdle/comments/1oqgy5g/need_some_help_with_what_my_goal_is/
- S1 https://steamcommunity.com/app/610080/negativereviews/?l=english&p=1&browsefilter=toprated (Realm Grinder)
- S2 https://steamcommunity.com/app/1831980/reviews/?browsefilter=toprated (Idle Superpowers)
- S3 https://steamcommunity.com/app/4047270/reviews/?browsefilter=toprated (Orc Incremental)
- S4 https://steamcommunity.com/app/1336490/discussions/2/3716062344562511112/ (Against the Storm)
- F1 https://forums.stardewvalley.net/threads/whats-your-opinion-on-remixed-bundles.45003/
- W1 https://wiki.kittensgame.com/en/game-tabs/challenges
- W2 https://shark-game.fandom.com/wiki/Shark_Game_Wiki [snippet]
- W3 https://evolve-idle.fandom.com/wiki/Bioseed
- W4 https://trimps.fandom.com/wiki/Daily_challenges
- W5 https://antimatterdimensions.wiki.gg/wiki/Glyphs
- W6 https://synergism.fandom.com/wiki/Corruptions
- W7 https://changelog.synergism.cc/c/v4.4.0%20-%20The%20Corrupted%20Update [snippet]
- W8 https://egg-inc.fandom.com/wiki/Contracts [snippet]
- W9 https://tvtropes.org/pmwiki/pmwiki.php/YMMV/ClickerHeroes
- P1 docs/research/prestige.md sources 2, 7, 21 (AdVenture Capitalist, Cookie Clicker, Antimatter Dimensions); not reopened.
- Repo: prestige.ts, balance.ts:462–463 and 538–589, state.ts:190–251, manager.ts, tests/sim.test.ts:3977–4000, DECISIONS.md, both handoff drafts.

Could not confirm
- Whether Clicker Heroes still uses random Ancient offers.
- Real ⭐ income per hour.
- The crop income gaps that decide whether ±15 % matters.
