import { beforeEach, describe, expect, it, vi } from "vitest";
import { getNewsDetail } from "./get-news-detail";

const mocks = vi.hoisted(() => ({
  requireManageNews: vi.fn(),
  findFirst: vi.fn(),
  auditFindFirst: vi.fn(),
  toNewsDetail: vi.fn(),
}));

vi.mock("../authorization", () => ({
  requireManageNews: mocks.requireManageNews,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    news: { findFirst: mocks.findFirst },
    auditLog: { findFirst: mocks.auditFindFirst },
  },
}));
vi.mock("../helpers", () => ({
  NEWS_DETAIL_INCLUDE: {},
  toNewsDetail: mocks.toNewsDetail,
}));

const newsId = "11111111-1111-4111-8111-111111111111";

describe("getNewsDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireManageNews.mockResolvedValue({
      id: "editor",
      role: "EDITOR",
      isActive: true,
    });
    mocks.toNewsDetail.mockReturnValue({ id: newsId });
  });

  it("authorizes before querying", async () => {
    mocks.requireManageNews.mockRejectedValue(new Error("unauthorized"));

    await expect(getNewsDetail(newsId)).rejects.toThrow("unauthorized");
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("scopes editors to owned news and serializes", async () => {
    const row = { id: newsId };
    const detail = { id: newsId };
    mocks.findFirst.mockResolvedValue(row);
    mocks.toNewsDetail.mockReturnValue(detail);

    await expect(getNewsDetail(newsId)).resolves.toEqual(detail);

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: newsId, authorId: "editor" },
      include: {},
    });
    expect(mocks.toNewsDetail).toHaveBeenCalledWith(row, null, {
      reviewedDraftAsChangesRequested: false,
    });
  });

  it("allows admins to load any author's published news", async () => {
    mocks.requireManageNews.mockResolvedValue({
      id: "admin",
      role: "ADMIN",
      isActive: true,
    });
    mocks.findFirst.mockResolvedValue({
      id: newsId,
      authorId: "other-author",
      deletedAt: null,
      workingRevision: null,
      publishedRevision: { status: "PUBLISHED" },
    });

    await getNewsDetail(newsId);

    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: newsId } }),
    );
  });

  it("hides another author's untouched unpublished draft from admins", async () => {
    mocks.requireManageNews.mockResolvedValue({
      id: "admin",
      role: "ADMIN",
      isActive: true,
    });
    mocks.findFirst.mockResolvedValue({
      id: newsId,
      authorId: "other-author",
      deletedAt: null,
      workingRevision: { status: "DRAFT", reviewedAt: null },
      publishedRevision: null,
    });

    await expect(getNewsDetail(newsId)).rejects.toThrow("ไม่พบข่าวสาร");
    expect(mocks.toNewsDetail).not.toHaveBeenCalled();
  });

  it("shows another author's reviewed draft as changes requested", async () => {
    const row = {
      id: newsId,
      authorId: "other-author",
      deletedAt: null,
      workingRevision: {
        status: "DRAFT",
        reviewedAt: new Date("2026-08-22T00:00:00.000Z"),
      },
      publishedRevision: null,
    };
    mocks.requireManageNews.mockResolvedValue({
      id: "admin",
      role: "ADMIN",
      isActive: true,
    });
    mocks.findFirst.mockResolvedValue(row);

    await getNewsDetail(newsId);

    expect(mocks.toNewsDetail).toHaveBeenCalledWith(row, null, {
      reviewedDraftAsChangesRequested: true,
    });
  });

  it("does not open a deleted unpublished draft", async () => {
    mocks.findFirst.mockResolvedValue({
      id: newsId,
      authorId: "editor",
      deletedAt: new Date(),
      workingRevision: { status: "DRAFT", reviewedAt: null },
      publishedRevision: null,
    });

    await expect(getNewsDetail(newsId)).rejects.toThrow("ไม่พบข่าวสาร");
    expect(mocks.toNewsDetail).not.toHaveBeenCalled();
  });

  it("throws not found for an unknown scoped id", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(getNewsDetail(newsId)).rejects.toThrow("ไม่พบข่าวสาร");
  });

  it("loads the latest archive note for an archived news detail", async () => {
    const row = {
      id: newsId,
      authorId: "editor",
      deletedAt: null,
      archivedAt: new Date(),
      workingRevision: null,
      publishedRevision: { status: "PUBLISHED" },
    };
    mocks.findFirst.mockResolvedValue(row);
    mocks.auditFindFirst.mockResolvedValue({ reason: "หมดช่วงเผยแพร่" });

    await getNewsDetail(newsId);

    expect(mocks.auditFindFirst).toHaveBeenCalledWith({
      where: {
        resourceType: "NEWS",
        resourceId: newsId,
        action: "NEWS_ARCHIVED",
      },
      orderBy: { createdAt: "desc" },
      select: { reason: true },
    });
    expect(mocks.toNewsDetail).toHaveBeenCalledWith(row, "หมดช่วงเผยแพร่", {
      reviewedDraftAsChangesRequested: false,
    });
  });
});
