import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  createAuditLog: vi.fn(),
  getRequestContext: vi.fn(),
  requireViewAllAuditLogs: vi.fn(),
  requireOwnAuditLogs: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: { findFirst: mocks.findFirst },
    createAuditLog: mocks.createAuditLog,
  },
}));
vi.mock("@/lib/audit/request-context", () => ({
  getRequestContext: mocks.getRequestContext,
}));
vi.mock("../authorization", () => ({
  requireViewAllAuditLogs: mocks.requireViewAllAuditLogs,
  requireOwnAuditLogs: mocks.requireOwnAuditLogs,
}));

import { AuditLogNotFoundError } from "../exceptions";
import { AUDIT_LOG_EXPORT_SELECT } from "../helpers";
import { exportAuditLog } from "./export-audit-log";
import { exportOwnAuditLog } from "./export-own-audit-log";

const adminId = "11111111-1111-4111-8111-111111111111";
const editorId = "22222222-2222-4222-8222-222222222222";
const auditLogId = "33333333-3333-4333-8333-333333333333";
const requestContext = {
  requestId: "request-id",
  ipHash: "ip-hash",
  userAgent: "vitest",
};
const record = {
  id: auditLogId,
  createdAt: new Date("2026-08-27T03:00:00.000Z"),
  action: "USER_NAME_CHANGED" as const,
  resourceType: "USER" as const,
  resourceId: editorId,
  actorUserId: adminId,
  actorRole: "ADMIN" as const,
  targetUserId: editorId,
  reason: "แก้ตามคำขอ",
  before: { name: "เดิม" },
  after: { name: "ใหม่" },
  metadata: { field: "name" },
  requestId: "request-id",
  ipHash: "ip-hash",
  userAgent: "vitest",
  actorUser: {
    id: adminId,
    email: "admin@example.com",
    name: "ผู้ดูแลระบบ",
    role: "ADMIN" as const,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-27T02:00:00.000Z"),
  },
  targetUser: {
    id: editorId,
    email: "editor@example.com",
    name: "ผู้แก้ไข",
    role: "EDITOR" as const,
    isActive: true,
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    updatedAt: new Date("2026-08-27T02:30:00.000Z"),
  },
};

describe("audit log export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequestContext.mockResolvedValue(requestContext);
    mocks.findFirst.mockResolvedValue(record);
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.requireViewAllAuditLogs.mockResolvedValue({
      id: adminId,
      role: "ADMIN",
      isActive: true,
    });
    mocks.requireOwnAuditLogs.mockResolvedValue({
      id: editorId,
      role: "EDITOR",
      isActive: true,
    });
  });

  it("returns the full row and direct user relations", async () => {
    const file = await exportAuditLog(auditLogId);

    expect(file.auditLog).toEqual({
      id: auditLogId,
      actorUserId: adminId,
      actorRole: "ADMIN",
      action: "USER_NAME_CHANGED",
      resourceType: "USER",
      resourceId: editorId,
      targetUserId: editorId,
      before: { name: "เดิม" },
      after: { name: "ใหม่" },
      metadata: { field: "name" },
      reason: "แก้ตามคำขอ",
      requestId: "request-id",
      ipHash: "ip-hash",
      userAgent: "vitest",
      createdAt: "2026-08-27T03:00:00.000Z",
      actorUser: {
        id: adminId,
        email: "admin@example.com",
        name: "ผู้ดูแลระบบ",
        role: "ADMIN",
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-08-27T02:00:00.000Z",
      },
      targetUser: {
        id: editorId,
        email: "editor@example.com",
        name: "ผู้แก้ไข",
        role: "EDITOR",
        isActive: true,
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-08-27T02:30:00.000Z",
      },
    });
    expect(JSON.stringify(file)).not.toContain("passwordHash");
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: auditLogId },
      select: AUDIT_LOG_EXPORT_SELECT,
    });
  });

  it("records the download as an audit event", async () => {
    await exportAuditLog(auditLogId);

    expect(mocks.createAuditLog).toHaveBeenCalledWith({
      actor: { id: adminId, role: "ADMIN" },
      target: { id: editorId },
      requestContext,
      action: "AUDIT_LOG_EXPORTED",
      resourceType: "AUDIT_LOG",
      resourceId: auditLogId,
      metadata: {
        exportedAction: "USER_NAME_CHANGED",
        exportedResourceType: "USER",
        exportedResourceId: editorId,
        includedBefore: true,
        includedAfter: true,
        includedMetadata: true,
        includedActorUser: true,
        includedTargetUser: true,
      },
    });
  });

  it("does not deliver a file when the download cannot be audited", async () => {
    mocks.createAuditLog.mockRejectedValue(new Error("audit unavailable"));

    await expect(exportAuditLog(auditLogId)).rejects.toThrow(
      "audit unavailable",
    );
  });

  it("throws when the record is out of reach", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(exportAuditLog(auditLogId)).rejects.toBeInstanceOf(
      AuditLogNotFoundError,
    );
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });

  it("limits a self-service download to the signed-in user's own records", async () => {
    await exportOwnAuditLog(auditLogId);

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        id: auditLogId,
        OR: [{ actorUserId: editorId }, { targetUserId: editorId }],
      },
      select: AUDIT_LOG_EXPORT_SELECT,
    });
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ actor: { id: editorId, role: "EDITOR" } }),
    );
  });

  it.each([
    ["system-wide", () => exportAuditLog(auditLogId), mocks.requireViewAllAuditLogs],
    ["own", () => exportOwnAuditLog(auditLogId), mocks.requireOwnAuditLogs],
  ])("does not read %s records when authorization fails", async (_label, run, guard) => {
    guard.mockRejectedValue(new Error("unauthorized"));

    await expect(run()).rejects.toThrow("unauthorized");
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("flags missing snapshots in the export metadata", async () => {
    mocks.findFirst.mockResolvedValue({ ...record, before: null, after: null });

    const file = await exportAuditLog(auditLogId);

    expect(file.auditLog.before).toBeNull();
    expect(file.auditLog.after).toBeNull();
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          includedBefore: false,
          includedAfter: false,
        }),
      }),
    );
  });
});
