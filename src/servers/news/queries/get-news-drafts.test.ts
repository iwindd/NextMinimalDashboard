import { beforeEach, describe, expect, it, vi } from "vitest";
import { getNewsDrafts } from "./get-news-drafts";

const mocks = vi.hoisted(() => ({
  requireManageNews: vi.fn(),
  findMany: vi.fn(),
  toNewsListItem: vi.fn(),
}));

vi.mock("../authorization", () => ({
  requireManageNews: mocks.requireManageNews,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { news: { findMany: mocks.findMany } },
}));
vi.mock("../helpers", () => ({
  NEWS_LIST_INCLUDE: { revisions: true },
  toNewsListItem: mocks.toNewsListItem,
}));

describe("getNewsDrafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireManageNews.mockResolvedValue({
      id: "current-user",
      role: "ADMIN",
      isActive: true,
    });
    mocks.findMany.mockResolvedValue([{ id: "draft" }]);
    mocks.toNewsListItem.mockReturnValue({ id: "draft" });
  });

  it("authorizes before loading only the current user's drafts", async () => {
    const result = await getNewsDrafts();

    expect(result).toEqual({ data: [{ id: "draft" }], total: 1 });
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        authorId: "current-user",
        deletedAt: null,
        workingRevision: { is: { status: "DRAFT" } },
      },
      include: { revisions: true },
      orderBy: { updatedAt: "desc" },
    });
  });

  it("does not query when authorization fails", async () => {
    mocks.requireManageNews.mockRejectedValue(new Error("unauthorized"));

    await expect(getNewsDrafts()).rejects.toThrow("unauthorized");
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
