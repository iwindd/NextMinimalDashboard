import { NewsRevisionStatus, UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestNewsChangesAction } from "./request-news-changes-action";
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
const newsId = "11111111-1111-4111-8111-111111111111";
const revisionId = "22222222-2222-4222-8222-222222222222";
const admin = {
  id: "33333333-3333-4333-8333-333333333333",
  role: UserRole.ADMIN,
  isActive: true,
};
describe("requestNewsChangesAction", () => {
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
  it("validates reason before writing", async () => {
    const result = await requestNewsChangesAction({ newsId, reason: "" });
    expect(result.validationErrors?.fieldErrors.reason).toBeDefined();
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });
  it("rejects editors", async () => {
    mocks.requireManageNews.mockResolvedValue({
      ...admin,
      role: UserRole.EDITOR,
    });
    expect(
      (await requestNewsChangesAction({ newsId, reason: "แก้ไข" })).serverError
        ?.code,
    ).toBe("UNAUTHORIZED");
  });
  it("rejects revisions outside review", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      deletedAt: null,
      workingRevision: { id: revisionId, status: NewsRevisionStatus.DRAFT },
    });
    expect(
      (await requestNewsChangesAction({ newsId, reason: "แก้ไข" })).serverError
        ?.code,
    ).toBe("POLICY");
  });
  it("requests changes and audits the reason", async () => {
    mocks.transaction.news.findUnique.mockResolvedValue({
      id: newsId,
      deletedAt: null,
      workingRevision: { id: revisionId, status: NewsRevisionStatus.IN_REVIEW },
    });
    const result = await requestNewsChangesAction({
      newsId,
      reason: " แก้ไข ",
    });
    expect(result.data).toEqual({ id: newsId });
    expect(mocks.transaction.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "NEWS_CHANGES_REQUESTED",
        reason: "แก้ไข",
        resourceId: newsId,
      }),
    );
  });
});
