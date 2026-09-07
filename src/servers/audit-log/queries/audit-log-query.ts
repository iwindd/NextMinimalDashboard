import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  AUDIT_LOG_LIST_SELECT,
  AUDIT_LOG_SEARCHABLE,
  toAuditLogListItem,
} from "../helpers";
import type { AuditLogListQuery, AuditLogListResult } from "../types";

/** Asia/Bangkok has no daylight saving, so a fixed offset is exact. */
const BANGKOK_UTC_OFFSET = "+07:00";

export type AuditLogScope =
  | { kind: "all" }
  | { kind: "user"; userId: string };

function toRangeStart(from?: string) {
  return from ? new Date(`${from}T00:00:00.000${BANGKOK_UTC_OFFSET}`) : undefined;
}

function toRangeEnd(to?: string) {
  return to ? new Date(`${to}T23:59:59.999${BANGKOK_UTC_OFFSET}`) : undefined;
}

function buildScopeWhere(
  scope: AuditLogScope,
  relationship: AuditLogListQuery["relationship"],
): Prisma.AuditLogWhereInput {
  if (scope.kind === "all") return {};
  if (relationship === "actor") return { actorUserId: scope.userId };
  if (relationship === "target") return { targetUserId: scope.userId };

  return {
    OR: [{ actorUserId: scope.userId }, { targetUserId: scope.userId }],
  };
}

export function buildAuditLogWhere(
  query: AuditLogListQuery,
  scope: AuditLogScope,
): Prisma.AuditLogWhereInput {
  const createdAtFrom = toRangeStart(query.from);
  const createdAtTo = toRangeEnd(query.to);

  return {
    ...buildScopeWhere(scope, query.relationship),
    ...(query.actions?.length ? { action: { in: query.actions } } : {}),
    ...(query.resourceTypes?.length
      ? { resourceType: { in: query.resourceTypes } }
      : {}),
    ...(query.actorRole ? { actorRole: query.actorRole } : {}),
    ...(createdAtFrom || createdAtTo
      ? {
          createdAt: {
            ...(createdAtFrom ? { gte: createdAtFrom } : {}),
            ...(createdAtTo ? { lte: createdAtTo } : {}),
          },
        }
      : {}),
  };
}

/**
 * Shared reader for every audit timeline. Callers are responsible for
 * authorizing the request and for deciding the scope; the scope is never
 * derived from raw query input.
 */
export async function runAuditLogListQuery(
  query: AuditLogListQuery,
  scope: AuditLogScope,
): Promise<AuditLogListResult> {
  const result = await prisma.auditLog.getDatatable({
    // Sorting is intentionally fixed to the timeline so pagination stays stable.
    query: { ...query, sortBy: undefined },
    select: AUDIT_LOG_LIST_SELECT,
    searchable: AUDIT_LOG_SEARCHABLE,
    where: buildAuditLogWhere(query, scope),
    defaultOrderBy: [
      { createdAt: query.sortDirection },
      { id: query.sortDirection },
    ],
  });

  return {
    data: result.data.map(toAuditLogListItem),
    total: result.total,
  };
}
