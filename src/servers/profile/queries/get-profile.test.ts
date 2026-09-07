import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mocks.findUnique } },
}));

import { PROFILE_SELECT } from "../helpers";
import { getProfile } from "./get-profile";

const databaseProfile = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Admin User",
  email: "admin@example.com",
  role: "ADMIN" as const,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

describe("getProfile", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.findUnique.mockReset();
  });

  it("returns null without an authenticated user", async () => {
    mocks.auth.mockResolvedValue(null);

    await expect(getProfile()).resolves.toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the authenticated user no longer exists", async () => {
    mocks.auth.mockResolvedValue({ user: { id: databaseProfile.id } });
    mocks.findUnique.mockResolvedValue(null);

    await expect(getProfile()).resolves.toBeNull();
  });

  it("loads and serializes the authenticated user's profile", async () => {
    mocks.auth.mockResolvedValue({ user: { id: databaseProfile.id } });
    mocks.findUnique.mockResolvedValue(databaseProfile);

    await expect(getProfile()).resolves.toEqual({
      ...databaseProfile,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: databaseProfile.id },
      select: PROFILE_SELECT,
    });
  });
});
