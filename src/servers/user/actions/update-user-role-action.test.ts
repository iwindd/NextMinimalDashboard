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

import { updateUserRoleAction } from "./update-user-role-action";

const actorId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const user = {
  id: targetId,
  name: "Editor User",
  email: "editor@example.com",
  role: "EDITOR" as const,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

describe("updateUserRoleAction", () => {
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

    const result = await updateUserRoleAction({
      userId: targetId,
      role: UserRole.EDITOR,
    });

    expect(result.serverError).toEqual({
      code: "NOT_FOUND",
      message: "ไม่พบผู้ใช้งาน",
    });
  });

  it("prevents the actor from demoting their own account", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue({
      id: actorId,
      role: UserRole.ADMIN,
      isActive: true,
    });

    const result = await updateUserRoleAction({
      userId: actorId,
      role: UserRole.EDITOR,
    });

    expect(result.serverError).toEqual({
      code: "POLICY",
      message: "ไม่สามารถลดสิทธิ์ของบัญชีที่กำลังใช้งานได้",
    });
  });

  it("keeps at least one active admin", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue({
      id: targetId,
      role: UserRole.ADMIN,
      isActive: true,
    });
    mocks.transaction.user.count.mockResolvedValue(0);

    const result = await updateUserRoleAction({
      userId: targetId,
      role: UserRole.EDITOR,
    });

    expect(result.serverError).toEqual({
      code: "POLICY",
      message: "ต้องมีผู้ดูแลระบบที่เปิดใช้งานอยู่อย่างน้อยหนึ่งคน",
    });
  });

  it("updates the role when another active admin remains", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue({
      id: targetId,
      role: UserRole.ADMIN,
      isActive: true,
    });
    mocks.transaction.user.count.mockResolvedValue(1);
    mocks.transaction.user.update.mockResolvedValue(user);

    const result = await updateUserRoleAction({
      userId: targetId,
      role: UserRole.EDITOR,
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
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "USER_ROLE_CHANGED",
        before: { role: UserRole.ADMIN },
        after: { role: UserRole.EDITOR },
      }),
    );
    expect(mocks.createUserSecurityLog).toHaveBeenCalledWith(
      expect.objectContaining({ event: "ROLE_CHANGED" }),
    );
  });

  it("does not write audit data for a no-op role update", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue({
      ...user,
      role: UserRole.EDITOR,
    });

    const result = await updateUserRoleAction({
      userId: targetId,
      role: UserRole.EDITOR,
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
      role: UserRole.ADMIN,
    });
    mocks.transaction.user.count.mockResolvedValue(1);
    mocks.transaction.user.update.mockRejectedValue(new Error("database down"));

    const result = await updateUserRoleAction({
      userId: targetId,
      role: UserRole.EDITOR,
    });

    expect(result.serverError).toEqual({
      code: "INTERNAL",
      message: "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง",
    });
  });
});
