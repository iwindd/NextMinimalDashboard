import { FileAccess, NewsRevisionStatus, UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    news: { findUnique: vi.fn(), update: vi.fn() },
    createAuditLog: vi.fn(),
  };
  return {
    requireManageNews: vi.fn(),
    getRequestContext: vi.fn(),
    runTransaction: vi.fn(),
    revalidatePath: vi.fn(),
    setFileAccess: vi.fn(),
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
  setNewsRevisionFileAccess: mocks.setFileAccess,
}));

import { republishNewsAction } from "./republish-news-action";

const newsId = "11111111-1111-4111-8111-111111111111";
const revisionId = "22222222-2222-4222-8222-222222222222";
const admin = {
  id: "33333333-3333-4333-8333-333333333333",
  role: UserRole.ADMIN,
  isActive: true,
};

describe("republishNewsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireManageNews.mockResolvedValue(admin);
    mocks.getRequestContext.mockResolvedValue({
      requestId: "request",
      ipHash: null,
      userAgent: null,
    });
    mocks.runTransaction.mockImplementation(
      (operation: (client: typeof mocks.transaction) => Promise<unknown>) =>
        operation(mocks.transaction),
    );
  });

  it("rejects editors", async () => {
    mocks.requireManageNews.mockResolvedValue({
      ...admin,
      role: UserRole.EDITOR,
    });

    const result = await republishNewsAction({ newsId });

    expect(result.serverError?.code).toBe("UNAUTHORIZED");
  });

  it("republishes the existing published revision without creating a version", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      deletedAt: null,
      archivedAt: new Date("2026-08-20T09:00:00.000Z"),
      publishedRevision: {
        id: revisionId,
        status: NewsRevisionStatus.PUBLISHED,
      },
      workingRevision: null,
    });

    const result = await republishNewsAction({ newsId });

    expect(result.data).toEqual({ id: newsId });
    expect(mocks.setFileAccess).toHaveBeenCalledWith(
      mocks.transaction,
      revisionId,
      FileAccess.PUBLIC,
    );
    expect(mocks.transaction.news.update).toHaveBeenCalledWith({
      where: { id: newsId },
      data: { archivedAt: null },
    });
    expect(mocks.transaction.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "NEWS_PUBLISHED",
        reason: "เผยแพร่ข่าวที่จัดเก็บอีกครั้งโดย ADMIN",
        after: expect.objectContaining({
          archived: false,
          revisionId,
          status: NewsRevisionStatus.PUBLISHED,
        }),
      }),
    );
  });

  it("requires the editor draft to be reviewed when one exists", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      deletedAt: null,
      archivedAt: new Date(),
      publishedRevision: { id: revisionId, status: NewsRevisionStatus.PUBLISHED },
      workingRevision: { id: "44444444-4444-4444-8444-444444444444" },
    });

    const result = await republishNewsAction({ newsId });

    expect(result.serverError).toEqual({
      code: "POLICY",
      message: "ข่าวนี้มีฉบับร่างที่ต้องตรวจสอบก่อนเผยแพร่",
    });
  });
});
