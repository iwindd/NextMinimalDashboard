import { requireOwnAuditLogs } from "../authorization";
import type { AuditLogListQuery, AuditLogListResult } from "../types";
import { runAuditLogListQuery } from "./audit-log-query";

/**
 * Timeline of the signed-in user. The scope always comes from the session, so
 * a caller cannot widen it through query input.
 */
export async function getOwnAuditLogList(
  query: AuditLogListQuery,
): Promise<AuditLogListResult> {
  const actor = await requireOwnAuditLogs();

  return runAuditLogListQuery(query, { kind: "user", userId: actor.id });
}
