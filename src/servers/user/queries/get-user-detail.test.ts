import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireManageUsers: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("../authorization", () => ({
  requireManageUsers: mocks.requireManageUsers,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mocks.findUnique } },
}));

import { USER_DETAIL_SELECT } from "../helpers";
import { getUserDetail } from "./get-user-detail";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Editor User",
  email: "editor@example.com",
  role: "EDITOR" as const,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

describe("getUserDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireManageUsers.mockResolvedValue({ id: "admin-id" });
  });

  it("authorizes before validating the requested user id", async () => {
    mocks.requireManageUsers.mockRejectedValue(new Error("unauthorized"));

    await expect(getUserDetail("invalid-id")).rejects.toThrow("unauthorized");
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("returns null for an invalid user id without querying Prisma", async () => {
    await expect(getUserDetail("invalid-id")).resolves.toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the user does not exist", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await expect(getUserDetail(user.id)).resolves.toBeNull();
  });

  it("loads and serializes a user detail", async () => {
    mocks.findUnique.mockResolvedValue(user);

    await expect(getUserDetail(user.id)).resolves.toEqual({
      ...user,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: user.id },
      select: USER_DETAIL_SELECT,
    });
  });
});
