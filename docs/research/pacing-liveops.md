Research and arithmetic done; nothing in the repo was touched, no git/pnpm/build run. Report follows.

REPORT: early automation pacing, active play after automation, rebalancing with rich players (research only)

Method: read DECISIONS/PLAN/PLAYTEST/balance.ts/workers.ts/serialize.ts, docs/research/workers.md, the four previous reports; Python on balance.ts numbers plus the sim pins in PLAN.md (batch 5/8/10 results); ~25 wiki/forum/dev pages (URLs §4). Subagent delegation was unavailable in this run, so breadth is narrower than the brief asked; unconfirmed items are listed at the end.

======================================================================
1. SUMMARY (reject by number). A = market batch, B = later.
======================================================================

Diagnosis first. Reference idle games do NOT have a long manual phase: Cookie Clicker automates at 15 cookies, Trimps at 5 food, AdCap at $1,000 (a few minutes), IMT at shaft level 5. What they do instead is keep the player's hands busy after automation (clicking still pays, the "player" is itself a worker, new businesses appear, golden cookies). Farm sims (Hay Day) never automate the core at all. tiles' problem is not that workers come at minute 10–19; it is that (i) the certificate arrives before the job's tool ladder is finished, so manual → tooling → automation is broken in the numbers, and (ii) once water+harvest are staffed the player has literally nothing to do with 90 % of their energy except mine. Fix (i) with counters, fix (ii) with an active bonus, and leave the rich player's cash alone.

A1. Certificate unlock = the job's level-3 tool owned (Water Cart / Reaper / Seed Spreader), not a counter of 40. Systemic rule: "a worker replaces a press, so the press must exist at 'all' level first." Numbers only (balance.ts + one check in certificateUnlocked); existing certificate owners keep them (rule 2). Effect: water worker at ~16 min instead of ~5–10, harvest worker at ~38–40 min instead of ~8–19 (tool-bot ticks 984 / ~2300). The manual phase becomes the tool phase, which is what DECISIONS already wanted.

A2. Reprice the two certificates and the hire base to roughly 5–10 min of income at unlock (AdCap's first manager is ≈ 270× the business's base price; today's water certificate is < 1 min of pumpkin income). Starting values: water 💰500 + 20 stone, harvest 💰750 + 20 stone + 5 coal, hire 💰150 × 1.7^(n−1). Cash-only changes, no migration; rich players are unaffected.

A3. Market exactly as agreed (glut, 50 % floor, 30 min half-life), depth 120. The −10 % lemon dip on a 24-tile farm is the only thing a current player feels; A4 gives the attentive player more than that back, so the patch reads as "new mechanic", not "nerf".

A4. "Hand-picked": a harvest the player performs (tap or tool press, i.e. energy spent) sells at ×1.25; a worker's harvest sells at ×1. This is the Cookie Clicker active/idle split in farm clothes, scaled down (CC active play is several × idle; tiles aims +25 % gross on what you pick yourself). On a fully automated 24-lemon farm the attentive player can pick all 240 lemons/h for 4 energy/min (of 20) → +💰6,600/h; the idle player loses nothing, offline loss is 0. It also gives the Reaper and copper sickle a reason to exist after automation. Hierarchy: farming per energy rises, mining untouched (rule 3 holds). Worst-case 8 h offline loss: 0.

A5. Milestone timeline in the save (needs the v12 migration the market needs anyway): run.milestones: Partial<Record<MilestoneId, tick>>, written once by step()/actions from a table in balance.ts (first harvest, 25 sales, each tool level, each license, each certificate, each hire, vein Lv1–3, furnace, first bar, copper/iron pickaxe, tiles 12/16/20/24, lifetime cash 1k/10k/100k/1M). Migration fills nothing (absent = "before tracking"), nothing is taken. Stats tab gets a "Timeline" list and a "Copy report" button (≈ 20 lines of text) plus "Export save / Import save" (base64 JSON, the Cookie Clicker/Trimps/AD norm). That is the feedback channel; no backend.

A6. For the 💰1M player, in this batch: nothing is taken (rule 2), and nothing new is priced by wealth (hated — §3 Q3). Their goals are the ones already agreed: materials (bars gate every late item), ⭐ (orders batch, cash cannot buy it), tile 25–36 in bars, deeds. Show the deed meter early: a Stats row "Lifetime cash 💰1,04M → 10 deeds when 'Sell the farm' opens" costs one line and turns the pile into a score, which is what the genre does with it (AdCap angels, CC heavenly chips).

B7. Orders + ⭐ next, as agreed; ⭐ is the currency that answers "every cash price is trivial" because it is paced by time, not tile count (orders report).

B8. "Tend" as the post-automation energy sink: a tool press "Tend n" adds 10 growth ticks per energy to moist growing tiles. Cash/energy lemon 2.5, pumpkin 2.1, carrot 0.8 — below farming (8–11), about equal to mining (1.5–2.3), so energy after automation has two uses: materials or speed. Offline loss 0. Reject if Toon wants energy to stay the mine's.

B9. Live-only market events: every 8–15 live minutes one crop gets "a buyer at the gate" (×2 for 90 s), weighted toward the crop with the deepest glut, so active players rotate crops. Never spawns during catch-up, so offline players lose nothing; keep the gain small (≈ +10–15 % on average) so missing one is not FOMO (the Hay Day boat-timer complaint).

B10. Wage as a share of the crop (harvest/plant wage = max(1, 5 % of base sell price), water stays 💰1): makes automation cost proportional (lemon 💰6 a harvest, carrot 💰1), fixes "carrot automation is marginal, lemon automation is free". Optional, later, needs the sim's 80 % check re-run.

B11. Do not: scale prices by cash/wealth; add property tax; convert cash to bars one-time; reset saves. Prestige stays the outlet (prestige report).

======================================================================
2. ARITHMETIC (balance.ts; sim pins from PLAN.md where quoted)
======================================================================

Today's ramp
- Energy 20/min. Carrot cycle on a tile = plant + 2 waters + harvest = 4 energy per 100 s; 9 tiles need 19.8 actions/min — exactly energy-bound at the start. Pumpkin ×9 needs 13.5/min, lemon ×9 12/min.
- Counter gates, carrot-only play (5 harvests + 10 waters per min): 40 waters ≈ 4 min, 40 harvests ≈ 8 min; 150 waters ≈ 15 min, 120 harvests ≈ 24 min. Tool bot (PLAN batch 5): Water Cart affordable at tick 984 (16 min), Reaper not by 1200 (≈ 2300 ticks ≈ 38 min).
- Sim with mining + pumpkin (PLAN batch 8): water certificate tick 628 (10.5 min), first hire 643, harvest certificate 1141 (19 min), pool 6 by the hour.
- Cash to 2 workers: water cert 100 + hire 80 + harvest cert 150 + hire 136 + mine license 50 + 3 wood 12 = 💰528 + 20 stone ≈ 4.8 min of pumpkin income (110/min) or 12.6 min of carrot (42/min).
- Hires 80 × 1.7^n = 80, 136, 231, 393, 668, 1136 (sum 2,644).
- Cash/h before vs after, 9 tiles (PLAN batch 10, 1 h bots): pumpkin manual 6,707 → water+harvest 5,842 (−13 %) → +planter 5,636 (−16 %, player energy 0) → +copper tools 6,755 (+0.7 %). Lemon 8,048 → 7,262 → 7,088 → 8,615. So full automation costs 13–16 % and frees 100 % of energy; with copper tools it is free. After water+harvest the player plants 1.5–2.2 times a minute: ~92 % of energy is idle → mine or nothing.
- Wages, 24 lemon tiles: basic can 1,920/h = 8.9 % of net 21,600; copper can 1,200 = 5.6 %; maxed farm (sell ×1.5, grow ×0.5) 1,680 of 69,600 = 2.4 %. Wages fade as the farm matures.
- Time to 💰1M: 14.4 h at the maxed 69,600/h, 25 h at 40k/h, 52 h at 19.4k/h; plus 8 h offline windows at +💰69,849 each with a planter (PLAN batch 10). A real player at 1M has played/idled several days; it is not a bug.

Reference ratios
- AdCap lemonade: buy $3.74, profit $1 per 0.5 s; manager $1,000 ≈ 267× base price [1][2]. Cookie Clicker: Cursor 15 cookies at 1 cookie/click, Grandma 100 [3]. Trimps: Farmer 5 food after gathering 1 food/s [6]. Kittens: Catnip Field at 10 catnip, 0.125 catnip/tick [5].
- Cookie Clicker golden cookies: spawn every 300–900 s base (Tmin/Tmax), Click Frenzy ×777 for 13 s, Frenzy ×7 for 77 s; the active/idle gap is several × in a session [4]. tiles A4 at +25 % and B9 at ≈ +10–15 % are deliberately an order of magnitude smaller.

Proposals
- A1 effect: water worker ≈ 16 min, harvest ≈ 38–40 min, both after their tool ladders; the Lv2 tools (tick 655 / 886) stop being skipped.
- A2: at 16 min a 9-tile pumpkin/chilli farm nets ≈ 💰80–110/min → 💰500 ≈ 5–6 min; harvest 💰750 at ~40 min ≈ 7 min. Hire 150 × 1.7^n = 150, 255, 434, 737, 1,253, 2,130 (sum 4,959, 24-pumpkin farm ≈ 300/min → 17 min total).
- A4: 24 lemons = 4 harvests/min = 4 energy/min; +25 % × 26,400 gross = +💰6,600/h for the attentive player; 9 pumpkins +💰1,350/h. Energy cap means the bonus is bounded by 20 harvests/min = at most 2 crops' worth of a 24-tile farm's full ripening; it can never exceed what the farm grows.
- B8: energy per extra crop = grow/10: carrot 10, chilli 16, pumpkin 24, lemon 36 → cash/energy 0.8 / 1.25 / 2.1 / 2.5 vs mining 1.5–2.3 and farming 2.1–11.
- Deeds at 💰1M lifetime = ⌊√100⌋ = 10 (gate 8 at 640k): the rich player is already past the first prestige gate; deeds are where that cash goes.

======================================================================
3. FINDINGS PER QUESTION
======================================================================

Q1 — Early automation pacing (minutes manual / first cost vs income / what stays manual)
- Cookie Clicker: Cursor 15 cookies (≈ 15 clicks, under a minute), produces 0.1 CpS; Grandma 100; every building ×1.15 per owned [3]. Clicking stays the main income for minutes and keeps mattering through click-power upgrades and golden cookies [4].
- AdVenture Capitalist: lemonade $3.74 / $1 per 0.5 s; first manager Cabe Johnson $1,000 (unlocks the business running itself, offline too) [1][2]. Reachable in the first few minutes (time not confirmed). After it the player still hand-clicks the other nine businesses and buys units: automation is per business, so a new manual thing appears with every unlock.
- Idle Miner Tycoon: managers appear once the first shaft is level 5, "beforehand you need to manually manage your workers" [7][8] — a minute or two; the elevator and warehouse remain tap-driven until their own managers; each new mine restarts the ladder.
- Kittens Game: 10 catnip gathered by hand → first field (0.125/tick); kittens arrive after huts (5 wood = refined catnip), farmers then automate catnip; a few minutes [5][9]. The player keeps assigning jobs, refining and building for the whole game.
- Trimps: "Gather" 1 food/s by hand; a Farmer costs 5 food [6] — automation after seconds, but the player's own gather button remains a job for hours (the "player" is a worker), and build/fight/maps stay manual.
- Melvor Idle: no manual phase at all; every skill repeats once started. "Manual" is choosing and switching activities, gear and mastery; the game advertises "no prestige" (prestige report).
- Rusty's Retirement: first bots "after getting a few crops through the generator" (Water Bot 60 biofuel + 290 spare parts per a Reddit summary; page not extractable, snippet only) [10][11]; the player keeps laying plots and paths.
- Hay Day: Bakery at level 2 for 20 coins [12]; production buildings are timers, but planting and harvesting crops is never automated in Hay Day — the farm sim keeps its core chore forever, the idle game automates it in the first minute.
- Egg Inc, FAPI, Idle Farming Empire: not confirmed beyond store copy; Egg Inc's manual hatchery tapping is replaced by internal-hatchery research while drone tapping stays a hand chore that players auto-click [13].
- Reading for tiles: the genre does not lengthen the manual phase; it stacks ladders (AdCap/IMT per business/shaft) and keeps a paying hand action. tiles has the stacked ladders (crops, mine, furnace, Workshop); what it lacks is the paying hand action after certificates (A4) and the ladder order inside one job (A1).

Q2 — Active play after automation
- Mechanics with numbers: Cookie Clicker golden cookies (spawn 300–900 s base, quartered with three upgrades; Frenzy ×7 / 77 s; Click Frenzy ×777 / 13 s; Lucky = min(15 % bank, 15 min CpS)); combos (Frenzy + Click Frenzy) are the top active play and the wiki documents the timing windows [4]. Clicker Heroes splits ancients into idle (Siyalatas) vs active (Juggernaut click combos) builds; the wiki recommends active only with auto-clickers, idle "on a fresh save" [14][15]. Idle Slayer sells itself as "active vs idle, switch between", and its own players complain the idle half "has disappeared" as content leaned active [16]. Realm Grinder: clicking and mana spells are the active layer, faction choice decides whether active or idle pays [17]. Leaf Blower Revolution: manual blowing vs autoblowers, "play actively or passively" [18].
- Ratio: idle games put active play at several × idle in short bursts (CC combos), while "idle-friendly" designs keep it ≤ ~2× (CH idle builds, Idle Slayer's offline souls "dependable, not as fast as active") [16]. No source gives a single genre number; mark unconfirmed.
- Chores/FOMO (quotes): Egg Inc drones — guides tell players to use eight fingers or an auto-tapper [13]; Hay Day boats on 5-minute timers — "I only log in once daily… missing a lot of boats", "the previous system allowed more time" [19]; daily logins — "a lazy or manipulative way to get players to keep the game in mind every day", "I hate them" [20]; Egg Inc boost/piggy changes — "done after this update" [21]. Pattern: the hated active mechanics are timed and lossy (miss it = lose it). The accepted ones are additive and bounded (golden cookies add; nothing is lost by not being there).
- For tiles: A4 (additive, bounded by energy, 0 offline loss), B8 (energy sink, 0 loss), B9 (live-only, small). All three use existing tools/energy/tiers; none adds a timer that can fail offline.

Q3 — Rebalancing with rich veterans
- Melvor Idle: Township at launch "blows all previous moneymaking methods out of the water… totally passive" [22]; the 2023 nerfs (GP costs up, crate requirements) drew "extremely harsh and should be reverted… unusable until much later" [23], and the rework's 10M GP unlock worried players about newcomers [24]. Lesson: cutting the rate of a source people already built around = backlash; raising the gate on new things is accepted.
- OSRS: GE tax 1 % introduced Dec 2021 (now 2 %, capped 5M per item), exempt under 100 gp and for new-player items; proceeds buy and delete items (item sink) [25][26]. It was polled; players still post "hyperinflation… what is the plan" in 2024 [27]. Prices never scale with the player's wealth; sinks are flat percentages everyone pays.
- Path of Exile: "leagues are basically economy resets"; Standard, where old wealth lives, is played by ~15 % (Chris Wilson, GDC 2019, via a Reddit summary) [28]. The reset is a cohort choice, never forced on the Standard pile.
- Stardew 1.6: added items and "balance and price adjustments" plus new sinks; no wealth-scaled pricing; Qi gems remain the challenge currency (cash-sinks report) [29].
- Cookie Clicker 2.0 (Feb 2016): the old save was automatically exported to a frozen v1.0466 build; heavenly chips reworked; later patches "tweaked the prices of some heavenly upgrades to better fit the current economy", queenbeets 6 % → 4 % [30]. Lesson: keep the old build alive, rebalance prices not holdings.
- Egg Inc: piggy-bank cap and boost changes (2019) — owned 1000× soul-egg boosts dropped to 500× — "4 months in. Done after this update" [21]. Taking value out of owned items is the one thing that makes people quit.
- Idle Champions: Jimothy/Asharra nerfs → "game is being systematically gutted", negative-review threads [31].
- Price scaling by wealth: the nearest precedents are level scaling (Oblivion — "one of the main designers… said monsters leveling with the player was a mistake" per a Steam thread, original quote not found) [32] and RimWorld wealth-based raids, which needed a wealth-independent mode (cash-sinks report). Players read it as the game punishing success and as a hidden tax.
- One-time conversions: none found in the idle games checked; CC converted saves by keeping the old game, not by exchanging currency (unconfirmed elsewhere).
- Verdict for tiles: material gates (bars) + a second currency (⭐) + prestige as the outlet; cash prices in the 0.5–1.5 h band for the intended tile count; accept that the 💰1M player buys cash parts instantly.

Q4 — Concretely, the next patch: see §1 A1–A6; rule checks: (1) A1 strengthens the ladder; A4/B8/B9 add no automation. (2) Only prices, gates and additive rewards change; v12 adds milestones with defaults; nothing is removed; the −10 % market dip is a balance number, not a migration. (3) A4 raises farming per energy only; B8 is below farming and ≈ mining; the sim should assert max mining < 0.9 × pumpkin with A4 on. (4) Worst-case 8 h offline loss for every proposal = 0 (no timers, no upkeep added; the market's glut from offline worker sales equals the online steady state). (5) All are tables and rules, no special cases.

Q5 — Feedback without a backend
- Norm in browser idles: export/import of a base64 save string (Cookie Clicker [33], Trimps FAQ "Go to Export and export your save file… save it in a text file" for bug reports [34], Antimatter Dimensions "Export to Web… paste on a site like paste.ee" [35]); communities then build save viewers/editors (AD save editor, Kittens "save file decoder", Melvor save editors) [35][36][37]. AD's Statistics tab shows past Infinities and fastest times [38] — the in-game timeline precedent.
- Telemetry options if ever wanted: Plausible/GoatCounter custom events from a static page (no PII, one event per milestone) [39][40]; a Cloudflare Worker free tier for a tiny POST endpoint [41]. At tiles' player count the paste route is enough and needs no consent screen.
- What to record (A5): tick (and run number later) for first harvest, each license, each tool level, each certificate, each hire, vein Lv1–3, furnace, first bar, copper/iron pickaxe, tiles 12/16/20/24, lifetime cash 1k/10k/100k/1M, first prestige. Reading a pasted report: 20 lines, each "milestone: 12m 34s"; a 10-line node script over the JSON prints the same from a full save.

======================================================================
4. SOURCES
======================================================================
1 https://adventure-capitalist.fandom.com/wiki/Lemonade_Stand
2 https://adventure-capitalist.fandom.com/wiki/Managers
3 https://cookieclicker.wiki.gg/wiki/Buildings ; https://cookieclicker.fandom.com/wiki/Cursor
4 https://cookieclicker.fandom.com/wiki/Golden_Cookie ; https://cookieclicker.wiki.gg/wiki/Golden_cookie
5 https://wiki.kittensgame.com/en/general-information/resources/catnip
6 https://trimps.fandom.com/wiki/Guide:From_Zone_1
7 https://idleminertycoon.fandom.com/wiki/Managers
8 https://idleminertycoon.fandom.com/wiki/Fundamental_Gameplay
9 https://www.reddit.com/r/kittensgame/comments/2x45zy/early_game_what_am_i_supposed_to_do/ (snippet)
10 https://progameguides.com/rustys-retirement/things-to-do-first-in-rustys-retirement/
11 https://www.reddit.com/r/rustysretirement/comments/1cmw1cz/understanding_rustys_retirement/ (snippet only)
12 https://hayday.fandom.com/wiki/Bakery
13 https://www.reddit.com/r/EggInc/comments/5v2g18/patashus_egg_inc_guide/ ; https://www.reddit.com/r/EggsInc/comments/1r9p9zn/drone_automation_takedown_for_4x_drones_day/ (snippets)
14 https://clickerheroes.fandom.com/wiki/Builds
15 https://steamcommunity.com/sharedfiles/filedetails/?id=2011778243
16 https://www.reddit.com/r/idleslayer/comments/1bvf6qt/the_idle_in_idle_slayer/ ; https://play.google.com/store/apps/details?id=com.pabloleban.IdleSlayer
17 https://allgameguides.com/games/realm-grinder/guides/tips/
18 https://apps.apple.com/us/app/leaf-blower-revolution/id6443698340
19 https://www.reddit.com/r/HayDay/comments/1x5f6eu/boat/ ; https://www.reddit.com/r/HayDay/comments/1vqvilf/harder_boat_orders_lol/ (snippets)
20 https://www.reddit.com/r/incremental_games/comments/w4o3x8/daily_login_rewards_automation_and_monetization/ (snippet)
21 https://www.reddit.com/r/EggsInc/comments/e9mxvx/4_months_in_done_after_this_update/
22 https://www.reddit.com/r/MelvorIdle/comments/yd0pzy/township_must_be_nerfed/ (snippet)
23 https://www.reddit.com/r/MelvorIdle/comments/169n1aa/the_township_nerfs_are_extremely_harsh_and_should/
24 https://www.reddit.com/r/MelvorIdle/comments/11y1uh8/township_rework_details/
25 https://oldschool.runescape.wiki/w/GE_tax
26 https://massivelyop.com/2021/12/13/old-school-runescape-adds-a-grand-exchange-tax-and-item-sink-system-proposes-death-pile-changes-to-ultimate-ironman/
27 https://www.reddit.com/r/2007scape/comments/1b2yu0a/jagex_what_is_the_plan_with_the_economy/ (snippet)
28 https://www.reddit.com/r/pathofexile/comments/bca17x/chris_wilsons_gdc_talk_raised_a_few_questions_and/ ; talk: https://www.youtube.com/watch?v=Z4FBAqwae-Y
29 https://www.pocketgamer.com/stardew-valley/patch-notes-1-6/ ; https://stardewvalleywiki.com/Version_History
30 https://w.atwiki.jp/cookieclickerjpn/pages/65.html (English changelog mirror) ; https://cookieclicker.wiki.gg/wiki/Version_History
31 https://www.reddit.com/r/idlechampions/comments/171g0pk/game_is_being_systematically_gutted/ ; https://steamcommunity.com/app/627690/discussions/0/3394037847197285323/ (snippets)
32 https://steamcommunity.com/app/2623190/discussions/0/604154270792674962/ (snippet)
33 https://cookieclicker.fandom.com/wiki/Save
34 https://www.reddit.com/r/Trimps/wiki/faq/
35 https://steamcommunity.com/app/1399720/discussions/0/3732953628857389852/ ; https://antimatterdimensions.online/save-editor/
36 https://wiki.kittensgame.com/en/general-information/third-party-scripts
37 https://wiki.melvoridle.com/w/FAQ ; https://github.com/muratdede/MelvorSaveEditor
38 https://antimatter-dimensions.fandom.com/wiki/Guide
39 https://plausible.io/docs/custom-event-goals
40 https://www.goatcounter.com/help/events
41 https://developers.cloudflare.com/workers/platform/pricing/
Background: Pecorella GDC 2015 https://archive.org/details/GDC2015Pecorella (slides PDF returned 403; not quoted).

Could not confirm: minutes-to-first-manager in AdCap and IMT (costs confirmed, timings not); Egg Inc internal-hatchery research cost; Farmer Against Potatoes Idle and Idle Farming Empire automation numbers; Rusty's bot prices (snippet only); a single genre-wide active:idle income ratio; the Oblivion designer quote's primary source; any idle game that did a one-time currency conversion at a patch; Clicker Heroes 1.0 compensation details; Pecorella's own words on first-automation timing.
