# Research — art assets for tiles (2026-11-09)

Question (Toon): what images does the game need, and should we ship one sprite sheet and clip zones from it?
He will generate assets with AI (Gemini/Nano Banana chosen) and Hermes integrates them as batch 24.

## Sprite sheet vs individual files — finding

- Tiles is a DOM/React game, not canvas: no draw-call/texture-bind benefit from an atlas. The win is requests +
  cache only.
- 2024–26 consensus: HTTP/2/3 made individual small images viable (1–10 icons: negligible difference), but for a
  "tightly controlled icon set" of 20–50+ icons, themed sheets still load 30–50 % faster, especially mobile
  (sosquishy benchmark 2024; Cloudinary: sheets are right for tightly controlled icon sets).
- **Decision: generate per-theme grids (consistency), ship 4 themed sheets + a manifest that maps icon id →
  {sheet, x, y, w, h}; `<Icon id size/>` renders CSS background-position.** Replacing one icon = replacing that
  theme's sheet. If tiles ever moves to canvas, the same manifest is already an atlas.
- Bonus: today every icon is locked to "Unicode ≤ 11" emoji because newer ones tofu on old fonts (src/core/
  data/items.ts comment — stone is ⛰️ because 🪨 is Unicode 13). Real assets delete that constraint game-wide.

## AI-generation workflow (cyborb, spritecook, web-game-kit agree)

1. Generate the WHOLE set as ONE grid image (3×3/4×4/4×2) — same lighting/outline/size across the set; separate
   calls drift. Small sets (4–10 cells) drift less than 16.
2. Prompt rules: solid flat magenta #FF00FF background (AI cannot do real transparency in most models; magenta
   keys cleanly), one object per cell listed in row order, evenly spaced, nothing crossing borders, no labels,
   no grid lines, consistent perspective/palette/outline, "readable at 64 px".
3. Post-process deterministically, never trust the grid: magenta-key → slice at cell boundaries
   (`magick sheet.png -crop 4x2@ +repage icon_%02d.png` or Pillow) → inspect EVERY cell at real size → resize to
   64 px (also emit 32/128) → WebP with alpha.
4. Style consistency across sets: attach the approved first sheet as a reference image for later sets
   (Nano Banana's strength).
5. Generator choice (2026 survey): Gemini Nano Banana — best at object counting + consistency + reference
   chaining; free tier usable; GPT Image prettier but slower; Midjourney counts wrong (unsuitable for grids).

## Manifest (from src on 2026-11-09, HEAD ab6e33c — CORRECTED after Toon caught missing tool tiers)

- **A. Crops (8, `CROP_EMOJI`)**: radish, chilli, pumpkin, lemon, tomato, corn, grape, strawberry. Grid 4×2.
- **B. Resources (10, `ITEMS` + spare)**: wood, stone, coal, copperOre/Bar, ironOre/Bar, goldOre/Bar, seed sack. Grid 5×2.
- **C. Tools (16)**: `TOOL_JOBS` water/harvest/plant each with tiers 0–3 (basic/copper/iron/gold — sickle ×4,
  dibber ×4, watering can ×4) PLUS `PICKAXE_TIERS` wooden/copper/iron/gold ×4. Grid **4×4** (rows = pickaxe,
  sickle, dibber, watering can; cols = wood/basic, copper, iron, gold) — one sheet gives the whole ladder with
  guaranteed material consistency.
- **D. Machines & buildings (7)**: harvester tiers 1–3 (`MachineKind` harvester [1800,3600,7200]), seeder tiers
  1–2, furnace, storage crate. Grid 4×2.
- **E. Workers (7, `WORKER_JOBS`)**: plant, water, harvest, ore, fuel, mine, clerk — 7 distinct simple figures.
  Grid 4×2.
- **F. UI & misc (~10)**: cash, star, energy, trophy, deed scroll, bank, order board, feedback bubble, map,
  pickaxe-swing/dig? Grid 5×2.
- Total ≈ 58 icons / 6 sheets. Exact final list = batch-24 task 1: script-extract every emoji literal from src
  (CROP_EMOJI, ITEMS, WORKER_JOB_EMOJI, panel tabs, UPGRADE_IDS) → `src/app/assets-manifest.ts`.

## Prompt pack (already sent to Toon in Discord — master style + 4 grid prompts)

Master style: flat 2D cartoon sticker, thick dark outline, soft top-left light, saturated colors, readable at
small size, no text, centered per cell, magenta #FF00FF background. Sets: A crops 4×2, B resources 5×2, C tools
& machines 5×2, D UI 5×2 (objects listed row by row). Toon generates set A first for style approval, then B–D
with A as reference. Raw grids land in `~/Documents/Project/side-project/tiles/design/raw/` (untracked).

## Batch X sketch (NOT dispatched — assets not generated yet)

- task: `tools/slice-sheet.py` (Pillow; magenta key → grid slice → trim → resize 64 → WebP + manifest JSON)
- task: `src/app/Icon.tsx` + assets-manifest; replace emoji per theme (crops first), keep emoji as fallback
  when an id has no cell yet.
- task: layout checks 375/1024/1440 (icons inline in buttons/rows), bundle-size before/after.
