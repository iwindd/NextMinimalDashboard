import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    user: { findUnique: vi.fn(), update: vi.fn() },
    createAuditLog: vi.fn(),
    userSecurityLog: { createLog: vi.fn() },
  };
  return {
    auth: vi.fn(),
    actorFindUnique: vi.fn(),
    transaction,
    runTransaction: vi.fn(),
    revalidatePath: vi.fn(),
    compare: vi.fn(),
    hash: vi.fn(),
    createAuditLog: transaction.createAuditLog,
    createUserSecurityLog: transaction.userSecurityLog.createLog,
  };
});

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.actorFindUnique },
    $transaction: mocks.runTransaction,
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("bcryptjs", () => ({ compare: mocks.compare, hash: mocks.hash }));

import { updateProfilePasswordAction } from "./update-profile-password-action";

const actorId = "11111111-1111-4111-8111-111111111111";
const profile = {
  id: actorId,
  name: "Admin User",
  email: "admin@example.com",
  role: "ADMIN" as const,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};
const input = {
  oldPassword: "old-password",
  password: "new-password",
  passwordConfirmation: "new-password",
};

describe("updateProfilePasswordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: actorId } });
    mocks.actorFindUnique.mockResolvedValue({ id: actorId, isActive: true });
    mocks.runTransaction.mockImplementation(
      (operation: (client: typeof mocks.transaction) => Promise<unknown>) =>
        operation(mocks.transaction),
    );
  });

  it("rejects an incorrect current password", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue({
      id: actorId,
      passwordHash: "existing-hash",
    });
    mocks.compare.mockResolvedValue(false);

    const result = await updateProfilePasswordAction(input);

    expect(result.serverError).toEqual({
      code: "POLICY",
      message: "รหัสผ่านเดิมไม่ถูกต้อง",
    });
    expect(mocks.transaction.user.update).not.toHaveBeenCalled();
  });

  it("returns not found when the profile disappears", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue(null);

    const result = await updateProfilePasswordAction(input);

    expect(result.serverError).toEqual({
      code: "NOT_FOUND",
      message: "ไม่พบข้อมูลโปรไฟล์",
    });
  });

  it("hashes, updates, and revalidates a valid password", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue({
      id: actorId,
      passwordHash: "existing-hash",
    });
    mocks.compare.mockResolvedValue(true);
    mocks.hash.mockResolvedValue("new-hash");
    mocks.transaction.user.update.mockResolvedValue(profile);

    const result = await updateProfilePasswordAction(input);

    expect(result.data).toEqual({
      ...profile,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(mocks.compare).toHaveBeenCalledWith("old-password", "existing-hash");
    expect(mocks.hash).toHaveBeenCalledWith("new-password", 12);
    expect(mocks.transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { passwordHash: "new-hash" } }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/profile");
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PROFILE_PASSWORD_CHANGED" }),
    );
    expect(mocks.createUserSecurityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "PASSWORD_CHANGED_BY_SELF",
        source: "SELF",
      }),
    );
  });

  it("rejects mismatched passwords before comparing or updating", async () => {
    const result = await updateProfilePasswordAction({
      ...input,
      passwordConfirmation: "different-password",
    });

    expect(result.validationErrors?.fieldErrors.passwordConfirmation).toContain(
      "รหัสผ่านไม่ตรงกัน",
    );
    expect(mocks.compare).not.toHaveBeenCalled();
    expect(mocks.transaction.user.findUnique).not.toHaveBeenCalled();
  });

  it("maps unexpected update failures to the safe internal error", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue({
      id: actorId,
      passwordHash: "existing-hash",
    });
    mocks.compare.mockResolvedValue(true);
    mocks.hash.mockResolvedValue("new-hash");
    mocks.transaction.user.update.mockRejectedValue(new Error("database down"));

    const result = await updateProfilePasswordAction(input);

    expect(result.serverError).toEqual({
      code: "INTERNAL",
      message: "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง",
    });
  });
});
