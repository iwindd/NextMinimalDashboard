import { describe, expect, it } from "vitest";
import { buildLifecycleAuditRows } from "./audit-rows";
import { MOCKUP_LIFECYCLE_STATES, planLifecycle } from "./lifecycle";
import { seedRequestContext } from "./request-context";

const author = { id: "editor-id", role: "EDITOR" as const };
const admin = { id: "admin-id", role: "ADMIN" as const };

const ACTIONS = {
  CREATED: "NEWS_CREATED",
  SUBMITTED: "NEWS_SUBMITTED",
  CHANGES_REQUESTED: "NEWS_CHANGES_REQUESTED",
  PUBLISHED: "NEWS_PUBLISHED",
  SUPERSEDED: "NEWS_UPDATED",
  ARCHIVED: "NEWS_ARCHIVED",
  DELETED: "NEWS_DELETED",
} as const;

function build(state: (typeof MOCKUP_LIFECYCLE_STATES)[number]) {
  const plan = planLifecycle(state);
  const revisionIds = new Map(
    plan.revisions.map((revision) => [
      revision.version,
      `revision-${revision.version}`,
    ]),
  );
  const archivedAt = plan.archived ? new Date("2025-06-01T00:00:00.000Z") : null;
  const deletedAt = plan.deleted ? new Date("2025-06-02T00:00:00.000Z") : null;

  return buildLifecycleAuditRows({
    plan,
    resourceId: "resource-id",
    resourceType: "NEWS",
    actions: ACTIONS,
    author,
    admin,
    revisionIds,
    requestContext: seedRequestContext("news"),
    reviewReason: "ขอให้ปรับปรุง",
    archiveNote: plan.archiveNote ? "จัดเก็บเพื่อทบทวน" : undefined,
    deleteReason: "ยกเลิกร่าง",
    startedAt: new Date("2025-05-01T00:00:00.000Z"),
    archivedAt,
    deletedAt,
  });
}

describe("buildLifecycleAuditRows", () => {
  it("attributes authoring to the author and review decisions to the admin", () => {
    const rows = build("SUPERSEDED");

    for (const row of rows) {
      const expected =
        row.action === ACTIONS.CREATED || row.action === ACTIONS.SUBMITTED
          ? author
          : admin;
      expect(row.actorUserId).toBe(expected.id);
      expect(row.actorRole).toBe(expected.role);
    }
  });

  it("stamps every row with the seed request context and the resource", () => {
    for (const state of MOCKUP_LIFECYCLE_STATES) {
      for (const row of build(state)) {
        expect(row.requestId).toBe("seed-news");
        expect(row.userAgent).toBe("simple-dashboard-news-seed");
        expect(row.resourceType).toBe("NEWS");
        expect(row.resourceId).toBe("resource-id");
      }
    }
  });

  it("orders rows strictly forward in time", () => {
    for (const state of MOCKUP_LIFECYCLE_STATES) {
      const times = build(state).map((row) => (row.createdAt as Date).getTime());

      for (let index = 1; index < times.length; index += 1) {
        expect(times[index]).toBeGreaterThan(times[index - 1]);
      }
    }
  });

  it("records a reason on the review, archive and delete rows only", () => {
    const rows = build("CHANGES_REQUESTED");
    const changesRequested = rows.find(
      (row) => row.action === ACTIONS.CHANGES_REQUESTED,
    );

    expect(changesRequested?.reason).toBe("ขอให้ปรับปรุง");
    expect(rows.find((row) => row.action === ACTIONS.CREATED)?.reason).toBeUndefined();
  });

  it("carries the archive note only for the state that has one", () => {
    const withNote = build("ARCHIVED_WITH_NOTE").find(
      (row) => row.action === ACTIONS.ARCHIVED,
    );
    const withoutNote = build("ARCHIVED").find(
      (row) => row.action === ACTIONS.ARCHIVED,
    );

    expect(withNote?.reason).toBe("จัดเก็บเพื่อทบทวน");
    expect(withoutNote?.reason).toBeUndefined();
  });

  it("never emits a review action for a record nobody reviewed", () => {
    const actions = build("DRAFT").map((row) => row.action);

    expect(actions).toEqual([ACTIONS.CREATED]);
  });
});
