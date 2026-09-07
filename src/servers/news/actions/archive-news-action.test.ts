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
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("../files/sync-news-revision-files", () => ({
  setNewsRevisionFileAccess: mocks.setFileAccess,
}));

import { archiveNewsAction } from "./archive-news-action";

const newsId = "11111111-1111-4111-8111-111111111111";
const revisionId = "22222222-2222-4222-8222-222222222222";
const admin = {
  id: "33333333-3333-4333-8333-333333333333",
  role: UserRole.ADMIN,
  isActive: true,
};

describe("archiveNewsAction", () => {
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

    const result = await archiveNewsAction({ newsId });

    expect(result.serverError?.code).toBe("UNAUTHORIZED");
    expect(mocks.transaction.news.findUnique).not.toHaveBeenCalled();
  });

  it("only archives news that has a published revision", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      deletedAt: null,
      archivedAt: null,
      publishedRevision: null,
    });

    const result = await archiveNewsAction({ newsId });

    expect(result.serverError).toEqual({
      code: "POLICY",
      message: "จัดเก็บได้เฉพาะข่าวที่เคยเผยแพร่แล้ว",
    });
  });

  it("returns not found when the news does not exist", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue(null);

    expect((await archiveNewsAction({ newsId })).serverError).toEqual({
      code: "NOT_FOUND",
      message: "ไม่พบข่าวสาร",
    });
  });

  it("rejects deleted news", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      deletedAt: new Date("2026-08-20T08:00:00.000Z"),
      archivedAt: null,
      publishedRevision: { id: revisionId },
    });

    expect((await archiveNewsAction({ newsId })).serverError).toEqual({
      code: "POLICY",
      message: "ข่าวนี้ถูกลบแล้ว",
    });
  });

  it("rejects news that is already archived", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      deletedAt: null,
      archivedAt: new Date("2026-08-20T08:00:00.000Z"),
      publishedRevision: { id: revisionId },
    });

    expect((await archiveNewsAction({ newsId })).serverError).toEqual({
      code: "POLICY",
      message: "ข่าวนี้ถูกจัดเก็บอยู่แล้ว",
    });
  });

  it("makes published files private, records an audit, and archives the news", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      deletedAt: null,
      archivedAt: null,
      publishedRevision: { id: revisionId },
    });

    const result = await archiveNewsAction({
      newsId,
      note: "ข่าวหมดช่วงเผยแพร่แล้ว",
    });

    expect(result.data).toEqual({ id: newsId });
    expect(mocks.setFileAccess).toHaveBeenCalledWith(
      mocks.transaction,
      revisionId,
      FileAccess.PRIVATE,
    );
    expect(mocks.transaction.news.update).toHaveBeenCalledWith({
      where: { id: newsId },
      data: { archivedAt: expect.any(Date) },
    });
    expect(mocks.transaction.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "NEWS_ARCHIVED",
        resourceId: newsId,
        reason: "ข่าวหมดช่วงเผยแพร่แล้ว",
        after: expect.objectContaining({
          archived: true,
          revisionId,
          note: "ข่าวหมดช่วงเผยแพร่แล้ว",
        }),
      }),
    );
  });

  it("archives without adding an optional note", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      deletedAt: null,
      archivedAt: null,
      publishedRevision: { id: revisionId },
    });

    const result = await archiveNewsAction({ newsId });

    expect(result.data).toEqual({ id: newsId });
    expect(mocks.transaction.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: undefined,
        after: expect.not.objectContaining({ note: expect.anything() }),
      }),
    );
  });
});
