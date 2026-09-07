# Learning media revision flow

## Relationship to News and Knowledge

Learning uses the same revision status vocabulary and parent pointers, but it is not a drop-in copy of News/Knowledge. The parent is `LearningSeries`; content is a series of YouTube episodes stored under `LearningSeriesRevision`. There is no `restoreLearningAction` currently, and there is no News/Knowledge-style file-access transition.

## Data and review gate

A Learning revision contains title, description, category, and ordered `LearningEpisode` records. Each episode stores source URL, parsed YouTube video ID, title, description, optional label, duration, thumbnail, and `metadataVerifiedAt`.

`getLearningReviewFieldErrors` requires:

- a non-empty series title;
- a category;
- at least one episode;
- a valid YouTube URL/video ID and verified metadata for every episode;
- a non-empty episode title.

The update schema also bounds episode count, URL/title/description/label lengths, and duration. Server submit/approve checks the same review invariants; a client-side button state is not sufficient.

## Authorization and permissions

All Learning actions run through `manageLearningActionClient`, which authenticates an active Admin or Editor and attaches request context. `src/servers/learning/permissions.ts` then grants:

| Permission | ADMIN | EDITOR |
|---|---:|---:|
| create | yes | yes |
| update | yes | yes |
| submit | yes | yes |
| review | yes | no |
| publish | yes | no |
| archive | yes | no |
| delete | yes | yes |
| manage category | yes | yes |

`saveLearning` allows Admins to edit visible series and requires Editors to own the series. `submitLearningAction`, cancellation, and deletion are owner-only. `approveLearningAction` allows an Admin to publish any valid working `DRAFT` or `IN_REVIEW` revision; a `CHANGES_REQUESTED` revision must be submitted again first, matching the News/Knowledge Admin detail UI while retaining Learning's episode review gate.

Detail/list visibility still scopes Editors to their own series and hides deleted never-published drafts. Admins cannot open another author's unreviewed draft.

## State transitions

### Create and save

`createLearningAction` creates an owned `LearningSeries`, version 1 working `DRAFT`, and its episodes. It validates category and records the create audit.

`saveLearning`:

1. rejects deleted records and non-owner Editors;
2. rejects Editor edits to an archived `IN_REVIEW` working revision;
3. resolves YouTube metadata with bounded concurrency and records per-episode metadata errors;
4. updates the existing working revision while retaining `CHANGES_REQUESTED` and its review reason until the Editor submits again, or creates the next working revision from the current published content when no working revision exists;
5. does not auto-publish a `CHANGES_REQUESTED` revision while it is being edited;
6. replaces the revision's episode rows while preserving existing IDs when updating a working revision;
7. audits `LEARNING_UPDATED`; an active published parent validates and publishes the saved revision in the same transaction, while an archived/draft parent remains working; public/admin paths are revalidated.

The detail UI labels active published saves `บันทึกและเผยแพร่`; archived and draft saves use `บันทึก`. Dirty workflow actions open a save-then-continue confirmation like News/Knowledge.

### Submit and cancel

`submitLearningAction` is Editor-only and owner-only. It accepts working `DRAFT` or `CHANGES_REQUESTED`. For an archived series with no working revision, it clones the published revision and all episodes into the next draft version first. It then checks category, episode count, YouTube IDs, metadata verification, and episode titles before changing the revision to `IN_REVIEW` and auditing `LEARNING_SUBMITTED`.

`cancelLearningSubmissionAction` is Editor-only, owner-only, and limited to `IN_REVIEW`. It changes the revision to `DRAFT`, clears reviewer/time/reason fields, updates the parent timestamp, and audits `LEARNING_UPDATED` with the cancellation reason.

### Review and publication

`requestLearningChangesAction` requires the Admin `REVIEW` permission and an `IN_REVIEW` working revision. It changes the revision to `CHANGES_REQUESTED`, records reviewer/time/reason, updates the parent timestamp, and audits `LEARNING_CHANGES_REQUESTED`.

`approveLearningAction` requires the Admin `PUBLISH` permission, a working revision, and a valid Learning review gate. It rejects deleted records and requires the working revision to be `DRAFT` or `IN_REVIEW`; a `CHANGES_REQUESTED` revision must be submitted again first. `publishLearningRevision` marks the old revision `SUPERSEDED`, publishes the selected revision, moves the parent pointers, clears archive state, and audits `LEARNING_PUBLISHED` with episode/video information.

`republishLearningAction` requires Admin `PUBLISH`, an archived parent, a published revision still in `PUBLISHED`, and no working revision. It reuses the same published revision, updates `publishedAt`, clears `archivedAt`, and audits `LEARNING_PUBLISHED` with a republish reason. It does not create a new version and does not touch file access.

### Archive and delete

`archiveLearningAction` requires Admin `ARCHIVE`, a published revision, and a non-archived/non-deleted parent. It sets `archivedAt`, stores an optional note in the audit log, and revalidates `/learning` plus admin paths.

`deleteLearningAction` requires the Delete permission and exact ownership. It only soft-deletes a never-published working `DRAFT`; it is idempotent if already deleted. It audits `LEARNING_DELETED`. There is currently no restore action or restore UI, so parity with News/Knowledge must not be assumed.

## Current Admin UI behavior

The detail page is `src/app/admin/(main)/(content)/learning-media/(routes)/[seriesId]/page.tsx`.

Current visibility predicates are:

- `canDelete`: owner, not deleted, no published revision, working status `DRAFT`;
- `canArchive`: Admin, not deleted/archived, has published revision;
- `canSubmit`: Editor owner, not deleted, not on the active published auto-publish path, normal status `DRAFT`/`CHANGES_REQUESTED` or archived with no working revision;
- `canCancel`: Editor owner with non-archived `IN_REVIEW`;
- `canReview`: Admin with `IN_REVIEW`;
- `canPublishOwn`: Admin owner, not on the active published auto-publish path, with `DRAFT`/`CHANGES_REQUESTED`;
- `canRepublish`: Admin, archived, no working revision, published status `PUBLISHED`.

The form itself is read-only when the parent is deleted, an Editor is looking at any `IN_REVIEW` revision, or an Admin is looking at `CHANGES_REQUESTED`. Admins can edit review and published content; server actions remain authoritative.

The current buttons now follow the News/Knowledge review and dirty-save contract:

- dirty changes show an outline save button, using `บันทึกและเผยแพร่` for active published content;
- dirty submit, send-back, approve, and archived republish actions confirm save-then-continue;
- Admin review uses orange outline `ส่งกลับให้แก้ไข` and green `อนุมัติและเผยแพร่`;
- archived republish remains a green action and reuses the existing published revision;
- no restore button is rendered.

The Learning action order is archive, dirty save, submit/request republish, owner-Admin publish, direct republish, cancellation, and Admin review. Its user-facing content noun is `สื่อการเรียนรู้`; the review labels are `ส่งกลับให้แก้ไข` and `อนุมัติและเผยแพร่` / `อนุมัติและเผยแพร่อีกครั้ง`.

When parity is requested, preserve Learning's episode verification and Editor ownership rules while matching the News/Knowledge Admin editing, review, and save-then-continue behavior.
