import { describe, expect, it } from "vitest";
import {
  CONTENT_CATEGORY_NAMES,
  normalizeContentCategoryName,
  requireSeedCategoryId,
  seedContentCategories,
} from "./content-categories";

describe("CONTENT_CATEGORY_NAMES", () => {
  it("is the five shared content categories", () => {
    expect([...CONTENT_CATEGORY_NAMES]).toEqual([
      "พืชไร่",
      "พืชสวน",
      "ปศุสัตว์/ประมง",
      "แมลงเศรษฐกิจ",
      "แปรรูป",
    ]);
  });

  it("normalizes to five distinct keys", () => {
    const keys = new Set(CONTENT_CATEGORY_NAMES.map(normalizeContentCategoryName));
    expect(keys.size).toBe(CONTENT_CATEGORY_NAMES.length);
  });
});

describe("normalizeContentCategoryName", () => {
  it("applies NFKC, trim, whitespace collapse and lowercase in order", () => {
    expect(normalizeContentCategoryName("  Poster   Design  ")).toBe("poster design");
  });

  it("leaves Thai characters unchanged because they have no lowercase form", () => {
    expect(normalizeContentCategoryName("  พืชไร่  ")).toBe("พืชไร่");
  });

  it("collapses tabs and newlines inside the value", () => {
    expect(normalizeContentCategoryName("ปศุสัตว์\t\nประมง")).toBe("ปศุสัตว์ ประมง");
  });

  it("normalises compatibility characters via NFKC", () => {
    expect(normalizeContentCategoryName("\uFF21\uFF22")).toBe("ab");
  });

  it("maps names differing only by case and spacing to one key", () => {
    expect(normalizeContentCategoryName("A  B")).toBe(normalizeContentCategoryName("a b"));
  });
});

describe("seedContentCategories", () => {
  it("creates every category once, keyed by name", async () => {
    const created: { name: string; normalizedName: string }[] = [];
    const categories = await seedContentCategories(async (input) => {
      created.push(input);
      return `id-${created.length}`;
    });

    expect(created.map((input) => input.name)).toEqual([...CONTENT_CATEGORY_NAMES]);
    expect([...categories.keys()]).toEqual([...CONTENT_CATEGORY_NAMES]);
    expect(categories.get("พืชไร่")).toBe("id-1");
  });

  it("passes the normalized name alongside the display name", async () => {
    const created: { name: string; normalizedName: string }[] = [];
    await seedContentCategories(async (input) => {
      created.push(input);
      return "id";
    });

    for (const input of created) {
      expect(input.normalizedName).toBe(normalizeContentCategoryName(input.name));
    }
  });
});

describe("requireSeedCategoryId", () => {
  const categories = new Map([["พืชไร่", "category-id"]]);

  it("resolves a known name", () => {
    expect(requireSeedCategoryId(categories, "พืชไร่")).toBe("category-id");
  });

  it("trims the template value before looking it up", () => {
    expect(requireSeedCategoryId(categories, "  พืชไร่  ")).toBe("category-id");
  });

  it("throws when seed data drifts from the taxonomy", () => {
    expect(() => requireSeedCategoryId(categories, "พลังงาน")).toThrow(
      /Unknown seed category "พลังงาน"/,
    );
  });
});
