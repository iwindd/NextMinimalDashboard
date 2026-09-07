import { describe, expect, it } from "vitest";
import { parseListUsersQuery } from "./get-user-list-schema";

describe("parseListUsersQuery", () => {
  it("coerces and normalizes supported query parameters", () => {
    const params = new URLSearchParams({
      page: "2",
      pageSize: "25",
      search: "  alice  ",
      role: "ADMIN",
      status: "active",
      sortBy: "email",
      sortDirection: "asc",
    });

    expect(parseListUsersQuery(params)).toEqual({
      page: 2,
      pageSize: 25,
      search: "alice",
      role: "ADMIN",
      status: "active",
      sortBy: "email",
      sortDirection: "asc",
    });
  });

  it("falls back to all defaults when any parameter is invalid", () => {
    expect(
      parseListUsersQuery(new URLSearchParams({ page: "0", role: "OWNER" })),
    ).toEqual({
      page: 1,
      pageSize: 10,
      search: "",
      status: "all",
      sortBy: "createdAt",
      sortDirection: "desc",
    });
  });
});
