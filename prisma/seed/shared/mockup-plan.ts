import {
  MOCKUP_LIFECYCLE_STATES,
  type MockupLifecycleState,
} from "./lifecycle";
import { pick, type Random, shuffle } from "./random";

/** How many demonstration News records the seed creates. */
export const MOCKUP_CONTENT_COUNT = 300;

export type MockupSlot<Variant> = {
  state: MockupLifecycleState;
  category: string;
  /**
   * A module-specific axis can be added if the retained seed needs one.
   */
  variant: Variant;
};

/**
 * Builds the per-record plan for a module.
 *
 * Every combination of lifecycle state, category and module variant is emitted
 * once before anything is drawn at random, which is what guarantees "at least one
 * record in that situation" for every situation rather than hoping a random draw
 * happens to cover them. The remainder is random, and the whole list is then
 * shuffled so the guaranteed records are not all at the front.
 */
export function buildMockupSlots<Variant>(input: {
  count?: number;
  categories: readonly string[];
  /** Defaults to a single `null` axis for modules with no extra dimension. */
  variants?: readonly Variant[];
  states?: readonly MockupLifecycleState[];
  random?: Random;
}): MockupSlot<Variant>[] {
  const {
    count = MOCKUP_CONTENT_COUNT,
    categories,
    variants = [null as Variant],
    states = MOCKUP_LIFECYCLE_STATES,
    random = Math.random,
  } = input;

  if (categories.length === 0) throw new Error("ต้องมีหมวดหมู่อย่างน้อย 1 รายการ");
  if (variants.length === 0) throw new Error("ต้องมีตัวเลือกย่อยอย่างน้อย 1 รายการ");

  const required: MockupSlot<Variant>[] = [];
  for (const state of states) {
    for (const category of categories) {
      for (const variant of variants) {
        required.push({ state, category, variant });
      }
    }
  }

  if (count < required.length) {
    throw new Error(
      `จำนวนข้อมูล mockup ${count} รายการ ไม่พอสำหรับทุกสถานะ/หมวดหมู่/ตัวเลือก ${required.length} ชุด`,
    );
  }

  const filler = Array.from({ length: count - required.length }, () => ({
    state: pick(states, random),
    category: pick(categories, random),
    variant: pick(variants, random),
  }));

  return shuffle([...required, ...filler], random);
}

/**
 * Numbers the reuse of a template so repeated content is labelled as a set
 * ("ชุดที่ 3") instead of silently duplicating a title. The counter is shared by
 * a whole module run.
 */
export function createSetLabeller() {
  const counts = new Map<string, number>();

  return function labelFor(key: string) {
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    return { occurrence: next };
  };
}

/**
 * The first use of a template keeps the plain title; every reuse is numbered, so
 * 300 records built from a dozen templates stay distinguishable in the admin list
 * without inventing 300 headlines.
 */
export function setTitle(base: string, occurrence: number) {
  return occurrence === 1 ? base : `${base} ชุดที่ ${occurrence}`;
}
