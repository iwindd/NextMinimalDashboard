import { UserRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireManageNews: vi.fn(),
  getRequestContext: vi.fn(),
  fetchPageTitle: vi.fn(),
}));

vi.mock("../authorization", () => ({
  requireManageNews: mocks.requireManageNews,
}));
vi.mock("@/lib/audit/request-context", () => ({
  getRequestContext: mocks.getRequestContext,
}));
vi.mock("../source-title", () => ({
  fetchPageTitle: mocks.fetchPageTitle,
}));

import { getSourceTitleAction } from "./get-source-title-action";

const url = "https://example.com/news";

describe("getSourceTitleAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireManageNews.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      role: UserRole.EDITOR,
      isActive: true,
    });
    mocks.getRequestContext.mockResolvedValue({
      requestId: "request",
      ipHash: null,
      userAgent: null,
    });
  });

  it("returns the fetched page title", async () => {
    mocks.fetchPageTitle.mockResolvedValue("Example News");

    const result = await getSourceTitleAction({ url });

    expect(result.data).toEqual({ title: "Example News" });
    expect(mocks.fetchPageTitle).toHaveBeenCalledWith(url);
  });

  it("maps an Error from the title fetcher to a policy error", async () => {
    mocks.fetchPageTitle.mockRejectedValue(new Error("URL ใช้งานไม่ได้"));

    const result = await getSourceTitleAction({ url });

    expect(result.serverError).toEqual({
      code: "POLICY",
      message: "URL ใช้งานไม่ได้",
    });
  });

  it("uses the fallback message for non-Error failures", async () => {
    mocks.fetchPageTitle.mockRejectedValue("request failed");

    const result = await getSourceTitleAction({ url });

    expect(result.serverError).toEqual({
      code: "POLICY",
      message: "ไม่สามารถตรวจสอบ URL นี้ได้",
    });
  });
});
