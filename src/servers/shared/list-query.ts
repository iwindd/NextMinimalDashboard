import { z } from "zod";

/**
 * Normalizes a datatable list-query filter that accepts multiple values.
 *
 * The same filter can arrive in three shapes:
 * - repeated search params (`?categoryIds=a&categoryIds=b`) collected into an array
 * - a comma separated string, which is how RTK Query serializes array params
 * - `undefined` when the filter is not applied
 */
function normalizeIdListInput(value: unknown) {
  if (value === undefined || value === null) return [];

  const values = Array.isArray(value)
    ? value.flatMap((item) =>
        typeof item === "string" ? item.split(",") : [item],
      )
    : typeof value === "string"
      ? value.split(",")
      : value;

  if (!Array.isArray(values)) return values;

  return values
    .map((item) => (typeof item === "string" ? item.trim() : item))
    .filter((item) => item !== "");
}

/**
 * Multi-select category filter shared by the admin content list schemas.
 * An empty array means "all categories".
 */
export const categoryIdsFilterSchema = z
  .preprocess(normalizeIdListInput, z.array(z.uuid()).max(50))
  .default([]);

/**
 * Collects the repeated `categoryIds` search params that
 * `Object.fromEntries(searchParams.entries())` would otherwise collapse
 * into a single value.
 */
export function getCategoryIdsQueryInput(searchParams: URLSearchParams) {
  const categoryIds = searchParams.getAll("categoryIds");
  return categoryIds.length > 1 ? categoryIds : undefined;
}
