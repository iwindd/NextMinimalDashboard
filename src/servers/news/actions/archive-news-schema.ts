import { newsIdSchema } from "../helpers";
import { z } from "zod";

export const archiveNewsSchema = newsIdSchema.extend({
  note: z
    .string()
    .trim()
    .max(500, "หมายเหตุต้องไม่เกิน 500 ตัวอักษร")
    .optional(),
});
