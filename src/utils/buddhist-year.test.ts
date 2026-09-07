import { describe, expect, it } from "vitest";
import {
  collectBuddhistYears,
  filterByBuddhistYear,
  getBuddhistYear,
  parseBuddhistYearSegment,
} from "./buddhist-year";

describe("getBuddhistYear", () => {
  it("converts a Gregorian date to its Buddhist Era year", () => {
    expect(getBuddhistYear("2025-06-15T03:00:00.000Z")).toBe(2568);
    expect(getBuddhistYear("2026-06-15T03:00:00.000Z")).toBe(2569);
  });

  it("resolves the year in the Asia/Bangkok timezone", () => {
    // 2025-12-31T17:30Z is already 2026-01-01 00:30 in Bangkok (UTC+7).
    expect(getBuddhistYear("2025-12-31T17:30:00.000Z")).toBe(2569);
    // 2026-01-01T00:30Z is still 2026-01-01 07:30 in Bangkok.
    expect(getBuddhistYear("2026-01-01T00:30:00.000Z")).toBe(2569);
    // 2025-12-31T16:30Z is 2025-12-31 23:30 in Bangkok.
    expect(getBuddhistYear("2025-12-31T16:30:00.000Z")).toBe(2568);
  });

  it("accepts Date instances", () => {
    expect(getBuddhistYear(new Date("2024-03-01T00:00:00.000Z"))).toBe(2567);
  });

  it("returns null for missing or invalid values", () => {
    expect(getBuddhistYear(null)).toBeNull();
    expect(getBuddhistYear(undefined)).toBeNull();
    expect(getBuddhistYear("not-a-date")).toBeNull();
  });
});

describe("parseBuddhistYearSegment", () => {
  it("accepts four digit year segments", () => {
    expect(parseBuddhistYearSegment("2568")).toBe(2568);
    expect(parseBuddhistYearSegment("2569")).toBe(2569);
  });

  it("rejects segments that are not four digit years", () => {
    expect(parseBuddhistYearSegment("cmf0k1x2y3z4a5b6c7d8e9f0g")).toBeNull();
    expect(parseBuddhistYearSegment("256")).toBeNull();
    expect(parseBuddhistYearSegment("25688")).toBeNull();
    expect(parseBuddhistYearSegment("2568a")).toBeNull();
    expect(parseBuddhistYearSegment("")).toBeNull();
  });
});

describe("collectBuddhistYears", () => {
  it("returns unique years sorted newest first", () => {
    expect(
      collectBuddhistYears([
        "2025-01-05T00:00:00.000Z",
        "2026-02-05T00:00:00.000Z",
        "2025-11-05T00:00:00.000Z",
        "2024-11-05T00:00:00.000Z",
      ]),
    ).toEqual([2569, 2568, 2567]);
  });

  it("skips invalid values and returns an empty list when nothing is usable", () => {
    expect(collectBuddhistYears([null, "not-a-date"])).toEqual([]);
    expect(collectBuddhistYears([null, "2026-02-05T00:00:00.000Z"])).toEqual([
      2569,
    ]);
  });
});

describe("filterByBuddhistYear", () => {
  const items = [
    { id: "a", publishedAt: "2026-02-05T00:00:00.000Z" },
    { id: "b", publishedAt: "2025-02-05T00:00:00.000Z" },
    { id: "c", publishedAt: "2025-12-31T17:30:00.000Z" },
  ];

  it("keeps only the items published in the requested year", () => {
    expect(filterByBuddhistYear(items, 2569).map((item) => item.id)).toEqual([
      "a",
      "c",
    ]);
    expect(filterByBuddhistYear(items, 2568).map((item) => item.id)).toEqual([
      "b",
    ]);
  });

  it("returns an empty list for a year without content", () => {
    expect(filterByBuddhistYear(items, 2500)).toEqual([]);
  });
});
