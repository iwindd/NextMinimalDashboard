import { beforeEach, describe, expect, it, vi } from "vitest";
import { getNewsCategories } from "./get-news-categories";
const mocks = vi.hoisted(() => ({
  requireManageNews: vi.fn(),
  findMany: vi.fn(),
}));
vi.mock("@/servers/news/authorization", () => ({
  requireManageNews: mocks.requireManageNews,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { newsCategory: { findMany: mocks.findMany } },
}));
describe("getNewsCategories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireManageNews.mockResolvedValue({ id: "editor" });
  });
  it("authorizes before querying", async () => {
    mocks.requireManageNews.mockRejectedValue(new Error("unauthorized"));
    await expect(getNewsCategories({ search: "", limit: 20 })).rejects.toThrow(
      "unauthorized",
    );
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it("returns a page and next cursor", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "1", name: "ก" },
      { id: "2", name: "ข" },
      { id: "3", name: "ค" },
    ]);
    await expect(
      getNewsCategories({
        search: "ข่าว",
        cursor: "11111111-1111-4111-8111-111111111111",
        limit: 2,
      }),
    ).resolves.toEqual({
      data: [
        { id: "1", name: "ก" },
        { id: "2", name: "ข" },
      ],
      nextCursor: "2",
    });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { contains: "ข่าว", mode: "insensitive" } },
        cursor: { id: "11111111-1111-4111-8111-111111111111" },
        skip: 1,
        take: 3,
      }),
    );
  });
  it("ends pagination when there are no extra rows", async () => {
    mocks.findMany.mockResolvedValue([{ id: "1", name: "ก" }]);
    await expect(getNewsCategories({ search: "", limit: 2 })).resolves.toEqual({
      data: [{ id: "1", name: "ก" }],
      nextCursor: null,
    });
  });
});
