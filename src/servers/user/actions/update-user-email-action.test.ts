import { Prisma, UserRole } from "@prisma/client";
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
    createAuditLog: transaction.createAuditLog,
    createUserSecurityLog: transaction.userSecurityLog.createLog,
  };
});

vi.mock("../authorization", () => ({
  requireManageUsers: mocks.requireManageUsers,
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.runTransaction } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateUserEmailAction } from "./update-user-email-action";

const actorId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const existingUser = {
  id: targetId,
  name: "Editor User",
  email: "old@example.com",
  role: "EDITOR" as const,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};
const updatedUser = { ...existingUser, email: "new@example.com" };

describe("updateUserEmailAction", () => {
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

    const result = await updateUserEmailAction({
      userId: targetId,
      email: "new@example.com",
    });

    expect(result.serverError).toEqual({
      code: "NOT_FOUND",
      message: "ไม่พบผู้ใช้งาน",
    });
  });

  it("returns a field error when the email conflicts", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue({ id: targetId });
    mocks.transaction.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const result = await updateUserEmailAction({
      userId: targetId,
      email: "used@example.com",
    });

    expect(result.validationErrors?.fieldErrors.email).toEqual([
      "อีเมลนี้ถูกใช้งานแล้ว",
    ]);
  });

  it("updates the email and writes audit and security logs", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue(existingUser);
    mocks.transaction.user.update.mockResolvedValue(updatedUser);

    const result = await updateUserEmailAction({
      userId: targetId,
      email: "NEW@EXAMPLE.COM",
      reason: "แก้ไขอีเมลผู้ใช้งาน",
    });

    expect(result.data).toEqual({
      ...updatedUser,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "USER_EMAIL_CHANGED",
        reason: "แก้ไขอีเมลผู้ใช้งาน",
        before: { email: "old@example.com" },
        after: { email: "new@example.com" },
      }),
    );
    expect(mocks.createUserSecurityLog).toHaveBeenCalledWith(
      expect.objectContaining({ event: "EMAIL_CHANGED_BY_ADMIN" }),
    );
  });

  it("does not write audit data for a no-op email update", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue(existingUser);

    const result = await updateUserEmailAction({
      userId: targetId,
      email: existingUser.email,
    });

    expect(result.data).toBeDefined();
    expect(mocks.transaction.user.update).not.toHaveBeenCalled();
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
    expect(mocks.createUserSecurityLog).not.toHaveBeenCalled();
  });

  it("maps unexpected update failures to the safe internal error", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue(existingUser);
    mocks.transaction.user.update.mockRejectedValue(new Error("database down"));

    const result = await updateUserEmailAction({
      userId: targetId,
      email: "new@example.com",
    });

    expect(result.serverError).toEqual({
      code: "INTERNAL",
      message: "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง",
    });
  });
});
