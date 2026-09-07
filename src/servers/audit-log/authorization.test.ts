import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mocks.findUnique } },
}));

import {
  getOwnAuditLogsActor,
  getViewAllAuditLogsActor,
  requireOwnAuditLogs,
  requireViewAllAuditLogs,
} from "./authorization";
import { AuditLogAuthorizationError } from "./exceptions";

const admin = {
  id: "11111111-1111-4111-8111-111111111111",
  role: UserRole.ADMIN,
  isActive: true,
};
const editor = {
  id: "22222222-2222-4222-8222-222222222222",
  role: UserRole.EDITOR,
  isActive: true,
};

describe("audit log authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null without a session and does not query the database", async () => {
    mocks.auth.mockResolvedValue(null);

    await expect(getOwnAuditLogsActor()).resolves.toBeNull();
    await expect(getViewAllAuditLogsActor()).resolves.toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("loads the current actor from the database", async () => {
    mocks.auth.mockResolvedValue({ user: { id: admin.id } });
    mocks.findUnique.mockResolvedValue(admin);

    await expect(getOwnAuditLogsActor()).resolves.toEqual(admin);
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: admin.id },
      select: { id: true, role: true, isActive: true },
    });
  });

  it("allows an active editor to read their own timeline", async () => {
    mocks.auth.mockResolvedValue({ user: { id: editor.id } });
    mocks.findUnique.mockResolvedValue(editor);

    await expect(getOwnAuditLogsActor()).resolves.toEqual(editor);
    await expect(requireOwnAuditLogs()).resolves.toEqual(editor);
  });

  it.each([
    ["inactive admin", { ...admin, isActive: false }],
    ["missing actor", null],
  ])("rejects %s for own timelines", async (_label, databaseActor) => {
    mocks.auth.mockResolvedValue({ user: { id: admin.id } });
    mocks.findUnique.mockResolvedValue(databaseActor);

    await expect(getOwnAuditLogsActor()).resolves.toBeNull();
    await expect(requireOwnAuditLogs()).rejects.toBeInstanceOf(
      AuditLogAuthorizationError,
    );
  });

  it("limits the system-wide timeline to active administrators", async () => {
    mocks.auth.mockResolvedValue({ user: { id: admin.id } });
    mocks.findUnique.mockResolvedValue(admin);

    await expect(getViewAllAuditLogsActor()).resolves.toEqual(admin);
    await expect(requireViewAllAuditLogs()).resolves.toEqual(admin);
  });

  it.each([
    ["active editor", editor],
    ["inactive admin", { ...admin, isActive: false }],
  ])("rejects %s for the system-wide timeline", async (_label, databaseActor) => {
    mocks.auth.mockResolvedValue({ user: { id: databaseActor.id } });
    mocks.findUnique.mockResolvedValue(databaseActor);

    await expect(getViewAllAuditLogsActor()).resolves.toBeNull();
    await expect(requireViewAllAuditLogs()).rejects.toBeInstanceOf(
      AuditLogAuthorizationError,
    );
  });
});
