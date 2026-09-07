# News revision flow

## Data and validation

The parent is `News`; revisions are `NewsRevision`. A revision contains title, excerpt, sanitized `bodyHtml`, category, read time, source links, review timestamps/reason, and revision-owned files. Files have `COVER` or `BODY` purpose and a `FileReference` controls access.

The review gate in `src/servers/news/helpers.ts` requires:

- non-empty title;
- a referenced cover file;
- non-empty body content after stripping HTML and `&nbsp;`.

Draft validation is broader and includes optional metadata. Server actions must re-run review validation; client-side validation is not an authorization boundary.

## Authorization and visibility

`getManageNewsActor` accepts only active `ADMIN` or `EDITOR` users. The action client authenticates the actor and attaches request context for audit logs. Individual actions then enforce role and ownership.

- Editors are scoped to their own News records in list/detail queries.
- Admins cannot open another author's unreviewed draft; reviewed drafts are exposed as a reviewable change-request state.
- Lists exclude `deletedAt` records.
- A deleted News record with no published revision is not detail-visible; a deleted record with a published revision can still be restored by Admin.

## State transitions

### Create and save

`createNewsAction` creates a parent owned by the actor, creates revision version 1 as working `DRAFT`, synchronizes cover/body files, and audits `NEWS_CREATED`.

`saveNews` has three important paths:

1. If a working revision exists, update it. If it is `CHANGES_REQUESTED`, keep that status and review reason until the owner submits it again.
2. If no working revision exists, create the next version from the published revision as `DRAFT`.
3. If a published revision exists and the parent is not archived, `autoPublish` is true unless the current working revision is `CHANGES_REQUESTED`: validate review fields, publish the saved revision immediately, supersede the previous published revision, and audit the automatic publication. A changes-requested or archived item does not auto-publish on save.

Editors cannot save another author's record. An Editor cannot edit an `IN_REVIEW` revision unless the active published auto-publish path applies; Admin can edit a submitted revision under the server policy.

### Submit and cancel

`submitNewsAction` accepts the owner Editor's working `DRAFT` or `CHANGES_REQUESTED` revision. For an archived item with no working revision, it clones the published revision into the next version as `DRAFT`, copies its file references, and then submits it. It validates title, cover, and body before changing the revision to `IN_REVIEW`, clears prior review fields and reason, and audits `NEWS_SUBMITTED`.

`cancelNewsSubmissionAction` is Editor-only and owner-only. It changes `IN_REVIEW` to `DRAFT`, clears `reviewedById`, `reviewedAt`, and `reviewReason`, and audits `NEWS_UPDATED` with the cancellation reason.

### Review and publication

`requestNewsChangesAction` is Admin-only, accepts only `IN_REVIEW`, requires a reason, changes the revision to `CHANGES_REQUESTED`, records reviewer/time/reason, and audits `NEWS_CHANGES_REQUESTED`.

`approveNewsAction` is Admin-only. It requires a working revision, a cover reference, valid review fields, and a publishable status of `DRAFT` or `IN_REVIEW`. A `CHANGES_REQUESTED` revision must be submitted for review again before an Admin can publish it. `publishNewsRevision` marks the old published revision `SUPERSEDED`, makes old files private, publishes the selected revision, makes its files public, moves the parent pointer, clears the working pointer, and clears archive state. It audits `NEWS_PUBLISHED`.

`republishNewsAction` is Admin-only and does not create a version. It requires `archivedAt`, a published revision still in `PUBLISHED`, and no working revision. It makes the existing published files public, clears archive state, and audits `NEWS_PUBLISHED` with an explicit republish reason.

### Archive, delete, restore

`archiveNewsAction` is Admin-only and requires a published revision that is not already archived. It makes the published revision's files private, sets `archivedAt`, stores an optional note in the archive audit log, and revalidates public and admin paths.

`deleteNewsAction` is owner-only, including an Admin deleting their own draft. It only soft-deletes a parent with no published revision and a working `DRAFT`; it is idempotent if already deleted and audits `NEWS_DELETED`. It never hard-deletes revision history.

`restoreNewsAction` is Admin-only. It clears `deletedAt`/`deletedById`; if a published revision exists, it makes that revision's files public again; then audits `NEWS_RESTORED`. It does not itself create a revision or clear archive state.

## Current Admin UI behavior

The detail page is `src/app/admin/(main)/(content)/news/(routes)/[newsId]/page.tsx`.

- The header menu exposes draft deletion only when the current actor owns a never-published `DRAFT`.
- News uses `autoPublishActive` to label the save button `บันทึกและเผยแพร่` for active published content.
- Submit, publish, and archived republish validate review fields in the client and can confirm “save then continue” when the form or pending media is dirty.
- Admin review exposes `ส่งกลับให้แก้ไข` and `อนุมัติและเผยแพร่`; Editor review exposes cancellation, with a separate republish-cancellation label for archived submissions.
- Archive appears before the save/workflow buttons; restore appears for Admin on a deleted record.

If a News UI change is requested, compare both the detail page conditions and the server action tests. A visible button is not enough evidence that a transition is permitted.
