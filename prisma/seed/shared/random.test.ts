import { describe, expect, it } from "vitest";
import { pick, pickIndex, shuffle } from "./random";

describe("shuffle", () => {
  it("keeps every item and leaves the input untouched", () => {
    const items = [1, 2, 3, 4, 5];
    const shuffled = shuffle(items, () => 0.5);

    expect([...shuffled].sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });

  it("tolerates a random source that returns exactly 1", () => {
    expect(shuffle([1, 2, 3], () => 1)).toHaveLength(3);
  });
});

describe("pickIndex", () => {
  it("stays inside the range for the extremes of the random source", () => {
    expect(pickIndex(5, () => 0)).toBe(0);
    expect(pickIndex(5, () => 1)).toBe(4);
    expect(pickIndex(5, () => 0.999999)).toBe(4);
  });

  it("rejects an empty range", () => {
    expect(() => pickIndex(0)).toThrow("ต้องมีตัวเลือกอย่างน้อย 1 รายการ");
  });
});

describe("pick", () => {
  it("returns a member of the list", () => {
    expect(pick(["ก", "ข", "ค"], () => 1)).toBe("ค");
    expect(pick(["ก", "ข", "ค"], () => 0)).toBe("ก");
  });
});
