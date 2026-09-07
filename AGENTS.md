<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Commands

- This is one npm package; use `npm ci` with the committed `package-lock.json`.
- Create `.env` from `.env.example`; both `DATABASE_URL` (PostgreSQL) and `AUTH_SECRET` are required for the database/auth flows.
- `npm run dev` and `npm start` use port `3006`, not Next.js's default port.
- Verification has no test suite: for admin work, `npm run lint` and `npm run typecheck` must pass; run `npm run build` for route/configuration changes.
- `npm run lint` intentionally checks only `src/admin/**/*.{ts,tsx}`, `src/app/admin/**/*.{ts,tsx}`, `src/servers/**/*.{ts,tsx}`, `src/hooks/**/*.{ts,tsx}`, and `src/lib/**/*.{ts,tsx}` for now. Public `(web)` lint is out of scope until its pre-existing errors (`no-explicit-any`, `react-hooks/set-state-in-effect`, and others) are addressed. Do not report a full-repository lint as passing based on the admin-only command.
- For a schema migration use `npm run db:migrate -- --name <migration_name>`; use `npm run db:generate` when only the generated Prisma client needs refreshing.

## Admin Verification

- Every admin task must leave `npm run lint` passing.
- Run `npm run check:admin-client-boundary` to scan exported function props in admin `"use client"` entry components. Function props must be named `action` or end with `Action`.
- `npm run typecheck` remains a project-wide TypeScript check.
- Next.js client-boundary warnings about function props come from the Next TypeScript plugin, not ESLint or the `tsc --noEmit` script. In `"use client"` entry components, custom function props should use `action` or an `Action` suffix; this naming convention does not turn a function into a Server Action.

## Server Actions

- Server Actions live under `src/servers/<module>/actions/`, not under `src/admin/features` or a central `src/actions` directory.
- Build actions with `next-safe-action` through the shared client in `src/lib/action-client.ts`.
- Each `*-action.ts` file must export exactly one Server Action.
- Keep module-specific schemas, types, and server helpers under the server module, for example `src/servers/user/actions/create-user-schema.ts` and `src/servers/user/types.ts`.
- Use explicit operation-oriented files such as `src/servers/user/actions/create-user-action.ts` and `src/servers/user/actions/set-user-status-action.ts`; do not combine multiple exported actions in one file.

## Application Boundaries

- There is deliberately no `src/app/layout.tsx`. `src/app/(web)/layout.tsx` and `src/app/admin/layout.tsx` are separate root layouts; moving a route between them changes providers/styles and navigation across them performs a full page load.
- Status pages: `src/app/(web)/not-found.tsx` and `src/app/(web)/error.tsx` render the public 404/500 inside the public layout. Unmatched URLs and root-layout failures are handled by `src/app/global-not-found.tsx` (requires `experimental.globalNotFound`) and `src/app/global-error.tsx`; because there is no single root layout, those two files must render their own `<html>`/`<body>`, fonts and styles. All four share `src/components/StatusScreen.tsx`. `global-error.tsx` is shared with the admin app, so keep it free of public-site branding.
- The public root uses `LayoutScaler`, `SiteNav`, `SiteFoot`, the frontend Mantine provider/theme, and `src/app/(web)/globals.css`. The admin root uses its own Mantine provider/theme, Redux, and admin CSS modules; keep the frontend and admin UI systems separate.
- The live application is `src/`. `html/` is a disconnected static prototype/reference, and `docs/ADMIN_REQUIREMENTS.md` is a target-state draft with stale current-state claims; trust executable source and `prisma/schema.prisma` over both.
- Public pages are dynamic Server Components that query Prisma directly through `src/lib/prisma.ts`. The only route handler currently implemented is `/api/auth/[...nextauth]`.
- Browser-served assets belong in `public/`. The tracked `uploads/` directory has no route or source references and is not web-accessible by itself.
- The current Prisma model keeps categories/regions and `News.publishedDate`/`Knowledge.publishedDate` as display strings. The normalized taxonomy and `DateTime` model in the requirements document has not been implemented.

## Database Safety

- Seeding has two levels. `npm run db:seed` (which `prisma db seed` and `npm run db:reset` also run) applies the default seed in `prisma/seed/default-seed.ts`: the `admin@example.com` account, the shared category taxonomy, Thai geography, the Bangkok operation area, stats, network partners, project origin and the homepage hero. It creates no News, Knowledge, Learning, Infographic or Technology content. `npm run db:seed:mockup` (`prisma/seed/mockup-seed.ts`) adds 300 demonstration records per content module plus the regional operation areas, and requires the default seed to have run first.
- `npm run db:seed` resets `admin@example.com` to its development password and rebuilds the network partner list. `npm run db:seed:mockup` additionally creates `editor@example.com` and `editor2@example.com` as content authors, and deletes and recreates every News, Knowledge, Learning, Infographic and Technology record together with their revisions, files and audit history; operation areas are added idempotently and never deleted.
- Seed code is organised as `prisma/seed/default/` (baseline), `prisma/seed/mockup/` (demonstration content, with its templates in `prisma/seed/mockup/data/`) and `prisma/seed/shared/` (lifecycle plan, coverage plan, users, categories, audit rows). Mockup lifecycle situations are declared once in `prisma/seed/shared/lifecycle.ts`; add a state there rather than branching inside a module seed.
- `npm run db:reset` and `npm run db:pushf` erase database data. Never run either unless the task explicitly calls for a disposable reset.
- Commit `prisma/schema.prisma` and its new `prisma/migrations/<timestamp>_<name>/migration.sql` together; do not edit `migration_lock.toml` manually.
- Create and apply schema migrations with `npm run db:migrate -- --name <migration_name>` (or the equivalent Prisma Migrate command); do not hand-write migration SQL or manually choose migration timestamps. Inspect the generated migration and keep it synchronized with the schema change.

## Admin And Auth

- Next.js 16 request protection lives in `src/proxy.ts` (not `middleware.ts`), backed by the NextAuth v5 configuration in `src/auth.ts`; `src/app/admin/(main)/layout.tsx` also enforces an authenticated session.
- `src/admin/routes.ts` owns route metadata and `src/admin/navigation.ts` derives menu items with `routeItem(...)`. Add the route first and leave it disabled until its App Router page exists.
- `src/admin/permissions.ts` and `src/admin/notifications.ts` are role-based UI mocks, not server authorization or live counts. Hidden navigation does not prevent direct URL access.
- Credentials validation is shared by the client and server through `src/validation/auth.ts`. Preserve the post-login `dispatch(setUser(...))` in `login-form.tsx`; the Redux store is created once and `router.refresh()` alone does not reliably synchronize its auth state.
