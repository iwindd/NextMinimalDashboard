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
    hash: vi.fn(),
    createAuditLog: transaction.createAuditLog,
    createUserSecurityLog: transaction.userSecurityLog.createLog,
  };
});

vi.mock("../authorization", () => ({
  requireManageUsers: mocks.requireManageUsers,
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.runTransaction } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("bcryptjs", () => ({ hash: mocks.hash }));

import { updateUserPasswordAction } from "./update-user-password-action";

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

describe("updateUserPasswordAction", () => {
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
    mocks.hash.mockResolvedValue("password-hash");
  });

  it("returns not found when the target does not exist", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue(null);

    const result = await updateUserPasswordAction({
      userId: targetId,
      password: "new-password",
      passwordConfirmation: "new-password",
    });

    expect(result.serverError).toEqual({
      code: "NOT_FOUND",
      message: "ไม่พบผู้ใช้งาน",
    });
  });

  it("hashes, stores, and serializes the updated password result", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue({ id: targetId });
    mocks.transaction.user.update.mockResolvedValue(user);

    const result = await updateUserPasswordAction({
      userId: targetId,
      password: "new-password",
      passwordConfirmation: "new-password",
    });

    expect(result.data).toEqual({
      ...user,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(mocks.hash).toHaveBeenCalledWith("new-password", 12);
    expect(mocks.transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { passwordHash: "password-hash" } }),
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "USER_PASSWORD_RESET",
      }),
    );
    expect(mocks.createUserSecurityLog).toHaveBeenCalledWith(
      expect.objectContaining({ event: "PASSWORD_RESET_BY_ADMIN" }),
    );
  });

  it("rejects mismatched passwords before hashing or querying", async () => {
    const result = await updateUserPasswordAction({
      userId: targetId,
      password: "new-password",
      passwordConfirmation: "different-password",
    });

    expect(result.validationErrors?.fieldErrors.passwordConfirmation).toContain(
      "รหัสผ่านไม่ตรงกัน",
    );
    expect(mocks.hash).not.toHaveBeenCalled();
    expect(mocks.transaction.user.findUnique).not.toHaveBeenCalled();
  });

  it("maps unexpected update failures to the safe internal error", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue({ id: targetId });
    mocks.transaction.user.update.mockRejectedValue(new Error("database down"));

    const result = await updateUserPasswordAction({
      userId: targetId,
      password: "new-password",
      passwordConfirmation: "new-password",
    });

    expect(result.serverError).toEqual({
      code: "INTERNAL",
      message: "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง",
    });
  });
});
