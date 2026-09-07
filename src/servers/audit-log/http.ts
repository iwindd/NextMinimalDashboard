import { NextResponse } from "next/server";
import {
  AuditLogAuthorizationError,
  AuditLogNotFoundError,
} from "./exceptions";
import { listAuditLogsSchema } from "./queries/get-audit-log-list-schema";
import type { AuditLogExportFile, AuditLogListQuery } from "./types";

type ParsedAuditLogListRequest =
  | { success: true; query: AuditLogListQuery }
  | { success: false; response: NextResponse };

export function parseAuditLogListRequest(
  request: Request,
): ParsedAuditLogListRequest {
  const url = new URL(request.url);
  const parsed = listAuditLogsSchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );

  if (!parsed.success) {
    return {
      success: false,
      response: NextResponse.json(
        {
          message: "พารามิเตอร์การค้นหาไม่ถูกต้อง",
          issues: parsed.error.issues,
        },
        { status: 400 },
      ),
    };
  }

  return { success: true, query: parsed.data };
}

/** Maps known audit-log failures to a response, or null for unexpected errors. */
export function toAuditLogErrorResponse(error: unknown) {
  if (error instanceof AuditLogAuthorizationError) {
    return NextResponse.json({ message: error.message }, { status: 403 });
  }

  if (error instanceof AuditLogNotFoundError) {
    return NextResponse.json({ message: error.message }, { status: 404 });
  }

  return null;
}

export function createAuditLogExportResponse(file: AuditLogExportFile) {
  return new NextResponse(JSON.stringify(file, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${file.auditLog.id}.json"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
