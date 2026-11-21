# Prototype plan — Phase 1 ("manual farm")

Question this prototype must answer: in the first 5–10 minutes, is the manual loop
plant → water → harvest → sell, under an energy limit, fun enough that the player
*wants* a sprinkler? If not, stop and fix the loop before Phase 2.

## Scope
**In:** 6 tiles, 2 crops (fast/cheap; slow/expensive behind a license), till/plant/water/harvest,
energy + regen, moisture bar, on-field rot, instant sell (no inventory), 3 upgrades
(energy max, energy regen, buy tile 7–8), localStorage save, offline catch-up (cap 8 h).

**Out:** workers, machines, dynamic market, inventory spoilage, loans, prestige, art.

## Stack
Vite + TypeScript + React, Vitest. Package manager: pnpm. Repo: this directory.

## Layout
```
src/
  core/            # pure TS, never imports React or DOM
    state.ts       # RunState / MetaState (run/meta split), GameState = { run, meta }
    step.ts        # step(state, ticks): moisture drains, crops grow while moist, energy regen, rot past grace
    actions.ts     # till/plant/water/harvest/sell/buyUpgrade/buyLicense/buyTile — return new state or a typed error
    balance.ts     # every tunable number lives here, read through multiplier fns
    data/crops.ts, data/upgrades.ts
  app/             # React: FarmGrid, Hud (cash/energy), Shop
  save/            # serialize/deserialize + schema version + offline catch-up
tests/
  *.test.ts        # per-action tests; sim/ holds the per-system bot sims (bot.ts + balanceMock.ts)
docs/              # PRD.md, DECISIONS.md, PLAN.md
```

## Tasks (in order)
1. Scaffold Vite + React + TS + Vitest; eslint; scripts `dev` / `build` / `test` / `lint`. Commit.
2. `core/state.ts` + `core/balance.ts` + `core/data/*` — data model and all starting values.
3. `core/step.ts` — tick logic, with tests (grow only while moist, regen caps at max, rot after grace).
4. `core/actions.ts` — 4 manual actions + sell + buy upgrade/license/tile; one test file per action group; errors are values, not throws.
5. `tests/sim/early.test.ts` — greedy bot plays 600 ticks: cash never negative, crop-2 license affordable within ~300 ticks (target, tune `balance.ts` until it passes and report the final numbers). (Was `tests/sim.test.ts` until batch 35.1.)
6. [x] React UI: 6-tile grid (colour/emoji per state), click tile → next sensible action, HUD, Shop. Mobile-width friendly.
7. [x] Save/load (localStorage, versioned) + offline catch-up (step missed seconds, cap 8 h), tested with a fake clock.
8. [x] Deploy to GitHub Pages (Vite `base`, `gh-pages` or Actions workflow).
9. [x] Playtest together in the Discord thread → record verdict + tuned numbers in `docs/PLAYTEST.md`.

Tasks 1–5 are batch 1; 6–8 batch 2. Each batch = one commit series on `main` (prototype repo,
no branch ceremony yet).

## Rules for the implementer
- `src/core/**` must stay free of React/DOM imports; add an eslint `no-restricted-imports` rule or a test that asserts it.
- All numbers in `balance.ts`. If you need a number elsewhere, add it there first.
- Do not start a dev server in headless runs; `pnpm test` and `pnpm build` are the proof.
- Keep `docs/DECISIONS.md` authoritative; if you must deviate, write the deviation and reason into `docs/PLAN.md` under "Deviations".

## Archive
Finished batches live in `docs/archive/PLAN-history.md`: every batch plan, `## Batch N results` and `### Deviations`
for batches 1–35.3, plus the big-farm roadmap. Lines 1–7436 of that file are the old `docs/PLAN.md` line for line, so a
`PLAN.md:N` citation from before 2026-11-14 points at the same line there. References like PLAN.md "Batch 24 results"
in tests and `docs/DECISIONS.md` resolve there too.

The archive is append-only and large (7,400+ lines, ~680 KB). Never read it whole: read only the line range a brief
cites, or `grep -n '^## Batch N'` and read that range.

## Active batches
New batch plans are appended below, and workers write `## Batch N results` + `### Deviations` at the end of this file.
After a batch is pushed, Hermes moves its plan and results to the end of the archive.

## Batch 35.4 — ⭐ Favours in Upgrades, pre-sale info page, full-width ＋ Field N, contract cap on the Orders card (tasks 201–205, no save bump)

Why: Toon's 2026-11-21 v27 playtest. ⭐ Favours are the late-run progress and sit behind a HUD sheet nobody finds;
Toon asked for them as rows in the Upgrades panel once the player has ⭐. The sale has no "what do I get" view until
the gate opens, and there is to be no "sell now" nudge — the page only informs (the pull to sell is batch 36). The
desktop ＋ Field N buy row is 341 px wide (one map column), not the whole row. The 35.3 contract cap is invisible, so a
player cannot tell why a contract is smaller than his fields.
Decisions: `docs/DECISIONS.md` "Batch 35.4 refined" (Toon's accepted scope + Hermes's calls). Anchors below are
origin/main d0c52954 (after batch 35.3). UI-only: no `src/core/balance.ts` number change, no save bump (stays v29),
no sim pins.

## Tasks (201–205)

- [ ] 201. **⭐ Favours section at the end of the Upgrades panel.** `Upgrades` (`src/app/Upgrades.tsx:86–120`) renders
  the ⭐ Favours block LAST, after `MineUpgrades` (`:117`): `<div id="favours" className="favours">` with
  `<h2>⭐ Favours</h2>` (same look as the ⚡ Energy / 🌱 Farm / ⛏ Mine groups), then the carry line and the rows that
  today live in the sheet component (`src/app/Favours.tsx:102–125`: carry line `:107–109`, rows `:110–122`; the row
  text helpers `:24–100` unchanged). Shown when `run.stars > 0` or any Favour level > 0: add the pure helper
  `favoursVisible(run)` = `run.stars > 0 || FAVOUR_IDS.some((id) => favourLevel(run, id) > 0)` in
  `src/core/favours.ts` (next to `favourShown`, `:37–39`; `favourLevel` `:17–34`). Rows keep `favourShown` (Stoker
  hidden until ready). Keep the `.favours` class and the row markup so `tests/FavoursSheet.test.tsx` selectors hold.
- [ ] 202. **HUD ⭐ jumps to the section; the old ⭐ sheet is removed.** `Hud` (`src/app/Hud.tsx:12–14, 28–33`): prop
  `openFavours` → `showFavours`; the ⭐ stays where it is with the same render condition (`run.orders.unlocked ||
  run.stars > 0`), but it is a `<button className="hud-stars" title="⭐ Favours">` only while `favoursVisible(run)`;
  otherwise a plain `<span className="hud-stars" title="⭐ comes from orders">` with the same text (nothing to jump
  to). `App` (`src/app/App.tsx`): delete `favoursOpen` (`:52–53`), the Favours modal (`:295–299`) and the now-unused
  imports (`Favours` `:7`, `STAR_EMOJI` `:4` if nothing else reads it). `showFavours()` opens ⬆️ Upgrades where it is
  in that layout: `setTab('upgrades')`, and phone (< 768) `setView('panel')`; tablet (768–1023) `setSlideOpen(true)`;
  desktop 1024–1439 with the panel collapsed `setCollapsed(false)`; ≥ 1440 the panel is always open. Then, on the
  render where `#favours` exists, `document.getElementById('favours')?.scrollIntoView?.({ block: 'start', behavior })`
  with `behavior` `'auto'` under `prefers-reduced-motion: reduce` (`window.matchMedia?.(…)`, the Surface.tsx:78
  pattern), else `'smooth'` — a one-shot request in a ref consumed by a `useEffect`, never `tiles.ui` (cosmetic,
  transient, not saved). Comments that call it "the ⭐ Favours sheet" are updated to "section"
  (`src/app/useGame.ts:204`, `src/app/Workers.tsx:90`, `src/app/Mine.tsx:284`; `Mine.tsx:290` "more in ⭐ Favours"
  stays).
- [ ] 203. **Full-width ＋ Field N row.** Cause: the row is an item of the `.map-rows` grid (`src/app/EstateMap.tsx:99`
  opens it, `:146` closes it; `src/app/app.css:729–733` `grid-template-columns: repeat(auto-fill, 341px)`), so its
  `grid-column: 1 / -1` (`app.css:834`) spans only the 341 px tracks that fit, not the map width. Fix: render the
  `opensNext` buy button and the `ghostField` "needs Pump" line (`EstateMap.tsx:140–145`) right AFTER the `.map-rows`
  `</div>`, not inside it; `.map-ghost-field` (`app.css:832–843`) drops `grid-column`, gains `width: 100%;
  box-sizing: border-box; margin-top: 8px` (the grid's row gap). Text, price, disabled rule and `.map-ghost-buy`
  (`app.css:844–849`) unchanged. The "Fields N–M · beyond Pump" row (`EstateMap.tsx:135–139`) stays where it is.
- [ ] 204. **Pre-sale info page: always reachable, information only.** Today the 🏦 Bank tab (`src/app/Bank.tsx:87–111`)
  shows the 🏆 Sell the farm card (`SellCard`, `src/app/Legacy.tsx:100–142`) only once `sellFarmUnlocked`
  (`src/core/prestige.ts:29–31`) and a locked teaser row before (`Bank.tsx:95–107`, `gateShort` `:73–85`). Now
  `BankTab` always renders `SellCard`: the deeds line, the ⭐ carry line, Resets and Carries show at every stage of
  every run. Its sell button is the two-press button (`Legacy.tsx:137–139`) once the gate is open; before that the
  same locked teaser in its place — `<button className="locked" disabled>🔒 Sell the farm<small>needs …</small>`
  (move `gateShort` from Bank.tsx into Legacy.tsx with the card, strings unchanged). No nudge: the deeds line
  "Sell now: +N deeds (💰N)" (`Legacy.tsx:113–115`) becomes "Selling gives +N deeds (💰N)"; nothing new appears
  when the gate opens (no badge dot, toast, banner or HUD mark). The deed meter line (`Bank.tsx:62–71`) stays. 36.1
  later mounts its "Next farm" listings on this card above `<h3>Resets</h3>` — do NOT build listings, a district or
  a "next farm" block now.
- [ ] 205. **contractCap on the Orders card.** The card note (`src/app/Orders.tsx:91–96`) after the Tractor reads
  "After the Tractor, crop orders are 🚜 contracts sized by your wet fields, at most {count(contractCap(run))} each;
  only you accept them." (`contractCap`, `src/core/orders.ts:82–86`, already exported in 35.3; `count` from
  `src/app/fmt.ts:2`). Before the Tractor the note is unchanged. Order rows unchanged.
- CHANGELOG line (top of `src/app/changelog.ts:7`, batch '35.4'): "⭐ Favours now sit at the end of ⬆️ Upgrades: tap ⭐
  in the top bar to jump there. The 🏦 Bank always shows what selling the farm gives, and Orders say how big a 🚜
  contract can get." (178 code points; the cap is 180.)

Tests to touch (grep at d0c52954): `tests/FavoursSheet.test.tsx` (`:33–52` the HUD-opens-a-sheet tests → the jump;
`:54–88` render `Favours` directly — keep or point at `Upgrades`), `tests/BankTab.test.tsx:93–114` (pre-gate teaser →
full card), `tests/Legacy.test.tsx:82–115` ("Sell now" strings `:88`, `:110`), `tests/Estate.test.tsx:186–205` (＋ Field
row), `tests/OrdersCard.test.tsx:135–146` (the note string), `tests/App.test.tsx` (matchMedia stubs `:272–285`,
`:358–…` to copy for the layout cases). jsdom has no `scrollIntoView`: stub `Element.prototype.scrollIntoView` with
`vi.fn()` in the test, and the code calls it with `?.`.

Tests to add (game terms, jsdom render tests):
- the Upgrades panel ends with a "⭐ Favours" section once the player has ⭐ (after ⛏ Mine when the mine is owned); a
  player with ⭐0 and no Favour bought sees no section; ⭐0 with Fine mist Lv1 bought still shows it; the section
  reads "⭐ 12 to spend · resets when you sell the farm (up to 400 ⭐ carry over)";
- tapping the HUD ⭐ on a phone opens ⬆️ Upgrades in the panel view and scrolls the section into view (the stub is
  called on `#favours`); on a tablet it opens the slide-over on ⬆️ Upgrades; at 1024 with the panel collapsed it
  expands the panel; no "⭐ Favours" dialog exists any more;
- with the board bought but ⭐0 and no Favour, the HUD ⭐ is text, not a button; after a sale with ⭐ carried it is a
  button (no board needed);
- with every field full below the pump cap, ＋ Field N is not inside the 341 px map columns (`.map-rows`) and still
  buys the next field's first plot; the "needs Pump" line likewise sits after the map;
- before the sale gate the Bank shows the whole 🏆 Sell the farm card (deeds line, ⭐ carry line, Resets, Carries) with
  the locked "🔒 Sell the farm" + "needs …" button; after the gate the two-press button; the text "Sell now" appears
  nowhere;
- after the Tractor the Orders note names the contract cap for a fixture (the number from `contractCap(run)` of
  that fixture, asserted as the exact string); before the Tractor no cap text.

Scenarios: none. UI-only, no sim runs (no balance or core rule change; `favoursVisible` is a pure read). The suite's
existing sims run as part of `pnpm test` only.

Hermes verify (after the worker, before / with the push): `pnpm test` ×2, lint, build, `tsc -b --force`, purity grep,
case-clash; push on green (Toon already said ปล่อย), Pages run by headSha, then a LIVE width sweep at 375 / 1024 /
1440 / 2560 / 3440 of: the ⭐ Favours section at the end of ⬆️ Upgrades (wrap, row height, scroll length), the HUD ⭐
jump (lands with the section heading in view in every layout: phone panel view, tablet slide-over, collapsed and
always-open desktop panel), the full-width ＋ Field N row (its width = the map area width; needs a save with every
field 5/5 and the pump watering another — seed-edit one if the v29 save has none), the pre-sale page before AND after
the gate (a fresh save and `post-deploy-v29.json`), and the contract-cap line on the Orders card. Seed with
`post-deploy-v29.json` (browser workspace `local-84942bb6…`). CSS-only defects → Hermes fix per tiles-game rule 11.

Out of scope: listings / districts / "next farm" on the pre-sale page (36.1); the 3-column pre-sale preview (36.6);
a field-gated order tier 3 (decide after playtest); batch 36's ⭐ prices; any balance number; a save bump; a sim run;
35.3 Deviation 5 (PIN311b looser assertion — ACCEPTED by Toon 08:25, closed); the 375 Reroll flush 0 px against the
Workers card and the dashed-beige disabled style (pre-existing minor notes from the 08:19 sweep); 35.3 Deviations 1–2
(the jammed v28 board — Toon's own discard); an Upgrades-tab badge for affordable Favour rows.
