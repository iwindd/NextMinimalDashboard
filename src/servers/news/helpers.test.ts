import { NewsRevisionStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  extractNewsFileIds,
  newsDraftFieldsSchema,
  normalizeNewsSources,
  sanitizeNewsBody,
  toNewsListItem,
} from "./helpers";

describe("news helpers", () => {
  it("removes executable markup while retaining rich text", () => {
    const result = sanitizeNewsBody('<p>Hello</p><script>alert(1)</script><p onclick="bad()">World</p>');
    expect(result).toContain("<p>Hello</p>");
    expect(result).toContain("<p>World</p>");
    expect(result).not.toContain("script");
    expect(result).not.toContain("onclick");
  });

  it("extracts unique managed file IDs from rich text", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    expect(
      extractNewsFileIds(
        `<img src="/api/files/${id}"><img src="/api/files/${id}">`,
      ),
    ).toEqual([id]);
  });

  it("normalizes legacy and JSON source values", () => {
    expect(normalizeNewsSources("หน่วยงานเดิม")).toEqual([
      { url: "", title: "หน่วยงานเดิม" },
    ]);
    expect(normalizeNewsSources([{ url: "https://example.com", title: "เว็บ" }])).toEqual([
      { url: "https://example.com", title: "เว็บ" },
    ]);
    expect(normalizeNewsSources(null)).toEqual([]);
  });

  it("requires both URL and title for each source item", () => {
    expect(newsDraftFieldsSchema.safeParse({ title: "ข่าว", source: [] }).success).toBe(true);
    expect(newsDraftFieldsSchema.safeParse({ title: "ข่าว", source: [{ url: "https://example.com", title: "" }] }).success).toBe(false);
    expect(newsDraftFieldsSchema.safeParse({ title: "ข่าว", source: [{ url: "not-a-url", title: "เว็บ" }] }).success).toBe(false);
    expect(newsDraftFieldsSchema.safeParse({ title: "ข่าว", source: [{ url: "https://example.com", title: "เว็บ" }, { url: "https://example.org", title: "อีกเว็บ" }] }).success).toBe(true);
  });

  it("presents a reviewed draft as changes requested for admin lists", () => {
    const reviewedAt = new Date("2026-08-22T00:00:00.000Z");
    const news = {
      id: "news",
      authorId: null,
      publishedRevisionId: null,
      workingRevisionId: "revision",
      deletedById: null,
      author: null,
      viewCount: 0,
      deletedAt: null,
      archivedAt: null,
      createdAt: reviewedAt,
      updatedAt: reviewedAt,
      workingRevision: {
        id: "revision",
        newsId: "news",
        version: 1,
        status: NewsRevisionStatus.DRAFT,
        title: "ข่าว",
        excerpt: null,
        bodyHtml: "<p>เนื้อหา</p>",
        categoryId: null,
        readTimeMinutes: null,
        source: [],
        createdById: null,
        reviewedById: "reviewer",
        reviewReason: null,
        submittedAt: reviewedAt,
        reviewedAt,
        publishedAt: null,
        createdAt: reviewedAt,
        updatedAt: reviewedAt,
        category: null,
        files: [],
      },
      publishedRevision: null,
    } as Parameters<typeof toNewsListItem>[0];

    expect(
      toNewsListItem(news, { reviewedDraftAsChangesRequested: true }).status,
    ).toBe(NewsRevisionStatus.CHANGES_REQUESTED);
    expect(toNewsListItem(news).status).toBe(NewsRevisionStatus.DRAFT);
  });
});
