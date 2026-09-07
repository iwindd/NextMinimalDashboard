import { describe, expect, it } from "vitest";
import {
  listAuditLogsSchema,
  parseListAuditLogsQuery,
} from "./get-audit-log-list-schema";

const defaults = {
  page: 1,
  pageSize: 25,
  search: "",
  relationship: "all",
  sortBy: "createdAt",
  sortDirection: "desc",
};

describe("listAuditLogsSchema", () => {
  it("applies timeline defaults", () => {
    expect(listAuditLogsSchema.parse({})).toEqual(defaults);
  });

  it("parses comma separated enum filters", () => {
    const parsed = listAuditLogsSchema.parse({
      actions: "USER_CREATED, USER_ROLE_CHANGED",
      resourceTypes: "USER",
    });

    expect(parsed.actions).toEqual(["USER_CREATED", "USER_ROLE_CHANGED"]);
    expect(parsed.resourceTypes).toEqual(["USER"]);
  });

  it("treats an empty filter list as no filter", () => {
    expect(listAuditLogsSchema.parse({ actions: "" }).actions).toEqual([]);
  });

  it("rejects unknown enum values", () => {
    expect(
      listAuditLogsSchema.safeParse({ actions: "NOT_AN_ACTION" }).success,
    ).toBe(false);
    expect(
      listAuditLogsSchema.safeParse({ resourceTypes: "NOT_A_RESOURCE" }).success,
    ).toBe(false);
  });

  it("accepts date-only range filters and rejects other formats", () => {
    expect(
      listAuditLogsSchema.parse({ from: "2026-08-01", to: "2026-08-31" }),
    ).toMatchObject({ from: "2026-08-01", to: "2026-08-31" });

    expect(listAuditLogsSchema.safeParse({ from: "01/08/2026" }).success).toBe(
      false,
    );
    expect(
      listAuditLogsSchema.safeParse({ from: "2026-08-01T10:00:00Z" }).success,
    ).toBe(false);
    expect(listAuditLogsSchema.safeParse({ from: "2026-02-30" }).success).toBe(
      false,
    );
  });

  it("bounds pagination", () => {
    expect(listAuditLogsSchema.safeParse({ pageSize: 500 }).success).toBe(false);
    expect(listAuditLogsSchema.safeParse({ pageSize: 1 }).success).toBe(false);
    expect(listAuditLogsSchema.safeParse({ page: 0 }).success).toBe(false);
  });

  it("only allows sorting by the timeline column", () => {
    expect(listAuditLogsSchema.safeParse({ sortBy: "action" }).success).toBe(
      false,
    );
  });
});

describe("parseListAuditLogsQuery", () => {
  it("reads filters from the URL", () => {
    const query = parseListAuditLogsQuery(
      new URLSearchParams({
        page: "3",
        pageSize: "50",
        search: " admin ",
        actions: "LOGIN_FAILED",
        relationship: "actor",
        sortDirection: "asc",
      }),
    );

    expect(query).toEqual({
      ...defaults,
      page: 3,
      pageSize: 50,
      search: "admin",
      actions: ["LOGIN_FAILED"],
      relationship: "actor",
      sortDirection: "asc",
    });
  });

  it("falls back to defaults for malformed URLs", () => {
    expect(
      parseListAuditLogsQuery(new URLSearchParams({ pageSize: "-5" })),
    ).toEqual(defaults);
  });
});
