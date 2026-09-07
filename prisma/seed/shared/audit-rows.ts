import type {
  AuditAction,
  AuditResourceType,
  Prisma,
  UserRole,
} from "@prisma/client";
import {
  type LifecycleAuditEvent,
  type LifecyclePlan,
  planLifecycleAuditEvents,
} from "./lifecycle";

export type LifecycleAuditActions = Record<
  LifecycleAuditEvent["kind"],
  AuditAction
>;

type Actor = { id: string; role: UserRole };

/**
 * Turns a lifecycle plan into the audit trail it would have produced, so seeded
 * records have a believable history in the audit log viewer and in the admin
 * notification counts.
 *
 * The author records the events they can perform and the Admin records the review
 * decisions, matching the real authorization rules.
 */
export function buildLifecycleAuditRows(input: {
  plan: LifecyclePlan;
  resourceId: string;
  resourceType: AuditResourceType;
  actions: LifecycleAuditActions;
  author: Actor;
  admin: Actor;
  /** Revision id by version, for the `after.revisionId` reference. */
  revisionIds: Map<number, string>;
  requestContext: { requestId: string; ipHash: null; userAgent: string };
  reviewReason: string;
  archiveNote?: string;
  deleteReason?: string;
  /** The first event's timestamp; later events are spaced a minute apart. */
  startedAt: Date;
  archivedAt: Date | null;
  deletedAt: Date | null;
}): Prisma.AuditLogCreateManyInput[] {
  const events = planLifecycleAuditEvents(input.plan);

  return events.map((event, order) => {
    const createdAt = new Date(input.startedAt.getTime() + order * 60_000);
    const revisionId =
      "version" in event ? input.revisionIds.get(event.version) : undefined;
    const shared = {
      action: input.actions[event.kind],
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      createdAt,
      ...input.requestContext,
    };

    switch (event.kind) {
      case "CREATED":
        return {
          ...shared,
          actorUserId: input.author.id,
          actorRole: input.author.role,
          after: { status: "DRAFT" },
        };
      case "SUBMITTED":
        return {
          ...shared,
          actorUserId: input.author.id,
          actorRole: input.author.role,
          after: { revisionId, status: "IN_REVIEW" },
        };
      case "CHANGES_REQUESTED":
        return {
          ...shared,
          actorUserId: input.admin.id,
          actorRole: input.admin.role,
          after: { revisionId, status: "CHANGES_REQUESTED" },
          reason: input.reviewReason,
        };
      case "PUBLISHED":
        return {
          ...shared,
          actorUserId: input.admin.id,
          actorRole: input.admin.role,
          after: { revisionId, status: "PUBLISHED" },
        };
      case "SUPERSEDED":
        return {
          ...shared,
          actorUserId: input.admin.id,
          actorRole: input.admin.role,
          before: { revisionId, status: "PUBLISHED" },
          after: { revisionId, status: "SUPERSEDED" },
        };
      case "ARCHIVED":
        return {
          ...shared,
          actorUserId: input.admin.id,
          actorRole: input.admin.role,
          reason: input.archiveNote,
          after: {
            archived: true,
            archivedAt: input.archivedAt?.toISOString(),
            revisionId,
            ...(input.archiveNote ? { note: input.archiveNote } : {}),
          },
        };
      case "DELETED":
        return {
          ...shared,
          actorUserId: input.author.id,
          actorRole: input.author.role,
          reason: input.deleteReason,
          after: {
            deleted: true,
            deletedAt: input.deletedAt?.toISOString(),
            revisionId,
          },
        };
    }
  });
}
