# Research — save import/export for tiles (2026-11-09)

Question (Toon): how do incremental/idle games implement save export/import? A friend suggested "convert the
save to a simple hash seed" — does that work? Sources: genre survey (Reddit r/incremental_games, save-format
wikis, TV Tropes "Export Save", a 226-repo corpus study) + an independent design consult by Claude Fable
(Anthropic Max) on the same brief; Hermes's own research. Full Fable answer: scratch `tiles-saveio-fable-answer.md`
(quote-verified below; file may be pruned).

## What the genre does

- **Dominant pattern**: versioned JSON → optional compression → base64 string in localStorage; export = textarea
  copy (+ optional .txt download); import = paste + confirm. Corpus: 226 open-source incrementals use btoa /
  LZ-String export; galaxy.click cloud slots are plain string slots (≤256k chars).
- **Real sizes**: Cookie Clicker ~3 kB (base64 pipe-separated + literal `!END!` suffix, NO checksum), Antimatter
  Dimensions ~6 kB (pako-compressed in newer builds, prefix `AntimatterDimensionsSavefileFormatAA` + suffix
  `EndOfSavefile`), Kittens Game (LZ-String), Home Quest 13 kB, Idle Breakout ~300 B.
- **The `!END!` / `EndOfSavefile` suffixes are truncation guards** — even games without checksums guard cut
  pastes (Fable's correction to the initial survey).
- **Versioning**: schema version inside the payload from day one; import runs the same migrate chain as boot;
  never trust shape; round-trip test is permanent.
- **Checksums**: split. Single-player games can't be tamper-proof client-side; checksum = corruption/truncation
  detection, not security. Salted HMAC rejected (secret ships in the bundle).
- **LZ-String is legacy**: it became standard because browsers had no native compression in 2013. Today
  `CompressionStream('deflate')` is built in and ~2× better (Fable).

## The seed idea — verdict: refuted (both agree)

A hash is one-way; a short code cannot restore state. A seed only reproduces a world when the game is a
deterministic function of (seed + action log); tiles has real time, player choice, and in-run RNG in state. No
incremental stores a full save as a seed (Cookie Clicker's `seed` field is RNG only). The friend's mental model
is the roguelike challenge seed (Isaac / Spelunky / Slay the Spire). The honest version of the idea: display the
8-hex checksum as a **save ID** so two devices can confirm they hold the same save.

## Measured on a real tiles save (fixture save-v18, mid-game)

compact JSON 6,147 B → base64 8,196 B → zlib-9+base64 2,116 B (3.9×). Discord's message cap is 2,000 chars, so
even compressed won't paste into chat — **file download is mandatory regardless**.

## Merged spec (Hermes research + Fable consult; recommended)

Grammar:

    code    := "TILES" envver "." body "." check
    envver  := "1"                       ; envelope/encoding version ONLY (bump to 2 for compression later)
    body    := base64url( utf8( JSON.stringify(saveFile) ) )   ; no padding; saveFile = the exact localStorage object
    check   := 8 lowercase hex of CRC32(body)    ; over the base64url TEXT, so it fails before any decode

- Schema version stays inside the JSON (one source of truth; the migrate chain already reads it). Dots are
  outside the base64url alphabet → unambiguous split. Missing tail = "cut off" error.
- **No compression now**: 8–80 kB is fine for clipboard/textarea/localStorage/.txt. Keeps the codec sync + pure
  (trivial tests, Safari clipboard needs the sync call inside the click handler). Flip to `TILES2.` +
  `CompressionStream('deflate')` when share-URLs become a goal or exports pass ~50 kB.
- **Codec** `src/save/codec.ts` (pure, sync): `encodeSave(saveFile)`, `decodeSave(str)` throwing tagged errors
  (`not-tiles | truncated | corrupt | newer-version`). TextEncoder + chunked base64url — `btoa` throws on
  non-ASCII; `String.fromCharCode(...80kB)` hits argument limits.
- **Export** (Stats card): serialise LIVE state (not the last autosave — that silently loses an interval),
  `savedAtMs` injected from src/app; auto-selected read-only textarea + clipboard copy + Download .txt
  (`navigator.clipboard` can be denied; the textarea IS the mobile copy path). Pure read, no throttling.
- **Import**: trim + strip whitespace/backticks, map `+/`→`-_`, drop `=`; reject unknown prefix / bad checksum /
  `version > SAVE_VERSION` ("from a newer game version — hard-reload"); older versions run the exact boot
  load+migrate path in memory (no separate validator — one load path or they drift); failure never touches
  `tiles.save` or the `bad` path; confirm card shows deeds / prestige count / tiles / "saved 3 days ago" /
  "will migrate v15→v19" vs the same for the current save; on confirm write current save to
  `tiles.save.backup.import` (one slot), write `tiles.save`, `location.reload()` (boot reused verbatim — AD's
  approach). NOTE: reload applies offline catch-up for the imported `savedAtMs` — confirm the boot path enforces
  the offline cap (it does for normal boot; test it for import).
- **Cross-tab clobber**: tab B's autosave can overwrite tab A's import seconds after reload. Add a `storage`
  listener on `tiles.save` in src/app that stops the loop and shows a "save changed in another tab — reload"
  banner. (Wanted anyway.)
- **Tests**: round-trip deepEqual; one frozen export fixture per past schema version (keeps every migrate step
  importable forever); truncate one valid code at EVERY length and assert clean throws; offline-cap-on-import.
- **Save ID**: display the CRC32 as a short ID (the honest version of the seed idea).

## Batch sketch (23?) — tasks 116–120

**Correction 2026-11-09 (from docs/IDEAS.md "exists today", verified: `src/app/SaveTransfer.tsx` since commit
7051f56):** export/import ALREADY SHIPS — 📊 Stats → Save; plain base64 of the save JSON, read-only box, copy,
two-press import, `tiles.save.backup.import` slot. So this is a RETROFIT of that card to the spec above, not a
green-field build. Backward compat: codes without the `TILES1.` prefix are accepted as legacy plain-base64
(with the same version gate) so nothing a player exported before breaks. Feedback already ships too
(`src/app/feedback.ts`, 4 fields → Google Form, DETAILS_MAX 2000).

- 116. `src/save/codec.ts` (pure) + tests incl. exhaustive truncation + per-version frozen fixtures + legacy
  plain-base64 fallback decode.
- 117. Save card: live-state export, auto-selected textarea + clipboard + Download .txt, save-ID display,
  cross-tab `storage` listener + freeze banner.
- 118. Import: in-memory decode + boot migrate path, confirm card (deeds/prestige/tiles/saved-ago/migrate note
  vs current save), backup slot, reload; offline-cap-on-import test.
- 119. Roadmap card in 📊 Stats (English, data-driven from a src/app list): the 7 parked ideas from
  docs/IDEAS.md with their suggested order, labelled parked/not-promises (Toon 2026-11-09).
- 120. Feedback form → 💬 button + modal (minor-feedback item 1; fields + endpoint unchanged).

Deferred (needs Toon's Google Form edit first): "attach my save" opt-in on feedback — base64 8.2 kB ≫
DETAILS_MAX 2000, so it needs a new long-text form field (or CompressionStream + still a new field).
