---
name: apptech-revision-flow
description: Analyze, explain, review, or change the AppTech admin revision workflow across News, Knowledge, and Learning media. Trigger whenever a request mentions revision flow, draft/review/publish states, changes requested, archive/republish, delete/restore, action buttons, status tabs, role permissions, or aligning any of the three content modules, even when the user names only one route.
---

# AppTech revision flow

Use this skill for AppTech's revision-based content management, not for generic CRUD work. Treat News, Knowledge, and Learning as related but non-identical workflows: News and Knowledge are intentionally parallel; Learning has different permissions, ownership, validation, and UI sequencing.

## Operating rules

1. Read the repository `AGENTS.md` and inspect current source before relying on this skill. The source is authoritative when the code and this reference disagree.
2. Read `references/overview.md` first. Then read only the module reference needed for the request: `news.md`, `knowledge.md`, or `learning.md`. Read `validation.md` when changing or reviewing code.
3. Trace every requested action through both lanes:
   - UI lane: route page, context/query, visibility predicate, label/style, confirmation modal, dirty-state behavior, loading/error/success behavior.
   - server lane: action client, authentication, role/permission guard, ownership rule, revision/parent predicates, transaction writes, audit log, file/access side effects, and revalidation.
4. Keep these concepts separate in every explanation and patch:
   - revision status: `DRAFT`, `IN_REVIEW`, `CHANGES_REQUESTED`, `PUBLISHED`, `SUPERSEDED`;
   - parent lifecycle: `workingRevision`, `publishedRevision`, `archivedAt`, and `deletedAt`;
   - UI display status, which may combine revision status with archive state;
   - authorization, which is not proven by a hidden or visible button.
5. When comparing modules, state whether a difference is intentional, a UI-only mismatch, a server-policy mismatch, or a confirmed defect. Do not call News/Knowledge and Learning “the same” merely because they share status names.
6. Preserve domain-specific behavior when aligning UI. In particular, do not silently import News/Knowledge's file-access or auto-publish behavior into Learning, and do not add Learning restore behavior without a real server action and policy.

## Canonical source map

| Concern | News | Knowledge | Learning |
|---|---|---|---|
| Admin detail route | `src/app/admin/(main)/(content)/news/(routes)/[newsId]/page.tsx` | `src/app/admin/(main)/(content)/knowledge/(routes)/[knowledgeId]/page.tsx` | `src/app/admin/(main)/(content)/learning-media/(routes)/[seriesId]/page.tsx` |
| Parent/revision schema | `prisma/models/content.prisma` (`News`, `NewsRevision`) | same file (`Knowledge`, `KnowledgeRevision`) | same file (`LearningSeries`, `LearningSeriesRevision`, `LearningEpisode`) |
| Detail query | `src/servers/news/queries/get-news-detail.ts` | `src/servers/knowledge/queries/get-knowledge-detail.ts` | `src/servers/learning/queries/get-learning-detail.ts` |
| Server actions | `src/servers/news/actions/` | `src/servers/knowledge/actions/` | `src/servers/learning/actions/` |
| Shared publish helper | `src/servers/news/publish-news-revision.ts` | `src/servers/knowledge/publish-knowledge-revision.ts` | `src/servers/learning/publish-learning-revision.ts` |
| List status mapping | `news-table.helpers.ts` + `get-news-list.ts` | `knowledge-table.helpers.ts` + `get-knowledge-list.ts` | `learning-table.helpers.ts` + `get-learning-list.ts` |
| Role/permission source | `authorization.ts` plus per-action role checks | `authorization.ts` plus per-action role checks | `authorization.ts`, `permissions.ts`, and per-action permission middleware |

## Required report format

For an investigation or comparison, report in this order:

1. Scope and the exact route/module names.
2. Source-of-truth files inspected.
3. Shared revision model and state transition summary.
4. A per-module role/status/action matrix.
5. Differences split into UI, server policy, data side effects, and audit/revalidation.
6. Concrete findings with file/line references and a clear classification: intentional difference, parity gap, or bug.
7. If implementing, list changed files and run only the relevant project validation; do not claim static checks prove live database or browser behavior.

## Change boundary

Before changing a workflow, build a truth table for role, owner, revision status, `workingRevision`, `publishedRevision`, `archivedAt`, `deletedAt`, and dirty form state. Apply the same invariant in the UI and server action, but keep the server guard authoritative. Prefer shared helpers for truly identical calculations while leaving thin News/Knowledge/Learning action wrappers and domain-specific audit names intact.

For schema or migration work, follow the repository's Prisma and database-safety instructions. Never use reset/force-push/seed commands that erase data unless the user explicitly authorizes a disposable database. For an ordinary admin code change, use the repository's required checks (`npm run lint`, `npm run check:admin-client-boundary`, `npm run typecheck`; add `npm run build` for route/configuration changes) and the relevant tests.

## References

- Read [`references/overview.md`](references/overview.md) for the shared model and cross-module matrix.
- Read [`references/news.md`](references/news.md) for News's complete transition and media behavior.
- Read [`references/knowledge.md`](references/knowledge.md) for Knowledge's parallel workflow and domain fields.
- Read [`references/learning.md`](references/learning.md) for Learning's permission matrix, episode validation, and intentional differences.
- Read [`references/validation.md`](references/validation.md) for a safe inspection, parity-review, and implementation checklist.
