import { NewsRevisionStatus, UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    news: { findUnique: vi.fn(), update: vi.fn() },
    newsCategory: { findUnique: vi.fn() },
    newsRevision: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    createAuditLog: vi.fn(),
  };
  return {
    requireManageNews: vi.fn(),
    getRequestContext: vi.fn(),
    runTransaction: vi.fn(),
    revalidatePath: vi.fn(),
    syncFiles: vi.fn(),
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
vi.mock("../files/sync-news-revision-files", () => ({
  syncNewsRevisionFiles: mocks.syncFiles,
}));
vi.mock("../publish-news-revision", () => ({
  publishNewsRevision: mocks.publishRevision,
}));

import { updateNewsAction } from "./update-news-action";
const actor = {
  id: "11111111-1111-4111-8111-111111111111",
  role: UserRole.EDITOR,
  isActive: true,
};
const admin = {
  id: "66666666-6666-4666-8666-666666666666",
  role: UserRole.ADMIN,
  isActive: true,
};
const newsId = "22222222-2222-4222-8222-222222222222";
const revisionId = "33333333-3333-4333-8333-333333333333";
const categoryId = "44444444-4444-4444-8444-444444444444";
const input = {
  newsId,
  title: "ข่าวใหม่",
  excerpt: null,
  bodyHtml: "<p>เนื้อหา</p>",
  categoryId,
  coverFileId: null,
  readTimeMinutes: null,
  source: [],
};

describe("updateNewsAction", () => {
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
  });
  it("hides another editor's news", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      authorId: "other",
    });
    expect((await updateNewsAction(input)).serverError?.code).toBe("NOT_FOUND");
  });
  it("rejects editing an in-review revision", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      authorId: actor.id,
      deletedAt: null,
      workingRevision: { id: revisionId, status: NewsRevisionStatus.IN_REVIEW },
      publishedRevision: null,
    });
    expect((await updateNewsAction(input)).serverError?.code).toBe("POLICY");
    expect(mocks.transaction.createAuditLog).not.toHaveBeenCalled();
  });
  it("rejects an editor editing an in-review revision over an active published item", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      authorId: actor.id,
      deletedAt: null,
      archivedAt: null,
      workingRevision: { id: revisionId, status: NewsRevisionStatus.IN_REVIEW },
      publishedRevision: { id: "published" },
    });

    expect((await updateNewsAction(input)).serverError).toEqual({
      code: "POLICY",
      message: "ข่าวที่ส่งตรวจแล้วไม่สามารถแก้ไขได้",
    });
    expect(mocks.transaction.newsRevision.update).not.toHaveBeenCalled();
  });
  it("allows an admin to edit the submitted revision without creating a new version", async () => {
    mocks.requireManageNews.mockResolvedValue(admin);
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      authorId: actor.id,
      deletedAt: null,
      workingRevision: {
        id: revisionId,
        status: NewsRevisionStatus.IN_REVIEW,
        submittedAt: new Date("2026-08-20T08:00:00.000Z"),
      },
      publishedRevision: { id: "published" },
      archivedAt: new Date("2026-08-20T09:00:00.000Z"),
    });

    const result = await updateNewsAction(input);

    expect(result.data).toEqual({ id: newsId, revisionId });
    expect(mocks.transaction.newsRevision.update).toHaveBeenCalledWith({
      where: { id: revisionId },
      data: expect.objectContaining({
        title: input.title,
        bodyHtml: input.bodyHtml,
      }),
    });
    const revisionUpdate = mocks.transaction.newsRevision.update.mock
      .calls[0][0] as { data: Record<string, unknown> };
    expect(revisionUpdate.data.status).toBeUndefined();
    expect(revisionUpdate.data.submittedAt).toBeUndefined();
    expect(mocks.transaction.newsRevision.create).not.toHaveBeenCalled();
    expect(mocks.transaction.news.update).not.toHaveBeenCalled();
    expect(mocks.transaction.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: admin,
        action: "NEWS_UPDATED",
        resourceId: newsId,
      }),
    );
  });
  it.each([
    NewsRevisionStatus.PUBLISHED,
    NewsRevisionStatus.SUPERSEDED,
  ])("rejects editing an immutable %s revision", async (status) => {
    mocks.requireManageNews.mockResolvedValue(admin);
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      authorId: actor.id,
      deletedAt: null,
      workingRevision: { id: revisionId, status },
      publishedRevision: { id: "published" },
    });

    const result = await updateNewsAction(input);

    expect(result.serverError).toEqual({
      code: "POLICY",
      message: "revision ที่เผยแพร่แล้วไม่สามารถแก้ไขได้",
    });
    expect(mocks.transaction.newsRevision.update).not.toHaveBeenCalled();
  });
  it("keeps a changes-requested draft pending resubmission while saving", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      authorId: actor.id,
      deletedAt: null,
      workingRevision: {
        id: revisionId,
        status: NewsRevisionStatus.CHANGES_REQUESTED,
      },
      publishedRevision: { id: "published" },
    });
    const result = await updateNewsAction(input);
    expect(result.data).toEqual({ id: newsId, revisionId });
    const revisionUpdate = mocks.transaction.newsRevision.update.mock
      .calls[0]?.[0] as { data: Record<string, unknown> };
    expect(revisionUpdate.data.status).toBeUndefined();
    expect(revisionUpdate.data.reviewReason).toBeUndefined();
    expect(mocks.publishRevision).not.toHaveBeenCalled();
    expect(mocks.syncFiles).toHaveBeenCalledWith(mocks.transaction, {
      revisionId,
      newsId,
      actor,
      coverFileId: null,
      bodyFileIds: [],
    });
    expect(mocks.transaction.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "NEWS_UPDATED", resourceId: newsId }),
    );
  });
  it("rejects an admin editing a changes-requested revision", async () => {
    mocks.requireManageNews.mockResolvedValue(admin);
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      authorId: actor.id,
      deletedAt: null,
      workingRevision: {
        id: revisionId,
        status: NewsRevisionStatus.CHANGES_REQUESTED,
      },
      publishedRevision: { id: "published" },
    });

    expect((await updateNewsAction(input)).serverError).toEqual({
      code: "POLICY",
      message: "ข่าวที่รอแก้ไขต้องให้ผู้เขียนส่งตรวจสอบอีกครั้งก่อนดำเนินการต่อ",
    });
    expect(mocks.transaction.newsRevision.update).not.toHaveBeenCalled();
  });
  it("creates the next working revision from published content", async () => {
    const newRevisionId = "55555555-5555-4555-8555-555555555555";
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      authorId: actor.id,
      deletedAt: null,
      workingRevision: null,
      publishedRevision: { id: revisionId },
      archivedAt: new Date("2026-08-20T09:00:00.000Z"),
    });
    mocks.transaction.newsRevision.findFirst.mockResolvedValue({ version: 2 });
    mocks.transaction.newsRevision.create.mockResolvedValue({
      id: newRevisionId,
    });
    expect((await updateNewsAction(input)).data).toEqual({
      id: newsId,
      revisionId: newRevisionId,
    });
    expect(mocks.transaction.newsRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        version: 3,
        status: NewsRevisionStatus.DRAFT,
      }),
      select: { id: true },
    });
    expect(mocks.transaction.news.update).toHaveBeenCalledWith({
      where: { id: newsId },
      data: { workingRevisionId: newRevisionId },
    });
  });

  it("publishes the next revision immediately for active published news", async () => {
    const newRevisionId = "77777777-7777-4777-8777-777777777777";
    const publishedRevisionId = "88888888-8888-4888-8888-888888888888";
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      authorId: actor.id,
      deletedAt: null,
      archivedAt: null,
      workingRevision: null,
      publishedRevision: { id: publishedRevisionId },
    });
    mocks.transaction.newsRevision.findFirst.mockResolvedValue({ version: 1 });
    mocks.transaction.newsRevision.create.mockResolvedValue({
      id: newRevisionId,
    });

    const result = await updateNewsAction({
      ...input,
      coverFileId: "99999999-9999-4999-8999-999999999999",
    });

    expect(result.data).toEqual({ id: newsId, revisionId: newRevisionId });
    expect(mocks.publishRevision).toHaveBeenCalledWith(mocks.transaction, {
      newsId,
      revisionId: newRevisionId,
      previousRevisionId: publishedRevisionId,
      reviewedById: null,
    });
    expect(mocks.transaction.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "NEWS_PUBLISHED",
        resourceId: newsId,
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/news");
  });

  it("returns review field errors before auto-publishing incomplete content", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      authorId: actor.id,
      deletedAt: null,
      archivedAt: null,
      workingRevision: null,
      publishedRevision: { id: revisionId },
    });

    const result = await updateNewsAction(input);

    expect(result.serverError).toEqual({
      code: "VALIDATION",
      message: "กรุณากรอกข้อมูลที่จำเป็นให้ครบก่อนส่งตรวจ",
      fieldErrors: { coverFileId: "กรุณาเพิ่มรูปปกข่าว" },
    });
    expect(mocks.transaction.newsRevision.create).not.toHaveBeenCalled();
  });

  it("does not auto-publish an archived news update", async () => {
    const newRevisionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      authorId: actor.id,
      deletedAt: null,
      archivedAt: new Date("2026-08-20T09:00:00.000Z"),
      workingRevision: null,
      publishedRevision: { id: revisionId },
    });
    mocks.transaction.newsRevision.findFirst.mockResolvedValue({ version: 1 });
    mocks.transaction.newsRevision.create.mockResolvedValue({
      id: newRevisionId,
    });

    const result = await updateNewsAction({
      ...input,
      coverFileId: "99999999-9999-4999-8999-999999999999",
    });

    expect(result.data).toEqual({ id: newsId, revisionId: newRevisionId });
    expect(mocks.publishRevision).not.toHaveBeenCalled();
    expect(mocks.transaction.createAuditLog).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "NEWS_PUBLISHED" }),
    );
  });

  it("maps unexpected save failures to the safe internal error", async () => {
    mocks.runTransaction.mockRejectedValue(new Error("database down"));

    const result = await updateNewsAction(input);

    expect(result.serverError).toEqual({
      code: "INTERNAL",
      message: "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง",
    });
  });
});
