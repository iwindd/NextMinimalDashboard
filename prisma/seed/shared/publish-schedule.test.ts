import { describe, expect, it } from "vitest";
import { getBuddhistYear } from "../../../src/utils/buddhist-year";
import {
  SEED_PUBLISH_YEARS,
  assignPublishYears,
  spreadWithinYear,
  withPublishYear,
} from "./publish-schedule";

describe("withPublishYear", () => {
  it("keeps the day and month and moves the record into the given year", () => {
    const moved = withPublishYear(new Date("2026-06-05T00:00:00.000Z"), 2024);

    expect(moved.toISOString()).toBe("2024-06-05T00:00:00.000Z");
  });

  it("clamps a day that does not exist in the target month", () => {
    const moved = withPublishYear(new Date("2024-02-29T00:00:00.000Z"), 2025);

    expect(moved.toISOString()).toBe("2025-02-28T00:00:00.000Z");
  });

  it("stays inside the intended year when read in Asia/Bangkok", () => {
    for (const year of SEED_PUBLISH_YEARS) {
      const firstOfJanuary = withPublishYear(
        new Date("2025-01-01T00:00:00.000Z"),
        year,
      );
      const lastOfDecember = withPublishYear(
        new Date("2025-12-31T00:00:00.000Z"),
        year,
      );

      // The site labels these with the Buddhist Era year, 543 ahead.
      expect(getBuddhistYear(firstOfJanuary)).toBe(year + 543);
      expect(getBuddhistYear(lastOfDecember)).toBe(year + 543);
    }
  });
});

describe("spreadWithinYear", () => {
  it("produces a valid date for every position in a 300 record run", () => {
    for (let index = 0; index < 300; index += 1) {
      const date = spreadWithinYear(index);

      expect(Number.isNaN(date.getTime())).toBe(false);
      // The month must survive the clamp: a 31st never rolls into the next month.
      expect(date.getUTCMonth()).toBe(index % 12);
    }
  });

  it("spreads consecutive records across months", () => {
    const months = new Set(
      Array.from({ length: 12 }, (_, index) =>
        spreadWithinYear(index).getUTCMonth(),
      ),
    );

    expect(months.size).toBe(12);
  });

  it("stays inside its assigned year once moved", () => {
    for (const year of SEED_PUBLISH_YEARS) {
      for (let index = 0; index < 24; index += 1) {
        const moved = withPublishYear(spreadWithinYear(index), year);
        expect(getBuddhistYear(moved)).toBe(year + 543);
      }
    }
  });
});

describe("assignPublishYears", () => {
  const years = [2024, 2025, 2026];

  it("gives every year at least one publicly visible record", () => {
    const isLivePublished = Array.from({ length: 20 }, (_, index) => index % 2 === 0);

    // A random source that always picks the first year would leave the other
    // two empty without the reservation pass.
    const assigned = assignPublishYears(isLivePublished, years, () => 0);
    const liveYears = new Set(
      assigned.filter((_, index) => isLivePublished[index]),
    );

    expect(assigned).toHaveLength(isLivePublished.length);
    for (const year of years) {
      expect(liveYears).toContain(year);
    }
  });

  it("only ever assigns one of the given years", () => {
    const assigned = assignPublishYears(
      Array.from({ length: 30 }, () => true),
      years,
    );

    for (const year of assigned) {
      expect(years).toContain(year);
    }
  });

  it("fails when there are fewer published records than years", () => {
    expect(() => assignPublishYears([true, true, false, false], years)).toThrow(
      "ไม่พอสำหรับ 3 ปี",
    );
  });

  it("rejects an empty year list", () => {
    expect(() => assignPublishYears([true], [])).toThrow("อย่างน้อย 1 ปี");
  });
});
