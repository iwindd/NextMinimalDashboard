import { requireOwnAuditLogs } from "../authorization";
import type { AuditLogExportFile } from "../types";
import { buildAuditLogExport } from "./audit-log-export";

/**
 * Downloads an audit record from the signed-in user's own timeline. The scope
 * filter is derived from the session so other users' records stay unreachable.
 */
export async function exportOwnAuditLog(
  auditLogId: string,
): Promise<AuditLogExportFile> {
  const actor = await requireOwnAuditLogs();

  return buildAuditLogExport({
    auditLogId,
    actor,
    scopeWhere: {
      OR: [{ actorUserId: actor.id }, { targetUserId: actor.id }],
    },
  });
}
