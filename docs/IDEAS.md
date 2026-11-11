# Ideas backlog (parked)

Status of every entry: **parked — needs research and a go from Toon before it becomes a batch.**
Source: Toon, Discord thread "idea / features เพิ่มเติม", 2026-11-09. Each idea gets designed one at a time,
research first (recipe: `docs/research/*.md` style offload), then a DECISIONS entry, then a batch.

"Exists today" lines were checked against the code/docs on 2026-11-09 (HEAD ec57888, save v18).

---

## 1. Save hash for cross-device import + attach to feedback

Idea: export the save as a code, import it on another device; attach it to a bug report so a reported
problem can be loaded and reproduced directly, cutting debug time.

Exists today:
- Export/import already ships: `src/app/SaveTransfer.tsx` (📊 Stats → Save; base64 export, import behind a two-press confirm).
- Feedback form already sends build, save version, screen, UA, a game summary and the timeline
  (`src/app/feedback.ts` `buildFeedbackBody`, lines 38–55) — but **not the save itself**.

Open questions:
- Save size as base64 vs the Google Form field limit (details are capped at `DETAILS_MAX = 2000`). Probably a
  separate form field, or compression (e.g. deflate + base64) — measure a late-game save first.
- Opt-in checkbox ("attach my save") — privacy/consent, and the contact field is optional.
- Dev-side loader: a `?load=<code>` or dev-only paste path that runs the normal migration chain, so an old-version
  save from a report is migrated like any other.
- Integrity: a checksum so a truncated paste fails loudly instead of loading half a save.

## 2. Foraging (extends dig-for-seeds)

Idea: a worker can dig for seeds (saves seed cost long term); chopping trees for wood used in buildings/crafting;
gathering wild items for crafting.

Exists today: dig (farm action, finds seeds) and mine are separate systems; wood is bought with cash in the Shop
(DECISIONS line ~55, price 4, resell 2). DECISIONS line 112 already lists "Later: logging (chop wood), dig mastery".

Open questions:
- Dig worker must cost more per seed than buying seeds at the stage it unlocks, or it kills the seed shop
  (skill rule 6c: price against net income at that stage).
- Where trees grow (farm tiles? a separate woodland zone?) — rows are not stable, use a tile count/zone.
- Does chopped wood replace bought wood, and what happens to the wood shop price (no arbitrage)?
- Wild-item list and what each crafts into — needs item #3/#4 recipes first.
- Automation ladder: manual → certificate worker → upgrade (rule 6b).

## 3. Crafting from mined/dug materials → buildings, storage

Idea: stone, ore, soil (from digging) etc. become building materials for processing structures; also solves storage
by letting players build extra chests/sheds.

Exists today: Storage upgrade (+10 slots, stone + cash, ×1.6/level, max 5 — DECISIONS line 163); furnace already a
stone+coal+cash building.

Open questions:
- Chests/sheds vs the existing Storage upgrade: replace it, extend past Lv5, or per-item-type storage?
- Soil as a resource: does dig produce soil today, and does taking it cost anything (tile fertility)?
- Every material price must fit the storage capacity at that moment (sim-enforced rule, DECISIONS line 164).

## 4. Processing (artisan goods)

Idea: turn crops into higher-value goods (jam, wine…), single or multi-crop recipes, each needing a building first
(e.g. grapes → wine needs a fermenting barrel made of wood + rope).

Open questions:
- Value model: Stardew-style multiplier (time × price) vs flat; must beat selling raw only after the wait.
- Interaction with the crop market glut (DECISIONS "Crop market", line ~288): processing could be the way to dodge a
  glut — intended or an exploit?
- Offline behaviour: processing timers inside the 8 h catch-up cap.
- New crops needed (grapes?) and new intermediate items (rope → from what?).
- Depends on #2/#3 (wood, rope, building materials).

## 5. Marketplace — buy resources with cash (late-game cash sink)

Idea: buy resources with cash to drain players with huge balances; price scales as a % of the player's cash so it
cannot be used often to skip upgrade tiers; buildings need resources.

Exists today / prior research: `docs/research/cash-sinks.md` point 6 says **do not** add a cash→ore trader (at vein
Lv2 an ore price above ≈💰35 makes mining beat pumpkin farming per energy) and **do not** let cash skip material gates.

Open questions (conflicts to resolve first):
- A %-of-wealth price is a wealth tax in disguise; players can game it by spending down before buying. Cap or floor?
- Which resources are allowed (raw only, never gated items?) so the cash-sinks.md rule holds.
- Compare with the existing orders/market sinks before adding another.

## 6. Livestock

Idea: raise animals for products to sell (cow → milk) or to process for more value (milk → cheese, takes time).

Open questions:
- Upkeep model (feed from crops = a crop sink?) and the worst-case offline loss (rule: state the bound before any
  upkeep mechanic).
- Space: animals on tiles or in a barn building (#3)?
- Processing reuses #4's building/timer system.

## 7. Fishing

Idea, three uses:
1. Catch to sell.
2. Catch to process into temporary consumable buffs; with enough crafting workers the buff can stay up permanently.
3. Collect rare fish; completing the collection (per category) gives a permanent % buff.

Open questions:
- Mechanic for an idle game (timed cast, energy cost, no twitch minigame?).
- Buff uptime by workers must be priced against net income at that stage (rule 6c).
- Permanent collection buffs vs prestige ("Sell the farm", batch 20): survive prestige or reset?
- Stacking caps so collection % buffs don't break the farming/mining hierarchy the sim pins.

## 8. Worker rework — unique hires (Toon, 2026-11-12)

Idea: a hire is a person, not a counter. Each candidate rolls stats, quirks and traits — good at some jobs, bad at
others — so who goes on which job becomes a real decision.

Open questions:
- How the hiring pool works: a few candidates to choose from per hire? Reroll the pool, maybe with ⭐?
- Can traits be improved (training), and what does it cost?
- Prestige: do workers reset on "Sell the farm", or can one favourite be kept (a deed or ⭐ keep row)?
- Migration: today's workers are interchangeable counts; old saves need a neutral-trait default.
- 375 px: a roster of distinct people needs a compact card; check against the tab bar and the worker pool UI.
- The Manager's assignment logic must read traits (or ignore them deliberately).
- Every trait names the one axis it owns (DECISIONS layer rule) and is priced against the sim.
- Ties into ⭐ Favours (reroll / train / keep) and the prestige-variety research (per-run hire pools).

---

## Suggested research order (proposal, not decided)

1 (small, mostly done, pays off immediately for debugging) → 2 + 3 (materials and buildings are the base for
everything else) → 4 → 6 (reuses 4) → 7 → 5 (last: it must not undercut the material gates 2–4 create).
