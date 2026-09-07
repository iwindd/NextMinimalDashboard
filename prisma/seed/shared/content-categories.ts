/**
 * The News content taxonomy.
 *
 * The default seed creates every name here in all five category tables, so an
 * unused category still exists and stays selectable in the admin form and the
 * public filters. The mockup seed only reads them back.
 */
export const CONTENT_CATEGORY_NAMES = [
  "พืชไร่",
  "พืชสวน",
  "ปศุสัตว์/ประมง",
  "แมลงเศรษฐกิจ",
  "แปรรูป",
] as const;

/**
 * `normalizedName` is the unique key on every category table, so the order here
 * (NFKC, trim, whitespace collapse, lowercase) is what decides whether two names
 * are the same category.
 */
export function normalizeContentCategoryName(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("th");
}

/**
 * Creates all five categories through `create`, which owns the module specific
 * Prisma delegate and audit log entry, and returns them keyed by name.
 */
export async function seedContentCategories(
  create: (input: {
    name: string;
    normalizedName: string;
  }) => Promise<string>,
): Promise<Map<string, string>> {
  const categories = new Map<string, string>();

  for (const name of CONTENT_CATEGORY_NAMES) {
    categories.set(
      name,
      await create({ name, normalizedName: normalizeContentCategoryName(name) }),
    );
  }

  return categories;
}

/**
 * Reads the taxonomy back for a module that does not own it. The mockup seed
 * runs on top of the default seed, so a missing category is a setup mistake
 * rather than something to silently create: failing here keeps the mockup data
 * from inventing a sixth category that the admin forms never offer.
 */
export async function loadContentCategories(
  moduleLabel: string,
  find: (normalizedName: string) => Promise<string | null>,
): Promise<Map<string, string>> {
  const categories = new Map<string, string>();

  for (const name of CONTENT_CATEGORY_NAMES) {
    const categoryId = await find(normalizeContentCategoryName(name));
    if (!categoryId) {
      throw new Error(
        `ไม่พบหมวดหมู่ "${name}" ของ ${moduleLabel} กรุณารัน "npm run db:seed" ก่อนรัน mockup`,
      );
    }
    categories.set(name, categoryId);
  }

  return categories;
}

/**
 * Resolves a template's category, failing loudly rather than silently creating a
 * sixth category when seed data drifts from the taxonomy.
 */
export function requireSeedCategoryId(
  categories: Map<string, string>,
  name: string,
) {
  const categoryId = categories.get(name.trim());
  if (!categoryId) {
    throw new Error(
      `Unknown seed category "${name}". Expected one of: ${CONTENT_CATEGORY_NAMES.join(", ")}`,
    );
  }
  return categoryId;
}
