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
for batches 1–37.1, plus the big-farm roadmap. Lines 1–7436 of that file are the old `docs/PLAN.md` line for line, so a
`PLAN.md:N` citation from before 2026-11-14 points at the same line there. References like PLAN.md "Batch 24 results"
in tests and `docs/DECISIONS.md` resolve there too.

The archive is append-only and large (7,400+ lines, ~680 KB). Never read it whole: read only the line range a brief
cites, or `grep -n '^## Batch N'` and read that range.

## Active batches
New batch plans are appended below, and workers write `## Batch N results` + `### Deviations` at the end of this file.
After a batch is pushed, Hermes moves its plan and results to the end of the archive.

## Batch 38 — 🖥️ Three sections: top bar, one main view (🌱 Farm / 🚜 Estate / ⛏️ Mine), side menu (tasks 262–267, save stays v38)

Why: Toon (2026-11-24): the screen is three parts — the existing top bar (energy, cash, ⭐, workers); one game main view
with tabs Farm / Estate / Mine; a side menu (☰ on phones) holding the old tabs: farm info (what to plant, orders,
workers…), 🛒 Shop, ⬆️ Upgrades, 🏦 Bank, 📊 Stats. Today the three are mixed: the phone tab bar holds 6 entries (main
views + menu pages), tablets show Mine + Farm side by side with a slide-over, desktop shows Mine | Farm | panel at once,
and the Estate is a "stop" inside the Farm column. Playtest question: is one big main view + a menu easier to read and
play than three columns? Also gives the Mine its width: the rock slots reach 96 px at 1440 (today 69 px, live check
after 37.1).

Hard guards (blockers: record under `### Deviations` and stop): no game rule, balance number or save change
(SAVE_VERSION stays 38; src/core and src/save untouched); every action reachable today stays reachable at 375 / 768 /
1024 / 1440 (list them in the results); no sideways scroll at 375; every tappable control ≥ 44 px; emoji ≤ Unicode 11.

Anchors: measured on ca1d5e3 (origin/main after batch 37.1). Context: `docs/DECISIONS.md` "Batch 38 refined".

## Words
main view = the one playfield on screen (🌱 Farm = the home grid, 🚜 Estate = the fields surface, ⛏️ Mine, or 🌊 River on
a Wetlands run); menu = the side menu (today's panel); main tabs = the three view buttons.

## Tasks (262–267)

- [x] 262. **UI state: one main view.** `src/app/uiState.ts:8–14`: `View = 'farm' | 'estate' | 'mine'` (the old 'panel'
  view is gone). `parseUi`: an old `view: 'panel'` → `'farm'`; an old `stop: 'estate'` with `view: 'farm'` → view
  `'estate'`. `stop` and `collapsed` leave UiState (a stored value is ignored, never an error). New transient App state
  `menuOpen` (not saved, starts closed). tests/uiState.test.ts: every old shape parses (pin each mapping).
- [x] 263. **App layout (src/app/App.tsx:53–298 + app.css :29–289).**
  - Markup order: `.top` (HUD + ☰ button + banners), `.main-tabs` (the three main tabs), the main view (only the
    selected one is rendered: `<FarmGrid>` with the planting line + Tools for 🌱 Farm, `<Surface>` on the Estate stop
    for 🚜 Estate, `<Mine>` for ⛏️ Mine), `<aside className="menu">` (today's `.panel`, renamed), toast.
  - 🚜 Estate tab exists only after the Tractor (`state.run.fields.unlocked`); before it the bar shows 🌱 Farm and ⛏️
    Mine. A remembered 'estate' without the Tractor shows Farm. On a Wetlands run the Mine tab reads `🌊 River` (as
    App.tsx:139). The Tractor's first-time pull-back (Surface.tsx `pulledBack`) now switches the main tab to Estate.
  - Phones (< 768): main tabs = the fixed bottom bar (`.tabbar`, 3 or 2 buttons, today's style); ☰ at the right end of
    the top bar; the menu is a drawer from the right, `width: min(85vw, 380px)`, over a dimmed scrim (`.menu-scrim`, a
    tap closes), ✕ in the drawer head (≥ 44 × 44), Esc closes. The top bar stays one row (rates and clock are already
    hidden < 768, app.css:143–149).
  - Tablets (768–1023): main tabs as a tab row at the top of the main view (`.main-tabs`, like the desktop mockup's
    segmented control); ☰ + the same drawer (today's slide-over rules :202–234 move to `.menu`).
  - Desktop (≥ 1024): two columns `minmax(0, 1fr) clamp(300px, 26vw, 480px)` (main | menu), the menu always open, no ☰,
    no collapse toggle (`.panel-toggle` and `.panel-collapsed` rules :253–263 deleted). The main view's content is
    centred with `max-width: 760px` for ⛏️ Mine (cards do not stretch to 1000 px); the Farm grid and Estate keep their
    own sizing (`.farm-fit`, container queries).
  - The 📋 sheet (App.tsx:50–51, :199–206, :288–295) and the `!farmTab` fallbacks (:185–243: planting line + Tools in
    the farm column on phones, Orders / Workers / Workshop / SoilTraits / Fields / DigSeeds under the grid) are deleted:
    the menu's 🌾 Farm tab now exists at every width (`farmTab` true everywhere; PANEL_TABS keeps 🌾 Farm, App stops
    filtering it, App.tsx:69).
  - Tools placement (C3): the planting line + Tools bar stay with the grid on the 🌱 Farm main view at every width; the
    menu's 🌾 Farm tab drops `<Tools>` (Farm.tsx:163) and keeps LegacyChip, Orders, crop picker, seed pouch, DigSeeds,
    Workers, Workshop, SoilTraits, Fields.
  - Surface (src/app/Surface.tsx): its stop comes from the main tab (no internal stop buttons), the `both` mode
    (:44–78, both stops at once on a wide column) is removed; the FLIP between the stops stays for the tab switch.
    `openEstate` (App.tsx:42–45) = select the Estate main tab (+ close the drawer).
- [x] 264. **Badges (App.tsx:72–89, badges.ts).** `onScreen`: shop / upgrades / farm = the menu is visible (desktop
  always; else `menuOpen`) and that menu tab is selected; mine = the Mine main view is selected. Dots: on each menu tab
  (as today, `.badge-dot` at the ICON's top-right corner, not over the label) and on the ☰ when any menu tab has news;
  the Mine main tab carries the mine dot. jsdom pins: dot on ☰ while closed, cleared after opening that tab.
- [x] 265. **Mockup leftovers as rules (Hermes's v2 review).**
  (a) the drop-odds line (`.vein-drops`, app.css :1290–1297 area) wraps whole items, never `14 / %`, no sideways scroll
  at 375; (b) locked rows (`.rock-off`) keep the ore readable: replace `opacity: 0.45` with `filter: grayscale(0.6);
  opacity: 0.7` (est.) so ⚫ coal is not a grey disc; (c) the last control of every main view clears the bottom bar
  (`.app` padding-bottom stays `calc(var(--tabbar-h) + var(--s4))`, check the Mine elevator row at 375); (d) the order
  card ✕ and every ⓘ get a 44 × 44 hit area (padding, not a bigger glyph); (e) Mine.tsx:701 "needs a {pickaxe}" → "needs
  an {iron…}" (article by the first letter); (f) no invented content: no version footer, no clock in the menu.
- [x] 266. **Tests.** tests/App.test.tsx is the big one (grep `view: 'panel'`, `panel-collapsed`, `panel-toggle`,
  `Shop` buttons, the 📋 sheet); farmTab props in DigSeeds / BankTab / Shop / StatsPanel tests become `true`. New jsdom
  pins: phone shows 3 (or 2) main tabs and ☰; ☰ opens the drawer with the 5 menu tabs; ✕ / scrim / Esc close it;
  selecting Estate renders Surface on the Estate stop; Estate tab absent before the Tractor; River label on Wetlands; the
  Farm main view has the grid + Tools and no Orders card; the menu's Farm tab has Orders and no Tools. No browser: list
  unverified widths under Deviations — Hermes sweeps 375 / 768 / 1024 / 1440 / 2560 / 3440 live.
- [x] 267. **CHANGELOG + results.** ONE entry at the top of `CHANGELOG` (src/app/changelog.ts), exactly:
  `🖥️ New screen: one main view with 🌱 Farm, 🚜 Estate and ⛏️ Mine tabs; Shop, Upgrades, Bank and Stats moved to the side menu (☰ on phones).`
  (137 code points, Hermes counted; cap 180.) Then `## Batch 38 results` + `### Deviations` at the true end of docs/PLAN.md
  (tests before → after, SHAs, every moved test with why, the reachability list per width).

Not in this batch: the wages line moving into the menu's Bank row (mockup idea, C8), a ⚙️ Settings tab (C9), M2.

## Batch 38 results

- 262 (657a0c2): the view model, TS only. `View = 'farm' | 'estate' | 'mine'`; parseUi maps old `view: 'panel'` →
  `'farm'` and `{view: 'farm', stop: 'estate'}` → `'estate'`, ignores `stop` / `collapsed`; `menuOpen` is transient
  App state. App.tsx renders `.top` (HUD + ☰ + banners) / `.main-tabs` / one main view / scrim / `.menu` (the old
  panel, ✕ below 1024) / toast; Surface takes its stop from the main tab and the Estate pull-back switches the tab.
  App.test rewritten around the drawer and the main tabs; uiState.test pins every old stored shape;
  BankTab / StatsPanel / Estate test literals lose `stop` / `collapsed`; WorkersCard / WorkshopCard cards assert the
  🌾 Farm menu tab. 1414 → 1412 total (1406 passed + 6 expected fail). The CSS layer lands in 263.
- 263 (a23406c): the CSS layer + the Tools split. app.css: phones keep the fixed bottom `.tabbar` and gain the ☰
  drawer (`min(85vw, 380px)`, scrim, ✕ 44×44, Esc), 768–1023 a static `.main-tabs` row + drawer, ≥1024 the
  `minmax(0, 1fr) clamp(300px, 26vw, 480px)` columns with the menu always open (no ☰ / ✕ / scrim, Mine
  `max-width: 760px`); `.panel`, `.panel-toggle`, `.panel-collapsed`, `.slide-open`, `.sheet-open`,
  `.stop-switch`, `.fold-strip`, `.surface-both` rules deleted. Farm.tsx drops the `<Tools>` card (C3: the 🧰 Tools
  bar lives on the 🌱 Farm main view at every width); 6 appCss pins + the App pins (farm view has Tools and no
  Orders; the menu's 🌾 Farm tab has Orders and no Tools). 1412 → 1417.
- 264 (a0088a9): the ☰ carries a `.badge-dot` while any menu-only tab (Shop / Upgrades / Farm) has unseen news —
  the ⛏️ Mine main tab keeps its own dot; jsdom pin: dot while closed → still dotted with the drawer open on 🌾
  Farm → cleared by opening ⬆️ Upgrades. 1417 → 1418.
- 265 (70ef9fc): Mine.tsx's too-hard hint picks its article by the pickaxe name ("an iron pickaxe"); `.rock-off`
  greys (grayscale 0.6, opacity 0.7) instead of ghosting; every ⓘ (`.info-btn`) grows to a 44×44 hit area, the
  order ✕ already had one. (a) the `.vein-drops` whole-item wrapping was already pinned by batch 36.7 — nothing to
  change; (c) `.app` keeps `calc(var(--tabbar-h) + var(--s4))` bottom padding (pinned); (f) nothing invented. Mine
  pin on the gold-zone hint + an appCss pin. 1418 → 1419.
- 266 (3d94bbc): the last App pin (no Orders card on the Farm main view); the farmTab flips and the drawer /
  main-tab / Estate / River / badge pins from 266's list landed inside 262's rewrite and 264's pin.
- 267 (this commit): the CHANGELOG entry at the top, verbatim, 137 code points; ticks + this section.

Final gates: 73 files, 1413 passed + 6 expected fail (1419), no flake; lint clean; build clean (95 modules); the
full suite ran before every task commit; dist deleted after every build. No `src/core` or `src/save` file was
touched; SAVE_VERSION stays 38; every sim guard green — **no sim number moved** (UI-only batch, as planned).

Reachability, every action that existed before the batch, per width:

- 375 (phone, drawer closed): HUD + banner dismiss / reload · 🌱 Farm / 🚜 Estate / ⛏️ Mine (🌊 River) main tabs on
  the fixed bottom bar · tile taps, the planting line and the 🧰 Tools bar on the Farm view · EstateBar Sow / Reap /
  ＋ Plot on the Estate view · the whole Mine on the Mine view · ☰ → the drawer with 🌾 Farm (LegacyChip, Orders,
  crop picker, seed pouch + auto-buy, Dig for seeds + the collection book, Workers, Workshop, SoilTraits, Fields →
  Open Estate), 🛒 Shop, ⬆️ Upgrades, 🏦 Bank, 📊 Stats (feedback + 💾 Data modal) · scrim / Esc / ✕ close the drawer ·
  keys 1 / 2 switch Farm / Estate. Removed stop-switch, fold-strip, 📋 sheet opener and the panel toggle — each
  replaced by a main tab or the drawer.
- 768–1023 (tablet): the same tree, but the main tabs are a static row above the main view and the menu is the same
  ☰ drawer; keys and Esc unchanged.
- 1024–1439 (desktop): the menu is the always-open right column (no ☰ / ✕ / scrim); both the main view and every
  menu tab are on screen at once, the 🧰 Tools bar collapses via its own button (tiles.ui.toolsOpen).
- ≥ 1440: as desktop; the Mine caps at 760 px and centres, the farm grid and Estate keep their own sizing.

### Deviations

- 262 and 263 split the TS view model from the CSS layer (the batch-37.1 259/260 precedent): the 262 tree is
  test-green but its `.menu` is unstyled in a real browser — the batch is only visually whole at 263. The 🌾 Farm
  tab's Tools drop therefore landed in 263, with the layout pins, not in 262.
- Test count 1414 → 1419 (+5): appCss 20 → 26 (the layout describe + the 265 details pin), uiState 9 → 10 (the
  old-shape mapping pin), App.test 42 → 40 — the rewrite deleted the panel-collapse, ≥1440-panel, fold-strip and
  sheet-opener pins (the controls no longer exist) and added the drawer, main-tab, view-mapping, ☰-dot and
  Tools-split pins; net −2. WorkersCard / WorkshopCard / Mine / BankTab / StatsPanel / Estate / Shop / DigSeeds kept
  their counts with assertions re-aimed at the new tree.
- No browser this session — jsdom + CSS pins only: the drawer transform / visibility animation, the scrim dimming,
  the real 375 / 768 / 1024 / 1440 / 2560 / 3440 layouts, and 265c's check that the Mine elevator row clears the
  bottom bar at 375 are unverified here; Hermes sweeps those widths live.
- The 44×44 `.info-btn` makes every `h-with-info` heading row 44 px tall — no design answer existed for that row
  height, so it follows the tap-target rule (ux-behaviour-default-simplest: none + awaiting design).
