import { Prisma } from "@prisma/client";
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
    createAuditLog: transaction.createAuditLog,
    createUserSecurityLog: transaction.userSecurityLog.createLog,
    revalidatePath: vi.fn(),
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

import { updateProfileEmailAction } from "./update-profile-email-action";

const actorId = "11111111-1111-4111-8111-111111111111";
const profile = {
  id: actorId,
  name: "Admin User",
  email: "new@example.com",
  role: "ADMIN" as const,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};
const existingProfile = { ...profile, email: "old@example.com" };

describe("updateProfileEmailAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: actorId } });
    mocks.actorFindUnique.mockResolvedValue({ ...existingProfile, isActive: true });
    mocks.transaction.user.findUnique.mockResolvedValue(existingProfile);
    mocks.runTransaction.mockImplementation(
      (operation: (client: typeof mocks.transaction) => Promise<unknown>) =>
        operation(mocks.transaction),
    );
  });

  it("returns a field error for an email already in use", async () => {
    mocks.transaction.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const result = await updateProfileEmailAction({ email: "USED@EXAMPLE.COM" });

    expect(result.validationErrors?.fieldErrors.email).toEqual([
      "อีเมลนี้ถูกใช้งานแล้ว",
    ]);
  });

  it("normalizes, updates, and revalidates the email", async () => {
    mocks.transaction.user.update.mockResolvedValue(profile);

    const result = await updateProfileEmailAction({ email: "NEW@EXAMPLE.COM" });

    expect(result.data).toEqual({
      ...profile,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(mocks.transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { email: "new@example.com" } }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/profile");
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PROFILE_EMAIL_CHANGED" }),
    );
    expect(mocks.createUserSecurityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "EMAIL_CHANGED_BY_SELF",
        source: "SELF",
      }),
    );
  });

  it("does not write audit data for a no-op email update", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue(profile);

    const result = await updateProfileEmailAction({ email: profile.email });

    expect(result.data).toBeDefined();
    expect(mocks.transaction.user.update).not.toHaveBeenCalled();
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
    expect(mocks.createUserSecurityLog).not.toHaveBeenCalled();
  });

  it("returns not found when the profile disappears", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue(null);

    const result = await updateProfileEmailAction({ email: "new@example.com" });

    expect(result.serverError).toEqual({
      code: "NOT_FOUND",
      message: "ไม่พบข้อมูลโปรไฟล์",
    });
  });

  it("maps unexpected update failures to the safe internal error", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue(existingProfile);
    mocks.transaction.user.update.mockRejectedValue(new Error("database down"));

    const result = await updateProfileEmailAction({ email: "new@example.com" });

    expect(result.serverError).toEqual({
      code: "INTERNAL",
      message: "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง",
    });
  });
});
