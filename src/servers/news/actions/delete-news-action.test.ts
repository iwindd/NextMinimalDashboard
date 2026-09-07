import { NewsRevisionStatus, UserRole } from "@prisma/client";
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

import { deleteNewsAction } from "./delete-news-action";

const newsId = "11111111-1111-4111-8111-111111111111";
const editor = {
  id: "22222222-2222-4222-8222-222222222222",
  role: UserRole.EDITOR,
  isActive: true,
};

describe("deleteNewsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireManageNews.mockResolvedValue(editor);
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

  it("soft-deletes an owned draft and records an audit", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      authorId: editor.id,
      deletedAt: null,
      workingRevision: { status: NewsRevisionStatus.DRAFT },
      publishedRevision: null,
    });

    const result = await deleteNewsAction({ newsId });

    expect(result.data).toEqual({ id: newsId });
    expect(mocks.transaction.news.update).toHaveBeenCalledWith({
      where: { id: newsId },
      data: {
        deletedAt: expect.any(Date),
        deletedById: editor.id,
      },
    });
    expect(mocks.transaction.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "NEWS_DELETED",
        resourceType: "NEWS",
        resourceId: newsId,
        after: { deleted: true },
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/news");
  });

  it("allows an admin to delete their own draft", async () => {
    const admin = {
      id: "33333333-3333-4333-8333-333333333333",
      role: UserRole.ADMIN,
      isActive: true,
    };
    mocks.requireManageNews.mockResolvedValue(admin);
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      authorId: admin.id,
      deletedAt: null,
      workingRevision: { status: NewsRevisionStatus.DRAFT },
      publishedRevision: null,
    });

    const result = await deleteNewsAction({ newsId });

    expect(result.data).toEqual({ id: newsId });
    expect(mocks.transaction.news.update).toHaveBeenCalledOnce();
  });

  it.each([
    {
      name: "a published news",
      workingRevision: { status: NewsRevisionStatus.DRAFT },
      publishedRevision: { id: "published-revision" },
    },
    {
      name: "a news in review",
      workingRevision: { status: NewsRevisionStatus.IN_REVIEW },
      publishedRevision: null,
    },
    {
      name: "a news waiting for changes",
      workingRevision: { status: NewsRevisionStatus.CHANGES_REQUESTED },
      publishedRevision: null,
    },
  ])(
    "rejects deleting $name",
    async ({ workingRevision, publishedRevision }) => {
      mocks.transaction.news.findUnique.mockResolvedValue({
        id: newsId,
        authorId: editor.id,
        deletedAt: null,
        workingRevision,
        publishedRevision,
      });

      const result = await deleteNewsAction({ newsId });

      expect(result.serverError).toEqual({
        code: "POLICY",
        message: "เจ้าของลบได้เฉพาะฉบับร่างที่ยังไม่เคยเผยแพร่",
      });
      expect(mocks.transaction.news.update).not.toHaveBeenCalled();
      expect(mocks.transaction.createAuditLog).not.toHaveBeenCalled();
    },
  );

  it("does not reveal or delete another owner's draft", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      authorId: "44444444-4444-4444-8444-444444444444",
      deletedAt: null,
      workingRevision: { status: NewsRevisionStatus.DRAFT },
      publishedRevision: null,
    });

    const result = await deleteNewsAction({ newsId });

    expect(result.serverError).toEqual({
      code: "NOT_FOUND",
      message: "ไม่พบข่าวสาร",
    });
    expect(mocks.transaction.news.update).not.toHaveBeenCalled();
    expect(mocks.transaction.createAuditLog).not.toHaveBeenCalled();
  });

  it("treats an already deleted draft as an idempotent success", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      authorId: editor.id,
      deletedAt: new Date(),
      workingRevision: { status: NewsRevisionStatus.DRAFT },
      publishedRevision: null,
    });

    const result = await deleteNewsAction({ newsId });

    expect(result.data).toEqual({ id: newsId });
    expect(mocks.transaction.news.update).not.toHaveBeenCalled();
    expect(mocks.transaction.createAuditLog).not.toHaveBeenCalled();
  });
});
