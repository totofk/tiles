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
for batches 1–35.4, plus the big-farm roadmap. Lines 1–7436 of that file are the old `docs/PLAN.md` line for line, so a
`PLAN.md:N` citation from before 2026-11-14 points at the same line there. References like PLAN.md "Batch 24 results"
in tests and `docs/DECISIONS.md` resolve there too.

The archive is append-only and large (7,400+ lines, ~680 KB). Never read it whole: read only the line range a brief
cites, or `grep -n '^## Batch N'` and read that range.

## Active batches
New batch plans are appended below, and workers write `## Batch N results` + `### Deviations` at the end of this file.
After a batch is pushed, Hermes moves its plan and results to the end of the archive.

## Batch 35.5 — the HUD ⭐ is a plain count, "Favours sheet" wording renamed, "Selling gives" hidden before the gate (tasks 206–208, no save bump)

Why: Toon (Trin) 2026-11-21 11:37, after watching the 35.4 HUD ⭐ jump: the ⭐ in the top bar is a currency count like
💰, not a control — 35.4 task 202 misread his intent. Favours are found where every other upgrade is (the ⭐ Favours
section at the end of ⬆️ Upgrades, task 201, which stays). The 35.4 rename left "Favours sheet" in a balance.ts
comment and in test names (35.4 Deviations 2 and 5). Before the sale gate the card's "Selling gives +N deeds" promises
a gain the player cannot take yet (35.4 Deviation 4).
Decisions: `docs/DECISIONS.md` "Batch 35.4 follow-ups" (Toon rejects 202; ⭐ is display-only) and "Batch 35.5 refined"
(Hermes's calls). Anchors below are origin/main 882ff553 (after batch 35.4). UI-only: no `src/core/balance.ts` number
change (one comment reworded), no save bump (stays v29), no sim runs.

## Tasks (206–208)

- [ ] 206. **The HUD ⭐ is a display-only count; the 35.4 jump is removed.** `Hud` (`src/app/Hud.tsx`): drop the
  `showFavours` prop and its doc line (`:13–15`) and the `favoursVisible` import (`:4`); under the same render
  condition (`run.orders.unlocked || run.stars > 0`, `:31`) render ONE element in every case:
  `<span className="hud-stars" title="⭐ comes from orders">{STAR_EMOJI} {count(run.stars)}</span>` — replacing the
  button / span pair (`:29–40`, the button at `:33` with `onClick={showFavours}`, the span at `:37`). No `button`,
  no `onClick`, no `role`, no `tabIndex`, no `cursor`. Comment `:29–30` → "batch 34: also with no board when ⭐
  carried over a sale; batch 35.5: a plain count like 💰, not a control". `App` (`src/app/App.tsx`): delete the
  scroll request ref + effect (`:50–58`, `favoursScroll`), `showFavours` (`:74–81`) and the Hud prop (`:169` →
  `<Hud state={state} rates={rates} />`); `useRef` / `useEffect` stay imported (still used at `:33`, `:68`, `:110`,
  `:130`). `src/app/app.css:358–363` `.hud > .hud-stars`: keep `white-space: nowrap` and the padding (the HUD must not
  shift); drop `font: inherit` (a button reset); comment → "batch 34: the ⭐ count (display only since batch 35.5)".
  `src/app/Favours.tsx:102–103` doc comment: drop "the HUD's ⭐ jumps to it by its id" (keep `id="favours"`).
  Unchanged: the ⭐ Favours section at the end of ⬆️ Upgrades (`src/app/Upgrades.tsx:120`, shown while
  `favoursVisible(run)`, `src/core/favours.ts:42`), its rows and texts; `favoursVisible` stays (Upgrades reads it).
- [ ] 207. **Rename the leftover "Favours sheet" wording.** `src/core/balance.ts:248` comment "bought in the ⭐ Favours
  sheet" → "bought in the ⭐ Favours section of ⬆️ Upgrades" (comment only, no number or code change in
  balance.ts). Test names: `git mv tests/FavoursSheet.test.tsx tests/FavoursSection.test.tsx` (not
  `Favours.test.tsx`: it would case-clash with `tests/favours.test.ts`); outer describe `:33`
  `'batch 34: the ⭐ Favours sheet'` → `'batch 34: the ⭐ Favours section of ⬆️ Upgrades'`; the 35.4 jump describe
  `:34–89` (`'batch 35.4: the HUD ⭐ jumps to the ⭐ Favours section of ⬆️ Upgrades'`, its scrollIntoView stub and
  the three layout tests) is replaced by task 206's tests. After the batch, `grep -rni "favours sheet\|FavoursSheet"
  src tests` prints nothing.
- [ ] 208. **"Selling gives +N deeds" shows only once selling is unlocked.** `SellCard` (`src/app/Legacy.tsx:121–…`):
  the deeds line (`:130–132`, `<p className="deeds">Selling gives +{gain} deed… (💰…)</p>`) renders only when
  `sellFarmUnlocked(state)` (`src/core/prestige.ts`, already imported `:15` and read at `:154`). Before the gate the
  card shows everything else exactly as in 35.4: heading, the ⭐ carry line, Resets, Carries and the locked
  "🔒 Sell the farm · needs …" button. The card stays always reachable in 🏦 Bank (35.4 task 204, `BankTab` always
  renders it). After the gate the line is unchanged, including "+0 deeds" with the gate open and nothing to gain.
  The deed meter line in Bank (`src/app/Bank.tsx`, "Lifetime cash … → N deeds when "Sell the farm" opens") stays. Doc
  comment `Legacy.tsx:116–120` gets "the deeds selling gives once the gate is open". No nudge appears when the gate
  opens (same rule as 35.4).
- CHANGELOG (`src/app/changelog.ts`): add at the TOP `{ batch: '35.5', date: '<today>', line: "The ⭐ in the top bar
  is now just your ⭐ count, not a button; Favours stay at the end of ⬆️ Upgrades. The sale card shows the deeds you
  get once selling opens." }` (158 code points; cap 180), AND amend the 35.4 entry's line (`:7`) — it tells players
  to tap ⭐ — to: "⭐ Favours now sit at the end of ⬆️ Upgrades. The 🏦 Bank always shows what selling the farm resets
  and keeps, and Orders say how big a 🚜 contract can get." (153 code points). Batch and date of 35.4 unchanged.

Tests to touch (grep at 882ff553): `tests/FavoursSheet.test.tsx` → `tests/FavoursSection.test.tsx` (`:33` outer
describe, `:34–89` the jump describe → removed, `:91–105` the "text vs button" test → rewritten for 206; `:53`,
`:94`, `:100` `button.hud-stars` selectors); `tests/BankTab.test.tsx:93–107` pre-gate (`:99` "Selling gives +0
deeds" → absent) and `:109–125` post-gate (`:119–120` stays); `tests/Legacy.test.tsx:82–115` (`:88–89` and `:111`
are gate-open `atGate()` cases → stay; add a pre-gate `SellCard` case). `tests/WorkersCard.test.tsx:53–112, 325` and
`tests/BankTab.test.tsx:59–62` render `<Hud>` without `showFavours` (no change needed; check they still compile).

Tests to add (game terms, jsdom render tests):
- the HUD ⭐ is a plain count: with ⭐12 and the board bought it reads "⭐ 12" in a `span.hud-stars`; there is no
  `button.hud-stars`, it is not inside any button, has no `tabindex`/`role` and no click handler; clicking it changes
  nothing (phone: `main.app` `data-view` stays `farm`, the ⬆️ Upgrades tab is not selected; nothing scrolls — no
  `scrollIntoView` stub call; no dialog);
- same for ⭐0 with the board bought (text "⭐ 0"), ⭐50 carried after a sale with no board (text "⭐ 50"), and no ⭐
  element at ⭐0 without the board (the 35.4 render rule);
- the ⭐ Favours section is still the last block of ⬆️ Upgrades with ⭐ > 0 (existing 35.4 test, kept as is);
- before the sale gate the 🏆 Sell the farm card shows its heading, the ⭐ carry line, Resets, Carries and the locked
  "🔒 Sell the farm" button, and the text "Selling gives" appears nowhere (Bank tab and bare `SellCard`); after the
  gate "Selling gives +8 deeds (💰8)"; gate open with deeds already claimed still "Selling gives +0 deeds (💰0)";
- CHANGELOG: the 35.4 line no longer contains "tap ⭐" (`tests/changelog.test.ts` cap check covers both lengths).

Scenarios: none. UI-only, no sim runs (no balance number or core rule change). The suite's existing sims run as part
of `pnpm test` only.

Hermes verify (after the worker, before / with the push): `pnpm test` ×2, lint, build, `tsc -b --force`, purity
grep, case-clash; push on green (Toon already said ปล่อย 11:37), Pages run by headSha, live index bundle no longer
contains the scroll request (`scrollIntoView`) and has the 35.5 changelog line; then a LIVE width sweep at 375 / 1024 /
1440 / 2560 / 3440 confirming: (a) the HUD ⭐ is not tappable — `.hud-stars` is a `span`, not a button, no element
of the HUD ⭐ is focusable (Tab key skips it, `tabIndex` −1/absent), computed `cursor` is not `pointer`, a real CDP
click on it changes nothing (tab, view, panel, scroll position unchanged), and the HUD still fits one line at 375;
(b) the ⭐ Favours section is still the last block of ⬆️ Upgrades; (c) the 🏆 Sell the farm card BEFORE the gate (a
fresh save and the v29 save edited to lifetime cash 100k) has no "Selling gives" line and still shows the ⭐ carry
line, Resets, Carries and the locked button; AFTER the gate (`post-deploy-v29.json`) it shows "Selling gives +N
deeds"; (d) a v29 save still loads (no bump): `version` 29, no `tiles.save.bad`, cash ticking. Seed with
`post-deploy-v29.json` (browser workspace `local-aa960ec6…` / `local-84942bb6…`, helper `tiles_check.py`). CSS-only
defects → Hermes fix per tiles-game rule 11.

Out of scope: anything from batch 36 (36.1 listings on the pre-sale card waits for its own "ปล่อย"); parked work; any
balance number; a save bump; a sim run; an Upgrades-tab badge for affordable Favour rows; a Favours shortcut anywhere
else; changing the ⭐ Favours section (task 201) or the Bank deed meter line; the 375 Reroll flush 0 px / dashed-beige
disabled style notes.
