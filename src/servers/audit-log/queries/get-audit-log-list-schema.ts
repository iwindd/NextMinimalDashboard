import { AuditAction, AuditResourceType } from "@prisma/client";
import { z } from "zod";

/** Filters that hold several values are transported as comma-separated lists. */
const MULTI_VALUE_SEPARATOR = ",";

function toEnumList(value: unknown) {
  if (typeof value !== "string") return value;

  return value
    .split(MULTI_VALUE_SEPARATOR)
    .map((item) => item.trim())
    .filter(Boolean);
}

function enumListSchema<T extends Record<string, string>>(enumObject: T) {
  return z.preprocess(
    toEnumList,
    z.array(z.enum(enumObject)).max(Object.keys(enumObject).length),
  );
}

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "วันที่ไม่ถูกต้อง");

export const listAuditLogsSchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
  search: z.string().trim().max(200).default(""),
  actions: enumListSchema(AuditAction).optional(),
  resourceTypes: enumListSchema(AuditResourceType).optional(),
  actorRole: z.enum(["ADMIN", "EDITOR"] as const).optional(),
  relationship: z.enum(["all", "actor", "target"] as const).default("all"),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  sortBy: z.enum(["createdAt"] as const).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"] as const).default("desc"),
});

export function parseListAuditLogsQuery(
  searchParams: URLSearchParams,
): z.infer<typeof listAuditLogsSchema> {
  const parsed = listAuditLogsSchema.safeParse(
    Object.fromEntries(searchParams.entries()),
  );

  return parsed.success ? parsed.data : listAuditLogsSchema.parse({});
}
