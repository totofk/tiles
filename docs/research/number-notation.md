TILES — NUMBER AND CURRENCY NOTATION (research only; nothing in the repo was edited, created or committed)

SUMMARY

1. This is a display problem, not a currency problem. tiles spans about 7 orders of magnitude (💰20 to 💰15M), which is small for the genre. Do not rescale stored numbers.
2. No lossless re-denomination exists for integer cash: 15,266,531 ÷ 1000 is not an integer.
3. Exact amounts under 1,000,000 get grouped digits (500,000 · 385,500). From 1,000,000 they get a suffix (M, B, T, Qa). This is Cookie Clicker's rule, read from its source [1].
4. No "k" for exact money. At 4 significant digits "385.5k" is no shorter than "385,500". "k" stays for estimates (≈💰386k/h) and the 52 px Estate cell.
5. HUD balance: 3 fixed decimals, rounded down (15.266M). At 💰2.64M/h it still changes every ~1.4 s, so the number keeps moving.
6. Prices: rounded up, trailing zeros trimmed (1.5M · 3M · 1.275M). Held amounts round down. The display can then never say "affordable" when it is not (0 violations in 200,000 random pairs on a throwaway prototype).
7. Can't-afford: disabled button, the blocking part marked, exact "needs 💰12,500 more", and a time estimate where income is known. The repo already has all of these in places; make them universal.
8. Rates: 💰/h everywhere, never 💰/s. The code, the pricing rule (0.5–1.5 h of income) and the 8 h cap already think in hours.
9. ⭐, bars, deeds and counters: grouped integers, never abbreviated.
10. No notation setting now. Every game checked that shows K/M/B/T shows the same thing below 1e12; options only matter past that.
11. One hand-rolled module, src/app/fmt.ts, fixed en-US, no Intl. A vitest source scan blocks raw 💰${n}.
12. compactCash has two carry bugs and rounds prices down; fold it into the new module.
13. Measured at 375 px: "💰500,000" is 3 px wider than "💰500000"; "💰1.5M" is 27 px narrower than "💰1500000".
14. The repo working tree changed under me (9 files, market/cropFactor work, not mine). Line numbers are as read at about 00:05–00:14.

THINGS TO KNOW BEFORE READING

- Another session is editing the repo. git status went from 5 to 9 modified files while I was reading (estateText.ts, marketText.ts, core/fields.ts, core/market.ts and five tests). I ran only read commands there.
- compactCash, same formula run in node: 999,500–999,999 gives "1000k"; 1e9 gives "1000.0M"; 385,400 gives "385k", which understates a price.
- There are 38 interpolation sites in 17 files under src/app, plus 2 in src/core/stats.ts (lines 78 and 92), which builds 💰 strings inside core.
- Tests: 123 lines in 23 files mention 💰. Only literals of 1,000 or more change; I counted 23.
- Widths were measured on the live build in desktop Chrome on macOS with 375 px emulation. Android and iOS fonts will differ by a few px.
- Number is exact only to 9.007e15, so the suffix ladder can stop at Qa. A future layer that pushes cash past that is a design problem, not a formatting one.
- Outside the repo: one temp download in the Hermes scratch dir (deleted), and the web tool's automatic page cache.

Q1. NOTATION FOR THE MAIN CURRENCY

What games do
- Cookie Clicker [1]: under 1,000,000 it shows full digits with commas (586,352). From 1e6 it shows up to 3 decimals plus a word ("5.003 billion"), rounded. Its k/M/B list is defined but Beautify never selects it.
- Melvor Idle [5][6]: full digits under 100,000. Default "1,000K" format: 123,456 → 123k, 1,234,567 → 1,234K, 12,345,678 → 12M.
- Old School RuneScape [7]: exact under 100,000, K up to 9,999K, M from 10,000,000, truncated, with a colour per tier.
- Kittens Game [8]: SI letters (K M G T P), K starting at 9,000, up to 2 decimals.
- Trimps [9]: "12.7M, 540B", 3 significant digits.
- AdVenture Capitalist [13]: 3 decimals plus full words ("$39.559 billion", "$231.374 duoquadragintillion").
- Universal Paperclips [15]: the main counter is full grouped digits ("97,665,230,705,956,900"); secondary numbers are "1.3 quadrillion".
- Egg Inc [12]: K M B T, then q Q s S.
- Antimatter Dimensions [2][3]: default is "Mixed scientific", named suffixes then scientific (below 1e33 per the wiki, [snippet]).
- Community [21f]: k, M and B are "fairly universal"; past that "no two games agree". Letter schemes (aa/ab) are disliked by this audience [21e][21g].
- Community [21a]: the main counter should keep a fixed digit count so it does not jump; a round fixed price needs no padding.
- Not confirmed: NGU Idle's options; Idle Slayer and Leaf Blower only from snippets [18][19].

Recommendation for tiles (outputs from the prototype)

    value            HUD (held)   price     toast gain   ≈ rate    52 px cell
    540              540          540       540          540       540
    7,500            7,500        7,500     7,500        7,500     7,500
    22,000           22,000       22,000    22,000       22k       22k
    385,500          385,500      385,500   385,500      386k      386k
    500,000          500,000      500,000   500,000      500k      500k
    999,999          999,999      999,999   999,999      1M        1M
    1,005,500        1.005M       1.006M    1.005M       1.01M     1.1M
    1,499,999        1.499M       1.5M      1.499M       1.5M      1.5M
    1,500,000        1.500M       1.5M      1.5M         1.5M      1.5M
    2,572,125        2.572M       2.573M    2.572M       2.57M     2.6M
    15,266,531       15.266M      15.267M   15.266M      15.3M     16M
    152,665,310      152.665M     152.666M  152.665M     153M      153M
    999,999,500      999.999M     1B        999.999M     1B        1B
    1,528,235,000    1.528B       1.529B    1.528B       1.53B     1.6B

- The Manager certificate becomes "🥇4 💰500,000"; the pumps "💰500,000 / 1.5M / 3M"; Toon's HUD "💰 15.266M".
- Lowercase k, uppercase M B T, then Qa. No space before the suffix.
- One prototype helper printed 500,000 as "5k" (a trailing-zero trim bug). The table shows the specified "500k"; pin that case in the tests.
- Aside, my inference: "B" can read as Baht to Thai players. It only appears at 1e9, so I would leave it.

Q2. PLAYER-SELECTABLE NOTATION

What games do
- Games that go far past trillions have it: Antimatter Dimensions lists 24 notations [3]; Trimps 5 [9]; Realm Grinder has Short/Scientific/Engineering plus a separator toggle [11]; Kittens has 3 [8]; Idle Obelisk Miner has 3 plus "extra digits" [16]; Melvor has 2 plus "remove commas" [6]; Cookie Clicker has one toggle [1].
- The community asks for it repeatedly [21d][21e][21g]. AdVenture Capitalist has none and players ask for it [14, snippet].
- The standard set is Standard (suffix), Scientific and Engineering, sometimes Letters. Defaults are suffix or mixed.

Recommendation: not now. tiles tops out around 1e7–1e9 per run, where every notation agrees. Give fmt a mode argument so a later "Full numbers" toggle (stored in tiles.ui, which the save never reads) is a one-file change. Add Scientific only if a later layer passes 1e15.

Q3. PRECISION, ROUNDING AND "CAN'T AFFORD"

What games do
- Cookie Clicker rounds: 1,499,999 displays as "1.5 million" [1]. It relies on the price colour, and its tooltip shows the time until affordable ("in X") [1]. The red/green colour itself is from memory.
- Kittens marks each lacking resource line with a noRes class [8].
- Trimps shows each ingredient green or red [10, snippet].
- Community: "Always round up displayed costs, always round down displayed possessions" [21b]. Use the same formatter for prices and balances [21c].

Recommendation
- Held amounts round down; prices and shortfalls round up. Then "shown held ≥ shown price" always implies it is really affordable. The reverse (affordable but looks 1 short) is harmless because the button is enabled.
- A price is never rounded down. Today's Estate ghost cell does exactly that.
- Affordability is never carried by digits alone. Use the disabled state, a mark on the blocking part, and an exact shortfall line.
- The repo already has the pieces: shortOf ("needs … more") in TierTool, Workshop, FarmGrid and EstateMap, and afford() ("≈~12 min") in estateText.ts. Extend them rather than invent a new pattern.
- No progress bar in every button; it is noise at 375 px.
- Optional: snap cash prices of 1e6 or more to multiples of 1,000 in scalePrice and plotCost, so the shown price is the real price. No save impact (prices are derived); under 0.05% change.

Q4. MIXED COSTS

What games do: I found no universal ordering convention. What is common is one token or line per resource with a per-part can't-afford state (Kittens [8], Trimps [10]).

Recommendation
- Keep today's order: materials in ITEM_IDS order, then ⭐, then 💰 last. Gates come first; cash is the part that solves itself with time.
- Build one PriceLine component in src/app that renders the tokens, marks short ones (colour plus the "needs … more" line as the non-colour cue), and keeps the U+2060 joiner so emoji and number never split.
- Measured at 13.3 px in a 162 px shop button: "🥇4 ⭐40 💰1.5M" is 113 px against 146 px with full digits. "needs 🥇2 💰12,500 more" is 164 px and wraps, as it can today.

Q5. RATES

What games do
- Cookie Clicker and Paperclips show per second [1][15].
- Kittens shows per second with a per-tick option; its source has a comment that values could later scale "e.g. minutes, hours" [8].
- Egg Inc shows laying and shipping per minute [25, snippet].

Recommendation: 💰/h everywhere.
- The code already uses ≈💰/h in estateText, Estate and tips.
- The pricing rule is in hours, so price ÷ rate is the wait.
- Early income per second would be below 1.
- Estimates carry ≈ and 3 significant digits. Show time-to-afford wherever income is known; players want that more than the rate.

Q6. "ADJUST THE CURRENCY" ITSELF

- Divide everything: start cash 20 and seed prices of 1–2 become fractions, and integer cash cannot be divided losslessly. That breaks the save rule.
- Compress the growth curve: this is a full rebalance. Lifetime cash feeds deeds (√(lifetime ÷ 10,000)), and the save does not record when cash was earned, so no faithful migration exists.
- Either one touches cash, lifetime totals, loans, run history, every price, the milestone thresholds and the sim pins, for zero gameplay gain. Smaller numbers also read as a take-away in a genre about growth.
- Precedent: in 2011 Blizzard weighed a display fix ("Mega Damage", K/M) against a squish and reportedly chose the display fix [23, snippet]. The 2014 squish needed "this isn't a nerf… the numbers will be easier to comprehend" [22].

Recommendation: display only. SAVE_VERSION stays 23.

Q7. SECOND CURRENCIES

What games do
- Cookie Clicker's ascend screen shows heavenly chips with commas only, not shortened [1].
- Melvor puts Slayer Coins under the same formatting rule as GP [5].
- Community [21a]: "I don't wanna know I have 2.05e3 of something I can only have 5000 at most."

Recommendation: same module, separate function. count(n) is a grouped integer and never abbreviates (⭐37 · 🥇10 · 12,345 harvests). Anything capped below 100,000 by design stays exact.

Q8. IMPLEMENTATION SHAPE (plan only)

- src/app/fmt.ts, pure and hand-rolled:
  - group(n) — comma grouping.
  - held(n) — HUD balance.
  - price(n) — costs and shortfalls.
  - gain(n) — toasts.
  - approx(n) — ≈ rates.
  - cell(n) — replaces compactCash.
  - count(n) — ⭐, bars, counters.
- Move priceText (now in Mine.tsx) and shortOf (now in Workshop.tsx) next to it.
- Apply to: Hud, Shop, Upgrades, Workers, Workshop, Mine, Farm, Bank, Legacy, Orders, Estate, EstateMap, estateText, marketText, Tools and App toasts, and the useGame offline summary.
- core/stats.ts: return numbers for the two cash rows and let Stats format them. This also removes display strings from core.
- Feedback reports and save export keep raw integers.
- Locale: fixed en-US. Do not use Intl compact: it needs Safari 14.1 / iOS 14.5 [24] and defaults to 2 significant digits [24]. Device-locale formatting would also break pinned test strings.
- Tests:
  - tests/fmt.test.ts in the node environment, table-driven: boundaries 999/1,000 and 999,999/1,000,000; carry at 999,999,500; 500,000; fractions; negatives; NaN.
  - The floor/ceil property test from Q3.
  - Character budgets instead of layout (jsdom has none).
  - Two or three jsdom component tests on the real fixture: HUD "15.266M", Manager certificate "🥇4 💰500,000".
  - A real-browser pass at 375 / 1024 / 3440.
- Guard: a vitest source scan in the style of appCss.test.ts.
  - Fail on 💰 (optionally U+2060) followed by ${ or { outside fmt.ts.
  - Fail on 💰 followed by 5 or more bare digits.
  - Fail on toLocaleString outside fmt.ts.
  - An ESLint no-restricted-syntax rule on TemplateElement and JSXText is an optional extra for editor feedback.
- Related raw number: the HUD's ⏱ {run.tick} shows raw seconds. core/stats.ts already has duration().

DECISION LIST (reply with the numbers you reject)

1. Display only: no change to stored cash, prices or SAVE_VERSION. Reason: no lossless migration exists and the scale is not the problem.
2. Exact money under 1,000,000 → grouped digits ("999,999"); from 1e6 → M, 1e9 → B, 1e12 → T, 1e15 → Qa. Reason: Cookie Clicker's rule; commas alone fix "500000".
3. No "k" for exact money. Reason: "385.5k" saves nothing over "385,500". Alternative if rejected: k from 100,000, Melvor/OSRS style ("500k", "385.5k").
4. HUD balance: 3 fixed decimals, rounded down, tabular-nums ("15.266M"); exact value in the title and in Stats. Reason: steady width and it still ticks every ~1.4 s.
5. Prices and shortfalls: up to 3 decimals, zeros trimmed, rounded up ("1.5M", "3M", "1.275M"; 999,999,500 → "1B"). Reason: a price is never understated.
6. Toast gains: like prices but rounded down ("+💰540", "+💰12,400", "+💰1.2M"). Reason: never overstate a gain.
7. Estimates: 3 significant digits, k from 10,000 ("≈💰12.8k/h", "≈💰386k/h", "≈💰2.64M/h"). Reason: they are already marked ≈.
8. Estate cell: "5,500 · 386k · 1M · 1.2M · 15M · 1.2B", rounded up. Reason: fixes "1000k", "1000.0M" and the understated price.
9. Rounding invariant test: shown held ≥ shown price implies affordable. Reason: answers "1.50M shown, 1,499,999 held" for good.
10. Can't-afford = disabled + marked part + exact "needs … more" + time where income is known; no per-button bars. Reason: the repo already uses this pattern in five places.
11. Mixed-cost order stays materials → ⭐ → 💰, through one PriceLine component. Reason: no convention found, so consistency wins.
12. Cash rates are always /h. Reason: matches the code, the pricing rule and the offline cap.
13. ⭐, bars, deeds and counters: grouped integers, never abbreviated. Reason: small capped numbers should just be numbers.
14. No notation setting now; fmt takes a mode for a later "Full numbers" toggle. Reason: below 1e12 all notations agree.
15. src/app/fmt.ts, hand-rolled, fixed en-US, no Intl or toLocaleString. Reason: deterministic tests and no browser-version floor.
16. core/stats.ts returns numbers for cash rows; feedback and export stay raw. Reason: core stays pure and bug reports stay exact.
17. Vitest source-scan guard (ESLint rule optional). Reason: the 40 sites came from having no guard.
18. Optional: snap cash prices of 1e6+ to multiples of 1,000 in balance.ts. Reason: shown price equals real price.
19. Optional: HUD ⏱ uses duration() instead of raw ticks. Reason: same readability problem.
20. Milestone labels ("Earned 💰100k") stay as they are. Reason: they are names, and tests pin them.

SOURCES ([snippet] = search-result text only, page not opened)

[1] Cookie Clicker source — https://orteil.dashnet.org/cookieclicker/main.js
[2] Antimatter Dimensions source, player.js — https://github.com/IvarK/AntimatterDimensionsSourceCode/blob/master/src/core/player.js
[3] Antimatter Dimensions wiki, Notations — https://antimatter-dimensions.fandom.com/wiki/Notations (opened; the "24 notations" count and the 1e33 line are from the snippet)
[4] Antimatter Dimensions notations library — https://github.com/antimatter-dimensions/notations
[5] Melvor Idle wiki, Currency — https://wiki.melvoridle.com/w/Currency
[6] Melvor Idle wiki, Settings — https://wiki.melvoridle.com/w/Settings
[7] OSRS wiki, Stackable items — https://oldschool.runescape.wiki/w/Stacking
[8] Kittens Game source (game.js, core.js) — https://github.com/nuclear-unicorn/kittensgame
[9] Trimps wiki, Settings — https://trimps.fandom.com/wiki/Settings
[10] Trimps updates — https://trimps.github.io/updates.html [snippet]
[11] Realm Grinder wiki, Options — https://realm-grinder.fandom.com/wiki/Options
[12] Egg Inc wiki, Order of Magnitude — https://egg-inc.fandom.com/wiki/Order_of_Magnitude
[13] AdVenture Capitalist — https://www.rockpapershotgun.com/adventure-capitalist-numbers ; https://adventure-capitalist.fandom.com/wiki/Money
[14] AdVenture Capitalist Steam thread "Proper Number Formatting" — https://steamcommunity.com/app/346900/discussions/0/144513248274313950/ [snippet]
[15] Universal Paperclips UI as quoted in — https://if50.substack.com/p/2017-universal-paperclips
[16] Idle Obelisk Miner, Options — https://shminer.miraheze.org/wiki/Options
[17] Revolution Idle, Options — https://revolutionidle.wiki.gg/wiki/Options [snippet]
[18] Idle Slayer — https://www.reddit.com/r/idleslayer/comments/1dtuwly/choice_of_notation/ [snippet]
[19] Leaf Blower Revolution — https://steamcommunity.com/sharedfiles/filedetails/?id=2773222340 [snippet]
[20] Farmer Against Potatoes Idle — https://steamcommunity.com/app/1535560/discussions/0/6504942507065816759/ [snippet]
[21] r/incremental_games, full threads read through the Arctic Shift archive (https://arctic-shift.photon-reddit.com/api):
  a. https://www.reddit.com/r/incremental_games/comments/sejom2/ (score 74)
  b. https://www.reddit.com/r/incremental_games/comments/87749r/
  c. https://www.reddit.com/r/incremental_games/comments/1cugov3/ (score 40)
  d. https://www.reddit.com/r/incremental_games/comments/5g5cjn/
  e. https://www.reddit.com/r/incremental_games/comments/crff1a/ (score 56)
  f. https://www.reddit.com/r/incremental_games/comments/5tkqcq/ (score 23)
  g. https://www.reddit.com/r/incremental_games/comments/17ktjlp/ (score 15)
[22] Wowpedia, Stat squish (quotes the Blizzard post) — https://wowpedia.fandom.com/wiki/Stat_squish
[23] Blizzard "The Great Item Squish (or Not) of Pandaria", Wowhead mirror — https://www.wowhead.com/news/dev-watercooler-the-great-item-squish-or-not-of-pandaria-197136 [snippet]; the Mists outcome is from https://www.bluetracker.gg/wow/topic/us-en/4217493363-no-squish-no-new-models/ [snippet]
[24] MDN Intl.NumberFormat — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat ; caniuse — https://caniuse.com/mdn-javascript_builtins_intl_numberformat_numberformat_options_parameter_options_notation_parameter
[25] Egg Inc per-minute rates — https://www.reddit.com/r/EggsInc/comments/bf9cig/ [snippet]

Opened but not used: https://www.simpleidle.com/learn/big-number-notation-explained — two of its claims contradict primary sources (Antimatter Dimensions' default, Egg Inc's suffixes).

Not confirmed: NGU Idle's notation options, Hay Day's have/need display, and the browser versions for Intl roundingMode.
