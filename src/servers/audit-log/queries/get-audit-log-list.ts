import { requireViewAllAuditLogs } from "../authorization";
import type { AuditLogListQuery, AuditLogListResult } from "../types";
import { runAuditLogListQuery } from "./audit-log-query";

/** System-wide timeline. Administrators only. */
export async function getAuditLogList(
  query: AuditLogListQuery,
): Promise<AuditLogListResult> {
  await requireViewAllAuditLogs();

  return runAuditLogListQuery(query, { kind: "all" });
}
