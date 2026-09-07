import { NewsRevisionStatus, UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitNewsAction } from "./submit-news-action";
const mocks = vi.hoisted(() => {
  const transaction = {
    news: { findUnique: vi.fn(), update: vi.fn() },
    newsRevision: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
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
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  revalidateTag: vi.fn(),
}));
vi.mock("../files/sync-news-revision-files", () => ({
  syncNewsRevisionFiles: mocks.syncFiles,
}));
const newsId = "11111111-1111-4111-8111-111111111111";
const revisionId = "22222222-2222-4222-8222-222222222222";
const editor = {
  id: "33333333-3333-4333-8333-333333333333",
  role: UserRole.EDITOR,
  isActive: true,
};
function target(overrides: Record<string, unknown> = {}) {
  return {
    id: newsId,
    authorId: editor.id,
    deletedAt: null,
    workingRevision: {
      id: revisionId,
      status: NewsRevisionStatus.DRAFT,
      title: "ข่าว",
      bodyHtml: "<p>เนื้อหา</p>",
      files: [
        {
          purpose: "COVER",
          reference: { fileId: "44444444-4444-4444-8444-444444444444" },
        },
      ],
    },
    ...overrides,
  };
}
describe("submitNewsAction", () => {
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
  it("hides another editor's draft", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue(
      target({ authorId: "other" }),
    );
    expect((await submitNewsAction({ newsId })).serverError?.code).toBe(
      "NOT_FOUND",
    );
  });
  it("returns field errors when review-required content is incomplete", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue(
      target({
        workingRevision: {
          id: revisionId,
          status: NewsRevisionStatus.DRAFT,
          title: "",
          bodyHtml: "<p></p>",
          files: [],
        },
      }),
    );
    const result = await submitNewsAction({ newsId });
    expect(result.serverError).toEqual(
      expect.objectContaining({
        code: "VALIDATION",
        fieldErrors: expect.objectContaining({
          title: expect.any(String),
          coverFileId: expect.any(String),
          bodyHtml: expect.any(String),
        }),
      }),
    );
    expect(mocks.transaction.createAuditLog).not.toHaveBeenCalled();
  });
  it("does not treat a body file as a cover", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue(
      target({
        workingRevision: {
          ...target().workingRevision,
          files: [
            {
              purpose: "BODY",
              reference: { fileId: "55555555-5555-4555-8555-555555555555" },
            },
          ],
        },
      }),
    );

    const result = await submitNewsAction({ newsId });

    expect(result.serverError).toEqual(
      expect.objectContaining({
        code: "VALIDATION",
        fieldErrors: expect.objectContaining({
          coverFileId: expect.any(String),
        }),
      }),
    );
    expect(mocks.transaction.newsRevision.update).not.toHaveBeenCalled();
  });
  it("rejects a revision outside submittable statuses", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue(
      target({
        workingRevision: {
          ...target().workingRevision,
          status: NewsRevisionStatus.IN_REVIEW,
        },
      }),
    );
    expect((await submitNewsAction({ newsId })).serverError?.code).toBe(
      "POLICY",
    );
  });
  it.each([NewsRevisionStatus.DRAFT, NewsRevisionStatus.CHANGES_REQUESTED])(
    "submits %s and audits",
    async (status) => {
      mocks.transaction.news.findUnique.mockResolvedValue(
        target({ workingRevision: { ...target().workingRevision, status } }),
      );
      const result = await submitNewsAction({ newsId });
      expect(result.data).toEqual({ id: newsId });
      expect(mocks.transaction.newsRevision.update).toHaveBeenCalledWith({
        where: { id: revisionId },
        data: expect.objectContaining({
          status: NewsRevisionStatus.IN_REVIEW,
          submittedAt: expect.any(Date),
        }),
      });
      expect(mocks.transaction.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "NEWS_SUBMITTED",
          resourceId: newsId,
        }),
      );
    },
  );

  it("clones the published revision before an archived editor requests republishing", async () => {
    const clonedRevisionId = "55555555-5555-4555-8555-555555555555";
    const publishedRevisionId = "66666666-6666-4666-8666-666666666666";
    const coverFileId = "77777777-7777-4777-8777-777777777777";
    const bodyFileId = "88888888-8888-4888-8888-888888888888";
    mocks.transaction.news.findUnique.mockResolvedValue(
      target({
        workingRevision: null,
        archivedAt: new Date("2026-08-20T09:00:00.000Z"),
        publishedRevision: {
          id: publishedRevisionId,
          title: "ข่าวที่เผยแพร่แล้ว",
          excerpt: "คำโปรย",
          bodyHtml: `<p>เนื้อหา</p><img src="/api/files/${bodyFileId}" />`,
          categoryId: null,
          readTimeMinutes: 5,
          source: [],
          files: [
            {
              purpose: "COVER",
              reference: { fileId: coverFileId },
            },
            {
              purpose: "BODY",
              reference: { fileId: bodyFileId },
            },
          ],
        },
      }),
    );
    mocks.transaction.newsRevision.findFirst.mockResolvedValue({ version: 2 });
    mocks.transaction.newsRevision.create.mockResolvedValue({
      id: clonedRevisionId,
    });

    const result = await submitNewsAction({ newsId });

    expect(result.data).toEqual({ id: newsId });
    expect(mocks.transaction.newsRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        newsId,
        version: 3,
        title: "ข่าวที่เผยแพร่แล้ว",
        status: NewsRevisionStatus.DRAFT,
      }),
      select: { id: true },
    });
    expect(mocks.syncFiles).toHaveBeenCalledWith(mocks.transaction, {
      revisionId: clonedRevisionId,
      newsId,
      actor: editor,
      coverFileId,
      bodyFileIds: [bodyFileId],
    });
    expect(mocks.transaction.news.update).toHaveBeenCalledWith({
      where: { id: newsId },
      data: { workingRevisionId: clonedRevisionId },
    });
    expect(mocks.transaction.newsRevision.update).toHaveBeenCalledWith({
      where: { id: clonedRevisionId },
      data: expect.objectContaining({ status: NewsRevisionStatus.IN_REVIEW }),
    });
  });
});
