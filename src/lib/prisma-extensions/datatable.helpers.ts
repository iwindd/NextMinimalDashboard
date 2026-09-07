import type { DatatableSearchConfig, DatatableSearchLeaf } from "./datatable.types";

function isSearchLeaf(value: unknown): value is DatatableSearchLeaf {
  return (
    typeof value === "object" &&
    value !== null &&
    ("mode" in value || "hasSome" in value)
  );
}

export function buildPrismaSearchOr(
  keyword: string,
  searchable: DatatableSearchConfig,
) {
  if (!keyword) {
    return [];
  }

  const conditions: Record<string, unknown>[] = [];

  const walk = (node: DatatableSearchConfig, path: string[] = []) => {
    for (const [key, value] of Object.entries(node)) {
      if (isSearchLeaf(value)) {
        const field = value.hasSome
          ? { hasSome: [keyword, ...value.hasSome] }
          : { contains: keyword };
        const condition = {
          [key]: {
            ...field,
            ...(value.mode ? { mode: value.mode } : {}),
          },
        };

        conditions.push(
          path.reduceRight<Record<string, unknown>>(
            (accumulator, pathKey) => ({ [pathKey]: accumulator }),
            condition,
          ),
        );
        continue;
      }

      walk(value, [...path, key]);
    }
  };

  walk(searchable);
  return conditions;
}

export function buildPrismaOrderBy(
  sortBy?: string,
  sortDirection: "asc" | "desc" = "desc",
) {
  if (!sortBy) {
    return undefined;
  }

  return [{ [sortBy]: sortDirection }];
}
