import { Prisma, UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    user: { create: vi.fn() },
    createAuditLog: vi.fn(),
    userSecurityLog: { createLog: vi.fn() },
  };

  return {
    requireManageUsers: vi.fn(),
    create: vi.fn(),
    runTransaction: vi.fn(),
    transaction,
    createAuditLog: transaction.createAuditLog,
    createUserSecurityLog: transaction.userSecurityLog.createLog,
    revalidatePath: vi.fn(),
    hash: vi.fn(),
  };
});

vi.mock("../authorization", () => ({
  requireManageUsers: mocks.requireManageUsers,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { create: mocks.create },
    $transaction: mocks.runTransaction,
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("bcryptjs", () => ({ hash: mocks.hash }));

import { createUserAction } from "./create-user-action";

const actorId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const createdUser = {
  id: targetId,
  name: "Editor User",
  email: "editor@example.com",
  role: UserRole.EDITOR,
  isActive: true,
};

describe("createUserAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireManageUsers.mockResolvedValue({
      id: actorId,
      role: UserRole.ADMIN,
      isActive: true,
    });
    mocks.hash.mockResolvedValue("password-hash");
    mocks.runTransaction.mockImplementation(
      (operation: (client: typeof mocks.transaction) => Promise<unknown>) =>
        operation(mocks.transaction),
    );
    mocks.transaction.user.create = mocks.create;
  });

  it("validates input before hashing or writing", async () => {
    const result = await createUserAction({
      name: "",
      email: "invalid-email",
      password: "short",
      passwordConfirmation: "different",
      role: UserRole.EDITOR,
    });

    expect(result.validationErrors?.fieldErrors).toMatchObject({
      name: ["กรุณากรอกชื่อผู้ใช้งาน"],
      email: ["กรุณากรอกอีเมลให้ถูกต้อง"],
      password: ["รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"],
      passwordConfirmation: ["รหัสผ่านไม่ตรงกัน"],
    });
    expect(mocks.hash).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("hashes, creates, and revalidates a user", async () => {
    mocks.create.mockResolvedValue(createdUser);

    const result = await createUserAction({
      name: "  Editor User  ",
      email: "EDITOR@EXAMPLE.COM",
      password: "password-123",
      passwordConfirmation: "password-123",
      role: UserRole.EDITOR,
    });

    expect(result.data).toEqual({ id: targetId });
    expect(mocks.hash).toHaveBeenCalledWith("password-123", 12);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: "Editor User",
          email: "editor@example.com",
          passwordHash: "password-hash",
          role: UserRole.EDITOR,
        },
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/users");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/admin/users/${targetId}/profile`,
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "USER_CREATED",
        resourceId: targetId,
        target: expect.objectContaining({ id: targetId }),
      }),
    );
    expect(mocks.createUserSecurityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "ACCOUNT_CREATED",
        source: "ADMIN",
        outcome: "SUCCESS",
        target: {
          id: targetId,
          name: "Editor User",
          email: "editor@example.com",
          role: UserRole.EDITOR,
        },
      }),
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        after: {
          name: "Editor User",
          email: "editor@example.com",
          role: UserRole.EDITOR,
          isActive: true,
        },
      }),
    );
  });

  it("returns a field error for an email already in use", async () => {
    mocks.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const result = await createUserAction({
      name: "Editor User",
      email: "editor@example.com",
      password: "password-123",
      passwordConfirmation: "password-123",
      role: UserRole.EDITOR,
    });

    expect(result.validationErrors?.fieldErrors.email).toEqual([
      "อีเมลนี้ถูกใช้งานแล้ว",
    ]);
  });

  it("maps unexpected database failures to the safe internal error", async () => {
    mocks.create.mockRejectedValue(new Error("database down"));

    const result = await createUserAction({
      name: "Editor User",
      email: "editor@example.com",
      password: "password-123",
      passwordConfirmation: "password-123",
      role: UserRole.EDITOR,
    });

    expect(result.serverError).toEqual({
      code: "INTERNAL",
      message: "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง",
    });
  });
});
