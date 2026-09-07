# Knowledge revision flow

## Relationship to News

Knowledge intentionally mirrors News at the revision/lifecycle level. The parent is `Knowledge`; revisions are `KnowledgeRevision`; the same five revision statuses, `workingRevision`/`publishedRevision` pointers, archive flag, soft deletion, review flow, and Admin restore flow apply. The corresponding UI action block is structurally parallel to News. When comparing the two, differences should normally be domain nouns, server action names, validation fields, and media metadata—not an unexplained lifecycle divergence.

## Data and validation

A Knowledge revision contains title, excerpt, sanitized `bodyHtml`, category, `KnowledgeType` (`ARTICLE` or `GUIDE`), study time, and JSON author/publisher links. Files have `COVER` or `BODY` purpose and use the same `FileReference` access model as News.

The review gate in `src/servers/knowledge/helpers.ts` requires:

- non-empty title;
- a referenced cover file;
- non-empty body content after stripping HTML and `&nbsp;`.

Draft validation also covers type, study time, category, and author/publisher fields. Server approval and submission revalidate the review gate.

## Authorization and visibility

`getManageKnowledgeActor` accepts only active `ADMIN` or `EDITOR` users. `manageKnowledgeActionClient` authenticates and attaches request context. Per-action role and ownership checks mirror News.

- Editors are scoped to their own Knowledge records.
- Admins cannot open another author's unreviewed draft; reviewed drafts can be presented as change-requested for Admin workflow.
- Lists exclude deleted records.
- Deleted Knowledge without a published revision is not detail-visible; an Admin can restore a deleted item that has a published revision.

## State transitions

### Create and save

`createKnowledgeAction` creates an owned parent and version 1 working `DRAFT`, sanitizes body HTML, synchronizes cover/body media, and audits `KNOWLEDGE_CREATED`.

`saveKnowledge` follows the News shape:

1. update an existing working revision; a `CHANGES_REQUESTED` revision keeps its status and reason until it is submitted again;
2. create the next working draft from the published revision when no working revision exists;
3. auto-publish a valid save when a published revision is active and the parent is not archived, except while the working revision is `CHANGES_REQUESTED`.

Active published edits require the review gate because the save itself is public. Archived edits remain draft until submitted/approved. Editors cannot save another author's item; Admin may operate on visible records under the action policy.

### Submit and cancel

`submitKnowledgeAction` accepts owner-Editor `DRAFT`/`CHANGES_REQUESTED` content. For an archived item with no working revision, it clones the published revision and its file references into the next draft version before submitting. It validates title, cover, and body, then changes the revision to `IN_REVIEW`, clears the previous review reason, and audits `KNOWLEDGE_SUBMITTED`.

`cancelKnowledgeSubmissionAction` is Editor-only and owner-only. It changes `IN_REVIEW` to `DRAFT`, clears review fields/reason, and audits `KNOWLEDGE_UPDATED`.

### Review and publication

`requestKnowledgeChangesAction` is Admin-only, accepts only `IN_REVIEW`, requires a reason, stores reviewer/time/reason, changes to `CHANGES_REQUESTED`, and audits `KNOWLEDGE_CHANGES_REQUESTED`.

`approveKnowledgeAction` is Admin-only. It requires a working revision, a cover reference, valid review fields, and a publishable status of `DRAFT` or `IN_REVIEW`. A `CHANGES_REQUESTED` revision must be submitted for review again before an Admin can publish it. `publishKnowledgeRevision` supersedes the previous published revision, changes file access to private/public as appropriate, sets the published pointer, clears the working pointer, clears archive state, and audits `KNOWLEDGE_PUBLISHED`.

`republishKnowledgeAction` is Admin-only, reuses the existing published revision for an archived item, requires no working revision, makes files public, clears archive state, and audits `KNOWLEDGE_PUBLISHED` with a republish reason. It does not create a new revision version.

### Archive, delete, restore

`archiveKnowledgeAction` is Admin-only and requires a published, non-deleted, non-archived item. It makes published files private, sets `archivedAt`, records the optional note, and audits `KNOWLEDGE_ARCHIVED`.

`deleteKnowledgeAction` is owner-only and limited to a never-published working `DRAFT`; it soft-deletes and audits `KNOWLEDGE_DELETED` without destroying revision history.

`restoreKnowledgeAction` is Admin-only. It clears deletion and re-publicizes the published revision's files when one exists, then audits `KNOWLEDGE_RESTORED`. It does not create a revision or automatically change archive state.

## Current Admin UI behavior

The detail page is `src/app/admin/(main)/(content)/knowledge/(routes)/[knowledgeId]/page.tsx`.

- Its action inventory, render order, role predicates, confirmation flow, and button props are intended to match News, including the `ส่งกลับให้แก้ไข`/`อนุมัติและเผยแพร่` review pair.
- Differences from News should normally be `ข่าว` versus `ความรู้`, route/form IDs, server action imports, review messages, and Knowledge-specific fields.
- The UI has separate normal submit, archived republish request, Admin draft publish, Admin archived republish, Editor cancellation, Admin reject/approve, archive, delete, and restore paths.
- Dirty saves use the “save then continue” confirmation flow for review/publish operations and include pending cover/body media in the dirty calculation.

When a user reports that `/admin/knowledge/[knowledgeId]` differs from News, first diff this page against the News detail page and then trace the paired server action. Do not assume a visual difference is a policy difference.
