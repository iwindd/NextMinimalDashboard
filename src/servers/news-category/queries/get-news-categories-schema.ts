import { z } from "zod";

export const listNewsCategoriesSchema = z.object({
  search: z.string().trim().max(80).default(""),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
