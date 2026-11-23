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
for batches 1–36.6, plus the big-farm roadmap. Lines 1–7436 of that file are the old `docs/PLAN.md` line for line, so a
`PLAN.md:N` citation from before 2026-11-14 points at the same line there. References like PLAN.md "Batch 24 results"
in tests and `docs/DECISIONS.md` resolve there too.

The archive is append-only and large (7,400+ lines, ~680 KB). Never read it whole: read only the line range a brief
cites, or `grep -n '^## Batch N'` and read that range.

## Active batches
New batch plans are appended below, and workers write `## Batch N results` + `### Deviations` at the end of this file.
After a batch is pushed, Hermes moves its plan and results to the end of the archive.
## Batch 36.7 — 🌾 the approved Farm-panel mockup, UI-only (tasks 239–244, save stays v35)
Source: Toon's feedback round 2026-11-23 (feedback-2026-11-23-decisions.md, items 3–8 + extras, all accepted) and the
Superdesign mockup he OK'd (draft a0c30eed-fa01-412d-9d97-8c18bc34c6d4, **version 2**,
preview https://p.superdesign.dev/draft/a0c30eed-fa01-412d-9d97-8c18bc34c6d4). The mockup is the look, the game's tokens
are the spec: keep `--s1/--s2/--s3/--s4` (app.css:15–18), the 44 px touch floor, `#c8e6c9`/`#2e7d32` selected greens,
`#9b2c2c` danger, 8 px radius. Do NOT import mockup CSS wholesale.

**UI-only batch. No `src/core` edit, no `src/save` edit, no SAVE_VERSION change (stays 35), no balance number, no new
`tiles.ui` field (all collapsibles stay uncontrolled `<details>`).** Every anchor below was re-measured on commit
`863b021c` (origin/main, clean). Panel content widths to check against (panel `clamp(300px, 26vw, 480px)` minus
`--s3`×2 padding, app.css:237 + :62–69): **375 → 359, 1024 → 276, 1440 → 350, 2560 → 456, 3440 → 456**; Mine column
(clamp(220px, 22vw, 440px) minus `--s2`×2): **209 / 301 / 424 / 424** (375 shares the 359 full-width view). The worker
has jsdom only (no ResizeObserver, zero rects — animations skip); it lists what it could not verify under
`### Deviations`. Verification widths: 375 / 1024 / 1440 / 2560 / 3440.

Mockup nits with NO code change (already true in the game): crop names come from `CROPS` ("Chilli", never "Pepper");
the Workshop beds glyph is the game's `SPRINKLER_EMOJI` = ⛲ (workshop.ts:10), not the mockup's fountain; the accepted
contract already shows a progress bar and no "✓ Ready" (`orderFillable` is item-orders-only, Orders.tsx:25) — keep it
that way. "Expand gets an ⓘ if siblings have one": in the game Expand sits in the Estate where no sibling heading has
one → it gets none (stated so the worker does not invent one).

## Tasks (239–244)

- [x] 239. **Farm panel card rhythm: chip gap after the tab bar, card-to-card space, order ✕ pinned top-right.**
  - `.legacy-chip` (app.css:2105–2109) has `margin-bottom` only → add `margin-top: var(--s2)`. One shared rule for
    sibling cards inside the panel tab (`.farm-tab` has NO gap today; `.farm-tab h2` margins exist only ≥ 1024,
    app.css:274–277), exact CSS after it:
    `.farm-tab > details + details, .farm-tab > details + div, .farm-tab > section + details { margin-top: var(--s4); }`
    (covers LegacyChip→Orders via the chip's own margin, Orders→Tools, Workers→Workshop, Workshop→Fields, Farm.tsx:162–190).
  - Order ✕: `.order-row` (app.css:1415–1428, flex-wrap; `> span:first-child` `flex:1 0 auto` nowrap :1421–1424) — the
    card states already pad/radius (:1440–1455). Pin the ✕ like the mockup's `.discard-x`: `.order-row.order-offer,
    .order-row.order-accepted, .order-row.order-ready { position: relative; padding-right: calc(44px + var(--s2)); }`
    and `.order-x { position: absolute; top: 0; right: 0; min-width: 44px; min-height: 44px; margin: 0; }` (today
    margin-left-s2 inline, app.css:1478–1486). In `OrderRow` (Orders.tsx:77–79) keep the ✕ button the LAST DOM child
    (test pins button order `['Accept','✕']`, OrdersCard.test.tsx:46) and keep the two-press "Discard?" text. The
    progress `Bar` (`flex: 1 0 100%`, app.css:1487–1490) and Accept/Deliver stay inside the padded content box, so the
    ✕ no longer moves when Accept/Deliver/progress appear (feedback item 8). `Orders card` variant (Orders.tsx:124–133)
    inherits the same rules.
  - Acceptance (5 widths): ✕ occupies the same top-right 44×44 px in offer / accepted / ready / armed states and at
    every width; Accept and Deliver never overlap it; the chip has ≥ 8 px to the tab bar above; Workers summary sits
    ≥ 16 px under the (open) Workers card's last row; nothing overflows the panel (scrollWidth ≤ clientWidth).
  - Tests: `tests/OrdersCard.test.tsx` (✕ still last button, Discard? flow — unchanged text should pass; update only
    if selectors break), `tests/Legacy.test.tsx` / `tests/Shop.test.tsx` (legacy-chip placement queries),
    `tests/appCss.test.ts` — ADD pins: the new `.farm-tab` sibling-card rule and `position: absolute` inside `.order-x`.

- [x] 240. **Workers rows on ONE shared grid (name | − count + | ⓘ), Manager plan one line, Hire grouped.**
  - Today `.worker-row` is `flex-wrap` with `flex: 1 0 auto; white-space: nowrap` on the label
    (app.css:1297–1310) — the plan text pushes −/+ to a third line (feedback item 6). Replace with the subgrid pattern
    (same shape as `.recipe-grid`, app.css:1358–1384). Rows live in `.workers > .group` (Workers.tsx:93–102, 104–111).
    Exact CSS (keep every old selector that tests use):
    `.workers .group { container-type: inline-size; }` (only the rows group, Workers.tsx:93),
    `.worker-group { display: grid; grid-template-columns: minmax(0, 1fr) 144px 20px; gap: var(--s2); align-items: center; }`
    — add `className="group worker-group"` to the rows div (Workers.tsx:93) — then
    `.worker-row { display: grid; grid-column: 1 / -1; grid-template-columns: subgrid; align-items: center; min-height: 44px; }`,
    delete the `flex: 1 0 auto/nowrap` label rule (app.css:1303–1306) in favour of `.worker-row > span:first-child { min-width: 0; }`,
    `.worker-controls { display: flex; align-items: center; justify-content: center; gap: var(--s2); }`.
    Narrow fallback (the 276 px Farm tab at 1024 gives a 96 px name; the phone sheet is narrower still):
    `@container (max-width: 299px) { .worker-row { grid-template-columns: minmax(0, 1fr) 20px; grid-template-areas: 'name info' 'controls info'; } .worker-row > span:first-child { grid-area: name; } .worker-controls { grid-area: controls; justify-content: flex-end; } .worker-row > .info-btn { grid-area: info; } }`
  - JSX (Workers.tsx:24–77): wrap the − / `.worker-n` / + (and the `unpaid` span, :74) in `<span className="worker-controls">`; the certificate
    button (:50–52) sits alone in the 144 px column (two lines, verb + `priceText`, like `.item-row > button`); the gate
    `<small>` lines (:48) stay under the name. Structure probe kept: `.worker-row > span:first-child` still holds
    `{dot} {label}` + smalls (tests read `childNodes[2]`, WorkersCard.test.tsx:203) — do not wrap the label in a new span.
  - Manager plan: add `managerPlanShort(state)` to `src/app/estateText.ts` (next to `managerPlanText`, :87–94):
    no wet fields → `'no wet fields to manage'` (keeps WorkersCard.test.tsx:75); else
    `` `${fields} crop${fields === 1 ? '' : 's'} → ${orders} order${orders === 1 ? '' : 's'}${rest.length > 0 ? ' · rest' : ''}` ``
    with `fields` = total contract fields, `orders` = contracts length (mockup line "4 crops → 3 orders...").
    The row's small (Workers.tsx:65) renders it with `.worker-plan { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`
    (one 44 px+ line); the full plan moves to the row's ⓘ: for a manager row with a plan the Info text is
    `` `${WORKER_TIPS.manager} Plan: ${managerPlanText(state)}` ``. `managerPlanText` and every `estateText.test.ts` pin stay.
    "nothing to water — reassign" (:64) stays a wrapping small in the name column.
  - Hire worker (Workers.tsx:103–112): move INTO the rows group as the last `.worker-row` — button spans the first two
    columns (`style`-free: give it `className="worker-hire"` + `.worker-hire { grid-column: 1 / 3; }`), ⓘ in the third
    column; delete the wrapping `<div className="group">` (:104–111) so the divider+16 px rule (:1207–1211) no longer
    separates it (mockup: Hire aligned with the workers, gap comes from task 239's card rule before the Workshop
    summary). Keep texts `👷 Hire worker` and `pool full` / `💰…` (tests) and the disabled look (`button:disabled`,
    app.css:289–294 — already the mockup's dashed muted style).
  - Acceptance (5 widths): every job row is one 44 px line with − n + right-aligned in the fixed 144 px column and ⓘ in
    a 20 px column, at 375 / 1024 (96 px name, plan ellipsised) / 1440 / 2560 / 3440 and in the Orders·Workers·Workshop
    sheet (App.tsx:285–290) and the farm-column render (App.tsx:208–211, 233–236); the Manager row never pushes +/− off
    its line; locked certificate rows keep gates under the name and the price inside the 144 px button; the hire row
    aligns with the job rows (one left edge) and reads disabled at pool-full; every − / + still fires `assignWorker`.
  - Tests: `tests/WorkersCard.test.tsx` (8 `.worker-row` queries survive; update the ones reading structure/plan text),
    `tests/WorkshopCard.test.tsx` (worker-row + "nothing to water"), `tests/estateText.test.ts` (ADD `managerPlanShort`
    pins; `managerPlanText` unchanged), `tests/appCss.test.ts` (ADD: `.worker-row` declares `subgrid` and the
    `@container (max-width: 299px)` fallback exists).

- [x] 241. **One ⓘ per heading, pouch on a 4-column grid, Buy ×10 never wraps, 🌰 in the Shop list, sale preview 3 columns.**
  - Seed pouch (Farm.tsx:24–90, also rendered by Shop at Shop.tsx:159): today every row carries the SAME ⓘ
    (`TIPS.pouch`, Farm.tsx:43). Move it to ONE `<Info>` beside the `<h2>Seed pouch</h2>` (Farm.tsx:28), and ONE beside
    `<h2>Crop to plant</h2>` (Farm.tsx:166) with a new `TIPS.plantPick` in tips.ts (verbatim):
    `'The crop your taps, tools and workers plant. seeds N is your pouch; the price line is today's market factor.'`
    Wrap each heading + Info in `<div className="h-with-info">` + CSS `.h-with-info { display: flex; align-items: center; gap: var(--s1); } .h-with-info h2 { margin: var(--s2) 0 var(--s1); }`.
  - Pouch grid: the rows leave `.item-grid`'s 5 columns (Mine keeps them, app.css:1726–1731) — add
    `className="item-grid pouch-grid"` on the pouch container (Farm.tsx:32) +
    `.pouch-grid { grid-template-columns: minmax(0, 1fr) auto 64px 64px; }` (name | ×count | Buy ×1 | Buy ×10; the per-row
    `<span className="item-extra">` :42–44 is DELETED, also in the ancient row :72–74) and a pouch branch in the narrow
    fallback (app.css:1740–1763): inside the same `@container (max-width: 359px)`,
    `.pouch-grid .item-row { grid-template-columns: minmax(0, 1fr) 64px 64px; grid-template-areas: 'name count' 'b1 b2'; }`
    (cells :nth-child by new order). Buy buttons: `.item-row > button` (app.css:1836–1846) gains
    `white-space: nowrap` so "Buy ×10" never wraps at any width / price (mockup nit).
  - 🌰 Ancient fruit in the Shop seeds list when the Farm tab is absent (feedback cites Shop.tsx:105; today the loop is
    Shop.tsx:116 over `CROP_IDS`): after the loop add, when `!farmTab && ((run.seeds[ANCIENT_CROP] ?? 0) > 0 || cropId === ANCIENT_CROP)`
    (same guard as Farm.tsx:177–183), an `<Item tip={CROP_TIPS.ancientFruit}>` button cloned from the licensed-elsewhere
    branch (Shop.tsx:137–142): `🌰 Ancient fruit`, `selected` when `cropId === ANCIENT_CROP`, smalls `seeds {n}` +
    `not sold — dig for 🦴 seeds`. Import `ANCIENT_CROP` (already imported in Farm.tsx:4).
  - Sale preview 3 columns (SellCard, Legacy.tsx:222–255): today `.sell-cols` is `repeat(auto-fit, minmax(11rem, 1fr))`
    (app.css:2090–2094) — 1 column to 1440, 2+1 at 2560/3440, never 3 (panel caps at 456 px). Wrap the `<div className="sell-cols">`
    in `<div className="sell-cols-wrap">` and replace with exact CSS:
    `.sell-cols-wrap { container-type: inline-size; } .sell-cols { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--s2) var(--s3); }`
    `@container (min-width: 419px) { .sell-cols { grid-template-columns: repeat(3, minmax(0, 1fr)); } }` → 1 column at
    375/1024/1440 (359/276/350), 3 equal ~141 px columns at 2560/3440 (456). Lists wrap inside their column; no ellipsis.
  - Acceptance (5 widths): exactly ONE ⓘ beside each of the two headings (0 per pouch row), every pouch row one line
    with "Buy ×1/×10" unbroken at 4-digit prices; 🌰 row appears in the Shop seeds list on phone/tablet/collapsed panel
    and never duplicates the Farm tab's; Gain/Lost/Kept read as 3 side-by-side columns only at 2560/3440, one column
    below; no row overflows.
  - Tests: `tests/Shop.test.tsx` (pouch-row cells 5 → 4 at :100, Buy ×10 queries, ADD the 🌰 row), `tests/App.test.tsx`
    + `tests/DigSeeds.test.tsx` ("Crop to plant" heading area), `tests/Info.test.tsx` (unchanged behaviour),
    `tests/Legacy.test.tsx` (sell-cols 4 hits — column text unchanged), `tests/appCss.test.ts` (ADD: `.pouch-grid`
    4 columns, `.sell-cols-wrap` container + the 419 px rule; UPDATE `.item-grid` five-column pin only if it breaks —
    it must NOT, Mine keeps 5).

- [x] 242. **Soil traits list + reroll move from ⭐ Favours to a collapsible card on the 🌾 Farm tab.**
  - Move the whole `<details className="soil-traits">` block (Favours.tsx:133–143) and `SoilRow` (Favours.tsx:149–167)
    VERBATIM into a new `src/app/SoilTraits.tsx` (`export function SoilTraits({ state, act })`, same guard
    `run.survey.level >= 1`, same `.soil-traits` / `.soil-row` CSS app.css:1899–1922, default closed as today). Delete
    them from Favours.tsx (the Soil survey BUY ladder row stays: Favours.tsx:120–132, `ROWS.soilSurvey` :36,
    `effectText` :95–97). After the move, grep `src/app` for `rerollSoil`: exactly 2 files — SoilTraits.tsx (moved rows) and
    EstateMap.tsx:17/:228 (the Field sheet's own Reroll, UNCHANGED); Favours.tsx keeps none (drop its import).
  - Call sites (every width keeps the control — Farm tab exists only on desktop): `<SoilTraits>` in the Farm tab
    (Farm.tsx:189, between Workshop and Fields), in BOTH no-Farm-tab farm-column branches (App.tsx:207–211 and
    App.tsx:232–236, after `<Workshop>`), and in the phone sheet modal (App.tsx:287–289, after Workshop). Empty state:
    survey level 0 renders nothing (unchanged); beds 0 + fields 0 cannot happen at level ≥ 1.
  - Acceptance (5 widths): the card renders on the Farm tab at ≥ 1024 and under Workshop elsewhere; every Reroll button
    still fires `rerollSoil` (one per bed/field row, 44 px); rows keep the one-line trait + effect + Reroll layout at
    276 px (1024) and 359 px (375); ⭐ Favours shows the survey ladder only (no traits list) at every width.
  - Tests: `tests/FavoursSection.test.tsx` — MOVE the `describe('batch 36.5: the 🧭 soil traits list…')` (:186–235,
    summary text + row texts + reroll aria-labels) to a new `tests/SoilTraits.test.tsx`; keep every soilSurvey ladder
    assertion in FavoursSection. No `survey.test.ts` change (core untouched).

- [x] 243. **Estate Expand group + mine column spots (vein drop table, Seam row, dig subtext, Forge Collect reason).**
  - Estate (Estate.tsx:91–164): `Expand` `<h3>` (:94) reads weaker than the row titles under it — add
    `className="expand-h"` + `.expand-h { font-size: 15px; font-weight: 600; color: #222; margin: 0; }` (the Farm tab h2
    look, app.css:274–277 / `.shop h2` :1855). Box ONLY the Fill tank row (mockup `.expand-row`):
    `<div className="recipe-row recipe-row-boxed">` (Estate.tsx:107–115) +
    `.recipe-row-boxed { padding: var(--s2); border: 1px solid #eee; border-radius: 8px; background: #faf8f4; }`.
    Space it from Machines: `.estate-machines { margin-top: var(--s4); }` (app.css:894–908 has none; the fill group is
    the last child of `.recipe-wrap` before the `<details>`, Estate.tsx:130–134). No ⓘ anywhere here (no sibling has one).
  - Vein drop table (screenshot spot): `Vein Lv{n}: {dropText(...)}` renders as wrapped inline text with a dangling "·"
    (Mine.tsx:606–609; `dropText` joins with ' · ', mining.ts:47–52). Keep core as the single source: split its string —
    `<span className="vein-label">Vein Lv{run.vein.level}:</span>` followed by
    `{dropText(run.vein.level, run.masteredTiers.length, run.favours.aim).split(' · ').map((d, i) => <span key={d} className="vein-drop">{i > 0 && ' '}{d}</span>)}`
    (the `{i > 0 && ' '}` keeps textContent byte-identical: `tests/Mine.test.tsx:39, :91` pin the joined string) + CSS
    `.vein-drops { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, max-content)); gap: 2px var(--s2); }`
    `.vein-drop { white-space: nowrap; }` (wrap the cells in `<div className="vein-drops">` after the label). The
    next-vein line (Mine.tsx:623–625), Upgrades.tsx:82 and stats.ts:127 keep `dropText` inline — do not touch them.
  - Seam row (screenshot spot): the label is a bare grid cell so it floats above and the gold chip wraps alone; the
    selected aim has NO visible state (no `[aria-pressed='true']` rule for `.mine-furnace-actions`, app.css:1497–1538).
    In Mine.tsx:611–620 give the row `className="mine-furnace-actions seam-row"` and wrap `{SEAM_EMOJI} Seam:` in a
    `<span>`; CSS: `.seam-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s1) var(--s2); }`
    `.seam-row > span { font-size: 14px; }` and, for ALL `.mine-furnace-actions` (pickaxe rack Mine.tsx:555–565, forge
    recipe :149–159 too): `.mine-furnace-actions button[aria-pressed='true'] { background: #c8e6c9; border-color: #2e7d32; font-weight: 600; }`.
  - Dig button subtext (screenshot spot): `.mine-dig` (app.css:1181–1187, flex-column, base `button` has no padding,
    app.css:280–287) — the `<small>` sits on the bottom edge. Add `padding-bottom: var(--s1);` to `.mine-dig` (4–6 px).
  - Forge Collect gives no reason when storage is full (36.2 nit c): the Collect button (Mine.tsx:166–171) shows only
    `Tray {n} / 3` — add `{!collect.ok && tray > 0 && <small>{shortReason(collect)}</small>}` (renders 'storage full',
    SMELT_SHORT.BAG_FULL, Mine.tsx:96–101; tray 0 keeps the plain count, NOTHING_TO_DO adds nothing).
  - Acceptance (5 widths): the drop table reads as cells in a grid (no dangling separator, no mid-token wrap) at 209 px
    (1024 Mine column, vein Lv 4 = 5 cells → 2 rows of whole cells) through 424 px; the Seam label sits ON the chip row
    and wrapped chip lines carry ≥ 2 chips at vein Lv ≥ 2; the selected aim chip is visibly green at every width; the
    dig subtext keeps ≥ 4 px to the button's bottom edge; Fill tank reads as a boxed row with the Fill button right,
    16 px above the Machines summary; Collect shows 'storage full' when disabled with a loaded tray.
  - Tests: `tests/Mine.test.tsx` (vein string pins UNCHANGED by the ' ' trick — ADD a pin that `.vein-drops` cells are
    `.vein-drop` spans; Forge Collect reason when BAG_FULL), `tests/Estate.test.tsx` (Fill tank :220 area, Machines),
    `tests/appCss.test.ts` (ADD: `.expand-h`, `.recipe-row-boxed`, `.seam-row`, the aria-pressed rule, `.vein-drops`).

- [x] 244. **36.2 nits (tree fruit count, Orchard sheet hint) + top bar one line at 375; pins, CHANGELOG, report.**
  - Tree tiles hide the fruit count at 1024 (36.2 nit a): `.cell-label` goes clip-path-hidden under 79 px container
    width (app.css:530–539) — on a tree tile the label IS the state (FarmGrid.tsx:63–66: `🌳` + `🍓3`). Add inside that
    same `@container` block: `.cell-tree .cell-label { position: static; width: auto; height: auto; clip-path: none; font-size: 11px; white-space: nowrap; }`
    — keep it visible down to the 63 px step (no bars to collide with).
  - Fresh Orchard tree sheet lacks the berry-licence hint (36.2 nit b): when `treeCrops.length === 0` (FarmGrid.tsx:137,
    :210–234 renders only "Permanent…") add one `<p className="sheet-line">` (verbatim):
    `'Needs a berry licence to plant — 🛒 Shop sells 🍋 Lemon, 🍇 Grape, 🍓 Strawberry here'` (Orchard's berries,
    districts.ts:22). Cadence line and buttons unchanged when licences exist (tests/Beds.test.tsx "Fruits every").
  - Top bar wraps at 375 (36.6 carried item): the HUD wraps by design when spans exceed 343 px (app.css:343–357,
    ⭐+👷+⏱ ≈ 389 px; rates already hidden < 768 with titles carrying them, app.css:142–145). Give the clock a class —
    `<span className="hud-clock">⏱ {duration(run.tick)}</span>` (Hud.tsx:53) — and hide it under 768:
    `@media (max-width: 767px) { .hud > .hud-clock { display: none; } }` → one line at 375 (💰 + ⭐ + ⚡ + 👷 ≈ 300 px);
    ≥ 768 unchanged. Rejectable pick — see Risks.
  - `tests/appCss.test.ts`: ADD pins — `.cell-tree .cell-label` override inside the 79 px container block, the
    `.hud-clock` mobile hide. `tests/Beds.test.tsx`: ADD the no-licence sheet line; keep 'Fruits every'. `tests/App.test.tsx`:
    clock text unchanged ≥ 0 (it renders only ≥ 768 in CSS; jsdom sees it — no text assertions break).
  - CHANGELOG (`src/app/changelog.ts`): ONE entry at the TOP, verbatim (169 code points):
    `{ batch: '36.7', date: '<today, YYYY-MM-DD>', line: "🌾 Farm panel: the order ✕ stays top-right, worker rows on one grid, Hire with the workers, boxed Fill tank, one ⓘ per heading, a soil traits card, 3-column sale preview." }`
  - Write `## Batch 36.7 results` + `### Deviations` at the TRUE END of docs/PLAN.md: test totals before → after, one
    line per task, every new UI string, and what jsdom could not show (grid geometry, ✕ overlap, the 3-column switch,
    the 375 single line). Tick 239–244.

Scenarios: (A) fresh save — Farm tab shows chip + Orders only; tasks change no guard, so nothing new appears;
worker rows from the first certificate; empty states: no orders (wait row), survey 0 (no card), tray 0 (no reason line).
(B) veteran (v35 fixture, 15 chilli fields, 12 chips) — worker grid holds the Manager plan ellipsis; soil card lists
4 beds + N fields; sale preview 3 columns at 2560/3440 only.

Out of scope (36.8+ unless Toon says otherwise): clerk scope change (core, batch B), hired rigs, any core/economy
change, save bump, the mockup's tab-strip restyle, moving Tools/Orders groups, `prefers-reduced-motion` pass.

## Batch 36.7 results

Tests before → after: 1335 passed / 5 failed / 8 expected fail (1348, 72 files) → 1348 passed / 8 expected fail plus 3
known-flake timeouts (1359, 73 files; the 3 flakes are the relics Monte-Carlo PIN36l ×2 + PIN36o pins, which pass solo —
see Deviations). No sim file and no core number moved; `SAVE_VERSION` stays 35; no fixture touched.

- 239 `1f706d91` — Farm-panel card rhythm: `.legacy-chip` clears the tab bar, `.farm-tab > details + details / details +
  div / section + details` sit 16 px apart, the order ✕ is absolutely pinned top-right (44×44) with every order state
  padding a `calc(44px + var(--s2))` slot.
- 240 `b9b2ca40` — worker rows on one `.worker-group` subgrid (name | 144 px controls | 20 px ⓘ), 299 px two-line
  fallback, Manager plan one ellipsised line (new `managerPlanShort`, full plan in the row's ⓘ), Hire row inside the group.
- 241 `aca8b6a0` — ONE ⓘ per heading (`.h-with-info` + new `TIPS.plantPick`), pouch a 4-column grid with a 359 px
  two-line branch, `white-space: nowrap` buttons, 🌰 Ancient fruit in the Shop seeds list without a Farm tab, sale preview
  1 column → 3 from 419 px (`.sell-cols-wrap`).
- 242 `bd91351b` — the 🧭 soil traits list + reroll moved verbatim from ⭐ Favours to a default-closed card under the
  Workshop (`SoilTraits.tsx`; Farm tab + every no-Farm-tab App layout + the phone 📋 sheet); Favours keeps the BUY ladder;
  `rerollSoil` now greps in exactly `SoilTraits.tsx` + `EstateMap.tsx`.
- 243 `ecec2cf1` — Estate `.expand-h` heading + boxed `.recipe-row-boxed` Fill tank + `.estate-machines` card gap; Mine
  vein line split into `.vein-label` + per-drop `.vein-drops` grid cells; Seam aim one `.seam-row` flex line with the
  pressed aim green; `.mine-dig` padding; Forge Collect shows the short 'storage full' reason when the tray holds goods.
- 244 (this commit) — a tree keeps its visible `.cell-label` inside the 79 px cell; the empty Orchard tree sheet names the
  berry licences; the HUD ⏱ gets `.hud-clock` and hides < 768 (one line at 375); CHANGELOG 36.7 entry; this report.

New UI strings: `TIPS.plantPick` ("The crop your taps, tools and workers plant. seeds N is your pouch; the price line is
today's market factor."); 'not sold — dig for 🦴 seeds' (Shop ancient row); `managerPlanShort` lines — 'no wet fields to
manage', 'N crops → M orders · rest' (rest-only edge '0 crops → 0 orders · rest'); the Manager row ⓘ '… Plan: ' prefix
(`managerPlanText` unchanged); 'Needs a berry licence to plant — 🛒 Shop sells 🍋 Lemon, 🍇 Grape, 🍓 Strawberry here';
'storage full' re-used on the Forge Collect button; the CHANGELOG line.

### Deviations

- jsdom shows no layout: the subgrid worker columns/areas, the ✕-overlap geometry, the 419 px 3-column switch, the
  375 px single-line HUD and the 79 px tree label are verified by `tests/appCss.test.ts` pins + string assertions only.
- Vein drop table: the plan called the split markup "byte-identical"; in reality the DOM now joins drops with single
  spaces (each i>0 drop carries one leading space inside its span), so the two Mine vein pins moved ' · ' → ' ' and gained
  `.vein-drop` cell pins (task 243).
- The 359 px pouch fallback declares 3 grid tracks for 2-area rows (the third 64 px track is unused) — implemented
  verbatim as planned.
- Statistical flakes under parallel load (survey PIN36q, relics PIN36l/PIN36o) failed in 3 of 6 gate runs and passed solo
  every time — pre-existing (batch 36.4/36.5 pins), untouched by this UI-only batch; 243's gate was fully green.
- Two full-suite gate runs (tasks 239, 241) were killed by background-command time limits mid-run (600 s default, then
  20 min) and rerun with a 2 h budget — machine load average 10–12 on the 16 GB machine, no rogue process.
- The `.hud-clock` hide sits inside the existing `@media (max-width: 767px)` block (after `.hud-rate`) instead of the
  plan's sketch of a new query — same rule, one block, the WorkersCard HUD pin still matches.
- `src/app/SoilTraits.tsx` was briefly created before task 242's Favours deletion and flagged by the stop hook; deleted
  the same turn and re-created in task 242 together with the deletion — no commit ever carried both copies.

### Hermes live check (2026-11-23, live 8b4ecf90 bundle BKMm2S6w, Toon's v35 save, 375/390/414/430/1024/1440/2560/3440)
- Fixed (CSS only, proven by injection at every width before the edit):
  1. Worker rows: the ⓘ column was 20 px but the ⓘ button is 44 px wide, so it poked 24 px past every row (9/9 rows,
     scrollWidth 374 vs 350 at 1440). Column → 44 px (also in the 299 px fallback): 0/9 rows overflow at
     1024/1440/2560/3440; name column 146 px at 1440.
  2. Seed pouch: `.pouch-grid` lost to the later `.item-grid` rule (same specificity), so the pouch kept 5 columns
     (Buy ×1 sat in the 43 px `extra` column, under the 44 px floor), and the 359 px fallback (3 tracks for 2 areas)
     put Buy ×1 at 207–222 px and every row on 2 lines (75 px) at 375 / 1024 / 1440. Now `.item-grid.pouch-grid`, the
     fallback resets the pouch to one line down to 270 px and a new 269 px block holds the two-line layout: every pouch
     row one 44 px line with two 64 px Buy buttons at 375/390/414/430 (Shop tab) and 1024/1440/2560/3440 (Farm tab).
- Measured OK, no change: order ✕ at the same top-right 44×44 in all 4 order cards; HUD one line at 375 with ⏱ hidden;
  soil traits card on the Farm tab; vein drop table 5 cells; sale preview 1 column at 1440, 3 × 144 px at 2560.
- Not seen by eye: the 🌰 Shop row (the v35 save holds no ancient seeds), the empty Orchard sheet hint.
