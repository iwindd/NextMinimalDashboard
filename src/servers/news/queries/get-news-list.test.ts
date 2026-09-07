import { beforeEach, describe, expect, it, vi } from "vitest";
import { getNewsList } from "./get-news-list";

const mocks = vi.hoisted(() => ({
  requireManageNews: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  toNewsListItem: vi.fn(),
}));

vi.mock("../authorization", () => ({
  requireManageNews: mocks.requireManageNews,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { news: { findMany: mocks.findMany, count: mocks.count } },
}));
vi.mock("../helpers", () => ({
  NEWS_LIST_INCLUDE: { revisions: true },
  toNewsListItem: mocks.toNewsListItem,
}));

const baseQuery = {
  page: 2,
  pageSize: 10,
  search: " ข่าว ",
  categoryIds: [] as string[],
  status: "all" as const,
  sortBy: "updatedAt" as const,
  sortDirection: "desc" as const,
};

const adminDraftVisibility = {
  OR: [
    { NOT: { workingRevision: { is: { status: "DRAFT" } } } },
    {
      AND: [
        { authorId: { not: "admin" } },
        {
          workingRevision: {
            is: { status: "DRAFT", reviewedAt: { not: null } },
          },
        },
      ],
    },
  ],
};

describe("getNewsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireManageNews.mockResolvedValue({
      id: "editor",
      role: "EDITOR",
      isActive: true,
    });
    mocks.findMany.mockResolvedValue([{ id: "news" }]);
    mocks.count.mockResolvedValue(1);
    mocks.toNewsListItem.mockReturnValue({ id: "news" });
  });

  it("authorizes before querying", async () => {
    mocks.requireManageNews.mockRejectedValue(new Error("unauthorized"));

    await expect(getNewsList(baseQuery)).rejects.toThrow("unauthorized");
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("scopes editor search and pagination", async () => {
    expect(await getNewsList(baseQuery)).toEqual({
      data: [{ id: "news" }],
      total: 1,
      counts: {
        all: 1,
        draft: 1,
        in_review: 1,
        published: 1,
        archived: 1,
        changes_requested: 1,
      },
    });

    const call = mocks.findMany.mock.calls[0]?.[0];
    expect(call).toEqual(
      expect.objectContaining({
        where: {
          AND: expect.arrayContaining([
            { authorId: "editor" },
            { deletedAt: null },
            { NOT: { workingRevision: { is: { status: "DRAFT" } } } },
          ]),
        },
        orderBy: { updatedAt: "desc" },
        skip: 10,
        take: 10,
      }),
    );
    expect(call.where.AND.at(-1)).toEqual({ OR: expect.any(Array) });
  });

  it("shows the current user's drafts and returned changes in the draft tab", async () => {
    await getNewsList({ ...baseQuery, search: "", status: ["draft"] });

    const conditions = mocks.findMany.mock.calls[0]?.[0].where.AND;
    expect(conditions).toContainEqual({ authorId: "editor" });
    expect(conditions).toContainEqual({ archivedAt: null });
    expect(conditions).toContainEqual({
      OR: [
        { workingRevision: { is: { status: "DRAFT" } } },
        { workingRevision: { is: { status: "CHANGES_REQUESTED" } } },
      ],
    });
    expect(conditions).not.toContainEqual({
      NOT: { workingRevision: { is: { status: "DRAFT" } } },
    });
  });

  it("scopes the admin draft tab to the admin's own news", async () => {
    mocks.requireManageNews.mockResolvedValue({
      id: "admin",
      role: "ADMIN",
      isActive: true,
    });

    await getNewsList({ ...baseQuery, search: "", status: ["draft"] });

    const conditions = mocks.findMany.mock.calls[0]?.[0].where.AND;
    expect(conditions).toContainEqual({ authorId: "admin" });
    expect(conditions).not.toContainEqual(adminDraftVisibility);
  });

  it("includes normal reviews and republish requests in the review tab", async () => {
    await getNewsList({ ...baseQuery, search: "", status: ["in_review"] });

    const conditions = mocks.findMany.mock.calls[0]?.[0].where.AND;
    expect(conditions).toContainEqual({
      workingRevision: { is: { status: "IN_REVIEW" } },
    });
    expect(conditions).not.toContainEqual({ archivedAt: null });
  });

  it("builds admin category and review filters", async () => {
    mocks.requireManageNews.mockResolvedValue({
      id: "admin",
      role: "ADMIN",
      isActive: true,
    });

    await getNewsList({
      ...baseQuery,
      search: "",
      categoryIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
      status: ["in_review"],
    });

    const categoryId = {
      in: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
    };
    expect(mocks.findMany.mock.calls[0]?.[0].where).toEqual({
      AND: [
        {},
        { deletedAt: null },
        adminDraftVisibility,
        {
          OR: [
            { workingRevision: { is: { categoryId } } },
            { publishedRevision: { is: { categoryId } } },
          ],
        },
        { workingRevision: { is: { status: "IN_REVIEW" } } },
      ],
    });
  });

  it("uses published revision status for published filter", async () => {
    mocks.requireManageNews.mockResolvedValue({
      id: "admin",
      role: "ADMIN",
      isActive: true,
    });

    await getNewsList({ ...baseQuery, search: "", status: ["published"] });

    expect(mocks.findMany.mock.calls[0]?.[0].where).toEqual({
      AND: [
        {},
        { deletedAt: null },
        adminDraftVisibility,
        { archivedAt: null },
        { publishedRevision: { is: { status: "PUBLISHED" } } },
        { workingRevision: { is: null } },
      ],
    });
  });

  it("combines multiple status filters with OR", async () => {
    mocks.requireManageNews.mockResolvedValue({
      id: "admin",
      role: "ADMIN",
      isActive: true,
    });

    await getNewsList({
      ...baseQuery,
      search: "",
      status: ["in_review", "published"],
    });

    expect(mocks.findMany.mock.calls[0]?.[0].where).toEqual({
      AND: [
        {},
        { deletedAt: null },
        adminDraftVisibility,
        {
          OR: [
            {
              AND: [
                { workingRevision: { is: { status: "IN_REVIEW" } } },
              ],
            },
            {
              AND: [
                { archivedAt: null },
                { publishedRevision: { is: { status: "PUBLISHED" } } },
                { workingRevision: { is: null } },
              ],
            },
          ],
        },
      ],
    });
  });

  it("hides untouched drafts and includes reviewed drafts for other authors", async () => {
    mocks.requireManageNews.mockResolvedValue({
      id: "admin",
      role: "ADMIN",
      isActive: true,
    });

    await getNewsList({ ...baseQuery, search: "" });

    expect(mocks.findMany.mock.calls[0]?.[0].where.AND).toContainEqual(
      adminDraftVisibility,
    );
  });

  it("filters reviewed drafts as changes requested for admins", async () => {
    mocks.requireManageNews.mockResolvedValue({
      id: "admin",
      role: "ADMIN",
      isActive: true,
    });

    await getNewsList({
      ...baseQuery,
      search: "",
      status: ["changes_requested"],
    });

    expect(mocks.findMany.mock.calls[0]?.[0].where.AND).toContainEqual({
      OR: [
        {
          workingRevision: {
            is: { status: "CHANGES_REQUESTED" },
          },
        },
        {
          AND: [
            { authorId: { not: "admin" } },
            {
              workingRevision: {
                is: { status: "DRAFT", reviewedAt: { not: null } },
              },
            },
          ],
        },
      ],
    });
  });

  it("orders the main list by review priority", async () => {
    const updatedAt = new Date("2026-08-21T00:00:00.000Z");
    mocks.findMany
      .mockResolvedValueOnce([
        {
          id: "published",
          updatedAt,
          archivedAt: null,
          workingRevision: null,
          publishedRevision: { status: "PUBLISHED" },
        },
        {
          id: "republish",
          updatedAt,
          archivedAt: updatedAt,
          workingRevision: { status: "IN_REVIEW", reviewedAt: null },
          publishedRevision: { status: "PUBLISHED" },
        },
        {
          id: "review",
          updatedAt,
          archivedAt: null,
          workingRevision: { status: "IN_REVIEW", reviewedAt: null },
          publishedRevision: null,
        },
        {
          id: "changes",
          updatedAt,
          archivedAt: null,
          workingRevision: { status: "CHANGES_REQUESTED", reviewedAt: null },
          publishedRevision: null,
        },
      ])
      .mockResolvedValueOnce([
        { id: "review" },
        { id: "republish" },
        { id: "published" },
        { id: "changes" },
      ]);
    mocks.toNewsListItem.mockImplementation((record) => record);

    const result = await getNewsList({
      ...baseQuery,
      page: 1,
      search: "",
      sortBy: "status",
      sortDirection: "asc",
    });

    expect(mocks.findMany.mock.calls[1]?.[0].where).toEqual({
      id: { in: ["review", "republish", "published", "changes"] },
    });
    expect(result).toEqual({
      data: [
        { id: "review" },
        { id: "republish" },
        { id: "published" },
        { id: "changes" },
      ],
      total: 4,
      counts: {
        all: 1,
        draft: 1,
        in_review: 1,
        published: 1,
        archived: 1,
        changes_requested: 1,
      },
    });
  });

  it("filters archived reviews as republish requests", async () => {
    await getNewsList({ ...baseQuery, search: "", status: ["republish"] });

    expect(mocks.findMany.mock.calls[0]?.[0].where.AND).toContainEqual({
      archivedAt: { not: null },
    });
    expect(mocks.findMany.mock.calls[0]?.[0].where.AND).toContainEqual({
      workingRevision: { is: { status: "IN_REVIEW" } },
    });
  });

  it("filters archived news without republish requests", async () => {
    await getNewsList({ ...baseQuery, search: "", status: ["archived"] });

    expect(mocks.findMany.mock.calls[0]?.[0].where.AND).toContainEqual({
      archivedAt: { not: null },
    });
    expect(mocks.findMany.mock.calls[0]?.[0].where.AND).toContainEqual({
      NOT: { workingRevision: { is: { status: "IN_REVIEW" } } },
    });
  });
});
