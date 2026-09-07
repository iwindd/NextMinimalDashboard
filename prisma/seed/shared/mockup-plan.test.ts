import { describe, expect, it } from "vitest";
import { MOCKUP_LIFECYCLE_STATES } from "./lifecycle";
import {
  buildMockupSlots,
  createSetLabeller,
  MOCKUP_CONTENT_COUNT,
  setTitle,
} from "./mockup-plan";

const categories = ["พืชไร่", "พืชสวน", "ปศุสัตว์/ประมง", "แมลงเศรษฐกิจ", "แปรรูป"];

describe("buildMockupSlots", () => {
  it("produces exactly the requested number of records", () => {
    expect(buildMockupSlots({ categories })).toHaveLength(MOCKUP_CONTENT_COUNT);
    expect(buildMockupSlots({ categories, count: 120 })).toHaveLength(120);
  });

  it("covers every state, category and variant combination at least once", () => {
    const slots = buildMockupSlots({
      categories,
      variants: ["A", "B"] as const,
    });
    const seen = new Set(
      slots.map((slot) => `${slot.state}|${slot.category}|${slot.variant}`),
    );

    for (const state of MOCKUP_LIFECYCLE_STATES) {
      for (const category of categories) {
        for (const variant of ["A", "B"]) {
          expect(seen).toContain(`${state}|${category}|${variant}`);
        }
      }
    }
  });

  it("still covers everything when the random source is degenerate", () => {
    // A source that always returns 0 would otherwise leave every category but the
    // first without coverage; the guaranteed combinations are not random.
    const slots = buildMockupSlots({ categories, random: () => 0 });
    const states = new Set(slots.map((slot) => slot.state));
    const covered = new Set(slots.map((slot) => slot.category));

    expect(states.size).toBe(MOCKUP_LIFECYCLE_STATES.length);
    expect(covered.size).toBe(categories.length);
  });

  it("tolerates a random source that returns exactly 1", () => {
    const slots = buildMockupSlots({ categories, random: () => 1 });

    expect(slots).toHaveLength(MOCKUP_CONTENT_COUNT);
    for (const slot of slots) {
      expect(categories).toContain(slot.category);
      expect(MOCKUP_LIFECYCLE_STATES).toContain(slot.state);
    }
  });

  it("rejects a count too small to cover every combination", () => {
    expect(() =>
      buildMockupSlots({ categories, variants: ["A", "B"] as const, count: 20 }),
    ).toThrow("ไม่พอสำหรับทุกสถานะ");
  });

  it("rejects an empty category or variant list", () => {
    expect(() => buildMockupSlots({ categories: [] })).toThrow(
      "ต้องมีหมวดหมู่อย่างน้อย 1 รายการ",
    );
    expect(() => buildMockupSlots({ categories, variants: [] })).toThrow(
      "ต้องมีตัวเลือกย่อยอย่างน้อย 1 รายการ",
    );
  });
});

describe("createSetLabeller", () => {
  it("counts each key independently, starting at 1", () => {
    const labelFor = createSetLabeller();

    expect(labelFor("ก").occurrence).toBe(1);
    expect(labelFor("ก").occurrence).toBe(2);
    expect(labelFor("ข").occurrence).toBe(1);
    expect(labelFor("ก").occurrence).toBe(3);
  });
});

describe("setTitle", () => {
  it("leaves the first use unchanged and numbers every reuse", () => {
    expect(setTitle("การผลิตน้ำผึ้งชันโรง", 1)).toBe("การผลิตน้ำผึ้งชันโรง");
    expect(setTitle("การผลิตน้ำผึ้งชันโรง", 2)).toBe(
      "การผลิตน้ำผึ้งชันโรง ชุดที่ 2",
    );
  });
});
