# Big farm — FINAL accepted decisions (Toon: "pick หมด", 2026-11-10)

Source of truth for the Opus planning step (batch plan C1–C5 + Renown, DECISIONS entry, docs/research commit).
Base = Design C (`research/bigfarm-design-c.md`), grafts from D (`research/bigfarm-design-d.md`), amended by the
r/incremental_games review (`research/incremental-community.md`, decisions 1–18) and Hermes' H1–H3. Nothing rejected.

## Crux
- PICK C: home sprinkler is built on a **bed socket** (4 beds of 3×2, one sprinkler per bed, permanent, paid on confirm,
  no placement mode). The confirm sheet says "permanent". D's per-tile heads dropped.

## Accepted list (final wording)
1. Home lot = 4 beds 3×2 (bed k = tiles 6k..6k+5, derived from index, no save change). Sprinkler on the bed's socket,
   stub visible before purchase, permanent. Recipe unchanged, max 4.
2. HOME: no upkeep — hoppers and the pump burn removed, hopper coal → storage (overflow sold at coal price).
   FIELDS: **coal = pressure** — tank has coal → bound (wet) field tiles grow ×2; empty → ×1; never dry, never a stall.
   Conditions: (a) never a stall; (b) "pressure off ×1" visible on the surface; (c) the fuel loader feeds the tank and the
   top tank capacity covers the 8 h offline window; (d) the **smart valve is NOT refunded** — it stays owned and its job
   becomes "no idle burn" (burn only for bound tiles that are planted; DECISIONS 235 pattern). In C2 the valve sits inert
   (no job until C4). Pressure ships in C4 together with plots — never a release where ×2 is free.
3. Irrigated tiles: no moisture bar; can/tool/worker skip them (can tap = free no-op + toast). Workshop row "n/4 beds —
   the water worker retires at 4/4"; at 4/4 the worker row says "nothing to water — reassign".
4. 🚜 Tractor: same gate (fields.ts:49) and price (10 Fe + 💰10k); nothing on the home lot; brings Field 1 with its first
   plot and pivot already plumbed.
5. Plot = 10 tiles (land + work unit, PLANT_BATCH). Field = 5 plots (water + crop unit). One pivot socket per field,
   permanent, no Fill button. Dry fields cannot be sown.
6. Pump tiers (today's pipe recipes, bars unchanged 8 Cu/8 Fe/8 Au) cap wet fields at 2/6/12/20 (base, t1–t3). A field the
   pump cannot feed cannot be started. The ghost field at the cap names the pump tier and its bar price. Sim asserts that
   something is buyable at every cap.
7. Next plot goes in any started field or opens the next one, same price (plot p = 💰10,000·p + 5,500). Show payback
   hours on both ghosts; do NOT pitch it as "tall vs wide".
8. Crop chip per field on the surface, with marginal 💰/h per crop shown from Field 1. Crop choice automation =
   **🧑‍💼 Manager worker** (see M1–M5), not a free Auto toggle. Seeder/planters only sow what the chip says.
9. One surface, 2 stops (🚜 Estate default / 🏡 Home); containers ≥ ~1,100 px show both. FLIP resize 250 ms, reduced
   motion cuts. The mini home block on the Estate stop shows the ripe count. Stop kept in tiles.ui.
10. Phone 375 px: tool bar swaps per stop (Sow empty / Reap ready / ＋Plot); Orders/Workers/Workshop cards move to a
    📋 sheet; the **accepted contract + its progress sit on the capacity strip**, not in the sheet.
11. Capacity strip on the surface (wet fields vs pump, sow/reap rate vs need, one bottleneck word + fix + time-to-afford).
    🌾 tab = read-only by-crop ledger (tiles, 💰/h, trend, 🏡 n/50 gate); machine + pump recipes under it.
12. Pull-back plays once per save (tiles.ui); 🚜 marker on the plot being worked.
13. Plots replace cohorts: plot {crop, readyTick} absolute, no per-tile field sim, prefix rule and coalCarry deleted.
14. Hand reap 10 ⚡ per plot; it pays hand-picked ×1.25 **only when the plot is delivered to an order/contract**, else ×1.
    Sowing is free.
15. Growth constant re-owned: base "×1", "pressure ×2" (named, displayed). Today no coal = stall(0), so every save gets ≥.
16. Migration (two bumps): any sprinkler → all 4 beds; hopper coal → storage/tank; valve kept (job changes); water workers
    stay assigned + hint. Fields: plots = ceil(count/10) packed per crop from Field 1, earliest readyTick wins, remaining
    time halved once; pipes tier N → Pump N; pivots on every field holding a planted plot (≥ old coverage ÷ 50, ≤ cap);
    stalled plantings return seeds; coalCarry dropped. Pins: fixtures v14..current migrate; wet ≥ old covered+ready;
    owned ≥ old; each fixture earns ≥ its pre-migration 8 h; forged 1-sprinkler/no-worker save has no dry tile after 8 h.
17. Batches C1 UI → C2 save → C3 UI → C4 save → C5 UI. C4 is now large (plots + pressure + contracts + Manager): plan it
    as C4a (plots, pivots, pumps, pressure, migration, sim) / C4b (contracts + Manager + chips wiring) if a GLM worker
    runs it (≤ 3–4 tasks per batch).
18. Spike before C3: throwaway page outside the repo (save-v17 → 8 fields, both stops + FLIP, field rows, faked 20/60
    fields) at 375/1440/3440. Same day: calculator on balance.ts re-derives the crop-mix numbers (Manager rule go/no-go).
19. Renown: each home harvest +1 to that crop, hand-picked +2; 50 = field gate (today's); 250/1,000/4,000 → market depth
    ×1.25/1.5/2 (est., sim pins). **Resets on Sell the farm**; one deed-shop row keeps the tiers (keepFirstCertificates
    style). Sim must show a worker-only route to the top tier in bounded time. Own batch after C5. Not a clash with
    DECISIONS 152 (per crop, not per job) — it is the milestone-row lever of DECISIONS 417–419.
20. Estate contracts are CORE (not "+"): after the Tractor a crop order is sized by the estate
    (tier minutes × max(today's capacity, 15 % of wet field tiles at that crop's pace)); off-crop pays base ×1.1, no glut.
    Accepted by the player with a button only. Ships in C4(b) with the Manager.
21. Parked (separate goes): irrigated-bed ×1.1 bonus; desktop free zoom; field traits; B's valley + free posts;
    rain-fed ×½ land; counted tractors + plough switch (D); Manager machine tier; deed keep for the 4 sprinkler beds;
    review of the 8 h offline cap.

## Manager worker (Toon's addition, all accepted)
- M1 Ladder for "who picks the crop": set chips by hand (numbers visible) → 🧑‍💼 Manager (certificate, wage, pool slot)
  → machine tier parked. Seeder/planters never decide.
- M2 Rule: accepted orders/contracts first — fields to flip = ceil(shortfall ÷ (50 tiles × yield per cycle)); the rest to
  the crop with the best marginal 💰/h (fieldsMarginalIncomePerHour per crop). Never accepts an order itself. Never touches
  a field the player pinned 📌.
- M3 Certificate: unlocked after delivering N estate orders by hand (N ≈ 3, sim sets).
- M4 Wage priced against estate net at unlock (few % of net, sim pins). Real cost = the pool slot (8 jobs / 6 slots after
  the water worker retires).
- M5 Door answers: Manager row shows its plan ("🍓 ×3 fields → order #12 · 🍋 rest"); no Manager + no chip = field waits
  and the strip says why; re-evaluates on action ticks like other workers (offline ok); certificate resets on prestige
  like the others (keepFirstCertificates covers it).

## Research spend (api-direct)
fable 5.2 rounds: 0.17 + 5.52 + 8.26 + 8.73 + 8.41 + 4.73 = $35.82; research $6.27; two killed runs (v1, and a 5.1
community run ~2 min) wrote no usage file. Total known $42.09.
