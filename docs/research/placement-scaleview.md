REPORT: locked sprinklers + Fields as a main view — research only, nothing edited

Builds on docs/research/fields-market.md (FM), sprinkler-gold.md (SG), progression.md; their findings are cited as FM §n / SG §n and not re-derived.

1. VERDICTS

  #  Proposal                         Verdict   One-line reason
  1  Sprinkler PLACED on 6 tiles      CHANGE    Lock to tiles: yes (every farm sim does; roaming automation draws "can't control it" complaints). Losing hopper coal on a move: no — every reference game picks sprinklers up free and lossless, and move-friction is the thing players rage about [3][5][6].
  2  Fields = third main view         KEEP      Matches the only pattern that survived in incremental/management games: a new tab/screen that opens on unlock while the hands-on tab stays and feeds it (Kittens, A Dark Room, Factorio, Anno) [8][9][11][14].
  3  Tractor replaces the grid        DROP      Only Paperclips did it, with nothing invested in the old layer (FM §1); tiles' mastery, tool tiers, orders, hand-picked ×1.25 and the 50-harvest crop gate all live on the grid. Also violates "earned value never taken away".
  4  Rename unlock "buy the Tractor"  CHANGE    A purchase as the trigger is right (Paperclips' project, Kittens' building). The word is wrong: to farm-game players a tractor is a 3×3 convenience tool (Farm Together, Stardew Tractor Mod top-30) and one reviewer already "never understood what the tractor did" [17][18][19]. Use "Land Deed"/"Open the Fields"; keep 🚜 for the harvester/seeder machines, which ARE tractors.

2. FINDINGS

A. Placement of watering automation
- Placed, movable for free: Stardew (4/8/24 tiles; pick up with axe/pickaxe, the Pressure Nozzle attachment is kept) [1]; Coral Island (sprinklers "affect a specific tile area", removed with the axe; a whole guide genre on rearranging farms) [4][5]; Core Keeper (5×5 furniture, pick up free) [7]; Story of Seasons PoOT (3×3 → 5×5 at Farming 8; guides say "put it in the middle") [2]; Farm Together (building, 2 adjacent tiles; recycling refunds the full 1-ribbon price) [3]. Dinkum adds a supply constraint: sprinklers only run inside a Water Tank's range [SG 34-35].
- The one punishing mover is Farm Together 2: sprinklers are bound to a plot, deleting the plot deletes them "and only refunds you 1 ribbon" — the thread title is "Moving Sprinklers Help Needed… OMG what a nightmare" [6]. That is proposal 1's "lose the coal" in the wild.
- Abstract/no watering: Hay Day ("even though it never rains, they never die") [13]; FarmVille 2 (water is a refilling resource you tap onto crops, no placement) [12]; Melvor (compost per plot, no water); Harvest Moon Light of Hope (no automation at all, largest can 5×3) [20].
- Sun Haven has no sprinkler, only a cursor-cast Rain Cloud spell; the result is players calling watering "a mana draining slog… a living nightmare" and begging for sprinklers [21]. An unplaced spell did not satisfy the "I built irrigation" fantasy.
- Roaming automation: Stardew Junimos roam inside a 17×17 radius and are the most-complained-about automation in the game: "they only harvest about half", "take quite a while", "I mainly consider them as decoration" [22][23]. Forager droids follow the player: "they make it REALLY hard to do basic things… Is there ANY way to control them?" and the accepted fix is assigning one droid per structure [24]. Rusty's Retirement is the hybrid that works: a water bot is a placed station with a fixed range, and inside that range it goes to the driest plot; guides tell you to "make note how far the water bots go… you want their coverage" [25][26]. Toon's instinct matches the evidence: automation that has no place reads as uncontrollable.
- Layout puzzle vs chore: Stardew's sprinkler-layout guides and planners are a cottage industry [1a][1b] — the puzzle is enjoyed, but it is a geometry puzzle tiles cannot offer (columns change with viewport). What tiles can offer is a priority puzzle: which 6 of 24 tiles get the sprinkler (lemon 360-tick tiles vs carrot). That is a real decision because the worker covers the rest (SG §6).

B. Scale-transition UI
- Screen replaced: Universal Paperclips flips flags; "buttons you relied on disappear, and the number you were watching stops mattering… fewer still make you feel you caused it" [8]. Works because the old layer carried no investment (FM §1). Antimatter Dimensions' layers "swallow the one before" but as tabs [8].
- New tab, old tab kept and feeding: Kittens Game (Bonfire → Outpost → Science → Trade → Space, each unlocked by a building/tech) [9]; A Dark Room (FM Q1). Spaceplan: a new planet/chapter [8].
- Zoom-out: Factorio's map view zooms continuously into the world (FFF-183: "at a certain zoom you just switch from the map view to the game view") [11]; handcrafting is never removed, it is "less and less efficient" and liquids are hand-uncraftable "to encourage automation" [10]. RimWorld: a World tab beside the colony map [15]. Farming Simulator 22: fields stay driveable; an "AI worker screen" manages every worker's job, and field info lives in a HUD corner [16].
- Side panel only: Satisfactory shipped no aggregate view and the top thread is "infuriating… lack of graphs and data"; Coffee Stain promised a stats panel [27]. Anno 1800 had to add a full Statistics menu in patch 6 (Dec 2019), "as part of the main game interface… available at any time" [14][14a]. Lesson: once the economy is bigger than the screen, the aggregate view must be a first-class screen, not a card.
- Lost hands-on layer: Melvor Township (FM Q2) and Junimo huts [22][23] — the complaint is never "the grid is gone", it is "the new layer doesn't need me / doesn't talk to the old one".

C. What makes a shift feel intentional
Spiel et al. (2019) name the structure: incremental games carry narrative through paradigm shifts where "gameplay and interface progressively reveal more contents of the system", and the feeling is irony — a small ordinary act becomes massive [28]. Techniques that follow from the examples:
1. One purchase is the trigger, and the screen changes the moment it lands (Paperclips project, Kittens building, Stardew Junimo hut) [8][9].
2. The new layer visibly consumes the old one (A Dark Room's village supplies expeditions; Township failed for lack of this — FM Q2). tiles already has the hooks: 50 home harvests per crop, workers finishing the plot first, best sickle inherited.
3. One rule family per object: spatial things are placed and stay (sprinkler, pipes), abstract things are counts (fields). The current sprinkler is a spatial object behaving like an abstract worker — that is literally the "mixed" feeling.
4. A ceremony once, a tab forever: banner, the tab appears, the view opens itself one time; afterwards it is a normal tab (Anno/Kittens).
5. A continuity cue: the home plot appears as the first row of the Fields screen ("🏡 Home plot · 24 tiles · hand-picked ×1.25"), the way Factorio's map is a zoom of the same world [11].

D. Dashboard numbers players actually use
- Rates per unit time, not totals: Factorio production window (5 s…all-time windows) [10a]; Anno tons/min [14]; Melvor Township "/t" [29].
- Current vs potential = the bottleneck: Anno's bars show the bright "current" and striped "potential" rate — "the most accurate way is comparing the bars" [14]; Egg Inc's green/yellow/red eggs/min vs shipping bar (FM Q1); Idle Miner Tycoon's one screen with shaft vs elevator vs warehouse throughput [30].
- Time-to-afford and payback: Cookie Monster's Payback Period max(cost−bank,0)/cps + cost/Δcps is the most-used Cookie Clicker addon [31]; Kittens players built tools to "project resource levels 5 and 15 minutes into the future" [32].
- ETA to next harvest: FS22's Crop Growth Stage Info mod (rated 4.8 by 1,134) exists because the base HUD hides it [16a].
- Price trend + recovery (FM Q5). Utilization of machines (Satisfactory's Productivity Display) [27a].

3. RECOMMENDED COMBINED DESIGN

Sprinkler (batch 17 amendment)
- Buying a sprinkler enters a "choose 6 tiles" mode on the home plot (tile indices, never geometry); tiles get a 💧 badge; the machine waters only those, every 5 s, as today. Unchosen tiles stay with can/worker (SG §6 already assumes this).
- Move = tap the badge, re-pick; free, hopper coal stays, one skipped action (5 s) as the only cost. Reasons: every reference is lossless [1][3][5][7]; FT2 shows the alternative [6]; "earned value never taken away".
- Tile count growing 18→24 and prestige: indices persist; a removed tile unassigns itself. Migration: existing machines auto-assign their current `sprinklerTargets` chunk (or lowest 6 waterable indices) — nobody loses watering on update.
- Optional later: "Lv2 coverage 12" extends the picked set (SG §3), still a set.

Fields (batch 18/19 amendment)
- Third main view 🚜/🗺 Fields next to Farm | Mine; on first unlock a banner + the tab appears and opens once. The right-panel card shrinks to a one-line summary that links to the tab.
- Unlock = "Land Deed" purchase (FM §4 wording), not "Tractor".
- Screen content, top to bottom: (1) continuity row: home plot 24 tiles, hand-picked bonus, workers' status; (2) capacity line with current/potential bars Anno-style: Pipes 300/420 tiles, Seeder 1,800/h · 92% busy, Harvester…, plus one red "⚠ bottleneck: harvester" word; (3) per-crop rows: emoji · planted n · growing n (next ready in m:ss) · ready n · 💰/h · price ×0.9 ▼ recovers ~25 min · Plant/Stop; (4) purchases with time-to-afford and payback: "+1 Field 💰X · afford in 4 min · payback ~6 h", pipes tier, machine recipes.
- Keep the 3 bars as the sparkline/summary; the rows are the dashboard.

4. SOURCES
1 https://axenthost.com/blog/sprinklers-in-stardew-valley/ (remove with axe/pickaxe, attachment kept)
1a https://stardewhub.com/en/guides/stardew-valley-sprinkler-layout · 1b https://www.stardewprofit.com/tools/sprinkler-layout-planner
2 https://ladiesgamers.com/beginners-guide-story-of-seasons-pioneers-of-olive-town/ ; https://steamcommunity.com/sharedfiles/filedetails/?id=2927242048
3 https://www.reddit.com/r/FarmTogether/comments/121qc3y/moving_sprinklers/ (snippet: full refund)
4 https://www.thegamer.com/coral-island-how-to-move-rearrange-farm-guide/
5 https://steamcommunity.com/app/1158160/discussions/0/550107882562061867/
6 https://steamcommunity.com/app/2418520/discussions/0/4338733186958761567/
7 https://core-keeper.fandom.com/wiki/Sprinkler
8 https://overbaked.studio/blog/games-like-universal-paperclips/
9 http://wiki.kittensgame.com/en/game-tabs/home
10 https://wiki.factorio.com/Crafting · 10a https://wiki.factorio.com/Production_statistics
11 https://www.factorio.com/blog/post/fff-183
12 https://www.supercheats.com/farmville-2/walkthrough/starting-tips-tricks-strategies-and-good-game-play-habits
13 https://apps.apple.com/us/app/hay-day/id506627515
14 https://anno1800.fandom.com/wiki/Statistics · 14a https://www.anno-union.com/updates/game-update-6-december-10-2019/
15 https://www.reddit.com/r/RimWorld/comments/5utrrm/can_i_explore_the_rest_of_the_world/
16 https://www.farming-simulator.com/newsArticle.php?lang=en&country=dk&news_id=281 · 16a https://www.farming-simulator.com/mod.php?mod_id=232903
17 https://ladiesgamers.com/guide-farm-together-for-switch/
18 https://www.nexusmods.com/stardewvalley/mods/top (Tractor Mod in top 30)
19 https://steamcommunity.com/id/jessira90/recommended/673950/
20 https://steamcommunity.com/app/585900/discussions/0/2425614539579787213/
21 https://steamcommunity.com/app/1432860/discussions/0/4520010784053943667/
22 https://www.reddit.com/r/StardewValley/comments/196n0ol/issues_with_junimos/
23 https://www.reddit.com/r/StardewValley/comments/1grqhrg/do_you_guys_use_junimo_huts/ ; https://www.reddit.com/r/StardewValleyMods/comments/1l3nlet/do_you_use_junimo_huts/
24 https://steamcommunity.com/app/751780/discussions/0/3062997274371893971/
25 https://www.reddit.com/r/rustysretirement/comments/1cmw1cz/understanding_rustys_retirement/
26 https://steamcommunity.com/app/2666510/discussions/0/4338734057914271860/
27 https://steamcommunity.com/app/526870/discussions/0/4843149419125665954/ · 27a https://satisfactory.fandom.com/wiki/Productivity_Display
28 https://repository.library.northeastern.edu/files/neu:bz617n08c/fulltext.pdf (Zhou, citing Spiel et al. 2019, "On the Design of Idle Games" https://par.nsf.gov/servlets/purl/10174274)
29 https://wiki.melvoridle.com/w/Tick
30 https://www.bluestacks.com/blog/game-guides/idle-miner-tycoon/idt-tips-tricks-en.html
31 https://github.com/CookieMonsterTeam/CookieMonster
32 https://github.com/jonrhall/ktns

Not confirmed: Reddit threads [3][22][23][25] were read from search snippets only (Reddit blocks fetching); no GDC talk by Lantz specifically on the phase-change UI was found (his 2018 Vision Track talk is on cognition, not Paperclips' interface); Idle Farming Empire and Farmer Against Potatoes Idle UI details come from store pages only and were not used as evidence.
