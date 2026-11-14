# tiles — incremental farm automator (side project)

Standalone web game. **Not** part of the TQM monorepo: ignore the parent `../../CLAUDE.md`
rules about Next.js, i18n, Prisma, graphify and ClickUp. Only the package-manager rule carries
over: use `pnpm`.

Docs (authority in this order):
1. `docs/DECISIONS.md` — agreed design decisions (authoritative, overrides the PRD)
2. `docs/PLAN.md` — implementer rules and the active batch; finished batches are in `docs/archive/PLAN-history.md`
3. `docs/PRD.md` — original product doc (background)

These files are large. When a brief cites a line range (`docs/PLAN.md:120-310`), read only that range. Never read
`docs/DECISIONS.md` or `docs/archive/PLAN-history.md` whole.

Commands: `pnpm dev` (user-run only), `pnpm test`, `pnpm build`, `pnpm lint`.

Architecture rule: `src/core/**` is pure TypeScript — no React, no DOM, no Date.now().
Time enters only as tick counts passed into `step()`. All tunable numbers live in `src/core/balance.ts`.

Save compatibility: players never restart because of a patch. Any change to the save shape bumps
`SAVE_VERSION`, adds a migration, keeps a real fixture of every past version in `tests/fixtures/` and tests the
chain from each fixture to the latest. Details in `docs/DECISIONS.md` "Save compatibility".
