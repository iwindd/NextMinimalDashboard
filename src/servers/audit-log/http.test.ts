import { describe, expect, it } from "vitest";
import {
  AuditLogAuthorizationError,
  AuditLogNotFoundError,
} from "./exceptions";
import {
  createAuditLogExportResponse,
  parseAuditLogListRequest,
  toAuditLogErrorResponse,
} from "./http";
import type { AuditLogExportFile } from "./types";

const auditLogId = "33333333-3333-4333-8333-333333333333";

const exportFile: AuditLogExportFile = {
  exportedAt: "2026-08-27T04:00:00.000Z",
  auditLog: {
    id: auditLogId,
    actorUserId: null,
    actorRole: null,
    action: "USER_NAME_CHANGED",
    resourceType: "USER",
    resourceId: auditLogId,
    targetUserId: null,
    before: { name: "เดิม" },
    after: { name: "ใหม่" },
    metadata: { field: "name" },
    reason: null,
    requestId: "request-id",
    ipHash: null,
    userAgent: null,
    createdAt: "2026-08-27T03:00:00.000Z",
    actorUser: null,
    targetUser: null,
  },
};

describe("parseAuditLogListRequest", () => {
  it("accepts a valid query", () => {
    const parsed = parseAuditLogListRequest(
      new Request("https://simple-dashboard.test/api/admin/audit-logs?pageSize=50"),
    );

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.query.pageSize).toBe(50);
  });

  it("rejects an invalid query with 400", async () => {
    const parsed = parseAuditLogListRequest(
      new Request("https://simple-dashboard.test/api/admin/audit-logs?from=2026-13-01"),
    );

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.response.status).toBe(400);
      await expect(parsed.response.json()).resolves.toMatchObject({
        message: "พารามิเตอร์การค้นหาไม่ถูกต้อง",
      });
    }
  });
});

describe("toAuditLogErrorResponse", () => {
  it("maps authorization failures to 403", () => {
    expect(toAuditLogErrorResponse(new AuditLogAuthorizationError())?.status).toBe(
      403,
    );
  });

  it("maps missing records to 404", () => {
    expect(toAuditLogErrorResponse(new AuditLogNotFoundError())?.status).toBe(404);
  });

  it("leaves unexpected errors to the caller", () => {
    expect(toAuditLogErrorResponse(new Error("boom"))).toBeNull();
  });
});

describe("createAuditLogExportResponse", () => {
  it("delivers a private JSON attachment", async () => {
    const response = createAuditLogExportResponse(exportFile);

    expect(response.headers.get("Content-Type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      `attachment; filename="audit-log-${auditLogId}.json"`,
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    await expect(response.json()).resolves.toEqual(exportFile);
  });
});
