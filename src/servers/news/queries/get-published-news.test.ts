import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublishedNewsDetail,
  getPublishedNewsList,
  toPublicNewsItem,
} from "./get-published-news";
const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  getFileUrl: vi.fn(),
  getCoverFile: vi.fn(),
  sanitizeBody: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { news: { findMany: mocks.findMany, findFirst: mocks.findFirst } },
}));
vi.mock("@/servers/file-manager/helpers", () => ({
  getFileUrl: mocks.getFileUrl,
}));
vi.mock("../helpers", () => ({
  getNewsRevisionCoverFile: mocks.getCoverFile,
  sanitizeNewsBody: mocks.sanitizeBody,
}));
const newsId = "11111111-1111-4111-8111-111111111111";
describe("published news queries", () => {
  beforeEach(() => vi.clearAllMocks());
  it("lists active news with published revisions", async () => {
    const rows = [{ id: newsId }];
    mocks.findMany.mockResolvedValue(rows);
    await expect(getPublishedNewsList()).resolves.toBe(rows);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          archivedAt: null,
          publishedRevision: { is: { status: "PUBLISHED" } },
        },
        orderBy: { createdAt: "desc" },
      }),
    );
  });
  it("loads detail through the same public policy", async () => {
    await getPublishedNewsDetail(newsId);
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: newsId,
          deletedAt: null,
          archivedAt: null,
          publishedRevision: { is: { status: "PUBLISHED" } },
        },
      }),
    );
  });
  it("maps nullable metadata and a cover to the public contract", () => {
    const publishedAt = new Date("2026-08-19T00:00:00.000Z");
    const cover = { id: "cover" };
    mocks.getCoverFile.mockReturnValue(cover);
    mocks.getFileUrl.mockReturnValue("/api/files/cover");
    mocks.sanitizeBody.mockReturnValue("<p>safe</p>");
    const item = toPublicNewsItem({
      id: newsId,
      viewCount: 9,
      publishedRevision: {
        title: "ข่าว",
        excerpt: null,
        bodyHtml: "unsafe",
        category: null,
        files: [],
        readTimeMinutes: null,
        source: [],
        publishedAt,
        createdAt: new Date(),
      },
    } as never);
    expect(item).toEqual(
      expect.objectContaining({
        id: newsId,
        category: "ไม่ระบุหมวดหมู่",
        description: "",
        imageUrl: "/api/files/cover",
        readTime: "",
        viewCount: 9,
        bodyHtml: "<p>safe</p>",
        publishedAt: publishedAt.toISOString(),
      }),
    );
  });
  it("returns null without a published revision and falls back to defaults", () => {
    expect(toPublicNewsItem(null)).toBeNull();
    expect(
      toPublicNewsItem({ id: newsId, publishedRevision: null } as never),
    ).toBeNull();
    mocks.getCoverFile.mockReturnValue(null);
    mocks.sanitizeBody.mockReturnValue("<p>safe</p>");
    const createdAt = new Date("2026-08-18T00:00:00.000Z");
    const item = toPublicNewsItem({
      id: newsId,
      viewCount: 0,
      publishedRevision: {
        title: "ข่าว",
        excerpt: "คำโปรย",
        bodyHtml: "body",
        category: { id: "category", name: "ทั่วไป" },
        files: [],
        readTimeMinutes: 3,
        source: [{ url: "https://example.com", title: "source" }],
        publishedAt: null,
        createdAt,
      },
    } as never);
    expect(item).toEqual(
      expect.objectContaining({
        imageUrl: "/img/news1.png",
        readTime: "3 นาที",
        publishedAt: createdAt.toISOString(),
      }),
    );
  });
});
