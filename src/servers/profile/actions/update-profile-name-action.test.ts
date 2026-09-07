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

import { updateProfileNameAction } from "./update-profile-name-action";

const actorId = "11111111-1111-4111-8111-111111111111";
const profile = {
  id: actorId,
  name: "New name",
  email: "admin@example.com",
  role: "ADMIN" as const,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};
const existingProfile = { ...profile, name: "Old name" };

describe("updateProfileNameAction", () => {
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

  it("rejects unauthenticated requests", async () => {
    mocks.auth.mockResolvedValue(null);

    const result = await updateProfileNameAction({ name: "New name" });

    expect(result.serverError).toEqual({
      code: "UNAUTHORIZED",
      message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ",
    });
    expect(mocks.transaction.user.update).not.toHaveBeenCalled();
  });

  it("rejects inactive actors", async () => {
    mocks.actorFindUnique.mockResolvedValue({ id: actorId, isActive: false });

    const result = await updateProfileNameAction({ name: "New name" });

    expect(result.serverError).toEqual({
      code: "UNAUTHORIZED",
      message: "ไม่สามารถแก้ไขโปรไฟล์ได้",
    });
  });

  it("validates the name before updating", async () => {
    const result = await updateProfileNameAction({ name: "   " });

    expect(result.validationErrors?.fieldErrors.name).toContain(
      "กรุณากรอกชื่อผู้ใช้งาน",
    );
    expect(mocks.transaction.user.update).not.toHaveBeenCalled();
  });

  it("updates and revalidates the profile", async () => {
    mocks.transaction.user.update.mockResolvedValue(profile);

    const result = await updateProfileNameAction({ name: "  New name  " });

    expect(result.data).toEqual({
      ...profile,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(mocks.transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: actorId },
        data: { name: "New name" },
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/profile");
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROFILE_NAME_CHANGED",
        resourceId: actorId,
        target: expect.objectContaining({ id: actorId }),
      }),
    );
    expect(mocks.createUserSecurityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "NAME_CHANGED_BY_SELF",
        source: "SELF",
      }),
    );
  });

  it("does not write audit data for a no-op name update", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue(profile);

    const result = await updateProfileNameAction({ name: profile.name });

    expect(result.data).toBeDefined();
    expect(mocks.transaction.user.update).not.toHaveBeenCalled();
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
    expect(mocks.createUserSecurityLog).not.toHaveBeenCalled();
  });

  it("returns not found when the profile disappears", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue(null);

    const result = await updateProfileNameAction({ name: "New name" });

    expect(result.serverError).toEqual({
      code: "NOT_FOUND",
      message: "ไม่พบข้อมูลโปรไฟล์",
    });
  });

  it("maps unexpected update failures to the safe internal error", async () => {
    mocks.transaction.user.findUnique.mockResolvedValue(existingProfile);
    mocks.transaction.user.update.mockRejectedValue(new Error("database down"));

    const result = await updateProfileNameAction({ name: "Another name" });

    expect(result.serverError).toEqual({
      code: "INTERNAL",
      message: "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง",
    });
  });
});
