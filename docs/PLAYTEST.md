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

## Round 2 — pending (batch 3 build)
Questions to answer: does digging while crops grow remove the "idle" feeling? Is mining income per energy
clearly below farming income per energy (it must stay a filler, not the main loop)?
