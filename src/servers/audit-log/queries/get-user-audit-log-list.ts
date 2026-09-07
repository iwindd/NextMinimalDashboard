import { z } from "zod";
import { requireViewAllAuditLogs } from "../authorization";
import type { AuditLogListQuery, AuditLogListResult } from "../types";
import { runAuditLogListQuery } from "./audit-log-query";

const userIdSchema = z.uuid();

/**
 * Timeline of a managed user: everything they did plus everything done to
 * their account. Administrators only.
 */
export async function getUserAuditLogList(
  userId: string,
  query: AuditLogListQuery,
): Promise<AuditLogListResult> {
  await requireViewAllAuditLogs();

  const parsedUserId = userIdSchema.safeParse(userId);
  if (!parsedUserId.success) {
    return { data: [], total: 0 };
  }

  return runAuditLogListQuery(query, {
    kind: "user",
    userId: parsedUserId.data,
  });
}
