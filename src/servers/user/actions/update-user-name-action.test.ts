import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    user: { findUnique: vi.fn(), update: vi.fn() },
    createAuditLog: vi.fn(),
    userSecurityLog: { createLog: vi.fn() },
  };
  return {
    requireManageUsers: vi.fn(),
    transaction,
    runTransaction: vi.fn(),
    revalidatePath: vi.fn(),
    createAuditLog: transaction.createAuditLog,
    createUserSecurityLog: transaction.userSecurityLog.createLog,
  };
});

vi.mock("../authorization", () => ({
  requireManageUsers: mocks.requireManageUsers,
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.runTransaction } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { UserAuthorizationError } from "../exceptions";
import { updateUserNameAction } from "./update-user-name-action";

const actorId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const user = {
  id: targetId,
  name: "New name",
  email: "editor@example.com",
  role: "EDITOR" as const,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};
const existingUser = { ...user, name: "Old name" };

describe("updateUserNameAction", () => {
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

  it("maps authorization failures to an unauthorized result", async () => {
    mocks.requireManageUsers.mockRejectedValue(new UserAuthorizationError());

    const result = await updateUserNameAction({
      userId: targetId,
      name: "New name",
    });

    expect(result.serverError).toEqual({
      code: "UNAUTHORIZED",
      message: "คุณไม่มีสิทธิ์จัดการผู้ใช้งาน",
    });
  });

  it("returns not found when the target does not exist", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue(null);

    const result = await updateUserNameAction({
      userId: targetId,
      name: "New name",
    });

    expect(result.serverError).toEqual({
      code: "NOT_FOUND",
      message: "ไม่พบผู้ใช้งาน",
    });
  });

  it("updates, serializes, and revalidates the name", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue(existingUser);
    mocks.transaction.user.update.mockResolvedValue(user);

    const result = await updateUserNameAction({
      userId: targetId,
      name: " New name ",
    });

    expect(result.data).toEqual({
      ...user,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(mocks.transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: "New name" } }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/admin/users/${targetId}/profile`,
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "USER_NAME_CHANGED",
        before: { name: "Old name" },
        after: { name: "New name" },
      }),
    );
    expect(mocks.createUserSecurityLog).toHaveBeenCalledWith(
      expect.objectContaining({ event: "NAME_CHANGED_BY_ADMIN" }),
    );
  });

  it("does not write an audit log for a no-op update", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue({ ...user });

    const result = await updateUserNameAction({
      userId: targetId,
      name: "New name",
    });

    expect(result.data).toBeDefined();
    expect(mocks.transaction.user.update).not.toHaveBeenCalled();
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });

  it("maps unexpected server failures to the safe internal error", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue(existingUser);
    mocks.transaction.user.update.mockRejectedValue(new Error("database down"));

    const result = await updateUserNameAction({
      userId: targetId,
      name: "Another name",
    });

    expect(result.serverError).toEqual({
      code: "INTERNAL",
      message: "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง",
    });
  });

  it("maps authorization infrastructure failures to the safe internal error", async () => {
    mocks.requireManageUsers.mockRejectedValue(new Error("auth service down"));

    const result = await updateUserNameAction({
      userId: targetId,
      name: "New name",
    });

    expect(result.serverError).toEqual({
      code: "INTERNAL",
      message: "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง",
    });
  });
});
