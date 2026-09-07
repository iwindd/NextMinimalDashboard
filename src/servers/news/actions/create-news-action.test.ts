import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    newsCategory: { findUnique: vi.fn() },
    news: { create: vi.fn(), update: vi.fn() },
    newsRevision: { create: vi.fn() },
    createAuditLog: vi.fn(),
  };
  return {
    requireManageNews: vi.fn(),
    getRequestContext: vi.fn(),
    runTransaction: vi.fn(),
    revalidatePath: vi.fn(),
    syncFiles: vi.fn(),
    transaction,
  };
});
vi.mock("../authorization", () => ({
  requireManageNews: mocks.requireManageNews,
}));
vi.mock("@/lib/audit/request-context", () => ({
  getRequestContext: mocks.getRequestContext,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.runTransaction },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("../files/sync-news-revision-files", () => ({
  syncNewsRevisionFiles: mocks.syncFiles,
}));

import { createNewsAction } from "./create-news-action";
const actor = {
  id: "11111111-1111-4111-8111-111111111111",
  role: UserRole.EDITOR,
  isActive: true,
};
const categoryId = "22222222-2222-4222-8222-222222222222";
const newsId = "33333333-3333-4333-8333-333333333333";
const revisionId = "44444444-4444-4444-8444-444444444444";
const coverFileId = "55555555-5555-4555-8555-555555555555";
const bodyFileId = "66666666-6666-4666-8666-666666666666";
const input = {
  title: "ข่าว",
  excerpt: "คำโปรย",
  bodyHtml: `<p>เนื้อหา</p><img src="/api/files/${bodyFileId}" onerror="bad()">`,
  categoryId,
  coverFileId,
  readTimeMinutes: 5,
  source: [{ url: "https://example.com/news", title: "แหล่งข่าว" }],
};

describe("createNewsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireManageNews.mockResolvedValue(actor);
    mocks.getRequestContext.mockResolvedValue({
      requestId: "request",
      ipHash: null,
      userAgent: null,
    });
    mocks.runTransaction.mockImplementation(
      (operation: (client: typeof mocks.transaction) => Promise<unknown>) =>
        operation(mocks.transaction),
    );
    mocks.transaction.newsCategory.findUnique.mockResolvedValue({
      id: categoryId,
    });
    mocks.transaction.news.create.mockResolvedValue({ id: newsId });
    mocks.transaction.newsRevision.create.mockResolvedValue({ id: revisionId });
  });
  it("validates before starting a transaction", async () => {
    const result = await createNewsAction({ ...input, title: "" });
    expect(result.validationErrors?.fieldErrors.title).toContain(
      "กรุณากรอกหัวข้อข่าว",
    );
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });
  it("rejects an unknown optional category", async () => {
    mocks.transaction.newsCategory.findUnique.mockResolvedValue(null);
    expect((await createNewsAction(input)).serverError).toEqual({
      code: "POLICY",
      message: "ไม่พบหมวดหมู่ข่าว",
    });
    expect(mocks.transaction.news.create).not.toHaveBeenCalled();
  });
  it("creates a sanitized draft, syncs files, and audits", async () => {
    const result = await createNewsAction(input);
    expect(result.data).toEqual({ id: newsId });
    expect(mocks.transaction.newsRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        newsId,
        title: "ข่าว",
        bodyHtml: expect.not.stringContaining("onerror"),
      }),
      select: { id: true },
    });
    expect(mocks.syncFiles).toHaveBeenCalledWith(mocks.transaction, {
      revisionId,
      newsId,
      actor,
      coverFileId,
      bodyFileIds: [bodyFileId],
    });
    expect(mocks.transaction.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "NEWS_CREATED", resourceId: newsId }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/news/${newsId}`);
  });
  it("supports a minimal draft without optional metadata", async () => {
    const result = await createNewsAction({ title: "ข่าว", bodyHtml: "" });
    expect(result.data).toEqual({ id: newsId });
    expect(mocks.transaction.newsCategory.findUnique).not.toHaveBeenCalled();
    expect(mocks.syncFiles).toHaveBeenCalledWith(mocks.transaction, {
      revisionId,
      newsId,
      actor,
      coverFileId: null,
      bodyFileIds: [],
    });
  });
});
