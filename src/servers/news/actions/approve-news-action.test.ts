import { NewsRevisionStatus, UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    news: { findUnique: vi.fn(), update: vi.fn() },
    newsRevision: { update: vi.fn() },
    createAuditLog: vi.fn(),
  };
  return {
    requireManageNews: vi.fn(),
    getRequestContext: vi.fn(),
    runTransaction: vi.fn(),
    revalidatePath: vi.fn(),
    publishRevision: vi.fn(),
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
vi.mock("../publish-news-revision", () => ({
  publishNewsRevision: mocks.publishRevision,
}));

import { approveNewsAction } from "./approve-news-action";
const newsId = "11111111-1111-4111-8111-111111111111";
const revisionId = "22222222-2222-4222-8222-222222222222";
const admin = {
  id: "33333333-3333-4333-8333-333333333333",
  role: UserRole.ADMIN,
  isActive: true,
};

describe("approveNewsAction", () => {
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

  it("rejects editors before querying news", async () => {
    mocks.requireManageNews.mockResolvedValue({
      ...admin,
      role: UserRole.EDITOR,
    });
    const result = await approveNewsAction({ newsId });
    expect(result.serverError?.code).toBe("UNAUTHORIZED");
    expect(mocks.transaction.news.findUnique).not.toHaveBeenCalled();
  });

  it("requires a cover reference", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      deletedAt: null,
      workingRevision: {
        id: revisionId,
        status: NewsRevisionStatus.IN_REVIEW,
        files: [],
      },
      publishedRevision: null,
    });
    const result = await approveNewsAction({ newsId });
    expect(result.serverError).toEqual({
      code: "POLICY",
      message: "กรุณาเพิ่มรูปปกก่อนเผยแพร่ข่าว",
    });
    expect(mocks.transaction.createAuditLog).not.toHaveBeenCalled();
  });

  it("requires a changes-requested revision to be submitted again", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      deletedAt: null,
      workingRevision: {
        id: revisionId,
        status: NewsRevisionStatus.CHANGES_REQUESTED,
        title: "ข่าวที่แก้ไขแล้ว",
        bodyHtml: "<p>เนื้อหาข่าว</p>",
        files: [{ reference: { fileId: newsId } }],
      },
      publishedRevision: null,
    });

    const result = await approveNewsAction({ newsId });

    expect(result.serverError).toEqual({
      code: "POLICY",
      message: "กรุณาส่งข่าวตรวจสอบอีกครั้งก่อนเผยแพร่",
    });
    expect(mocks.publishRevision).not.toHaveBeenCalled();
    expect(mocks.transaction.createAuditLog).not.toHaveBeenCalled();
  });

  it("publishes files and revision, supersedes the previous revision, and audits", async () => {
    const oldRevisionId = "44444444-4444-4444-8444-444444444444";
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      deletedAt: null,
      workingRevision: {
        id: revisionId,
        status: NewsRevisionStatus.IN_REVIEW,
        title: "ข่าวพร้อมเผยแพร่",
        bodyHtml: "<p>เนื้อหาข่าว</p>",
        files: [{ reference: { id: "ref", fileId: newsId } }],
      },
      publishedRevision: { id: oldRevisionId },
    });
    const result = await approveNewsAction({ newsId });
    expect(result.data).toEqual({ id: newsId });
    expect(mocks.publishRevision).toHaveBeenCalledWith(mocks.transaction, {
      newsId,
      revisionId,
      previousRevisionId: oldRevisionId,
      reviewedById: admin.id,
    });
    expect(mocks.transaction.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "NEWS_PUBLISHED", resourceId: newsId }),
    );
  });

  it("rejects incomplete drafts before publishing", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      deletedAt: null,
      workingRevision: {
        id: revisionId,
        status: NewsRevisionStatus.DRAFT,
        title: "ข่าวที่ยังไม่สมบูรณ์",
        bodyHtml: "<p></p>",
        files: [{ reference: { id: "ref", fileId: newsId } }],
      },
      publishedRevision: null,
    });

    const result = await approveNewsAction({ newsId });

    expect(result.serverError).toEqual({
      code: "VALIDATION",
      message: "กรุณากรอกข้อมูลที่จำเป็นให้ครบก่อนส่งตรวจ",
      fieldErrors: { bodyHtml: "กรุณากรอกเนื้อหาข่าว" },
    });
    expect(mocks.transaction.newsRevision.update).not.toHaveBeenCalled();
  });
});
