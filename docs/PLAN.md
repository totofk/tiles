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

## Batch 39 — 📎 Save-attach finished: TILES2 codes + `#replay=` (tasks 268–272, save stays v38)

Why: IDEAS.md #1. Batch 23.1 already attaches a TILES1 code to every 💬 Feedback report, but the code is uncompressed,
and importing it to debug overwrote the developer's save and ran the offline catch-up from the report's `savedAtMs`,
so the report state was not the state on screen. Toon picked option A (2026-11-25, thread "Attach saves to feedback
reports"). Context: `docs/DECISIONS.md:1582-1614` "Batch 39 refined".

Hard guards: no `src/core` or `balance.ts` change; SAVE_VERSION stays 38 (envelope only, no shape change); every past
code fixture (code-v13…v19) and the legacy plain base64 still decode; the player's own save is never written by a replay.

Anchors: measured on `be21283` (origin/main after batch 38). Worker: Claude (project thread), no browser.

## Tasks (268–272)

- [ ] 268. **Codec: TILES2** (`src/save/codec.ts`). `encodeSaveCompact` (async, :152) = deflate-raw through
  CompressionStream, base64url, CRC32 over the text, falls back to TILES1 without CompressionStream. `decodeImport`
  (:226) becomes async and accepts TILES2 / TILES1 / legacy. New tag `unsupported`. Inflate capped at
  `MAX_INFLATED_BYTES` (:101) → `corrupt`. `encodeSave` (TILES1, sync) stays for the fallback and the frozen
  fixtures. New fixture `tests/fixtures/code-v38.txt`.
- [ ] 269. **Writers use TILES2.** 💬 FeedbackCard's context is async and attaches `encodeSaveCompact`. 💾 Data
  `exportCode` returns `Promise<string>` (useGame, panelTabs, DataModal). DataModal "Check save" awaits the decode and
  has an `unsupported` message.
- [ ] 270. **Replay mode.** `src/app/replay.ts` (hash parse without URLSearchParams, because legacy codes carry `+`;
  `replayUrl`, `withoutHash`). `src/app/Root.tsx` is the boot switch (loading / failed / App) and `main.tsx` renders it.
  `useGame(replay)` (:201) uses `memoryStore` (`storage.ts:25`) for every write, `replayBoot` (:191) skips the catch-up,
  the storage listener and the hidden-tab catch-up are off, and a Data import replaces the run in memory. App shows the
  violet `.banner-replay` with Exit replay and never writes `tiles.ui`. DataModal adds **Open as replay** (new tab,
  `noopener`) under the confirm card.
- [ ] 271. **Tests.** codec (+7: TILES2 round-trip of every fixture, ≥3× shorter on v37, frozen code-v38 decode, a
  Node-zlib code decodes, prefixes/damage/non-deflate, newer-version, inflate bomb, no-Compression fallback);
  tests/replay.test.tsx (new, 6: hash parse, URL helpers, Root replay / old-version / damaged / off); useGame (+2:
  sandbox never writes localStorage, no catch-up or freeze, import in memory); DataModal (+1: TILES2 check + Open as
  replay). The existing async callers were re-aimed: codec, feedback, FeedbackCard, DataModal, App, BankTab, StatsPanel.
- [ ] 272. **Docs + CHANGELOG.** DECISIONS entry, IDEAS #1 marked shipped, 🗺 Roadmap drops idea 1 (and "Save-attach
  first" from the order note), CHANGELOG line (137 code points):
  `📎 Feedback reports now attach a save code about 4× shorter, and 💾 Data can open any save as a replay in a new tab without touching yours.`
