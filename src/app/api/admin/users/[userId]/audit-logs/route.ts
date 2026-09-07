import {
  parseAuditLogListRequest,
  toAuditLogErrorResponse,
} from "@/servers/audit-log/http";
import { getUserAuditLogList } from "@/servers/audit-log/queries/get-user-audit-log-list";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const parsedQuery = parseAuditLogListRequest(request);
  if (!parsedQuery.success) return parsedQuery.response;

  try {
    const { userId } = await params;

    return NextResponse.json(
      await getUserAuditLogList(userId, parsedQuery.query),
    );
  } catch (error) {
    const response = toAuditLogErrorResponse(error);
    if (response) return response;

    throw error;
  }
}
