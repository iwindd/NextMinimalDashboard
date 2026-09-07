# Revision-flow inspection and change checklist

## Before making a claim

Inspect the current branch and worktree, then read:

1. `AGENTS.md` and `package.json` for project commands;
2. `prisma/models/content.prisma` for parent/revision pointers and enums;
3. the module's detail query and list query for visibility and display projection;
4. the detail page and table helper for UI predicates and status labels;
5. every action involved in the requested transition;
6. the shared publish/save helper and media/episode synchronizer;
7. action tests, including negative authorization/policy cases.

Do not stop at a button's `onClick`. A button can be missing while the server still permits an action, or visible while the server correctly rejects it.

## Build a transition truth table

For each action, record:

```text
module
actor role
actor owns parent?
working revision present/status
published revision present/status
archivedAt
deletedAt
dirty form or pending media
UI predicate and label
server action and guard
database writes
audit action/reason
revalidated paths
```

Check at least these cases: owned Editor draft, owned Editor changes-requested, Editor in review, archived Editor request, Admin reviewing another author's submission, Admin publishing an owned draft, active published edit, archived published item, never-published deletion, deleted published restore, and an invalid review payload.

## Safe parity review

When comparing News and Knowledge, use one as a structural baseline and diff the other at the detail page, list helper, action names, schemas, server save/publish helpers, file synchronizers, and tests. Expected differences are domain fields and nouns; unexplained differences in state predicates, confirmation flow, or audit/revalidation deserve investigation.

When comparing Learning with either baseline, explicitly preserve these boundaries:

- Learning uses permission middleware; News/Knowledge use per-action role checks.
- Learning save is owner-only; News/Knowledge Admin save can operate on visible records.
- Learning has YouTube metadata/episode validation; News/Knowledge have cover/body file validation.
- News/Knowledge active published saves may auto-publish; Learning has no matching branch.
- News/Knowledge can restore; Learning currently cannot.

## Implementation guidance

If the requested change is a real policy change, update both the UI predicate and server guard, then add positive and negative tests. If it is presentation-only, do not loosen server policy. Keep action files operation-oriented and preserve the repository's one-action-per-file pattern.

Prefer a shared pure helper only when the calculation is truly identical across modules. Keep thin domain wrappers for audit resource/action names, schema fields, media access, and revalidation paths. Do not copy a News fix into Knowledge or Learning without checking the corresponding server policy.

Do not use a list badge, hidden navigation item, or route reachability as proof of authorization. Do not treat `archivedAt` as `ARCHIVED` revision status, and do not delete historical `SUPERSEDED` revisions when publishing.

## Validation and reporting

For an admin code change, run the exact relevant checks from the repository guidance. At minimum this normally includes:

- `npm run lint`;
- `npm run check:admin-client-boundary`;
- `npm run typecheck`;
- `npm run build` for route/configuration changes;
- the relevant Vitest/Bun wrapper tests when the repository's test script is requested or affected.

Report what each check proves and what it does not prove. Static checks do not prove populated-database migration safety, live authorization, or browser action behavior. Never run `npm run db:reset`, `npm run db:pushf`, or destructive seed commands for routine workflow work without explicit disposable-database authorization.
