import { exportOwnAuditLog } from "@/servers/audit-log/exports/export-own-audit-log";
import {
  createAuditLogExportResponse,
  toAuditLogErrorResponse,
} from "@/servers/audit-log/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ auditLogId: string }> },
) {
  try {
    const { auditLogId } = await params;

    return createAuditLogExportResponse(await exportOwnAuditLog(auditLogId));
  } catch (error) {
    const response = toAuditLogErrorResponse(error);
    if (response) return response;

    throw error;
  }
}
