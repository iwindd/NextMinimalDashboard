import { Prisma } from "@prisma/client";
import type { DatatableSearchConfig } from "@/lib/prisma-extensions/datatable.types";
import type { AuditLogListItem, AuditLogUserSummary } from "./types";

const AUDIT_LOG_USER_SELECT = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;

/**
 * `before`/`after` are selected to derive availability flags only. Snapshot
 * bodies are never returned to the browser by list endpoints.
 */
export const AUDIT_LOG_LIST_SELECT = {
  id: true,
  createdAt: true,
  action: true,
  resourceType: true,
  resourceId: true,
  actorRole: true,
  reason: true,
  before: true,
  after: true,
  actorUser: { select: AUDIT_LOG_USER_SELECT },
  targetUser: { select: AUDIT_LOG_USER_SELECT },
} satisfies Prisma.AuditLogSelect;

// Keep the relation useful without exposing the user's password hash.
const AUDIT_LOG_EXPORT_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const AUDIT_LOG_EXPORT_SELECT = {
  id: true,
  createdAt: true,
  action: true,
  resourceType: true,
  resourceId: true,
  actorUserId: true,
  actorRole: true,
  targetUserId: true,
  reason: true,
  before: true,
  after: true,
  metadata: true,
  requestId: true,
  ipHash: true,
  userAgent: true,
  actorUser: { select: AUDIT_LOG_EXPORT_USER_SELECT },
  targetUser: { select: AUDIT_LOG_EXPORT_USER_SELECT },
} satisfies Prisma.AuditLogSelect;

export const AUDIT_LOG_SEARCHABLE: DatatableSearchConfig = {
  resourceId: { mode: "insensitive" },
  reason: { mode: "insensitive" },
  actorUser: {
    name: { mode: "insensitive" },
    email: { mode: "insensitive" },
  },
  targetUser: {
    name: { mode: "insensitive" },
    email: { mode: "insensitive" },
  },
};

function toUserSummary(
  user: { id: string; name: string; email: string } | null,
): AuditLogUserSummary | null {
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}

function hasSnapshot(value: Prisma.JsonValue | null) {
  return value !== null && value !== undefined;
}

export function toAuditLogListItem(row: {
  id: string;
  createdAt: Date;
  action: AuditLogListItem["action"];
  resourceType: AuditLogListItem["resourceType"];
  resourceId: string | null;
  actorRole: AuditLogListItem["actorRole"];
  reason: string | null;
  before: Prisma.JsonValue | null;
  after: Prisma.JsonValue | null;
  actorUser: { id: string; name: string; email: string } | null;
  targetUser: { id: string; name: string; email: string } | null;
}): AuditLogListItem {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    actorRole: row.actorRole,
    actor: toUserSummary(row.actorUser),
    target: toUserSummary(row.targetUser),
    reason: row.reason,
    hasBefore: hasSnapshot(row.before),
    hasAfter: hasSnapshot(row.after),
  };
}
