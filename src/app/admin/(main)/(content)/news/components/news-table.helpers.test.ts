import { describe, expect, it } from "vitest";
import type { NewsListItem } from "@/servers/news/types";
import {
  getActiveNewsTab,
  getNewsDisplayStatus,
  getNewsStatusBadgeColor,
  getNewsTabQueryValue,
} from "./news-table.helpers";

const record = (overrides: Partial<NewsListItem> = {}) =>
  ({
    id: "news",
    title: "ข่าว",
    excerpt: null,
    category: null,
    coverUrl: null,
    status: "IN_REVIEW",
    author: null,
    viewCount: 0,
    deletedAt: null,
    archivedAt: null,
    updatedAt: "2026-08-21T00:00:00.000Z",
    publishedAt: null,
    ...overrides,
  }) as NewsListItem;

describe("getNewsDisplayStatus", () => {
  it("distinguishes republish requests from normal reviews", () => {
    expect(getNewsDisplayStatus(record())).toBe("IN_REVIEW");
    expect(
      getNewsDisplayStatus(record({ archivedAt: "2026-08-21T00:00:00.000Z" })),
    ).toBe("REPUBLISH");
  });

  it("uses archived status before published status", () => {
    expect(
      getNewsDisplayStatus(
        record({ status: "PUBLISHED", archivedAt: "2026-08-21T00:00:00.000Z" }),
      ),
    ).toBe("ARCHIVED");
  });
});

describe("news status tabs", () => {
  it("uses all for default, legacy multi-status, and republish URLs", () => {
    expect(getActiveNewsTab("all")).toBe("all");
    expect(getActiveNewsTab(["in_review", "published"])).toBe("all");
    expect(getActiveNewsTab(["republish"])).toBe("all");
  });

  it("maps a single tab to its status query and clears all", () => {
    expect(getActiveNewsTab(["draft"])).toBe("draft");
    expect(getActiveNewsTab(["changes_requested"])).toBe("changes_requested");
    expect(getNewsTabQueryValue("all")).toBeUndefined();
    expect(getNewsTabQueryValue("archived")).toBe("archived");
  });
});

describe("getNewsStatusBadgeColor", () => {
  it("reuses the datatable status colors for each tab", () => {
    expect(getNewsStatusBadgeColor("all")).toBe("gray");
    expect(getNewsStatusBadgeColor("draft")).toBe("gray");
    expect(getNewsStatusBadgeColor("in_review")).toBe("blue");
    expect(getNewsStatusBadgeColor("published")).toBe("green");
    expect(getNewsStatusBadgeColor("archived")).toBe("dark");
    expect(getNewsStatusBadgeColor("changes_requested")).toBe("orange");
  });

  it("returns the same color for a table status", () => {
    expect(getNewsStatusBadgeColor("REPUBLISH")).toBe("violet");
  });
});
