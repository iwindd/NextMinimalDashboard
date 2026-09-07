import { Prisma, UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    user: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    createAuditLog: vi.fn(),
    userSecurityLog: { createLog: vi.fn() },
  };
  return {
    requireManageUsers: vi.fn(),
    transaction,
    runTransaction: vi.fn(),
    createAuditLog: transaction.createAuditLog,
    createUserSecurityLog: transaction.userSecurityLog.createLog,
  };
});

vi.mock("../authorization", () => ({
  requireManageUsers: mocks.requireManageUsers,
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.runTransaction } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { setUserStatusAction } from "./set-user-status-action";

const actorId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const user = {
  id: targetId,
  name: "Editor User",
  email: "editor@example.com",
  role: "EDITOR" as const,
  isActive: false,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

describe("setUserStatusAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireManageUsers.mockResolvedValue({
      id: actorId,
      role: UserRole.ADMIN,
      isActive: true,
    });
    mocks.runTransaction.mockImplementation(
      (operation: (client: typeof mocks.transaction) => Promise<unknown>) =>
        operation(mocks.transaction),
    );
  });

  it("returns not found when the target does not exist", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue(null);

    const result = await setUserStatusAction({
      userId: targetId,
      isActive: false,
    });

    expect(result.serverError).toEqual({
      code: "NOT_FOUND",
      message: "ไม่พบผู้ใช้งาน",
    });
  });

  it("prevents the actor from disabling their own account", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue({
      id: actorId,
      role: UserRole.ADMIN,
      isActive: true,
    });

    const result = await setUserStatusAction({
      userId: actorId,
      isActive: false,
    });

    expect(result.serverError).toEqual({
      code: "POLICY",
      message: "ไม่สามารถปิดใช้งานบัญชีของตนเองได้",
    });
  });

  it("keeps at least one active admin", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue({
      id: targetId,
      role: UserRole.ADMIN,
      isActive: true,
    });
    mocks.transaction.user.count.mockResolvedValue(0);

    const result = await setUserStatusAction({
      userId: targetId,
      isActive: false,
    });

    expect(result.serverError).toEqual({
      code: "POLICY",
      message: "ต้องมีผู้ดูแลระบบที่เปิดใช้งานอยู่อย่างน้อยหนึ่งคน",
    });
  });

  it("updates and serializes an editor's status", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue({
      id: targetId,
      role: UserRole.EDITOR,
      isActive: true,
    });
    mocks.transaction.user.update.mockResolvedValue(user);

    const result = await setUserStatusAction({
      userId: targetId,
      isActive: false,
    });

    expect(result.data).toEqual({
      ...user,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(mocks.runTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    expect(mocks.transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "USER_STATUS_CHANGED",
        before: { isActive: true },
        after: { isActive: false },
      }),
    );
    expect(mocks.createUserSecurityLog).toHaveBeenCalledWith(
      expect.objectContaining({ event: "ACCOUNT_DISABLED" }),
    );
  });

  it("records the enabled event when reactivating an editor", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue({
      ...user,
      isActive: false,
    });
    mocks.transaction.user.update.mockResolvedValue({
      ...user,
      isActive: true,
    });

    const result = await setUserStatusAction({
      userId: targetId,
      isActive: true,
    });

    expect(result.data).toMatchObject({ id: targetId, isActive: true });
    expect(mocks.transaction.user.count).not.toHaveBeenCalled();
    expect(mocks.createUserSecurityLog).toHaveBeenCalledWith(
      expect.objectContaining({ event: "ACCOUNT_ENABLED" }),
    );
  });

  it("does not write audit data for a no-op status update", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue(user);

    const result = await setUserStatusAction({
      userId: targetId,
      isActive: false,
    });

    expect(result.data).toBeDefined();
    expect(mocks.transaction.user.update).not.toHaveBeenCalled();
    expect(mocks.transaction.user.count).not.toHaveBeenCalled();
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
    expect(mocks.createUserSecurityLog).not.toHaveBeenCalled();
  });

  it("maps unexpected update failures to the safe internal error", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue({
      ...user,
      isActive: true,
    });
    mocks.transaction.user.update.mockRejectedValue(new Error("database down"));

    const result = await setUserStatusAction({
      userId: targetId,
      isActive: false,
    });

    expect(result.serverError).toEqual({
      code: "INTERNAL",
      message: "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง",
    });
  });
});
