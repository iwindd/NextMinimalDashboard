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
  getManageUsersActor,
  requireManageUsers,
} from "./authorization";
import { UserAuthorizationError } from "./exceptions";

const actor = {
  id: "11111111-1111-4111-8111-111111111111",
  role: UserRole.ADMIN,
  isActive: true,
};

describe("user authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null without a session and does not query the database", async () => {
    mocks.auth.mockResolvedValue(null);

    await expect(getManageUsersActor()).resolves.toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("loads the current actor and allows an active admin", async () => {
    mocks.auth.mockResolvedValue({ user: { id: actor.id } });
    mocks.findUnique.mockResolvedValue(actor);

    await expect(getManageUsersActor()).resolves.toEqual(actor);
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: actor.id },
      select: { id: true, role: true, isActive: true },
    });
  });

  it.each([
    ["inactive admin", { ...actor, isActive: false }],
    ["active editor", { ...actor, role: UserRole.EDITOR }],
    ["missing actor", null],
  ])("rejects %s", async (_label, databaseActor) => {
    mocks.auth.mockResolvedValue({ user: { id: actor.id } });
    mocks.findUnique.mockResolvedValue(databaseActor);

    await expect(getManageUsersActor()).resolves.toBeNull();
  });

  it("throws the authorization error when management is not allowed", async () => {
    mocks.auth.mockResolvedValue({ user: { id: actor.id } });
    mocks.findUnique.mockResolvedValue({ ...actor, role: UserRole.EDITOR });

    await expect(requireManageUsers()).rejects.toBeInstanceOf(
      UserAuthorizationError,
    );
  });

  it("returns the actor when management is allowed", async () => {
    mocks.auth.mockResolvedValue({ user: { id: actor.id } });
    mocks.findUnique.mockResolvedValue(actor);

    await expect(requireManageUsers()).resolves.toEqual(actor);
  });
});
