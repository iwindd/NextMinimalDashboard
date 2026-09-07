import { requireViewAllAuditLogs } from "../authorization";
import type { AuditLogExportFile } from "../types";
import { buildAuditLogExport } from "./audit-log-export";

/** Downloads any audit record. Administrators only. */
export async function exportAuditLog(
  auditLogId: string,
): Promise<AuditLogExportFile> {
  const actor = await requireViewAllAuditLogs();

  return buildAuditLogExport({ auditLogId, actor });
}
