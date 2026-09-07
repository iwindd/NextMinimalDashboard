import { FileAccess, UserRole } from "@prisma/client";
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
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: vi.fn(),
}));
vi.mock("../files/sync-news-revision-files", () => ({
  setNewsRevisionFileAccess: mocks.setFileAccess,
}));

import { restoreNewsAction } from "./restore-news-action";
const newsId = "11111111-1111-4111-8111-111111111111";
const admin = {
  id: "22222222-2222-4222-8222-222222222222",
  role: UserRole.ADMIN,
  isActive: true,
};

describe("restoreNewsAction", () => {
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
    expect((await restoreNewsAction({ newsId })).serverError?.code).toBe(
      "UNAUTHORIZED",
    );
  });
  it("restores news, publicizes its published files, and audits", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      deletedAt: new Date(),
      publishedRevisionId: "published",
    });
    const result = await restoreNewsAction({ newsId });
    expect(result.data).toEqual({ id: newsId });
    expect(mocks.setFileAccess).toHaveBeenCalledWith(
      mocks.transaction,
      "published",
      FileAccess.PUBLIC,
    );
    expect(mocks.transaction.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "NEWS_RESTORED", resourceId: newsId }),
    );
  });
  it("does not audit active news", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      deletedAt: null,
      publishedRevisionId: null,
    });
    await restoreNewsAction({ newsId });
    expect(mocks.transaction.news.update).not.toHaveBeenCalled();
    expect(mocks.transaction.createAuditLog).not.toHaveBeenCalled();
  });
});
