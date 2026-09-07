import { NewsRevisionStatus, UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    news: { findUnique: vi.fn() },
    newsRevision: { update: vi.fn() },
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
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: vi.fn(),
}));

import { cancelNewsSubmissionAction } from "./cancel-news-submission-action";
const newsId = "11111111-1111-4111-8111-111111111111";
const revisionId = "22222222-2222-4222-8222-222222222222";
const editor = {
  id: "33333333-3333-4333-8333-333333333333",
  role: UserRole.EDITOR,
  isActive: true,
};

describe("cancelNewsSubmissionAction", () => {
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

  it("rejects administrators", async () => {
    mocks.requireManageNews.mockResolvedValue({
      ...editor,
      role: UserRole.ADMIN,
    });
    const result = await cancelNewsSubmissionAction({ newsId });
    expect(result.serverError?.code).toBe("UNAUTHORIZED");
  });

  it("hides another editor's submission", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      authorId: "other",
      deletedAt: null,
      workingRevision: { id: revisionId, status: NewsRevisionStatus.IN_REVIEW },
    });
    const result = await cancelNewsSubmissionAction({ newsId });
    expect(result.serverError?.code).toBe("NOT_FOUND");
    expect(mocks.transaction.newsRevision.update).not.toHaveBeenCalled();
  });

  it("returns an in-review revision to draft and audits the cancellation", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      authorId: editor.id,
      deletedAt: null,
      workingRevision: {
        id: revisionId,
        status: NewsRevisionStatus.IN_REVIEW,
        submittedAt: new Date("2026-08-20T08:00:00.000Z"),
      },
    });
    const result = await cancelNewsSubmissionAction({ newsId });
    expect(result.data).toEqual({ id: newsId });
    expect(mocks.transaction.newsRevision.update).toHaveBeenCalledWith({
      where: { id: revisionId },
      data: {
        status: NewsRevisionStatus.DRAFT,
        reviewedById: null,
        reviewedAt: null,
        reviewReason: null,
      },
    });
    expect(mocks.transaction.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "NEWS_UPDATED",
        reason: "ยกเลิกการส่งตรวจสอบ",
        resourceId: newsId,
      }),
    );
  });
});
