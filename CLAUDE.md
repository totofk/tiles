# tiles — incremental farm automator (side project)

Standalone web game. **Not** part of the TQM monorepo: ignore the parent `../../CLAUDE.md`
rules about Next.js, i18n, Prisma, graphify and ClickUp. Only the package-manager rule carries
over: use `pnpm`.

Read in this order before changing anything:
1. `docs/DECISIONS.md` — agreed design decisions (authoritative, overrides the PRD)
2. `docs/PLAN.md` — current prototype scope, layout, task list, implementer rules
3. `docs/PRD.md` — original product doc (background)

Commands: `pnpm dev` (user-run only), `pnpm test`, `pnpm build`, `pnpm lint`.

Architecture rule: `src/core/**` is pure TypeScript — no React, no DOM, no Date.now().
Time enters only as tick counts passed into `step()`. All tunable numbers live in `src/core/balance.ts`.
