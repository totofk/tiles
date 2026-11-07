# Design decisions (agreed in Discord thread, 2026-11-07)

These override the PRD where they differ. Source PRD: `docs/PRD.md`.

## Project
- Name: **tiles**. Platform: web (mobile browser must work). Side project, not part of TQM work.
- Stack: Vite + TypeScript + React, Vitest. No Phaser yet (80% of the game is UI/menus + a 6–24 tile grid; DOM is enough). Phaser may be added later for farm visuals because the core is UI-independent.
- No incremental framework (Profectus etc.): they are layer/prestige/big-number engines; this is a management sim with normal-range numbers. We borrow *patterns* only: tick loop, offline catch-up, JSON save + version migration.

## Time model
- **Real-time idle**, no day/night. Core logic advances in fixed **1-second ticks**: `step(state, ticks)`. UI may render at any rate.
- "Daily" costs from the PRD (wages, maintenance, loan interest, market recovery) become **per-second rates**, charged continuously. No end-of-day summary screen (a 60 s "payroll" pulse may be added later; rates make both possible).
- **Offline progress** on load: simulate missed ticks, **capped at 8 hours**. Every system runs during catch-up (crops rot, wages charged) — coming back to rotten crops is the push toward buying a harvester. Emergency Power Off (PRD 4.1) stops cash going deeply negative.

## Energy
- Start max 20, regen 1 per 3 s, each manual action costs 1. Max and regen are upgradable (first shop upgrades). All numbers are starting values to tune in playtest.

## Water (changed from "water once at plant")
- Each tile has a **moisture bar**. Watering fills it; it drains over time (start: empty in 60 s).
- Crops **grow only while moist**. Dry = growth pauses (no death, no rot from dryness).
- Tune so the first crop needs ~2 waterings per growth cycle: repetitive enough to want help, not a clicker.
- Later: **Sprinkler** = tiles in range never drain (maintenance per second). **Waterer worker** = waters the driest tile one at a time with delay, cheaper but imperfect. General principle for every manual action: worker = slow substitute with wage, machine = instant substitute with maintenance. That ladder is Phase 1 → 2 → 3.

## Rot
- On-field rot grace window = **2× that crop's grow time** (fast crops rot fast, expensive license crops last longer).

## Tiles
- Buy tiles one at a time, geometric price. Start 6, cap 24 for now.

## Prestige / end game
- Undecided, but likely later. Prepare now at ~zero cost:
  1. State split into `run` (resettable farm) and `meta` (survives prestige).
  2. Every balance number (prices, wages, grow times) goes through one multiplier function in `core/balance.ts`; never hardcoded at use sites.

## Process
- Planned and tracked in the Discord thread, not ClickUp/Kanban.
- Prototype first: Phase 1 only, answering one question — is the manual loop fun enough to make the player want a sprinkler? If not, fix the loop before Phase 2.


## Round-1 playtest changes (2026-11-07, see docs/PLAYTEST.md)
- **Start: 9 tiles, energy max 10** (regen unchanged 1 per 3 s). Tile cap stays 24.
- **Watering any time.** Tapping a planted, moist tile refills moisture to 1 (costs 1 energy). The player decides
  whether to top up early. Replaces "tapping a moist tile does nothing".
- **Planted tiles show their crop** (emoji + name) while growing, and harvest shows a toast "+💰N <crop>".
  Taps on a tile are ignored for a short guard window after a harvest, so a double tap cannot replant.
- **Milestone unlocks.** Run state keeps counters (`harvests`, `sales`, `digs`, …). Some shop items are hidden
  until a counter passes a threshold, then bought with cash as usual:
  - `sellPrice` upgrade (+10 % per level): unlocked after 25 sales.
  - `fertilizer` upgrade (−10 % grow time per level): unlocked after 15 harvests.
  Thresholds are starting values; tune in playtest.

## Mining (fills idle energy while crops grow)
- Why: the player waits for crops with nothing to spend energy on. Mining is the energy sink while waiting and
  the source of **materials**, so later upgrades cost money *and* materials instead of money alone.
- **v1 (batch 3):** buy a mine license (cash) → buy wood (cash) → craft a wooden pickaxe (wood) → dig (1 energy,
  1 pickaxe durability) → 1 random drop into the inventory → sell items for cash. Pickaxe breaks at 0 durability;
  craft another. Inventory has a capacity (upgradable later); digging with a full bag fails with a typed error.
- **Stone vein v1 drops 100 % stone.** Vein upgrades add ores and shift the table (batch 4). Drop table lives in
  `balance.ts`; the RNG is injected (seeded PRNG in run state) so the core stays deterministic and testable.
- **Balance rule:** mining cash per energy must stay below farming cash per energy (it is a filler, not the main
  loop); stone's real value is as a material later. Sim must assert this.
- **Later (not v1):** vein upgrades (stone → coal → iron …; the player's 98.5/1/0.5 % idea is too slow for a
  ~20 digs/min energy budget — first non-stone drop should land within ~3 minutes of digging), stone pickaxe,
  furnace (ore → ingot, fuel = wood or coal, capacity/fuel upgrades paid in cash → stone → ingots), forge
  (ingots + cash → tool tiers: watering can / hoe / seeder acting on 2+ tiles per energy).

## Automation (moved after tooling)
- Sprinklers, seeders, harvesters and workers come **after the forge**, are crafted from materials in quantity,
  and pay running costs (water/power). The PRD's "Phase 2 semi-auto" dissolves into: manual → tooling → automation.

## Round-2 changes (2026-11-07, see docs/PLAYTEST.md round 2)
- **Desktop-first responsive layout.** The game is meant to be played full-screen on desktop; mobile is a shrunk
  version. Breakpoints: ≥ 1024 px three columns (mine left, farm centre growing with the viewport, side panel right
  with tabs Shop / Upgrades / Bank that collapses so the farm takes the space); 768–1023 px farm + mine side by
  side, side panel as a slide-over; < 768 px one view at a time with a bottom tab bar (Farm / Mine / Shop /
  Upgrades / Bank) and the HUD (cash, energy) sticky on top. Why: the 480 px single column wasted the desktop screen
  and every new system (mine table, mastery, bank) needs its own space.
- **Upgrades are a separate tab from Shop.** Shop = seeds, licenses, wood, tiles. Upgrades = energy, sell price,
  fertilizer and every later upgrade (mastery, vein). UI-only state (open tab, panel collapsed) lives in its own
  localStorage key `tiles.ui`, never in the game save.
- **Bank v0 (rough, numbers pending research).** Fixes the round-2 soft-lock now; hand digging (batch 5) will add
  a free floor later. One loan at a time, borrowed from a Bank tab. Debt starts at principal × (1 + fee) and grows
  linearly per tick while unpaid, capped at 200 % of principal (Toon's cap). Partial or full repayment any time;
  no forced collection in v0. Interest accrues inside `step`, so offline catch-up charges it too. All numbers in
  `balance.ts`; tuned after the round-2 research (docs/research/round2-mining.md).
- **Pending research (Fable, round 2):** hand digging (stone = 2 hits; hand 1 hit/energy, pickaxe 2), per-tool-type
  mastery (chance to preserve durability, cap ~90 %), visible locked drop table, vein Lv1, logging. Batches 5–6 are
  planned after the research returns.
