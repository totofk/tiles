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
