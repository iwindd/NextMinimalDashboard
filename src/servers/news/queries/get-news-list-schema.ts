import { z } from "zod";
import {
  categoryIdsFilterSchema,
  getCategoryIdsQueryInput,
} from "@/servers/shared/list-query";

const NEWS_STATUS_FILTER_VALUES = [
  "draft",
  "in_review",
  "republish",
  "changes_requested",
  "published",
  "archived",
] as const;

const newsStatusFilterSchema = z.enum(NEWS_STATUS_FILTER_VALUES);

function normalizeStatusInput(value: unknown) {
  const values = Array.isArray(value)
    ? value.flatMap((item) =>
        typeof item === "string" ? item.split(",") : [item],
      )
    : typeof value === "string"
      ? value.split(",")
      : value;

  if (!Array.isArray(values)) return values;

  const normalized = values.map((item) =>
    typeof item === "string" ? item.trim() : item,
  );
  if (normalized.length === 0) return "all";
  if (normalized.length === 1 && normalized[0] === "all") return "all";
  return normalized;
}

export const listNewsSchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(10),
  search: z.string().trim().max(100).default(""),
  categoryIds: categoryIdsFilterSchema,
  status: z
    .preprocess(
      normalizeStatusInput,
      z.union([z.literal("all"), z.array(newsStatusFilterSchema).min(1)]),
    )
    .default("all"),
  sortBy: z.enum(["status", "updatedAt", "viewCount", "createdAt"] as const).default("status"),
  sortDirection: z.enum(["asc", "desc"] as const).default("asc"),
});

export function getListNewsQueryInput(searchParams: URLSearchParams) {
  const input: Record<string, string | string[]> = Object.fromEntries(
    searchParams.entries(),
  );
  const statuses = searchParams.getAll("status");
  const categoryIds = getCategoryIdsQueryInput(searchParams);

  if (statuses.length > 1) input.status = statuses;
  if (categoryIds) input.categoryIds = categoryIds;
  return input;
}

export function parseListNewsQuery(searchParams: URLSearchParams) {
  const parsed = listNewsSchema.safeParse(getListNewsQueryInput(searchParams));
  return parsed.success ? parsed.data : listNewsSchema.parse({});
}
