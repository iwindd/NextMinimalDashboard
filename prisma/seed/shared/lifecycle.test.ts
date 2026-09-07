import { describe, expect, it } from "vitest";
import {
  isLivePublished,
  MOCKUP_LIFECYCLE_STATES,
  planLifecycle,
  planLifecycleAuditEvents,
} from "./lifecycle";

describe("planLifecycle", () => {
  it("covers every state exactly once", () => {
    expect(new Set(MOCKUP_LIFECYCLE_STATES).size).toBe(
      MOCKUP_LIFECYCLE_STATES.length,
    );
  });

  it("numbers revisions from 1 with no gaps", () => {
    for (const state of MOCKUP_LIFECYCLE_STATES) {
      const plan = planLifecycle(state);
      expect(plan.revisions.map((revision) => revision.version)).toEqual(
        plan.revisions.map((_, index) => index + 1),
      );
    }
  });

  it("only ever points the parent at a revision that exists", () => {
    for (const state of MOCKUP_LIFECYCLE_STATES) {
      const plan = planLifecycle(state);
      const versions = plan.revisions.map((revision) => revision.version);

      if (plan.publishedVersion !== null) {
        expect(versions).toContain(plan.publishedVersion);
      }
      if (plan.workingVersion !== null) {
        expect(versions).toContain(plan.workingVersion);
      }
    }
  });

  it("marks at most one revision live, and never for an archived record", () => {
    for (const state of MOCKUP_LIFECYCLE_STATES) {
      const plan = planLifecycle(state);
      const live = plan.revisions.filter((revision) => revision.live);

      expect(live.length).toBeLessThanOrEqual(1);
      if (plan.archived || plan.deleted) expect(live).toHaveLength(0);
      // A live revision is always the one the parent publishes.
      if (live.length === 1) {
        expect(live[0].version).toBe(plan.publishedVersion);
      }
    }
  });

  it("treats a published, unarchived record as publicly listed", () => {
    expect(isLivePublished(planLifecycle("PUBLISHED"))).toBe(true);
    expect(isLivePublished(planLifecycle("PUBLISHED_WITH_DRAFT"))).toBe(true);
    expect(isLivePublished(planLifecycle("SUPERSEDED"))).toBe(true);
    expect(isLivePublished(planLifecycle("ARCHIVED"))).toBe(false);
    expect(isLivePublished(planLifecycle("DRAFT"))).toBe(false);
    expect(isLivePublished(planLifecycle("DELETED_DRAFT"))).toBe(false);
  });

  it("keeps a superseded revision out of the parent pointers", () => {
    const plan = planLifecycle("SUPERSEDED");

    expect(plan.publishedVersion).toBe(2);
    expect(plan.workingVersion).toBeNull();
    expect(plan.revisions[0].status).toBe("SUPERSEDED");
  });

  it("models a republish request as archived plus a working in-review revision", () => {
    const plan = planLifecycle("ARCHIVED_REPUBLISH_REQUEST");

    expect(plan.archived).toBe(true);
    expect(plan.publishedVersion).toBe(1);
    expect(plan.workingVersion).toBe(2);
    expect(plan.revisions[1].status).toBe("IN_REVIEW");
  });

  it("never submits a plain draft and always submits anything past it", () => {
    for (const state of MOCKUP_LIFECYCLE_STATES) {
      for (const revision of planLifecycle(state).revisions) {
        expect(revision.submitted).toBe(revision.status !== "DRAFT");
      }
    }
  });
});

describe("planLifecycleAuditEvents", () => {
  it("always opens with the creation event", () => {
    for (const state of MOCKUP_LIFECYCLE_STATES) {
      const events = planLifecycleAuditEvents(planLifecycle(state));
      expect(events[0]).toEqual({ kind: "CREATED" });
    }
  });

  it("records archiving after the publish it archives", () => {
    const events = planLifecycleAuditEvents(planLifecycle("ARCHIVED"));
    const publishedAt = events.findIndex((event) => event.kind === "PUBLISHED");
    const archivedAt = events.findIndex((event) => event.kind === "ARCHIVED");

    expect(publishedAt).toBeGreaterThan(-1);
    expect(archivedAt).toBeGreaterThan(publishedAt);
  });

  it("archives before the republish request is submitted", () => {
    const events = planLifecycleAuditEvents(
      planLifecycle("ARCHIVED_REPUBLISH_REQUEST"),
    );
    const archivedAt = events.findIndex((event) => event.kind === "ARCHIVED");
    const republishAt = events.findIndex(
      (event) => event.kind === "SUBMITTED" && event.version === 2,
    );

    expect(archivedAt).toBeGreaterThan(-1);
    expect(republishAt).toBeGreaterThan(archivedAt);
  });

  it("supersedes version 1 only after version 2 is published", () => {
    const events = planLifecycleAuditEvents(planLifecycle("SUPERSEDED"));
    const secondPublishAt = events.findIndex(
      (event) => event.kind === "PUBLISHED" && event.version === 2,
    );
    const supersededAt = events.findIndex((event) => event.kind === "SUPERSEDED");

    expect(secondPublishAt).toBeGreaterThan(-1);
    expect(supersededAt).toBeGreaterThan(secondPublishAt);
  });

  it("records a deletion last", () => {
    const events = planLifecycleAuditEvents(planLifecycle("DELETED_DRAFT"));

    expect(events.at(-1)).toEqual({ kind: "DELETED", version: 1 });
  });

  it("only references revisions the plan creates", () => {
    for (const state of MOCKUP_LIFECYCLE_STATES) {
      const plan = planLifecycle(state);
      const versions = plan.revisions.map((revision) => revision.version);

      for (const event of planLifecycleAuditEvents(plan)) {
        if ("version" in event) expect(versions).toContain(event.version);
      }
    }
  });
});
