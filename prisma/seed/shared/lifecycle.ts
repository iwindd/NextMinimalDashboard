/**
 * Every mockup lifecycle situation the News admin UI can show.
 *
 * News carries the lifecycle fields — `publishedRevisionId`, `workingRevisionId`,
 * `archivedAt`, `deletedAt` — so the shape of a situation is module independent.
 * Only the Prisma delegates and audit action names differ, and those stay in the
 * the News seed.
 *
 * The list is deliberately exhaustive rather than a sample: the mockup seed
 * guarantees at least one record per state per category, so every admin status
 * tab and every public listing path has data.
 */
export const MOCKUP_LIFECYCLE_STATES = [
  /** Never published, author still editing. */
  "DRAFT",
  /** Draft an Admin has already looked at; the lists present it as changes requested. */
  "DRAFT_REVIEWED",
  /** Waiting for review. */
  "IN_REVIEW",
  /** Sent back to the author with a reason. */
  "CHANGES_REQUESTED",
  /** Live on the public site. */
  "PUBLISHED",
  /** Live, with an unpublished edit in progress. */
  "PUBLISHED_WITH_DRAFT",
  /** Live, with an edit waiting for review. */
  "PUBLISHED_WITH_REVIEW",
  /** Live at version 2; version 1 is kept as history. */
  "SUPERSEDED",
  /** Deliberately hidden from the public site. */
  "ARCHIVED",
  /** Archived with a reason recorded. */
  "ARCHIVED_WITH_NOTE",
  /** Archived, with the author asking for it to go live again. */
  "ARCHIVED_REPUBLISH_REQUEST",
  /** Soft deleted while it was still an unpublished draft. */
  "DELETED_DRAFT",
] as const;

export type MockupLifecycleState = (typeof MOCKUP_LIFECYCLE_STATES)[number];

/** The revision status vocabulary every module shares. */
type RevisionStatusName =
  | "DRAFT"
  | "IN_REVIEW"
  | "CHANGES_REQUESTED"
  | "PUBLISHED"
  | "SUPERSEDED";

export type PlannedRevision = {
  version: number;
  status: RevisionStatusName;
  /** An Admin has seen it: `reviewedById` and `reviewedAt` are set. */
  reviewed: boolean;
  /** A review reason is recorded on the revision. */
  hasReviewReason: boolean;
  /** The author has submitted it: `submittedAt` is set. */
  submitted: boolean;
  /**
   * Whether this revision is the one the public site serves right now. Only a
   * live revision may expose its files with `FileAccess.PUBLIC`; every other
   * revision, including a superseded one, keeps them private.
   */
  live: boolean;
};

export type LifecyclePlan = {
  state: MockupLifecycleState;
  revisions: PlannedRevision[];
  /** Version the parent points at as `publishedRevisionId`, or null. */
  publishedVersion: number | null;
  /** Version the parent points at as `workingRevisionId`, or null. */
  workingVersion: number | null;
  archived: boolean;
  /** Whether the archive event records a reason. */
  archiveNote: boolean;
  deleted: boolean;
};

/** Abstract audit events, mapped to module specific `AuditAction` values by the caller. */
export type LifecycleAuditEvent =
  | { kind: "CREATED" }
  | { kind: "SUBMITTED"; version: number }
  | { kind: "CHANGES_REQUESTED"; version: number }
  | { kind: "PUBLISHED"; version: number }
  | { kind: "SUPERSEDED"; version: number }
  | { kind: "ARCHIVED"; version: number }
  | { kind: "DELETED"; version: number };

function revision(
  version: number,
  status: RevisionStatusName,
  overrides: Partial<Omit<PlannedRevision, "version" | "status">> = {},
): PlannedRevision {
  return {
    version,
    status,
    reviewed: false,
    hasReviewReason: false,
    submitted: status !== "DRAFT",
    live: false,
    ...overrides,
  };
}

/**
 * Expands a state name into the exact revisions and parent pointers to write.
 *
 * Keeping this pure is what lets the module seeds stay small: they only translate
 * the plan into their own Prisma delegates, with no lifecycle branching of their
 * own, and the plan itself is unit tested without a database.
 */
export function planLifecycle(state: MockupLifecycleState): LifecyclePlan {
  switch (state) {
    case "DRAFT":
      return base(state, [revision(1, "DRAFT")], { workingVersion: 1 });
    case "DRAFT_REVIEWED":
      return base(state, [revision(1, "DRAFT", { reviewed: true })], {
        workingVersion: 1,
      });
    case "IN_REVIEW":
      return base(state, [revision(1, "IN_REVIEW")], { workingVersion: 1 });
    case "CHANGES_REQUESTED":
      return base(
        state,
        [
          revision(1, "CHANGES_REQUESTED", {
            reviewed: true,
            hasReviewReason: true,
          }),
        ],
        { workingVersion: 1 },
      );
    case "PUBLISHED":
      return base(
        state,
        [revision(1, "PUBLISHED", { reviewed: true, live: true })],
        { publishedVersion: 1 },
      );
    case "PUBLISHED_WITH_DRAFT":
      return base(
        state,
        [
          revision(1, "PUBLISHED", { reviewed: true, live: true }),
          revision(2, "DRAFT"),
        ],
        { publishedVersion: 1, workingVersion: 2 },
      );
    case "PUBLISHED_WITH_REVIEW":
      return base(
        state,
        [
          revision(1, "PUBLISHED", { reviewed: true, live: true }),
          revision(2, "IN_REVIEW"),
        ],
        { publishedVersion: 1, workingVersion: 2 },
      );
    case "SUPERSEDED":
      return base(
        state,
        [
          revision(1, "SUPERSEDED", { reviewed: true }),
          revision(2, "PUBLISHED", { reviewed: true, live: true }),
        ],
        { publishedVersion: 2 },
      );
    case "ARCHIVED":
      return base(state, [revision(1, "PUBLISHED", { reviewed: true })], {
        publishedVersion: 1,
        archived: true,
      });
    case "ARCHIVED_WITH_NOTE":
      return base(state, [revision(1, "PUBLISHED", { reviewed: true })], {
        publishedVersion: 1,
        archived: true,
        archiveNote: true,
      });
    case "ARCHIVED_REPUBLISH_REQUEST":
      return base(
        state,
        [
          revision(1, "PUBLISHED", { reviewed: true }),
          revision(2, "IN_REVIEW"),
        ],
        { publishedVersion: 1, workingVersion: 2, archived: true },
      );
    case "DELETED_DRAFT":
      return base(state, [revision(1, "DRAFT")], {
        workingVersion: 1,
        deleted: true,
      });
  }
}

function base(
  state: MockupLifecycleState,
  revisions: PlannedRevision[],
  overrides: Partial<
    Pick<
      LifecyclePlan,
      | "publishedVersion"
      | "workingVersion"
      | "archived"
      | "archiveNote"
      | "deleted"
    >
  >,
): LifecyclePlan {
  return {
    state,
    revisions,
    publishedVersion: null,
    workingVersion: null,
    archived: false,
    archiveNote: false,
    deleted: false,
    ...overrides,
  };
}

/**
 * Whether the public site lists the record, which is what decides if its year
 * gets a year archive entry.
 */
export function isLivePublished(plan: LifecyclePlan) {
  return plan.revisions.some((planned) => planned.live);
}

/**
 * A plausible audit trail for a plan, in chronological order. Modules map each
 * `kind` to their own `AuditAction` and supply the resource id.
 */
export function planLifecycleAuditEvents(
  plan: LifecyclePlan,
): LifecycleAuditEvent[] {
  const events: LifecycleAuditEvent[] = [{ kind: "CREATED" }];
  const supersededVersions: number[] = [];

  for (const planned of plan.revisions) {
    if (planned.submitted) {
      events.push({ kind: "SUBMITTED", version: planned.version });
    }
    if (planned.status === "CHANGES_REQUESTED") {
      events.push({ kind: "CHANGES_REQUESTED", version: planned.version });
    }
    // A superseded revision was published before it was replaced, so it has a
    // publish event of its own.
    if (planned.status === "PUBLISHED" || planned.status === "SUPERSEDED") {
      events.push({ kind: "PUBLISHED", version: planned.version });
    }
    if (planned.status === "SUPERSEDED") supersededVersions.push(planned.version);
    // Archiving happens after the live revision was published but before a
    // later republish request is submitted.
    if (plan.archived && planned.version === plan.publishedVersion) {
      events.push({ kind: "ARCHIVED", version: planned.version });
    }
  }

  // A revision is superseded at the moment its replacement is published, which
  // is after every publish event above.
  for (const version of supersededVersions) {
    events.push({ kind: "SUPERSEDED", version });
  }
  if (plan.deleted) {
    events.push({ kind: "DELETED", version: plan.workingVersion ?? 1 });
  }

  return events;
}
