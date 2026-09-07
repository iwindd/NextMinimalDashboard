import { describe, expect, it } from "vitest";
import { buildPrismaOrderBy, buildPrismaSearchOr } from "./datatable.helpers";

describe("datatable helpers", () => {
  it("returns no search conditions for an empty keyword", () => {
    expect(
      buildPrismaSearchOr("", {
        name: { mode: "insensitive" },
      }),
    ).toEqual([]);
  });

  it("builds nested contains and hasSome search conditions", () => {
    expect(
      buildPrismaSearchOr("alice", {
        name: { mode: "insensitive" },
        tags: { hasSome: ["admin"] },
        profile: { email: { mode: "insensitive" } },
      }),
    ).toEqual([
      { name: { contains: "alice", mode: "insensitive" } },
      { tags: { hasSome: ["alice", "admin"] } },
      { profile: { email: { contains: "alice", mode: "insensitive" } } },
    ]);
  });

  it("builds an order by entry or leaves it undefined", () => {
    expect(buildPrismaOrderBy("email", "asc")).toEqual([
      { email: "asc" },
    ]);
    expect(buildPrismaOrderBy()).toBeUndefined();
  });
});
