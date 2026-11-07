# Playtest log

## Round 1 — 2026-11-07, build 3556eec (Phase 1 prototype on GitHub Pages)

Player: Toon (designer). ~10 minutes, mobile browser.

**Verdict on the prototype question** ("is the manual loop fun enough to want help?"):
- Manual watering/harvesting: *wants help* (not bored, not fun — "I know I have to wait, but I feel idle, I need
  something else to do"). → The loop works as a motivator; the waiting gap is the problem to fill.
- Money pacing to the pumpkin license: normal.
- Nothing confusing.

**Bug report:** "planted radish, watered, bought the pumpkin license meanwhile, and the planted crop seemed to
turn into pumpkin." Reproduced on the live build with state inspection: `tile.cropId` stays `radish` through
license purchase and crop selection — the state is correct. Root causes are display/UX:
1. A growing tile shows the same 🌱 for every crop, so the player cannot see what is planted.
2. Harvest leaves the tile tilled and the very next tap plants the *selected* crop (pumpkin). A double tap at
   harvest time sells the radish and silently plants a pumpkin; the player only sees "wrong money".

**Feature feedback (accepted, see DECISIONS.md "Round-1 changes"):**
- Start with 9 tiles and energy 10 (energy upgrades had no felt value at 6 tiles / 20 energy).
- Allow watering any time (player decides whether to top up early).
- Upgrades unlocked by milestones, not just cash: sell price (after N sales), fertilizer / growth speed (after N harvests).
- Mining as the "spend idle energy while crops grow" system → furnace → forge → tool tiers → automation last.

## Round 2 — 2026-11-07, build 09bfbe2 (batch 3: 9 tiles, energy 10, mining v1)

Player: Toon. Reached tick ~5500, stamina Lv 3, regen Lv 2 (so energy upgrades *are* bought now).

1. Idle feeling: **gone**, but digging feels pointless — "only stone, no progress, no idea what the rates are or
   what the mine can be upgraded into, so farming is clearly the better use of energy". → Mining v1 shows no
   goal; the vein upgrade / drop table (batch 4) must be *visible* (locked rows with %) before it is earned.
2. Pumpkin pacing: not felt as slower — but wood is too expensive: 3 wood (12) per pickaxe, 20 digs of stone (40)
   = **net ~8 per pickaxe**. Ideas: cheaper-wood upgrade, or replace buying wood with a **logging license**
   (spend energy to chop wood, axe upgradable).
3. **Soft-lock (bug):** ended with cash 1, no pickaxe, all 9 tiles tilled, nothing in the bag. Radish seed costs 2,
   wood 4 → no action can ever produce cash again. Phase 1 had no anti-bankruptcy floor because seeds were
   always affordable; mining spend broke that assumption. Needs a safety net (e.g. free/starter radish seeds
   when cash < seed cost, or PRD 4.1 emergency micro-loan).
4. Energy upgrades: wants them now (confirmed by the screenshot: Lv 3 / Lv 2).

Design discussion continues in a separate thread.
