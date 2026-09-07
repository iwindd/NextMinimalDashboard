import { exportAuditLog } from "@/servers/audit-log/exports/export-audit-log";
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

    return createAuditLogExportResponse(await exportAuditLog(auditLogId));
  } catch (error) {
    const response = toAuditLogErrorResponse(error);
    if (response) return response;

    throw error;
  }
}
