import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireManageUsers: vi.fn(),
  getDatatable: vi.fn(),
}));

vi.mock("../authorization", () => ({
  requireManageUsers: mocks.requireManageUsers,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { getDatatable: mocks.getDatatable } },
}));

import { USER_LIST_SELECT } from "../helpers";
import { getUserList } from "./get-user-list";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Editor User",
  email: "editor@example.com",
  role: "EDITOR" as const,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};
const query = {
  page: 1,
  pageSize: 10,
  search: "editor",
  role: "EDITOR" as const,
  status: "inactive" as const,
  sortBy: "createdAt" as const,
  sortDirection: "desc" as const,
};

describe("getUserList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireManageUsers.mockResolvedValue({ id: "admin-id" });
  });

  it("builds filters and serializes datatable rows", async () => {
    mocks.getDatatable.mockResolvedValue({ data: [user], total: 1 });

    await expect(getUserList(query)).resolves.toEqual({
      data: [
        {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      total: 1,
    });
    expect(mocks.getDatatable).toHaveBeenCalledWith({
      query,
      select: USER_LIST_SELECT,
      searchable: {
        name: { mode: "insensitive" },
        email: { mode: "insensitive" },
      },
      where: { role: "EDITOR", isActive: false },
      defaultOrderBy: { createdAt: "desc" },
    });
  });

  it("does not query Prisma when authorization fails", async () => {
    mocks.requireManageUsers.mockRejectedValue(new Error("unauthorized"));

    await expect(getUserList(query)).rejects.toThrow("unauthorized");
    expect(mocks.getDatatable).not.toHaveBeenCalled();
  });

  it("builds active and all-status filters without a role", async () => {
    mocks.getDatatable.mockResolvedValue({ data: [], total: 0 });

    await getUserList({ ...query, role: undefined, status: "active" });
    expect(mocks.getDatatable).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );

    mocks.getDatatable.mockClear();
    await getUserList({ ...query, role: undefined, status: "all" });
    expect(mocks.getDatatable).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });
});
