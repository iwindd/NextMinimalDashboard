# Shared AppTech revision model

## Contents

- [Canonical state](#canonical-state)
- [Parent versus revision](#parent-versus-revision)
- [Shared transition matrix](#shared-transition-matrix)
- [Display and list semantics](#display-and-list-semantics)
- [Cross-module parity rules](#cross-module-parity-rules)
- [Source map](#source-map)

## Canonical state

All three modules use the same revision status enum values:

```text
DRAFT -> IN_REVIEW -> PUBLISHED
          |              |
          v              v
  CHANGES_REQUESTED   SUPERSEDED (historical revision)
```

`CHANGES_REQUESTED` returns the current working revision to the author. News and Knowledge keep that status while the author edits so the revision cannot be published before resubmission; their submit action clears the review fields and changes it to `IN_REVIEW`. Learning retains its domain-specific save behavior. `SUPERSEDED` is assigned to the previous published revision when a different revision is published; it is historical and should not be treated as the current display state.

The status enum is declared in `prisma/models/content.prisma` as `NewsRevisionStatus`, `KnowledgeRevisionStatus`, and `LearningRevisionStatus`. Do not introduce a second status vocabulary in a feature or infer parent lifecycle from the enum alone.

## Parent versus revision

Each parent record has two nullable pointers:

- `workingRevision`: the editable or submitted candidate;
- `publishedRevision`: the revision currently selected for public content.

The parent also owns:

- `archivedAt`: whether the public item is deliberately hidden; this is not a revision status;
- `deletedAt`: soft deletion of the parent; this is not a revision status.

The normal detail/list projection is `workingRevision ?? publishedRevision`, but display status must account for parent flags. For example, an archived item with a working `IN_REVIEW` revision is displayed as a republish request in all three list helpers. An archived item with no working revision retains a published revision but is displayed as archived.

Publishing a new revision normally does all of the following in one transaction:

1. mark the prior published revision `SUPERSEDED` when it is a different revision;
2. mark the selected working revision `PUBLISHED` and set `publishedAt`;
3. set the parent `publishedRevisionId` to the selected revision;
4. clear `workingRevisionId`;
5. clear `archivedAt`.

The helper also controls public file access for News and Knowledge. Learning has YouTube episode records and no equivalent file-access transition.

## Shared transition matrix

| Intent | News / Knowledge | Learning | Important boundary |
|---|---|---|---|
| Create | Create parent + version 1 working `DRAFT`; audit create | Same, with series and episodes | Creation is not publication. |
| Save draft | Update working revision, or create the next draft from published content; a live published item may auto-publish on save unless its working revision is `CHANGES_REQUESTED` | Admin or owner saves through `saveLearning`; a live published item auto-publishes after Learning review validation | Check whether a working revision exists before creating a version. |
| Submit | Editor-owned `DRAFT`/`CHANGES_REQUESTED` -> `IN_REVIEW`; archived editor request clones the published revision first | Same status transition, but server requires owner and verified episode metadata | Server validation is required even if the UI validates first. |
| Cancel submission | Editor-owned `IN_REVIEW` -> `DRAFT`, clears review fields | Same, audit action is `LEARNING_UPDATED` | Do not allow Admin cancellation. |
| Request changes | Admin only; `IN_REVIEW` -> `CHANGES_REQUESTED` with required reason | Admin permission `REVIEW`; same state transition | Reason belongs to the working revision and audit log. |
| Approve/publish | Admin publishes a valid working revision from `DRAFT` or `IN_REVIEW`; `CHANGES_REQUESTED` must be submitted again first | Admin publishes a valid working revision from `DRAFT` or `IN_REVIEW`; `CHANGES_REQUESTED` must be submitted again first | Learning applies the same status gate plus episode/YouTube review validation; `CHANGES_REQUESTED` must be submitted again first. |
| Archive | Admin only; requires published revision; public files become private | Admin only; requires published revision; records note | Archive is parent lifecycle, not revision status. |
| Republish | Admin only; archived + published + no working revision; reuses same version | Same; reuses same version and updates `publishedAt` | A working revision blocks republish. |
| Delete | Owner only; never-published working `DRAFT`; soft delete | Same, owner-only; no published revision | Deletion is not a trash/revision status. |
| Restore | Admin action exists; clears deletion and re-publicizes published files | No restore action currently exists | Do not add Learning restore by copying News/Knowledge. |

## Display and list semantics

News and Knowledge list queries always add `deletedAt: null`. Editors are scoped to their own parent records. Admin visibility intentionally hides another author's unreviewed draft; a reviewed draft may be presented as `CHANGES_REQUESTED` through `reviewedDraftAsChangesRequested` even when the stored status is still `DRAFT`.

The `republish` list filter means:

```text
archivedAt IS NOT NULL AND workingRevision.status = IN_REVIEW
```

The regular `archived` filter excludes that in-review republish case. A status tab is therefore not necessarily a direct database enum filter.

Learning uses the same conceptual display distinction but its helper maps the current record in `learning-table.helpers.ts` without the News/Knowledge reviewed-draft presentation option.

## Cross-module parity rules

When a request says “make the actions the same,” compare these separately:

1. action inventory and render order;
2. visibility predicates for each role and state;
3. label, color, variant, disabled/loading behavior;
4. dirty-form and confirmation behavior;
5. server action and policy predicate;
6. revision/parent writes;
7. media or episode side effects;
8. audit action, reason, and revalidation paths.

News and Knowledge are intended to remain close clones. Learning now shares their dirty-save and active published auto-publish behavior, while still differing in episode validation, permission middleware, and restore availability.

## Current action-stack baseline

The News and Knowledge detail pages intentionally render the same action order; only the domain noun changes. Read this as the current UI contract, then verify predicates in source before changing it:

1. Admin archive: orange outline, `จัดเก็บข่าว` / `จัดเก็บความรู้`.
2. Dirty save: outline, `บันทึก` or `บันทึกและเผยแพร่` when an active published item will auto-publish.
3. Owner Editor draft: filled `ส่งตรวจสอบ`.
4. Owner Editor archived request: orange filled `ส่งคำร้องขอเผยแพร่อีกครั้ง`.
5. Admin draft publish: green `เผยแพร่ข่าว` / `เผยแพร่ความรู้`, or `เผยแพร่อีกครั้ง` for the archived working-draft path.
6. Admin archived item with no working revision: green `เผยแพร่อีกครั้ง`.
7. Owner Editor review cancellation: gray outline `ยกเลิกการส่งตรวจสอบ`.
8. Admin review: orange outline `ส่งกลับให้แก้ไข` plus green `อนุมัติและเผยแพร่`, or `อนุมัติและเผยแพร่อีกครั้ง` for an archived review.
9. Admin restore: light green `กู้คืนข่าว` / `กู้คืนความรู้` when the parent is deleted.

The header overflow menu is shown only for the owner of a never-published working `DRAFT`; its red item is `ลบข่าว` or `ลบความรู้`, and the News/Knowledge trigger uses the `default-subtle` action-icon variant. Learning uses a `default` trigger and `ลบฉบับร่าง`.

## Source map

Use these files as the first evidence set:

- schema: `prisma/models/content.prisma`;
- News: `src/servers/news/helpers.ts`, `authorization.ts`, `save-news.ts`, `publish-news-revision.ts`, `queries/get-news-detail.ts`, `queries/get-news-list.ts`, `actions/`;
- Knowledge: the corresponding files under `src/servers/knowledge/`;
- Learning: `src/servers/learning/helpers.ts`, `authorization.ts`, `permissions.ts`, `save-learning.ts`, `publish-learning-revision.ts`, `queries/get-learning-detail.ts`, `queries/get-learning-list.ts`, `actions/`;
- UI: the three detail pages and their table helper files under `src/app/admin/(main)/(content)/`;
- tests: `src/servers/*/actions/*.test.ts`, plus module table/helper tests where present.
