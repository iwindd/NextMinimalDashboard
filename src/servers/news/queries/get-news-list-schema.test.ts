import { describe, expect, it } from "vitest";
import { parseListNewsQuery } from "./get-news-list-schema";

describe("parseListNewsQuery", () => {
  it("defaults the main list to status priority order", () => {
    expect(parseListNewsQuery(new URLSearchParams())).toMatchObject({
      status: "all",
      sortBy: "status",
      sortDirection: "asc",
    });
  });

  it("accepts the draft tab status and ignores legacy trash parameters", () => {
    expect(
      parseListNewsQuery(new URLSearchParams("status=draft&trash=true")),
    ).toMatchObject({
      status: ["draft"],
      sortBy: "status",
      sortDirection: "asc",
    });
  });

  it("parses repeated and comma-separated status filters", () => {
    expect(
      parseListNewsQuery(
        new URLSearchParams("status=in_review&status=published"),
      ).status,
    ).toEqual(["in_review", "published"]);
    expect(
      parseListNewsQuery(new URLSearchParams("status=in_review,published"))
        .status,
    ).toEqual(["in_review", "published"]);
  });

  it("accepts the archived status filter", () => {
    expect(
      parseListNewsQuery(new URLSearchParams("status=archived")).status,
    ).toEqual(["archived"]);
  });
});

