import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatatable: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { auditLog: { getDatatable: mocks.getDatatable } },
}));

import { AUDIT_LOG_LIST_SELECT, AUDIT_LOG_SEARCHABLE } from "../helpers";
import type { AuditLogListQuery } from "../types";
import { buildAuditLogWhere, runAuditLogListQuery } from "./audit-log-query";

const userId = "11111111-1111-4111-8111-111111111111";
const baseQuery: AuditLogListQuery = {
  page: 1,
  pageSize: 25,
  search: "",
  relationship: "all",
  sortBy: "createdAt",
  sortDirection: "desc",
};

const row = {
  id: "33333333-3333-4333-8333-333333333333",
  createdAt: new Date("2026-08-27T03:00:00.000Z"),
  action: "USER_NAME_CHANGED" as const,
  resourceType: "USER" as const,
  resourceId: userId,
  actorRole: "ADMIN" as const,
  reason: "แก้ตามคำขอ",
  before: { name: "เดิม" },
  after: { name: "ใหม่" },
  actorUser: { id: userId, name: "Admin", email: "admin@example.com" },
  targetUser: null,
};

describe("buildAuditLogWhere", () => {
  it("does not scope the system-wide timeline", () => {
    expect(buildAuditLogWhere(baseQuery, { kind: "all" })).toEqual({});
  });

  it("includes both sides of a personal timeline by default", () => {
    expect(buildAuditLogWhere(baseQuery, { kind: "user", userId })).toEqual({
      OR: [{ actorUserId: userId }, { targetUserId: userId }],
    });
  });

  it.each([
    ["actor", { actorUserId: userId }],
    ["target", { targetUserId: userId }],
  ] as const)("narrows a personal timeline to %s", (relationship, expected) => {
    expect(
      buildAuditLogWhere({ ...baseQuery, relationship }, { kind: "user", userId }),
    ).toEqual(expected);
  });

  it("ignores the relationship filter on the system-wide timeline", () => {
    expect(
      buildAuditLogWhere({ ...baseQuery, relationship: "actor" }, { kind: "all" }),
    ).toEqual({});
  });

  it("builds enum and role filters", () => {
    expect(
      buildAuditLogWhere(
        {
          ...baseQuery,
          actions: ["LOGIN_FAILED"],
          resourceTypes: ["USER", "PROFILE"],
          actorRole: "EDITOR",
        },
        { kind: "all" },
      ),
    ).toEqual({
      action: { in: ["LOGIN_FAILED"] },
      resourceType: { in: ["USER", "PROFILE"] },
      actorRole: "EDITOR",
    });
  });

  it("omits empty filter lists", () => {
    expect(
      buildAuditLogWhere(
        { ...baseQuery, actions: [], resourceTypes: [] },
        { kind: "all" },
      ),
    ).toEqual({});
  });

  it("converts the date range to Bangkok day boundaries", () => {
    const where = buildAuditLogWhere(
      { ...baseQuery, from: "2026-08-01", to: "2026-08-02" },
      { kind: "all" },
    );

    expect(where.createdAt).toEqual({
      gte: new Date("2026-07-31T17:00:00.000Z"),
      lte: new Date("2026-08-02T16:59:59.999Z"),
    });
  });

  it("supports an open-ended range", () => {
    expect(
      buildAuditLogWhere({ ...baseQuery, from: "2026-08-01" }, { kind: "all" })
        .createdAt,
    ).toEqual({ gte: new Date("2026-07-31T17:00:00.000Z") });
    expect(
      buildAuditLogWhere({ ...baseQuery, to: "2026-08-02" }, { kind: "all" })
        .createdAt,
    ).toEqual({ lte: new Date("2026-08-02T16:59:59.999Z") });
  });
});

describe("runAuditLogListQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDatatable.mockResolvedValue({ data: [row], total: 1 });
  });

  it("keeps timeline ordering deterministic and hides snapshot bodies", async () => {
    await expect(
      runAuditLogListQuery(baseQuery, { kind: "user", userId }),
    ).resolves.toEqual({
      data: [
        {
          id: row.id,
          createdAt: "2026-08-27T03:00:00.000Z",
          action: "USER_NAME_CHANGED",
          resourceType: "USER",
          resourceId: userId,
          actorRole: "ADMIN",
          actor: { id: userId, name: "Admin", email: "admin@example.com" },
          target: null,
          reason: "แก้ตามคำขอ",
          hasBefore: true,
          hasAfter: true,
        },
      ],
      total: 1,
    });

    expect(mocks.getDatatable).toHaveBeenCalledWith({
      query: { ...baseQuery, sortBy: undefined },
      select: AUDIT_LOG_LIST_SELECT,
      searchable: AUDIT_LOG_SEARCHABLE,
      where: { OR: [{ actorUserId: userId }, { targetUserId: userId }] },
      defaultOrderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  });

  it("follows the requested sort direction for the tiebreaker", async () => {
    await runAuditLogListQuery(
      { ...baseQuery, sortDirection: "asc" },
      { kind: "all" },
    );

    expect(mocks.getDatatable).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultOrderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    );
  });

  it("reports missing snapshots", async () => {
    mocks.getDatatable.mockResolvedValue({
      data: [{ ...row, before: null, after: null }],
      total: 1,
    });

    const result = await runAuditLogListQuery(baseQuery, { kind: "all" });

    expect(result.data[0]).toMatchObject({ hasBefore: false, hasAfter: false });
  });
});
