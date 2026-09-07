import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireViewAllAuditLogs: vi.fn(),
  requireOwnAuditLogs: vi.fn(),
  runAuditLogListQuery: vi.fn(),
}));

vi.mock("../authorization", () => ({
  requireViewAllAuditLogs: mocks.requireViewAllAuditLogs,
  requireOwnAuditLogs: mocks.requireOwnAuditLogs,
}));
vi.mock("./audit-log-query", () => ({
  runAuditLogListQuery: mocks.runAuditLogListQuery,
}));

import type { AuditLogListQuery } from "../types";
import { getAuditLogList } from "./get-audit-log-list";
import { getOwnAuditLogList } from "./get-own-audit-log-list";
import { getUserAuditLogList } from "./get-user-audit-log-list";

const actorId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const query: AuditLogListQuery = {
  page: 1,
  pageSize: 25,
  search: "",
  relationship: "all",
  sortBy: "createdAt",
  sortDirection: "desc",
};
const emptyResult = { data: [], total: 0 };

describe("audit log list scopes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireViewAllAuditLogs.mockResolvedValue({
      id: actorId,
      role: "ADMIN",
      isActive: true,
    });
    mocks.requireOwnAuditLogs.mockResolvedValue({
      id: actorId,
      role: "EDITOR",
      isActive: true,
    });
    mocks.runAuditLogListQuery.mockResolvedValue(emptyResult);
  });

  it("reads the system-wide timeline for administrators", async () => {
    await expect(getAuditLogList(query)).resolves.toEqual(emptyResult);
    expect(mocks.runAuditLogListQuery).toHaveBeenCalledWith(query, {
      kind: "all",
    });
  });

  it("reads a managed user timeline for administrators", async () => {
    await getUserAuditLogList(targetId, query);

    expect(mocks.runAuditLogListQuery).toHaveBeenCalledWith(query, {
      kind: "user",
      userId: targetId,
    });
  });

  it("returns nothing for a malformed user id instead of widening the scope", async () => {
    await expect(getUserAuditLogList("not-a-uuid", query)).resolves.toEqual(
      emptyResult,
    );
    expect(mocks.runAuditLogListQuery).not.toHaveBeenCalled();
  });

  it("derives the own timeline scope from the session actor", async () => {
    await getOwnAuditLogList({ ...query, relationship: "actor" });

    expect(mocks.runAuditLogListQuery).toHaveBeenCalledWith(
      { ...query, relationship: "actor" },
      { kind: "user", userId: actorId },
    );
  });

  it.each([
    [
      "system-wide",
      () => getAuditLogList(query),
      mocks.requireViewAllAuditLogs,
    ],
    [
      "managed user",
      () => getUserAuditLogList(targetId, query),
      mocks.requireViewAllAuditLogs,
    ],
    ["own", () => getOwnAuditLogList(query), mocks.requireOwnAuditLogs],
  ])("does not read %s logs when authorization fails", async (_label, run, guard) => {
    guard.mockRejectedValue(new Error("unauthorized"));

    await expect(run()).rejects.toThrow("unauthorized");
    expect(mocks.runAuditLogListQuery).not.toHaveBeenCalled();
  });
});
