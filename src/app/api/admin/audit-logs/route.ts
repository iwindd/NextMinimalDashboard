import {
  parseAuditLogListRequest,
  toAuditLogErrorResponse,
} from "@/servers/audit-log/http";
import { getAuditLogList } from "@/servers/audit-log/queries/get-audit-log-list";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parsedQuery = parseAuditLogListRequest(request);
  if (!parsedQuery.success) return parsedQuery.response;

  try {
    return NextResponse.json(await getAuditLogList(parsedQuery.query));
  } catch (error) {
    const response = toAuditLogErrorResponse(error);
    if (response) return response;

    throw error;
  }
}
